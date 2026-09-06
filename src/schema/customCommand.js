const { Schema, model } = require("mongoose");

const customCommandSchema = new Schema({
  userId: { type: String, required: true, index: true },
  name: { type: String, required: true },
  response: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

customCommandSchema.index({ userId: 1, name: 1 }, { unique: true });

module.exports = model("CustomCommand", customCommandSchema);
