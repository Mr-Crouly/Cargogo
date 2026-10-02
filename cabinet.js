const API_URL = "http://localhost:3000/api";

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

    renderProfile(data.user, data.profile);

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
  cabinetContent.style.display = "block";

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
      loadPublicCargos();
    }
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
        editErrorMessage.textContent = data. message || "Не удалось сохранить изменения";
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

function renderTrips(trips) {
  tripsList.innerHTML = "";
  tripsEmpty.style.display = trips.length ? "none" : "block";

  trips.forEach((trip) => {
    const card = document.createElement("div");
    card.className = "entity-card";

    const subParts = [];
    if (trip.departure_date) subParts.push(formatDate(trip.departure_date));
    if (trip.capacity_kg) subParts.push(`до ${trip.capacity_kg} кг`);
    if (trip.vehicle_brand) subParts.push(`${trip.vehicle_brand} (${trip.vehicle_plate})`);

    card.innerHTML = `
      <div class="entity-card-main">
        <div class="entity-card-title">${escapeHtml(trip.origin_city)} → ${escapeHtml(trip.destination_city)}</div>
        ${subParts.length ? `<div class="entity-card-sub">${escapeHtml(subParts.join(" · "))}</div>` : ""}
        ${trip.price ? `<div class="entity-card-sub">${escapeHtml(formatMoney(trip.price))}</div>` : ""}
        ${trip.comment ? `<div class="entity-card-sub">${escapeHtml(trip.comment)}</div>` : ""}
      </div>
      <button class="entity-card-delete" data-id="${trip.id}">Удалить</button>
    `;

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
    card.className = "entity-card";

    const subParts = [];
    if (cargo.cargo_type) subParts.push(cargo.cargo_type);
    if (cargo.weight_kg) subParts.push(`${cargo.weight_kg} кг`);
    if (cargo.ready_date) subParts.push(`готов к ${formatDate(cargo.ready_date)}`);

    const contactName = cargo.client_name || "Клиент";
    const contactPhone = cargo.client_phone;

    card.innerHTML = `
      <div class="entity-card-main">
        <div class="entity-card-title">${escapeHtml(cargo.origin_city)} → ${escapeHtml(cargo.destination_city)}</div>
        ${subParts.length ? `<div class="entity-card-sub">${escapeHtml(subParts.join(" · "))}</div>` : ""}
        ${cargo.price ? `<div class="entity-card-sub">${escapeHtml(formatMoney(cargo.price))}</div>` : ""}
        ${cargo.comment ? `<div class="entity-card-sub">${escapeHtml(cargo.comment)}</div>` : ""}
        <div class="entity-card-sub">
          Заказчик: ${escapeHtml(contactName)}${contactPhone ? ` · <a href="tel:${escapeHtml(contactPhone)}">${escapeHtml(contactPhone)}</a>` : ""}
        </div>
      </div>
    `;

    publicCargosList.appendChild(card);
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

function renderCargos(cargos) {
  cargosList.innerHTML = "";
  cargosEmpty.style.display = cargos.length ? "none" : "block";

  cargos.forEach((cargo) => {
    const card = document.createElement("div");
    card.className = "entity-card";

    const subParts = [];
    if (cargo.cargo_type) subParts.push(cargo.cargo_type);
    if (cargo.weight_kg) subParts.push(`${cargo.weight_kg} кг`);
    if (cargo.ready_date) subParts.push(`готов к ${formatDate(cargo.ready_date)}`);

    card.innerHTML = `
      <div class="entity-card-main">
        <div class="entity-card-title">${escapeHtml(cargo.origin_city)} → ${escapeHtml(cargo.destination_city)}</div>
        ${subParts.length ? `<div class="entity-card-sub">${escapeHtml(subParts.join(" · "))}</div>` : ""}
        ${cargo.price ? `<div class="entity-card-sub">${escapeHtml(formatMoney(cargo.price))}</div>` : ""}
        ${cargo.comment ? `<div class="entity-card-sub">${escapeHtml(cargo.comment)}</div>` : ""}
      </div>
      <button class="entity-card-delete" data-id="${cargo.id}">Удалить</button>
    `;

    card.querySelector(".entity-card-delete").addEventListener("click", () => {
      deleteEntity(`${API_URL}/cargos/${cargo.id}`, loadCargos, "Удалить этот груз?");
    });

    cargosList.appendChild(card);
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
loadProfile();