const messageEl = document.getElementById("message");
const outputEl = document.getElementById("output");

const showLoginBtn = document.getElementById("show-login");
const showRegisterBtn = document.getElementById("show-register");

const loginSection = document.getElementById("login-section");
const registerSection = document.getElementById("register-section");

const loginEmail = document.getElementById("login-email");
const loginPassword = document.getElementById("login-password");
const loginBtn = document.getElementById("login-btn");

const registerUsername = document.getElementById("register-username");
const registerEmail = document.getElementById("register-email");
const registerPassword = document.getElementById("register-password");
const registerBtn = document.getElementById("register-btn");

const meBtn = document.getElementById("me-btn");
const logoutBtn = document.getElementById("logout-btn");

function showMessage(text, isError = false) {
  if (!messageEl) return;
  messageEl.textContent = text;
  messageEl.style.color = isError ? "#fca5a5" : "#86efac";
}

function showOutput(data) {
  if (!outputEl) return;
  outputEl.textContent =
    typeof data === "string" ? data : JSON.stringify(data, null, 2);
}

function switchToLogin() {
  if (!loginSection || !registerSection || !showLoginBtn || !showRegisterBtn) return;

  loginSection.classList.remove("hidden");
  registerSection.classList.add("hidden");
  showLoginBtn.classList.add("active");
  showRegisterBtn.classList.remove("active");
}

function switchToRegister() {
  if (!loginSection || !registerSection || !showLoginBtn || !showRegisterBtn) return;

  registerSection.classList.remove("hidden");
  loginSection.classList.add("hidden");
  showRegisterBtn.classList.add("active");
  showLoginBtn.classList.remove("active");
}

function isValidEmail(email) {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(String(email || "").trim());
}

window.addEventListener("DOMContentLoaded", () => {
  const token = localStorage.getItem("token");

  if (token) {
    window.location.href = "index.html";
    return;
  }

  switchToLogin();
});

if (showLoginBtn) {
  showLoginBtn.addEventListener("click", switchToLogin);
}

if (showRegisterBtn) {
  showRegisterBtn.addEventListener("click", switchToRegister);
}

if (registerBtn) {
  registerBtn.addEventListener("click", async () => {
    const username = registerUsername?.value.trim() || "";
    const email = registerEmail?.value.trim() || "";
    const password = registerPassword?.value.trim() || "";

    if (!username || !email || !password) {
      showMessage("Preencha usuário, email e senha.", true);
      return;
    }

    if (!isValidEmail(email)) {
      showMessage("Digite um email válido.", true);
      return;
    }

    try {
      showMessage("Cadastrando...");
      showOutput("");

      const data = await registerPlayer(username, email, password);

      if (data.token) {
        localStorage.setItem("token", data.token);
      }

      if (data.player) {
        localStorage.setItem("player", JSON.stringify(data.player));
      }

      showMessage("Cadastro realizado com sucesso!");
      showOutput(data);

      setTimeout(() => {
        window.location.href = "index.html";
      }, 500);
    } catch (error) {
      console.error("Erro no cadastro:", error);
      showMessage(error.message || "Erro ao cadastrar.", true);
      showOutput(error.message || "Erro ao cadastrar.");
    }
  });
}

if (loginBtn) {
  loginBtn.addEventListener("click", async () => {
    const email = loginEmail?.value.trim() || "";
    const password = loginPassword?.value.trim() || "";

    if (!email || !password) {
      showMessage("Preencha email e senha.", true);
      return;
    }

    if (!isValidEmail(email)) {
      showMessage("Digite um email válido.", true);
      return;
    }

    try {
      showMessage("Entrando...");
      showOutput("");

      const data = await loginPlayer(email, password);

      if (data.token) {
        localStorage.setItem("token", data.token);
      }

      if (data.player) {
        localStorage.setItem("player", JSON.stringify(data.player));
      }

      showMessage("Login realizado com sucesso!");
      showOutput(data);

      setTimeout(() => {
        window.location.href = "index.html";
      }, 500);
    } catch (error) {
      console.error("Erro no login:", error);
      showMessage(error.message || "Erro ao fazer login.", true);
      showOutput(error.message || "Erro ao fazer login.");
    }
  });
}

if (meBtn) {
  meBtn.addEventListener("click", async () => {
    const token = localStorage.getItem("token");

    if (!token) {
      showMessage("Não há token salvo. Faça login primeiro.", true);
      return;
    }

    try {
      showMessage("Buscando dados do usuário...");
      const data = await getMe(token);
      showMessage("Dados carregados com sucesso!");
      showOutput(data);
    } catch (error) {
      console.error("Erro no /me:", error);
      showMessage(error.message || "Erro ao buscar usuário.", true);
      showOutput(error.message || "Erro ao buscar usuário.");
    }
  });
}

if (logoutBtn) {
  logoutBtn.addEventListener("click", () => {
    localStorage.removeItem("token");
    localStorage.removeItem("player");
    showMessage("Você saiu da conta.");
    showOutput("Token removido.");
  });
}