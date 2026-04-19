const mongoose = require("mongoose");

const UsuarioSchema = new mongoose.Schema({
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
});

module.exports = mongoose.models.Usuario || mongoose.model("Usuario", UsuarioSchema);