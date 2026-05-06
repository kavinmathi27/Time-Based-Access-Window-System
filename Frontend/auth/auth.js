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
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  const role = document.getElementById("role")?.value || "USER";

  try {
    const res = await fetch(`${BASE_URL}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, role })
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
