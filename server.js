const express = require('express');
const { getSavedSessions, deleteSessionFolder } = require('./sessionManager');
const { initializeClient, restoreAllClients, getClients, getPendingQRCodes } = require('./whatsappManager');
const { updateBlockedNumbers,deleteBlockedNumbers } = require('./blockedNumbers');
const whatsappManager = require('./whatsappManager');

const app = express();
app.use(express.json());

const PORT = 3000;

app.post('/session', async (req, res) => {
    const { clientId } = req.body;

    if (!clientId) return res.status(400).json({ error: 'clientId é obrigatório.' });
    if (getClients()[clientId]) return res.status(400).json({ error: 'Cliente já está ativo.' });

    initializeClient(clientId);

    const waitForQR = new Promise((resolve, reject) => {
        const timeout = 10000;
        const interval = 200;
        let waited = 0;

        const check = () => {
            const qr = getPendingQRCodes()[clientId];
            if (qr) resolve(qr);
            else if (waited >= timeout) reject(new Error('Tempo esgotado esperando o QR code.'));
            else {
                waited += interval;
                setTimeout(check, interval);
            }
        };

        check();
    });

    try {
        const qrCode = await waitForQR;
        res.status(200).json({ qrCode });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/delete/:clientId', (req, res) => {
    const { clientId } = req.params;
    const { blockedNumber } = req.body;
    deleteBlockedNumbers(clientId,blockedNumber);

    res.json({ message: `${clientId} deletado` });
});

app.get('/sessions', (req, res) => {
    const saved = getSavedSessions();
    const active = Object.keys(getClients());
    res.json(saved.map(id => ({ clientId: id, isActive: active.includes(id) })));
});


app.post('/update-blocked/:clientId', (req, res) => {
    const { clientId } = req.params;
    const { blockedNumber } = req.body;

    updateBlockedNumbers(clientId, blockedNumber);
    res.json({ message: `Lista atualizada para cliente ${clientId}` });
});


app.delete('/session/delete/:clientId', (req, res) => {
    const { clientId } = req.params;
    const clients = whatsappManager.getClients();
    if (!clients[clientId]) {
        return res.status(404).json({ error: `Cliente ${clientId} não encontrado` });
    }
    clients[clientId].destroy();
    delete clients[clientId];
    deleteSessionFolder(clientId);
    res.json({ message: `Cliente ${clientId} deletado` });
});

app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
    restoreAllClients(getSavedSessions());
});
