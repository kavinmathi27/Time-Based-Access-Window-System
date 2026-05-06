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
