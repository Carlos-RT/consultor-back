const TelegramBot = require("node-telegram-bot-api");
const axios = require("axios");

const TOKEN = process.env.TELEGRAM_TOKEN;
const API_URL = process.env.BASE_URL;

const bot = new TelegramBot(TOKEN, { polling: false });

// 🧠 sesiones en memoria
const sesiones = {};

function initBot(app) {

    // ✅ WEBHOOK
    app.post("/telegram-webhook", (req, res) => {

        // 🔥 RESPONDER INMEDIATO (EVITA TIMEOUT)
        res.sendStatus(200);

        // 🔥 PROCESAR DESPUÉS
        procesarMensaje(req.body);

    });

}


// ===============================
// 🧠 LÓGICA DEL BOT
// ===============================
async function procesarMensaje(update) {

    try {

        if (!update.message) return;

        const chatId = update.message.chat.id;
        const text = update.message.text;

        console.log("📩 Mensaje:", text);

        // ======================
        // /start
        // ======================
        if (text === "/start") {

            return bot.sendMessage(chatId,
                "🤖 Bienvenido\n\n" +
                "Usa:\n" +
                "/login usuario password"
            );
        }

        // ======================
        // LOGIN
        // ======================
        if (text.startsWith("/login")) {

            const partes = text.split(" ");

            if (partes.length < 3) {
                return bot.sendMessage(chatId, "Uso: /login usuario password");
            }

            const usuario = partes[1];
            const password = partes[2];

            try {

                console.log("Intentando login:", usuario);

                const resLogin = await axios.post(`${API_URL}/login`, {
                    usuario,
                    password
                });

                const data = resLogin.data;

                // guardar sesión
                sesiones[chatId] = {
                    id: data.id,
                    nombre: data.nombre
                };

                return bot.sendMessage(chatId,
                    `✅ Bienvenido ${data.nombre}\n\n` +
                    "Comandos:\n" +
                    "/clientes\n" +
                    "/crear nombre1 nombre2 cedula telefono monto\n" +
                    "/pago cedula monto"
                );

            } catch (err) {

                console.error("ERROR LOGIN:", err.response?.data || err.message);

                return bot.sendMessage(chatId, "❌ Credenciales inválidas");
            }
        }

        // ======================
        // VER CLIENTES
        // ======================
        if (text === "/clientes") {

            if (!sesiones[chatId]) {
                return bot.sendMessage(chatId, "Primero debes hacer /login");
            }

            try {

                const resClientes = await axios.get(
                    `${API_URL}/clientes/${sesiones[chatId].id}`
                );

                const clientes = resClientes.data;

                if (clientes.length === 0) {
                    return bot.sendMessage(chatId, "No tienes clientes");
                }

                let mensaje = "📋 Tus clientes:\n\n";

                clientes.forEach(c => {
                    mensaje += `👤 ${c.primerNombre} ${c.segundoNombre}\n`;
                    mensaje += `🆔 ${c.cedula}\n`;
                    mensaje += `💰 ${c.deuda}\n\n`;
                });

                return bot.sendMessage(chatId, mensaje);

            } catch (error) {

                console.error("ERROR CLIENTES:", error.message);

                return bot.sendMessage(chatId, "Error obteniendo clientes");
            }
        }

        // ======================
        // CREAR CLIENTE
        // ======================
        if (text.startsWith("/crear")) {

            if (!sesiones[chatId]) {
                return bot.sendMessage(chatId, "Primero debes hacer /login");
            }

            const partes = text.split(" ");

            if (partes.length < 6) {
                return bot.sendMessage(chatId,
                    "Uso:\n/crear nombre1 nombre2 cedula telefono monto"
                );
            }

            const [_, p1, p2, cedula, telefono, monto] = partes;

            try {

                const res = await axios.post(`${API_URL}/cliente`, {
                    primerNombre: p1,
                    segundoNombre: p2,
                    cedula,
                    telefono,
                    monto: Number(monto),
                    cobradorId: sesiones[chatId].id
                });

                return bot.sendMessage(chatId, "✅ Cliente creado");

            } catch (error) {

                console.error("ERROR CREAR:", error.response?.data || error.message);

                return bot.sendMessage(chatId, "❌ Error creando cliente");
            }
        }

        // ======================
        // PAGO
        // ======================
        if (text.startsWith("/pago")) {

            if (!sesiones[chatId]) {
                return bot.sendMessage(chatId, "Primero debes hacer /login");
            }

            const partes = text.split(" ");

            if (partes.length < 3) {
                return bot.sendMessage(chatId, "Uso: /pago cedula monto");
            }

            const cedula = partes[1];
            const monto = Number(partes[2]);

            try {

                const res = await axios.put(`${API_URL}/pago/${cedula}`, {
                    abono: monto
                });

                return bot.sendMessage(chatId,
                    `💰 Pago aplicado\nNuevo saldo: ${res.data.nuevoSaldo}`
                );

            } catch (error) {

                console.error("ERROR PAGO:", error.response?.data || error.message);

                return bot.sendMessage(chatId, "Error en el pago");
            }
        }

    } catch (error) {

        console.error("ERROR GENERAL BOT:", error);
    }

}

module.exports = { initBot };