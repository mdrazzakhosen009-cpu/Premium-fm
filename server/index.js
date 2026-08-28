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
  Repository structure:

  FM repository
  ├── server
  │   ├── index.js
  │   └── package.json
  │
  ├── admin
  │   ├── index.html
  │   ├── app.js
  │   ├── config.js
  │   └── style.css
  │
  └── store
      ├── index.html
      ├── app.js
      └── style.css

  Render Root Directory:
  server
*/

const ROOT = path.join(__dirname, "..");

const DATA = path.join(ROOT, "data");
const UPLOADS = path.join(ROOT, "uploads");

const STORE_DIR = path.join(ROOT, "store");
const ADMIN_DIR = path.join(ROOT, "admin");

fs.mkdirSync(DATA, { recursive: true });
fs.mkdirSync(UPLOADS, { recursive: true });

/* =========================
   DATABASE
========================= */

const db = new Database(
  path.join(DATA, "fm-fashion.db")
);

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
   EXPRESS
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
    process.env.SESSION_SECRET ||
      "fm-fashion-development-secret"
  )
);

/* =========================
   CORS
========================= */

app.use((req, res, next) => {
  const origin = req.headers.origin;

  const allowOrigin =
    process.env.ALLOW_ORIGIN || "*";

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

    res.setHeader(
      "Vary",
      "Origin"
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

/* =========================
   FILE UPLOAD
========================= */

const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOADS,

    filename: (req, file, cb) => {
      const extension =
        path.extname(
          file.originalname
        ).toLowerCase();

      const filename =
        Date.now() +
        "-" +
        crypto
          .randomBytes(5)
          .toString("hex") +
        extension;

      cb(null, filename);
    }
  }),

  limits: {
    fileSize:
      8 * 1024 * 1024
  },

  fileFilter: (req, file, cb) => {
    const allowed = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif"
    ];

    if (
      allowed.includes(
        file.mimetype
      )
    ) {
      cb(null, true);
    } else {
      cb(
        new Error(
          "Only image files are allowed"
        )
      );
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
      .prepare(
        "SELECT key, value FROM settings"
      )
      .all()
      .map((row) => [
        row.key,
        row.value
      ])
  );
}

function getPaymentMethods() {
  const s = getSettings();

  return {
    bKash: {
      enabled:
        s.bkash_enabled === "1",
      number:
        s.bkash_number || ""
    },

    Nagad: {
      enabled:
        s.nagad_enabled === "1",
      number:
        s.nagad_number || ""
    },

    Rocket: {
      enabled:
        s.rocket_enabled === "1",
      number:
        s.rocket_number || ""
    },

    "Cash on Delivery": {
      enabled:
        s.cod_enabled === "1",
      number: ""
    }
  };
}

function publicProduct(product) {
  return {
    ...product,

    price: Number(
      product.price || 0
    ),

    old_price: Number(
      product.old_price || 0
    ),

    featured:
      Boolean(product.featured),

    is_new:
      Boolean(product.is_new)
  };
}

function parseBoolean(value) {
  return (
    value === true ||
    value === "true" ||
    value === "1" ||
    value === 1 ||
    value === "on"
  )
    ? 1
    : 0;
}

/* =========================
   ADMIN AUTH
========================= */

function admin(req, res, next) {
  const token =
    req.signedCookies
      .admin_session;

  if (!token) {
    return res.status(401).json({
      error:
        "Admin login required"
    });
  }

  const session =
    db
      .prepare(
        `
        SELECT *
        FROM sessions
        WHERE token = ?
        AND expires_at > ?
        `
      )
      .get(
        token,
        Date.now()
      );

  if (!session) {
    return res.status(401).json({
      error:
        "Session expired"
    });
  }

  next();
}

/* =========================
   HEALTH
========================= */

app.get(
  "/api/health",
  (req, res) => {
    res.json({
      success: true,
      service: "FM FASHION",
      status: "online"
    });
  }
);

/* =========================
   PUBLIC SETTINGS
========================= */

app.get(
  "/api/settings",
  (req, res) => {
    res.json({
      ...getSettings(),
      payment_methods:
        getPaymentMethods()
    });
  }
);

/* =========================
   PUBLIC PRODUCTS
========================= */

app.get(
  "/api/products",
  (req, res) => {
    const products =
      db
        .prepare(
          `
          SELECT *
          FROM products
          ORDER BY id DESC
          `
        )
        .all()
        .map(publicProduct);

    res.json(products);
  }
);

/* =========================
   PUBLIC AGENTS
========================= */

app.get(
  "/api/agents",
  (req, res) => {
    const agents =
      db
        .prepare(
          `
          SELECT
            id,
            name,
            messenger_url,
            whatsapp,
            active
          FROM agents
          WHERE active = 1
          ORDER BY id DESC
          `
        )
        .all();

    res.json(
      agents.map((agent) => ({
        ...agent,

        whatsapp_url:
          agent.whatsapp
            ? (
                agent.whatsapp
                  .startsWith("http")
                  ? agent.whatsapp
                  : `https://wa.me/${agent.whatsapp.replace(/\D/g, "")}`
              )
            : ""
      }))
    );
  }
);

/* =========================
   CREATE ORDER
========================= */

app.post(
  "/api/orders",
  (req, res) => {
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
        payment_method =
          "Cash on Delivery",
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
        const product =
          db
            .prepare(
              `
              SELECT
                id,
                name,
                price,
                image
              FROM products
              WHERE id = ?
              `
            )
            .get(
              Number(item.id)
            );

        if (!product) {
          continue;
        }

        const quantity =
          Math.max(
            1,
            Math.min(
              99,
              Number(item.qty) || 1
            )
          );

        cleanItems.push({
          id: product.id,
          name: product.name,
          price:
            Number(product.price),
          qty: quantity,
          image: product.image
        });

        total +=
          Number(product.price) *
          quantity;
      }

      if (
        cleanItems.length === 0
      ) {
        return res.status(400).json({
          error:
            "No valid products"
        });
      }

      const result =
        db
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
            String(
              customer_name
            ).trim(),

            String(
              phone
            ).trim(),

            String(
              email
            ).trim(),

            String(
              division
            ),

            String(
              district
            ),

            String(
              upazila
            ),

            String(
              address
            ).trim(),

            String(
              note
            ).trim(),

            JSON.stringify(
              cleanItems
            ),

            total,

            String(
              payment_method
            ),

            String(
              transaction_id
            ).trim()
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
      console.error(
        "CREATE ORDER ERROR:",
        error
      );

      res.status(500).json({
        error:
          "Unable to create order"
      });
    }
  }
);

/* =========================
   TRACK ORDER
========================= */

app.get(
  "/api/orders/track",
  (req, res) => {
    const phone =
      String(
        req.query.phone || ""
      ).trim();

    const id =
      String(
        req.query.id || ""
      ).replace(/\D/g, "");

    if (!phone || !id) {
      return res.status(400).json({
        error:
          "Order ID and phone required"
      });
    }

    const order =
      db
        .prepare(
          `
          SELECT *
          FROM orders
          WHERE id = ?
          AND phone = ?
          `
        )
        .get(
          Number(id),
          phone
        );

    if (!order) {
      return res.status(404).json({
        error:
          "Order not found"
      });
    }

    let items = [];

    try {
      items =
        JSON.parse(
          order.items_json
        );
    } catch (e) {}

    res.json({
      ...order,
      items
    });
  }
);

/* =========================
   AI CHAT
========================= */

app.post(
  "/api/chat",
  async (req, res) => {
    const message =
      String(
        req.body.message || ""
      ).trim();

    if (!message) {
      return res.status(400).json({
        error:
          "Message required"
      });
    }

    const catalog =
      db
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

    if (
      !process.env.OPENAI_API_KEY
    ) {
      return res.json({
        reply:
          "FM FASHION AI এখন demo mode-এ আছে। Product, price বা order জানতে Shop section ব্যবহার করুন অথবা Contact with Agent চাপুন।"
      });
    }

    try {
      const response =
        await fetch(
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
                  role:
                    "system",

                  content:
                    `You are the FM FASHION shopping assistant.

Use only the catalog below.

Never invent products, prices, stock, payment information or policies.

Be concise and helpful.

Catalog:
${JSON.stringify(
  catalog
)}`
                },

                {
                  role:
                    "user",

                  content:
                    message
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
        error:
          "AI service unavailable"
      });
    }
  }
);

/* =========================================================
   ADMIN LOGIN
========================================================= */

app.post(
  "/api/admin/login",
  async (req, res) => {
    try {
      const password =
        String(
          req.body.password || ""
        );

      if (!password) {
        return res.status(400).json({
          error:
            "Password required"
        });
      }

      const settings =
        getSettings();

      const storedHash =
        settings.admin_password_hash ||
        "";

      const envPassword =
        process.env.ADMIN_PASSWORD ||
        "";

      let valid = false;

      /*
        If database already has a password hash,
        use that password.
      */

      if (storedHash) {
        valid =
          await bcrypt.compare(
            password,
            storedHash
          );
      }

      /*
        First login:
        If there is no hash, use Render ADMIN_PASSWORD.
      */

      else {
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
          error:
            "Incorrect password"
        });
      }

      /*
        Remove expired sessions
      */

      db.prepare(
        `
        DELETE FROM sessions
        WHERE expires_at <= ?
        `
      ).run(Date.now());

      const token =
        crypto
          .randomBytes(32)
          .toString("hex");

      const expires =
        Date.now() +
        1000 *
          60 *
          60 *
          12;

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
            1000 *
            60 *
            60 *
            12,

          path: "/"
        }
      );

      res.json({
        success: true
      });

    } catch (error) {
      console.error(
        "LOGIN ERROR:",
        error
      );

      res.status(500).json({
        error:
          "Login failed"
      });
    }
  }
);

/* =========================================================
   ADMIN LOGOUT
========================================================= */

app.post(
  "/api/admin/logout",
  admin,
  (req, res) => {
    try {
      const token =
        req.signedCookies
          .admin_session;

      if (token) {
        db.prepare(
          `
          DELETE FROM sessions
          WHERE token = ?
          `
        ).run(token);
      }

      res.clearCookie(
        "admin_session",
        {
          path: "/"
        }
      );

      res.json({
        success: true
      });

    } catch (error) {
      console.error(error);

      res.status(500).json({
        error:
          "Logout failed"
      });
    }
  }
);

/* =========================================================
   ADMIN ME
========================================================= */

app.get(
  "/api/admin/me",
  admin,
  (req, res) => {
    res.json({
      authenticated: true
    });
  }
);

/* =========================================================
   ADMIN DASHBOARD
========================================================= */

app.get(
  "/api/admin/dashboard",
  admin,
  (req, res) => {
    try {
      const products =
        db
          .prepare(
            "SELECT COUNT(*) AS count FROM products"
          )
          .get()
          .count;

      const orders =
        db
          .prepare(
            "SELECT COUNT(*) AS count FROM orders"
          )
          .get()
          .count;

      const agents =
        db
          .prepare(
            "SELECT COUNT(*) AS count FROM agents"
          )
          .get()
          .count;

      const revenue =
        db
          .prepare(
            `
            SELECT COALESCE(
              SUM(total),
              0
            ) AS revenue
            FROM orders
            WHERE status != 'Cancelled'
            `
          )
          .get()
          .revenue;

      res.json({
        products:
          Number(products || 0),

        orders:
          Number(orders || 0),

        agents:
          Number(agents || 0),

        revenue:
          Number(revenue || 0)
      });

    } catch (error) {
      console.error(
        "DASHBOARD ERROR:",
        error
      );

      res.status(500).json({
        error:
          "Dashboard unavailable"
      });
    }
  }
);

/* =========================================================
   ADMIN PASSWORD CHANGE
========================================================= */

app.put(
  "/api/admin/password",
  admin,
  async (req, res) => {
    try {
      const currentPassword =
        String(
          req.body.current_password ||
            ""
        );

      const newPassword =
        String(
          req.body.new_password ||
            ""
        );

      if (
        newPassword.length < 6
      ) {
        return res.status(400).json({
          error:
            "New password must be at least 6 characters"
        });
      }

      const settings =
        getSettings();

      let valid = false;

      if (
        settings.admin_password_hash
      ) {
        valid =
          await bcrypt.compare(
            currentPassword,
            settings.admin_password_hash
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
        INSERT INTO settings(
          key,
          value
        )
        VALUES (?, ?)
        ON CONFLICT(key)
        DO UPDATE SET
          value = excluded.value
        `
      ).run(
        "admin_password_hash",
        hash
      );

      /*
        Logout all previous sessions
        after password change.
      */

      db.prepare(
        "DELETE FROM sessions"
      ).run();

      res.clearCookie(
        "admin_session",
        {
          path: "/"
        }
      );

      res.json({
        success: true
      });

    } catch (error) {
      console.error(
        "PASSWORD ERROR:",
        error
      );

      res.status(500).json({
        error:
          "Password change failed"
      });
    }
  }
);

/* =========================================================
   ADMIN PRODUCTS - GET
========================================================= */

app.get(
  "/api/admin/products",
  admin,
  (req, res) => {
    try {
      const products =
        db
          .prepare(
            `
            SELECT *
            FROM products
            ORDER BY id DESC
            `
          )
          .all()
          .map(publicProduct);

      res.json(products);

    } catch (error) {
      console.error(error);

      res.status(500).json({
        error:
          "Unable to load products"
      });
    }
  }
);

/* =========================================================
   ADMIN PRODUCTS - CREATE
========================================================= */

app.post(
  "/api/admin/products",
  admin,
  upload.single("image"),
  (req, res) => {
    try {
      const name =
        String(
          req.body.name || ""
        ).trim();

      const description =
        String(
          req.body.description ||
            ""
        ).trim();

      const price =
        Number(
          req.body.price
        );

      const oldPrice =
        Number(
          req.body.old_price || 0
        );

      const category =
        String(
          req.body.category ||
            "General"
        ).trim();

      const tags =
        String(
          req.body.tags || ""
        ).trim();

      const featured =
        parseBoolean(
          req.body.featured
        );

      const isNew =
        parseBoolean(
          req.body.is_new
        );

      if (!name) {
        return res.status(400).json({
          error:
            "Product name required"
        });
      }

      if (
        !Number.isFinite(price) ||
        price <= 0
      ) {
        return res.status(400).json({
          error:
            "Valid price required"
        });
      }

      let image = "";

      if (req.file) {
        image =
          `/uploads/${req.file.filename}`;
      } else if (
        req.body.image_url
      ) {
        image =
          String(
            req.body.image_url
          ).trim();
      }

      const result =
        db
          .prepare(
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
          )
          .run(
            name,
            description,
            price,
            oldPrice,
            image,
            category,
            tags,
            featured,
            isNew
          );

      const product =
        db
          .prepare(
            `
            SELECT *
            FROM products
            WHERE id = ?
            `
          )
          .get(
            result.lastInsertRowid
          );

      res.status(201).json(
        publicProduct(product)
      );

    } catch (error) {
      console.error(
        "ADD PRODUCT ERROR:",
        error
      );

      res.status(500).json({
        error:
          "Unable to add product"
      });
    }
  }
);

/* =========================================================
   ADMIN PRODUCTS - UPDATE
========================================================= */

app.put(
  "/api/admin/products/:id",
  admin,
  upload.single("image"),
  (req, res) => {
    try {
      const id =
        Number(req.params.id);

      const existing =
        db
          .prepare(
            `
            SELECT *
            FROM products
            WHERE id = ?
            `
          )
          .get(id);

      if (!existing) {
        return res.status(404).json({
          error:
            "Product not found"
        });
      }

      const name =
        String(
          req.body.name ??
            existing.name
        ).trim();

      const description =
        String(
          req.body.description ??
            existing.description
        ).trim();

      const price =
        Number(
          req.body.price ??
            existing.price
        );

      const oldPrice =
        Number(
          req.body.old_price ??
            existing.old_price
        );

      const category =
        String(
          req.body.category ??
            existing.category
        ).trim();

      const tags =
        String(
          req.body.tags ??
            existing.tags
        ).trim();

      const featured =
        req.body.featured !==
        undefined
          ? parseBoolean(
              req.body.featured
            )
          : existing.featured;

      const isNew =
        req.body.is_new !==
        undefined
          ? parseBoolean(
              req.body.is_new
            )
          : existing.is_new;

      let image =
        existing.image || "";

      if (req.file) {
        image =
          `/uploads/${req.file.filename}`;
      } else if (
        req.body.image_url
      ) {
        image =
          String(
            req.body.image_url
          ).trim();
      }

      if (!name) {
        return res.status(400).json({
          error:
            "Product name required"
        });
      }

      if (
        !Number.isFinite(price) ||
        price <= 0
      ) {
        return res.status(400).json({
          error:
            "Valid price required"
        });
      }

      db.prepare(
        `
        UPDATE products
        SET
          name = ?,
          description = ?,
          price = ?,
          old_price = ?,
          image = ?,
          category = ?,
          tags = ?,
          featured = ?,
          is_new = ?
        WHERE id = ?
        `
      ).run(
        name,
        description,
        price,
        oldPrice,
        image,
        category,
        tags,
        featured,
        isNew,
        id
      );

      const product =
        db
          .prepare(
            `
            SELECT *
            FROM products
            WHERE id = ?
            `
          )
          .get(id);

      res.json(
        publicProduct(product)
      );

    } catch (error) {
      console.error(
        "UPDATE PRODUCT ERROR:",
        error
      );

      res.status(500).json({
        error:
          "Unable to update product"
      });
    }
  }
);

/* =========================================================
   ADMIN PRODUCTS - DELETE
========================================================= */

app.delete(
  "/api/admin/products/:id",
  admin,
  (req, res) => {
    try {
      const id =
        Number(req.params.id);

      const product =
        db
          .prepare(
            `
            SELECT *
            FROM products
            WHERE id = ?
            `
          )
          .get(id);

      if (!product) {
        return res.status(404).json({
          error:
            "Product not found"
        });
      }

      /*
        Delete uploaded image
        if it belongs to our uploads folder.
      */

      if (
        product.image &&
        product.image.startsWith(
          "/uploads/"
        )
      ) {
        const filename =
          path.basename(
            product.image
          );

        const filePath =
          path.join(
            UPLOADS,
            filename
          );

        if (
          fs.existsSync(filePath)
        ) {
          fs.unlinkSync(filePath);
        }
      }

      db.prepare(
        `
        DELETE FROM products
        WHERE id = ?
        `
      ).run(id);

      res.json({
        success: true
      });

    } catch (error) {
      console.error(
        "DELETE PRODUCT ERROR:",
        error
      );

      res.status(500).json({
        error:
          "Unable to delete product"
      });
    }
  }
);

/* =========================================================
   ADMIN ORDERS - GET
========================================================= */

app.get(
  "/api/admin/orders",
  admin,
  (req, res) => {
    try {
      const orders =
        db
          .prepare(
            `
            SELECT *
            FROM orders
            ORDER BY id DESC
            `
          )
          .all();

      res.json(
        orders.map((order) => ({
          ...order,

          total:
            Number(
              order.total || 0
            ),

          items:
            (() => {
              try {
                return JSON.parse(
                  order.items_json
                );
              } catch (e) {
                return [];
              }
            })()
        }))
      );

    } catch (error) {
      console.error(
        "ORDERS ERROR:",
        error
      );

      res.status(500).json({
        error:
          "Unable to load orders"
      });
    }
  }
);

/* =========================================================
   ADMIN ORDER STATUS
========================================================= */

app.patch(
  "/api/admin/orders/:id",
  admin,
  (req, res) => {
    try {
      const id =
        Number(req.params.id);

      const status =
        String(
          req.body.status || ""
        ).trim();

      const allowedStatuses = [
        "Pending",
        "Confirmed",
        "Processing",
        "Shipped",
        "Delivered",
        "Cancelled"
      ];

      if (
        !allowedStatuses.includes(
          status
        )
      ) {
        return res.status(400).json({
          error:
            "Invalid order status"
        });
      }

      const result =
        db
          .prepare(
            `
            UPDATE orders
            SET status = ?
            WHERE id = ?
            `
          )
          .run(
            status,
            id
          );

      if (
        result.changes === 0
      ) {
        return res.status(404).json({
          error:
            "Order not found"
        });
      }

      res.json({
        success: true,
        status
      });

    } catch (error) {
      console.error(
        "ORDER STATUS ERROR:",
        error
      );

      res.status(500).json({
        error:
          "Unable to update order"
      });
    }
  }
);

/* =========================================================
   ADMIN AGENTS - GET
========================================================= */

app.get(
  "/api/admin/agents",
  admin,
  (req, res) => {
    try {
      const agents =
        db
          .prepare(
            `
            SELECT *
            FROM agents
            ORDER BY id DESC
            `
          )
          .all();

      res.json(agents);

    } catch (error) {
      console.error(error);

      res.status(500).json({
        error:
          "Unable to load agents"
      });
    }
  }
);

/* =========================================================
   ADMIN AGENTS - CREATE
========================================================= */

app.post(
  "/api/admin/agents",
  admin,
  (req, res) => {
    try {
      const name =
        String(
          req.body.name || ""
        ).trim();

      const whatsapp =
        String(
          req.body.whatsapp || ""
        ).trim();

      const messenger_url =
        String(
          req.body.messenger_url ||
            ""
        ).trim();

      const active =
        parseBoolean(
          req.body.active
        );

      if (!name) {
        return res.status(400).json({
          error:
            "Agent name required"
        });
      }

      if (!whatsapp) {
        return res.status(400).json({
          error:
            "WhatsApp number required"
        });
      }

      const result =
        db
          .prepare(
            `
            INSERT INTO agents (
              name,
              whatsapp,
              messenger_url,
              active
            )
            VALUES (?, ?, ?, ?)
            `
          )
          .run(
            name,
            whatsapp,
            messenger_url,
            active
          );

      const agent =
        db
          .prepare(
            `
            SELECT *
            FROM agents
            WHERE id = ?
            `
          )
          .get(
            result.lastInsertRowid
          );

      res.status(201).json(
        agent
      );

    } catch (error) {
      console.error(
        "ADD AGENT ERROR:",
        error
      );

      res.status(500).json({
        error:
          "Unable to add agent"
      });
    }
  }
);

/* =========================================================
   ADMIN AGENTS - UPDATE
========================================================= */

app.put(
  "/api/admin/agents/:id",
  admin,
  (req, res) => {
    try {
      const id =
        Number(req.params.id);

      const existing =
        db
          .prepare(
            `
            SELECT *
            FROM agents
            WHERE id = ?
            `
          )
          .get(id);

      if (!existing) {
        return res.status(404).json({
          error:
            "Agent not found"
        });
      }

      const name =
        String(
          req.body.name ??
            existing.name
        ).trim();

      const whatsapp =
        String(
          req.body.whatsapp ??
            existing.whatsapp
        ).trim();

      const messenger_url =
        String(
          req.body.messenger_url ??
            existing.messenger_url
        ).trim();

      const active =
        req.body.active !==
        undefined
          ? parseBoolean(
              req.body.active
            )
          : existing.active;

      if (!name) {
        return res.status(400).json({
          error:
            "Agent name required"
        });
      }

      if (!whatsapp) {
        return res.status(400).json({
          error:
            "WhatsApp number required"
        });
      }

      db.prepare(
        `
        UPDATE agents
        SET
          name = ?,
          whatsapp = ?,
          messenger_url = ?,
          active = ?
        WHERE id = ?
        `
      ).run(
        name,
        whatsapp,
        messenger_url,
        active,
        id
      );

      const agent =
        db
          .prepare(
            `
            SELECT *
            FROM agents
            WHERE id = ?
            `
          )
          .get(id);

      res.json(agent);

    } catch (error) {
      console.error(
        "UPDATE AGENT ERROR:",
        error
      );

      res.status(500).json({
        error:
          "Unable to update agent"
      });
    }
  }
);

/* =========================================================
   ADMIN AGENTS - DELETE
========================================================= */

app.delete(
  "/api/admin/agents/:id",
  admin,
  (req, res) => {
    try {
      const id =
        Number(req.params.id);

      const result =
        db
          .prepare(
            `
            DELETE FROM agents
            WHERE id = ?
            `
          )
          .run(id);

      if (
        result.changes === 0
      ) {
        return res.status(404).json({
          error:
            "Agent not found"
        });
      }

      res.json({
        success: true
      });

    } catch (error) {
      console.error(
        "DELETE AGENT ERROR:",
        error
      );

      res.status(500).json({
        error:
          "Unable to delete agent"
      });
    }
  }
);

/* =========================================================
   ADMIN SETTINGS - GET
========================================================= */

app.get(
  "/api/admin/settings",
  admin,
  (req, res) => {
    try {
      res.json(
        getSettings()
      );
    } catch (error) {
      console.error(error);

      res.status(500).json({
        error:
          "Unable to load settings"
      });
    }
  }
);

/* =========================================================
   ADMIN SETTINGS - UPDATE
========================================================= */

app.put(
  "/api/admin/settings",
  admin,
  (req, res) => {
    try {
      const data =
        req.body || {};

      const allowedKeys = [
        "store_name",
        "logo",
        "delivery_promise",
        "payment_note",

        "bkash_number",
        "nagad_number",
        "rocket_number",

        "bkash_enabled",
        "nagad_enabled",
        "rocket_enabled",
        "cod_enabled"
      ];

      const update =
        db.prepare(
          `
          INSERT INTO settings(
            key,
            value
          )
          VALUES (?, ?)
          ON CONFLICT(key)
          DO UPDATE SET
            value = excluded.value
          `
        );

      const transaction =
        db.transaction(() => {
          for (
            const key of allowedKeys
          ) {
            if (
              Object.prototype.hasOwnProperty.call(
                data,
                key
              )
            ) {
              let value =
                data[key];

              if (
                [
                  "bkash_enabled",
                  "nagad_enabled",
                  "rocket_enabled",
                  "cod_enabled"
                ].includes(key)
              ) {
                value =
                  value === true ||
                  value === "true" ||
                  value === "1"
                    ? "1"
                    : "0";
              } else {
                value =
                  String(
                    value ?? ""
                  );
              }

              update.run(
                key,
                value
              );
            }
          }
        });

      transaction();

      res.json({
        success: true,
        settings:
          getSettings()
      });

    } catch (error) {
      console.error(
        "SETTINGS ERROR:",
        error
      );

      res.status(500).json({
        error:
          "Unable to save settings"
      });
    }
  }
);

/* =========================================================
   ADMIN AI PRODUCT
========================================================= */

app.post(
  "/api/admin/ai-product",
  admin,
  upload.single("image"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          error:
            "Image required"
        });
      }

      const price =
        Number(
          req.body.price
        );

      if (
        !Number.isFinite(price) ||
        price <= 0
      ) {
        return res.status(400).json({
          error:
            "Price required"
        });
      }

      let suggestion = {
        name:
          "Premium Fashion Product",

        description:
          "Premium quality fashion product from FM FASHION.",

        category:
          "Fashion",

        tags:
          "fashion,premium,new"
      };

      /*
        AI is optional.
        Without OPENAI_API_KEY,
        the product still gets a preview.
      */

      if (
        process.env.OPENAI_API_KEY
      ) {
        try {
          const base64 =
            fs
              .readFileSync(
                req.file.path
              )
              .toString("base64");

          const response =
            await fetch(
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
                    process.env.OPENAI_VISION_MODEL ||
                    "gpt-4.1-mini",

                  input: [
                    {
                      role:
                        "user",

                      content: [
                        {
                          type:
                            "input_text",

                          text:
                            "Identify this fashion product. Return ONLY valid JSON with these keys: name, description, category, tags."
                        },

                        {
                          type:
                            "input_image",

                          image_url:
                            `data:${req.file.mimetype};base64,${base64}`
                        }
                      ]
                    }
                  ]
                })
              }
            );

          const result =
            await response.json();

          if (
            response.ok &&
            result.output_text
          ) {
            try {
              const parsed =
                JSON.parse(
                  result.output_text
                );

              if (
                parsed &&
                typeof parsed ===
                  "object"
              ) {
                suggestion = {
                  ...suggestion,
                  ...parsed
                };
              }
            } catch (error) {
              console.error(
                "AI JSON PARSE ERROR:",
                error
              );
            }
          }

        } catch (error) {
          console.error(
            "AI PRODUCT ERROR:",
            error
          );
        }
      }

      const image =
        `/uploads/${req.file.filename}`;

      res.json({
        preview: {
          ...suggestion,
          price,
          image
        }
      });

    } catch (error) {
      console.error(
        "AI PRODUCT ROUTE ERROR:",
        error
      );

      res.status(500).json({
        error:
          "AI product failed"
      });
    }
  }
);

/* =========================================================
   ADMIN PAGE
========================================================= */

app.get(
  "/admin",
  (req, res) => {
    const file =
      path.join(
        ADMIN_DIR,
        "index.html"
      );

    if (
      fs.existsSync(file)
    ) {
      return res.sendFile(
        file
      );
    }

    res.status(404).send(
      "Admin panel not found"
    );
  }
);

/* =========================================================
   STORE PAGE
========================================================= */

app.get(
  "/",
  (req, res) => {
    const file =
      path.join(
        STORE_DIR,
        "index.html"
      );

    if (
      fs.existsSync(file)
    ) {
      return res.sendFile(
        file
      );
    }

    res.status(404).send(
      "Store not found"
    );
  }
);

/* =========================================================
   ERROR HANDLER
========================================================= */

app.use(
  (err, req, res, next) => {
    console.error(
      "SERVER ERROR:",
      err
    );

    if (
      err instanceof
      multer.MulterError
    ) {
      return res.status(400).json({
        error:
          err.message
      });
    }

    res.status(500).json({
      error:
        err.message ||
        "Internal server error"
    });
  }
);

/* =========================================================
   START SERVER
========================================================= */

const port =
  Number(
    process.env.PORT
  ) || 10000;

app.listen(
  port,
  "0.0.0.0",
  () => {
    console.log(
      `FM FASHION API running on port ${port}`
    );

    console.log(
      `Store: http://localhost:${port}/`
    );

    console.log(
      `Admin: http://localhost:${port}/admin`
    );
  }
);
