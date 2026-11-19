import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import express from "express";
import session from "express-session";
import SQLiteStoreFactory from "connect-sqlite3";
import helmet from "helmet";
import bcrypt from "bcryptjs";
import { db } from "./db.js";

dotenv.config();
const ROOT = path.dirname(fileURLToPath(import.meta.url));
fs.mkdirSync(path.join(ROOT, "data"), { recursive: true });
if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
  console.error("Set SESSION_SECRET to a random value of at least 32 characters.");
  process.exit(1);
}
const app = express();
const SQLiteStore = SQLiteStoreFactory(session);
app.set("trust proxy", 1);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.urlencoded({ extended: false, limit: "20kb" }));
app.use(express.static(path.join(ROOT, "public")));
app.use(session({
  store: new SQLiteStore({ db: "sessions.sqlite", dir: path.join(ROOT, "data") }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 1000 * 60 * 60 * 12 }
}));
app.use((req, res, next) => {
  if (req.session.user) res.locals.user = db.prepare("SELECT id,name,phone,role,balance_paisa FROM users WHERE id=?").get(req.session.user.id);
  next();
});

const esc = (value = "") => String(value).replace(/[&<>\"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[c]);
const money = (paisa) => `PKR ${(paisa / 100).toLocaleString("en-PK", { minimumFractionDigits: 2 })}`;
const page = (title, body, user = null) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#101b35"><meta name="description" content="Captain Nawab customer services panel"><title>${esc(title)} | Captain Nawab</title><link rel="stylesheet" href="/style.css"></head><body><header class="top"><a class="brand" href="/"> <span class="mark">CN</span><span>Captain Nawab<small class="brand-sub">SERVICE PANEL</small></span></a><div class="nav"><button id="languageToggle" class="button light" type="button">اردو</button>${user ? `<a href="/services">Services</a><a href="/orders">Orders</a><a href="/deposit">Add funds</a>${user.role === "admin" ? '<a href="/admin">Admin</a>' : ''}<form method="post" action="/logout"><input type="hidden" name="csrf" value="${esc(user.csrf)}"><button class="button light">Log out</button></form>` : '<a href="/login">Log in</a><a href="/register">Create account</a>'}</div></header><main class="container">${body}</main><footer>© 2026 Captain Nawab · PKR · Pakistan</footer><script src="/app.js" defer></script></body></html>`;
const csrf = (req) => { req.session.csrf ||= crypto.randomBytes(24).toString("hex"); return req.session.csrf; };
const hiddenCsrf = (req) => `<input type="hidden" name="csrf" value="${esc(csrf(req))}">`;
const requireAuth = (req, res, next) => req.session.user ? next() : res.redirect("/login");
const requireAdmin = (req, res, next) => {
  const user = req.session.user && db.prepare("SELECT role FROM users WHERE id=?").get(req.session.user.id);
  if (!user || user.role !== "admin") return res.status(403).send(page("Forbidden", "<h1>Access denied</h1>"));
  next();
};
app.use((req, res, next) => {
  if (["POST", "PUT", "DELETE"].includes(req.method)) {
    if (!req.session.csrf || req.body.csrf !== req.session.csrf) return res.status(403).send("Invalid form token. Refresh and try again.");
  }
  next();
});
function render(req, res, title, body, status = 200) {
  const user = res.locals.user ? { ...res.locals.user, csrf: csrf(req) } : null;
  res.status(status).send(page(title, body, user));
}
function formField(label, name, type = "text", attrs = "") {
  return `<label>${label}<input name="${name}" type="${type}" ${attrs} required></label>`;
}

app.get("/", (req, res) => {
  if (!req.session.user) return res.redirect("/login");
  const user = db.prepare("SELECT * FROM users WHERE id=?").get(req.session.user.id);
  const orderCount = db.prepare("SELECT COUNT(*) AS n FROM orders WHERE user_id=?").get(user.id).n;
  const pendingDeposits = db.prepare("SELECT COUNT(*) AS n FROM deposits WHERE user_id=? AND status='Pending'").get(user.id).n;
  const recent = db.prepare("SELECT o.id,o.quantity,o.status,o.created_at,s.name_en FROM orders o JOIN services s ON s.id=o.service_id WHERE o.user_id=? ORDER BY o.id DESC LIMIT 5").all(user.id);
  const recentRows = recent.map(o => `<tr><td>#${o.id}</td><td>${esc(o.name_en)}</td><td>${o.quantity.toLocaleString()}</td><td><span class="status">${esc(o.status)}</span></td><td>${esc(o.created_at)}</td></tr>`).join("");
  render(req, res, "Dashboard", `<section class="hero"><div><p class="eyebrow">CUSTOMER DASHBOARD</p><h1>Welcome, ${esc(user.name)}</h1><p>Your account overview and recent activity, all in one place.</p><div class="hero-actions"><a class="button gold" href="/services">Explore services</a><a class="button light" href="/deposit">Add funds</a></div></div><div class="photo"><img src="/captain-nawab.jpg" alt="Captain Nawab"></div></section><div class="grid stats-grid"><article class="card stat-card"><p>Available balance</p><h2>${money(user.balance_paisa)}</h2><span class="muted">Your current wallet balance</span></article><article class="card stat-card"><p>Total orders</p><h2>${orderCount}</h2><span class="muted">Orders placed by your account</span></article><article class="card stat-card"><p>Pending deposits</p><h2>${pendingDeposits}</h2><span class="muted">Waiting for admin review</span></article></div><section class="card table-wrap"><div class="section-heading"><div><p class="eyebrow">ACTIVITY</p><h2>Recent orders</h2></div><a href="/orders">View all</a></div><table><thead><tr><th>Order</th><th>Service</th><th>Quantity</th><th>Status</th><th>Date</th></tr></thead><tbody>${recentRows || '<tr><td colspan="5">You have not placed any orders yet.</td></tr>'}</tbody></table></section>`);
});
app.get("/register", (req, res) => render(req, res, "Create account", `<section class="card narrow"><p class="eyebrow">CUSTOMER ACCOUNT</p><h1>Create account</h1><form method="post" action="/register">${hiddenCsrf(req)}${formField("Your name", "name", "text", 'maxlength="80"')}${formField("Pakistan mobile number", "phone", "tel", 'inputmode="numeric" placeholder="03XXXXXXXXX" maxlength="13"')}${formField("Password (minimum 10 characters)", "password", "password", 'minlength="10" autocomplete="new-password"')}<button class="button full">Create account</button></form><p>Already registered? <a href="/login">Log in</a></p></section>`));
app.post("/register", (req, res) => {
  const name = String(req.body.name || "").trim(); const phone = String(req.body.phone || "").replace(/\D/g, "").replace(/^92/, "0"); const password = String(req.body.password || "");
  if (name.length < 2 || name.length > 80 || !/^03\d{9}$/.test(phone) || password.length < 10) return render(req, res, "Create account", '<div class="notice">Enter a valid name, Pakistani mobile number, and password of at least 10 characters.</div><a href="/register">Try again</a>', 400);
  try { const result = db.prepare("INSERT INTO users(name,phone,password_hash) VALUES(?,?,?)").run(name, phone, bcrypt.hashSync(password, 12)); req.session.regenerate((error) => { if (error) return res.sendStatus(500); req.session.user = { id: result.lastInsertRowid }; req.session.csrf = crypto.randomBytes(24).toString("hex"); req.session.save(() => res.redirect("/")); }); }
  catch { render(req, res, "Create account", '<div class="notice">That phone number may already be registered.</div><a href="/register">Try again</a>', 409); }
});
app.get("/login", (req, res) => render(req, res, "Log in", `<section class="card narrow"><p class="eyebrow">WELCOME TO</p><div class="login-head"><div><h1>Captain Nawab</h1><p>Sign in to your account</p></div><div class="photo small"><img src="/captain-nawab.jpg" alt="Captain Nawab"></div></div><form method="post" action="/login">${hiddenCsrf(req)}${formField("Mobile number", "phone", "tel", 'autocomplete="tel"')}${formField("Password", "password", "password", 'autocomplete="current-password"')}<button class="button full">Sign in</button></form><p>New here? <a href="/register">Create an account</a></p></section>`));
app.post("/login", (req, res) => {
  const phone = String(req.body.phone || "").replace(/\D/g, "").replace(/^92/, "0"); const user = db.prepare("SELECT * FROM users WHERE phone=?").get(phone);
  if (!user || !bcrypt.compareSync(String(req.body.password || ""), user.password_hash)) return render(req, res, "Log in", '<div class="notice">Phone number or password was not accepted.</div><a href="/login">Try again</a>', 401);
  req.session.regenerate((error) => { if (error) return res.sendStatus(500); req.session.user = { id: user.id }; req.session.csrf = crypto.randomBytes(24).toString("hex"); res.redirect("/"); });
});
app.post("/logout", requireAuth, (req, res) => req.session.destroy(() => res.redirect("/login")));

app.get("/services", requireAuth, (req, res) => {
  const services = db.prepare("SELECT * FROM services WHERE active=1 ORDER BY id DESC").all();
  const cards = services.map(s => `<article class="card"><p class="eyebrow">SERVICE #${s.id}</p><h2>${esc(s.name_en)}</h2><p>${esc(s.description_en)}</p><p><strong>${money(s.price_per_1000_paisa)}</strong> / 1,000</p><form method="post" action="/orders">${hiddenCsrf(req)}<input type="hidden" name="service_id" value="${s.id}">${formField("Link", "link", "url", 'placeholder="https://" maxlength="500"')}${formField(`Quantity (${s.min_quantity}–${s.max_quantity})`, "quantity", "number", `min="${s.min_quantity}" max="${s.max_quantity}"`)}<button class="button">Place order</button></form></article>`).join("") || '<div class="card">No active services yet. Contact the administrator.</div>';
  render(req, res, "Services", `<h1>Services</h1><p class="muted">Prices are shown in PKR per 1,000 units. Review service details before ordering.</p><div class="grid">${cards}</div>`);
});
app.post("/orders", requireAuth, (req, res) => {
  const service = db.prepare("SELECT * FROM services WHERE id=? AND active=1").get(Number(req.body.service_id)); const quantity = Number(req.body.quantity); const link = String(req.body.link || "").trim();
  if (!service || !Number.isSafeInteger(quantity) || quantity < service.min_quantity || quantity > service.max_quantity || !/^https:\/\//i.test(link) || link.length > 500) return res.status(400).send(page("Invalid order", "<h1>Invalid order details</h1><a href='/services'>Back to services</a>"));
  const cost = Math.ceil(service.price_per_1000_paisa * quantity / 1000); const tx = db.transaction(() => { const user = db.prepare("SELECT balance_paisa FROM users WHERE id=?").get(req.session.user.id); if (user.balance_paisa < cost) return false; db.prepare("UPDATE users SET balance_paisa=balance_paisa-? WHERE id=?").run(cost, req.session.user.id); db.prepare("INSERT INTO orders(user_id,service_id,link,quantity,cost_paisa) VALUES(?,?,?,?,?)").run(req.session.user.id,service.id,link,quantity,cost); return true; });
  if (!tx()) return render(req, res, "Insufficient balance", '<div class="notice">Insufficient balance. Submit a deposit request first.</div><a class="button" href="/deposit">Add funds</a>', 400);
  res.redirect("/orders");
});
app.get("/orders", requireAuth, (req, res) => {
  const rows = db.prepare("SELECT o.*,s.name_en FROM orders o JOIN services s ON s.id=o.service_id WHERE o.user_id=? ORDER BY o.id DESC").all(req.session.user.id);
  const table = rows.map(o => `<tr><td>${o.id}</td><td>${esc(o.name_en)}</td><td>${o.quantity.toLocaleString()}</td><td>${money(o.cost_paisa)}</td><td>${esc(o.status)}</td><td>${esc(o.created_at)}</td></tr>`).join("");
  render(req, res, "Your orders", `<h1>Your orders</h1><div class="card table-wrap"><table><thead><tr><th>ID</th><th>Service</th><th>Quantity</th><th>Cost</th><th>Status</th><th>Date</th></tr></thead><tbody>${table || '<tr><td colspan="6">No orders yet.</td></tr>'}</tbody></table></div>`);
});
app.get("/deposit", requireAuth, (req, res) => render(req, res, "Add funds", `<section class="card narrow"><p class="eyebrow">MANUAL EASYPAISA DEPOSIT</p><h1>Add funds</h1><p>Send payment to <strong>${esc(process.env.EASYPAISA_ACCOUNT_NAME || "Account holder")}</strong> at <strong>${esc(process.env.EASYPAISA_MOBILE || "Configure Easypaisa number in .env")}</strong>. Submit the reference below. Admin verification is required before your balance is credited.</p><form method="post" action="/deposit">${hiddenCsrf(req)}${formField("Amount (PKR)", "amount", "number", 'min="50" max="500000" step="0.01"')}${formField("Transaction reference", "transaction_ref", "text", 'maxlength="100"')}${formField("Optional proof image URL", "proof_url", "url", 'placeholder="https://" maxlength="500"')}<button class="button full">Submit for review</button></form><p class="muted">Never submit your Easypaisa PIN, OTP, or account password.</p></section>`));
app.post("/deposit", requireAuth, (req, res) => {
  const amount = Math.round(Number(req.body.amount) * 100); const ref = String(req.body.transaction_ref || "").trim(); const proof = String(req.body.proof_url || "").trim();
  if (!Number.isSafeInteger(amount) || amount < 5000 || amount > 50000000 || ref.length < 4 || ref.length > 100 || (proof && (!/^https:\/\//i.test(proof) || proof.length > 500))) return res.status(400).send(page("Invalid deposit", "<h1>Check amount, transaction reference, and proof URL.</h1><a href='/deposit'>Try again</a>"));
  db.prepare("INSERT INTO deposits(user_id,amount_paisa,transaction_ref,proof_url) VALUES(?,?,?,?)").run(req.session.user.id, amount, ref, proof); res.redirect("/deposit");
});

app.get("/admin", requireAuth, requireAdmin, (req, res) => {
  const deposits = db.prepare("SELECT d.*,u.name,u.phone FROM deposits d JOIN users u ON u.id=d.user_id WHERE d.status='Pending' ORDER BY d.id").all();
  const orders = db.prepare("SELECT o.*,u.name,s.name_en FROM orders o JOIN users u ON u.id=o.user_id JOIN services s ON s.id=o.service_id ORDER BY o.id DESC LIMIT 50").all();
  const services = db.prepare("SELECT * FROM services ORDER BY id DESC").all();
  const depHtml = deposits.map(d => `<tr><td>${d.id}</td><td>${esc(d.name)} (${esc(d.phone)})</td><td>${money(d.amount_paisa)}</td><td>${esc(d.transaction_ref)} ${d.proof_url ? `<a href="${esc(d.proof_url)}" target="_blank" rel="noopener">Proof</a>` : ""}</td><td><form method="post" action="/admin/deposit/${d.id}">${hiddenCsrf(req)}<button class="button">Approve & credit</button></form><form method="post" action="/admin/deposit/${d.id}/reject">${hiddenCsrf(req)}<button class="button danger">Reject</button></form></td></tr>`).join("");
  const orderHtml = orders.map(o => `<tr><td>${o.id}</td><td>${esc(o.name)}</td><td>${esc(o.name_en)}</td><td>${o.quantity}</td><td>${esc(o.status)}</td><td><form method="post" action="/admin/order/${o.id}">${hiddenCsrf(req)}<select name="status">${["Pending","Processing","Completed","Partial","Cancelled"].map(st => `<option ${o.status === st ? "selected" : ""}>${st}</option>`).join("")}</select><button class="button">Update</button></form></td></tr>`).join("");
  const serviceHtml = services.map(s => `<tr><td>${s.id}</td><td>${esc(s.name_en)}</td><td>${money(s.price_per_1000_paisa)}</td><td>${s.active ? "Active" : "Inactive"}</td></tr>`).join("");
  render(req, res, "Admin", `<h1>Admin panel</h1><h2>Pending Easypaisa deposits</h2><div class="card table-wrap"><table><thead><tr><th>ID</th><th>Customer</th><th>Amount</th><th>Reference</th><th>Review</th></tr></thead><tbody>${depHtml || '<tr><td colspan="5">No pending requests.</td></tr>'}</tbody></table></div><h2>Recent orders</h2><div class="card table-wrap"><table><thead><tr><th>ID</th><th>Customer</th><th>Service</th><th>Qty</th><th>Status</th><th>Update</th></tr></thead><tbody>${orderHtml}</tbody></table></div><h2>Services</h2><div class="card table-wrap"><table><thead><tr><th>ID</th><th>Service</th><th>Price/1000</th><th>State</th></tr></thead><tbody>${serviceHtml}</tbody></table></div><section class="card narrow"><h2>Add service</h2><form method="post" action="/admin/services">${hiddenCsrf(req)}${formField("Name in English", "name_en", "text", 'maxlength="120"')}${formField("Name in Urdu", "name_ur", "text", 'maxlength="120"')}${formField("Description in English", "description_en", "text", 'maxlength="500"')}${formField("Description in Urdu", "description_ur", "text", 'maxlength="500"')}${formField("Price per 1,000 (PKR)", "price", "number", 'min="0.01" step="0.01"')}${formField("Minimum quantity", "min_quantity", "number", 'min="1"')}${formField("Maximum quantity", "max_quantity", "number", 'min="1"')}<button class="button">Add service</button></form></section>`);
});
app.post("/admin/deposit/:id", requireAuth, requireAdmin, (req, res) => {
  const approve = db.transaction(() => { const d = db.prepare("SELECT * FROM deposits WHERE id=? AND status='Pending'").get(Number(req.params.id)); if (!d) return; db.prepare("UPDATE deposits SET status='Approved' WHERE id=?").run(d.id); db.prepare("UPDATE users SET balance_paisa=balance_paisa+? WHERE id=?").run(d.amount_paisa,d.user_id); }); approve(); res.redirect("/admin");
});
app.post("/admin/deposit/:id/reject", requireAuth, requireAdmin, (req, res) => { db.prepare("UPDATE deposits SET status='Rejected' WHERE id=? AND status='Pending'").run(Number(req.params.id)); res.redirect("/admin"); });
app.post("/admin/order/:id", requireAuth, requireAdmin, (req, res) => { const allowed = ["Pending","Processing","Completed","Partial","Cancelled"]; const status = String(req.body.status); if (allowed.includes(status)) db.prepare("UPDATE orders SET status=? WHERE id=?").run(status, Number(req.params.id)); res.redirect("/admin"); });
app.post("/admin/services", requireAuth, requireAdmin, (req, res) => {
  const nameEn = String(req.body.name_en || "").trim(); const nameUr = String(req.body.name_ur || "").trim(); const price = Math.round(Number(req.body.price) * 100); const min = Number(req.body.min_quantity); const max = Number(req.body.max_quantity);
  if (!nameEn || !nameUr || nameEn.length > 120 || nameUr.length > 120 || !Number.isSafeInteger(price) || price < 1 || !Number.isSafeInteger(min) || !Number.isSafeInteger(max) || min < 1 || max < min || max > 10000000) return res.status(400).send(page("Invalid service", "<h1>Check service fields.</h1><a href='/admin'>Back</a>"));
  db.prepare("INSERT INTO services(name_en,name_ur,description_en,description_ur,price_per_1000_paisa,min_quantity,max_quantity) VALUES(?,?,?,?,?,?,?)").run(nameEn,nameUr,String(req.body.description_en || "").slice(0,500),String(req.body.description_ur || "").slice(0,500),price,min,max); res.redirect("/admin");
});
app.use((req, res) => render(req, res, "Not found", "<h1>Page not found</h1>" ,404));
const port = Number(process.env.PORT || 3000);
app.listen(port, () => console.log(`Captain Nawab panel listening on port ${port}`));
