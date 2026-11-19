import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import { db } from "./db.js";
dotenv.config();
const phone = (process.env.ADMIN_PHONE || "3001234567").replace(/\D/g, "");
const password = process.env.ADMIN_PASSWORD;
if (!password || password === "ChangeThisStrongPassword123!") {
  console.error("Set a private ADMIN_PASSWORD in .env before seeding.");
  process.exit(1);
}
const existing = db.prepare("SELECT id FROM users WHERE phone = ?").get(phone);
if (!existing) {
  db.prepare("INSERT INTO users (name, phone, password_hash, role) VALUES (?, ?, ?, 'admin')")
    .run(process.env.ADMIN_NAME || "Admin", phone, bcrypt.hashSync(password, 12));
  console.log(`Admin created. Login phone: ${phone}`);
} else {
  console.log("Admin account already exists; no changes made.");
}
const count = db.prepare("SELECT COUNT(*) AS n FROM services").get().n;
if (!count) {
  const add = db.prepare(`INSERT INTO services
    (name_en,name_ur,description_en,description_ur,price_per_1000_paisa,min_quantity,max_quantity)
    VALUES (?,?,?,?,?,?,?)`);
  add.run("Instagram — sample service", "انسٹاگرام — نمونہ سروس", "Replace this sample with an authorized, clearly described service.", "اس نمونے کو واضح اور مجاز سروس سے تبدیل کریں۔", 5000, 10, 10000);
  add.run("YouTube — sample service", "یوٹیوب — نمونہ سروس", "Replace this sample with an authorized, clearly described service.", "اس نمونے کو واضح اور مجاز سروس سے تبدیل کریں۔", 10000, 10, 10000);
}
console.log("Seed complete. Review sample services before launch.");
