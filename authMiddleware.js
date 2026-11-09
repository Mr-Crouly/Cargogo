const jwt = require("jsonwebtoken");
const pool = require("./db");

// Проверяем токен и актуальное состояние аккаунта в БД при каждом запросе.
// Это позволяет немедленно отзывать доступ заблокированным пользователям.
async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Требуется авторизация" });
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const result = await pool.query(
      "SELECT id, email, role, is_blocked FROM users WHERE id = $1",
      [decoded.userId]
    );
    const user = result.rows[0];
    if (!user) return res.status(401).json({ message: "Пользователь не найден" });
    if (user.is_blocked) return res.status(403).json({ message: "Аккаунт заблокирован" });

    // Роль и email берём из БД, а не из потенциально устаревшего JWT.
    req.user = { userId: user.id, role: user.role, email: user.email };
    next();
  } catch (err) {
    if (err && err.name === "JsonWebTokenError") {
      return res.status(401).json({ message: "Недействительный или истёкший токен" });
    }
    if (err && err.name === "TokenExpiredError") {
      return res.status(401).json({ message: "Недействительный или истёкший токен" });
    }
    console.error("Ошибка проверки авторизации:", err);
    return res.status(500).json({ message: "Ошибка авторизации" });
  }
}

module.exports = authMiddleware;
