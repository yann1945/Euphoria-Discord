const { Schema, model } = require("mongoose");

const aliasSchema = new Schema({
  userId: { type: String, required: true, index: true },
  prefix: { type: String, required: true },
  alias: { type: String, required: true },
  command: { type: String, required: true },
  updatedAt: { type: Date, default: Date.now },
});

aliasSchema.index({ userId: 1, prefix: 1, alias: 1 }, { unique: true });

module.exports = model("Alias", aliasSchema);
