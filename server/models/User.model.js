const { Schema, model } = require("mongoose");

const UserSchema = new Schema({
  id: {
    type: String,
    required: true,
    unique: true,
  },
  secret: {
    type: String,
    required: true,
  },
  googleId: {
    type: String,
    unique: true,
    sparse: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const User = model("User", UserSchema);
// User.createIndexes(); // Removed side-effect
module.exports = User;
