const fs = require('fs');
const path = require('path');

const SESSIONS_DIR = path.join(__dirname, '.wwebjs_auth');

function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
    wait,
    SESSIONS_DIR
};