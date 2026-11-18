(() => {
  const API = "/api";
  const $ = (id) => document.getElementById(id);
  let token = localStorage.getItem("token") || "";
  let activeView = "overview";
  const titles = { overview:"Обзор", submissions:"Заявки на модерацию", users:"Пользователи", cargos:"Все грузы", trips:"Все рейсы", audit:"Журнал действий", express:"Экспресс-заявки" };
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const date = (v) => v ? new Date(v).toLocaleString("ru-RU", {dateStyle:"short", timeStyle:"short"}) : "—";
  const money = (v) => v == null ? "—" : `${Number(v).toLocaleString("ru-RU")} MDL`;
  async function api(path, options={}) {
    const response = await fetch(`${API}${path}`, { ...options, headers: { "Content-Type":"application/json", Authorization:`Bearer ${token}`, ...(options.headers||{}) } });
    let data = {}; try { data = await response.json(); } catch (_) {}
    if (!response.ok) {
      const error = new Error(data.message || "Ошибка запроса");
      error.status = response.status;
      throw error;
    }
    return data;
  }
  function notice(message, error=false) { const el=$("notice"); el.textContent=message; el.className=`notice show${error?" error":""}`; setTimeout(()=>el.className="notice",4500); }
  function showLogin(message = "Сначала войдите в аккаунт администратора.") { sessionStorage.setItem("adminAccessMessage", message); location.href = "cabinet.html"; }
  function showApp() { $("adminApp").hidden=false; }
  function setView(view) {
    activeView=view; document.querySelectorAll(".view").forEach(el=>el.classList.toggle("active",el.id===`view-${view}`));
    document.querySelectorAll(".nav-item").forEach(el=>el.classList.toggle("active",el.dataset.view===view));
    $("pageTitle").textContent=titles[view]||"Панель"; loadView(view).catch(e=>notice(e.message,true));
  }
  const table = (headers, rows) => rows.length ? `<table><thead><tr>${headers.map(h=>`<th>${h}</th>`).join("")}</tr></thead><tbody>${rows.join("")}</tbody></table>` : `<div class="empty">Записей пока нет</div>`;
  const status = (s) => `<span class="status ${esc(s)}">${({pending:"На проверке",approved:"Опубликовано",rejected:"Отклонено",hidden:"Скрыто",active:"Активно",completed:"Завершено",blocked:"Заблокирован"})[s]||esc(s||"—")}</span>`;
  function submissionRow(x) {
    const kind=x.type==="cargo"?"Груз":"Рейс";
    const moderation=x.moderation_status;
    const actions=moderation==="pending"?`<div class="actions"><button class="mini accept" data-moderate="approved" data-type="${x.type}" data-id="${x.id}">Принять</button><button class="mini reject" data-moderate="rejected" data-type="${x.type}" data-id="${x.id}">Отклонить</button></div>`:
      `<div class="actions">${moderation!=="approved"?`<button class="mini accept" data-moderate="approved" data-type="${x.type}" data-id="${x.id}">Опубликовать</button>`:""}${moderation==="approved"?`<button class="mini danger" data-moderate="hidden" data-type="${x.type}" data-id="${x.id}">Скрыть</button>`:""}</div>`;
    return `<tr><td><strong>${kind} #${x.id}</strong><small>${date(x.created_at)}</small></td><td><span class="route">${esc(x.origin_city)} → ${esc(x.destination_city)}</span><small>${esc(x.details||"")} ${x.amount?`· ${esc(x.amount)} кг`:""}</small></td><td><strong>${esc(x.owner_name)}</strong><small>${esc(x.owner_email)} · ${esc(x.owner_phone)}</small></td><td>${money(x.price)}</td><td>${status(moderation)}${x.moderation_reason?`<small>${esc(x.moderation_reason)}</small>`:""}</td><td>${actions}</td></tr>`;
  }
  async function loadOverview() {
    const d=await api("/admin/overview"), s=d.stats;
    const cards=[["Пользователи",s.users,"♙","Всего аккаунтов"],["Заявки на проверке",s.pending,"◷","Нужна модерация"],["Грузы",s.cargos,"▣","Все объявления"],["Рейсы",s.trips,"▱","Все предложения"],["Заблокировано",s.blocked,"⊘","Аккаунты"],["Опубликовано",s.approved,"✓","Прошли модерацию"]];
    $("statsGrid").innerHTML=cards.map(c=>`<div class="stat-card"><div class="stat-top"><span>${c[0]}</span><span class="stat-icon">${c[2]}</span></div><div class="stat-value">${c[1]}</div><div class="stat-note">${c[3]}</div></div>`).join("");
    $("pendingBadge").textContent=s.pending;
    const q=await api("/admin/submissions?type=all&status=pending");
    $("overviewPending").innerHTML=table(["Заявка","Маршрут","Автор","Цена","Статус","Действия"],q.submissions.slice(0,6).map(submissionRow));
  }
  async function loadSubmissions() {
    const type=$("submissionType").value, statusValue=$("submissionStatus").value;
    const d=await api(`/admin/submissions?type=${type}&status=${statusValue}`);
    $("submissionsTable").innerHTML=table(["Заявка","Маршрут","Автор","Цена","Статус","Действия"],d.submissions.map(submissionRow));
  }
  async function loadUsers() {
    const q=encodeURIComponent($("userSearch").value.trim()), d=await api(`/admin/users?q=${q}`);
    $("usersTable").innerHTML=table(["Пользователь","Контакты","Роль","Объявления","Статус","Действия"],d.users.map(u=>`<tr><td><strong>${esc(u.full_name)}</strong><small>#${u.id} · ${date(u.created_at)}</small></td><td>${esc(u.email)}<small>${esc(u.phone)}</small></td><td>${u.role==="carrier"?"Перевозчик":"Клиент"}<small>${esc(u.company_name||"")}</small></td><td>${u.cargo_count} грузов · ${u.trip_count} рейсов</td><td>${u.is_blocked?status("blocked"):status("active")}</td><td><button class="mini ${u.is_blocked?"accept":"danger"}" data-user-block="${u.id}" data-blocked="${!u.is_blocked}">${u.is_blocked?"Разблокировать":"Заблокировать"}</button></td></tr>`));
  }
  async function loadAnnouncements(view) {
    const d = await api("/admin/announcements");
    // The navigation sends "cargos" / "trips" (plural). Normalize it here
    // so we always select the correct data array and HTML container.
    const isCargo = view === "cargos" || view === "cargo";
    const type = isCargo ? "cargo" : "trip";
    const list = isCargo ? d.cargos : d.trips;
    const targetId = isCargo ? "cargosTable" : "tripsTable";
    if (!Array.isArray(list)) throw new Error(`Сервер не вернул список ${isCargo ? "грузов" : "рейсов"}.`);
    const rows = list.map(x => `<tr><td><strong>#${x.id}</strong><small>${date(x.created_at)}</small></td><td><span class="route">${esc(x.origin_city || x.origin_address || "—")} → ${esc(x.destination_city || x.destination_address || "—")}</span><small>${esc(x.cargo_type || x.comment || "")}</small></td><td><strong>${esc(x.owner_name || "Клиент без аккаунта")}</strong><small>${esc(x.owner_email || x.owner_phone || "")}</small></td><td>${money(x.price)}</td><td>${status(x.moderation_status)}<small>Системный статус: ${esc(x.status)}</small></td><td>${x.moderation_status !== "approved" ? `<button class="mini accept" data-moderate="approved" data-type="${type}" data-id="${x.id}">Опубликовать</button>` : `<button class="mini danger" data-moderate="hidden" data-type="${type}" data-id="${x.id}">Скрыть</button>`}</td></tr>`);
    const target = $(targetId);
    if (!target) throw new Error(`Не найден контейнер: ${targetId}`);
    target.innerHTML = table(["ID", "Маршрут", "Владелец", "Цена", "Статус", "Действия"], rows);
  }
  async function loadExpressRequests() {
    const filter = $("expressStatusFilter").value;
    const d = await api(`/admin/express-requests?status=${filter}`);
    const rows = d.requests.map(x => `<tr><td><strong>#${x.id} · ${esc(x.contact_name)}</strong><small>${date(x.created_at)}</small></td><td>${esc(x.phone)}</td><td><span class="route">${esc(x.origin_address)} → ${esc(x.destination_address)}</span><small>${esc(x.cargo_description)}</small></td><td>${x.desired_date ? date(x.desired_date) : "—"}</td><td>${status(x.status)}${x.published_cargo_id ? `<small>Опубликован груз #${x.published_cargo_id}</small>` : ""}</td><td><div class="actions">${x.published_cargo_id ? `<span class="status approved">Опубликовано</span>` : `<button class="mini accept" data-express-publish="${x.id}">Опубликовать для перевозчиков</button>`}<button class="mini" data-express-status="completed" data-id="${x.id}">Завершить</button></div></td></tr>`);
    $("expressRequestsTable").innerHTML = table(["Заявка","Телефон","Маршрут и груз","Дата","Статус","Действия"], rows);
    $("expressBadge").textContent = d.requests.filter(x => x.status === "new").length;
  }
  async function loadAudit() {
    const d=await api("/admin/audit");
    $("auditTable").innerHTML=table(["Дата","Администратор","Действие","Объект","Детали"],d.entries.map(a=>`<tr><td>${date(a.created_at)}</td><td>${esc(a.admin_name||"—")}</td><td>${esc(a.action)}</td><td>${esc(a.entity_type)} #${esc(a.entity_id)}</td><td>${esc(a.details||"—")}</td></tr>`));
  }
  async function loadView(view) {
    if(view==="overview") return loadOverview(); if(view==="submissions") return loadSubmissions(); if(view==="users") return loadUsers(); if(view==="cargos"||view==="trips") return loadAnnouncements(view); if(view==="audit") return loadAudit(); if(view==="express") return loadExpressRequests();
  }
  async function checkAccess() {
    if(!token){showLogin("Сначала войдите в аккаунт.");return;}
    try{await api("/admin/overview");showApp();setView(activeView);}catch(e){
      if(e.status===401){localStorage.removeItem("token");token="";showLogin("Сессия истекла. Войдите снова.");return;}
      if(e.status===403){showLogin("У вашего аккаунта нет прав администратора.");return;}
      notice(e.message,true);
    }
  }
  $("adminNav").addEventListener("click",e=>{const b=e.target.closest("[data-view]");if(b)setView(b.dataset.view);});
  document.addEventListener("click",async e=>{
    const go=e.target.closest("[data-go]");if(go){setView(go.dataset.go);return;}
    const mod=e.target.closest("[data-moderate]");if(mod){let reason="";if(mod.dataset.moderate==="rejected"){reason=prompt("Укажите причину отклонения:")||"";if(reason.trim().length<3){notice("Нужно указать причину отказа (не менее 3 символов).",true);return;}}else if(mod.dataset.moderate==="hidden"){reason=prompt("Причина скрытия (необязательно):")||"";}
      try{const d=await api(`/admin/${mod.dataset.type}/${mod.dataset.id}/moderation`,{method:"PATCH",body:JSON.stringify({status:mod.dataset.moderate,reason})});notice(d.message);await loadView(activeView);if(activeView!=="overview")await loadOverview();}catch(err){notice(err.message,true);}return;}
    const publish=e.target.closest("[data-express-publish]");if(publish){if(!confirm("Опубликовать эту заявку как груз, доступный всем перевозчикам?"))return;try{const d=await api(`/admin/express-requests/${publish.dataset.expressPublish}/publish`,{method:"POST"});notice(d.message);await loadExpressRequests();}catch(err){notice(err.message,true);}return;}
    const express=e.target.closest("[data-express-status]");if(express){try{const d=await api(`/admin/express-requests/${express.dataset.id}/status`,{method:"PATCH",body:JSON.stringify({status:express.dataset.expressStatus})});notice(d.message);await loadExpressRequests();}catch(err){notice(err.message,true);}return;}
    const user=e.target.closest("[data-user-block]");if(user){const blocked=user.dataset.blocked==="true";if(!confirm(blocked?"Заблокировать этого пользователя?":"Снять блокировку пользователя?"))return;try{const d=await api(`/admin/users/${user.dataset.userBlock}/block`,{method:"PATCH",body:JSON.stringify({blocked})});notice(d.message);await loadUsers();await loadOverview();}catch(err){notice(err.message,true);}}
  });
  $("expressStatusFilter").addEventListener("change",()=>loadExpressRequests().catch(e=>notice(e.message,true)));
  $("submissionType").addEventListener("change",()=>loadSubmissions().catch(e=>notice(e.message,true)));
  $("submissionStatus").addEventListener("change",()=>loadSubmissions().catch(e=>notice(e.message,true)));
  let searchTimer;$("userSearch").addEventListener("input",()=>{clearTimeout(searchTimer);searchTimer=setTimeout(()=>loadUsers().catch(e=>notice(e.message,true)),250);});
  $("refreshBtn").addEventListener("click",()=>loadView(activeView).then(()=>notice("Данные обновлены")).catch(e=>notice(e.message,true)));
  $("logoutBtn").addEventListener("click",()=>{location.href="cabinet.html";});
  checkAccess();
})();
