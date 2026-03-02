require("dotenv").config()
const express = require("express")
const mongoose = require("mongoose")
const cors = require("cors")
const dns = require("dns")
const PORT = process.env.PORT || 3000;

const app = express()
app.use(cors())
app.use(express.json())

// DNS públicos
dns.setServers(['1.1.1.1', '8.8.8.8'])

// 🔌 Conexión MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB conectado'))
  .catch(err => console.error('Error Mongo:', err))

// =============================
// 📌 MODELOS
// =============================

const Cobrador = mongoose.model("Cobrador", {
  nombre: String,
  usuario: String,
  password: String,
  activo: { type: Boolean, default: true }
})

const Administrador = mongoose.model("Administrador", {
  nombre: String,
  usuario: String,
  password: String
})

const Cliente = mongoose.model("Cliente", {
  primerNombre: String,
  segundoNombre: String,
  cedula: String,
  telefono: String,
  cobrador: { type: mongoose.Schema.Types.ObjectId, ref: "Cobrador" }
})

const Credito = mongoose.model("Credito", {
  cliente: { type: mongoose.Schema.Types.ObjectId, ref: "Cliente" },
  monto: Number,
  saldo: Number,
  fecha: Date
})

// =============================
// 📌 ENDPOINTS
// =============================

// 🔹 Crear Administrador
app.post("/crear-admin", async (req, res) => {
  try {

    const { nombre, usuario, password } = req.body;

    const existeAdmin = await Administrador.findOne();

    if (existeAdmin) {
      return res.status(400).json({ mensaje: "Ya existe un administrador" });
    }

    const nuevo = new Administrador({ nombre, usuario, password });
    await nuevo.save();

    res.json({ mensaje: "Administrador creado correctamente" });

  } catch (error) {
    res.status(500).json({ error: "Error al crear administrador" });
  }
});

// 🔹 Iniciar Sesion en Dashboard
app.post("/login-admin", async (req, res) => {

  const { usuario, password } = req.body;

  const admin = await Administrador.findOne({ usuario, password });

  if (!admin) {
    return res.status(401).json({ mensaje: "Credenciales inválidas" });
  }

  res.json({ id: admin._id, nombre: admin.nombre });
});

// 🔹 Iniciar Sesion en movil
app.post("/login", async (req, res) => {

  const { usuario, password } = req.body

  const cobrador = await Cobrador.findOne({ usuario, password })

  if (!cobrador) {
    return res.status(401).json({ mensaje: "Credenciales inválidas" })
  }

  if (!cobrador.activo) {
    return res.status(403).json({ mensaje: "Cuenta deshabilitada por el administrador" })
  }

  res.json({ id: cobrador._id, nombre: cobrador.nombre })
})

// 🔹 Crear cobrador
app.post("/cobrador", async (req, res) => {
  try {

    const { nombre, usuario, password } = req.body;

    // Verificar si ya existe usuario
    const existeUsuario = await Cobrador.findOne({ usuario });

    if (existeUsuario) {
      return res.status(400).json({ mensaje: "El usuario ya existe" });
    }

    const nuevo = new Cobrador({ nombre, usuario, password });
    await nuevo.save();

    res.json({ mensaje: "Cobrador creado correctamente" });

  } catch (error) {
    res.status(500).json({ error: "Error al crear cobrador" });
  }
});

// 🔹 Buscar cobrador por usuario
app.get("/cobrador/:usuario", async (req, res) => {

  try {

    const cobrador = await Cobrador.findOne({ usuario: req.params.usuario })

    if (!cobrador) {
      return res.status(404).json({ mensaje: "Cobrador no encontrado" })
    }

    res.json({
      usuario: cobrador.usuario,
      nombre: cobrador.nombre,
      activo: cobrador.activo
    })

  } catch (error) {
    res.status(500).json({ error: "Error al buscar cobrador" })
  }
})

// 🔹 Deshabilitar cobrador
app.put("/cobrador/deshabilitar/:usuario", async (req, res) => {

  try {

    const cobrador = await Cobrador.findOne({ usuario: req.params.usuario })

    if (!cobrador) {
      return res.status(404).json({ mensaje: "Cobrador no encontrado" })
    }

    cobrador.activo = false
    await cobrador.save()

    res.json({ mensaje: "Cobrador deshabilitado correctamente" })

  } catch (error) {
    res.status(500).json({ error: "Error al deshabilitar cobrador" })
  }
})


// 🔹 Crear cliente + crédito
app.post("/cliente", async (req, res) => {
  try {
    const { primerNombre, segundoNombre, cedula, telefono, monto, cobradorId } = req.body

    const cliente = new Cliente({
      primerNombre,
      segundoNombre,
      cedula,
      telefono,
      cobrador: cobradorId
    })

    await cliente.save()

    const credito = new Credito({
      cliente: cliente._id,
      monto,
      saldo: monto,
      fecha: new Date()
    })

    await credito.save()

    res.json({ cliente, credito })

  } catch (error) {
    res.status(500).json({ error: "Error al crear cliente" })
  }
})

// 🔹 Eliminar deuda (poner saldo en 0)
app.put("/eliminar-deuda/:cedula", async (req, res) => {
  try {

    const cliente = await Cliente.findOne({ cedula: req.params.cedula });
    if (!cliente) return res.status(404).json({ mensaje: "Cliente no encontrado" });

    const credito = await Credito.findOne({ cliente: cliente._id });
    if (!credito) return res.status(404).json({ mensaje: "Crédito no encontrado" });

    credito.saldo = 0;
    await credito.save();

    res.json({ mensaje: "Deuda eliminada" });

  } catch (error) {
    res.status(500).json({ error: "Error al eliminar deuda" });
  }
});

// 🔹 Clientes por cobrador
app.get("/clientes/:cobradorId", async (req, res) => {

  const clientes = await Cliente.find({ cobrador: req.params.cobradorId })

  const resultado = []

  for (let cliente of clientes) {

    const credito = await Credito.findOne({ cliente: cliente._id })

    resultado.push({
      primerNombre: cliente.primerNombre,
      segundoNombre: cliente.segundoNombre,
      cedula: cliente.cedula,
      telefono: cliente.telefono,
      deuda: credito ? credito.saldo : 0
    })
  }

  res.json(resultado)
})

// 🔹 Buscar cliente por cédula (incluye saldo)
app.get("/cliente/:cedula", async (req, res) => {
  try {
    const cliente = await Cliente.findOne({ cedula: req.params.cedula })

    if (!cliente) {
      return res.status(404).json({ mensaje: "Cliente no encontrado" })
    }

    const credito = await Credito.findOne({ cliente: cliente._id })

    res.json({
      primerNombre: cliente.primerNombre,
      segundoNombre: cliente.segundoNombre,
      cedula: cliente.cedula,
      telefono: cliente.telefono,
      deuda: credito ? credito.saldo : 0
    })

  } catch (error) {
    res.status(500).json({ error: "Error al buscar cliente" })
  }
})


// 🔹 Actualizar saldo (cuando pague)
app.put("/pago/:cedula", async (req, res) => {
  try {
    const { abono } = req.body

    const cliente = await Cliente.findOne({ cedula: req.params.cedula })
    if (!cliente) return res.status(404).json({ mensaje: "No encontrado" })

    const credito = await Credito.findOne({ cliente: cliente._id })
    if (!credito) return res.status(404).json({ mensaje: "Crédito no encontrado" })

    credito.saldo -= abono
    await credito.save()

    res.json({ nuevoSaldo: credito.saldo })

  } catch (error) {
    res.status(500).json({ error: "Error al registrar pago" })
  }
})


// 🔹 Logística: Cobradores con sus clientes
app.get("/logistica", async (req, res) => {

  try {

    const cobradores = await Cobrador.find();

    const resultado = [];

    for (let cobrador of cobradores) {

      const clientes = await Cliente.find({ cobrador: cobrador._id });

      const clientesConDeuda = [];

      for (let cliente of clientes) {

        const credito = await Credito.findOne({ cliente: cliente._id });

        clientesConDeuda.push({
          nombre: cliente.primerNombre + " " + cliente.segundoNombre,
          cedula: cliente.cedula,
          telefono: cliente.telefono,
          deuda: credito ? credito.saldo : 0,
          estado: credito && credito.saldo > 0 ? "Con deuda" : "Al día"
        });
      }

      resultado.push({
        usuario: cobrador.usuario,
        nombre: cobrador.nombre,
        activo: cobrador.activo,
        clientes: clientesConDeuda
      });
    }

    res.json(resultado);

  } catch (error) {
    res.status(500).json({ error: "Error en logística" });
  }
});

// Cargar Cobradores select
app.get("/cobradores", async (req, res) => {
  const cobradores = await Cobrador.find();
  res.json(cobradores);
});

// Crear Cliente Con Asignacion
app.post("/crear-cliente-admin", async (req, res) => {

  const { primerNombre, segundoNombre, cedula, telefono, deuda, cobradorId } = req.body;

  try {

    const nuevoCliente = new Cliente({
      primerNombre,
      segundoNombre,
      cedula,
      telefono,
      cobrador: cobradorId
    });

    await nuevoCliente.save();

    const nuevoCredito = new Credito({
      cliente: nuevoCliente._id,
      saldo: deuda
    });

    await nuevoCredito.save();

    res.json({ mensaje: "Cliente creado correctamente" });

  } catch (error) {
    res.status(500).json({ error: "Error creando cliente" });
  }
});

// =============================
// 🩺 HEALTH CHECK
// =============================
app.get("/", (req, res) => {
  res.json({
    estado: "Servidor funcionando correctamente 🚀",
    entorno: process.env.VERCEL ? "Producción (Vercel)" : "Local",
  });
});

// =============================
// 🚀 INICIAR SERVIDOR LOCAL
// =============================
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
    console.log("Entorno actual:", "Local");
  });
}

module.exports = app;