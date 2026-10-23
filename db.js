const { Pool } = require("pg");
require("dotenv").config();

// Пул подключений к PostgreSQL.
// Все параметры берутся из .env файла (см. .env.example)
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

pool.on("connect", () => {
  console.log("Подключено к PostgreSQL");
});

pool.on("error", (err) => {
  console.error("Ошибка подключения к БД:", err);
});

module.exports = pool;
