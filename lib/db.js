"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { DatabaseSync } = require("node:sqlite");

const DATA_DIR = path.join(__dirname, "..", "data");
const DB_PATH = path.join(DATA_DIR, "prohouse.db");

let db;

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 32).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  if (!password || !stored) return false;
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const check = crypto.scryptSync(password, salt, 32);
  const actual = Buffer.from(hash, "hex");
  if (check.length !== actual.length) return false;
  return crypto.timingSafeEqual(check, actual);
}

function now() {
  return new Date().toISOString();
}

function isoDays(offset) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString();
}

function isoDate(offset) {
  return isoDays(offset).slice(0, 10);
}

function getDb() {
  if (db) return db;
  fs.mkdirSync(DATA_DIR, { recursive: true });
  db = new DatabaseSync(DB_PATH);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");
  migrate();
  if (count("users") === 0) seed();
  if (count("gallery") === 0) seedGallery();
  return db;
}

function reset() {
  if (db) {
    db.close();
    db = null;
  }
  for (const file of ["prohouse.db", "prohouse.db-wal", "prohouse.db-shm"]) {
    const p = path.join(DATA_DIR, file);
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }
  return getDb();
}

function migrate() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      phone TEXT,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL,
      customer_type TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS properties (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      label TEXT NOT NULL,
      address TEXT NOT NULL,
      area TEXT NOT NULL,
      kind TEXT NOT NULL,
      notes TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS subscriptions (
      id TEXT PRIMARY KEY,
      property_id TEXT NOT NULL,
      tier TEXT NOT NULL,
      monthly_fee INTEGER NOT NULL,
      status TEXT NOT NULL,
      start_date TEXT NOT NULL,
      FOREIGN KEY (property_id) REFERENCES properties(id)
    );

    CREATE TABLE IF NOT EXISTS leads (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT,
      phone TEXT NOT NULL,
      area TEXT NOT NULL,
      service TEXT NOT NULL,
      preferred_date TEXT,
      message TEXT,
      photo_path TEXT,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY,
      number TEXT NOT NULL,
      property_id TEXT,
      lead_id TEXT,
      user_id TEXT,
      title TEXT NOT NULL,
      division TEXT NOT NULL,
      status TEXT NOT NULL,
      description TEXT,
      coordinator TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (property_id) REFERENCES properties(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS quotes (
      id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL,
      number TEXT NOT NULL,
      items_json TEXT NOT NULL,
      total INTEGER NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (job_id) REFERENCES jobs(id)
    );

    CREATE TABLE IF NOT EXISTS invoices (
      id TEXT PRIMARY KEY,
      job_id TEXT,
      quote_id TEXT,
      number TEXT NOT NULL,
      title TEXT NOT NULL,
      amount INTEGER NOT NULL,
      status TEXT NOT NULL,
      due_date TEXT,
      paid_at TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS visits (
      id TEXT PRIMARY KEY,
      property_id TEXT NOT NULL,
      job_id TEXT,
      scheduled_at TEXT NOT NULL,
      completed_at TEXT,
      kind TEXT NOT NULL,
      summary TEXT,
      status TEXT NOT NULL,
      FOREIGN KEY (property_id) REFERENCES properties(id)
    );

    CREATE TABLE IF NOT EXISTS photos (
      id TEXT PRIMARY KEY,
      visit_id TEXT,
      job_id TEXT,
      kind TEXT NOT NULL,
      caption TEXT,
      path TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS contractors (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      trade TEXT NOT NULL,
      phone TEXT NOT NULL,
      daily_rate INTEGER,
      status TEXT NOT NULL,
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS job_contractors (
      job_id TEXT NOT NULL,
      contractor_id TEXT NOT NULL,
      PRIMARY KEY (job_id, contractor_id)
    );

    CREATE TABLE IF NOT EXISTS approvals (
      id TEXT PRIMARY KEY,
      property_id TEXT NOT NULL,
      job_id TEXT,
      title TEXT NOT NULL,
      description TEXT,
      amount INTEGER NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      decided_at TEXT,
      FOREIGN KEY (property_id) REFERENCES properties(id)
    );

    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL,
      body TEXT NOT NULL,
      author TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS gallery (
      id TEXT PRIMARY KEY,
      category TEXT NOT NULL,
      room TEXT,
      title TEXT NOT NULL,
      caption TEXT,
      image_path TEXT NOT NULL,
      trending INTEGER NOT NULL DEFAULT 1,
      published INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS visualisations (
      id TEXT PRIMARY KEY,
      client_name TEXT NOT NULL,
      address TEXT,
      area TEXT,
      kind TEXT,
      sqft INTEGER,
      rooms TEXT,
      style TEXT,
      mode TEXT NOT NULL,
      notes TEXT,
      photo_paths TEXT,
      result_path TEXT NOT NULL,
      published INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );
  `);
}

function count(table) {
  return Number(db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n);
}

function all(sql, ...params) {
  return db.prepare(sql).all(...params);
}

function one(sql, ...params) {
  return db.prepare(sql).get(...params) || null;
}

function run(sql, ...params) {
  return db.prepare(sql).run(...params);
}

function nextNumber(table, field, prefix) {
  const rows = all(`SELECT ${field} AS n FROM ${table}`);
  let max = 0;
  for (const row of rows) {
    const part = Number(String(row.n || "").split("-").pop());
    if (Number.isFinite(part) && part > max) max = part;
  }
  return `${prefix}-${String(max + 1).padStart(3, "0")}`;
}

function seed() {
  const adminHash = hashPassword("ProHouse2026");
  const clientHash = hashPassword("HomeCare2026");

  run(
    `INSERT INTO users (id, name, email, phone, password_hash, role, customer_type, created_at)
     VALUES (?,?,?,?,?,?,?,?)`,
    "user-admin",
    "Kasun Jayasuriya",
    "admin@prohouse.lk",
    "+94 77 123 4567",
    adminHash,
    "admin",
    null,
    now()
  );
  run(
    `INSERT INTO users (id, name, email, phone, password_hash, role, customer_type, created_at)
     VALUES (?,?,?,?,?,?,?,?)`,
    "user-nisha",
    "Nisha Fernando",
    "nisha@example.com",
    "+44 7700 900123",
    clientHash,
    "customer",
    "overseas",
    now()
  );
  run(
    `INSERT INTO users (id, name, email, phone, password_hash, role, customer_type, created_at)
     VALUES (?,?,?,?,?,?,?,?)`,
    "user-ruwan",
    "Ruwan Perera",
    "ruwan@example.com",
    "+94 71 555 0182",
    clientHash,
    "customer",
    "homeowner",
    now()
  );
  run(
    `INSERT INTO users (id, name, email, phone, password_hash, role, customer_type, created_at)
     VALUES (?,?,?,?,?,?,?,?)`,
    "user-dilani",
    "Dilani Jayasuriya",
    "dilani@example.com",
    "+94 76 441 2290",
    clientHash,
    "customer",
    "landlord",
    now()
  );

  const properties = [
    [
      "prop-nisha",
      "user-nisha",
      "Rajagiriya family house",
      "42/3 Sri Wickrama Mawatha, Rajagiriya",
      "Rajagiriya",
      "house",
      "Empty most of the year. Maid comes twice a week. Gate code with coordinator.",
    ],
    [
      "prop-ruwan",
      "user-ruwan",
      "Pagoda Road house",
      "18 Pagoda Road, Nugegoda",
      "Nugegoda",
      "house",
      "Occupied. Two bathrooms. Old plumbing on the rear wing.",
    ],
    [
      "prop-dilani-house",
      "user-dilani",
      "Hill Street rental",
      "7A Hill Street, Dehiwala",
      "Dehiwala",
      "house",
      "Tenanted. Roof tiles need seasonal check.",
    ],
    [
      "prop-dilani-apt",
      "user-dilani",
      "Capitol apartment 4B",
      "Apartment 4B, Summit Residencies, Rajagiriya",
      "Rajagiriya",
      "apartment",
      "Short-let between family visits.",
    ],
  ];
  for (const p of properties) {
    run(
      `INSERT INTO properties (id, user_id, label, address, area, kind, notes) VALUES (?,?,?,?,?,?,?)`,
      ...p
    );
  }

  run(
    `INSERT INTO subscriptions (id, property_id, tier, monthly_fee, status, start_date) VALUES (?,?,?,?,?,?)`,
    "sub-nisha",
    "prop-nisha",
    "premium",
    40000,
    "active",
    isoDate(-90)
  );
  run(
    `INSERT INTO subscriptions (id, property_id, tier, monthly_fee, status, start_date) VALUES (?,?,?,?,?,?)`,
    "sub-ruwan",
    "prop-ruwan",
    "standard",
    22000,
    "active",
    isoDate(-40)
  );
  run(
    `INSERT INTO subscriptions (id, property_id, tier, monthly_fee, status, start_date) VALUES (?,?,?,?,?,?)`,
    "sub-dilani",
    "prop-dilani-house",
    "basic",
    12000,
    "active",
    isoDate(-20)
  );

  const trades = [
    ["tr-saman", "Saman Ekanayake", "Electrician", "+94 77 201 3344", 4500, "CEB-side work only with him. NVQ 4."],
    ["tr-rizwan", "Mohamed Rizwan", "Plumber", "+94 76 812 0091", 4500, "Fast on leaks. Bring own thread tape."],
    ["tr-chaminda", "Chaminda Silva", "Painter", "+94 71 334 8821", 4000, "Two-coat interiors. Good with damp walls."],
    ["tr-nimal", "Nimal Fernando", "Mason", "+94 75 441 1180", 4000, "Bathrooms and waterproofing."],
    ["tr-tharindu", "Tharindu Wijesinghe", "AC technician", "+94 77 909 2218", 5000, "Samsung and Daikin. Gas extra."],
    ["tr-anjali", "Anjali Perera", "Interior designer", "+94 77 555 0190", 12000, "Freelance. 3D in SketchUp."],
    ["tr-pradeep", "Eng. Pradeep Jayawardena", "Civil engineer", "+94 71 220 7744", 15000, "Structural reviews only. Do not skip on floors."],
  ];
  for (const t of trades) {
    run(
      `INSERT INTO contractors (id, name, trade, phone, daily_rate, status, notes) VALUES (?,?,?,?,?,?,?)`,
      t[0],
      t[1],
      t[2],
      t[3],
      t[4],
      "active",
      t[5]
    );
  }

  run(
    `INSERT INTO leads (id, name, email, phone, area, service, preferred_date, message, photo_path, status, created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    "lead-kitchen",
    "Harshani Silva",
    "harshani@example.com",
    "+94 77 618 4402",
    "Battaramulla",
    "interior-design",
    isoDate(4),
    "Want a 3D for a 12-foot pantry before we commit to cabinets.",
    null,
    "new",
    isoDays(-1)
  );
  run(
    `INSERT INTO leads (id, name, email, phone, area, service, preferred_date, message, photo_path, status, created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    "lead-roof",
    "Mahesh Gunasekara",
    "maheshg@example.com",
    "+94 71 902 3310",
    "Dehiwala",
    "renovation",
    isoDate(2),
    "Front roof leaks into the hall when it rains at night.",
    null,
    "contacted",
    isoDays(-3)
  );

  run(
    `INSERT INTO jobs (id, number, property_id, lead_id, user_id, title, division, status, description, coordinator, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    "job-bath",
    "PH-001",
    "prop-ruwan",
    null,
    "user-ruwan",
    "Rear bathroom remodel",
    "renovation",
    "in_progress",
    "Waterproofing, new tiles, grout, vanity, and extractor. Client staying in the house.",
    "Kasun Jayasuriya",
    isoDays(-18),
    isoDays(-1)
  );
  run(
    `INSERT INTO jobs (id, number, property_id, lead_id, user_id, title, division, status, description, coordinator, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    "job-kitchen",
    "PH-002",
    "prop-nisha",
    null,
    "user-nisha",
    "Kitchen layout and 3D pack",
    "design",
    "quoted",
    "Full kitchen redesign, 3 views, material board. Build option quoted separately.",
    "Kasun Jayasuriya",
    isoDays(-12),
    isoDays(-2)
  );
  run(
    `INSERT INTO jobs (id, number, property_id, lead_id, user_id, title, division, status, description, coordinator, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    "job-roof",
    "PH-003",
    "prop-dilani-house",
    null,
    "user-dilani",
    "Front roof leak repair",
    "renovation",
    "completed",
    "Replaced cracked tiles, resealed valley, checked ceiling stain.",
    "Kasun Jayasuriya",
    isoDays(-35),
    isoDays(-10)
  );
  run(
    `INSERT INTO jobs (id, number, property_id, lead_id, user_id, title, division, status, description, coordinator, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    "job-care-nisha",
    "PH-004",
    "prop-nisha",
    null,
    "user-nisha",
    "Premium Care — Rajagiriya house",
    "care",
    "in_progress",
    "Monthly inspections, cleaning coordination, emergency desk.",
    "Kasun Jayasuriya",
    isoDays(-90),
    isoDays(-2)
  );

  run(`INSERT INTO job_contractors VALUES (?,?)`, "job-bath", "tr-nimal");
  run(`INSERT INTO job_contractors VALUES (?,?)`, "job-bath", "tr-rizwan");
  run(`INSERT INTO job_contractors VALUES (?,?)`, "job-kitchen", "tr-anjali");
  run(`INSERT INTO job_contractors VALUES (?,?)`, "job-roof", "tr-nimal");

  const bathItems = JSON.stringify([
    { desc: "Waterproofing compound and labour", qty: 1, amount: 85000 },
    { desc: "Tiles and adhesive (client-selected)", qty: 1, amount: 160000 },
    { desc: "Sanitary fittings supply", qty: 1, amount: 95000 },
    { desc: "Labour, waste, and coordination", qty: 1, amount: 75000 },
  ]);
  run(
    `INSERT INTO quotes (id, job_id, number, items_json, total, status, created_at) VALUES (?,?,?,?,?,?,?)`,
    "quote-bath",
    "job-bath",
    "Q-001",
    bathItems,
    415000,
    "accepted",
    isoDays(-16)
  );
  const kitchenItems = JSON.stringify([
    { desc: "Measured survey and 2D layout", qty: 1, amount: 45000 },
    { desc: "Three 3D views", qty: 3, amount: 48000 },
    { desc: "Material board and electrician mark-up", qty: 1, amount: 22000 },
  ]);
  run(
    `INSERT INTO quotes (id, job_id, number, items_json, total, status, created_at) VALUES (?,?,?,?,?,?,?)`,
    "quote-kitchen",
    "job-kitchen",
    "Q-002",
    kitchenItems,
    115000,
    "sent",
    isoDays(-4)
  );

  run(
    `INSERT INTO invoices (id, job_id, quote_id, number, title, amount, status, due_date, paid_at, created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
    "inv-bath-1",
    "job-bath",
    "quote-bath",
    "INV-001",
    "Bathroom mobilisation 40%",
    166000,
    "paid",
    isoDate(-15),
    isoDays(-15),
    isoDays(-16)
  );
  run(
    `INSERT INTO invoices (id, job_id, quote_id, number, title, amount, status, due_date, paid_at, created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
    "inv-bath-2",
    "job-bath",
    "quote-bath",
    "INV-002",
    "Bathroom waterproofing milestone 40%",
    166000,
    "due",
    isoDate(5),
    null,
    isoDays(-3)
  );
  run(
    `INSERT INTO invoices (id, job_id, quote_id, number, title, amount, status, due_date, paid_at, created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
    "inv-care-nisha",
    "job-care-nisha",
    null,
    "INV-003",
    "Premium Care — November",
    40000,
    "paid",
    isoDate(-5),
    isoDays(-6),
    isoDays(-8)
  );
  run(
    `INSERT INTO invoices (id, job_id, quote_id, number, title, amount, status, due_date, paid_at, created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
    "inv-roof",
    "job-roof",
    null,
    "INV-004",
    "Roof leak repair",
    85000,
    "paid",
    isoDate(-12),
    isoDays(-11),
    isoDays(-20)
  );

  run(
    `INSERT INTO visits (id, property_id, job_id, scheduled_at, completed_at, kind, summary, status)
     VALUES (?,?,?,?,?,?,?,?)`,
    "vis-nisha-last",
    "prop-nisha",
    "job-care-nisha",
    isoDays(-12),
    isoDays(-12),
    "inspection",
    "Garden overgrown at the rear. AC in the master bedroom icing. No roof leak after last week's rain. Recommended compressor check.",
    "done"
  );
  run(
    `INSERT INTO visits (id, property_id, job_id, scheduled_at, completed_at, kind, summary, status)
     VALUES (?,?,?,?,?,?,?,?)`,
    "vis-nisha-next",
    "prop-nisha",
    "job-care-nisha",
    isoDays(3),
    null,
    "inspection",
    null,
    "scheduled"
  );
  run(
    `INSERT INTO visits (id, property_id, job_id, scheduled_at, completed_at, kind, summary, status)
     VALUES (?,?,?,?,?,?,?,?)`,
    "vis-bath",
    "prop-ruwan",
    "job-bath",
    isoDays(1),
    null,
    "handover",
    "Waterproofing inspection before tiling continues.",
    "scheduled"
  );
  run(
    `INSERT INTO visits (id, property_id, job_id, scheduled_at, completed_at, kind, summary, status)
     VALUES (?,?,?,?,?,?,?,?)`,
    "vis-dilani",
    "prop-dilani-house",
    null,
    isoDays(6),
    null,
    "inspection",
    null,
    "scheduled"
  );

  run(
    `INSERT INTO photos (id, visit_id, job_id, kind, caption, path) VALUES (?,?,?,?,?,?)`,
    "ph-1",
    "vis-nisha-last",
    "job-care-nisha",
    "report",
    "Front elevation, 29 Oct",
    "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1200&q=80"
  );
  run(
    `INSERT INTO photos (id, visit_id, job_id, kind, caption, path) VALUES (?,?,?,?,?,?)`,
    "ph-2",
    "vis-nisha-last",
    "job-care-nisha",
    "report",
    "Kitchen as left by maid",
    "https://images.unsplash.com/photo-1556912173-46c336c7fd55?auto=format&fit=crop&w=1200&q=80"
  );
  run(
    `INSERT INTO photos (id, visit_id, job_id, kind, caption, path) VALUES (?,?,?,?,?,?)`,
    "ph-3",
    null,
    "job-bath",
    "before",
    "Rear bathroom before strip-out",
    "https://images.unsplash.com/photo-1552321554-5fefe8c9ef14?auto=format&fit=crop&w=1200&q=80"
  );
  run(
    `INSERT INTO photos (id, visit_id, job_id, kind, caption, path) VALUES (?,?,?,?,?,?)`,
    "ph-4",
    null,
    "job-roof",
    "after",
    "Valley resealed",
    "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=1200&q=80"
  );

  run(
    `INSERT INTO approvals (id, property_id, job_id, title, description, amount, status, created_at, decided_at)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    "ap-ac",
    "prop-nisha",
    "job-care-nisha",
    "Master bedroom AC compressor",
    "Inspection found icing on the indoor unit. Tharindu recommends a compressor replacement rather than another gas top-up. Above the LKR 15,000 auto-approve limit.",
    28000,
    "pending",
    isoDays(-1),
    null
  );

  run(
    `INSERT INTO notes (id, job_id, body, author, created_at) VALUES (?,?,?,?,?)`,
    "note-1",
    "job-bath",
    "Waterproofing coat 1 done. Need 24 hours dry before coat 2. Do not let the family use the rear bath.",
    "Kasun Jayasuriya",
    isoDays(-2)
  );
  run(
    `INSERT INTO notes (id, job_id, body, author, created_at) VALUES (?,?,?,?,?)`,
    "note-2",
    "job-kitchen",
    "3D views sent on WhatsApp. Waiting on quartz vs granite decision.",
    "Anjali Perera",
    isoDays(-2)
  );
  seedGallery();
}

function seedGallery() {
  const items = [
    ["gal-1", "design", "Living", "Ice-blue Colombo living", "2026 trend: pale oak, ice velvet, tropical light.", "/gallery/design-living-ice.jpg"],
    ["gal-2", "design", "Kitchen", "White island, ice cabinetry", "Handleless kitchen with morning light.", "/gallery/design-kitchen-ice.jpg"],
    ["gal-3", "design", "Bedroom", "Linen and quiet blue", "Calm bedroom with sheer curtains.", "/gallery/design-bedroom-ice.jpg"],
    ["gal-4", "design", "Living", "Soft modern lounge", "Low furniture, lots of air.", "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=1600&q=80"],
    ["gal-5", "design", "Dining", "White dining with garden", "Indoor-outdoor Colombo dining.", "https://images.unsplash.com/photo-1617806118233-18e1de3d13f0?auto=format&fit=crop&w=1600&q=80"],
    ["gal-6", "design", "Bathroom", "Hotel-calm wet room", "Stone, glass, and ice mosaic.", "https://images.unsplash.com/photo-1507652313519-d4e9174996dd?auto=format&fit=crop&w=1600&q=80"],
    ["gal-7", "renovate", "Kitchen", "Kitchen after remodel", "New cabinets, porcelain floor, tropical doors.", "/gallery/reno-kitchen.jpg"],
    ["gal-8", "renovate", "Bathroom", "Bathroom after waterproofing", "Walk-in shower and ice mosaic niche.", "/gallery/reno-bathroom.jpg"],
    ["gal-9", "renovate", "Living", "Living room refresh", "White walls, ice feature wall, new floor.", "/gallery/reno-living.jpg"],
    ["gal-10", "renovate", "Exterior", "House after paint and roof", "Clean elevation, ready for care visits.", "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1600&q=80"],
    ["gal-11", "renovate", "Kitchen", "Open kitchen strip-out complete", "After first-fix, before joinery.", "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?auto=format&fit=crop&w=1600&q=80"],
    ["gal-12", "renovate", "Bathroom", "Old wet room before", "The brief we start from.", "https://images.unsplash.com/photo-1552321554-5fefe8c9ef14?auto=format&fit=crop&w=1600&q=80"],
  ];
  for (const item of items) {
    run(
      `INSERT OR IGNORE INTO gallery (id, category, room, title, caption, image_path, trending, published, created_at)
       VALUES (?,?,?,?,?,?,1,1,?)`,
      item[0],
      item[1],
      item[2],
      item[3],
      item[4],
      item[5],
      now()
    );
  }
}

const dbApi = {
  hashPassword,
  verifyPassword,
  now,
  getDb,
  reset,
  all,
  one,
  run,
  nextNumber,

  findUserByEmail(email) {
    getDb();
    return one("SELECT * FROM users WHERE email = ?", String(email || "").trim().toLowerCase());
  },
  findUserById(id) {
    getDb();
    return one("SELECT * FROM users WHERE id = ?", id);
  },
  listCustomers() {
    getDb();
    return all("SELECT * FROM users WHERE role = 'customer' ORDER BY name");
  },

  listLeads() {
    getDb();
    return all("SELECT * FROM leads ORDER BY created_at DESC");
  },
  getLead(id) {
    getDb();
    return one("SELECT * FROM leads WHERE id = ?", id);
  },
  createLead(data) {
    getDb();
    const id = "lead-" + crypto.randomBytes(4).toString("hex");
    run(
      `INSERT INTO leads (id, name, email, phone, area, service, preferred_date, message, photo_path, status, created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      id,
      data.name,
      data.email || "",
      data.phone,
      data.area,
      data.service,
      data.preferred_date || "",
      data.message || "",
      data.photo_path || null,
      "new",
      now()
    );
    return id;
  },
  updateLeadStatus(id, status) {
    getDb();
    run("UPDATE leads SET status = ? WHERE id = ?", status, id);
  },

  listJobs(filters = {}) {
    getDb();
    if (filters.userId) {
      return all(
        `SELECT jobs.*, properties.label AS property_label, properties.area, users.name AS client_name
         FROM jobs
         LEFT JOIN properties ON properties.id = jobs.property_id
         LEFT JOIN users ON users.id = jobs.user_id
         WHERE jobs.user_id = ?
         ORDER BY jobs.updated_at DESC`,
        filters.userId
      );
    }
    if (filters.status) {
      return all(
        `SELECT jobs.*, properties.label AS property_label, properties.area, users.name AS client_name
         FROM jobs
         LEFT JOIN properties ON properties.id = jobs.property_id
         LEFT JOIN users ON users.id = jobs.user_id
         WHERE jobs.status = ?
         ORDER BY jobs.updated_at DESC`,
        filters.status
      );
    }
    return all(
      `SELECT jobs.*, properties.label AS property_label, properties.area, users.name AS client_name
       FROM jobs
       LEFT JOIN properties ON properties.id = jobs.property_id
       LEFT JOIN users ON users.id = jobs.user_id
       ORDER BY jobs.updated_at DESC`
    );
  },
  getJob(id) {
    getDb();
    return one(
      `SELECT jobs.*, properties.label AS property_label, properties.address, properties.area,
              users.name AS client_name, users.email AS client_email, users.phone AS client_phone
       FROM jobs
       LEFT JOIN properties ON properties.id = jobs.property_id
       LEFT JOIN users ON users.id = jobs.user_id
       WHERE jobs.id = ?`,
      id
    );
  },
  createJob(data) {
    getDb();
    const id = "job-" + crypto.randomBytes(4).toString("hex");
    const number = nextNumber("jobs", "number", "PH");
    run(
      `INSERT INTO jobs (id, number, property_id, lead_id, user_id, title, division, status, description, coordinator, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      id,
      number,
      data.property_id || null,
      data.lead_id || null,
      data.user_id || null,
      data.title,
      data.division,
      data.status || "lead",
      data.description || "",
      data.coordinator || "Kasun Jayasuriya",
      now(),
      now()
    );
    return id;
  },
  updateJob(id, fields) {
    getDb();
    run(
      `UPDATE jobs SET status = ?, title = ?, description = ?, updated_at = ? WHERE id = ?`,
      fields.status,
      fields.title,
      fields.description,
      now(),
      id
    );
  },

  listProperties(userId) {
    getDb();
    if (userId) {
      return all(
        `SELECT properties.*, users.name AS owner_name, subscriptions.tier, subscriptions.monthly_fee, subscriptions.status AS sub_status
         FROM properties
         JOIN users ON users.id = properties.user_id
         LEFT JOIN subscriptions ON subscriptions.property_id = properties.id
         WHERE properties.user_id = ?
         ORDER BY properties.label`,
        userId
      );
    }
    return all(
      `SELECT properties.*, users.name AS owner_name, subscriptions.tier, subscriptions.monthly_fee, subscriptions.status AS sub_status
       FROM properties
       JOIN users ON users.id = properties.user_id
       LEFT JOIN subscriptions ON subscriptions.property_id = properties.id
       ORDER BY properties.area, properties.label`
    );
  },
  getProperty(id) {
    getDb();
    return one(
      `SELECT properties.*, users.name AS owner_name, users.email AS owner_email, users.id AS owner_id,
              subscriptions.id AS subscription_id, subscriptions.tier, subscriptions.monthly_fee, subscriptions.status AS sub_status
       FROM properties
       JOIN users ON users.id = properties.user_id
       LEFT JOIN subscriptions ON subscriptions.property_id = properties.id
       WHERE properties.id = ?`,
      id
    );
  },
  createProperty(data) {
    getDb();
    const id = "prop-" + crypto.randomBytes(4).toString("hex");
    run(
      `INSERT INTO properties (id, user_id, label, address, area, kind, notes) VALUES (?,?,?,?,?,?,?)`,
      id,
      data.user_id,
      data.label,
      data.address,
      data.area,
      data.kind,
      data.notes || ""
    );
    if (data.tier) {
      run(
        `INSERT INTO subscriptions (id, property_id, tier, monthly_fee, status, start_date) VALUES (?,?,?,?,?,?)`,
        "sub-" + crypto.randomBytes(4).toString("hex"),
        id,
        data.tier,
        Number(data.monthly_fee || 0),
        "active",
        now().slice(0, 10)
      );
    }
    return id;
  },

  listVisits(filters = {}) {
    getDb();
    if (filters.userId) {
      return all(
        `SELECT visits.*, properties.label AS property_label, properties.area, properties.user_id
         FROM visits
         JOIN properties ON properties.id = visits.property_id
         WHERE properties.user_id = ?
         ORDER BY visits.scheduled_at DESC`,
        filters.userId
      );
    }
    if (filters.propertyId) {
      return all(
        `SELECT visits.*, properties.label AS property_label, properties.area
         FROM visits JOIN properties ON properties.id = visits.property_id
         WHERE visits.property_id = ?
         ORDER BY visits.scheduled_at DESC`,
        filters.propertyId
      );
    }
    return all(
      `SELECT visits.*, properties.label AS property_label, properties.area, users.name AS owner_name
       FROM visits
       JOIN properties ON properties.id = visits.property_id
       JOIN users ON users.id = properties.user_id
       ORDER BY visits.scheduled_at ASC`
    );
  },
  getVisit(id) {
    getDb();
    return one(
      `SELECT visits.*, properties.label AS property_label, properties.address, properties.area, properties.user_id, users.name AS owner_name
       FROM visits
       JOIN properties ON properties.id = visits.property_id
       JOIN users ON users.id = properties.user_id
       WHERE visits.id = ?`,
      id
    );
  },
  createVisit(data) {
    getDb();
    const id = "vis-" + crypto.randomBytes(4).toString("hex");
    run(
      `INSERT INTO visits (id, property_id, job_id, scheduled_at, completed_at, kind, summary, status)
       VALUES (?,?,?,?,?,?,?,?)`,
      id,
      data.property_id,
      data.job_id || null,
      data.scheduled_at,
      null,
      data.kind,
      data.summary || "",
      "scheduled"
    );
    return id;
  },
  completeVisit(id, summary) {
    getDb();
    run(
      `UPDATE visits SET status = 'done', completed_at = ?, summary = ? WHERE id = ?`,
      now(),
      summary,
      id
    );
  },

  listContractors() {
    getDb();
    return all("SELECT * FROM contractors ORDER BY trade, name");
  },
  createContractor(data) {
    getDb();
    const id = "tr-" + crypto.randomBytes(4).toString("hex");
    run(
      `INSERT INTO contractors (id, name, trade, phone, daily_rate, status, notes) VALUES (?,?,?,?,?,?,?)`,
      id,
      data.name,
      data.trade,
      data.phone,
      Number(data.daily_rate || 0),
      "active",
      data.notes || ""
    );
    return id;
  },
  jobContractors(jobId) {
    getDb();
    return all(
      `SELECT contractors.* FROM job_contractors
       JOIN contractors ON contractors.id = job_contractors.contractor_id
       WHERE job_contractors.job_id = ?`,
      jobId
    );
  },
  assignContractor(jobId, contractorId) {
    getDb();
    run(`INSERT OR IGNORE INTO job_contractors (job_id, contractor_id) VALUES (?,?)`, jobId, contractorId);
  },

  listQuotes(jobId) {
    getDb();
    if (jobId) return all("SELECT * FROM quotes WHERE job_id = ? ORDER BY created_at DESC", jobId);
    return all(
      `SELECT quotes.*, jobs.number AS job_number, jobs.title AS job_title
       FROM quotes JOIN jobs ON jobs.id = quotes.job_id
       ORDER BY quotes.created_at DESC`
    );
  },
  createQuote(jobId, items) {
    getDb();
    const id = "quote-" + crypto.randomBytes(4).toString("hex");
    const number = nextNumber("quotes", "number", "Q");
    const total = items.reduce((s, i) => s + Number(i.amount || 0), 0);
    run(
      `INSERT INTO quotes (id, job_id, number, items_json, total, status, created_at) VALUES (?,?,?,?,?,?,?)`,
      id,
      jobId,
      number,
      JSON.stringify(items),
      total,
      "sent",
      now()
    );
    run(`UPDATE jobs SET status = 'quoted', updated_at = ? WHERE id = ? AND status = 'lead'`, now(), jobId);
    return id;
  },
  setQuoteStatus(id, status) {
    getDb();
    run("UPDATE quotes SET status = ? WHERE id = ?", status, id);
    if (status === "accepted") {
      const q = one("SELECT job_id FROM quotes WHERE id = ?", id);
      if (q) run(`UPDATE jobs SET status = 'approved', updated_at = ? WHERE id = ?`, now(), q.job_id);
    }
  },

  listInvoices(filters = {}) {
    getDb();
    if (filters.userId) {
      return all(
        `SELECT invoices.*, jobs.title AS job_title, jobs.number AS job_number
         FROM invoices
         LEFT JOIN jobs ON jobs.id = invoices.job_id
         WHERE jobs.user_id = ?
         ORDER BY invoices.created_at DESC`,
        filters.userId
      );
    }
    if (filters.jobId) return all("SELECT * FROM invoices WHERE job_id = ? ORDER BY created_at DESC", filters.jobId);
    return all(
      `SELECT invoices.*, jobs.title AS job_title, jobs.number AS job_number, users.name AS client_name
       FROM invoices
       LEFT JOIN jobs ON jobs.id = invoices.job_id
       LEFT JOIN users ON users.id = jobs.user_id
       ORDER BY invoices.created_at DESC`
    );
  },
  createInvoice(data) {
    getDb();
    const id = "inv-" + crypto.randomBytes(4).toString("hex");
    const number = nextNumber("invoices", "number", "INV");
    run(
      `INSERT INTO invoices (id, job_id, quote_id, number, title, amount, status, due_date, paid_at, created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      id,
      data.job_id || null,
      data.quote_id || null,
      number,
      data.title,
      Number(data.amount),
      "due",
      data.due_date || isoDate(7),
      null,
      now()
    );
    return id;
  },
  markInvoicePaid(id) {
    getDb();
    run(`UPDATE invoices SET status = 'paid', paid_at = ? WHERE id = ?`, now(), id);
  },

  listApprovals(filters = {}) {
    getDb();
    if (filters.userId) {
      return all(
        `SELECT approvals.*, properties.label AS property_label
         FROM approvals JOIN properties ON properties.id = approvals.property_id
         WHERE properties.user_id = ?
         ORDER BY approvals.created_at DESC`,
        filters.userId
      );
    }
    return all(
      `SELECT approvals.*, properties.label AS property_label, users.name AS owner_name
       FROM approvals
       JOIN properties ON properties.id = approvals.property_id
       JOIN users ON users.id = properties.user_id
       ORDER BY approvals.created_at DESC`
    );
  },
  createApproval(data) {
    getDb();
    const id = "ap-" + crypto.randomBytes(4).toString("hex");
    run(
      `INSERT INTO approvals (id, property_id, job_id, title, description, amount, status, created_at, decided_at)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      id,
      data.property_id,
      data.job_id || null,
      data.title,
      data.description || "",
      Number(data.amount),
      "pending",
      now(),
      null
    );
    return id;
  },
  decideApproval(id, status) {
    getDb();
    run(`UPDATE approvals SET status = ?, decided_at = ? WHERE id = ?`, status, now(), id);
  },
  getApproval(id) {
    getDb();
    return one(
      `SELECT approvals.*, properties.label AS property_label, properties.user_id
       FROM approvals JOIN properties ON properties.id = approvals.property_id
       WHERE approvals.id = ?`,
      id
    );
  },

  listPhotos(filters = {}) {
    getDb();
    if (filters.jobId) return all("SELECT * FROM photos WHERE job_id = ?", filters.jobId);
    if (filters.visitId) return all("SELECT * FROM photos WHERE visit_id = ?", filters.visitId);
    return all("SELECT * FROM photos ORDER BY id DESC");
  },
  addPhoto(data) {
    getDb();
    const id = "ph-" + crypto.randomBytes(4).toString("hex");
    run(
      `INSERT INTO photos (id, visit_id, job_id, kind, caption, path) VALUES (?,?,?,?,?,?)`,
      id,
      data.visit_id || null,
      data.job_id || null,
      data.kind,
      data.caption || "",
      data.path
    );
    return id;
  },
  listNotes(jobId) {
    getDb();
    return all("SELECT * FROM notes WHERE job_id = ? ORDER BY created_at DESC", jobId);
  },
  addNote(jobId, body, author) {
    getDb();
    run(
      `INSERT INTO notes (id, job_id, body, author, created_at) VALUES (?,?,?,?,?)`,
      "note-" + crypto.randomBytes(4).toString("hex"),
      jobId,
      body,
      author,
      now()
    );
  },

  stats() {
    getDb();
    const leadsNew = one("SELECT COUNT(*) AS n FROM leads WHERE status = 'new'").n;
    const jobsActive = one(
      "SELECT COUNT(*) AS n FROM jobs WHERE status IN ('quoted','approved','in_progress','snagging')"
    ).n;
    const careActive = one("SELECT COUNT(*) AS n FROM subscriptions WHERE status = 'active'").n;
    const approvalsPending = one("SELECT COUNT(*) AS n FROM approvals WHERE status = 'pending'").n;
    const invoicesDue = one("SELECT COALESCE(SUM(amount),0) AS n FROM invoices WHERE status = 'due'").n;
    const paid = one("SELECT COALESCE(SUM(amount),0) AS n FROM invoices WHERE status = 'paid'").n;
    const visitsSoon = one(
      "SELECT COUNT(*) AS n FROM visits WHERE status = 'scheduled'"
    ).n;
    return {
      leadsNew: Number(leadsNew),
      jobsActive: Number(jobsActive),
      careActive: Number(careActive),
      approvalsPending: Number(approvalsPending),
      invoicesDue: Number(invoicesDue),
      paid: Number(paid),
      visitsSoon: Number(visitsSoon),
    };
  },

  listGallery(category) {
    getDb();
    if (category) {
      return all(
        "SELECT * FROM gallery WHERE published = 1 AND category = ? ORDER BY trending DESC, CASE WHEN image_path LIKE '/gallery/%' THEN 0 ELSE 1 END, created_at DESC",
        category
      );
    }
    return all("SELECT * FROM gallery WHERE published = 1 ORDER BY created_at DESC");
  },
  listGalleryAll() {
    getDb();
    return all("SELECT * FROM gallery ORDER BY created_at DESC");
  },
  addGallery(data) {
    getDb();
    const id = "gal-" + crypto.randomBytes(4).toString("hex");
    run(
      `INSERT INTO gallery (id, category, room, title, caption, image_path, trending, published, created_at)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      id,
      data.category,
      data.room || "",
      data.title,
      data.caption || "",
      data.image_path,
      data.trending ? 1 : 0,
      data.published === "0" ? 0 : 1,
      now()
    );
    return id;
  },
  deleteGallery(id) {
    getDb();
    run("DELETE FROM gallery WHERE id = ?", id);
  },
  listVisualisations() {
    getDb();
    return all("SELECT * FROM visualisations ORDER BY created_at DESC");
  },
  getVisualisation(id) {
    getDb();
    return one("SELECT * FROM visualisations WHERE id = ?", id);
  },
  addVisualisation(data) {
    getDb();
    const id = "visu-" + crypto.randomBytes(4).toString("hex");
    run(
      `INSERT INTO visualisations (id, client_name, address, area, kind, sqft, rooms, style, mode, notes, photo_paths, result_path, published, created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      id,
      data.client_name,
      data.address || "",
      data.area || "",
      data.kind || "",
      Number(data.sqft || 0),
      data.rooms || "",
      data.style || "ice",
      data.mode,
      data.notes || "",
      data.photo_paths || "",
      data.result_path,
      0,
      now()
    );
    return id;
  },
  publishVisualisation(id, category) {
    getDb();
    const vis = one("SELECT * FROM visualisations WHERE id = ?", id);
    if (!vis) return;
    run("UPDATE visualisations SET published = 1 WHERE id = ?", id);
    run(
      `INSERT INTO gallery (id, category, room, title, caption, image_path, trending, published, created_at)
       VALUES (?,?,?,?,?,?,1,1,?)`,
      "gal-" + crypto.randomBytes(4).toString("hex"),
      category || (vis.mode === "3d" ? "design" : "renovate"),
      vis.kind || vis.mode,
      vis.mode.toUpperCase() + " · " + vis.client_name,
      vis.address || vis.notes || "",
      vis.result_path,
      now()
    );
  },
};

module.exports = dbApi;
