# Time-Based Access Window System — All Code

---

## Backend/server.js

```javascript
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
```

---

## Backend/utils/db.js

```javascript
const mongoose = require("mongoose");
const dns = require("dns");

dns.setServers(["8.8.8.8", "8.8.4.4"]);

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB connected");
  } catch (error) {
    console.error("MongoDB connection failed:", error.message);
    process.exit(1);
  }
};

module.exports = connectDB;
```

---

## Backend/models/User.js

```javascript
const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      trim: true
    },
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

module.exports = mongoose.model("User", userSchema, "users");
```

---

## Backend/models/Admin.js

```javascript
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

module.exports = mongoose.model("Admin", adminSchema, "admins");
```

---

## Backend/models/AccessWindow.js

```javascript
const mongoose = require("mongoose");

const accessWindowSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    startTime: {
      type: Date,
      required: true
    },
    endTime: {
      type: Date,
      required: true
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("AccessWindow", accessWindowSchema);
```

---

## Backend/controllers/authController.js

```javascript
const User = require("../models/User");
const Admin = require("../models/Admin");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const register = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password required" });
    }

    const isAdmin = role === "ADMIN";
    const Model = isAdmin ? Admin : User;

    const existing = await Model.findOne({ email });
    if (existing) {
      return res.status(400).json({ message: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const userData = { email, password: hashedPassword, role: isAdmin ? "ADMIN" : "USER" };
    if (name && !isAdmin) userData.name = name.trim();
    await Model.create(userData);

    res.status(201).json({ message: `${isAdmin ? "Admin" : "User"} registered successfully` });
  } catch (err) {
    res.status(500).json({ message: "Registration failed" });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    let user = await Admin.findOne({ email });
    if (!user) user = await User.findOne({ email });

    if (!user) return res.status(400).json({ message: "Invalid credentials" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: "Invalid credentials" });

    const token = jwt.sign(
      { id: user._id, role: user.role, name: user.name || user.email },
      process.env.JWT_SECRET,
      { expiresIn: "8h" }
    );

    res.json({ token, role: user.role, name: user.name || user.email });
  } catch (err) {
    res.status(500).json({ message: "Login failed" });
  }
};

module.exports = { register, login };
```

---

## Backend/controllers/adminController.js

```javascript
const AccessWindow = require("../models/AccessWindow");
const User = require("../models/User");

exports.setAccessWindow = async (req, res) => {
  const { email, startTime, endTime } = req.body;

  if (!email || !startTime || !endTime) {
    return res.status(400).json({ message: "Email, startTime, and endTime are required" });
  }

  const start = new Date(startTime);
  const end = new Date(endTime);

  if (isNaN(start) || isNaN(end)) {
    return res.status(400).json({ message: "Invalid date format for startTime or endTime" });
  }

  if (start >= end) {
    return res.status(400).json({ message: "startTime must be before endTime" });
  }

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    const accessWindow = await AccessWindow.findOneAndUpdate(
      { userId: user._id },
      { startTime: start, endTime: end },
      { upsert: true, new: true }
    );

    res.json({ message: "Access window set successfully", accessWindow });
  } catch (err) {
    res.status(500).json({ message: "Failed to set access window" });
  }
};

exports.getAllAccessWindows = async (req, res) => {
  try {
    const windows = await AccessWindow.find().populate("userId", "email name");
    const result = windows.map((w) => ({
      email: w.userId ? w.userId.email : "Unknown",
      name: w.userId ? (w.userId.name || w.userId.email) : "Unknown",
      startTime: w.startTime,
      endTime: w.endTime
    }));
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch access windows" });
  }
};
```

---

## Backend/controllers/userController.js

```javascript
const AccessWindow = require("../models/AccessWindow");

exports.getAccessStatus = async (req, res) => {
  try {
    const accessWindow = await AccessWindow.findOne({ userId: req.user.id });

    if (!accessWindow) {
      return res.status(403).json({ status: "none", message: "No access window assigned. Contact your admin." });
    }

    const now = new Date();
    const start = new Date(accessWindow.startTime);
    const end = new Date(accessWindow.endTime);

    if (now < start) {
      return res.status(403).json({
        status: "upcoming",
        message: `Your shift starts at ${start.toLocaleString()}`,
        startTime: accessWindow.startTime,
        endTime: accessWindow.endTime
      });
    }

    if (now > end) {
      return res.status(403).json({
        status: "expired",
        message: `Your shift ended at ${end.toLocaleString()}`,
        startTime: accessWindow.startTime,
        endTime: accessWindow.endTime
      });
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
```

---

## Backend/middleware/auth.js

```javascript
const jwt = require("jsonwebtoken");

const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "No token provided" });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ message: "Invalid token" });
  }
};

module.exports = authMiddleware;
```

---

## Backend/middleware/isAdmin.js

```javascript
const isAdmin = (req, res, next) => {
  if (req.user && req.user.role === "ADMIN") {
    return next();
  }
  return res.status(403).json({ message: "Access denied: Admins only" });
};

module.exports = isAdmin;
```

---

## Backend/middleware/timeWindow.js

```javascript
const AccessWindow = require("../models/AccessWindow");

const timeWindowMiddleware = async (req, res, next) => {
  try {
    if (req.user.role === "ADMIN") {
      return next();
    }

    const accessWindow = await AccessWindow.findOne({ userId: req.user.id });

    if (!accessWindow) {
      return res.status(403).json({ message: "No access window assigned" });
    }

    const now = new Date();
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
```

---

## Backend/routes/index.js

```javascript
const express = require("express");
const router = express.Router();

const authController = require("../controllers/authController");
const adminController = require("../controllers/adminController");
const userController = require("../controllers/userController");

const auth = require("../middleware/auth");
const isAdmin = require("../middleware/isAdmin");
const timeWindow = require("../middleware/timeWindow");

router.post("/register", authController.register);
router.post("/login", authController.login);

router.post("/admin/access-window", auth, isAdmin, adminController.setAccessWindow);
router.get("/admin/all-access-windows", auth, isAdmin, adminController.getAllAccessWindows);

router.get("/user/access-status", auth, userController.getAccessStatus);

router.get("/protected", auth, timeWindow, (req, res) => {
  res.json({ message: "Access granted" });
});

module.exports = router;
```

---

## Backend/.env

```
PORT=5000
MONGO_URI=mongodb+srv://kavinmathi:kavinmathi27@cluster0.qyvrty8.mongodb.net/timebasedaccess?retryWrites=true&w=majority&appName=Cluster0
JWT_SECRET=supersecretkey
```

---

## Backend/package.json

```json
{
  "name": "access-window-backend",
  "version": "1.0.0",
  "main": "server.js",
  "scripts": {
    "start": "node server.js"
  },
  "dependencies": {
    "bcryptjs": "^3.0.3",
    "cors": "^2.8.6",
    "dotenv": "^16.6.1",
    "express": "^5.2.1",
    "jsonwebtoken": "^9.0.3",
    "mongoose": "^8.22.1"
  }
}
```

---

## Frontend/index.html

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Time-Based Access Control</title>
  <link rel="stylesheet" href="assets/css/style.css">
</head>
<body>
  <div class="navbar">
    <a href="#" class="brand">AccessControl</a>
    <div class="links">
      <a href="auth/login.html">Login</a>
      <a href="auth/register.html">Register</a>
    </div>
  </div>

  <div class="hero">
    <h1>Precision Access,<br>Perfectly Timed.</h1>
    <p>Secure your premises with time-based access control. Grant permissions that expire automatically.</p>
    <div class="hero-buttons">
      <a href="auth/login.html"><button>Get Started</button></a>
      <a href="auth/register.html"><button class="btn-secondary">Register</button></a>
    </div>
  </div>

  <script>
    const token = localStorage.getItem("token");
    if (token) {
      const payload = JSON.parse(atob(token.split('.')[1]));
      window.location.href = payload.role === "ADMIN" ? "admin/dashboard.html" : "user/dashboard.html";
    }
  </script>
</body>
</html>
```

---

## Frontend/auth/login.html

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Login | AccessControl</title>
  <link rel="stylesheet" href="../assets/css/style.css">
</head>
<body>
  <div class="navbar">
    <a href="../index.html" class="brand">AccessControl</a>
  </div>

  <div class="container">
    <h2>Welcome Back</h2>
    <p class="text-muted" style="margin-bottom: 1.5rem;">Enter your credentials to access your account.</p>

    <input id="email" type="email" placeholder="Email Address">
    <input id="password" type="password" placeholder="Password">

    <button onclick="login()">Sign In</button>

    <p class="mt-4 text-sm text-muted">
      Don't have an account? <a href="register.html">Register here</a>
    </p>
  </div>

  <script src="../assets/js/api.js"></script>
  <script src="auth.js"></script>
</body>
</html>
```

---

## Frontend/auth/register.html

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Register | AccessControl</title>
  <link rel="stylesheet" href="../assets/css/style.css">
</head>
<body>
  <div class="navbar">
    <a href="../index.html" class="brand">AccessControl</a>
  </div>

  <div class="container">
    <h2>Create Account</h2>
    <p class="text-muted" style="margin-bottom: 1.5rem;">Join us to manage your access securely.</p>

    <input id="name" type="text" placeholder="Full Name">
    <input id="email" type="email" placeholder="Email Address">
    <input id="password" type="password" placeholder="Password">

    <select id="role">
      <option value="USER">User</option>
      <option value="ADMIN">Admin</option>
    </select>

    <button onclick="register()">Create Account</button>

    <p class="mt-4 text-sm text-muted">
      Already have an account? <a href="login.html">Sign in here</a>
    </p>
  </div>

  <script src="../assets/js/api.js"></script>
  <script src="auth.js"></script>
</body>
</html>
```

---

## Frontend/auth/auth.js

```javascript
async function login() {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  try {
    const res = await fetch(`${BASE_URL}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();

    if (res.ok) {
      saveToken(data.token);
      window.location.href = data.role === "ADMIN" ? "../admin/dashboard.html" : "../user/dashboard.html";
    } else {
      alert(data.message || "Login failed");
    }
  } catch (error) {
    alert("Cannot connect to server. Ensure the backend is running.");
  }
}

async function register() {
  const name = document.getElementById("name").value;
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  const role = document.getElementById("role")?.value || "USER";

  try {
    const res = await fetch(`${BASE_URL}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password, role })
    });

    const data = await res.json();

    if (res.ok) {
      alert("Registered successfully");
      window.location.href = "login.html";
    } else {
      alert(data.message || "Registration failed");
    }
  } catch (error) {
    alert("Cannot connect to server. Ensure the backend is running.");
  }
}
```

---

## Frontend/admin/dashboard.html

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Admin Dashboard | AccessControl</title>
  <link rel="stylesheet" href="../assets/css/style.css">
</head>
<body onload="loadAdmin()">

  <div class="navbar">
    <a href="#" class="brand">AccessControl <span class="text-sm text-muted">| Admin</span></a>
    <a href="#" onclick="logout()" class="text-muted">Logout</a>
  </div>

  <div class="dashboard-container">
    <div class="welcome-banner">
      <h2>Admin Dashboard</h2>
      <p class="text-muted">Manage user access windows.</p>
    </div>

    <div class="app-grid">
      <div class="card">
        <h3>Set Access Window</h3>
        <p class="text-muted" style="margin-bottom:1.5rem;">Assign working hours for a user.</p>
        <label>User Email</label>
        <input id="userEmail" type="email" placeholder="Enter user email">
        <label>Start Time</label>
        <input id="startTime" type="datetime-local">
        <label>End Time</label>
        <input id="endTime" type="datetime-local">
        <button onclick="setAccess()">Update Access Window</button>
      </div>

      <div class="card">
        <h3>Server Time</h3>
        <p class="text-muted">Current local time.</p>
        <div id="server-time" style="font-size:2.5rem; font-weight:700; color:var(--primary); margin-top:2rem;">--:--:--</div>
      </div>
    </div>

    <div class="card" style="margin-top:2rem;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem;">
        <h3 style="margin:0;">All Access Windows</h3>
        <button onclick="loadAllUsers()" style="width:auto; padding:0.5rem 1.25rem; font-size:0.85rem;">↻ Refresh</button>
      </div>
      <div style="overflow-x:auto;">
        <table style="width:100%; border-collapse:collapse; font-size:0.9rem;">
          <thead>
            <tr style="border-bottom:1px solid var(--border); text-align:left; color:var(--text-muted);">
              <th style="padding:0.75rem 1rem;">Name</th>
              <th style="padding:0.75rem 1rem;">Email</th>
              <th style="padding:0.75rem 1rem;">Start Time</th>
              <th style="padding:0.75rem 1rem;">End Time</th>
              <th style="padding:0.75rem 1rem;">Status</th>
            </tr>
          </thead>
          <tbody id="users-table-body">
            <tr><td colspan="5" style="padding:1.5rem; text-align:center; color:var(--text-muted);">Loading...</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>

  <script src="../assets/js/api.js"></script>
  <script src="../assets/js/utils.js"></script>
  <script src="admin.js"></script>
</body>
</html>
```

---

## Frontend/admin/admin.js

```javascript
function loadAdmin() {
  checkAuth();
  const payload = decodeJWT(getToken());
  if (payload.role !== "ADMIN") {
    alert("Access denied");
    window.location.href = "../user/dashboard.html";
    return;
  }
  loadAllUsers();
  setInterval(() => {
    document.getElementById("server-time").innerText = new Date().toLocaleTimeString();
  }, 1000);
}

async function setAccess() {
  const email = document.getElementById("userEmail").value;
  const startRaw = document.getElementById("startTime").value;
  const endRaw = document.getElementById("endTime").value;

  if (!email || !startRaw || !endRaw) {
    alert("Please fill in all fields.");
    return;
  }

  const res = await apiRequest("/admin/access-window", "POST", {
    email,
    startTime: new Date(startRaw).toISOString(),
    endTime: new Date(endRaw).toISOString()
  });

  const data = await res.json();
  alert(data.message);
  if (res.ok) loadAllUsers();
}

async function loadAllUsers() {
  const tbody = document.getElementById("users-table-body");
  tbody.innerHTML = `<tr><td colspan="5" style="padding:1.5rem;text-align:center;color:var(--text-muted);">Loading...</td></tr>`;

  try {
    const res = await apiRequest("/admin/all-access-windows");
    const data = await res.json();

    if (!res.ok) {
      tbody.innerHTML = `<tr><td colspan="5" style="padding:1.5rem;text-align:center;color:#ef4444;">Failed to load data.</td></tr>`;
      return;
    }

    if (data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="padding:1.5rem;text-align:center;color:var(--text-muted);">No access windows assigned yet.</td></tr>`;
      return;
    }

    const now = new Date();
    tbody.innerHTML = data.map(w => {
      const start = new Date(w.startTime);
      const end = new Date(w.endTime);
      let label, color;
      if (now >= start && now <= end)   { label = "● Active";   color = "#22c55e"; }
      else if (now < start)             { label = "◌ Upcoming"; color = "#f59e0b"; }
      else                              { label = "✕ Expired";  color = "#ef4444"; }

      return `<tr style="border-bottom:1px solid var(--border);">
        <td style="padding:0.85rem 1rem;">${w.name || "—"}</td>
        <td style="padding:0.85rem 1rem;">${w.email}</td>
        <td style="padding:0.85rem 1rem;">${start.toLocaleString()}</td>
        <td style="padding:0.85rem 1rem;">${end.toLocaleString()}</td>
        <td style="padding:0.85rem 1rem;font-weight:600;color:${color};">${label}</td>
      </tr>`;
    }).join("");

  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="5" style="padding:1.5rem;text-align:center;color:#ef4444;">Error connecting to server.</td></tr>`;
  }
}
```

---

## Frontend/user/dashboard.html

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>User Dashboard | AccessControl</title>
  <link rel="stylesheet" href="../assets/css/style.css">
</head>
<body onload="loadUser()">

  <div id="lock-screen" class="lock-screen">
    <div class="lock-icon">
      <svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
        <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
      </svg>
    </div>
    <h1>Access Restricted</h1>
    <p class="text-muted" id="lock-reason">You are outside your allowed access window. Please return during your scheduled shift.</p>
    <div class="card" style="max-width:400px; background:rgba(30,41,59,0.5); margin-top:1.5rem;">
      <p class="text-sm text-muted">Your Access Window</p>
      <div id="next-shift-info" style="font-size:1.1rem; font-weight:600; margin-top:0.5rem;">Contact Admin</div>
    </div>
    <button onclick="logout()" style="max-width:200px; margin-top:2rem; background:var(--border);">Logout</button>
  </div>

  <div id="office-dashboard" class="hidden">
    <div id="shift-warning" style="display:none; background:#92400e; color:#fef3c7; padding:0.75rem 1.5rem; font-weight:600; text-align:center; font-size:0.9rem;"></div>

    <div class="navbar">
      <a href="#" class="brand">AccessControl <span class="text-sm text-muted">| User</span></a>
      <div style="display:flex; gap:1rem; align-items:center;">
        <span id="shift-timer" class="text-sm text-muted" style="border:1px solid var(--border); padding:0.25rem 0.75rem; border-radius:99px;">Shift Active</span>
        <a href="#" onclick="logout()" class="text-muted">Logout</a>
      </div>
    </div>

    <div class="dashboard-container">
      <div class="welcome-banner">
        <h2 id="welcome-msg">Dashboard</h2>
        <p class="text-muted">You are logged in and your access window is active.</p>
      </div>

      <div class="app-grid">
        <div class="app-card">
          <div class="app-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
              <polyline points="22,6 12,13 2,6"></polyline>
            </svg>
          </div>
          <h3>Mail</h3>
          <p>Access your company email.</p>
          <span class="app-badge">Open</span>
        </div>

        <div class="app-card">
          <div class="app-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="16" y1="2" x2="16" y2="6"></line>
              <line x1="8" y1="2" x2="8" y2="6"></line>
              <line x1="3" y1="10" x2="21" y2="10"></line>
            </svg>
          </div>
          <h3>Calendar</h3>
          <p>View your schedule and meetings.</p>
          <span class="app-badge">Open</span>
        </div>

        <div class="app-card">
          <div class="app-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
              <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
          </div>
          <h3>Tasks</h3>
          <p>Track your assigned tasks.</p>
          <span class="app-badge">Open</span>
        </div>

        <div class="app-card">
          <div class="app-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
          </div>
          <h3>Team Chat</h3>
          <p>Communicate with your team.</p>
          <span class="app-badge">Open</span>
        </div>
      </div>
    </div>
  </div>

  <script src="../assets/js/api.js"></script>
  <script src="../assets/js/utils.js"></script>
  <script src="user.js"></script>
</body>
</html>
```

---

## Frontend/user/user.js

```javascript
async function loadUser() {
  checkAuth();

  try {
    const payload = decodeJWT(getToken());
    const name = payload.name || payload.email || "User";
    const el = document.getElementById("welcome-msg");
    if (el) el.innerText = `Welcome back, ${name}`;
  } catch (e) {}

  const res = await apiRequest("/user/access-status");
  const data = await res.json();

  const lockScreen = document.getElementById("lock-screen");
  const officeDashboard = document.getElementById("office-dashboard");

  if (res.ok && data.status === "active") {
    lockScreen.classList.add("hidden");
    officeDashboard.classList.remove("hidden");

    if (data.endTime) {
      startCountdown(new Date(data.endTime));
      startAccessPoller();
    }
  } else {
    lockScreen.classList.remove("hidden");
    officeDashboard.classList.add("hidden");

    const reasonEl = document.getElementById("lock-reason");
    const shiftEl = document.getElementById("next-shift-info");

    if (data.status === "upcoming") {
      if (reasonEl) reasonEl.innerText = "Your shift hasn't started yet. Please wait until your scheduled access window.";
      if (shiftEl && data.startTime) shiftEl.innerText = `Starts: ${new Date(data.startTime).toLocaleString()}`;
    } else if (data.status === "expired") {
      if (reasonEl) reasonEl.innerText = "Your shift has ended. Contact your admin to extend access.";
      if (shiftEl && data.endTime) shiftEl.innerText = `Ended: ${new Date(data.endTime).toLocaleString()}`;
    } else {
      if (shiftEl && data.message) shiftEl.innerText = data.message;
    }
  }
}

function startAccessPoller() {
  setInterval(async () => {
    try {
      const res = await apiRequest("/user/access-status");
      if (!res.ok) {
        alert("Your shift has ended. You will be logged out.");
        logout();
      }
    } catch (err) {
      console.error("Access poller error:", err);
    }
  }, 60000);
}

function startCountdown(endTime) {
  const timerEl = document.getElementById("shift-timer");
  const warningEl = document.getElementById("shift-warning");

  function tick() {
    const now = new Date();
    const diff = endTime - now;

    if (diff <= 0) {
      if (timerEl) timerEl.innerText = "Shift Ended";
      return;
    }

    const totalSeconds = Math.floor(diff / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    let display = "";
    if (hours > 0) display += `${hours}h `;
    display += `${minutes}m ${seconds}s`;

    if (timerEl) timerEl.innerText = `Shift ends in: ${display}`;

    if (warningEl) {
      if (totalSeconds <= 300) {
        warningEl.style.display = "block";
        warningEl.innerText = `⚠️ Your shift ends in ${minutes}m ${seconds}s. Please save your work.`;
      } else {
        warningEl.style.display = "none";
      }
    }
  }

  tick();
  setInterval(tick, 1000);
}
```

---

## Frontend/assets/js/api.js

```javascript
const BASE_URL = "http://localhost:5000/api";

function getToken() {
  return localStorage.getItem("token");
}

function saveToken(token) {
  localStorage.setItem("token", token);
}

function logout() {
  localStorage.clear();
  const depth = window.location.pathname.split("/").filter(Boolean).length;
  const prefix = depth > 1 ? "../".repeat(depth - 1) : "";
  window.location.href = prefix + "auth/login.html";
}

async function apiRequest(endpoint, method = "GET", body = null) {
  const options = {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + getToken()
    }
  };
  if (body) options.body = JSON.stringify(body);
  return fetch(BASE_URL + endpoint, options);
}
```

---

## Frontend/assets/js/utils.js

```javascript
function decodeJWT(token) {
  return JSON.parse(atob(token.split('.')[1]));
}

function checkAuth() {
  if (!localStorage.getItem("token")) {
    const depth = window.location.pathname.split("/").filter(Boolean).length;
    const prefix = depth > 1 ? "../".repeat(depth - 1) : "";
    window.location.href = prefix + "auth/login.html";
  }
}
```

---

## Frontend/assets/css/style.css

```css
@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap');

:root {
  --bg-main: #0b1120;
  --bg-card: #151e32;
  --bg-input: #1e293b;
  --primary: #2dd4bf;
  --primary-hover: #14b8a6;
  --text-main: #f1f5f9;
  --text-muted: #94a3b8;
  --border: #334155;
  --border-hover: #475569;
  --success: #34d399;
  --danger: #fb7185;
  --font-main: 'Outfit', sans-serif;
  --radius: 12px;
}

* { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: var(--font-main);
  background-color: var(--bg-main);
  color: var(--text-main);
  line-height: 1.6;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

a { color: var(--primary); text-decoration: none; font-weight: 500; transition: opacity 0.2s; }
a:hover { opacity: 0.8; }

h1, h2, h3 { font-weight: 600; letter-spacing: -0.02em; color: white; }

.container {
  width: 100%; max-width: 480px; margin: auto;
  padding: 2rem; flex-grow: 1;
  display: flex; flex-direction: column; justify-content: center;
}

.dashboard-container { max-width: 1200px; margin: 0 auto; padding: 2rem; width: 100%; }

.card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 2.5rem;
  box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06);
}

label { display: block; margin-bottom: 0.5rem; font-size: 0.875rem; font-weight: 500; color: var(--text-muted); }

input, select {
  width: 100%; padding: 0.875rem 1rem; margin-bottom: 1.25rem;
  background: var(--bg-input); border: 1px solid var(--border);
  border-radius: var(--radius); color: white;
  font-family: var(--font-main); font-size: 1rem; transition: all 0.2s;
}

input:focus, select:focus {
  outline: none; border-color: var(--primary);
  box-shadow: 0 0 0 2px rgba(45,212,191,0.1);
}

button {
  width: 100%; padding: 0.875rem;
  background-color: var(--primary); color: #0f172a;
  border: none; border-radius: var(--radius);
  font-size: 1.05rem; font-weight: 600; cursor: pointer;
  transition: transform 0.1s, background-color 0.2s;
}
button:hover { background-color: var(--primary-hover); transform: translateY(-1px); }
button:active { transform: translateY(0); }

.navbar {
  display: flex; justify-content: space-between; align-items: center;
  padding: 1rem 2rem;
  background: rgba(11,17,32,0.8);
  border-bottom: 1px solid var(--border);
  backdrop-filter: blur(12px);
  position: sticky; top: 0; z-index: 100;
}
.navbar .brand { font-size: 1.25rem; font-weight: 700; color: white; display: flex; align-items: center; gap: 0.5rem; }
.navbar a:not(.brand) { color: var(--text-muted); font-size: 0.95rem; margin-left: 1.5rem; }
.navbar a:not(.brand):hover { color: var(--primary); }

.welcome-banner { margin-bottom: 2.5rem; padding-bottom: 1.5rem; border-bottom: 1px solid var(--border); }
.welcome-banner h2 { font-size: 2rem; margin-bottom: 0.5rem; }

.app-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1.5rem; }

.app-card {
  background: var(--bg-card); border: 1px solid var(--border);
  border-radius: var(--radius); padding: 1.75rem;
  transition: all 0.2s ease; cursor: pointer;
  display: flex; flex-direction: column; height: 100%;
  position: relative; overflow: hidden;
}
.app-card:hover { transform: translateY(-4px); border-color: var(--primary); box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1); }

.app-icon {
  width: 54px; height: 54px; border-radius: 14px;
  background: rgba(255,255,255,0.03); color: var(--primary);
  display: flex; align-items: center; justify-content: center;
  margin-bottom: 1.25rem; border: 1px solid var(--border);
}
.app-card h3 { font-size: 1.25rem; margin-bottom: 0.5rem; }
.app-card p { color: var(--text-muted); font-size: 0.95rem; margin-bottom: 1.5rem; flex-grow: 1; }

.app-badge {
  display: inline-flex; align-items: center;
  padding: 0.25rem 0.75rem;
  background: rgba(45,212,191,0.1); color: var(--primary);
  border-radius: 99px; font-size: 0.75rem; font-weight: 600; align-self: flex-start;
}

.hero {
  flex: 1; display: flex; flex-direction: column;
  justify-content: center; align-items: center;
  text-align: center; padding: 2rem;
}
.hero h1 {
  font-size: 4.5rem; line-height: 1.1;
  background: linear-gradient(to right, #fff, #94a3b8);
  -webkit-background-clip: text; -webkit-text-fill-color: transparent;
  margin-bottom: 1.5rem; font-weight: 700;
}
.hero p { font-size: 1.25rem; color: var(--text-muted); max-width: 500px; margin-bottom: 3rem; }
.hero-buttons { display: flex; gap: 1rem; }

.btn-secondary { background: transparent; border: 1px solid var(--border); color: var(--text-main); }
.btn-secondary:hover { background: rgba(255,255,255,0.05); border-color: var(--text-muted); }

.lock-screen {
  position: fixed; top: 0; left: 0; width: 100%; height: 100%;
  background: var(--bg-main); z-index: 2000;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  text-align: center; padding: 2rem;
}
.lock-icon {
  width: 96px; height: 96px;
  background: rgba(251,113,133,0.1); color: var(--danger);
  border-radius: 24px; display: flex;
  align-items: center; justify-content: center;
  margin-bottom: 2rem; border: 1px solid rgba(251,113,133,0.2);
}

.hidden { display: none !important; }

.text-muted { color: var(--text-muted); }
.text-sm { font-size: 0.875rem; }
.mt-4 { margin-top: 1rem; }
```
