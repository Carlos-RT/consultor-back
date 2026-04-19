const TelegramBot = require("node-telegram-bot-api");

const TOKEN = process.env.TELEGRAM_TOKEN;
const API_URL = process.env.BASE_URL;
const axios = require("axios");

const bot = new TelegramBot(TOKEN, { polling: false });

// 🧠 sesiones en memoria
const sesiones = {};

function initBot(app) {

    app.post("/telegram-webhook", async (req, res) => {

        try {

            const update = req.body;

            if (update.message) {

                const chatId = update.message.chat.id;
                const text = update.message.text;

                console.log("📩", text);

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

                        const resLogin = await axios.post(`${API_URL}/login`, {
                            usuario,
                            password
                        });

                        if (!resLogin.data) {
                            return bot.sendMessage(chatId, "❌ Credenciales inválidas");
                        }

                        const data = resLogin.data;

                        // guardar sesión
                        sesiones[chatId] = {
                            id: data.id,
                            nombre: data.nombre
                        };

                        return bot.sendMessage(chatId,
                            `✅ Bienvenido ${data.nombre}\n\n` +
                            "Comandos disponibles:\n" +
                            "/clientes\n" +
                            "/crear\n" +
                            "/pago cedula monto"
                        );

                    } catch (err) {
                        console.error(err);
                        return bot.sendMessage(chatId, "Error conectando con el servidor");
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

                        const resClientes = await fetch(
                            `${API_URL}/clientes/${sesiones[chatId].id}`
                        );

                        const clientes = await resClientes.json();

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

                    return bot.sendMessage(chatId,
                        "Uso:\n" +
                        "/crear nombre1 nombre2 cedula telefono monto"
                    );
                }

                if (text.startsWith("/crear ")) {

                    const partes = text.split(" ");

                    if (partes.length < 6) {
                        return bot.sendMessage(chatId, "Formato incorrecto");
                    }

                    const [_, p1, p2, cedula, telefono, monto] = partes;

                    try {

                        const res = await fetch(`${API_URL}/cliente`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                primerNombre: p1,
                                segundoNombre: p2,
                                cedula,
                                telefono,
                                monto: Number(monto),
                                cobradorId: sesiones[chatId].id
                            })
                        });

                        if (res.ok) {
                            return bot.sendMessage(chatId, "✅ Cliente creado");
                        } else {
                            return bot.sendMessage(chatId, "❌ Error creando cliente");
                        }

                    } catch (error) {
                        return bot.sendMessage(chatId, "Error en servidor");
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

                        const res = await fetch(`${API_URL}/pago/${cedula}`, {
                            method: "PUT",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ abono: monto })
                        });

                        if (!res.ok) {
                            return bot.sendMessage(chatId, "Error en el pago");
                        }

                        const data = await res.json();

                        return bot.sendMessage(chatId,
                            `💰 Pago aplicado\nNuevo saldo: ${data.nuevoSaldo}`
                        );

                    } catch (error) {
                        return bot.sendMessage(chatId, "Error en servidor");
                    }
                }

            }

            res.sendStatus(200);

        } catch (error) {

            console.error(error);
            res.sendStatus(500);

        }

    });

}

module.exports = { initBot };