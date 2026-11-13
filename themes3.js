// 版型：同一套背景，依每頁內容自動變化（簡單但不單調）
const VARIANT_LABELS = {
  auto: '自動', title: '標題頁', plain: '一般', band: '一般・側邊色條', rule: '一般・底部分隔線',
  brackets: '一般・框角', spark: '重點句・星芒', num: '編號重點', spot: '深色強調',
};
const hexA = (hex, a) => hex + hex2(a);
const ptext = p => p.map(r => r.t).join('');
const NUM_RE = /^\s*([1-9１-９])\s*[\.、．]\s*/;

function autoVariant(sl, idx) {
  if (sl.variant && sl.variant !== 'auto') return sl.variant;
  if (idx === 0) return 'title';
  const ps = sl.paras.map(ptext).map(s => s.trim()).filter(Boolean);
  if (ps.length && NUM_RE.test(ps[0]) && ps[0].length <= 44) return 'num';
  if (ps.length && ps.length <= 2 && ps.join('').length <= 34) return 'spark';
  return ['plain', 'band', 'rule', 'brackets', 'plain', 'rule'][idx % 6];
}
function slideTheme(T, v) {
  return v === 'spot' ? Object.assign({}, T, { text: '#F7F0E6', red: '#FF9C86', dark: true }) : T;
}

// ---- 通用裝飾（疊在任何一套背景上）----
function decorate(c, T, v, p) {
  const a = T.accent;
  c.save();
  switch (v) {
    case 'band': c.fillStyle = hexA(a, .9); c.fillRect(p % 2 === 0 ? W - 120 : 104, 0, 14, 170); break;
    case 'rule':
      c.fillStyle = hexA(a, .7); c.fillRect(160, H - 130, W - 320, 2); star(c, W - 170, H - 130, 26, hexA(a, .95)); star(c, W - 214, H - 152, 11, hexA(a, .7)); break;
    case 'brackets':
      c.strokeStyle = hexA(a, .8); c.lineWidth = 4; c.beginPath();
      c.moveTo(108, 250); c.lineTo(108, 108); c.lineTo(260, 108); c.moveTo(W - 108, H - 250); c.lineTo(W - 108, H - 108); c.lineTo(W - 260, H - 108); c.stroke(); break;
    case 'spark':
      star(c, 190, 190, 64, a); star(c, 270, 120, 28, a); star(c, W - 200, H - 170, 40, hexA(a, .8)); star(c, W - 262, H - 118, 18, hexA(a, .7)); break;
    case 'num':
      star(c, W - 200, 140, 36, a); star(c, W - 252, 92, 16, hexA(a, .8)); break;
  }
  c.restore();
}

// ---- 深色強調：暖色光暈或散景 ----
function drawSpot(c, T, p) {
  c.fillStyle = '#14110e'; c.fillRect(0, 0, W, H);
  blob(c, W / 2, H / 2, 900, '#3a2d22', .7);
  const r = rng(77 + p * 13), gold = '#E3A85F';
  if (p % 2 === 0) {
    const cx = W * (.28 + r() * .44), cy = H * (.3 + r() * .3);
    blob(c, cx, cy, 560, gold, .5); blob(c, cx, cy, 210, '#FFE2B0', .9); blob(c, cx, cy, 64, '#FFFFFF', 1);
    c.save(); c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 16; i++) { c.save(); c.translate(cx, cy); c.rotate(i * Math.PI / 8); const g = c.createLinearGradient(0, 0, 560, 0); g.addColorStop(0, 'rgba(255,226,176,.45)'); g.addColorStop(1, 'rgba(255,226,176,0)'); c.fillStyle = g; c.fillRect(0, -2, 560, 4); c.restore(); }
    c.restore();
  } else {
    for (let i = 0; i < 24; i++) blob(c, r() * W, r() * H * .95, 30 + r() * 100, r() < .6 ? '#FFD9A0' : gold, .16 + r() * .3);
  }
  grain(c, W, H, .08);
  const g = c.createRadialGradient(W / 2, H / 2, H * .4, W / 2, H / 2, H); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.55)'); c.fillStyle = g; c.fillRect(0, 0, W, H);
}

// ---- 撕邊紙：仿手作紙片風格（自帶全部版型）----
function paperBase(c, P, seed) {
  const r = rng(seed);
  c.fillStyle = P.paper; c.fillRect(0, 0, W, H);
  for (let i = 0; i < 70; i++) blob(c, r() * W, r() * H, 120 + r() * 380, r() < .5 ? P.hi : P.lo, .06 + r() * .10);
  c.save(); c.lineWidth = 2;
  for (let i = 0; i < 26; i++) {
    let x = r() * W, y = r() * H; c.beginPath(); c.moveTo(x, y);
    for (let k = 0; k < 6; k++) { x += (r() - .5) * 260; y += (r() - .5) * 260; c.lineTo(x, y); }
    c.strokeStyle = r() < .5 ? hexA(P.hi, .35) : hexA(P.lo, .2); c.stroke();
  }
  c.restore(); grain(c, W, H, .10);
}
function jag(thick, seed) {
  const r = rng(seed), pts = []; let y = 0;
  for (let x = -20; x <= W + 20; x += 16) { y += (r() - .5) * 30; y *= .86; pts.push([x, thick + y + Math.sin(x / 310 + seed) * thick * .16 + Math.sin(x / 97 + seed * 2) * 8]); }
  return pts;
}
function tornStrip(c, P, side, thick, seed) {
  const pts = jag(thick, seed);
  c.save();
  if (side === 'bottom') { c.translate(0, H); c.scale(1, -1); }
  c.beginPath(); c.moveTo(-20, -20); pts.forEach(p => c.lineTo(p[0], p[1] + 10)); c.lineTo(W + 20, -20); c.closePath(); c.fillStyle = P.fringe; c.fill();
  c.beginPath(); c.moveTo(-20, -20); pts.forEach(p => c.lineTo(p[0], p[1])); c.lineTo(W + 20, -20); c.closePath();
  const g = c.createLinearGradient(0, 0, 0, thick + 40); g.addColorStop(0, P.edgeD); g.addColorStop(1, P.edgeL); c.fillStyle = g; c.fill();
  c.clip();
  const r = rng(seed + 7); for (let i = 0; i < 40; i++) blob(c, r() * W, r() * (thick + 40), 60 + r() * 160, r() < .5 ? P.edgeD : P.hi, .12 + r() * .14);
  grain(c, W, thick + 60, .16);
  c.restore();
}
function gridNote(c, x, y, w, h, rot) {
  c.save(); c.translate(x, y); c.rotate(rot);
  c.shadowColor = 'rgba(60,40,20,.35)'; c.shadowBlur = 18; c.shadowOffsetY = 6; c.fillStyle = '#f3f2ee'; c.fillRect(-w / 2, -h / 2, w, h); c.shadowColor = 'transparent';
  c.strokeStyle = 'rgba(120,150,190,.45)'; c.lineWidth = 1.5;
  for (let gx = -w / 2 + 34; gx < w / 2; gx += 34) { c.beginPath(); c.moveTo(gx, -h / 2); c.lineTo(gx, h / 2); c.stroke(); }
  for (let gy = -h / 2 + 34; gy < h / 2; gy += 34) { c.beginPath(); c.moveTo(-w / 2, gy); c.lineTo(w / 2, gy); c.stroke(); }
  c.fillStyle = 'rgba(214,196,160,.75)'; c.fillRect(-46, -h / 2 - 12, 92, 28);
  c.restore();
}
function tornBg(c, P, kind) {
  const seed = P.k.length * 131 + P.n.length * 17;
  paperBase(c, P, seed);
  switch (kind) {
    case 'title': tornStrip(c, P, 'top', 200, seed + 1); tornStrip(c, P, 'bottom', 90, seed + 2); gridNote(c, W - 220, 150, 230, 190, .08); gridNote(c, 140, H - 160, 250, 200, -.12); break;
    case 'band': tornStrip(c, P, 'top', 84, seed + 3); c.fillStyle = P.acc; c.fillRect(W - 120, 0, 16, 190); break;
    case 'rule': c.fillStyle = hexA(P.acc, .7); c.fillRect(160, H - 130, W - 320, 2); star(c, W - 170, H - 130, 26, P.acc); star(c, W - 214, H - 152, 11, hexA(P.acc, .7)); break;
    case 'brackets': decorate(c, { accent: P.acc }, 'brackets', 0); break;
    case 'spark': tornStrip(c, P, 'top', 78, seed + 4); decorate(c, { accent: P.acc }, 'spark', 0); break;
    case 'num': tornStrip(c, P, 'bottom', 108, seed + 5); decorate(c, { accent: P.acc }, 'num', 0); break;
    default: tornStrip(c, P, 'bottom', 118, seed + 6);
  }
}
(function () {
  const TORN = [
    { k: 'kraft', n: '牛皮棕', hue: 'warm', paper: '#E9E1D3', hi: '#FFFBF2', lo: '#B8A88C', edgeD: '#6E4F34', edgeL: '#A58660', fringe: '#F2EBDD', acc: '#6B4A2F', text: '#1E1914', card: '#F5EFE4' },
    { k: 'stone', n: '灰石', hue: 'neutral', paper: '#E7E7E4', hi: '#FFFFFF', lo: '#A9ABAE', edgeD: '#5B5F66', edgeL: '#8D9198', fringe: '#F1F1EF', acc: '#4B5058', text: '#1B1D20', card: '#F4F4F2' },
    { k: 'moss', n: '青苔綠', hue: 'green', paper: '#E4E8DC', hi: '#FAFFF4', lo: '#A3AE96', edgeD: '#3F5642', edgeL: '#6F8A70', fringe: '#EEF2E7', acc: '#3F5642', text: '#1A241C', card: '#F2F5EC' },
    { k: 'clay', n: '陶土紅', hue: 'warm', paper: '#EFE2D5', hi: '#FFF8F0', lo: '#BFA38E', edgeD: '#8A4A36', edgeL: '#B97A60', fringe: '#F6EBDD', acc: '#8A4A36', text: '#241812', card: '#F8EEE3' },
    { k: 'ink', n: '墨藍', hue: 'cool', paper: '#E3E7EC', hi: '#F9FBFF', lo: '#A4AEBB', edgeD: '#2F4260', edgeL: '#60769A', fringe: '#EEF1F5', acc: '#2F4260', text: '#141B26', card: '#F2F4F8' },
  ];
  const rest = Object.entries(THEMES); rest.forEach(([k]) => delete THEMES[k]);
  TORN.forEach(P => {
    THEMES['torn_' + P.k] = {
      name: '撕邊紙・' + P.n, text: P.text, red: '#B3261E', accent: P.acc, dark: false, hue: P.hue, ownVariants: true,
      card: { fill: P.card, alpha: .97, radius: 10, grain: false, deco: 'leftbar' },
      bg(c, kind) { tornBg(c, P, kind); }
    };
  });
  rest.forEach(([k, t]) => { THEMES[k] = t; });
})();

// 各套背景的裝飾占用區（文字自動避開）：波浪在底部、拱門在右側
Object.entries(THEMES).forEach(([k, t]) => {
  if (/^g4_/.test(k)) t.safe = { b: 170 };
  if (/^g8_/.test(k)) t.safe = { r: 380 };
});
Object.assign(THEMES.ocean, { safe: { b: 170 } }); Object.assign(THEMES.spring, { safe: { b: 220 } });
Object.assign(THEMES.snownight, { safe: { b: 150 } }); Object.assign(THEMES.retro, { safe: { b: 170 } }); Object.assign(THEMES.sunrise, { safe: { b: 240 } });
