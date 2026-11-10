"use strict";

const db = require("./db");
const { appLayout, esc, money, fmtDate, fmtDateTime, pill, table, field, selectOptions, ideaCard } = require("./ui");

const STATUSES = [
  ["lead", "Lead"],
  ["quoted", "Quoted"],
  ["approved", "Approved"],
  ["in_progress", "In progress"],
  ["snagging", "Snagging"],
  ["completed", "Completed"],
  ["cancelled", "Cancelled"],
];

function overview(user, flash) {
  const s = db.stats();
  const jobs = db.listJobs();
  const visits = db.listVisits().filter((v) => v.status === "scheduled").slice(0, 6);
  const approvals = db.listApprovals().filter((a) => a.status === "pending");
  return appLayout({
    title: "Overview",
    user,
    flash,
    current: "/admin",
    body: `
      <p class="kicker">Coordinator desk</p>
      <h1>Today in Colombo</h1>
      <div class="stat-row">
        <div class="stat"><div class="price">${s.leadsNew}</div><p>New leads</p></div>
        <div class="stat"><div class="price">${s.jobsActive}</div><p>Active jobs</p></div>
        <div class="stat"><div class="price">${s.careActive}</div><p>Care subscriptions</p></div>
        <div class="stat"><div class="price">${money(s.invoicesDue)}</div><p>Invoices due</p></div>
      </div>
      <h2>Pipeline</h2>
      ${table(
        ["Job", "Client", "Division", "Status", "Updated"],
        jobs.map((j) => [
          `<a href="/admin/jobs/${j.id}">${esc(j.number)} · ${esc(j.title)}</a>`,
          esc(j.client_name || "—"),
          esc(j.division),
          pill(j.status),
          fmtDate(j.updated_at),
        ])
      )}
      <div class="two" style="margin-top:28px">
        <div>
          <h2>Upcoming visits</h2>
          ${table(
            ["When", "Property", "Kind"],
            visits.map((v) => [
              fmtDateTime(v.scheduled_at),
              `<a href="/admin/properties/${v.property_id}">${esc(v.property_label)}</a>`,
              esc(v.kind),
            ])
          )}
        </div>
        <div>
          <h2>Waiting on owner</h2>
          ${table(
            ["Repair", "Amount", "Owner"],
            approvals.map((a) => [
              esc(a.title),
              money(a.amount),
              esc(a.owner_name),
            ])
          )}
        </div>
      </div>
    `,
  });
}

function leads(user, flash) {
  const rows = db.listLeads();
  return appLayout({
    title: "Leads",
    user,
    flash,
    current: "/admin/leads",
    body: `
      <h1>Leads</h1>
      <p class="muted">Booking form on the public site lands here. Convert after the first visit.</p>
      ${table(
        ["When", "Name", "Area", "Service", "Status", ""],
        rows.map((l) => [
          fmtDateTime(l.created_at),
          `<a href="/admin/leads/${l.id}">${esc(l.name)}</a><div class="tiny">${esc(l.phone)}</div>`,
          esc(l.area),
          esc(l.service),
          pill(l.status),
          l.status === "new" || l.status === "contacted"
            ? `<form method="post" action="/admin/leads/${l.id}/status"><input type="hidden" name="status" value="contacted"><button class="btn small ghost">Mark contacted</button></form>`
            : "",
        ])
      )}
    `,
  });
}

function leadDetail(user, lead, flash) {
  const customers = db.listCustomers();
  const properties = db.listProperties();
  return appLayout({
    title: lead.name,
    user,
    flash,
    current: "/admin/leads",
    body: `
      <p class="kicker">Lead ${esc(lead.status)}</p>
      <h1>${esc(lead.name)}</h1>
      <p>${esc(lead.phone)} · ${esc(lead.email || "no email")} · ${esc(lead.area)} · ${esc(lead.service)}</p>
      <p>${esc(lead.message || "")}</p>
      ${lead.photo_path ? `<img class="photo" src="${esc(lead.photo_path)}" alt="Uploaded from booking" style="max-width:420px">` : ""}
      <div class="two">
        <form class="stack panel" method="post" action="/admin/leads/${lead.id}/convert">
          <h3>Convert to a job</h3>
          ${field(
            "Existing client",
            `<select name="user_id"><option value="">— new visit only —</option>${selectOptions(
              customers.map((c) => [c.id, c.name]),
              ""
            )}</select>`
          )}
          ${field(
            "Property",
            `<select name="property_id"><option value="">— choose if known —</option>${selectOptions(
              properties.map((p) => [p.id, `${p.label} (${p.area})`]),
              ""
            )}</select>`
          )}
          ${field("Job title", `<input name="title" value="${esc(lead.service)} — ${esc(lead.area)}" required>`)}
          ${field(
            "Division",
            `<select name="division">${selectOptions(
              [
                ["design", "Design"],
                ["renovation", "Renovation"],
                ["maintenance", "Maintenance"],
                ["care", "Property care"],
              ],
              lead.service.includes("design") ? "design" : lead.service.includes("reno") ? "renovation" : "maintenance"
            )}</select>`
          )}
          <button class="btn" type="submit">Create job</button>
        </form>
        <form class="stack panel" method="post" action="/admin/leads/${lead.id}/status">
          <h3>Close without converting</h3>
          <input type="hidden" name="status" value="closed">
          <button class="btn ghost" type="submit">Close lead</button>
        </form>
      </div>
    `,
  });
}

function jobs(user, flash) {
  const rows = db.listJobs();
  return appLayout({
    title: "Jobs",
    user,
    flash,
    current: "/admin/jobs",
    body: `
      <h1>Jobs</h1>
      ${table(
        ["No.", "Title", "Client", "Area", "Division", "Status"],
        rows.map((j) => [
          esc(j.number),
          `<a href="/admin/jobs/${j.id}">${esc(j.title)}</a>`,
          esc(j.client_name || "—"),
          esc(j.area || "—"),
          esc(j.division),
          pill(j.status),
        ])
      )}
    `,
  });
}

function jobDetail(user, job, flash) {
  const quotes = db.listQuotes(job.id);
  const invoices = db.listInvoices({ jobId: job.id });
  const notes = db.listNotes(job.id);
  const photos = db.listPhotos({ jobId: job.id });
  const trades = db.listContractors();
  const assigned = db.jobContractors(job.id);
  const properties = db.listProperties();
  return appLayout({
    title: job.number,
    user,
    flash,
    current: "/admin/jobs",
    body: `
      <p class="kicker">${esc(job.number)} · ${esc(job.division)}</p>
      <h1>${esc(job.title)}</h1>
      <p>${esc(job.client_name || "No client yet")} · ${esc(job.address || job.area || "")} · Coordinator ${esc(job.coordinator)}</p>
      <form method="post" action="/admin/jobs/${job.id}" class="panel stack" style="max-width:720px">
        ${field("Title", `<input name="title" value="${esc(job.title)}" required>`)}
        ${field("Status", `<select name="status">${selectOptions(STATUSES, job.status)}</select>`)}
        ${field("Description", `<textarea name="description">${esc(job.description || "")}</textarea>`)}
        <button class="btn" type="submit">Save job</button>
      </form>
      <h2>Assigned trades</h2>
      <p>${assigned.length ? assigned.map((t) => `${esc(t.name)} (${esc(t.trade)})`).join(" · ") : "None yet."}</p>
      <form method="post" action="/admin/jobs/${job.id}/assign" class="stack" style="max-width:420px">
        ${field(
          "Add contractor",
          `<select name="contractor_id">${selectOptions(
            trades.map((t) => [t.id, `${t.name} — ${t.trade}`]),
            ""
          )}</select>`
        )}
        <button class="btn small" type="submit">Assign</button>
      </form>
      <h2>Quotations</h2>
      ${quotes
        .map((q) => {
          const items = JSON.parse(q.items_json || "[]");
          return `<div class="panel"><strong>${esc(q.number)}</strong> ${pill(q.status)} · ${money(q.total)}
            <ul>${items.map((i) => `<li>${esc(i.desc)} — ${money(i.amount)}</li>`).join("")}</ul>
            ${
              q.status !== "accepted"
                ? `<form method="post" action="/admin/quotes/${q.id}/accept"><button class="btn small">Mark accepted</button></form>`
                : ""
            }
          </div>`;
        })
        .join("") || "<p class='muted'>No quotations yet.</p>"}
      <form class="panel stack" method="post" action="/admin/jobs/${job.id}/quote">
        <h3>New quotation</h3>
        <div class="line-items">
          <div class="row"><input name="desc1" placeholder="Line item"><input name="qty1" type="number" value="1"><input name="amt1" type="number" placeholder="LKR"></div>
          <div class="row"><input name="desc2" placeholder="Line item"><input name="qty2" type="number" value="1"><input name="amt2" type="number" placeholder="LKR"></div>
          <div class="row"><input name="desc3" placeholder="Line item"><input name="qty3" type="number" value="1"><input name="amt3" type="number" placeholder="LKR"></div>
        </div>
        <button class="btn" type="submit">Send quotation</button>
      </form>
      <h2>Invoices</h2>
      ${table(
        ["No.", "Title", "Amount", "Status", ""],
        invoices.map((i) => [
          esc(i.number),
          esc(i.title),
          money(i.amount),
          pill(i.status),
          i.status !== "paid"
            ? `<form method="post" action="/admin/invoices/${i.id}/paid"><button class="btn small">Mark paid</button></form>`
            : fmtDate(i.paid_at),
        ])
      )}
      <form class="panel stack" method="post" action="/admin/jobs/${job.id}/invoice" style="max-width:480px">
        <h3>Raise invoice</h3>
        ${field("Title", `<input name="title" value="Progress payment" required>`)}
        ${field("Amount (LKR)", `<input type="number" name="amount" required>`)}
        ${field("Due date", `<input type="date" name="due_date">`)}
        <button class="btn" type="submit">Create invoice</button>
      </form>
      <h2>Photos</h2>
      <div class="photos">${photos.map((p) => `<figure><img class="photo" src="${esc(p.path)}" alt=""><figcaption>${esc(p.kind)} · ${esc(p.caption || "")}</figcaption></figure>`).join("")}</div>
      <form class="panel stack" method="post" action="/admin/jobs/${job.id}/photo" style="max-width:520px">
        <h3>Add photo URL</h3>
        ${field("URL", `<input name="path" required placeholder="https://… or /uploads/…">`)}
        ${field("Caption", `<input name="caption">`)}
        ${field("Kind", `<select name="kind">${selectOptions(
          [
            ["before", "Before"],
            ["after", "After"],
            ["report", "Report"],
          ],
          "after"
        )}</select>`)}
        <button class="btn small" type="submit">Attach</button>
      </form>
      <h2>Site notes</h2>
      ${notes.map((n) => `<div class="note"><strong>${esc(n.author)}</strong> · ${fmtDateTime(n.created_at)}<p>${esc(n.body)}</p></div>`).join("")}
      <form class="stack" method="post" action="/admin/jobs/${job.id}/note" style="max-width:560px">
        <textarea name="body" required placeholder="Site note"></textarea>
        <button class="btn small" type="submit">Add note</button>
      </form>
      <h2>Ask owner to approve a repair</h2>
      <form class="panel stack" method="post" action="/admin/jobs/${job.id}/approval" style="max-width:520px">
        ${field(
          "Property",
          `<select name="property_id">${selectOptions(
            properties.map((p) => [p.id, p.label]),
            job.property_id || ""
          )}</select>`
        )}
        ${field("Title", `<input name="title" required>`)}
        ${field("Amount (LKR)", `<input type="number" name="amount" required>`)}
        ${field("Why", `<textarea name="description"></textarea>`)}
        <button class="btn" type="submit">Send for approval</button>
      </form>
    `,
  });
}

function properties(user, flash) {
  const rows = db.listProperties();
  const customers = db.listCustomers();
  return appLayout({
    title: "Properties",
    user,
    flash,
    current: "/admin/properties",
    body: `
      <h1>Properties</h1>
      ${table(
        ["Property", "Owner", "Area", "Care", "Fee"],
        rows.map((p) => [
          `<a href="/admin/properties/${p.id}">${esc(p.label)}</a><div class="tiny">${esc(p.address)}</div>`,
          esc(p.owner_name),
          esc(p.area),
          p.tier ? pill(p.tier) : "—",
          p.monthly_fee ? money(p.monthly_fee) : "—",
        ])
      )}
      <form class="panel stack" method="post" action="/admin/properties" style="max-width:560px;margin-top:24px">
        <h3>Add property</h3>
        ${field("Owner", `<select name="user_id">${selectOptions(customers.map((c) => [c.id, c.name]), "")}</select>`)}
        ${field("Label", `<input name="label" required>`)}
        ${field("Address", `<input name="address" required>`)}
        ${field("Area", `<input name="area" required>`)}
        ${field("Kind", `<select name="kind">${selectOptions(
          [
            ["house", "House"],
            ["apartment", "Apartment"],
          ],
          "house"
        )}</select>`)}
        ${field("Care tier", `<select name="tier"><option value="">None yet</option>${selectOptions(
          [
            ["basic", "Basic"],
            ["standard", "Standard"],
            ["premium", "Premium"],
          ],
          ""
        )}</select>`)}
        ${field("Monthly fee", `<input type="number" name="monthly_fee">`)}
        <button class="btn" type="submit">Save property</button>
      </form>
    `,
  });
}

function propertyDetail(user, property, flash) {
  const visits = db.listVisits({ propertyId: property.id });
  return appLayout({
    title: property.label,
    user,
    flash,
    current: "/admin/properties",
    body: `
      <p class="kicker">${esc(property.area)} · ${esc(property.kind)}</p>
      <h1>${esc(property.label)}</h1>
      <p>${esc(property.address)}<br>Owner ${esc(property.owner_name)} · ${esc(property.owner_email)}</p>
      <p>${property.tier ? `${pill(property.tier)} ${money(property.monthly_fee)} / month` : "No care plan"}</p>
      <p>${esc(property.notes || "")}</p>
      <h2>Visits</h2>
      ${table(
        ["When", "Kind", "Status", "Summary"],
        visits.map((v) => [fmtDateTime(v.scheduled_at), esc(v.kind), pill(v.status), esc(v.summary || "—")])
      )}
      <form class="panel stack" method="post" action="/admin/visits" style="max-width:480px">
        <h3>Schedule visit</h3>
        <input type="hidden" name="property_id" value="${esc(property.id)}">
        ${field("When", `<input type="datetime-local" name="scheduled_at" required>`)}
        ${field("Kind", `<select name="kind">${selectOptions(
          [
            ["inspection", "Inspection"],
            ["repair", "Repair"],
            ["handover", "Handover"],
          ],
          "inspection"
        )}</select>`)}
        ${field("Note", `<input name="summary">`)}
        <button class="btn" type="submit">Schedule</button>
      </form>
    `,
  });
}

function visits(user, flash) {
  const rows = db.listVisits();
  const properties = db.listProperties();
  return appLayout({
    title: "Visits",
    user,
    flash,
    current: "/admin/visits",
    body: `
      <h1>Visits</h1>
      ${table(
        ["When", "Property", "Owner", "Kind", "Status", ""],
        rows.map((v) => [
          fmtDateTime(v.scheduled_at),
          `<a href="/admin/properties/${v.property_id}">${esc(v.property_label)}</a>`,
          esc(v.owner_name || ""),
          esc(v.kind),
          pill(v.status),
          v.status === "scheduled"
            ? `<form method="post" action="/admin/visits/${v.id}/complete"><input name="summary" placeholder="Report note" required> <button class="btn small">Complete + report</button></form>`
            : `<a href="/admin/visits/${v.id}">Report</a>`,
        ])
      )}
      <form class="panel stack" method="post" action="/admin/visits" style="max-width:480px;margin-top:24px">
        <h3>Schedule visit</h3>
        ${field("Property", `<select name="property_id">${selectOptions(properties.map((p) => [p.id, p.label]), "")}</select>`)}
        ${field("When", `<input type="datetime-local" name="scheduled_at" required>`)}
        ${field("Kind", `<select name="kind">${selectOptions(
          [
            ["inspection", "Inspection"],
            ["repair", "Repair"],
            ["handover", "Handover"],
          ],
          "inspection"
        )}</select>`)}
        <button class="btn" type="submit">Schedule</button>
      </form>
    `,
  });
}

function visitDetail(user, visit, flash) {
  const photos = db.listPhotos({ visitId: visit.id });
  return appLayout({
    title: "Visit report",
    user,
    flash,
    current: "/admin/visits",
    body: `
      <p class="kicker">${esc(visit.kind)} · ${pill(visit.status)}</p>
      <h1>${esc(visit.property_label)}</h1>
      <p>${fmtDateTime(visit.scheduled_at)} · ${esc(visit.owner_name)}</p>
      <p>${esc(visit.summary || "No summary yet.")}</p>
      <div class="photos">${photos.map((p) => `<figure><img class="photo" src="${esc(p.path)}" alt=""><figcaption>${esc(p.caption || "")}</figcaption></figure>`).join("")}</div>
    `,
  });
}

function trades(user, flash) {
  const rows = db.listContractors();
  return appLayout({
    title: "Trades",
    user,
    flash,
    current: "/admin/trades",
    body: `
      <h1>Trade bench</h1>
      ${table(
        ["Name", "Trade", "Phone", "Day rate", "Notes"],
        rows.map((t) => [esc(t.name), esc(t.trade), esc(t.phone), money(t.daily_rate), esc(t.notes || "")])
      )}
      <form class="panel stack" method="post" action="/admin/trades" style="max-width:520px;margin-top:24px">
        <h3>Add contractor</h3>
        ${field("Name", `<input name="name" required>`)}
        ${field("Trade", `<input name="trade" required>`)}
        ${field("Phone", `<input name="phone" required>`)}
        ${field("Daily rate", `<input type="number" name="daily_rate">`)}
        ${field("Notes", `<input name="notes">`)}
        <button class="btn" type="submit">Save</button>
      </form>
    `,
  });
}

function moneyPage(user, flash) {
  const quotes = db.listQuotes();
  const invoices = db.listInvoices();
  return appLayout({
    title: "Money",
    user,
    flash,
    current: "/admin/money",
    body: `
      <h1>Quotations and invoices</h1>
      <h2>Quotations</h2>
      ${table(
        ["No.", "Job", "Total", "Status"],
        quotes.map((q) => [esc(q.number), `<a href="/admin/jobs/${q.job_id}">${esc(q.job_number)} ${esc(q.job_title)}</a>`, money(q.total), pill(q.status)])
      )}
      <h2>Invoices</h2>
      ${table(
        ["No.", "Client", "Title", "Amount", "Status", ""],
        invoices.map((i) => [
          esc(i.number),
          esc(i.client_name || "—"),
          esc(i.title),
          money(i.amount),
          pill(i.status),
          i.status !== "paid"
            ? `<form method="post" action="/admin/invoices/${i.id}/paid"><button class="btn small">Mark paid</button></form>`
            : fmtDate(i.paid_at),
        ])
      )}
    `,
  });
}

function studio(user, flash) {
  const items = db.listGalleryAll();
  return appLayout({
    title: "Studio",
    user,
    flash,
    current: "/admin/studio",
    body: `
      <p class="kicker">Lookbook</p>
      <h1>Add designs and renovation photos</h1>
      <p class="muted">Published items appear on Design or Renovate. Click a thumbnail on the public site to pop it open.</p>
      <form class="panel stack" method="post" action="/admin/studio" enctype="multipart/form-data" style="max-width:640px">
        ${field("Title", `<input name="title" required placeholder="Ice-blue kitchen">`)}
        ${field("Caption", `<input name="caption" placeholder="Handleless, quartz, tropical light">`)}
        ${field("Category", `<select name="category">${selectOptions(
          [
            ["design", "Design idea"],
            ["renovate", "Renovation idea"],
          ],
          "design"
        )}</select>`)}
        ${field("Room", `<select name="room">${selectOptions(
          [
            ["Living", "Living"],
            ["Kitchen", "Kitchen"],
            ["Bedroom", "Bedroom"],
            ["Bathroom", "Bathroom"],
            ["Dining", "Dining"],
            ["Exterior", "Exterior"],
          ],
          "Living"
        )}</select>`)}
        ${field("Image", `<input type="file" name="photo" accept="image/*" required>`)}
        <label class="field"><span><input type="checkbox" name="trending" value="1" checked> Mark as trending</span></label>
        <button class="btn" type="submit">Publish to the site</button>
      </form>
      <h2>On the site now</h2>
      <div class="idea-grid">
        ${items
          .map(
            (item) => `<div class="studio-item">
            ${ideaCard(item, false)}
            <form method="post" action="/admin/studio/${item.id}/delete">
              <button class="btn small ghost" type="submit">Remove</button>
            </form>
          </div>`
          )
          .join("")}
      </div>
    `,
  });
}

function visualise(user, flash, current) {
  const rows = db.listVisualisations();
  const leads = db.listLeads();
  return appLayout({
    title: "2D / 3D",
    user,
    flash,
    current: "/admin/visualise",
    body: `
      <p class="kicker">From the brief</p>
      <h1>Generate a 2D plan or 3D concept</h1>
      <p class="muted">Enter the customer’s property details and photos. The desk draws an ice-blue 2D floor plan or a 3D interior concept you can publish to Design.</p>
      <form class="panel stack" method="post" action="/admin/visualise" enctype="multipart/form-data">
        ${field("Customer name", `<input name="client_name" required placeholder="Amaya Wickramasinghe">`)}
        ${field("Address", `<input name="address" placeholder="18 Pagoda Road, Nugegoda">`)}
        ${field("Area", `<input name="area" value="Nugegoda">`)}
        ${field("Property type", `<select name="kind">${selectOptions(
          [
            ["house", "House"],
            ["apartment", "Apartment"],
          ],
          "house"
        )}</select>`)}
        ${field("Floor area (sq ft)", `<input type="number" name="sqft" value="1500">`)}
        ${field("Rooms (comma separated)", `<input name="rooms" value="Living, Kitchen, Bedroom, Bedroom, Bathroom">`)}
        ${field("Style", `<select name="style">${selectOptions(
          [
            ["ice", "Ice blue / white"],
            ["tropical", "Tropical Colombo"],
            ["minimal", "Minimal white"],
            ["luxury", "Warm luxury"],
          ],
          "ice"
        )}</select>`)}
        ${field("Generate", `<select name="mode">${selectOptions(
          [
            ["2d", "2D floor plan"],
            ["3d", "3D interior concept"],
          ],
          "3d"
        )}</select>`)}
        ${field("Requirements", `<textarea name="notes" placeholder="Keep the rear wall. Ice-blue kitchen island. More light in the hall."></textarea>`)}
        ${field("Property photos", `<input type="file" name="photos" accept="image/*" multiple>`)}
        ${
          leads.length
            ? field(
                "Or pull a lead name",
                `<select name="lead_hint"><option value="">—</option>${selectOptions(
                  leads.map((l) => [l.name, l.name + " · " + l.area]),
                  ""
                )}</select>`
              )
            : ""
        }
        <button class="btn" type="submit">Generate visualisation</button>
      </form>
      <h2>Generated</h2>
      ${table(
        ["When", "Client", "Mode", ""],
        rows.map((v) => [
          fmtDateTime(v.created_at),
          `<a href="/admin/visualise/${v.id}">${esc(v.client_name)}</a><div class="tiny">${esc(v.address || "")}</div>`,
          esc(v.mode.toUpperCase()),
          v.published ? "On site" : `<form method="post" action="/admin/visualise/${v.id}/publish"><button class="btn small">Publish to Design</button></form>`,
        ])
      )}
    `,
  });
}

function visualiseDetail(user, vis, flash) {
  return appLayout({
    title: vis.client_name,
    user,
    flash,
    current: "/admin/visualise",
    body: `
      <p class="kicker">${esc(vis.mode.toUpperCase())} · ${esc(vis.style)}</p>
      <h1>${esc(vis.client_name)}</h1>
      <p>${esc(vis.address || "")} · ${esc(String(vis.sqft || ""))} sq ft · ${esc(vis.rooms || "")}</p>
      <p>${esc(vis.notes || "")}</p>
      <div class="vis-frame look-frame">
        <img class="look-img" src="${esc(vis.result_path)}" alt="Generated visualisation">
      </div>
      <div class="actions">
        <a class="btn ghost" href="${esc(vis.result_path)}" download>Download SVG</a>
        ${
          vis.published
            ? ""
            : `<form method="post" action="/admin/visualise/${vis.id}/publish"><button class="btn">Publish to Design</button></form>`
        }
      </div>
    `,
  });
}

module.exports = {
  overview,
  leads,
  leadDetail,
  jobs,
  jobDetail,
  properties,
  propertyDetail,
  visits,
  visitDetail,
  trades,
  moneyPage,
  studio,
  visualise,
  visualiseDetail,
};
