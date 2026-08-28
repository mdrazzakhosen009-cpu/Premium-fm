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
  Project structure:

  Premium-fm/
  ├── admin/
  ├── store/
  ├── server/
  │   ├── index.js
  │   └── package.json
  ├── data/
  └── uploads/
*/

const ROOT = path.join(__dirname, "..");

const DATA = path.join(ROOT, "data");
const UPLOADS = path.join(ROOT, "uploads");
const STORE_DIR = path.join(ROOT, "store");
const ADMIN_DIR = path.join(ROOT, "admin");

fs.mkdirSync(DATA, { recursive: true });
fs.mkdirSync(UPLOADS, { recursive: true });

const db = new Database(
  path.join(DATA, "fm-fashion.db")
);

db.pragma("journal_mode=WAL");

db.exec(`
CREATE TABLE IF NOT EXISTS products(
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

CREATE TABLE IF NOT EXISTS agents(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  whatsapp TEXT NOT NULL,
  messenger_url TEXT DEFAULT '',
  active INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS orders(
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
  payment_method TEXT DEFAULT 'COD',
  transaction_id TEXT DEFAULT '',
  status TEXT DEFAULT 'Pending',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS settings(
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS sessions(
  token TEXT PRIMARY KEY,
  expires_at INTEGER NOT NULL
);
`);

const defaults = {
  admin_password_hash: "",
  store_name: "FM FASHION",
  logo: "assets/logo.png",
  delivery_promise: "2–5 working days",
  payment_note: "Online payment করলে Send Money করে Transaction ID দিন।",
  bkash_number: "",
  nagad_number: "",
  rocket_number: "",
  bkash_enabled: "1",
  nagad_enabled: "1",
  rocket_enabled: "1",
  cod_enabled: "1"
};

const up = db.prepare(`
  INSERT INTO settings(key,value)
  VALUES(?,?)
  ON CONFLICT(key) DO NOTHING
`);

for (const [k, v] of Object.entries(defaults)) {
  up.run(k, v);
}

const app = express();

app.use(
  express.json({
    limit: "10mb"
  })
);

app.use(
  express.urlencoded({
    extended: true
  })
);

app.use(
  cookieParser(
    process.env.SESSION_SECRET || "change-this-secret"
  )
);

/*
  CORS
*/

app.use((req, res, next) => {
  const origin = req.headers.origin;
  const allow = process.env.ALLOW_ORIGIN || "*";

  if (
    origin &&
    (
      allow === "*" ||
      allow
        .split(",")
        .map(x => x.trim())
        .includes(origin)
    )
  ) {
    res.setHeader(
      "Access-Control-Allow-Origin",
      origin
    );

    res.setHeader(
      "Vary",
      "Origin"
    );

    res.setHeader(
      "Access-Control-Allow-Credentials",
      "true"
    );
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

/*
  File upload
*/

const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOADS,

    filename: (req, file, cb) => {
      const filename =
        Date.now() +
        "-" +
        crypto.randomBytes(4).toString("hex") +
        path.extname(file.originalname).toLowerCase();

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
      cb(new Error("Image only"));
    }
  }
});

/*
  Static files
*/

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

/*
  Admin page
*/

app.get("/admin", (req, res) => {
  const file = path.join(
    ADMIN_DIR,
    "index.html"
  );

  if (!fs.existsSync(file)) {
    return res.status(404).send("Admin panel not found");
  }

  res.sendFile(file);
});

/*
  Settings helpers
*/

const settings = () =>
  Object.fromEntries(
    db
      .prepare("SELECT key,value FROM settings")
      .all()
      .map(x => [x.key, x.value])
  );

const paymentMethods = () => {
  const s = settings();

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
};

const publicProduct = p => ({
  ...p,
  price: +p.price,
  old_price: +p.old_price,
  featured: !!p.featured,
  is_new: !!p.is_new
});

/*
  Admin authentication
*/

function admin(req, res, next) {
  const token =
    req.signedCookies.admin_session;

  if (!token) {
    return res
      .status(401)
      .json({
        error: "Admin login required"
      });
  }

  const session = db
    .prepare(
      "SELECT * FROM sessions WHERE token=? AND expires_at>?"
    )
    .get(token, Date.now());

  if (!session) {
    return res
      .status(401)
      .json({
        error: "Session expired"
      });
  }

  next();
}

/*
  Health check
*/

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    service: "FM FASHION"
  });
});

/*
  Public settings
*/

app.get("/api/settings", (req, res) => {
  res.json({
    ...settings(),
    payment_methods: paymentMethods()
  });
});

/*
  Public products
*/

app.get("/api/products", (req, res) => {
  const products = db
    .prepare(
      "SELECT * FROM products ORDER BY id DESC"
    )
    .all()
    .map(publicProduct);

  res.json(products);
});

/*
  Public agents
*/

app.get("/api/agents", (req, res) => {
  const agents = db
    .prepare(`
      SELECT id,name,messenger_url,whatsapp,active
      FROM agents
      WHERE active=1
      ORDER BY id DESC
    `)
    .all()
    .map(a => ({
      ...a,

      whatsapp_url: a.whatsapp
        ? (
            a.whatsapp.startsWith("http")
              ? a.whatsapp
              : `https://wa.me/${a.whatsapp.replace(/\D/g, "")}`
          )
        : ""
    }));

  res.json(agents);
});

/*
  Create order
*/

app.post("/api/orders", (req, res) => {
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
    !items.length
  ) {
    return res.status(400).json({
      error:
        "Name, phone, address and cart items are required"
    });
  }

  let total = 0;
  const clean = [];

  for (const i of items) {
    const p = db
      .prepare(
        "SELECT id,name,price,image FROM products WHERE id=?"
      )
      .get(Number(i.id));

    if (!p) continue;

    const qty = Math.max(
      1,
      Math.min(
        99,
        Number(i.qty) || 1
      )
    );

    clean.push({
      id: p.id,
      name: p.name,
      price: +p.price,
      qty,
      image: p.image
    });

    total += +p.price * qty;
  }

  if (!clean.length) {
    return res.status(400).json({
      error: "No valid products"
    });
  }

  const result = db
    .prepare(`
      INSERT INTO orders(
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
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?)
    `)
    .run(
      customer_name.trim(),
      phone.trim(),
      email.trim(),
      division,
      district,
      upazila,
      address.trim(),
      note.trim(),
      JSON.stringify(clean),
      total,
      payment_method,
      String(transaction_id).trim()
    );

  res.status(201).json({
    success: true,
    orderId:
      `FMF-${String(result.lastInsertRowid).padStart(6, "0")}`,
    total
  });
});

/*
  Track order
*/

app.get("/api/orders/track", (req, res) => {
  const phone =
    String(req.query.phone || "").trim();

  const id =
    String(req.query.id || "")
      .replace(/\D/g, "");

  if (!phone || !id) {
    return res.status(400).json({
      error: "Order ID and phone required"
    });
  }

  const order = db
    .prepare(
      "SELECT * FROM orders WHERE id=? AND phone=?"
    )
    .get(Number(id), phone);

  if (!order) {
    return res.status(404).json({
      error: "Order not found"
    });
  }

  res.json({
    ...order,
    items: JSON.parse(order.items_json)
  });
});

/*
  AI chat
*/

app.post("/api/chat", async (req, res) => {
  const message =
    String(req.body.message || "").trim();

  if (!message) {
    return res.status(400).json({
      error: "Message required"
    });
  }

  const catalog = db
    .prepare(`
      SELECT id,name,price,category,tags,description
      FROM products
      ORDER BY id DESC
      LIMIT 80
    `)
    .all();

  if (!process.env.OPENAI_API_KEY) {
    return res.json({
      reply:
        "AI assistant এখন demo mode-এ আছে। Product, price বা order জানতে চাইলে Shop section ব্যবহার করুন অথবা Contact with Agent চাপুন।"
    });
  }

  try {
    const response = await fetch(
      "https://api.openai.com/v1/responses",
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          "Authorization":
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
                `You are FM FASHION's shopping assistant. Use only this catalog. Never invent price, stock, policy or contact details. Be concise and helpful. Catalog: ${JSON.stringify(catalog)}`
            },

            {
              role: "user",
              content: message
            }
          ]
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.error?.message ||
        "AI failed"
      );
    }

    res.json({
      reply:
        data.output_text ||
        "Sorry, I couldn't answer."
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "AI service unavailable"
    });
  }
});

/*
  Admin login
*/

app.post(
  "/api/admin/login",
  async (req, res) => {
    const password =
      String(req.body.password || "");

    const stored =
      settings().admin_password_hash || "";

    const configured =
      process.env.ADMIN_PASSWORD || "";

    let ok = false;

    if (stored) {
      ok = await bcrypt.compare(
        password,
        stored
      );
    } else {
      ok =
        !!configured &&
        password === configured;

      if (ok) {
        const hash =
          await bcrypt.hash(
            password,
            12
          );

        db
          .prepare(
            "UPDATE settings SET value=? WHERE key=?"
          )
          .run(
            hash,
            "admin_password_hash"
          );
      }
    }

    if (!ok) {
      return res.status(401).json({
        error: "Incorrect password"
      });
    }

    const token =
      crypto.randomBytes(32).toString("hex");

    db
      .prepare(
        "INSERT INTO sessions(token,expires_at) VALUES(?,?)"
      )
      .run(
        token,
        Date.now() +
          1000 * 60 * 60 * 12
      );

    res.cookie(
      "admin_session",
      token,
      {
        signed: true,
        httpOnly: true,
        sameSite: "none",
        secure: true,
        maxAge:
          1000 * 60 * 60 * 12
      }
    );

    res.json({
      success: true
    });
  }
);

/*
  Admin logout
*/

app.post(
  "/api/admin/logout",
  admin,
  (req, res) => {
    db
      .prepare(
        "DELETE FROM sessions WHERE token=?"
      )
      .run(
        req.signedCookies.admin_session
      );

    res.clearCookie(
      "admin_session"
    );

    res.json({
      success: true
    });
  }
);

/*
  Admin session check
*/

app.get(
  "/api/admin/me",
  admin,
  (req, res) => {
    res.json({
      authenticated: true
    });
  }
);

/*
  Change admin password
*/

app.put(
  "/api/admin/password",
  admin,
  async (req, res) => {
    const current =
      String(
        req.body.current_password || ""
      );

    const next =
      String(
        req.body.new_password || ""
      );

    if (next.length < 6) {
      return res.status(400).json({
        error:
          "New password must be at least 6 characters"
      });
    }

    const s = settings();

    let ok = false;

    if (s.admin_password_hash) {
      ok = await bcrypt.compare(
        current,
        s.admin_password_hash
      );
    } else {
      ok =
        !!process.env.ADMIN_PASSWORD &&
        current ===
          process.env.ADMIN_PASSWORD;
    }

    if (!ok) {
      return res.status(401).json({
        error:
          "Current password is incorrect"
      });
    }

    const hash =
      await bcrypt.hash(
        next,
        12
      );

    db
      .prepare(`
        INSERT INTO settings(key,value)
        VALUES(?,?)
        ON CONFLICT(key)
        DO UPDATE SET value=excluded.value
      `)
      .run(
        "admin_password_hash",
        hash
      );

    res.json({
      success: true
    });
  }
);

/*
  Admin products
*/

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

/*
  Add product
*/

app.post(
  "/api/admin/products",
  admin,
  upload.single("image"),
  (req, res) => {
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

    const image = req.file
      ? `/uploads/${req.file.filename}`
      : String(image_url || "");

    if (
      !String(name || "").trim() ||
      !Number.isFinite(+price) ||
      +price < 0
    ) {
      return res.status(400).json({
        error:
          "Product name and valid price are required"
      });
    }

    const result = db
      .prepare(`
        INSERT INTO products(
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
        VALUES(?,?,?,?,?,?,?,?,?)
      `)
      .run(
        String(name).trim(),
        description,
        +price,
        +old_price,
        image,
        category,
        tags,
        featured === "on" ? 1 : 0,
        is_new === "on" ? 1 : 0
      );

    res.json({
      success: true,
      id: result.lastInsertRowid
    });
  }
);

/*
  Update product
*/

app.put(
  "/api/admin/products/:id",
  admin,
  upload.single("image"),
  (req, res) => {
    const product = db
      .prepare(
        "SELECT * FROM products WHERE id=?"
      )
      .get(
        Number(req.params.id)
      );

    if (!product) {
      return res.status(404).json({
        error: "Not found"
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
    } = req.body;

    const image = req.file
      ? `/uploads/${req.file.filename}`
      : product.image;

    db
      .prepare(`
        UPDATE products
        SET
          name=?,
          price=?,
          old_price=?,
          image=?,
          category=?,
          description=?,
          tags=?,
          featured=?,
          is_new=?
        WHERE id=?
      `)
      .run(
        name,
        +price,
        +old_price,
        image,
        category,
        description,
        tags,
        featured === "on" ? 1 : 0,
        is_new === "on" ? 1 : 0,
        product.id
      );

    res.json({
      success: true
    });
  }
);

/*
  Delete product
*/

app.delete(
  "/api/admin/products/:id",
  admin,
  (req, res) => {
    db
      .prepare(
        "DELETE FROM products WHERE id=?"
      )
      .run(
        Number(req.params.id)
      );

    res.json({
      success: true
    });
  }
);

/*
  Admin orders
*/

app.get(
  "/api/admin/orders",
  admin,
  (req, res) => {
    const orders = db
      .prepare(
        "SELECT * FROM orders ORDER BY id DESC"
      )
      .all()
      .map(order => ({
        ...order,
        items: JSON.parse(
          order.items_json
        )
      }));

    res.json(orders);
  }
);

/*
  Update order status
*/

app.patch(
  "/api/admin/orders/:id",
  admin,
  (req, res) => {
    const allowed = [
      "Pending",
      "Confirmed",
      "Processing",
      "Shipped",
      "Delivered",
      "Cancelled"
    ];

    const status =
      String(req.body.status);

    if (!allowed.includes(status)) {
      return res.status(400).json({
        error: "Invalid status"
      });
    }

    db
      .prepare(
        "UPDATE orders SET status=? WHERE id=?"
      )
      .run(
        status,
        Number(req.params.id)
      );

    res.json({
      success: true
    });
  }
);

/*
  Admin agents
*/

app.get(
  "/api/admin/agents",
  admin,
  (req, res) => {
    res.json(
      db
        .prepare(
          "SELECT * FROM agents ORDER BY id DESC"
        )
        .all()
    );
  }
);

/*
  Add agent
*/

app.post(
  "/api/admin/agents",
  admin,
  (req, res) => {
    const {
      name,
      whatsapp,
      messenger_url = "",
      active = "on"
    } = req.body;

    const result = db
      .prepare(`
        INSERT INTO agents(
          name,
          whatsapp,
          messenger_url,
          active
        )
        VALUES(?,?,?,?)
      `)
      .run(
        name,
        whatsapp,
        messenger_url,
        active === "on" ? 1 : 0
      );

    res.json({
      success: true,
      id: result.lastInsertRowid
    });
  }
);

/*
  Update agent
*/

app.put(
  "/api/admin/agents/:id",
  admin,
  (req, res) => {
    const {
      name,
      whatsapp,
      messenger_url = "",
      active
    } = req.body;

    db
      .prepare(`
        UPDATE agents
        SET
          name=?,
          whatsapp=?,
          messenger_url=?,
          active=?
        WHERE id=?
      `)
      .run(
        name,
        whatsapp,
        messenger_url,
        active === "on" ? 1 : 0,
        Number(req.params.id)
      );

    res.json({
      success: true
    });
  }
);

/*
  Delete agent
*/

app.delete(
  "/api/admin/agents/:id",
  admin,
  (req, res) => {
    db
      .prepare(
        "DELETE FROM agents WHERE id=?"
      )
      .run(
        Number(req.params.id)
      );

    res.json({
      success: true
    });
  }
);

/*
  Admin settings
*/

app.get(
  "/api/admin/settings",
  admin,
  (req, res) => {
    res
