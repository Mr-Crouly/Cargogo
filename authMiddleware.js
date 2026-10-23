const jwt = require("jsonwebtoken");

// Проверяет заголовок Authorization: Bearer <token>
// Если токен валиден — кладёт данные пользователя в req.user и пропускает дальше.
// Если нет — возвращает 401.
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Требуется авторизация" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { userId, role, email }
    next();
  } catch (err) {
    return res.status(401).json({ message: "Недействительный или истёкший токен" });
  }
}

module.exports = authMiddleware;
