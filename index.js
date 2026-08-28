import express from "express";
import cookieParser from "cookie-parser";
import multer from "multer";
import Database from "better-sqlite3";
import dotenv from "dotenv";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

dotenv.config();

const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = __dirname, DATA = path.join(ROOT, "data"), UPLOADS = path.join(ROOT, "uploads");
fs.mkdirSync(DATA, { recursive: true });
fs.mkdirSync(UPLOADS, { recursive: true });
const db = new Database(path.join(DATA, "fm-fashion.db"));
db.pragma("journal_mode=WAL");

db.exec(`
CREATE TABLE IF NOT EXISTS products(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,price REAL NOT NULL,old_price REAL,image TEXT,category TEXT,stock INTEGER DEFAULT 0,featured INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS agents(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,messenger_url TEXT NOT NULL,phone TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS orders(id INTEGER PRIMARY KEY AUTOINCREMENT,customer_name TEXT NOT NULL,phone TEXT NOT NULL,email TEXT,division TEXT,district TEXT,upazila TEXT,address TEXT NOT NULL,items TEXT NOT NULL,total_amount REAL NOT NULL,delivery_charge REAL NOT NULL,status TEXT DEFAULT 'Pending',created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY,value TEXT NOT NULL DEFAULT '');
CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,expires_at INTEGER NOT NULL);
`);

const defaults = {
    admin_password_hash: "",
    store_name: "FM FASHION",
    logo: "assets/logo.png",
    delivery_charge_inside: "60",
    delivery_charge_outside: "120",
    bkash_enabled: "1",
    bkash_number: "",
    nagad_enabled: "1",
    nagad_number: "",
    rocket_enabled: "0",
    rocket_number: "",
    cod_enabled: "1",
    hero_title: "Discover Premium Fashion",
    hero_subtitle: "Upgrade your wardrobe with our latest exclusive collection.",
    hero_image: "hero.jpg"
};
const up = db.prepare("INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO NOTHING");
for(const [k,v] of Object.entries(defaults)) up.run(k,v);

app.use(cookieParser());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
    const origin = req.headers.origin;
    if(origin) {
        res.setHeader("Access-Control-Allow-Origin", origin);
        res.setHeader("Access-Control-Allow-Credentials", "true");
    }
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
    if(req.method === "OPTIONS") return res.sendStatus(204);
    next();
});

const upload = multer({ storage: multer.diskStorage({ destination: UPLOADS, filename: (r, f, cb) => cb(null, Date.now() + "-" + f.originalname) }) });

const STORE_DIR = path.join(ROOT, "store");
const ADMIN_DIR = path.join(ROOT, "admin");

app.use("/uploads", express.static(UPLOADS));
app.use("/admin", express.static(ADMIN_DIR));
app.use(express.static(STORE_DIR));

app.get("/", (req, res) => {
    res.sendFile(path.join(STORE_DIR, "index.html"));
});

app.get("/admin", (req, res) => {
    res.sendFile(path.join(ADMIN_DIR, "index.html"));
});

const settingsData = () => Object.fromEntries(db.prepare("SELECT key,value FROM settings").all());

function admin(req, res, next) {
    const t = req.cookies.admin_session;
    if(!t) return res.status(401).json({ error: "Unauthorized" });
    const s = db.prepare("SELECT * FROM sessions WHERE token=? AND expires_at>?").get(t, Date.now());
    if(!s) return res.status(401).json({ error: "Unauthorized" });
    next();
}

app.post("/api/admin/login", (req, res) => {
    try {
        const { password } = req.body;
        const s = settingsData();
        let passHash = s.admin_password_hash;

        if (!passHash) {
            const envPass = process.env.ADMIN_PASSWORD || "admin123";
            passHash = bcrypt.hashSync(envPass, 10);
            db.prepare("INSERT INTO settings(key,value) VALUES('admin_password_hash',?) ON CONFLICT(key) DO UPDATE SET value=?").run(passHash, passHash);
        }

        const match = bcrypt.compareSync(password || "", passHash);
        if (!match) {
            return res.status(401).json({ error: "Invalid password" });
        }

        const token = crypto.randomBytes(32).toString("hex");
        const expires_at = Date.now() + 7 * 24 * 60 * 60 * 1000;
        db.prepare("INSERT INTO sessions(token, expires_at) VALUES(?, ?)").run(token, expires_at);

        res.cookie("admin_session", token, {
            httpOnly: true,
            secure: false,
            sameSite: "lax",
            maxAge: 7 * 24 * 60 * 60 * 1000
        });

        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Internal server error" });
    }
});

app.get("/api/admin/me", admin, (req, res) => {
    res.json({ success: true });
});

app.post("/api/admin/logout", (req, res) => {
    const t = req.cookies.admin_session;
    if (t) {
        db.prepare("DELETE FROM sessions WHERE token=?").run(t);
    }
    res.clearCookie("admin_session");
    res.json({ success: true });
});

app.get("/api/products", (req, res) => {
    const products = db.prepare("SELECT * FROM products ORDER BY id DESC").all();
    res.json(products);
});

app.post("/api/products", admin, upload.single("image"), (req, res) => {
    const { name, price, old_price, category, stock, featured } = req.body;
    const image = req.file ? `/uploads/${req.file.filename}` : "";
    const stmt = db.prepare("INSERT INTO products (name, price, old_price, image, category, stock, featured) VALUES (?, ?, ?, ?, ?, ?, ?)");
    const info = stmt.run(name, price, old_price || null, image, category || "", stock || 0, featured ? 1 : 0);
    res.json({ id: info.lastInsertRowid, success: true });
});

app.delete("/api/products/:id", admin, (req, res) => {
    db.prepare("DELETE FROM products WHERE id=?").run(req.params.id);
    res.json({ success: true });
});

app.get("/api/settings", (req, res) => {
    const s = settingsData();
    res.json({
        store_name: s.store_name,
        logo: s.logo,
        hero_title: s.hero_title,
        hero_subtitle: s.hero_subtitle,
        hero_image: s.hero_image,
        payment_methods: {
            bKash: { enabled: s.bkash_enabled === "1", number: s.bkash_number },
            Nagad: { enabled: s.nagad_enabled === "1", number: s.nagad_number },
            Rocket: { enabled: s.rocket_enabled === "1", number: s.rocket_number },
            COD: { enabled: s.cod_enabled === "1", number: "" }
        }
    });
});

app.get("/api/agents", (req, res) => {
    const agents = db.prepare("SELECT * FROM agents").all();
    res.json(agents);
});

app.post("/api/orders", (req, res) => {
    const { name, phone, email, division, district, upazila, address, items, total } = req.body;
    const stmt = db.prepare("INSERT INTO orders (customer_name, phone, email, division, district, upazila, address, items, total_amount, delivery_charge) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
    const info = stmt.run(name || "Customer", phone || "", email || "", division || "", district || "", upazila || "", address || "", JSON.stringify(items || []), total || 0, 60);
    res.json({ orderId: info.lastInsertRowid, total });
});

app.get("/api/orders", admin, (req, res) => {
    const orders = db.prepare("SELECT * FROM orders ORDER BY id DESC").all();
    res.json(orders);
});

app.post("/api/chat", (req, res) => {
    try {
        const { message } = req.body;
        let reply = "দুঃখিত, আমি এই মুহূর্তে বুঝতে পারিনি। অনুগ্রহ করে আমাদের কোনো এজেন্টের সাথে যোগাযোগ করুন।";
        
        const msg = (message || "").toLowerCase();
        if (msg.includes("hello") || msg.includes("hi") || msg.includes("সালাম")) {
            reply = "আসসালামু আলাইকুম! এফএম ফ্যাশনে আপনাকে স্বাগতম। কীভাবে সাহায্য করতে পারি?";
        } else if (msg.includes("price") || msg.includes("দাম")) {
            reply = "আমাদের প্রতিটি পণ্যের নিচে মূল্য দেওয়া আছে। আপনার পছন্দের পণ্যটি কার্টে যোগ করে অর্ডার করতে পারেন।";
        } else if (msg.includes("delivery") || msg.includes("ডেলিভারি")) {
            reply = "ঢাকার ভেতরে ডেলিভারি চার্জ ৬০ টাকা এবং ঢাকার বাইরে ১২০ টাকা।";
        }

        res.json({ reply });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Chat service error" });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
