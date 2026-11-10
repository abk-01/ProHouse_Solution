"use strict";

const STYLES = {
  ice: {
    wall: "#f4fbff",
    floor: "#d4eaf6",
    floor2: "#c5e0f0",
    accent: "#7ec8e8",
    wood: "#e2c9a8",
    text: "#123047",
    sky: "#b9e4ff",
    glass: "#d7eefc",
    curtain: "#eef6ff",
    metal: "#9aa8b5",
    plant: "#5ea36a",
    leaf: "#8fbf7a",
  },
  tropical: {
    wall: "#f4fbf4",
    floor: "#e4d3b4",
    floor2: "#d7c4a0",
    accent: "#3aa37a",
    wood: "#c4a574",
    text: "#1c3a2c",
    sky: "#9fd9b8",
    glass: "#d7f0e2",
    curtain: "#e7f6ea",
    metal: "#8a9a88",
    plant: "#2f7a45",
    leaf: "#6fbf7a",
  },
  minimal: {
    wall: "#ffffff",
    floor: "#e6eaee",
    floor2: "#d7dce2",
    accent: "#9aa7b2",
    wood: "#d8d2cb",
    text: "#1b2430",
    sky: "#d5dde6",
    glass: "#edf1f4",
    curtain: "#f4f6f8",
    metal: "#7d8790",
    plant: "#6d8f74",
    leaf: "#9bbb9a",
  },
  luxury: {
    wall: "#f6f1ea",
    floor: "#e0cbb3",
    floor2: "#d2ba9e",
    accent: "#c9a36a",
    wood: "#8c6a3d",
    text: "#2a2118",
    sky: "#e4d2b4",
    glass: "#f0e6d6",
    curtain: "#f4eadc",
    metal: "#b0894d",
    plant: "#4f6f45",
    leaf: "#7da36a",
  },
};

function parseRooms(raw) {
  const parts = String(raw || "")
    .split(/[,/\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.length ? parts : ["Living", "Kitchen", "Bedroom", "Bathroom"];
}

function layoutRooms(rooms, sqft) {
  const n = rooms.length;
  const cols = n <= 2 ? n : n <= 4 ? 2 : 3;
  const rows = Math.ceil(n / cols);
  const pad = 28;
  const gap = 14;
  const cellW = (920 - pad * 2 - gap * (cols - 1)) / cols;
  const cellH = (560 - pad * 2 - 48 - gap * (rows - 1)) / rows;
  const areaEach = Math.round(Number(sqft || 1200) / n);
  return rooms.map((name, i) => ({
    name,
    x: pad + (i % cols) * (cellW + gap),
    y: pad + 40 + Math.floor(i / cols) * (cellH + gap),
    w: cellW,
    h: cellH,
    area: areaEach,
  }));
}

function hexToRgb(hex) {
  const h = String(hex || "#888888").replace("#", "");
  return [parseInt(h.slice(0, 2), 16) || 0, parseInt(h.slice(2, 4), 16) || 0, parseInt(h.slice(4, 6), 16) || 0];
}

function rgbToHex(r, g, b) {
  const c = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

function shade(hex, amt) {
  const [r, g, b] = hexToRgb(hex);
  if (amt >= 0) return rgbToHex(r + (255 - r) * amt, g + (255 - g) * amt, b + (255 - b) * amt);
  return rgbToHex(r * (1 + amt), g * (1 + amt), b * (1 + amt));
}

function svgWrap(w, h, inner, style) {
  const pal = style || STYLES.ice;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
  <defs>
    <linearGradient id="icebg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#f7fbff"/>
      <stop offset="100%" stop-color="${pal.sky}"/>
    </linearGradient>
    <linearGradient id="winlight" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="55%" stop-color="${pal.glass}"/>
      <stop offset="100%" stop-color="${shade(pal.sky, -0.08)}"/>
    </linearGradient>
    <linearGradient id="ceil" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${shade(pal.wall, 0.08)}"/>
      <stop offset="100%" stop-color="${pal.wall}"/>
    </linearGradient>
    <radialGradient id="lamp" cx="50%" cy="40%" r="50%">
      <stop offset="0%" stop-color="#fff7d6"/>
      <stop offset="100%" stop-color="#ffe08a" stop-opacity="0.15"/>
    </radialGradient>
    <filter id="soft"><feDropShadow dx="0" dy="4" stdDeviation="3" flood-color="#123047" flood-opacity="0.12"/></filter>
  </defs>
  ${inner}
</svg>`;
}

function floorPlan2d(input) {
  const style = STYLES[input.style] || STYLES.ice;
  const rooms = layoutRooms(parseRooms(input.rooms), input.sqft);
  const boxes = rooms
    .map((r, i) => {
      const doorX = r.x + r.w * 0.12;
      return `
      <g>
        <rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="${i % 2 ? shade(style.accent, 0.45) : style.wall}" stroke="${style.accent}" stroke-width="3"/>
        <rect x="${doorX}" y="${r.y + r.h - 3}" width="28" height="6" fill="#fff"/>
        <rect x="${r.x + r.w - 6}" y="${r.y + 18}" width="6" height="36" fill="${style.glass}"/>
        <text x="${r.x + r.w / 2}" y="${r.y + r.h / 2 - 4}" text-anchor="middle" font-family="Outfit, Segoe UI, sans-serif" font-size="20" fill="${style.text}">${escapeXml(r.name)}</text>
        <text x="${r.x + r.w / 2}" y="${r.y + r.h / 2 + 18}" text-anchor="middle" font-family="Outfit, Segoe UI, sans-serif" font-size="12" fill="#5b7388">${r.area} sq ft</text>
      </g>`;
    })
    .join("");
  return svgWrap(
    960,
    620,
    `<rect width="960" height="620" fill="url(#icebg)"/>
     <text x="32" y="36" font-family="Fraunces, Georgia, serif" font-size="22" fill="#123047">2D plan · ${escapeXml(input.client_name || "Client")}</text>
     <text x="32" y="56" font-family="Outfit, Segoe UI, sans-serif" font-size="13" fill="#5b7388">${escapeXml(input.address || "")} · ${escapeXml(String(input.sqft || ""))} sq ft · ${escapeXml(input.style || "ice")}</text>
     <rect x="18" y="70" width="924" height="530" rx="16" fill="#fff" stroke="#cfe6f5"/>
     ${boxes}`,
    style
  );
}

function iso(x, y, z) {
  return { x: (x - z) * 1.08 + 455, y: (x + z) * 0.56 - y * 1.05 + 228 };
}

function pts(list) {
  return list.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
}

function poly(corners, fill, stroke, sw) {
  return `<polygon points="${pts(corners)}" fill="${fill}" stroke="${stroke || shade(fill, -0.18)}" stroke-width="${sw == null ? 0.7 : sw}" stroke-linejoin="round"/>`;
}

function box3(x, z, w, d, y0, y1, pal, stroke) {
  const top = pal.top;
  const east = pal.east || shade(top, -0.16);
  const south = pal.south || shade(top, -0.28);
  const t = [iso(x, y1, z), iso(x + w, y1, z), iso(x + w, y1, z + d), iso(x, y1, z + d)];
  const s = [iso(x + w, y0, z), iso(x + w, y0, z + d), iso(x + w, y1, z + d), iso(x + w, y1, z)];
  const f = [iso(x, y0, z), iso(x + w, y0, z), iso(x + w, y1, z), iso(x, y1, z)];
  return poly(f, south, stroke) + poly(s, east, stroke) + poly(t, top, stroke);
}

function slab(x, z, w, d, y, fill) {
  return poly([iso(x, y, z), iso(x + w, y, z), iso(x + w, y, z + d), iso(x, y, z + d)], fill, shade(fill, -0.2), 0.6);
}

function floorTiles(style) {
  let out = "";
  const step = 24;
  for (let x = 0; x < 360; x += step) {
    for (let z = 0; z < 260; z += step) {
      const w = Math.min(step - 1.4, 360 - x);
      const d = Math.min(step - 1.4, 260 - z);
      const alt = (Math.floor(x / step) + Math.floor(z / step)) % 2;
      out += slab(x, z, w, d, 0.4, alt ? style.floor : style.floor2);
    }
  }
  return out;
}

function skirting(style) {
  return (
    box3(0, 0, 4, 260, 0, 10, { top: shade(style.wood, 0.1), east: style.wood, south: shade(style.wood, -0.2) }) +
    box3(0, 256, 360, 4, 0, 10, { top: shade(style.wood, 0.1), east: style.wood, south: shade(style.wood, -0.2) })
  );
}

function windowSet(style) {
  const outdoor =
    poly([iso(2, 70, 42), iso(2, 168, 42), iso(2, 168, 168), iso(2, 70, 168)], style.sky, "none", 0) +
    poly([iso(2, 70, 42), iso(2, 108, 70), iso(2, 70, 108)], "#ffffff", "none", 0) +
    poly([iso(2, 70, 130), iso(2, 118, 150), iso(2, 70, 168)], "#ffffff", "none", 0) +
    poly([iso(2, 70, 78), iso(2, 128, 96), iso(2, 70, 118)], shade(style.leaf, 0.1), "none", 0) +
    box3(1, 88, 6, 14, 70, 128, { top: style.wood, east: shade(style.plant, -0.1), south: style.plant });
  const frame = box3(6, 38, 8, 134, 62, 172, { top: shade(style.wood, 0.2), east: style.wood, south: shade(style.wood, -0.25) });
  const glass = poly([iso(10, 72, 46), iso(10, 164, 46), iso(10, 164, 164), iso(10, 72, 164)], "url(#winlight)", "#9ec9e0", 1.2);
  const mullionV = box3(10, 98, 3, 4, 72, 164, { top: "#f7fbff", east: "#cfe6f5", south: "#b7d7ea" });
  const mullionH = box3(10, 46, 3, 118, 114, 118, { top: "#f7fbff", east: "#cfe6f5", south: "#b7d7ea" });
  const sheerL = poly([iso(12, 68, 44), iso(12, 166, 44), iso(12, 166, 70), iso(12, 68, 64)], "rgba(255,255,255,0.55)", style.curtain, 0.4);
  const sheerR = poly([iso(12, 68, 140), iso(12, 166, 146), iso(12, 166, 166), iso(12, 68, 166)], "rgba(255,255,255,0.55)", style.curtain, 0.4);
  return outdoor + frame + glass + mullionV + mullionH + sheerL + sheerR;
}

function recLights() {
  const spots = [
    [80, 40],
    [180, 40],
    [280, 40],
    [80, 140],
    [180, 140],
    [280, 140],
    [80, 220],
    [220, 220],
  ];
  return spots
    .map(([x, z]) => {
      const p = iso(x, 186, z);
      return `<ellipse cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" rx="9" ry="5" fill="#fff8e0" opacity="0.9"/><ellipse cx="${p.x.toFixed(1)}" cy="${(p.y + 8).toFixed(1)}" rx="16" ry="7" fill="url(#lamp)"/>`;
    })
    .join("");
}

function roomShell(style, photo) {
  const W = 360;
  const D = 260;
  const H = 188;
  const left = [iso(0, 0, 0), iso(0, H, 0), iso(0, H, D), iso(0, 0, D)];
  const back = [iso(0, 0, D), iso(0, H, D), iso(W, H, D), iso(W, 0, D)];
  const ceil = [iso(0, H, 0), iso(W, H, 0), iso(W, H, D), iso(0, H, D)];
  const pattern = photo
    ? `<pattern id="wallphoto" patternUnits="userSpaceOnUse" width="360" height="220">
         <image href="${escapeXml(photo)}" x="0" y="0" width="360" height="220" preserveAspectRatio="xMidYMid slice"/>
       </pattern>`
    : "";
  const backFill = photo ? "url(#wallphoto)" : style.wall;
  const panelling = [40, 90, 140, 190, 240, 290]
    .map((x) => poly([iso(x, 12, 259), iso(x + 4, 12, 259), iso(x + 4, 110, 259), iso(x, 110, 259)], shade(style.wall, -0.04), shade(style.wall, -0.12), 0.4))
    .join("");
  return `${pattern}
    ${poly([iso(0, 0, 0), iso(W, 0, 0), iso(W, 0, D), iso(0, 0, D)], style.floor, shade(style.floor, -0.2), 1)}
    ${floorTiles(style)}
    ${poly(left, shade(style.wall, 0.04), "#cfe6f5", 1)}
    ${poly(back, backFill, "#cfe6f5", 1)}
    ${poly(ceil, "url(#ceil)", "#d7eefc", 0.8)}
    ${panelling}
    ${windowSet(style)}
    ${skirting(style)}
    ${recLights()}`;
}

function plant(x, z, style, scale) {
  const s = scale || 1;
  const pot = box3(x, z, 16 * s, 16 * s, 0, 18 * s, { top: style.wood, east: shade(style.wood, -0.1), south: shade(style.wood, -0.25) });
  const soil = slab(x + 2 * s, z + 2 * s, 12 * s, 12 * s, 18 * s, "#5a4636");
  const c = iso(x + 8 * s, 18 * s, z + 8 * s);
  const leaves = [
    [0, -52 * s, 18 * s, 10 * s],
    [-16 * s, -40 * s, 14 * s, 9 * s],
    [16 * s, -38 * s, 14 * s, 9 * s],
    [-8 * s, -28 * s, 12 * s, 8 * s],
    [10 * s, -24 * s, 11 * s, 7 * s],
  ]
    .map(
      ([dx, dy, rx, ry], i) =>
        `<ellipse cx="${(c.x + dx).toFixed(1)}" cy="${(c.y + dy).toFixed(1)}" rx="${rx}" ry="${ry}" fill="${i % 2 ? style.leaf : style.plant}" opacity="0.92"/>`
    )
    .join("");
  const stem = `<rect x="${(c.x - 1.5).toFixed(1)}" y="${(c.y - 48 * s).toFixed(1)}" width="${3 * s}" height="${48 * s}" fill="${shade(style.plant, -0.25)}"/>`;
  return pot + soil + stem + leaves;
}

function sofa(style, finish) {
  const body = box3(78, 78, 190, 62, 18, 46, { top: style.accent, east: shade(style.accent, -0.12), south: shade(style.accent, -0.28) });
  const base = box3(78, 78, 190, 62, 0, 18, { top: style.wood, east: shade(style.wood, -0.1), south: shade(style.wood, -0.3) });
  const back = box3(78, 128, 190, 16, 18, 78, { top: shade(style.accent, 0.08), east: shade(style.accent, -0.18), south: shade(style.accent, -0.32) });
  const armL = box3(70, 78, 16, 62, 18, 62, { top: shade(style.accent, 0.12), east: shade(style.accent, -0.1), south: shade(style.accent, -0.22) });
  const armR = box3(260, 78, 16, 62, 18, 62, { top: shade(style.accent, 0.12), east: shade(style.accent, -0.1), south: shade(style.accent, -0.22) });
  const cushions =
    box3(92, 86, 52, 42, 46, 58, { top: shade(style.accent, 0.22), east: shade(style.accent, 0.05), south: shade(style.accent, -0.1) }) +
    box3(148, 86, 52, 42, 46, 58, { top: shade(style.curtain, 0.1), east: style.curtain, south: shade(style.curtain, -0.15) }) +
    box3(204, 86, 52, 42, 46, 58, { top: shade(style.accent, 0.22), east: shade(style.accent, 0.05), south: shade(style.accent, -0.1) });
  const throwP = finish === "prestige" ? box3(160, 90, 36, 18, 58, 66, { top: style.wood, east: shade(style.wood, -0.1), south: shade(style.wood, -0.25) }) : "";
  return base + body + back + armL + armR + cushions + throwP;
}

function livingScene(style, finish) {
  const rug = slab(70, 48, 210, 150, 1.2, finish === "prestige" ? "#d9c4a4" : shade(style.curtain, -0.04)) + slab(82, 58, 186, 130, 1.6, finish === "prestige" ? "#cbb089" : "#f4fbff");
  const table =
    box3(132, 40, 86, 54, 0, 8, { top: style.wood, east: shade(style.wood, -0.12), south: shade(style.wood, -0.3) }) +
    box3(168, 58, 10, 10, 8, 32, { top: style.wood, east: shade(style.wood, -0.1), south: shade(style.wood, -0.25) }) +
    box3(136, 44, 78, 46, 32, 36, { top: "#ffffff", east: shade(style.wood, 0.2), south: shade(style.wood, 0.05) });
  const books = box3(142, 50, 22, 14, 36, 44, { top: style.text, east: shade(style.accent, -0.2), south: style.accent }) + box3(166, 52, 18, 12, 36, 42, { top: style.wood, east: shade(style.wood, -0.2), south: shade(style.wood, -0.35) });
  const vase = box3(196, 58, 10, 10, 36, 52, { top: style.glass, east: shade(style.accent, 0.2), south: style.accent });
  const consoleB = box3(90, 228, 180, 26, 0, 42, { top: style.wood, east: shade(style.wood, -0.12), south: shade(style.wood, -0.3) });
  const tv = box3(118, 248, 124, 8, 70, 148, { top: "#1b2430", east: "#2a3340", south: "#111820" });
  const screen = poly([iso(124, 78, 249), iso(236, 78, 249), iso(236, 140, 249), iso(124, 140, 249)], shade(style.sky, 0.15), "#8fbdd6", 0.8);
  const artL = poly([iso(40, 108, 258), iso(78, 108, 258), iso(78, 150, 258), iso(40, 150, 258)], shade(style.accent, 0.2), style.wood, 2);
  const artR = poly([iso(286, 108, 258), iso(330, 108, 258), iso(330, 150, 258), iso(286, 150, 258)], shade(style.curtain, -0.05), style.wood, 2);
  const lamp =
    box3(300, 40, 14, 14, 0, 8, { top: style.metal, east: shade(style.metal, -0.1), south: shade(style.metal, -0.3) }) +
    `<line x1="${iso(307, 8, 47).x.toFixed(1)}" y1="${iso(307, 8, 47).y.toFixed(1)}" x2="${iso(307, 120, 47).x.toFixed(1)}" y2="${iso(307, 120, 47).y.toFixed(1)}" stroke="${style.metal}" stroke-width="2"/>` +
    `<ellipse cx="${iso(307, 124, 47).x.toFixed(1)}" cy="${iso(307, 124, 47).y.toFixed(1)}" rx="16" ry="8" fill="${shade(style.curtain, -0.05)}"/>` +
    `<ellipse cx="${iso(307, 90, 47).x.toFixed(1)}" cy="${iso(307, 90, 47).y.toFixed(1)}" rx="28" ry="12" fill="url(#lamp)"/>`;
  return rug + sofa(style, finish) + table + books + vase + consoleB + tv + screen + artL + artR + lamp + plant(28, 28, style, 1.15) + plant(318, 200, style, 0.85);
}

function cabinetDoors(x, z, w, d, y0, y1, style, cols) {
  let out = box3(x, z, w, d, y0, y1, { top: shade(style.wall, 0.08), east: shade(style.wall, -0.08), south: shade(style.wall, -0.18) });
  const cw = w / cols;
  for (let i = 0; i < cols; i++) {
    const xx = x + i * cw + 3;
    out += poly([iso(xx, y0 + 6, z + 1), iso(xx + cw - 6, y0 + 6, z + 1), iso(xx + cw - 6, y1 - 6, z + 1), iso(xx, y1 - 6, z + 1)], shade(style.wall, 0.12), shade(style.accent, -0.1), 0.7);
    out += box3(xx + cw - 12, z + 2, 4, 3, (y0 + y1) / 2 - 4, (y0 + y1) / 2 + 4, { top: style.metal, east: shade(style.metal, -0.1), south: shade(style.metal, -0.3) });
  }
  return out;
}

function kitchenScene(style, finish) {
  const worktop = finish === "prestige" ? "#ece7e1" : "#f7fbff";
  const base = cabinetDoors(16, 214, 328, 40, 0, 78, style, 6);
  const topRun = box3(16, 214, 328, 40, 78, 86, { top: worktop, east: shade(style.accent, 0.1), south: shade(style.accent, -0.15) });
  const splash = box3(18, 250, 324, 6, 86, 118, { top: shade(style.accent, 0.35), east: style.accent, south: shade(style.accent, -0.1) });
  const uppers = cabinetDoors(16, 228, 140, 26, 128, 178, style, 3) + cabinetDoors(220, 228, 124, 26, 128, 178, style, 3);
  const sink = slab(48, 222, 46, 24, 87, style.glass) + box3(66, 230, 10, 8, 87, 96, { top: style.metal, east: shade(style.metal, -0.2), south: shade(style.metal, -0.4) });
  const hob = slab(168, 222, 70, 26, 87, "#2a3340");
  const rings = [178, 196, 186, 204]
    .map((x, i) => `<ellipse cx="${iso(x, 88, 236).x.toFixed(1)}" cy="${iso(x, 88, 236 + (i % 2) * 8).y.toFixed(1)}" rx="8" ry="4" fill="none" stroke="#8ad" stroke-width="1.2"/>`)
    .join("");
  const hood = box3(176, 232, 56, 22, 150, 178, { top: style.metal, east: shade(style.text, 0.1), south: style.text }) + box3(186, 236, 36, 14, 178, 188, { top: shade(style.text, 0.2), east: style.text, south: shade(style.text, -0.2) });
  const fridge = box3(310, 168, 42, 48, 0, 168, { top: shade(style.wall, 0.2), east: shade(style.wall, -0.05), south: shade(style.wall, -0.18) }) + box3(348, 186, 3, 8, 86, 96, { top: style.metal, east: style.metal, south: shade(style.metal, -0.3) });
  const island = cabinetDoors(108, 78, 150, 72, 0, 76, style, 3) + box3(104, 74, 158, 80, 76, 84, { top: worktop, east: shade(style.accent, 0.05), south: shade(style.accent, -0.2) });
  const bowl = slab(150, 96, 28, 22, 85, style.glass);
  const stools =
    [118, 162, 206]
      .map((x) => {
        const seat = box3(x, 42, 26, 26, 42, 48, { top: style.wood, east: shade(style.wood, -0.1), south: shade(style.wood, -0.3) });
        const leg = box3(x + 10, 52, 6, 6, 0, 42, { top: style.metal, east: shade(style.metal, -0.1), south: shade(style.metal, -0.3) });
        return leg + seat;
      })
      .join("");
  const pendants = [140, 188]
    .map((x) => {
      const a = iso(x, 186, 108);
      const b = iso(x, 128, 108);
      return `<line x1="${a.x.toFixed(1)}" y1="${a.y.toFixed(1)}" x2="${b.x.toFixed(1)}" y2="${b.y.toFixed(1)}" stroke="${style.metal}" stroke-width="1.4"/><ellipse cx="${b.x.toFixed(1)}" cy="${b.y.toFixed(1)}" rx="14" ry="7" fill="${style.wood}"/><ellipse cx="${b.x.toFixed(1)}" cy="${(b.y + 10).toFixed(1)}" rx="22" ry="9" fill="url(#lamp)"/>`;
    })
    .join("");
  return base + topRun + splash + uppers + sink + hob + rings + hood + fridge + island + bowl + stools + pendants + plant(24, 24, style, 0.9);
}

function bedroomScene(style, finish) {
  const rug = slab(70, 40, 220, 170, 1.2, finish === "prestige" ? "#d9c4a4" : shade(style.curtain, -0.02));
  const frame = box3(86, 70, 188, 140, 0, 18, { top: style.wood, east: shade(style.wood, -0.12), south: shade(style.wood, -0.3) });
  const mattress = box3(92, 76, 176, 128, 18, 36, { top: "#f7fbff", east: shade(style.curtain, -0.05), south: shade(style.curtain, -0.18) });
  const duvet = box3(96, 78, 168, 96, 36, 46, { top: shade(style.accent, 0.28), east: shade(style.accent, 0.05), south: shade(style.accent, -0.18) });
  const fold = slab(96, 150, 168, 18, 47, shade(style.accent, 0.4));
  const head = box3(86, 196, 188, 18, 18, 92, { top: shade(style.accent, 0.1), east: shade(style.accent, -0.15), south: shade(style.accent, -0.3) });
  const pillows =
    box3(108, 178, 58, 28, 46, 62, { top: "#ffffff", east: style.curtain, south: shade(style.curtain, -0.12) }) +
    box3(188, 178, 58, 28, 46, 62, { top: "#ffffff", east: style.curtain, south: shade(style.curtain, -0.12) }) +
    box3(148, 168, 36, 18, 62, 72, { top: shade(style.accent, 0.15), east: style.accent, south: shade(style.accent, -0.2) });
  const side = (x) =>
    box3(x, 186, 32, 36, 0, 42, { top: style.wood, east: shade(style.wood, -0.1), south: shade(style.wood, -0.28) }) +
    box3(x + 8, 196, 16, 16, 42, 58, { top: "#fff4cc", east: shade(style.wood, 0.2), south: style.wood }) +
    `<ellipse cx="${iso(x + 16, 70, 204).x.toFixed(1)}" cy="${iso(x + 16, 70, 204).y.toFixed(1)}" rx="18" ry="8" fill="url(#lamp)"/>`;
  const wardrobe = cabinetDoors(300, 150, 50, 100, 0, 168, style, 2);
  const bench = box3(130, 48, 100, 28, 0, 32, { top: style.wood, east: shade(style.wood, -0.12), south: shade(style.wood, -0.3) }) + slab(134, 52, 92, 20, 33, shade(style.accent, 0.2));
  const art = poly([iso(140, 120, 258), iso(220, 120, 258), iso(220, 158, 258), iso(140, 158, 258)], shade(style.sky, 0.2), style.wood, 2.2);
  return rug + frame + mattress + duvet + fold + head + pillows + side(48) + side(280) + wardrobe + bench + art + plant(20, 24, style, 1);
}

function bathScene(style, finish) {
  const tileWall = [0, 28, 56, 84, 112, 140]
    .map((y) =>
      [210, 238, 266, 294, 322]
        .map((x) => poly([iso(x, y + 12, 258), iso(x + 26, y + 12, 258), iso(x + 26, y + 36, 258), iso(x, y + 36, 258)], y % 56 ? shade(style.accent, 0.45) : shade(style.wall, 0.1), "#9ec9e0", 0.5))
        .join("")
    )
    .join("");
  const vanity = cabinetDoors(28, 208, 150, 42, 0, 70, style, 3) + box3(24, 204, 158, 50, 70, 76, { top: finish === "prestige" ? "#ece7e1" : "#f7fbff", east: shade(style.accent, 0.1), south: shade(style.accent, -0.15) });
  const basin = slab(70, 216, 64, 28, 77, style.glass) + box3(96, 226, 12, 8, 77, 90, { top: style.metal, east: shade(style.metal, -0.15), south: shade(style.metal, -0.35) });
  const mirror = poly([iso(56, 96, 258), iso(150, 96, 258), iso(150, 160, 258), iso(56, 160, 258)], "url(#winlight)", style.metal, 2);
  const lights = [70, 100, 130]
    .map((x) => `<ellipse cx="${iso(x, 164, 257).x.toFixed(1)}" cy="${iso(x, 164, 257).y.toFixed(1)}" rx="7" ry="4" fill="#fff4cc"/>`)
    .join("");
  const tray = box3(210, 148, 130, 100, 0, 8, { top: shade(style.floor, 0.15), east: shade(style.floor, -0.1), south: shade(style.floor, -0.25) });
  const glass = poly([iso(210, 8, 148), iso(210, 168, 148), iso(340, 168, 148), iso(340, 8, 148)], "rgba(214,238,252,0.28)", "#9ec9e0", 1.4);
  const door = poly([iso(248, 8, 148), iso(248, 160, 148), iso(300, 160, 148), iso(300, 8, 148)], "rgba(255,255,255,0.18)", style.metal, 1);
  const head = box3(250, 236, 40, 16, 150, 168, { top: style.metal, east: shade(style.metal, -0.1), south: shade(style.metal, -0.3) });
  const rain = `<ellipse cx="${iso(270, 146, 244).x.toFixed(1)}" cy="${iso(270, 146, 244).y.toFixed(1)}" rx="16" ry="7" fill="${style.metal}"/>`;
  const niche = poly([iso(268, 90, 258), iso(318, 90, 258), iso(318, 118, 258), iso(268, 118, 258)], shade(style.accent, 0.25), "#8fbdd6", 1);
  const towels = box3(186, 210, 16, 10, 70, 118, { top: style.curtain, east: shade(style.curtain, -0.1), south: shade(style.accent, 0.2) });
  const wc = box3(28, 40, 40, 54, 0, 36, { top: "#f7fbff", east: shade(style.wall, -0.08), south: shade(style.wall, -0.16) }) + box3(36, 70, 24, 18, 36, 52, { top: "#ffffff", east: style.curtain, south: shade(style.wall, -0.1) });
  return tileWall + vanity + basin + mirror + lights + tray + glass + door + head + rain + niche + towels + wc + plant(330, 24, style, 0.75);
}

function sceneFor(input, style) {
  const room = String(input.scene || input.rooms || "Living").toLowerCase();
  const finish = input.finish || "signature";
  if (room.includes("kitchen")) return kitchenScene(style, finish);
  if (room.includes("bed")) return bedroomScene(style, finish);
  if (room.includes("bath")) return bathScene(style, finish);
  return livingScene(style, finish);
}

function interior3d(input) {
  const style = STYLES[input.style] || STYLES.ice;
  const photo = (input.photos || [])[0];
  const room = parseRooms(input.rooms)[0] || "Living";
  const furniture = sceneFor(input, style);
  return svgWrap(
    1100,
    720,
    `<rect width="1100" height="720" fill="url(#icebg)"/>
     <text x="36" y="40" font-family="Fraunces, Georgia, serif" font-size="26" fill="${style.text}">3D concept · ${escapeXml(input.client_name || "Client")}</text>
     <text x="36" y="62" font-family="Outfit, Segoe UI, sans-serif" font-size="14" fill="#5b7388">${escapeXml(input.address || "")} · ${escapeXml(input.style || "ice")} · ${escapeXml(room)} · ${escapeXml(input.finish || "signature")}</text>
     <g filter="url(#soft)">
       ${roomShell(style, photo)}
       ${furniture}
     </g>
     <text x="550" y="692" text-anchor="middle" font-family="Outfit, Segoe UI, sans-serif" font-size="13" fill="#5b7388">${escapeXml(input.notes || "Detailed Colombo interior concept from the submitted brief.")}</text>`,
    style
  );
}

function escapeXml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function generate(input) {
  return input.mode === "3d" ? interior3d(input) : floorPlan2d(input);
}

module.exports = { generate, parseRooms, STYLES };
