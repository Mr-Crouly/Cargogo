const express = require("express");
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const pool = require("./db");
const authMiddleware = require("./authMiddleware");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

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
  await ensureColumn("cargos", "created_at", "TIMESTAMP NOT NULL DEFAULT NOW()");
  await relaxUnknownNotNullColumns("cargos", [
    "id", "client_id", "origin_city", "destination_city", "cargo_type", "weight_kg",
    "price", "ready_date", "comment", "status", "created_at",
  ]);
}

// ---------- POST /api/register ----------
// Принимает данные из формы регистрации, создаёт пользователя
// и (в зависимости от роли) соответствующий профиль.
app.post("/api/register", async (req, res) => {
  const { fullName, email, phone, password, role } = req.body;

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
    const existing = await client.query("SELECT id FROM users WHERE email = $1", [email]);
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
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "Заполните email и пароль" });
  }

  try {
    const result = await pool.query(
      "SELECT id, email, password_hash, role, full_name FROM users WHERE email = $1",
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ message: "Неверный email или пароль" });
    }

    const user = result.rows[0];
    const passwordMatches = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatches) {
      return res.status(401).json({ message: "Неверный email или пароль" });
    }

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
  const { fullName, phone, companyName, taxId, address, licenseNumber } = req.body;

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
  const { brand, model, plateNumber, capacityKg, bodyType } = req.body;

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
  const { originCity, destinationCity, departureDate, price, capacityKg, comment, vehicleId } = req.body;

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
      `SELECT id, origin_city, destination_city, cargo_type, weight_kg, price,
              ready_date, comment, status, created_at
       FROM cargos WHERE client_id = $1 ORDER BY created_at DESC`,
      [req.user.userId]
    );
    return res.json({ cargos: result.rows });
  } catch (err) {
    console.error("Ошибка получения грузов:", err);
    return res.status(500).json({ message: "Ошибка сервера" });
  }
});

// ---------- POST /api/cargos ----------
app.post("/api/cargos", authMiddleware, requireRole("client"), async (req, res) => {
  const { originCity, destinationCity, cargoType, weightKg, price, readyDate, comment } = req.body;

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
