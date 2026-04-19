const mongoose = require("mongoose");

const ClienteSchema = new mongoose.Schema({
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
});

module.exports = mongoose.model("Cliente", ClienteSchema);