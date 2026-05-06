const AccessWindow = require("../models/AccessWindow");

exports.getAccessStatus = async (req, res) => {
  try {
    const accessWindow = await AccessWindow.findOne({ userId: req.user.id });

    if (!accessWindow) {
      return res.json({ status: "No access window assigned" });
    }

    res.json({
      status: "active",
      startTime: accessWindow.startTime,
      endTime: accessWindow.endTime
    });
  } catch (err) {
    res.status(500).json({ message: "Failed to get access status" });
  }
};
