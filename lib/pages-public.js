"use strict";

const db = require("./db");
const { siteLayout, esc, money, field, selectOptions, ideaCard } = require("./ui");

const AREAS = [
  ["Nugegoda", "House refresh, kitchens, leaks"],
  ["Rajagiriya", "Apartments, AC, empty-house care"],
  ["Battaramulla", "Newer houses and interiors"],
  ["Dehiwala", "Older houses and roofs"],
  ["Colombo 05–07", "Premium interiors and aftercare"],
];

const SERVICES = [
  ["maintenance", "Monthly care / inspection"],
  ["interior-design", "Interior design"],
  ["renovation", "Renovation"],
  ["property-care", "Overseas property care"],
  ["virtual-consult", "30-minute virtual consult"],
  ["empty-handover", "Empty-house handover"],
  ["rental-refresh", "Tenant-ready refresh"],
  ["monsoon-check", "Monsoon home-health check"],
];

const LOOKS = {
  ice: {
    title: "Ice Blue / White",
    copy: "Pale oak, sheer curtains, handleless cabinetry. This is the lookbook on the site — and the default for 2D/3D generation.",
  },
  tropical: {
    title: "Tropical Colombo",
    copy: "Garden green, timber, indoor-outdoor dining. We keep the rear wall and the breeze, then cool the floors.",
  },
  minimal: {
    title: "Minimal White",
    copy: "Gallery walls, hidden storage, north light. Fewer objects, more air. Strong in apartments.",
  },
  luxury: {
    title: "Warm Luxury",
    copy: "Stone, brass, evening lamps. Prestige finish. We still write every line item.",
  },
};

function pickLook(fields) {
  const votes = [fields.feel, fields.kitchen, fields.light].filter(Boolean);
  const tally = {};
  for (const v of votes) tally[v] = (tally[v] || 0) + 1;
  const key = (Object.entries(tally).sort((a, b) => b[1] - a[1])[0] || ["ice"])[0];
  const look = LOOKS[key] || LOOKS.ice;
  return { key, title: look.title, copy: look.copy };
}

function radio(name, value, label, current, fallback) {
  const on = current ? current === value : value === fallback;
  return `<label><input type="radio" name="${esc(name)}" value="${esc(value)}" ${on ? "checked" : ""}> ${esc(label)}</label>`;
}

function trustRow() {
  const items = [
    ["01", "Named coordinator", "One WhatsApp thread. No call-centre shuffle."],
    ["02", "Line-item quotes", "Materials, labour and contingency, written out."],
    ["03", "Photos after every visit", "Dated, labelled, in the owner portal."],
    ["04", "12-month labour warranty", "Six months on repairs. Twelve on renovation."],
  ];
  return `<div class="trust-row">${items
    .map(([n, t, d]) => `<article class="stat"><span class="num">${n}</span><h3>${t}</h3><p class="tiny">${d}</p></article>`)
    .join("")}</div>`;
}

function quotes() {
  return `
    <section class="section">
      <p class="kicker">Clients</p>
      <h2>Houses we already run.</h2>
      <div class="quote-grid">
        <blockquote class="quote-card">
          <p>“I get dated photographs of the Rajagiriya house before I leave for work in London. When the tank needed cleaning I tapped approve. That is the product.”</p>
          <footer>Nisha Perera · Premium Care · London</footer>
        </blockquote>
        <blockquote class="quote-card">
          <p>“The bathroom quote had waterproofing as its own line. They did not vanish into a lump sum. The after photos matched the drawing.”</p>
          <footer>Ruwan Fernando · Nugegoda bathroom · PH-001</footer>
        </blockquote>
        <blockquote class="quote-card">
          <p>“They sent a 2D plan and an ice-blue 3D concept from the photos I emailed. We built the kitchen they drew.”</p>
          <footer>Amaya Wickramasinghe · Pagoda Road kitchen</footer>
        </blockquote>
      </div>
    </section>`;
}

function ctaBand(title, lede, href, label) {
  return `
    <section class="cta-band">
      <div>
        <p class="kicker">Next step</p>
        <h2>${title}</h2>
        <p>${lede}</p>
      </div>
      <a class="btn" href="${href}">${label}</a>
    </section>`;
}

function home(user, flash) {
  const look = db.listGallery("design").slice(0, 4);
  return siteLayout({
    title: "The operating company for your house",
    user,
    flash,
    pageClass: "home",
    body: `
      <section class="hero-stage">
        <div class="hero-copy">
          <p class="kicker">Colombo property studio, 2026</p>
          <h1>Design it. Build the contained work. Then keep the house.</h1>
          <p class="lede">A professional desk for interior design, renovation, monthly care and overseas inspections — in a forty-minute ring of Colombo. Ice-blue, white, and written quotations.</p>
          <div class="actions">
            <a class="btn" href="/book">Book a site visit</a>
            <a class="btn ghost" href="/estimate">Instant estimate</a>
            <a class="btn ghost" href="/style">Find your style</a>
          </div>
        </div>
        <div class="hero-photos">
          <img src="/gallery/design-living-ice.jpg" alt="Ice-blue Colombo living room">
          <div class="hero-stack">
            <img src="/gallery/design-kitchen-ice.jpg" alt="White ice kitchen">
            <img src="/gallery/reno-bathroom.jpg" alt="Renovated bathroom">
          </div>
        </div>
      </section>
      <section class="section">${trustRow()}</section>
      <section class="section">
        <p class="kicker">Four divisions</p>
        <h2>One brand. Four desks that actually talk.</h2>
        <div class="service-grid">
          <a class="service-card" href="/design">
            <img src="/gallery/design-bedroom-ice.jpg" alt="">
            <span class="num">01</span>
            <h3>Interior design</h3>
            <p>2D layouts, 3D concepts and a material board. From LKR 95 / sq ft, credited if you build with us.</p>
          </a>
          <a class="service-card" href="/renovate">
            <img src="/gallery/reno-kitchen.jpg" alt="">
            <span class="num">02</span>
            <h3>Renovation</h3>
            <p>Kitchens, bathrooms, painting, floors, roofs and first-fix. Additional floors wait for an engineer.</p>
          </a>
          <a class="service-card" href="/care">
            <img src="/gallery/reno-living.jpg" alt="">
            <span class="num">03</span>
            <h3>Monthly care</h3>
            <p>The visit and the report are included. The plumber is billed after you approve the work.</p>
          </a>
          <a class="service-card" href="/overseas">
            <img src="/gallery/design-living-ice.jpg" alt="">
            <span class="num">04</span>
            <h3>Overseas owners</h3>
            <p>Dated photographs, a bilingual report, and an approval button from London, Dubai or Melbourne.</p>
          </a>
        </div>
      </section>
      <section class="band">
        <div class="section">
          <p class="kicker">New for 2026</p>
          <h2>Studio products the market is missing.</h2>
          <div class="offer-grid">
            <article class="panel">
              <h3>Instant estimate</h3>
              <p>A public calculator for design, kitchens, bathrooms and full refreshes — then a coordinator confirms on WhatsApp.</p>
              <a href="/estimate">Run the numbers</a>
            </article>
            <article class="panel">
              <h3>Style quiz</h3>
              <p>Four questions. A recommended look — Ice Blue, Tropical Colombo, Minimal White or Warm Luxury — matched to our 2D/3D studio.</p>
              <a href="/style">Take the quiz</a>
            </article>
            <article class="panel">
              <h3>Empty-house handover</h3>
              <p>Keys, meter photos, snag list and a 14-day punch list when a tenant leaves or you fly in.</p>
              <a href="/packages">See packages</a>
            </article>
            <article class="panel">
              <h3>Tenant-ready in seven days</h3>
              <p>Paint, lights, silicone, basic joinery and a photo set so the house can be listed without a cousin’s weekend.</p>
              <a href="/packages">Rental refresh</a>
            </article>
          </div>
        </div>
      </section>
      <section class="section">
        <div class="section-head">
          <div>
            <p class="kicker">Lookbook</p>
            <h2>Trending ice-blue interiors. Click to open.</h2>
          </div>
          <a class="btn ghost" href="/design">All design ideas</a>
        </div>
        <div class="idea-grid">
          ${look.map((item, i) => ideaCard(item, i === 0)).join("")}
        </div>
      </section>
      ${quotes()}
      <section class="section split">
        <div>
          <p class="kicker">Launch geography</p>
          <h1>A forty-minute ring. Not the whole island.</h1>
          <p>We stay close enough that a coordinator can stand in the house the same afternoon. That is the promise overseas owners actually buy.</p>
          <div class="area-row dense">
            ${AREAS.map(([name, job]) => `<div class="area-chip"><strong>${esc(name)}</strong><p class="tiny">${esc(job)}</p></div>`).join("")}
          </div>
        </div>
        <img class="photo" alt="Renovated Colombo living" src="/gallery/reno-living.jpg">
      </section>
      ${ctaBand("Tell us the house. We will come.", "Design visits are free in the five launch areas and credited if you proceed.", "/book", "Book a visit")}
    `,
  });
}

function care(user) {
  const plans = [
    {
      name: "Basic Care",
      price: 12000,
      includes: ["One inspection", "Photo report", "Punch-list", "48-hour non-emergency window"],
      extra: "All repairs, materials, cleaning, garden work.",
    },
    {
      name: "Standard Care",
      price: 22000,
      featured: true,
      includes: ["Inspection", "Plumbing and electrical visual check", "Priority booking of trades", "Monthly summary"],
      extra: "Trade labour, parts, AC gas, tank cleaning.",
    },
    {
      name: "Premium Care",
      price: 40000,
      note: "or 10% of rent, whichever is higher",
      includes: ["Two inspections", "Cleaning coordination", "Emergency phone", "Tenant repair desk", "Bilingual report"],
      extra: "Repairs over LKR 15,000, legal work, rent collection.",
    },
  ];
  return siteLayout({
    title: "Monthly care membership",
    user,
    body: `
      <section class="hero">
        <p class="kicker">Membership, not a one-off plumber</p>
        <h1>The visit and the report are included. The plumber is not.</h1>
        <p class="lede">A professional care desk for Colombo houses: scheduled eyes on the property, a named coordinator, and repairs only after you approve the line items.</p>
      </section>
      <section class="section plan-grid">
        ${plans
          .map(
            (p) => `
          <article class="plan ${p.featured ? "featured" : ""}">
            ${p.featured ? `<span class="ribbon">Most chosen</span>` : ""}
            <h3>${esc(p.name)}</h3>
            <div class="price">${money(p.price)}<span class="tiny"> / month</span></div>
            ${p.note ? `<p class="tiny">${esc(p.note)}</p>` : ""}
            <ul class="ticks">${p.includes.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>
            <p class="muted">Billed extra: ${esc(p.extra)}</p>
            <a class="btn small" href="/book?service=maintenance">Request this plan</a>
          </article>`
          )
          .join("")}
      </section>
      <section class="section two">
        <div class="panel">
          <h3>Add a monsoon check</h3>
          <p>April and October: roof, gutters, drains, AC trays and a leak walk. LKR 18,000 as a standalone visit, or included in Premium.</p>
        </div>
        <div class="panel">
          <h3>After a renovation</h3>
          <p>The first three months of Standard Care are complimentary on jobs over LKR 800,000. Warranty claims go through the same coordinator.</p>
        </div>
      </section>
      ${ctaBand("Put the house on a calendar.", "We confirm the first inspection on WhatsApp within one working day.", "/book?service=maintenance", "Start a care plan")}
    `,
  });
}

function design(user) {
  const ideas = db.listGallery("design");
  const rooms = [...new Set(ideas.map((i) => i.room).filter(Boolean))];
  return siteLayout({
    title: "Interior design studio",
    user,
    body: `
      <section class="hero-stage compact">
        <div class="hero-copy">
          <p class="kicker">2026 lookbook</p>
          <h1>Ice-blue, white, and air. A Colombo studio, not a European catalogue.</h1>
          <p class="lede">Trending interiors with pale oak, handleless kitchens and linen bedrooms. Design from LKR 95 / sq ft. 2D, 3D and a material board — credited if you build with us.</p>
          <div class="actions">
            <a class="btn" href="/book?service=interior-design">Book a design visit</a>
            <a class="btn ghost" href="/style">Take the style quiz</a>
          </div>
        </div>
        <img class="photo hero-one" src="/gallery/design-kitchen-ice.jpg" alt="Ice-blue kitchen">
      </section>
      <section class="section">
        <div class="filters" data-filter-group=".idea-card">
          <button type="button" class="active" data-filter="all">All</button>
          ${rooms.map((r) => `<button type="button" data-filter="${esc(r)}">${esc(r)}</button>`).join("")}
        </div>
        <div class="idea-grid">
          ${ideas.map((item, i) => ideaCard(item, i === 0 || i === 5)).join("")}
        </div>
      </section>
      <section class="section two">
        <div class="panel">
          <h3>What the fee covers</h3>
          <p>Site visit in the five launch areas. 2D layout, three revision rounds, material board, electrical mark-up, and 3D views. A 1,500 sq ft home from LKR 142,500.</p>
        </div>
        <div class="panel">
          <h3>Admin can add to this board</h3>
          <p>New images publish from the studio desk. Generated 2D/3D concepts can be posted here so clients see their own house, not stock.</p>
          <a class="btn ghost" href="/estimate">Price a design package</a>
        </div>
      </section>
    `,
  });
}

function renovate(user) {
  const ideas = db.listGallery("renovate");
  const rooms = [...new Set(ideas.map((i) => i.room).filter(Boolean))];
  return siteLayout({
    title: "Renovation studio",
    user,
    body: `
      <section class="hero">
        <p class="kicker">After photos, not moodboards only</p>
        <h1>Kitchens, bathrooms and living rooms — tap an image to open it.</h1>
        <p class="lede">A three-bed moderate refresh is about LKR 1 million plus 10–15% contingency. Bathrooms typically LKR 250,000–600,000. Additional floors still need an engineer and a permit.</p>
      </section>
      <section class="section">
        <div class="filters" data-filter-group=".idea-card">
          <button type="button" class="active" data-filter="all">All</button>
          ${rooms.map((r) => `<button type="button" data-filter="${esc(r)}">${esc(r)}</button>`).join("")}
        </div>
        <div class="idea-grid">
          ${ideas.map((item, i) => ideaCard(item, i === 0)).join("")}
        </div>
      </section>
      <section class="section">
        <h2>Payment stages</h2>
        <ol class="steps">
          <li><span class="num">40%</span><h3>Mobilisation</h3><p>Clears before we buy a single bag of adhesive.</p></li>
          <li><span class="num">40%</span><h3>Milestone</h3><p>Waterproofing, first-fix, or structure — named in the quotation.</p></li>
          <li><span class="num">20%</span><h3>Handover</h3><p>After photos, snag list, and a 5% retention on larger jobs.</p></li>
        </ol>
      </section>
      ${ctaBand("Request a renovation visit.", "Send photos. We return a line-item quotation, not a single number.", "/book?service=renovation", "Book renovation")}
    `,
  });
}

function overseas(user) {
  return siteLayout({
    title: "Overseas owners",
    user,
    body: `
      <section class="hero-stage compact">
        <div class="hero-copy">
          <p class="kicker">London, Melbourne, Dubai, Doha</p>
          <h1>Your house in Colombo, with dated photographs.</h1>
          <p class="lede">Premium Care is built for owners who cannot ask a cousin to drop by. Monthly or fortnightly inspections, a bilingual report, and an approval button for anything over LKR 15,000.</p>
          <div class="actions">
            <a class="btn" href="/book?service=property-care">Book an empty-house check</a>
            <a class="btn ghost" href="/login">Open the owner portal</a>
          </div>
        </div>
        <img class="photo hero-one" src="/gallery/reno-living.jpg" alt="Cared-for Colombo living room">
      </section>
      <section class="section two">
        <div class="panel">
          <h3>Included</h3>
          <p>Scheduled visits, photo and short video, punch-list, cleaning coordination, emergency phone, and a named coordinator who answers in the evening UK time when we can.</p>
        </div>
        <div class="panel">
          <h3>Not included until you ask</h3>
          <p>Rent collection into our account, Airbnb guest operations, and court work. Those are year-two products. Repairs are quoted, then you tap approve.</p>
        </div>
      </section>
      <section class="section">
        <p class="kicker">Portal</p>
        <h2>Approve a repair from the airport lounge.</h2>
        <div class="offer-grid">
          <article class="panel"><h3>Jobs</h3><p>Quotations, photographs and snag lists on one thread.</p></article>
          <article class="panel"><h3>Visits</h3><p>Every inspection dated. Meter readings when we can see them.</p></article>
          <article class="panel"><h3>Approvals</h3><p>Anything over LKR 15,000 waits for your tap.</p></article>
          <article class="panel"><h3>Payments</h3><p>Invoices marked paid against the job, not a mystery chat.</p></article>
        </div>
      </section>
    `,
  });
}

function work(user) {
  return siteLayout({
    title: "Selected work",
    user,
    body: `
      <section class="hero">
        <p class="kicker">Case studies</p>
        <h1>Proof from the five launch areas. Drag the slider.</h1>
        <p class="lede">Before and after from jobs we coordinated. Not a European stock kitchen.</p>
      </section>
      <section class="section case-list">
        <article class="case-card">
          <div class="ba" data-ba>
            <img class="ba-after" src="/gallery/reno-bathroom.jpg" alt="Bathroom after">
            <div class="ba-before-wrap"><img class="ba-before" src="https://images.unsplash.com/photo-1552321554-5fefe8c9ef14?auto=format&fit=crop&w=1400&q=80" alt="Bathroom before"></div>
            <input type="range" min="0" max="100" value="52" aria-label="Before and after">
          </div>
          <div>
            <p class="kicker">PH-001 · Nugegoda</p>
            <h2>Rear bathroom, waterproofed and rebuilt</h2>
            <p>Strip-out, tanking, ice mosaic niche, walk-in shower. Labour warranty twelve months. Client approved two extras on the portal.</p>
            <p class="tiny">Bathroom package · LKR 420,000 · 18 days on site</p>
          </div>
        </article>
        <article class="case-card">
          <div class="ba" data-ba>
            <img class="ba-after" src="/gallery/reno-kitchen.jpg" alt="Kitchen after">
            <div class="ba-before-wrap"><img class="ba-before" src="https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?auto=format&fit=crop&w=1400&q=80" alt="Kitchen before"></div>
            <input type="range" min="0" max="100" value="48" aria-label="Before and after">
          </div>
          <div>
            <p class="kicker">PH-006 · Pagoda Road</p>
            <h2>Handleless kitchen, ice cabinetry</h2>
            <p>2D plan and 3D concept generated from the brief. Quartz, porcelain floor, garden doors kept. Design fee credited against the build.</p>
            <p class="tiny">Kitchen · signature finish · 1,500 sq ft house</p>
          </div>
        </article>
        <article class="case-card">
          <div class="ba" data-ba>
            <img class="ba-after" src="/gallery/reno-living.jpg" alt="Living after">
            <div class="ba-before-wrap"><img class="ba-before" src="/gallery/design-living-ice.jpg" alt="Living concept"></div>
            <input type="range" min="0" max="100" value="50" aria-label="Before and after">
          </div>
          <div>
            <p class="kicker">PH-004 · Rajagiriya</p>
            <h2>Living refresh on Premium Care</h2>
            <p>Paint, feature wall, new floor, furniture layout. Monthly inspections continue so the overseas owner sees the room stay that way.</p>
            <p class="tiny">Refresh + Premium Care</p>
          </div>
        </article>
      </section>
      ${ctaBand("Want this for your house?", "Send three photos. We return a look and a range.", "/book", "Start a case")}
    `,
  });
}

function about(user) {
  return siteLayout({
    title: "About the desk",
    user,
    body: `
      <section class="hero">
        <p class="kicker">The company</p>
        <h1>We are not a furniture showroom. We run the house after the lookbook is closed.</h1>
        <p class="lede">Interia, WIDAC and Urbanspace already sell furniture well. ProHouse is the coordinator: design, contained renovation, care membership, and a portal for owners who live abroad.</p>
      </section>
      <section class="section">
        <p class="kicker">How a job moves</p>
        <ol class="steps">
          <li><span class="num">1</span><h3>Visit</h3><p>Free in the five areas. Photos, measurements, and the thing that is actually wrong.</p></li>
          <li><span class="num">2</span><h3>Quotation</h3><p>Line items. Contingency named. Design credited if you build.</p></li>
          <li><span class="num">3</span><h3>Make</h3><p>A named trade. Mobilisation before materials. Daily or milestone photos.</p></li>
          <li><span class="num">4</span><h3>Keep</h3><p>Handover, snag, warranty, then a care plan so the house does not slide.</p></li>
        </ol>
      </section>
      <section class="section two">
        <div class="panel">
          <h3>Warranty</h3>
          <p>Six months on repair labour. Twelve months on renovation labour. Waterproofing failures inside that window are our problem. Appliances follow the maker.</p>
        </div>
        <div class="panel">
          <h3>Insurance and permits</h3>
          <p>We work inside what a coordinator can honestly hold. Additional floors, structural openings and boundary walls wait for an engineer and a CMC / municipal permit.</p>
        </div>
      </section>
      <section class="section">
        <p class="kicker">Desk</p>
        <h2>Who you are talking to.</h2>
        <div class="team-grid">
          <article class="panel"><h3>Kasun Jayasuriya</h3><p class="tiny">Coordinator</p><p>Quotations, WhatsApp, and the person who shows up if a trade does not.</p></article>
          <article class="panel"><h3>Rotating trades</h3><p class="tiny">Vetted bench</p><p>Plumber, electrician, painter, tiler, AC — hired per job, paid after photos.</p></article>
          <article class="panel"><h3>Engineer, when needed</h3><p class="tiny">Retained</p><p>Not on staff in year one. Called before any additional floor or beam.</p></article>
        </div>
      </section>
      <section class="section">
        <p class="kicker">Questions</p>
        <div class="faq">
          <details open><summary>Do you take the whole island?</summary><p>No. Forty minutes from Nugegoda. That is how we keep same-afternoon visits.</p></details>
          <details><summary>Is the design fee extra if I build with you?</summary><p>It is credited against the renovation quotation.</p></details>
          <details><summary>Can you add a floor?</summary><p>Only with an engineer and a permit. We will not pretend otherwise.</p></details>
          <details><summary>Do overseas owners need a Sri Lankan bank account?</summary><p>Year one we invoice and you pay from wherever you pay. Rent collection is a later product.</p></details>
          <details><summary>How do I add photos to Design or Renovate?</summary><p>Log in as admin, open Studio, upload. 2D and 3D drawings are generated under 2D / 3D from the customer brief.</p></details>
        </div>
      </section>
    `,
  });
}

function packages(user) {
  return siteLayout({
    title: "Packages",
    user,
    body: `
      <section class="hero">
        <p class="kicker">Studio products</p>
        <h1>New ways to buy the desk — without inventing a second brand.</h1>
        <p class="lede">These sit beside Design, Renovate and Care. Same coordinator. Same ice-blue site. Same photographs after the visit.</p>
      </section>
      <section class="section offer-grid packs">
        <article class="plan">
          <p class="kicker">30 minutes</p>
          <h3>Virtual consult</h3>
          <div class="price">${money(0)}<span class="tiny"> in launch areas</span></div>
          <p>Video walkthrough, a written note, and whether you need design, a plumber, or a care plan. Paid if we are asked to travel outside the ring.</p>
          <a class="btn small" href="/book?service=virtual-consult">Book a consult</a>
        </article>
        <article class="plan featured">
          <span class="ribbon">New</span>
          <p class="kicker">Keys back</p>
          <h3>Empty-house handover</h3>
          <div class="price">${money(35000)}<span class="tiny"> typical</span></div>
          <p>Meter photos, snag list, cleaning quote, and a 14-day punch list when a tenant leaves or you land in Colombo.</p>
          <a class="btn small" href="/book?service=empty-handover">Book a handover</a>
        </article>
        <article class="plan">
          <p class="kicker">Seven days</p>
          <h3>Tenant-ready refresh</h3>
          <div class="price">${money(180000)}<span class="tiny"> from</span></div>
          <p>Paint, lights, silicone, minor joinery, and a listing photo set. For landlords who cannot wait on a full renovation.</p>
          <a class="btn small" href="/book?service=rental-refresh">Request a refresh</a>
        </article>
        <article class="plan">
          <p class="kicker">April &amp; October</p>
          <h3>Monsoon home-health</h3>
          <div class="price">${money(18000)}<span class="tiny"> per visit</span></div>
          <p>Roof, gutters, drains, AC trays, a leak walk, and a photo report. Included in Premium Care.</p>
          <a class="btn small" href="/book?service=monsoon-check">Book the check</a>
        </article>
        <article class="plan">
          <p class="kicker">After build</p>
          <h3>Warranty desk</h3>
          <div class="price">Included</div>
          <p>Snag list, 5% retention on larger jobs, and a coordinator who still answers when the silicone fails in month four.</p>
          <a class="btn small ghost" href="/about">Read the warranty</a>
        </article>
        <article class="plan">
          <p class="kicker">Owners</p>
          <h3>Referral credit</h3>
          <div class="price">${money(10000)}</div>
          <p>If a neighbour books a paid job over LKR 250,000, your next inspection or design hour is on us.</p>
          <a class="btn small ghost" href="/book">Mention a neighbour</a>
        </article>
      </section>
      ${ctaBand("Not sure which package?", "The style quiz and the estimate take two minutes. Then we visit.", "/estimate", "Get a range")}
    `,
  });
}

function estimate(user) {
  return siteLayout({
    title: "Instant estimate",
    user,
    body: `
      <section class="hero">
        <p class="kicker">Public calculator</p>
        <h1>A range you can show a spouse. Then we visit.</h1>
        <p class="lede">These are Colombo 2026 working ranges, not a quotation. A coordinator still walks the house before anything is ordered.</p>
      </section>
      <section class="section estimate-layout">
        <form class="panel stack" data-estimate>
          ${field(
            "What do you need",
            `<select name="kind">
              <option value="design">Interior design package</option>
              <option value="kitchen">Kitchen renovation</option>
              <option value="bathroom">Bathroom renovation</option>
              <option value="refresh">Whole-home refresh</option>
              <option value="care">Monthly care</option>
              <option value="handover">Empty-house handover</option>
            </select>`
          )}
          ${field("Floor area (sq ft)", `<input type="number" name="sqft" value="1500" min="400" max="8000">`)}
          ${field(
            "Finish",
            `<select name="finish">
              <option value="essential">Essential</option>
              <option value="signature" selected>Signature</option>
              <option value="prestige">Prestige</option>
            </select>`
          )}
          ${field(
            "Area",
            `<select name="area">${selectOptions(
              AREAS.map(([n]) => [n, n]),
              "Nugegoda"
            )}</select>`
          )}
          <p class="tiny">Signature is the ice-blue / white look on this site. Prestige adds stone, custom joinery and imported fittings.</p>
        </form>
        <aside class="estimate-result panel">
          <p class="kicker">Working range</p>
          <div class="price" data-est-range>—</div>
          <p data-est-note class="muted">Move the fields. The range updates.</p>
          <ul class="ticks" data-est-points></ul>
          <a class="btn" data-est-book href="/book">Request this range</a>
        </aside>
      </section>
    `,
  });
}

function stylePage(user, result) {
  const f = (result && result.fields) || {};
  const drawn = result && result.path;
  const look = result && result.look;
  const note = look
    ? `Style quiz: ${look.title}. Room: ${f.room || "Living"}. Finish: ${f.budget || "signature"}. ${f.notes || ""}`
    : "";
  return siteLayout({
    title: drawn ? "Your 3D look" : "Style quiz",
    user,
    pageClass: "style-page",
    body: `
      <section class="hero">
        <p class="kicker">${drawn ? "Generated from your brief" : "Your brief, then a 3D look"}</p>
        <h1>${drawn ? "This is the 3D concept from your answers." : "Tell us the house. We will draw the 3D look."}</h1>
        <p class="lede">${drawn ? look.copy : "Choose the feel, kitchen, light and finish. Add the room and a photo if you have one. See my look generates a 3D concept for those requirements."}</p>
      </section>
      ${
        drawn
          ? `<section class="section style-result">
        <div class="vis-frame look-frame">
          <img class="look-img" src="${esc(result.path)}" alt="3D interior concept">
        </div>
        <aside class="panel quiz-result">
          <p class="kicker">Recommended look</p>
          <h2>${esc(look.title)}</h2>
          <p>${esc(look.copy)}</p>
          <p class="tiny">${esc(result.notes || "")}</p>
          <div class="actions">
            <a class="btn" href="/book?service=interior-design&amp;note=${encodeURIComponent(note)}">Book this look</a>
            <a class="btn ghost" href="${esc(result.path)}" download>Download 3D SVG</a>
            <a class="btn ghost" href="/style">Draw another room</a>
          </div>
        </aside>
      </section>`
          : ""
      }
      <section class="section quiz-layout">
        <form class="panel stack" method="post" action="/style" enctype="multipart/form-data" data-quiz>
          ${field("Your name", `<input name="name" placeholder="Amaya Wickramasinghe" value="${esc(f.name || "")}">`)}
          ${field(
            "Area",
            `<select name="area">${selectOptions(
              AREAS.map(([n]) => [n, n]),
              f.area || "Nugegoda"
            )}</select>`
          )}
          ${field(
            "Room to draw in 3D",
            `<select name="room">${selectOptions(
              [
                ["Living", "Living room"],
                ["Kitchen", "Kitchen"],
                ["Bedroom", "Bedroom"],
                ["Bathroom", "Bathroom"],
              ],
              f.room || "Living"
            )}</select>`
          )}
          ${field("Floor area (sq ft)", `<input type="number" name="sqft" value="${esc(f.sqft || "1500")}" min="400" max="8000">`)}
          <fieldset>
            <legend>How should the rooms feel?</legend>
            ${radio("feel", "ice", "Calm, cool, quiet", f.feel, "ice")}
            ${radio("feel", "tropical", "Garden, timber, breeze", f.feel)}
            ${radio("feel", "minimal", "Gallery-white, almost empty", f.feel)}
            ${radio("feel", "luxury", "Warm stone and brass", f.feel)}
          </fieldset>
          <fieldset>
            <legend>Kitchen</legend>
            ${radio("kitchen", "ice", "Handleless, ice cabinetry", f.kitchen, "ice")}
            ${radio("kitchen", "tropical", "Open timber and plants", f.kitchen)}
            ${radio("kitchen", "minimal", "Compact white, hidden", f.kitchen)}
            ${radio("kitchen", "luxury", "Stone island, statement hood", f.kitchen)}
          </fieldset>
          <fieldset>
            <legend>Light</legend>
            ${radio("light", "ice", "Morning white and sheer curtains", f.light, "ice")}
            ${radio("light", "tropical", "Deep shade and garden green", f.light)}
            ${radio("light", "minimal", "North light, no clutter", f.light)}
            ${radio("light", "luxury", "Lamps, gold, evening", f.light)}
          </fieldset>
          <fieldset>
            <legend>Budget posture</legend>
            ${radio("budget", "essential", "Tight — paint and layout first", f.budget)}
            ${radio("budget", "signature", "Signature — the lookbook on this site", f.budget, "signature")}
            ${radio("budget", "prestige", "Prestige — stone and custom joinery", f.budget)}
          </fieldset>
          ${field("Anything else we should keep or change", `<textarea name="notes" placeholder="Keep the rear wall. More light in the hall.">${esc(f.notes || "")}</textarea>`)}
          ${field("Photos of the room (optional)", `<input type="file" name="photos" accept="image/*" multiple>`)}
          <button class="btn" type="submit" data-quiz-submit>See my look</button>
          <p class="tiny">We draw a 3D concept from this brief. A coordinator still visits before anything is built.</p>
        </form>
        ${
          drawn
            ? ""
            : `<aside class="panel">
          <p class="kicker">What you get</p>
          <h3>A 3D room, not a moodboard only.</h3>
          <p>See my look scores Ice Blue, Tropical, Minimal or Luxury from your answers, then draws that room — living, kitchen, bedroom or bath — with your notes on the drawing.</p>
          <p class="muted">Upload a photo and it sits on the back wall of the concept, the same way the admin 2D/3D desk works.</p>
        </aside>`
        }
      </section>
    `,
  });
}

function book(user, query, flash) {
  const service = query.service || "maintenance";
  const note = query.note || "";
  return siteLayout({
    title: "Book a visit",
    user,
    flash,
    body: `
      <section class="hero-stage compact">
        <div class="hero-copy">
          <p class="kicker">No account required</p>
          <h1>Tell us the house. We will come.</h1>
          <p class="lede">A coordinator confirms on WhatsApp. Design visits are free in the five launch areas and credited if you proceed.</p>
        </div>
        <form class="panel stack book-form" method="post" action="/book" enctype="multipart/form-data">
          ${field("Full name", `<input name="name" required>`)}
          ${field("Phone / WhatsApp", `<input name="phone" required placeholder="+94 …">`)}
          ${field("Email", `<input type="email" name="email">`)}
          ${field(
            "Area",
            `<select name="area">${selectOptions(
              AREAS.map(([n]) => [n, n]),
              query.area || "Nugegoda"
            )}</select>`
          )}
          ${field("Service", `<select name="service">${selectOptions(SERVICES, service)}</select>`)}
          ${field("Preferred date", `<input type="date" name="preferred_date">`)}
          ${field("What is going on", `<textarea name="message" placeholder="Roof leak, kitchen, empty house…">${esc(note)}</textarea>`)}
          ${field("Photos of the space", `<input type="file" name="photo" accept="image/*">`)}
          <button class="btn" type="submit">Request the visit</button>
        </form>
      </section>
    `,
  });
}

function thanks(user) {
  return siteLayout({
    title: "Request received",
    user,
    body: `
      <section class="hero">
        <p class="kicker">Received</p>
        <h1>A coordinator will confirm the visit on WhatsApp.</h1>
        <p class="lede">If you already have a portal login, the job will also appear there once we convert the lead.</p>
        <div class="actions">
          <a class="btn" href="/">Back home</a>
          <a class="btn ghost" href="/estimate">Run another estimate</a>
        </div>
      </section>
    `,
  });
}

function login(user, flash) {
  return siteLayout({
    title: "Log in",
    user,
    flash,
    body: `
      <div class="login-card">
        <p class="kicker">Desk and owner portal</p>
        <h1>Log in</h1>
        <form class="stack" method="post" action="/login">
          ${field("Email", `<input type="email" name="email" required value="admin@prohouse.lk">`)}
          ${field("Password", `<input type="password" name="password" required>`)}
          <button class="btn" type="submit">Enter</button>
        </form>
        <div class="demo-box">
          <strong>Demo logins</strong>
          <p>Coordinator: admin@prohouse.lk / ProHouse2026</p>
          <p>Overseas owner: nisha@example.com / HomeCare2026</p>
          <p>Homeowner: ruwan@example.com / HomeCare2026</p>
        </div>
      </div>
    `,
  });
}

module.exports = {
  home,
  care,
  design,
  renovate,
  overseas,
  work,
  about,
  packages,
  estimate,
  stylePage,
  pickLook,
  book,
  thanks,
  login,
};
