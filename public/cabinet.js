const API_URL = "/api";

const token = localStorage.getItem("token");

const loadingState = document.getElementById("loadingState");
const cabinetContent = document.getElementById("cabinetContent");
const errorState = document.getElementById("errorState");
const logoutBtn = document.getElementById("logoutBtn");

const editProfileBtn = document.getElementById("editProfileBtn");
const cancelEditBtn = document.getElementById("cancelEditBtn");
const editProfileForm = document.getElementById("editProfileForm");
const editErrorMessage = document.getElementById("editErrorMessage");

const viewSection = document.getElementById("viewSection");
const profileSection = document.getElementById("profileSection");
const editSection = document.getElementById("editSection");

// Текущие данные пользователя/профиля, чтобы форма редактирования
// всегда открывалась с актуальными значениями.
let currentUser = null;
let currentProfile = null;


// ---------- Тост-уведомление ----------
function showToast(message, isError = false) {
  let toast = document.getElementById("toast");

  if (!toast) {
    toast = document.createElement("div");
    toast.id = "toast";
    toast.className = "toast";
    document.body.appendChild(toast);
  }

  toast.textContent = message;
  toast.classList.toggle("toast-error", isError);
  toast.classList.add("show");

  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => {
    toast.classList.remove("show");
  }, 2500);
}


// ---------- Проверка авторизации ----------
if (!token) {
  window.location.href = "index.html";
}


// ---------- Загрузка профиля ----------
async function loadProfile() {
  try {
    const response = await fetch(`${API_URL}/me`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    // Токен недействителен
    if (!response.ok) {
      localStorage.removeItem("token");
      window.location.href = "index.html";
      return;
    }

    const data = await response.json();

    currentUser = data.user;
    currentProfile = data.profile;

    const createBtn = document.getElementById("sidebarCreateBtn");
    const requestsLabel = document.getElementById("sidebarRequestsLabel");
    const transportLink = document.getElementById("sidebarTransportLink");
    if (createBtn) createBtn.textContent = data.user.role === "client" ? "+ Новый заказ" : "+ Новый рейс";
    if (requestsLabel) requestsLabel.textContent = data.user.role === "client" ? "Мои заявки" : "Доступные грузы";
    if (transportLink) transportLink.innerHTML = '<span class="sidebar-icon">▱</span>' + (data.user.role === "client" ? "Рейсы перевозчиков" : "Мой транспорт");

    renderProfile(data.user, data.profile);
    setCabinetView("overview");

  } catch (err) {
    console.error("Ошибка загрузки профиля:", err);

    localStorage.removeItem("token");

    loadingState.style.display = "none";
    cabinetContent.style.display = "none";
    errorState.style.display = "block";
  }
}


// ---------- Отображение профиля ----------
function renderProfile(user, profile) {
  loadingState.style.display = "none";
  cabinetContent.style.display = "grid";

  // ---------- Аватар ----------
  const initials = user.full_name
    .split(" ")
    .map((word) => word[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  document.getElementById("avatarInitials").textContent = initials;


  // ---------- Основная информация ----------
  document.getElementById("userName").textContent =
    user.full_name;

  document.getElementById("userEmail").textContent =
    user.email;

  document.getElementById("userPhone").textContent =
    user.phone || "Не указан";

  document.getElementById("userCreatedAt").textContent =
    new Date(user.created_at).toLocaleDateString("ru-RU");


  // ---------- Роль ----------
  let roleText = "Пользователь";

  if (user.role === "client") {
    roleText = "Клиент";
  } else if (user.role === "carrier") {
    roleText = "Перевозчик";
  } else if (user.role === "admin") {
    roleText = "Администратор";
  }

  document.getElementById("userRoleLabel").textContent =
    roleText;


  // ---------- Данные профиля ----------
  if (profile) {
    document.getElementById("companyName").textContent =
      profile.company_name || "Не указано";

    document.getElementById("taxId").textContent =
      profile.tax_id || "Не указано";
  }


  // ---------- Клиент ----------
  if (user.role === "client") {
    document.getElementById("profileSectionTitle").textContent =
      "Профиль клиента";

    const address = document.getElementById("address");

    if (address) {
      address.textContent =
        profile?.address || "Не указано";
    }

    const clientCargosSection =
      document.getElementById("clientCargosSection");

    if (clientCargosSection) {
      clientCargosSection.style.display = "block";
      loadCargos();

      const clientTripsSection = document.getElementById("clientTripsSection");
      if (clientTripsSection) clientTripsSection.style.display = "block";
      if (typeof loadClientTrips === "function") loadClientTrips();
    }
  }


  // ---------- Перевозчик ----------
  if (user.role === "carrier") {
    document.getElementById("profileSectionTitle").textContent =
      "Профиль перевозчика";

    const addressRow =
      document.getElementById("addressRow");

    if (addressRow) {
      addressRow.style.display = "none";
    }

    const licenseRow =
      document.getElementById("licenseRow");

    if (licenseRow) {
      licenseRow.style.display = "flex";
    }

    const verifiedRow =
      document.getElementById("verifiedRow");

    if (verifiedRow) {
      verifiedRow.style.display = "flex";
    }

    document.getElementById("licenseNumber").textContent =
      profile?.license_number || "Не указано";

    document.getElementById("isVerified").textContent =
      profile?.is_verified
        ? "Подтверждён ✓"
        : "Не подтверждён";

    const carrierVehiclesSection =
      document.getElementById("carrierVehiclesSection");

    if (carrierVehiclesSection) {
      carrierVehiclesSection.style.display = "block";
      loadVehicles();
    }

    const carrierTripsSection =
      document.getElementById("carrierTripsSection");

    if (carrierTripsSection) {
      carrierTripsSection.style.display = "block";
      loadTrips();
    }

    const publicCargosSection =
      document.getElementById("publicCargosSection");

    if (publicCargosSection) {
      publicCargosSection.style.display = "block";
      const myResponsesSection = document.getElementById("myResponsesSection");
      if (myResponsesSection) myResponsesSection.style.display = "block";
      loadPublicCargos();
      loadMyResponses();

      const myReviewsSection = document.getElementById("myReviewsSection");
      if (myReviewsSection) myReviewsSection.style.display = "block";
      if (typeof loadMyReviews === "function") loadMyReviews();
    }
  }

  // ---------- Сообщения (обе роли) ----------
  if (user.role === "client" || user.role === "carrier") {
    initMessages();
  }
}


// ---------- Открытие формы редактирования ----------
// Показывает только те поля, которые относятся к роли пользователя:
// у клиента — адрес, у перевозчика — номер лицензии (разделение профилей).
function openEditForm() {
  if (!currentUser) return;

  document.getElementById("editFullName").value = currentUser.full_name || "";
  document.getElementById("editPhone").value = currentUser.phone || "";
  document.getElementById("editCompanyName").value = currentProfile?.company_name || "";
  document.getElementById("editTaxId").value = currentProfile?.tax_id || "";

  const addressLabel = document.getElementById("editAddressLabel");
  const addressInput = document.getElementById("editAddress");
  const licenseLabel = document.getElementById("editLicenseLabel");
  const licenseInput = document.getElementById("editLicenseNumber");

  if (currentUser.role === "client") {
    document.getElementById("editSectionTitle").textContent = "Редактирование профиля клиента";
    addressLabel.style.display = "block";
    addressInput.style.display = "block";
    addressInput.value = currentProfile?.address || "";
    licenseLabel.style.display = "none";
    licenseInput.style.display = "none";
    licenseInput.value = "";
  } else if (currentUser.role === "carrier") {
    document.getElementById("editSectionTitle").textContent = "Редактирование профиля перевозчика";
    licenseLabel.style.display = "block";
    licenseInput.style.display = "block";
    licenseInput.value = currentProfile?.license_number || "";
    addressLabel.style.display = "none";
    addressInput.style.display = "none";
    addressInput.value = "";
  }

  editErrorMessage.textContent = "";

  viewSection.style.display = "none";
  profileSection.style.display = "none";
  editSection.style.display = "block";
}


function closeEditForm() {
  editSection.style.display = "none";
  viewSection.style.display = "block";
  profileSection.style.display = "block";
}


if (editProfileBtn) {
  editProfileBtn.addEventListener("click", openEditForm);
}

if (cancelEditBtn) {
  cancelEditBtn.addEventListener("click", closeEditForm);
}


// ---------- Сохранение профиля ----------
if (editProfileForm) {
  editProfileForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    editErrorMessage.textContent = "";

    const payload = {
      fullName: document.getElementById("editFullName").value.trim(),
      phone: document.getElementById("editPhone").value.trim(),
      companyName: document.getElementById("editCompanyName").value.trim(),
      taxId: document.getElementById("editTaxId").value.trim(),
      address: document.getElementById("editAddress").value.trim(),
      licenseNumber: document.getElementById("editLicenseNumber").value.trim(),
    };

    if (!payload.fullName) {
      editErrorMessage.textContent = "Имя не может быть пустым";
      return;
    }

    const saveBtn = document.getElementById("saveEditBtn");
    saveBtn.disabled = true;
    saveBtn.textContent = "Сохранение...";

    try {
      const response = await fetch(`${API_URL}/profile`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        editErrorMessage.textContent = data.message || "Не удалось сохранить изменения";
        return;
      }

      currentUser = data.user;
      currentProfile = data.profile;

      renderProfile(data.user, data.profile);
      closeEditForm();
      showToast("Профиль обновлён");
    } catch (err) {
      console.error("Ошибка сохранения профиля:", err);
      editErrorMessage.textContent = "Не удалось связаться с сервером";
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = "Сохранить";
    }
  });
}


// ---------- Вспомогательные функции ----------
function formatDate(value) {
  if (!value) return null;
  return new Date(value).toLocaleDateString("ru-RU");
}

function formatMoney(value) {
  if (value === null || value === undefined) return null;
  return `${Number(value).toLocaleString("ru-RU")} MDL`;
}

function toggleForm(form, show) {
  form.style.display = show ? "block" : "none";
  if (!show) form.reset();
}

async function deleteEntity(url, onSuccess, confirmText) {
  if (!window.confirm(confirmText)) return;

  try {
    const response = await fetch(url, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });

    const data = await response.json();

    if (!response.ok) {
      showToast(data.message || "Не удалось удалить", true);
      return;
    }

    showToast(data.message || "Удалено");
    onSuccess();
  } catch (err) {
    console.error("Ошибка удаления:", err);
    showToast("Не удалось связаться с сервером", true);
  }
}


// ==================== ПЕРЕВОЗЧИК: автомобили ====================
const vehiclesList = document.getElementById("vehiclesList");
const vehiclesEmpty = document.getElementById("vehiclesEmpty");
const addVehicleBtn = document.getElementById("addVehicleBtn");
const cancelVehicleBtn = document.getElementById("cancelVehicleBtn");
const vehicleForm = document.getElementById("vehicleForm");
const vehicleErrorMessage = document.getElementById("vehicleErrorMessage");

let vehiclesCache = [];

async function loadVehicles() {
  try {
    const response = await fetch(`${API_URL}/vehicles`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json();
    if (!response.ok) return;

    vehiclesCache = data.vehicles;
    renderVehicles(vehiclesCache);
    renderVehicleOptions(vehiclesCache);
  } catch (err) {
    console.error("Ошибка загрузки автомобилей:", err);
  }
}

function renderVehicles(vehicles) {
  vehiclesList.innerHTML = "";
  vehiclesEmpty.style.display = vehicles.length ? "none" : "block";

  vehicles.forEach((vehicle) => {
    const card = document.createElement("div");
    card.className = "entity-card";

    const details = [vehicle.body_type, vehicle.capacity_kg ? `до ${vehicle.capacity_kg} кг` : null]
      .filter(Boolean)
      .join(" · ");

    card.innerHTML = `
      <div class="entity-card-main">
        <div class="entity-card-title">${escapeHtml(vehicle.brand)} ${escapeHtml(vehicle.model || "")}</div>
        <div class="entity-card-sub">Гос. номер: ${escapeHtml(vehicle.plate_number)}</div>
        ${details ? `<div class="entity-card-sub">${escapeHtml(details)}</div>` : ""}
      </div>
      <button class="entity-card-delete" data-id="${vehicle.id}">Удалить</button>
    `;

    card.querySelector(".entity-card-delete").addEventListener("click", () => {
      deleteEntity(
        `${API_URL}/vehicles/${vehicle.id}`,
        loadVehicles,
        "Удалить этот автомобиль?"
      );
    });

    vehiclesList.appendChild(card);
  });
}

function renderVehicleOptions(vehicles) {
  const select = document.getElementById("tripVehicle");
  if (!select) return;

  const current = select.value;
  select.innerHTML = '<option value="">Не выбран</option>';

  vehicles.forEach((vehicle) => {
    const option = document.createElement("option");
    option.value = vehicle.id;
    option.textContent = `${vehicle.brand} ${vehicle.model || ""} (${vehicle.plate_number})`;
    select.appendChild(option);
  });

  select.value = current;
}

if (addVehicleBtn) {
  addVehicleBtn.addEventListener("click", () => {
    vehicleErrorMessage.textContent = "";
    toggleForm(vehicleForm, true);
  });
}

if (cancelVehicleBtn) {
  cancelVehicleBtn.addEventListener("click", () => toggleForm(vehicleForm, false));
}

if (vehicleForm) {
  vehicleForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    vehicleErrorMessage.textContent = "";

    const payload = {
      brand: document.getElementById("vehicleBrand").value.trim(),
      model: document.getElementById("vehicleModel").value.trim(),
      plateNumber: document.getElementById("vehiclePlate").value.trim(),
      capacityKg: document.getElementById("vehicleCapacity").value,
      bodyType: document.getElementById("vehicleBodyType").value,
    };

    if (!payload.brand || !payload.plateNumber) {
      vehicleErrorMessage.textContent = "Укажите марку и гос. номер";
      return;
    }

    const saveBtn = document.getElementById("saveVehicleBtn");
    saveBtn.disabled = true;
    saveBtn.textContent = "Добавление...";

    try {
      const response = await fetch(`${API_URL}/vehicles`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const data = await response.json();

      if (!response.ok) {
        vehicleErrorMessage.textContent = data.message || "Не удалось добавить автомобиль";
        return;
      }

      toggleForm(vehicleForm, false);
      showToast("Автомобиль добавлен");
      loadVehicles();
    } catch (err) {
      console.error("Ошибка добавления автомобиля:", err);
      vehicleErrorMessage.textContent = "Не удалось связаться с сервером";
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = "Добавить";
    }
  });
}


// ==================== ПЕРЕВОЗЧИК: рейсы ====================
const tripsList = document.getElementById("tripsList");
const tripsEmpty = document.getElementById("tripsEmpty");
const addTripBtn = document.getElementById("addTripBtn");
const cancelTripBtn = document.getElementById("cancelTripBtn");
const tripForm = document.getElementById("tripForm");
const tripErrorMessage = document.getElementById("tripErrorMessage");

async function loadTrips() {
  try {
    const response = await fetch(`${API_URL}/trips`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json();
    if (!response.ok) return;

    renderTrips(data.trips);
  } catch (err) {
    console.error("Ошибка загрузки рейсов:", err);
  }
}

// ---------- Общие помощники для статусов и запросов ----------
const STATUS_LABELS = {
  cargo: { active: "Активен", in_progress: "В работе", completed: "Завершён", cancelled: "Закрыт" },
  trip: { active: "Активен", completed: "Завершён", cancelled: "Снят с публикации" },
  response: { pending: "Ожидает", accepted: "Выбран", rejected: "Отклонён" },
};

function statusBadge(kind, status) {
  const label = (STATUS_LABELS[kind] && STATUS_LABELS[kind][status]) || status;
  return `<span class="status-badge status-${escapeHtml(status)}">${escapeHtml(label)}</span>`;
}

async function apiCall(method, url, body) {
  try {
    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await response.json();
    return { ok: response.ok, data };
  } catch (err) {
    console.error("Ошибка запроса:", err);
    return { ok: false, data: { message: "Не удалось связаться с сервером" } };
  }
}

function makeActionButton(text, onClick, extraClass = "") {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = `action-btn ${extraClass}`.trim();
  btn.textContent = text;
  btn.addEventListener("click", onClick);
  return btn;
}

async function changeStatus(url, status, onSuccess, confirmText) {
  if (confirmText && !window.confirm(confirmText)) return;
  const { ok, data } = await apiCall("PUT", url, { status });
  if (!ok) {
    showToast(data.message || "Не удалось изменить статус", true);
    return;
  }
  showToast(data.message || "Статус обновлён");
  onSuccess();
}

function renderTrips(trips) {
  tripsList.innerHTML = "";
  tripsEmpty.style.display = trips.length ? "none" : "block";

  trips.forEach((trip) => {
    const card = document.createElement("div");
    card.className = "entity-card entity-card-col";

    const subParts = [];
    if (trip.departure_date) subParts.push(formatDate(trip.departure_date));
    if (trip.capacity_kg) subParts.push(`до ${trip.capacity_kg} кг`);
    if (trip.vehicle_brand) subParts.push(`${trip.vehicle_brand} (${trip.vehicle_plate})`);

    card.innerHTML = `
      <div class="entity-card-row">
        <div class="entity-card-main">
          <div class="entity-card-title">${escapeHtml(trip.origin_city)} → ${escapeHtml(trip.destination_city)} ${statusBadge("trip", trip.status)}</div>
          ${subParts.length ? `<div class="entity-card-sub">${escapeHtml(subParts.join(" · "))}</div>` : ""}
          ${trip.price ? `<div class="entity-card-sub">${escapeHtml(formatMoney(trip.price))}</div>` : ""}
          ${trip.comment ? `<div class="entity-card-sub">${escapeHtml(trip.comment)}</div>` : ""}
        </div>
        <button class="entity-card-delete" data-id="${trip.id}">Удалить</button>
      </div>
      <div class="entity-card-actions"></div>
    `;

    const actions = card.querySelector(".entity-card-actions");
    const statusUrl = `${API_URL}/trips/${trip.id}/status`;

    if (trip.status === "active") {
      actions.appendChild(makeActionButton("Рейс выполнен", () =>
        changeStatus(statusUrl, "completed", loadTrips, "Отметить рейс выполненным? Он пропадёт с главной страницы.")));
      actions.appendChild(makeActionButton("Снять с публикации", () =>
        changeStatus(statusUrl, "cancelled", loadTrips)));
    } else if (trip.status === "cancelled") {
      actions.appendChild(makeActionButton("Опубликовать снова", () =>
        changeStatus(statusUrl, "active", loadTrips)));
    }

    card.querySelector(".entity-card-delete").addEventListener("click", () => {
      deleteEntity(`${API_URL}/trips/${trip.id}`, loadTrips, "Удалить этот рейс?");
    });

    tripsList.appendChild(card);
  });
}

if (addTripBtn) {
  addTripBtn.addEventListener("click", () => {
    tripErrorMessage.textContent = "";
    renderVehicleOptions(vehiclesCache);
    toggleForm(tripForm, true);
  });
}

if (cancelTripBtn) {
  cancelTripBtn.addEventListener("click", () => toggleForm(tripForm, false));
}

if (tripForm) {
  tripForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    tripErrorMessage.textContent = "";

    const payload = {
      originCity: document.getElementById("tripOrigin").value,
      destinationCity: document.getElementById("tripDestination").value,
      departureDate: document.getElementById("tripDate").value,
      vehicleId: document.getElementById("tripVehicle").value || null,
      capacityKg: document.getElementById("tripCapacity").value,
      price: document.getElementById("tripPrice").value,
      comment: document.getElementById("tripComment").value.trim(),
    };

    if (!payload.originCity || !payload.destinationCity) {
      tripErrorMessage.textContent = "Укажите города отправления и назначения";
      return;
    }

    const saveBtn = document.getElementById("saveTripBtn");
    saveBtn.disabled = true;
    saveBtn.textContent = "Сохранение...";

    try {
      const response = await fetch(`${API_URL}/trips`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const data = await response.json();

      if (!response.ok) {
        tripErrorMessage.textContent = data.message || "Не удалось выставить рейс";
        return;
      }

      toggleForm(tripForm, false);
      showToast("Рейс выставлен");
      loadTrips();
    } catch (err) {
      console.error("Ошибка добавления рейса:", err);
      tripErrorMessage.textContent = "Не удалось связаться с сервером";
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = "Выставить рейс";
    }
  });
}


// ==================== ПЕРЕВОЗЧИК: доступные грузы (витрина) ====================
const publicCargosList = document.getElementById("publicCargosList");
const publicCargosEmpty = document.getElementById("publicCargosEmpty");
const refreshPublicCargosBtn = document.getElementById("refreshPublicCargosBtn");

async function loadPublicCargos() {
  try {
    const response = await fetch(`${API_URL}/cargos/public`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json();
    if (!response.ok) return;

    renderPublicCargos(data.cargos);
  } catch (err) {
    console.error("Ошибка загрузки витрины грузов:", err);
  }
}

function renderPublicCargos(cargos) {
  publicCargosList.innerHTML = "";
  publicCargosEmpty.style.display = cargos.length ? "none" : "block";

  cargos.forEach((cargo) => {
    const card = document.createElement("div");
    card.className = "entity-card entity-card-col";

    const subParts = [];
    if (cargo.cargo_type) subParts.push(cargo.cargo_type);
    if (cargo.weight_kg) subParts.push(`${cargo.weight_kg} кг`);
    if (cargo.ready_date) subParts.push(`готов к ${formatDate(cargo.ready_date)}`);

    card.innerHTML = `
      <div class="entity-card-main">
        <div class="entity-card-title">${escapeHtml(cargo.origin_city)} → ${escapeHtml(cargo.destination_city)}</div>
        ${subParts.length ? `<div class="entity-card-sub">${escapeHtml(subParts.join(" · "))}</div>` : ""}
        ${cargo.price ? `<div class="entity-card-sub">Бюджет клиента: ${escapeHtml(formatMoney(cargo.price))}</div>` : ""}
        ${cargo.comment ? `<div class="entity-card-sub">${escapeHtml(cargo.comment)}</div>` : ""}
        <div class="entity-card-sub">Заказчик: ${escapeHtml(cargo.client_name || "Клиент")}</div>
      </div>
      <div class="entity-card-actions"></div>
      <form class="respond-form" style="display: none;">
        <input type="number" min="1" class="respond-price" placeholder="Ваша цена, MDL" required />
        <input type="text" class="respond-comment" placeholder="Комментарий (необязательно)" />
        <button type="submit" class="action-btn action-btn-primary">Отправить отклик</button>
      </form>
    `;

    const actions = card.querySelector(".entity-card-actions");
    const form = card.querySelector(".respond-form");

    if (cargo.my_response_status) {
      const priceText = cargo.my_response_price ? ` · ваша цена ${formatMoney(cargo.my_response_price)}` : "";
      actions.innerHTML = `${statusBadge("response", cargo.my_response_status)}<span class="entity-card-sub">Вы откликнулись${escapeHtml(priceText)}</span>`;
    } else {
      actions.appendChild(makeActionButton("Откликнуться", () => {
        form.style.display = form.style.display === "none" ? "flex" : "none";
        if (cargo.price) form.querySelector(".respond-price").value = cargo.price;
      }, "action-btn-primary"));
    }

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const submitBtn = form.querySelector("button[type=submit]");
      submitBtn.disabled = true;

      const { ok, data } = await apiCall("POST", `${API_URL}/cargos/${cargo.id}/respond`, {
        price: form.querySelector(".respond-price").value,
        comment: form.querySelector(".respond-comment").value.trim(),
      });

      submitBtn.disabled = false;

      if (!ok) {
        showToast(data.message || "Не удалось отправить отклик", true);
        loadPublicCargos();
        return;
      }

      showToast("Отклик отправлен");
      loadPublicCargos();
      loadMyResponses();
    });

    publicCargosList.appendChild(card);
  });
}

// ==================== ПЕРЕВОЗЧИК: мои отклики ====================
const myResponsesList = document.getElementById("myResponsesList");
const myResponsesEmpty = document.getElementById("myResponsesEmpty");

async function loadMyResponses() {
  if (!myResponsesList) return;
  const { ok, data } = await apiCall("GET", `${API_URL}/responses/my`);
  if (!ok) return;
  renderMyResponses(data.responses);
}

function renderMyResponses(responses) {
  myResponsesList.innerHTML = "";
  myResponsesEmpty.style.display = responses.length ? "none" : "block";

  responses.forEach((item) => {
    const card = document.createElement("div");
    card.className = "entity-card entity-card-col";

    const subParts = [];
    if (item.cargo_type) subParts.push(item.cargo_type);
    if (item.weight_kg) subParts.push(`${item.weight_kg} кг`);

    let contactHtml = "";
    if (item.status === "accepted") {
      contactHtml = `
        <div class="contact-box">
          Вас выбрали! Заказчик: <strong>${escapeHtml(item.client_name || "Клиент")}</strong>
          ${item.client_phone ? ` · <a href="tel:${escapeHtml(item.client_phone)}">${escapeHtml(item.client_phone)}</a>` : " · телефон не указан"}
        </div>`;
    }

    card.innerHTML = `
      <div class="entity-card-main">
        <div class="entity-card-title">${escapeHtml(item.origin_city)} → ${escapeHtml(item.destination_city)} ${statusBadge("response", item.status)}</div>
        ${subParts.length ? `<div class="entity-card-sub">${escapeHtml(subParts.join(" · "))}</div>` : ""}
        <div class="entity-card-sub">Ваша цена: ${escapeHtml(formatMoney(item.price))}</div>
        ${item.comment ? `<div class="entity-card-sub">${escapeHtml(item.comment)}</div>` : ""}
        ${contactHtml}
      </div>
      <div class="entity-card-actions"></div>
    `;

    if (item.status === "pending") {
      card.querySelector(".entity-card-actions").appendChild(
        makeActionButton("Отозвать отклик", () => {
          deleteEntity(`${API_URL}/responses/${item.id}`, () => {
            loadMyResponses();
            loadPublicCargos();
          }, "Отозвать отклик?");
        })
      );
    }

    myResponsesList.appendChild(card);
  });
}

if (refreshPublicCargosBtn) {
  refreshPublicCargosBtn.addEventListener("click", loadPublicCargos);
}


// ==================== КЛИЕНТ: грузы ====================
const cargosList = document.getElementById("cargosList");
const cargosEmpty = document.getElementById("cargosEmpty");
const addCargoBtn = document.getElementById("addCargoBtn");
const cancelCargoBtn = document.getElementById("cancelCargoBtn");
const cargoForm = document.getElementById("cargoForm");
const cargoErrorMessage = document.getElementById("cargoErrorMessage");

async function loadCargos() {
  try {
    const response = await fetch(`${API_URL}/cargos`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json();
    if (!response.ok) return;

    renderCargos(data.cargos);
  } catch (err) {
    console.error("Ошибка загрузки грузов:", err);
  }
}

function renderCargoResponses(box, cargo, responses) {
  box.innerHTML = "";

  if (!responses.length) {
    box.innerHTML = '<p class="empty-state">Пока нет откликов.</p>';
    return;
  }

  responses.forEach((resp) => {
    const row = document.createElement("div");
    row.className = "response-row";

    const who = resp.carrier_company
      ? `${escapeHtml(resp.carrier_name)} · ${escapeHtml(resp.carrier_company)}`
      : escapeHtml(resp.carrier_name);

    row.innerHTML = `
      <div class="response-main">
        <div class="response-title">${who}${resp.carrier_verified ? ' <span class="verified-mark" title="Проверен">✓</span>' : ""} ${typeof ratingBadge === "function" ? ratingBadge(resp.carrier_rating, resp.carrier_reviews) : ""} ${statusBadge("response", resp.status)}</div>
        <div class="response-price">${escapeHtml(formatMoney(resp.price))}</div>
        ${resp.comment ? `<div class="entity-card-sub">${escapeHtml(resp.comment)}</div>` : ""}
        ${resp.status === "accepted" ? `<div class="contact-box">Контакты перевозчика: ${resp.carrier_phone ? `<a href="tel:${escapeHtml(resp.carrier_phone)}">${escapeHtml(resp.carrier_phone)}</a>` : "телефон не указан"}</div>` : ""}
      </div>
    `;

    if (cargo.status === "active" && resp.status === "pending") {
      row.appendChild(makeActionButton("Выбрать", async () => {
        if (!window.confirm("Выбрать этого перевозчика? Остальные отклики будут отклонены, а груз пропадёт с витрины.")) return;
        const { ok, data } = await apiCall("POST", `${API_URL}/responses/${resp.id}/accept`);
        if (!ok) {
          showToast(data.message || "Не удалось выбрать перевозчика", true);
          loadCargos();
          return;
        }
        showToast("Перевозчик выбран");
        loadCargos();
      }, "action-btn-primary"));
    }

    box.appendChild(row);
  });
}

// id грузов, у которых сейчас раскрыт список откликов (чтобы не сворачивался при обновлении)
const openResponseBoxes = new Set();

function renderCargos(cargos) {
  cargosList.innerHTML = "";
  cargosEmpty.style.display = cargos.length ? "none" : "block";

  cargos.forEach((cargo) => {
    const card = document.createElement("div");
    card.className = "entity-card entity-card-col";

    const subParts = [];
    if (cargo.cargo_type) subParts.push(cargo.cargo_type);
    if (cargo.weight_kg) subParts.push(`${cargo.weight_kg} кг`);
    if (cargo.ready_date) subParts.push(`готов к ${formatDate(cargo.ready_date)}`);

    card.innerHTML = `
      <div class="entity-card-row">
        <div class="entity-card-main">
          <div class="entity-card-title">${escapeHtml(cargo.origin_city)} → ${escapeHtml(cargo.destination_city)} ${statusBadge("cargo", cargo.status)}</div>
          ${subParts.length ? `<div class="entity-card-sub">${escapeHtml(subParts.join(" · "))}</div>` : ""}
          ${cargo.price ? `<div class="entity-card-sub">${escapeHtml(formatMoney(cargo.price))}</div>` : ""}
          ${cargo.comment ? `<div class="entity-card-sub">${escapeHtml(cargo.comment)}</div>` : ""}
        </div>
        <button class="entity-card-delete" data-id="${cargo.id}">Удалить</button>
      </div>
      <div class="entity-card-actions"></div>
      <div class="responses-box" style="display: none;"></div>
    `;

    const actions = card.querySelector(".entity-card-actions");
    const box = card.querySelector(".responses-box");
    const statusUrl = `${API_URL}/cargos/${cargo.id}/status`;
    const count = cargo.responses_count || 0;

    async function showResponses() {
      const { ok, data } = await apiCall("GET", `${API_URL}/cargos/${cargo.id}/responses`);
      if (!ok) {
        showToast(data.message || "Не удалось загрузить отклики", true);
        return;
      }
      renderCargoResponses(box, cargo, data.responses);
      box.style.display = "block";
      openResponseBoxes.add(cargo.id);
    }

    actions.appendChild(makeActionButton(`Отклики (${count})`, () => {
      if (box.style.display === "none") {
        showResponses();
      } else {
        box.style.display = "none";
        openResponseBoxes.delete(cargo.id);
      }
    }, count > 0 && cargo.status === "active" ? "action-btn-primary" : ""));

    if (cargo.status === "active") {
      actions.appendChild(makeActionButton("Закрыть груз", () =>
        changeStatus(statusUrl, "cancelled", loadCargos, "Закрыть груз? Он пропадёт с витрины.")));
    } else if (cargo.status === "in_progress") {
      actions.appendChild(makeActionButton("Груз доставлен", () =>
        changeStatus(statusUrl, "completed", loadCargos, "Отметить груз доставленным?"), "action-btn-primary"));
      actions.appendChild(makeActionButton("Отменить", () =>
        changeStatus(statusUrl, "cancelled", loadCargos, "Отменить заказ?")));
    }

    card.querySelector(".entity-card-delete").addEventListener("click", () => {
      deleteEntity(`${API_URL}/cargos/${cargo.id}`, loadCargos, "Удалить этот груз вместе с откликами?");
    });

    // Для доставленного груза — оценка перевозчика (reviews.js)
    if (typeof addReviewControls === "function") addReviewControls(card, cargo, loadCargos);

    cargosList.appendChild(card);

    if (openResponseBoxes.has(cargo.id)) showResponses();
  });
}

if (addCargoBtn) {
  addCargoBtn.addEventListener("click", () => {
    cargoErrorMessage.textContent = "";
    toggleForm(cargoForm, true);
  });
}

if (cancelCargoBtn) {
  cancelCargoBtn.addEventListener("click", () => toggleForm(cargoForm, false));
}

if (cargoForm) {
  cargoForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    cargoErrorMessage.textContent = "";

    const payload = {
      originCity: document.getElementById("cargoOrigin").value,
      destinationCity: document.getElementById("cargoDestination").value,
      cargoType: document.getElementById("cargoType").value.trim(),
      weightKg: document.getElementById("cargoWeight").value,
      readyDate: document.getElementById("cargoReadyDate").value,
      price: document.getElementById("cargoPrice").value,
      comment: document.getElementById("cargoComment").value.trim(),
    };

    if (!payload.originCity || !payload.destinationCity) {
      cargoErrorMessage.textContent = "Укажите города отправления и назначения";
      return;
    }

    const saveBtn = document.getElementById("saveCargoBtn");
    saveBtn.disabled = true;
    saveBtn.textContent = "Размещение...";

    try {
      const response = await fetch(`${API_URL}/cargos`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const data = await response.json();

      if (!response.ok) {
        cargoErrorMessage.textContent = data.message || "Не удалось разместить груз";
        return;
      }

      toggleForm(cargoForm, false);
      showToast("Груз размещён");
      loadCargos();
    } catch (err) {
      console.error("Ошибка размещения груза:", err);
      cargoErrorMessage.textContent = "Не удалось связаться с сервером";
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = "Разместить";
    }
  });
}



// ---------- Навигация боковой панели ----------
function setCabinetView(view) {
  const sections = [...document.querySelectorAll(".cabinet-main .cabinet-section")];
  sections.forEach((section) => { section.style.display = "none"; });

  const show = (...ids) => ids.forEach((id) => {
    const section = document.getElementById(id);
    if (section) section.style.display = "block";
  });

  if (view === "overview") {
    show("viewSection", "profileSection");
  } else if (view === "requests") {
    if (currentUser?.role === "client") show("clientCargosSection");
    else show("publicCargosSection", "myResponsesSection");
  } else if (view === "messages") {
    show("messagesSection");
  } else if (view === "favorites") {
    show("favoritesSection");
  } else if (view === "reviews") {
    if (currentUser?.role === "carrier") show("myReviewsSection");
    else show("clientCargosSection");
  } else if (view === "transport") {
    if (currentUser?.role === "carrier") show("carrierVehiclesSection", "carrierTripsSection");
    else show("clientTripsSection");
  } else if (view === "settings") {
    show("viewSection", "profileSection", "passwordSection");
  }

  document.querySelectorAll(".sidebar-link").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === view);
  });
  const main = document.querySelector(".cabinet-main");
  if (main) main.scrollIntoView({ behavior: "smooth", block: "start" });
}

document.querySelectorAll(".sidebar-link").forEach((button) => {
  button.addEventListener("click", () => setCabinetView(button.dataset.view));
});
const sidebarCreateBtn = document.getElementById("sidebarCreateBtn");
if (sidebarCreateBtn) sidebarCreateBtn.addEventListener("click", () => {
  if (currentUser?.role === "client") {
    setCabinetView("requests");
    const addCargoBtn = document.getElementById("addCargoBtn");
    if (addCargoBtn) addCargoBtn.click();
  } else {
    setCabinetView("transport");
    const addTripBtn = document.getElementById("addTripBtn");
    if (addTripBtn) addTripBtn.click();
  }
});

// ---------- Экранирование текста для безопасной вставки в HTML ----------
function escapeHtml(value) {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}


// ---------- Выход ----------
if (logoutBtn) {
  logoutBtn.addEventListener("click", () => {

    // Удаляем токен
    localStorage.removeItem("token");

    // Возвращаемся на главную страницу
    window.location.href = "index.html";
  });
}


// ---------- Запуск ----------
// ---------- Переключение светлой / тёмной темы ----------
const themeToggleBtn = document.getElementById("themeToggleBtn");
function applyCabinetTheme(isDark) {
  document.body.classList.toggle("dark-theme", isDark);
  if (themeToggleBtn) {
    themeToggleBtn.textContent = isDark ? "Включить светлую" : "Включить тёмную";
    themeToggleBtn.setAttribute("aria-pressed", String(isDark));
  }
}
const savedTheme = localStorage.getItem("cargogo-theme");
applyCabinetTheme(savedTheme === "dark");
if (themeToggleBtn) {
  themeToggleBtn.addEventListener("click", () => {
    const isDark = !document.body.classList.contains("dark-theme");
    localStorage.setItem("cargogo-theme", isDark ? "dark" : "light");
    applyCabinetTheme(isDark);
  });
}

loadProfile();