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

app.listen(PORT, () => {
  console.log(`Сервер запущен на http://localhost:${PORT}`);
});
