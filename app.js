'use strict';
// ---------- 狀態 ----------
const S = {
  slides: [], sel: 0, page: 0, themeKey: 'paper', stripW: 0.81, stripY: 64,
  custom: null, customMode: 'dark', fileName: '簡報',
  fonts: { head: 'theme', body: 'theme' }, localFonts: [], lineGap: null, live: {}, liveScope: 'all',
};
const $ = id => document.getElementById(id);
const measureCtx = mk(10, 10).getContext('2d');
const FONT = '"Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif';
const NO_START = new Set('，。、；：！？」』）》〉,.;:!?)”’…'.split(''));
const NO_END = new Set('「『（《〈([“‘'.split(''));

// ---------- 取得目前主題（含自訂背景圖）----------
function curTheme() {
  if (S.custom) {
    const base = THEMES[S.customMode === 'dark' ? 'dusk' : 'paper'];
    const light = S.customMode === 'light';
    return Object.assign({}, base, {
      name: '自訂背景', key: 'custom',
      bg(c) {
        const im = S.custom, sc = Math.max(W / im.width, H / im.height), w = im.width * sc, h = im.height * sc;
        c.drawImage(im, (W - w) / 2, (H - h) / 2, w, h);
        c.fillStyle = light ? 'rgba(255,255,255,.62)' : 'rgba(10,8,6,.58)'; c.fillRect(0, 0, W, H);
      }
    });
  }
  return Object.assign({ key: S.themeKey }, THEMES[S.themeKey]);
}
const bgCache = new Map();
function getBg(kind) {
  const t = curTheme(), key = t.key + kind + S.customMode + (S.custom ? S.custom.src.length : '');
  if (!bgCache.has(key)) { const c = mk(W, H); t.bg(c.getContext('2d'), kind); bgCache.set(key, c); }
  return bgCache.get(key);
}

// ---------- 文字排版 ----------
const wcache = new Map();
function tw(font, tok) {
  const k = font + '|' + tok; let v = wcache.get(k);
  if (v === undefined) { measureCtx.font = font; v = measureCtx.measureText(tok).width; wcache.set(k, v); }
  return v;
}
function tokenize(t) { return t.match(/[A-Za-z0-9:：.\-–—]+|[\s\S]/g) || []; }
const SERIF = '"Noto Serif TC","Songti TC","PMingLiU",serif';
const isSerif = () => !S.custom && !!THEMES[S.themeKey].serif;
const FONT_OPTS = [
  { id: 'serifH', label: '源樣明體 Heavy', stack: SERIF, w: 900, rw: 900 },
  { id: 'serifB', label: '源樣明體 Bold', stack: SERIF, w: 700, rw: 900 },
  { id: 'sansB', label: '源樣黑體 Bold', stack: FONT, w: 700, rw: 700 },
  { id: 'sansM', label: '源樣黑體 Medium', stack: FONT, w: 500, rw: 700 },
  { id: 'huninn', label: '粉圓體（圓體，近似金萱）', stack: '"Huninn","jf-openhuninn","PingFang TC",sans-serif', w: 400, rw: 400 },
  { id: 'iansui', label: '芫荽體（圓潤手寫感）', stack: '"Iansui","PingFang TC",sans-serif', w: 400, rw: 400 },
  { id: 'wenkai', label: '霞鶩文楷（楷書，近似凝書體）', stack: '"LXGW WenKai TC","Kaiti TC","KaiTC",serif', w: 400, rw: 700 },
];
function fontOpt(id) {
  if (!id || id === 'theme') return null;
  const b = FONT_OPTS.find(o => o.id === id); if (b) return b;
  const f = S.localFonts.find(x => 'L:' + x.fam === id);
  return f && f.ok !== false ? { id, label: '本機：' + f.name, stack: `"${f.fam}","Noto Sans TC",sans-serif`, w: 400, rw: 400 } : null;
}
const fnt = (weight, size, head, red) => {
  const o = fontOpt(head ? S.fonts.head : S.fonts.body);
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
    const base = fnt(wt, fs, head, false), redf = fnt(700, fs, head, true);
    const flat = [];
    runs.forEach(r => tokenize(r.t.replace(/[\n\v]/g, ' ')).forEach(tk => flat.push({ t: tk, red: r.red })));
    let cur = [], cw = 0;
    for (const tk of flat) {
      const w = tw(tk.red ? redf : base, tk.t);
      if (cur.length && cw + w > maxW && !NO_START.has(tk.t)) {
        const carry = [];
        while (cur.length && NO_END.has(cur[cur.length - 1].t)) carry.unshift(cur.pop());
        lines.push({ pi, segs: cur, size: fs, head, w: cw });
        cur = carry; cw = carry.reduce((a, s) => a + tw(s.red ? redf : base, s.t), 0);
      }
      if (tk.t === ' ' && !cur.length) continue;
      cur.push(tk); cw += w;
    }
    if (cur.length) lines.push({ pi, segs: cur, size: fs, head, w: cw });
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
  lines.forEach((l, i) => {
    const wt = l.head ? 700 : 500, base = fnt(wt, l.size, l.head, false), redf = fnt(700, l.size, l.head, true);
    let px = align === 'center' ? x + (boxW - l.w) / 2 : align === 'right' ? x + boxW - l.w : x;
    const cy = y + l.h / 2;
    l.segs.forEach(s => {
      c.font = s.red ? redf : base; c.fillStyle = s.red ? T.red : T.text; c.fillText(s.t, px, cy);
      px += tw(s.red ? redf : base, s.t);
    });
    y += l.h; if (lines[i + 1] && lines[i + 1].pi !== l.pi) y += l.size * o.paraGap;
  });
}
const plain = p => p.map(r => r.t).join('');

// ---------- 現場版 ----------
function liveOpts(isTitle) {
  return {
    headRule: (pi, ps) => isTitle ? pi === 0 : (pi === 0 && ps.length > 1 && plain(ps[0]).length <= 28),
    headScale: isTitle ? 1.9 : 1.16, lineGap: S.lineGap || 1.5, paraGap: .5,
  };
}
function liveCfg(slide, isTitle) {
  const m = Object.assign({ dx: 0, dy: 0, w: null, align: null }, S.live, (slide && slide.lv) || {});
  return { dx: m.dx, dy: m.dy, w: m.w || (isTitle ? 1500 : 1560), align: m.align || (isTitle ? 'center' : 'left') };
}
function drawLive(cv, slide, idx) {
  const T = curTheme(), c = cv.getContext('2d'), isTitle = idx === 0;
  c.clearRect(0, 0, W, H);
  c.drawImage(getBg(isTitle ? 'title' : 'content'), 0, 0);
  const o = liveOpts(isTitle), fs = slide.fs || 1, L = liveCfg(slide, isTitle);
  const maxW = L.w, maxH = isTitle ? 560 : 790;
  let size = Math.round((isTitle ? 56 : 76) * fs), lines;
  for (; size >= 30; size -= 2) { lines = layout(slide.paras, size, maxW, o); if (blockH(lines, o) <= maxH) break; }
  const h = blockH(lines, o);
  const x = (isTitle ? (W - maxW) / 2 : 160) + L.dx;
  const y = (isTitle ? Math.max(120, (H * .72 - h) / 2 + 40) : Math.max(110, (H - h) / 2 - 10)) + L.dy;
  drawLines(c, lines, x, y, o, T, L.align, maxW);
  return { shrunk: size < Math.round((isTitle ? 56 : 76) * fs) };
}

// ---------- 長條版 ----------
const STRIP = { padL: 100, padR: 140, padT: 46, padB: 46, maxH: 340 };
function stripOpts() {
  return { headRule: (pi, ps) => pi === 0 && ps.length > 1, headScale: 1.2, lineGap: S.lineGap ? Math.max(1.1, S.lineGap - .1) : 1.4, paraGap: .3 };
}
function stripPages(slide) {
  const o = stripOpts(), cardW = Math.round(W * S.stripW), tw_ = cardW - STRIP.padL - STRIP.padR;
  const sfs = slide.sfs || 1, pv = STRIP.padT + STRIP.padB;
  for (let size = Math.round(46 * sfs); size >= 30; size -= 2) {
    const lines = layout(slide.paras, size, tw_, o);
    if (blockH(lines, o) + pv <= STRIP.maxH) return { pages: [lines], o, cardW };
  }
  const lines = layout(slide.paras, 30, tw_, o), pages = []; let cur = [];
  for (const ln of lines) {
    if (cur.length && blockH(cur.concat([ln]), o) + pv > STRIP.maxH) { pages.push(cur); cur = []; }
    cur.push(ln);
  }
  if (cur.length) pages.push(cur);
  return { pages, o, cardW };
}
function drawStrip(cv, slide, page) {
  const T = curTheme(), c = cv.getContext('2d');
  c.clearRect(0, 0, W, H);
  const { pages, o, cardW } = stripPages(slide);
  page = Math.min(page, pages.length - 1);
  const lines = pages[page], h = Math.round(blockH(lines, o) + STRIP.padT + STRIP.padB);
  const x0 = Math.round((W - cardW) / 2), y0 = H - h - S.stripY;
  const card = drawCard(T, cardW, h, 1);
  c.save(); c.shadowColor = 'rgba(0,0,0,.35)'; c.shadowBlur = 24; c.shadowOffsetY = 8;
  c.drawImage(card, x0, y0, cardW, h); c.restore();
  drawLines(c, lines, x0 + STRIP.padL, y0 + STRIP.padT, o, T);
  return pages.length;
}

// ---------- 解析 pptx ----------
async function parsePptx(buf) {
  const zip = await JSZip.loadAsync(buf), dp = new DOMParser();
  const txt = async p => zip.file(p).async('string');
  const pres = dp.parseFromString(await txt('ppt/presentation.xml'), 'text/xml');
  const rels = dp.parseFromString(await txt('ppt/_rels/presentation.xml.rels'), 'text/xml');
  const map = {}; [...rels.getElementsByTagName('Relationship')].forEach(r => map[r.getAttribute('Id')] = r.getAttribute('Target'));
  const ids = [...pres.getElementsByTagName('p:sldId')].map(e => e.getAttribute('r:id'));
  const slides = [];
  for (const id of ids) {
    let tgt = map[id]; tgt = tgt.replace(/^\/?(ppt\/)?/, 'ppt/');
    const doc = dp.parseFromString(await txt(tgt), 'text/xml');
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
    if (paras.length) slides.push({ paras, fs: 1, sfs: 1, hasPic });
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
  for (const id of [S.fonts.head, S.fonts.body]) { const o = fontOpt(id); if (o) [o.w, o.rw].forEach(w => jobs.push(document.fonts.load(`${w} 40px ${o.stack}`, sample))); }
  try { await Promise.allSettled(jobs); } catch (e) { }
  wcache.clear(); return true;
}

// ---------- UI 繪製 ----------
const thumbCv = new Map();
function renderMain() {
  const sl = S.slides[S.sel]; if (!sl) return;
  const r = drawLive($('cvLive'), sl, S.sel);
  $('capLive').textContent = r.shrunk ? '字多，已自動縮小' : '';
  const n = drawStrip($('cvStrip'), sl, S.page);
  const pg = $('pages'); pg.innerHTML = '';
  if (n > 1) for (let i = 0; i < n; i++) { const b = document.createElement('button'); b.className = 'pill' + (i === S.page ? ' sel' : ''); b.textContent = `第${i + 1}張`; b.onclick = () => { S.page = i; renderMain(); }; pg.appendChild(b); }
  renderThumb(S.sel);
}
function renderThumb(i) {
  const cv = thumbCv.get(i); if (!cv) return;
  const full = mk(W, H); drawLive(full, S.slides[i], i);
  const c = cv.getContext('2d'); c.drawImage(full, 0, 0, cv.width, cv.height);
  const badge = cv.parentElement.querySelector('.badge'); const n = stripPages(S.slides[i]).pages.length;
  badge.textContent = `長條×${n}`; badge.hidden = n < 2;
}
function buildList() {
  const list = $('list'); list.innerHTML = ''; thumbCv.clear();
  S.slides.forEach((sl, i) => {
    const d = document.createElement('div'); d.className = 'thumb' + (i === S.sel ? ' sel' : '');
    d.innerHTML = `<canvas width="400" height="225"></canvas><span class="n">${i + 1}</span><span class="badge" hidden></span>`;
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
  syncOut(); renderMain();
  const th = document.querySelectorAll('.thumb')[i]; if (th) th.scrollIntoView({ block: 'nearest' });
}
function syncLiveUI() {
  const sl = S.slides[S.sel]; if (!sl) return;
  const L = liveCfg(sl, S.sel === 0);
  $('lvX').value = L.dx; $('lvXO').textContent = L.dx; $('lvY').value = L.dy; $('lvYO').textContent = L.dy; $('lvW').value = L.w; $('lvWO').textContent = L.w;
  document.querySelectorAll('#lvAlign .pill').forEach(b => b.classList.toggle('sel', b.dataset.a === L.align));
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
  $('lineGapO').textContent = S.lineGap ? S.lineGap.toFixed(2) : '預設'; $('stripYO').textContent = S.stripY; $('stripWO').textContent = Math.round(S.stripW * 100) + '%';
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
    const b = document.createElement('button'); b.className = 'tcard' + (!S.custom && S.themeKey === k ? ' sel' : ''); b.title = t.name;
    const cv = mk(320, 180); cv.dataset.k = k; b.appendChild(cv);
    if (thumbCache.has(k)) drawThumb(k, cv); else io.observe(cv);
    const sp = document.createElement('span'); sp.textContent = t.name; b.appendChild(sp);
    b.onclick = () => { S.themeKey = k; clearCustom(false); ensureFonts().then(() => { loadedChars.clear(); return ensureFonts(); }).then(afterThemeChange); }; box.appendChild(b);
  });
  $('themeCount').textContent = box.children.length + ' / ' + Object.keys(THEMES).length;
}
function getBgFor(k) { const c = mk(W, H); THEMES[k].bg.call(THEMES[k], c.getContext('2d'), 'content'); return c; }
function afterThemeChange() { bgCache.clear(); buildThemes(); buildList(); renderMain(); save(); }
function clearCustom(redraw = true) { S.custom = null; $('btnBgClear').hidden = true; $('bgMode').hidden = true; if (redraw) afterThemeChange(); }

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
  [['fontHead', 'head'], ['fontBody', 'body']].forEach(([id, k]) => {
    const sel = $(id); sel.innerHTML = '';
    const add = (v, t, dis) => { const o = document.createElement('option'); o.value = v; o.textContent = t; if (dis) o.disabled = true; sel.appendChild(o); };
    add('theme', '跟著背景主題');
    FONT_OPTS.forEach(o => add(o.id, o.label));
    S.localFonts.forEach(f => add('L:' + f.fam, '本機：' + f.name + (f.ok === false ? '（找不到）' : ''), f.ok === false));
    sel.value = fontOpt(S.fonts[k]) || S.fonts[k] === 'theme' ? S.fonts[k] : 'theme';
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

// ---------- 儲存 ----------
let saveT;
function save() {
  clearTimeout(saveT); saveT = setTimeout(() => {
    try { localStorage.setItem('ppt-web-v1', JSON.stringify({ slides: S.slides, themeKey: S.themeKey, stripW: S.stripW, stripY: S.stripY, lineGap: S.lineGap, live: S.live, fileName: S.fileName, fonts: S.fonts, localFonts: S.localFonts.map(f => ({ name: f.name, fam: f.fam })) })); } catch (e) { }
  }, 300);
}
let redrawT;
function redrawSoon() { clearTimeout(redrawT); redrawT = setTimeout(renderMain, 60); save(); }

// ---------- 載入 ----------
async function start(slides, name) {
  S.slides = slides; S.sel = 0; S.page = 0; S.fileName = name.replace(/\.pptx$/i, '');
  $('drop').hidden = true; $('editor').hidden = false; $('sideEmpty').hidden = true; $('sideBody').hidden = false; $('btnExport').disabled = false;
  await ensureFonts(); bgCache.clear(); buildCats(); buildThemes(); buildList(); select(0); save();
}
async function loadFile(f) {
  try { const slides = await parsePptx(await f.arrayBuffer()); if (!slides.length) throw new Error('empty'); await start(slides, f.name); toast(`已讀入 ${slides.length} 頁`); }
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

async function exportAll() {
  await ensureFonts();
  const zip = new JSZip(), pL = new PptxGenJS(), pS = new PptxGenJS(); pL.layout = pS.layout = 'LAYOUT_WIDE';
  const cv = mk(W, H); const total = S.slides.length; let done = 0;
  for (let i = 0; i < total; i++) {
    prog(`正在輸出第 ${i + 1} / ${total} 頁…`, done / total); await sleep(0);
    drawLive(cv, S.slides[i], i);
    const jb = await blobOf(cv, 'image/jpeg', .93), name = String(i + 1).padStart(3, '0');
    zip.file(`現場圖片/現場_${name}.jpg`, jb);
    pL.addSlide().addImage({ data: await dataOf(jb), x: 0, y: 0, w: 13.333, h: 7.5 });
    const n = stripPages(S.slides[i]).pages.length;
    for (let p = 0; p < n; p++) {
      drawStrip(cv, S.slides[i], p);
      const pb = await blobOf(cv, 'image/png');
      zip.file(`長條圖片/長條_${name}${n > 1 ? '_' + 'abcdefgh'[p] : ''}.png`, pb);
      pS.addSlide().addImage({ data: await dataOf(pb), x: 0, y: 0, w: 13.333, h: 7.5 });
    }
    done++;
  }
  prog('正在打包 pptx…', .95); await sleep(30);
  zip.file(`${S.fileName}_現場版_給ProPresenter.pptx`, await pL.write({ outputType: 'blob' }));
  zip.file(`${S.fileName}_線上長條版_給ProPresenter.pptx`, await pS.write({ outputType: 'blob' }));
  const out = await zip.generateAsync({ type: 'blob' });
  $('prog').style.display = 'none'; download(out, `${S.fileName}_輸出.zip`); toast('完成！已下載 zip');
  return out;
}

function toast(t) { const e = $('toast'); e.textContent = t; e.classList.add('on'); clearTimeout(e._t); e._t = setTimeout(() => e.classList.remove('on'), 2600); }

// ---------- 事件 ----------
$('btnOpen').onclick = $('btnPick').onclick = () => $('file').click();
$('file').onchange = e => { if (e.target.files[0]) loadFile(e.target.files[0]); e.target.value = ''; };
$('btnSample').onclick = () => start(sampleSlides(), '範例');
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
$('lineGap').oninput = () => { S.lineGap = +$('lineGap').value; wcache.clear(); syncOut(); S.page = 0; redrawSoon(); };
$('lineGapReset').onclick = () => { S.lineGap = null; $('lineGap').value = 1.5; wcache.clear(); syncOut(); S.page = 0; redrawSoon(); };
$('stripY').oninput = () => { S.stripY = +$('stripY').value; syncOut(); redrawSoon(); };
$('stripW').oninput = () => { S.stripW = $('stripW').value / 100; syncOut(); S.page = 0; redrawSoon(); };
$('stripW').onchange = () => buildList();
$('btnExport').onclick = () => exportAll().catch(e => { console.error(e); $('prog').style.display = 'none'; toast('匯出失敗：' + e.message); });

$('btnBg').onclick = () => $('bgFile').click();
$('bgFile').onchange = e => {
  const f = e.target.files[0]; if (!f) return; const im = new Image();
  im.onload = () => { S.custom = im; $('btnBgClear').hidden = false; $('bgMode').hidden = false; afterThemeChange(); };
  im.src = URL.createObjectURL(f); e.target.value = '';
};
$('btnBgClear').onclick = () => clearCustom();
document.querySelectorAll('#bgMode .pill').forEach(b => b.onclick = () => {
  S.customMode = b.dataset.m; document.querySelectorAll('#bgMode .pill').forEach(x => x.classList.toggle('sel', x === b)); afterThemeChange();
});
document.querySelector('#bgMode .pill[data-m=dark]').classList.add('sel');

// ---------- 啟動：還原上次內容 ----------
$('fontHead').onchange = e => { S.fonts.head = e.target.value; afterFontChange(); };
$('fontBody').onchange = e => { S.fonts.body = e.target.value; afterFontChange(); };
$('btnLocalAdd').onclick = async () => { const f = await addLocalFontByName($('localName').value); if (f && f.ok) { $('localName').value = ''; save(); } };
$('localName').onkeydown = e => { if (e.key === 'Enter') $('btnLocalAdd').click(); };
$('localFilter').oninput = renderLocalList;
if (!window.queryLocalFonts) $('btnLocalPick').hidden = true;
$('btnLocalPick').onclick = async () => {
  try { _localAll = await window.queryLocalFonts(); $('localFilter').hidden = false; renderLocalList(); }
  catch (e) { toast('沒有取得字型清單的權限，可以改用輸入名稱'); }
};
$('lvX').oninput = () => editLive('dx', +$('lvX').value);
$('lvY').oninput = () => editLive('dy', +$('lvY').value);
$('lvW').oninput = () => editLive('w', +$('lvW').value);
document.querySelectorAll('#lvAlign .pill').forEach(b => b.onclick = () => editLive('align', b.dataset.a));
document.querySelectorAll('#lvScope .pill').forEach(b => b.onclick = () => { S.liveScope = b.dataset.s; syncLiveUI(); });
$('lvReset').onclick = () => {
  if (S.liveScope === 'slide') delete S.slides[S.sel].lv; else { S.live = {}; S.slides.forEach(s => delete s.lv); }
  syncLiveUI(); redrawSoon();
};
(() => { // 直接在預覽上拖曳文字區塊
  const cv = $('cvLive'); let drag = null;
  cv.addEventListener('pointerdown', e => {
    const sl = S.slides[S.sel]; if (!sl) return; const L = liveCfg(sl, S.sel === 0);
    drag = { x: e.clientX, y: e.clientY, dx: L.dx, dy: L.dy, k: W / cv.getBoundingClientRect().width }; cv.setPointerCapture(e.pointerId); cv.style.cursor = 'grabbing';
  });
  cv.addEventListener('pointermove', e => {
    if (!drag) return;
    const dx = Math.round((drag.dx + (e.clientX - drag.x) * drag.k) / 4) * 4, dy = Math.round((drag.dy + (e.clientY - drag.y) * drag.k) / 4) * 4;
    editLive('dx', Math.max(-900, Math.min(900, dx))); editLive('dy', Math.max(-600, Math.min(600, dy)));
  });
  const end = () => { drag = null; cv.style.cursor = 'grab'; }; cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end); cv.style.cursor = 'grab'; cv.style.touchAction = 'none';
})();
(async () => {
  syncOut(); buildCats(); buildThemes(); buildFontSelects();
  try {
    const v = JSON.parse(localStorage.getItem('ppt-web-v1') || 'null');
    if (v && v.slides && v.slides.length) {
      Object.assign(S, { themeKey: v.themeKey || 'paper', stripW: v.stripW || .81, stripY: v.stripY || 64, lineGap: v.lineGap || null, live: v.live || {} });
      if (S.lineGap) $('lineGap').value = S.lineGap;
      if (v.fonts) S.fonts = v.fonts;
      for (const f of (v.localFonts || [])) await registerLocal(f.name, f.fam);
      buildFontSelects();
      $('stripY').value = S.stripY; $('stripW').value = Math.round(S.stripW * 100);
      const b = document.createElement('button'); b.className = 'btn'; b.textContent = `繼續上次的「${v.fileName}」`;
      b.onclick = () => start(v.slides, v.fileName); $('btnSample').after(b);
    }
  } catch (e) { }
})();
