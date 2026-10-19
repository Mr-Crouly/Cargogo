// ---------- Колокольчик уведомлений в кабинете ----------
// Зависит от cabinet.js (apiCall, API_URL, escapeHtml, showToast, currentUser, token,
// loadCargos, loadMyResponses, loadPublicCargos, openResponseBoxes) и chat.js (loadChats, openChat, chatState).
(function () {
  const POLL_MS = 15000;

  const wrap = document.getElementById("notifWrap");
  const btn = document.getElementById("notifBtn");
  const badge = document.getElementById("notifBadge");
  const panel = document.getElementById("notifPanel");
  const list = document.getElementById("notifList");
  const readAllBtn = document.getElementById("notifReadAll");

  if (!wrap || !token) {
    if (wrap) wrap.style.display = "none";
    return;
  }

  const state = { unread: null, open: false };

  function setBadge(count) {
    badge.textContent = count > 99 ? "99+" : String(count);
    badge.style.display = count > 0 ? "inline-block" : "none";
  }

  function timeLabel(value) {
    const date = new Date(value);
    const diff = Math.floor((Date.now() - date.getTime()) / 60000);
    if (diff < 1) return "только что";
    if (diff < 60) return `${diff} мин назад`;
    const time = date.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
    if (date.toDateString() === new Date().toDateString()) return `сегодня, ${time}`;
    return `${date.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" })}, ${time}`;
  }

  function scrollToSection(id) {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // Обновляем то, что могло измениться из-за нового события
  function refreshAfterNotification() {
    if (!currentUser) return;
    if (currentUser.role === "client") loadCargos();
    if (currentUser.role === "carrier") {
      loadMyResponses();
      loadPublicCargos();
    }
    if (typeof chatState !== "undefined" && !chatState.activeChat && typeof chatEls !== "undefined" && chatEls.list) {
      loadChats(true);
    }
  }

  async function fetchUnreadCount() {
    const { ok, data } = await apiCall("GET", `${API_URL}/notifications/count`);
    if (!ok) return;

    const previous = state.unread;
    state.unread = data.unread;
    setBadge(data.unread);

    // Первый запрос только запоминает число, тост показываем только о новых событиях
    if (previous !== null && data.unread > previous) {
      showToast("У вас новое уведомление");
      refreshAfterNotification();
      if (state.open) loadNotifications();
    }
  }
  window.fetchUnreadCount = fetchUnreadCount;

  async function loadNotifications() {
    const { ok, data } = await apiCall("GET", `${API_URL}/notifications`);
    if (!ok) {
      list.innerHTML = '<p class="notif-empty">Не удалось загрузить уведомления</p>';
      return;
    }
    state.unread = data.unread;
    setBadge(data.unread);
    render(data.notifications);
  }

  function render(items) {
    list.innerHTML = "";
    if (items.length === 0) {
      list.innerHTML = '<p class="notif-empty">Уведомлений пока нет</p>';
      return;
    }

    items.forEach((item) => {
      const row = document.createElement("button");
      row.type = "button";
      row.className = `notif-item${item.is_read ? "" : " unread"}`;
      const more = item.repeat_count > 1 ? ` (${item.repeat_count})` : "";
      row.innerHTML = `<div>${escapeHtml(item.text)}${escapeHtml(more)}</div><div class="notif-time">${escapeHtml(timeLabel(item.created_at))}</div>`;
      row.addEventListener("click", () => openNotification(item));
      list.appendChild(row);
    });
  }

  async function openNotification(item) {
    closePanel();

    if (!item.is_read) {
      await apiCall("POST", `${API_URL}/notifications/${item.id}/read`);
      fetchUnreadCount();
    }

    if (item.target === "cargo") {
      // Клиент: открываем отклики на этот груз
      if (item.cargo_id) openResponseBoxes.add(item.cargo_id);
      await loadCargos();
      scrollToSection("clientCargosSection");
    } else if (item.target === "my-responses") {
      await loadMyResponses();
      scrollToSection("myResponsesSection");
    } else if (item.target === "chat") {
      scrollToSection("messagesSection");
      const { ok, data } = await apiCall("GET", `${API_URL}/chats`);
      const chat = ok ? data.chats.find((c) => c.id === item.ref_id) : null;
      if (chat) openChat(chat);
      else loadChats();
    }
  }

  function openPanel() {
    state.open = true;
    panel.style.display = "block";
    btn.setAttribute("aria-expanded", "true");
    loadNotifications();
  }

  function closePanel() {
    state.open = false;
    panel.style.display = "none";
    btn.setAttribute("aria-expanded", "false");
  }

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    state.open ? closePanel() : openPanel();
  });

  readAllBtn.addEventListener("click", async () => {
    await apiCall("POST", `${API_URL}/notifications/read-all`);
    await loadNotifications();
  });

  document.addEventListener("click", (e) => {
    if (state.open && !wrap.contains(e.target)) closePanel();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && state.open) closePanel();
  });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) fetchUnreadCount();
  });

  fetchUnreadCount();
  setInterval(() => {
    if (!document.hidden) fetchUnreadCount();
  }, POLL_MS);
})();
