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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/*
  Render:
  rootDir = server

  Therefore:
  __dirname = /project/server

  Website folders are one level above:
  /project/store
  /project/admin
*/

const ROOT = path.join(__dirname, "..");
const DATA = path.join(ROOT, "data");
const UPLOADS = path.join(ROOT, "uploads");
const STORE_DIR = path.join(ROOT, "store");
const ADMIN_DIR = path.join(ROOT, "admin");

fs.mkdirSync(DATA, { recursive: true });
fs.mkdirSync(UPLOADS, { recursive: true });

const db = new Database(path.join(DATA, "fm-fashion.db"));

db.pragma("journal_mode = WAL");

db.exec(`
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  price REAL NOT NULL,
  old_price REAL DEFAULT 0,
  image TEXT DEFAULT '',
  category TEXT DEFAULT 'General',
  tags TEXT DEFAULT '',
  featured INTEGER DEFAULT 0,
  is_new INTEGER DEFAULT 0,
  rating REAL DEFAULT 5,
  review_count INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS agents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  whatsapp TEXT NOT NULL,
  messenger_url TEXT DEFAULT '',
  active INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT DEFAULT '',
  division TEXT DEFAULT '',
  district TEXT DEFAULT '',
  upazila TEXT DEFAULT '',
  address TEXT NOT NULL,
  note TEXT DEFAULT '',
  items_json TEXT NOT NULL,
  total REAL NOT NULL,
  payment_method TEXT DEFAULT 'Cash on Delivery',
  transaction_id TEXT DEFAULT '',
  status TEXT DEFAULT 'Pending',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  expires_at INTEGER NOT NULL
);
`);

/* =========================
   DEFAULT SETTINGS
========================= */

const defaults = {
  admin_password_hash: "",
  store_name: "FM FASHION",
  logo: "assets/logo.png",
  delivery_promise: "2–5 working days",
  payment_note:
    "Online payment করলে Send Money করে Transaction ID দিন।",

  bkash_number: "",
  nagad_number: "",
  rocket_number: "",

  bkash_enabled: "1",
  nagad_enabled: "1",
  rocket_enabled: "1",
  cod_enabled: "1"
};

const insertSetting = db.prepare(`
  INSERT INTO settings(key, value)
  VALUES(?, ?)
  ON CONFLICT(key) DO NOTHING
`);

for (const [key, value] of Object.entries(defaults)) {
  insertSetting.run(key, value);
}

/* =========================
   EXPRESS APP
========================= */

const app = express();

app.set("trust proxy", 1);

app.use(
  express.json({
    limit: "10mb"
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: "10mb"
  })
);

app.use(
  cookieParser(
    process.env.SESSION_SECRET || "fm-fashion-development-secret"
  )
);

/* =========================
   CORS
========================= */

app.use((req, res, next) => {
  const origin = req.headers.origin;

  const allowOrigin = process.env.ALLOW_ORIGIN || "*";

  if (
    origin &&
    (
      allowOrigin === "*" ||
      allowOrigin
        .split(",")
        .map((x) => x.trim())
        .includes(origin)
    )
  ) {
    res.setHeader(
      "Access-Control-Allow-Origin",
      origin
    );

    res.setHeader(
      "Access-Control-Allow-Credentials",
      "true"
    );

    res.setHeader("Vary", "Origin");
  }

  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization"
  );

  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET,POST,PUT,PATCH,DELETE,OPTIONS"
  );

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  next();
});

/* =========================
   FILE UPLOAD
========================= */

const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOADS,

    filename: (req, file, cb) => {
      const extension = path
        .extname(file.originalname)
        .toLowerCase();

      const filename =
        Date.now() +
        "-" +
        crypto.randomBytes(5).toString("hex") +
        extension;

      cb(null, filename);
    }
  }),

  limits: {
    fileSize: 8 * 1024 * 1024
  },

  fileFilter: (req, file, cb) => {
    const allowed = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif"
    ];

    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"));
    }
  }
});

/* =========================
   STATIC FILES
========================= */

app.use(
  "/uploads",
  express.static(UPLOADS)
);

app.use(
  "/admin",
  express.static(ADMIN_DIR)
);

app.use(
  express.static(STORE_DIR)
);

/* =========================
   HELPERS
========================= */

function getSettings() {
  return Object.fromEntries(
    db
      .prepare("SELECT key, value FROM settings")
      .all()
      .map((row) => [row.key, row.value])
  );
}

function getPaymentMethods() {
  const s = getSettings();

  return {
    bKash: {
      enabled: s.bkash_enabled === "1",
      number: s.bkash_number || ""
    },

    Nagad: {
      enabled: s.nagad_enabled === "1",
      number: s.nagad_number || ""
    },

    Rocket: {
      enabled: s.rocket_enabled === "1",
      number: s.rocket_number || ""
    },

    "Cash on Delivery": {
      enabled: s.cod_enabled === "1",
      number: ""
    }
  };
}

function publicProduct(product) {
  return {
    ...product,

    price: Number(product.price || 0),

    old_price: Number(
      product.old_price || 0
    ),

    featured: Boolean(product.featured),

    is_new: Boolean(product.is_new)
  };
}

/* =========================
   ADMIN AUTH
========================= */

function admin(req, res, next) {
  const token =
    req.signedCookies.admin_session;

  if (!token) {
    return res.status(401).json({
      error: "Admin login required"
    });
  }

  const session = db
    .prepare(
      `
      SELECT *
      FROM sessions
      WHERE token = ?
      AND expires_at > ?
      `
    )
    .get(token, Date.now());

  if (!session) {
    return res.status(401).json({
      error: "Session expired"
    });
  }

  next();
}

/* =========================
   HEALTH CHECK
========================= */

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    service: "FM FASHION",
    status: "online"
  });
});

/* =========================
   PUBLIC SETTINGS
========================= */

app.get("/api/settings", (req, res) => {
  res.json({
    ...getSettings(),
    payment_methods: getPaymentMethods()
  });
});

/* =========================
   PUBLIC PRODUCTS
========================= */

app.get("/api/products", (req, res) => {
  const products = db
    .prepare(
      "SELECT * FROM products ORDER BY id DESC"
    )
    .all()
    .map(publicProduct);

  res.json(products);
});

/* =========================
   PUBLIC AGENTS
========================= */

app.get("/api/agents", (req, res) => {
  const agents = db
    .prepare(
      `
      SELECT id, name, messenger_url, whatsapp, active
      FROM agents
      WHERE active = 1
      ORDER BY id DESC
      `
    )
    .all();

  res.json(
    agents.map((agent) => ({
      ...agent,

      whatsapp_url: agent.whatsapp
        ? (
            agent.whatsapp.startsWith("http")
              ? agent.whatsapp
              : `https://wa.me/${agent.whatsapp.replace(/\D/g, "")}`
          )
        : ""
    }))
  );
});

/* =========================
   CREATE ORDER
========================= */

app.post("/api/orders", (req, res) => {
  try {
    const {
      customer_name,
      phone,
      email = "",
      division = "",
      district = "",
      upazila = "",
      address,
      note = "",
      payment_method = "Cash on Delivery",
      transaction_id = "",
      items
    } = req.body;

    if (
      !customer_name ||
      !phone ||
      !address ||
      !Array.isArray(items) ||
      items.length === 0
    ) {
      return res.status(400).json({
        error:
          "Name, phone, address and cart items are required"
      });
    }

    let total = 0;

    const cleanItems = [];

    for (const item of items) {
      const product = db
        .prepare(
          `
          SELECT id, name, price, image
          FROM products
          WHERE id = ?
          `
        )
        .get(Number(item.id));

      if (!product) continue;

      const quantity = Math.max(
        1,
        Math.min(
          99,
          Number(item.qty) || 1
        )
      );

      cleanItems.push({
        id: product.id,
        name: product.name,
        price: Number(product.price),
        qty: quantity,
        image: product.image
      });

      total +=
        Number(product.price) *
        quantity;
    }

    if (cleanItems.length === 0) {
      return res.status(400).json({
        error: "No valid products"
      });
    }

    const result = db
      .prepare(
        `
        INSERT INTO orders (
          customer_name,
          phone,
          email,
          division,
          district,
          upazila,
          address,
          note,
          items_json,
          total,
          payment_method,
          transaction_id
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `
      )
      .run(
        String(customer_name).trim(),
        String(phone).trim(),
        String(email).trim(),
        String(division),
        String(district),
        String(upazila),
        String(address).trim(),
        String(note).trim(),
        JSON.stringify(cleanItems),
        total,
        String(payment_method),
        String(transaction_id).trim()
      );

    const orderId =
      `FMF-${String(
        result.lastInsertRowid
      ).padStart(6, "0")}`;

    res.status(201).json({
      success: true,
      orderId,
      total
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Unable to create order"
    });
  }
});

/* =========================
   TRACK ORDER
========================= */

app.get("/api/orders/track", (req, res) => {
  const phone =
    String(req.query.phone || "").trim();

  const id = String(
    req.query.id || ""
  ).replace(/\D/g, "");

  if (!phone || !id) {
    return res.status(400).json({
      error: "Order ID and phone required"
    });
  }

  const order = db
    .prepare(
      `
      SELECT *
      FROM orders
      WHERE id = ?
      AND phone = ?
      `
    )
    .get(Number(id), phone);

  if (!order) {
    return res.status(404).json({
      error: "Order not found"
    });
  }

  res.json({
    ...order,

    items: JSON.parse(
      order.items_json
    )
  });
});

/* =========================
   AI CHAT
========================= */

app.post("/api/chat", async (req, res) => {
  const message =
    String(req.body.message || "").trim();

  if (!message) {
    return res.status(400).json({
      error: "Message required"
    });
  }

  const catalog = db
    .prepare(
      `
      SELECT
        id,
        name,
        price,
        category,
        tags,
        description
      FROM products
      ORDER BY id DESC
      LIMIT 80
      `
    )
    .all();

  if (!process.env.OPENAI_API_KEY) {
    return res.json({
      reply:
        "FM FASHION AI এখন demo mode-এ আছে। Product, price বা order জানতে Shop section ব্যবহার করুন অথবা Contact with Agent চাপুন।"
    });
  }

  try {
    const response = await fetch(
      "https://api.openai.com/v1/responses",
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",

          Authorization:
            `Bearer ${process.env.OPENAI_API_KEY}`
        },

        body: JSON.stringify({
          model:
            process.env.OPENAI_MODEL ||
            "gpt-4.1-mini",

          input: [
            {
              role: "system",

              content:
                `You are the FM FASHION shopping assistant.

Use only the catalog below.

Never invent products, prices, stock,
payment information or policies.

Be concise and helpful.

Catalog:
${JSON.stringify(catalog)}`
            },

            {
              role: "user",
              content: message
            }
          ]
        })
      }
    );

    const data =
      await response.json();

    if (!response.ok) {
      throw new Error(
        data.error?.message ||
        "AI request failed"
      );
    }

    res.json({
      reply:
        data.output_text ||
        "Sorry, I couldn't answer that."
    });
  } catch (error) {
    console.error(
      "AI CHAT ERROR:",
      error
    );

    res.status(500).json({
      error: "AI service unavailable"
    });
  }
});

/* =========================
   ADMIN LOGIN
========================= */

app.post(
  "/api/admin/login",
  async (req, res) => {
    try {
      const password =
        String(req.body.password || "");

      const currentSettings =
        getSettings();

      const storedHash =
        currentSettings.admin_password_hash ||
        "";

      const envPassword =
        process.env.ADMIN_PASSWORD ||
        "";

      let valid = false;

      if (storedHash) {
        valid = await bcrypt.compare(
          password,
          storedHash
        );
      } else {
        valid =
          envPassword.length > 0 &&
          password === envPassword;

        if (valid) {
          const hash =
            await bcrypt.hash(
              password,
              12
            );

          db.prepare(
            `
            UPDATE settings
            SET value = ?
            WHERE key = ?
            `
          ).run(
            hash,
            "admin_password_hash"
          );
        }
      }

      if (!valid) {
        return res.status(401).json({
          error: "Incorrect password"
        });
      }

      const token =
        crypto.randomBytes(32)
          .toString("hex");

      const expires =
        Date.now() +
        1000 * 60 * 60 * 12;

      db.prepare(
        `
        INSERT INTO sessions(
          token,
          expires_at
        )
        VALUES (?, ?)
        `
      ).run(
        token,
        expires
      );

      res.cookie(
        "admin_session",
        token,
        {
          signed: true,
          httpOnly: true,
          sameSite: "lax",
          secure:
            process.env.NODE_ENV ===
            "production",
          maxAge:
            1000 * 60 * 60 * 12
        }
      );

      res.json({
        success: true
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        error: "Login failed"
      });
    }
  }
);

/* =========================
   ADMIN LOGOUT
========================= */

app.post(
  "/api/admin/logout",
  admin,
  (req, res) => {
    const token =
      req.signedCookies.admin_session;

    db.prepare(
      "DELETE FROM sessions WHERE token = ?"
    ).run(token);

    res.clearCookie(
      "admin_session"
    );

    res.json({
      success: true
    });
  }
);

/* =========================
   ADMIN ME
========================= */

app.get(
  "/api/admin/me",
  admin,
  (req, res) => {
    res.json({
      authenticated: true
    });
  }
);

/* =========================
   CHANGE ADMIN PASSWORD
========================= */

app.put(
  "/api/admin/password",
  admin,
  async (req, res) => {
    try {
      const currentPassword =
        String(
          req.body.current_password || ""
        );

      const newPassword =
        String(
          req.body.new_password || ""
        );

      if (newPassword.length < 6) {
        return res.status(400).json({
          error:
            "New password must be at least 6 characters"
        });
      }

      const s =
        getSettings();

      let valid = false;

      if (s.admin_password_hash) {
        valid =
          await bcrypt.compare(
            currentPassword,
            s.admin_password_hash
          );
      } else {
        valid =
          currentPassword ===
          process.env.ADMIN_PASSWORD;
      }

      if (!valid) {
        return res.status(401).json({
          error:
            "Current password is incorrect"
        });
      }

      const hash =
        await bcrypt.hash(
          newPassword,
          12
        );

      db.prepare(
        `
        INSERT INTO settings(key, value)
        VALUES (?, ?)
        ON CONFLICT(key)
        DO UPDATE SET value = excluded.value
        `
      ).run(
        "admin_password_hash",
        hash
      );

      res.json({
        success: true
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        error:
          "Password change failed"
      });
    }
  }
);

/* =========================
   ADMIN PRODUCTS
========================= */

app.get(
  "/api/admin/products",
  admin,
  (req, res) => {
    const products = db
      .prepare(
        "SELECT * FROM products ORDER BY id DESC"
      )
      .all()
      .map(publicProduct);

    res.json(products);
  }
);

/* =========================
   ADD PRODUCT
========================= */

app.post(
  "/api/admin/products",
  admin,
  upload.single("image"),
  (req, res) => {
    try {
      const {
        name,
        price,
        old_price = 0,
        category = "General",
        description = "",
        tags = "",
        featured,
        is_new,
        image_url = ""
      } = req.body;

      if (
        !String(name || "").trim()
      ) {
        return res.status(400).json({
          error:
            "Product name is required"
        });
      }

      const productPrice =
        Number(price);

      if (
        !Number.isFinite(productPrice) ||
        productPrice < 0
      ) {
        return res.status(400).json({
          error:
            "Valid product price is required"
        });
      }

      const image =
        req.file
          ? `/uploads/${req.file.filename}`
          : String(image_url || "");

      const result =
        db.prepare(
          `
          INSERT INTO products (
            name,
            description,
            price,
            old_price,
            image,
            category,
            tags,
            featured,
            is_new
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `
        ).run(
          String(name).trim(),
          String(description),
          productPrice,
          Number(old_price) || 0,
          image,
          String(category),
          String(tags),
          featured === "on" ? 1 : 0,
          is_new === "on" ? 1 : 0
        );

      res.json({
        success: true,
        id: result.lastInsertRowid
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        error:
          "Product could not be added"
      });
    }
  }
);

/* =========================
   UPDATE PRODUCT
========================= */

app.put(
  "/api/admin/products/:id",
  admin,
  upload.single("image"),
  (req, res) => {
    try {
      const id =
        Number(req.params.id);

      const product =
        db.prepare(
          "SELECT * FROM products WHERE id = ?"
        ).get(id);

      if (!product) {
        return res.status(404).json({
          error: "Product not found"
        });
      }

      const {
        name,
        price,
        old_price = 0,
        category = "General",
        description = "",
        tags = "",
        featured,
        is_new
  
