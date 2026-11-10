(() => {
  const box = document.createElement("div");
  box.className = "lightbox";
  box.innerHTML = `<button class="lb-x" type="button" aria-label="Close">×</button><img alt=""><p class="lb-cap"></p>`;
  document.body.appendChild(box);
  const img = box.querySelector("img");
  const cap = box.querySelector(".lb-cap");
  const close = () => box.classList.remove("open");
  box.querySelector(".lb-x").addEventListener("click", close);
  box.addEventListener("click", (e) => {
    if (e.target === box) close();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") close();
  });
  document.addEventListener("click", (e) => {
    const card = e.target.closest("[data-lightbox]");
    if (!card) return;
    e.preventDefault();
    img.src = card.getAttribute("data-lightbox");
    cap.textContent = card.getAttribute("data-caption") || "";
    box.classList.add("open");
  });

  document.querySelectorAll("[data-filter-group]").forEach((group) => {
    const buttons = group.querySelectorAll("[data-filter]");
    const items = document.querySelectorAll(group.getAttribute("data-filter-group"));
    buttons.forEach((btn) => {
      btn.addEventListener("click", () => {
        buttons.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        const key = btn.getAttribute("data-filter");
        items.forEach((item) => {
          item.style.display = key === "all" || item.getAttribute("data-room") === key ? "" : "none";
        });
      });
    });
  });

  const header = document.querySelector(".site-header");
  const toggle = document.querySelector(".nav-toggle");
  if (header && toggle) {
    toggle.addEventListener("click", () => {
      header.classList.toggle("nav-open");
      toggle.textContent = header.classList.contains("nav-open") ? "Close" : "Menu";
    });
  }
  document.querySelectorAll(".nav-drop > button").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      btn.parentElement.classList.toggle("open");
    });
  });

  document.querySelectorAll("[data-ba]").forEach((wrap) => {
    const shade = wrap.querySelector(".ba-before-wrap");
    const slider = wrap.querySelector("input[type=range]");
    const set = (v) => {
      shade.style.width = v + "%";
    };
    set(slider.value);
    slider.addEventListener("input", () => set(slider.value));
  });

  const lkr = (n) => "LKR " + Math.round(n).toLocaleString("en-LK");
  const estimateForm = document.querySelector("[data-estimate]");
  if (estimateForm) {
    const rangeEl = document.querySelector("[data-est-range]");
    const noteEl = document.querySelector("[data-est-note]");
    const pointsEl = document.querySelector("[data-est-points]");
    const bookEl = document.querySelector("[data-est-book]");
    const finishMul = { essential: 0.82, signature: 1, prestige: 1.45 };
    const calc = () => {
      const kind = estimateForm.kind.value;
      const sqft = Number(estimateForm.sqft.value || 1500);
      const finish = estimateForm.finish.value;
      const area = estimateForm.area.value;
      const m = finishMul[finish] || 1;
      let low = 0;
      let high = 0;
      let service = "renovation";
      const points = [];
      if (kind === "design") {
        low = sqft * 95 * m;
        high = sqft * 140 * m;
        service = "interior-design";
        points.push("Site visit, 2D, 3D, material board", "Credited if you build with us");
      } else if (kind === "kitchen") {
        low = 450000 * m;
        high = 900000 * m;
        points.push("Cabinets, worktop, splash, first-fix", "Appliances billed separately");
      } else if (kind === "bathroom") {
        low = 250000 * m;
        high = 620000 * m;
        points.push("Waterproofing as its own line", "18–24 days typical");
      } else if (kind === "refresh") {
        low = sqft * 550 * m;
        high = sqft * 950 * m;
        points.push("Paint, floors, wet rooms, lighting", "Add 10–15% contingency");
      } else if (kind === "care") {
        const map = { essential: [12000, 12000], signature: [22000, 22000], prestige: [40000, 40000] };
        low = map[finish][0];
        high = map[finish][1];
        service = "maintenance";
        points.push("Visit and report included", "Repairs billed after approval");
      } else {
        low = 28000 * m;
        high = 45000 * m;
        service = "empty-handover";
        points.push("Meters, snag list, 14-day punch list");
      }
      const monthly = kind === "care";
      rangeEl.textContent = monthly ? lkr(low) + " / month" : lkr(low) + " – " + lkr(high);
      noteEl.textContent = monthly
        ? "Membership range for " + area + ". Materials extra."
        : "Working range for " + area + ". Confirmed after a visit.";
      pointsEl.innerHTML = points.map((p) => "<li>" + p + "</li>").join("");
      const note = "Estimate: " + kind + ", " + sqft + " sq ft, " + finish + ", " + rangeEl.textContent;
      bookEl.href = "/book?service=" + encodeURIComponent(service) + "&area=" + encodeURIComponent(area) + "&note=" + encodeURIComponent(note);
    };
    estimateForm.addEventListener("input", calc);
    estimateForm.addEventListener("change", calc);
    calc();
  }

  const quiz = document.querySelector("[data-quiz]");
  if (quiz) {
    quiz.addEventListener("submit", () => {
      const btn = quiz.querySelector("[data-quiz-submit]");
      if (btn) btn.textContent = "Drawing your 3D look…";
    });
  }
})();
