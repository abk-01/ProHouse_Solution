"use strict";

const http = require("http");
const path = require("path");
const fs = require("fs");
const db = require("./lib/db");
const H = require("./lib/http");
const pub = require("./lib/pages-public");
const admin = require("./lib/pages-admin");
const portal = require("./lib/pages-portal");
const visualise = require("./lib/visualise");

const PORT = Number(process.env.PORT) || 3000;
const PUBLIC_DIR = path.join(__dirname, "public");
const UPLOAD_DIR = path.join(__dirname, "uploads");

if (process.argv.includes("--reset")) {
  db.reset();
  console.log("Database reset and reseeded.");
}

db.getDb();

function flashFrom(query) {
  return query.ok || query.err || "";
}

function requireUser(req, res, role) {
  const session = H.getSession(req);
  if (!session) {
    H.redirect(res, "/login?err=" + encodeURIComponent("Log in to continue."));
    return null;
  }
  if (role && session.role !== role) {
    H.redirect(res, session.role === "admin" ? "/admin" : "/portal");
    return null;
  }
  return session;
}

function quoteItems(fields) {
  const items = [];
  for (const n of [1, 2, 3]) {
    const desc = (fields[`desc${n}`] || "").trim();
    const amount = Number(fields[`amt${n}`] || 0);
    if (desc && amount) items.push({ desc, qty: Number(fields[`qty${n}`] || 1), amount });
  }
  return items;
}

const server = http.createServer(async (req, res) => {
  try {
    const { path: pathname, query } = H.parseUrl(req);
    const session = H.getSession(req);
    const method = req.method || "GET";

    if (pathname === "/styles.css" || pathname === "/app.js") {
      if (H.serveStatic(res, path.join(PUBLIC_DIR, path.basename(pathname)))) return;
    }
    if (pathname.startsWith("/gallery/")) {
      if (H.serveStatic(res, path.join(PUBLIC_DIR, "gallery", path.basename(pathname)))) return;
      return H.notFound(res);
    }
    if (pathname.startsWith("/uploads/")) {
      if (H.serveStatic(res, path.join(UPLOAD_DIR, path.basename(pathname)))) return;
      return H.notFound(res);
    }

    if (method === "GET" && pathname === "/") return H.html(res, pub.home(session, flashFrom(query)));
    if (method === "GET" && pathname === "/care") return H.html(res, pub.care(session));
    if (method === "GET" && pathname === "/design") return H.html(res, pub.design(session));
    if (method === "GET" && pathname === "/renovate") return H.html(res, pub.renovate(session));
    if (method === "GET" && pathname === "/overseas") return H.html(res, pub.overseas(session));
    if (method === "GET" && pathname === "/work") return H.html(res, pub.work(session));
    if (method === "GET" && pathname === "/about") return H.html(res, pub.about(session));
    if (method === "GET" && pathname === "/packages") return H.html(res, pub.packages(session));
    if (method === "GET" && pathname === "/estimate") return H.html(res, pub.estimate(session));
    if (method === "GET" && pathname === "/style") return H.html(res, pub.stylePage(session));
    if (method === "POST" && pathname === "/style") {
      const { fields } = await H.readBody(req);
      const look = pub.pickLook(fields);
      const photos = String(fields.photo_paths || fields.photo_path || "")
        .split(",")
        .filter(Boolean);
      const room = fields.room || "Living";
      const notes = [
        look.title,
        room,
        fields.budget || "signature",
        fields.notes,
      ]
        .filter(Boolean)
        .join(" · ");
      const svg = visualise.generate({
        client_name: (fields.name || "Your look").trim(),
        address: fields.area || "Colombo",
        sqft: fields.sqft || 1500,
        rooms: room,
        style: look.key,
        mode: "3d",
        notes,
        photos,
        scene: room,
        finish: fields.budget || "signature",
      });
      const filename = `look-${Date.now()}.svg`;
      fs.mkdirSync(UPLOAD_DIR, { recursive: true });
      fs.writeFileSync(path.join(UPLOAD_DIR, filename), svg);
      const resultPath = "/uploads/" + filename;
      db.addVisualisation({
        client_name: (fields.name || "Style quiz").trim(),
        address: fields.area || "",
        area: fields.area || "",
        kind: room,
        sqft: fields.sqft,
        rooms: room,
        style: look.key,
        mode: "3d",
        notes,
        photo_paths: photos.join(","),
        result_path: resultPath,
      });
      return H.html(
        res,
        pub.stylePage(session, {
          look,
          path: resultPath,
          fields,
          notes,
        })
      );
    }
    if (method === "GET" && pathname === "/book") return H.html(res, pub.book(session, query, flashFrom(query)));
    if (method === "GET" && pathname === "/thanks") return H.html(res, pub.thanks(session));
    if (method === "GET" && pathname === "/login") {
      if (session) return H.redirect(res, session.role === "admin" ? "/admin" : "/portal");
      return H.html(res, pub.login(session, flashFrom(query)));
    }
    if (method === "GET" && pathname === "/logout") {
      if (session) H.destroySession(session.token);
      return H.redirect(res, "/", { "Set-Cookie": H.clearCookie() });
    }

    if (method === "POST" && pathname === "/book") {
      const { fields } = await H.readBody(req);
      if (!fields.name || !fields.phone || !fields.area || !fields.service) {
        return H.redirect(res, "/book?err=" + encodeURIComponent("Name, phone, area and service are required."));
      }
      db.createLead({
        name: fields.name.trim(),
        email: (fields.email || "").trim().toLowerCase(),
        phone: fields.phone.trim(),
        area: fields.area,
        service: fields.service,
        preferred_date: fields.preferred_date,
        message: fields.message,
        photo_path: fields.photo_path || null,
      });
      return H.redirect(res, "/thanks");
    }

    if (method === "POST" && pathname === "/login") {
      const { fields } = await H.readBody(req);
      const user = db.findUserByEmail(fields.email);
      if (!user || !db.verifyPassword(fields.password, user.password_hash)) {
        return H.redirect(res, "/login?err=" + encodeURIComponent("Email or password is wrong."));
      }
      const token = H.createSession(user);
      const dest = user.role === "admin" ? "/admin" : "/portal";
      return H.redirect(res, dest, { "Set-Cookie": H.sessionCookie(token) });
    }

    let params;

    if (pathname.startsWith("/admin")) {
      const user = requireUser(req, res, "admin");
      if (!user) return;

      if (method === "GET" && pathname === "/admin") return H.html(res, admin.overview(user, flashFrom(query)));
      if (method === "GET" && pathname === "/admin/leads") return H.html(res, admin.leads(user, flashFrom(query)));
      params = H.matchRoute("/admin/leads/:id", pathname);
      if (method === "GET" && params) {
        const lead = db.getLead(params.id);
        if (!lead) return H.notFound(res);
        return H.html(res, admin.leadDetail(user, lead, flashFrom(query)));
      }
      params = H.matchRoute("/admin/leads/:id/status", pathname);
      if (method === "POST" && params) {
        const { fields } = await H.readBody(req);
        db.updateLeadStatus(params.id, fields.status || "contacted");
        return H.redirect(res, "/admin/leads?ok=" + encodeURIComponent("Lead updated."));
      }
      params = H.matchRoute("/admin/leads/:id/convert", pathname);
      if (method === "POST" && params) {
        const { fields } = await H.readBody(req);
        const jobId = db.createJob({
          property_id: fields.property_id || null,
          lead_id: params.id,
          user_id: fields.user_id || null,
          title: fields.title,
          division: fields.division,
          status: "lead",
          description: "Converted from booking lead.",
        });
        db.updateLeadStatus(params.id, "converted");
        return H.redirect(res, "/admin/jobs/" + jobId + "?ok=" + encodeURIComponent("Job created from lead."));
      }

      if (method === "GET" && pathname === "/admin/jobs") return H.html(res, admin.jobs(user, flashFrom(query)));
      params = H.matchRoute("/admin/jobs/:id", pathname);
      if (method === "GET" && params) {
        const job = db.getJob(params.id);
        if (!job) return H.notFound(res);
        return H.html(res, admin.jobDetail(user, job, flashFrom(query)));
      }
      if (method === "POST" && params) {
        const { fields } = await H.readBody(req);
        db.updateJob(params.id, fields);
        return H.redirect(res, "/admin/jobs/" + params.id + "?ok=" + encodeURIComponent("Job saved."));
      }
      params = H.matchRoute("/admin/jobs/:id/assign", pathname);
      if (method === "POST" && params) {
        const { fields } = await H.readBody(req);
        db.assignContractor(params.id, fields.contractor_id);
        return H.redirect(res, "/admin/jobs/" + params.id);
      }
      params = H.matchRoute("/admin/jobs/:id/quote", pathname);
      if (method === "POST" && params) {
        const { fields } = await H.readBody(req);
        const items = quoteItems(fields);
        if (!items.length) return H.redirect(res, "/admin/jobs/" + params.id + "?err=" + encodeURIComponent("Add at least one line."));
        db.createQuote(params.id, items);
        return H.redirect(res, "/admin/jobs/" + params.id + "?ok=" + encodeURIComponent("Quotation sent."));
      }
      params = H.matchRoute("/admin/jobs/:id/invoice", pathname);
      if (method === "POST" && params) {
        const { fields } = await H.readBody(req);
        db.createInvoice({
          job_id: params.id,
          title: fields.title,
          amount: fields.amount,
          due_date: fields.due_date,
        });
        return H.redirect(res, "/admin/jobs/" + params.id + "?ok=" + encodeURIComponent("Invoice raised."));
      }
      params = H.matchRoute("/admin/jobs/:id/photo", pathname);
      if (method === "POST" && params) {
        const { fields } = await H.readBody(req);
        db.addPhoto({ job_id: params.id, kind: fields.kind, caption: fields.caption, path: fields.path });
        return H.redirect(res, "/admin/jobs/" + params.id);
      }
      params = H.matchRoute("/admin/jobs/:id/note", pathname);
      if (method === "POST" && params) {
        const { fields } = await H.readBody(req);
        db.addNote(params.id, fields.body, user.name);
        return H.redirect(res, "/admin/jobs/" + params.id);
      }
      params = H.matchRoute("/admin/jobs/:id/approval", pathname);
      if (method === "POST" && params) {
        const { fields } = await H.readBody(req);
        db.createApproval({
          property_id: fields.property_id,
          job_id: params.id,
          title: fields.title,
          description: fields.description,
          amount: fields.amount,
        });
        return H.redirect(res, "/admin/jobs/" + params.id + "?ok=" + encodeURIComponent("Sent to the owner."));
      }

      params = H.matchRoute("/admin/quotes/:id/accept", pathname);
      if (method === "POST" && params) {
        db.setQuoteStatus(params.id, "accepted");
        return H.redirect(res, "/admin/money?ok=" + encodeURIComponent("Quotation accepted."));
      }
      params = H.matchRoute("/admin/invoices/:id/paid", pathname);
      if (method === "POST" && params) {
        db.markInvoicePaid(params.id);
        const back = req.headers.referer && req.headers.referer.includes("/admin/jobs/") ? req.headers.referer.split("?")[0] : "/admin/money";
        return H.redirect(res, back + "?ok=" + encodeURIComponent("Marked paid."));
      }

      if (method === "GET" && pathname === "/admin/properties") return H.html(res, admin.properties(user, flashFrom(query)));
      if (method === "POST" && pathname === "/admin/properties") {
        const { fields } = await H.readBody(req);
        db.createProperty(fields);
        return H.redirect(res, "/admin/properties?ok=" + encodeURIComponent("Property added."));
      }
      params = H.matchRoute("/admin/properties/:id", pathname);
      if (method === "GET" && params) {
        const property = db.getProperty(params.id);
        if (!property) return H.notFound(res);
        return H.html(res, admin.propertyDetail(user, property, flashFrom(query)));
      }

      if (method === "GET" && pathname === "/admin/visits") return H.html(res, admin.visits(user, flashFrom(query)));
      if (method === "POST" && pathname === "/admin/visits") {
        const { fields } = await H.readBody(req);
        const scheduled = fields.scheduled_at ? new Date(fields.scheduled_at).toISOString() : db.now();
        db.createVisit({
          property_id: fields.property_id,
          scheduled_at: scheduled,
          kind: fields.kind,
          summary: fields.summary,
        });
        return H.redirect(res, "/admin/visits?ok=" + encodeURIComponent("Visit scheduled."));
      }
      params = H.matchRoute("/admin/visits/:id", pathname);
      if (method === "GET" && params) {
        const visit = db.getVisit(params.id);
        if (!visit) return H.notFound(res);
        return H.html(res, admin.visitDetail(user, visit, flashFrom(query)));
      }
      params = H.matchRoute("/admin/visits/:id/complete", pathname);
      if (method === "POST" && params) {
        const { fields } = await H.readBody(req);
        db.completeVisit(params.id, fields.summary);
        return H.redirect(res, "/admin/visits/" + params.id + "?ok=" + encodeURIComponent("Report filed."));
      }

      if (method === "GET" && pathname === "/admin/trades") return H.html(res, admin.trades(user, flashFrom(query)));
      if (method === "POST" && pathname === "/admin/trades") {
        const { fields } = await H.readBody(req);
        db.createContractor(fields);
        return H.redirect(res, "/admin/trades?ok=" + encodeURIComponent("Contractor added."));
      }

      if (method === "GET" && pathname === "/admin/money") return H.html(res, admin.moneyPage(user, flashFrom(query)));

      if (method === "GET" && pathname === "/admin/studio") return H.html(res, admin.studio(user, flashFrom(query)));
      if (method === "POST" && pathname === "/admin/studio") {
        const { fields } = await H.readBody(req);
        if (!fields.photo_path || !fields.title) {
          return H.redirect(res, "/admin/studio?err=" + encodeURIComponent("Title and image are required."));
        }
        db.addGallery({
          category: fields.category,
          room: fields.room,
          title: fields.title,
          caption: fields.caption,
          image_path: fields.photo_path,
          trending: fields.trending,
        });
        return H.redirect(res, "/admin/studio?ok=" + encodeURIComponent("Published to the lookbook."));
      }
      params = H.matchRoute("/admin/studio/:id/delete", pathname);
      if (method === "POST" && params) {
        db.deleteGallery(params.id);
        return H.redirect(res, "/admin/studio?ok=" + encodeURIComponent("Removed."));
      }

      if (method === "GET" && pathname === "/admin/visualise") return H.html(res, admin.visualise(user, flashFrom(query)));
      if (method === "POST" && pathname === "/admin/visualise") {
        const { fields, saved } = await H.readBody(req);
        const clientName = (fields.client_name || fields.lead_hint || "").trim();
        if (!clientName) {
          return H.redirect(res, "/admin/visualise?err=" + encodeURIComponent("Customer name is required."));
        }
        const photos = (fields.photo_paths || "").split(",").filter(Boolean);
        const svg = visualise.generate({
          client_name: clientName,
          address: fields.address,
          sqft: fields.sqft,
          rooms: fields.rooms,
          style: fields.style,
          mode: fields.mode,
          notes: fields.notes,
          photos,
        });
        const filename = `vis-${Date.now()}.svg`;
        fs.mkdirSync(UPLOAD_DIR, { recursive: true });
        fs.writeFileSync(path.join(UPLOAD_DIR, filename), svg);
        const id = db.addVisualisation({
          client_name: clientName,
          address: fields.address,
          area: fields.area,
          kind: fields.kind,
          sqft: fields.sqft,
          rooms: fields.rooms,
          style: fields.style,
          mode: fields.mode === "3d" ? "3d" : "2d",
          notes: fields.notes,
          photo_paths: photos.join(","),
          result_path: "/uploads/" + filename,
        });
        return H.redirect(res, "/admin/visualise/" + id + "?ok=" + encodeURIComponent("Visualisation ready."));
      }
      params = H.matchRoute("/admin/visualise/:id", pathname);
      if (method === "GET" && params) {
        const vis = db.getVisualisation(params.id);
        if (!vis) return H.notFound(res);
        return H.html(res, admin.visualiseDetail(user, vis, flashFrom(query)));
      }
      params = H.matchRoute("/admin/visualise/:id/publish", pathname);
      if (method === "POST" && params) {
        db.publishVisualisation(params.id, "design");
        return H.redirect(res, "/design?ok=" + encodeURIComponent("Published to Design."));
      }

      return H.notFound(res);
    }

    if (pathname.startsWith("/portal")) {
      const user = requireUser(req, res, "customer");
      if (!user) return;

      if (method === "GET" && pathname === "/portal") return H.html(res, portal.home(user, flashFrom(query)));
      if (method === "GET" && pathname === "/portal/jobs") return H.html(res, portal.jobs(user, flashFrom(query)));
      params = H.matchRoute("/portal/jobs/:id", pathname);
      if (method === "GET" && params) {
        const job = db.getJob(params.id);
        if (!job || job.user_id !== user.userId) return H.notFound(res);
        return H.html(res, portal.jobDetail(user, job, flashFrom(query)));
      }
      if (method === "GET" && pathname === "/portal/visits") return H.html(res, portal.visits(user, flashFrom(query)));
      params = H.matchRoute("/portal/visits/:id", pathname);
      if (method === "GET" && params) {
        const visit = db.getVisit(params.id);
        if (!visit || visit.user_id !== user.userId) return H.notFound(res);
        return H.html(res, portal.visitDetail(user, visit, flashFrom(query)));
      }
      if (method === "GET" && pathname === "/portal/payments") return H.html(res, portal.payments(user, flashFrom(query)));
      if (method === "GET" && pathname === "/portal/approvals") return H.html(res, portal.approvals(user, flashFrom(query)));
      params = H.matchRoute("/portal/approvals/:id", pathname);
      if (method === "POST" && params) {
        const approval = db.getApproval(params.id);
        if (!approval || approval.user_id !== user.userId) return H.notFound(res);
        const { fields } = await H.readBody(req);
        const decision = fields.decision === "rejected" ? "rejected" : "approved";
        db.decideApproval(params.id, decision);
        return H.redirect(res, "/portal/approvals?ok=" + encodeURIComponent("Decision saved."));
      }
      params = H.matchRoute("/portal/quotes/:id/accept", pathname);
      if (method === "POST" && params) {
        const quotes = db.all("SELECT * FROM quotes WHERE id = ?", params.id);
        const quote = quotes[0];
        if (!quote) return H.notFound(res);
        const job = db.getJob(quote.job_id);
        if (!job || job.user_id !== user.userId) return H.notFound(res);
        db.setQuoteStatus(params.id, "accepted");
        return H.redirect(res, "/portal/jobs/" + job.id + "?ok=" + encodeURIComponent("Quotation accepted."));
      }
      return H.notFound(res);
    }

    H.notFound(res);
  } catch (err) {
    console.error(err);
    H.html(
      res,
      `<!doctype html><meta charset="utf-8"><title>Error</title>
       <body style="font-family:Georgia;padding:48px;background:#cfefff">
       <p>The desk hit an error. Try again, or restart the server.</p>
       <pre>${String(err.message || err)}</pre>`,
      500
    );
  }
});

server.listen(PORT, () => {
  console.log(`ProHouse Solutions running at http://localhost:${PORT}`);
  console.log("Admin  admin@prohouse.lk / ProHouse2026");
  console.log("Owner  nisha@example.com / HomeCare2026");
});
