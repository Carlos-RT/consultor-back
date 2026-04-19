const mongoose = require("mongoose");

const CreditoSchema = new mongoose.Schema({
  cliente: { type: mongoose.Schema.Types.ObjectId, ref: "Cliente" },
  monto: Number,
  saldo: Number,
  fecha: Date
});

module.exports = mongoose.model("Credito", CreditoSchema);