import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import dotenv from "dotenv";

dotenv.config();
const dbFile = process.env.DB_FILE || "./data/panel.sqlite";
fs.mkdirSync(path.dirname(path.resolve(dbFile)), { recursive: true });
export const db = new Database(dbFile);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'customer' CHECK(role IN ('customer','admin')),
    balance_paisa INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS services (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name_en TEXT NOT NULL,
    name_ur TEXT NOT NULL,
    description_en TEXT NOT NULL DEFAULT '',
    description_ur TEXT NOT NULL DEFAULT '',
    price_per_1000_paisa INTEGER NOT NULL,
    min_quantity INTEGER NOT NULL DEFAULT 10,
    max_quantity INTEGER NOT NULL DEFAULT 100000,
    active INTEGER NOT NULL DEFAULT 1
  );
  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    service_id INTEGER NOT NULL REFERENCES services(id),
    link TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    cost_paisa INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'Pending',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS deposits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    amount_paisa INTEGER NOT NULL,
    transaction_ref TEXT NOT NULL,
    proof_url TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'Pending',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);
