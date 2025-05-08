const pool = require('./db');

const blockedNumbersByClient = {}; // Armazena por clientId

// Requisição externa para buscar a lista de bloqueados
async function fetchBlockedNumbersFromPostgres(clientId) {
    try {
        const [botNumber] = clientId.split("-");

        const query = `
        SELECT bn.number
        FROM blocked_number bn
        JOIN bot b ON bn.bot_id = b.id
        WHERE b.number = $1
        `;
        const result = await pool.query(query, [botNumber]);
        const blockedNumbers = result.rows.map(row => row.number);

        blockedNumbersByClient[clientId] = blockedNumbers;

        console.log(`✅ Lista de bloqueados atualizada para o cliente ${clientId}:`, blockedNumbers);
    } catch (err) {
        console.error(`❌ Erro ao buscar números bloqueados do banco para ${clientId}:`, err.message);
    }
}

// Atualiza a lista manualmente via POST
function updateBlockedNumbers(clientId, blockedNumber) {
    if (!blockedNumbersByClient[clientId]) {
        blockedNumbersByClient[clientId] = [];
    }
    blockedNumbersByClient[clientId].push(blockedNumber);
    console.log(`✅ Lista de bloqueados atualizada via POST para ${clientId}:`, blockedNumbersByClient[clientId]);
}

function deleteBlockedNumbers(clientId, blockedNumber) {
    const numbers = blockedNumbersByClient[clientId];

    if (!numbers) {
        console.log(`Cliente ${clientId} não encontrado.`);
        return;
    }

    const index = numbers.indexOf(blockedNumber);
    if (index !== -1) {
        numbers.splice(index, 1);
        console.log(`Número ${blockedNumber} removido do cliente ${clientId}.`);
    } else {
        console.log(`Número ${blockedNumber} não está bloqueado para o cliente ${clientId}.`);
    }
}

// Retorna a lista para o clientId
function getBlockedNumbers(clientId) {
    return blockedNumbersByClient[clientId] || [];
}

module.exports = {
    fetchBlockedNumbersFromPostgres,
    updateBlockedNumbers,
    deleteBlockedNumbers,
    getBlockedNumbers
};
