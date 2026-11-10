"use strict";

const WHATSAPP = "94771234567";

function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function money(n) {
  const v = Number(n || 0);
  return "LKR " + v.toLocaleString("en-LK");
}

function fmtDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return esc(iso);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function fmtDateTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return esc(iso);
  return d.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function pill(status) {
  const s = String(status || "").replace(/_/g, " ");
  return `<span class="pill pill-${esc(String(status || "").split(" ")[0])}">${esc(s)}</span>`;
}

function flashBox(flash) {
  if (!flash) return "";
  return `<div class="flash">${esc(flash)}</div>`;
}

const MARK = `<svg class="mark" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="8" fill="#15639a"/><path d="M8 18.5 16 11l8 7.5V24a1 1 0 0 1-1 1h-4v-5h-6v5h-4a1 1 0 0 1-1-1z" fill="#fff"/><path d="M10 14.2 16 8.8l6 5.4" fill="none" stroke="#cfefff" stroke-width="1.6"/></svg>`;

function siteNav(user) {
  const auth = user
    ? user.role === "admin"
      ? `<a href="/admin">Desk</a><a href="/logout">Log out</a>`
      : `<a href="/portal">Your property</a><a href="/logout">Log out</a>`
    : `<a href="/login">Client login</a>`;
  return `
    <div class="topbar">
      <span>Colombo 05–07 · Nugegoda · Rajagiriya · Battaramulla · Dehiwala</span>
      <a href="https://wa.me/${WHATSAPP}" target="_blank" rel="noreferrer">WhatsApp +94 77 123 4567</a>
    </div>
    <header class="site-header">
      <a class="wordmark" href="/">${MARK}ProHouse <span>Solutions</span></a>
      <button class="nav-toggle" type="button" aria-label="Open menu">Menu</button>
      <nav>
        <div class="nav-drop">
          <button type="button">Services</button>
          <div class="nav-menu">
            <a href="/design">Interior design</a>
            <a href="/renovate">Renovation</a>
            <a href="/care">Monthly care</a>
            <a href="/overseas">Overseas owners</a>
            <a href="/packages">New packages</a>
            <a href="/style">Style quiz</a>
          </div>
        </div>
        <a href="/estimate">Estimate</a>
        <a href="/work">Work</a>
        <a href="/about">About</a>
        <a class="nav-cta" href="/book">Book a visit</a>
        ${auth}
      </nav>
    </header>`;
}

function siteFooter() {
  return `
    <footer class="site-footer">
      <div class="footer-grid">
        <div>
          <a class="wordmark" href="/">${MARK}ProHouse <span>Solutions</span></a>
          <p>The operating company for Colombo houses: design, contained renovation, monthly care, and overseas inspections. One coordinator. Line-item quotations. Photographs after every visit.</p>
        </div>
        <div>
          <h4>Services</h4>
          <a href="/design">Interior design</a>
          <a href="/renovate">Renovation</a>
          <a href="/care">Monthly care</a>
          <a href="/overseas">Overseas owners</a>
          <a href="/packages">Handover &amp; tenant-ready</a>
        </div>
        <div>
          <h4>Studio</h4>
          <a href="/estimate">Instant estimate</a>
          <a href="/style">Style quiz</a>
          <a href="/work">Case studies</a>
          <a href="/about">Process &amp; warranty</a>
          <a href="/book">Book a visit</a>
        </div>
        <div>
          <h4>Desk</h4>
          <p>Nugegoda studio, by appointment</p>
          <p><a href="https://wa.me/${WHATSAPP}">+94 77 123 4567</a></p>
          <p>admin@prohouse.lk</p>
          <p class="tiny">Mon–Sat, 8:30–18:00 IST · UK evening replies for overseas owners</p>
        </div>
      </div>
      <div class="footer-base">
        <span>ProHouse Solutions (Pvt) Ltd · Demo system, November 2026</span>
        <span>Design fees credited if you build with us.</span>
      </div>
    </footer>`;
}

function siteLayout({ title, user, flash, body, pageClass = "" }) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="ProHouse Solutions — Colombo interior design, renovation, monthly care and overseas property inspections.">
  <title>${esc(title)} · ProHouse Solutions</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Outfit:wght@400;500;600&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/styles.css?v=pro3">
</head>
<body class="${esc(pageClass)}">
  ${siteNav(user)}
  ${flashBox(flash)}
  ${body}
  ${siteFooter()}
  <a class="wa-float" href="https://wa.me/${WHATSAPP}" target="_blank" rel="noreferrer">WhatsApp</a>
  <script src="/app.js?v=pro2" defer></script>
</body>
</html>`;
}

function appNav(user, current) {
  const items =
    user.role === "admin"
      ? [
          ["/admin", "Overview"],
          ["/admin/leads", "Leads"],
          ["/admin/jobs", "Jobs"],
          ["/admin/properties", "Properties"],
          ["/admin/visits", "Visits"],
          ["/admin/trades", "Trades"],
          ["/admin/money", "Money"],
          ["/admin/studio", "Studio"],
          ["/admin/visualise", "2D / 3D"],
        ]
      : [
          ["/portal", "Home"],
          ["/portal/jobs", "Jobs"],
          ["/portal/visits", "Visits"],
          ["/portal/payments", "Payments"],
          ["/portal/approvals", "Approvals"],
        ];
  return items
    .map(([href, label]) => {
      const active = current === href || (href !== "/admin" && href !== "/portal" && current.startsWith(href));
      return `<a class="${active ? "active" : ""}" href="${href}">${label}</a>`;
    })
    .join("");
}

function appLayout({ title, user, flash, body, current }) {
  const home = user.role === "admin" ? "/admin" : "/portal";
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(title)} · ProHouse Desk</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Outfit:wght@400;500;600&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/styles.css?v=pro3">
</head>
<body class="app-body">
  <aside class="app-side">
    <a class="wordmark compact" href="${home}">${MARK}ProHouse <span>Desk</span></a>
    <p class="who">${esc(user.name)}<br><small>${esc(user.role === "admin" ? "Coordinator" : "Owner")}</small></p>
    <nav>${appNav(user, current)}</nav>
    <div class="side-foot">
      <a href="/">Public site</a>
      <a href="/logout">Log out</a>
    </div>
  </aside>
  <main class="app-main">
    ${flashBox(flash)}
    ${body}
  </main>
  <script src="/app.js?v=pro2" defer></script>
</body>
</html>`;
}

function table(headers, rows) {
  if (!rows.length) {
    return `<div class="empty">Nothing here yet.</div>`;
  }
  return `<div class="table-wrap"><table>
    <thead><tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr></thead>
    <tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody>
  </table></div>`;
}

function field(label, input) {
  return `<label class="field"><span>${esc(label)}</span>${input}</label>`;
}

function ideaCard(item, wide) {
  return `<button class="idea-card ${wide ? "wide" : ""}" type="button" data-lightbox="${esc(item.image_path)}" data-caption="${esc(item.title)} — ${esc(item.caption || "")}" data-room="${esc(item.room || "all")}">
    <img src="${esc(item.image_path)}" alt="${esc(item.title)}">
    <div class="idea-meta"><span class="pill">${esc(item.room || item.category)}</span><strong>${esc(item.title)}</strong></div>
  </button>`;
}

function selectOptions(list, selected) {
  return list
    .map(([value, label]) => `<option value="${esc(value)}" ${value === selected ? "selected" : ""}>${esc(label)}</option>`)
    .join("");
}

module.exports = {
  WHATSAPP,
  esc,
  money,
  fmtDate,
  fmtDateTime,
  pill,
  siteLayout,
  appLayout,
  table,
  field,
  selectOptions,
  ideaCard,
};
