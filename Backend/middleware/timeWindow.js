const AccessWindow = require("../models/AccessWindow");

const timeWindowMiddleware = async (req, res, next) => {
  try {
    // If user is admin, skip time check
    if (req.user.role === 'ADMIN') {
      return next();
    }

    const accessWindow = await AccessWindow.findOne({
      userId: req.user.id
    });

    if (!accessWindow) {
      return res.status(403).json({ message: "No access window assigned" });
    }

    const now = new Date();
    // Check if NOW is BEFORE start OR AFTER end
    if (now < new Date(accessWindow.startTime) || now > new Date(accessWindow.endTime)) {
      return res.status(403).json({
        message: "Access denied: You are outside your allowed access window."
      });
    }
    next();
  } catch (error) {
    console.error("Time window error:", error);
    res.status(500).json({ message: "Time validation failed" });
  }
};

module.exports = timeWindowMiddleware;
