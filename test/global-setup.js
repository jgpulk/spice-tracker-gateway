// Runs once before the e2e suite. Loads .env.test into process.env (Jest
// forks test workers from this process, so they inherit it) and makes sure
// the isolated test schema exists — dotenv won't override vars that are
// already set, so this must run before AppModule's ConfigModule does.
const path = require('path');
const dotenv = require('dotenv');
const mysql = require('mysql2/promise');

module.exports = async function globalSetup() {
  dotenv.config({ path: path.resolve(__dirname, '../.env.test') });

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  });

  await connection.query(`CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME}\``);
  await connection.end();
};
