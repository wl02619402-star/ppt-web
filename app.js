'use strict';
// ---------- 狀態 ----------
const S = {
  slides: [], sel: 0, page: 0, themeKey: 'torn_kraft', stripW: 0.81, stripFixed: false, stripY: 64, stripX: 0, view: 'live', autoExport: false, exportFmt: 'image', deckScale: 1, anchor: 'middle',
  custom: null, customMode: 'dark', customDim: null, fileName: '簡報',
  fonts: { head: 'theme', body: 'theme', scr: 'same' }, shadow: false, blocks: false, dashRef: true, photos: [], tpl: null, autoVary: true, bgAll: null, bgScope: 'all', localFonts: [], lineGap: null, stripGap: null, stripScale: 1, layScope: 'all', live: {}, liveScope: 'all',
};
S.sLook = { bg: null, a: 1, r: null, pad: 46 };   // 字條樣式：底色、不透明度、圓角、上下留白
S.sAuto = { num: true, ref: true };               // 字條自動整理：大數字、出處接句尾
const $ = id => document.getElementById(id);
// 每一段自己的調整：位移（x、y）和大小倍率（k）；現場版 'l'、線上版 's' 各一組，用原文的段落序號當鑰匙
function ppOf(slide, view, gid) { return (slide && slide.pp && slide.pp[view] && slide.pp[view][gid]) || null; }
function ppSet(slide, view, gid, patch) {
  slide.pp = Object.assign({}, slide.pp); const m = slide.pp[view] = Object.assign({}, slide.pp[view]);
  if (!patch) delete m[gid]; else { m[gid] = Object.assign({ x: 0, y: 0, k: 1 }, m[gid], patch); if (!m[gid].x && !m[gid].y && m[gid].k === 1) delete m[gid]; }
}
function ppOpts(slide, view) { const m = slide && slide.pp && slide.pp[view]; return { pk: m ? g => (m[g] && m[g].k) || 1 : null, off: m && view === 'l' ? g => m[g] : null }; }
// 清掉某一版的逐段調整；posOnly＝只清位移、保留大小
function ppClear(slide, view, posOnly) { const m = slide.pp && slide.pp[view]; if (!m) return; if (!posOnly) { delete slide.pp[view]; return; } Object.keys(m).forEach(g => ppSet(slide, view, g, { x: 0, y: 0 })); }
// 使用者自己加的圖片（logo、裝飾）：不加陰影、文字不會為它讓位。現場版放 slide.pics（free:true），線上版放 slide.spics
function drawFreePics(c, list) {
  (list || []).forEach(p => { const e = imgCache.get(p.src); if (!e) return; c.drawImage(e.im, p.x * W, p.y * H, p.w * W, p.h * H); });
}
// 使用者自己加的文字框：slide.tb = [{ id, v:'l'|'s', t, x, y, s }]，座標是畫面上的像素
function drawTB(c, slide, view, T, noText, card) {
  const out = [];
  (slide.tb || []).forEach(b => {
    if (b.v !== view) return;
    const f = fnt(500, b.s, false, false, false), w = tw(f, b.t || ' '), h = b.s * 1.3;
    // 字條外面是直播畫面：放在字條外的文字框用白字加陰影，才看得到
    const cx = b.x + w / 2, cy = b.y + h / 2, outside = card && !(cx >= card.x && cx <= card.x + card.w && cy >= card.y && cy <= card.y + card.h), col = b.c || (outside ? '#FFFFFF' : T.text);
    if (!noText) { c.save(); c.font = f; c.textBaseline = 'middle'; c.fillStyle = col; if (outside) { c.shadowColor = 'rgba(0,0,0,.65)'; c.shadowBlur = 10; c.shadowOffsetY = 2; } c.fillText(b.t, b.x, b.y + h / 2); c.restore(); }
    out.push({ tb: b.id, x: b.x, y: b.y, w, h, t: b.t, s: b.s, color: col });
  });
  return out;
}
function addTBText(sl, boxes) { const f = faceOf(false, false); boxes.forEach(b => sl.addText(b.t, { x: inch(b.x), y: inch(b.y), w: inch(b.w * 1.15 + 20), h: inch(b.h), margin: 0, valign: 'middle', align: 'left', fontSize: ptOf(b.s), bold: f.bold, fontFace: f.face, color: hexNo(b.color), wrap: false })); }
// 這一頁自己的圖：可以取景（放大、左右、上下），也可以只佔畫面的一部分（其餘用原本的背景）
const BAND = { l3: [0, 1 / 3], l2: [0, .5], r2: [.5, .5], r3: [2 / 3, 1 / 3] };
function coverDraw(c, im, dx, dy, dw, dh, b) {
  const z = (b && b.z) || 1, px = b && b.px != null ? b.px : .5, py = b && b.py != null ? b.py : .5;
  const sc = Math.max(dw / im.width, dh / im.height) * z, sw = dw / sc, sh = dh / sc;
  c.drawImage(im, (im.width - sw) * px, (im.height - sh) * py, sw, sh, dx, dy, dw, dh);
}
function bandOf(slide) { const b = slide && slide.bg; return b && b.t === 'img' && BAND[b.area] ? { b, x: BAND[b.area][0] * W, w: BAND[b.area][1] * W, left: BAND[b.area][0] === 0 } : null; }
function drawBand(c, slide) {
  const k = bandOf(slide); if (!k) return; const e = imgCache.get(k.b.src); if (!e) return;
  coverDraw(c, e.im, k.x, 0, k.w, H, k.b);
  const dim = k.b.dim == null ? 0 : k.b.dim; if (dim > 0) { c.fillStyle = `rgba(10,8,6,${dim})`; c.fillRect(k.x, 0, k.w, H); }
}
function tagParas(slide) { slide.paras.forEach((p, i) => { p._i = i; }); }
const measureCtx = mk(10, 10).getContext('2d');
const FONT = '"Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif';
const NO_START = new Set('，。、；：！？」』）》〉,.;:!?)”’…'.split(''));
const NO_END = new Set('「『（《〈([“‘'.split(''));

// ---------- 取得目前主題（含自訂背景圖）----------
const LN = 1.448; // Noto 系列字型的單行高度（PowerPoint「多行 1.0」的基準）
const lumOf = hex => { const h = String(hex).replace('#', ''); if (h.length < 6) return .5; const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16); return (.299 * r + .587 * g + .114 * b) / 255; };
const imgCache = new Map();
function loadBgImg(src) {
  return new Promise(res => {
    if (imgCache.has(src)) return res(imgCache.get(src));
    const im = new Image();
    im.onload = () => { const c = mk(32, 18), x = c.getContext('2d'); x.drawImage(im, 0, 0, 32, 18); const d = x.getImageData(0, 0, 32, 18).data; let t = 0; for (let i = 0; i < d.length; i += 4) t += .299 * d[i] + .587 * d[i + 1] + .114 * d[i + 2]; const e = { im, lum: t / (d.length / 4) / 255 }; imgCache.set(src, e); res(e); };
    im.onerror = () => res(null); im.src = src;
  });
}
function slideBgTheme(bg) {
  if (bg.t === 'theme' && THEMES[bg.k]) return Object.assign({ key: bg.k }, THEMES[bg.k]);
  if (bg.t === 'color') {
    const dark = lumOf(bg.c) < .5, base = THEMES[dark ? 'dusk' : 'paper'];
    return Object.assign({}, base, { name: '純色', key: 'color:' + bg.c, flat: true, dark, ownVariants: false, bg(c) { c.fillStyle = bg.c; c.fillRect(0, 0, W, H); } });
  }
  if (bg.t === 'img') {
    const e = imgCache.get(bg.src), dark = e ? e.lum < .55 : true, base = THEMES[dark ? 'dusk' : 'paper'], dim = bg.dim == null ? .45 : bg.dim;
    return Object.assign({}, base, { name: '圖片', key: 'img:' + bg.src.length + ':' + dim + (e ? 1 : 0) + ':' + [bg.z || 1, bg.px, bg.py].join(','), flat: true, dark, ownVariants: false,
      bg(c) {
        if (e) coverDraw(c, e.im, 0, 0, W, H, bg);
        else { c.fillStyle = '#222'; c.fillRect(0, 0, W, H); }
        c.fillStyle = dark ? `rgba(10,8,6,${dim})` : `rgba(255,255,255,${dim})`; c.fillRect(0, 0, W, H);
      } });
  }
  return null;
}
const BLANK = { key: 'blank', name: '白底', text: '#1F1A17', red: '#C0392B', accent: '#8A8F98', dark: false, flat: true, card: { fill: '#FFFFFF', alpha: .96, radius: 10, grain: false, deco: 'none' }, bg(c) { c.fillStyle = '#FFFFFF'; c.fillRect(0, 0, W, H); } };
const dimOf = () => S.customDim == null ? (S.customMode === 'light' ? .62 : .58) : S.customDim;
const useOrig = sl => !!(sl && sl.orig && S.keepOrig !== false && !sl.noOrig);
function curTheme(slide) {
  if (slide && slide.bg && !bandOf(slide)) { const t = slideBgTheme(slide.bg); if (t) return t; }
  if (useOrig(slide)) { const t = slideBgTheme({ t: 'color', c: slide.orig.bg }); if (t) return Object.assign({}, t, { key: 'orig:' + slide.orig.bg, P: null, card: { fill: slide.orig.bg, alpha: 1, radius: 10, grain: false, deco: 'none' } }); }   // 照 Keynote 原樣：字條也用原本的底色
  if (tplOn()) return tplTheme();
  if (S._demo && THEMES[S._demo]) return Object.assign({ key: S._demo }, THEMES[S._demo]);   // 首頁範例用
  if (S.plain) {   // 還沒有模板時的素色底：乾淨的底色，不加任何裝飾
    const col = S.plain, dark = lumOf(col) < .5;
    return { key: 'plain:' + col, name: '素色', text: dark ? '#F4F1EA' : '#1F1A17', red: dark ? '#FF8E7E' : '#C0392B', accent: dark ? '#D8B36A' : '#8A6F3C', dark, flat: true, card: { fill: col, alpha: .96, radius: 10, grain: false, deco: 'none' }, bg(c) { c.fillStyle = col; c.fillRect(0, 0, W, H); } };
  }
  return BLANK;
  if (S.bgAll) { const t = slideBgTheme(S.bgAll); if (t) return t; }
  if (S.custom) {
    const base = THEMES[S.customMode === 'dark' ? 'dusk' : 'paper'];
    const light = S.customMode === 'light';
    return Object.assign({}, base, {
      name: '自訂背景', key: 'custom', flat: true,
      bg(c) {
        const im = S.custom, sc = Math.max(W / im.width, H / im.height), w = im.width * sc, h = im.height * sc;
        c.drawImage(im, (W - w) / 2, (H - h) / 2, w, h);
        const a = dimOf(); c.fillStyle = light ? `rgba(255,255,255,${a})` : `rgba(10,8,6,${a})`; c.fillRect(0, 0, W, H);
      }
    });
  }
  return Object.assign({ key: S.themeKey }, THEMES[S.themeKey]);
}
const bgCache = new Map();
function composeBg(c, T, v, p) {
  const kind = T.ownVariants ? 'plain' : 'content';
  const base = mk(W, H); T.bg.call(T, base.getContext('2d'), kind);
  if (v === 'flip') { c.save(); c.translate(W, T.ownVariants ? H : 0); c.scale(-1, T.ownVariants ? -1 : 1); c.drawImage(base, 0, 0); c.restore(); return; }
  if (v === 'zoom') {
    const sc = 1.5, cw = W / sc, ch = H / sc, spots = [[0, 0], [W - cw, 0], [(W - cw) / 2, 0]], [sx, sy] = spots[p % 3];
    c.drawImage(base, sx, sy, cw, ch, 0, 0, W, H); return;
  }
  if (v === 'solid') {
    c.fillStyle = T.accent; c.fillRect(0, 0, W, H);
    c.save(); c.globalAlpha = .2; c.drawImage(base, 0, 0); c.restore();
    const g = c.createRadialGradient(W / 2, H / 2, H * .35, W / 2, H / 2, H * .95); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.28)'); c.fillStyle = g; c.fillRect(0, 0, W, H);
    star(c, W - 190, 170, 46, 'rgba(255,255,255,.16)'); star(c, W - 250, 110, 20, 'rgba(255,255,255,.12)'); star(c, 190, H - 150, 34, 'rgba(255,255,255,.12)');
    grain(c, W, H, .06); return;
  }
  c.drawImage(base, 0, 0);
  if (v === 'side') {
    const pw = 560, left = p % 2 === 0, x0 = left ? 0 : W - pw;
    c.save(); c.shadowColor = 'rgba(0,0,0,.28)'; c.shadowBlur = 30; c.shadowOffsetX = left ? 8 : -8; c.fillStyle = T.accent; c.fillRect(x0, 0, pw, H); c.restore();
    c.save(); c.beginPath(); c.rect(x0, 0, pw, H); c.clip(); grain(c, W, H, .1);
    c.strokeStyle = 'rgba(255,255,255,.3)'; c.lineWidth = 2; c.strokeRect(x0 + 28, 28, pw - 56, H - 56);
    star(c, x0 + pw / 2, H - 120, 26, 'rgba(255,255,255,.35)'); c.restore(); return;
  }
  if (v === 'card') {
    const cw = 1720, ch = 840, card = drawCard(T, cw, ch, 1);
    c.save(); c.shadowColor = 'rgba(0,0,0,.3)'; c.shadowBlur = 36; c.shadowOffsetY = 12; c.drawImage(card, (W - cw) / 2, (H - ch) / 2 - 6, cw, ch); c.restore();
  }
}
// 小裝飾：參考手作講道簡報常用的元素（掛籤、框角、星芒、紙膠帶），每頁換不同組合，只放在角落、不碰文字
function tape(c, x, y, w, h, rot) {
  c.save(); c.translate(x, y); c.rotate(rot); c.fillStyle = 'rgba(222,206,170,.78)'; c.beginPath(); c.moveTo(-w / 2, -h / 2);
  for (let i = 0; i <= 6; i++) c.lineTo(-w / 2 + (i % 2 ? 4 : 0), -h / 2 + h * i / 6);
  c.lineTo(w / 2, h / 2); for (let i = 6; i >= 0; i--) c.lineTo(w / 2 - (i % 2 ? 4 : 0), -h / 2 + h * i / 6); c.closePath(); c.fill(); c.restore();
}
function ornaments(c, T, p) {
  const A = T.accent, sets = [['tab', 'spark'], ['bracket'], ['tape', 'bracket'], ['spark'], ['tab', 'bracket'], ['tape', 'spark']];
  sets[p % sets.length].forEach(k => {
    if (k === 'tab') { c.fillStyle = A; c.fillRect(W - 152, 0, 22, 112); }
    if (k === 'bracket') { c.strokeStyle = hexA(A, .85); c.lineWidth = 3; c.beginPath(); c.moveTo(W - 70, H - 150); c.lineTo(W - 70, H - 70); c.lineTo(W - 150, H - 70); c.stroke(); }
    if (k === 'spark') { star(c, W - 140, 150, 30, A); star(c, W - 184, 108, 13, hexA(A, .8)); }
    if (k === 'tape') tape(c, 190, 52, 190, 44, -.16);
  });
}
// ---------- 強調頁：自己的照片（輪流用），沒有照片就用內建光影 ----------
// 短句（兩段以內、34 字以內）才置中放大；長一點的經文靠左、用一般字級，避免一堆長短不一的置中行
const isShort = sl => { const ps = sl.paras.map(ptext).map(x => x.trim()).filter(Boolean); return ps.length <= 2 && ps.join('').length <= 34; };
function spotOrder(idx) { const pl = planVariants(); let k = 0; for (let i = 0; i < idx; i++) if (pl[i] === 'spot') k++; return k; }
function spotPhoto(k) { const n = S.photos.length; if (!n) return null; const e = imgCache.get(S.photos[k % n]); return e ? e.im : null; }
function drawSpotPhoto(c, im, k) {
  const sc = Math.max(W / im.width, H / im.height), w = im.width * sc, h = im.height * sc;
  c.drawImage(im, (W - w) / 2, (H - h) / 2, w, h);
  c.fillStyle = 'rgba(28,18,8,.42)'; c.fillRect(0, 0, W, H);   // 壓暗、帶一點暖色，讓白字清楚
  const g = c.createRadialGradient(W / 2, H / 2, H * .3, W / 2, H / 2, H * 1.05); g.addColorStop(0, 'rgba(0,0,0,.05)'); g.addColorStop(1, 'rgba(0,0,0,.6)'); c.fillStyle = g; c.fillRect(0, 0, W, H);
  grain(c, W, H, .05);
}
const NO_ORN = new Set(['title', 'spot', 'solid', 'spark', 'num', 'band', 'rule', 'brackets', 'side']);
function getBg(v, p = 0, slide) {
  const t = curTheme(slide); if (t.tpl) v = 'tpl'; const sk = v === 'spot' ? spotOrder(p) : 0, key = [t.key, v, p % 6, S.customMode, S.custom ? S.custom.src.length : '', dimOf(), v === 'spot' ? 'k' + sk + ':' + S.photos.map(x => x.length).join(',') + ':' + (slide && slide.spotSrc ? slide.spotSrc.length : '') : '', t.tpl ? 'pg' + tplPageIdx(p) : ''].join('|');
  if (!bgCache.has(key)) {
    const c = mk(W, H), x = c.getContext('2d');
    if (t.tpl) { const im = tplImg(tplPageIdx(p)); if (im) x.drawImage(im, 0, 0, W, H); }
    else if (COMP.has(v)) composeBg(x, t, v, p);
    else if (v === 'spot' && !t.flat) { const own = slide && slide.spotSrc && imgCache.get(slide.spotSrc), ph = own ? own.im : spotPhoto(sk); if (ph) drawSpotPhoto(x, ph, sk); else drawSpot(x, t, sk); }
    else { t.bg.call(t, x, t.ownVariants ? v : (v === 'title' ? 'title' : 'content')); if (!t.ownVariants && !t.flat) decorate(x, t, v, p); }
    if (!t.flat && !t.tpl && !NO_ORN.has(v)) ornaments(x, t, p);
    bgCache.set(key, c);
  }
  return bgCache.get(key);
}

// ---------- 文字排版 ----------
const wcache = new Map();
function tw(font, tok) {
  const k = font + '|' + tok; let v = wcache.get(k);
  if (v === undefined) { measureCtx.font = font; v = measureCtx.measureText(tok).width; wcache.set(k, v); }
  return v;
}
const _seg = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter('zh-Hant', { granularity: 'word' }) : null;
const isCJK = ch => /[\u3400-\u9fff]/.test(ch);
// 斷行單位：經文出處、英數字當一整塊；中文用詞為單位（避免「死／亡」被拆開），過長的詞再拆成單字
// 經文出處：(約11:33) → —— 約11:33（只改顯示，不改原文）
const dashRef = t => S.dashRef === false ? t : t.replace(/\s*[（(]\s*([^（）()]{0,8}?\d+\s*[:：]\s*\d[^（）()]{0,16}?)\s*[）)]/g, '—— $1');
const isCallout = p => { const t = ptext(p).trim(); return !REF_RE.test(t) && /[！!]$/.test(t) && t.length <= 48; };
function tokenize(t) {
  const out = [], parts = t.match(/——\s?[^\s，。；、」』]{0,8}?\d+\s*[:：]\s*\d+(?:[-–]\d+)?(?:[,，]\s?\d+(?:[-–]\d+)?)*|[（(](?=[^（）()]*\d)[^（）()]{1,14}[）)]|[A-Za-z0-9:：.\-–—]+|[^A-Za-z0-9:：.\-–—（(]+|[\s\S]/g) || [];
  for (const p of parts) {
    if (/^——\s?\S*\d/.test(p) || /^[A-Za-z0-9（(:：.\-–]/.test(p) || p.length < 2) { out.push(p); continue; }
    if (!_seg) { out.push(...p); continue; }
    for (const g of _seg.segment(p)) { const w = g.segment; if (w.length > 4) out.push(...w); else out.push(w); }
  }
  return out;
}
const SERIF = '"Noto Serif TC","Songti TC","PMingLiU",serif';
const isSerif = () => !S.custom && !!THEMES[S.themeKey].serif;
const FONT_OPTS = [
  { id: 'serifH', label: '源樣明體 Heavy', stack: SERIF, w: 900, rw: 900, face: 'Noto Serif TC', bold: true },
  { id: 'serifB', label: '源樣明體 Bold', stack: SERIF, w: 700, rw: 900, face: 'Noto Serif TC', bold: true },
  { id: 'sansB', label: '源樣黑體 Bold', stack: FONT, w: 700, rw: 700, face: 'Noto Sans TC', bold: true },
  { id: 'sansM', label: '源樣黑體 Medium', stack: FONT, w: 500, rw: 700, face: 'Noto Sans TC', bold: false },
  { id: 'huninn', label: '粉圓體（圓體，近似金萱）', stack: '"Huninn","jf-openhuninn","PingFang TC",sans-serif', w: 400, rw: 400, face: 'Huninn', bold: false },
  { id: 'iansui', label: '芫荽體（圓潤手寫感）', stack: '"Iansui","PingFang TC",sans-serif', w: 400, rw: 400, face: 'Iansui', bold: false },
  { id: 'wenkai', label: '霞鶩文楷（楷書，近似凝書體）', stack: '"LXGW WenKai TC","Kaiti TC","KaiTC",serif', w: 400, rw: 700, face: 'LXGW WenKai TC', bold: false },
];
function fontOpt(id) {
  if (!id || id === 'theme') return null;
  const b = FONT_OPTS.find(o => o.id === id); if (b) return b;
  const f = S.localFonts.find(x => 'L:' + x.fam === id);
  return f && f.ok !== false ? { id, label: '本機：' + f.name, stack: `"${f.fam}","Noto Sans TC",sans-serif`, w: 400, rw: 400, face: f.name, bold: false } : null;
}
const isScripture = runs => { const t = runs.map(r => r.t).join(''); return /[（(][^）)]{1,14}\d+\s*[:：]\s*\d/.test(t) || /^\s*[「『]/.test(t); };
const fontIdOf = (head, scr) => head ? S.fonts.head : (scr && S.fonts.scr && S.fonts.scr !== 'same' ? S.fonts.scr : S.fonts.body);
const fnt = (weight, size, head, red, scr) => {
  const o = fontOpt(fontIdOf(head, scr));
  if (o) return `${red ? o.rw : o.w} ${size}px ${o.stack}`;
  return `${weight} ${size}px ${head && isSerif() ? SERIF : FONT}`;
};

function layout(paras, size, maxW, o) {
  // o: {headRule, headScale, lineGap, paraGap}
  const lines = [];
  paras.forEach((runs, pi) => {
    const ex = runs[0] && runs[0].ps, head = ex ? ex === 'h' : o.headRule(pi, paras);   // 使用者指定的「標題／內文」優先
    const gid = runs._i != null ? runs._i : pi, pk = o.pk ? o.pk(gid) : 1;
    const fs = Math.round((head ? size * o.headScale : size) * pk);
    const wt = head ? 700 : 500;
    const scr = !head && isScripture(runs);
    const base = fnt(wt, fs, head, false, scr), redf = fnt(700, fs, head, true, scr), trk = (o.track || 0) * fs;
    const flat = []; let pos = 0;
    runs.forEach(r => {
      dashRef(r.t.replace(/[\n\v]/g, ' ')).split('↵').forEach((pc, k) => {
        if (k > 0) { flat.push({ brk: true, t: '', red: r.red }); pos += 1; }
        let po = pos; tokenize(pc).forEach(tk => { flat.push({ t: tk, red: r.red, c: r.c, o: po }); po += tk.length; });
        pos += pc.length;
      });
    });
    const wrap = mw => {
      const out = []; let cur = [], cw = 0;
      for (const tk of flat) {
        if (tk.brk) { if (cur.length) { out.push({ pi, segs: cur, size: fs, head, scr, w: cw }); cur = []; cw = 0; } continue; }
        const w = tw(tk.red ? redf : base, tk.t) + trk * [...tk.t].length;
        if (cur.length && cw + w > mw && !NO_START.has(tk.t)) {
          const carry = [];
          // 字條：這一行後段有標點，就斷在標點後面（不要把「我要在／你的律例」拆開）
          if (o.hang) {
            let acc = 0, cut = -1;
            cur.forEach((x, j) => { acc += tw(x.red ? redf : base, x.t) + trk * [...x.t].length; if (/[，。；：！？、」』]$/.test(x.t) && acc >= mw * .62 && j < cur.length - 1) cut = j; });
            if (cut >= 0) carry.push(...cur.splice(cut + 1));
          }
          while (cur.length && NO_END.has(cur[cur.length - 1].t)) carry.unshift(cur.pop());
          // 新的一行不要以太短的詞開頭：把前面的詞一起帶下來，湊到至少 4 個字（例如「死亡之路」整個放到下一行）
          if (isCJK(tk.t[0]) && tk.t.length <= 2) {
            let n = carry.reduce((a, x) => a + x.t.length, 0) + tk.t.length;
            while (n < 4 && cur.length > 2 && isCJK(cur[cur.length - 1].t[0])) { const x = cur.pop(); carry.unshift(x); n += x.t.length; }
          }
          out.push({ pi, segs: cur, size: fs, head, scr, w: cur.reduce((a, s) => a + tw(s.red ? redf : base, s.t) + trk * [...s.t].length, 0) });
          cur = carry; cw = carry.reduce((a, s) => a + tw(s.red ? redf : base, s.t) + trk * [...s.t].length, 0);
        }
        if (/^\s+$/.test(tk.t) && (!cur.length || /[，。、；：！？」』）]$/.test(cur[cur.length - 1].t))) continue;   // 「， 如同」全形標點後面多打的空白不顯示
        cur.push(tk); cw += w;
      }
      if (cur.length) out.push({ pi, segs: cur, size: fs, head, scr, w: cw });
      out.forEach(l => {
        l.gid = gid; l.trk = trk; l.w = Math.max(0, l.w - trk);   // 最後一個字後面不算字距
        // 行尾的「，。」字形只佔左半邊：對齊時讓它稍微凸出去，視覺上邊緣才整齊
        const ls = l.segs[l.segs.length - 1]; if (o.hang && ls && /[，。、；：]$/.test(ls.t)) l.w = Math.max(0, l.w - fs * .45);
      });
      return out;
    };
    // 換行平均：最後一行如果只剩幾個字，就把每行稍微縮短重排，讓各行長度接近（行數不增加）
    let best = wrap(maxW);
    const shortLast = ls => ls.length > 1 && ls[ls.length - 1].w < maxW * .34;
    if (shortLast(best) && !flat.some(t => t.brk)) {
      for (const k of [.95, .9, .85, .8, .75, .7]) {
        const t = wrap(maxW * k); if (t.length !== best.length) break;
        best = t; if (!shortLast(t)) break;
      }
    }
    lines.push(...best);
  });
  lines.forEach(l => { l.h = l.size * o.lineGap; });
  return lines;
}
// 段落間距：兩段標題連在一起時只留小間距，看起來像同一個標題換行
const pgap = (l, nx, o) => (l.head && nx.head) ? l.size * .08 : l.size * o.paraGap;
function blockH(lines, o) {
  let h = 0;
  lines.forEach((l, i) => { h += l.h; if (lines[i + 1] && lines[i + 1].pi !== l.pi) h += pgap(l, lines[i + 1], o); });
  return h;
}
function runColor(s, T) { if (!s.red) return T.text; if (!s.c || s.c === 'red') return T.red; if (s.c === 'accent') return T.accent; return s.c; }
function drawLines(c, lines, x, y, o, T, align = 'left', boxW = 0) {
  c.textBaseline = 'middle';
  const shadowOn = !!o.shadow && lumOf(T.text) > .6;
  lines.forEach((l, i) => {
    const wt = l.head ? 700 : 500, base = fnt(wt, l.size, l.head, false, l.scr), redf = fnt(700, l.size, l.head, true, l.scr);
    const d = o.off ? o.off(l.gid) : null;
    let px = (align === 'center' ? x + (boxW - l.w) / 2 : align === 'right' ? x + boxW - l.w : x) + (d ? d.x || 0 : 0);
    const cy = y + l.h / 2 + (d ? d.y || 0 : 0);
    if (o.rec) o.rec.push({ gid: l.gid, x: px, y: cy - l.h / 2, w: l.w, h: l.h, size: l.size, head: l.head, scr: l.scr });
    if (o.hide && l.gid >= o.hide[0] && l.gid < o.hide[0] + o.hide[1]) return;   // 正在投影片上編輯的那一段先不畫
    l.segs.forEach(s => {
      c.font = s.red ? redf : base; c.fillStyle = (l.head && o.headColor) ? o.headColor : runColor(s, T);
      if (shadowOn) { c.shadowColor = 'rgba(0,0,0,.6)'; c.shadowBlur = 12; c.shadowOffsetY = 3; }
      if (l.trk) { for (const ch of s.t) { c.fillText(ch, px, cy); px += tw(c.font, ch) + l.trk; } }
      else { c.fillText(s.t, px, cy); px += tw(s.red ? redf : base, s.t); }
      if (shadowOn) { c.shadowColor = 'transparent'; c.shadowBlur = 0; c.shadowOffsetY = 0; }
    });
    y += l.h; if (lines[i + 1] && lines[i + 1].pi !== l.pi) y += pgap(l, lines[i + 1], o);
  });
}
const plain = p => p.map(r => r.t).join('');

// ---------- 現場版 ----------
const gapOf = slide => (slide && slide.lg) || S.lineGap || 1.1 * LN;
function liveOpts(isTitle, v, slide) {
  return {
    headRule: (pi, ps) => (v === 'spark' || v === 'solid' || (v === 'spot' && slide && isShort(slide))) ? false : isTitle ? pi === 0 : (pi === 0 && ps.length > 1 && plain(ps[0]).length <= 28),
    headScale: isTitle ? 1.9 : 1.16, lineGap: gapOf(slide), paraGap: .45, shadow: S.shadow || v === 'spot', rec: [], ...ppOpts(slide, 'l'), hide: slide && slide._editP,
  };
}
function liveCfg(slide, isTitle, v) {
  const m = Object.assign({ dx: 0, dy: 0, w: null, align: null }, S.live, (slide && slide.lv) || {});
  return { dx: m.dx, dy: m.dy, w: isTitle ? 1500 : v === 'spark' ? 1300 : 1560, userW: false, align: m.align || null };
}
// 每種版型、每套背景的「裝飾占用區」：文字自動避開
function safeOf(T, v, idx = 0) {
  const tp = T.ownVariants
    ? { title: [230, 120], band: [140, 90], rule: [90, 170], brackets: [130, 130], spark: [110, 100], num: [90, 150], plain: [90, 170], spot: [110, 110], flip: [170, 90] }
    : { title: [110, 110], band: [100, 100], rule: [90, 170], brackets: [130, 130], spark: [110, 110], num: [90, 100], plain: [90, 90], spot: [110, 110], flip: [90, 90] };
  Object.assign(tp, { zoom: [90, 90], solid: [90, 90], side: [90, 90], card: [190, 190], split: [110, 110] });
  const [t, b] = tp[v] || [100, 100]; let e = T.safe || {};
  if (v === 'flip') e = { t: e.t, b: e.b, l: e.r, r: e.l };
  if (v === 'zoom' || v === 'solid' || v === 'card' || v === 'spot') e = {};
  let l = e.l || 0, r = e.r || 0;
  if (v === 'side') { if (idx % 2 === 0) l = Math.max(l, 470); else r = Math.max(r, 470); }
  return { t: Math.max(t, e.t || 0), b: Math.max(b, e.b || 0), l, r };
}
function picSafe(slide, sf) {
  const bd = bandOf(slide); if (bd) { sf = Object.assign({}, sf); if (bd.left) sf.l = Math.max(sf.l, bd.w - 70); else sf.r = Math.max(sf.r, bd.w - 110); }
  const ps = (slide.pics || []).filter(p => !p.free); if (!ps.length) return sf;
  const minX = Math.min(...ps.map(p => p.x)) * W, maxX = Math.max(...ps.map(p => p.x + p.w)) * W; if (maxX - minX > .7 * W) return sf;
  const o = Object.assign({}, sf);
  if ((minX + maxX) / 2 > W / 2) o.r = Math.max(sf.r, 1560 - (minX - 220)); else o.l = Math.max(sf.l, maxX + 60 - 160);
  return o;
}
function stripLead(runs, n) {
  const out = []; let left = n;
  for (const r of runs) { if (left >= r.t.length) { left -= r.t.length; continue; } out.push({ t: r.t.slice(left), red: r.red, c: r.c, ps: r.ps }); left = 0; }
  return out.length ? out : [{ t: ' ', red: false }];
}
// 整份簡報的統一字級：每頁各自算出「放得下的最大字級」，取中位數，讓相鄰頁面字級一致；太長的頁面才個別縮小
let _deck = { sig: '', val: 80 };
function deckSize() {
    const sig = [S.themeKey, S.autoVary, S.dashRef, JSON.stringify(S.bgAll), S.custom ? 1 : 0, S.lineGap, JSON.stringify(S.fonts), S.live.w || '', S.slides.map((s, i) => (s.variant || '') + '|' + (s.fs || 1) + '|' + (s.bg ? s.bg.t : '') + '|' + (s.lg || '') + '|' + s.paras.map(ptext).join('/')).join('#')].join('~');
  if (sig === _deck.sig) return _deck.val;
  const fits = [];
  S.slides.forEach((sd, i) => {
    const v = autoVariant(sd, i); if (v === 'title' || v === 'spark' || v === 'solid' || (v === 'spot' && isShort(sd))) return;
    let paras = sd.paras, shift = 0;
    if (v === 'num') { const m = ptext(paras[0]).match(NUM_RE); if (m) { shift = 150; paras = paras.map((p, k) => k ? p : stripLead(p, m[0].length)); } }
    const sf = picSafe(sd, safeOf(slideTheme(curTheme(sd), v), v, i)), o = liveOpts(false, v, sd), maxW = (S.live.w ? S.live.w : 1560 - sf.r - sf.l) - shift, maxH = H - sf.t - sf.b;
    if (v === 'side' && paras.length > 1 && plain(paras[0]).length <= 28) paras = paras.slice(1), o.headRule = () => false;
    if (v === 'split') { const sp = splitParts(paras); if (sp) { paras = sp.body; o.headRule = () => false; let z = 80; for (; z >= 30; z -= 2) if (blockH(layout(paras, z, SPLIT.rightW, o), o) <= maxH) break; fits.push(z); return; } }
    let size = 80; for (; size >= 30; size -= 2) if (blockH(layout(paras, size, maxW, o), o) <= maxH) break;
    fits.push(size);
  });
  fits.sort((x, y) => x - y);
  const med = fits.length ? fits[Math.floor(fits.length / 2)] : 80;
  _deck = { sig, val: Math.max(30, Math.min(80, med)) };
  return _deck.val;
}
// ---------- 左右兩欄：標題（和一句重點）在左，經文在右 ----------
const SPLIT = { leftW: 560, gap: 96, get rightW() { return W - 320 - this.leftW - this.gap; } };
function splitParts(paras) {
  if (paras.length < 2 || plain(paras[0]).trim().length > 30) return null;
  const rest = paras.slice(1), calls = rest.filter(isCallout), body = rest.filter(p => !isCallout(p));
  return body.length ? { head: [paras[0]], calls, body } : null;
}
function calloutBox(c, T, x, y, w, h) {
  c.save(); c.beginPath(); if (c.roundRect) c.roundRect(x, y, w, h, 12); else c.rect(x, y, w, h);
  c.fillStyle = T.dark ? 'rgba(255,255,255,.12)' : hexA(T.accent, .2); c.fill();
  c.fillStyle = hexA(T.accent, .9); c.fillRect(x + 18, y + 16, 3, h - 32); c.restore();
}
function liveSplit(c, slide, T, o, sf, L, sp, noText) {
  const x1 = 160 + L.dx, x2 = x1 + SPLIT.leftW + SPLIT.gap, rw = SPLIT.rightW, maxH = H - sf.t - sf.b;
  const bo = Object.assign({}, o, { headRule: () => false }), base = deckSize() * S.deckScale * (slide.fs || 1);
  let size = Math.round(base), body; for (; size >= 30; size -= 2) { body = layout(sp.body, size, rw, bo); if (blockH(body, bo) <= maxH) break; }
  const ho = { headRule: () => true, headScale: 1, lineGap: o.lineGap * .95, paraGap: .3 };
  let hs = Math.min(100, Math.round(size * 1.25)), head; for (; hs >= 40; hs -= 2) { head = layout(sp.head, hs, SPLIT.leftW, ho); if (blockH(head, ho) <= maxH * .55) break; }
  const co = { headRule: () => false, headScale: 1, lineGap: o.lineGap, paraGap: .35 }, cs = Math.max(30, Math.round(size * .8));
  const calls = sp.calls.length ? layout(sp.calls, cs, SPLIT.leftW - 64, co) : [];
  const hh = blockH(head, ho), ch = calls.length ? blockH(calls, co) + 40 : 0, leftH = hh + (ch ? 40 + ch : 0), bh = blockH(body, bo);
  const top = sf.t + Math.max(0, (maxH - Math.max(leftH, bh)) / 2) + L.dy, cy = top + hh + 40;
  if (ch) calloutBox(c, T, x1, cy, SPLIT.leftW, ch);
  const extra = [{ lines: head, x: x1, y: top, o: ho, w: SPLIT.leftW, T }];
  if (ch) extra.push({ lines: calls, x: x1 + 40, y: cy + 20, o: co, w: SPLIT.leftW - 64, T });
  if (!noText) { extra.forEach(e => drawLines(c, e.lines, e.x, e.y, e.o, e.T, 'left', e.w)); drawLines(c, body, x2, top, bo, T, 'left', rw); }
  slide._autoAlign = 'left';
  return { shrunk: size < Math.round(base) && size < 48, geo: { lines: body, x: x2, y: top, o: bo, align: 'left', maxW: rw, T, extra } };
}
// ---------- 照 Keynote 原樣畫出來 ----------
const NAT_LH = 1.41, NAT_DESC = .29, EMPTY_LH = 1.2;   // 從 Keynote 匯出的投影片量出來的：一般行高、基線下方、空白行行高
// Keynote 的字型名稱（PostScript 名）→ 瀏覽器字型：源樣用思源（Noto），西文字型用 Mac 內建同名字型，沒有就用相近的
const _famCache = new Map();
function hasLocalFont(fam) {
  if (_famCache.has(fam)) return _famCache.get(fam);
  const t = 'Mg2.Wq', a = (measureCtx.font = `72px "${fam}",monospace`, measureCtx.measureText(t).width), b = (measureCtx.font = '72px monospace', measureCtx.measureText(t).width);
  const ok = Math.abs(a - b) > .5; _famCache.set(fam, ok); return ok;
}
function famOf(r) {
  const n = String(r.fn || '');
  if (!n || /GenYo|Source|Noto|PingFang|Hiragino|Heiti|Songti|Kaiti|Ming|Hei|Sung|Kai|STHeiti|LiHei|LiSong|BiauKai|jf/i.test(n)) return { ff: r.serif ? SERIF : FONT };
  if (/AcademyEngraved/i.test(n)) return hasLocalFont('Academy Engraved LET') ? { ff: '"Academy Engraved LET",serif' } : { ff: '"Playfair Display",serif', eng: true };
  const fam = n.split('-')[0].replace(/MT$|PS$|Std$|Pro$/, '').replace(/([a-z])([A-Z])/g, '$1 $2');
  if (/Times/i.test(fam)) return { ff: '"Times New Roman",Times,serif' };
  return { ff: `"${fam}",${r.serif || /Serif|Garamond|Baskerville|Didot|Bodoni|Georgia|Times|Palatino|Caslon/i.test(fam) ? SERIF : FONT}` };
}
function origImg(src) { const e = imgCache.get(src); if (e) return e.im; loadBgImg(src).then(x => { if (x) { _origDirty = true; redrawSoon(); } }); return null; }
let _origDirty = false;
function origWrap(c, runs, maxW, k, pk) {
  // 依寬度換行：中文逐字、英數字整個字一起；行首不放標點
  const toks = []; runs.forEach(r => { (r.t.match(/\n|[A-Za-z0-9.,:;'"!?()\-–—’”]+|\s+|[\s\S]/gu) || []).forEach(t => toks.push({ t, r })); });
  const lines = []; let cur = [], cw = 0;
  const fontOf = r => `${r.w} ${r.size * k * pk}px ${famOf(r).ff}`;
  const flush = () => { lines.push({ segs: cur, w: cw }); cur = []; cw = 0; };
  for (const tk of toks) {
    if (tk.t === '\n') { flush(); continue; }
    const w = tw(fontOf(tk.r), tk.t);
    if (cur.length && cw + w > maxW + .5 && !NO_START.has(tk.t) && !/^\s+$/.test(tk.t)) { const carry = []; while (cur.length && NO_END.has(cur[cur.length - 1].t)) carry.unshift(cur.pop()); cw = cur.reduce((a, s) => a + s.w, 0); flush(); carry.forEach(s => { cur.push(s); cw += s.w; }); if (/^\s+$/.test(tk.t)) continue; }
    if (!cur.length && /^\s+$/.test(tk.t) && lines.length) continue;
    const last = cur[cur.length - 1];
    if (last && last.r === tk.r) { last.t += tk.t; last.w += w; } else cur.push({ t: tk.t, r: tk.r, w, font: fontOf(tk.r) }); cw += w;
  }
  if (cur.length || !lines.length) flush();
  return lines;
}
// ---------- 原樣頁面改字：編輯框直接改 Keynote 的文字框，字型、大小、顏色盡量保留 ----------
// 文字框照閱讀順序：同一列（上下重疊一半以上）由左到右，不同列由上到下
function textBoxesOf(sl) {
  const bs = sl.orig.items.map((it, n) => ({ it, n })).filter(x => x.it.k === 'text' && x.it.paras.length).sort((a, b) => a.it.y - b.it.y), rows = [];
  bs.forEach(b => { const h = b.it.h || 60, r = rows.find(rw => Math.min(rw.y1, b.it.y + h) - Math.max(rw.y0, b.it.y) >= Math.min(rw.y1 - rw.y0, h) * .5); if (r) { r.bs.push(b); r.y1 = Math.max(r.y1, b.it.y + h); } else rows.push({ y0: b.it.y, y1: b.it.y + h, bs: [b] }); });
  return rows.flatMap(r => r.bs.sort((a, b) => a.it.x - b.it.x));
}
// 原樣頁面的顏色：整頁共用一個「一般字色」（字最多的顏色），第二多的當「主題色」；第一次看到時記住，之後改顏色也不會變
function origColors(sl) {
  const O = sl.orig; if (O.mc) return { mc: O.mc, ac: O.ac };
  const cnt = {}; O.items.forEach(it => (it.paras || []).forEach(p => p.runs.forEach(r => { cnt[r.c] = (cnt[r.c] || 0) + r.t.replace(/\s/g, '').length; })));
  const ks = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a]); O.mc = ks[0] || '#000000'; O.ac = ks[1] || null; return { mc: O.mc, ac: O.ac };
}
const origHex = (sl, c) => { const { mc, ac } = origColors(sl); return c === 'red' ? '#C0392B' : c === 'accent' ? (ac || curTheme(sl).accent) : c ? c : mc; };
const baseColor = p => p.bc || (p.bc = baseColor0(p));
const baseColor0 = p => { const cnt = {}; p.runs.forEach(r => { cnt[r.c] = (cnt[r.c] || 0) + r.t.length; }); return Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a])[0] || '#000000'; };
function origEdRender(sl) {
  return textBoxesOf(sl).map(({ it, n }, i) => `<section data-ob="${n}" data-label="文字框 ${i + 1}">` + it.paras.map(p => {
    const base = origColors(sl).mc, h = p.runs.map(r => r.c === base ? escH(r.t) : `<span style="color:${r.c}">${escH(r.t)}</span>`).join('');   // 一般字色不標，編輯框才看得清楚
    return `<div>${h.length && p.runs.some(r => r.t) ? h.replace(/\n/g, '<br>') : '<br>'}</div>`;
  }).join('') + '</section>').join('');
}
const rgbHex = v => { const m = String(v).match(/(\d+),\s*(\d+),\s*(\d+)/); return m ? '#' + [m[1], m[2], m[3]].map(x => (+x).toString(16).padStart(2, '0')).join('').toUpperCase() : null; };
function origEdApply(sl, root = ed, only = null) {   // only＝只改這一個文字框（投影片上直接編輯時）
  const groups = new Map(); let lastOb = null;
  [...root.querySelectorAll(only != null ? ':scope > div' : 'section > div, :scope > div')].forEach(div => {
    const sec = only != null ? null : div.closest('section'), ob = only != null ? only : sec && sec.dataset.ob != null ? +sec.dataset.ob : div.dataset.ob != null ? +div.dataset.ob : lastOb; if (ob == null) return; lastOb = ob;
    const chars = [];
    const walk = (node, col) => {
      if (node.nodeType === 3) { for (const ch of node.nodeValue.replace(/ /g, ' ')) chars.push({ ch: ch === '\n' ? '\n' : ch, col }); return; }
      if (node.nodeType !== 1) return; if (node.nodeName === 'BR') { if (node.nextSibling || node.previousSibling) chars.push({ ch: '\n', col }); return; }
      const st = node.style && node.style.color ? rgbHex(node.style.color) : null, fc = node.nodeName === 'FONT' && node.getAttribute('color'); node.childNodes.forEach(k => walk(k, st || (fc ? fc.toUpperCase() : null) || col));
    };
    div.childNodes.forEach(k => walk(k, null));
    while (chars.length && chars[chars.length - 1].ch === '\n') chars.pop();
    (groups.get(ob) || groups.set(ob, []).get(ob)).push(chars);
  });
  sl.orig.items.forEach((it, n) => {
    if (it.k !== 'text' || (only != null && n !== only)) return; const news = groups.get(n) || [], olds = it.paras;
    it.paras = news.map((chars, j) => {
      const op = olds[Math.min(j, olds.length - 1)] || { align: 0, lh: { mode: 0, amt: 1 }, sb: 0, sa: 0, size: 18, runs: [] };
      const oc = op.runs.flatMap(r => [...r.t].map(ch => ({ ch, r }))), base = origColors(sl).mc, def = op.runs[0] || { size: op.size || 18, w: 400, serif: false, c: base, fn: '' };
      let a = 0; while (a < oc.length && a < chars.length && oc[a].ch === chars[a].ch) a++;
      let b = 0; while (b < oc.length - a && b < chars.length - a && oc[oc.length - 1 - b].ch === chars[chars.length - 1 - b].ch) b++;
      const runs = [];
      chars.forEach((x, i) => {
        const src = i < a ? oc[i].r : i >= chars.length - b ? oc[oc.length - (chars.length - i)].r : (oc[Math.min(a, oc.length - 1)] || { r: def }).r;
        const c = x.col || base, last = runs[runs.length - 1];
        if (last && last.size === src.size && last.w === src.w && last.serif === src.serif && last.fn === src.fn && last.c === c) last.t += x.ch;
        else runs.push({ t: x.ch, size: src.size, w: src.w, serif: src.serif, fn: src.fn, c });
      });
      return Object.assign({}, op, { runs });
    });
  });
  origRebuild(sl);
}
// 線上版字條跟著更新：用同一套閱讀順序規則
function origRebuild(sl) {
  const items = [], main = origColors(sl).mc;
  sl.orig.items.forEach((it, order) => { if (it.k !== 'text') return; const ps = it.paras.filter(p => p.runs.some(r => r.t.trim())).map(p => { const rs = []; p.runs.forEach(r => { const red = !!(main && r.c.toLowerCase() !== main.toLowerCase()), t = r.t.replace(/\n/g, '↵'), l = rs[rs.length - 1]; if (l && l.red === red && l.c === (red ? r.c : undefined)) l.t += t; else rs.push(red ? { t, red, c: r.c } : { t, red }); }); return rs; }); if (ps.length) items.push({ x: it.x, y: it.y, h: it.h || 60, order, paras: ps }); });
  const paras = arrangeItems(items); sl.paras = paras.length ? paras : [[{ t: ' ', red: false }]]; sl.origSig = JSON.stringify(sl.paras);
}
function drawOrig(cv, slide, idx, noText) {
  const c = cv.getContext('2d'), O = slide.orig, k = W / (O.sw || 1920), rec = [], otext = [];
  c.clearRect(0, 0, W, H); c.fillStyle = O.bg || '#FFFFFF'; c.fillRect(0, 0, W, H);
  if (O.bgImg) { const im = origImg(O.bgImg); if (im) coverDraw(c, im, 0, 0, W, H, null); }   // 這一頁換成照片背景
  const rot = (it, fn) => { c.save(); const cx = (it.x + it.w / 2) * k, cy = (it.y + it.h / 2) * k; c.translate(cx, cy); if (it.rot) c.rotate(-it.rot * Math.PI / 180); c.translate(-it.w * k / 2, -it.h * k / 2); fn(it.w * k, it.h * k); c.restore(); };
  O.items.forEach((it, n) => {
    if (it.k === 'shape') rot(it, (w, h) => {
      const P = new Path2D(), pt = it.path, sx = w / (pt.nat[0] || 1), sy = h / (pt.nat[1] || 1);
      if (pt.cmds) pt.cmds.forEach(([t, ...a]) => { const X = i => a[i] * sx, Y = i => a[i + 1] * sy;
        if (t === 1) P.moveTo(X(0), Y(0)); else if (t === 2) P.lineTo(X(0), Y(0)); else if (t === 3 && a.length >= 4) P.quadraticCurveTo(X(0), Y(0), X(2), Y(2)); else if (t === 4 && a.length >= 6) P.bezierCurveTo(X(0), Y(0), X(2), Y(2), X(4), Y(4)); else if (t === 5) P.closePath(); });
      else if (pt.poly) { const nn = pt.poly; for (let i = 0; i < nn; i++) { const an = -Math.PI / 2 + i * 2 * Math.PI / nn, px = w / 2 + Math.cos(an) * w / 2, py = h / 2 + Math.sin(an) * h / 2; i ? P.lineTo(px, py) : P.moveTo(px, py); } P.closePath(); }
      else P.roundRect(0, 0, w, h, Math.max(0, (pt.round || 0) * Math.min(sx, sy)));
      c.globalAlpha = it.op == null ? 1 : it.op;
      const f = it.fill;
      if (f && f.c) { c.globalAlpha *= f.a == null ? 1 : f.a; c.fillStyle = f.c; c.fill(P); c.globalAlpha = it.op == null ? 1 : it.op; }
      else if (f && f.img) { const im = origImg(f.img); if (im) { c.save(); c.clip(P);
        if (f.tech === 2) { c.fillStyle = c.createPattern(im, 'repeat'); c.fillRect(0, 0, w, h); }
        else if (f.tech === 3 || f.tech === 4) { const s2 = (f.tech === 3 ? Math.max : Math.min)(w / im.width, h / im.height); c.drawImage(im, (w - im.width * s2) / 2, (h - im.height * s2) / 2, im.width * s2, im.height * s2); }
        else c.drawImage(im, 0, 0, w, h);
        c.restore(); } }
      if (it.stroke) { c.globalAlpha *= it.stroke.a == null ? 1 : it.stroke.a; c.strokeStyle = it.stroke.c; c.lineWidth = Math.max(1, it.stroke.w * k); c.setLineDash(it.stroke.dash ? [6 * k, 4 * k] : []); c.stroke(P); c.setLineDash([]); }
      c.globalAlpha = 1;
    });
    else if (it.k === 'pic') rot(it, (w, h) => { const im = origImg(it.src); if (!im) return; const cr = it.crop || { l: 0, t: 0, r: 0, b: 0 }; c.drawImage(im, im.width * cr.l, im.height * cr.t, im.width * (1 - cr.l - cr.r), im.height * (1 - cr.t - cr.b), 0, 0, w, h); });
    else if (it.k === 'text') {
      const gid = 'b' + n, d = ppOf(slide, 'l', gid) || {}, inset = 3.6 * k, bw = Math.max(40, it.w * k * (d.k || 1) - inset * 2);
      const ox = (d.x || 0), oy = (d.y || 0);
      const lay = pk => {
        const lines = []; let yy = 0;
        it.paras.forEach((p, pi) => {
          yy += (pi ? p.sb : 0) * k * pk;
          const wrapped = origWrap(c, p.runs, it.nowrap ? Math.max(bw, W - it.x * k - inset - 40) : bw, k, pk), maxS = (p.runs.length ? Math.max(...p.runs.map(r => r.size)) : (p.size || 18)) * k * pk;   // 空白段落也要佔一行
          const lhOf = sz => p.lh.mode === 2 ? p.lh.amt * k * pk : p.lh.mode === 1 ? Math.max(p.lh.amt * k * pk, sz * NAT_LH) : sz * NAT_LH * (p.lh.amt || 1);
          const empty = !p.runs.length;
          wrapped.forEach(ln => { const sz = ln.segs.length ? Math.max(maxS * .3, ...ln.segs.map(sg => sg.r.size * k * pk)) : maxS, lh = empty && p.lh.mode !== 2 ? sz * EMPTY_LH * (p.lh.amt || 1) : lhOf(sz); lines.push({ ln, y: yy, lh, sz, align: p.align }); yy += lh; });
          yy += p.sa * k * pk;
        });
        return { lines, yy };
      };
      const pk = d.k || 1, L0 = lay(pk);
      const lines = L0.lines, yy = L0.yy; (slide._pk = slide._pk || {})[gid] = pk;
      const tx = it.x * k + inset + ox, ty = it.y * k + inset + oy;
      lines.forEach(L => {
        const lx = tx + (L.align === 2 ? (bw - L.ln.w) / 2 : L.align === 1 ? bw - L.ln.w : 0), base = ty + L.y + L.lh - NAT_DESC * L.sz;
        if (L.ln.w > 0) rec.push({ gid, x: lx, y: ty + L.y, w: L.ln.w, h: L.lh });
        if (noText || slide._editing === n) return;
        let px = lx; c.textBaseline = 'alphabetic';
        L.ln.segs.forEach(sg => { c.font = sg.font; c.fillStyle = sg.r.c; c.fillText(sg.t, px, base);
          if (famOf(sg.r).eng) { c.save(); c.strokeStyle = O.bg || '#fff'; c.lineWidth = Math.max(1, sg.r.size * k * pk * .025); c.strokeText(sg.t, px + sg.r.size * k * pk * .02, base - sg.r.size * k * pk * .02); c.restore(); }   // 沒有雕刻字型時，用內線模仿
          px += sg.w; });
      });
      otext.push({ x: tx, y: ty, w: bw, h: yy, paras: it.paras, k: k * pk });
      (slide._box = slide._box || {})[n] = { x: tx, y: ty, w: it.nowrap ? Math.max(bw, W - tx - 40) : bw * 1.01 + 4, pk, k };
    }
  });
  const T = curTheme(slide), tb = drawTB(c, slide, 'l', Object.assign({}, T, { text: lumOf(O.bg || '#fff') < .5 ? '#FFFFFF' : '#1F1A17' }), noText);
  return { shrunk: false, capped: false, geo: { lines: [], x: 0, y: 0, o: { headRule: () => false, headScale: 1, lineGap: LN, paraGap: 0 }, align: 'left', maxW: W, T, extra: [], rec, tb, otext } };
}
function drawLive(cv, slide, idx, noText) {
  tagParas(slide);
  if (useOrig(slide) && !slide.bg) return drawOrig(cv, slide, idx, noText);
  if (tplOn() && (!slide.bg || bandOf(slide))) return drawTplSlide(cv, slide, idx, noText);
  const v = autoVariant(slide, idx), T = slideTheme(curTheme(slide), v), c = cv.getContext('2d');
  const isTitle = v === 'title', isSpark = v === 'spark' || v === 'solid' || (v === 'spot' && isShort(slide));
  c.clearRect(0, 0, W, H);
  c.drawImage(getBg(v, idx, slide), 0, 0); drawBand(c, slide);
  (slide.pics || []).forEach(p => {
    const e = imgCache.get(p.src); if (!e) return; const im = e.im, cr = p.crop || { l: 0, t: 0, r: 0, b: 0 };
    c.save(); if (!p.free) { c.shadowColor = 'rgba(0,0,0,.28)'; c.shadowBlur = 26; c.shadowOffsetY = 8; }
    c.drawImage(im, im.width * cr.l, im.height * cr.t, im.width * (1 - cr.l - cr.r), im.height * (1 - cr.t - cr.b), p.x * W, p.y * H, p.w * W, p.h * H); c.restore();
  });
  const o = liveOpts(isTitle, v, slide), fs = slide.fs || 1, L = liveCfg(slide, isTitle, v), sf = picSafe(slide, safeOf(T, v, idx));
  let paras = S.dashRef !== false ? stripParas(slide, true).paras : slide.paras, numeral = null, panel = null;
  if (v === 'side' && paras.length > 1 && plain(paras[0]).length <= 28) {
    const left = idx % 2 === 0, pw = 560, ho = { headRule: () => true, headScale: 1, lineGap: o.lineGap, paraGap: .3 };
    let hs = 76, hl; for (; hs >= 40; hs -= 2) { hl = layout([paras[0]], hs, pw - 130, ho); if (blockH(hl, ho) <= H - 380) break; }
    const hh = blockH(hl, ho), lt = lumOf(T.accent) > .55;
    panel = { lines: hl, x: (left ? 0 : W - pw) + 65, y: (H - hh) / 2, o: ho, w: pw - 130, T: Object.assign({}, T, { text: lt ? '#1E1914' : '#FBF6EC', red: lt ? '#B3261E' : '#FFD27A' }) };
    paras = paras.slice(1); o.headRule = () => false;
  }
  if (v === 'split') { const sp = splitParts(paras); if (sp) return liveSplit(c, slide, T, o, sf, L, sp, noText); }
  if (v === 'num') {
    const m = ptext(paras[0]).match(NUM_RE);
    if (m) { numeral = /[１-９]/.test(m[1]) ? String(m[1].charCodeAt(0) - 0xFF10) : m[1]; paras = paras.map((p, i) => i ? p : stripLead(p, m[0].length)); }
  }
  const hasPic = !!(slide.pics && slide.pics.some(p => !p.free)), shift = numeral ? 150 : 0, maxW = (L.userW ? (hasPic ? Math.min(L.w, 1560 - sf.r - sf.l) : L.w) : L.w - sf.r - sf.l) - shift, maxH = H - sf.t - sf.b;
  const base = isTitle ? 56 : isSpark ? 100 : deckSize() * S.deckScale;
  let size = Math.round(base * fs), lines;
  for (; size >= 30; size -= 2) { lines = layout(paras, size, maxW, o); if (blockH(lines, o) <= maxH) break; }
  const h = blockH(lines, o);
  // 自動對齊：標題、重點句、只有一小段的頁面置中，其餘靠左
  const auto = (isTitle || isSpark || (paras.length <= 1 && lines.length <= 2)) ? 'center' : 'left', align = L.align || auto;
  slide._autoAlign = align;
  const x = (align === 'left' && !isTitle && !isSpark ? 160 + sf.l : (W - maxW - shift) / 2 + (sf.l - sf.r) / 2) + (hasPic ? 0 : L.dx) + shift;
  const y = ((S.anchor === 'top' && !isTitle && !isSpark) ? sf.t + 24 : Math.max(sf.t, sf.t + (maxH - h) / 2 - 6)) + L.dy;
  const numSize = numeral ? Math.round(lines[0].size * 2.1) : 0, numX = x - shift + 6, numY = numeral ? y + lines[0].h / 2 + lines[0].size * .1 : 0;
  if (v === 'spot' && spotOrder(idx) % 2 === 1 && lines.length) {
    // 半透明底板＋掛籤（像燭光那一頁的做法）
    const bw = Math.max(...lines.map(l => l.w)), bx = align === 'center' ? x + (maxW - bw) / 2 : x, px = bx - 64, py = y - 52;
    c.save(); c.fillStyle = 'rgba(78,70,62,.58)'; c.fillRect(px, py, bw + 128, h + 104); c.fillStyle = '#6B4A2F'; c.fillRect(px + 36, py - 26, 22, 74); c.restore();
  }
  if (S.blocks && !isTitle && !isSpark) {
    const gs = textGroups(lines, y, o), multi = gs.length > 1; let anyHead = false;
    gs.forEach(g => {
      if (!(g.head || (g.scr && multi))) return;
      const bw = Math.max(...g.lines.map(l => l.w)), bx = align === 'center' ? x + (maxW - bw) / 2 : align === 'right' ? x + maxW - bw : x;
      c.beginPath(); if (c.roundRect) c.roundRect(bx - 36, g.y - 9, bw + 72, g.h + 18, 14); else c.rect(bx - 36, g.y - 9, bw + 72, g.h + 18);
      if (g.head) { anyHead = true; c.fillStyle = hexA(T.accent, .94); } else c.fillStyle = hexA(T.text, .09);
      c.fill();
    });
    o.headColor = anyHead ? (lumOf(T.accent) > .55 ? '#1E1914' : '#FBF6EC') : null;
  }
  if (!noText) {
    if (panel) drawLines(c, panel.lines, panel.x, panel.y, panel.o, panel.T, 'left', panel.w);
    drawLines(c, lines, x, y, o, T, align, maxW);
    if (numeral) { c.font = `italic 700 ${numSize}px ${SERIF}`; c.fillStyle = T.accent; c.textBaseline = 'middle'; c.fillText(numeral, numX, numY); }
  }
  const tb = drawTB(c, slide, 'l', T, noText);
  return { shrunk: size < Math.round(base * fs) && size < 48, capped: size < Math.round(base * fs), geo: { lines, x, y, o, align, maxW, T, numeral, numX, numY, numSize, extra: panel ? [panel] : [], rec: o.rec, tb } };
}

// ---------- 長條版 ----------
// 字條：左右留白一樣、字放大（字幕帶的比例：寬扁、字撐滿），標題靠字級分層，字距稍微拉開
const STRIP = { padL: 120, padR: 120, get padT() { return S.sLook.pad || 46; }, get padB() { return S.sLook.pad || 46; }, maxH: 340, base: 60 };
const stripAlignOf = slide => (slide && slide.sal) || S.stripAlign || 'auto';
const sgapOf = slide => (slide && slide.slg) || S.stripGap || 0.96 * LN;
// 字條依內容類型排：「重點＋經文」這種頁，標題大、內文小（約六成）；短句維持接近的大小
function stripOpts(slide, pt) {
  return { headRule: (pi, ps) => pi === 0 && ps.length > 1, headScale: pt ? 1.6 : 1.32, baseK: pt ? .8 : 1, lineGap: sgapOf(slide), paraGap: pt ? .3 : .36, track: .1, hang: true, pk: ppOpts(slide, 's').pk };
}
// 字條專用的文字整理（只改顯示，不改原文）：
// 1. 標題開頭的「1.」「2、」抽出來，畫成左邊的大數字
// 2. 單獨一行的經文出處接到經文句尾「—— 詩篇119:2」，外層「」拿掉
// 3. 版本代號（CUNP-神、和合本…）不顯示
const VER_RE = /[\s\u3000]*[（(]?(?:CUNP|RCUV|CUV|CNV|CCB|CSB|NIV|ESV|KJV|NLT|新標點和合本|和合本修訂版|和合本|新譯本|當代譯本|現代中文譯本|呂振中譯本)[-－—–]?[^\s）)]{0,6}[）)]?\s*$/i;
const REFLINE_RE = /^\s*(?:——|—|–|-)?\s*[（(]?\s*([\u4e00-\u9fff]{1,8})\s*(\d+\s*[:：]\s*\d+(?:\s*[-–~～]\s*\d+)?(?:\s*[,，、]\s*\d+(?:\s*[-–]\s*\d+)?)*)\s*[）)]?\s*$/;
const _spCache = new WeakMap();
// live＝現場版也用同一套整理（出處接句尾、不顯示版本代號），但不抽大數字、不拿掉「」
function stripParas(slide, live) {
  const key = JSON.stringify(slide.paras) + '|' + S.dashRef + JSON.stringify(S.sAuto), slot = live ? 'l' : 's', hit = (_spCache.get(slide) || {})[slot]; if (hit && hit.key === key) return hit.v;
  const src = slide.paras.map((p, i) => { const q = p.map(r => Object.assign({}, r)); q._i = i; return q; }), out = []; let num = '', merged = false;
  const cutStart = (p, n) => { const ps = p[0] && p[0].ps; while (n > 0 && p.length) { const k = Math.min(n, p[0].t.length); p[0].t = p[0].t.slice(k); n -= k; if (!p[0].t && p.length > 1) p.shift(); } if (ps && p[0]) p[0].ps = ps; };
  const cutEnd = (p, n) => { while (n > 0 && p.length) { const r = p[p.length - 1], k = Math.min(n, r.t.length); r.t = r.t.slice(0, r.t.length - k); n -= k; if (!r.t && p.length > 1) p.pop(); } };
  if (!live && src.length > 1 && S.sAuto.num) { const m = /^\s*(\d{1,2})\s*[.．、:：)）]\s*(?=\S)/.exec(plain(src[0])); if (m && plain(src[0]).length - m[0].length >= 2) { num = m[1]; cutStart(src[0], m[0].length); } }
  src.forEach((p, i) => {
    const full = plain(p), vm = S.sAuto.ref && S.dashRef !== false && VER_RE.exec(full); if (vm && vm.index > 0) cutEnd(p, full.length - vm.index);
    const t = plain(p), prev = out[out.length - 1], rm = S.sAuto.ref && S.dashRef !== false && prev && t.length <= 30 && REFLINE_RE.exec(t);
    const pt = prev ? plain(prev) : '', prevIsBody = prev && !(prev[0] && prev[0].ps === 'h') && (out.length > 1 || pt.length > 14) && !REFLINE_RE.test(pt);
    if (rm && prevIsBody) {
      if (!live && /^\s*「/.test(pt) && /」\s*$/.test(pt) && (pt.match(/「/g) || []).length === 1 && !src.some(q => q !== prev && /「/.test(plain(q)))) { cutStart(prev, pt.indexOf('「') + 1); cutEnd(prev, plain(prev).length - plain(prev).lastIndexOf('」')); }
      prev.push({ t: ' —— ' + rm[1] + rm[2].replace(/\s+/g, ''), red: false }); merged = true; return;
    }
    if (t.trim()) out.push(p);
  });
  const bodyLen = out.slice(1).reduce((a, p) => a + plain(p).length, 0);
  const v = { paras: out, num, point: out.length > 1 && (!!num || merged || bodyLen > 18) };
  _spCache.set(slide, Object.assign({}, _spCache.get(slide), { [slot]: { key, v } })); return v;
}
// 大數字佔的欄寬：數字本身＋跟文字之間的空隙
const numSizeOf = hs => Math.round(hs * 2.3);
const numCol = (num, hs) => num ? Math.ceil(tw(fnt(700, numSizeOf(hs), true, false, false), num) + hs * .5) : 0;
// 字條寬度：沒調過就自動貼合內容；調過（整份或這一頁）就照設定的寬度
const stripFixedW = slide => slide.sw ? Math.round(W * slide.sw) : S.stripFixed ? Math.round(W * S.stripW) : 0;
function stripSplitLayout(slide, sp) {
  const cardW = stripFixedW(slide) || Math.round(W * .96), iw = cardW - STRIP.padL - STRIP.padR, leftW = Math.round(iw * .3), gap = 48, rw = iw - leftW - gap;
  const o = Object.assign(stripOpts(slide), { headRule: () => false }), pv = STRIP.padT + STRIP.padB;
  const ho = { headRule: () => true, headScale: 1, lineGap: o.lineGap, paraGap: .3 }, co = { headRule: () => false, headScale: 1, lineGap: o.lineGap, paraGap: .3 };
  for (let size = Math.round(STRIP.base * (S.stripScale || 1) * (slide.sfs || 1)); size >= 30; size -= 2) {
    const body = layout(sp.body, size, rw, o), head = layout(sp.head, Math.round(size * 1.2), leftW, ho);
    const calls = sp.calls.length ? layout(sp.calls, Math.round(size * .85), leftW - 48, co) : [];
    const bh = blockH(body, o), hh = blockH(head, ho), ch = calls.length ? blockH(calls, co) + 28 : 0, lh = hh + (ch ? 20 + ch : 0);
    if (Math.max(bh, lh) + pv <= STRIP.maxH) return { pages: [body], o, cardW, split: { head, ho, calls, co, leftW, gap, rw, bh, hh, ch, lh } };
  }
  return null;
}
// 字條高度：扣掉第一行上方、最後一行下方的行距空白，上下留白看起來才一樣
const stripTrim = (lines, slide) => lines.length && !(slide && curTheme(slide).P) ? [(lines[0].h - lines[0].size) / 2, (lines[lines.length - 1].h - lines[lines.length - 1].size) / 2] : [0, 0];
const stripH = (lines, o, slide) => { const [a, b] = stripTrim(lines, slide); return blockH(lines, o) - a - b + STRIP.padT + STRIP.padB; };
function stripPages(slide) {
  if (!slide.paras.length) return { pages: [], o: stripOpts(slide), cardW: Math.round(W * S.stripW) };
  // 先把字條變寬（最寬到畫面的 96%）、再縮字，一頁永遠只有一條字條
  const idx = S.slides.indexOf(slide), v = idx >= 0 ? autoVariant(slide, idx) : 'plain';
  if (v === 'split') { const sp = splitParts(slide.paras), r = sp && stripSplitLayout(slide, sp); if (r) return r; }
  const spx = stripParas(slide), o = stripOpts(slide, spx.point), sfs = slide.sfs || 1, pv = STRIP.padT + STRIP.padB, meta = { num: spx.num, point: spx.point };
  const fixed = stripFixedW(slide), base = fixed || Math.round(W * S.stripW), wide = fixed || Math.round(W * .96);
  const widths = [base]; for (let k = 1; k <= 3; k++) { const w = Math.round(base + (wide - base) * k / 3); if (w > widths[widths.length - 1]) widths.push(w); }
  const attempt = (cardW, minSize) => {
    for (let size = Math.round(STRIP.base * o.baseK * (S.stripScale || 1) * sfs); size >= minSize; size -= 2) {
      const tw_ = cardW - STRIP.padL - STRIP.padR - numCol(spx.num, Math.round(size * o.headScale));
      const lines = layout(spx.paras, size, tw_, o);
      if (stripH(lines, o, slide) <= STRIP.maxH) return Object.assign({ pages: [lines], o, cardW }, meta);
    }
    return null;
  };
  // 先試：每一段都不換行（字條加寬、字最多縮兩成就放得下的話，寬扁一條最好讀）
  const full = Math.round(STRIP.base * o.baseK * (S.stripScale || 1) * sfs);
  for (let size = full; size >= full * .8; size -= 2) for (const w of widths) {
    const lines = layout(spx.paras, size, w - STRIP.padL - STRIP.padR - numCol(spx.num, Math.round(size * o.headScale)), o);
    if (lines.length === spx.paras.length && stripH(lines, o, slide) <= STRIP.maxH) return Object.assign({ pages: [lines], o, cardW: w }, meta);
  }
  for (const w of widths) { const r = attempt(w, Math.round(40 * o.baseK)); if (r) return r; }
  // 線上版一頁只能有一張字條：再縮字也放不下，就讓字條長高，不拆成兩張
  // 直播畫面上字小於 34 就看不清楚：寧可字條長高，也不再縮字
  const r2 = attempt(wide, 34); if (r2) return r2;
  return Object.assign({ pages: [layout(spx.paras, 34, wide - STRIP.padL - STRIP.padR - numCol(spx.num, Math.round(34 * o.headScale)), o)], o, cardW: wide, tall: true }, meta);
}
// 線上版字條：跟現場版同一套設計（同樣的紙紋／底圖、配色、裝飾），不再是另一種風格的白卡片
const _scCache = new Map();
const STRIP_LOOK = { title: 'frame', card: 'paper', plain: 'block', flip: 'ribbon', band: 'ribbon', zoom: 'rule', rule: 'rule', brackets: 'block', num: 'block', side: 'block', spark: 'solid', solid: 'solid', spot: 'solid' };
const stripLook = v => 'paper';   // 字條沿用模板本身的樣子，不加內建裝飾
function stripCard(T, cw, h, v = 'plain', idx = 0, slide) {
  const key = [T.key, cw, h, v, idx % 6, S.custom ? S.custom.src.length : '', dimOf(), S.bgAll ? S.bgAll.c : '', S.plain || '', JSON.stringify(S.sLook), slide && slide.bg ? JSON.stringify(slide.bg).length : ''].join('|');
  if (_scCache.has(key)) return _scCache.get(key);
  const sc = 2, c = mk(cw * sc, h * sc), x = c.getContext('2d'); x.scale(sc, sc);
  const A = T.accent, look = stripLook(v), rad = S.sLook.r != null ? S.sLook.r : (T.P ? 4 : T.card.radius);
  if (S.sLook.bg) { x.fillStyle = S.sLook.bg; rrect(x, 0, 0, cw, h, rad); x.fill(); if (_scCache.size > 60) _scCache.clear(); _scCache.set(key, c); return c; }   // 自選底色：乾淨的色塊
  x.save(); rrect(x, 0, 0, cw, h, rad); x.clip();
  if (T.P) {
    // 撕邊紙：同一張紙，每一頁的撕邊位置不同（上下、只有上、只有下）
    const tmp = mk(W, H), tx = tmp.getContext('2d'), seed = T.P.k.length * 131 + T.P.n.length * 17 + idx * 7, edge = v === 'title' ? 0 : idx % 3;
    paperBase(tx, T.P, seed);
    if (edge !== 2) tornStrip(tx, T.P, 'top', 22, seed + 8);
    if (edge !== 1) tornStrip(tx, T.P, 'bottom', 26, seed + 9);
    const top = Math.ceil(h / 2), bot = h - top, ox = (idx * 211) % Math.max(1, W - cw);
    x.drawImage(tmp, ox, 0, cw, top, 0, 0, cw, top); x.drawImage(tmp, ox, H - bot, cw, bot, 0, top, cw, bot);
  } else {
    // 其他風格：從現場版同一張底圖取一段，每一頁取不同位置；翻轉頁就左右鏡像
    const bg = getBg('plain', tplOn() ? idx : 0, slide), sw = Math.min(cw, W), sx = Math.max(0, Math.min(W - sw, ((idx * 337) % Math.max(1, W - sw)))), sy = Math.max(0, Math.min(H - h, [.5, .2, .8][idx % 3] * (H - h)));
    x.save();
    x.drawImage(bg, sx, sy, sw, h, 0, 0, sw, h); x.restore();
    x.globalAlpha = T.dark ? .55 : .5; x.fillStyle = T.card.fill; x.fillRect(0, 0, cw, h); x.globalAlpha = 1;
  }
  if (look === 'solid' && v === 'spot') { const tmp = getBg('spot', idx, slide); const sy = Math.max(0, Math.min(H - h, H * .32 - h / 2)); x.drawImage(tmp, Math.max(0, (W - cw) / 2), sy, Math.min(cw, W), h, 0, 0, Math.min(cw, W), h); }
  else if (look === 'solid') { x.globalAlpha = .93; x.fillStyle = A; x.fillRect(0, 0, cw, h); x.globalAlpha = 1; grain(x, cw, h, .08); }
  x.restore();
  // 字條的樣式跟著現場版這一頁的版面走：一般卡、左色塊、右緞帶、底線、整條色塊、標題框
  const W8 = 'rgba(255,255,255,.55)';
  x.save();
  switch (look) {
    case 'block': x.fillStyle = A; x.fillRect(0, 0, 64, h); star(x, 32, h / 2, 14, W8); break;
    case 'ribbon': x.fillStyle = A; x.fillRect(cw - 112, 0, 112, h); x.fillStyle = hexA(A, .5); x.fillRect(cw - 124, 0, 4, h); star(x, cw - 56, h / 2 - 10, 20, W8); star(x, cw - 34, h / 2 + 26, 8, W8); break;
    case 'rule': x.fillStyle = A; x.fillRect(40, h - 20, cw - 120, 4); star(x, cw - 56, h - 18, 16, A); x.fillRect(40, 22, 36, 6); break;
    case 'solid': star(x, cw - 90, 54, 24, W8); star(x, cw - 124, 32, 10, W8); star(x, cw - 70, h - 40, 12, W8); break;
    case 'frame': if (T.P) gridNote(x, cw - 120, h / 2, 130, 110, .08); else { x.strokeStyle = hexA(A, .75); x.lineWidth = 2; rrect(x, 10, 10, cw - 20, h - 20, Math.max(2, T.card.radius - 4)); x.stroke(); x.lineWidth = 1; rrect(x, 18, 18, cw - 36, h - 36, Math.max(2, T.card.radius - 8)); x.stroke(); star(x, cw - 80, 50, 18, A); } break;
    default: { const T2 = Object.assign({}, T, { card: Object.assign({}, T.card, { alpha: 0, grain: false }) }); x.drawImage(drawCard(T2, cw, h, 1), 0, 0, cw, h); }
  }
  x.restore();
  if (_scCache.size > 60) _scCache.clear(); _scCache.set(key, c); return c;
}
function drawStrip(cv, slide, page, noText) {
  const idx = Math.max(0, S.slides.indexOf(slide)), v = autoVariant(slide, idx), T0 = curTheme(slide), T1 = slideTheme(T0, stripLook(v) === 'solid' ? (v === 'spot' ? 'spot' : 'solid') : 'plain'), c = cv.getContext('2d');
  const T = S.sLook.bg ? Object.assign({}, T1, lumOf(S.sLook.bg) < .5 ? { text: '#F4F1EA', red: '#FF8E7E', dark: true } : { text: '#1F1A17', red: '#C0392B', dark: false }) : T1;
  c.clearRect(0, 0, W, H);
  const sp = stripPages(slide), { pages, o, split } = sp; let cardW = sp.cardW; drawStrip.tall = !!sp.tall;
  drawStrip.capped = !!(pages[0] && pages[0][0] && pages[0][0].size < Math.round(STRIP.base * (o.baseK || 1) * .8 * (S.stripScale || 1) * (slide.sfs || 1) * (pages[0][0].head ? o.headScale : 1)) - 1);
  if (!pages.length) { drawStrip.pos = []; drawFreePics(c, slide.spics); drawStrip.tb = drawTB(c, slide, 's', T, noText); drawStrip.geo = { lines: [], x: 0, y: 0, o, w: 0, T }; return 0; }
  page = Math.min(page, pages.length - 1);
  const lines = pages[page], lastL = lines[lines.length - 1];
  // 上下留白看起來一樣：扣掉第一行上方、最後一行下方的行距空白
  const [trimT, trimB] = split ? [0, 0] : stripTrim(lines, slide);
  const h = Math.round((split ? Math.max(split.bh, split.lh) : blockH(lines, o)) - trimT - trimB + STRIP.padT + STRIP.padB);
  // 字條寬度貼合內容：短的字條就短，不再每條都一樣長
  // 錯開：一行標題＋一兩行內文時，標題靠左、內文往右退，兩行斜斜錯開，像在說話的停頓
  // 大數字、重點＋經文的頁不錯開：標題和內文對齊同一條線，數字掛在線的左邊
  const num = split ? '' : (sp.num || ''), col = num && lines[0] ? numCol(num, lines[0].size) : 0;
  const al = stripAlignOf(slide), maxC = cardW - STRIP.padL - STRIP.padR - col;
  let stag = null;
  if (al === 'auto' && !split && !sp.point && lines.length === 2 && lines[0].head && !lines[1].head) {
    const hw = lines[0].w, body = lines.slice(1), bw = Math.max(...body.map(l => l.w)), bs = body[0].size;
    const room = (stripFixedW(slide) ? maxC : Math.round(W * .96) - STRIP.padL - STRIP.padR) - bw;
    const ind = Math.min(room, Math.max(bs * 1.5, Math.min(bs * 4, hw * .62)));
    if (ind >= bs * 1.5 - 1) stag = { body, bw, ind, cw: Math.max(hw, ind + bw) };
  }
  if (!split && !stripFixedW(slide)) {
    const mw = stag ? stag.cw : Math.max(...pages.flat().map(l => l.w));
    cardW = Math.max(Math.round(W * .34), Math.ceil(mw) + col + STRIP.padL + STRIP.padR + 8); if (!stag) cardW = Math.min(cardW, sp.cardW);
  }
  const x0 = Math.max(0, Math.min(W - cardW, Math.round((W - cardW) / 2) + S.stripX)), y0 = Math.max(0, H - h - S.stripY);
  const card = stripCard(T0, cardW, h, v, idx, slide); drawStrip.card = { x: x0, y: y0, w: cardW, h };
  c.save(); c.globalAlpha = S.sLook.a == null ? 1 : S.sLook.a; c.shadowColor = 'rgba(0,0,0,.35)'; c.shadowBlur = 24; c.shadowOffsetY = 8;
  c.drawImage(card, x0, y0, cardW, h); c.restore();
  drawFreePics(c, slide.spics); drawStrip.tb = drawTB(c, slide, 's', T, noText, drawStrip.card);
  if (split) {
    const lx = x0 + STRIP.padL, ty = y0 + STRIP.padT, bx = lx + split.leftW + split.gap, extra = [{ lines: split.head, x: lx, y: ty, o: split.ho, w: split.leftW, T }];
    if (split.ch) { const cy = ty + split.hh + 20; calloutBox(c, T, lx, cy, split.leftW, split.ch); extra.push({ lines: split.calls, x: lx + 36, y: cy + 14, o: split.co, w: split.leftW - 48, T }); }
    if (!noText) { extra.forEach(e => drawLines(c, e.lines, e.x, e.y, e.o, e.T, 'left', e.w)); drawLines(c, lines, bx, ty, o, T); }
    drawStrip.geo = { lines, x: bx, y: ty, o, w: split.rw, T, extra };
    return 1;
  }
  const lx = x0 + STRIP.padL + col, ty = y0 + STRIP.padT - trimT, tw0 = cardW - STRIP.padL - STRIP.padR - col;
  let numGeo = null;
  if (num) {
    const ns = numSizeOf(lines[0].size), nf = fnt(700, ns, true, false, false);
    numGeo = { t: num, x: x0 + STRIP.padL, y: y0 + h / 2, size: ns, color: T.accent };
    if (!noText) { c.save(); c.font = nf; c.textBaseline = 'middle'; c.fillStyle = T.accent; c.fillText(num, numGeo.x, numGeo.y + ns * .04); c.restore(); }
  }
  // 每一行的位置：錯開（標題靠左、內文整塊靠右、出處靠右）／置中／靠左，再加上使用者自己拖的位移
  const isRef = l => { const t = plain(l.segs); return t.length <= 28 && /^——|^\s*[（(]?[^\s，。「」]{0,8}\s?\d+\s*[:：]\s*\d/.test(t); };
  const pos = []; let yy = ty;
  lines.forEach((l, i) => {
    let x = lx;
    if (stag && i > 0) { const bx = lx + tw0 - stag.bw; x = isRef(l) ? bx + stag.bw - l.w : bx; }
    else if (!stag && al === 'center') x = lx + (tw0 - l.w) / 2;
    const d = ppOf(slide, 's', l.gid) || {}, base = x; x = Math.max(x0 + 24, Math.min(x0 + cardW - 24 - l.w, x + (d.x || 0)));
    pos.push({ l, x, y: yy + (d.y || 0), base, lx, tw0 });
    yy += l.h; if (lines[i + 1] && lines[i + 1].pi !== l.pi) yy += pgap(l, lines[i + 1], o);
  });
  if (!noText) pos.forEach(p => drawLines(c, [p.l], p.x, p.y, o, T));
  drawStrip.pos = pos;
  drawStrip.geo = { lines: [], x: lx, y: ty, o, w: tw0, T, align: 'left', extra: pos.map(p => ({ lines: [p.l], x: p.x, y: p.y, o, w: p.l.w + 8, T })), num: numGeo };
  return pages.length;
}

// ---------- 解析 pptx ----------
async function shrinkImg(src, mime) {
  const e = await loadBgImg(src); if (!e) return src;
  const im = e.im, m = Math.max(im.width, im.height); if (m <= 1600 && src.length < 900000) return src;
  const sc = Math.min(1, 1600 / m), c = mk(Math.round(im.width * sc), Math.round(im.height * sc)); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
  return mime === 'image/png' ? c.toDataURL('image/png') : c.toDataURL('image/jpeg', .85);
}
// 把一頁上的文字框（位置＋段落）排成閱讀順序的段落；pptx 和 Keynote 共用
function arrangeItems(items) {
  // 閱讀順序：同一列（上下範圍重疊）的框由左到右，不同列由上到下
  items.sort((a, b) => (a.y - b.y) || (a.x - b.x) || (a.order - b.order));
  const rows = [];
  items.forEach(it => { const r = rows.find(rw => Math.min(rw.y1, it.y + it.h) - Math.max(rw.y0, it.y) >= Math.min(rw.y1 - rw.y0, Math.max(1, it.h)) * .5); if (r) { r.its.push(it); r.y1 = Math.max(r.y1, it.y + it.h); } else rows.push({ y0: it.y, y1: it.y + Math.max(1, it.h), its: [it] }); });
  const NUMP = /^[0-9０-９]{1,2}\s*[.．、:：)）]?$/, ptx = p => p.map(r => r.t).join(''), isNumBox = it => it.paras.every(p => NUMP.test(ptx(p).trim()));
  // 同一列裡，只有編號的框排在最前面（編號框常常和標題框疊在一起、起點一樣）
  items.length = 0; rows.forEach((r, ri) => { r.its.forEach(it => it.row = ri); items.push(...r.its.sort((a, b) => (isNumBox(b) - isNumBox(a)) || (a.x - b.x))); });
  for (let k = 0; k < items.length - 1; k++) {
    const a = items[k]; if (!isNumBox(a) || items[k + 1].row !== a.row) continue;
    const nx = items[k + 1], nums = a.paras.map(p => ptx(p).trim());
    if (nums.length === 1) { nx.paras[0] = [{ t: nums[0] + ' ', red: false }].concat(nx.paras[0]); items.splice(k, 1); k--; continue; }   // 「2.」接到右邊標題前面：「2. 真理：…」
    // 一欄「1. 2. 3.」：右邊剛好有同樣多行時，一行配一個編號
    // 開頭空兩格以上的段落是上一行的延續（手動縮排），不算新的一行
    const cont = p => /^[ \u3000]{2,}/.test(ptx(p)), lines = nx.paras.reduce((n, p) => n + (cont(p) ? 0 : 1) + (ptx(p).replace(/↵+$/, '').match(/↵/g) || []).length, 0);
    if (lines !== nums.length) continue;
    let i = 0;
    nx.paras = nx.paras.map(p => { const out = p.map(r => Object.assign({}, r)); if (cont(p)) { out[0].t = out[0].t.replace(/^[ \u3000]+/, ''); return out; } out[0].t = nums[i++] + ' ' + out[0].t; const tot = ptx(p).replace(/↵+$/, '').length; let pos = 0; out.forEach(r => { r.t = [...r.t].map(ch => { pos += ch.length; return ch === '↵' && pos < tot ? '↵' + (nums[i++] || '') + ' ' : ch; }).join(''); }); return out; });
    items.splice(k, 1); k--;
  }
  // 一句話被拆到下一個框（上一句以「，、：」結尾、緊接在下面、不是新的條列）：接回同一段，保留換行
  for (let k = 1; k < items.length; k++) {
    const a = items[k - 1], b = items[k], lp = a.paras[a.paras.length - 1], t = ptx(b.paras[0]).trim();
    if (b.paras.length === 1 && /[，、：；,]\s*$/.test(ptx(lp)) && !/^[▻►▶•・●○■□◆◇\-–—*0-9０-９]/.test(t) && b.y >= a.y && b.y - (a.y + a.h) < a.h * .6 && t.length <= 30) {
      lp.push({ t: '↵', red: false }, ...b.paras[0]); items.splice(k, 1); k--;
    }
  }
  // 標題框分好幾段短句（「2. 真理：」「是非對錯認定的信念」）：合成同一個標題，用換行分開
  const t0 = items[0];
  if (t0 && items.length > 1 && t0.paras.length > 1 && t0.paras.length <= 3 && t0.paras.every(p => ptx(p).replace(/↵/g, '').trim().length <= 20)) t0.paras = [t0.paras.reduce((acc, p, i) => i ? acc.concat([{ t: '↵', red: false }], p) : p.slice(), [])];
  return items.flatMap(i => i.paras);
}
// ---------- 直接讀 Keynote（.key）----------
// .key 是 zip，裡面 Index/*.iwa 是 Snappy 壓縮的 protobuf。只讀需要的：頁順序、文字框位置、文字、字色
function snappyRaw(b) {
  let i = 0, n = 0, sh = 0; for (;;) { const c = b[i++]; n |= (c & 0x7f) << sh; sh += 7; if (c < 0x80) break; }
  const out = new Uint8Array(n); let o = 0;
  while (i < b.length) {
    const t = b[i++], k = t & 3;
    if (k === 0) { let L = t >> 2; if (L >= 60) { const nb = L - 59; L = 0; for (let j = 0; j < nb; j++) L |= b[i + j] << (8 * j); i += nb; } L += 1; out.set(b.subarray(i, i + L), o); o += L; i += L; }
    else { let L, off; if (k === 1) { L = ((t >> 2) & 7) + 4; off = ((t >> 5) << 8) | b[i++]; } else if (k === 2) { L = (t >> 2) + 1; off = b[i] | (b[i + 1] << 8); i += 2; } else { L = (t >> 2) + 1; off = (b[i] | (b[i + 1] << 8) | (b[i + 2] << 16) | (b[i + 3] << 24)) >>> 0; i += 4; }
      for (let j = 0; j < L; j++) { out[o] = out[o - off]; o++; } }
  }
  return out;
}
function iwaDecode(d) {
  const parts = []; let i = 0, total = 0;
  while (i + 4 <= d.length) { const L = d[i + 1] | (d[i + 2] << 8) | (d[i + 3] << 16); const p = snappyRaw(d.subarray(i + 4, i + 4 + L)); parts.push(p); total += p.length; i += 4 + L; }
  const out = new Uint8Array(total); let o = 0; parts.forEach(p => { out.set(p, o); o += p.length; }); return out;
}
function pbVarint(b, i) { let n = 0, m = 1; for (;;) { const c = b[i++]; n += (c & 0x7f) * m; m *= 128; if (c < 0x80) return [n, i]; } }
function pbFields(b) {
  const out = []; let i = 0;
  while (i < b.length) {
    let k; [k, i] = pbVarint(b, i); const f = Math.floor(k / 8), w = k & 7; let v;
    if (w === 0) [v, i] = pbVarint(b, i);
    else if (w === 1) { v = b.subarray(i, i + 8); i += 8; }
    else if (w === 2) { let L; [L, i] = pbVarint(b, i); v = b.subarray(i, i + L); i += L; }
    else if (w === 5) { v = new DataView(b.buffer, b.byteOffset + i, 4).getFloat32(0, true); i += 4; }
    else throw new Error('pb wire ' + w);
    out.push({ f, w, v });
  }
  return out;
}
const pbGet = (b, ...path) => { for (const k of path) { if (!b) return null; const h = pbFields(b).find(x => x.f === k); b = h ? h.v : null; } return b; };
const pbAll = (b, k) => b ? pbFields(b).filter(x => x.f === k).map(x => x.v) : [];
const pbRef = b => { if (!b || !b.length) return null; try { const fs = pbFields(b); return fs.length === 1 && fs[0].f === 1 && fs[0].w === 0 ? fs[0].v : null; } catch (e) { return null; } };
function iwaObjects(d, into) {
  let i = 0;
  while (i < d.length) {
    let L; [L, i] = pbVarint(d, i); const info = pbFields(d.subarray(i, i + L)); i += L;
    const id = (info.find(x => x.f === 1) || {}).v;
    info.filter(x => x.f === 2).forEach(x => { const mi = pbFields(x.v), t = (mi.find(y => y.f === 1) || {}).v, ln = (mi.find(y => y.f === 3) || {}).v || 0; if (!into.has(id)) into.set(id, { t, p: d.subarray(i, i + ln) }); i += ln; });
  }
}
async function parseKey(buf) {
  const zip = await JSZip.loadAsync(buf), O = new Map();
  const files = Object.keys(zip.files).filter(n => /^Index\/.*\.iwa$/.test(n));
  if (!files.length) throw new Error('not keynote');
  for (const n of files) { try { iwaObjects(iwaDecode(await zip.file(n).async('uint8array')), O); } catch (e) { console.warn('略過', n, e); } }
  const ofType = t => [...O].filter(([, o]) => o.t === t);
  // 頁順序：簡報（type 2）的 slide tree 依序列出每一頁的節點（type 4），節點裡指到那一頁（type 5）
  const findRefs = (b, want, depth = 0, out = []) => { let fs; try { fs = pbFields(b); } catch (e) { return out; } fs.forEach(x => { if (x.w !== 2) return; const r = pbRef(x.v); if (r != null && want(r)) out.push(r); else if (r == null && depth < 4) findRefs(x.v, want, depth + 1, out); }); return out; };
  const isT = t => r => O.has(r) && O.get(r).t === t;
  let order = [];
  for (const [, o] of ofType(2)) { const nodes = findRefs(o.p, isT(4)); if (nodes.length > order.length) order = nodes; }
  let slideIds = order.map(n => findRefs(O.get(n).p, isT(5))[0]).filter(x => x != null);
  if (!slideIds.length) { const tpl = new Set(ofType(5).flatMap(([, o]) => { const r = pbRef(pbGet(o.p, 17)); return r != null ? [r] : []; })); slideIds = ofType(5).map(([id]) => id).filter(id => !tpl.has(id)); }
  // 字色：字元樣式（type 2021）的 11 → 7 是 RGB
  const colorOf = sid => { const o = O.get(sid); if (!o) return null; const c = pbGet(o.p, 11, 7); if (!c) return null; const fs = pbFields(c), g = k => (fs.find(x => x.f === k) || {}).v; const r = g(3), gg = g(4), bb = g(5); if (r == null) return null; const h = v => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, '0'); return '#' + h(r) + h(gg) + h(bb); };
  const textOf = sidRef => {
    const o = O.get(sidRef); if (!o || o.t !== 2001) return null;
    const txt = new TextDecoder().decode(pbGet(o.p, 3) || new Uint8Array());
    const tbl = pbAll(pbGet(o.p, 8), 1).map(e => ({ raw: pbFields(e) })).map(e => ({ at: (e.raw.find(x => x.f === 1) || { v: 0 }).v, col: colorOf(pbRef((e.raw.find(x => x.f === 2) || {}).v)) }));
    return { txt, tbl };
  };
  const geom = d => { const g = pbGet(d, 1), pos = g && pbGet(g, 1), sz = g && pbGet(g, 2), f = (b, k) => b ? ((pbFields(b).find(x => x.f === k) || {}).v || 0) : 0; return { x: f(pos, 1), y: f(pos, 2), w: f(sz, 1), h: f(sz, 2) }; };
  // ===== 照 Keynote 原樣：底色、形狀、照片、文字（位置、字型、字級、顏色、對齊、行距）=====
  const pbF = (b, k) => { if (!b) return null; try { return pbFields(b).find(x => x.f === k) || null; } catch (e) { return null; } };
  const colOf = b => { if (!b) return null; const fs = pbFields(b), g = k => (fs.find(x => x.f === k) || {}).v; const r = g(3); if (r == null) return null; const h = v => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, '0'); return { c: '#' + h(r) + h(g(4)) + h(g(5)), a: g(6) == null ? 1 : g(6) }; };
  // 樣式往上找：這一層沒設，就看父樣式
  const sProp = (sid, propsPath, k, superPath, guard = 0) => {
    const o = O.get(sid); if (!o || guard > 12) return null;
    const f = pbF(pbGet(o.p, ...propsPath), k); if (f) return f;
    return sProp(pbRef(pbGet(o.p, ...superPath, 3)), propsPath, k, superPath, guard + 1);
  };
  const charP = (sid, k) => sProp(sid, [11], k, [1]), paraP = (sid, k) => sProp(sid, [12], k, [1]), shapeP = (sid, k) => sProp(sid, [1, 11], k, [1, 1]);
  const fontSpec = (name, bold) => {
    const n = String(name || ''), serif = /Min|Serif|Ming|Song|宋|明/i.test(n) && !/Gothic|Sans|Hei/i.test(n);
    let w = /Heavy|Black|ExtraBold|UltraBold/i.test(n) ? 900 : /Bold|Semibold|SemiBold|Demi/i.test(n) ? 700 : /Medium/i.test(n) ? 500 : /Light|Thin|ExtraLight/i.test(n) ? 300 : 400;
    if (bold && w < 700) w = 700;
    return { serif, w };
  };
  const imgCacheK = new Map();
  const dataURL = async id => {
    if (imgCacheK.has(id)) return imgCacheK.get(id);
    const fn = id != null && Object.keys(zip.files).find(n => n.startsWith('Data/') && new RegExp('-' + id + '\\.\\w+$').test(n)); let v = null;
    if (fn) { const ext = fn.split('.').pop().toLowerCase(), mime = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp' }[ext]; if (mime) v = await shrinkImg(`data:${mime};base64,${await zip.file(fn).async('base64')}`, mime); }
    imgCacheK.set(id, v); return v;
  };
  const pathOf = shp => {   // 回傳 { nat:[w,h], cmds:[[type, x,y, ...]] }
    const ps = pbGet(shp, 1, 3); if (!ps) return null;
    const sc = pbGet(ps, 4);
    if (sc) { const fs = pbFields(sc), g = k => (fs.find(x => x.f === k) || {}).v, sz = pbFields(g(3) || new Uint8Array()), w = (sz.find(x => x.f === 1) || {}).v || 1, h = (sz.find(x => x.f === 2) || {}).v || 1; return { nat: [w, h], round: (g(1) || 0) === 0 ? Math.min(g(2) || 0, w / 2, h / 2) : null, poly: (g(1) || 0) === 1 ? Math.max(3, Math.round(g(2) || 5)) : null }; }
    const bz = pbGet(ps, 5) || pbGet(ps, 8);
    if (bz) {
      const sz = pbGet(bz, 2), szf = sz ? pbFields(sz) : [], w = (szf.find(x => x.f === 1) || {}).v || 1, h = (szf.find(x => x.f === 2) || {}).v || 1, cmds = [];
      pbAll(pbGet(bz, 3), 1).forEach(el => { const t = pbGet(el, 1) != null ? (pbFields(el).find(x => x.f === 1) || {}).v : 0, pts = pbAll(el, 2).flatMap(pt => { const f = pbFields(pt); return [(f.find(x => x.f === 1) || {}).v || 0, (f.find(x => x.f === 2) || {}).v || 0]; }); cmds.push([t, ...pts]); });
      return { nat: [w, h], cmds };
    }
    return null;
  };
  async function origOf(sid) {
    const so = O.get(sid), out = { bg: null, items: [] };
    const bgOf = s => { const o = O.get(s); if (!o) return null; const st = pbRef(pbGet(o.p, 1)); const f = st != null && sProp(st, [11], 1, [1]); const c = f && colOf(pbGet(f.v, 1)); return c ? c.c : null; };
    out.bg = bgOf(sid) || bgOf(pbRef(pbGet(so.p, 17))) || '#FFFFFF';
    const draws = [];
    const tplS = pbRef(pbGet(so.p, 17)); if (tplS != null && O.get(tplS)) pbAll(O.get(tplS).p, 7).forEach(r => draws.push([pbRef(r), 0, 0]));
    pbAll(so.p, 7).forEach(r => draws.push([pbRef(r), 0, 0]));
    const visit = async (ref, dx, dy, depth) => {
      const o = O.get(ref); if (!o || depth > 6) return;
      if (o.t === 3008) { const g = geom(pbGet(o.p, 1)); for (const c of pbAll(o.p, 2)) await visit(pbRef(c), dx + g.x, dy + g.y, depth + 1); return; }
      if (o.t === 3005) {
        const gd = pbGet(o.p, 1), g = geom(gd), ang = (pbF(pbGet(gd, 1), 4) || {}).v || 0, src = await dataURL(pbRef(pbGet(o.p, 11)) ?? pbRef(pbGet(o.p, 12))); if (!src) return;
        const mo = O.get(pbRef(pbGet(o.p, 5))), m = mo && mo.t === 3006 ? geom(pbGet(mo.p, 1)) : null;
        const vis = m && m.w ? { x: g.x + m.x, y: g.y + m.y, w: m.w, h: m.h } : g, crop = m && m.w ? { l: Math.max(0, m.x / g.w), t: Math.max(0, m.y / g.h), r: Math.max(0, 1 - (m.x + m.w) / g.w), b: Math.max(0, 1 - (m.y + m.h) / g.h) } : { l: 0, t: 0, r: 0, b: 0 };
        out.items.push({ k: 'pic', src, x: dx + vis.x, y: dy + vis.y, w: vis.w, h: vis.h, rot: ang, crop }); return;
      }
      const shp = o.t === 2011 ? o.p : o.t === 7 ? pbGet(o.p, 1) : null; if (!shp) return;
      const gd = pbGet(shp, 1, 1), g = geom(gd), ang = (pbF(pbGet(gd, 1), 4) || {}).v || 0, x = dx + g.x, y = dy + g.y;
      const st = pbRef(pbGet(shp, 1, 2)), path = pathOf(shp);
      if (path && (!g.w || !g.h)) { g.w = g.w || path.nat[0]; g.h = g.h || path.nat[1]; }   // 自動大小的框：大小寫在路徑裡
      // 形狀：填色（純色／圖片）、外框、透明度
      if (st != null && path) {
        const fill = shapeP(st, 1), stroke = shapeP(st, 2), op = shapeP(st, 3);
        let f = null;
        if (fill && fill.w === 2) { const fc = pbGet(fill.v, 1), fi = pbGet(fill.v, 3), gr = pbGet(fill.v, 2);
          if (fc) { const c = colOf(fc); if (c) f = { c: c.c, a: c.a }; }
          else if (fi) { const tech = (pbF(fi, 2) || {}).v || 0, src = await dataURL(pbRef(pbGet(fi, 6))); if (src) f = { img: src, tech }; }
          else if (gr) { const stp = pbAll(gr, 2)[0], c = stp && colOf(pbGet(stp, 1)); if (c) f = { c: c.c, a: c.a }; } }
        let sk = null;
        if (stroke && stroke.w === 2) { const pt = (pbF(pbGet(stroke.v, 6), 1) || {}).v; const c = colOf(pbGet(stroke.v, 1)), wd = (pbF(stroke.v, 2) || {}).v || 1; if (c && pt !== 2) sk = { c: c.c, a: c.a, w: wd, dash: pt === 0 }; }
        if (f || sk) out.items.push({ k: 'shape', x, y, w: g.w || path.nat[0], h: g.h || path.nat[1], rot: ang, path, fill: f, stroke: sk, op: op && op.w === 5 ? op.v : 1 });
      }
      // 文字：每一段的字型、字級、顏色、對齊、行距
      const so2 = O.get(pbRef(pbGet(shp, 2))); if (!so2 || so2.t !== 2001) return;
      const txt = new TextDecoder().decode(pbGet(so2.p, 3) || new Uint8Array()); if (!txt.replace(/[\n￼\s]/g, '')) return;
      const tab = k => pbAll(pbGet(so2.p, k), 1).map(e => { const f = pbFields(e); return { at: (f.find(x => x.f === 1) || { v: 0 }).v, ref: pbRef((f.find(x => x.f === 2) || {}).v) }; });
      const pT = tab(5), cT = tab(8), at = (T, i, keep) => { let r = null; for (const e of T) { if (e.at <= i) { if (e.ref != null || !keep) r = e.ref ?? (keep ? r : null); } else break; } return r; };
      const paras = []; let cur = null, i = 0;
      const newPara = pos => { const ps = at(pT, pos, true), ls = paraP(ps, 13), lsF = ls ? pbFields(ls.v) : [], mode = (lsF.find(x => x.f === 1) || {}).v || 0, amt = (lsF.find(x => x.f === 2) || {}).v;
        cur = { align: (paraP(ps, 1) || {}).v || 0, lh: { mode, amt: amt == null ? 1 : amt }, sb: (paraP(ps, 21) || {}).v || 0, sa: (paraP(ps, 20) || {}).v || 0, size: (charP(ps, 3) || {}).v || 18, runs: [] }; paras.push(cur); return ps; };
      let ps = newPara(0);
      for (const ch of txt) {
        if (ch === '\n') { if (!cur.runs.length) { const cs = at(cT, i), f = cs != null && O.get(cs) && pbF(pbGet(O.get(cs).p, 11), 3); if (f) cur.size = f.v; }   // 空白段落的高度看那個換行字元的字級
          i += 1; ps = newPara(i); continue; }
        if (ch !== '￼') {
          const cs = at(cT, i), pick = k => (cs != null && O.get(cs) && pbF(pbGet(O.get(cs).p, 11), k)) || charP(ps, k);   // 字元樣式只看自己設的，其餘照段落樣式
          const size = (pick(3) || {}).v || 18, font = pick(5) ? new TextDecoder().decode(pick(5).v) : '', bold = !!(pick(1) || {}).v, col = pick(7) && colOf(pick(7).v);
          const spec = fontSpec(font, bold), ch2 = ch === ' ' ? '\n' : ch, last = cur.runs[cur.runs.length - 1], c = col ? col.c : '#000000';
          if (last && last.size === size && last.w === spec.w && last.serif === spec.serif && last.c === c && last.fn === font) last.t += ch2; else cur.runs.push({ t: ch2, size, w: spec.w, serif: spec.serif, c, fn: font });
        }
        i += ch.length;
      }
      while (paras.length && !paras[paras.length - 1].runs.length) paras.pop();
      // 寬度自動的框：位置記的是對齊點（置中＝中心、靠右＝右緣），要換回左上角
      const flags = (pbF(pbGet(gd, 1), 3) || {}).v || 0, al = paras[0] ? paras[0].align : 0;
      const tx0 = (flags & 1) ? x : x - g.w * (al === 2 ? .5 : al === 1 ? 1 : 0);
      out.items.push({ k: 'text', x: tx0, y, w: g.w, h: g.h, rot: ang, paras, nowrap: !(flags & 1) });   // 寬度自動的框不換行
    };
    for (const [r, dx, dy] of draws) await visit(r, dx, dy, 0);
    return out;
  }
  // 投影片大小（簡報 type 2 的欄位 4），照片位置要換成比例
  let SWk = 1920, SHk = 1080;
  for (const [, o] of ofType(2)) { const sz = pbGet(o.p, 4); if (sz) { const fs = pbFields(sz); const w = (fs.find(x => x.f === 1) || {}).v, h = (fs.find(x => x.f === 2) || {}).v; if (w > 100 && h > 100) { SWk = w; SHk = h; break; } } }
  // 照片檔：Data/ 裡檔名結尾是「-編號.副檔名」
  const dataFile = id => Object.keys(zip.files).find(n => n.startsWith('Data/') && new RegExp('-' + id + '\\.\\w+$').test(n));
  const MIMEK = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', heic: null, tif: null, tiff: null };
  const slides = [], perSlide = [], picsOf = [], sidOf = [], cnt = {};
  for (const sid of slideIds) {
    const so = O.get(sid); if (!so) continue; sidOf.push(sid);
    const boxes = [], pics = []; perSlide.push(boxes); picsOf.push(pics);
    const visit = (ref, dx, dy, depth) => {
      const o = O.get(ref); if (!o || depth > 6) return;
      if (o.t === 3008) { const d = pbGet(o.p, 1), g = geom(d); pbAll(o.p, 2).forEach(c => visit(pbRef(c), dx + g.x, dy + g.y, depth + 1)); return; }
      if (o.t === 3005) {   // 照片：外框位置＋遮罩（裁切）
        const g = geom(pbGet(o.p, 1)), id = pbRef(pbGet(o.p, 11)) ?? pbRef(pbGet(o.p, 12)), fn = id != null && dataFile(id); if (!fn || !g.w || !g.h) return;
        const mo = O.get(pbRef(pbGet(o.p, 5))), m = mo && mo.t === 3006 ? geom(pbGet(mo.p, 1)) : null;
        const vis = m && m.w && m.h ? { x: g.x + m.x, y: g.y + m.y, w: m.w, h: m.h } : g;
        const crop = m && m.w ? { l: Math.max(0, m.x / g.w), t: Math.max(0, m.y / g.h), r: Math.max(0, 1 - (m.x + m.w) / g.w), b: Math.max(0, 1 - (m.y + m.h) / g.h) } : { l: 0, t: 0, r: 0, b: 0 };
        pics.push({ fn, x: (dx + vis.x) / SWk, y: (dy + vis.y) / SHk, w: vis.w / SWk, h: vis.h / SHk, crop }); return;
      }
      let shp = o.t === 2011 ? o.p : o.t === 7 ? pbGet(o.p, 1) : null; if (!shp) return;
      const d = pbGet(shp, 1, 1), g = d ? geom(d) : { x: 0, y: 0, w: 0, h: 0 }, st = textOf(pbRef(pbGet(shp, 2))); if (!st) return;
      if (!g.h) { const ps = pbGet(shp, 1, 3, 4, 3) || pbGet(shp, 1, 3, 5, 2); if (ps) { const fs = pbFields(ps); g.h = (fs.find(x => x.f === 2) || {}).v || 0; } }
      boxes.push(Object.assign(st, { x: dx + g.x, y: dy + g.y, h: g.h || 60 * (st.txt.split('\n').length) }));
    };
    pbAll(so.p, 7).forEach(r => visit(pbRef(r), 0, 0, 0));
    boxes.forEach(b => b.tbl.forEach((e, k) => { const end = k + 1 < b.tbl.length ? b.tbl[k + 1].at : b.txt.length; if (e.col) cnt[e.col] = (cnt[e.col] || 0) + (end - e.at); }));
  }
  // 整份簡報最多字用的顏色＝一般字色；跟它差很多的顏色＝強調色
  const main = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a])[0];
  for (let si = 0; si < perSlide.length; si++) {
    const boxes = perSlide[si];
    const dist = (a, b) => { const p = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)); const x = p(a), y = p(b); return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]); };
    const items = [];
    boxes.forEach((b, order) => {
      const colAt = i => { let c = null; for (const e of b.tbl) { if (e.at <= i) c = e.col; else break; } return c; };
      const paras = []; let runs = [], i = 0;
      const push = (t, c) => { const red = !!(c && main && dist(c, main) > 60), cc = red ? c.toUpperCase() : undefined, last = runs[runs.length - 1]; if (last && last.red === red && last.c === cc) last.t += t; else runs.push(cc ? { t, red, c: cc } : { t, red }); };
      for (const ch of b.txt) {
        if (ch === '\n') { if (runs.map(r => r.t).join('').replace(/↵/g, '').trim()) paras.push(runs); runs = []; }
        else if (ch === '\u2028') push('↵', null);
        else if (ch !== '\ufffc') push(ch, colAt(i));
        i += ch.length;
      }
      if (runs.map(r => r.t).join('').replace(/↵/g, '').trim()) paras.push(runs);
      paras.forEach(p => { while (p.length && /↵$/.test(p[p.length - 1].t)) { const l = p[p.length - 1]; l.t = l.t.replace(/↵+$/, ''); if (!l.t) p.pop(); } });
      if (paras.length) items.push({ x: b.x, y: b.y, h: b.h, order, paras });
    });
    const paras = arrangeItems(items), pics = [];
    for (const pc of picsOf[si]) {
      try { const ext = pc.fn.split('.').pop().toLowerCase(), mime = MIMEK[ext] || 'image/jpeg'; if (MIMEK[ext] === null) continue;
        pics.push({ src: await shrinkImg(`data:${mime};base64,${await zip.file(pc.fn).async('base64')}`, mime), x: pc.x, y: pc.y, w: pc.w, h: pc.h, crop: pc.crop }); } catch (e) { console.warn('照片略過', e); }
    }
    let orig = null; try { orig = await origOf(sidOf[si]); orig.sw = SWk; orig.sh = SHk; } catch (e) { console.warn('原樣略過', e); }
    if (paras.length || pics.length || (orig && orig.items.length)) { const sd = { paras: paras.length ? paras : [[{ t: ' ', red: false }]], fs: 1, sfs: 1, hasPic: pics.length > 0 }; if (pics.length) sd.pics = pics; if (orig) { sd.orig = orig; sd.origSig = JSON.stringify(sd.paras); } else if (!paras.length) sd.bg = { t: 'color', c: '#F4EFE6' }; slides.push(sd); }
  }
  return slides;
}
async function phPositions(zip, dp, layoutT) {
  const look = [], read = async path => { const f = zip.file(path); return f ? dp.parseFromString(await f.async('string'), 'text/xml') : null; };
  const relOf = async path => { const f = zip.file(path.replace(/([^/]+)$/, '_rels/$1.rels')); if (!f) return {}; const m = {}; [...dp.parseFromString(await f.async('string'), 'text/xml').getElementsByTagName('Relationship')].forEach(r => m[r.getAttribute('Type').split('/').pop()] = r.getAttribute('Target')); return m; };
  if (layoutT) {
    const lp = 'ppt/slideLayouts/' + layoutT.split('/').pop(), ld = await read(lp); if (ld) look.push(ld);
    const mt = (await relOf(lp)).slideMaster; if (mt) { const md = await read('ppt/slideMasters/' + mt.split('/').pop()); if (md) look.push(md); }
  }
  const tbl = look.map(d => [...d.getElementsByTagName('p:sp')].map(sp => { const ph = sp.getElementsByTagName('p:ph')[0], o = sp.getElementsByTagName('a:off')[0], e = sp.getElementsByTagName('a:ext')[0]; return ph && o ? { type: ph.getAttribute('type') || 'body', idx: ph.getAttribute('idx'), x: +o.getAttribute('x'), y: +o.getAttribute('y'), h: e ? +e.getAttribute('cy') : 0 } : null; }).filter(Boolean));
  const norm = t => t === 'ctrTitle' ? 'title' : t === 'subTitle' ? 'body' : t;
  return ph => { const ty = norm(ph.getAttribute('type') || 'body'), idx = ph.getAttribute('idx');
    for (const list of tbl) { const hit = (idx && list.find(q => q.idx === idx)) || list.find(q => norm(q.type) === ty); if (hit) return hit; } return null; };
}
async function parsePptx(buf) {
  const zip = await JSZip.loadAsync(buf), dp = new DOMParser();
  const txt = async p => zip.file(p).async('string');
  const pres = dp.parseFromString(await txt('ppt/presentation.xml'), 'text/xml');
  const rels = dp.parseFromString(await txt('ppt/_rels/presentation.xml.rels'), 'text/xml');
  const map = {}; [...rels.getElementsByTagName('Relationship')].forEach(r => map[r.getAttribute('Id')] = r.getAttribute('Target'));
  const ids = [...pres.getElementsByTagName('p:sldId')].map(e => e.getAttribute('r:id'));
  const slides = [];
  const sz = pres.getElementsByTagName('p:sldSz')[0], SW = sz ? +sz.getAttribute('cx') : 12192000, SH = sz ? +sz.getAttribute('cy') : 6858000;
  const MIME = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp' };
  for (const id of ids) {
    let tgt = map[id]; tgt = tgt.replace(/^\/?(ppt\/)?/, 'ppt/');
    const doc = dp.parseFromString(await txt(tgt), 'text/xml');
    // 圖片：連同位置、裁切一起帶進來
    const pics = [], rf = zip.file('ppt/slides/_rels/' + tgt.split('/').pop() + '.rels'), rmap = {};
    if (rf) [...dp.parseFromString(await rf.async('string'), 'text/xml').getElementsByTagName('Relationship')].forEach(r => rmap[r.getAttribute('Id')] = r.getAttribute('Target'));
    // 版面配置區（標題、內文框）常常沒寫位置，位置在版面配置／母片裡：先查出來，排順序才不會亂
    const phPos = await phPositions(zip, dp, Object.values(rmap).find(t => /slideLayout/.test(t)));
    for (const pic of [...doc.getElementsByTagName('p:pic')]) {
      try {
        const blip = pic.getElementsByTagName('a:blip')[0], rid = blip && blip.getAttribute('r:embed'), t = rid && rmap[rid]; if (!t) continue;
        const ext = t.split('.').pop().toLowerCase(), mime = MIME[ext]; if (!mime) continue;
        const f = zip.file('ppt/media/' + t.split('/').pop()); if (!f) continue;
        const xf = pic.getElementsByTagName('a:xfrm')[0]; if (!xf) continue;
        const o = xf.getElementsByTagName('a:off')[0], e = xf.getElementsByTagName('a:ext')[0], sr = pic.getElementsByTagName('a:srcRect')[0];
        const g = k => sr ? (+(sr.getAttribute(k) || 0)) / 100000 : 0;
        pics.push({ src: await shrinkImg(`data:${mime};base64,${await f.async('base64')}`, mime), x: +o.getAttribute('x') / SW, y: +o.getAttribute('y') / SH, w: +e.getAttribute('cx') / SW, h: +e.getAttribute('cy') / SH, crop: { l: g('l'), t: g('t'), r: g('r'), b: g('b') } });
      } catch (err) { console.warn('圖片略過', err); }
    }
    const items = [];
    [...doc.getElementsByTagName('p:sp')].forEach((sp, order) => {
      const tb = sp.getElementsByTagName('p:txBody')[0]; if (!tb) return;
      const xf = sp.getElementsByTagName('a:xfrm')[0], off = xf && xf.getElementsByTagName('a:off')[0], ex = xf && xf.getElementsByTagName('a:ext')[0];
      const ph = sp.getElementsByTagName('p:ph')[0], pp = !off && ph ? phPos(ph) : null;
      let y = off ? +off.getAttribute('y') : pp ? pp.y : -1, x = off ? +off.getAttribute('x') : pp ? pp.x : 0, h = ex ? +ex.getAttribute('cy') : pp ? pp.h : 0;
      // 群組裡的文字框用的是群組自己的座標，要換算回投影片上的位置（Keynote 匯出常有）
      for (let g = sp.parentNode; g && g.nodeName === 'p:grpSp'; g = g.parentNode) {
        const gx = [...g.childNodes].find(n => n.nodeName === 'p:grpSpPr'), gf = gx && gx.getElementsByTagName('a:xfrm')[0]; if (!gf) continue;
        const v = (tag, a) => { const e = gf.getElementsByTagName(tag)[0]; return e ? +e.getAttribute(a) : 0; };
        const sx = v('a:chExt', 'cx') ? v('a:ext', 'cx') / v('a:chExt', 'cx') : 1, sy = v('a:chExt', 'cy') ? v('a:ext', 'cy') / v('a:chExt', 'cy') : 1;
        x = v('a:off', 'x') + (x - v('a:chOff', 'x')) * sx; y = v('a:off', 'y') + (y - v('a:chOff', 'y')) * sy; h *= sy;
      }
      const paras = [];
      [...tb.getElementsByTagName('a:p')].forEach(p => {
        const runs = [];
        [...p.childNodes].forEach(n => {
          if (n.nodeName === 'a:br') { const l0 = runs[runs.length - 1]; if (l0) l0.t += '↵'; else runs.push({ t: '↵', red: false }); return; }   // 原檔的手動換行（Shift+Enter）保留
          if (n.nodeName !== 'a:r') return;
          const t = (n.getElementsByTagName('a:t')[0] || {}).textContent || '';
          const clr = n.getElementsByTagName('a:srgbClr')[0];
          let red = false, cc;
          if (clr) {
            const v = clr.getAttribute('val'), r = parseInt(v.slice(0, 2), 16), g = parseInt(v.slice(2, 4), 16), b = parseInt(v.slice(4, 6), 16);
            const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
            if (r > 150 && g < 90 && b < 90) red = true; else if (mx - mn > 70 && mx > 90) { red = true; cc = '#' + v.toUpperCase(); }
          }
          const last = runs[runs.length - 1];
          if (last && last.red === red && last.c === cc) last.t += t; else runs.push(cc ? { t, red, c: cc } : { t, red });
        });
        if (runs.map(r => r.t).join('').trim()) paras.push(runs);
      });
      if (paras.length) items.push({ y, x, h, order, paras });
    });
    const paras = arrangeItems(items);
    const hasPic = doc.getElementsByTagName('p:pic').length > 0;
    if (paras.length || pics.length) { const sd = { paras, fs: 1, sfs: 1, hasPic }; if (pics.length) sd.pics = pics; if (!paras.length) sd.bg = { t: 'color', c: '#F4EFE6' }; slides.push(sd); }
  }
  return slides;
}
const paraToStr = p => p.map(r => r.red ? `**${r.t}**` : r.t).join('');
function strToParas(s) {
  return s.split('\n').filter(l => l.trim()).map(l => {
    const parts = l.split('**'), runs = [];
    parts.forEach((t, i) => { if (t) runs.push({ t, red: i % 2 === 1 }); });
    return runs.length ? runs : [{ t: l, red: false }];
  });
}

// ---------- 字型 ----------
const loadedChars = new Set();
async function ensureFonts() {
  const all = new Set(); S.slides.forEach(s => { s.paras.forEach(p => p.forEach(r => [...r.t].forEach(ch => all.add(ch)))); if (s.orig) s.orig.items.forEach(it => (it.paras || []).forEach(p => p.runs.forEach(r => [...r.t].forEach(ch => all.add(ch))))); });
  const fresh = [...all].filter(ch => !loadedChars.has(ch)); if (!fresh.length) return false;
  const sample = fresh.join(''); fresh.forEach(ch => loadedChars.add(ch));
  const jobs = [400, 500, 700].map(w => document.fonts.load(`${w} 40px "Noto Sans TC"`, sample)).concat([document.fonts.load('700 40px "Noto Serif TC"', sample)]);
  const ow = new Set(); S.slides.forEach(s => s.orig && s.orig.items.forEach(it => (it.paras || []).forEach(p => p.runs.forEach(r => ow.add((r.serif ? 'S' : 'G') + r.w)))));
  ow.forEach(x => jobs.push(document.fonts.load(`${x.slice(1)} 40px ${x[0] === 'S' ? '"Noto Serif TC"' : '"Noto Sans TC"'}`, sample)));
  for (const id of [S.fonts.head, S.fonts.body, S.fonts.scr]) { const o = fontOpt(id); if (o) [o.w, o.rw].forEach(w => jobs.push(document.fonts.load(`${w} 40px ${o.stack}`, sample))); }
  try { await Promise.allSettled(jobs); } catch (e) { }
  wcache.clear(); return true;
}

// ---------- UI 繪製 ----------
const thumbCv = new Map();
function renderMain() {
  const sl = S.slides[S.sel]; if (!sl) return;
  const r = drawLive($('cvLive'), sl, S.sel); S.liveGeo = r.geo;
  const key = S.sel + '|' + S.view; if (key !== renderMain._k) { renderMain._k = key; [$('cvLive'), $('cvStrip')].forEach(c => { c.classList.remove('swap'); void c.offsetWidth; c.classList.add('swap'); }); }
  $('capLive').textContent = '';
  $('capName').textContent = S.view === 'live' ? '現場版' : '線上版'; $('capTally').className = 'tally ' + (S.view === 'live' ? 'live' : 'rec'); $('capPage').textContent = `第 ${S.sel + 1} 頁／共 ${S.slides.length} 頁`;
  $('lvCap').hidden = !r.capped; $('lvCap').textContent = '這一頁字比較多，已經是放得下的最大字級；字級往大調不會再變大，往小調才有變化。';
  const n = drawStrip($('cvStrip'), sl, S.page);
  $('svCap').hidden = !drawStrip.capped; $('svCap').textContent = drawStrip.tall ? '這一頁字太多，字條變高、字也變小了；建議在「文字」分頁把這頁拆成兩頁。' : '這一頁字比較多，字條已經是放得下的最大字級；可以拉長字條讓字變大。';
  $('miniLive').getContext('2d').drawImage($('cvLive'), 0, 0, 320, 180); const mc = $('miniStrip').getContext('2d'); mc.clearRect(0, 0, 320, 180); mc.drawImage($('cvStrip'), 0, 0, 320, 180);
  const pg = $('pages'); pg.innerHTML = '';
  if (S.view === 'strip' && n > 1) for (let i = 0; i < n; i++) { const b = document.createElement('button'); b.className = 'pill' + (i === S.page ? ' sel' : ''); b.textContent = `第${i + 1}張`; b.onclick = () => { S.page = i; renderMain(); }; pg.appendChild(b); }
  renderThumb(S.sel); syncVariantUI(); syncParaBar(); syncPage();
}
function syncVariantUI() {
  const sl = S.slides[S.sel], sel = $('variantSel'); if (!sl || !sel) return;
  const auto = autoVariant(Object.assign({}, sl, { variant: 'auto' }), S.sel);
  if (!sel.options.length) Object.entries(VARIANT_LABELS).forEach(([k, t]) => { const o = document.createElement('option'); o.value = k; o.textContent = t; sel.appendChild(o); });
  sel.options[0].textContent = `自動（${VARIANT_LABELS[auto]}）`; sel.value = sl.variant || 'auto';
}
function renderThumb(i) {
  const cv = thumbCv.get(i); if (!cv) return;
  const full = mk(W, H), r = drawLive(full, S.slides[i], i);
  const c = cv.getContext('2d');
  if (S.view === 'strip') {
    // 線上版：縮圖顯示這一頁的字條（放大到字條附近，才看得清楚排得好不好）
    const keep = { geo: drawStrip.geo, pos: drawStrip.pos, tb: drawStrip.tb, card: drawStrip.card, capped: drawStrip.capped, tall: drawStrip.tall };
    const sc = mk(W, H); drawStrip(sc, S.slides[i], 0); const k = drawStrip.card; Object.assign(drawStrip, keep);
    c.fillStyle = '#17181c'; c.fillRect(0, 0, cv.width, cv.height);
    if (k) { const vw = Math.max(k.w + 120, (k.h + 80) * 16 / 9), vh = vw * 9 / 16, vx = k.x + k.w / 2 - vw / 2, vy = k.y + k.h / 2 - vh / 2; c.drawImage(sc, vx, vy, vw, vh, 0, 0, cv.width, cv.height); }
  } else c.drawImage(full, 0, 0, cv.width, cv.height);
  const badge = cv.parentElement.querySelector('.badge'); const n = stripPages(S.slides[i]).pages.length;
  badge.textContent = `線上 ${n} 條`; badge.hidden = n < 2;
  const fl = cv.parentElement.querySelector('.flag'); if (fl) fl.hidden = !S.slides[i].bg;
  // 需要看一下：字被縮得很小，或線上版要拆成好幾條
  const wn = cv.parentElement.querySelector('.warn'), why = r.shrunk ? '這頁字很多，字被縮小了' : n > 2 ? `線上版要拆成 ${n} 條字條` : '';
  if (wn) { wn.hidden = !why; wn.title = why; }
  S.slides[i]._warn = why;
}
function buildList() {
  const list = $('list'); list.innerHTML = ''; thumbCv.clear();
  S.slides.forEach((sl, i) => {
    const d = document.createElement('div'); d.className = 'thumb' + (i === S.sel ? ' sel' : '');
    d.innerHTML = `<canvas width="400" height="225"></canvas><span class="n">${i + 1}</span><span class="badge" hidden></span><span class="flag" hidden>單頁背景</span><span class="warn" hidden>看一下</span>`;
    d.onclick = () => select(i); list.appendChild(d); thumbCv.set(i, d.querySelector('canvas'));
    if (S._ripple) { d.classList.add('ripple'); d.style.animationDelay = Math.min(i, 20) * 45 + 'ms'; }
  });
  let i = 0; const step = () => { if (i < S.slides.length) { renderThumb(i++); setTimeout(step, 0); } }; step();
}
function select(i) {
  if ($('inEd') && !$('inEd').hidden) inlineClose();
  if (typeof pEdClose === 'function') pEdClose();
  S.sel = i; S.page = 0; paraSel = null; if (typeof picSel !== 'undefined') { picSel.hidden = true; picPinned = false; }
  document.querySelectorAll('.thumb').forEach((d, k) => d.classList.toggle('sel', k === i));
  const sl = S.slides[i];
  edRender();
  syncOut(); renderMain(); syncSlideBgUI();
  const th = document.querySelectorAll('.thumb')[i]; if (th) th.scrollIntoView({ block: 'nearest' });
}
const VIEW_HINT = {
  live: '點一下選取，點兩下改字',
  strip: '點一下選取，拖曳可以移動字條',
};
function setView(v) {
  S.view = v; paraSel = null; if (typeof picSel !== 'undefined') { picSel.hidden = true; picPinned = false; }
  document.querySelectorAll('.view, #hView button').forEach(b => b.classList.toggle('on', b.dataset.v === v));
  if (typeof pEdClose === 'function') pEdClose(); syncPage();
  $('frameLive').hidden = v !== 'live'; $('frameStrip').hidden = v !== 'strip';
  $('posLive').hidden = v !== 'live'; $('posStrip').hidden = v !== 'strip';
  $('viewHint').textContent = VIEW_HINT[v]; if (typeof edRender === 'function' && S.slides.length) edRender(); $('capAlign').hidden = v !== 'strip'; $('stripLookSec').hidden = v !== 'strip';   // 字條的設定只在看線上版時出現 renderMain();
  if (S.slides.length) setTimeout(() => S.slides.forEach((_, i) => renderThumb(i)), 60);   // 縮圖跟著換成現場版／字條
}
// ---------- 大小位置：同一個「整份／這一頁」開關，現場版、線上版各自一組 ----------
const pct = v => Math.round(v * 100) + '%', mul = g => (g / LN).toFixed(2);
function syncLiveUI() {
  const sl = S.slides[S.sel], one = S.layScope === 'slide' && !!sl;
  document.querySelectorAll('#layScope button').forEach(b => b.classList.toggle('on', b.dataset.s === S.layScope));
  $('layScopeSlide').textContent = sl ? `只有第 ${S.sel + 1} 頁` : '只有這一頁';
  const own = sl && ((sl.fs && sl.fs !== 1) || sl.lg || (sl.sfs && sl.sfs !== 1) || sl.slg || (sl.lv && Object.keys(sl.lv).length));
  $('layNote').textContent = one ? `下面的調整只會改第 ${S.sel + 1} 頁。` : '下面的調整會套用到每一頁' + (own ? '；這一頁有自己的設定，不會被蓋掉。' : '。');
  // 現場版
  const ls = one ? (sl.fs || 1) : S.deckScale, lg = one ? gapOf(sl) : (S.lineGap || 1.1 * LN);
  $('lvSize').value = Math.round(ls * 100); $('lvSizeO').textContent = pct(ls);
  $('lvGap').value = mul(lg); $('lvGapO').textContent = mul(lg);
  document.querySelectorAll('#anchorRow .pill').forEach(b => b.classList.toggle('sel', b.dataset.an === S.anchor));
  $('anchorRow').hidden = one;
  // 線上版
  const ss = one ? (sl.sfs || 1) : (S.stripScale || 1), sg = one ? sgapOf(sl) : (S.stripGap || 0.96 * LN);
  $('svSize').value = Math.round(ss * 100); $('svSizeO').textContent = pct(ss);
  $('svGap').value = mul(sg); $('svGapO').textContent = mul(sg);
  const sa = one ? stripAlignOf(sl) : (S.stripAlign || 'auto'); document.querySelectorAll('.svAlign .pill').forEach(b => b.classList.toggle('sel', b.dataset.a === sa));
  $('lvReset').textContent = one ? `第 ${S.sel + 1} 頁還原成跟整份一樣` : '還原整份的預設';
  $('stripReset').textContent = one ? `第 ${S.sel + 1} 頁還原成跟整份一樣` : '還原整份的預設';
  if (!sl) return;
  const vv = autoVariant(sl, S.sel), L = liveCfg(sl, vv === 'title', vv);
  $('lvX').value = L.dx; $('lvXO').textContent = L.dx; $('lvY').value = L.dy; $('lvYO').textContent = L.dy; $('lvW').value = L.w; $('lvWO').textContent = L.w;
  const al = L.align || sl._autoAlign || 'left'; document.querySelectorAll('#lvAlign .pill').forEach(b => b.classList.toggle('sel', b.dataset.a === al));
}
function editLive(key, val) {
  if (S.layScope === 'slide') { const sl = S.slides[S.sel]; sl.lv = sl.lv || {}; sl.lv[key] = val; }
  else S.live[key] = val;
  syncLiveUI(); redrawSoon();
}
function setLay(kind, v) {
  const sl = S.slides[S.sel], one = S.layScope === 'slide' && sl;
  if (kind === 'lvSize') one ? (sl.fs = v) : (S.deckScale = v);
  if (kind === 'lvGap') one ? (sl.lg = v) : (S.lineGap = v);
  if (kind === 'svSize') one ? (sl.sfs = v) : (S.stripScale = v);
  if (kind === 'svGap') one ? (sl.slg = v) : (S.stripGap = v);
  _deck.sig = ''; S.page = 0; syncLiveUI(); redrawSoon();
}
function syncOut() {
  syncLiveUI(); syncStripLook(); setTimeout(() => document.querySelectorAll('input[type=range]').forEach(paintRange), 0);
  $('stripXO').textContent = S.stripX; $('stripX').value = S.stripX; $('stripY').value = S.stripY; $('stripYO').textContent = S.stripY; syncStripW();
}
const HUE = {
  paper: 'warm', dusk: 'cool', morning: 'warm', olive: 'green', minimal: 'neutral', burgundy: 'warm', sage: 'green', terracotta: 'warm',
  ocean: 'cool', lavender: 'cool', forest: 'green', midnight: 'cool', sunrise: 'warm', mono: 'neutral', sunny: 'warm', cloud: 'cool',
  ember: 'warm', rose: 'warm', watercolor: 'warm', skyframe: 'cool', charcoal: 'neutral', royal: 'cool', sunray: 'warm',
  duskcloud: 'warm', cocoa: 'warm', peach: 'warm', parchment: 'warm', evergreen: 'green', pastel: 'cool', vigil: 'cool',
  xmaslights: 'warm', xmasnight: 'green', snownight: 'cool', spring: 'green', bunting: 'warm', lemon: 'warm', tangerine: 'warm', retro: 'warm', fog: 'neutral', mint: 'green'
};
const CATS = [['all', '全部'], ['light', '淺色'], ['dark', '深色'], ['warm', '暖色'], ['cool', '藍紫'], ['green', '綠意'], ['neutral', '黑白灰']];
let themeCat = 'all';
const hueOf = (k, t) => t.hue || HUE[k];
function inCat(k, t) { return themeCat === 'all' || (themeCat === 'light' && !t.dark) || (themeCat === 'dark' && t.dark) || hueOf(k, t) === themeCat; }
function buildCats() {
  const bar = $('themeCats'); bar.innerHTML = '';
  CATS.forEach(([id, label]) => {
    const n = Object.entries(THEMES).filter(([k, t]) => id === 'all' || (id === 'light' && !t.dark) || (id === 'dark' && t.dark) || hueOf(k, t) === id).length;
    const b = document.createElement('button'); b.className = 'pill' + (themeCat === id ? ' sel' : ''); b.textContent = `${label} ${n}`;
    b.onclick = () => { themeCat = id; buildCats(); buildThemes(); }; bar.appendChild(b);
  });
}
const thumbCache = new Map();
function drawThumb(k, cv) {
  if (!thumbCache.has(k)) {
    const t = THEMES[k], tc = mk(320, 180), cc = tc.getContext('2d');
    cc.drawImage(getBgFor(k), 0, 0, 320, 180);
    cc.font = `700 34px ${t.serif ? SERIF : FONT}`; cc.fillStyle = t.text; cc.fillText('耶穌愛你', 24, 80); cc.fillStyle = t.red; cc.fillText('真理', 24, 128);
    thumbCache.set(k, tc);
  }
  cv.getContext('2d').drawImage(thumbCache.get(k), 0, 0);
}
function buildThemes() {
  const box = $('themes'); box.innerHTML = '';
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { io.unobserve(e.target); drawThumb(e.target.dataset.k, e.target); } }), { root: box, rootMargin: '200px' });
  Object.entries(THEMES).filter(([k, t]) => inCat(k, t)).forEach(([k, t]) => {
    const b = document.createElement('button'); b.className = 'tcard' + (!S.custom && S.themeKey === k ? ' sel' : ''); b.title = t.name; b.dataset.k = k;
    const cv = mk(320, 180); cv.dataset.k = k; b.appendChild(cv);
    if (thumbCache.has(k)) drawThumb(k, cv); else io.observe(cv);
    const sp = document.createElement('span'); sp.textContent = t.name; b.appendChild(sp);
    b.onclick = () => applyTheme(k); box.appendChild(b);
  });
  $('themeCount').textContent = box.children.length + ' / ' + Object.keys(THEMES).length; if (typeof markBgSel === 'function') markBgSel();
}
function getBgFor(k) { const c = mk(W, H); THEMES[k].bg.call(THEMES[k], c.getContext('2d'), 'content'); return c; }
function afterThemeChange() { bgCache.clear(); _scCache.clear(); buildThemes(); buildList(); renderMain(); if (document.activeElement !== ed) edRender(); save(); }
function clearCustom(redraw = true) { S.custom = null; try { localStorage.removeItem('ppt-web-bg'); } catch (e) { } syncBgUi(); if (redraw) afterThemeChange(); }
function syncBgUi() {
  const has = !!S.custom;
  $('bgCtl').hidden = !has; $('bgThumb').hidden = !has; $('bgUp').classList.toggle('has', has);
  $('bgUp').hidden = !has;
  $('bgHint').textContent = has ? '每一頁都用這張圖（自己設過背景的頁面除外），重新整理也會記住' : '';
  document.querySelectorAll('#bgMode .pill').forEach(x => x.classList.toggle('sel', x.dataset.m === S.customMode));
  $('bgDim').value = Math.round(dimOf() * 100); $('bgDimO').textContent = Math.round(dimOf() * 100) + '%';
  if (has) { const c = $('bgThumbCv').getContext('2d'), im = S.custom, sc = Math.max(320 / im.width, 180 / im.height); c.drawImage(im, (320 - im.width * sc) / 2, (180 - im.height * sc) / 2, im.width * sc, im.height * sc); c.fillStyle = S.customMode === 'light' ? `rgba(255,255,255,${dimOf()})` : `rgba(10,8,6,${dimOf()})`; c.fillRect(0, 0, 320, 180); }
}
let bgSaveT;
function saveBg() {
  clearTimeout(bgSaveT); bgSaveT = setTimeout(() => {
    if (!S.custom) return;
    try {
      const c = mk(1920, 1080), x = c.getContext('2d'), im = S.custom, sc = Math.max(1920 / im.width, 1080 / im.height);
      x.drawImage(im, (1920 - im.width * sc) / 2, (1080 - im.height * sc) / 2, im.width * sc, im.height * sc);
      localStorage.setItem('ppt-web-bg', JSON.stringify({ src: c.toDataURL('image/jpeg', .82), mode: S.customMode, dim: S.customDim }));
    } catch (e) { }
  }, 400);
}
function loadSavedBg() {
  try {
    const v = JSON.parse(localStorage.getItem('ppt-web-bg') || 'null'); if (!v || !v.src) return;
    const im = new Image(); im.onload = () => { S.custom = im; S.customMode = v.mode || 'dark'; S.customDim = v.dim == null ? null : v.dim; syncBgUi(); afterThemeChange(); }; im.src = v.src;
  } catch (e) { }
}

// ---------- 字型選單 ----------
async function registerLocal(name, fam) {
  fam = fam || 'LF_' + Math.random().toString(36).slice(2, 8);
  let f = S.localFonts.find(x => x.name === name);
  if (!f) { f = { name, fam }; S.localFonts.push(f); }
  try { const ff = new FontFace(f.fam, `local("${name.replace(/"/g, '')}")`); await ff.load(); document.fonts.add(ff); f.ok = true; }
  catch (e) { f.ok = false; }
  return f;
}
function buildFontSelects() {
  [['fontHead', 'head'], ['fontBody', 'body'], ['fontScr', 'scr']].forEach(([id, k]) => {
    const first = k === 'scr' ? 'same' : 'theme';
    const sel = $(id); sel.innerHTML = '';
    const add = (v, t, dis) => { const o = document.createElement('option'); o.value = v; o.textContent = t; if (dis) o.disabled = true; sel.appendChild(o); };
    add(first, k === 'scr' ? '跟內文一樣' : '預設');
    FONT_OPTS.forEach(o => add(o.id, o.label));
    S.localFonts.forEach(f => add('L:' + f.fam, '本機：' + f.name + (f.ok === false ? '（找不到）' : ''), f.ok === false));
    sel.value = (fontOpt(S.fonts[k]) || S.fonts[k] === first) ? S.fonts[k] : first;
  });
}
async function afterFontChange() {
  loadedChars.clear(); await ensureFonts(); wcache.clear(); buildList(); renderMain(); save();
}
async function addLocalFontByName(name) {
  name = name.trim(); if (!name) return;
  const f = await registerLocal(name);
  if (f.ok) { toast(`已加入本機字型：${name}`); buildFontSelects(); } else { S.localFonts = S.localFonts.filter(x => x !== f); toast('找不到這個字型，請確認名稱，或用「從電腦挑」'); }
  return f;
}
let _localAll = null;
function renderLocalList() {
  const box = $('localList'), q = $('localFilter').value.trim().toLowerCase();
  const pre = /金萱|那堤|凝書|源樣|源柔|思源|圓|jf|huninn/i;
  let list = _localAll || []; list = q ? list.filter(f => (f.fullName + f.family).toLowerCase().includes(q)) : list.filter(f => pre.test(f.fullName + f.family));
  box.innerHTML = '';
  list.slice(0, 80).forEach(f => {
    const b = document.createElement('button'); b.className = 'btn small'; b.textContent = f.fullName;
    b.onclick = async () => { const r = await addLocalFontByName(f.postscriptName || f.fullName); if (r && r.ok) { r.name = f.fullName; save(); } };
    box.appendChild(b);
  });
  if (!list.length) box.textContent = q ? '沒有符合的字型' : '沒找到金萱、凝書等常用字型，請直接在上面搜尋';
}

// ---------- 記住上次的樣式 ----------
const styleObj = () => ({ themeKey: S.themeKey, stripW: S.stripW, stripY: S.stripY, stripX: S.stripX, lineGap: S.lineGap, fonts: S.fonts, autoExport: S.autoExport, exportFmt: S.exportFmt, deckScale: S.deckScale, anchor: S.anchor, stripFixed: S.stripFixed, stripGap: S.stripGap, stripScale: S.stripScale, sAlign: S.stripAlign, keepOrig: S.keepOrig !== false, sLook: S.sLook, sAuto: S.sAuto, plain: S.plain || null, shadow: S.shadow, blocks: S.blocks, dashRef: S.dashRef, autoVary: S.autoVary, bgAll: S.bgAll, localFonts: S.localFonts.map(f => ({ name: f.name, fam: f.fam })) });
async function applyStyle(v) {
  if (!v) return;
  Object.assign(S, { themeKey: THEMES[v.themeKey] ? v.themeKey : 'torn_kraft', stripW: v.stripW || .81, stripY: v.stripY == null ? 64 : v.stripY, stripX: v.stripX || 0, lineGap: v.lineGap || null, autoExport: false, exportFmt: v.exportFmt || 'image', deckScale: v.deckScale || 1, anchor: 'middle', stripFixed: !!v.stripFixed, stripGap: v.stripGap || null, stripScale: v.stripScale || 1, stripAlign: v.sAlign || 'auto', keepOrig: v.keepOrig !== false, sLook: Object.assign({ bg: null, r: null, pad: 46 }, v.sLook, { a: 1 }), sAuto: Object.assign({ num: true }, v.sAuto, { ref: true }), plain: v.plain || null, shadow: false, blocks: false, dashRef: v.dashRef !== false, autoVary: v.autoVary !== false, bgAll: v.bgAll || null });
  if (v.fonts) S.fonts = Object.assign({}, v.fonts, { scr: 'same' });
  for (const f of (v.localFonts || [])) await registerLocal(f.name, f.fam);
  $('optShadow').checked = !!S.shadow; $('optDash').checked = S.dashRef !== false; $('optBlocks').checked = !!S.blocks;
  $('autoExport').checked = S.autoExport;
  buildFontSelects(); buildThemes(); syncOut();
}
function showStyleNote(has) {
  $('styleNote').hidden = !has; if (has) $('styleNoteT').textContent = `已記住你上次的設定（背景：${THEMES[S.themeKey].name}），新檔案會自動套用。`;
}
// ---------- 儲存 ----------
let saveT;
function save() {
  clearTimeout(saveT); saveT = setTimeout(() => {
    histCommit();
    try { localStorage.setItem('ppt-web-style', JSON.stringify(styleObj())); } catch (e) { }
    const mk1 = sl => ({ slides: sl, themeKey: S.themeKey, stripW: S.stripW, stripY: S.stripY, stripX: S.stripX, lineGap: S.lineGap, live: S.live, fileName: S.fileName, fonts: S.fonts, localFonts: S.localFonts.map(f => ({ name: f.name, fam: f.fam })) });
    try { localStorage.setItem('ppt-web-v1', JSON.stringify(mk1(S.slides))); }
    catch (e) {
      try { localStorage.setItem('ppt-web-v1', JSON.stringify(mk1(S.slides.map(x => x.bg && x.bg.t === 'img' ? Object.assign({}, x, { bg: undefined }) : x)))); }
      catch (e2) { try { localStorage.setItem('ppt-web-v1', JSON.stringify(mk1(S.slides.map(x => Object.assign({}, x, { pics: undefined, bg: x.bg && x.bg.t === 'img' ? undefined : x.bg }))))); } catch (e3) { } }
    }
  }, 300);
}
let redrawT;
let thumbT;
function redrawSoon() { clearTimeout(redrawT); redrawT = setTimeout(renderMain, 60); clearTimeout(thumbT); thumbT = setTimeout(() => S.slides.forEach((_, i) => renderThumb(i)), 500); save(); }

// ---------- 載入 ----------
async function start(slides, name, live) {
  S.slides = slides; S.live = live || {}; S.sel = 0; S.page = 0; S.fileName = name.replace(/\.(pptx|txt|key)$/i, '');
  $('drop').hidden = true; $('editor').hidden = false; $('viewHint').textContent = VIEW_HINT[S.view]; $('sideEmpty').hidden = true; $('sideBody').hidden = false; document.body.classList.remove('empty');
  await Promise.all(slides.flatMap(x => [].concat(x.bg && x.bg.t === 'img' ? [x.bg.src] : [], x.orig ? x.orig.items.flatMap(it => [it.src, it.fill && it.fill.img]).filter(Boolean) : [], (x.pics || []).concat(x.spics || []).map(p => p.src))).map(loadBgImg));
  await ensureFonts(); bgCache.clear(); buildCats(); buildThemes(); buildList(); select(0); save(); histReset();
  setTimeout(() => { const w = S.slides.map((s, i) => s._warn ? i + 1 : 0).filter(Boolean); if (w.length) toast(`排好了。第 ${w.slice(0, 5).join('、')}${w.length > 5 ? ' 等' : ''} 頁字比較多，縮圖上有標「看一下」`); }, 1500);
}
function parseTxt(buf) {
  let s = new TextDecoder('utf-8').decode(buf);
  if (s.includes('\uFFFD')) { try { s = new TextDecoder('big5').decode(buf); } catch (e) {} }
  s = s.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').replace(/\u3000/g, ' ');
  return s.split(/\n[ \t]*\n+/).map(b => b.trim()).filter(Boolean).map(b => ({ paras: strToParas(b), fs: 1, sfs: 1 }));
}
async function loadFile(f) {
  try { const isTxt = /\.txt$/i.test(f.name) || f.type === 'text/plain', isKey = /\.key$/i.test(f.name); const buf = await f.arrayBuffer(); const slides = isTxt ? parseTxt(buf) : isKey ? await parseKey(buf) : await parsePptx(buf); if (!slides.length) throw new Error('empty'); await start(slides, f.name); toast(`已讀入 ${slides.length} 頁`); if (S.autoExport) await exportByFormat().catch(e => { console.error(e); $('prog').style.display = 'none'; toast('匯出失敗：' + e.message); }); }
  catch (e) { console.error(e); toast(/\.key$/i.test(f.name) ? '讀不到這個 Keynote 檔；可以在 Keynote 選「檔案 → 輸出至 → PowerPoint」再上傳' : '讀不到這個檔案，請確認是 .pptx、.key 或 .txt'); }
}
const SAMPLE = [
  [['耶穌是道路、真理和生命'], ['約14:6-7'], ['栗育仁  牧師']],
  [['耶穌說：「我就是道路、真理、生命；若不藉著我，沒有人能到父那裡去。你們若認識我，也就認識我的父。從今以後，你們認識他，並且已經看見他。」(約14:6-7)']],
  [['門徒關心耶穌要去哪裡！'], ['西門•彼得問耶穌說：「', '**主往哪裡去？**', '」耶穌回答說：「我所去的地方，你現在不能跟我去，後來卻要跟我去。」(約13:36)'], ['彼得說：「主啊，我為甚麼現在不能跟你去？我願意為你捨命！」(約13:37)']],
  [['2. 真理：是非對錯認定的信念'], ['後現代的世俗潮流，認為沒有絕對的真理'], ['現代人很多時候也高舉意識形態，是非對錯不重要']],
];
function sampleSlides() { return SAMPLE.map(ps => ({ paras: strToParas(ps.map(p => p.join('')).join('\n')), fs: 1, sfs: 1 })); }

// ---------- 匯出 ----------
const sleep = ms => new Promise(r => setTimeout(r, ms));
function prog(t, p) {
  $('prog').style.display = 'flex'; $('progT').textContent = t; $('progB').style.width = (p * 100) + '%';
  // 每一頁一個小格，做完的亮起來，看得出還剩多少
  const m = t.match(/第\s*(\d+)\s*\/\s*(\d+)\s*頁/), box = $('progDots');
  if (!m) { if (p >= .95) box.querySelectorAll('i').forEach(d => d.classList.add('on')); return; }
  const cur = +m[1], n = +m[2];
  if (box.children.length !== n) box.innerHTML = '<i></i>'.repeat(n);
  [...box.children].forEach((d, k) => { d.classList.toggle('on', k < cur - 1); d.classList.toggle('now', k === cur - 1); });
}
const blobOf = (cv, type, q) => new Promise(r => cv.toBlob(r, type, q));
const dataOf = blob => new Promise(r => { const f = new FileReader(); f.onload = () => r(f.result); f.readAsDataURL(blob); });
function download(blob, name) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000); }

async function exportAll(mode = 'zip') {
  const wantZip = mode === 'zip';
  await ensureFonts();
  const zip = new JSZip(), pL = new PptxGenJS(), pS = new PptxGenJS(); pL.layout = pS.layout = 'LAYOUT_WIDE';
  const cv = mk(W, H); const total = S.slides.length; let done = 0;
  for (let i = 0; i < total; i++) {
    prog(`正在輸出第 ${i + 1} / ${total} 頁…`, done / total); await sleep(0);
    drawLive(cv, S.slides[i], i);
    const jb = await blobOf(cv, 'image/jpeg', .93), name = String(i + 1).padStart(3, '0');
    if (wantZip) zip.file(`現場版圖片/現場版_${name}.jpg`, jb);
    pL.addSlide().addImage({ data: await dataOf(jb), x: 0, y: 0, w: 13.333, h: 7.5 });
    const n = stripPages(S.slides[i]).pages.length;
    for (let p = 0; p < n; p++) {
      drawStrip(cv, S.slides[i], p);
      const pb = await blobOf(cv, 'image/png');
      if (wantZip) zip.file(`線上版圖片/線上版_${name}${n > 1 ? '_' + 'abcdefgh'[p] : ''}.png`, pb);
      pS.addSlide().addImage({ data: await dataOf(pb), x: 0, y: 0, w: 13.333, h: 7.5 });
    }
    done++;
  }
  prog('正在打包 pptx…', .95); await sleep(30);
  const liveName = `${S.fileName}_現場版_給ProPresenter.pptx`, stripName = `${S.fileName}_線上版_給ProPresenter.pptx`;
  const liveBlob = await pL.write({ outputType: 'blob' }), stripBlob = await pS.write({ outputType: 'blob' });
  if (!wantZip) {
    $('prog').style.display = 'none'; download(liveBlob, liveName); await sleep(500); download(stripBlob, stripName);
    toast('已下載兩個 pptx：現場版、線上版'); return [liveBlob, stripBlob];
  }
  zip.file(liveName, liveBlob); zip.file(stripName, stripBlob);
  const out = await zip.generateAsync({ type: 'blob' });
  $('prog').style.display = 'none'; download(out, `${S.fileName}_輸出.zip`); toast('已下載 zip');
  return out;
}

// ---------- 可編輯文字版 pptx ----------
const PX_IN = 144, inch = px => +(px / PX_IN).toFixed(4), ptOf = px => +(px * .5).toFixed(2), hexNo = c => String(c).replace('#', '');
function textGroups(lines, y, o) {
  const gs = []; let cur = null;
  lines.forEach((l, i) => {
    if (!cur || cur.pi !== l.pi) { cur = { pi: l.pi, gid: l.gid, y, size: l.size, head: l.head, scr: l.scr, lines: [], h: 0 }; gs.push(cur); }
    cur.lines.push(l); cur.h += l.h; y += l.h;
    if (lines[i + 1] && lines[i + 1].pi !== l.pi) y += pgap(l, lines[i + 1], o);
  });
  return gs;
}
function faceOf(head, scr) {
  const o = fontOpt(fontIdOf(head, scr));
  if (o) return { face: o.face, bold: !!o.bold };
  return { face: head && isSerif() ? 'Noto Serif TC' : 'Noto Sans TC', bold: !!head };
}
function addTextGroups(sl, lines, y, o, x, w, align, T) {
  textGroups(lines, y, o).forEach(g => {
    const f = faceOf(g.head, g.scr), runs = [], sh = !!o.shadow && lumOf(T.text) > .6;
    g.lines.forEach((l, li) => {
      let last = null;
      l.segs.forEach(s => {
        const key = s.red ? 'r' + (s.c || '') : 't';
        if (last && last.key === key && !last.fresh) { last.run.text += s.t; return; }
        const opt = { color: hexNo((g.head && o.headColor) ? o.headColor : runColor(s, T)), bold: f.bold || !!s.red, fontFace: f.face };
        if (li > 0 && !last) opt.softBreakBefore = true;
        const run = { text: s.t, options: opt }; runs.push(run); last = { key, run };
      });
    });
    const d = (o.off && o.off(g.gid)) || {}, slack = w * .14, bx = (align === 'center' ? x - slack / 2 : align === 'right' ? x - slack : x) + (d.x || 0);
    sl.addText(runs, { x: inch(bx), y: inch(g.y + (d.y || 0)), w: inch(w + slack), h: inch(g.h), margin: 0, valign: 'top', align, fontSize: ptOf(g.size), lineSpacingMultiple: +(g.lines[0].h / (g.size * LN)).toFixed(2), ...(o.track ? { charSpacing: +(o.track * ptOf(g.size)).toFixed(1) } : {}), wrap: true, fit: 'none', ...(sh ? { shadow: { type: 'outer', color: '000000', opacity: .6, blur: 6, offset: 2, angle: 90 } } : {}) });
  });
}
async function exportEditable() {
  await ensureFonts();
  const pL = new PptxGenJS(), pS = new PptxGenJS(); pL.layout = pS.layout = 'LAYOUT_WIDE';
  const cv = mk(W, H), total = S.slides.length;
  for (let i = 0; i < total; i++) {
    prog(`正在輸出可編輯版 第 ${i + 1} / ${total} 頁…`, i / total); await sleep(0);
    const sd = S.slides[i], r = drawLive(cv, sd, i, true), g = r.geo;
    const sl = pL.addSlide(); sl.addImage({ data: await dataOf(await blobOf(cv, 'image/jpeg', .93)), x: 0, y: 0, w: 13.333, h: 7.5 });
    (g.otext || []).forEach(b => sl.addText(b.paras.flatMap((p, pi) => p.runs.map((r, ri) => ({ text: r.t.replace(/\n/g, '\n'), options: { fontSize: ptOf(r.size * b.k), color: hexNo(r.c), bold: r.w >= 700, fontFace: (famOf(r).ff.match(/"([^"]+)"/) || [, r.serif ? 'Noto Serif TC' : 'Noto Sans TC'])[1], breakLine: ri === p.runs.length - 1 && pi < b.paras.length - 1, align: ['left', 'right', 'center', 'justify', 'left'][p.align] || 'left' } }))), { x: inch(b.x), y: inch(b.y), w: inch(b.w), h: inch(Math.max(40, b.h)), margin: 0, valign: 'top' }));
    addTextGroups(sl, g.lines, g.y, g.o, g.x, g.maxW, g.align, g.T); addTBText(sl, g.tb || []);
    (g.extra || []).forEach(e => addTextGroups(sl, e.lines, e.y, e.o, e.x, e.w, 'left', e.T));
    if (g.numeral) { const hh = g.numSize * 1.3; sl.addText(g.numeral, { x: inch(g.numX - 6), y: inch(g.numY - hh / 2), w: 1.1, h: inch(hh), margin: 0, valign: 'middle', align: 'left', fontSize: ptOf(g.numSize), italic: true, bold: true, fontFace: 'Noto Serif TC', color: hexNo(g.T.accent) }); }
    const n = stripPages(sd).pages.length;
    for (let p = 0; p < n; p++) {
      drawStrip(cv, sd, p, true); const sg = drawStrip.geo;
      const ss = pS.addSlide(); ss.addImage({ data: await dataOf(await blobOf(cv, 'image/png')), x: 0, y: 0, w: 13.333, h: 7.5 });
      addTextGroups(ss, sg.lines, sg.y, sg.o, sg.x, sg.w, sg.align || 'left', sg.T);
      (sg.extra || []).forEach(e => addTextGroups(ss, e.lines, e.y, e.o, e.x, e.w, 'left', e.T));
      addTBText(ss, drawStrip.tb || []);
      if (sg.num) { const hh = sg.num.size * 1.3, f = faceOf(true, false); ss.addText(sg.num.t, { x: inch(sg.num.x), y: inch(sg.num.y - hh / 2), w: inch(sg.num.size * 1.5), h: inch(hh), margin: 0, valign: 'middle', align: 'left', fontSize: ptOf(sg.num.size), bold: true, fontFace: f.face, color: hexNo(sg.num.color) }); }
    }
  }
  prog('正在打包 pptx…', .95); await sleep(30);
  const a = await pL.write({ outputType: 'blob' }), b = await pS.write({ outputType: 'blob' });
  $('prog').style.display = 'none'; download(a, `${S.fileName}_現場版_可編輯.pptx`); await sleep(500); download(b, `${S.fileName}_線上版_可編輯.pptx`);
  toast('已下載兩個可以改字的 pptx'); return [a, b];
}
async function exportByFormat() {
  const f = S.exportFmt;
  if (f === 'text') return exportEditable();
  if (f === 'both') { await exportAll('pptx'); await sleep(600); return exportEditable(); }
  return exportAll('pptx');
}

function toast(t) { const e = $('toast'); e.textContent = t; e.classList.add('on'); clearTimeout(e._t); e._t = setTimeout(() => e.classList.remove('on'), 2600); }

// ---------- 事件 ----------
$('btnOpen').onclick = $('btnPick').onclick = () => $('file').click();
$('file').onchange = e => { if (e.target.files[0]) loadFile(e.target.files[0]); e.target.value = ''; };
$('btnSample').onclick = () => start(sampleSlides(), '範例');
async function renderEmptyPreview() {
  try {
    const sl = sampleSlides(), keep = S.slides; S.slides = sl; loadedChars.clear(); await ensureFonts(); S.slides = keep;
    if (!tplOn()) S._demo = 'torn_kraft'; bgCache.clear(); _scCache.clear();
    drawLive($('sampleLive'), sl[1], 1); drawStrip($('sampleStrip'), sl[1], 0);
    S._demo = null; bgCache.clear(); _scCache.clear();
  } catch (e) { }
}
['dragover', 'dragenter'].forEach(ev => document.addEventListener(ev, e => { e.preventDefault(); $('drop').classList.add('over'); }));
['dragleave', 'drop'].forEach(ev => document.addEventListener(ev, e => { e.preventDefault(); $('drop').classList.remove('over'); }));
document.addEventListener('drop', e => { const f = e.dataTransfer.files[0]; if (f) loadFile(f); });

// ---------- 文字編輯：所見即所得，選字直接點顏色 ----------
const ed = $('ed');
const escH = t => t.replace(/[&<>"]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));
function edColor(c, T) {
  let col = !c || c === 'red' ? '#FF6B5E' : c === 'accent' ? T.accent : c;
  if (c && c !== 'red' && lumOf(col) < .42) col = mixHex(col, '#FFFFFF', .45);   // 編輯框是深色底，太暗的顏色稍微提亮才看得到
  return col;
}
function mixHex(a, b, k) { const p = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)), A = p(a), B = p(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * k).toString(16).padStart(2, '0')).join(''); }
function edRender() {
  const sl = S.slides[S.sel]; if (!sl) return; const T = curTheme(sl);
  const og = useOrig(sl); document.querySelectorAll('#colorBar [data-ps], #colorBar .cbsep').forEach(b => b.hidden = og);
  if (!edRender._hint) edRender._hint = $('edHint').textContent;
  // Keynote 原樣頁面：右邊只留一句說明，文字清單要用再打開
  $('edSimple').hidden = !og; ed.hidden = og && !S.edCards; $('edHint').hidden = og;
  if (og) {
    $('edSimpleTxt').textContent = S.view === 'strip' ? '字條的文字會跟著現場版。要改字，切到「現場版」，在投影片上點兩下。' : '在投影片上點兩下，就能直接改字。要換顏色，先選取字，再按上面的顏色。';
    $('edToggle').textContent = S.edCards ? '收起文字清單' : '用文字清單改';
    ed.innerHTML = origEdRender(sl); $('accSw').style.background = origColors(sl).ac || T.accent; return;
  }
  $('edHint').textContent = edRender._hint;
  const v = autoVariant(sl, S.sel), hr = liveOpts(v === 'title', v, sl).headRule;
  ed.innerHTML = sl.paras.map((p, pi) => {
    const isH = p[0] && p[0].ps ? p[0].ps === 'h' : hr(pi, sl.paras);
    const h = p.map(r => { const t = escH(r.t).replace(/↵/g, '\n'); return r.red ? `<span data-c="${r.c || 'red'}" style="color:${edColor(r.c, T)}">${t}</span>` : t; }).join('');
    return `<div${isH ? ' data-ps="h"' : ''}>` + (h.trim() ? h : '<br>') + '</div>';
  }).join('');
  $('accSw').style.background = curTheme(sl).accent;
}
function edParse() {
  const paras = []; let cur = [];
  const push = (t, c) => {
    if (!t) return; const red = !!c, cc = c && c !== 'red' ? c : undefined, last = cur[cur.length - 1];
    if (last && last.red === red && last.c === cc) last.t += t; else cur.push(cc ? { t, red, c: cc } : { t, red });
  };
  const flush = () => {
    cur.forEach(r => { r.t = r.t.replace(/\u00a0/g, ' '); });
    while (cur.length && /^↵/.test(cur[0].t)) { cur[0].t = cur[0].t.slice(1); if (!cur[0].t) cur.shift(); }
    while (cur.length && /↵$/.test(cur[cur.length - 1].t)) { const l = cur[cur.length - 1]; l.t = l.t.slice(0, -1); if (!l.t) cur.pop(); }
    if (cur.map(r => r.t).join('').replace(/[↵\s]/g, '')) paras.push(cur); cur = [];
  };
  const walk = (n, c) => {
    if (n.nodeType === 3) return push(n.nodeValue.replace(/\n/g, '↵'), c);
    if (n.nodeType !== 1) return;
    if (n.nodeName === 'BR') return push('↵', c);
    const block = /^(DIV|P|LI|H\d)$/.test(n.nodeName), cc = n.dataset && 'c' in n.dataset ? (n.dataset.c || null) : c;
    if (block) flush();
    n.childNodes.forEach(k => walk(k, cc));
    if (block) { if (cur.length) cur[0].ps = n.dataset.ps === 'h' ? 'h' : 'b'; flush(); }
  };
  ed.childNodes.forEach(n => walk(n, null)); flush();
  return paras;
}
let edRange = null;
document.addEventListener('selectionchange', () => { const s = getSelection(); if (s.rangeCount && ed.contains(s.anchorNode) && !s.isCollapsed) edRange = s.getRangeAt(0).cloneRange(); });
function colorText(c) {
  {
    const slO = S.slides[S.sel], ov = [$('inEd'), $('pEd')].find(x => x && !x.hidden && x.contains(getSelection().anchorNode));
  if (ov) {   // 投影片上直接編輯時
      const Tt = curTheme(slO), hex = ov.id === 'inEd' ? origHex(slO, c) : c === 'red' ? Tt.red : c === 'accent' ? Tt.accent : c ? c : Tt.text;
      document.execCommand('styleWithCSS', false, true); document.execCommand('foreColor', false, hex); ov.dispatchEvent(new Event('input')); return;
    }  }
  const s = getSelection(); let r = s.rangeCount && ed.contains(s.anchorNode) && !s.isCollapsed ? s.getRangeAt(0) : edRange;
  if (!r || r.collapsed || !ed.contains(r.commonAncestorContainer)) { toast('先在文字框裡選取要改顏色的字'); return; }
  const slO = S.slides[S.sel];

  if (useOrig(slO)) {   // 原樣頁面：直接把選取的字換顏色；「一般」＝那一段原本最多字的顏色
    const T = curTheme(slO), st0 = r.startContainer.nodeType === 1 ? r.startContainer : r.startContainer.parentElement, sec = st0 && st0.closest('section'), it = sec && slO.orig.items[+sec.dataset.ob];
    const hex = origHex(slO, c);
    s.removeAllRanges(); s.addRange(r); document.execCommand('styleWithCSS', false, true); document.execCommand('foreColor', false, hex);
    ed.dispatchEvent(new Event('input')); return;
  }
  const r2 = r.cloneRange(); r2.collapse(false); r2.insertNode(document.createTextNode('\uE001'));
  const r1 = r.cloneRange(); r1.collapse(true); r1.insertNode(document.createTextNode('\uE000'));
  let on = false, sel = null; const out = [];
  edParse().forEach((p, pi) => {
    const ch = []; p.forEach(run => { for (const x of run.t) {
      if (x === '\uE000') { on = true; sel = sel || { a: [out.length, ch.length] }; continue; }
      if (x === '\uE001') { on = false; if (sel) sel.b = [out.length, ch.length]; continue; }
      ch.push(on ? { x, red: !!c, c: c && c !== 'red' ? c : undefined } : { x, red: run.red, c: run.c });
    } });
    const runs = []; ch.forEach(k => { const l = runs[runs.length - 1]; if (l && l.red === k.red && l.c === k.c) l.t += k.x; else runs.push(k.c ? { t: k.x, red: k.red, c: k.c } : { t: k.x, red: k.red }); });
    if (runs.length) { if (p[0] && p[0].ps) runs[0].ps = p[0].ps; out.push(runs); }
  });
  const sl = S.slides[S.sel], n0 = sl.paras.length; sl.paras = out.length ? out : [[{ t: ' ', red: false }]]; if (sl.paras.length !== n0) delete sl.pp;
  edRender(); edSelect(sel); redrawSoon();
}
function edSelect(sel) {
  if (!sel || !sel.b) return;
  const pos = ([pi, ci]) => {
    const div = ed.children[pi]; if (!div) return null; let left = ci, found = null;
    const walk = n => { if (found) return; if (n.nodeType === 3) { if (left <= n.nodeValue.length) { found = [n, left]; return; } left -= n.nodeValue.length; } else if (n.nodeName === 'BR') { if (left === 0) { found = [n.parentNode, [...n.parentNode.childNodes].indexOf(n)]; return; } left -= 1; } else n.childNodes.forEach(walk); };
    walk(div); return found;
  };
  const a = pos(sel.a), b = pos(sel.b); if (!a || !b) return;
  const r = document.createRange(); r.setStart(a[0], a[1]); r.setEnd(b[0], b[1]); const s = getSelection(); s.removeAllRanges(); s.addRange(r); edRange = r.cloneRange();
}
ed.addEventListener('input', async () => {
  const sl = S.slides[S.sel]; if (!sl) return;
  if (useOrig(sl)) { origEdApply(sl); if (await ensureFonts()) buildList(); redrawSoon(); return; }
  const n0 = sl.paras.length; sl.paras = edParse(); if (!sl.paras.length) sl.paras = [[{ t: ' ', red: false }]]; if (sl.paras.length !== n0) delete sl.pp;
  if (await ensureFonts()) buildList();
  redrawSoon();
});
ed.addEventListener('paste', e => {
  e.preventDefault(); const t = (e.clipboardData || window.clipboardData).getData('text/plain').replace(/\r/g, '');
  t.split('\n').forEach((line, i) => { if (i) document.execCommand('insertParagraph'); if (line) document.execCommand('insertText', false, line); });
});
document.querySelectorAll('#colorBar [data-c]').forEach(b => { b.onmousedown = e => e.preventDefault(); b.onclick = () => colorText(b.dataset.c || null); });
$('pickColor').onchange = () => colorText($('pickColor').value.toUpperCase());
// 段落樣式：把游標所在（或選取到）的段落設成標題或內文
function setParaStyle(ps) {
  const s = getSelection(); let r = s.rangeCount && ed.contains(s.anchorNode) ? s.getRangeAt(0) : edRange;
  if (!r || !ed.contains(r.startContainer)) { toast('先在文字框裡點一下要改的那一段'); return; }
  const top = n => { while (n && n.parentNode !== ed) n = n.parentNode; return n; };
  const a = top(r.startContainer), b = top(r.endContainer); if (!a) return;
  const kids = [...ed.children]; let on = false;
  kids.forEach(d => { if (d === a) on = true; if (on) { if (ps === 'h') d.dataset.ps = 'h'; else delete d.dataset.ps; } if (d === (b || a)) on = false; });
  ed.dispatchEvent(new Event('input'));
}
document.querySelectorAll('#colorBar [data-ps]').forEach(b => { b.onmousedown = e => e.preventDefault(); b.onclick = () => setParaStyle(b.dataset.ps); });
$('btnAdd').onclick = () => { S.slides.splice(S.sel + 1, 0, { paras: [[{ t: '新的一頁', red: false }]], fs: 1, sfs: 1 }); buildList(); select(S.sel + 1); save(); };
$('btnDup').onclick = () => { S.slides.splice(S.sel + 1, 0, JSON.parse(JSON.stringify(S.slides[S.sel]))); buildList(); select(S.sel + 1); save(); };
$('btnDel').onclick = () => {
  if (S.slides.length < 2) { toast('至少要留一頁'); return; }
  const th = document.querySelectorAll('.thumb')[S.sel], done = () => { S.slides.splice(S.sel, 1); buildList(); select(Math.min(S.sel, S.slides.length - 1)); save(); toast('已刪除這一頁'); };
  if (th && !matchMedia('(prefers-reduced-motion: reduce)').matches) { th.classList.add('leaving'); setTimeout(done, 180); } else done();
};
$('lvSize').oninput = () => setLay('lvSize', $('lvSize').value / 100);
$('lvGap').oninput = () => setLay('lvGap', $('lvGap').value * LN);
$('svSize').oninput = () => setLay('svSize', $('svSize').value / 100);
$('svGap').oninput = () => setLay('svGap', $('svGap').value * LN);
document.querySelectorAll('#layScope button').forEach(b => b.onclick = () => { S.layScope = b.dataset.s; syncOut(); });
$('stripY').oninput = () => { S.stripY = +$('stripY').value; syncOut(); redrawSoon(); };
$('stripW').oninput = () => { setStripW($('stripW').value / 100); };
$('stripW').onchange = () => buildList();
const expFail = e => { console.error(e); $('prog').style.display = 'none'; toast('匯出失敗：' + e.message); };
function closeExp() { $('expMenu').hidden = true; $('btnExport').setAttribute('aria-expanded', 'false'); }
$('btnExport').onclick = () => exportAll('pptx').catch(expFail);   // 一個按鈕：現場版、線上版各一個 pptx
document.addEventListener('click', e => { if (!$('expMenu').hidden && !e.target.closest('.expwrap')) closeExp(); });
document.querySelectorAll('#expMenu button').forEach(b => b.onclick = () => {
  closeExp(); const f = b.dataset.f;
  if (f === 'zip') return exportAll('zip').catch(expFail);
  S.exportFmt = f; save(); exportByFormat().catch(expFail);
});

$('btnBg').onclick = () => $('bgFile').click();
$('bgFile').onchange = e => {
  const f = e.target.files[0]; if (!f) return; const im = new Image();
  im.onload = () => { S.custom = im; S.bgAll = null; syncBgUi(); afterThemeChange(); saveBg(); };
  im.src = URL.createObjectURL(f); e.target.value = '';
};
$('btnBgClear').onclick = () => clearCustom();
document.querySelectorAll('#bgMode .pill').forEach(b => b.onclick = () => {
  S.customMode = b.dataset.m; S.customDim = null; syncBgUi(); afterThemeChange(); saveBg();
});
$('bgDim').oninput = () => { S.customDim = $('bgDim').value / 100; syncBgUi(); bgCache.clear(); redrawSoon(); saveBg(); };
syncBgUi();

// ---------- 背景分頁：整份簡報／只有這一頁 ----------
const SW = ['#FFFFFF', '#F4EFE6', '#E6E8EB', '#2A2C30', '#111214'];
function markBgSel() {
  const sl = S.slides[S.sel], b = sl && sl.bg, slideMode = S.bgScope === 'slide', cur = slideMode ? b : S.bgAll;
  document.querySelectorAll('#themes .tcard').forEach(x => x.classList.toggle('sel', slideMode ? !!(b && b.t === 'theme' && b.k === x.dataset.k) : (!S.custom && !S.bgAll && S.themeKey === x.dataset.k)));
  document.querySelectorAll('#bgSwatches .sw').forEach(x => x.classList.toggle('sel', !!(cur && cur.t === 'color' && cur.c.toLowerCase() === x.dataset.c.toLowerCase())));
}
function syncSlideBgUI() {
  const slideMode = S.bgScope === 'slide', sl = S.slides[S.sel]; if (!$('bgScope')) return;
  document.querySelectorAll('#bgScope button').forEach(x => x.classList.toggle('on', x.dataset.s === S.bgScope)); $('pBg').classList.toggle('allscope', !slideMode); if (typeof renderTplUI === 'function') renderTplUI();
  $('scopeSlideBtn').textContent = sl ? `只有第 ${S.sel + 1} 頁` : '只有這一頁';
  $('scopeHint').textContent = slideMode ? `下面的選擇只會改第 ${S.sel + 1} 頁，其他頁不變。` : '想讓某一頁換成模板的另一頁、純色或自己的圖，先點左邊那一頁，再按「只有這一頁」。';
  $('bgVaryRow').hidden = slideMode || tplOn(); $('bgLayoutRow').hidden = !slideMode; $('slBgPick').textContent = sl ? `只用在第 ${S.sel + 1} 頁…` : '只用在這一頁…'; $('slBgTitle').textContent = `第 ${S.sel + 1} 頁用自己的圖`;
  $('bgResetRow').hidden = !(slideMode && sl && (sl.bg || sl.tplPage != null));
  $('optVary').checked = S.autoVary !== false;
  const b = sl && sl.bg; $('slBgImg').hidden = !(b && b.t === 'img'); if (typeof renderPhotos === 'function' && $('photoList')) renderPhotos();
  if (b && b.t === 'img') {
    const part = !!BAND[b.area], d = Math.round((b.dim == null ? (part ? 0 : .45) : b.dim) * 100); $('slBgDim').value = d; $('slBgDimO').textContent = d + '%';
    document.querySelectorAll('#slBgArea .pill').forEach(x => x.classList.toggle('sel', (b.area || 'full') === x.dataset.a));
    const z = Math.round((b.z || 1) * 100), px = Math.round((b.px == null ? .5 : b.px) * 100), py = Math.round((b.py == null ? .5 : b.py) * 100);
    $('slBgZ').value = z; $('slBgZO').textContent = z + '%'; $('slBgX').value = px; $('slBgXO').textContent = px; $('slBgY').value = py; $('slBgYO').textContent = py;
    setTimeout(() => document.querySelectorAll('#slBgImg input[type=range]').forEach(paintRange), 0);
  }
  markBgSel();
}
function setSlideBg(b) {
  const sl = S.slides[S.sel]; if (!sl) return;
  if (b) sl.bg = b; else delete sl.bg;
  syncSlideBgUI(); renderMain(); renderThumb(S.sel); save();
}
function applyTheme(k) {
  if (S.bgScope === 'slide') return setSlideBg({ t: 'theme', k });
  S.themeKey = k; S.bgAll = null; clearCustom(false); if (S.tpl && S.tpl.on) { S.tpl.on = false; renderTplUI(); tplDB.set('tpl', S.tpl).catch(() => { }); }
  ensureFonts().then(() => { loadedChars.clear(); return ensureFonts(); }).then(afterThemeChange);
}
function applyColor(c) {
  if (S.bgScope === 'slide') return setSlideBg({ t: 'color', c });
  S.bgAll = { t: 'color', c }; clearCustom(false); afterThemeChange();
}
(function buildPlain() {
  const box = $('plainSw'); if (!box) return;
  [['', '白', '#FFFFFF'], ['#F3EEE3', '米白', '#F3EEE3'], ['#24262B', '深灰', '#24262B'], ['#1F3A36', '墨綠', '#1F3A36']].forEach(([c, name, show]) => {
    const b = document.createElement('button'); b.className = 'sw'; b.dataset.c = c; b.style.background = show; b.title = name + '底'; b.setAttribute('aria-label', name + '底');
    b.onclick = () => { S.plain = c || null; renderTplUI(); afterThemeChange(); }; box.appendChild(b);
  });
})();
(function buildBgPanel() {
  const box = $('bgSwatches');
  SW.forEach(c => { const b = document.createElement('button'); b.className = 'sw'; b.dataset.c = c; b.style.background = c; b.title = c; b.onclick = () => applyColor(c); box.appendChild(b); });
  const pick = document.createElement('input'); pick.type = 'color'; pick.value = '#F4EFE6'; pick.title = '自選顏色'; pick.onchange = () => applyColor(pick.value); box.appendChild(pick);
  document.querySelectorAll('#bgScope button').forEach(b => b.onclick = () => { S.bgScope = b.dataset.s; syncSlideBgUI(); });
  $('slBgReset').onclick = () => { delete S.slides[S.sel].tplPage; setSlideBg(null); afterTplChange(); };
  $('slBgPick').onclick = () => $('slBgFile').click();
  $('slBgRemove').onclick = () => setSlideBg(null);
  $('slBgFile').onchange = e => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    const im = new Image();
    im.onload = async () => {
      // 保留整張圖（只縮小、不裁切），之後才能自己選要取哪一塊
      const sc = Math.min(1, 1600 / Math.max(im.width, im.height)), c = mk(Math.round(im.width * sc), Math.round(im.height * sc)), x = c.getContext('2d');
      x.drawImage(im, 0, 0, c.width, c.height);
      const src = c.toDataURL('image/jpeg', .8); await loadBgImg(src);
      const cur = S.slides[S.sel].bg, keep = cur && cur.t === 'img' ? cur : {};
      setSlideBg({ t: 'img', src, dim: keep.dim != null ? keep.dim : .45, area: keep.area || 'full', z: 1, px: .5, py: .5 });
    };
    im.src = URL.createObjectURL(f);
  };
  const bgEdit = fn => { const sl = S.slides[S.sel]; if (!sl || !sl.bg || sl.bg.t !== 'img') return; fn(sl.bg); bgCache.clear(); _scCache.clear(); _deck.sig = ''; syncSlideBgUI(); redrawSoon(); };
  document.querySelectorAll('#slBgArea .pill').forEach(x => x.onclick = () => bgEdit(b => { const was = !!BAND[b.area]; b.area = x.dataset.a; const now = !!BAND[b.area]; if (was !== now) b.dim = now ? 0 : .45; }));
  $('slBgZ').oninput = () => bgEdit(b => { b.z = $('slBgZ').value / 100; });
  $('slBgX').oninput = () => bgEdit(b => { b.px = $('slBgX').value / 100; });
  $('slBgY').oninput = () => bgEdit(b => { b.py = $('slBgY').value / 100; });
  $('slBgDim').oninput = () => { const sl = S.slides[S.sel]; if (sl.bg && sl.bg.t === 'img') { sl.bg.dim = $('slBgDim').value / 100; $('slBgDimO').textContent = $('slBgDim').value + '%'; redrawSoon(); } };
  $('optShadow').onchange = () => { S.shadow = $('optShadow').checked; redrawSoon(); };
  $('optBlocks').onchange = () => { S.blocks = $('optBlocks').checked; redrawSoon(); };
  $('optDash').onchange = () => { S.dashRef = $('optDash').checked; _deck.sig = ''; wcache.clear(); redrawSoon(); buildList(); };
  $('optVary').onchange = () => { S.autoVary = $('optVary').checked; bgCache.clear(); redrawSoon(); buildList(); syncVariantUI(); save(); };
})();

// ---------- 強調頁照片庫 ----------
function savePhotos() { try { localStorage.setItem('ppt-web-photos', JSON.stringify(S.photos)); } catch (e) { toast('照片太多，瀏覽器存不下；重新整理後最後幾張可能會消失'); } }
function renderPhotos() {
  const box = $('photoList'); box.innerHTML = '';
  S.photos.forEach((src, i) => {
    const sl = S.slides[S.sel], d = document.createElement('div'); d.className = 'ph' + (sl && sl.spotSrc === src ? ' sel' : ''); d.title = '點一下：這一頁用這張照片當強調頁';
    const im = new Image(); im.src = src; d.appendChild(im);
    im.onclick = () => { const s2 = S.slides[S.sel]; if (!s2) return; s2.spotSrc = src; s2.variant = 'spot'; afterSpotChange(); };
    const x = document.createElement('button'); x.className = 'phx'; x.textContent = '×'; x.title = '移除這張照片'; x.onclick = e => { e.stopPropagation(); S.slides.forEach(z => { if (z.spotSrc === src) delete z.spotSrc; }); S.photos.splice(i, 1); savePhotos(); afterSpotChange(); };
    d.appendChild(x); box.appendChild(d);
  });
  $('photoHint').textContent = S.photos.length ? '點照片，就會把左邊選中的這一頁變成用這張照片的強調頁。' : '還沒有照片，強調頁會用內建的光影（深色背景＋光暈）。';
  syncSpotUI();
}
function syncSpotUI() {
  const sl = S.slides[S.sel]; if (!$('spotList')) return;
  const pl = planVariants(), list = pl.map((v, i) => v === 'spot' ? i : -1).filter(i => i >= 0);
  const box = $('spotList'); box.innerHTML = '';
  const lead = document.createElement('span'); lead.textContent = list.length ? '目前的強調頁：' : '目前沒有強調頁。'; box.appendChild(lead);
  list.forEach(i => { const b = document.createElement('button'); b.className = 'link'; b.textContent = `第 ${i + 1} 頁`; b.onclick = () => select(i); box.appendChild(b); });
  const on = sl && autoVariant(sl, S.sel) === 'spot';
  $('btnSpotToggle').textContent = sl ? (on ? `第 ${S.sel + 1} 頁取消強調頁` : `第 ${S.sel + 1} 頁設成強調頁`) : '設成強調頁';
}
function afterSpotChange() { bgCache.clear(); _scCache.clear(); _deck.sig = ''; renderPhotos(); buildList(); renderMain(); syncVariantUI(); save(); }
$('btnSpotToggle').onclick = () => {
  const sl = S.slides[S.sel]; if (!sl) return;
  if (autoVariant(sl, S.sel) === 'spot') { sl.variant = 'plain'; delete sl.spotSrc; } else sl.variant = 'spot';
  afterSpotChange();
};
$('btnPhotos').onclick = () => $('photoFile').click();
$('photoFile').onchange = async e => {
  const fs = [...e.target.files].slice(0, 8); e.target.value = '';
  for (const f of fs) {
    const src = await new Promise(res => { const im = new Image(); im.onload = () => { const sc = Math.min(1, 1600 / Math.max(im.width, im.height)), c = mk(Math.round(im.width * sc), Math.round(im.height * sc)); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); res(c.toDataURL('image/jpeg', .8)); }; im.onerror = () => res(null); im.src = URL.createObjectURL(f); });
    if (src) { await loadBgImg(src); S.photos.push(src); }
  }
  savePhotos(); renderPhotos(); afterThemeChange();
  if (false) toast('照片已加入。目前沒有強調頁，可以在「背景」切到「只有這一頁」，把版面換成「深色強調」。');
};
async function loadPhotos() { try { S.photos = JSON.parse(localStorage.getItem('ppt-web-photos') || '[]'); await Promise.all(S.photos.map(loadBgImg)); } catch (e) { S.photos = []; } renderPhotos(); }

// ---------- 模板：把 Slidesgo 等模板的頁面當背景，講道文字放進原本的文字框 ----------
const tplImgs = [];
const tplOn = () => !!(S.tpl && S.tpl.on && S.tpl.pages && S.tpl.pages.length);
const tplImg = i => tplImgs[i] || null;
function tplUsable() { return S.tpl.pages.map((p, i) => p.use ? i : -1).filter(i => i >= 0); }
function tplTheme() {
  const pg = S.tpl.pages[tplUsable()[1] ?? tplUsable()[0] ?? 0], dark = pg.lum < .5;
  return { key: 'tpl:' + S.tpl.name + ':' + tplUsable().join(','), name: S.tpl.name, tpl: true, flat: true, dark, text: dark ? '#FFFFFF' : '#1F1A17', red: dark ? '#FFB3A0' : '#C0392B', accent: pg.accent, card: { fill: dark ? '#1C1C1E' : pg.light, alpha: .92, radius: 12, grain: false, deco: 'none' }, bg(c) { const im = tplImg(S.tpl.pages.indexOf(pg)); if (im) c.drawImage(im, 0, 0, W, H); } };
}
// 每一頁講道內容配一頁模板：封面給第一頁；標題＋內文配有兩個文字框的頁面；短句配章節頁；相鄰頁不重複
let _tplPlan = { sig: '', v: [] };
function tplPageIdx(idx) {
  const use = tplUsable(), sig = S.tpl.name + use.join(',') + '|' + S.slides.map(s => (s.tplPage ?? '') + s.paras.map(ptext).join('/')).join('#');
  if (sig !== _tplPlan.sig) {
    const P = S.tpl.pages, by = k => use.filter(i => P[i].kind === k), cover = by('cover'), content = by('content'), section = by('section');
    const cnt = {}, out = [];
    S.slides.forEach((sl, i) => {
      if (sl.tplPage != null && P[sl.tplPage]) { out.push(sl.tplPage); return; }
      const ps = sl.paras.map(ptext).map(x => x.trim()).filter(Boolean), chars = ps.join('').length, headBody = ps.length > 1 && ps[0].length <= 30;
      let c = i === 0 ? (cover.length ? cover : content) : chars <= 34 && ps.length <= 2 ? (section.length ? section : content) : headBody ? content.filter(k => P[k].title && P[k].body) : content.concat(section).filter(k => P[k].body || P[k].title);
      if (!c.length) c = use.length ? use : [0];
      const prev = out[i - 1], pool = c.filter(k => k !== prev).length ? c.filter(k => k !== prev) : c;
      const k = pool.reduce((a, b) => (cnt[b] || 0) < (cnt[a] || 0) ? b : a); cnt[k] = (cnt[k] || 0) + 1; out.push(k);
    });
    _tplPlan = { sig, v: out };
  }
  return _tplPlan.v[idx] ?? (tplUsable().find(i => S.tpl.pages[i].kind === 'content') ?? tplUsable()[0] ?? 0);
}
function fitRegion(paras, r, o, maxS, minS) {
  let size = maxS, lines;
  for (; size >= minS; size -= 2) { lines = layout(paras, size, r.w, o); if (blockH(lines, o) <= r.h) return { lines, size, fit: true }; }
  return { lines: layout(paras, minS, r.w, o), size: minS, fit: false };
}
// 套模板時整份內文字級一致：先算每頁放得下的內文字級，取中位數，太大的頁面往下對齊
let _tplDeck = { sig: '', v: 0 };
function tplDeckSize() {
  tplPageIdx(0);
  const sig = _tplPlan.sig + '|' + S.deckScale + '|' + (S.lineGap || '') + JSON.stringify(S.fonts) + S.slides.map(s => (s.fs || 1) + '/' + (s.lg || '') + '/' + (s.bg ? 1 : 0)).join(',');
  if (sig === _tplDeck.sig) return _tplDeck.v;
  _tplDeck = { sig, v: 0 };
  const c = mk(W, H), sizes = [];
  S.slides.forEach((sl, i) => { if (i === 0 || sl.bg) return; const r = drawTplSlide(c, sl, i, true, true); if (r.bodySize) sizes.push(r.bodySize / (sl.fs || 1)); });
  sizes.sort((a, b) => a - b);
  _tplDeck.v = sizes.length ? sizes[Math.floor(sizes.length / 2)] : 0; return _tplDeck.v;
}
function drawTplSlide(cv, slide, idx, noText, dry) {
  tagParas(slide); const rec = [], ppo = ppOpts(slide, 'l');
  const c = cv.getContext('2d'), pi = tplPageIdx(idx), pg = S.tpl.pages[pi], L = liveCfg(slide, false, 'plain');
  c.clearRect(0, 0, W, H); c.drawImage(getBg('tpl', idx, slide), 0, 0); drawBand(c, slide);
  const bd = bandOf(slide), fx0 = bd && bd.left ? bd.w + 80 : 0, fx1 = bd && !bd.left ? bd.x - 80 : W;   // 圖片佔掉的那一側，文字不放
  const clipR = r => { if (!r || !bd) return r; const a = Math.max(r.x, fx0), b2 = Math.min(r.x + r.w, fx1); return Object.assign({}, r, { x: a, w: Math.max(240, b2 - a) }); };
  (slide.pics || []).forEach(p => { const e = imgCache.get(p.src); if (!e) return; const im = e.im, cr = p.crop || { l: 0, t: 0, r: 0, b: 0 }; c.save(); if (!p.free) { c.shadowColor = 'rgba(0,0,0,.28)'; c.shadowBlur = 26; c.shadowOffsetY = 8; } c.drawImage(im, im.width * cr.l, im.height * cr.t, im.width * (1 - cr.l - cr.r), im.height * (1 - cr.t - cr.b), p.x * W, p.y * H, p.w * W, p.h * H); c.restore(); });
  const colorFor = r => { const dark = (r ? r.lum : pg.lum) < .5; return { text: dark ? '#FFFFFF' : '#1F1A17', red: dark ? '#FFB3A0' : '#C0392B', accent: pg.accent, dark }; };
  const pad = r => r && { x: r.x + 12 + L.dx, y: r.y + 8 + L.dy, w: Math.max(200, r.w - 24), h: Math.max(80, r.h - 16), align: r.align, anchor: r.anchor, lum: r.lum };
  // 文字放不下時把文字框往右、往下撐大，但不能蓋到模板上的圖片和圖形
  const occ = (pg.occ || []).filter(o => !(o.x <= (pg.title || {}).x && o.y <= (pg.title || {}).y && o.x + o.w >= ((pg.title || {}).x + (pg.title || {}).w)));
  const hits = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  const grow = r => {
    let w = Math.max(r.w, W - r.x - 110), h = Math.max(r.h, H - r.y - 90);
    for (const o of occ) { if (hits(r, o)) continue; const cand = { x: r.x, y: r.y, w, h }; if (!hits(cand, o)) continue; if (o.x >= r.x + r.w - 20) w = Math.min(w, o.x - 40 - r.x); else if (o.y >= r.y + r.h - 20) h = Math.min(h, o.y - 30 - r.y); }
    return clipR({ x: r.x, y: r.y, w: Math.max(r.w, w), h: Math.max(r.h, h), align: r.align, anchor: r.anchor, lum: r.lum });
  };
  const paras = S.dashRef !== false ? stripParas(slide, true).paras : slide.paras, ps = paras.map(ptext);
  let nh = 0; while (nh < paras.length - 1 && paras[nh][0] && paras[nh][0].ps === 'h') nh++;
  const hp = paras.slice(0, Math.max(1, nh)), rest = paras.slice(Math.max(1, nh));
  const headBody = paras.length > 1 && (nh > 0 || ps[0].trim().length <= 30);
  let tR = clipR(pad(pg.title)), bR = clipR(pad(pg.body));
  if (!tR && !bR) tR = clipR({ x: 160, y: 140, w: W - 320, h: H - 280, align: 'center', anchor: 'middle', lum: pg.lum });
  const scale = S.deckScale * (slide.fs || 1), gap = gapOf(slide), parts = [];
  const cap = dry ? 0 : tplDeckSize();
  const place = (pp, r, head, maxS, body) => {
    if (body && cap) maxS = Math.min(maxS, Math.round(cap * 1.12 / scale));
    const o = { headRule: head ? (pi2, all) => pi2 === 0 && all.length > 1 : () => false, headScale: 1.2, lineGap: gap, paraGap: .45, shadow: S.shadow, rec, ...ppo, hide: slide._editP };
    let f = fitRegion(pp, r, o, Math.round(maxS * scale), 40);
    if (!f.fit) { const g = grow(r), f2 = fitRegion(pp, g, o, Math.round(maxS * scale), 32); if (f2.size > f.size || f2.fit) { f = f2; r = g; } }
    const h = blockH(f.lines, o), y = r.anchor === 'middle' ? r.y + (r.h - h) / 2 : r.anchor === 'bottom' ? r.y + r.h - h : r.y;
    const align = L.align || (f.lines.length > 2 && paras.length > 1 && r.align === 'center' && pp.length > 1 ? 'left' : r.align);
    parts.push({ body: !!body, capped: f.size < Math.round(maxS * scale), lines: f.lines, x: r.x, y: Math.max(40, y), o, w: r.w, align, T: Object.assign({}, curTheme(slide), colorFor(r)), size: f.size });
  };
  if (headBody && tR && bR) { place(hp, tR, false, idx === 0 ? 110 : 90); place(rest, bR, false, 80, true); }
  else if (idx === 0 && tR) { place(hp, tR, false, 110); if (rest.length) place(rest, bR || grow({ x: tR.x, y: tR.y + tR.h + 20, w: tR.w, h: 200, align: tR.align, anchor: 'top', lum: tR.lum }), false, 60); }
  else place(paras, bR || tR, true, (bR ? 80 : 96), idx !== 0);
  if (!noText) parts.forEach(p => drawLines(c, p.lines, p.x, p.y, p.o, p.T, p.align, p.w));
  const main = parts[parts.length - 1], tb = drawTB(c, slide, 'l', main.T, noText);
  slide._autoAlign = main.align;
  const bp = parts.find(p => p.body);
  return { bodySize: bp ? bp.size : 0, shrunk: main.size < 44, capped: parts.some(p => p.capped), geo: { rec, tb, lines: main.lines, x: main.x, y: main.y, o: main.o, align: main.align, maxW: main.w, T: main.T, extra: parts.slice(0, -1).map(p => ({ lines: p.lines, x: p.x, y: p.y, o: p.o, w: p.w, T: p.T, align: p.align })) } };
}
async function loadTplImages() { tplImgs.length = 0; if (!S.tpl) return; await Promise.all(S.tpl.pages.map((p, i) => new Promise(r => { const im = new Image(); im.onload = () => { tplImgs[i] = im; r(); }; im.onerror = r; im.src = p.img; }))); }
function renderTplUI() {
  const has = !!S.tpl; $('tplBox').hidden = !has; $('tplNow').textContent = has ? `已經有模板：${S.tpl.name}（會自動套用）` : ''; $('tplBanner').hidden = has;
  $('btnPickTpl').textContent = has ? '換一個模板' : '上傳模板'; $('btnTpl').innerHTML = ic('image') + (has ? '換一個模板…' : '上傳模板 pptx…');
  $('tplHint').textContent = S.bgScope === 'slide' && S.slides[S.sel] ? `點縮圖，第 ${S.sel + 1} 頁就改用那一頁模板（橘框是目前用的）。` : '橘框的頁面會輪流當背景，點縮圖可以選用或不用。';
  const anyOrig = S.slides.some(x => x.orig), cur = S.slides[S.sel]; $('origRow').hidden = !anyOrig;
  if (anyOrig) { $('optOrig').checked = S.keepOrig !== false; $('origSlide').hidden = !(S.keepOrig !== false && cur && cur.orig); $('origSlide').textContent = cur && cur.noOrig ? `第 ${S.sel + 1} 頁改回 Keynote 原樣` : `第 ${S.sel + 1} 頁改用網站排版`; }
  $('tplSteps').hidden = has || anyOrig; $('plainRow').hidden = has || anyOrig; $('tplBanner').hidden = has || (anyOrig && S.keepOrig !== false);
  document.querySelectorAll('#plainSw .sw').forEach(b => b.classList.toggle('sel', (S.plain || '') === b.dataset.c));
  if (!has) return;
  $('tplName').textContent = S.tpl.name; $('tplOn').checked = !!S.tpl.on;
  const g = $('tplGrid'); g.innerHTML = '';
  S.tpl.pages.forEach((p, i) => {
    const one = S.bgScope === 'slide' && S.slides[S.sel], mine = one && tplOn() && tplPageIdx(S.sel) === i;
    const d = document.createElement('button'); d.className = 'tp' + ((one ? mine : p.use) ? ' on' : ''); d.title = one ? `第 ${S.sel + 1} 頁改用這一頁模板` : p.use ? '使用中，點一下不用這頁' : '沒用到，點一下改成使用';
    const im = new Image(); im.src = p.img; d.appendChild(im); const sp = document.createElement('span'); sp.textContent = { cover: '封面', content: '內容', section: '章節', free: '純圖', busy: '圖表' }[p.kind] || ''; d.appendChild(sp);
    d.onclick = () => { if (one) { S.slides[S.sel].tplPage = i; delete S.slides[S.sel].bg; save(); afterTplChange(); return; } p.use = !p.use; if (!tplUsable().length) { p.use = true; toast('至少要留一頁'); } afterTplChange(); }; g.appendChild(d);
  });
}
function afterTplChange() { _tplPlan.sig = ''; bgCache.clear(); _scCache.clear(); renderTplUI(); syncSlideBgUI(); if (!S.slides.length) renderEmptyPreview(); buildList(); renderMain(); tplDB.set('tpl', S.tpl).catch(() => toast('模板太大，瀏覽器存不下；重新整理後要重新上傳')); }
$('btnTpl').onclick = $('btnPickTpl').onclick = $('btnBannerTpl').onclick = () => $('tplFile').click();
$('tplFile').onchange = async e => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  try {
    prog('正在讀取模板…', 0);
    const t = await parseTemplate(await f.arrayBuffer(), f.name, (i, n) => prog(`正在讀取模板 第 ${i + 1} / ${n} 頁…`, i / n));
    $('prog').style.display = 'none';
    if (!t.pages.length) throw new Error('沒有頁面');
    S.tpl = Object.assign(t, { on: true }); await loadTplImages(); S._ripple = true; afterTplChange(); S._ripple = false;
    toast(`已套用模板「${t.name}」：${tplUsable().length} 頁會輪流當背景`);
  } catch (err) { console.error(err); $('prog').style.display = 'none'; toast('讀不到這個模板，請確認是 .pptx 檔'); }
};
$('tplOn').onchange = () => { S.tpl.on = $('tplOn').checked; afterTplChange(); buildThemes(); };
$('tplRemove').onclick = () => { S.tpl = null; tplImgs.length = 0; tplDB.del('tpl').catch(() => { }); afterTplChange(); };
async function loadSavedTpl() { try { const t = await tplDB.get('tpl'); if (t && t.pages) { S.tpl = t; await loadTplImages(); } } catch (e) { } renderTplUI(); }


// ---------- 圖片：直接在畫面上選取，拖曳移動、拉四個角縮放（像 PowerPoint） ----------
const picSel = document.createElement('div'); picSel.className = 'picsel'; picSel.hidden = true;
picSel.innerHTML = '<i data-h="nw"></i><i data-h="ne"></i><i data-h="sw"></i><i data-h="se"></i><span class="picbtns"><button class="picall" type="button" title="把這張圖放到每一頁的同一個位置">每一頁都放</button><button class="picdel" type="button">移除圖片</button></span>';
$('frameLive').appendChild(picSel);
let selPic = -1, picPinned = false;
const picKey = () => S.view === 'strip' ? 'spics' : 'pics', curPics = () => (S.slides[S.sel] || {})[picKey()] || [], curCv = () => $(S.view === 'strip' ? 'cvStrip' : 'cvLive');
function placePicSel(i) {
  const p = curPics()[i], fr = $(S.view === 'strip' ? 'frameStrip' : 'frameLive');
  if (!p) { picSel.hidden = true; selPic = -1; picPinned = false; return; }
  if (picSel.parentElement !== fr) fr.appendChild(picSel);
  picSel.querySelector('.picall').hidden = !p.free;
  selPic = i; Object.assign(picSel.style, { left: p.x * 100 + '%', top: p.y * 100 + '%', width: p.w * 100 + '%', height: p.h * 100 + '%' }); picSel.hidden = false;
}
function picAt(cx, cy) { const ps = curPics(); for (let i = ps.length - 1; i >= 0; i--) { const p = ps[i]; if (cx >= p.x * W && cx <= (p.x + p.w) * W && cy >= p.y * H && cy <= (p.y + p.h) * H) return i; } return -1; }
const cvL = $('cvLive'), toCvL = e => { const r = curCv().getBoundingClientRect(), k = W / r.width; return [(e.clientX - r.left) * k, (e.clientY - r.top) * k]; };
[cvL, $('cvStrip')].forEach(cvx => {
  cvx.addEventListener('pointermove', e => { if (picPinned || e.buttons) return; const i = picAt(...toCvL(e)); if (i >= 0) placePicSel(i); });
  cvx.addEventListener('pointerdown', () => { if (picPinned) { picPinned = false; picSel.hidden = true; picSel.classList.remove('pinned'); } });
});
picSel.addEventListener('pointerleave', () => { if (!picPinned) picSel.hidden = true; });
picSel.addEventListener('pointerdown', e => {
  if (e.target.tagName === 'BUTTON') return;
  e.preventDefault(); e.stopPropagation();
  const h = e.target.dataset.h || 'move', p = curPics()[selPic]; if (!p) return;
  picPinned = true; picSel.classList.add('pinned');
  const o = Object.assign({}, p), k = W / curCv().getBoundingClientRect().width, sx = e.clientX, sy = e.clientY;
  try { picSel.setPointerCapture(e.pointerId); } catch (err) { }
  const mv = ev => {
    const dx = (ev.clientX - sx) * k / W, dy = (ev.clientY - sy) * k / H;
    if (h === 'move') { p.x = clampN(o.x + dx, -o.w + .05, .95); p.y = clampN(o.y + dy, -o.h + .05, .95); }
    else {
      const sgn = h.includes('e') ? 1 : -1, nw = Math.max(.06, o.w + sgn * dx), nh = nw * o.h / o.w;
      p.w = nw; p.h = nh; if (h.includes('w')) p.x = o.x + (o.w - nw); if (h.includes('n')) p.y = o.y + (o.h - nh);
    }
    placePicSel(selPic); _deck.sig = ''; redrawSoon();
  };
  const up = () => { picSel.removeEventListener('pointermove', mv); picSel.removeEventListener('pointerup', up); renderThumb(S.sel); save(); };
  picSel.addEventListener('pointermove', mv); picSel.addEventListener('pointerup', up);
});
picSel.querySelector('.picdel').onclick = () => {
  const sl = S.slides[S.sel], key = picKey(); if (!sl || !sl[key] || selPic < 0) return;
  sl[key].splice(selPic, 1); if (!sl[key].length) delete sl[key]; picPinned = false; picSel.hidden = true;
  _deck.sig = ''; renderMain(); renderThumb(S.sel); save(); toast('已移除這張圖片');
};

picSel.querySelector('.picall').onclick = () => {
  const key = picKey(), p = curPics()[selPic]; if (!p) return; let n = 0;
  S.slides.forEach((x, i) => { if (i === S.sel) return; const list = x[key] = x[key] || []; if (!list.some(q => q.src === p.src && q.free)) { list.push(Object.assign({}, p)); n++; } else { const q = list.find(z => z.src === p.src && z.free); Object.assign(q, { x: p.x, y: p.y, w: p.w, h: p.h }); } });
  bgCache.clear(); buildList(); renderMain(); save(); toast(n ? `已經放到其他 ${n} 頁` : '其他頁的位置和大小也更新了');
};
// 加圖片／logo、加文字框：加到正在看的那個版本
async function addPicFile(f) {
  const sl = S.slides[S.sel]; if (!sl || !f) return;
  const raw = await new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = no; r.readAsDataURL(f); });
  const src = await shrinkImg(raw, f.type), e = await loadBgImg(src); if (!e) { toast('讀不到這張圖片'); return; }
  // 預設放在右上角（不蓋到文字），大小約畫面寬的 16%；太高的圖再縮小
  let w = .16, h = w * (e.im.height / e.im.width) * 16 / 9; if (h > .3) { w *= .3 / h; h = .3; }
  const key = picKey();
  (sl[key] = sl[key] || []).push({ src, x: .94 - w, y: S.view === 'strip' ? .45 : .06, w, h, free: true });
  _deck.sig = ''; renderMain(); renderThumb(S.sel); save(); placePicSel(sl[key].length - 1); picPinned = true; picSel.classList.add('pinned');
  toast('圖片加好了：拖曳移動，拉四個角縮放');
}
function addTextBox() {
  const sl = S.slides[S.sel]; if (!sl) return; const v = S.view === 'strip' ? 's' : 'l', id = Date.now().toString(36);
  const card = drawStrip.card, s = v === 's' ? 40 : 56;
  (sl.tb = sl.tb || []).push({ id, v, t: '文字', s, x: v === 's' && card ? card.x + 40 : W / 2 - s, y: v === 's' && card ? Math.max(20, card.y - s * 1.3 - 24) : H * .78 });
  renderMain(); save(); selPara(v, null, id); setTimeout(() => { const i = $('tbText'); i.focus(); i.select(); }, 60);
}
// ---------- 復原／重做：每次修改（停下來 0.3 秒後）存一個版本，最多 60 步 ----------
const HIST = { undo: [], redo: [], cur: null, sig: '', busy: false };
function stateSnap() {
  return { slides: structuredClone(S.slides), live: structuredClone(S.live), deckScale: S.deckScale, lineGap: S.lineGap, stripScale: S.stripScale, stripGap: S.stripGap, stripW: S.stripW, stripFixed: S.stripFixed, stripX: S.stripX, stripY: S.stripY, stripAlign: S.stripAlign, fonts: structuredClone(S.fonts), dashRef: S.dashRef, tplUse: S.tpl ? S.tpl.pages.map(p => p.use) : null };
}
const snapSig = st => JSON.stringify(st, (k, v) => k.startsWith('_') ? undefined : k === 'src' && typeof v === 'string' ? v.length : v);   // _開頭是畫面暫存，不算修改
function histReset() { HIST.undo = []; HIST.redo = []; HIST.cur = stateSnap(); HIST.sig = snapSig(HIST.cur); syncUndoUI(); }
function histCommit() {
  if (HIST.busy || HIST.hold || !S.slides.length) return;
  const st = stateSnap(), sig = snapSig(st); if (sig === HIST.sig) return;
  if (HIST.cur) { HIST.undo.push(HIST.cur); if (HIST.undo.length > 60) HIST.undo.shift(); }
  HIST.redo = []; HIST.cur = st; HIST.sig = sig; syncUndoUI();
}
function histApply(st) {
  HIST.busy = true;
  S.slides = structuredClone(st.slides); S.live = structuredClone(st.live); S.fonts = structuredClone(st.fonts);
  ['deckScale', 'lineGap', 'stripScale', 'stripGap', 'stripW', 'stripFixed', 'stripX', 'stripY', 'stripAlign', 'dashRef'].forEach(k => S[k] = st[k]);
  if (S.tpl && st.tplUse && st.tplUse.length === S.tpl.pages.length) S.tpl.pages.forEach((p, i) => p.use = st.tplUse[i]);
  HIST.cur = st; HIST.sig = snapSig(st);
  bgCache.clear(); _scCache.clear(); _deck.sig = ''; if (typeof _tplPlan !== 'undefined') _tplPlan.sig = ''; wcache.clear();
  buildFontSelects(); $('optDash').checked = S.dashRef !== false;
  buildList(); select(Math.min(S.sel, S.slides.length - 1)); if (typeof renderTplUI === 'function') renderTplUI();
  HIST.busy = false; syncUndoUI(); save();
}
function histUndo() { if (!HIST.undo.length) { toast('沒有可以復原的步驟'); return; } clearTimeout(saveT); histCommit(); if (!HIST.undo.length) return; HIST.redo.push(HIST.cur); histApply(HIST.undo.pop()); toast('已復原'); }
function histRedo() { if (!HIST.redo.length) return; HIST.undo.push(HIST.cur); histApply(HIST.redo.pop()); toast('已重做'); }
function syncUndoUI() { $('btnUndo').disabled = !HIST.undo.length; $('btnRedo').disabled = !HIST.redo.length; }
$('btnUndo').onclick = histUndo; $('btnRedo').onclick = histRedo;

// ---------- 線條圖示（同一套、同一粗細） ----------
const ICON = {
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>',
  redo: '<path d="m15 14 5-5-5-5"/><path d="M20 9H9a5 5 0 0 0 0 10h3"/>',
  upload: '<path d="M12 15V3"/><path d="m7 8 5-5 5 5"/><path d="M5 15v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4"/>',
  download: '<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 15v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4"/>',
  text: '<path d="M4 7V5h16v2"/><path d="M12 5v14"/><path d="M9 19h6"/>',
  layout: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/>',
  type: '<path d="M3 19 8 5l5 14"/><path d="M4.8 14h6.4"/><path d="M15 19v-6.5a2.5 2.5 0 0 1 5 0V19"/><path d="M15 15.5h5"/>',
  move: '<path d="M12 3v18"/><path d="M3 12h18"/><path d="m9 6 3-3 3 3"/><path d="m9 18 3 3 3-3"/><path d="m6 9-3 3 3 3"/><path d="m18 9 3 3-3 3"/>',
  plus: '<path d="M12 5v14"/><path d="M5 12h14"/>',
  copy: '<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M4 16V5a1 1 0 0 1 1-1h11"/>',
  trash: '<path d="M4 7h16"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13"/><path d="M9 7V4h6v3"/>',
  file: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 13h6"/><path d="M9 17h4"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-9 9"/>',
};
const ic = n => `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">${ICON[n]}</svg>`;
[['btnUndo', 'undo'], ['btnRedo', 'redo'], ['btnOpen', 'upload'], ['btnExport', 'download'], ['btnPick', 'upload'], ['btnSample', 'file'], ['btnBannerTpl', 'image'], ['btnTpl', 'image'], ['btnAdd', 'plus'], ['btnDup', 'copy'], ['btnDel', 'trash']].forEach(([id, n]) => { const b = $(id); if (b && !b.querySelector('.ic')) b.insertAdjacentHTML('afterbegin', ic(n)); });
document.querySelectorAll('.tabs button').forEach(b => { const n = { pText: 'text', pBg: 'layout', pLook: 'type', pPos: 'move' }[b.dataset.pane]; if (n && !b.querySelector('.ic')) b.insertAdjacentHTML('afterbegin', ic(n)); });
// 滑桿：已經拉到的那一段亮一點
function paintRange(r) { const min = +r.min || 0, max = +r.max || 100, v = +r.value; r.style.setProperty('--p', ((v - min) / (max - min) * 100) + '%'); }
document.querySelectorAll('input[type=range]').forEach(r => { paintRange(r); r.addEventListener('input', () => paintRange(r)); });
new MutationObserver(() => document.querySelectorAll('input[type=range]').forEach(paintRange)).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['hidden', 'class'] });

// ---------- 啟動：還原上次內容 ----------
$('fontHead').onchange = e => { S.fonts.head = e.target.value; afterFontChange(); };
$('fontBody').onchange = e => { S.fonts.body = e.target.value; afterFontChange(); };
$('fontScr').onchange = e => { S.fonts.scr = e.target.value; afterFontChange(); };
$('btnLocalAdd').onclick = async () => { const f = await addLocalFontByName($('localName').value); if (f && f.ok) { $('localName').value = ''; save(); } };
$('localName').onkeydown = e => { if (e.key === 'Enter') $('btnLocalAdd').click(); };
$('localFilter').oninput = renderLocalList;
if (!window.queryLocalFonts) $('btnLocalPick').hidden = true; else $('localName').placeholder = '或直接打字型名稱';
$('btnLocalPick').onclick = async () => {
  try { _localAll = await window.queryLocalFonts(); $('localFilter').hidden = false; renderLocalList(); }
  catch (e) { toast('沒有取得字型清單的權限，可以改用輸入名稱'); }
};
$('variantSel').onchange = () => { const sl = S.slides[S.sel]; sl.variant = $('variantSel').value; syncOut(); renderMain(); save(); };
document.querySelectorAll('#anchorRow .pill').forEach(b => b.onclick = () => { S.anchor = b.dataset.an; syncOut(); redrawSoon(); });
$('lvX').oninput = () => editLive('dx', +$('lvX').value);
$('lvY').oninput = () => editLive('dy', +$('lvY').value);
$('lvW').oninput = () => editLive('w', +$('lvW').value);
document.querySelectorAll('#lvAlign .pill').forEach(b => b.onclick = () => editLive('align', b.dataset.a));
document.querySelectorAll('.svAlign .pill').forEach(b => b.onclick = () => { const sl = S.slides[S.sel]; if (S.layScope === 'slide' && sl) { sl.sal = b.dataset.a; ppClear(sl, 's', true); } else { S.stripAlign = b.dataset.a; S.slides.forEach(x => { delete x.sal; ppClear(x, 's', true); }); } syncLiveUI(); redrawSoon(); });
$('lvReset').onclick = () => {
  const sl = S.slides[S.sel];
  if (S.layScope === 'slide' && sl) { delete sl.lv; delete sl.fs; delete sl.lg; ppClear(sl, 'l'); } else { S.slides.forEach(x => ppClear(x, 'l')); S.live = {}; S.deckScale = 1; S.lineGap = null; S.anchor = 'middle'; }
  _deck.sig = ''; syncLiveUI(); redrawSoon();
};
function setStripW(v) {
  const sl = S.slides[S.sel]; v = Math.max(.3, Math.min(.98, v));
  if (S.layScope === 'slide' && sl) sl.sw = v; else { S.stripW = v; S.stripFixed = true; }
  _scCache.clear(); S.page = 0; syncStripW(); redrawSoon();
}
function syncStripW() {
  const sl = S.slides[S.sel], own = S.layScope === 'slide' && sl && sl.sw, auto = !own && !S.stripFixed && !(sl && sl.sw && S.layScope === 'slide');
  const v = own ? sl.sw : S.stripW; $('stripW').value = Math.round(v * 100); $('stripWO').textContent = auto ? '自動' : Math.round(v * 100) + '%';
}
// 線上版：拖曳字條左右兩端可以直接拉長、縮短
function pickStripEdge(cx, cy) {
  const r = drawStrip.card; if (!r || S.view !== 'strip' || cy < r.y || cy > r.y + r.h) return null;
  const left = Math.abs(cx - r.x) < 28, right = Math.abs(cx - (r.x + r.w)) < 28; if (!left && !right) return null;
  const w0 = r.w;
  return { cursor: 'ew-resize', title: '拖曳可以調整字條長度', move(dx) { setStripW((w0 + (right ? dx : -dx) * 2) / W); } };
}
// 兩種版本都一樣：按住一段文字可以單獨拖動（靠近其他段的邊緣、中線會吸附），點一下選取後可以調大小
function paraBoxes(view) {
  return view === 'l' ? ((S.liveGeo && S.liveGeo.rec) || []) : (drawStrip.pos || []).map(p => ({ gid: p.l.gid, x: p.x, y: p.y, w: p.l.w, h: p.l.h, lx: p.lx, tw0: p.tw0 }));
}
function tbBoxes(view) { return (view === 'l' ? (S.liveGeo && S.liveGeo.tb) : drawStrip.tb) || []; }
function pickPara(view, cx, cy) {
  const sl = S.slides[S.sel]; if (!sl || S.view !== (view === 'l' ? 'live' : 'strip')) return null;
  const tbx = tbBoxes(view).find(q => cy >= q.y - 6 && cy <= q.y + q.h + 6 && cx >= q.x - 16 && cx <= q.x + q.w + 16);
  if (tbx) { const b0 = sl.tb.find(z => z.id === tbx.tb), o0 = { x: b0.x, y: b0.y };
    return { cursor: 'move', title: '拖曳移動這個文字框；點一下可以改字、調大小', move(dx, dy) { b0.x = Math.round(o0.x + dx); b0.y = Math.round(o0.y + dy); redrawSoon(); }, click() { selPara(view, null, tbx.tb); } }; }
  const boxes = paraBoxes(view), b = boxes.find(q => cy >= q.y && cy <= q.y + q.h && cx >= q.x - 24 && cx <= q.x + q.w + 24); if (!b) return null;
  const gid = b.gid, d0 = Object.assign({ x: 0, y: 0 }, ppOf(sl, view, gid)), targets = [];
  if (view === 's') { const card = drawStrip.card; targets.push(b.lx, b.lx + b.tw0 - b.w, card.x + (card.w - b.w) / 2); } else targets.push((W - b.w) / 2);
  boxes.forEach(q => { if (q.gid !== gid) targets.push(q.x, q.x + q.w - b.w); });
  return { cursor: 'move', title: '拖曳可以移動這一段；點一下可以調大小',
    move(dx, dy) {
      let x = b.x + dx; for (const t of targets) if (Math.abs(x - t) < 14) { x = t; break; }
      let ny = d0.y + dy; if (Math.abs(ny) < 12) ny = 0;   // 靠近原本的高度就吸回去，方便只做左右移動
      ppSet(sl, view, gid, { x: Math.round(d0.x + x - b.x), y: Math.round(ny) }); redrawSoon();
    },
    click() { selPara(view, gid); } };
}
let paraSel = null;
function selPara(view, gid, tb) {
  paraSel = view ? { view, gid, tb } : null; syncParaBar();
  // 原樣頁面：點投影片上的文字框，右邊對應的卡片亮起來
  ed.querySelectorAll('section.hot').forEach(x => x.classList.remove('hot'));
  if (typeof gid === 'string' && gid[0] === 'b') { const sec = ed.querySelector(`section[data-ob="${gid.slice(1)}"]`); if (sec) { sec.classList.add('hot'); sec.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } }
}
// 雙擊投影片上的文字框：就在投影片上改字（字型、大小、顏色跟投影片一樣）
function inlineClose() { const ov = $('inEd'); if (!ov || ov.hidden) return; ov.hidden = true; ov.innerHTML = ''; const sl = S.slides[S.sel]; if (sl) delete sl._editing; renderMain(); edRender(); save(); }
function inlineOpen(n, cx, cy) {
  const sl = S.slides[S.sel], it = sl && sl.orig && sl.orig.items[n], bx = sl && sl._box && sl._box[n]; if (!it || !bx || it.rot) return false;
  const frame = $('frameLive'), disp = frame.clientWidth / W, ov = $('inEd') || (() => { const d = document.createElement('div'); d.id = 'inEd'; d.contentEditable = 'true'; d.spellcheck = false; frame.appendChild(d);
    d.addEventListener('input', () => { const s2 = S.slides[S.sel]; if (s2 && s2._editing != null) { origEdApply(s2, d, s2._editing); renderMain(); redrawSoon(); setTimeout(editBar, 0); } });
    d.addEventListener('keydown', e => { if (e.key === 'Escape' || (e.key === 'Enter' && !e.shiftKey && !e.isComposing && e.keyCode !== 229)) { e.preventDefault(); d.blur(); if (d.id === 'inEd') inlineClose(); else pEdClose(); editBar(); } e.stopPropagation(); });   // Enter 完成（中文選字時的 Enter 不算），Shift+Enter 換行
    d.addEventListener('blur', () => setTimeout(() => { const a = document.activeElement; if (!d.contains(a) && !(a && a.closest && a.closest('#colorBar, #paraBar'))) { inlineClose(); editBar(); } }, 150));
    d.addEventListener('paste', e => { e.preventDefault(); const t = (e.clipboardData || window.clipboardData).getData('text/plain').replace(/\r/g, ''); t.split('\n').forEach((line, i) => { if (i) document.execCommand('insertParagraph'); if (line) document.execCommand('insertText', false, line); }); });
    return d; })();
  const k = bx.k, pk = bx.pk, px = v => (v * disp) + 'px';
  ov.innerHTML = it.paras.map((p, pi) => {
    const sz = (p.runs.length ? Math.max(...p.runs.map(r => r.size)) : (p.size || 18)) * k * pk, lh = p.lh.mode === 2 ? p.lh.amt * k * pk : p.lh.mode === 1 ? Math.max(p.lh.amt * k * pk, sz * NAT_LH) : sz * NAT_LH * (p.lh.amt || 1);
    const h = p.runs.map(r => `<span style="font:${r.w} ${px(r.size * k * pk)} ${famOf(r).ff.replace(/"/g, "'")};color:${r.c}">${escH(r.t).replace(/\n/g, '<br>')}</span>`).join('');
    return `<div style="text-align:${['left', 'right', 'center', 'justify', 'left'][p.align] || 'left'};line-height:${px(lh)};font-size:${px(sz)};margin-top:${pi ? px(p.sb * k * pk) : 0};margin-bottom:${px(p.sa * k * pk)}">${p.runs.some(r => r.t) ? h : '<br>'}</div>`;
  }).join('');
  Object.assign(ov.style, { left: bx.x / W * 100 + '%', top: bx.y / H * 100 + '%', width: px(bx.w + 2) });
  ov.hidden = false; sl._editing = n; renderMain(); ov.focus();
  const rg = document.caretRangeFromPoint && cx != null ? document.caretRangeFromPoint(cx, cy) : null, s2 = getSelection();
  if (rg && ov.contains(rg.startContainer)) { s2.removeAllRanges(); s2.addRange(rg); } else { const r2 = document.createRange(); r2.selectNodeContents(ov); r2.collapse(false); s2.removeAllRanges(); s2.addRange(r2); }
  return true;
}
$('cvStrip').addEventListener('dblclick', () => { const sl = S.slides[S.sel]; if (sl) { setView('live'); toast('在投影片上點兩下改字，字條會跟著改'); } });
$('cvLive').addEventListener('dblclick', e => {
  const r = $('cvLive').getBoundingClientRect(), k = W / r.width, cx = (e.clientX - r.left) * k, cy = (e.clientY - r.top) * k, sl = S.slides[S.sel];
  const b = useOrig(sl) && (S.liveGeo.rec || []).find(q => typeof q.gid === 'string' && cy >= q.y && cy <= q.y + q.h && cx >= q.x - 24 && cx <= q.x + q.w + 24);
  if (b && inlineOpen(+b.gid.slice(1), e.clientX, e.clientY)) { selPara(null); selectWordAt($('inEd')); editBar(); return; }
  const pb = !useOrig(sl) && (S.liveGeo.rec || []).find(q => typeof q.gid === 'number' && cy >= q.y && cy <= q.y + q.h && cx >= q.x - 24 && cx <= q.x + q.w + 24);
  if (pb && pEdOpen(pb.gid, e.clientX, e.clientY)) { selPara(null); selectWordAt($('pEd')); editBar(); return; }
  const sec = ed.querySelector('section.hot'); if (!sec) return;   // 其他情況：游標跳到右邊對應的卡片
  ed.focus(); const rg = document.createRange(); rg.selectNodeContents(sec.lastElementChild || sec); rg.collapse(false); const s2 = getSelection(); s2.removeAllRanges(); s2.addRange(rg);
});
function syncParaBar() {
  const bar = $('paraBar'), box = $('paraBox'); if (!bar) return;
  if ([$('inEd'), $('pEd')].some(x => x && !x.hidden)) return;   // 打字中：工具列由 editBar 管
  const sl = S.slides[S.sel], v = S.view === 'live' ? 'l' : 's', isTB = !!(paraSel && paraSel.tb), bs = paraSel && sl && paraSel.view === v ? (isTB ? tbBoxes(v).filter(q => q.tb === paraSel.tb) : paraBoxes(v).filter(q => q.gid === paraSel.gid)) : [];
  if (!bs.length) { bar.hidden = box.hidden = true; return; }
  const x0 = Math.min(...bs.map(q => q.x)) - 14, y0 = Math.min(...bs.map(q => q.y)) - 6, x1 = Math.max(...bs.map(q => q.x + q.w)) + 14, y1 = Math.max(...bs.map(q => q.y + q.h)) + 6;
  const frame = $(v === 'l' ? 'frameLive' : 'frameStrip'); if (box.parentElement !== frame) { frame.appendChild(box); frame.appendChild(bar); }
  Object.assign(box.style, { left: x0 / W * 100 + '%', top: y0 / H * 100 + '%', width: (x1 - x0) / W * 100 + '%', height: (y1 - y0) / H * 100 + '%' });
  const below = y0 < 170; bar.classList.toggle('below', below);
  Object.assign(bar.style, { left: Math.max(1, Math.min(70, x0 / W * 100)) + '%', top: (below ? y1 + 10 : y0 - 10) / H * 100 + '%' });
  const d = ppOf(sl, v, paraSel.gid) || {}, tbo = isTB && sl.tb.find(z => z.id === paraSel.tb);
  $('paraK').textContent = isTB ? tbo.s : Math.round((d.k || (sl._pk && sl._pk[paraSel.gid]) || 1) * 100) + '%';
  $('tbText').hidden = $('tbDel').hidden = !isTB; $('paraReset').hidden = isTB; ['paraUp', 'paraDown', 'paraJoin'].forEach(id => $(id).hidden = isTB);
  if (typeof paraSel.gid === 'string') ['paraUp', 'paraDown', 'paraJoin'].forEach(id => $(id).hidden = true);
  else if (!isTB) { $('paraUp').disabled = $('paraJoin').disabled = paraSel.gid <= 0; $('paraDown').disabled = paraSel.gid >= sl.paras.length - 1; } if (isTB && document.activeElement !== $('tbText')) $('tbText').value = tbo.t;
  bar.hidden = box.hidden = false;
}
// 調整段落順序：上移、下移、併到上一段（例如「2.」和標題被拆成兩段時）
function paraMove(kind) {
  const sl = S.slides[S.sel]; if (!paraSel || paraSel.tb || !sl) return; const i = paraSel.gid, ps = sl.paras;
  if (kind === 'up' && i > 0) { [ps[i - 1], ps[i]] = [ps[i], ps[i - 1]]; paraSel.gid = i - 1; }
  else if (kind === 'down' && i < ps.length - 1) { [ps[i + 1], ps[i]] = [ps[i], ps[i + 1]]; paraSel.gid = i + 1; }
  else if (kind === 'join' && i > 0) { const a = ps[i - 1], b = ps[i].map(r => Object.assign({}, r)); if (b[0]) delete b[0].ps; const gap = /[0-9A-Za-z.．、:：]$/.test(plain(a)) ? ' ' : ''; ps.splice(i - 1, 2, a.concat(gap ? [{ t: gap, red: false }] : [], b)); paraSel.gid = i - 1; }
  else return;
  delete sl.pp; _deck.sig = ''; if (typeof edRender === 'function') edRender(); redrawSoon();
}
function paraScale(f) {
  const sl = S.slides[S.sel]; if (!paraSel || !sl) return;
  if (paraSel.tb) { const b = (sl.tb || []).find(z => z.id === paraSel.tb); if (b && f) b.s = Math.max(16, Math.min(300, Math.round(b.s * f))); redrawSoon(); return; }
  const d = ppOf(sl, paraSel.view, paraSel.gid) || {}, k0 = d.k || (sl._pk && sl._pk[paraSel.gid]) || 1;
  if (f === 0) ppSet(sl, paraSel.view, paraSel.gid, null); else ppSet(sl, paraSel.view, paraSel.gid, { k: Math.max(.3, Math.min(3, +(k0 * f).toFixed(3))) });
  _deck.sig = ''; redrawSoon();
}
const snap4 = v => Math.round(v / 4) * 4, clampN = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
// 投影片上的圖片：拖曳移動，拉右下角縮放；文字會自動讓開
function pickPic(cx, cy) {
  const sl = S.slides[S.sel], ps = sl && sl.pics; if (!ps || !ps.length) return null;
  for (let i = ps.length - 1; i >= 0; i--) {
    const p = ps[i], x = p.x * W, y = p.y * H, w = p.w * W, h = p.h * H;
    if (cx < x || cx > x + w || cy < y || cy > y + h) continue;
    const corner = cx > x + w - 70 && cy > y + h - 70, o = Object.assign({}, p);
    return { cursor: corner ? 'nwse-resize' : 'move', title: corner ? '拖曳可以縮放圖片' : '拖曳可以移動圖片',
      move(dx, dy) {
        if (corner) { const k = Math.max(.25, (o.w * W + dx) / (o.w * W)); p.w = o.w * k; p.h = o.h * k; }
        else { p.x = clampN(o.x + dx / W, -o.w + .05, .95); p.y = clampN(o.y + dy / H, -o.h + .05, .95); }
        _deck.sig = ''; redrawSoon();
      } };
  }
  return null;
}
function attachDrag(cv, get, set, hit, pick) {
  let drag = null; cv.style.touchAction = 'none';
  const frame = cv.parentElement, guide = document.createElement('div'); guide.className = 'bkg'; guide.hidden = true; frame.appendChild(guide);
  const toCv = e => { const r = cv.getBoundingClientRect(), k = W / r.width; return [(e.clientX - r.left) * k, (e.clientY - r.top) * k]; };
  const hideGuide = () => { guide.hidden = true; cv.style.cursor = 'grab'; };
  cv.addEventListener('pointerdown', e => { if (!S.slides[S.sel]) return; drag = { x: e.clientX, y: e.clientY, s: get(), k: W / cv.getBoundingClientRect().width, moved: false, t: Date.now(), obj: pick ? pick(...toCv(e)) : null }; HIST.hold = true; try { cv.setPointerCapture(e.pointerId); } catch (er) { } hideGuide(); });
  cv.addEventListener('pointermove', e => {
    if (drag) { if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 5) drag.moved = true; if (drag.moved) { const mx = (e.clientX - drag.x) * drag.k, my = (e.clientY - drag.y) * drag.k; if (drag.obj) { cv.style.cursor = drag.obj.cursor; drag.obj.move(mx, my); } else { cv.style.cursor = 'grabbing'; set(drag.s, mx, my); } } return; }
    const ob = pick && pick(...toCv(e)); if (ob) { guide.hidden = true; cv.style.cursor = ob.cursor; cv.title = ob.title; return; } cv.title = '';
    const h = hit && hit(...toCv(e));
    if (!h) return hideGuide();
    guide.hidden = false; guide.classList.toggle('rm', !!h.removing); cv.style.cursor = 'text';
    Object.assign(guide.style, { left: (h.x / W * 100) + '%', top: (h.y / H * 100) + '%', height: (h.h / H * 100) + '%' });
    cv.title = h.removing ? '點一下：取消這裡的換行' : '點一下：在這裡換行';
  });
  cv.addEventListener('pointerleave', () => { if (!drag) hideGuide(); });
  const end = e => {
    if (drag && !drag.moved && Date.now() - drag.t < 600 && hit && e.type === 'pointerup') { const h = hit(...toCv(e)); if (h) toggleBreak(h.pi, h.off); }
    if (drag && !drag.moved && e.type === 'pointerup') { if (drag.obj && drag.obj.click) drag.obj.click(); else selPara(null); }
    const was = drag && drag.moved; drag = null; cv.style.cursor = 'grab'; HIST.hold = false; if (was) save();
  };
  cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
}
attachDrag($('cvLive'), () => { const vv = autoVariant(S.slides[S.sel], S.sel), L = liveCfg(S.slides[S.sel], vv === 'title', vv); return { dx: L.dx, dy: L.dy }; },
  (s, mx, my) => { editLive('dx', clampN(snap4(s.dx + mx), -900, 900)); editLive('dy', clampN(snap4(s.dy + my), -600, 600)); }, null, (cx, cy) => pickPara('l', cx, cy));
attachDrag($('cvStrip'), () => ({ x: S.stripX, y: S.stripY }),
  (s, mx, my) => { S.stripX = clampN(snap4(s.x + mx), -700, 700); S.stripY = clampN(snap4(s.y - my), 0, 700); syncOut(); redrawSoon(); }, null, (cx, cy) => pickStripEdge(cx, cy) || pickPara('s', cx, cy));
$('stripX').oninput = () => { S.stripX = +$('stripX').value; syncOut(); redrawSoon(); };
$('stripReset').onclick = () => {
  const sl = S.slides[S.sel];
  if (S.layScope === 'slide' && sl) { delete sl.sfs; delete sl.slg; delete sl.sw; delete sl.sal; ppClear(sl, 's'); } else { S.slides.forEach(x => ppClear(x, 's')); S.sLook = { bg: null, a: 1, r: null, pad: 46 }; S.sAuto = { num: true, ref: true }; _scCache.clear(); S.stripAlign = 'auto'; S.stripX = 0; S.stripY = 64; S.stripW = .81; S.stripFixed = false; S.stripScale = 1; S.stripGap = null; $('stripY').value = 64; }
  S.page = 0; syncOut(); redrawSoon();
};
document.querySelectorAll('.view').forEach(b => b.onclick = () => setView(b.dataset.v));
$('autoExport').onchange = () => { S.autoExport = $('autoExport').checked; save(); };
$('styleClear').onclick = () => { try { localStorage.removeItem('ppt-web-style'); localStorage.removeItem('ppt-web-v1'); } catch (e) { } location.reload(); };
// 鍵盤切換頁面：上下鍵（或左右鍵、PageUp/PageDown）；在輸入框裡打字時不攔截，按 Esc 離開輸入框
document.addEventListener('keydown', e => {
  const t = e.target, tag = t.tagName, type = (t.type || '').toLowerCase();
  const typing = t.isContentEditable || tag === 'TEXTAREA' || tag === 'SELECT' || (tag === 'INPUT' && !['range', 'checkbox', 'button'].includes(type));
  if (e.key === 'Escape' && typing) { t.blur(); return; }
  if (!typing && (e.metaKey || e.ctrlKey) && !e.altKey && (e.key.toLowerCase() === 'z' || e.key.toLowerCase() === 'y') && S.slides.length) { e.preventDefault(); (e.key.toLowerCase() === 'y' || e.shiftKey) ? histRedo() : histUndo(); return; }
  if (typing || e.metaKey || e.ctrlKey || e.altKey || !S.slides.length || !$('editor') || $('editor').hidden) return;
  let to = null;
  if (e.key === 'ArrowDown' || e.key === 'PageDown') to = S.sel + 1;
  else if (e.key === 'ArrowUp' || e.key === 'PageUp') to = S.sel - 1;
  else if ((e.key === 'ArrowRight' || e.key === 'ArrowLeft') && type !== 'range') to = S.sel + (e.key === 'ArrowRight' ? 1 : -1);
  else if (e.key === 'Home') to = 0;
  else if (e.key === 'End') to = S.slides.length - 1;
  if (to === null) return;
  e.preventDefault();
  to = Math.max(0, Math.min(S.slides.length - 1, to));
  if (to !== S.sel) select(to);
});
(async () => {
  syncOut(); buildCats(); buildThemes(); buildFontSelects();
  try {
    const v = JSON.parse(localStorage.getItem('ppt-web-v1') || 'null');
    const st = JSON.parse(localStorage.getItem('ppt-web-style') || 'null') || (v && v.themeKey ? v : null);
    if (st) { await applyStyle(st); showStyleNote(true); }
    loadSavedBg(); await loadPhotos(); await loadSavedTpl();
    await renderEmptyPreview();
    if (v && v.slides && v.slides.length) {
      const b = document.createElement('button'); b.className = 'btn'; b.textContent = `繼續上次的「${v.fileName}」`;
      b.onclick = () => start(v.slides, v.fileName, v.live); $('btnSample').after(b);
    }
  } catch (e) { }
})();

// ---------- 逐段工具列、字條樣式 ----------
function syncStripLook() {
  if (!$('stR')) return; const k = S.sLook;
  document.querySelectorAll('#stBg .pill[data-c]').forEach(b => b.classList.toggle('sel', (k.bg || '') === b.dataset.c));
  $('stR').value = k.r == null ? 10 : k.r; $('stRO').textContent = k.r == null ? '自動' : k.r;
  $('stPad').value = k.pad || 46; $('stPadO').textContent = k.pad || 46;
  $('saNum').checked = !!S.sAuto.num;
}
(function wireCustom() {
  if (!$('stR')) return;
  const go = () => { _scCache.clear(); syncStripLook(); redrawSoon(); };
  document.querySelectorAll('#stBg .pill[data-c]').forEach(b => b.onclick = () => { S.sLook.bg = b.dataset.c || null; go(); });
  $('stBgPick').oninput = () => { S.sLook.bg = $('stBgPick').value; go(); };
  $('stR').oninput = () => { S.sLook.r = +$('stR').value; go(); };
  $('stPad').oninput = () => { S.sLook.pad = +$('stPad').value; go(); };
  $('saNum').onchange = () => { S.sAuto.num = $('saNum').checked; go(); };
  $('paraUp').onclick = () => paraMove('up'); $('paraDown').onclick = () => paraMove('down'); $('paraJoin').onclick = () => paraMove('join');
  $('paraMinus').onclick = () => paraScale(1 / 1.08); $('paraPlus').onclick = () => paraScale(1.08); $('paraReset').onclick = () => paraScale(0);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && paraSel) selPara(null); });
  $('tbText').oninput = () => { const sl = S.slides[S.sel], b = paraSel && sl && (sl.tb || []).find(z => z.id === paraSel.tb); if (b) { b.t = $('tbText').value || ' '; redrawSoon(); } };
  $('tbDel').onclick = () => { const sl = S.slides[S.sel]; if (!paraSel || !sl || !sl.tb) return; sl.tb = sl.tb.filter(z => z.id !== paraSel.tb); if (!sl.tb.length) delete sl.tb; selPara(null); redrawSoon(); };
  $('btnAddTB').onclick = addTextBox; $('btnAddPic').onclick = () => $('addPicFile').click();
  $('addPicFile').onchange = e => { const f = e.target.files[0]; e.target.value = ''; addPicFile(f).catch(er => { console.error(er); toast('讀不到這張圖片'); }); };
  syncStripLook();
})();

(function wireOrig() {
  if (!$('optOrig')) return;
  $('optOrig').onchange = () => { S.keepOrig = $('optOrig').checked; bgCache.clear(); _scCache.clear(); _deck.sig = ''; renderTplUI(); buildList(); renderMain(); save(); };
  $('origSlide').onclick = () => { const sl = S.slides[S.sel]; if (!sl) return; sl.noOrig = !sl.noOrig; if (!sl.noOrig) delete sl.noOrig; delete sl.pp; bgCache.clear(); _scCache.clear(); _deck.sig = ''; renderTplUI(); renderMain(); renderThumb(S.sel); save(); };
})();

(function wireEdSimple() { if (!$('edToggle')) return; $('edToggle').onclick = () => { S.edCards = !S.edCards; edRender(); }; })();

// ================= 簡化後的操作：上方工具、浮動工具列、投影片上直接改字、右邊「這一頁」 =================
$('hAddTB').onclick = $('mAddTB').onclick = () => addTextBox();
$('mOpen').onclick = () => $('btnOpen').click();
$('hAddPic').onclick = $('mAddPic').onclick = () => $('addPicFile').click();
document.querySelectorAll('#hView button').forEach(b => b.onclick = () => setView(b.dataset.v));
// 原本分散在「文字」分頁的區塊，搬到「這一頁」
(function movePageBlocks() {
  const box = $('pgMove'); if (!box) return;
  [$('stripLookSec'), $('btnAdd') && $('btnAdd').closest('.sec')].forEach(x => x && box.appendChild(x));
  const addSec = $('btnAddTB') && $('btnAddTB').closest('.sec'); if (addSec) addSec.hidden = true;
})();
// ---- 這一頁的背景 ----
const PG_BG = [['', '原本'], ['#FFFFFF', '白'], ['#F3EEE3', '米白'], ['#24262B', '深灰'], ['#1F3A36', '墨綠']];
(function buildPgBg() {
  const box = $('pgBg'); if (!box) return;
  PG_BG.forEach(([c, name]) => { const b = document.createElement('button'); b.dataset.c = c; b.title = name; b.setAttribute('aria-label', name + '背景'); if (c) b.style.background = c; else { b.className = 'orig'; b.textContent = '原本'; } b.onclick = () => setPageBg(c); box.appendChild(b); });
})();
function setPageBg(c) {
  const sl = S.slides[S.sel]; if (!sl) return;
  if (useOrig(sl)) { const O = sl.orig; if (O.bg0 == null) O.bg0 = O.bg; O.bg = c || O.bg0; delete O.bgImg; }
  else if (c) setSlideBg({ t: 'color', c }); else { delete sl.bg; }
  bgCache.clear(); _scCache.clear(); renderMain(); renderThumb(S.sel); save(); syncPage();
}
function syncPage() {
  const sl = S.slides[S.sel]; if (!sl || !$('pgBg')) return;
  const cur = useOrig(sl) ? (sl.orig.bgImg ? 'img' : sl.orig.bg0 != null && sl.orig.bg !== sl.orig.bg0 ? sl.orig.bg : '') : sl.bg && sl.bg.t === 'color' ? sl.bg.c : sl.bg ? 'img' : '';
  document.querySelectorAll('#pgBg button').forEach(b => b.classList.toggle('sel', (b.dataset.c || '') === cur));
}
$('pgPhoto').onclick = () => {
  const sl = S.slides[S.sel]; if (!sl) return;
  if (!useOrig(sl)) { $('slBgFile').click(); return; }
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*';
  inp.onchange = async () => { const f = inp.files[0]; if (!f) return; const raw = await new Promise(ok => { const r = new FileReader(); r.onload = () => ok(r.result); r.readAsDataURL(f); }); const src = await shrinkImg(raw, f.type); await loadBgImg(src); sl.orig.bgImg = src; renderMain(); renderThumb(S.sel); save(); syncPage(); };
  inp.click();
};
$('pgAll').onclick = () => {
  const sl = S.slides[S.sel]; if (!sl) return; let n = 0;
  S.slides.forEach((x, i) => { if (i === S.sel) return;
    if (useOrig(sl) && useOrig(x)) { if (x.orig.bg0 == null) x.orig.bg0 = x.orig.bg; x.orig.bg = sl.orig.bg; if (sl.orig.bgImg) x.orig.bgImg = sl.orig.bgImg; else delete x.orig.bgImg; n++; }
    else if (!useOrig(sl) && !useOrig(x)) { if (sl.bg) x.bg = JSON.parse(JSON.stringify(sl.bg)); else delete x.bg; n++; } });
  bgCache.clear(); _scCache.clear(); buildList(); renderMain(); save(); toast(n ? `已經套用到其他 ${n} 頁` : '沒有其他同類型的頁面');
};
// ---- 浮動工具列：顏色、粗體、對齊、刪除 ----
function paraTarget() { const sl = S.slides[S.sel]; return paraSel && sl ? { sl, gid: paraSel.gid, tb: paraSel.tb, orig: typeof paraSel.gid === 'string' } : null; }
function paraColor(c) {
  const sel = getSelection(), ov = [$('inEd'), $('pEd')].find(x => x && !x.hidden && x.contains(sel.anchorNode));
  if (ov && !sel.isCollapsed) return colorText(c);
  const t = paraTarget(); if (!t) return; const T = curTheme(t.sl);
  if (t.tb) { const b = (t.sl.tb || []).find(z => z.id === t.tb); if (b) b.c = c === 'red' ? T.red : c === 'accent' ? T.accent : c || undefined; }
  else if (t.orig) { const it = t.sl.orig.items[+t.gid.slice(1)], hex = origHex(t.sl, c); it.paras.forEach(p => p.runs.forEach(r => { r.c = hex; })); origRebuild(t.sl); }
  else { const p = t.sl.paras[t.gid]; if (!p) return; const txt = plain(p), ps = p[0] && p[0].ps, run = !c ? { t: txt, red: false } : c === 'red' ? { t: txt, red: true } : { t: txt, red: true, c }; if (ps) run.ps = ps; t.sl.paras[t.gid] = [run]; }
  edRender(); redrawSoon();
}
document.querySelectorAll('#paraBar [data-pc]').forEach(b => { b.onmousedown = e => e.preventDefault(); b.onclick = () => paraColor(b.dataset.pc); });
$('paraPick').onchange = () => paraColor($('paraPick').value.toUpperCase());
$('paraBold').onmousedown = e => e.preventDefault();
$('paraBold').onclick = () => {
  const t = paraTarget(); if (!t || t.tb) return;
  if (t.orig) { const it = t.sl.orig.items[+t.gid.slice(1)], bold = it.paras.some(p => p.runs.some(r => r.w >= 700)); it.paras.forEach(p => p.runs.forEach(r => { r.w = bold ? 400 : 700; })); origRebuild(t.sl); }
  else { const p = t.sl.paras[t.gid]; if (!p || !p[0]) return; const v = autoVariant(t.sl, S.sel), hr = liveOpts(v === 'title', v, t.sl).headRule, isH = p[0].ps ? p[0].ps === 'h' : hr(t.gid, t.sl.paras); p[0].ps = isH ? 'b' : 'h'; }
  _deck.sig = ''; edRender(); redrawSoon(); syncParaBar();
};
const ALIGNS = ['left', 'center', 'right'], ALIGN_NAME = { left: '靠左', center: '置中', right: '靠右' };
function curAlign(t) { if (t.orig) { const it = t.sl.orig.items[+t.gid.slice(1)], a = it.paras[0] ? it.paras[0].align : 0; return a === 2 ? 'center' : a === 1 ? 'right' : 'left'; } const vv = autoVariant(t.sl, S.sel); return liveCfg(t.sl, vv === 'title', vv).align || t.sl._autoAlign || 'left'; }
$('paraAlign').onclick = () => {
  const t = paraTarget(); if (!t || t.tb) return; const next = ALIGNS[(ALIGNS.indexOf(curAlign(t)) + 1) % 3];
  if (t.orig) { const it = t.sl.orig.items[+t.gid.slice(1)]; it.paras.forEach(p => { p.align = next === 'center' ? 2 : next === 'right' ? 1 : 0; }); }
  else t.sl.lv = Object.assign({}, t.sl.lv, { align: next });
  redrawSoon(); setTimeout(syncParaBar, 120);
};
$('paraDelete').onclick = () => {
  const t = paraTarget(); if (!t) return;
  if (t.tb) { t.sl.tb = (t.sl.tb || []).filter(z => z.id !== t.tb); if (!t.sl.tb.length) delete t.sl.tb; }
  else if (t.orig) { t.sl.orig.items[+t.gid.slice(1)].paras = []; origRebuild(t.sl); }
  else { t.sl.paras.splice(t.gid, 1); if (!t.sl.paras.length) t.sl.paras = [[{ t: ' ', red: false }]]; delete t.sl.pp; }
  selPara(null); edRender(); redrawSoon();
};
// 工具列：依選到的東西顯示需要的按鈕
const _syncParaBar0 = syncParaBar;
syncParaBar = function () {
  _syncParaBar0();
  const t = paraTarget(); if (!t || $('paraBar').hidden) return;
  const strip = paraSel.view === 's', A = curTheme(t.sl).accent;
  document.querySelectorAll('#paraBar .dot, #paraBar .bsep').forEach(x => x.hidden = strip);
  $('paraBold').hidden = $('paraAlign').hidden = strip || !!t.tb; $('paraDelete').hidden = strip || !!t.tb;
  ['paraUp', 'paraDown', 'paraJoin', 'paraReset'].forEach(id => $(id).hidden = true);
  const dA = $('paraBar').querySelector('.dA'); if (dA) dA.style.background = t.orig ? (origColors(t.sl).ac || A) : A;
  if (!strip && !t.tb) $('paraAlign').textContent = ALIGN_NAME[curAlign(t)];
};
// ---- 網站排版的頁面：一樣可以在投影片上點兩下改字 ----
function pEdClose() { const ov = $('pEd'); if (!ov || ov.hidden) return; ov.hidden = true; ov.innerHTML = ''; const sl = S.slides[S.sel]; if (sl) delete sl._editP; renderMain(); edRender(); save(); }
function pEdOpen(gid, cx, cy) {
  const sl = S.slides[S.sel], rec = ((S.liveGeo && S.liveGeo.rec) || []).filter(q => q.gid === gid); if (!sl || !rec.length || !sl.paras[gid]) return false;
  const frame = $('frameLive'), disp = frame.clientWidth / W, T = curTheme(sl), g = S.liveGeo;
  const ov = $('pEd') || (() => { const d = document.createElement('div'); d.id = 'pEd'; d.contentEditable = 'true'; d.spellcheck = false; frame.appendChild(d);
    d.addEventListener('input', () => { const s2 = S.slides[S.sel]; if (!s2 || !s2._editP) return; const [a, n] = s2._editP, T2 = curTheme(s2), ps = [];
      [...d.children].forEach(div => { const runs = []; const walk = (node, col) => { if (node.nodeType === 3) { const t = node.nodeValue.replace(/ /g, ' '); if (!t) return; const hex = col && col.toUpperCase(), red = !!(hex && hex !== String(T2.text).toUpperCase()), cc = red && hex !== String(T2.red).toUpperCase() ? (hex === String(T2.accent).toUpperCase() ? 'accent' : hex) : undefined, last = runs[runs.length - 1]; if (last && last.red === red && last.c === cc) last.t += t; else runs.push(cc ? { t, red, c: cc } : { t, red }); return; } if (node.nodeType !== 1) return; if (node.nodeName === 'BR') { if (node.nextSibling) { const l = runs[runs.length - 1]; if (l) l.t += '↵'; } return; } const st = node.style && node.style.color ? rgbHex(node.style.color) : null; node.childNodes.forEach(k => walk(k, st || col)); }; div.childNodes.forEach(k => walk(k, null)); if (runs.length) { if (div.dataset.ps) runs[0].ps = div.dataset.ps; ps.push(runs); } });
      s2.paras.splice(a, n, ...(ps.length ? ps : [])); if (!s2.paras.length) s2.paras = [[{ t: ' ', red: false }]]; s2._editP = [a, Math.max(1, ps.length)]; delete s2.pp; _deck.sig = ''; renderMain(); redrawSoon(); });
    d.addEventListener('keydown', e => { if (e.key === 'Escape' || (e.key === 'Enter' && !e.shiftKey && !e.isComposing && e.keyCode !== 229)) { e.preventDefault(); d.blur(); if (d.id === 'inEd') inlineClose(); else pEdClose(); editBar(); } e.stopPropagation(); });   // Enter 完成（中文選字時的 Enter 不算），Shift+Enter 換行
    d.addEventListener('blur', () => setTimeout(() => { const a = document.activeElement; if (!d.contains(a) && !(a && a.closest && a.closest('#colorBar, #paraBar'))) { pEdClose(); editBar(); } }, 150));
    d.addEventListener('paste', e => { e.preventDefault(); const t = (e.clipboardData || window.clipboardData).getData('text/plain').replace(/\r/g, ''); t.split('\n').forEach((line, i) => { if (i) document.execCommand('insertParagraph'); if (line) document.execCommand('insertText', false, line); }); });
    return d; })();
  const p = sl.paras[gid], l0 = rec[0], col = r => !r.red ? T.text : !r.c || r.c === 'red' ? T.red : r.c === 'accent' ? T.accent : r.c;
  const x0 = Math.min(...rec.map(q => q.x)), y0 = Math.min(...rec.map(q => q.y)), x1 = Math.max(...rec.map(q => q.x + q.w)), al = g.align || 'left';
  const left = al === 'center' || al === 'right' ? (g.x || x0) : x0, width = al === 'center' || al === 'right' ? (g.maxW || (x1 - x0)) : Math.max(x1 - x0, (g.maxW || 0) - (x0 - (g.x || x0)));
  ov.innerHTML = `<div${p[0] && p[0].ps ? ` data-ps="${p[0].ps}"` : ''}>` + p.map(r => `<span style="color:${col(r)}">${escH(r.t).replace(/↵/g, '<br>')}</span>`).join('') + '</div>';
  Object.assign(ov.style, { left: left / W * 100 + '%', top: (y0 - 4) / W * 100 * (W / H) + '%', width: (width + 8) * disp + 'px', font: fnt(l0.head ? 700 : 500, Math.round(l0.size * disp), l0.head, false, l0.scr), lineHeight: (l0.h || l0.size * 1.4) * disp + 'px', textAlign: al, color: T.text });
  ov.hidden = false; sl._editP = [gid, 1]; renderMain(); ov.focus();
  const rg = document.caretRangeFromPoint && cx != null ? document.caretRangeFromPoint(cx, cy) : null, s2 = getSelection();
  if (rg && ov.contains(rg.startContainer)) { s2.removeAllRanges(); s2.addRange(rg); } else { const r2 = document.createRange(); r2.selectNodeContents(ov); r2.collapse(false); s2.removeAllRanges(); s2.addRange(r2); }
  return true;
}

// ---- 打字的時候：工具列停在文字上方，顏色只改選取的字 ----
let _edRange = null;
const curEditor = () => [$('inEd'), $('pEd')].find(x => x && !x.hidden) || null;
function editBar() {
  const ov = curEditor(), bar = $('paraBar'); if (!bar) return;
  if (!ov) { bar.classList.remove('editing'); return; }
  const frame = ov.parentElement; if (bar.parentElement !== frame) frame.appendChild(bar);
  bar.classList.add('editing'); bar.hidden = false; $('paraBox').hidden = true;
  const fr = frame.getBoundingClientRect(), r = ov.getBoundingClientRect(), top = r.top - fr.top - 14, below = top < 50;
  bar.classList.toggle('below', below);
  Object.assign(bar.style, { left: Math.max(4, r.left - fr.left) + 'px', top: (below ? r.bottom - fr.top + 14 : top) + 'px' });
  const sl = S.slides[S.sel], dA = bar.querySelector('.dA'); if (dA && sl) dA.style.background = ov.id === 'inEd' ? (origColors(sl).ac || curTheme(sl).accent) : curTheme(sl).accent;
}
document.addEventListener('selectionchange', () => { const ov = curEditor(), s2 = getSelection(); if (ov && s2.rangeCount && ov.contains(s2.anchorNode)) _edRange = s2.getRangeAt(0).cloneRange(); });
function selectWordAt(ov) {   // 點兩下：選取游標所在的那個詞
  const s2 = getSelection(); if (!ov || !s2.rangeCount || !s2.isCollapsed || !ov.contains(s2.anchorNode)) return;
  try { s2.modify('move', 'backward', 'word'); s2.modify('extend', 'forward', 'word'); } catch (e) { }
}
const _paraColor0 = paraColor;
paraColor = function (c) {
  const ov = curEditor();
  if (!ov) return _paraColor0(c);
  const s2 = getSelection();
  if (_edRange && (!s2.rangeCount || !ov.contains(s2.anchorNode))) { ov.focus(); s2.removeAllRanges(); s2.addRange(_edRange); }
  if (s2.isCollapsed) { toast('先選取要換顏色的字（按住拖曳）'); return; }
  colorText(c); setTimeout(editBar, 30);
};
$('paraDone').onmousedown = e => e.preventDefault();
$('paraDone').onclick = () => { inlineClose(); pEdClose(); editBar(); };
$('paraEdit').onclick = () => {
  const t = paraTarget(); if (!t || t.tb) return;
  const ok = t.orig ? inlineOpen(+t.gid.slice(1)) : pEdOpen(t.gid);
  if (ok) { selPara(null); setTimeout(editBar, 30); }
};
$('paraPick').addEventListener('mousedown', () => { const s2 = getSelection(), ov = curEditor(); if (ov && s2.rangeCount && ov.contains(s2.anchorNode)) _edRange = s2.getRangeAt(0).cloneRange(); });
