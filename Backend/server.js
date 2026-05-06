require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const connectDB = require("./utils/db");

const app = express();

app.use(cors({ origin: "*" }));
app.use(express.json());

connectDB();

app.use(express.static(path.join(__dirname, "../Frontend")));
app.use("/api", require("./routes"));

app.get(/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, "../Frontend", "index.html"));
});

app.listen(5000, () => {
  console.log("Server running on port 5000");
});
