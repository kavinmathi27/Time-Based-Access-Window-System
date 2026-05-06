const BASE_URL = "http://localhost:5000/api";

function getToken() {
  return localStorage.getItem("token");
}

function saveToken(token) {
  localStorage.setItem("token", token);
}

function logout() {
  localStorage.clear();
  // Use relative navigation — works both when served by Express and as raw HTML
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
