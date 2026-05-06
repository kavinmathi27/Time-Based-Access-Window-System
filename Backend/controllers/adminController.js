const AccessWindow = require("../models/AccessWindow");
const User = require("../models/User");

exports.setAccessWindow = async (req, res) => {
  const { email, startTime, endTime } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    const accessWindow = await AccessWindow.findOneAndUpdate(
      { userId: user._id },
      { startTime, endTime },
      { upsert: true, new: true }
    );

    res.json({ message: "Access window set successfully", accessWindow });
  } catch (err) {
    res.status(500).json({ message: "Failed to set access window" });
  }
};

exports.getAllAccessWindows = async (req, res) => {
  try {
    const windows = await AccessWindow.find().populate("userId", "email");
    const result = windows.map((w) => ({
      email: w.userId ? w.userId.email : "Unknown",
      startTime: w.startTime,
      endTime: w.endTime
    }));
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch access windows" });
  }
};
