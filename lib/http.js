"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const sessions = new Map();
const COOKIE = "phsid";
const UPLOAD_DIR = path.join(__dirname, "..", "uploads");

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
  }
  return out;
}

function createSession(user) {
  const token = crypto.randomBytes(24).toString("hex");
  sessions.set(token, {
    userId: user.id,
    role: user.role,
    name: user.name,
    email: user.email,
    expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
  });
  return token;
}

function destroySession(token) {
  sessions.delete(token);
}

function getSession(req) {
  const token = parseCookies(req.headers.cookie)[COOKIE];
  if (!token) return null;
  const session = sessions.get(token);
  if (!session || session.expires < Date.now()) {
    sessions.delete(token);
    return null;
  }
  return { ...session, token };
}

function sessionCookie(token) {
  return `${COOKIE}=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${7 * 24 * 60 * 60}`;
}

function clearCookie() {
  return `${COOKIE}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`;
}

function send(res, status, body, headers = {}) {
  const payload = Buffer.isBuffer(body) ? body : Buffer.from(body || "");
  res.writeHead(status, {
    "Content-Length": payload.length,
    ...headers,
  });
  res.end(payload);
}

function html(res, body, status = 200, extra = {}) {
  send(res, status, body, {
    "Content-Type": "text/html; charset=utf-8",
    ...extra,
  });
}

function redirect(res, location, extra = {}) {
  send(res, 303, "", { Location: location, ...extra });
}

function notFound(res) {
  html(
    res,
    `<!doctype html><meta charset="utf-8"><title>Not found</title>
     <body style="font-family:Georgia;padding:48px;background:#f4efe6">
     <p>That page is not in the ProHouse system.</p>
     <p><a href="/">Back home</a></p>`,
    404
  );
}

function parseUrl(req) {
  const host = req.headers.host || "localhost";
  const u = new URL(req.url, `http://${host}`);
  return { path: u.pathname.replace(/\/+$/, "") || "/", query: Object.fromEntries(u.searchParams) };
}

function matchRoute(pattern, pathname) {
  const pa = pattern.split("/").filter(Boolean);
  const pb = pathname.split("/").filter(Boolean);
  if (pa.length !== pb.length) return null;
  const params = {};
  for (let i = 0; i < pa.length; i++) {
    if (pa[i].startsWith(":")) params[pa[i].slice(1)] = decodeURIComponent(pb[i]);
    else if (pa[i] !== pb[i]) return null;
  }
  return params;
}

function parseUrlEncoded(raw) {
  const out = {};
  for (const [k, v] of new URLSearchParams(raw)) {
    if (k.endsWith("[]")) {
      const key = k.slice(0, -2);
      if (!Array.isArray(out[key])) out[key] = [];
      out[key].push(v);
    } else out[k] = v;
  }
  return out;
}

function readRaw(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (c) => {
      size += c.length;
      if (size > 12 * 1024 * 1024) {
        reject(new Error("File too large"));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function parseMultipart(buffer, boundary) {
  const fields = {};
  const files = {};
  const sep = Buffer.from(`--${boundary}`);
  let start = indexOf(buffer, sep, 0);
  while (start !== -1) {
    const contentStart = start + sep.length + 2;
    const next = indexOf(buffer, sep, contentStart);
    if (next === -1) break;
    const part = buffer.subarray(contentStart, next - 2);
    const headerEnd = indexOf(part, Buffer.from("\r\n\r\n"), 0);
    if (headerEnd === -1) {
      start = next;
      continue;
    }
    const header = part.subarray(0, headerEnd).toString("utf8");
    const body = part.subarray(headerEnd + 4);
    const nameMatch = header.match(/name="([^"]+)"/);
    const fileMatch = header.match(/filename="([^"]*)"/);
    if (!nameMatch) {
      start = next;
      continue;
    }
    const name = nameMatch[1];
    if (fileMatch && fileMatch[1]) {
      const file = { filename: fileMatch[1], data: Buffer.from(body) };
      if (!files[name]) files[name] = [];
      files[name].push(file);
    } else {
      fields[name] = body.toString("utf8");
    }
    start = next;
  }
  return { fields, files };
}

function indexOf(buf, seq, from) {
  return buf.indexOf(seq, from);
}

async function readBody(req) {
  const type = req.headers["content-type"] || "";
  const raw = await readRaw(req);
  if (type.includes("multipart/form-data")) {
    const m = type.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
    if (!m) return { fields: {}, files: {} };
    const parsed = parseMultipart(raw, (m[1] || m[2]).trim());
    const saved = [];
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    for (const list of Object.values(parsed.files)) {
      for (const file of list) {
        if (!file.data || !file.data.length) continue;
        const ext = path.extname(file.filename).toLowerCase() || ".jpg";
        const safeExt = [".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg"].includes(ext) ? ext : ".jpg";
        const filename = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}${safeExt}`;
        fs.writeFileSync(path.join(UPLOAD_DIR, filename), file.data);
        saved.push("/uploads/" + filename);
      }
    }
    if (saved[0]) parsed.fields.photo_path = saved[0];
    if (saved.length) parsed.fields.photo_paths = saved.join(",");
    parsed.saved = saved;
    return { fields: parsed.fields, files: parsed.files, saved };
  }
  return { fields: parseUrlEncoded(raw.toString("utf8")), files: {} };
}

const MIME = {
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

function serveStatic(res, filePath) {
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) return false;
  const ext = path.extname(filePath).toLowerCase();
  send(res, 200, fs.readFileSync(filePath), {
    "Content-Type": MIME[ext] || "application/octet-stream",
    "Cache-Control": ext === ".css" || ext === ".js" ? "no-cache" : "public, max-age=3600",
  });
  return true;
}

module.exports = {
  COOKIE,
  UPLOAD_DIR,
  createSession,
  destroySession,
  getSession,
  sessionCookie,
  clearCookie,
  send,
  html,
  redirect,
  notFound,
  parseUrl,
  matchRoute,
  readBody,
  serveStatic,
};
