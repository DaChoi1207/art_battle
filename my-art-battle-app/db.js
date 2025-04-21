// db.js
const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.PGUSER || 'davidchoi',
  host: 'localhost',
  database: 'art_battle_db',
  password: process.env.PGPASSWORD || '', // leave blank for local dev, or set env var
  port: 5432,
});

module.exports = pool;
