const TelegramBot = require("node-telegram-bot-api");
const mongoose = require("mongoose");

const TOKEN = process.env.TELEGRAM_TOKEN;

const bot = new TelegramBot(TOKEN, { polling: false });

// 🔗 usar modelos ya definidos en server.js
const Usuario = mongoose.model("Usuario");
const Cliente = mongoose.model("Cliente");
const Credito = mongoose.model("Credito");

// 🧠 sesiones en memoria
const sesiones = {};

// =============================
// INICIALIZAR BOT
// =============================
function initBot(app) {

    app.post("/telegram-webhook", (req, res) => {

        // 🔥 RESPUESTA INMEDIATA (EVITA TIMEOUT)
        res.sendStatus(200);

        procesarMensaje(req.body);

    });

}

// =============================
// LÓGICA PRINCIPAL
// =============================
async function procesarMensaje(update) {

    try {

        if (!update.message) return;

        const chatId = update.message.chat.id;
        const text = update.message.text;

        console.log("📩", text);

        // ======================
        // START
        // ======================
        if (text === "/start") {
            return bot.sendMessage(chatId,
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
                return bot.sendMessage(chatId, "Uso: /login usuario password");
            }

            const usuario = partes[1];
            const password = partes[2];

            try {

                const cobrador = await Usuario.findOne({
                    usuario,
                    password,
                    rol: "cobrador"
                });

                if (!cobrador) {
                    return bot.sendMessage(chatId, "❌ Credenciales inválidas");
                }

                if (!cobrador.activo) {
                    return bot.sendMessage(chatId, "⛔ Cuenta deshabilitada");
                }

                sesiones[chatId] = {
                    id: cobrador._id,
                    nombre: cobrador.nombre
                };

                return bot.sendMessage(chatId,
                    `✅ Bienvenido ${cobrador.nombre}\n\n` +
                    "📌 Comandos disponibles:\n\n" +
                    "/clientes → ver todos\n" +
                    "/buscar cedula → ver cliente\n" +
                    "/crear n1 n2 cedula tel monto\n" +
                    "/eliminar cedula → marcar como pagado"
                );

            } catch (error) {
                console.error(error);
                return bot.sendMessage(chatId, "Error en login");
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

                const clientes = await Cliente.find({
                    cobrador: sesiones[chatId].id
                });

                if (clientes.length === 0) {
                    return bot.sendMessage(chatId, "No tienes clientes");
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

                return bot.sendMessage(chatId, mensaje);

            } catch (error) {
                console.error(error);
                return bot.sendMessage(chatId, "Error obteniendo clientes");
            }
        }

        // ======================
        // BUSCAR CLIENTE
        // ======================
        if (text.startsWith("/buscar")) {

            if (!sesiones[chatId]) {
                return bot.sendMessage(chatId, "Primero debes hacer /login");
            }

            const partes = text.split(" ");

            if (partes.length < 2) {
                return bot.sendMessage(chatId, "Uso: /buscar cedula");
            }

            const cedula = partes[1];

            try {

                const cliente = await Cliente.findOne({
                    cedula,
                    cobrador: sesiones[chatId].id
                });

                if (!cliente) {
                    return bot.sendMessage(chatId, "Cliente no encontrado");
                }

                const credito = await Credito.findOne({
                    cliente: cliente._id
                });

                const deuda = credito ? credito.saldo : 0;
                const estado = deuda > 0 ? "Pendiente" : "Pagado";

                return bot.sendMessage(chatId,
                    `👤 ${cliente.primerNombre} ${cliente.segundoNombre}\n` +
                    `🆔 ${cliente.cedula}\n` +
                    `📞 ${cliente.telefono}\n` +
                    `💰 Deuda: ${deuda}\n` +
                    `📊 Estado: ${estado}`
                );

            } catch (error) {
                console.error(error);
                return bot.sendMessage(chatId, "Error buscando cliente");
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

                const existe = await Cliente.findOne({ cedula });

                if (existe) {
                    return bot.sendMessage(chatId, "❌ Ya existe un cliente con esa cédula");
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

                return bot.sendMessage(chatId, "✅ Cliente creado correctamente");

            } catch (error) {
                console.error(error);
                return bot.sendMessage(chatId, "Error creando cliente");
            }
        }

        // ======================
        // ELIMINAR DEUDA (PAGO COMPLETO)
        // ======================
        if (text.startsWith("/eliminar")) {

            if (!sesiones[chatId]) {
                return bot.sendMessage(chatId, "Primero debes hacer /login");
            }

            const partes = text.split(" ");

            if (partes.length < 2) {
                return bot.sendMessage(chatId, "Uso: /eliminar cedula");
            }

            const cedula = partes[1];

            try {

                const cliente = await Cliente.findOne({
                    cedula,
                    cobrador: sesiones[chatId].id
                });

                if (!cliente) {
                    return bot.sendMessage(chatId, "Cliente no encontrado");
                }

                const credito = await Credito.findOne({
                    cliente: cliente._id
                });

                if (!credito) {
                    return bot.sendMessage(chatId, "Crédito no encontrado");
                }

                credito.saldo = 0;
                await credito.save();

                return bot.sendMessage(chatId,
                    "✅ Pago registrado correctamente\nEl cliente ahora está al día"
                );

            } catch (error) {
                console.error(error);
                return bot.sendMessage(chatId, "Error eliminando deuda");
            }
        }

    } catch (error) {
        console.error("ERROR BOT:", error);
    }
}

module.exports = { initBot };