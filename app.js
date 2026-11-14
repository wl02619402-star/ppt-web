'use strict';
// ---------- 狀態 ----------
const S = {
  slides: [], sel: 0, page: 0, themeKey: 'torn_kraft', stripW: 0.81, stripY: 64, stripX: 0, view: 'live', autoExport: false, exportFmt: 'image', deckScale: 1, anchor: 'middle',
  custom: null, customMode: 'dark', customDim: null, fileName: '簡報',
  fonts: { head: 'theme', body: 'theme', scr: 'same' }, shadow: false, blocks: false, autoVary: true, bgAll: null, bgScope: 'all', localFonts: [], lineGap: null, live: {}, liveScope: 'all',
};
const $ = id => document.getElementById(id);
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
    return Object.assign({}, base, { name: '圖片', key: 'img:' + bg.src.length + ':' + dim + (e ? 1 : 0), flat: true, dark, ownVariants: false,
      bg(c) {
        if (e) { const im = e.im, sc = Math.max(W / im.width, H / im.height), w = im.width * sc, h = im.height * sc; c.drawImage(im, (W - w) / 2, (H - h) / 2, w, h); }
        else { c.fillStyle = '#222'; c.fillRect(0, 0, W, H); }
        c.fillStyle = dark ? `rgba(10,8,6,${dim})` : `rgba(255,255,255,${dim})`; c.fillRect(0, 0, W, H);
      } });
  }
  return null;
}
const dimOf = () => S.customDim == null ? (S.customMode === 'light' ? .62 : .58) : S.customDim;
function curTheme(slide) {
  if (slide && slide.bg) { const t = slideBgTheme(slide.bg); if (t) return t; }
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
function getBg(v, p = 0, slide) {
  const t = curTheme(slide), key = [t.key, v, p % 6, S.customMode, S.custom ? S.custom.src.length : '', dimOf()].join('|');
  if (!bgCache.has(key)) {
    const c = mk(W, H), x = c.getContext('2d');
    if (COMP.has(v)) composeBg(x, slideTheme(t, v), v, p);
    else if (v === 'spot' && !t.flat) drawSpot(x, t, p % 2);
    else { t.bg.call(t, x, t.ownVariants ? v : (v === 'title' ? 'title' : 'content')); if (!t.ownVariants && !t.flat) decorate(x, t, v, p); }
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
function tokenize(t) {
  const out = [], parts = t.match(/[（(](?=[^（）()]*\d)[^（）()]{1,14}[）)]|[A-Za-z0-9:：.\-–—]+|[^A-Za-z0-9:：.\-–—（(]+|[\s\S]/g) || [];
  for (const p of parts) {
    if (/^[A-Za-z0-9（(:：.\-–—]/.test(p) || p.length < 2) { out.push(p); continue; }
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
    const head = o.headRule(pi, paras);
    const fs = head ? Math.round(size * o.headScale) : size;
    const wt = head ? 700 : 500;
    const scr = !head && isScripture(runs);
    const base = fnt(wt, fs, head, false, scr), redf = fnt(700, fs, head, true, scr);
    const flat = []; let pos = 0;
    runs.forEach(r => {
      r.t.replace(/[\n\v]/g, ' ').split('↵').forEach((pc, k) => {
        if (k > 0) { flat.push({ brk: true, t: '', red: r.red }); pos += 1; }
        let po = pos; tokenize(pc).forEach(tk => { flat.push({ t: tk, red: r.red, o: po }); po += tk.length; });
        pos += pc.length;
      });
    });
    let cur = [], cw = 0;
    for (const tk of flat) {
      if (tk.brk) { if (cur.length) { lines.push({ pi, segs: cur, size: fs, head, scr, w: cw }); cur = []; cw = 0; } continue; }
      const w = tw(tk.red ? redf : base, tk.t);
      if (cur.length && cw + w > maxW && !NO_START.has(tk.t)) {
        const carry = [];
        while (cur.length && NO_END.has(cur[cur.length - 1].t)) carry.unshift(cur.pop());
        // 新的一行不要以太短的詞開頭：把前面的詞一起帶下來，湊到至少 4 個字（例如「死亡之路」整個放到下一行）
        if (isCJK(tk.t[0]) && tk.t.length <= 2) {
          let n = carry.reduce((a, x) => a + x.t.length, 0) + tk.t.length;
          while (n < 4 && cur.length > 2 && isCJK(cur[cur.length - 1].t[0])) { const x = cur.pop(); carry.unshift(x); n += x.t.length; }
        }
        lines.push({ pi, segs: cur, size: fs, head, scr, w: cw });
        cur = carry; cw = carry.reduce((a, s) => a + tw(s.red ? redf : base, s.t), 0);
      }
      if (tk.t === ' ' && !cur.length) continue;
      cur.push(tk); cw += w;
    }
    if (cur.length) lines.push({ pi, segs: cur, size: fs, head, scr, w: cw });
  });
  lines.forEach(l => { l.h = l.size * o.lineGap; });
  return lines;
}
function blockH(lines, o) {
  let h = 0;
  lines.forEach((l, i) => { h += l.h; if (lines[i + 1] && lines[i + 1].pi !== l.pi) h += l.size * o.paraGap; });
  return h;
}
function drawLines(c, lines, x, y, o, T, align = 'left', boxW = 0) {
  c.textBaseline = 'middle';
  const shadowOn = !!o.shadow && lumOf(T.text) > .6;
  lines.forEach((l, i) => {
    const wt = l.head ? 700 : 500, base = fnt(wt, l.size, l.head, false, l.scr), redf = fnt(700, l.size, l.head, true, l.scr);
    let px = align === 'center' ? x + (boxW - l.w) / 2 : align === 'right' ? x + boxW - l.w : x;
    const cy = y + l.h / 2;
    l.segs.forEach(s => {
      c.font = s.red ? redf : base; c.fillStyle = (l.head && o.headColor) ? o.headColor : s.red ? T.red : T.text;
      if (shadowOn) { c.shadowColor = 'rgba(0,0,0,.6)'; c.shadowBlur = 12; c.shadowOffsetY = 3; }
      c.fillText(s.t, px, cy); if (shadowOn) { c.shadowColor = 'transparent'; c.shadowBlur = 0; c.shadowOffsetY = 0; }
      px += tw(s.red ? redf : base, s.t);
    });
    y += l.h; if (lines[i + 1] && lines[i + 1].pi !== l.pi) y += l.size * o.paraGap;
  });
}
const plain = p => p.map(r => r.t).join('');

// ---------- 現場版 ----------
function liveOpts(isTitle, v) {
  return {
    headRule: (pi, ps) => (v === 'spark' || v === 'solid') ? false : isTitle ? pi === 0 : (pi === 0 && ps.length > 1 && plain(ps[0]).length <= 28),
    headScale: isTitle ? 1.9 : 1.16, lineGap: S.lineGap || 1.1 * LN, paraGap: .45, shadow: S.shadow,
  };
}
function liveCfg(slide, isTitle, v) {
  const m = Object.assign({ dx: 0, dy: 0, w: null, align: null }, S.live, (slide && slide.lv) || {});
  return { dx: m.dx, dy: m.dy, w: m.w || (isTitle ? 1500 : v === 'spark' ? 1300 : 1560), userW: !!m.w, align: m.align || null };
}
// 每種版型、每套背景的「裝飾占用區」：文字自動避開
function safeOf(T, v, idx = 0) {
  const tp = T.ownVariants
    ? { title: [230, 120], band: [140, 90], rule: [90, 170], brackets: [130, 130], spark: [110, 100], num: [90, 150], plain: [90, 170], spot: [110, 110], flip: [170, 90] }
    : { title: [110, 110], band: [100, 100], rule: [90, 170], brackets: [130, 130], spark: [110, 110], num: [90, 100], plain: [90, 90], spot: [110, 110], flip: [90, 90] };
  Object.assign(tp, { zoom: [90, 90], solid: [90, 90], side: [90, 90], card: [190, 190] });
  const [t, b] = tp[v] || [100, 100]; let e = T.safe || {};
  if (v === 'flip') e = { t: e.t, b: e.b, l: e.r, r: e.l };
  if (v === 'zoom' || v === 'solid' || v === 'card') e = {};
  let l = e.l || 0, r = e.r || 0;
  if (v === 'side') { if (idx % 2 === 0) l = Math.max(l, 470); else r = Math.max(r, 470); }
  return { t: Math.max(t, e.t || 0), b: Math.max(b, e.b || 0), l, r };
}
function picSafe(slide, sf) {
  const ps = slide.pics; if (!ps || !ps.length) return sf;
  const minX = Math.min(...ps.map(p => p.x)) * W, maxX = Math.max(...ps.map(p => p.x + p.w)) * W; if (maxX - minX > .7 * W) return sf;
  const o = Object.assign({}, sf);
  if ((minX + maxX) / 2 > W / 2) o.r = Math.max(sf.r, 1560 - (minX - 220)); else o.l = Math.max(sf.l, maxX + 60 - 160);
  return o;
}
function stripLead(runs, n) {
  const out = []; let left = n;
  for (const r of runs) { if (left >= r.t.length) { left -= r.t.length; continue; } out.push({ t: r.t.slice(left), red: r.red }); left = 0; }
  return out.length ? out : [{ t: ' ', red: false }];
}
// 整份簡報的統一字級：每頁各自算出「放得下的最大字級」，取中位數，讓相鄰頁面字級一致；太長的頁面才個別縮小
let _deck = { sig: '', val: 80 };
function deckSize() {
    const sig = [S.themeKey, S.autoVary, JSON.stringify(S.bgAll), S.custom ? 1 : 0, S.lineGap, JSON.stringify(S.fonts), S.live.w || '', S.slides.map((s, i) => (s.variant || '') + '|' + (s.fs || 1) + '|' + (s.bg ? s.bg.t : '') + '|' + s.paras.map(ptext).join('/')).join('#')].join('~');
  if (sig === _deck.sig) return _deck.val;
  const fits = [];
  S.slides.forEach((sd, i) => {
    const v = autoVariant(sd, i); if (v === 'title' || v === 'spark' || v === 'solid') return;
    let paras = sd.paras, shift = 0;
    if (v === 'num') { const m = ptext(paras[0]).match(NUM_RE); if (m) { shift = 150; paras = paras.map((p, k) => k ? p : stripLead(p, m[0].length)); } }
    const sf = picSafe(sd, safeOf(slideTheme(curTheme(sd), v), v, i)), o = liveOpts(false, v), maxW = (S.live.w ? S.live.w : 1560 - sf.r - sf.l) - shift, maxH = H - sf.t - sf.b;
    if (v === 'side' && paras.length > 1 && plain(paras[0]).length <= 28) paras = paras.slice(1), o.headRule = () => false;
    let size = 80; for (; size >= 30; size -= 2) if (blockH(layout(paras, size, maxW, o), o) <= maxH) break;
    fits.push(size);
  });
  fits.sort((x, y) => x - y);
  const med = fits.length ? fits[Math.floor(fits.length / 2)] : 80;
  _deck = { sig, val: Math.max(30, Math.min(80, med)) };
  return _deck.val;
}
function drawLive(cv, slide, idx, noText) {
  const v = autoVariant(slide, idx), T = slideTheme(curTheme(slide), v), c = cv.getContext('2d');
  const isTitle = v === 'title', isSpark = v === 'spark' || v === 'solid';
  c.clearRect(0, 0, W, H);
  c.drawImage(getBg(v, idx, slide), 0, 0);
  (slide.pics || []).forEach(p => {
    const e = imgCache.get(p.src); if (!e) return; const im = e.im, cr = p.crop || { l: 0, t: 0, r: 0, b: 0 };
    c.save(); c.shadowColor = 'rgba(0,0,0,.28)'; c.shadowBlur = 26; c.shadowOffsetY = 8;
    c.drawImage(im, im.width * cr.l, im.height * cr.t, im.width * (1 - cr.l - cr.r), im.height * (1 - cr.t - cr.b), p.x * W, p.y * H, p.w * W, p.h * H); c.restore();
  });
  const o = liveOpts(isTitle, v), fs = slide.fs || 1, L = liveCfg(slide, isTitle, v), sf = picSafe(slide, safeOf(T, v, idx));
  let paras = slide.paras, numeral = null, panel = null;
  if (v === 'side' && paras.length > 1 && plain(paras[0]).length <= 28) {
    const left = idx % 2 === 0, pw = 560, ho = { headRule: () => true, headScale: 1, lineGap: o.lineGap, paraGap: .3 };
    let hs = 76, hl; for (; hs >= 40; hs -= 2) { hl = layout([paras[0]], hs, pw - 130, ho); if (blockH(hl, ho) <= H - 380) break; }
    const hh = blockH(hl, ho), lt = lumOf(T.accent) > .55;
    panel = { lines: hl, x: (left ? 0 : W - pw) + 65, y: (H - hh) / 2, o: ho, w: pw - 130, T: Object.assign({}, T, { text: lt ? '#1E1914' : '#FBF6EC', red: lt ? '#B3261E' : '#FFD27A' }) };
    paras = paras.slice(1); o.headRule = () => false;
  }
  if (v === 'num') {
    const m = ptext(paras[0]).match(NUM_RE);
    if (m) { numeral = /[１-９]/.test(m[1]) ? String(m[1].charCodeAt(0) - 0xFF10) : m[1]; paras = paras.map((p, i) => i ? p : stripLead(p, m[0].length)); }
  }
  const shift = numeral ? 150 : 0, maxW = (L.userW ? L.w : L.w - sf.r - sf.l) - shift, maxH = H - sf.t - sf.b;
  const base = isTitle ? 56 : isSpark ? 100 : deckSize() * S.deckScale;
  let size = Math.round(base * fs), lines;
  for (; size >= 30; size -= 2) { lines = layout(paras, size, maxW, o); if (blockH(lines, o) <= maxH) break; }
  const h = blockH(lines, o);
  // 自動對齊：標題、重點句、只有一小段的頁面置中，其餘靠左
  const auto = (isTitle || isSpark || (paras.length <= 1 && lines.length <= 2)) ? 'center' : 'left', align = L.align || auto;
  slide._autoAlign = align;
  const x = (align === 'left' && !isTitle && !isSpark ? 160 + sf.l : (W - maxW - shift) / 2 + (sf.l - sf.r) / 2) + L.dx + shift;
  const y = ((S.anchor === 'top' && !isTitle && !isSpark) ? sf.t + 24 : Math.max(sf.t, sf.t + (maxH - h) / 2 - 6)) + L.dy;
  const numSize = numeral ? Math.round(lines[0].size * 2.1) : 0, numX = x - shift + 6, numY = numeral ? y + lines[0].h / 2 + lines[0].size * .1 : 0;
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
  return { shrunk: size < Math.round(base * fs) && size < 48, geo: { lines, x, y, o, align, maxW, T, numeral, numX, numY, numSize, extra: panel ? [panel] : [] } };
}

// ---------- 長條版 ----------
const STRIP = { padL: 100, padR: 140, padT: 46, padB: 46, maxH: 340 };
function stripOpts() {
  return { headRule: (pi, ps) => pi === 0 && ps.length > 1, headScale: 1.2, lineGap: Math.max(1.2, (S.lineGap || 1.1 * LN) - .2), paraGap: .3 };
}
function stripPages(slide) {
  if (!slide.paras.length) return { pages: [], o: stripOpts(), cardW: Math.round(W * S.stripW) };
  // 先把字條變寬（最寬到畫面的 96%）、再縮字，盡量讓一段內容放在同一條；真的放不下才分成多條
  const o = stripOpts(), sfs = slide.sfs || 1, pv = STRIP.padT + STRIP.padB;
  const base = Math.round(W * S.stripW), wide = Math.round(W * .96);
  const widths = [base]; for (let k = 1; k <= 3; k++) { const w = Math.round(base + (wide - base) * k / 3); if (w > widths[widths.length - 1]) widths.push(w); }
  const attempt = (cardW, minSize) => {
    const tw_ = cardW - STRIP.padL - STRIP.padR;
    for (let size = Math.round(46 * sfs); size >= minSize; size -= 2) {
      const lines = layout(slide.paras, size, tw_, o);
      if (blockH(lines, o) + pv <= STRIP.maxH) return { pages: [lines], o, cardW };
    }
    return null;
  };
  for (const w of widths) { const r = attempt(w, 40); if (r) return r; }
  const r2 = attempt(wide, 30); if (r2) return r2;
  const tw2 = wide - STRIP.padL - STRIP.padR, lines = layout(slide.paras, 30, tw2, o), pages = []; let cur = [];
  for (const ln of lines) {
    if (cur.length && blockH(cur.concat([ln]), o) + pv > STRIP.maxH) { pages.push(cur); cur = []; }
    cur.push(ln);
  }
  if (cur.length) pages.push(cur);
  return { pages, o, cardW: wide };
}
// 線上版字條：跟現場版同一套設計（同樣的紙紋／底圖、配色、裝飾），不再是另一種風格的白卡片
const _scCache = new Map();
function stripCard(T, cw, h) {
  const key = [T.key, cw, h, S.custom ? S.custom.src.length : '', dimOf(), S.bgAll ? S.bgAll.c : ''].join('|');
  if (_scCache.has(key)) return _scCache.get(key);
  const sc = 2, c = mk(cw * sc, h * sc), x = c.getContext('2d'); x.scale(sc, sc);
  x.save(); rrect(x, 0, 0, cw, h, T.P ? 4 : T.card.radius); x.clip();
  if (T.P) {
    const tmp = mk(W, H), tx = tmp.getContext('2d'), seed = T.P.k.length * 131 + T.P.n.length * 17;
    paperBase(tx, T.P, seed); tornStrip(tx, T.P, 'top', 22, seed + 8); tornStrip(tx, T.P, 'bottom', 26, seed + 9);
    const top = Math.ceil(h / 2), bot = h - top;
    x.drawImage(tmp, 0, 0, cw, top, 0, 0, cw, top); x.drawImage(tmp, 0, H - bot, cw, bot, 0, top, cw, bot);
  } else {
    const bg = getBg('plain', 0), sx = Math.max(0, (W - cw) / 2), sy = Math.max(0, Math.min(H - h, (H - h) / 2));
    x.drawImage(bg, sx, sy, Math.min(cw, W), h, 0, 0, Math.min(cw, W), h);
    x.globalAlpha = T.dark ? .55 : .5; x.fillStyle = T.card.fill; x.fillRect(0, 0, cw, h); x.globalAlpha = 1;
  }
  x.restore();
  const T2 = Object.assign({}, T, { card: Object.assign({}, T.card, { alpha: 0, grain: false }) });
  x.drawImage(drawCard(T2, cw, h, 1), 0, 0, cw, h);
  if (_scCache.size > 40) _scCache.clear(); _scCache.set(key, c); return c;
}
function drawStrip(cv, slide, page, noText) {
  const T = curTheme(), c = cv.getContext('2d');
  c.clearRect(0, 0, W, H);
  const { pages, o, cardW } = stripPages(slide);
  if (!pages.length) { drawStrip.geo = { lines: [], x: 0, y: 0, o, w: 0, T }; return 0; }
  page = Math.min(page, pages.length - 1);
  const lines = pages[page], h = Math.round(blockH(lines, o) + STRIP.padT + STRIP.padB);
  const x0 = Math.max(0, Math.min(W - cardW, Math.round((W - cardW) / 2) + S.stripX)), y0 = Math.max(0, H - h - S.stripY);
  const card = stripCard(T, cardW, h);
  c.save(); c.shadowColor = 'rgba(0,0,0,.35)'; c.shadowBlur = 24; c.shadowOffsetY = 8;
  c.drawImage(card, x0, y0, cardW, h); c.restore();
  if (!noText) drawLines(c, lines, x0 + STRIP.padL, y0 + STRIP.padT, o, T);
  drawStrip.geo = { lines, x: x0 + STRIP.padL, y: y0 + STRIP.padT, o, w: cardW - STRIP.padL - STRIP.padR, T };
  return pages.length;
}

// ---------- 解析 pptx ----------
async function shrinkImg(src, mime) {
  const e = await loadBgImg(src); if (!e) return src;
  const im = e.im, m = Math.max(im.width, im.height); if (m <= 1600 && src.length < 900000) return src;
  const sc = Math.min(1, 1600 / m), c = mk(Math.round(im.width * sc), Math.round(im.height * sc)); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
  return mime === 'image/png' ? c.toDataURL('image/png') : c.toDataURL('image/jpeg', .85);
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
      const off = sp.getElementsByTagName('a:off')[0];
      const y = off ? +off.getAttribute('y') : -1, x = off ? +off.getAttribute('x') : 0;
      const paras = [];
      [...tb.getElementsByTagName('a:p')].forEach(p => {
        const runs = [];
        [...p.childNodes].forEach(n => {
          if (n.nodeName === 'a:br') { runs.push({ t: ' ', red: false }); return; }
          if (n.nodeName !== 'a:r') return;
          const t = (n.getElementsByTagName('a:t')[0] || {}).textContent || '';
          const clr = n.getElementsByTagName('a:srgbClr')[0];
          let red = false;
          if (clr) { const v = clr.getAttribute('val'), r = parseInt(v.slice(0, 2), 16), g = parseInt(v.slice(2, 4), 16), b = parseInt(v.slice(4, 6), 16); red = r > 150 && g < 90 && b < 90; }
          const last = runs[runs.length - 1];
          if (last && last.red === red) last.t += t; else runs.push({ t, red });
        });
        if (runs.map(r => r.t).join('').trim()) paras.push(runs);
      });
      if (paras.length) items.push({ y, x, order, paras });
    });
    items.sort((a, b) => (a.y - b.y) || (a.x - b.x) || (a.order - b.order));
    const paras = items.flatMap(i => i.paras);
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
  const all = new Set(); S.slides.forEach(s => s.paras.forEach(p => p.forEach(r => [...r.t].forEach(ch => all.add(ch)))));
  const fresh = [...all].filter(ch => !loadedChars.has(ch)); if (!fresh.length) return false;
  const sample = fresh.join(''); fresh.forEach(ch => loadedChars.add(ch));
  const jobs = [400, 500, 700].map(w => document.fonts.load(`${w} 40px "Noto Sans TC"`, sample)).concat([document.fonts.load('700 40px "Noto Serif TC"', sample)]);
  for (const id of [S.fonts.head, S.fonts.body, S.fonts.scr]) { const o = fontOpt(id); if (o) [o.w, o.rw].forEach(w => jobs.push(document.fonts.load(`${w} 40px ${o.stack}`, sample))); }
  try { await Promise.allSettled(jobs); } catch (e) { }
  wcache.clear(); return true;
}

// ---------- UI 繪製 ----------
const thumbCv = new Map();
function renderMain() {
  const sl = S.slides[S.sel]; if (!sl) return;
  const r = drawLive($('cvLive'), sl, S.sel); S.liveGeo = r.geo;
  $('capLive').textContent = S.view === 'live' && r.shrunk ? '字多，已自動縮小' : '';
  const n = drawStrip($('cvStrip'), sl, S.page);
  $('miniLive').getContext('2d').drawImage($('cvLive'), 0, 0, 320, 180); const mc = $('miniStrip').getContext('2d'); mc.clearRect(0, 0, 320, 180); mc.drawImage($('cvStrip'), 0, 0, 320, 180);
  const pg = $('pages'); pg.innerHTML = '';
  if (S.view === 'strip' && n > 1) for (let i = 0; i < n; i++) { const b = document.createElement('button'); b.className = 'pill' + (i === S.page ? ' sel' : ''); b.textContent = `第${i + 1}張`; b.onclick = () => { S.page = i; renderMain(); }; pg.appendChild(b); }
  renderThumb(S.sel); syncVariantUI();
}
function syncVariantUI() {
  const sl = S.slides[S.sel], sel = $('variantSel'); if (!sl || !sel) return;
  const auto = autoVariant(Object.assign({}, sl, { variant: 'auto' }), S.sel);
  if (!sel.options.length) Object.entries(VARIANT_LABELS).forEach(([k, t]) => { const o = document.createElement('option'); o.value = k; o.textContent = t; sel.appendChild(o); });
  sel.options[0].textContent = `自動（${VARIANT_LABELS[auto]}）`; sel.value = sl.variant || 'auto';
}
function renderThumb(i) {
  const cv = thumbCv.get(i); if (!cv) return;
  const full = mk(W, H); drawLive(full, S.slides[i], i);
  const c = cv.getContext('2d'); c.drawImage(full, 0, 0, cv.width, cv.height);
  const badge = cv.parentElement.querySelector('.badge'); const n = stripPages(S.slides[i]).pages.length;
  badge.textContent = `長條×${n}`; badge.hidden = n < 2;
  const fl = cv.parentElement.querySelector('.flag'); if (fl) fl.hidden = !S.slides[i].bg;
}
function buildList() {
  const list = $('list'); list.innerHTML = ''; thumbCv.clear();
  S.slides.forEach((sl, i) => {
    const d = document.createElement('div'); d.className = 'thumb' + (i === S.sel ? ' sel' : '');
    d.innerHTML = `<canvas width="400" height="225"></canvas><span class="n">${i + 1}</span><span class="badge" hidden></span><span class="flag" hidden>單頁背景</span>`;
    d.onclick = () => select(i); list.appendChild(d); thumbCv.set(i, d.querySelector('canvas'));
  });
  let i = 0; const step = () => { if (i < S.slides.length) { renderThumb(i++); setTimeout(step, 0); } }; step();
}
function select(i) {
  S.sel = i; S.page = 0;
  document.querySelectorAll('.thumb').forEach((d, k) => d.classList.toggle('sel', k === i));
  const sl = S.slides[i];
  $('txt').value = sl.paras.map(paraToStr).join('\n');
  $('fs').value = Math.round((sl.fs || 1) * 100); $('sfs').value = Math.round((sl.sfs || 1) * 100);
  syncOut(); renderMain(); syncSlideBgUI();
  const th = document.querySelectorAll('.thumb')[i]; if (th) th.scrollIntoView({ block: 'nearest' });
}
const VIEW_HINT = {
  live: '現場版：投在教會大螢幕的整頁畫面。點一下文字就能在那裡換行（再點一次取消），拖曳可以移動文字。',
  strip: '線上版：直播時疊在影像上，背景透明，只有一條字幕。點一下文字就能在那裡換行，拖曳可以移動字幕條。',
};
function setView(v) {
  S.view = v;
  document.querySelectorAll('.view').forEach(b => b.classList.toggle('on', b.dataset.v === v));
  $('frameLive').hidden = v !== 'live'; $('frameStrip').hidden = v !== 'strip';
  $('posLive').hidden = v !== 'live'; $('posStrip').hidden = v !== 'strip';
  $('viewHint').textContent = VIEW_HINT[v]; renderMain();
}
function syncLiveUI() {
  $('deckScale').value = Math.round(S.deckScale * 100); $('deckScaleO').textContent = Math.round(S.deckScale * 100) + '%';
  document.querySelectorAll('#anchorRow .pill').forEach(b => b.classList.toggle('sel', b.dataset.an === S.anchor));
  const sl = S.slides[S.sel]; if (!sl) return;
  const vv = autoVariant(sl, S.sel), L = liveCfg(sl, vv === 'title', vv);
  $('lvX').value = L.dx; $('lvXO').textContent = L.dx; $('lvY').value = L.dy; $('lvYO').textContent = L.dy; $('lvW').value = L.w; $('lvWO').textContent = L.w;
  const al = L.align || sl._autoAlign || 'left'; document.querySelectorAll('#lvAlign .pill').forEach(b => b.classList.toggle('sel', b.dataset.a === al));
  document.querySelectorAll('#lvScope .pill').forEach(b => b.classList.toggle('sel', b.dataset.s === S.liveScope));
}
function editLive(key, val) {
  if (S.liveScope === 'slide') { const sl = S.slides[S.sel]; sl.lv = sl.lv || {}; sl.lv[key] = val; }
  else { S.live[key] = val; S.slides.forEach(s => { if (s.lv) delete s.lv[key]; }); }
  syncLiveUI(); redrawSoon();
}
function syncOut() {
  syncLiveUI();
  $('fsO').textContent = $('fs').value + '%'; $('sfsO').textContent = $('sfs').value + '%';
  $('lineGapO').textContent = (S.lineGap ? S.lineGap / LN : 1.1).toFixed(2); $('lineGap').value = S.lineGap ? S.lineGap / LN : 1.1; $('stripXO').textContent = S.stripX; $('stripX').value = S.stripX; $('stripY').value = S.stripY; $('stripYO').textContent = S.stripY; $('stripWO').textContent = Math.round(S.stripW * 100) + '%';
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
function afterThemeChange() { bgCache.clear(); buildThemes(); buildList(); renderMain(); save(); }
function clearCustom(redraw = true) { S.custom = null; try { localStorage.removeItem('ppt-web-bg'); } catch (e) { } syncBgUi(); if (redraw) afterThemeChange(); }
function syncBgUi() {
  const has = !!S.custom;
  $('bgCtl').hidden = !has; $('bgThumb').hidden = !has; $('bgUp').classList.toggle('has', has);
  $('btnBg').textContent = has ? '換一張圖…' : '選一張圖…';
  $('bgHint').textContent = has ? '已套用到每一頁，重新整理也會記住' : '每一頁都會用這張圖，自動壓暗讓字清楚';
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
    add(first, k === 'scr' ? '跟內文一樣' : '跟著背景主題');
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
const styleObj = () => ({ themeKey: S.themeKey, stripW: S.stripW, stripY: S.stripY, stripX: S.stripX, lineGap: S.lineGap, fonts: S.fonts, autoExport: S.autoExport, exportFmt: S.exportFmt, deckScale: S.deckScale, anchor: S.anchor, shadow: S.shadow, blocks: S.blocks, autoVary: S.autoVary, bgAll: S.bgAll, localFonts: S.localFonts.map(f => ({ name: f.name, fam: f.fam })) });
async function applyStyle(v) {
  if (!v) return;
  Object.assign(S, { themeKey: THEMES[v.themeKey] ? v.themeKey : 'torn_kraft', stripW: v.stripW || .81, stripY: v.stripY == null ? 64 : v.stripY, stripX: v.stripX || 0, lineGap: v.lineGap || null, autoExport: !!v.autoExport, exportFmt: v.exportFmt || 'image', deckScale: v.deckScale || 1, anchor: v.anchor || 'middle', shadow: !!v.shadow, blocks: !!v.blocks, autoVary: v.autoVary !== false, bgAll: v.bgAll || null });
  if (v.fonts) S.fonts = v.fonts;
  for (const f of (v.localFonts || [])) await registerLocal(f.name, f.fam);
  $('optShadow').checked = !!S.shadow; $('optBlocks').checked = !!S.blocks;
  $('stripW').value = Math.round(S.stripW * 100); $('autoExport').checked = S.autoExport; $('exportFmt').value = S.exportFmt; $('deckScale').value = Math.round(S.deckScale * 100);
  buildFontSelects(); buildThemes(); syncOut();
}
function showStyleNote(has) {
  $('styleNote').hidden = !has; if (has) $('styleNoteT').textContent = `已記住你上次的設定（背景：${THEMES[S.themeKey].name}），新檔案會自動套用。`;
}
// ---------- 儲存 ----------
let saveT;
function save() {
  clearTimeout(saveT); saveT = setTimeout(() => {
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
  S.slides = slides; S.live = live || {}; S.sel = 0; S.page = 0; S.fileName = name.replace(/\.pptx$/i, '');
  $('drop').hidden = true; $('editor').hidden = false; $('viewHint').textContent = VIEW_HINT[S.view]; $('sideEmpty').hidden = true; $('sideBody').hidden = false; $('btnExport').disabled = false; $('btnZip').disabled = false;
  await Promise.all(slides.flatMap(x => [].concat(x.bg && x.bg.t === 'img' ? [x.bg.src] : [], (x.pics || []).map(p => p.src))).map(loadBgImg));
  await ensureFonts(); bgCache.clear(); buildCats(); buildThemes(); buildList(); select(0); save();
}
async function loadFile(f) {
  try { const slides = await parsePptx(await f.arrayBuffer()); if (!slides.length) throw new Error('empty'); await start(slides, f.name); toast(`已讀入 ${slides.length} 頁`); if (S.autoExport) await exportByFormat().catch(e => { console.error(e); $('prog').style.display = 'none'; toast('匯出失敗：' + e.message); }); }
  catch (e) { console.error(e); toast('讀不到這個檔案，請確認是 .pptx 格式'); }
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
function prog(t, p) { $('prog').style.display = 'flex'; $('progT').textContent = t; $('progB').style.width = (p * 100) + '%'; }
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
    if (wantZip) zip.file(`現場圖片/現場_${name}.jpg`, jb);
    pL.addSlide().addImage({ data: await dataOf(jb), x: 0, y: 0, w: 13.333, h: 7.5 });
    const n = stripPages(S.slides[i]).pages.length;
    for (let p = 0; p < n; p++) {
      drawStrip(cv, S.slides[i], p);
      const pb = await blobOf(cv, 'image/png');
      if (wantZip) zip.file(`長條圖片/長條_${name}${n > 1 ? '_' + 'abcdefgh'[p] : ''}.png`, pb);
      pS.addSlide().addImage({ data: await dataOf(pb), x: 0, y: 0, w: 13.333, h: 7.5 });
    }
    done++;
  }
  prog('正在打包 pptx…', .95); await sleep(30);
  const liveName = `${S.fileName}_現場版_給ProPresenter.pptx`, stripName = `${S.fileName}_線上長條版_給ProPresenter.pptx`;
  const liveBlob = await pL.write({ outputType: 'blob' }), stripBlob = await pS.write({ outputType: 'blob' });
  if (!wantZip) {
    $('prog').style.display = 'none'; download(liveBlob, liveName); await sleep(500); download(stripBlob, stripName);
    toast('完成！已下載兩個 pptx（現場版、線上長條版）'); return [liveBlob, stripBlob];
  }
  zip.file(liveName, liveBlob); zip.file(stripName, stripBlob);
  const out = await zip.generateAsync({ type: 'blob' });
  $('prog').style.display = 'none'; download(out, `${S.fileName}_輸出.zip`); toast('完成！已下載 zip');
  return out;
}

// ---------- 可編輯文字版 pptx ----------
const PX_IN = 144, inch = px => +(px / PX_IN).toFixed(4), ptOf = px => +(px * .5).toFixed(2), hexNo = c => String(c).replace('#', '');
function textGroups(lines, y, o) {
  const gs = []; let cur = null;
  lines.forEach((l, i) => {
    if (!cur || cur.pi !== l.pi) { cur = { pi: l.pi, y, size: l.size, head: l.head, scr: l.scr, lines: [], h: 0 }; gs.push(cur); }
    cur.lines.push(l); cur.h += l.h; y += l.h;
    if (lines[i + 1] && lines[i + 1].pi !== l.pi) y += l.size * o.paraGap;
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
        const key = s.red ? 'r' : 't';
        if (last && last.key === key && !last.fresh) { last.run.text += s.t; return; }
        const opt = { color: hexNo((g.head && o.headColor) ? o.headColor : s.red ? T.red : T.text), bold: f.bold || !!s.red, fontFace: f.face };
        if (li > 0 && !last) opt.softBreakBefore = true;
        const run = { text: s.t, options: opt }; runs.push(run); last = { key, run };
      });
    });
    const slack = w * .14, bx = align === 'center' ? x - slack / 2 : align === 'right' ? x - slack : x;
    sl.addText(runs, { x: inch(bx), y: inch(g.y), w: inch(w + slack), h: inch(g.h), margin: 0, valign: 'top', align, fontSize: ptOf(g.size), lineSpacingMultiple: +(g.lines[0].h / (g.size * LN)).toFixed(2), wrap: true, fit: 'none', ...(sh ? { shadow: { type: 'outer', color: '000000', opacity: .6, blur: 6, offset: 2, angle: 90 } } : {}) });
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
    addTextGroups(sl, g.lines, g.y, g.o, g.x, g.maxW, g.align, g.T);
    (g.extra || []).forEach(e => addTextGroups(sl, e.lines, e.y, e.o, e.x, e.w, 'left', e.T));
    if (g.numeral) { const hh = g.numSize * 1.3; sl.addText(g.numeral, { x: inch(g.numX - 6), y: inch(g.numY - hh / 2), w: 1.1, h: inch(hh), margin: 0, valign: 'middle', align: 'left', fontSize: ptOf(g.numSize), italic: true, bold: true, fontFace: 'Noto Serif TC', color: hexNo(g.T.accent) }); }
    const n = stripPages(sd).pages.length;
    for (let p = 0; p < n; p++) {
      drawStrip(cv, sd, p, true); const sg = drawStrip.geo;
      const ss = pS.addSlide(); ss.addImage({ data: await dataOf(await blobOf(cv, 'image/png')), x: 0, y: 0, w: 13.333, h: 7.5 });
      addTextGroups(ss, sg.lines, sg.y, sg.o, sg.x, sg.w, 'left', sg.T);
    }
  }
  prog('正在打包 pptx…', .95); await sleep(30);
  const a = await pL.write({ outputType: 'blob' }), b = await pS.write({ outputType: 'blob' });
  $('prog').style.display = 'none'; download(a, `${S.fileName}_現場版_可編輯.pptx`); await sleep(500); download(b, `${S.fileName}_線上長條版_可編輯.pptx`);
  toast('完成！已下載兩個可編輯文字的 pptx'); return [a, b];
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
    drawLive($('sampleLive'), sl[1], 1); drawStrip($('sampleStrip'), sl[1], 0);
  } catch (e) { }
}
['dragover', 'dragenter'].forEach(ev => document.addEventListener(ev, e => { e.preventDefault(); $('drop').classList.add('over'); }));
['dragleave', 'drop'].forEach(ev => document.addEventListener(ev, e => { e.preventDefault(); $('drop').classList.remove('over'); }));
document.addEventListener('drop', e => { const f = e.dataTransfer.files[0]; if (f) loadFile(f); });

$('txt').oninput = async () => {
  const sl = S.slides[S.sel]; sl.paras = strToParas($('txt').value);
  if (!sl.paras.length) sl.paras = [[{ t: ' ', red: false }]];
  if (await ensureFonts()) buildList();
  redrawSoon();
};
$('btnRed').onclick = () => {
  const t = $('txt'), a = t.selectionStart, b = t.selectionEnd; if (a === b) { toast('先在文字框選取要變紅的字'); return; }
  t.value = t.value.slice(0, a) + '**' + t.value.slice(a, b) + '**' + t.value.slice(b); t.oninput();
};
$('btnAdd').onclick = () => { S.slides.splice(S.sel + 1, 0, { paras: [[{ t: '新的一頁', red: false }]], fs: 1, sfs: 1 }); buildList(); select(S.sel + 1); save(); };
$('btnDup').onclick = () => { S.slides.splice(S.sel + 1, 0, JSON.parse(JSON.stringify(S.slides[S.sel]))); buildList(); select(S.sel + 1); save(); };
$('btnDel').onclick = () => {
  if (S.slides.length < 2) { toast('至少要留一頁'); return; }
  S.slides.splice(S.sel, 1); buildList(); select(Math.min(S.sel, S.slides.length - 1)); save();
};
$('fs').oninput = () => { S.slides[S.sel].fs = $('fs').value / 100; syncOut(); redrawSoon(); };
$('sfs').oninput = () => { S.slides[S.sel].sfs = $('sfs').value / 100; syncOut(); redrawSoon(); };
$('lineGap').oninput = () => { S.lineGap = +$('lineGap').value * LN; wcache.clear(); syncOut(); S.page = 0; redrawSoon(); };
$('lineGapReset').onclick = () => { S.lineGap = null; $('lineGap').value = 1.1; wcache.clear(); syncOut(); S.page = 0; redrawSoon(); };
$('stripY').oninput = () => { S.stripY = +$('stripY').value; syncOut(); redrawSoon(); };
$('stripW').oninput = () => { S.stripW = $('stripW').value / 100; syncOut(); S.page = 0; redrawSoon(); };
$('stripW').onchange = () => buildList();
const runExport = mode => exportAll(mode).catch(e => { console.error(e); $('prog').style.display = 'none'; toast('匯出失敗：' + e.message); });
$('btnExport').onclick = () => exportByFormat().catch(e => { console.error(e); $('prog').style.display = 'none'; toast('匯出失敗：' + e.message); }); $('btnZip').onclick = () => runExport('zip');

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
  document.querySelectorAll('#bgScope button').forEach(x => x.classList.toggle('on', x.dataset.s === S.bgScope));
  $('scopeSlideBtn').textContent = sl ? `只有這一頁（第 ${S.sel + 1} 頁）` : '只有這一頁';
  $('scopeHint').textContent = slideMode ? `下面的選擇只會改第 ${S.sel + 1} 頁，其他頁不變。` : '下面的選擇會套用到每一頁。想只改某一頁，先點左邊那一頁，再按「只有這一頁」。';
  $('bgVaryRow').hidden = slideMode; $('bgLayoutRow').hidden = !slideMode; $('bgAllImg').hidden = slideMode; $('bgSlideImg').hidden = !slideMode;
  $('bgResetRow').hidden = !(slideMode && sl && sl.bg);
  $('optVary').checked = S.autoVary !== false;
  const b = sl && sl.bg; $('slBgImg').hidden = !(b && b.t === 'img');
  if (b && b.t === 'img') { const d = Math.round((b.dim == null ? .45 : b.dim) * 100); $('slBgDim').value = d; $('slBgDimO').textContent = d + '%'; }
  markBgSel();
}
function setSlideBg(b) {
  const sl = S.slides[S.sel]; if (!sl) return;
  if (b) sl.bg = b; else delete sl.bg;
  syncSlideBgUI(); renderMain(); renderThumb(S.sel); save();
}
function applyTheme(k) {
  if (S.bgScope === 'slide') return setSlideBg({ t: 'theme', k });
  S.themeKey = k; S.bgAll = null; clearCustom(false);
  ensureFonts().then(() => { loadedChars.clear(); return ensureFonts(); }).then(afterThemeChange);
}
function applyColor(c) {
  if (S.bgScope === 'slide') return setSlideBg({ t: 'color', c });
  S.bgAll = { t: 'color', c }; clearCustom(false); afterThemeChange();
}
(function buildBgPanel() {
  const box = $('bgSwatches');
  SW.forEach(c => { const b = document.createElement('button'); b.className = 'sw'; b.dataset.c = c; b.style.background = c; b.title = c; b.onclick = () => applyColor(c); box.appendChild(b); });
  const pick = document.createElement('input'); pick.type = 'color'; pick.value = '#F4EFE6'; pick.title = '自選顏色'; pick.onchange = () => applyColor(pick.value); box.appendChild(pick);
  document.querySelectorAll('#bgScope button').forEach(b => b.onclick = () => { S.bgScope = b.dataset.s; syncSlideBgUI(); });
  $('slBgReset').onclick = () => setSlideBg(null);
  $('slBgPick').onclick = () => $('slBgFile').click();
  $('slBgFile').onchange = e => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    const im = new Image();
    im.onload = async () => {
      const c = mk(1280, 720), x = c.getContext('2d'), sc = Math.max(1280 / im.width, 720 / im.height);
      x.drawImage(im, (1280 - im.width * sc) / 2, (720 - im.height * sc) / 2, im.width * sc, im.height * sc);
      const src = c.toDataURL('image/jpeg', .78); await loadBgImg(src);
      const cur = S.slides[S.sel].bg; setSlideBg({ t: 'img', src, dim: cur && cur.t === 'img' && cur.dim != null ? cur.dim : .45 });
    };
    im.src = URL.createObjectURL(f);
  };
  $('slBgDim').oninput = () => { const sl = S.slides[S.sel]; if (sl.bg && sl.bg.t === 'img') { sl.bg.dim = $('slBgDim').value / 100; $('slBgDimO').textContent = $('slBgDim').value + '%'; redrawSoon(); } };
  $('optShadow').onchange = () => { S.shadow = $('optShadow').checked; redrawSoon(); };
  $('optBlocks').onchange = () => { S.blocks = $('optBlocks').checked; redrawSoon(); };
  $('optVary').onchange = () => { S.autoVary = $('optVary').checked; bgCache.clear(); redrawSoon(); buildList(); syncVariantUI(); save(); };
})();

// ---------- 啟動：還原上次內容 ----------
$('fontHead').onchange = e => { S.fonts.head = e.target.value; afterFontChange(); };
$('fontBody').onchange = e => { S.fonts.body = e.target.value; afterFontChange(); };
$('fontScr').onchange = e => { S.fonts.scr = e.target.value; afterFontChange(); };
$('btnLocalAdd').onclick = async () => { const f = await addLocalFontByName($('localName').value); if (f && f.ok) { $('localName').value = ''; save(); } };
$('localName').onkeydown = e => { if (e.key === 'Enter') $('btnLocalAdd').click(); };
$('localFilter').oninput = renderLocalList;
if (!window.queryLocalFonts) $('btnLocalPick').hidden = true;
$('btnLocalPick').onclick = async () => {
  try { _localAll = await window.queryLocalFonts(); $('localFilter').hidden = false; renderLocalList(); }
  catch (e) { toast('沒有取得字型清單的權限，可以改用輸入名稱'); }
};
$('variantSel').onchange = () => { const sl = S.slides[S.sel]; sl.variant = $('variantSel').value; syncOut(); renderMain(); save(); };
$('deckScale').oninput = () => { S.deckScale = $('deckScale').value / 100; syncOut(); redrawSoon(); };
document.querySelectorAll('#anchorRow .pill').forEach(b => b.onclick = () => { S.anchor = b.dataset.an; syncOut(); redrawSoon(); });
$('lvX').oninput = () => editLive('dx', +$('lvX').value);
$('lvY').oninput = () => editLive('dy', +$('lvY').value);
$('lvW').oninput = () => editLive('w', +$('lvW').value);
document.querySelectorAll('#lvAlign .pill').forEach(b => b.onclick = () => editLive('align', b.dataset.a));
document.querySelectorAll('#lvScope .pill').forEach(b => b.onclick = () => { S.liveScope = b.dataset.s; syncLiveUI(); });
$('lvReset').onclick = () => {
  if (S.liveScope === 'slide') delete S.slides[S.sel].lv; else { S.live = {}; S.slides.forEach(s => delete s.lv); }
  syncLiveUI(); redrawSoon();
};
function attachDrag(cv, get, set, hit) {
  let drag = null; cv.style.touchAction = 'none';
  const frame = cv.parentElement, guide = document.createElement('div'); guide.className = 'bkg'; guide.hidden = true; frame.appendChild(guide);
  const toCv = e => { const r = cv.getBoundingClientRect(), k = W / r.width; return [(e.clientX - r.left) * k, (e.clientY - r.top) * k]; };
  const hideGuide = () => { guide.hidden = true; cv.style.cursor = 'grab'; };
  cv.addEventListener('pointerdown', e => { if (!S.slides[S.sel]) return; drag = { x: e.clientX, y: e.clientY, s: get(), k: W / cv.getBoundingClientRect().width, moved: false, t: Date.now() }; cv.setPointerCapture(e.pointerId); hideGuide(); });
  cv.addEventListener('pointermove', e => {
    if (drag) { if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 5) drag.moved = true; if (drag.moved) { cv.style.cursor = 'grabbing'; set(drag.s, (e.clientX - drag.x) * drag.k, (e.clientY - drag.y) * drag.k); } return; }
    const h = hit && hit(...toCv(e));
    if (!h) return hideGuide();
    guide.hidden = false; guide.classList.toggle('rm', !!h.removing); cv.style.cursor = 'text';
    Object.assign(guide.style, { left: (h.x / W * 100) + '%', top: (h.y / H * 100) + '%', height: (h.h / H * 100) + '%' });
    cv.title = h.removing ? '點一下：取消這裡的換行' : '點一下：在這裡換行';
  });
  cv.addEventListener('pointerleave', () => { if (!drag) hideGuide(); });
  const end = e => {
    if (drag && !drag.moved && Date.now() - drag.t < 600 && hit && e.type === 'pointerup') { const h = hit(...toCv(e)); if (h) toggleBreak(h.pi, h.off); }
    drag = null; cv.style.cursor = 'grab';
  };
  cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
}
// ---------- 點畫面換行：在文字裡插入（或移除）一個「↵」，現場版、線上版、輸出都會照辦 ----------
function hitBreak(geo, cx, cy, align, gx, boxW) {
  const sl = S.slides[S.sel]; if (!sl || !geo || !geo.lines || !geo.lines.length) return null;
  let y = geo.y, best = null;
  geo.lines.forEach((l, i) => {
    const d = Math.abs(cy - (y + l.h / 2));
    if (d <= l.h * .75 && (!best || d < best.d)) best = { l, y, d };
    y += l.h; if (geo.lines[i + 1] && geo.lines[i + 1].pi !== l.pi) y += l.size * geo.o.paraGap;
  });
  if (!best) return null;
  const l = best.l, wt = l.head ? 700 : 500, base = fnt(wt, l.size, l.head, false, l.scr), redf = fnt(700, l.size, l.head, true, l.scr);
  let px = align === 'center' ? gx + (boxW - l.w) / 2 : align === 'right' ? gx + boxW - l.w : gx;
  const para = ptext(sl.paras[l.pi]), cands = [];
  l.segs.forEach((sg, si) => {
    const f = sg.red ? redf : base;
    for (let k = 0; k < sg.t.length; k++) {
      const off = sg.o + k, removing = para[off - 1] === '↵', first = si === 0 && k === 0;
      if (first && !removing) continue;
      cands.push({ x: px + tw(f, sg.t.slice(0, k)), off, removing });
    }
    px += tw(f, sg.t);
  });
  if (!cands.length) return null;
  const c = cands.reduce((a, b) => Math.abs(b.x - cx) < Math.abs(a.x - cx) ? b : a);
  return { pi: l.pi, off: c.off, removing: c.removing, x: c.x, y: best.y, h: l.h };
}
function toggleBreak(pi, off) {
  const sl = S.slides[S.sel], runs = sl.paras[pi]; if (!runs) return;
  const ch = []; runs.forEach(r => { for (let i = 0; i < r.t.length; i++) ch.push({ c: r.t[i], red: r.red }); });
  if (off > 0 && ch[off - 1] && ch[off - 1].c === '↵') ch.splice(off - 1, 1); else ch.splice(off, 0, { c: '↵', red: false });
  const out = []; ch.forEach(x => { const last = out[out.length - 1]; if (last && last.red === x.red) last.t += x.c; else out.push({ t: x.c, red: x.red }); });
  sl.paras[pi] = out.length ? out : [{ t: ' ', red: false }];
  $('txt').value = sl.paras.map(paraToStr).join('\n');
  _deck.sig = ''; wcache.clear(); renderMain(); renderThumb(S.sel); save();
}
attachDrag($('cvLive'), () => { const vv = autoVariant(S.slides[S.sel], S.sel), L = liveCfg(S.slides[S.sel], vv === 'title', vv); return { dx: L.dx, dy: L.dy }; },
  (s, mx, my) => { editLive('dx', clampN(snap4(s.dx + mx), -900, 900)); editLive('dy', clampN(snap4(s.dy + my), -600, 600)); },
  (cx, cy) => { const g = S.liveGeo; return g && hitBreak(g, cx, cy, g.align, g.x, g.maxW); });
attachDrag($('cvStrip'), () => ({ x: S.stripX, y: S.stripY }),
  (s, mx, my) => { S.stripX = clampN(snap4(s.x + mx), -700, 700); S.stripY = clampN(snap4(s.y - my), 0, 700); syncOut(); redrawSoon(); },
  (cx, cy) => { const g = drawStrip.geo; return g && g.lines && hitBreak(g, cx, cy, 'left', g.x, g.w); });
$('stripX').oninput = () => { S.stripX = +$('stripX').value; syncOut(); redrawSoon(); };
$('stripReset').onclick = () => { S.stripX = 0; S.stripY = 64; S.stripW = .81; $('stripY').value = 64; $('stripW').value = 81; S.page = 0; syncOut(); redrawSoon(); };
document.querySelectorAll('.view').forEach(b => b.onclick = () => setView(b.dataset.v));
$('exportFmt').onchange = () => { S.exportFmt = $('exportFmt').value; save(); };
$('autoExport').onchange = () => { S.autoExport = $('autoExport').checked; save(); };
$('styleClear').onclick = () => { try { localStorage.removeItem('ppt-web-style'); localStorage.removeItem('ppt-web-v1'); } catch (e) { } location.reload(); };
// 鍵盤切換頁面：上下鍵（或左右鍵、PageUp/PageDown）；在輸入框裡打字時不攔截，按 Esc 離開輸入框
document.addEventListener('keydown', e => {
  const t = e.target, tag = t.tagName, type = (t.type || '').toLowerCase();
  const typing = tag === 'TEXTAREA' || tag === 'SELECT' || (tag === 'INPUT' && !['range', 'checkbox', 'button'].includes(type));
  if (e.key === 'Escape' && typing) { t.blur(); return; }
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
    loadSavedBg();
    await renderEmptyPreview();
    if (v && v.slides && v.slides.length) {
      const b = document.createElement('button'); b.className = 'btn'; b.textContent = `繼續上次的「${v.fileName}」`;
      b.onclick = () => start(v.slides, v.fileName, v.live); $('btnSample').after(b);
    }
  } catch (e) { }
})();
