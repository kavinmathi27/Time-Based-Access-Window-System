const mongoose = require("mongoose");

const adminSchema = new mongoose.Schema(
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
            default: "ADMIN"
        }
    },
    { timestamps: true }
);

// Explicitly stored in 'admins' collection
module.exports = mongoose.model("Admin", adminSchema, "admins");
