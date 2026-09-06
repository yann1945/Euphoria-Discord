const { Schema, model } = require("mongoose");

const Prefix = new Schema({
  Guild: String,
  Prefix: String,
  oldPrefix: String,
  isUser: { type: Boolean, default: false },
});

Prefix.index({ Guild: 1, isUser: 1 }, { unique: true, sparse: true });

module.exports = model("prefix", Prefix);
