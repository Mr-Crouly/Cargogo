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

const guestButtons = document.getElementById("guestButtons");
const accountButtons = document.getElementById("accountButtons");
const accountGreeting = document.getElementById("accountGreeting");
const logoutFromHomeBtn = document.getElementById("logoutFromHomeBtn");


// ---------- Открытие / закрытие окон ----------
function openModal(overlay) {
  if (overlay) {
    overlay.classList.add("open");
  }
}

function closeModal(overlay) {
  if (overlay) {
    overlay.classList.remove("open");
  }
}


// ---------- Кнопки регистрации ----------
if (openRegisterBtn) {
  openRegisterBtn.addEventListener("click", () => {
    openModal(registerOverlay);
  });
}

if (closeRegisterBtn) {
  closeRegisterBtn.addEventListener("click", () => {
    closeModal(registerOverlay);
  });
}


// ---------- Кнопки входа ----------
if (openLoginBtn) {
  openLoginBtn.addEventListener("click", () => {
    openModal(loginOverlay);
  });
}

if (closeLoginBtn) {
  closeLoginBtn.addEventListener("click", () => {
    closeModal(loginOverlay);
  });
}


// ---------- Переключение между регистрацией и входом ----------
if (switchToLoginLink) {
  switchToLoginLink.addEventListener("click", () => {
    closeModal(registerOverlay);
    openModal(loginOverlay);
  });
}

if (switchToRegisterLink) {
  switchToRegisterLink.addEventListener("click", () => {
    closeModal(loginOverlay);
    openModal(registerOverlay);
  });
}


// ---------- Закрытие по клику на фон ----------
[registerOverlay, loginOverlay].forEach((overlay) => {
  if (overlay) {
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) {
        closeModal(overlay);
      }
    });
  }
});


// ---------- Переключение роли ----------
const roleClientBtn = document.getElementById("roleClientBtn");
const roleCarrierBtn = document.getElementById("roleCarrierBtn");
const roleInput = document.getElementById("role");

function selectRole(role) {
  if (roleInput) {
    roleInput.value = role;
  }

  if (roleClientBtn) {
    roleClientBtn.classList.toggle("active", role === "client");
  }

  if (roleCarrierBtn) {
    roleCarrierBtn.classList.toggle("active", role === "carrier");
  }
}

if (roleClientBtn) {
  roleClientBtn.addEventListener("click", () => {
    selectRole("client");
  });
}

if (roleCarrierBtn) {
  roleCarrierBtn.addEventListener("click", () => {
    selectRole("carrier");
  });
}


// ---------- Состояние авторизации на главной странице ----------
// Позволяет спокойно находиться на главной, будучи авторизованным:
// вместо "Войти"/"Регистрация" показываем ссылку на кабинет,
// и не разлогиниваем пользователя просто за визит на index.html.
async function checkAuthState() {
  const token = localStorage.getItem("token");

  if (!token) {
    showGuestButtons();
    return;
  }

  try {
    const response = await fetch(`${API_URL}/me`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      // Токен истёк или недействителен — тихо чистим и показываем гостя
      localStorage.removeItem("token");
      showGuestButtons();
      return;
    }

    const data = await response.json();
    showAccountButtons(data.user.full_name);
  } catch (err) {
    console.error("Не удалось проверить сессию:", err);
    // Сеть недоступна — не выкидываем пользователя, просто оставляем гостевой вид
    showGuestButtons();
  }
}

function showGuestButtons() {
  if (guestButtons) guestButtons.style.display = "flex";
  if (accountButtons) accountButtons.style.display = "none";
}

function showAccountButtons(fullName) {
  if (accountGreeting) {
    accountGreeting.textContent = fullName ? `Привет, ${fullName.split(" ")[0]}` : "";
  }
  if (guestButtons) guestButtons.style.display = "none";
  if (accountButtons) accountButtons.style.display = "flex";
}

if (logoutFromHomeBtn) {
  logoutFromHomeBtn.addEventListener("click", () => {
    localStorage.removeItem("token");
    showGuestButtons();
  });
}

checkAuthState();


// ---------- Показать/скрыть пароль ----------
document.querySelectorAll(".password-toggle").forEach((toggle) => {
  toggle.addEventListener("click", () => {
    const input = document.getElementById(toggle.dataset.target);
    if (!input) return;

    const isHidden = input.type === "password";
    input.type = isHidden ? "text" : "password";
    toggle.textContent = isHidden ? "Скрыть" : "Показать";
  });
});


// ---------- Регистрация ----------
const registerForm = document.getElementById("registerForm");
const errorMessage = document.getElementById("errorMessage");
const registerSubmitBtn = document.getElementById("registerSubmitBtn");

if (registerForm) {
  registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    errorMessage.style.color = "";
    errorMessage.textContent = "";

    const payload = {
      fullName: document.getElementById("fullName").value.trim(),
      email: document.getElementById("email").value.trim(),
      phone: document.getElementById("phone").value.trim(),
      password: document.getElementById("password").value,
      role: roleInput.value,
    };

    // Проверка заполнения
    if (
      !payload.fullName ||
      !payload.email ||
      !payload.phone ||
      !payload.password
    ) {
      errorMessage.textContent = "Заполните все поля";
      return;
    }

    registerSubmitBtn.disabled = true;
    registerSubmitBtn.textContent = "Создаём аккаунт...";

    try {
      const response = await fetch(`${API_URL}/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      // Ошибка регистрации
      if (!response.ok) {
        errorMessage.style.color = "";
        errorMessage.textContent =
          data.message || "Ошибка регистрации";
        return;
      }

      // Успешная регистрация
      errorMessage.style.color = "green";
      errorMessage.textContent =
        "Регистрация прошла успешно!";

      // Через 1.5 секунды переходим к окну входа
      setTimeout(() => {
        closeModal(registerOverlay);

        registerForm.reset();

        errorMessage.style.color = "";
        errorMessage.textContent = "";

        // Открываем окно входа
        openModal(loginOverlay);

        // Email уже зарегистрированного пользователя
        document.getElementById("loginEmail").value =
          payload.email;

        // Пароль пользователь вводит сам
        document.getElementById("loginPassword").value = "";

        // Ставим курсор в поле пароля
        document.getElementById("loginPassword").focus();

      }, 1500);

    } catch (err) {
      errorMessage.style.color = "";
      errorMessage.textContent =
        "Не удалось связаться с сервером";

      console.error("Ошибка регистрации:", err);
    } finally {
      registerSubmitBtn.disabled = false;
      registerSubmitBtn.textContent = "Создать аккаунт";
    }
  });
}


// ---------- Логин ----------
const loginForm = document.getElementById("loginForm");
const loginErrorMessage =
  document.getElementById("loginErrorMessage");

if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    loginErrorMessage.textContent = "";

    const email =
      document.getElementById("loginEmail").value.trim();

    const password =
      document.getElementById("loginPassword").value;

    // Проверка полей
    if (!email || !password) {
      loginErrorMessage.textContent =
        "Заполните email и пароль";
      return;
    }

    const loginSubmitBtn = document.getElementById("loginSubmitBtn");
    loginSubmitBtn.disabled = true;
    loginSubmitBtn.textContent = "Входим...";

    // Выполняем вход
    const success =
      await loginAndRedirect(email, password);

    if (!success) {
      loginErrorMessage.textContent =
        "Неверный email или пароль";
      loginSubmitBtn.disabled = false;
      loginSubmitBtn.textContent = "Войти";
    }
    // При успехе loginAndRedirect уже переносит на cabinet.html,
    // так что кнопку возвращать в исходное состояние не нужно.
  });
}


// ---------- Функция входа ----------
async function loginAndRedirect(email, password) {
  try {
    const response = await fetch(`${API_URL}/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        email: email,
        password: password
      }),
    });

    const data = await response.json();

    // Если сервер вернул ошибку
    if (!response.ok) {
      return false;
    }

    // Сохраняем JWT-токен
    localStorage.setItem("token", data.token);

    // Переходим в личный кабинет
    window.location.href = "cabinet.html";

    return true;

  } catch (err) {
    console.error("Ошибка входа:", err);
    return false;
  }
}