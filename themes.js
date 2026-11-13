// 主題：現場版背景與長條版卡片共用同一組顏色與裝飾語彙
const W = 1920, H = 1080;

function rng(seed) { // mulberry32
  let a = seed >>> 0;
  return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
function mk(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

let _grain;
function grain(ctx, w, h, alpha, mode = 'overlay') {
  if (!_grain) {
    _grain = mk(256, 256);
    const g = _grain.getContext('2d'), id = g.createImageData(256, 256), r = rng(7);
    for (let i = 0; i < id.data.length; i += 4) { const v = 90 + r() * 90; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255; }
    g.putImageData(id, 0, 0);
  }
  ctx.save(); ctx.globalAlpha = alpha; ctx.globalCompositeOperation = mode;
  ctx.fillStyle = ctx.createPattern(_grain, 'repeat'); ctx.fillRect(0, 0, w, h); ctx.restore();
}
function blob(ctx, x, y, r, color, a) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color + hex2(a)); g.addColorStop(1, color + '00');
  ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
}
function hex2(a) { return Math.round(a * 255).toString(16).padStart(2, '0'); }
function star(ctx, cx, cy, r, color) {
  const k = r * 0.16; ctx.fillStyle = color; ctx.beginPath();
  ctx.moveTo(cx, cy - r); ctx.lineTo(cx + k, cy - k); ctx.lineTo(cx + r, cy); ctx.lineTo(cx + k, cy + k);
  ctx.lineTo(cx, cy + r); ctx.lineTo(cx - k, cy + k); ctx.lineTo(cx - r, cy); ctx.lineTo(cx - k, cy - k); ctx.closePath(); ctx.fill();
}
function rrect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }
function diamond(ctx, x, y, r, color) { ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(x, y - r); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r, y); ctx.closePath(); ctx.fill(); }

// 一小枝橄欖枝（線條 + 葉片）
function branch(ctx, x, y, ang, len, color, alpha, flip = 1) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.globalAlpha = alpha; ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.bezierCurveTo(len * .3, -len * .08 * flip, len * .65, len * .1 * flip, len, 0); ctx.stroke();
  const n = 9;
  for (let i = 1; i <= n; i++) {
    const t = i / (n + 1), px = len * t, py = Math.sin(t * Math.PI * 1.2) * len * .03 * flip * -1;
    const s = (1 - t * .5) * len * .09;
    for (const side of [-1, 1]) {
      ctx.save(); ctx.translate(px, py); ctx.rotate(side * (.9 - t * .2)); ctx.beginPath(); ctx.ellipse(s, 0, s, s * .38, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
  }
  ctx.restore();
}

const THEMES = {
  paper: {
    name: '米色紙本', text: '#2B2118', red: '#C00000', accent: '#7A5A38', dark: false,
    card: { fill: '#F3EBDD', alpha: 1, radius: 10, grain: true, deco: 'bookmark' },
    bg(c, kind) {
      c.fillStyle = '#F3EBDD'; c.fillRect(0, 0, W, H);
      const g = c.createRadialGradient(W / 2, H / 2, H * .35, W / 2, H / 2, W * .72);
      g.addColorStop(0, 'rgba(255,250,240,.0)'); g.addColorStop(1, 'rgba(120,92,56,.20)'); c.fillStyle = g; c.fillRect(0, 0, W, H);
      grain(c, W, H, .22);
      c.strokeStyle = this.accent + '59'; c.lineWidth = 2; c.strokeRect(40, 40, W - 80, H - 80);
      if (kind === 'title') { c.fillStyle = this.accent; c.fillRect(W * .35, H * .78, W * .30, 3); star(c, W / 2, H * .78 + 1, 26, this.accent); }
      else { star(c, W - 118, 118, 30, this.accent + 'cc'); star(c, W - 166, 156, 15, this.accent + 'aa'); }
    }
  },
  dusk: {
    name: '夜空星光', text: '#F4ECE0', red: '#FF8F7F', accent: '#E2BD83', dark: true,
    card: { fill: '#121428', alpha: .9, radius: 14, grain: false, deco: 'goldline' },
    bg(c, kind) {
      const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#0E1530'); g.addColorStop(.6, '#241F40'); g.addColorStop(1, '#5A3E48');
      c.fillStyle = g; c.fillRect(0, 0, W, H);
      blob(c, W * .85, H * 1.05, 760, '#FFBE78', .36); blob(c, W * .1, H * -.05, 600, '#6C7BD6', .22);
      const r = rng(11);
      for (let i = 0; i < 120; i++) { const x = r() * W, y = r() * H * .85; c.fillStyle = `rgba(255,240,215,${.12 + r() * .4})`; c.beginPath(); c.arc(x, y, .8 + r() * 1.8, 0, 7); c.fill(); }
      for (let i = 0; i < 6; i++) star(c, r() * W, r() * H * .5, 10 + r() * 12, 'rgba(255,230,180,.55)');
      grain(c, W, H, .10);
      if (kind === 'title') { c.fillStyle = this.accent; c.fillRect(W * .38, H * .78, W * .24, 2); star(c, W / 2, H * .78 + 1, 22, this.accent); }
    }
  },
  morning: {
    name: '晨曦柔光', text: '#3B2F3A', red: '#C0392B', accent: '#C47A5A', dark: false,
    card: { fill: '#FFFFFF', alpha: .9, radius: 26, grain: false, deco: 'pill' },
    bg(c, kind) {
      const g = c.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#FCEBDD'); g.addColorStop(.55, '#F8D9D3'); g.addColorStop(1, '#D5E3F0');
      c.fillStyle = g; c.fillRect(0, 0, W, H);
      blob(c, 300, 180, 520, '#FFD9B8', .65); blob(c, 1640, 280, 480, '#BBD3F0', .7); blob(c, 1000, 1050, 640, '#F7BFC4', .45);
      grain(c, W, H, .10);
      c.fillStyle = this.accent + 'cc'; rrect(c, 120, 90, 90, 8, 4); c.fill();
      if (kind === 'title') { rrect(c, W / 2 - 60, H * .78, 120, 8, 4); c.fill(); }
    }
  },
  olive: {
    name: '橄欖枝', text: '#263628', red: '#B03A2E', accent: '#6B8450', dark: false,
    card: { fill: '#F6F9EF', alpha: 1, radius: 16, grain: false, deco: 'leaf' },
    bg(c, kind) {
      const g = c.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#EEF2E4'); g.addColorStop(1, '#DCE5CE'); c.fillStyle = g; c.fillRect(0, 0, W, H);
      grain(c, W, H, .14);
      branch(c, -20, H - 70, -.38, 620, '#6B8450', .5); branch(c, W + 30, 130, Math.PI - .35, 560, '#7C9A63', .45, -1);
      if (kind === 'title') { c.strokeStyle = this.accent; c.lineWidth = 3; c.beginPath(); c.moveTo(W * .38, H * .78); c.lineTo(W * .62, H * .78); c.stroke(); }
    }
  },
  minimal: {
    name: '極簡素雅', text: '#1B1B1B', red: '#C0392B', accent: '#1F3A5F', dark: false,
    card: { fill: '#FFFFFF', alpha: 1, radius: 4, grain: false, deco: 'leftbar' },
    bg(c, kind) {
      c.fillStyle = '#FAF9F6'; c.fillRect(0, 0, W, H);
      grain(c, W, H, .06);
      c.fillStyle = this.accent; c.fillRect(0, 0, 14, H);
      c.fillRect(110, 96, 64, 5);
      if (kind === 'title') c.fillRect(W / 2 - 80, H * .78, 160, 4);
    }
  },
  burgundy: {
    name: '酒紅鎏金', text: '#F7EBD2', red: '#FF9A8A', accent: '#D8B472', dark: true,
    card: { fill: '#34101A', alpha: .94, radius: 8, grain: false, deco: 'gold2' },
    bg(c, kind) {
      const g = c.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#4D1020'); g.addColorStop(1, '#27070F'); c.fillStyle = g; c.fillRect(0, 0, W, H);
      blob(c, W / 2, H / 2, 900, '#FFC87C', .10); grain(c, W, H, .10);
      c.strokeStyle = this.accent + 'cc'; c.lineWidth = 3; c.strokeRect(34, 34, W - 68, H - 68);
      c.strokeStyle = this.accent + '66'; c.lineWidth = 1.5; c.strokeRect(50, 50, W - 100, H - 100);
      for (const [x, y] of [[34, 34], [W - 34, 34], [34, H - 34], [W - 34, H - 34]]) diamond(c, x, y, 12, this.accent);
      if (kind === 'title') { c.fillStyle = this.accent; c.fillRect(W * .38, H * .78, W * .24, 2); diamond(c, W / 2, H * .78 + 1, 12, this.accent); }
    }
  }
};

// 長條卡片（與 bg 同一組裝飾語彙）。回傳 canvas（w×h，含陰影空間外不含）
function drawCard(theme, w, h, seed) {
  const T = theme, s = 2, c = mk(w * s, h * s), x = c.getContext('2d'); x.scale(s, s);
  const k = T.card;
  x.save(); rrect(x, 0, 0, w, h, k.radius); x.clip();
  x.globalAlpha = k.alpha; x.fillStyle = k.fill; x.fillRect(0, 0, w, h); x.globalAlpha = 1;
  if (k.grain) grain(x, w, h, .22);
  x.restore();
  const A = T.accent;
  switch (k.deco) {
    case 'bookmark':
      x.fillStyle = A; x.fillRect(w - 92, 0, 36, 62); star(x, 52, 56, 20, A); star(x, 82, 34, 10, A);
      x.strokeStyle = A; x.lineWidth = 2; x.beginPath(); x.moveTo(34, h - 70); x.lineTo(34, h - 26); x.lineTo(120, h - 26); x.stroke(); break;
    case 'goldline':
      x.strokeStyle = A + 'b0'; x.lineWidth = 2; rrect(x, 8, 8, w - 16, h - 16, k.radius - 4); x.stroke();
      star(x, 56, 52, 18, A); star(x, 84, 32, 9, A); break;
    case 'pill':
      x.fillStyle = A; rrect(x, 48, 30, 70, 8, 4); x.fill(); x.fillStyle = A + '88'; rrect(x, 128, 30, 18, 8, 4); x.fill(); break;
    case 'leaf':
      x.strokeStyle = A + 'aa'; x.lineWidth = 2; rrect(x, 7, 7, w - 14, h - 14, Math.max(2, k.radius - 3)); x.stroke();
      branch(x, w - 30, 54, Math.PI * .92, 150, A, .65, -1); break;
    case 'leftbar':
      x.fillStyle = A; x.fillRect(0, 0, 12, h); x.fillRect(48, 28, 44, 4); break;
    case 'dots3':
      [1, .72, .45].forEach((al, i) => { x.fillStyle = A; x.globalAlpha = al; x.beginPath(); x.arc(52 + i * 30, 36, 10, 0, 7); x.fill(); }); x.globalAlpha = 1; break;
    case 'arch':
      x.fillStyle = A; rrect(x, w - 120, 0, 40, 60, [0, 0, 20, 20]); x.fill();
      x.fillStyle = A + '77'; rrect(x, w - 70, 0, 30, 38, [0, 0, 15, 15]); x.fill(); break;
    case 'wave':
      x.strokeStyle = A + '99'; x.lineWidth = 3; x.beginPath();
      for (let px = 40; px <= w - 40; px += 4) { const py = h - 18 + Math.sin(px / 18) * 5; px === 40 ? x.moveTo(px, py) : x.lineTo(px, py); } x.stroke();
      x.fillStyle = A; x.beginPath(); x.arc(52, 34, 9, 0, 7); x.fill(); break;
    case 'circles':
      x.fillStyle = A + 'cc'; x.beginPath(); x.arc(w - 74, 40, 26, 0, 7); x.fill();
      x.fillStyle = A + '66'; x.beginPath(); x.arc(w - 118, 54, 16, 0, 7); x.fill(); break;
    case 'corners':
      x.strokeStyle = A; x.lineWidth = 2;
      for (const [px, py, dx, dy] of [[10, 10, 1, 1], [w - 10, 10, -1, 1], [10, h - 10, 1, -1], [w - 10, h - 10, -1, -1]]) {
        x.beginPath(); x.moveTo(px + dx * 60, py); x.lineTo(px, py); x.lineTo(px, py + dy * 40); x.stroke();
        x.beginPath(); x.moveTo(px + dx * 36, py + dy * 10); x.lineTo(px + dx * 10, py + dy * 10); x.lineTo(px + dx * 10, py + dy * 26); x.stroke();
      } break;
    case 'sun':
      x.save(); x.beginPath(); x.rect(w - 130, 0, 100, 46); x.clip(); x.fillStyle = A; x.beginPath(); x.arc(w - 80, 46, 34, 0, 7); x.fill(); x.restore();
      x.fillStyle = A + '66'; x.fillRect(w - 150, 46, 140, 3); break;
    case 'frame':
      x.strokeStyle = '#ffffffcc'; x.lineWidth = 2; x.strokeRect(7, 7, w - 14, h - 14);
      x.fillStyle = '#fff'; x.fillRect(w - 62, 7, 24, 24); break;
    case 'gold2':
      x.strokeStyle = A + 'cc'; x.lineWidth = 2.5; x.strokeRect(6, 6, w - 12, h - 12);
      x.strokeStyle = A + '66'; x.lineWidth = 1.2; x.strokeRect(15, 15, w - 30, h - 30);
      for (const [px, py] of [[6, 6], [w - 6, 6], [6, h - 6], [w - 6, h - 6]]) diamond(x, px, py, 9, A); break;
  }
  return c;
}


function circ(c, x, y, r, col) { c.fillStyle = col; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); }
function wave(c, base, amp, len, col, phase) {
  c.fillStyle = col; c.beginPath(); c.moveTo(0, H);
  for (let x = 0; x <= W; x += 6) c.lineTo(x, base + Math.sin(x / len + phase) * amp);
  c.lineTo(W, H); c.closePath(); c.fill();
}
function cornerDeco(c, col) {
  c.strokeStyle = col; c.lineWidth = 3;
  for (const [px, py, dx, dy] of [[40, 40, 1, 1], [W - 40, 40, -1, 1], [40, H - 40, 1, -1], [W - 40, H - 40, -1, -1]]) {
    c.beginPath(); c.moveTo(px + dx * 150, py); c.lineTo(px, py); c.lineTo(px, py + dy * 100); c.stroke();
    c.lineWidth = 1.5; c.beginPath(); c.moveTo(px + dx * 90, py + dy * 22); c.lineTo(px + dx * 22, py + dy * 22); c.lineTo(px + dx * 22, py + dy * 66); c.stroke(); c.lineWidth = 3;
    diamond(c, px + dx * 170, py, 7, col); diamond(c, px, py + dy * 120, 7, col);
  }
}

Object.assign(THEMES, {
  sage: {
    name: '鼠尾草', serif: true, text: '#363A20', red: '#A63D2F', accent: '#6E7545', dark: false,
    card: { fill: '#E7E8C8', alpha: 1, radius: 24, grain: false, deco: 'dots3' },
    bg(c, kind) {
      c.fillStyle = '#DCDDB5'; c.fillRect(0, 0, W, H); circ(c, W + 40, H + 60, 440, 'rgba(110,117,69,.14)'); grain(c, W, H, .08);
      [1, .72, .45].forEach((a, i) => circ(c, 150 + i * 50, 120, 19, `rgba(110,117,69,${a})`));
      if (kind === 'title') [1, .72, .45].forEach((a, i) => circ(c, W / 2 - 50 + i * 50, H * .78, 14, `rgba(110,117,69,${a})`));
    }
  },
  terracotta: {
    name: '陶土暖橘', serif: true, text: '#46281B', red: '#A32A1E', accent: '#C8754B', dark: false,
    card: { fill: '#FBF1E6', alpha: 1, radius: 14, grain: false, deco: 'arch' },
    bg(c, kind) {
      c.fillStyle = '#F2DECB'; c.fillRect(0, 0, W, H); grain(c, W, H, .10);
      c.fillStyle = '#C8754B'; rrect(c, W - 160, H - 300, 100, 300, [50, 50, 0, 0]); c.fill();
      c.fillStyle = '#E2A57F'; rrect(c, W - 270, H - 190, 90, 190, [45, 45, 0, 0]); c.fill();
      c.fillStyle = '#C8754B'; c.fillRect(120, 96, 90, 8);
      if (kind === 'title') { c.fillRect(W / 2 - 60, H * .78, 120, 8); }
    }
  },
  ocean: {
    name: '海天藍', text: '#14304A', red: '#B3261E', accent: '#2F6F9F', dark: false,
    card: { fill: '#FFFFFF', alpha: .94, radius: 18, grain: false, deco: 'wave' },
    bg(c, kind) {
      const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#E8F1F8'); g.addColorStop(1, '#C2D9EA'); c.fillStyle = g; c.fillRect(0, 0, W, H);
      wave(c, H - 130, 26, 90, 'rgba(156,195,222,.45)', 0); wave(c, H - 90, 24, 110, 'rgba(111,163,201,.40)', 2); wave(c, H - 48, 20, 80, 'rgba(47,111,159,.35)', 4);
      circ(c, 160, 120, 14, this.accent); grain(c, W, H, .06);
    }
  },
  lavender: {
    name: '薰衣草', serif: true, text: '#2F2547', red: '#B3261E', accent: '#7A5FA8', dark: false,
    card: { fill: '#F7F3FC', alpha: 1, radius: 28, grain: false, deco: 'circles' },
    bg(c, kind) {
      const g = c.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#F0EAF8'); g.addColorStop(1, '#E0D6F0'); c.fillStyle = g; c.fillRect(0, 0, W, H);
      circ(c, 1730, 150, 190, 'rgba(201,184,232,.55)'); circ(c, 1580, 250, 92, 'rgba(178,155,219,.5)'); circ(c, 180, 1000, 280, 'rgba(216,203,239,.6)'); grain(c, W, H, .06);
    }
  },
  forest: {
    name: '深林金葉', text: '#EFF3E2', red: '#FF9C8A', accent: '#C9B26B', dark: true,
    card: { fill: '#14301F', alpha: .92, radius: 12, grain: false, deco: 'leaf' },
    bg(c, kind) {
      const g = c.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#1D3E29'); g.addColorStop(1, '#0F2218'); c.fillStyle = g; c.fillRect(0, 0, W, H);
      blob(c, W * .2, H * .1, 700, '#9BC28A', .12); grain(c, W, H, .10);
      branch(c, -20, H - 40, -.30, 460, '#C9B26B', .5); branch(c, W + 30, 120, Math.PI - .33, 560, '#C9B26B', .5, -1);
    }
  },
  midnight: {
    name: '午夜藍金', serif: true, text: '#F5EBD0', red: '#FF9A8A', accent: '#D4B068', dark: true,
    card: { fill: '#0B1A38', alpha: .94, radius: 6, grain: false, deco: 'corners' },
    bg(c, kind) {
      const g = c.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#102449'); g.addColorStop(1, '#070F24'); c.fillStyle = g; c.fillRect(0, 0, W, H);
      blob(c, W / 2, H / 2, 900, '#4C6FB8', .10); grain(c, W, H, .08); cornerDeco(c, this.accent);
      if (kind === 'title') { c.fillStyle = this.accent; c.fillRect(W * .4, H * .78, W * .2, 2); diamond(c, W / 2, H * .78 + 1, 10, this.accent); }
    }
  },
  sunrise: {
    name: '日出霞光', text: '#FFFFFF', red: '#FFB9A6', accent: '#FFD18A', dark: true,
    card: { fill: '#2A2250', alpha: .92, radius: 20, grain: false, deco: 'sun' },
    bg(c, kind) {
      const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#1C1E4E'); g.addColorStop(.55, '#3A2B62'); g.addColorStop(.84, '#8F466B'); g.addColorStop(1, '#E88F5A');
      c.fillStyle = g; c.fillRect(0, 0, W, H);
      blob(c, W / 2, H + 40, 620, '#FFD18A', .75); c.save(); c.beginPath(); c.rect(0, 0, W, H); c.clip(); circ(c, W / 2, H + 30, 190, '#FFE3AE'); c.restore();
      const r = rng(5); for (let i = 0; i < 50; i++) circ(c, r() * W, r() * H * .45, .8 + r() * 1.4, `rgba(255,240,215,${.2 + r() * .4})`);
      grain(c, W, H, .08);
    }
  },
  mono: {
    name: '墨黑高對比', text: '#FFFFFF', red: '#FF7A6B', accent: '#FFFFFF', dark: true,
    card: { fill: '#0E0E0E', alpha: .95, radius: 2, grain: false, deco: 'frame' },
    bg(c, kind) {
      c.fillStyle = '#101010'; c.fillRect(0, 0, W, H); grain(c, W, H, .08);
      c.strokeStyle = 'rgba(255,255,255,.85)'; c.lineWidth = 2; c.strokeRect(40, 40, W - 80, H - 80);
      c.fillStyle = '#fff'; c.fillRect(W - 120, 40, 40, 40);
      if (kind === 'title') c.fillRect(W / 2 - 80, H * .78, 160, 3);
    }
  },
  sunny: {
    name: '暖陽黃', text: '#4A2F14', red: '#B3261E', accent: '#D9822B', dark: false,
    card: { fill: '#FFF8DF', alpha: 1, radius: 22, grain: false, deco: 'dots3' },
    bg(c, kind) {
      c.fillStyle = '#FFF0C4'; c.fillRect(0, 0, W, H); circ(c, 0, H, 320, 'rgba(255,205,96,.55)'); grain(c, W, H, .06);
      for (let i = 0; i < 8; i++) for (let j = 0; j < 4; j++) circ(c, W - 360 + i * 40, 70 + j * 40, 5, 'rgba(217,130,43,.4)');
      c.fillStyle = this.accent; c.fillRect(120, 96, 90, 8);
    }
  },
  cloud: {
    name: '雲朵晴空', serif: true, text: '#2B2A5C', red: '#B3261E', accent: '#6C6FD1', dark: false,
    card: { fill: '#FFFFFF', alpha: .95, radius: 30, grain: false, deco: 'circles' },
    bg(c, kind) {
      const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#C9CBF3'); g.addColorStop(1, '#E7E8FA'); c.fillStyle = g; c.fillRect(0, 0, W, H);
      const cl = (x, y, s, a) => { for (const [dx, dy, r] of [[0, 0, 70], [80, -30, 90], [170, 0, 70], [90, 20, 80]]) circ(c, x + dx * s, y + dy * s, r * s, `rgba(255,255,255,${a})`); };
      cl(120, 170, 1.3, .8); cl(1450, 120, 1.6, .75); cl(1000, 960, 1.8, .7); cl(-60, 900, 1.4, .6);
      c.save(); c.beginPath(); c.moveTo(W / 2, -20); c.lineTo(W / 2 - 520, H); c.lineTo(W / 2 + 520, H); c.closePath(); c.fillStyle = 'rgba(255,255,255,.12)'; c.fill(); c.restore();
      grain(c, W, H, .05);
    }
  },
  ember: {
    name: '暗夜紅光', text: '#FFF3EC', red: '#FF9A7A', accent: '#E0503A', dark: true,
    card: { fill: '#120A0C', alpha: .94, radius: 10, grain: false, deco: 'goldline' },
    bg(c, kind) {
      c.fillStyle = '#0D0809'; c.fillRect(0, 0, W, H);
      blob(c, W / 2, H * .98, 1100, '#E0503A', .55); blob(c, W / 2, H * 1.05, 600, '#FF9A5A', .45);
      for (const r of [380, 560, 740]) { c.strokeStyle = `rgba(224,80,58,${.28 - r / 4000})`; c.lineWidth = 2; c.beginPath(); c.arc(W / 2, H + 80, r, Math.PI, 2 * Math.PI); c.stroke(); }
      grain(c, W, H, .09);
    }
  },
  rose: {
    name: '玫瑰粉霧', serif: true, text: '#4A2330', red: '#B3261E', accent: '#C9667F', dark: false,
    card: { fill: '#FFF5F6', alpha: 1, radius: 24, grain: false, deco: 'pill' },
    bg(c, kind) {
      const g = c.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#FBE6EA'); g.addColorStop(1, '#F3CFD8'); c.fillStyle = g; c.fillRect(0, 0, W, H);
      circ(c, 1760, 140, 230, 'rgba(232,160,178,.5)'); circ(c, 1620, 270, 100, 'rgba(201,102,127,.35)'); circ(c, 150, 960, 300, 'rgba(240,184,198,.6)');
      c.fillStyle = this.accent; c.fillRect(120, 96, 90, 8); grain(c, W, H, .06);
    }
  },
  watercolor: {
    name: '水彩暈染', serif: true, text: '#2A2622', red: '#B3261E', accent: '#E07B4A', dark: false,
    card: { fill: '#FFFDF9', alpha: .96, radius: 22, grain: false, deco: 'pill' },
    bg(c, kind) {
      c.fillStyle = '#FBF8F3'; c.fillRect(0, 0, W, H);
      blob(c, 80, 60, 520, '#F08A4B', .55); blob(c, 330, 20, 360, '#F5B36A', .45); blob(c, W - 60, H - 40, 560, '#4FA79B', .45);
      blob(c, W - 380, H + 20, 380, '#E07B4A', .35); blob(c, W - 40, 40, 300, '#F5B36A', .3); blob(c, 30, H - 30, 320, '#4FA79B', .3);
      grain(c, W, H, .06);
    }
  },
  skyframe: {
    name: '淺藍細框', serif: true, text: '#1F2F4A', red: '#B3261E', accent: '#4A78A8', dark: false,
    card: { fill: '#F4F9FE', alpha: .97, radius: 16, grain: false, deco: 'corners' },
    bg(c, kind) {
      c.fillStyle = '#CFE3F3'; c.fillRect(0, 0, W, H); blob(c, W / 2, H / 2, 900, '#FFFFFF', .35);
      c.strokeStyle = this.accent; c.lineWidth = 2.5; c.strokeRect(70, 70, W - 140, H - 140); c.lineWidth = 1.2; c.strokeRect(90, 90, W - 180, H - 180);
      for (const [x, y] of [[70, 70], [W - 70, 70], [70, H - 70], [W - 70, H - 70], [W / 2, 70], [W / 2, H - 70]]) { c.fillStyle = '#CFE3F3'; c.fillRect(x - 22, y - 22, 44, 44); diamond(c, x, y, 16, this.accent); }
      grain(c, W, H, .05);
    }
  },
  charcoal: {
    name: '炭灰金枝', serif: true, text: '#F3E7CB', red: '#FF9C84', accent: '#D1B06A', dark: true,
    card: { fill: '#2C2C2E', alpha: .94, radius: 10, grain: false, deco: 'leaf' },
    bg(c, kind) {
      const g = c.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#4A4A4C'); g.addColorStop(1, '#2A2A2C'); c.fillStyle = g; c.fillRect(0, 0, W, H);
      grain(c, W, H, .10);
      c.strokeStyle = this.accent; c.lineWidth = 2; c.globalAlpha = .8; c.strokeRect(60, 60, W - 120, H - 120); c.globalAlpha = 1;
      branch(c, 70, 300, -Math.PI / 2 + .1, 220, this.accent, .7); branch(c, W - 70, H - 300, Math.PI / 2 + .1, 220, this.accent, .7);
      branch(c, 300, 70, .02, 260, this.accent, .6); branch(c, W - 300, H - 70, Math.PI + .02, 260, this.accent, .6);
      const r = rng(11); for (let i = 0; i < 60; i++) circ(c, r() * W, r() * H, .8 + r() * 1.2, 'rgba(209,176,106,.45)');
    }
  },
  royal: {
    name: '寶藍燭光', serif: true, text: '#FFFFFF', red: '#FFB38A', accent: '#E9D7A6', dark: true,
    card: { fill: '#10286A', alpha: .93, radius: 8, grain: false, deco: 'goldline' },
    bg(c, kind) {
      const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#1B3F9C'); g.addColorStop(1, '#0C1F5C'); c.fillStyle = g; c.fillRect(0, 0, W, H);
      const r = rng(21); for (let i = 0; i < 40; i++) blob(c, r() * W, r() * H, 30 + r() * 70, '#9FB8FF', .10 + r() * .12);
      c.strokeStyle = 'rgba(233,215,166,.85)'; c.lineWidth = 2; c.beginPath(); c.roundRect(80, 80, W - 160, H - 160, 14); c.stroke();
      blob(c, W / 2, H + 60, 700, '#E9D7A6', .18); grain(c, W, H, .06);
    }
  },
  sunray: {
    name: '暖紅光芒', text: '#FFE2B0', red: '#FFB38A', accent: '#F2A33A', dark: true,
    card: { fill: '#4A1416', alpha: .94, radius: 12, grain: false, deco: 'sun' },
    bg(c, kind) {
      c.fillStyle = '#5A1A1C'; c.fillRect(0, 0, W, H);
      c.save(); c.translate(W / 2, H / 2); for (let i = 0; i < 24; i++) { c.rotate(Math.PI / 12); c.fillStyle = 'rgba(120,32,30,.45)'; c.beginPath(); c.moveTo(0, 0); c.lineTo(2400, -190); c.lineTo(2400, 190); c.closePath(); c.fill(); } c.restore();
      blob(c, W / 2, H / 2, 800, '#2A0A0C', .35);
      c.strokeStyle = this.accent; c.lineWidth = 2; c.strokeRect(50, 50, W - 100, H - 100);
      grain(c, W, H, .08);
    }
  },
  duskcloud: {
    name: '黃昏雲彩', serif: true, text: '#FFFFFF', red: '#FFD0A8', accent: '#F4C9A0', dark: true,
    card: { fill: '#6E4636', alpha: .9, radius: 20, grain: false, deco: 'pill' },
    bg(c, kind) {
      const g = c.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#9A6A52'); g.addColorStop(.5, '#C08B68'); g.addColorStop(1, '#7B4E3E'); c.fillStyle = g; c.fillRect(0, 0, W, H);
      blob(c, W * .25, H * .3, 700, '#F2B07C', .5); blob(c, W * .8, H * .2, 600, '#E8A5A0', .4); blob(c, W * .6, H * .9, 800, '#5A3A30', .6); blob(c, W * .1, H * .95, 500, '#D88A60', .4);
      c.fillStyle = 'rgba(40,20,14,.22)'; c.fillRect(0, 0, W, H); grain(c, W, H, .08);
    }
  },
  cocoa: {
    name: '咖啡金邊', serif: true, text: '#F7E6C4', red: '#FFA58A', accent: '#E0B15A', dark: true,
    card: { fill: '#4A2F28', alpha: .94, radius: 14, grain: false, deco: 'gold2' },
    bg(c, kind) {
      c.fillStyle = '#573830'; c.fillRect(0, 0, W, H); blob(c, W / 2, H / 2, 1000, '#7A5244', .45); grain(c, W, H, .08);
      c.strokeStyle = this.accent; c.lineWidth = 2.5; c.globalAlpha = .9;
      c.beginPath(); c.moveTo(60, 190); c.arcTo(60, 60, 190, 60, 130); c.lineTo(W - 190, 60); c.arcTo(W - 60, 60, W - 60, 190, 130); c.stroke();
      c.beginPath(); c.moveTo(60, H - 190); c.arcTo(60, H - 60, 190, H - 60, 130); c.lineTo(W - 190, H - 60); c.arcTo(W - 60, H - 60, W - 60, H - 190, 130); c.stroke(); c.globalAlpha = 1;
      c.fillStyle = '#D9654A'; rrect(c, W / 2 - 90, H - 60 - 10, 180, 20, 10); c.fill();
    }
  },
  peach: {
    name: '蜜桃暖陽', serif: true, text: '#5A3320', red: '#B3261E', accent: '#D9825B', dark: false,
    card: { fill: '#FFF4EA', alpha: .97, radius: 34, grain: false, deco: 'dots3' },
    bg(c, kind) {
      c.fillStyle = '#EBC09A'; c.fillRect(0, 0, W, H);
      c.save(); c.globalAlpha = .35; c.fillStyle = '#F7D9BC'; for (let i = -2; i < 8; i++) { c.beginPath(); c.moveTo(i * 330, 0); c.lineTo(i * 330 + 150, 0); c.lineTo(i * 330 - 450, H); c.lineTo(i * 330 - 600, H); c.closePath(); c.fill(); } c.restore();
      const r = rng(31); for (let i = 0; i < 14; i++) star(c, r() * W, r() * H, 10 + r() * 16, 'rgba(255,255,255,.75)');
      grain(c, W, H, .05);
    }
  },
  parchment: {
    name: '羊皮紙卷', serif: true, text: '#4B3A26', red: '#A8321F', accent: '#8A7248', dark: false,
    card: { fill: '#F6EDD6', alpha: .97, radius: 8, grain: false, deco: 'corners' },
    bg(c, kind) {
      c.fillStyle = '#EFE2C2'; c.fillRect(0, 0, W, H); blob(c, W / 2, H / 2, 1100, '#FBF3DC', .8);
      blob(c, 0, 0, 700, '#B79A63', .45); blob(c, W, 0, 600, '#B79A63', .35); blob(c, 0, H, 600, '#B79A63', .35); blob(c, W, H, 750, '#A88A55', .5);
      branch(c, 60, H - 60, -.9, 300, this.accent, .55); branch(c, W - 60, 60, Math.PI - .9, 300, this.accent, .55, -1);
      grain(c, W, H, .14);
    }
  },
  evergreen: {
    name: '深綠幾何', text: '#F1EBD8', red: '#FFAE96', accent: '#E2C58A', dark: true,
    card: { fill: '#34493C', alpha: .94, radius: 4, grain: false, deco: 'leftbar' },
    bg(c, kind) {
      c.fillStyle = '#566E5C'; c.fillRect(0, 0, W, H); blob(c, W / 2, H / 2, 1000, '#7A9380', .4); grain(c, W, H, .09);
      c.strokeStyle = 'rgba(241,235,216,.55)'; c.lineWidth = 2; c.strokeRect(140, 120, W - 280, H - 240);
      circ(c, W - 140, 120, 36, '#E8C9B0');
      for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) { c.strokeStyle = 'rgba(241,235,216,.6)'; c.beginPath(); c.arc(70 + j * 24, 180 + i * 32, 8, 0, 7); c.stroke(); }
      c.save(); c.translate(W - 220, H); c.strokeStyle = 'rgba(241,235,216,.35)'; for (let a = Math.PI; a <= 2 * Math.PI + .01; a += Math.PI / 24) { c.beginPath(); c.moveTo(Math.cos(a) * 60, Math.sin(a) * 60); c.lineTo(Math.cos(a) * 190, Math.sin(a) * 190); c.stroke(); } c.restore();
    }
  },
  pastel: {
    name: '粉彩夢幻', serif: true, text: '#3B2B63', red: '#C2255C', accent: '#8E7CC3', dark: false,
    card: { fill: '#FFFFFF', alpha: .92, radius: 30, grain: false, deco: 'circles' },
    bg(c, kind) {
      const g = c.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#F8D9E6'); g.addColorStop(.5, '#E3DAF6'); g.addColorStop(1, '#D3E6F7'); c.fillStyle = g; c.fillRect(0, 0, W, H);
      blob(c, 300, 200, 500, '#FFFFFF', .6); blob(c, W - 300, H - 150, 600, '#FFFFFF', .5);
      c.strokeStyle = 'rgba(142,124,195,.6)'; c.lineWidth = 2; c.strokeRect(80, 80, W - 160, H - 160);
      const r = rng(41); for (let i = 0; i < 16; i++) star(c, r() * W, r() * H, 8 + r() * 16, 'rgba(255,255,255,.9)');
      grain(c, W, H, .04);
    }
  },
  vigil: {
    name: '夜藍祈禱', serif: true, text: '#F6E7C6', red: '#FFA68E', accent: '#E3B866', dark: true,
    card: { fill: '#171C45', alpha: .94, radius: 14, grain: false, deco: 'goldline' },
    bg(c, kind) {
      const g = c.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#242A66'); g.addColorStop(1, '#10143A'); c.fillStyle = g; c.fillRect(0, 0, W, H);
      blob(c, W * .15, H * .5, 700, '#5A55C8', .3); grain(c, W, H, .09);
      c.strokeStyle = this.accent; c.lineWidth = 3;
      c.beginPath(); c.moveTo(W - 320, H); c.lineTo(W - 320, 360); c.arc(W - 220, 360, 100, Math.PI, 0); c.lineTo(W - 120, H); c.stroke();
      c.lineWidth = 1.5; c.globalAlpha = .6; c.beginPath(); c.moveTo(W - 350, H); c.lineTo(W - 350, 350); c.arc(W - 220, 350, 130, Math.PI, 0); c.lineTo(W - 90, H); c.stroke(); c.globalAlpha = 1;
      const r = rng(51); for (let i = 0; i < 9; i++) star(c, 60 + r() * (W - 500), 60 + r() * (H - 120), 8 + r() * 12, 'rgba(227,184,102,.7)');
    }
  },
  xmaslights: {
    name: '聖誕燈串', serif: true, text: '#2F3F34', red: '#C0262D', accent: '#C0262D', dark: false,
    card: { fill: '#FFF8EE', alpha: .97, radius: 22, grain: false, deco: 'dots3' },
    bg(c, kind) {
      c.fillStyle = '#F9EEDF'; c.fillRect(0, 0, W, H); grain(c, W, H, .05);
      lights(c, 40, 70, 0); lights(c, H - 60, -50, 1);
      const r = rng(61); for (let i = 0; i < 24; i++) star(c, r() * W, 160 + r() * (H - 320), 5 + r() * 7, 'rgba(192,38,45,.35)');
    }
  },
  xmasnight: {
    name: '聖誕夜綠', serif: true, text: '#FFF4D6', red: '#FFB29A', accent: '#F2C14E', dark: true,
    card: { fill: '#10403B', alpha: .93, radius: 20, grain: false, deco: 'pill' },
    bg(c, kind) {
      const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#16524B'); g.addColorStop(1, '#0B2F2C'); c.fillStyle = g; c.fillRect(0, 0, W, H);
      lights(c, 40, 80, 2); grain(c, W, H, .07);
      const r = rng(62); for (let i = 0; i < 70; i++) circ(c, r() * W, r() * H, .8 + r() * 1.6, 'rgba(255,244,214,.5)');
    }
  },
  snownight: {
    name: '雪夜深藍', serif: true, text: '#FFFFFF', red: '#FFB5A0', accent: '#BFD7F5', dark: true,
    card: { fill: '#1B2858', alpha: .93, radius: 22, grain: false, deco: 'circles' },
    bg(c, kind) {
      const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#2B3A80'); g.addColorStop(1, '#161F4C'); c.fillStyle = g; c.fillRect(0, 0, W, H);
      const r = rng(63); for (let i = 0; i < 110; i++) circ(c, r() * W, r() * H * .92, 1.2 + r() * 3, `rgba(255,255,255,${.35 + r() * .5})`);
      wave(c, H - 90, 30, 160, 'rgba(228,238,252,.9)', 0); wave(c, H - 40, 22, 120, '#FFFFFF', 3);
    }
  },
  spring: {
    name: '復活春草', serif: true, text: '#1F4D4A', red: '#C23B5A', accent: '#3FA37F', dark: false,
    card: { fill: '#FFFFFF', alpha: .95, radius: 30, grain: false, deco: 'wave' },
    bg(c, kind) {
      const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#CDEBFA'); g.addColorStop(1, '#E4F6E6'); c.fillStyle = g; c.fillRect(0, 0, W, H);
      circ(c, 190, 150, 70, 'rgba(255,228,140,.9)'); circ(c, 1500, 130, 60, 'rgba(255,255,255,.8)'); circ(c, 1570, 150, 80, 'rgba(255,255,255,.8)'); circ(c, 1650, 130, 55, 'rgba(255,255,255,.8)');
      wave(c, H - 150, 34, 380, 'rgba(142,214,170,.75)', 1); wave(c, H - 100, 30, 300, 'rgba(94,190,142,.85)', 3); wave(c, H - 50, 24, 260, 'rgba(63,163,127,.9)', 0);
      const r = rng(64); const cols = ['#F7A8C0', '#FFD36B', '#B8A6F0', '#FF9C7A']; for (let i = 0; i < 16; i++) { const x = 60 + r() * (W - 120), y = H - 90 + r() * 70; circ(c, x, y - 12, 9, cols[i % 4]); circ(c, x, y - 12, 3.5, '#FFF7D0'); }
    }
  },
  bunting: {
    name: '復活旗串', serif: true, text: '#7A2438', red: '#C0262D', accent: '#E8A33D', dark: false,
    card: { fill: '#FFF8EC', alpha: .97, radius: 24, grain: false, deco: 'pill' },
    bg(c, kind) {
      const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#FFE9C7'); g.addColorStop(1, '#FCD7B4'); c.fillStyle = g; c.fillRect(0, 0, W, H);
      circ(c, W / 2, H + 120, 520, 'rgba(255,196,120,.5)');
      const cols = ['#E8A33D', '#E07A5F', '#8FBF9F', '#F2CC8F', '#D96C75'];
      for (let row = 0; row < 2; row++) { const y0 = 20 + row * 36; for (let i = 0; i < 24; i++) { const x = i * 84 - 20, y = y0 + Math.sin(i / 23 * Math.PI) * 64; c.fillStyle = cols[(i + row * 2) % 5]; c.beginPath(); c.moveTo(x, y); c.lineTo(x + 62, y); c.lineTo(x + 31, y + 70); c.closePath(); c.fill(); } }
      grain(c, W, H, .05);
    }
  },
  lemon: {
    name: '青春檸檬', text: '#2B2A26', red: '#D6336C', accent: '#F59F00', dark: false,
    card: { fill: '#FFFDF0', alpha: .97, radius: 26, grain: false, deco: 'dots3' },
    bg(c, kind) {
      c.fillStyle = '#FFE88A'; c.fillRect(0, 0, W, H);
      c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 2; for (let x = 0; x < W; x += 60) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, H); c.stroke(); } for (let y = 0; y < H; y += 60) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
      circ(c, 150, 130, 110, '#FF9EB5'); circ(c, W - 170, H - 140, 150, '#7FD6C8'); circ(c, W - 120, 150, 60, '#B8A6F0'); circ(c, 230, H - 110, 70, '#FFB26B');
      c.fillStyle = '#FF6B8A'; c.save(); c.translate(W - 340, 120); c.rotate(.3); c.fillRect(-60, -16, 120, 32); c.restore();
      grain(c, W, H, .04);
    }
  },
  tangerine: {
    name: '蜜橘貼紙', text: '#4A1F10', red: '#B3261E', accent: '#F26B3A', dark: false,
    card: { fill: '#FFF1E6', alpha: .98, radius: 30, grain: false, deco: 'circles' },
    bg(c, kind) {
      c.fillStyle = '#F58A5A'; c.fillRect(0, 0, W, H);
      c.fillStyle = '#FDDCC6'; rrect(c, 70, 70, W - 140, H - 140, 48); c.fill();
      for (let i = 0; i < 5; i++) for (let j = 0; j < 2; j++) circ(c, 140 + i * 30, 130 + j * 30, 5, 'rgba(242,107,58,.7)');
      const cols = ['#F26B3A', '#7FD6C8', '#B8A6F0']; for (let i = 0; i < 3; i++) { c.strokeStyle = cols[i]; c.lineWidth = 16; c.beginPath(); c.arc(W - 160, H - 100, 110 - i * 24, Math.PI, 2 * Math.PI); c.stroke(); }
      circ(c, 170, H - 160, 54, '#FFC93C'); grain(c, W, H, .05);
    }
  },
  retro: {
    name: '復古網格', text: '#2B2326', red: '#C2255C', accent: '#F4A62A', dark: false,
    card: { fill: '#FFF6EA', alpha: .98, radius: 10, grain: false, deco: 'corners' },
    bg(c, kind) {
      c.fillStyle = '#FFE08A'; c.fillRect(0, 0, W, H); c.fillStyle = '#FFF1E2'; c.fillRect(46, 46, W - 92, H - 92); c.strokeStyle = '#2B2326'; c.lineWidth = 3; c.strokeRect(46, 46, W - 92, H - 92);
      c.fillStyle = '#FFE08A'; c.fillRect(46, 46, W - 92, 60); c.strokeRect(46, 46, W - 92, 60); circ(c, W - 120, 76, 12, '#FF6B6B'); circ(c, W - 160, 76, 12, '#FFD43B'); circ(c, W - 200, 76, 12, '#B197FC');
      c.save(); c.beginPath(); c.rect(46, 46, W - 92, H - 92); c.clip(); const cols = ['#B197FC', '#74C0FC', '#FF8787']; for (let i = 0; i < 3; i++) wave(c, H - 70 + i * 22, 20, 140, cols[i], i * 2); c.restore();
      star(c, 160, H - 220, 26, '#74C0FC'); star(c, W - 200, 280, 20, '#FF8787'); grain(c, W, H, .04);
    }
  },
  fog: {
    name: '霧灰簡約', text: '#22262B', red: '#C03A2B', accent: '#5F6B7A', dark: false,
    card: { fill: '#F6F7F8', alpha: .97, radius: 6, grain: false, deco: 'leftbar' },
    bg(c, kind) {
      const g = c.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#E9EBEE'); g.addColorStop(1, '#CFD4DA'); c.fillStyle = g; c.fillRect(0, 0, W, H);
      blob(c, W * .8, H * .2, 700, '#FFFFFF', .6); c.strokeStyle = this.accent; c.lineWidth = 1.5; c.strokeRect(70, 70, W - 140, H - 140);
      c.fillStyle = this.accent; c.fillRect(70, 70, 8, 120); grain(c, W, H, .05);
    }
  },
  mint: {
    name: '薄荷清新', text: '#1E4B44', red: '#C2255C', accent: '#2FA58C', dark: false,
    card: { fill: '#FFFFFF', alpha: .94, radius: 28, grain: false, deco: 'circles' },
    bg(c, kind) {
      const g = c.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#D8F3EA'); g.addColorStop(1, '#B9E6D8'); c.fillStyle = g; c.fillRect(0, 0, W, H);
      circ(c, 1740, 170, 230, 'rgba(255,255,255,.55)'); circ(c, 1600, 300, 90, 'rgba(47,165,140,.3)'); circ(c, 140, 980, 280, 'rgba(255,255,255,.5)'); circ(c, 360, 1060, 90, 'rgba(47,165,140,.25)'); grain(c, W, H, .05);
    }
  }
});

// 一串彩燈：y0 起點高度，sag 為下垂量（負值向上），pal 為配色組
function lights(c, y0, sag, pal) {
  const sets = [['#E63946', '#FFD166', '#06D6A0', '#4D96FF', '#F78CA2'], ['#E63946', '#F4A62A', '#2FA58C', '#4D96FF', '#B197FC'], ['#FFD166', '#FF8FA3', '#8ECAE6', '#FFF4D6', '#95D5B2']][pal];
  c.save(); c.strokeStyle = pal === 1 ? 'rgba(60,60,60,.55)' : 'rgba(40,40,40,.5)'; c.lineWidth = 3;
  const seg = 5, w = W / seg;
  for (let s = 0; s < seg; s++) {
    const x0 = s * w, x1 = x0 + w; c.beginPath(); c.moveTo(x0, y0); c.quadraticCurveTo((x0 + x1) / 2, y0 + sag * 2, x1, y0); c.stroke();
    for (let i = 1; i < 7; i++) { const t = i / 7, x = x0 + w * t, y = (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * (y0 + sag * 2) + t * t * y0;
      const col = sets[(s * 7 + i) % 5]; blob(c, x, y + 20, 36, col, .45); c.fillStyle = col; c.beginPath(); c.ellipse(x, y + 18, 9, 15, 0, 0, 7); c.fill(); c.fillStyle = 'rgba(40,40,40,.6)'; c.fillRect(x - 4, y + 2, 8, 6); }
  }
  c.restore();
}
