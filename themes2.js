// 程式化背景：12 種版型 × 6 組配色 = 72 套，接在手繪的 40 套後面
(function () {
  const PAL = [
    { n: '晨霧', hue: 'cool', dark: false, a: '#EEF1F4', b: '#D5DCE4', text: '#1F2A37', red: '#C0392B', acc: '#4B6584', card: '#FFFFFF' },
    { n: '杏仁', hue: 'warm', dark: false, a: '#F7EBDD', b: '#EBD5BD', text: '#3E2C1C', red: '#B3261E', acc: '#B5773A', card: '#FFF8EE' },
    { n: '青苔', hue: 'green', dark: false, a: '#E6EDE1', b: '#CBD9C4', text: '#25382A', red: '#B3261E', acc: '#5E8466', card: '#F8FBF5' },
    { n: '櫻粉', hue: 'warm', dark: false, a: '#FBE8EC', b: '#F2CBD5', text: '#4A2330', red: '#B3261E', acc: '#C9667F', card: '#FFF6F8' },
    { n: '天藍', hue: 'cool', dark: false, a: '#E3F0FA', b: '#BFDCF2', text: '#12324F', red: '#B3261E', acc: '#2F7BB8', card: '#F7FBFF' },
    { n: '奶黃', hue: 'warm', dark: false, a: '#FFF4CF', b: '#FBE29A', text: '#4A3410', red: '#B3261E', acc: '#D98A12', card: '#FFFBEA' },
    { n: '夜藍', hue: 'cool', dark: true, a: '#1B2A55', b: '#0C1430', text: '#F1F3FA', red: '#FFAE9A', acc: '#9DB4FF', card: '#121C3E' },
    { n: '墨綠', hue: 'green', dark: true, a: '#1E4231', b: '#0E241A', text: '#EEF4E4', red: '#FFAE9A', acc: '#D2BD74', card: '#14301F' },
    { n: '酒紅', hue: 'warm', dark: true, a: '#5E1B26', b: '#2F0C13', text: '#FBEBDD', red: '#FFB59A', acc: '#E5B766', card: '#3B1018' },
    { n: '炭黑', hue: 'neutral', dark: true, a: '#34363B', b: '#17181B', text: '#F4F4F2', red: '#FF9C86', acc: '#D8D8D2', card: '#1E1F22' },
    { n: '暗紫', hue: 'cool', dark: true, a: '#3E2A66', b: '#1D1236', text: '#F3EEFB', red: '#FFB3A0', acc: '#C7B0F5', card: '#281A47' },
    { n: '深棕', hue: 'warm', dark: true, a: '#4A2F26', b: '#251612', text: '#F6E8D3', red: '#FFAC90', acc: '#DDB26A', card: '#331F18' }
  ];

  const base = (c, P, ang) => {
    const g = ang ? c.createLinearGradient(0, 0, W, H) : c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, P.a); g.addColorStop(1, P.b); c.fillStyle = g; c.fillRect(0, 0, W, H);
  };
  const al = (hex, a) => hex + hex2(a);

  const MOTIFS = [
    { n: '柔光', deco: 'pill', draw(c, P) { base(c, P, 1); blob(c, W * .18, H * .15, 800, P.acc, .28); blob(c, W * .85, H * .9, 700, P.acc, .22); grain(c, W, H, .06); } },
    { n: '雙框', deco: 'corners', draw(c, P) {
      base(c, P, 1); c.strokeStyle = P.acc; c.lineWidth = 2.5; c.strokeRect(64, 64, W - 128, H - 128); c.lineWidth = 1.2; c.strokeRect(84, 84, W - 168, H - 168);
      for (const [x, y] of [[64, 64], [W - 64, 64], [64, H - 64], [W - 64, H - 64]]) { c.fillStyle = P.b; c.fillRect(x - 16, y - 16, 32, 32); diamond(c, x, y, 12, P.acc); }
      grain(c, W, H, .05);
    } },
    { n: '光斑', deco: 'circles', draw(c, P) { base(c, P, 1); const r = rng(101); for (let i = 0; i < 26; i++) blob(c, r() * W, r() * H, 50 + r() * 140, P.acc, .08 + r() * .16); grain(c, W, H, .06); } },
    { n: '斜紋', deco: 'leftbar', draw(c, P) {
      base(c, P, 1); c.save(); c.beginPath(); c.moveTo(W, H * .45); c.lineTo(W, H); c.lineTo(W * .62, H); c.closePath(); c.clip();
      c.strokeStyle = al(P.acc, .35); c.lineWidth = 14; for (let i = -20; i < 40; i++) { c.beginPath(); c.moveTo(W * .5 + i * 44, H + 20); c.lineTo(W * .5 + i * 44 + 700, H - 700); c.stroke(); } c.restore();
      c.fillStyle = P.acc; c.fillRect(110, 96, 90, 8); grain(c, W, H, .05);
    } },
    { n: '波浪', deco: 'wave', draw(c, P) { base(c, P, 0); wave(c, H - 130, 26, 90, al(P.acc, .25), 0); wave(c, H - 88, 24, 110, al(P.acc, .35), 2); wave(c, H - 46, 20, 80, al(P.acc, .5), 4); grain(c, W, H, .05); } },
    { n: '光芒', deco: 'sun', draw(c, P) {
      base(c, P, 0); c.save(); c.translate(W / 2, H + 40); for (let i = 0; i < 28; i++) { c.rotate(Math.PI / 14); c.fillStyle = al(P.acc, .10); c.beginPath(); c.moveTo(0, 0); c.lineTo(2000, -90); c.lineTo(2000, 90); c.closePath(); c.fill(); } c.restore();
      blob(c, W / 2, H + 40, 700, P.acc, .35); grain(c, W, H, .06);
    } },
    { n: '方塊', deco: 'frame', draw(c, P) {
      base(c, P, 1); for (let i = 0; i < 4; i++) { c.fillStyle = al(P.acc, .10 + i * .07); c.fillRect(W - 120 - i * 80, 0, 80, 80 + i * 60); }
      for (let i = 0; i < 3; i++) { c.fillStyle = al(P.acc, .10 + i * .07); c.fillRect(i * 70, H - 80 - i * 50, 70, 80 + i * 50); }
      grain(c, W, H, .05);
    } },
    { n: '星點', deco: 'goldline', draw(c, P) { base(c, P, 0); const r = rng(103); for (let i = 0; i < 40; i++) star(c, r() * W, r() * H, 6 + r() * 14, al(P.acc, .35 + r() * .45)); for (let i = 0; i < 80; i++) circ(c, r() * W, r() * H, .8 + r() * 1.4, al(P.acc, .5)); grain(c, W, H, .06); } },
    { n: '拱門', deco: 'arch', draw(c, P) {
      base(c, P, 1); c.strokeStyle = P.acc; for (let k = 0; k < 3; k++) { c.lineWidth = 3 - k * .8; c.globalAlpha = 1 - k * .3; const x0 = W - 380 - k * 36, x1 = W - 120 + k * 36, rr = (x1 - x0) / 2;
        c.beginPath(); c.moveTo(x0, H); c.lineTo(x0, 330 - k * 36); c.arc(x0 + rr, 330 - k * 36, rr, Math.PI, 0); c.lineTo(x1, H); c.stroke(); } c.globalAlpha = 1; grain(c, W, H, .05);
    } },
    { n: '葉枝', deco: 'leaf', draw(c, P) { base(c, P, 1); blob(c, W * .2, H * .1, 600, P.acc, .15); branch(c, -20, H - 40, -.30, 460, P.acc, .55); branch(c, W + 30, 120, Math.PI - .33, 560, P.acc, .55, -1); grain(c, W, H, .06); } },
    { n: '同心環', deco: 'dots3', draw(c, P) {
      base(c, P, 1); c.strokeStyle = P.acc; for (let i = 1; i <= 7; i++) { c.globalAlpha = .45 - i * .05; c.lineWidth = 2; c.beginPath(); c.arc(W - 100, 100, i * 90, 0, 7); c.stroke(); }
      for (let i = 1; i <= 4; i++) { c.globalAlpha = .35 - i * .06; c.beginPath(); c.arc(120, H - 100, i * 80, 0, 7); c.stroke(); } c.globalAlpha = 1; grain(c, W, H, .05);
    } },
    { n: '色帶', deco: 'leftbar', draw(c, P) {
      base(c, P, 0); c.fillStyle = al(P.acc, .85); c.fillRect(0, 0, 70, H); c.fillStyle = al(P.acc, .25); c.fillRect(70, 0, 22, H);
      for (let i = 0; i < 6; i++) for (let j = 0; j < 4; j++) circ(c, W - 260 + i * 36, 80 + j * 36, 4.5, al(P.acc, .55));
      grain(c, W, H, .05);
    } }
  ];

  MOTIFS.forEach((M, mi) => {
    for (let j = 0; j < 6; j++) {
      const P = PAL[(mi * 2 + j) % PAL.length];
      const key = `g${mi}_${(mi * 2 + j) % PAL.length}`;
      THEMES[key] = {
        name: `${M.n}・${P.n}`, serif: (mi + j) % 3 === 0, text: P.text, red: P.red, accent: P.acc, dark: P.dark, hue: P.hue,
        card: { fill: P.card, alpha: P.dark ? .93 : .96, radius: 6 + (mi % 4) * 6, grain: false, deco: M.deco },
        bg(c, kind) { M.draw(c, P, kind); }
      };
    }
  });
})();
