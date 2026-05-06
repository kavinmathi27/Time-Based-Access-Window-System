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
      if (shiftEl && data.startTime) {
        shiftEl.innerText = `Starts: ${new Date(data.startTime).toLocaleString()}`;
      }
    } else if (data.status === "expired") {
      if (reasonEl) reasonEl.innerText = "Your shift has ended. Contact your admin to extend access.";
      if (shiftEl && data.endTime) {
        shiftEl.innerText = `Ended: ${new Date(data.endTime).toLocaleString()}`;
      }
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
