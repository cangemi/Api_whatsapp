const fs = require('fs');
const path = require('path');
const { SESSIONS_DIR } = require('./utils');

function getSavedSessions() {
    if (!fs.existsSync(SESSIONS_DIR)) return [];

    return fs.readdirSync(SESSIONS_DIR)
        .filter(file => fs.lstatSync(path.join(SESSIONS_DIR, file)).isDirectory() && file.startsWith('session-'))
        .map(file => file.replace('session-', ''));
}

function deleteSessionFolder(clientId, retries = 5, delay = 5000) {
    const sessionPath = path.join(SESSIONS_DIR, `session-${clientId}`);
    let attempt = 1;

    const tryDelete = () => {
        if (!fs.existsSync(sessionPath)) return;

        try {
            fs.rmSync(sessionPath, { recursive: true, force: true });
            console.log(`🧹 Sessão ${clientId} apagada com sucesso.`);
        } catch (err) {
            if (attempt <= retries && err.code === 'EPERM') {
                attempt++;
                setTimeout(tryDelete, delay);
            } else {
                console.error(`❌ Falha ao apagar sessão ${clientId}:`, err.message);
            }
        }
    };

    setTimeout(tryDelete, 3000);
}

module.exports = {
    getSavedSessions,
    deleteSessionFolder
};
