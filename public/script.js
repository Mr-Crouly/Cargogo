const API_URL = "/api";

// Единая тема для главной страницы и личного кабинета.
const themeToggleBtn = document.getElementById("themeToggleBtn");
function applyHomeTheme(isDark) {
  document.body.classList.toggle("dark-theme", isDark);
  if (themeToggleBtn) {
    themeToggleBtn.textContent = isDark ? "☀" : "☾";
    themeToggleBtn.setAttribute("aria-pressed", String(isDark));
    const ro = window.CARGOGO_I18N?.language === "ro";
    themeToggleBtn.setAttribute("aria-label", isDark
      ? (ro ? "Activează tema luminoasă" : "Включить светлую тему")
      : (ro ? "Activează tema întunecată" : "Включить тёмную тему"));
    themeToggleBtn.title = isDark
      ? (ro ? "Tema luminoasă" : "Светлая тема")
      : (ro ? "Tema întunecată" : "Тёмная тема");
  }
}
applyHomeTheme(localStorage.getItem("cargogo-theme") === "dark");
if (themeToggleBtn) {
  themeToggleBtn.addEventListener("click", () => {
    const isDark = !document.body.classList.contains("dark-theme");
    localStorage.setItem("cargogo-theme", isDark ? "dark" : "light");
    applyHomeTheme(isDark);
  });
}
document.addEventListener("cargogo:languagechange", () => {
  applyHomeTheme(document.body.classList.contains("dark-theme"));
});
const tr = (key) => window.CARGOGO_I18N ? window.CARGOGO_I18N.t(key) : key;


// ---------- Экспресс-заявка без регистрации ----------
const expressOverlay = document.getElementById("expressOverlay");
const expressForm = document.getElementById("expressForm");
const expressError = document.getElementById("expressError");
const openExpressBtn = document.getElementById("openExpressBtn");
const closeExpressBtn = document.getElementById("closeExpressBtn");
if (openExpressBtn) openExpressBtn.addEventListener("click", () => openModal(expressOverlay));
if (closeExpressBtn) closeExpressBtn.addEventListener("click", () => closeModal(expressOverlay));
if (expressOverlay) expressOverlay.addEventListener("click", e => { if (e.target === expressOverlay) closeModal(expressOverlay); });
if (expressForm) expressForm.addEventListener("submit", async e => {
  e.preventDefault();
  expressError.textContent = "";
  const submit = document.getElementById("expressSubmitBtn");
  const data = Object.fromEntries(new FormData(expressForm).entries());
  submit.disabled = true;
  submit.textContent = tr("expressSending");
  try {
    const response = await fetch(`${API_URL}/express-requests`, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(data) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.message || tr("expressError"));
    expressForm.reset();
    closeModal(expressOverlay);
    alert(tr("expressSent"));
  } catch (err) {
    expressError.textContent = err.message || tr("expressError");
  } finally {
    submit.disabled = false;
    submit.textContent = tr("expressSend");
  }
});

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
// Число непрочитанных уведомлений рядом со ссылкой «Личный кабинет»
async function loadHomeNotifBadge(token) {
  const badge = document.getElementById("homeNotifBadge");
  if (!badge) return;
  try {
    const response = await fetch(`${API_URL}/notifications/count`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) return;
    const { unread } = await response.json();
    badge.textContent = unread > 99 ? "99+" : unread;
    badge.style.display = unread > 0 ? "inline-block" : "none";
  } catch (err) {
    // не критично: просто не показываем счётчик
  }
}

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
    loadHomeNotifBadge(token);
  } catch (err) {
    console.error("Не удалось проверить сессию:", err);
    // Сеть недоступна — не выкидываем пользователя, просто оставляем гостевой вид
    showGuestButtons();
  }
}

function showGuestButtons() {
  if (guestButtons) guestButtons.style.display = "flex";
  if (accountButtons) accountButtons.style.display = "none";
  const guestFeatures = document.getElementById("guestFeatures");
  if (guestFeatures) guestFeatures.hidden = false;
}

function showAccountButtons(fullName) {
  if (accountGreeting) {
    accountGreeting.textContent = fullName ? `${window.CARGOGO_I18N?.language === "ro" ? "Salut" : "Привет"}, ${fullName.split(" ")[0]}` : "";
  }
  if (guestButtons) guestButtons.style.display = "none";
  if (accountButtons) accountButtons.style.display = "flex";
  const guestFeatures = document.getElementById("guestFeatures");
  if (guestFeatures) guestFeatures.hidden = true;
}

if (logoutFromHomeBtn) {
  logoutFromHomeBtn.addEventListener("click", () => {
    localStorage.removeItem("token");
    showGuestButtons();
  });
}

// Если токен уже есть, не показываем гостевые карточки даже на время проверки сессии.
if (localStorage.getItem("token")) {
  const guestFeatures = document.getElementById("guestFeatures");
  if (guestFeatures) guestFeatures.hidden = true;
}
checkAuthState();
document.addEventListener("cargogo:languagechange", () => {
  if (allHomeCargos.length) renderHomeCargos(applyCurrentHomeFilter(allHomeCargos));
  if (allHomeTrips.length) renderHomeTrips(applyCurrentHomeFilter(allHomeTrips));
});
function applyCurrentHomeFilter(items) {
  const origin = originCitySelect?.value || ""; const destination = destinationCitySelect?.value || "";
  return items.filter(item => (!origin || item.origin_city === origin) && (!destination || item.destination_city === destination));
}


// ---------- Витрина: актуальные грузы и рейсы на главной ----------
const homeCargosList = document.getElementById("homeCargosList");
const homeCargosLoading = document.getElementById("homeCargosLoading");
const homeCargosEmpty = document.getElementById("homeCargosEmpty");

const homeTripsList = document.getElementById("homeTripsList");
const homeTripsLoading = document.getElementById("homeTripsLoading");
const homeTripsEmpty = document.getElementById("homeTripsEmpty");

const searchBtn = document.getElementById("searchBtn");
const resetSearchBtn = document.getElementById("resetSearchBtn");
const originCitySelect = document.getElementById("originCity");
const destinationCitySelect = document.getElementById("destinationCity");

let allHomeCargos = [];
let allHomeTrips = [];

function escapeHtmlHome(value) {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDateHome(value) {
  if (!value) return null;
  return new Date(value).toLocaleDateString(window.CARGOGO_I18N?.language === "ro" ? "ro-RO" : "ru-RU");
}

function formatMoneyHome(value) {
  if (value === null || value === undefined) return null;
  return `${Number(value).toLocaleString(window.CARGOGO_I18N?.language === "ro" ? "ro-RO" : "ru-RU")} MDL`;
}

// При клике по карточке груза/рейса — если пользователь уже авторизован,
// ведём сразу в кабинет (там видны полные контакты), иначе предлагаем войти.
function goToCabinetOrLogin() {
  if (localStorage.getItem("token")) {
    window.location.href = "cabinet.html";
  } else {
    openModal(loginOverlay);
  }
}

async function loadHomeCargos() {
  if (homeCargosLoading) homeCargosLoading.style.display = "block";

  try {
    const response = await fetch(`${API_URL}/public/cargos`);
    const data = await response.json();
    if (!response.ok) return;

    allHomeCargos = data.cargos;
    renderHomeCargos(allHomeCargos);
  } catch (err) {
    console.error("Ошибка загрузки витрины грузов:", err);
    if (homeCargosLoading) homeCargosLoading.textContent = window.CARGOGO_I18N?.language === "ro" ? "Nu s-au putut încărca mărfurile" : "Не удалось загрузить грузы";
  }
}

function renderHomeCargos(cargos) {
  if (homeCargosLoading) homeCargosLoading.style.display = "none";
  homeCargosList.innerHTML = "";
  homeCargosEmpty.style.display = cargos.length ? "none" : "block";

  cargos.forEach((cargo) => {
    const card = document.createElement("div");
    card.className = "listing-card";

    const subParts = [];
    if (cargo.cargo_type) subParts.push(cargo.cargo_type);
    if (cargo.weight_kg) subParts.push(`${cargo.weight_kg} кг`);
    if (cargo.ready_date) subParts.push(`${tr("ready")} ${formatDateHome(cargo.ready_date)}`);

    card.innerHTML = `
      <div class="listing-card-route">${escapeHtmlHome(cargo.origin_city)} → ${escapeHtmlHome(cargo.destination_city)}</div>
      ${subParts.length ? `<div class="listing-card-sub">${escapeHtmlHome(subParts.join(" · "))}</div>` : ""}
      ${cargo.price ? `<div class="listing-card-price">${escapeHtmlHome(formatMoneyHome(cargo.price))}</div>` : ""}
      <button class="listing-card-btn">${escapeHtmlHome(tr("respond"))}</button>
    `;

    card.querySelector(".listing-card-btn").addEventListener("click", goToCabinetOrLogin);
    homeCargosList.appendChild(card);
  });
}

async function loadHomeTrips() {
  if (homeTripsLoading) homeTripsLoading.style.display = "block";

  try {
    const response = await fetch(`${API_URL}/public/trips`);
    const data = await response.json();
    if (!response.ok) return;

    allHomeTrips = data.trips;
    renderHomeTrips(allHomeTrips);
  } catch (err) {
    console.error("Ошибка загрузки витрины рейсов:", err);
    if (homeTripsLoading) homeTripsLoading.textContent = window.CARGOGO_I18N?.language === "ro" ? "Nu s-au putut încărca cursele" : "Не удалось загрузить рейсы";
  }
}

function renderHomeTrips(trips) {
  if (homeTripsLoading) homeTripsLoading.style.display = "none";
  homeTripsList.innerHTML = "";
  homeTripsEmpty.style.display = trips.length ? "none" : "block";

  trips.forEach((trip) => {
    const card = document.createElement("div");
    card.className = "listing-card";

    const subParts = [];
    if (trip.departure_date) subParts.push(formatDateHome(trip.departure_date));
    if (trip.capacity_kg) subParts.push(`${tr("upTo")} ${trip.capacity_kg} ${tr("kg")}`);

    card.innerHTML = `
      <div class="listing-card-route">${escapeHtmlHome(trip.origin_city)} → ${escapeHtmlHome(trip.destination_city)}</div>
      ${subParts.length ? `<div class="listing-card-sub">${escapeHtmlHome(subParts.join(" · "))}</div>` : ""}
      ${trip.price ? `<div class="listing-card-price">${escapeHtmlHome(formatMoneyHome(trip.price))}</div>` : ""}
      <button class="listing-card-btn">${escapeHtmlHome(tr("respond"))}</button>
    `;

    card.querySelector(".listing-card-btn").addEventListener("click", goToCabinetOrLogin);
    homeTripsList.appendChild(card);
  });
}

// ---------- Поиск по городам: фильтрует обе витрины ----------
function applySearchFilter() {
  const origin = originCitySelect.value;
  const destination = destinationCitySelect.value;

  if (!origin && !destination) {
    renderHomeCargos(allHomeCargos);
    renderHomeTrips(allHomeTrips);
    if (resetSearchBtn) resetSearchBtn.style.display = "none";
    return;
  }

  const matches = (item) =>
    (!origin || item.origin_city === origin) &&
    (!destination || item.destination_city === destination);

  renderHomeCargos(allHomeCargos.filter(matches));
  renderHomeTrips(allHomeTrips.filter(matches));
  if (resetSearchBtn) resetSearchBtn.style.display = "inline-block";
}

if (searchBtn) {
  searchBtn.addEventListener("click", () => {
    applySearchFilter();
    document.getElementById("cargos-section").scrollIntoView({ behavior: "smooth" });
  });
}

if (resetSearchBtn) {
  resetSearchBtn.addEventListener("click", () => {
    originCitySelect.value = "";
    destinationCitySelect.value = "";
    applySearchFilter();
  });
}

loadHomeCargos();
loadHomeTrips();


// ---------- CTA-кнопки "Я клиент" / "Я перевозчик" ----------
const ctaClientBtn = document.getElementById("ctaClientBtn");
const ctaCarrierBtn = document.getElementById("ctaCarrierBtn");

function handleRoleCta(role) {
  if (localStorage.getItem("token")) {
    // Пользователь уже авторизован — просто ведём в кабинет
    window.location.href = "cabinet.html";
    return;
  }
  // Не авторизован — открываем регистрацию с предвыбранной ролью
  selectRole(role);
  openModal(registerOverlay);
}

if (ctaClientBtn) {
  ctaClientBtn.addEventListener("click", () => handleRoleCta("client"));
}

if (ctaCarrierBtn) {
  ctaCarrierBtn.addEventListener("click", () => handleRoleCta("carrier"));
}


// ---------- Год в футере ----------
const footerYear = document.getElementById("footerYear");
if (footerYear) {
  footerYear.textContent = new Date().getFullYear();
}


// ---------- Показать/скрыть пароль ----------
document.querySelectorAll(".password-toggle").forEach((toggle) => {
  toggle.addEventListener("click", () => {
    const input = document.getElementById(toggle.dataset.target);
    if (!input) return;

    const isHidden = input.type === "password";
    input.type = isHidden ? "text" : "password";
    toggle.textContent = isHidden ? tr("hide") : tr("show");
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
      errorMessage.textContent = tr("fillAll");
      return;
    }

    registerSubmitBtn.disabled = true;
    registerSubmitBtn.textContent = tr("creating");

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
          data.message || tr("registerError");
        return;
      }

      // Успешная регистрация
      errorMessage.style.color = "green";
      errorMessage.textContent =
        tr("registered");

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
        tr("serverError");

      console.error("Ошибка регистрации:", err);
    } finally {
      registerSubmitBtn.disabled = false;
      registerSubmitBtn.textContent = tr("createAccount");
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
        tr("fillLogin");
      return;
    }

    const loginSubmitBtn = document.getElementById("loginSubmitBtn");
    loginSubmitBtn.disabled = true;
    loginSubmitBtn.textContent = tr("loggingIn");

    // Выполняем вход
    const success =
      await loginAndRedirect(email, password);

    if (!success) {
      loginErrorMessage.textContent =
        lastLoginError || tr("wrongLogin");
      loginSubmitBtn.disabled = false;
      loginSubmitBtn.textContent = tr("login");
    }
    // При успехе loginAndRedirect уже переносит на cabinet.html,
    // так что кнопку возвращать в исходное состояние не нужно.
  });
}


// ---------- Функция входа ----------
let lastLoginError = "";

async function loginAndRedirect(email, password) {
  lastLoginError = "";
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

    // Если сервер вернул ошибку — запоминаем его сообщение (лимит попыток, остаток попыток)
    if (!response.ok) {
      lastLoginError = data.message || "";
      return false;
    }

    // Сохраняем JWT-токен
    localStorage.setItem("token", data.token);

    // Переходим в личный кабинет
    window.location.href = "cabinet.html";

    return true;

  } catch (err) {
    console.error("Ошибка входа:", err);
    lastLoginError = tr("serverError");
    return false;
  }
}