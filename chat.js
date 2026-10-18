// ---------- Раздел «Сообщения»: чат клиент ↔ перевозчик ----------
// Зависит от cabinet.js (apiCall, API_URL, escapeHtml, showToast, currentUser).

const CHAT_POLL_MS = 3000;
const CHAT_LIST_POLL_MS = 10000;
const CHAT_MAX_LENGTH = 2000;

const chatState = {
  activeChat: null,   // объект чата из списка
  lastMessageId: 0,
  canSend: false,
  pollTimer: null,
  listTimer: null,
  loading: false,
};

const chatEls = {};

function chatTime(value) {
  const d = new Date(value);
  const now = new Date();
  const time = d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  if (d.toDateString() === now.toDateString()) return time;
  return `${d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" })} ${time}`;
}

function chatDayLabel(value) {
  const d = new Date(value);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Сегодня";
  if (d.toDateString() === yesterday.toDateString()) return "Вчера";
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
}

// ---------- Список чатов ----------
async function loadChats(silent = false) {
  const { ok, data } = await apiCall("GET", `${API_URL}/chats`);
  if (!ok) {
    if (!silent) chatEls.list.innerHTML = `<p class="empty-hint">Не удалось загрузить сообщения</p>`;
    return;
  }
  renderChatList(data.chats);
}

function renderChatList(chats) {
  if (chats.length === 0) {
    chatEls.list.innerHTML = `<p class="empty-hint">Здесь появятся переписки, когда клиент выберет перевозчика по грузу.</p>`;
    return;
  }

  chatEls.list.innerHTML = "";
  chats.forEach((chat) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "chat-list-item";

    let preview = "Напишите первым";
    if (chat.last_message) {
      const mine = chat.last_sender_id === currentUser.id;
      preview = (mine ? "Вы: " : "") + chat.last_message;
    }

    card.innerHTML = `
      <div class="chat-list-top">
        <span class="chat-list-name">${escapeHtml(chat.partner_name)}</span>
        <span class="chat-list-time">${chat.last_message_at ? escapeHtml(chatTime(chat.last_message_at)) : ""}</span>
      </div>
      <div class="chat-list-route">${escapeHtml(chat.origin_city)} → ${escapeHtml(chat.destination_city)}${chat.cargo_type ? " · " + escapeHtml(chat.cargo_type) : ""}</div>
      <div class="chat-list-preview">${escapeHtml(preview)}</div>
    `;
    card.addEventListener("click", () => openChat(chat));
    chatEls.list.appendChild(card);
  });
}

// ---------- Окно переписки ----------
async function openChat(chat) {
  chatState.activeChat = chat;
  chatState.lastMessageId = 0;
  chatState.canSend = false;

  chatEls.listView.style.display = "none";
  chatEls.convView.style.display = "flex";
  chatEls.convTitle.textContent = chat.partner_name;
  chatEls.convRoute.textContent =
    `${chat.origin_city} → ${chat.destination_city}${chat.cargo_type ? " · " + chat.cargo_type : ""}`;
  chatEls.messages.innerHTML = "";
  chatEls.messages.dataset.lastDay = "";
  chatEls.input.value = "";

  clearInterval(chatState.listTimer);
  await fetchMessages();
  chatEls.messages.scrollTop = chatEls.messages.scrollHeight;
  if (chatState.canSend) chatEls.input.focus();

  clearInterval(chatState.pollTimer);
  chatState.pollTimer = setInterval(() => {
    if (!document.hidden) fetchMessages();
  }, CHAT_POLL_MS);
}

function closeChat() {
  clearInterval(chatState.pollTimer);
  chatState.activeChat = null;
  chatEls.convView.style.display = "none";
  chatEls.listView.style.display = "block";
  loadChats();
  startChatListPolling();
}

function startChatListPolling() {
  clearInterval(chatState.listTimer);
  chatState.listTimer = setInterval(() => {
    if (!document.hidden && !chatState.activeChat) loadChats(true);
  }, CHAT_LIST_POLL_MS);
}

async function fetchMessages() {
  const chat = chatState.activeChat;
  if (!chat || chatState.loading) return;
  chatState.loading = true;

  const { ok, data } = await apiCall(
    "GET",
    `${API_URL}/chats/${chat.id}/messages?after=${chatState.lastMessageId}`
  );
  chatState.loading = false;

  // Пока шёл запрос, пользователь мог закрыть чат или открыть другой
  if (!ok || chatState.activeChat !== chat) return;

  updateComposer(data.canSend);
  if (data.messages.length > 0) appendMessages(data.messages);
}

function updateComposer(canSend) {
  chatState.canSend = canSend;
  chatEls.form.style.display = canSend ? "flex" : "none";
  chatEls.readonly.style.display = canSend ? "none" : "block";
}

function appendMessages(messages) {
  const box = chatEls.messages;
  const nearBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 80;
  const lastDay = box.dataset.lastDay || "";
  let prevDay = lastDay;

  messages.forEach((msg) => {
    if (box.querySelector(`[data-id="${msg.id}"]`)) return; // уже показано (ответ POST + опрос)

    const day = new Date(msg.created_at).toDateString();
    if (day !== prevDay) {
      const sep = document.createElement("div");
      sep.className = "chat-day";
      sep.textContent = chatDayLabel(msg.created_at);
      box.appendChild(sep);
      prevDay = day;
    }

    const mine = msg.sender_id === currentUser.id;
    const bubble = document.createElement("div");
    bubble.className = `chat-bubble ${mine ? "chat-bubble-mine" : "chat-bubble-theirs"}`;
    bubble.dataset.id = msg.id;
    bubble.innerHTML = `
      <div class="chat-bubble-text">${escapeHtml(msg.message_text)}</div>
      <div class="chat-bubble-time">${escapeHtml(chatTime(msg.created_at))}</div>
    `;
    box.appendChild(bubble);
    chatState.lastMessageId = Math.max(chatState.lastMessageId, msg.id);
  });

  box.dataset.lastDay = prevDay;
  const lastIsMine = messages[messages.length - 1].sender_id === currentUser.id;
  if (nearBottom || lastIsMine) box.scrollTop = box.scrollHeight;
}

async function sendChatMessage(event) {
  event.preventDefault();
  const chat = chatState.activeChat;
  const text = chatEls.input.value.trim();
  if (!chat || !text) return;

  chatEls.send.disabled = true;
  const { ok, data } = await apiCall("POST", `${API_URL}/chats/${chat.id}/messages`, { text });
  chatEls.send.disabled = false;

  if (!ok) {
    showToast(data.message || "Не удалось отправить сообщение", true);
    if (data.message && data.message.includes("только для чтения")) updateComposer(false);
    return;
  }

  chatEls.input.value = "";
  chatEls.input.style.height = "auto";
  appendMessages([data.message]);
  chatEls.input.focus();
}

// ---------- Инициализация ----------
function initMessages() {
  const section = document.getElementById("messagesSection");
  if (!section) return;

  Object.assign(chatEls, {
    list: document.getElementById("chatList"),
    listView: document.getElementById("chatListView"),
    convView: document.getElementById("chatConversation"),
    convTitle: document.getElementById("chatConvTitle"),
    convRoute: document.getElementById("chatConvRoute"),
    messages: document.getElementById("chatMessages"),
    form: document.getElementById("chatForm"),
    input: document.getElementById("chatInput"),
    send: document.getElementById("chatSendBtn"),
    readonly: document.getElementById("chatReadonly"),
    back: document.getElementById("chatBackBtn"),
  });

  section.style.display = "block";
  chatEls.back.addEventListener("click", closeChat);
  chatEls.form.addEventListener("submit", sendChatMessage);

  // Enter — отправить, Shift+Enter — перенос строки
  chatEls.input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      chatEls.form.requestSubmit();
    }
  });
  chatEls.input.addEventListener("input", () => {
    chatEls.input.style.height = "auto";
    chatEls.input.style.height = Math.min(chatEls.input.scrollHeight, 120) + "px";
  });

  loadChats();
  startChatListPolling();
}
