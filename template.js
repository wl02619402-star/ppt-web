// ---------- 模板：讀 Slidesgo（Google 簡報匯出）等 pptx ----------
// 畫出每一頁的背景、圖片與圖形（不畫範例文字），並記下原本文字框的位置，之後把講道文字放進去。
const TPLNS = { a: 'http://schemas.openxmlformats.org/drawingml/2006/main', p: 'http://schemas.openxmlformats.org/presentationml/2006/main', r: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships' };
const kids = (el, name) => el ? [...el.children].filter(k => k.localName === name) : [];
const kid = (el, name) => kids(el, name)[0] || null;
const deep = (el, name) => el ? el.getElementsByTagNameNS('*', name)[0] || null : null;
const attrN = (el, n, d = 0) => el && el.hasAttribute(n) ? +el.getAttribute(n) : d;

function tplHexToRgb(h) { return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)); }
function rgbToHsl(r, g, b) { r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b); let h = 0, s = 0; const l = (mx + mn) / 2; if (mx !== mn) { const d = mx - mn; s = l > .5 ? d / (2 - mx - mn) : d / (mx + mn); h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h /= 6; } return [h, s, l]; }
function hslToRgb(h, s, l) { if (!s) return [l, l, l].map(v => Math.round(v * 255)); const q = l < .5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q; const f = t => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < .5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; }; return [f(h + 1 / 3), f(h), f(h - 1 / 3)].map(v => Math.round(v * 255)); }

async function parseTemplate(buf, name, onProg) {
  const zip = await JSZip.loadAsync(buf), dp = new DOMParser();
  const xml = async p => { const f = zip.file(p); return f ? dp.parseFromString(await f.async('string'), 'text/xml') : null; };
  const relsOf = async p => { const d = await xml(p.replace(/([^/]+)$/, '_rels/$1.rels')), m = {}; if (d) [...d.getElementsByTagName('Relationship')].forEach(r => m[r.getAttribute('Id')] = { t: r.getAttribute('Target'), type: r.getAttribute('Type') }); return m; };
  const resolve = (base, t) => { if (t.startsWith('/')) return t.slice(1); const parts = base.split('/'); parts.pop(); t.split('/').forEach(s => { if (s === '..') parts.pop(); else if (s !== '.') parts.push(s); }); return parts.join('/'); };
  const pres = await xml('ppt/presentation.xml'), prel = await relsOf('ppt/presentation.xml');
  const sz = deep(pres, 'sldSz'), SW = attrN(sz, 'cx', 12192000), SH = attrN(sz, 'cy', 6858000);
  const ids = [...pres.getElementsByTagNameNS('*', 'sldId')].map(e => e.getAttributeNS(TPLNS.r, 'id') || e.getAttribute('r:id'));
  const imgCacheT = new Map();
  const loadMedia = async path => {
    if (imgCacheT.has(path)) return imgCacheT.get(path);
    const f = zip.file(path); let im = null;
    const ext = path.split('.').pop().toLowerCase(), mime = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', svg: 'image/svg+xml', webp: 'image/webp' }[ext];
    if (f && mime) { const url = URL.createObjectURL(new Blob([await f.async('uint8array')], { type: mime })); im = await new Promise(res => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = url; }); }
    imgCacheT.set(path, im); return im;
  };
  const pages = [];
  for (const [n, id] of ids.entries()) {
    if (onProg) { onProg(n, ids.length); await new Promise(r => setTimeout(r, 0)); }
    const sp = resolve('ppt/presentation.xml', prel[id].t), sdoc = await xml(sp), srel = await relsOf(sp);
    const lp = resolve(sp, Object.values(srel).find(r => /slideLayout$/.test(r.type)).t), ldoc = await xml(lp), lrel = await relsOf(lp);
    const mp = resolve(lp, Object.values(lrel).find(r => /slideMaster$/.test(r.type)).t), mdoc = await xml(mp), mrel = await relsOf(mp);
    const tp = resolve(mp, Object.values(mrel).find(r => /theme$/.test(r.type)).t), tdoc = await xml(tp);
    // 配色
    const scheme = {}; const cs = deep(tdoc, 'clrScheme');
    if (cs) [...cs.children].forEach(c => { const v = c.firstElementChild; scheme[c.localName] = v ? (v.getAttribute('val') && v.localName === 'srgbClr' ? v.getAttribute('val') : v.getAttribute('lastClr') || '000000') : '000000'; });
    const cmapEl = deep(mdoc, 'clrMap'), cmap = {}; if (cmapEl) [...cmapEl.attributes].forEach(a => cmap[a.name] = a.value);
    const ctx = { zip, SW, SH, scheme, cmap, layers: [{ doc: sdoc, path: sp, rel: srel }, { doc: ldoc, path: lp, rel: lrel }, { doc: mdoc, path: mp, rel: mrel }], resolve, loadMedia };
    pages.push(await renderTplPage(ctx));
  }
  return { name: name.replace(/\.pptx$/i, ''), pages };
}

// 顏色：srgbClr / schemeClr / sysClr / prstClr，加上 lumMod、lumOff、tint、shade、alpha
function tplColor(node, ctx, phClr) {
  if (!node) return null;
  const c = [...node.children].find(k => /^(srgbClr|schemeClr|sysClr|prstClr|scrgbClr)$/.test(k.localName)); if (!c) return null;
  let hex = '000000';
  if (c.localName === 'srgbClr') hex = c.getAttribute('val');
  else if (c.localName === 'sysClr') hex = c.getAttribute('lastClr') || (c.getAttribute('val') === 'window' ? 'FFFFFF' : '000000');
  else if (c.localName === 'prstClr') hex = ({ black: '000000', white: 'FFFFFF', red: 'FF0000', gray: '808080' })[c.getAttribute('val')] || '000000';
  else if (c.localName === 'schemeClr') { let v = c.getAttribute('val'); if (v === 'phClr') return phClr || null; v = ctx.cmap[v] || v; hex = ctx.scheme[v] || '000000'; }
  let [r, g, b] = tplHexToRgb(hex), a = 1;
  for (const m of c.children) {
    const v = attrN(m, 'val') / 100000;
    if (m.localName === 'alpha') a = v;
    else if (m.localName === 'lumMod' || m.localName === 'lumOff') { const [h, s, l] = rgbToHsl(r, g, b); const nl = m.localName === 'lumMod' ? l * v : l + v; [r, g, b] = hslToRgb(h, s, Math.max(0, Math.min(1, nl))); }
    else if (m.localName === 'tint') { r = r + (255 - r) * (1 - v); g = g + (255 - g) * (1 - v); b = b + (255 - b) * (1 - v); }
    else if (m.localName === 'shade') { r *= v; g *= v; b *= v; }
  }
  return `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${a})`;
}

async function tplFill(c, spPr, ctx, layer, w, h, styleFill) {
  const sf = kid(spPr, 'solidFill'), gf = kid(spPr, 'gradFill'), bf = kid(spPr, 'blipFill');
  if (kid(spPr, 'noFill')) return null;
  if (sf) return tplColor(sf, ctx);
  if (gf) {
    const stops = kids(kid(gf, 'gsLst'), 'gs'); if (!stops.length) return null;
    const lin = kid(gf, 'lin'), ang = (attrN(lin, 'ang', 5400000) / 60000) * Math.PI / 180;
    const dx = Math.cos(ang) * w / 2, dy = Math.sin(ang) * h / 2, g = kid(gf, 'path') ? c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) / 1.4) : c.createLinearGradient(w / 2 - dx, h / 2 - dy, w / 2 + dx, h / 2 + dy);
    stops.forEach(s => { const col = tplColor(s, ctx); if (col) g.addColorStop(Math.min(1, attrN(s, 'pos') / 100000), col); }); return g;
  }
  if (bf) return { blip: bf };
  return styleFill || null;
}
function tplPath(c, spPr, w, h) {
  const pg = kid(spPr, 'prstGeom'), cg = kid(spPr, 'custGeom');
  c.beginPath();
  if (cg) {
    for (const path of kids(kid(cg, 'pathLst'), 'path')) {
      const pw = attrN(path, 'w', w) || w, ph = attrN(path, 'h', h) || h, kx = w / pw, ky = h / ph; let cx = 0, cy = 0;
      for (const cmd of path.children) {
        const pts = kids(cmd, 'pt').map(p => [attrN(p, 'x') * kx, attrN(p, 'y') * ky]);
        if (cmd.localName === 'moveTo') { c.moveTo(...pts[0]); [cx, cy] = pts[0]; }
        else if (cmd.localName === 'lnTo') { c.lineTo(...pts[0]); [cx, cy] = pts[0]; }
        else if (cmd.localName === 'cubicBezTo') { c.bezierCurveTo(...pts[0], ...pts[1], ...pts[2]); [cx, cy] = pts[2]; }
        else if (cmd.localName === 'quadBezTo') { c.quadraticCurveTo(...pts[0], ...pts[1]); [cx, cy] = pts[1]; }
        else if (cmd.localName === 'arcTo') {
          const wr = attrN(cmd, 'wR') * kx, hr = attrN(cmd, 'hR') * ky, st = attrN(cmd, 'stAng') / 60000 * Math.PI / 180, sw = attrN(cmd, 'swAng') / 60000 * Math.PI / 180;
          const ox = cx - wr * Math.cos(st), oy = cy - hr * Math.sin(st);
          c.ellipse(ox, oy, Math.max(.01, wr), Math.max(.01, hr), 0, st, st + sw, sw < 0); cx = ox + wr * Math.cos(st + sw); cy = oy + hr * Math.sin(st + sw);
        } else if (cmd.localName === 'close') c.closePath();
      }
    }
    return true;
  }
  const prst = pg ? pg.getAttribute('prst') : 'rect';
  const adj = n => { const gd = kids(kid(pg, 'avLst'), 'gd').find(g => g.getAttribute('name') === n); return gd ? +gd.getAttribute('fmla').replace(/[^\d.-]/g, '') : null; };
  const m = Math.min(w, h);
  switch (prst) {
    case 'rect': case 'flowChartProcess': case 'snip1Rect': c.rect(0, 0, w, h); break;
    case 'roundRect': case 'flowChartAlternateProcess': { const r = m * ((adj('adj') ?? 16667) / 100000); if (c.roundRect) c.roundRect(0, 0, w, h, r); else c.rect(0, 0, w, h); break; }
    case 'round2SameRect': { const r = m * ((adj('adj1') ?? 16667) / 100000); if (c.roundRect) c.roundRect(0, 0, w, h, [r, r, 0, 0]); else c.rect(0, 0, w, h); break; }
    case 'ellipse': case 'flowChartConnector': c.ellipse(w / 2, h / 2, w / 2, h / 2, 0, 0, Math.PI * 2); break;
    case 'triangle': { const a = (adj('adj') ?? 50000) / 100000; c.moveTo(w * a, 0); c.lineTo(w, h); c.lineTo(0, h); c.closePath(); break; }
    case 'rtTriangle': c.moveTo(0, 0); c.lineTo(w, h); c.lineTo(0, h); c.closePath(); break;
    case 'diamond': c.moveTo(w / 2, 0); c.lineTo(w, h / 2); c.lineTo(w / 2, h); c.lineTo(0, h / 2); c.closePath(); break;
    case 'parallelogram': { const a = m * ((adj('adj') ?? 25000) / 100000); c.moveTo(a, 0); c.lineTo(w, 0); c.lineTo(w - a, h); c.lineTo(0, h); c.closePath(); break; }
    case 'trapezoid': { const a = m * ((adj('adj') ?? 25000) / 100000); c.moveTo(a, 0); c.lineTo(w - a, 0); c.lineTo(w, h); c.lineTo(0, h); c.closePath(); break; }
    case 'hexagon': { const a = m * ((adj('adj') ?? 25000) / 100000); c.moveTo(a, 0); c.lineTo(w - a, 0); c.lineTo(w, h / 2); c.lineTo(w - a, h); c.lineTo(a, h); c.lineTo(0, h / 2); c.closePath(); break; }
    case 'homePlate': case 'chevron': { const a = m * ((adj('adj') ?? 50000) / 100000); c.moveTo(0, 0); c.lineTo(w - a, 0); c.lineTo(w, h / 2); c.lineTo(w - a, h); c.lineTo(0, h); if (prst === 'chevron') c.lineTo(a, h / 2); c.closePath(); break; }
    case 'donut': { const a = m * ((adj('adj') ?? 25000) / 100000); c.ellipse(w / 2, h / 2, w / 2, h / 2, 0, 0, Math.PI * 2); c.moveTo(w / 2 + w / 2 - a, h / 2); c.ellipse(w / 2, h / 2, w / 2 - a, h / 2 - a, 0, 0, Math.PI * 2, true); break; }
    case 'star4': case 'star5': case 'star6': case 'star8': { const n = +prst.slice(4), ri = prst === 'star4' ? .25 : .42; for (let i = 0; i < n * 2; i++) { const r = i % 2 ? ri : 1, t = -Math.PI / 2 + i * Math.PI / n; const x = w / 2 + Math.cos(t) * w / 2 * r, y = h / 2 + Math.sin(t) * h / 2 * r; i ? c.lineTo(x, y) : c.moveTo(x, y); } c.closePath(); break; }
    case 'line': case 'straightConnector1': c.moveTo(0, 0); c.lineTo(w, h); return 'line';
    default: return false;   // 認不得的形狀不畫，避免畫出錯誤的方塊
  }
  return true;
}
async function tplDrawBlip(c, ctx, layer, blipFill, w, h) {
  const blip = kid(blipFill, 'blip'); if (!blip) return;
  const rid = blip.getAttributeNS(TPLNS.r, 'embed') || blip.getAttribute('r:embed'); const rel = rid && layer.rel[rid]; if (!rel) return;
  const im = await ctx.loadMedia(ctx.resolve(layer.path, rel.t)); if (!im) return;
  const sr = kid(blipFill, 'srcRect'), l = attrN(sr, 'l') / 1e5, t = attrN(sr, 't') / 1e5, r = attrN(sr, 'r') / 1e5, b = attrN(sr, 'b') / 1e5;
  const am = deep(blip, 'alphaModFix'); c.save(); if (am) c.globalAlpha *= attrN(am, 'amt', 100000) / 1e5;
  const iw = im.naturalWidth || im.width, ih = im.naturalHeight || im.height;
  if (kid(blipFill, 'tile')) { const pat = c.createPattern(im, 'repeat'); c.fillStyle = pat; c.fillRect(0, 0, w, h); }
  else c.drawImage(im, iw * l, ih * t, Math.max(1, iw * (1 - l - r)), Math.max(1, ih * (1 - t - b)), 0, 0, w, h);
  c.restore();
}
function phOf(el) { const ph = deep(kid(el, 'nvSpPr') || kid(el, 'nvPicPr'), 'ph'); return ph ? { type: ph.getAttribute('type') || 'body', idx: ph.getAttribute('idx') || '' } : null; }
function hasText(el) { const tb = kid(el, 'txBody'); return !!tb && [...tb.getElementsByTagNameNS('*', 't')].some(t => t.textContent.trim()); }

async function renderTplPage(ctx) {
  const c = mk(W, H), x = c.getContext('2d'), k = W / ctx.SW, regions = [], occ = [];
  // 背景：投影片 → 版面配置 → 母片，找到第一個有設定的
  let bgDone = false;
  for (const L of ctx.layers) {
    const bg = deep(L.doc, 'bg'); if (!bg) continue;
    const bgPr = kid(bg, 'bgPr'), bgRef = kid(bg, 'bgRef');
    if (bgPr) {
      const f = await tplFill(x, bgPr, ctx, L, W, H);
      if (f && f.blip) await tplDrawBlip(x, ctx, L, f.blip, W, H); else if (f) { x.fillStyle = f; x.fillRect(0, 0, W, H); }
      bgDone = true; break;
    }
    if (bgRef) { const col = tplColor(bgRef, ctx); if (col) { x.fillStyle = col; x.fillRect(0, 0, W, H); bgDone = true; break; } }
  }
  if (!bgDone) { x.fillStyle = '#' + (ctx.scheme[ctx.cmap.bg1 || 'lt1'] || 'FFFFFF'); x.fillRect(0, 0, W, H); }
  // 要不要畫母片上的圖形
  const showMaster = ['showMasterSp'].every(a => ctx.layers.slice(0, 2).every(L => L.doc.documentElement.getAttribute(a) !== '0'));
  const order = [showMaster ? ctx.layers[2] : null, ctx.layers[1], ctx.layers[0]].filter(Boolean);
  // 版面配置上的文字框位置（投影片的佔位框常常沒有自己的位置）
  const phPos = {};
  for (const L of [ctx.layers[2], ctx.layers[1]]) {
    for (const el of L.doc.getElementsByTagNameNS('*', 'sp')) { const ph = phOf(el); if (!ph) continue; const xf = deep(kid(el, 'spPr'), 'xfrm'); if (xf) { phPos[ph.type + '|' + ph.idx] = xf; phPos[ph.type] = phPos[ph.type] || xf; } }
  }
  x.save(); x.scale(k, k);
  for (const L of order) {
    const tree = deep(L.doc, 'spTree');
    await drawTree(x, tree, ctx, L, L === ctx.layers[0], regions, phPos, occ);
  }
  x.restore();
  // 分類：封面、內容（標題＋內文）、章節（只有一個文字區）
  const big = regions.filter(r => r.w * r.h > W * H * .012);
  const titles = big.filter(r => r.role === 'title'), bodies = big.filter(r => r.role === 'body');
  const kind = big.some(r => r.cover) ? 'cover' : titles.length && bodies.length ? 'content' : big.length === 1 ? 'section' : big.length === 0 ? 'free' : big.length <= 3 ? 'content' : 'busy';
  const pick = arr => arr.sort((a, b) => b.w * b.h - a.w * a.h)[0] || null;
  const title = pick(titles.slice()) || (bodies.length > 1 ? bodies.slice().sort((a, b) => a.y - b.y)[0] : null);
  const body = pick(bodies.filter(r => r !== title)) || (!title ? pick(big.slice()) : null);
  // 文字區的亮度：決定字用深色還是白色
  const lumAt = r => { if (!r) return 1; const d = x.getImageData(Math.max(0, r.x | 0), Math.max(0, r.y | 0), Math.max(1, Math.min(W - r.x, r.w) | 0), Math.max(1, Math.min(H - r.y, r.h) | 0)).data; let s = 0, n = 0; for (let i = 0; i < d.length; i += 16) { s += .299 * d[i] + .587 * d[i + 1] + .114 * d[i + 2]; n++; } return s / n / 255; };
  [title, body].forEach(r => { if (r) r.lum = lumAt(r); });
  const all = x.getImageData(0, 0, W, H).data; let s = 0, n = 0; for (let i = 0; i < all.length; i += 400) { s += .299 * all[i] + .587 * all[i + 1] + .114 * all[i + 2]; n++; }
  const accentHex = '#' + (ctx.scheme.accent1 || '6B4A2F'), lightHex = '#' + (ctx.scheme[ctx.cmap.bg1 || 'lt1'] || 'FFFFFF');
  const picFrac = occ.filter(o => o.pic).reduce((a, o) => a + o.w * o.h, 0) / (W * H);
  return { img: c.toDataURL('image/jpeg', .88), kind, title, body, occ, picFrac, regions: big.length, lum: s / n / 255, accent: accentHex, light: lightHex, use: (kind === 'cover' || kind === 'content' || kind === 'section') && picFrac < .35 };
}

async function drawTree(x, tree, ctx, L, isSlide, regions, phPos, occ) {
  for (const el of tree.children) {
    const nm = el.localName;
    if (nm === 'grpSp') {
      const xf = deep(kid(el, 'grpSpPr'), 'xfrm'); x.save();
      if (xf) {
        const off = kid(xf, 'off'), ext = kid(xf, 'ext'), co = kid(xf, 'chOff'), ce = kid(xf, 'chExt');
        const ox = attrN(off, 'x'), oy = attrN(off, 'y'), w = attrN(ext, 'cx'), h = attrN(ext, 'cy'), cw = attrN(ce, 'cx', w) || w, ch = attrN(ce, 'cy', h) || h;
        applyXf(x, xf, ox, oy, w, h); x.scale(w / (cw || 1), h / (ch || 1)); x.translate(-attrN(co, 'x'), -attrN(co, 'y'));
      }
      await drawTree(x, el, ctx, L, isSlide, regions, phPos, occ); x.restore(); continue;
    }
    if (nm !== 'sp' && nm !== 'pic' && nm !== 'cxnSp') continue;
    const ph = phOf(el), spPr = kid(el, 'spPr');
    let xf = deep(spPr, 'xfrm');
    if (ph) {
      // 佔位框：只記位置（標題、內文），不畫
      if (isSlide && (hasText(el) || ph.type !== 'pic')) { xf = xf || phPos[ph.type + '|' + ph.idx] || phPos[ph.type] || (ph.type === 'ctrTitle' ? phPos.title : null) || (ph.type === 'subTitle' ? phPos.body : null); if (xf) regions.push(regionOf(x, el, xf, ph.type)); }
      if (nm !== 'pic') continue;
    }
    if (!xf) continue;
    const off = kid(xf, 'off'), ext = kid(xf, 'ext'), ox = attrN(off, 'x'), oy = attrN(off, 'y'), w = attrN(ext, 'cx'), h = attrN(ext, 'cy');
    if (nm === 'sp' && hasText(el)) { if (isSlide) regions.push(regionOf(x, el, xf, null)); }
    else { const r = regionOf(x, el, xf, null); if (r.w * r.h > W * H * .006 && r.w * r.h < W * H * .6) occ.push({ x: r.x, y: r.y, w: r.w, h: r.h, pic: nm === 'pic' }); }
    x.save(); applyXf(x, xf, ox, oy, w, h);
    if (nm === 'pic') {
      const bf = kid(el, 'blipFill'); const isPath = tplPath(x, spPr, w, h); if (isPath === true) x.clip();
      await tplDrawBlip(x, ctx, L, bf, w, h);
    } else {
      const style = kid(el, 'style'), fr = kid(style, 'fillRef'), lr = kid(style, 'lnRef');
      const styleFill = fr && attrN(fr, 'idx') > 0 ? tplColor(fr, ctx) : null;
      const shape = tplPath(x, spPr, w, h);
      if (shape) {
        const fill = shape === 'line' ? null : await tplFill(x, spPr, ctx, L, w, h, styleFill);
        if (fill && fill.blip) { x.save(); x.clip(); await tplDrawBlip(x, ctx, L, fill.blip, w, h); x.restore(); }
        else if (fill) { x.fillStyle = fill; x.fill('evenodd'); }
        const ln = kid(spPr, 'ln');
        if (ln && !kid(ln, 'noFill')) {
          const col = tplColor(kid(ln, 'solidFill'), ctx) || (lr && attrN(lr, 'idx') > 0 ? tplColor(lr, ctx) : null);
          if (col) { x.strokeStyle = col; x.lineWidth = attrN(ln, 'w', 9525) || 9525; x.stroke(); }
        } else if (!ln && lr && attrN(lr, 'idx') > 0 && nm === 'cxnSp') { const col = tplColor(lr, ctx); if (col) { x.strokeStyle = col; x.lineWidth = 12700; x.stroke(); } }
      }
    }
    x.restore();
  }
}
function applyXf(x, xf, ox, oy, w, h) {
  const rot = attrN(xf, 'rot') / 60000 * Math.PI / 180, fh = xf.getAttribute('flipH') === '1', fv = xf.getAttribute('flipV') === '1';
  x.translate(ox + w / 2, oy + h / 2); if (rot) x.rotate(rot); if (fh || fv) x.scale(fh ? -1 : 1, fv ? -1 : 1); x.translate(-w / 2, -h / 2);
}
function regionOf(x, el, xf, phType) {
  const off = kid(xf, 'off'), ext = kid(xf, 'ext'), ox = attrN(off, 'x'), oy = attrN(off, 'y'), w = attrN(ext, 'cx'), h = attrN(ext, 'cy');
  const m = x.getTransform(), p1 = m.transformPoint(new DOMPoint(ox, oy)), p2 = m.transformPoint(new DOMPoint(ox + w, oy + h));
  const tb = kid(el, 'txBody'), bp = kid(tb, 'bodyPr'), pPr = deep(tb, 'pPr'), rPr = deep(tb, 'rPr') || deep(tb, 'defRPr');
  const algn = pPr && pPr.getAttribute('algn'), anchor = bp && bp.getAttribute('anchor');
  const role = phType ? (/title/i.test(phType) ? 'title' : 'body') : (attrN(rPr, 'sz', 1800) >= 3000 ? 'title' : 'body');
  return { x: Math.min(p1.x, p2.x), y: Math.min(p1.y, p2.y), w: Math.abs(p2.x - p1.x), h: Math.abs(p2.y - p1.y), role, cover: phType === 'ctrTitle', align: algn === 'ctr' ? 'center' : algn === 'r' ? 'right' : 'left', anchor: anchor === 'ctr' ? 'middle' : anchor === 'b' ? 'bottom' : 'top' };
}

// ---------- 存取（IndexedDB，圖片比較大） ----------
const tplDB = (() => {
  let p = null; const open = () => p || (p = new Promise((res, rej) => { const r = indexedDB.open('ppt-web', 1); r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }));
  const tx = (mode, fn) => open().then(db => new Promise((res, rej) => { const t = db.transaction('kv', mode), s = t.objectStore('kv'), q = fn(s); t.oncomplete = () => res(q && q.result); t.onerror = () => rej(t.error); }));
  return { get: k => tx('readonly', s => s.get(k)), set: (k, v) => tx('readwrite', s => s.put(v, k)), del: k => tx('readwrite', s => s.delete(k)) };
})();
