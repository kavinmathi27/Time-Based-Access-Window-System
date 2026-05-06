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
