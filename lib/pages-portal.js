"use strict";

const db = require("./db");
const { appLayout, esc, money, fmtDate, fmtDateTime, pill, table } = require("./ui");

function home(user, flash) {
  const properties = db.listProperties(user.userId);
  const visits = db.listVisits({ userId: user.userId });
  const upcoming = visits.filter((v) => v.status === "scheduled").slice(0, 5);
  const approvals = db.listApprovals({ userId: user.userId }).filter((a) => a.status === "pending");
  const invoices = db.listInvoices({ userId: user.userId });
  return appLayout({
    title: "Your property",
    user,
    flash,
    current: "/portal",
    body: `
      <p class="kicker">Owner portal</p>
      <h1>Hello ${esc(user.name.split(" ")[0])}.</h1>
      <p class="lede">Inspections, jobs, and anything over LKR 15,000 wait here — not in a family WhatsApp thread.</p>
      <div class="stat-row">
        <div class="stat"><div class="price">${properties.length}</div><p>Properties</p></div>
        <div class="stat"><div class="price">${upcoming.length}</div><p>Upcoming visits</p></div>
        <div class="stat"><div class="price">${approvals.length}</div><p>Waiting your approval</p></div>
        <div class="stat"><div class="price">${money(invoices.filter((i) => i.status === "due").reduce((s, i) => s + i.amount, 0))}</div><p>Due</p></div>
      </div>
      <h2>Properties</h2>
      ${properties
        .map(
          (p) => `<div class="panel">
            <h3>${esc(p.label)}</h3>
            <p>${esc(p.address)}</p>
            <p>${p.tier ? `${pill(p.tier)} ${money(p.monthly_fee)} / month` : "No care plan yet"}</p>
          </div>`
        )
        .join("")}
      <h2>Next visits</h2>
      ${table(
        ["When", "Property", "Kind"],
        upcoming.map((v) => [fmtDateTime(v.scheduled_at), esc(v.property_label), esc(v.kind)])
      )}
      ${
        approvals.length
          ? `<h2>Approve a repair</h2>${approvals
              .map(
                (a) => `<div class="panel">
            <h3>${esc(a.title)}</h3>
            <p>${esc(a.description || "")}</p>
            <p class="price">${money(a.amount)}</p>
            <form method="post" action="/portal/approvals/${a.id}" style="display:flex;gap:8px">
              <button class="btn ok" name="decision" value="approved">Approve</button>
              <button class="btn warn" name="decision" value="rejected">Reject</button>
            </form>
          </div>`
              )
              .join("")}`
          : ""
      }
    `,
  });
}

function jobs(user, flash) {
  const rows = db.listJobs({ userId: user.userId });
  return appLayout({
    title: "Jobs",
    user,
    flash,
    current: "/portal/jobs",
    body: `
      <h1>Jobs</h1>
      ${table(
        ["No.", "Title", "Division", "Status", "Updated"],
        rows.map((j) => [
          esc(j.number),
          `<a href="/portal/jobs/${j.id}">${esc(j.title)}</a>`,
          esc(j.division),
          pill(j.status),
          fmtDate(j.updated_at),
        ])
      )}
    `,
  });
}

function jobDetail(user, job, flash) {
  const quotes = db.listQuotes(job.id);
  const photos = db.listPhotos({ jobId: job.id });
  const notes = db.listNotes(job.id);
  return appLayout({
    title: job.title,
    user,
    flash,
    current: "/portal/jobs",
    body: `
      <p class="kicker">${esc(job.number)} · ${pill(job.status)}</p>
      <h1>${esc(job.title)}</h1>
      <p>${esc(job.description || "")}</p>
      <h2>Quotations</h2>
      ${quotes
        .map((q) => {
          const items = JSON.parse(q.items_json || "[]");
          return `<div class="panel"><strong>${esc(q.number)}</strong> ${pill(q.status)} · ${money(q.total)}
            <ul>${items.map((i) => `<li>${esc(i.desc)} — ${money(i.amount)}</li>`).join("")}</ul>
            ${
              q.status === "sent"
                ? `<form method="post" action="/portal/quotes/${q.id}/accept"><button class="btn">Accept quotation</button></form>`
                : ""
            }
          </div>`;
        })
        .join("") || "<p>No quotations yet.</p>"}
      <h2>Before and after</h2>
      <div class="photos">${photos.map((p) => `<figure><img class="photo" src="${esc(p.path)}" alt=""><figcaption>${esc(p.kind)} · ${esc(p.caption || "")}</figcaption></figure>`).join("")}</div>
      <h2>Coordinator notes</h2>
      ${notes.map((n) => `<div class="note"><strong>${esc(n.author)}</strong> · ${fmtDateTime(n.created_at)}<p>${esc(n.body)}</p></div>`).join("")}
    `,
  });
}

function visits(user, flash) {
  const rows = db.listVisits({ userId: user.userId });
  return appLayout({
    title: "Visits",
    user,
    flash,
    current: "/portal/visits",
    body: `
      <h1>Inspections and visits</h1>
      ${table(
        ["When", "Property", "Kind", "Status", ""],
        rows.map((v) => [
          fmtDateTime(v.scheduled_at),
          esc(v.property_label),
          esc(v.kind),
          pill(v.status),
          `<a href="/portal/visits/${v.id}">Report</a>`,
        ])
      )}
    `,
  });
}

function visitDetail(user, visit, flash) {
  const photos = db.listPhotos({ visitId: visit.id });
  return appLayout({
    title: "Inspection report",
    user,
    flash,
    current: "/portal/visits",
    body: `
      <p class="kicker">${esc(visit.kind)} · ${fmtDateTime(visit.scheduled_at)}</p>
      <h1>${esc(visit.property_label)}</h1>
      <p>${esc(visit.address)}</p>
      <p>${esc(visit.summary || "The coordinator has not filed this report yet.")}</p>
      <div class="photos">${photos.map((p) => `<figure><img class="photo" src="${esc(p.path)}" alt=""><figcaption>${esc(p.caption || "")}</figcaption></figure>`).join("")}</div>
    `,
  });
}

function payments(user, flash) {
  const invoices = db.listInvoices({ userId: user.userId });
  return appLayout({
    title: "Payments",
    user,
    flash,
    current: "/portal/payments",
    body: `
      <h1>Payments</h1>
      <p class="muted">Pay by bank transfer using the invoice number as the reference. Marking paid is done by the coordinator after the slip.</p>
      ${table(
        ["Invoice", "For", "Amount", "Status", "Due"],
        invoices.map((i) => [esc(i.number), esc(i.title), money(i.amount), pill(i.status), fmtDate(i.due_date)])
      )}
    `,
  });
}

function approvals(user, flash) {
  const rows = db.listApprovals({ userId: user.userId });
  return appLayout({
    title: "Approvals",
    user,
    flash,
    current: "/portal/approvals",
    body: `
      <h1>Repair approvals</h1>
      <p class="muted">Anything over LKR 15,000 waits here.</p>
      ${rows
        .map(
          (a) => `<div class="panel">
          <p class="tiny">${esc(a.property_label)} · ${pill(a.status)} · ${fmtDate(a.created_at)}</p>
          <h3>${esc(a.title)}</h3>
          <p>${esc(a.description || "")}</p>
          <p class="price">${money(a.amount)}</p>
          ${
            a.status === "pending"
              ? `<form method="post" action="/portal/approvals/${a.id}" style="display:flex;gap:8px">
              <button class="btn ok" name="decision" value="approved">Approve</button>
              <button class="btn warn" name="decision" value="rejected">Reject</button>
            </form>`
              : `<p class="tiny">Decided ${fmtDateTime(a.decided_at)}</p>`
          }
        </div>`
        )
        .join("") || "<p>No approvals yet.</p>"}
    `,
  });
}

module.exports = { home, jobs, jobDetail, visits, visitDetail, payments, approvals };
