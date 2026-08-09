// Runs once before the e2e suite. Loads .env.test into process.env (Jest
// forks test workers from this process, so they inherit it) and rebuilds the
// isolated test schema from scratch — dotenv won't override vars that are
// already set, so this must run before AppModule's ConfigModule does.
//
// The schema is dropped (not just truncated) every run: TypeORM's
// `synchronize: true` only ever adds/alters columns to match the current
// entities, so a schema left over from an older entity shape can desync
// (e.g. backfilling a new NOT NULL UNIQUE column onto existing rows collides
// on the unique index). Dropping guarantees a clean sync every time.
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

  await connection.query(`DROP DATABASE IF EXISTS \`${process.env.DB_NAME}\``);
  await connection.query(`CREATE DATABASE \`${process.env.DB_NAME}\``);
  await connection.end();
};
