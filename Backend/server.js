require("dotenv").config();
const express = require("express");
const cors = require("cors");
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

app.use("/api", require("./routes"));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
