const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { deleteSessionFolder } = require('./sessionManager');
const { getBlockedNumbers, fetchBlockedNumbersFromPostgres } = require('./blockedNumbers');
const { processMessage } = require('./messageProcessor');
const { wait } = require('./utils');
const pool = require('./db');

const clients = {};
const pendingQRCodes = {};

function initializeClient(clientId) {
    if (clients[clientId]) return;

    const client = new Client({
        authStrategy: new LocalAuth({ clientId }),
        puppeteer: {
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
            headless: true,
        }
    });

    const messageBuffers = new Map();
    const timers = new Map();
    const typingStates = new Map();
    const WAIT_BEFORE_PROCESSING = 10000;

    client.on('qr', (qr) => {
        qrcode.generate(qr, { small: true });
        pendingQRCodes[clientId] = qr;
    });

    client.on('ready', () => {
        delete pendingQRCodes[clientId];
        console.log(`✅ Cliente ${clientId} pronto.`);
    });

    client.on('auth_failure', () => {
        console.error(`❌ Autenticação falhou para ${clientId}`);
    });

    client.on('disconnected', async (reason) => {
        console.log(`⚠️ Cliente ${clientId} desconectado: ${reason}`);
        client.destroy();
        delete clients[clientId];
        deleteSessionFolder(clientId);
    
        const [botNumber] = clientId.split('-');
    
        try {
            await pool.query(`
                DELETE FROM blocked_number
                WHERE bot_id = (
                    SELECT id FROM bot WHERE number = $1
                )
            `, [botNumber]);

            await pool.query('DELETE FROM bot WHERE number = $1', [botNumber]);
        
            console.log(`🗑️ Bot ${botNumber} e seus números bloqueados foram removidos.`);
        } catch (err) {
            console.error(`❌ Erro ao deletar bot do banco:`, err.message);
        }
    });

    client.on('message', async (message) => {
        if (message.from.endsWith('@g.us') || message.from === 'status@broadcast') return;

        const blockedNumbers = getBlockedNumbers(clientId);

        const formattedNumber = `${message.from.split('@')[0]}`;

        if (blockedNumbers.includes(formattedNumber)) {
            console.log(`🚫 Mensagem ignorada de número bloqueado: ${formattedNumber}`);
            return;
        }

        const from = message.from;
        const now = Math.floor(Date.now() / 1000);
        if (now - message.timestamp > 5) return;

        if (!messageBuffers.has(from)) messageBuffers.set(from, []);
        messageBuffers.get(from).push(message.body);

        if (timers.has(from)) clearTimeout(timers.get(from));

        const processBufferedMessages = async () => {
            if (typingStates.get(from)) {
                const interval = setInterval(() => {
                    if (!typingStates.get(from)) {
                        clearInterval(interval);
                        processBufferedMessages();
                    }
                }, 1000);
                return;
            }

            const allMessages = messageBuffers.get(from).join(' ');
            messageBuffers.delete(from);
            timers.delete(from);

            const chat = await message.getChat();
            await chat.sendStateTyping();
            await wait(2000);
            const [bot_number, bot_name] = clientId.split("-");
            const reply = await processMessage(allMessages, from,bot_number,bot_name,formattedNumber);
            chat.sendMessage(reply);
        };

        const timer = setTimeout(processBufferedMessages, WAIT_BEFORE_PROCESSING);
        timers.set(from, timer);
    });

    client.on('typing', (chat) => typingStates.set(chat.id._serialized, true));
    client.on('typing-stopped', (chat) => typingStates.set(chat.id._serialized, false));

    client.initialize();
    clients[clientId] = client;

    fetchBlockedNumbersFromPostgres(clientId);
}

function restoreAllClients(savedSessions) {
    savedSessions.forEach(clientId => initializeClient(clientId));
}

function getClients() {
    return clients;
}

function getPendingQRCodes() {
    return pendingQRCodes;
}

module.exports = {
    initializeClient,
    restoreAllClients,
    getClients,
    getPendingQRCodes,
    clients
};
