// ---------- Смена пароля и ограничения полей дат ----------
// Зависит от cabinet.js (apiCall, API_URL, showToast).
(function () {
  const changeBtn = document.getElementById("changePasswordBtn");
  const form = document.getElementById("passwordForm");
  const cancelBtn = document.getElementById("cancelPasswordBtn");
  const saveBtn = document.getElementById("savePasswordBtn");
  const errorBox = document.getElementById("passwordErrorMessage");

  function setOpen(open) {
    form.style.display = open ? "block" : "none";
    changeBtn.style.display = open ? "none" : "inline-block";
    errorBox.textContent = "";
    if (!open) form.reset();
    else document.getElementById("currentPassword").focus();
  }

  if (changeBtn && form) {
    changeBtn.addEventListener("click", () => setOpen(true));
    cancelBtn.addEventListener("click", () => setOpen(false));

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      errorBox.textContent = "";

      const currentPassword = document.getElementById("currentPassword").value;
      const newPassword = document.getElementById("newPassword").value;
      const repeat = document.getElementById("newPassword2").value;

      if (newPassword !== repeat) {
        errorBox.textContent = "Новые пароли не совпадают";
        return;
      }

      saveBtn.disabled = true;
      saveBtn.textContent = "Сохранение...";
      const { ok, data } = await apiCall("PUT", `${API_URL}/password`, { currentPassword, newPassword });
      saveBtn.disabled = false;
      saveBtn.textContent = "Сохранить";

      if (!ok) {
        errorBox.textContent = data.message || "Не удалось сменить пароль";
        return;
      }

      setOpen(false);
      showToast("Пароль изменён");
    });
  }

  // В полях дат нельзя выбрать прошедший день (сервер проверяет это тоже)
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  ["tripDate", "cargoReadyDate"].forEach((id) => {
    const input = document.getElementById(id);
    if (input) input.min = today;
  });
})();
