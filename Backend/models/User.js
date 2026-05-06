const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true
    },
    password: {
      type: String,
      required: true
    },
    role: {
      type: String,
      default: "USER"
    }
  },
  { timestamps: true }
);

// Explicitly stored in 'users' collection
module.exports = mongoose.model("User", userSchema, "users");
