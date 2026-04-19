require("dotenv").config()
const express = require("express")
const mongoose = require("mongoose")
const cors = require("cors")
const dns = require("dns")
const { initBot } = require("./chatbot");

const PORT = process.env.PORT || 3000;

const app = express()
app.use(cors())
app.use(express.json())
initBot(app);

dns.setServers(['1.1.1.1', '8.8.8.8'])

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB conectado"))
  .catch(err => console.error("Error Mongo:", err))


// =============================
// MODELOS
// =============================

const Usuario = mongoose.model("Usuario", {

  nombre: String,

  usuario: { type: String, unique: true },

  password: String,

  rol: {
    type: String,
    enum: ["superadmin", "admin", "cobrador"]
  },

  activo: { type: Boolean, default: true },

  oficina: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Oficina"
  }

})

const Cliente = mongoose.model("Cliente", {

  primerNombre: String,

  segundoNombre: String,

  cedula: String,

  telefono: String,

  cobrador: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Usuario"
  },

  oficina: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Oficina"
  }

})

const Credito = mongoose.model("Credito", {

  cliente: { type: mongoose.Schema.Types.ObjectId, ref: "Cliente" },
  monto: Number,
  saldo: Number,
  fecha: Date

})

const Oficina = mongoose.model("Oficina", {

  nombre: String,
  direccion: String,
  telefono: String,

  superAdmin: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Usuario"
  },

  fechaCreacion: {
    type: Date,
    default: Date.now
  }

})


// ENDPOINTS
// vvvvvvvvvvvvvvvvvvvvvvvvvvvvv




// =============================
// ADMINISTRADOR
// =============================

app.post("/crear-admin", async (req, res) => {

  try {

    const { nombre, usuario, password, oficinaId } = req.body

    const existe = await Usuario.findOne({ usuario })

    if (existe) {
      return res.status(400).json({ mensaje: "El usuario ya existe" })
    }

    const nuevo = new Usuario({
      nombre,
      usuario,
      password,
      rol: "admin",
      oficina: oficinaId
    })

    await nuevo.save()

    res.json({ mensaje: "Administrador creado correctamente" })

  } catch (error) {
    res.status(500).json({ error: "Error al crear administrador" })
  }

})



app.post("/login-admin", async (req, res) => {

  const { usuario, password } = req.body

  const admin = await Usuario.findOne({
    usuario,
    password,
    rol: "admin"
  }).populate("oficina")

  if (!admin) {
    return res.status(401).json({ mensaje: "Credenciales inválidas" })
  }

  res.json({
    id: admin._id,
    nombre: admin.nombre,
    oficinaId: admin.oficina ? admin.oficina._id : null,
    oficinaNombre: admin.oficina ? admin.oficina.nombre : "Sin oficina"
  })

})

// =============================
// CREAR SUPER ADMIN
// =============================

app.post("/crear-superadmin", async (req, res) => {

  try {

    const { nombre, usuario, password } = req.body

    const existe = await Usuario.findOne({ usuario })

    if (existe) {
      return res.status(400).json({ mensaje: "Usuario ya existe" })
    }

    const nuevo = new Usuario({
      nombre,
      usuario,
      password,
      rol: "superadmin"
    })

    await nuevo.save()

    res.json({ mensaje: "Super admin creado" })

  } catch (error) {

    res.status(500).json({ error: "Error creando super admin" })

  }

})

// =============================
// INICIAR SESION SUPER ADMIN
// =============================

app.post("/login-superadmin", async (req, res) => {

  const { usuario, password } = req.body

  const admin = await Usuario.findOne({
    usuario,
    password,
    rol: "superadmin"
  })

  if (!admin) {
    return res.status(401).json({ mensaje: "Credenciales inválidas" })
  }

  res.json({
    id: admin._id,
    nombre: admin.nombre
  })

})

// =============================
// CREAR OFICINA
// =============================

app.post("/oficina", async (req, res) => {

  try {

    const { nombre, direccion, telefono, superAdminId } = req.body

    const nueva = new Oficina({
      nombre,
      direccion,
      telefono,
      superAdmin: superAdminId
    })

    await nueva.save()

    res.json({ mensaje: "Oficina creada", oficina: nueva })

  } catch (error) {

    res.status(500).json({ error: "Error creando oficina" })

  }

})


// =============================
// CREAR SUPER OFICINA
// =============================

app.get("/oficinas/:superAdminId", async (req, res) => {

  try {

    const oficinas = await Oficina.find({
      superAdmin: req.params.superAdminId
    })

    res.json(oficinas)

  } catch (error) {

    res.status(500).json({ error: "Error obteniendo oficinas" })

  }

})

// =============================
// BORRAR OFICINA
// =============================

app.delete("/oficina/:id", async (req, res) => {

  try {

    const oficinaId = req.params.id

    const clientes = await Cliente.find({ oficina: oficinaId })

    const clientesIds = clientes.map(c => c._id)

    await Credito.deleteMany({ cliente: { $in: clientesIds } })

    await Cliente.deleteMany({ oficina: oficinaId })

    await Usuario.deleteMany({ oficina: oficinaId })

    await Oficina.findByIdAndDelete(oficinaId)

    res.json({ mensaje: "Oficina eliminada correctamente" })

  } catch (error) {

    res.status(500).json({ error: "Error eliminando oficina" })

  }

})

// =============================
// LOGIN COBRADOR
// =============================

app.post("/login", async (req, res) => {

  const { usuario, password } = req.body

  const cobrador = await Usuario.findOne({
    usuario,
    password,
    rol: "cobrador"
  })

  if (!cobrador) {
    return res.status(401).json({ mensaje: "Credenciales inválidas" })
  }

  if (!cobrador.activo) {
    return res.status(403).json({ mensaje: "Cuenta deshabilitada" })
  }

  res.json({ id: cobrador._id, nombre: cobrador.nombre })

})


// =============================
// COBRADORES
// =============================

app.post("/cobrador", async (req, res) => {

  try {

    const { nombre, usuario, password, oficinaId } = req.body

    const existe = await Usuario.findOne({ usuario })

    if (existe) {
      return res.status(400).json({ mensaje: "El usuario ya existe" })
    }

    const nuevo = new Usuario({
      nombre,
      usuario,
      password,
      rol: "cobrador",
      oficina: oficinaId
    })

    await nuevo.save()

    res.json({ mensaje: "Cobrador creado correctamente" })

  } catch (error) {
    res.status(500).json({ error: "Error al crear cobrador" })
  }

})


app.get("/cobrador/:usuario", async (req, res) => {

  try {

    const cobrador = await Usuario.findOne({
      usuario: req.params.usuario,
      rol: "cobrador"
    })

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


app.put("/cobrador/deshabilitar/:usuario", async (req, res) => {

  try {

    const cobrador = await Usuario.findOne({
      usuario: req.params.usuario,
      rol: "cobrador"
    })

    if (!cobrador) {
      return res.status(404).json({ mensaje: "Cobrador no encontrado" })
    }

    cobrador.activo = false
    await cobrador.save()

    res.json({ mensaje: "Cobrador deshabilitado correctamente" })

  } catch (error) {
    res.status(500).json({ error: "Error al deshabilitar" })
  }

})

// FILTRAR COBRADORES POR OFICINA 

app.get("/cobradores/:oficinaId", async (req, res) => {

  try {

    const cobradores = await Usuario.find({
      rol: "cobrador",
      oficina: req.params.oficinaId
    })

    res.json(cobradores)

  } catch (error) {

    res.status(500).json({ error: "Error obteniendo cobradores" })

  }

})


// =============================
// CLIENTES
// =============================

app.post("/cliente", async (req, res) => {

  try {

    const { primerNombre, segundoNombre, cedula, telefono, monto, cobradorId } = req.body

    // 🔒 VALIDAR CEDULA DUPLICADA
    const existeCliente = await Cliente.findOne({ cedula })

    if (existeCliente) {
      return res.status(400).json({ mensaje: "Ya existe un cliente con esa cédula" })
    }

    // 🔎 BUSCAR COBRADOR PARA SABER SU OFICINA
    const cobrador = await Usuario.findById(cobradorId)

    if (!cobrador) {
      return res.status(404).json({ mensaje: "Cobrador no encontrado" })
    }

    const cliente = new Cliente({
      primerNombre,
      segundoNombre,
      cedula,
      telefono,
      cobrador: cobradorId,
      oficina: cobrador.oficina   // 🔑 ESTA ES LA PARTE NUEVA
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


// =============================
// PAGOS
// =============================

app.put("/pago/:cedula", async (req, res) => {

  try {

    const { abono } = req.body

    const cliente = await Cliente.findOne({ cedula: req.params.cedula })
    if (!cliente) return res.status(404).json({ mensaje: "Cliente no encontrado" })

    const credito = await Credito.findOne({ cliente: cliente._id })
    if (!credito) return res.status(404).json({ mensaje: "Crédito no encontrado" })

    credito.saldo -= abono

    if (credito.saldo < 0) {
      credito.saldo = 0
    }

    await credito.save()

    res.json({ nuevoSaldo: credito.saldo })

  } catch (error) {
    res.status(500).json({ error: "Error al registrar pago" })
  }

})


app.put("/eliminar-deuda/:cedula", async (req, res) => {

  try {

    const cliente = await Cliente.findOne({ cedula: req.params.cedula })
    if (!cliente) return res.status(404).json({ mensaje: "Cliente no encontrado" })

    const credito = await Credito.findOne({ cliente: cliente._id })
    if (!credito) return res.status(404).json({ mensaje: "Crédito no encontrado" })

    credito.saldo = 0
    await credito.save()

    res.json({ mensaje: "Deuda eliminada" })

  } catch (error) {
    res.status(500).json({ error: "Error al eliminar deuda" })
  }

})


// =============================
// LOGISTICA
// =============================

app.get("/logistica/:oficinaId", async (req, res) => {

  try {

    const cobradores = await Usuario.find({
      rol: "cobrador",
      oficina: req.params.oficinaId
    })

    const resultado = []

    for (let cobrador of cobradores) {

      const clientes = await Cliente.find({ cobrador: cobrador._id })

      const clientesConDeuda = []

      for (let cliente of clientes) {

        const credito = await Credito.findOne({ cliente: cliente._id })

        clientesConDeuda.push({
          nombre: cliente.primerNombre + " " + cliente.segundoNombre,
          cedula: cliente.cedula,
          telefono: cliente.telefono,
          deuda: credito ? credito.saldo : 0,
          estado: credito && credito.saldo > 0 ? "Con deuda" : "Al día"
        })

      }

      resultado.push({
        usuario: cobrador.usuario,
        nombre: cobrador.nombre,
        activo: cobrador.activo,
        clientes: clientesConDeuda
      })

    }

    res.json(resultado)

  } catch (error) {

    res.status(500).json({ error: "Error en logística" })

  }

})


// =============================
// COBRADORES SELECT
// =============================

app.get("/cobradores", async (req, res) => {

  const cobradores = await Usuario.find({ rol: "cobrador" })
  res.json(cobradores)

})


// =============================
// CREAR CLIENTE ADMIN
// =============================

app.post("/crear-cliente-admin", async (req, res) => {

  const { primerNombre, segundoNombre, cedula, telefono, deuda, cobradorId } = req.body;

  try {

    // 🔒 VALIDAR CEDULA DUPLICADA
    const existeCliente = await Cliente.findOne({ cedula })

    if (existeCliente) {
      return res.status(400).json({ mensaje: "Ya existe un cliente con esa cédula" })
    }

    // 🔎 BUSCAR COBRADOR PARA OBTENER SU OFICINA
    const cobrador = await Usuario.findById(cobradorId)

    if (!cobrador) {
      return res.status(404).json({ mensaje: "Cobrador no encontrado" })
    }

    const nuevoCliente = new Cliente({
      primerNombre,
      segundoNombre,
      cedula,
      telefono,
      cobrador: cobradorId,
      oficina: cobrador.oficina   // 🔑 NUEVO CAMPO
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
// HEALTH CHECK
// =============================

app.get("/", (req, res) => {

  res.json({
    estado: "Servidor funcionando",
    entorno: process.env.VERCEL ? "Producción" : "Local"
  })

})

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`)
  })
}

module.exports = app