const axios = require('axios');

async function processMessage(text, userId, bot_number,bot_name,formattedNumber) {
    try {
        const response = await axios.post('http://localhost:5000/chat', {
            number: bot_number,
            client_number: formattedNumber,
            bot_name: bot_name,
            prompt: text
        });

        return response.data.resposta.trim();
    } catch (err) {
        console.error(`Erro ao processar mensagem de ${userId}:`, err);
        return "Desculpa, não entendi!";
    }
}

module.exports = {
    processMessage
};
