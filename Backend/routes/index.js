const express = require("express");
const router = express.Router();

const authController = require("../controllers/authController");
const adminController = require("../controllers/adminController");
const userController = require("../controllers/userController");

const auth = require("../middleware/auth");
const timeWindow = require("../middleware/timeWindow");

router.post("/register", authController.register);
router.post("/login", authController.login);

router.post("/admin/access-window", auth, adminController.setAccessWindow);
router.get("/admin/all-access-windows", auth, adminController.getAllAccessWindows);

router.get("/user/access-status", auth, timeWindow, userController.getAccessStatus);

router.get("/protected", auth, timeWindow, (req, res) => {
  res.json({ message: "Access granted" });
});

module.exports = router;
