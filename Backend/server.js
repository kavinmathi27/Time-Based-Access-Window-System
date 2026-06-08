require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const connectDB = require("./utils/db");

const app = express();

app.use(cors({
  origin: [
    "https://time-based-access-window-system.vercel.app",
    "http://localhost:5000",
    "http://localhost:3000"
  ],
  credentials: true
}));
app.use(express.json());

connectDB();

// Serve frontend statically (for local development)
app.use(express.static(path.join(__dirname, "../Frontend")));

app.use("/api", require("./routes"));

// Catch-all: serve index.html for any non-API route
app.get(/^(?!\/api).*/, (req, res) => {
  res.sendFile(path.join(__dirname, "../Frontend", "index.html"));
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
