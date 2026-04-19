const TelegramBot = require("node-telegram-bot-api");
const mongoose = require("mongoose");
require("dotenv").config();

// 🔥 IMPORTAR MODELOS (solo registrar)
require("./models/Usuario");
require("./models/Cliente");
require("./models/Credito");
require("./models/Oficina");

// 🔥 OBTENER MODELOS
const Usuario = mongoose.model("Usuario");
const Cliente = mongoose.model("Cliente");
const Credito = mongoose.model("Credito");

const TOKEN = process.env.TELEGRAM_TOKEN;
const bot = new TelegramBot(TOKEN, { polling: false });

// ⚠️ CONFIGURAR WEBHOOK (solo una vez)
bot.setWebHook("https://consultor-back.vercel.app/telegram-webhook");

// 🧠 sesiones en memoria
const sesiones = {};

// =============================
// 🔥 CONFIG MONGOOSE (MEJORA PERFORMANCE)
// =============================
mongoose.set("strictQuery", false);

// =============================
// 🔥 CONEXIÓN SEGURA A MONGO
// =============================
async function conectarDB() {
    if (mongoose.connection.readyState === 1) return;

    try {
        await mongoose.connect(process.env.MONGO_URI, {
            bufferCommands: false
        });
        console.log("✅ Mongo conectado desde chatbot");
    } catch (error) {
        console.error("❌ Error conectando a Mongo:", error);
        throw error;
    }
}

// =============================
// INICIALIZAR BOT (FIX PRINCIPAL)
// =============================
function initBot(app) {

    app.post("/telegram-webhook", async (req, res) => {

        try {
            await procesarMensaje(req.body); // 🔥 ESPERAR PROCESO
            res.sendStatus(200);
        } catch (error) {
            console.error("❌ Error webhook:", error);
            res.sendStatus(200); // Telegram siempre espera 200
        }

    });

}

// =============================
// LÓGICA PRINCIPAL
// =============================
async function procesarMensaje(update) {

    try {

        await conectarDB(); // 🔥 SOLO UNA VEZ

        if (!update.message || !update.message.text) return;

        const chatId = update.message.chat.id;
        const text = update.message.text.trim();

        console.log("📩", text);

        // ======================
        // START
        // ======================
        if (text === "/start") {
            return await bot.sendMessage(chatId,
                "🤖 Bienvenido al bot de cobradores\n\n" +
                "Usa:\n/login usuario password"
            );
        }

        // ======================
        // LOGIN
        // ======================
        if (text.startsWith("/login")) {

            const partes = text.split(" ");

            if (partes.length < 3) {
                return await bot.sendMessage(chatId, "Uso: /login usuario password");
            }

            const usuario = partes[1];
            const password = partes[2];

            const cobrador = await Usuario.findOne({
                usuario,
                password,
                rol: "cobrador"
            });

            if (!cobrador) {
                return await bot.sendMessage(chatId, "❌ Credenciales inválidas");
            }

            if (!cobrador.activo) {
                return await bot.sendMessage(chatId, "⛔ Cuenta deshabilitada");
            }

            sesiones[chatId] = {
                id: cobrador._id,
                nombre: cobrador.nombre
            };

            return await bot.sendMessage(chatId,
                `✅ Bienvenido ${cobrador.nombre}\n\n` +
                "📌 Comandos:\n" +
                "/clientes\n" +
                "/buscar cedula\n" +
                "/crear n1 n2 cedula tel monto\n" +
                "/eliminar cedula"
            );
        }

        // ======================
        // VER CLIENTES
        // ======================
        if (text === "/clientes") {

            if (!sesiones[chatId]) {
                return await bot.sendMessage(chatId, "Primero debes hacer /login");
            }

            const clientes = await Cliente.find({
                cobrador: sesiones[chatId].id
            });

            if (clientes.length === 0) {
                return await bot.sendMessage(chatId, "No tienes clientes");
            }

            let mensaje = "📋 Tus clientes:\n\n";

            for (let cliente of clientes) {

                const credito = await Credito.findOne({
                    cliente: cliente._id
                });

                const deuda = credito ? credito.saldo : 0;
                const estado = deuda > 0 ? "Pendiente" : "Pagado";

                mensaje += `👤 ${cliente.primerNombre} ${cliente.segundoNombre}\n`;
                mensaje += `🆔 ${cliente.cedula}\n`;
                mensaje += `💰 ${deuda} (${estado})\n\n`;
            }

            return await bot.sendMessage(chatId, mensaje);
        }

        // ======================
        // BUSCAR CLIENTE
        // ======================
        if (text.startsWith("/buscar")) {

            if (!sesiones[chatId]) {
                return await bot.sendMessage(chatId, "Primero debes hacer /login");
            }

            const partes = text.split(" ");

            if (partes.length < 2) {
                return await bot.sendMessage(chatId, "Uso: /buscar cedula");
            }

            const cedula = partes[1];

            const cliente = await Cliente.findOne({
                cedula,
                cobrador: sesiones[chatId].id
            });

            if (!cliente) {
                return await bot.sendMessage(chatId, "Cliente no encontrado");
            }

            const credito = await Credito.findOne({
                cliente: cliente._id
            });

            const deuda = credito ? credito.saldo : 0;
            const estado = deuda > 0 ? "Pendiente" : "Pagado";

            return await bot.sendMessage(chatId,
                `👤 ${cliente.primerNombre} ${cliente.segundoNombre}\n` +
                `🆔 ${cliente.cedula}\n` +
                `📞 ${cliente.telefono}\n` +
                `💰 Deuda: ${deuda}\n` +
                `📊 Estado: ${estado}`
            );
        }

        // ======================
        // CREAR CLIENTE
        // ======================
        if (text.startsWith("/crear")) {

            if (!sesiones[chatId]) {
                return await bot.sendMessage(chatId, "Primero debes hacer /login");
            }

            const partes = text.split(" ");

            if (partes.length < 6) {
                return await bot.sendMessage(chatId,
                    "Uso:\n/crear nombre1 nombre2 cedula telefono monto"
                );
            }

            const [_, p1, p2, cedula, telefono, monto] = partes;

            const existe = await Cliente.findOne({ cedula });

            if (existe) {
                return await bot.sendMessage(chatId, "❌ Ya existe esa cédula");
            }

            const cobrador = await Usuario.findById(sesiones[chatId].id);

            const cliente = new Cliente({
                primerNombre: p1,
                segundoNombre: p2,
                cedula,
                telefono,
                cobrador: cobrador._id,
                oficina: cobrador.oficina
            });

            await cliente.save();

            const credito = new Credito({
                cliente: cliente._id,
                monto: Number(monto),
                saldo: Number(monto),
                fecha: new Date()
            });

            await credito.save();

            return await bot.sendMessage(chatId, "✅ Cliente creado");
        }

        // ======================
        // ELIMINAR DEUDA
        // ======================
        if (text.startsWith("/eliminar")) {

            if (!sesiones[chatId]) {
                return await bot.sendMessage(chatId, "Primero debes hacer /login");
            }

            const partes = text.split(" ");

            if (partes.length < 2) {
                return await bot.sendMessage(chatId, "Uso: /eliminar cedula");
            }

            const cedula = partes[1];

            const cliente = await Cliente.findOne({
                cedula,
                cobrador: sesiones[chatId].id
            });

            if (!cliente) {
                return await bot.sendMessage(chatId, "Cliente no encontrado");
            }

            const credito = await Credito.findOne({
                cliente: cliente._id
            });

            if (!credito) {
                return await bot.sendMessage(chatId, "Crédito no encontrado");
            }

            credito.saldo = 0;
            await credito.save();

            return await bot.sendMessage(chatId, "✅ Cliente ahora está al día");
        }

    } catch (error) {
        console.error("❌ ERROR BOT:", error);
    }
}

module.exports = { initBot };