const express = require("express");
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const path = require("path");
const pool = require("./db");
const authMiddleware = require("./authMiddleware");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

// За прокси (nginx, Heroku и т.п.) включите TRUST_PROXY=1, иначе все пользователи будут выглядеть как один IP
if (process.env.TRUST_PROXY) app.set("trust proxy", Number(process.env.TRUST_PROXY) || 1);

app.use(cors());
app.use(express.json());
// Сайт (HTML, CSS, JS) лежит в папке public. Корень проекта отдавать нельзя: оттуда можно было бы скачать server.js и db.js
app.use(express.static(path.join(__dirname, "public")));

// ---------- Проверка роли ----------
// Используется после authMiddleware, чтобы отделить действия
// клиента от действий перевозчика на уровне API.
function requireRole(role) {
  return (req, res, next) => {
    if (req.user.role !== role) {
      return res.status(403).json({ message: "Действие недоступно для вашей роли" });
    }
    next();
  };
}

// Безопасно приводит значение к числу или null (для NUMERIC-полей)
function toNumberOrNull(value) {
  if (value === undefined || value === null || value === "") return null;
  const num = Number(value);
  return Number.isNaN(num) ? null : num;
}

// ---------- Проверка входных данных ----------
class ValidationError extends Error {}
function bad(message) { throw new ValidationError(message); }
function sendValidation(res, err) {
  if (err instanceof ValidationError) return res.status(400).json({ message: err.message });
  console.error("Непредвиденная ошибка проверки данных:", err);
  return res.status(500).json({ message: "Ошибка сервера" });
}

function optText(value, max, label) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  if (!text) return null;
  if (text.length > max) bad(`${label}: не больше ${max} символов`);
  return text;
}
function reqText(value, max, label) {
  const text = optText(value, max, label);
  if (!text) bad(`${label}: обязательное поле`);
  return text;
}
function optNumber(value, max, label) {
  if (value === undefined || value === null || String(value).trim() === "") return null;
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0 || num > max) {
    bad(`${label}: укажите число больше 0 и не более ${max.toLocaleString("ru-RU")}`);
  }
  return num;
}
// Дата в формате ГГГГ-ММ-ДД, не в прошлом и не дальше чем через 2 года
function optDate(value, label) {
  if (value === undefined || value === null || String(value).trim() === "") return null;
  const text = String(value).trim();
  const parsed = new Date(`${text}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== text) {
    bad(`${label}: некорректная дата`);
  }
  const today = new Date();
  const limit = new Date(today);
  limit.setUTCFullYear(limit.getUTCFullYear() + 2);
  if (text < today.toISOString().slice(0, 10)) bad(`${label}: дата не может быть в прошлом`);
  if (text > limit.toISOString().slice(0, 10)) bad(`${label}: слишком далёкая дата`);
  return text;
}
function reqCity(value, label) {
  const text = reqText(value, 100, label);
  if (!/\p{L}/u.test(text)) bad(`${label}: укажите название населённого пункта`);
  return text;
}
function checkName(value) {
  const text = reqText(value, 100, "Имя");
  if (text.length < 2) bad("Имя: не менее 2 символов");
  if (!/\p{L}/u.test(text)) bad("Имя должно содержать буквы");
  if (/[<>]/.test(text)) bad("Имя содержит недопустимые символы");
  return text;
}
function checkEmail(value) {
  const text = String(value || "").trim().toLowerCase();
  if (!text) bad("Укажите email");
  if (text.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(text)) bad("Укажите корректный email");
  return text;
}
function checkPhone(value, required) {
  const text = String(value || "").trim();
  if (!text) {
    if (required) bad("Укажите телефон");
    return null;
  }
  if (!/^\+?[0-9][0-9\s\-()]*$/.test(text)) bad("Телефон: допустимы цифры, пробелы, дефис, скобки и «+» в начале");
  const digits = text.replace(/\D/g, "").length;
  if (digits < 8 || digits > 15) bad("Телефон: должно быть от 8 до 15 цифр");
  return text;
}
// Пароль: 8–72 байта (ограничение bcrypt), минимум одна буква и одна цифра
function checkPassword(value) {
  if (typeof value !== "string" || !value) bad("Укажите пароль");
  if (value.length < 8) bad("Пароль: не менее 8 символов");
  if (Buffer.byteLength(value, "utf8") > 72) bad("Пароль слишком длинный (максимум 72 байта)");
  if (!/\p{L}/u.test(value) || !/\d/.test(value)) bad("Пароль должен содержать буквы и цифры");
  return value;
}

function validateRegister(body) {
  return {
    fullName: checkName(body.fullName),
    email: checkEmail(body.email),
    phone: checkPhone(body.phone, true),
    password: checkPassword(body.password),
    role: body.role,
  };
}
function validateProfile(body) {
  const taxId = optText(body.taxId, 30, "IDNO");
  if (taxId && !/^[0-9A-Za-zА-Яа-яЁё\-\s]+$/.test(taxId)) bad("IDNO: допустимы буквы, цифры и дефис");
  return {
    fullName: checkName(body.fullName),
    phone: checkPhone(body.phone, false),
    companyName: optText(body.companyName, 150, "Название компании"),
    taxId,
    address: optText(body.address, 200, "Адрес"),
    licenseNumber: optText(body.licenseNumber, 50, "Номер лицензии"),
  };
}
function validateVehicle(body) {
  const plateNumber = reqText(body.plateNumber, 30, "Гос. номер");
  if (!/^[\p{L}\p{N}][\p{L}\p{N}\s\-]{1,29}$/u.test(plateNumber)) bad("Гос. номер: допустимы буквы, цифры, пробел и дефис");
  return {
    brand: reqText(body.brand, 100, "Марка"),
    model: optText(body.model, 100, "Модель"),
    plateNumber,
    capacityKg: optNumber(body.capacityKg, 100000, "Грузоподъёмность"),
    bodyType: optText(body.bodyType, 100, "Тип кузова"),
  };
}
function validateTrip(body) {
  const rawVehicle = body.vehicleId;
  const vehicleId = rawVehicle ? Number(rawVehicle) : null;
  if (vehicleId !== null && !Number.isInteger(vehicleId)) bad("Некорректный автомобиль");
  return {
    originCity: reqCity(body.originCity, "Откуда"),
    destinationCity: reqCity(body.destinationCity, "Куда"),
    departureDate: optDate(body.departureDate, "Дата отправления"),
    price: optNumber(body.price, 100000000, "Цена"),
    capacityKg: optNumber(body.capacityKg, 100000, "Свободная загрузка"),
    comment: optText(body.comment, 500, "Комментарий"),
    vehicleId,
  };
}
function validateCargo(body) {
  return {
    originCity: reqCity(body.originCity, "Откуда"),
    destinationCity: reqCity(body.destinationCity, "Куда"),
    cargoType: optText(body.cargoType, 100, "Тип груза"),
    weightKg: optNumber(body.weightKg, 200000, "Вес"),
    price: optNumber(body.price, 100000000, "Бюджет"),
    readyDate: optDate(body.readyDate, "Дата готовности"),
    comment: optText(body.comment, 500, "Комментарий"),
  };
}
function validateReview(body) {
  const rating = Number(body.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) bad("Оценка: выберите от 1 до 5");
  return { rating, comment: optText(body.comment, 500, "Отзыв") };
}
function validateRespond(body) {
  const price = optNumber(body.price, 100000000, "Цена");
  if (price === null) bad("Укажите вашу цену");
  return { price, comment: optText(body.comment, 500, "Комментарий") };
}

// ---------- Ограничение частоты попыток ----------
// Хранится в памяти сервера: после перезапуска счётчики обнуляются.
// Для нескольких серверов понадобится общее хранилище (например, Redis).
function createLimiter({ max, windowMs, lockMs }) {
  const entries = new Map();
  const timer = setInterval(() => {
    const t = Date.now();
    for (const [key, e] of entries) {
      if (e.lockedUntil < t && t - e.first > windowMs) entries.delete(key);
    }
  }, 60 * 1000);
  timer.unref();

  return {
    // Сколько секунд ещё действует блокировка (0 — не заблокирован). Счётчик не меняет.
    check(key) {
      const e = entries.get(key);
      const t = Date.now();
      return e && e.lockedUntil > t ? Math.ceil((e.lockedUntil - t) / 1000) : 0;
    },
    // Засчитывает попытку. Возвращает { blocked, retryAfter, remaining }.
    hit(key) {
      const t = Date.now();
      let e = entries.get(key);
      if (e && e.lockedUntil > t) {
        return { blocked: true, retryAfter: Math.ceil((e.lockedUntil - t) / 1000), remaining: 0 };
      }
      if (!e || t - e.first > windowMs) {
        e = { count: 0, first: t, lockedUntil: 0 };
        entries.set(key, e);
      }
      e.count += 1;
      if (e.count >= max) {
        e.lockedUntil = t + lockMs;
        e.count = 0;
        e.first = t;
        return { blocked: true, retryAfter: Math.ceil(lockMs / 1000), remaining: 0 };
      }
      return { blocked: false, retryAfter: 0, remaining: max - e.count };
    },
    reset(key) { entries.delete(key); },
  };
}

const MINUTE = 60 * 1000;
const loginPairLimiter = createLimiter({ max: 5, windowMs: 15 * MINUTE, lockMs: 15 * MINUTE });   // email + IP
const loginIpLimiter = createLimiter({ max: 50, windowMs: 15 * MINUTE, lockMs: 15 * MINUTE });    // перебор разных email
const passwordLimiter = createLimiter({ max: 5, windowMs: 15 * MINUTE, lockMs: 15 * MINUTE });    // смена пароля
const registerLimiter = createLimiter({ max: 30, windowMs: 60 * MINUTE, lockMs: 60 * MINUTE });   // регистрации с одного IP

function tooMany(res, seconds) {
  res.set("Retry-After", String(seconds));
  const minutes = Math.max(1, Math.ceil(seconds / 60));
  return res.status(429).json({ message: `Слишком много попыток. Повторите через ${minutes} мин.` });
}

// Для неизвестного email сравниваем пароль с фиктивным хешем, чтобы время ответа не выдавало,
// существует ли такой пользователь.
const DUMMY_HASH = bcrypt.hashSync("dummy-password-for-timing", 10);

// ---------- Уведомления ----------
// Ошибка уведомления никогда не должна ломать основное действие, поэтому всё в try/catch.
async function notify(userId, { type, text, target, cargoId = null, refId = null, coalesce = false }) {
  try {
    if (coalesce) {
      const updated = await pool.query(
        `UPDATE notifications
         SET repeat_count = repeat_count + 1, text = $4, created_at = NOW()
         WHERE user_id = $1 AND type = $2 AND ref_id = $3 AND is_read = FALSE
         RETURNING id`,
        [userId, type, refId, text]
      );
      if (updated.rows.length > 0) return;
    }
    await pool.query(
      `INSERT INTO notifications (user_id, type, text, target, cargo_id, ref_id)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, type, text, target, cargoId, refId]
    );
  } catch (err) {
    console.error("Ошибка создания уведомления:", err);
  }
}

const routeOf = (cargo) => `${cargo.origin_city} → ${cargo.destination_city}`;

// ---------- Создание / доращивание таблиц при старте ----------
// vehicles — автомобили перевозчика, trips — рейсы, которые он предлагает,
// cargos — грузы, которые размещает клиент.
//
// Важно: если у вас в БД уже случайно существовала таблица с таким именем
// (например, осталась от более ранних тестов) — CREATE TABLE IF NOT EXISTS
// её не трогает, и в ней может не хватать нужных колонок. Поэтому после
// создания таблицы мы ещё и "дотягиваем" её до нужной структуры через
// ALTER TABLE ... ADD COLUMN IF NOT EXISTS — это безопасно повторять
// при каждом запуске сервера и ничего не удаляет.
async function ensureColumn(table, column, definition) {
  await pool.query(
    `ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${column} ${definition}`
  );
}

// Снимает NOT NULL с любых "чужих" колонок таблицы — то есть с тех, что
// не входят в наш ожидаемый список. Такие колонки могут остаться от более
// ранних версий таблицы (например carrier_id в vehicles) и без значения
// по умолчанию будут ломать INSERT, в который мы их не включаем.
async function relaxUnknownNotNullColumns(table, knownColumns) {
  const result = await pool.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_name = $1 AND is_nullable = 'NO' AND column_default IS NULL`,
    [table]
  );

  for (const row of result.rows) {
    if (!knownColumns.includes(row.column_name)) {
      await pool.query(
        `ALTER TABLE ${table} ALTER COLUMN ${row.column_name} DROP NOT NULL`
      );
      console.log(`Снял NOT NULL со старой колонки ${table}.${row.column_name}`);
    }
  }
}

// Если колонка status осталась в БД от ранней версии как ENUM, значения вроде
// 'completed' / 'in_progress' отклоняются ошибкой 22P02 (invalid input value for enum).
// Переводим такую колонку в VARCHAR(20) — данные сохраняются как есть.
async function ensureStatusIsText(table, defaultValue) {
  const res = await pool.query(
    `SELECT data_type FROM information_schema.columns
     WHERE table_schema = current_schema() AND table_name = $1 AND column_name = 'status'`,
    [table]
  );
  if (res.rows.length === 0 || res.rows[0].data_type !== "USER-DEFINED") return;
  await pool.query(`ALTER TABLE ${table} ALTER COLUMN status DROP DEFAULT`);
  await pool.query(`ALTER TABLE ${table} ALTER COLUMN status TYPE VARCHAR(20) USING status::text`);
  await pool.query(`ALTER TABLE ${table} ALTER COLUMN status SET DEFAULT '${defaultValue}'`);
  await pool.query(`ALTER TABLE ${table} ALTER COLUMN status SET NOT NULL`);
  console.log(`Колонка ${table}.status переведена из ENUM в VARCHAR(20)`);
}

// В старой версии БД внешние ключи могли ссылаться на client_profiles(id) / carrier_profiles(id),
// а код хранит в *_id идентификатор пользователя (users.id). Тогда INSERT падает с ошибкой 23503.
// Пересоздаём такие ключи так, чтобы они ссылались на users(id). NOT VALID — чтобы старые строки
// не мешали миграции (новые записи проверяются как обычно).
async function ensureFkToUsers(table, column) {
  const res = await pool.query(
    `SELECT con.conname, ref.relname AS ref_table
     FROM pg_constraint con
     JOIN pg_class t ON t.oid = con.conrelid
     JOIN pg_class ref ON ref.oid = con.confrelid
     JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = ANY (con.conkey)
     WHERE con.contype = 'f' AND t.relname = $1 AND a.attname = $2
       AND t.relnamespace = current_schema()::regnamespace`,
    [table, column]
  );
  if (res.rows.length === 0 || res.rows.every((r) => r.ref_table === "users")) return;
  for (const row of res.rows) {
    if (row.ref_table === "users") continue;
    await pool.query(`ALTER TABLE ${table} DROP CONSTRAINT "${row.conname}"`);
  }
  const hasUsersFk = res.rows.some((r) => r.ref_table === "users");
  if (!hasUsersFk) {
    const onDelete = table === "reviews" && column === "client_id" ? "SET NULL" : "CASCADE";
    await pool.query(
      `ALTER TABLE ${table} ADD CONSTRAINT ${table}_${column}_users_fkey
       FOREIGN KEY (${column}) REFERENCES users(id) ON DELETE ${onDelete} NOT VALID`
    );
  }
  console.log(`Внешний ключ ${table}.${column} теперь ссылается на users(id)`);
}

async function ensureSchema() {
  // ---------- vehicles ----------
  await pool.query(`CREATE TABLE IF NOT EXISTS vehicles (id SERIAL PRIMARY KEY);`);
  await ensureColumn("vehicles", "user_id", "INTEGER REFERENCES users(id) ON DELETE CASCADE");
  await ensureColumn("vehicles", "brand", "VARCHAR(100)");
  await ensureColumn("vehicles", "model", "VARCHAR(100)");
  await ensureColumn("vehicles", "plate_number", "VARCHAR(30)");
  await ensureColumn("vehicles", "capacity_kg", "NUMERIC");
  await ensureColumn("vehicles", "body_type", "VARCHAR(100)");
  await ensureColumn("vehicles", "created_at", "TIMESTAMP NOT NULL DEFAULT NOW()");
  await relaxUnknownNotNullColumns("vehicles", [
    "id", "user_id", "brand", "model", "plate_number", "capacity_kg", "body_type", "created_at",
  ]);

  // ---------- trips ----------
  await pool.query(`CREATE TABLE IF NOT EXISTS trips (id SERIAL PRIMARY KEY);`);
  await ensureColumn("trips", "carrier_id", "INTEGER REFERENCES users(id) ON DELETE CASCADE");
  await ensureColumn("trips", "vehicle_id", "INTEGER REFERENCES vehicles(id) ON DELETE SET NULL");
  await ensureColumn("trips", "origin_city", "VARCHAR(100)");
  await ensureColumn("trips", "destination_city", "VARCHAR(100)");
  await ensureColumn("trips", "departure_date", "DATE");
  await ensureColumn("trips", "price", "NUMERIC");
  await ensureColumn("trips", "capacity_kg", "NUMERIC");
  await ensureColumn("trips", "comment", "TEXT");
  await ensureColumn("trips", "status", "VARCHAR(20) NOT NULL DEFAULT 'active'");
  await ensureStatusIsText("trips", "active");
  await ensureColumn("trips", "created_at", "TIMESTAMP NOT NULL DEFAULT NOW()");
  await relaxUnknownNotNullColumns("trips", [
    "id", "carrier_id", "vehicle_id", "origin_city", "destination_city", "departure_date",
    "price", "capacity_kg", "comment", "status", "created_at",
  ]);

  // ---------- cargos ----------
  await pool.query(`CREATE TABLE IF NOT EXISTS cargos (id SERIAL PRIMARY KEY);`);
  await ensureColumn("cargos", "client_id", "INTEGER REFERENCES users(id) ON DELETE CASCADE");
  await ensureColumn("cargos", "origin_city", "VARCHAR(100)");
  await ensureColumn("cargos", "destination_city", "VARCHAR(100)");
  await ensureColumn("cargos", "cargo_type", "VARCHAR(100)");
  await ensureColumn("cargos", "weight_kg", "NUMERIC");
  await ensureColumn("cargos", "price", "NUMERIC");
  await ensureColumn("cargos", "ready_date", "DATE");
  await ensureColumn("cargos", "comment", "TEXT");
  await ensureColumn("cargos", "status", "VARCHAR(20) NOT NULL DEFAULT 'active'");
  await ensureStatusIsText("cargos", "active");
  await ensureColumn("cargos", "created_at", "TIMESTAMP NOT NULL DEFAULT NOW()");
  await relaxUnknownNotNullColumns("cargos", [
    "id", "client_id", "origin_city", "destination_city", "cargo_type", "weight_kg",
    "price", "ready_date", "comment", "status", "created_at",
  ]);

  // ---------- responses (отклики перевозчиков на грузы) ----------
  await pool.query(`CREATE TABLE IF NOT EXISTS responses (id SERIAL PRIMARY KEY);`);
  await ensureColumn("responses", "cargo_id", "INTEGER REFERENCES cargos(id) ON DELETE CASCADE");
  await ensureColumn("responses", "carrier_id", "INTEGER REFERENCES users(id) ON DELETE CASCADE");
  await ensureColumn("responses", "price", "NUMERIC");
  await ensureColumn("responses", "comment", "TEXT");
  await ensureColumn("responses", "status", "VARCHAR(20) NOT NULL DEFAULT 'pending'");
  await ensureStatusIsText("responses", "pending");
  await ensureColumn("responses", "created_at", "TIMESTAMP NOT NULL DEFAULT NOW()");
  await relaxUnknownNotNullColumns("responses", [
    "id", "cargo_id", "carrier_id", "price", "comment", "status", "created_at",
  ]);
  // Один перевозчик — один отклик на конкретный груз
  await pool.query(
    `CREATE UNIQUE INDEX IF NOT EXISTS responses_cargo_carrier_uniq ON responses (cargo_id, carrier_id)`
  );

  // ---------- chats (переписка клиент ↔ перевозчик по конкретному грузу) ----------
  await pool.query(`CREATE TABLE IF NOT EXISTS chats (id SERIAL PRIMARY KEY);`);
  await ensureColumn("chats", "cargo_id", "INTEGER REFERENCES cargos(id) ON DELETE CASCADE");
  await ensureColumn("chats", "client_id", "INTEGER REFERENCES users(id) ON DELETE CASCADE");
  await ensureColumn("chats", "carrier_id", "INTEGER REFERENCES users(id) ON DELETE CASCADE");
  await ensureColumn("chats", "created_at", "TIMESTAMP NOT NULL DEFAULT NOW()");
  await relaxUnknownNotNullColumns("chats", [
    "id", "cargo_id", "client_id", "carrier_id", "created_at",
  ]);

  // ---------- messages ----------
  await pool.query(`CREATE TABLE IF NOT EXISTS messages (id SERIAL PRIMARY KEY);`);
  await ensureColumn("messages", "chat_id", "INTEGER REFERENCES chats(id) ON DELETE CASCADE");
  await ensureColumn("messages", "sender_id", "INTEGER REFERENCES users(id) ON DELETE CASCADE");
  await ensureColumn("messages", "message_text", "TEXT");
  await ensureColumn("messages", "created_at", "TIMESTAMP NOT NULL DEFAULT NOW()");
  await relaxUnknownNotNullColumns("messages", [
    "id", "chat_id", "sender_id", "message_text", "created_at",
  ]);
  await pool.query(
    `CREATE INDEX IF NOT EXISTS messages_chat_id_idx ON messages (chat_id, id)`
  );

  // ---------- reviews (отзывы клиентов о перевозчиках) ----------
  // cargo_id при удалении груза обнуляется, а не удаляется: клиент не должен иметь возможность
  // стереть свой отзыв (и тем самым повлиять на рейтинг), удалив груз. Маршрут хранится в самом отзыве.
  await pool.query(`CREATE TABLE IF NOT EXISTS reviews (id SERIAL PRIMARY KEY);`);
  await ensureColumn("reviews", "cargo_id", "INTEGER REFERENCES cargos(id) ON DELETE SET NULL");
  await ensureColumn("reviews", "client_id", "INTEGER REFERENCES users(id) ON DELETE SET NULL");
  await ensureColumn("reviews", "carrier_id", "INTEGER REFERENCES users(id) ON DELETE CASCADE");
  await ensureColumn("reviews", "rating", "INTEGER");
  await ensureColumn("reviews", "comment", "TEXT");
  await ensureColumn("reviews", "route", "TEXT");
  await ensureColumn("reviews", "created_at", "TIMESTAMP NOT NULL DEFAULT NOW()");
  await relaxUnknownNotNullColumns("reviews", [
    "id", "cargo_id", "client_id", "carrier_id", "rating", "comment", "route", "created_at",
  ]);
  // Один отзыв на один груз
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS reviews_cargo_uniq ON reviews (cargo_id)`);

  // ---------- notifications (колокольчик в кабинете) ----------
  await pool.query(`CREATE TABLE IF NOT EXISTS notifications (id SERIAL PRIMARY KEY);`);
  await ensureColumn("notifications", "user_id", "INTEGER REFERENCES users(id) ON DELETE CASCADE");
  await ensureColumn("notifications", "type", "VARCHAR(30)");
  await ensureColumn("notifications", "text", "TEXT");
  await ensureColumn("notifications", "target", "VARCHAR(30)");
  await ensureColumn("notifications", "cargo_id", "INTEGER REFERENCES cargos(id) ON DELETE CASCADE");
  await ensureColumn("notifications", "ref_id", "INTEGER");
  await ensureColumn("notifications", "repeat_count", "INTEGER NOT NULL DEFAULT 1");
  await ensureColumn("notifications", "is_read", "BOOLEAN NOT NULL DEFAULT FALSE");
  await ensureColumn("notifications", "created_at", "TIMESTAMP NOT NULL DEFAULT NOW()");
  await relaxUnknownNotNullColumns("notifications", [
    "id", "user_id", "type", "text", "target", "cargo_id", "ref_id", "repeat_count", "is_read", "created_at",
  ]);
  await pool.query(
    `CREATE INDEX IF NOT EXISTS notifications_user_idx ON notifications (user_id, is_read, created_at DESC)`
  );

  // Выравниваем внешние ключи на users(id) (см. ensureFkToUsers)
  for (const [table, column] of [
    ["vehicles", "user_id"], ["trips", "carrier_id"], ["cargos", "client_id"],
    ["responses", "carrier_id"], ["chats", "client_id"], ["chats", "carrier_id"],
    ["messages", "sender_id"], ["reviews", "client_id"], ["reviews", "carrier_id"],
    ["notifications", "user_id"],
  ]) {
    await ensureFkToUsers(table, column);
  }

  // Для уже принятых ранее откликов создаём чаты задним числом
  // (NOT EXISTS вместо ON CONFLICT — не зависит от наличия уникального индекса)
  await pool.query(`
    INSERT INTO chats (cargo_id, client_id, carrier_id)
    SELECT r.cargo_id, c.client_id, r.carrier_id
    FROM responses r
    JOIN cargos c ON c.id = r.cargo_id
    WHERE r.status = 'accepted'
      AND NOT EXISTS (
        SELECT 1 FROM chats ch WHERE ch.cargo_id = r.cargo_id AND ch.carrier_id = r.carrier_id
      )
  `);
}

// ---------- POST /api/register ----------
// Принимает данные из формы регистрации, создаёт пользователя
// и (в зависимости от роли) соответствующий профиль.
app.post("/api/register", async (req, res) => {
  let valid;
  try {
    valid = validateRegister(req.body);
  } catch (err) {
    return sendValidation(res, err);
  }
  const { fullName, email, phone, password, role } = valid;

  const registerHit = registerLimiter.hit(`reg|${req.ip}`);
  if (registerHit.blocked) return tooMany(res, registerHit.retryAfter);

  // Базовая валидация
  if (!fullName || !email || !phone || !password || !role) {
    return res.status(400).json({ message: "Заполните все поля" });
  }

  if (!["client", "carrier"].includes(role)) {
    return res.status(400).json({ message: "Некорректная роль" });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Проверяем, что email ещё не занят
    const existing = await client.query("SELECT id FROM users WHERE LOWER(email) = $1", [email]);
    if (existing.rows.length > 0) {
      await client.query("ROLLBACK");
      return res.status(409).json({ message: "Пользователь с таким email уже существует" });
    }

    // Хэшируем пароль — никогда не храним пароли в открытом виде
    const passwordHash = await bcrypt.hash(password, 10);

    // Создаём запись в users
    const userResult = await client.query(
      `INSERT INTO users (email, password_hash, phone, full_name, role)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [email, passwordHash, phone, fullName, role]
    );

    const userId = userResult.rows[0].id;

    // Создаём профиль в зависимости от роли
    if (role === "client") {
      await client.query(
        `INSERT INTO client_profiles (user_id) VALUES ($1)`,
        [userId]
      );
    } else {
      await client.query(
        `INSERT INTO carrier_profiles (user_id) VALUES ($1)`,
        [userId]
      );
    }

    await client.query("COMMIT");

    return res.status(201).json({ message: "Регистрация успешна", userId });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Ошибка регистрации:", err);
    return res.status(500).json({ message: "Ошибка сервера" });
  } finally {
    client.release();
  }
});

// ---------- POST /api/login ----------
// Проверяет email + пароль, выдаёт JWT-токен на 7 дней.
app.post("/api/login", async (req, res) => {
  const email = typeof req.body.email === "string" ? req.body.email.trim() : "";
  const password = typeof req.body.password === "string" ? req.body.password : "";

  if (!email || !password) {
    return res.status(400).json({ message: "Заполните email и пароль" });
  }

  const ip = req.ip || "unknown";
  const pairKey = `${ip}|${email.toLowerCase()}`;

  const wait = loginPairLimiter.check(pairKey) || loginIpLimiter.check(ip);
  if (wait) return tooMany(res, wait);

  try {
    const result = await pool.query(
      "SELECT id, email, password_hash, role, full_name FROM users WHERE LOWER(email) = LOWER($1) ORDER BY id LIMIT 1",
      [email]
    );

    const user = result.rows[0];
    const passwordMatches = await bcrypt.compare(password, user ? user.password_hash : DUMMY_HASH);

    if (!user || !passwordMatches) {
      const pairHit = loginPairLimiter.hit(pairKey);
      const ipHit = loginIpLimiter.hit(ip);
      if (pairHit.blocked || ipHit.blocked) return tooMany(res, pairHit.retryAfter || ipHit.retryAfter);
      return res.status(401).json({
        message: `Неверный email или пароль. Осталось попыток: ${pairHit.remaining}`,
      });
    }

    loginPairLimiter.reset(pairKey);

    // Формируем токен. В payload кладём только то, что не секретно.
    const token = jwt.sign(
      { userId: user.id, role: user.role, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        role: user.role,
      },
    });
  } catch (err) {
    console.error("Ошибка входа:", err);
    return res.status(500).json({ message: "Ошибка сервера" });
  }
});

// ---------- PUT /api/password ----------
// Смена пароля: нужен текущий пароль. Неверные попытки ограничены.
app.put("/api/password", authMiddleware, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const key = `pw|${req.user.userId}`;

  const wait = passwordLimiter.check(key);
  if (wait) return tooMany(res, wait);

  if (typeof currentPassword !== "string" || !currentPassword) {
    return res.status(400).json({ message: "Введите текущий пароль" });
  }
  try {
    checkPassword(newPassword);
  } catch (err) {
    return sendValidation(res, err);
  }
  if (newPassword === currentPassword) {
    return res.status(400).json({ message: "Новый пароль должен отличаться от текущего" });
  }

  try {
    const found = await pool.query("SELECT password_hash FROM users WHERE id = $1", [req.user.userId]);
    if (found.rows.length === 0) return res.status(404).json({ message: "Пользователь не найден" });

    const matches = await bcrypt.compare(currentPassword, found.rows[0].password_hash);
    if (!matches) {
      const hit = passwordLimiter.hit(key);
      if (hit.blocked) return tooMany(res, hit.retryAfter);
      return res.status(400).json({ message: `Текущий пароль указан неверно. Осталось попыток: ${hit.remaining}` });
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    await pool.query("UPDATE users SET password_hash = $1 WHERE id = $2", [newHash, req.user.userId]);
    passwordLimiter.reset(key);
    return res.json({ message: "Пароль изменён" });
  } catch (err) {
    console.error("Ошибка смены пароля:", err);
    return res.status(500).json({ message: "Ошибка сервера" });
  }
});

// ---------- GET /api/me ----------
// Защищённый эндпоинт: возвращает данные текущего пользователя + его профиль.
// Требует заголовок Authorization: Bearer <token>
app.get("/api/me", authMiddleware, async (req, res) => {
  try {
    const userResult = await pool.query(
      "SELECT id, email, phone, full_name, role, created_at FROM users WHERE id = $1",
      [req.user.userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: "Пользователь не найден" });
    }

    const user = userResult.rows[0];
    let profile = null;

    if (user.role === "client") {
      const profileResult = await pool.query(
        "SELECT company_name, tax_id, address FROM client_profiles WHERE user_id = $1",
        [user.id]
      );
      profile = profileResult.rows[0] || null;
    } else if (user.role === "carrier") {
      const profileResult = await pool.query(
        "SELECT company_name, tax_id, license_number, is_verified FROM carrier_profiles WHERE user_id = $1",
        [user.id]
      );
      profile = profileResult.rows[0] || null;
    }

    return res.json({ user, profile });
  } catch (err) {
    console.error("Ошибка получения профиля:", err);
    return res.status(500).json({ message: "Ошибка сервера" });
  }
});

// ---------- PUT /api/profile ----------
// Защищённый эндпоинт: обновляет данные текущего пользователя
// и его профиль (клиента или перевозчика — в зависимости от роли).
app.put("/api/profile", authMiddleware, async (req, res) => {
  let valid;
  try {
    valid = validateProfile(req.body);
  } catch (err) {
    return sendValidation(res, err);
  }
  const { fullName, phone, companyName, taxId, address, licenseNumber } = valid;

  if (!fullName || !fullName.trim()) {
    return res.status(400).json({ message: "Имя не может быть пустым" });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Обновляем общие поля пользователя
    await client.query(
      `UPDATE users SET full_name = $1, phone = $2 WHERE id = $3`,
      [fullName.trim(), phone ? phone.trim() : null, req.user.userId]
    );

    // Обновляем профиль в зависимости от роли.
    // Каждая роль хранит и редактирует только свои поля —
    // это и есть разделение профиля клиента и перевозчика.
    if (req.user.role === "client") {
      await client.query(
        `UPDATE client_profiles
         SET company_name = $1, tax_id = $2, address = $3
         WHERE user_id = $4`,
        [companyName || null, taxId || null, address || null, req.user.userId]
      );
    } else if (req.user.role === "carrier") {
      await client.query(
        `UPDATE carrier_profiles
         SET company_name = $1, tax_id = $2, license_number = $3
         WHERE user_id = $4`,
        [companyName || null, taxId || null, licenseNumber || null, req.user.userId]
      );
    }

    await client.query("COMMIT");

    // Возвращаем свежие данные, как их отдаёт /api/me
    const userResult = await pool.query(
      "SELECT id, email, phone, full_name, role, created_at FROM users WHERE id = $1",
      [req.user.userId]
    );
    const user = userResult.rows[0];
    let profile = null;

    if (user.role === "client") {
      const profileResult = await pool.query(
        "SELECT company_name, tax_id, address FROM client_profiles WHERE user_id = $1",
        [user.id]
      );
      profile = profileResult.rows[0] || null;
    } else if (user.role === "carrier") {
      const profileResult = await pool.query(
        "SELECT company_name, tax_id, license_number, is_verified FROM carrier_profiles WHERE user_id = $1",
        [user.id]
      );
      profile = profileResult.rows[0] || null;
    }

    return res.json({ message: "Профиль обновлён", user, profile });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Ошибка обновления профиля:", err);
    return res.status(500).json({ message: "Ошибка сервера" });
  } finally {
    client.release();
  }
});

// ==================== ПУБЛИЧНАЯ ВИТРИНА (главная страница) ====================
// Без авторизации: показываем общий список актуальных грузов и рейсов
// на главной странице, но БЕЗ контактов — чтобы не светить телефоны
// клиентов и перевозчиков всем подряд. Полные контакты доступны только
// авторизованным пользователям в личном кабинете.

// ---------- GET /api/public/cargos ----------
app.get("/api/public/cargos", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, origin_city, destination_city, cargo_type, weight_kg, price, ready_date, created_at
       FROM cargos
       WHERE status = 'active'
       ORDER BY created_at DESC
       LIMIT 24`
    );
    return res.json({ cargos: result.rows });
  } catch (err) {
    console.error("Ошибка получения публичных грузов:", err);
    return res.status(500).json({ message: "Ошибка сервера" });
  }
});

// ---------- GET /api/public/trips ----------
app.get("/api/public/trips", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, origin_city, destination_city, departure_date, price, capacity_kg, created_at
       FROM trips
       WHERE status = 'active' AND (departure_date IS NULL OR departure_date >= CURRENT_DATE)
       ORDER BY created_at DESC
       LIMIT 24`
    );
    return res.json({ trips: result.rows });
  } catch (err) {
    console.error("Ошибка получения публичных рейсов:", err);
    return res.status(500).json({ message: "Ошибка сервера" });
  }
});


// ==================== ПЕРЕВОЗЧИК: автомобили ====================

// ---------- GET /api/vehicles ----------
app.get("/api/vehicles", authMiddleware, requireRole("carrier"), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, brand, model, plate_number, capacity_kg, body_type, created_at
       FROM vehicles WHERE user_id = $1 ORDER BY created_at DESC`,
      [req.user.userId]
    );
    return res.json({ vehicles: result.rows });
  } catch (err) {
    console.error("Ошибка получения автомобилей:", err);
    return res.status(500).json({ message: "Ошибка сервера" });
  }
});

// ---------- POST /api/vehicles ----------
app.post("/api/vehicles", authMiddleware, requireRole("carrier"), async (req, res) => {
  let valid;
  try {
    valid = validateVehicle(req.body);
  } catch (err) {
    return sendValidation(res, err);
  }
  const { brand, model, plateNumber, capacityKg, bodyType } = valid;

  if (!brand || !brand.trim() || !plateNumber || !plateNumber.trim()) {
    return res.status(400).json({ message: "Укажите марку и гос. номер" });
  }

  try {
    const result = await pool.query(
      `INSERT INTO vehicles (user_id, brand, model, plate_number, capacity_kg, body_type)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, brand, model, plate_number, capacity_kg, body_type, created_at`,
      [
        req.user.userId,
        brand.trim(),
        model ? model.trim() : null,
        plateNumber.trim(),
        toNumberOrNull(capacityKg),
        bodyType ? bodyType.trim() : null,
      ]
    );
    return res.status(201).json({ vehicle: result.rows[0] });
  } catch (err) {
    console.error("Ошибка добавления автомобиля:", err);
    return res.status(500).json({ message: "Ошибка сервера" });
  }
});

// ---------- DELETE /api/vehicles/:id ----------
app.delete("/api/vehicles/:id", authMiddleware, requireRole("carrier"), async (req, res) => {
  try {
    const result = await pool.query(
      "DELETE FROM vehicles WHERE id = $1 AND user_id = $2 RETURNING id",
      [req.params.id, req.user.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Автомобиль не найден" });
    }
    return res.json({ message: "Автомобиль удалён" });
  } catch (err) {
    console.error("Ошибка удаления автомобиля:", err);
    return res.status(500).json({ message: "Ошибка сервера" });
  }
});


// ==================== ПЕРЕВОЗЧИК: рейсы ====================

// ---------- GET /api/trips ----------
app.get("/api/trips", authMiddleware, requireRole("carrier"), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT t.id, t.origin_city, t.destination_city, t.departure_date, t.price,
              t.capacity_kg, t.comment, t.status, t.created_at,
              t.vehicle_id, v.brand AS vehicle_brand, v.plate_number AS vehicle_plate
       FROM trips t
       LEFT JOIN vehicles v ON v.id = t.vehicle_id
       WHERE t.carrier_id = $1
       ORDER BY t.created_at DESC`,
      [req.user.userId]
    );
    return res.json({ trips: result.rows });
  } catch (err) {
    console.error("Ошибка получения рейсов:", err);
    return res.status(500).json({ message: "Ошибка сервера" });
  }
});

// ---------- POST /api/trips ----------
app.post("/api/trips", authMiddleware, requireRole("carrier"), async (req, res) => {
  let valid;
  try {
    valid = validateTrip(req.body);
  } catch (err) {
    return sendValidation(res, err);
  }
  const { originCity, destinationCity, departureDate, price, capacityKg, comment, vehicleId } = valid;

  if (!originCity || !originCity.trim() || !destinationCity || !destinationCity.trim()) {
    return res.status(400).json({ message: "Укажите города отправления и назначения" });
  }

  try {
    // Если указан автомобиль — убеждаемся, что он принадлежит этому перевозчику
    let safeVehicleId = null;
    if (vehicleId) {
      const vehicleCheck = await pool.query(
        "SELECT id FROM vehicles WHERE id = $1 AND user_id = $2",
        [vehicleId, req.user.userId]
      );
      if (vehicleCheck.rows.length > 0) {
        safeVehicleId = vehicleCheck.rows[0].id;
      }
    }

    const result = await pool.query(
      `INSERT INTO trips (carrier_id, vehicle_id, origin_city, destination_city, departure_date, price, capacity_kg, comment)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, origin_city, destination_city, departure_date, price, capacity_kg, comment, status, created_at, vehicle_id`,
      [
        req.user.userId,
        safeVehicleId,
        originCity.trim(),
        destinationCity.trim(),
        departureDate || null,
        toNumberOrNull(price),
        toNumberOrNull(capacityKg),
        comment ? comment.trim() : null,
      ]
    );
    return res.status(201).json({ trip: result.rows[0] });
  } catch (err) {
    console.error("Ошибка добавления рейса:", err);
    return res.status(500).json({ message: "Ошибка сервера" });
  }
});

// ---------- DELETE /api/trips/:id ----------
app.delete("/api/trips/:id", authMiddleware, requireRole("carrier"), async (req, res) => {
  try {
    const result = await pool.query(
      "DELETE FROM trips WHERE id = $1 AND carrier_id = $2 RETURNING id",
      [req.params.id, req.user.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Рейс не найден" });
    }
    return res.json({ message: "Рейс удалён" });
  } catch (err) {
    console.error("Ошибка удаления рейса:", err);
    return res.status(500).json({ message: "Ошибка сервера" });
  }
});


// ==================== КЛИЕНТ: грузы ====================

// ---------- GET /api/cargos ----------
app.get("/api/cargos", authMiddleware, requireRole("client"), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT c.id, c.origin_city, c.destination_city, c.cargo_type, c.weight_kg, c.price,
              c.ready_date, c.comment, c.status, c.created_at,
              (SELECT COUNT(*)::int FROM responses r WHERE r.cargo_id = c.id) AS responses_count,
              (SELECT rv.rating FROM reviews rv WHERE rv.cargo_id = c.id) AS review_rating,
              (SELECT u.full_name FROM responses r JOIN users u ON u.id = r.carrier_id
               WHERE r.cargo_id = c.id AND r.status = 'accepted' LIMIT 1) AS carrier_name
       FROM cargos c WHERE c.client_id = $1 ORDER BY c.created_at DESC`,
      [req.user.userId]
    );
    return res.json({ cargos: result.rows });
  } catch (err) {
    console.error("Ошибка получения грузов:", err);
    return res.status(500).json({ message: "Ошибка сервера" });
  }
});

// ---------- GET /api/cargos/public ----------
// Витрина активных грузов для перевозчиков. Телефон клиента здесь НЕ отдаётся —
// он открывается только после того, как клиент выберет отклик этого перевозчика.
app.get("/api/cargos/public", authMiddleware, requireRole("carrier"), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT c.id, c.origin_city, c.destination_city, c.cargo_type, c.weight_kg,
              c.price, c.ready_date, c.comment, c.created_at,
              u.full_name AS client_name,
              r.status AS my_response_status, r.price AS my_response_price
       FROM cargos c
       JOIN users u ON u.id = c.client_id
       LEFT JOIN responses r ON r.cargo_id = c.id AND r.carrier_id = $1
       WHERE c.status = 'active'
       ORDER BY c.created_at DESC`,
      [req.user.userId]
    );
    return res.json({ cargos: result.rows });
  } catch (err) {
    console.error("Ошибка получения витрины грузов:", err);
    return res.status(500).json({ message: "Ошибка сервера" });
  }
});

// ---------- POST /api/cargos ----------
app.post("/api/cargos", authMiddleware, requireRole("client"), async (req, res) => {
  let valid;
  try {
    valid = validateCargo(req.body);
  } catch (err) {
    return sendValidation(res, err);
  }
  const { originCity, destinationCity, cargoType, weightKg, price, readyDate, comment } = valid;

  if (!originCity || !originCity.trim() || !destinationCity || !destinationCity.trim()) {
    return res.status(400).json({ message: "Укажите города отправления и назначения" });
  }

  try {
    const result = await pool.query(
      `INSERT INTO cargos (client_id, origin_city, destination_city, cargo_type, weight_kg, price, ready_date, comment)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, origin_city, destination_city, cargo_type, weight_kg, price, ready_date, comment, status, created_at`,
      [
        req.user.userId,
        originCity.trim(),
        destinationCity.trim(),
        cargoType ? cargoType.trim() : null,
        toNumberOrNull(weightKg),
        toNumberOrNull(price),
        readyDate || null,
        comment ? comment.trim() : null,
      ]
    );
    return res.status(201).json({ cargo: result.rows[0] });
  } catch (err) {
    console.error("Ошибка размещения груза:", err);
    return res.status(500).json({ message: "Ошибка сервера" });
  }
});

// ---------- DELETE /api/cargos/:id ----------
app.delete("/api/cargos/:id", authMiddleware, requireRole("client"), async (req, res) => {
  try {
    const result = await pool.query(
      "DELETE FROM cargos WHERE id = $1 AND client_id = $2 RETURNING id",
      [req.params.id, req.user.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Груз не найден" });
    }
    return res.json({ message: "Груз удалён" });
  } catch (err) {
    console.error("Ошибка удаления груза:", err);
    return res.status(500).json({ message: "Ошибка сервера" });
  }
});

// ==================== ОТКЛИКИ И СТАТУСЫ ====================

// ---------- POST /api/cargos/:id/respond (перевозчик) ----------
app.post("/api/cargos/:id/respond", authMiddleware, requireRole("carrier"), async (req, res) => {
  let valid;
  try {
    valid = validateRespond(req.body);
  } catch (err) {
    return sendValidation(res, err);
  }
  const { price, comment } = valid;

  if (price === null || price <= 0) {
    return res.status(400).json({ message: "Укажите вашу цену" });
  }

  try {
    const cargo = await pool.query("SELECT id, status FROM cargos WHERE id = $1", [req.params.id]);
    if (cargo.rows.length === 0) {
      return res.status(404).json({ message: "Груз не найден" });
    }
    if (cargo.rows[0].status !== "active") {
      return res.status(409).json({ message: "Этот груз уже недоступен для откликов" });
    }

    const existing = await pool.query(
      "SELECT id FROM responses WHERE cargo_id = $1 AND carrier_id = $2",
      [req.params.id, req.user.userId]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ message: "Вы уже откликнулись на этот груз" });
    }

    const result = await pool.query(
      `INSERT INTO responses (cargo_id, carrier_id, price, comment)
       VALUES ($1, $2, $3, $4)
       RETURNING id, cargo_id, price, comment, status, created_at`,
      [req.params.id, req.user.userId, price, comment]
    );
    const info = await pool.query(
      `SELECT c.client_id, c.origin_city, c.destination_city, u.full_name
       FROM cargos c JOIN users u ON u.id = $2 WHERE c.id = $1`,
      [req.params.id, req.user.userId]
    );
    if (info.rows[0]) {
      await notify(info.rows[0].client_id, {
        type: "response_new",
        text: `Новый отклик на груз ${routeOf(info.rows[0])}: ${price.toLocaleString("ru-RU")} MDL от ${info.rows[0].full_name}`,
        target: "cargo",
        cargoId: Number(req.params.id),
        refId: result.rows[0].id,
      });
    }
    return res.status(201).json({ response: result.rows[0] });
  } catch (err) {
    console.error("Ошибка отклика:", err);
    return res.status(500).json({ message: "Ошибка сервера" });
  }
});

// ---------- GET /api/responses/my (перевозчик) ----------
// Свои отклики. Контакты клиента видны только у принятых.
app.get("/api/responses/my", authMiddleware, requireRole("carrier"), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT r.id, r.price, r.comment, r.status, r.created_at,
              c.id AS cargo_id, c.origin_city, c.destination_city, c.cargo_type,
              c.weight_kg, c.ready_date, c.status AS cargo_status,
              u.full_name AS client_name,
              CASE WHEN r.status = 'accepted' THEN u.phone END AS client_phone
       FROM responses r
       JOIN cargos c ON c.id = r.cargo_id
       JOIN users u ON u.id = c.client_id
       WHERE r.carrier_id = $1
       ORDER BY r.created_at DESC`,
      [req.user.userId]
    );
    return res.json({ responses: result.rows });
  } catch (err) {
    console.error("Ошибка получения откликов:", err);
    return res.status(500).json({ message: "Ошибка сервера" });
  }
});

// ---------- DELETE /api/responses/:id (перевозчик отзывает отклик) ----------
app.delete("/api/responses/:id", authMiddleware, requireRole("carrier"), async (req, res) => {
  try {
    const result = await pool.query(
      "DELETE FROM responses WHERE id = $1 AND carrier_id = $2 AND status = 'pending' RETURNING id",
      [req.params.id, req.user.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Отклик не найден или уже обработан" });
    }
    return res.json({ message: "Отклик отозван" });
  } catch (err) {
    console.error("Ошибка отзыва отклика:", err);
    return res.status(500).json({ message: "Ошибка сервера" });
  }
});

// ---------- GET /api/cargos/:id/responses (клиент) ----------
// Отклики на свой груз. Телефон перевозчика — только у выбранного.
app.get("/api/cargos/:id/responses", authMiddleware, requireRole("client"), async (req, res) => {
  try {
    const own = await pool.query(
      "SELECT id FROM cargos WHERE id = $1 AND client_id = $2",
      [req.params.id, req.user.userId]
    );
    if (own.rows.length === 0) {
      return res.status(404).json({ message: "Груз не найден" });
    }

    const result = await pool.query(
      `SELECT r.id, r.price, r.comment, r.status, r.created_at,
              u.full_name AS carrier_name,
              cp.company_name AS carrier_company,
              cp.is_verified AS carrier_verified,
              (SELECT ROUND(AVG(rv.rating), 1)::float8 FROM reviews rv WHERE rv.carrier_id = r.carrier_id) AS carrier_rating,
              (SELECT COUNT(*)::int FROM reviews rv WHERE rv.carrier_id = r.carrier_id) AS carrier_reviews,
              CASE WHEN r.status = 'accepted' THEN u.phone END AS carrier_phone
       FROM responses r
       JOIN users u ON u.id = r.carrier_id
       LEFT JOIN carrier_profiles cp ON cp.user_id = r.carrier_id
       WHERE r.cargo_id = $1
       ORDER BY (r.status = 'accepted') DESC, r.price ASC NULLS LAST, r.created_at ASC`,
      [req.params.id]
    );
    await pool.query(
      "UPDATE notifications SET is_read = TRUE WHERE user_id = $1 AND type = 'response_new' AND cargo_id = $2 AND is_read = FALSE",
      [req.user.userId, req.params.id]
    );
    return res.json({ responses: result.rows });
  } catch (err) {
    console.error("Ошибка получения откликов на груз:", err);
    return res.status(500).json({ message: "Ошибка сервера" });
  }
});

// ---------- POST /api/responses/:id/accept (клиент выбирает перевозчика) ----------
app.post("/api/responses/:id/accept", authMiddleware, requireRole("client"), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Блокируем строки отклика и груза, чтобы два параллельных клика не выбрали двоих
    const found = await client.query(
      `SELECT r.id, r.cargo_id, r.carrier_id, r.status AS response_status, c.status AS cargo_status
       FROM responses r
       JOIN cargos c ON c.id = r.cargo_id
       WHERE r.id = $1 AND c.client_id = $2
       FOR UPDATE OF r, c`,
      [req.params.id, req.user.userId]
    );

    if (found.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Отклик не найден" });
    }

    const row = found.rows[0];
    if (row.cargo_status !== "active" || row.response_status !== "pending") {
      await client.query("ROLLBACK");
      return res.status(409).json({ message: "Выбор уже сделан или груз недоступен" });
    }

    await client.query("UPDATE responses SET status = 'accepted' WHERE id = $1", [row.id]);
    await client.query(
      "UPDATE responses SET status = 'rejected' WHERE cargo_id = $1 AND id <> $2 AND status = 'pending'",
      [row.cargo_id, row.id]
    );
    await client.query("UPDATE cargos SET status = 'in_progress' WHERE id = $1", [row.cargo_id]);

    // Открываем чат между клиентом и выбранным перевозчиком
    await client.query(
      `INSERT INTO chats (cargo_id, client_id, carrier_id)
       SELECT $1::int, $2::int, $3::int
       WHERE NOT EXISTS (SELECT 1 FROM chats WHERE cargo_id = $1::int AND carrier_id = $3::int)`,
      [row.cargo_id, req.user.userId, row.carrier_id]
    );

    await client.query("COMMIT");

    // Уведомления: выбранному перевозчику и тем, кого не выбрали
    const cargoInfo = await pool.query("SELECT origin_city, destination_city FROM cargos WHERE id = $1", [row.cargo_id]);
    const route = routeOf(cargoInfo.rows[0]);
    const chatInfo = await pool.query(
      "SELECT id FROM chats WHERE cargo_id = $1 AND carrier_id = $2 ORDER BY id LIMIT 1",
      [row.cargo_id, row.carrier_id]
    );
    await notify(row.carrier_id, {
      type: "response_accepted",
      text: `Вас выбрали по грузу ${route}. Откройте чат с клиентом.`,
      target: chatInfo.rows[0] ? "chat" : "my-responses",
      cargoId: row.cargo_id,
      refId: chatInfo.rows[0] ? chatInfo.rows[0].id : null,
    });
    const rejected = await pool.query(
      "SELECT carrier_id FROM responses WHERE cargo_id = $1 AND status = 'rejected'",
      [row.cargo_id]
    );
    for (const other of rejected.rows) {
      await notify(other.carrier_id, {
        type: "response_rejected",
        text: `По грузу ${route} выбран другой перевозчик`,
        target: "my-responses",
        cargoId: row.cargo_id,
      });
    }

    return res.json({ message: "Перевозчик выбран" });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Ошибка выбора отклика:", err);
    return res.status(500).json({ message: "Ошибка сервера" });
  } finally {
    client.release();
  }
});

// ---------- PUT /api/cargos/:id/status (клиент) ----------
// Допустимые переходы: active → cancelled, in_progress → completed / cancelled
const CARGO_TRANSITIONS = {
  active: ["cancelled"],
  in_progress: ["completed", "cancelled"],
};

app.put("/api/cargos/:id/status", authMiddleware, requireRole("client"), async (req, res) => {
  const { status } = req.body;

  try {
    const cargo = await pool.query(
      "SELECT id, status FROM cargos WHERE id = $1 AND client_id = $2",
      [req.params.id, req.user.userId]
    );
    if (cargo.rows.length === 0) {
      return res.status(404).json({ message: "Груз не найден" });
    }

    const allowed = CARGO_TRANSITIONS[cargo.rows[0].status] || [];
    if (!allowed.includes(status)) {
      return res.status(409).json({ message: "Недопустимое изменение статуса" });
    }

    await pool.query("UPDATE cargos SET status = $1 WHERE id = $2", [status, req.params.id]);

    // Если груз был в работе — сообщаем выбранному перевозчику
    if (cargo.rows[0].status === "in_progress") {
      const accepted = await pool.query(
        `SELECT r.carrier_id, c.origin_city, c.destination_city
         FROM responses r JOIN cargos c ON c.id = r.cargo_id
         WHERE r.cargo_id = $1 AND r.status = 'accepted' LIMIT 1`,
        [req.params.id]
      );
      if (accepted.rows[0]) {
        await notify(accepted.rows[0].carrier_id, {
          type: "cargo_status",
          text: status === "completed"
            ? `Груз ${routeOf(accepted.rows[0])} отмечен доставленным`
            : `Клиент отменил заказ по грузу ${routeOf(accepted.rows[0])}`,
          target: "my-responses",
          cargoId: Number(req.params.id),
        });
      }
    }

    return res.json({ message: "Статус обновлён", status });
  } catch (err) {
    console.error("Ошибка смены статуса груза:", err);
    return res.status(500).json({ message: "Ошибка сервера" });
  }
});

// ---------- PUT /api/trips/:id/status (перевозчик) ----------
// active → completed / cancelled, cancelled → active (опубликовать снова)
const TRIP_TRANSITIONS = {
  active: ["completed", "cancelled"],
  cancelled: ["active"],
};

app.put("/api/trips/:id/status", authMiddleware, requireRole("carrier"), async (req, res) => {
  const { status } = req.body;

  try {
    const trip = await pool.query(
      "SELECT id, status FROM trips WHERE id = $1 AND carrier_id = $2",
      [req.params.id, req.user.userId]
    );
    if (trip.rows.length === 0) {
      return res.status(404).json({ message: "Рейс не найден" });
    }

    const allowed = TRIP_TRANSITIONS[trip.rows[0].status] || [];
    if (!allowed.includes(status)) {
      return res.status(409).json({ message: "Недопустимое изменение статуса" });
    }

    await pool.query("UPDATE trips SET status = $1 WHERE id = $2", [status, req.params.id]);
    return res.json({ message: "Статус обновлён", status });
  } catch (err) {
    console.error("Ошибка смены статуса рейса:", err);
    return res.status(500).json({ message: "Ошибка сервера" });
  }
});

// ---------- Чаты ----------
// Возвращает чат, только если текущий пользователь — его участник.
// Для чужих и несуществующих чатов результат одинаковый (null) — не раскрываем наличие чата.
async function getChatForUser(chatId, userId) {
  const result = await pool.query(
    `SELECT ch.id, ch.cargo_id, ch.client_id, ch.carrier_id, c.status AS cargo_status
     FROM chats ch
     JOIN cargos c ON c.id = ch.cargo_id
     WHERE ch.id = $1 AND (ch.client_id = $2 OR ch.carrier_id = $2)`,
    [chatId, userId]
  );
  return result.rows[0] || null;
}

const MAX_MESSAGE_LENGTH = 2000;

// ---------- GET /api/chats ----------
app.get("/api/chats", authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT ch.id, ch.cargo_id, c.origin_city, c.destination_city, c.cargo_type,
              c.status AS cargo_status,
              u.full_name AS partner_name,
              lm.message_text AS last_message, lm.created_at AS last_message_at,
              lm.sender_id AS last_sender_id, ch.created_at,
              (SELECT COALESCE(SUM(n.repeat_count), 0)::int FROM notifications n
               WHERE n.user_id = $1 AND n.type = 'message' AND n.ref_id = ch.id AND n.is_read = FALSE) AS unread_count
       FROM chats ch
       JOIN cargos c ON c.id = ch.cargo_id
       JOIN users u ON u.id = CASE WHEN ch.client_id = $1 THEN ch.carrier_id ELSE ch.client_id END
       LEFT JOIN LATERAL (
         SELECT message_text, created_at, sender_id FROM messages
         WHERE chat_id = ch.id ORDER BY id DESC LIMIT 1
       ) lm ON TRUE
       WHERE ch.client_id = $1 OR ch.carrier_id = $1
       ORDER BY COALESCE(lm.created_at, ch.created_at) DESC`,
      [req.user.userId]
    );
    return res.json({ chats: result.rows });
  } catch (err) {
    console.error("Ошибка загрузки чатов:", err);
    return res.status(500).json({ message: "Ошибка сервера" });
  }
});

// ---------- GET /api/chats/:id/messages?after=<id сообщения> ----------
// Без after — вся история; с after — только новые сообщения (для опроса раз в пару секунд).
app.get("/api/chats/:id/messages", authMiddleware, async (req, res) => {
  const chatId = Number(req.params.id);
  const after = Number(req.query.after) || 0;
  if (!Number.isInteger(chatId)) return res.status(404).json({ message: "Чат не найден" });

  try {
    const chat = await getChatForUser(chatId, req.user.userId);
    if (!chat) return res.status(404).json({ message: "Чат не найден" });

    // Открыл переписку — уведомления о сообщениях в ней прочитаны
    await pool.query(
      "UPDATE notifications SET is_read = TRUE WHERE user_id = $1 AND type = 'message' AND ref_id = $2 AND is_read = FALSE",
      [req.user.userId, chatId]
    );

    const result = await pool.query(
      `SELECT id, sender_id, message_text, created_at
       FROM messages WHERE chat_id = $1 AND id > $2 ORDER BY id ASC`,
      [chatId, after]
    );
    return res.json({
      messages: result.rows,
      canSend: chat.cargo_status === "in_progress",
    });
  } catch (err) {
    console.error("Ошибка загрузки сообщений:", err);
    return res.status(500).json({ message: "Ошибка сервера" });
  }
});

// ---------- POST /api/chats/:id/messages ----------
app.post("/api/chats/:id/messages", authMiddleware, async (req, res) => {
  const chatId = Number(req.params.id);
  if (!Number.isInteger(chatId)) return res.status(404).json({ message: "Чат не найден" });

  const text = typeof req.body.text === "string" ? req.body.text.trim() : "";
  if (!text) return res.status(400).json({ message: "Введите сообщение" });
  if (text.length > MAX_MESSAGE_LENGTH) {
    return res.status(400).json({ message: `Сообщение слишком длинное (максимум ${MAX_MESSAGE_LENGTH} символов)` });
  }

  try {
    const chat = await getChatForUser(chatId, req.user.userId);
    if (!chat) return res.status(404).json({ message: "Чат не найден" });

    if (chat.cargo_status !== "in_progress") {
      return res.status(409).json({ message: "Груз уже не в работе — переписка доступна только для чтения" });
    }

    const result = await pool.query(
      `INSERT INTO messages (chat_id, sender_id, message_text)
       VALUES ($1, $2, $3)
       RETURNING id, sender_id, message_text, created_at`,
      [chatId, req.user.userId, text]
    );
    const recipientId = chat.client_id === req.user.userId ? chat.carrier_id : chat.client_id;
    const info = await pool.query(
      `SELECT c.origin_city, c.destination_city, u.full_name
       FROM cargos c JOIN users u ON u.id = $2 WHERE c.id = $1`,
      [chat.cargo_id, req.user.userId]
    );
    if (info.rows[0]) {
      await notify(recipientId, {
        type: "message",
        text: `Сообщение от ${info.rows[0].full_name} · ${routeOf(info.rows[0])}`,
        target: "chat",
        cargoId: chat.cargo_id,
        refId: chatId,
        coalesce: true,
      });
    }
    return res.status(201).json({ message: result.rows[0] });
  } catch (err) {
    console.error("Ошибка отправки сообщения:", err);
    return res.status(500).json({ message: "Ошибка сервера" });
  }
});

// ==================== РЕЙСЫ ДЛЯ КЛИЕНТОВ И ОТЗЫВЫ ====================

// ---------- GET /api/trips/public (клиент) ----------
// Витрина рейсов перевозчиков. Контакты видят только вошедшие клиенты (на главной их нет).
// Рейсы с уже прошедшей датой отправления не показываются.
app.get("/api/trips/public", authMiddleware, requireRole("client"), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT t.id, t.origin_city, t.destination_city, t.departure_date, t.price, t.capacity_kg,
              t.comment, t.created_at,
              u.full_name AS carrier_name, u.phone AS carrier_phone,
              cp.company_name AS carrier_company, cp.is_verified AS carrier_verified,
              v.brand AS vehicle_brand, v.model AS vehicle_model,
              v.body_type AS vehicle_body_type, v.capacity_kg AS vehicle_capacity,
              (SELECT ROUND(AVG(rv.rating), 1)::float8 FROM reviews rv WHERE rv.carrier_id = t.carrier_id) AS carrier_rating,
              (SELECT COUNT(*)::int FROM reviews rv WHERE rv.carrier_id = t.carrier_id) AS carrier_reviews
       FROM trips t
       JOIN users u ON u.id = t.carrier_id
       LEFT JOIN carrier_profiles cp ON cp.user_id = t.carrier_id
       LEFT JOIN vehicles v ON v.id = t.vehicle_id
       WHERE t.status = 'active' AND (t.departure_date IS NULL OR t.departure_date >= CURRENT_DATE)
       ORDER BY t.departure_date ASC NULLS LAST, t.created_at DESC
       LIMIT 100`
    );
    return res.json({ trips: result.rows });
  } catch (err) {
    console.error("Ошибка получения рейсов для клиента:", err);
    return res.status(500).json({ message: "Ошибка сервера" });
  }
});

// ---------- POST /api/cargos/:id/review (клиент) ----------
// Отзыв о выбранном перевозчике — только по доставленному грузу и только один раз.
app.post("/api/cargos/:id/review", authMiddleware, requireRole("client"), async (req, res) => {
  let valid;
  try {
    valid = validateReview(req.body);
  } catch (err) {
    return sendValidation(res, err);
  }

  try {
    const found = await pool.query(
      `SELECT c.id, c.status, c.origin_city, c.destination_city, r.carrier_id
       FROM cargos c
       LEFT JOIN responses r ON r.cargo_id = c.id AND r.status = 'accepted'
       WHERE c.id = $1 AND c.client_id = $2`,
      [req.params.id, req.user.userId]
    );
    if (found.rows.length === 0) return res.status(404).json({ message: "Груз не найден" });

    const cargo = found.rows[0];
    if (cargo.status !== "completed") {
      return res.status(409).json({ message: "Отзыв можно оставить после доставки груза" });
    }
    if (!cargo.carrier_id) {
      return res.status(409).json({ message: "По этому грузу не был выбран перевозчик" });
    }

    let inserted;
    try {
      inserted = await pool.query(
        `INSERT INTO reviews (cargo_id, client_id, carrier_id, rating, comment, route)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, rating, comment, created_at`,
        [cargo.id, req.user.userId, cargo.carrier_id, valid.rating, valid.comment, routeOf(cargo)]
      );
    } catch (err) {
      if (err.code === "23505") return res.status(409).json({ message: "Вы уже оставили отзыв по этому грузу" });
      throw err;
    }

    await notify(cargo.carrier_id, {
      type: "review",
      text: `Новый отзыв по грузу ${routeOf(cargo)}: оценка ${valid.rating} из 5`,
      target: "reviews",
      cargoId: cargo.id,
    });
    return res.status(201).json({ review: inserted.rows[0] });
  } catch (err) {
    console.error("Ошибка сохранения отзыва:", err);
    return res.status(500).json({ message: "Ошибка сервера" });
  }
});

// ---------- GET /api/reviews/my (перевозчик) ----------
app.get("/api/reviews/my", authMiddleware, requireRole("carrier"), async (req, res) => {
  try {
    const list = await pool.query(
      `SELECT rv.id, rv.rating, rv.comment, rv.route, rv.created_at, u.full_name AS client_name
       FROM reviews rv LEFT JOIN users u ON u.id = rv.client_id
       WHERE rv.carrier_id = $1
       ORDER BY rv.created_at DESC, rv.id DESC LIMIT 50`,
      [req.user.userId]
    );
    const summary = await pool.query(
      "SELECT ROUND(AVG(rating), 1)::float8 AS average, COUNT(*)::int AS count FROM reviews WHERE carrier_id = $1",
      [req.user.userId]
    );
    return res.json({ reviews: list.rows, average: summary.rows[0].average, count: summary.rows[0].count });
  } catch (err) {
    console.error("Ошибка получения отзывов:", err);
    return res.status(500).json({ message: "Ошибка сервера" });
  }
});

// ==================== УВЕДОМЛЕНИЯ ====================

// ---------- GET /api/notifications/count ----------
// Лёгкий запрос для опроса раз в несколько секунд: сколько событий не прочитано.
app.get("/api/notifications/count", authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT COALESCE(SUM(repeat_count), 0)::int AS unread FROM notifications WHERE user_id = $1 AND is_read = FALSE",
      [req.user.userId]
    );
    return res.json({ unread: result.rows[0].unread });
  } catch (err) {
    console.error("Ошибка счётчика уведомлений:", err);
    return res.status(500).json({ message: "Ошибка сервера" });
  }
});

// ---------- GET /api/notifications ----------
app.get("/api/notifications", authMiddleware, async (req, res) => {
  try {
    const list = await pool.query(
      `SELECT id, type, text, target, cargo_id, ref_id, repeat_count, is_read, created_at
       FROM notifications WHERE user_id = $1
       ORDER BY created_at DESC, id DESC LIMIT 30`,
      [req.user.userId]
    );
    const unread = await pool.query(
      "SELECT COALESCE(SUM(repeat_count), 0)::int AS unread FROM notifications WHERE user_id = $1 AND is_read = FALSE",
      [req.user.userId]
    );
    return res.json({ notifications: list.rows, unread: unread.rows[0].unread });
  } catch (err) {
    console.error("Ошибка загрузки уведомлений:", err);
    return res.status(500).json({ message: "Ошибка сервера" });
  }
});

// ---------- POST /api/notifications/read-all ----------
app.post("/api/notifications/read-all", authMiddleware, async (req, res) => {
  try {
    await pool.query("UPDATE notifications SET is_read = TRUE WHERE user_id = $1 AND is_read = FALSE", [req.user.userId]);
    return res.json({ message: "Все уведомления прочитаны" });
  } catch (err) {
    console.error("Ошибка отметки уведомлений:", err);
    return res.status(500).json({ message: "Ошибка сервера" });
  }
});

// ---------- POST /api/notifications/:id/read ----------
app.post("/api/notifications/:id/read", authMiddleware, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(404).json({ message: "Уведомление не найдено" });
  try {
    const result = await pool.query(
      "UPDATE notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2 RETURNING id",
      [id, req.user.userId]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: "Уведомление не найдено" });
    return res.json({ message: "Прочитано" });
  } catch (err) {
    console.error("Ошибка отметки уведомления:", err);
    return res.status(500).json({ message: "Ошибка сервера" });
  }
});

ensureSchema()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Сервер запущен на http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Не удалось подготовить схему БД:", err);
    process.exit(1);
  });
