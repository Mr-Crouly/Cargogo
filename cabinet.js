const API_URL = "http://localhost:3000/api";

const token = localStorage.getItem("token");

const loadingState = document.getElementById("loadingState");
const cabinetContent = document.getElementById("cabinetContent");
const errorState = document.getElementById("errorState");

// Если токена нет вообще — сразу отправляем на главную
if (!token) {
  window.location.href = "index.html";
}

async function loadProfile() {
  try {
    const response = await fetch(`${API_URL}/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      throw new Error("Не авторизован");
    }

    const data = await response.json();
    renderProfile(data.user, data.profile);
  } catch (err) {
    console.error(err);
    loadingState.style.display = "none";
    errorState.style.display = "block";
    localStorage.removeItem("token");
  }
}

function renderProfile(user, profile) {
  loadingState.style.display = "none";
  cabinetContent.style.display = "block";

  // Инициалы для аватара
  const initials = user.full_name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
  document.getElementById("avatarInitials").textContent = initials;

  document.getElementById("userName").textContent = user.full_name;
  document.getElementById("userRoleLabel").textContent =
    user.role === "client" ? "Клиент" : user.role === "carrier" ? "Перевозчик" : "Админ";
  document.getElementById("userEmail").textContent = user.email;
  document.getElementById("userPhone").textContent = user.phone || "Не указан";
  document.getElementById("userCreatedAt").textContent = new Date(
    user.created_at
  ).toLocaleDateString("ru-RU");

  // Профильная секция зависит от роли
  if (profile) {
    document.getElementById("companyName").textContent = profile.company_name || "Не указано";
    document.getElementById("taxId").textContent = profile.tax_id || "Не указано";
  }

  if (user.role === "client") {
    document.getElementById("profileSectionTitle").textContent = "Профиль клиента";
    document.getElementById("address").textContent = profile?.address || "Не указано";
    document.getElementById("clientCargosSection").style.display = "block";
  }

  if (user.role === "carrier") {
    document.getElementById("profileSectionTitle").textContent = "Профиль перевозчика";
    document.getElementById("addressRow").style.display = "none";
    document.getElementById("licenseRow").style.display = "flex";
    document.getElementById("verifiedRow").style.display = "flex";
    document.getElementById("licenseNumber").textContent = profile?.license_number || "Не указано";
    document.getElementById("isVerified").textContent = profile?.is_verified
      ? "Подтверждён ✓"
      : "Не подтверждён";
    document.getElementById("carrierVehiclesSection").style.display = "block";
  }
}

document.getElementById("logoutBtn").addEventListener("click", () => {
  localStorage.removeItem("token");
  window.location.href = "index.html";
});

loadProfile();
