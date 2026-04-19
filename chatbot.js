const TelegramBot = require("node-telegram-bot-api");

const TOKEN = process.env.TELEGRAM_TOKEN;

let bot;

// Inicializar bot en modo webhook
function initBot(app) {

    bot = new TelegramBot(TOKEN);

    const url = process.env.BASE_URL + "/bot" + TOKEN;

    // Configurar webhook
    bot.setWebHook(url);

    // Endpoint que Telegram usará
    app.post("/bot" + TOKEN, (req, res) => {
        bot.processUpdate(req.body);
        res.sendStatus(200);
    });

    // =========================
    // COMANDOS DEL BOT
    // =========================

    bot.onText(/\/start/, (msg) => {
        bot.sendMessage(msg.chat.id, "🤖 Bienvenido al bot de cobradores");
    });

    bot.onText(/\/login (.+) (.+)/, async (msg, match) => {

        const chatId = msg.chat.id;
        const usuario = match[1];
        const password = match[2];

        try {
            // Aquí llamaremos luego tu lógica real
            bot.sendMessage(chatId, `Intentando login con ${usuario}...`);

        } catch (error) {
            bot.sendMessage(chatId, "Error en login");
        }

    });

}

module.exports = { initBot };