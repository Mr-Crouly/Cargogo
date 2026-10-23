// ---------- Рейсы для клиента, отзывы и рейтинг ----------
// Подключается ДО cabinet.js: здесь только определения функций. Всё, что нужно из cabinet.js
// (apiCall, API_URL, escapeHtml, formatDate, formatMoney, makeActionButton, showToast),
// берётся в момент вызова, когда кабинет уже загружен. Списки городов заполняет cities.js
// (атрибут data-cities); здесь только дополняем их городами, которых в общем списке нет
// (например, из старых рейсов), чтобы такие рейсы можно было найти и подставить в форму.
(function () {
  const stars = (n) => "★".repeat(n) + "☆".repeat(5 - n);

  function plural(n, forms) {
    const mod10 = n % 10, mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return forms[0];
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return forms[1];
    return forms[2];
  }
  const reviewsWord = (n) => `${n} ${plural(n, ["отзыв", "отзыва", "отзывов"])}`;

  // Значок рейтинга для списков откликов и рейсов
  window.ratingBadge = function (rating, count) {
    if (!count) return '<span class="rating rating-none">нет отзывов</span>';
    return `<span class="rating" title="${reviewsWord(count)}">★ ${Number(rating).toFixed(1)} (${count})</span>`;
  };

  // ==================== КЛИЕНТ: рейсы перевозчиков ====================
  let allTrips = [];

  const el = (id) => document.getElementById(id);

  // Сравнение названий без учёта регистра и разницы «е/ё»
  const norm = (name) => String(name || "").trim().toLowerCase().replace(/ё/g, "е");

  // Есть ли в списке такой город; если нет — добавляем в группу «Другие». Возвращает значение option.
  function ensureOption(select, city) {
    const found = [...select.options].find((o) => o.value && norm(o.value) === norm(city));
    if (found) return found.value;

    let group = select.querySelector('optgroup[data-extra="true"]');
    if (!group) {
      group = document.createElement("optgroup");
      group.label = "Другие";
      group.dataset.extra = "true";
      select.appendChild(group);
    }
    const option = document.createElement("option");
    option.value = city;
    option.textContent = city;
    group.appendChild(option);
    return city;
  }

  async function loadClientTrips() {
    const list = el("clientTripsList");
    if (!list) return;

    const { ok, data } = await apiCall("GET", `${API_URL}/trips/public`);
    if (!ok) return;

    allTrips = data.trips;
    // Города из рейсов, которых нет в общем списке (введены вручную), тоже попадают в фильтр
    allTrips.forEach((t) => {
      ensureOption(el("tripsFilterOrigin"), t.origin_city);
      ensureOption(el("tripsFilterDestination"), t.destination_city);
    });
    renderClientTrips();
  }
  window.loadClientTrips = loadClientTrips;

  function filteredTrips() {
    const origin = el("tripsFilterOrigin").value;
    const destination = el("tripsFilterDestination").value;
    return allTrips.filter(
      (t) =>
        (!origin || norm(t.origin_city) === norm(origin)) &&
        (!destination || norm(t.destination_city) === norm(destination))
    );
  }

  function renderClientTrips() {
    const list = el("clientTripsList");
    const empty = el("clientTripsEmpty");
    const trips = filteredTrips();

    list.innerHTML = "";
    empty.style.display = trips.length ? "none" : "block";
    empty.textContent = allTrips.length ? "По этому маршруту рейсов нет." : "Подходящих рейсов пока нет.";

    trips.forEach((trip) => {
      const card = document.createElement("div");
      card.className = "entity-card entity-card-col";

      const sub = [];
      if (trip.departure_date) sub.push(formatDate(trip.departure_date));
      if (trip.capacity_kg) sub.push(`свободно до ${trip.capacity_kg} кг`);

      const car = [[trip.vehicle_brand, trip.vehicle_model].filter(Boolean).join(" "), trip.vehicle_body_type,
        trip.vehicle_capacity ? `до ${trip.vehicle_capacity} кг` : null].filter(Boolean).join(" · ");

      const who = trip.carrier_company ? `${trip.carrier_name} · ${trip.carrier_company}` : trip.carrier_name;
      const phone = trip.carrier_phone
        ? `<a href="tel:${escapeHtml(trip.carrier_phone)}">${escapeHtml(trip.carrier_phone)}</a>`
        : "телефон не указан";

      card.innerHTML = `
        <div class="entity-card-main">
          <div class="entity-card-title">${escapeHtml(trip.origin_city)} → ${escapeHtml(trip.destination_city)}</div>
          ${sub.length ? `<div class="entity-card-sub">${escapeHtml(sub.join(" · "))}</div>` : ""}
          ${trip.price ? `<div class="entity-card-sub">Цена перевозчика: ${escapeHtml(formatMoney(trip.price))}</div>` : ""}
          ${car ? `<div class="entity-card-sub">Автомобиль: ${escapeHtml(car)}</div>` : ""}
          ${trip.comment ? `<div class="entity-card-sub">${escapeHtml(trip.comment)}</div>` : ""}
          <div class="entity-card-sub">Перевозчик: ${escapeHtml(who)}${trip.carrier_verified ? ' <span class="verified-mark" title="Проверен">✓</span>' : ""}${window.ratingBadge(trip.carrier_rating, trip.carrier_reviews)}</div>
          <div class="contact-box">Контакты: ${phone}</div>
        </div>
        <div class="entity-card-actions"></div>
      `;

      card.querySelector(".entity-card-actions").appendChild(
        makeActionButton("Разместить груз по этому маршруту", () => prefillCargoForm(trip))
      );
      list.appendChild(card);
    });
  }

  function setCity(select, city) {
    select.value = ensureOption(select, city);
    select.dispatchEvent(new Event("change"));
  }

  // Открывает форму «Разместить груз» с уже заполненным маршрутом и датой рейса
  function prefillCargoForm(trip) {
    el("addCargoBtn").click();
    setCity(el("cargoOrigin"), trip.origin_city);
    setCity(el("cargoDestination"), trip.destination_city);

    if (trip.departure_date) {
      const d = new Date(trip.departure_date);
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      el("cargoReadyDate").value = iso;
    }

    el("cargoForm").scrollIntoView({ behavior: "smooth", block: "center" });
  }

  document.addEventListener("DOMContentLoaded", () => {
    ["tripsFilterOrigin", "tripsFilterDestination"].forEach((id) => {
      const select = el(id);
      if (select) select.addEventListener("change", renderClientTrips);
    });
    const reset = el("tripsFilterReset");
    if (reset) {
      reset.addEventListener("click", () => {
        el("tripsFilterOrigin").value = "";
        el("tripsFilterDestination").value = "";
        renderClientTrips();
      });
    }
  });

  // ==================== КЛИЕНТ: отзыв о перевозчике ====================
  // Вызывается из renderCargos для каждого груза.
  window.addReviewControls = function (card, cargo, reload) {
    if (cargo.status !== "completed" || !cargo.carrier_name) return;

    const box = document.createElement("div");
    box.className = "review-box";

    if (cargo.review_rating) {
      box.innerHTML = `Ваша оценка перевозчику ${escapeHtml(cargo.carrier_name)}: <span class="stars">${stars(cargo.review_rating)}</span>`;
      card.appendChild(box);
      return;
    }

    box.appendChild(makeActionButton("Оценить перевозчика", () => {
      form.style.display = form.style.display === "none" ? "flex" : "none";
    }, "action-btn-primary"));

    const form = document.createElement("form");
    form.className = "review-form";
    form.style.display = "none";
    form.innerHTML = `
      <div>Как прошла перевозка с ${escapeHtml(cargo.carrier_name)}?</div>
      <div class="star-picker" role="radiogroup" aria-label="Оценка"></div>
      <input type="text" class="review-comment" maxlength="500" placeholder="Комментарий (необязательно)" />
      <p class="error-message review-error"></p>
      <div><button type="submit" class="action-btn action-btn-primary">Отправить отзыв</button></div>
    `;

    let rating = 0;
    const picker = form.querySelector(".star-picker");
    const buttons = [1, 2, 3, 4, 5].map((n) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "star-btn";
      b.textContent = "★";
      b.setAttribute("aria-label", `Оценка ${n} из 5`);
      b.addEventListener("click", () => {
        rating = n;
        buttons.forEach((x, i) => x.classList.toggle("on", i < n));
      });
      picker.appendChild(b);
      return b;
    });

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const error = form.querySelector(".review-error");
      error.textContent = "";
      if (!rating) {
        error.textContent = "Выберите оценку от 1 до 5";
        return;
      }

      const submit = form.querySelector("button[type=submit]");
      submit.disabled = true;
      const { ok, data } = await apiCall("POST", `${API_URL}/cargos/${cargo.id}/review`, {
        rating,
        comment: form.querySelector(".review-comment").value.trim(),
      });
      submit.disabled = false;

      if (!ok) {
        error.textContent = data.message || "Не удалось отправить отзыв";
        if (data.message && /уже оставили/.test(data.message)) reload();
        return;
      }
      showToast("Спасибо за отзыв");
      reload();
    });

    box.appendChild(form);
    card.appendChild(box);
  };

  // ==================== ПЕРЕВОЗЧИК: мои отзывы ====================
  async function loadMyReviews() {
    const list = el("myReviewsList");
    if (!list) return;

    const { ok, data } = await apiCall("GET", `${API_URL}/reviews/my`);
    if (!ok) return;

    el("myReviewsSummary").innerHTML = data.count
      ? `<span class="stars">★</span> ${Number(data.average).toFixed(1)} из 5 · ${escapeHtml(reviewsWord(data.count))}`
      : "";
    el("myReviewsEmpty").style.display = data.count ? "none" : "block";

    list.innerHTML = "";
    data.reviews.forEach((review) => {
      const item = document.createElement("div");
      item.className = "review-item";
      item.innerHTML = `
        <div><span class="stars">${stars(review.rating)}</span> ${escapeHtml(review.route || "")}</div>
        ${review.comment ? `<div>${escapeHtml(review.comment)}</div>` : ""}
        <div class="entity-card-sub">${escapeHtml(review.client_name || "Клиент")} · ${escapeHtml(formatDate(review.created_at))}</div>
      `;
      list.appendChild(item);
    });
  }
  window.loadMyReviews = loadMyReviews;
})();
