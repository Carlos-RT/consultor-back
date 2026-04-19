const mongoose = require("mongoose");

const OficinaSchema = new mongoose.Schema({
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
});

module.exports = mongoose.models.Oficina || mongoose.model("Oficina", OficinaSchema);