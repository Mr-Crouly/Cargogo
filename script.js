const API_URL = "http://localhost:3000/api";

// ---------- Элементы окон ----------
const registerOverlay = document.getElementById("registerOverlay");
const loginOverlay = document.getElementById("loginOverlay");

const openRegisterBtn = document.getElementById("openRegisterBtn");
const closeRegisterBtn = document.getElementById("closeRegisterBtn");

const openLoginBtn = document.getElementById("openLoginBtn");
const closeLoginBtn = document.getElementById("closeLoginBtn");

const switchToLoginLink = document.getElementById("switchToLoginLink");
const switchToRegisterLink = document.getElementById("switchToRegisterLink");

function openModal(overlay) {
  overlay.classList.add("open");
}
function closeModal(overlay) {
  overlay.classList.remove("open");
}

openRegisterBtn.addEventListener("click", () => openModal(registerOverlay));
closeRegisterBtn.addEventListener("click", () => closeModal(registerOverlay));

openLoginBtn.addEventListener("click", () => openModal(loginOverlay));
closeLoginBtn.addEventListener("click", () => closeModal(loginOverlay));

// Переключение между окнами внутри самих модалок
switchToLoginLink.addEventListener("click", () => {
  closeModal(registerOverlay);
  openModal(loginOverlay);
});
switchToRegisterLink.addEventListener("click", () => {
  closeModal(loginOverlay);
  openModal(registerOverlay);
});

// Закрытие по клику на затемнённый фон
[registerOverlay, loginOverlay].forEach((overlay) => {
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeModal(overlay);
  });
});

// ---------- Переключение роли клиент / перевозчик (регистрация) ----------
const roleClientBtn = document.getElementById("roleClientBtn");
const roleCarrierBtn = document.getElementById("roleCarrierBtn");
const roleInput = document.getElementById("role");

function selectRole(role) {
  roleInput.value = role;
  roleClientBtn.classList.toggle("active", role === "client");
  roleCarrierBtn.classList.toggle("active", role === "carrier");
}

roleClientBtn.addEventListener("click", () => selectRole("client"));
roleCarrierBtn.addEventListener("click", () => selectRole("carrier"));

// ---------- Регистрация ----------
const registerForm = document.getElementById("registerForm");
const errorMessage = document.getElementById("errorMessage");

registerForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  errorMessage.textContent = "";

  const payload = {
    fullName: document.getElementById("fullName").value.trim(),
    email: document.getElementById("email").value.trim(),
    phone: document.getElementById("phone").value.trim(),
    password: document.getElementById("password").value,
    role: roleInput.value,
  };

  if (!payload.fullName || !payload.email || !payload.phone || !payload.password) {
    errorMessage.textContent = "Заполните все поля";
    return;
  }

  try {
    const response = await fetch(`${API_URL}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      errorMessage.textContent = data.message || "Ошибка регистрации";
      return;
    }

    // После успешной регистрации сразу логиним пользователя
    await loginAndRedirect(payload.email, payload.password);
  } catch (err) {
    errorMessage.textContent = "Не удалось связаться с сервером";
    console.error(err);
  }
});

// ---------- Логин ----------
const loginForm = document.getElementById("loginForm");
const loginErrorMessage = document.getElementById("loginErrorMessage");

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  loginErrorMessage.textContent = "";

  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;

  if (!email || !password) {
    loginErrorMessage.textContent = "Заполните email и пароль";
    return;
  }

  const success = await loginAndRedirect(email, password);
  if (!success) {
    loginErrorMessage.textContent = "Неверный email или пароль";
  }
});

// Общая функция логина: используется и после регистрации, и в форме входа
async function loginAndRedirect(email, password) {
  try {
    const response = await fetch(`${API_URL}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (!response.ok) {
      return false;
    }

    localStorage.setItem("token", data.token);
    window.location.href = "cabinet.html";
    return true;
  } catch (err) {
    console.error("Ошибка входа:", err);
    return false;
  }
}
