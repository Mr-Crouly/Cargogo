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