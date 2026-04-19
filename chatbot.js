const TelegramBot = require("node-telegram-bot-api");

const TOKEN = process.env.TELEGRAM_TOKEN;

// ⚠️ IMPORTANTE: NO usar polling ni setWebHook aquí
const bot = new TelegramBot(TOKEN, { polling: false });

// Función que procesa mensajes manualmente
function initBot(app) {

    app.post("/telegram-webhook", async (req, res) => {

        try {

            const update = req.body;

            if (update.message) {

                const chatId = update.message.chat.id;
                const text = update.message.text;

                console.log("📩 Mensaje recibido:", text);

                // =====================
                // COMANDOS
                // =====================

                if (text === "/start") {
                    await bot.sendMessage(chatId, "🤖 Bienvenido al bot de cobradores");
                }

                else if (text.startsWith("/login")) {

                    const partes = text.split(" ");

                    if (partes.length < 3) {
                        return bot.sendMessage(chatId, "Uso: /login usuario contraseña");
                    }

                    const usuario = partes[1];
                    const password = partes[2];

                    await bot.sendMessage(chatId, `Intentando login con ${usuario}...`);

                    // luego conectamos con tu backend

                }

            }

            res.sendStatus(200);

        } catch (error) {

            console.error("❌ Error en webhook:", error);
            res.sendStatus(500);

        }

    });

}

module.exports = { initBot };