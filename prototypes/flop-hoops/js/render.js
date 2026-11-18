// PROTOTYPE - NOT FOR PRODUCTION
// Question: Does one key plus floppy physics give a match that is chaotic, funny and still winnable on skill?
// Date: 2026-11-14
'use strict';
/**
 * Render: draws a round's world, the HUD and the overlays on a 2D canvas, in flat cut-out vector
 * with thick ink outlines. It reads physics bodies and game state; it never changes either.
 */
const Render = (() => {
  const INK = '#1d1a2b', LW = 6;
  const TEAM_NAMES = ['Tangerines', 'Tealbacks'];
  const TEAM_COLORS = ['#ff9a3c', '#1fc2b1'];
  const TEAM_DARK = ['#b5461b', '#118580'];
  let FONT = 'sans-serif';
  const lerp = (a, b, t) => a + (b - a) * t;
  const F = () => Physics.FLOOR_Y;

  function setFont(f) { FONT = f; }
  /** Interpolated position and angle of a body between the last two steps. */
  function pose(b, al) {
    if (b._px === undefined) return { x: b.position.x, y: b.position.y, a: b.angle };
    return { x: lerp(b._px, b.position.x, al), y: lerp(b._py, b.position.y, al), a: lerp(b._pa, b.angle, al) };
  }
  function ink(ctx, fill, lw = LW) {
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    ctx.lineWidth = lw; ctx.strokeStyle = INK; ctx.lineJoin = 'miter'; ctx.lineCap = 'square'; ctx.stroke(); // square corners: blocky
  }
  function rr(ctx, x, y, w, h) { ctx.beginPath(); ctx.rect(x, y, w, h); } // retro: every panel square-cornered
  function text(ctx, s, x, y, size, fill, o = {}) {
    ctx.font = `${size}px ${FONT}`;   // Departure Mono has one weight: heft comes from the outline
    ctx.textAlign = o.align || 'center'; ctx.textBaseline = 'middle';
    // a hard drop shadow under outlined text, as on the menus (o.shadow overrides its size, 0 turns it off)
    const sh = o.shadow ?? (o.stroke ? Math.max(2, Math.round(o.stroke / 2.5)) : 0);
    if (o.stroke) { ctx.lineJoin = 'round'; ctx.lineWidth = o.stroke;
      if (sh) { ctx.strokeStyle = 'rgba(8,4,20,0.6)'; ctx.strokeText(s, x + sh, y + sh); }
      ctx.strokeStyle = o.strokeColor || INK; ctx.strokeText(s, x, y); }
    else if (sh) { ctx.fillStyle = 'rgba(8,4,20,0.6)'; ctx.fillText(s, x + sh, y + sh); }
    ctx.fillStyle = fill; ctx.fillText(s, x, y);
  }

  // ---- Venues: flat and plain like the jerseys, darker and calmer than play ---------------
  // Each venue is four flat colours: sky, a horizon band, the floor, and its one line colour.
  const VENUES = {
    gym: { sky: '#4b2734', band: '#6e3a48', floor: '#b07a46', line: '#f3e3c3', side: '#3a2230' },
    rooftop: { sky: '#2f2a5a', band: '#7a4a6e', floor: '#6f6878', line: '#f1efe6', side: '#2a2442' },
    beach: { sky: '#6fb8cc', band: '#3a8fa3', floor: '#d8bd84', line: '#fffaf0', side: '#3d8d9a' },
    street: { sky: '#151c38', band: '#253058', floor: '#3a3e4c', line: '#f5d34f', side: '#171c2e' },
  };

  /**
   * The crowd in the stands behind the court: rows of heads on shoulders, each bobbing on its own
   * beat. w.hype (0..1, set by the spark machines and baskets) makes them bob higher and faster
   * and throw their arms up.
   */
  function crowd(ctx, w, W, f, v) {
    const hype = w.hype || 0, t = w.time || 0, looks = w.S.looks.flat(), kits = w.S.kits;
    const rows = Math.round(CONFIG.crowd_rows.value), gap = 26, top = f - 140;
    for (let r = 0; r < rows; r++) {
      const y0 = top + r * gap, step = 24, off = r % 2 ? step / 2 : 0;
      for (let x = off - step; x < W + step; x += step) {
        const i = Math.round(x / step) * 7 + r * 31, seed = Math.abs(Math.sin(i * 12.9898) * 43758.5453) % 1;
        if (seed < CONFIG.crowd_gaps.value) continue;                                         // an empty seat
        const rate = 1.4 + seed * 1.2 + hype * 6, amp = 2 + hype * 12;
        const bob = Math.round(Math.abs(Math.sin(t * rate + seed * 9)) * amp);
        const m = n => ((i % n) + n) % n;   // seats left of the screen edge have negative numbers
        const skin = looks[m(looks.length)].skin, shirt = m(3) === 2 ? v.side : kits[m(2)].jersey;
        const y = y0 - bob;
        ctx.fillStyle = shirt; ctx.fillRect(x - 9, y + 8, 18, 16);                          // shoulders
        if (hype > 0.3 && seed > 0.45) { ctx.fillStyle = skin; ctx.fillRect(x - 11, y - 10, 4, 14); ctx.fillRect(x + 7, y - 10, 4, 14); } // arms up
        ctx.fillStyle = skin; ctx.fillRect(x - 6, y - 4, 12, 12);                             // head
        if (hype > 0.2 && (Math.abs(i * 37 + Math.floor(t * 14) * 101) % 97) < hype * 5) { ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 4, y - 2, 8, 8); }   // a camera flash
      }
    }
  }

  /** Two #rrggbb colours mixed, k = 0 the first .. 1 the second. */
  function mix(c1, c2, k) {
    const a = parseInt(c1.slice(1), 16), b = parseInt(c2.slice(1), 16), kk = Math.max(0, Math.min(1, k));
    const ch = sh => Math.round(lerp((a >> sh) & 255, (b >> sh) & 255, kk));
    return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
  }
  /** A colour mixed toward black (k < 0) or white (k > 0) by |k|. */
  function shade(hex, k) {
    const n = parseInt(hex.slice(1), 16), to = k < 0 ? 0 : 255, a = Math.abs(k);
    const ch = sh => Math.round(lerp((n >> sh) & 255, to, a));
    return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
  }
  const hash = i => Math.abs(Math.sin(i * 12.9898 + 78.233) * 43758.5453) % 1;   // a fixed number 0..1 per index (no rng at draw time)

  /**
   * The backdrop behind the stands: each venue its own place, in flat square blocks of its own palette, kept darker
   * and calmer than the court. Drawn between the side walls (w.L..w.R) above the crowd band (which starts at f - 150).
   */
  function backdrop(ctx, w, v, f) {
    const L = w.L, R = w.R, top = f - 150, t = w.time || 0, kind = w.S.venue;
    const box = (x, y, bw, bh, c) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), Math.round(bw), Math.round(bh)); };
    if (kind === 'gym') {
      // the upper stand: rows of seats with a rail, a roof of trusses with hanging light rigs, banners, a video board, ad boards
      for (let r = 0; r < 5; r++) box(L, top - 120 + r * 24, R - L, 14, shade(v.sky, r % 2 ? -0.18 : -0.1));
      for (let x = L + 12; x < R; x += 24) for (let r = 0; r < 5; r++) if (hash(x * 3 + r) > 0.35) box(x, top - 128 + r * 24, 10, 8, shade(v.band, -0.05 - 0.1 * hash(x + r)));   // far fans
      box(L, top - 132, R - L, 6, shade(v.line, -0.55));                                                                         // the rail
      box(L, 60, R - L, 12, shade(v.sky, -0.4)); box(L, 132, R - L, 8, shade(v.sky, -0.4));                                     // roof chords
      for (let x = L; x <= R; x += 72) { box(x, 60, 8, 80, shade(v.sky, -0.4)); for (let k = 0; k < 6; k++) box(x + 8 + k * 10, 72 + k * 10, 10, 6, shade(v.sky, -0.32)); }   // posts and stepped diagonals
      for (let x = L + 108; x < R - 60; x += 216) {                                                                               // light rigs and their glow
        box(x, 140, 6, 26, shade(v.sky, -0.45)); box(x - 22, 164, 50, 14, shade(v.sky, -0.5));
        box(x - 18, 168, 42, 6, '#fff3c4');
        ctx.globalAlpha = 0.07; box(x - 40, 178, 86, 120, '#fff3c4'); box(x - 70, 298, 146, 90, '#fff3c4'); ctx.globalAlpha = 1;
      }
      for (const [x, team] of [[L + 40, 0], [L + 96, 1], [R - 132, 0], [R - 76, 1]]) {                                           // banners
        box(x, 144, 36, 70, shade(TEAM_DARK[team], -0.25)); box(x, 214, 14, 10, shade(TEAM_DARK[team], -0.25)); box(x + 22, 214, 14, 10, shade(TEAM_DARK[team], -0.25));
        box(x + 8, 160, 20, 6, shade(v.line, -0.4)); box(x + 8, 172, 20, 6, shade(v.line, -0.4));
      }
      const cx = w.cx;                                                                                                          // the hanging video board
      box(cx - 4, 140, 8, 40, shade(v.sky, -0.45)); box(cx - 74, 178, 148, 58, INK); box(cx - 68, 184, 136, 46, shade(v.sky, -0.55));
      box(cx - 60, 192, 50, 30, shade(TEAM_COLORS[0], -0.45)); box(cx + 10, 192, 50, 30, shade(TEAM_COLORS[1], -0.45));
    } else if (kind === 'rooftop') {
      // the city at dusk: stars, a skyline with lit windows, a water tank, and a string of lights over the court
      for (let i = 0; i < 40; i++) { const x = L + hash(i) * (R - L), y = 40 + hash(i + 99) * 160; if (Math.sin(t * 2 + i) > -0.6) box(x, y, 3, 3, shade(v.line, -0.3)); }
      let x = L;
      for (let i = 0; x < R; i++) {
        const bw = 60 + hash(i * 7) * 70, bh = 110 + hash(i * 13) * 210, y0 = top - bh, c = shade(v.sky, -0.25 - 0.15 * hash(i));
        box(x, y0, bw - 4, bh, c);
        for (let wy = y0 + 14; wy < top - 14; wy += 20) for (let wx = x + 10; wx < x + bw - 18; wx += 16) if (hash(wx * 1.3 + wy * 7) > 0.62) box(wx, wy, 7, 9, shade('#ffd27a', -0.35));
        if (i === 2) { box(x + 14, y0 - 46, 34, 30, shade(v.sky, -0.5)); box(x + 18, y0 - 16, 4, 16, shade(v.sky, -0.5)); box(x + 40, y0 - 16, 4, 16, shade(v.sky, -0.5)); }   // water tank
        x += bw;
      }
      for (let i = 0; i <= 40; i++) {                                                                                          // string lights, sagging between two poles
        const u = i / 40, sx = L + 20 + u * (R - L - 40), sy = 150 + Math.round(60 * 4 * u * (1 - u));
        box(sx, sy, 3, 3, shade(v.sky, -0.5));
        if (i % 2 === 0) box(sx - 2, sy + 3, 7, 7, Math.sin(t * 3 + i) > 0 ? '#ffd27a' : shade('#ffd27a', -0.3));
      }
    } else if (kind === 'beach') {
      // sea to the horizon, blocky clouds, a pier on posts, a lifeguard tower, palms
      for (let i = 0; i < 4; i++) { const cx = L + 80 + hash(i * 5) * (R - L - 200), cy = 70 + hash(i * 9) * 90; box(cx, cy, 90, 18, shade(v.sky, 0.25)); box(cx + 20, cy - 12, 50, 14, shade(v.sky, 0.25)); }
      for (let r = 0; r < 6; r++) box(L, top - 96 + r * 16, R - L, 16, shade(v.band, -0.05 * r + (r % 2 ? 0.05 : 0)));
      for (let r = 0; r < 6; r++) for (let x = L + ((r * 37) % 60); x < R; x += 90) box(x + Math.round(Math.sin(t + r + x) * 6), top - 92 + r * 16, 26, 3, shade(v.band, 0.3));   // glints
      box(R - 300, top - 72, 300, 10, shade(v.side, -0.35));                                                                    // the pier
      for (let x = R - 290; x < R; x += 40) box(x, top - 62, 6, 62, shade(v.side, -0.4));
      const lx = L + 70;                                                                                                       // lifeguard tower
      box(lx, top - 92, 54, 34, shade('#d1342c', -0.35)); box(lx - 6, top - 98, 66, 8, shade(v.side, -0.4));
      box(lx + 4, top - 58, 6, 58, shade(v.side, -0.4)); box(lx + 44, top - 58, 6, 58, shade(v.side, -0.4)); box(lx + 4, top - 32, 46, 5, shade(v.side, -0.4));
      for (const [px, h] of [[L + 190, 200], [R - 360, 170]]) {                                                                // palms: a stepped trunk and blocky fronds
        for (let k = 0; k < h; k += 12) box(px + Math.round(k * 0.12), top - k, 12, 13, shade(v.side, -0.45));
        const tx = px + Math.round(h * 0.12) + 6, ty = top - h;
        for (const [dx, dy, fw] of [[-60, 6, 56], [6, 6, 56], [-40, -6, 40], [4, -6, 40], [-14, -12, 28]]) box(tx + dx, ty + dy, fw, 10, shade('#2e7d4f', -0.4));
      }
    } else {
      // a night street: brick walls with lit windows, a chain-link fence, street lamps with their pools of light
      let x = L;
      for (let i = 0; x < R; i++) {
        const bw = 150 + hash(i * 3) * 90, y0 = 90 + hash(i * 11) * 90, c = shade(v.sky, 0.03 + 0.03 * (i % 2));
        box(x, y0, bw - 6, top - y0, c);
        for (let by = y0 + 8; by < top; by += 12) for (let bx = x + ((by / 12) % 2 ? 0 : 12); bx < x + bw - 6; bx += 24) box(bx, by, 22, 2, shade(v.sky, -0.12));   // brick courses
        for (let wy = y0 + 20; wy < top - 70; wy += 44) for (let wx = x + 16; wx < x + bw - 40; wx += 42) box(wx, wy, 22, 26, hash(wx + wy * 3) > 0.72 ? shade('#ffd27a', -0.55) : shade(v.sky, -0.22));
        x += bw;
      }
      ctx.globalAlpha = 0.35;                                                                                                  // chain-link fence
      for (let fx = L; fx < R; fx += 12) box(fx, top - 120, 2, 120, shade(v.line, -0.5));
      for (let fy = top - 120; fy < top; fy += 12) box(L, fy, R - L, 2, shade(v.line, -0.5));
      ctx.globalAlpha = 1;
      box(L, top - 124, R - L, 5, shade(v.line, -0.45));
      for (const lx of [L + 150, R - 160]) {                                                                                   // street lamps
        box(lx, top - 260, 8, 260, shade(v.side, 0.1)); box(lx - 4, top - 266, 40, 8, shade(v.side, 0.1)); box(lx + 24, top - 260, 20, 10, '#fff3c4');
        ctx.globalAlpha = 0.08; for (let k = 0; k < 4; k++) box(lx + 34 - 16 - k * 18, top - 250 + k * 60, 32 + k * 36, 60, '#fff3c4'); ctx.globalAlpha = 1;
      }
    }
  }

  function venue(ctx, w, W, H) {
    const v = VENUES[w.S.venue], f = F();
    ctx.fillStyle = v.sky; ctx.fillRect(0, 0, W, f);
    backdrop(ctx, w, v, f);
    ctx.fillStyle = v.band; ctx.fillRect(0, f - 150, W, 150);
    crowd(ctx, w, W, f, v);
    // LED ad boards along the near edge of the stands, a slow scroll of team-coloured blocks
    const t = w.time || 0, by = f - 26;
    ctx.fillStyle = INK; ctx.fillRect(0, by - 3, W, 25);
    for (let x = -((t * 30) % 64); x < W; x += 64) {
      const k = Math.floor((x + t * 30) / 64 + 1000);
      ctx.fillStyle = shade(k % 3 === 2 ? v.line : TEAM_COLORS[k % 2], -0.45); ctx.fillRect(Math.round(x) + 3, by, 58, 19);
      ctx.fillStyle = shade(v.line, -0.2); for (let j = 0; j < 4; j++) if (hash(k * 5 + j) > 0.4) ctx.fillRect(Math.round(x) + 10 + j * 12, by + 7, 8, 5);
    }
    ctx.fillStyle = v.floor; ctx.fillRect(0, f, W, H - f);
    ctx.fillStyle = v.line; ctx.fillRect(w.cx - 3, f, 6, H - f); ctx.fillRect(0, f, W, 4);
    ctx.fillStyle = v.side; ctx.fillRect(0, 0, w.L, H); ctx.fillRect(w.R, 0, W - w.R, H);
    ctx.fillStyle = INK; ctx.fillRect(w.L - 3, 0, 4, H); ctx.fillRect(w.R - 1, 0, 4, H);
  }

  // ---- Hoops ----------------------------------------------------------------------------
  /** Pole, backboard face and the back half of the rim: drawn behind the players. */
  function hoopBack(ctx, h) {
    const f = F(), outward = h.side, poleX = h.boardX + outward * 20, top = h.boardTop, bot = h.boardBot;
    ctx.beginPath(); ctx.rect(poleX - 6, top + 20, 12, f - top - 20); ink(ctx, '#8d93a8');
    ctx.beginPath(); ctx.rect(poleX - 12, f - 56, 24, 56); ink(ctx, '#3d4a7a');
    ctx.beginPath(); ctx.rect(Math.min(poleX, h.boardX), top + 24, Math.abs(poleX - h.boardX), 10); ink(ctx, '#8d93a8');
    // backboard face, seen at a slight angle, with its target square
    const fx = h.boardX, fw = outward * 22;
    ctx.beginPath();
    ctx.moveTo(fx, top); ctx.lineTo(fx + fw, top - 6); ctx.lineTo(fx + fw, bot - 6); ctx.lineTo(fx, bot); ctx.closePath();
    ink(ctx, '#f4f6fb');
    ctx.beginPath(); ctx.rect(Math.min(fx + fw * 0.2, fx + fw * 0.8), h.rimY - 38, Math.abs(fw * 0.6), 34);
    ctx.lineWidth = 4; ctx.strokeStyle = '#e04a3a'; ctx.stroke();
    ctx.beginPath(); ctx.rect(h.boardX - 5, top, 10, bot - top); ink(ctx, '#ffffff');
    // back half of the rim
    ctx.beginPath(); ctx.ellipse(h.cx, h.rimY, (h.x2 - h.x1) / 2, 6, 0, Math.PI, 0);
    ctx.lineWidth = 8; ctx.strokeStyle = INK; ctx.stroke(); ctx.lineWidth = 4; ctx.strokeStyle = '#c23c2c'; ctx.stroke();
  }

  /** Net and the front half of the rim: drawn over the ball, so a basket goes in. */
  function hoopFront(ctx, h, t) {
    const sway = Math.sin(t * 18) * 5 * h.sway + Math.sin(t * 30) * 3 * h.wobble;
    const top1 = h.x1 + 4, top2 = h.x2 - 4, inset = (top2 - top1) * 0.2;
    const b1 = top1 + inset + sway, b2 = top2 - inset + sway, depth = 54 + h.sway * 6 + (h.flex || 0) * 14;
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = Math.max(3, CONFIG.pixel_size.value * 1.2); // at least one art pixel wide
    ctx.beginPath();
    const n = 3;
    for (let i = 0; i <= n; i++) {
      const tx = lerp(top1, top2, i / n), bx = lerp(b1, b2, i / n);
      ctx.moveTo(tx, h.rimY); ctx.lineTo(bx, h.rimY + depth);
      if (i < n) { ctx.moveTo(tx, h.rimY); ctx.lineTo(lerp(b1, b2, (i + 1) / n), h.rimY + depth); }
      if (i > 0) { ctx.moveTo(tx, h.rimY); ctx.lineTo(lerp(b1, b2, (i - 1) / n), h.rimY + depth); }
    }
    ctx.moveTo(b1, h.rimY + depth); ctx.lineTo(b2, h.rimY + depth);
    ctx.stroke();
    const dy = Math.sin(t * 40) * 2 * h.wobble + (h.flex || 0) * 8, rx = (h.x2 - h.x1) / 2;   // (flex: bent down by a slam, springing back)
    const heat = h.gleam !== undefined && h.gleam !== null ? 1 : h.heat || 0;
    const rim = () => { ctx.beginPath(); ctx.ellipse(h.cx, h.rimY + dy, rx, 6, 0, 0, Math.PI); };
    if (heat > 0.4) {   // a red-hot rim glows, pulsing faster the hotter it gets
      const pulse = 0.5 + 0.5 * Math.sin(t * (8 + heat * 16));
      ctx.globalAlpha = (heat - 0.4) / 0.6 * (0.25 + 0.25 * pulse);
      rim(); ctx.lineWidth = 22; ctx.strokeStyle = '#ff5a1f'; ctx.stroke(); ctx.globalAlpha = 1;
    }
    rim(); ctx.lineWidth = 9; ctx.strokeStyle = INK; ctx.stroke();
    // its colour: the rim's red, through hot orange, to a crimson-white core
    const col = heat < 0.5 ? mix('#ef4b35', '#ff7a1a', heat / 0.5) : mix('#ff7a1a', '#ffd8c4', (heat - 0.5) / 0.5);
    rim(); ctx.lineWidth = 5; ctx.strokeStyle = col; ctx.stroke();
    if (heat > 0.7) { rim(); ctx.lineWidth = 2; ctx.strokeStyle = mix('#c4143c', '#ffffff', (heat - 0.7) / 0.3); ctx.stroke(); }   // the crimson core line
    if (h.gleam !== undefined && h.gleam !== null) {   // the gleam: a white flash sweeps along the rim and back, then the blast
      const k = h.gleam / CONFIG.rim_gleam_time.value, u = k < 0.5 ? k * 2 : 2 - k * 2, gx = h.cx + (u * 2 - 1) * rx * 1.1;
      ctx.save(); ctx.beginPath(); ctx.rect(gx - 12, h.rimY - 20, 24, 40); ctx.clip();
      rim(); ctx.lineWidth = 11; ctx.strokeStyle = '#ffffff'; ctx.stroke(); ctx.restore();
      ctx.globalAlpha = 0.35 + 0.35 * Math.sin(k * Math.PI * 6) ** 2; rim(); ctx.lineWidth = 30; ctx.strokeStyle = '#fff3c4'; ctx.stroke(); ctx.globalAlpha = 1;
    }
  }

  // ---- Players --------------------------------------------------------------------------
  function shadow(ctx, x, y, r) {
    const f = F(), k = Math.max(0.25, 1 - (f - y) / 500);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(x - r * k, f + 2, r * 2 * k, 7 * k);
  }

  /** A squircle path (superellipse, exponent 4) of half-size r around the origin. */
  function squirclePath(ctx, r, e = 4) {
    const pts = Physics.squircle(r, 32, e);
    ctx.beginPath(); pts.forEach((q, i) => i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)); ctx.closePath();
  }

  /**
   * Draw one slim ragdoll in plain blocks: no face and no shirt detail, only a squircle head,
   * a solid shirt over darker shorts, block legs and shoes, and a long arm with a square hand.
   */
  function player(ctx, p, al, kit) {
    const d = p.dims, look = p.look, dir = p.dir;
    const T = pose(p.torso, al), Hd = pose(p.head, al), A = pose(p.arm, al);
    shadow(ctx, T.x, T.y + d.torsoH, 22);

    for (const leg of p.legs) {
      const P = pose(leg, al);
      ctx.save(); ctx.translate(P.x, P.y); ctx.rotate(P.a);
      ctx.beginPath(); ctx.rect(-d.legW / 2, -d.legL / 2, d.legW, d.legL); ink(ctx, look.skin, 5);
      ctx.beginPath(); ctx.rect(dir > 0 ? -d.legW / 2 - 2 : -d.legW / 2 - 8, d.legL / 2 - 7, d.legW + 10, 10); ink(ctx, look.shoe, 5);
      ctx.restore();
    }

    // the back arm: drawn only, behind the torso, hanging from the same shoulder line
    ctx.save(); ctx.translate(T.x, T.y); ctx.rotate(T.a); ctx.translate(0, -d.torsoH / 2 + 10); ctx.rotate(p.back || 0);
    ctx.beginPath(); ctx.rect(-d.armW / 2, -5, d.armW, d.armL); ink(ctx, look.skin, 5);
    ctx.beginPath(); ctx.rect(-d.armW * 0.6, d.armL - 5 - d.armW * 0.5, d.armW * 1.2, d.armW * 1.1); ink(ctx, look.skin, 4);
    ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(-d.armW / 2, -5, d.armW, d.armL);   // a touch darker: it is the far arm
    ctx.restore();

    ctx.save(); ctx.translate(T.x, T.y); ctx.rotate(T.a);
    ctx.beginPath(); ctx.rect(-d.torsoW / 2, -d.torsoH / 2, d.torsoW, d.torsoH);
    ctx.fillStyle = kit.jersey; ctx.fill();
    ctx.fillStyle = kit.shorts; ctx.fillRect(-d.torsoW / 2, d.torsoH / 2 - d.torsoH * 0.32, d.torsoW, d.torsoH * 0.32);
    ink(ctx, null, 5);
    ctx.restore();

    ctx.save(); ctx.translate(Hd.x, Hd.y); ctx.rotate(T.a * 0.7);
    ctx.scale(d.headW / d.headS, 1);   // the head's extra width
    squirclePath(ctx, d.headS / 2, CONFIG.head_shape.value); ink(ctx, look.skin, 5);
    ctx.restore();

    ctx.save(); ctx.translate(A.x, A.y); ctx.rotate(A.a);
    ctx.beginPath(); ctx.rect(-d.armW / 2, -d.armL / 2, d.armW, d.armL); ink(ctx, look.skin, 5);
    // the hand; in a shot's follow-through the wrist bends over, palm down
    const bend = p.followT > 0 ? dir * CONFIG.wrist_bend.value * Math.min(1, p.followT / 0.12) : 0;
    ctx.translate(0, d.armL / 2 - d.armW * 0.3); ctx.rotate(bend);
    ctx.beginPath(); ctx.rect(-d.armW * 0.6, -d.armW * 0.2, d.armW * 1.2, d.armW * (bend ? 1.5 : 1.1)); ink(ctx, look.skin, 4);
    ctx.restore();
  }

  // ---- Ball -----------------------------------------------------------------------------
  /** The squircle ball with its seams. */
  function ball(ctx, x, y, r, a, withShadow = true, squash = 0) {
    if (withShadow) shadow(ctx, x, y, r);
    ctx.save(); ctx.translate(x, y + squash * r * 0.5);
    if (squash) ctx.scale(1 + squash, 1 - squash);   // squashed flat where it meets the floor (or the slam drives it down)
    ctx.rotate(a);
    const e = CONFIG.ball_shape.value;
    squirclePath(ctx, r, e); ink(ctx, '#e8591a', Math.max(4, r * 0.18));
    squirclePath(ctx, r - 1, e); ctx.save(); ctx.clip();
    ctx.strokeStyle = INK; ctx.lineWidth = Math.max(3, r * 0.12);
    ctx.beginPath(); ctx.moveTo(-r, 0); ctx.lineTo(r, 0); ctx.moveTo(0, -r); ctx.lineTo(0, r);
    ctx.moveTo(-r * 0.45, -r); ctx.quadraticCurveTo(-r * 0.95, 0, -r * 0.45, r);
    ctx.moveTo(r * 0.45, -r); ctx.quadraticCurveTo(r * 0.95, 0, r * 0.45, r);
    ctx.stroke();
    ctx.restore();
    ctx.restore();
    ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.fillRect(x - r * 0.6, y - r * 0.65, r * 0.4, r * 0.18);
  }

  const RAINBOW = ['#ff3b3b', '#ff9a1f', '#ffe23b', '#3bd66b', '#3ba7ff', '#9b5bff'];
  const CONTESTED = '#7ee08a'; // the trail of a shot that scored after a real touch of rim or backboard
  const LOB_GOLD = '#ffd23f'; // the trail of an alley-oop lob
  const FADE_BLUE = '#5aa8ff'; // the trail of a fadeaway that is going in
  const ICE = ['#ffd2a0', '#ff8a3a', '#ff4a2a']; // the spark machines' sparks: warm reds and oranges
  /** The fired ball's trail: blocks that shrink toward the tail; white, rainbow on a perfect line, green when contested. */
  function trail(ctx, tr, r, t) {
    const n = tr.pts.length;
    for (let i = 0; i < n; i++) {
      // the newest blocks sit under the ball: keep their corners inside its outline so no white pixels poke out of its sides
      const q = tr.pts[i], k = (i + 1) / n, sz = Math.min(r * 1.25, Math.max(6, r * CONFIG.trail_width.value * k));
      ctx.fillStyle = tr.mode === 'rainbow' ? RAINBOW[(i + Math.floor(t * 20)) % RAINBOW.length] : tr.mode === 'green' ? CONTESTED : tr.mode === 'blue' ? FADE_BLUE : tr.mode === 'lob' ? LOB_GOLD : '#ffffff';
      ctx.globalAlpha = 0.35 + 0.6 * k;
      ctx.fillRect(q.x - sz / 2, q.y - sz / 2, sz, sz);
    }
    ctx.globalAlpha = 1;
  }

  /**
   * The bubble over an AI player's head showing what it is attempting: ball (dribbling), shot, shield (a block or
   * a rim guard), screen (a wall), pass (an arrow), dunk (ball over a rim), steal (a hand), board (a rebound arrow).
   * `color` is its team's colour; `t` bobs it.
   */
  function aiIcon(ctx, x, y, kind, color, t, dir = 1) {
    ctx.save(); ctx.translate(x, y); ctx.scale(1.45, 1.45); x = 0; y = 0;   // (drawn at 15 units, shown a bit bigger: it must read at a glance)
    const by = y + Math.sin(t * 6) * 2.5, S = 15;
    rr(ctx, x - S, by - S, S * 2, S * 2); ink(ctx, '#fff3d6', 4);
    ctx.beginPath(); ctx.moveTo(x - 5, by + S); ctx.lineTo(x + 5, by + S); ctx.lineTo(x, by + S + 7); ctx.closePath(); ctx.fillStyle = '#fff3d6'; ctx.fill();   // the tail toward the head
    const ball = (bx, byy, r) => { ctx.beginPath(); ctx.arc(bx, byy, r, 0, Math.PI * 2); ctx.fillStyle = '#e8591a'; ctx.fill(); ctx.lineWidth = 1.6; ctx.strokeStyle = INK; ctx.stroke(); ctx.beginPath(); ctx.moveTo(bx - r, byy); ctx.lineTo(bx + r, byy); ctx.stroke(); };
    const px = (dx, dy, w, h, fill) => { ctx.fillStyle = fill; ctx.fillRect(x + dx, by + dy, w, h); };
    if (kind === 'ball') {   // dribbling: an arrow forward, the way the team attacks
      ctx.save(); ctx.translate(x, by); ctx.scale(dir, 1);
      ctx.fillStyle = INK; ctx.fillRect(-11, -3, 13, 6);
      ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(11, 0); ctx.lineTo(0, 10); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    else if (kind === 'shot') ball(x, by, 9);   // a shot: the ball
    else if (kind === 'fake') { ctx.lineWidth = 4.5; ctx.lineJoin = 'miter'; ctx.lineCap = 'butt'; ctx.strokeStyle = INK; ctx.beginPath(); ctx.moveTo(x - 7, by + 9); ctx.lineTo(x - 7, by - 3); ctx.lineTo(x - 3, by - 8); ctx.lineTo(x + 3, by - 8); ctx.lineTo(x + 7, by - 3); ctx.lineTo(x + 7, by + 1); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x + 1, by + 1); ctx.lineTo(x + 13, by + 1); ctx.lineTo(x + 7, by + 11); ctx.closePath(); ctx.fillStyle = '#d1342c'; ctx.fill(); ctx.lineWidth = 1.5; ctx.stroke(); }   // a U-turn arrow: up, round, and back down
    else if (kind === 'shield') { ctx.beginPath(); ctx.moveTo(x - 8, by - 9); ctx.lineTo(x + 8, by - 9); ctx.lineTo(x + 8, by + 1); ctx.lineTo(x, by + 10); ctx.lineTo(x - 8, by + 1); ctx.closePath(); ctx.fillStyle = '#2f6fe0'; ctx.fill(); ctx.lineJoin = 'miter'; ctx.lineWidth = 4.5; ctx.strokeStyle = INK; ctx.stroke(); ctx.lineWidth = 2.2; ctx.strokeStyle = '#d3d8e2'; ctx.stroke(); px(-2, -6, 4, 11, '#ffffff'); px(-5, -3, 10, 4, '#ffffff'); }   // a blue shield with a silver edge
    else if (kind === 'screen') { for (const [dx, dy, w] of [[-10, -10, 9], [0, -10, 10], [-10, -3, 5], [-5, -3, 10], [6, -3, 4], [-10, 4, 9], [0, 4, 10]]) { px(dx, dy, w, 6, '#c0602a'); ctx.lineWidth = 1.5; ctx.strokeStyle = INK; ctx.strokeRect(x + dx, by + dy, w, 6); } }   // a wall of bricks
    else if (kind === 'lob') { ball(x - 7, by + 7, 5); for (const [dx, dy] of [[-3, 1], [0, -3], [3, -6]]) px(dx, dy, 4, 4, INK); px(7, -11, 4, 15, INK); px(2, -11, 6, 3, '#ffd23f'); }   // a ball arcing up to the board
    else if (kind === 'pass') { px(-3, -11, 6, 13, INK); ctx.beginPath(); ctx.moveTo(x - 10, by + 1); ctx.lineTo(x + 10, by + 1); ctx.lineTo(x, by + 11); ctx.closePath(); ctx.fillStyle = INK; ctx.fill(); }   // a down arrow
    else if (kind === 'dunk') { px(7, -11, 4, 13, INK); px(-9, -3, 17, 3, '#e8591a'); ctx.lineWidth = 1.6; ctx.strokeStyle = INK; ctx.strokeRect(x - 9, by - 3, 17, 3); ctx.beginPath(); ctx.moveTo(x - 8, by); ctx.lineTo(x - 4, by + 10); ctx.lineTo(x + 4, by + 10); ctx.lineTo(x + 7, by); ctx.fillStyle = '#ffffff'; ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x - 2, by); ctx.lineTo(x - 1, by + 10); ctx.moveTo(x + 3, by); ctx.lineTo(x + 2, by + 10); ctx.stroke(); }   // a hoop: rim, net and a backboard edge
    else if (kind === 'steal') { for (const [dx, dy, h] of [[-7, -9, 9], [-3, -11, 11], [1, -9, 9], [5, -6, 6]]) { px(dx, dy, 3, h, color); ctx.lineWidth = 1.2; ctx.strokeStyle = INK; ctx.strokeRect(x + dx, by + dy, 3, h); } px(-7, 0, 15, 9, color); ctx.lineWidth = 1.5; ctx.strokeStyle = INK; ctx.strokeRect(x - 7, by, 15, 9); }
    else if (kind === 'board') { ctx.beginPath(); ctx.moveTo(x, by - 10); ctx.lineTo(x + 9, by); ctx.lineTo(x + 3, by); ctx.lineTo(x + 3, by + 9); ctx.lineTo(x - 3, by + 9); ctx.lineTo(x - 3, by); ctx.lineTo(x - 9, by); ctx.closePath(); ctx.fillStyle = INK; ctx.fill(); }
    ctx.restore();
  }

  /** A cold-spark machine: a squat box with a nozzle; it glows while it fires. */
  function sparkMachine(ctx, x, f, on, t) {
    ctx.beginPath(); ctx.rect(x - 22, f - 30, 44, 30); ink(ctx, '#3a3f55', 5);
    ctx.beginPath(); ctx.rect(x - 9, f - 42, 18, 12); ink(ctx, '#5d6480', 4);
    ctx.fillStyle = on > 0 ? (Math.floor(t * 16) % 2 ? '#ffd2a0' : '#ff6a2a') : '#24283a';
    ctx.fillRect(x - 14, f - 22, 28, 8);
  }

  /**
   * A dunk's motion in the air, by style. Every style leaves afterimages of the ball and a swoosh through them: a tomahawk's in
   * the dunker's colour with a white core; a two-hand hammer's wider and heavier (an ink edge, a yellow core); a honey dip's in
   * honey gold, dripping. A windmill draws a circular arc instead, in the team colour, round the shoulder along the hand's path
   * (from where the circle began to where the hand is now), with no afterimages, kept through the follow-through, fading after the slam.
   */
  function dunkTrail(ctx, d, B, r, al) {
    const p = d.p, col = TEAM_COLORS[p.team], G = d.ghosts, style = d.style;
    if (style === 'windmill' && d.arcFrom !== null && (!d.slammed || d.hangT < 0.3)) {
      const T = pose(p.torso, al), A = pose(p.arm, al), oy = -p.dims.torsoH / 2 + 10;
      const sx = T.x - Math.sin(T.a) * oy, sy = T.y + Math.cos(T.a) * oy, R = p.dims.armL + 2;   // round the shoulder, just past the hand
      const head = d.th + Math.atan2(Math.sin((A.a - T.a) * p.dir - d.th), Math.cos((A.a - T.a) * p.dir - d.th));   // the hand as drawn
      const from = Math.max(d.arcFrom, head - 5.6), fade = d.slammed ? 1 - d.hangT / 0.3 : 1, n = 28;
      if (head > from + 0.1) {
        ctx.lineCap = 'round';
        for (let i = 0; i < n; i++) {   // tail to head: thin and faint to full width
          const a0 = T.a + p.dir * lerp(from, head, i / n), a1 = T.a + p.dir * lerp(from, head, (i + 1) / n), k = (i + 1) / n;
          ctx.beginPath(); ctx.moveTo(sx - Math.sin(a0) * R, sy + Math.cos(a0) * R); ctx.lineTo(sx - Math.sin(a1) * R, sy + Math.cos(a1) * R);
          ctx.globalAlpha = fade * (0.15 + 0.75 * k); ctx.strokeStyle = col; ctx.lineWidth = 3 + r * 1.0 * k; ctx.stroke();
          ctx.globalAlpha = fade * (0.2 + 0.8 * k); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2 + r * 0.4 * k; ctx.stroke();
        }
        ctx.lineCap = 'butt'; ctx.globalAlpha = 1;
      }
    }
    if (!G || !G.length) return;
    const n = G.length, path = () => { ctx.beginPath(); G.forEach((g, i) => i ? ctx.lineTo(g.x, g.y) : ctx.moveTo(g.x, g.y)); ctx.lineTo(B.x, B.y); };
    ctx.lineCap = 'round';
    if (style === 'hammer') {   // heavy: an ink edge, the team colour, a yellow core
      path(); ctx.globalAlpha = 0.7; ctx.strokeStyle = INK; ctx.lineWidth = r * 1.45 + 6; ctx.stroke();
      ctx.globalAlpha = 0.75; ctx.strokeStyle = col; ctx.lineWidth = r * 1.45; ctx.stroke();
      ctx.globalAlpha = 0.95; ctx.strokeStyle = '#ffe23b'; ctx.lineWidth = r * 0.5; ctx.stroke();
    } else if (style === 'elbow') {   // honey: gold over orange, with drips falling off the afterimages
      path(); ctx.globalAlpha = 0.8; ctx.strokeStyle = '#ff9a1f'; ctx.lineWidth = r * 1.3; ctx.stroke();
      ctx.globalAlpha = 0.9; ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = r * 0.5; ctx.stroke();
      ctx.fillStyle = '#ffd23f';
      G.forEach((g, i) => { const k = (n - i) / n; ctx.globalAlpha = 0.3 + 0.5 * (1 - k); ctx.fillRect(g.x - 3, g.y + r * 0.6 + k * 16, 6, 6 + k * 6); });
    } else if (style !== 'windmill') {   // a tomahawk: the team colour with a white core
      path(); ctx.globalAlpha = 0.8; ctx.strokeStyle = col; ctx.lineWidth = r * 1.3; ctx.stroke();
      ctx.strokeStyle = '#ffffff'; ctx.globalAlpha = 0.9; ctx.lineWidth = r * 0.45; ctx.stroke();
    }
    ctx.lineCap = 'butt';
    const big = style === 'hammer' ? 1.1 : 1;
    if (style === 'windmill') { ctx.globalAlpha = 1; return; }   // (the arc is the windmill's trail: afterimages over it only muddy it)
    G.forEach((g, i) => { if (style === 'hammer' && i % 2) return; ctx.globalAlpha = 0.25 + 0.45 * i / n; ball(ctx, g.x, g.y, r * big * (0.8 + 0.2 * i / n), B.a, false); });
    ctx.globalAlpha = 1;
  }

  /** The whole court: venue, hoops, players, ball, nets. */
  /**
   * Each team's two-point line, painted on the floor in that team's colour (the line for the oranges is on the teal half, between the
   * teal basket and the centre line, and the other way round) with a faint beam above it so it reads in the air. A shooter of that team
   * holding the ball on the line's hot spot (inside line_zone) makes it flash: a shot from there goes in.
   */
  function twoLines(ctx, w, t, H) {
    if (!w.lineX) return;
    const zone = CONFIG.line_zone.value;
    for (const team of [0, 1]) {
      const x = Math.round(w.lineX[team]), col = TEAM_COLORS[team];
      const hot = !!w.hold && w.hold.p.team === team && Math.abs(Physics.handPos(w.hold.p).x - x) <= zone && (Physics.handPos(w.hold.p).x - w.cx) * w.hold.p.dir > 0 && w.hold.p.sinceGround < 0.06;
      const bg = ctx.createLinearGradient(0, F() - 260, 0, F());   // a faint beam up from the floor
      bg.addColorStop(0, 'rgba(0,0,0,0)'); bg.addColorStop(1, mixAlpha(col, hot ? 0.5 : 0.26));
      ctx.fillStyle = bg; ctx.fillRect(x - 7, F() - 260, 14, 260);
      ctx.fillStyle = '#14111f'; ctx.fillRect(x - 8, F() + 1, 16, H - F());                 // an ink edge so it reads on any floor
      ctx.fillStyle = hot && Math.floor(t * 8) % 2 ? '#ffffff' : col;                       // a painted stripe down the floor
      for (let y = F() + 3; y < H; y += 20) ctx.fillRect(x - 6, y, 12, 14);
      ctx.fillStyle = col; ctx.fillRect(x - 18, F() + 1, 36, 7);
      text(ctx, '2', x, F() + 44, 40, col, { stroke: 7 });
    }
  }
  /** `hex` as an rgba() string at alpha a. */
  function mixAlpha(c, a) { const n = parseInt(toHex(c).slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; }

  function world(ctx, w, al, t, W, H) {
    venue(ctx, w, W, H);
    twoLines(ctx, w, t, H);
    for (const x of [w.L - 40, w.R + 40]) sparkMachine(ctx, x, F(), w.sparkT || 0, t);
    for (const h of w.hoops) hoopBack(ctx, h);
    if (w.hold) { // the dunk zone: a floor marker under the attacked rim while its carrier is near
      const hp = w.hold.p, h = w.hoops.find(q => q.team === hp.team), dir = hp.dir, C = CONFIG;
      const near = (h.cx - hp.torso.position.x) * dir;
      if (near > -20 && near < C.dunk_reach_x.value * 2.4) {
        const x0 = h.cx - dir * C.dunk_ground_x.value, x1 = h.cx - dir * C.dunk_min_gap.value, ready = w.hold.dunkReady;
        ctx.fillStyle = ready ? (Math.floor(t * 8) % 2 ? '#ffd23f' : '#ffffff') : 'rgba(255,255,255,0.35)';
        ctx.fillRect(Math.min(x0, x1), F() + 6, Math.abs(x1 - x0), 5);
        ctx.fillStyle = ready ? '#ffd23f' : 'rgba(255,255,255,0.35)';
        ctx.fillRect(x0 - 2, F() + 3, 4, 11); ctx.fillRect(x1 - 2, F() + 3, 4, 11);
      }
    }
    const B = pose(w.ball, al), r = w.ball.r;
    for (const p of w.players) {
      if (w.hustle[p.team]) { // a trailing team's hustle: a flickering block glow at the feet
        const T = pose(p.torso, al), on = Math.floor(t * 8) % 2;
        ctx.fillStyle = on ? '#ffd23f' : '#ff9a3c'; ctx.fillRect(T.x - 18, F() - 6, 36, 6);
      }
      player(ctx, p, al, w.S.kits[p.team]);
    }
    if (w.trail) trail(ctx, w.trail, r, t);
    // (a replay draws a view made with Object.create over the world: the live dunk is not that moment's, so it is drawn live only)
    if (w.dunk && Object.getPrototypeOf(w) === Object.prototype) dunkTrail(ctx, w.dunk, B, r, al);
    const nearFloor = B.y + r > F() - 5, vy = w.ball.velocity.y;
    const sq = nearFloor && !w.hold ? Math.min(0.3, Math.abs(vy) * 0.035) : 0;
    ball(ctx, B.x, B.y, r, B.a, true, sq);
    if (w.flash && w.flash.t > 0) { // pickup flash: four blocks spinning out from the ball
      const k = 1 - w.flash.t / 0.25, d = r + 6 + k * 18;
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 4; i++) { const q = i * Math.PI / 2 + k * 2; ctx.fillRect(B.x + Math.cos(q) * d - 4, B.y + Math.sin(q) * d - 4, 8, 8); }
    }
    if (w.hold) { // the carrier's cock-back charge, a block meter over the head
      const p = w.hold.p, Hd = pose(p.head, al), bw = 52, x = Hd.x - bw / 2, y = Hd.y - p.dims.headS - 22;
      ctx.beginPath(); ctx.rect(x, y, bw, 12); ink(ctx, '#1d1a2b', 4);
      const bnc = w.hold.bouncing, c = bnc ? w.hold.bcharge : w.hold.charge;
      ctx.fillStyle = bnc ? '#7ad0ff' : !w.hold.armed ? '#8a83a8' : c >= 1 ? '#ffd23f' : TEAM_COLORS[p.team];
      ctx.fillRect(x + 2, y + 2, (bw - 4) * Math.max(w.hold.armed || bnc ? 0 : 1, Math.floor(c * 8) / 8), 8);
      if (w.hold.dunkReady) { // dunk on: the attacked rim flashes and a block arrow points down at it
        const hp = w.hoops.find(q => q.team === p.team), on = Math.floor(t * 10) % 2;
        ctx.fillStyle = on ? '#ffd23f' : '#ffffff';
        ctx.fillRect(hp.cx - 12, hp.rimY - 70, 24, 14); ctx.fillRect(hp.cx - 6, hp.rimY - 56, 12, 10);
      }
    }
    for (const h of w.hoops) hoopFront(ctx, h, t);
    if (B.y + r < 0) { // ball above the screen: a marker at the top edge
      const x = Math.max(30, Math.min(W - 30, B.x));
      ctx.beginPath(); ctx.moveTo(x, 6); ctx.lineTo(x - 14, 30); ctx.lineTo(x + 14, 30); ctx.closePath(); ink(ctx, '#e8591a', 3);
    }
  }

  // ---- HUD ------------------------------------------------------------------------------
  function keycap(ctx, x, y, label, s = 1) {
    rr(ctx, x - 22 * s, y - 20 * s, 44 * s, 42 * s, 9 * s); ink(ctx, '#f7f3ea', 3.5 * s);
    rr(ctx, x - 22 * s, y + 14 * s, 44 * s, 8 * s, 4 * s); ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.fill();
    if (label === 'up' || label === 'down') { // a drawn arrow, not a font symbol
      ctx.save(); ctx.translate(x, y); if (label === 'down') ctx.rotate(Math.PI); ctx.translate(-x, -y);
      ctx.beginPath(); ctx.moveTo(x, y - 11 * s); ctx.lineTo(x + 10 * s, y + 1 * s); ctx.lineTo(x + 4 * s, y + 1 * s);
      ctx.lineTo(x + 4 * s, y + 11 * s); ctx.lineTo(x - 4 * s, y + 11 * s); ctx.lineTo(x - 4 * s, y + 1 * s); ctx.lineTo(x - 10 * s, y + 1 * s); ctx.closePath();
      ctx.fillStyle = INK; ctx.fill(); ctx.restore();
    } else text(ctx, label, x, y, 24 * s, INK, { weight: 900 });
  }

  function crown(ctx, x, y, s = 1) {
    ctx.beginPath();
    ctx.moveTo(x - 20 * s, y + 10 * s); ctx.lineTo(x - 22 * s, y - 10 * s); ctx.lineTo(x - 10 * s, y);
    ctx.lineTo(x, y - 16 * s); ctx.lineTo(x + 10 * s, y); ctx.lineTo(x + 22 * s, y - 10 * s); ctx.lineTo(x + 20 * s, y + 10 * s); ctx.closePath();
    ink(ctx, '#ffd23f', 3.5 * s);
  }

  /** Scoreboard at the top: names, keys, big scores that pop and the round. */
  function scoreboard(ctx, W, st) {
    const cx = W / 2, y = 12, w = 600, h = 96, T = st.t || 0;
    // the menus' own dress: a bevelled panel with the two team colours as a split stripe, studs, a slow bob and a gleam
    ctx.save(); ctx.translate(0, Math.round(Math.sin(T * 1.6) * 1.5));
    panel(ctx, cx - w / 2, y, w, h, { accents: [TEAM_COLORS[0], TEAM_COLORS[1]], alpha: 1 });
    for (const team of [0, 1]) {
      const s = team ? 1 : -1, bx = cx + s * 190, col = TEAM_COLORS[team], x0 = bx - 100, y0 = y + 14, bw = 200, bh = h - 24;
      ctx.fillStyle = MENU_INK; notch(ctx, x0 - 3, y0 - 3, bw + 6, bh + 6, 4);
      ctx.fillStyle = sd(col, -0.3); notch(ctx, x0, y0, bw, bh, 4);
      ctx.fillStyle = col; notch(ctx, x0, y0, bw, bh - 6, 4);
      ctx.fillStyle = mx(col, '#ffffff', 0.35); ctx.fillRect(x0 + 4, y0 + 2, bw - 8, 3);
      text(ctx, TEAM_NAMES[team].toUpperCase(), bx - s * 28, y + 30, 17, '#ffffff', { stroke: 4 });
      if ((team === 1 && st.cpu) || (team === 0 && st.cpu0)) { const sty = team ? st.cpuStyle : st.cpuStyle0; text(ctx, 'CPU', bx - s * 28, y + (sty ? 58 : 62), 18, '#ffffff', { stroke: 4 }); if (sty) text(ctx, sty, bx - s * 28, y + 76, 12, '#ffffff', { stroke: 3 }); }   // the computer plays this side
      else { keycap(ctx, bx - s * 28 - 18, y + 62, team ? 'up' : 'W', 0.55); keycap(ctx, bx - s * 28 + 14, y + 62, team ? 'down' : 'S', 0.55); }
      const pop = st.pops[team];
      ctx.save(); ctx.translate(bx + s * (st.score[team] >= 10 ? 60 : 52), y + h / 2); ctx.scale(1 + pop * 0.6, 1 + pop * 0.6);
      text(ctx, String(st.score[team]), 0, 2, st.score[team] >= 10 ? 38 : 52, '#ffffff', { weight: 900, stroke: 7 });   // (two digits smaller, clear of the name)
      ctx.restore();
      if (st.leader === team) crown(ctx, bx + s * 52, y - 4, 0.9);
    }
    text(ctx, `FIRST TO ${st.target}`, cx, y + 30, 15, '#ffd23f');
    text(ctx, `ROUND ${st.round}`, cx, y + 54, 20, '#ffffff');
    text(ctx, st.leader < 0 ? 'TIED' : `${TEAM_NAMES[st.leader].toUpperCase()} LEAD`, cx, y + 77, 13,
      st.leader < 0 ? '#c9c3e0' : TEAM_COLORS[st.leader], { shadow: 2 });
    gleam(ctx, cx - w / 2, y, w, h, T);
    ctx.restore();
  }
  /** A white sheen that sweeps diagonally across a panel every few seconds, like the menu buttons' gleam. */
  function gleam(ctx, x, y, w, h, t, every = 5.5) {
    const ph = (t % every) / 0.7; if (ph >= 1) return;
    const gx = x - 60 + ph * (w + 120);
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.beginPath(); ctx.moveTo(gx, y); ctx.lineTo(gx + 36, y); ctx.lineTo(gx + 6, y + h); ctx.lineTo(gx - 30, y + h); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.beginPath(); ctx.moveTo(gx + 44, y); ctx.lineTo(gx + 54, y); ctx.lineTo(gx + 24, y + h); ctx.lineTo(gx + 14, y + h); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  /** The round card: flips in with the round number, ends on GO. */
  function roundCard(ctx, W, H, t, dur, S) {
    const flipIn = Math.min(1, t / 0.3), out = Math.max(0, (t - (dur - 0.25)) / 0.25);
    const sx = Math.sin(flipIn * Math.PI / 2) * (1 - out), cx = W / 2, cy = H / 2 - 10;
    ctx.fillStyle = `rgba(20,16,36,${0.35 * (1 - out)})`; ctx.fillRect(0, 0, W, H);
    if (t > dur - 0.5) {
      const k = Math.min(1, (t - (dur - 0.5)) / 0.15);
      ctx.save(); ctx.translate(cx, cy); ctx.scale(0.5 + k, 0.5 + k);
      text(ctx, 'GO!', 0, 0, 110, '#ffd23f', { weight: 900, stroke: 12 });
      ctx.restore();
      return;
    }
    ctx.save(); ctx.translate(cx, cy); ctx.scale(Math.max(0.01, sx), 1);
    // a square panel in the scoreboard's dress: dark fill, ink outline, a hard drop shadow, the two team colours as a
    // split stripe on top, pixel corner studs; ROUND in the HUD's yellow, the number white with an ink outline
    const pw = 300, ph = 250, x0 = -pw / 2, y0 = -ph / 2 + 6;
    panel(ctx, x0, y0, pw, ph, { accents: [TEAM_COLORS[0], TEAM_COLORS[1]], alpha: 1 });          // the menus' panel
    ctx.fillStyle = MENU_INK; ctx.fillRect(x0 + 18, y0 + 46, pw - 36, ph - 64);                  // inner bezel
    ctx.fillStyle = '#120d27'; ctx.fillRect(x0 + 22, y0 + 50, pw - 44, ph - 72);
    gleam(ctx, x0, y0, pw, ph, t * 3.2, 2.4);
    text(ctx, 'ROUND', 0, y0 + 76, 28, '#ffd23f', { weight: 900, stroke: 5 });
    text(ctx, String(S.round), 0, y0 + 142, 92, '#ffffff', { weight: 900, stroke: 10 });
    text(ctx, S.venueName.toUpperCase(), 0, y0 + 206, 15, '#c9c3e0', { weight: 700, stroke: 3 });
    ctx.restore();
  }

  const colMemo = new Map();   // colours as hex, so mixed colours can be mixed again
  const toHex = c => { if (c[0] === '#') return c; let h = colMemo.get(c); if (!h) { h = '#' + c.match(/\d+/g).slice(0, 3).map(v => (+v).toString(16).padStart(2, '0')).join(''); colMemo.set(c, h); } return h; };
  const mx = (a, b, k) => mix(toHex(a), toHex(b), k), sd = (c, k) => shade(toHex(c), k);
  // ---- Menus: polished retro arcade ----------------------------------------------------------
  const MENU_INK = '#0c0818';
  const clamp01 = v => Math.max(0, Math.min(1, v));
  /** A block with its corners stepped in by n px: the pixel-art "rounded" corner. */
  function notch(ctx, x, y, w, h, n = 4) { ctx.fillRect(x + n, y, w - 2 * n, h); ctx.fillRect(x, y + n, w, h - 2 * n); }

  /** A pixel-stepped glow halo round a box: rings of the colour, fading outward (cheaper than a blur). */
  function glow(ctx, x, y, w, h, col, k = 1) {
    const ga = ctx.globalAlpha; ctx.fillStyle = col;
    for (let i = 3; i >= 1; i--) { ctx.globalAlpha = ga * k * 0.16; notch(ctx, x - i * 4, y - i * 4, w + i * 8, h + i * 8, Math.min(12, 4 + i * 2)); }
    ctx.globalAlpha = ga;
  }
  /** Pixel icon glyphs for buttons: '#' cells are drawn, '.' cells stay clear (the face shows through). */
  const ICONS = {
    controller: ['..#########..', '.###########.', '##.#######.##', '#...#####.#.#', '##.#######.##', '#############', '####.....####', '.##.......##.'],
    players: ['..###...###..', '.#####.#####.', '.#####.#####.', '..###...###..', '.............', '.#####.#####.', '######.######', '######.######'],
    screen: ['#############', '#...........#', '#...#####...#', '#..#..#..#..#', '#...#####...#', '#...........#', '#############', '.....###.....', '...#######...'],
    gear: ['...###...', '.#.###.#.', '.#######.', '####.####', '###...###', '####.####', '.#######.', '.#.###.#.', '...###...'],
    sound: ['....#...#..', '...##....#.', '#####.#..#.', '#####..#..#', '#####..#..#', '#####..#..#', '#####.#..#.', '...##....#.', '....#...#..'],
    mute: ['....#......', '...##......', '#####.#...#', '#####..#.#.', '#####...#..', '#####..#.#.', '#####.#...#', '...##......', '....#......'],
    play: ['#.....', '##....', '###...', '####..', '#####.', '####..', '###...', '##....', '#.....'],
    restart: ['...####.#', '.##....##', '.#....###', '#........', '#........', '#.......#', '.#.....#.', '.##...##.', '...###...'],
    home: ['....#....', '...###...', '..#####..', '.#######.', '#########', '.###.###.', '.###.###.', '.###.###.', '.###.###.'],
    back: ['...#.....', '..##.....', '.########', '#########', '.########', '..##.....', '...#.....'],
    left: ['....#', '...##', '..##.', '.##..', '##...', '.##..', '..##.', '...##', '....#'],
    star: ['....#....', '....#....', '...###...', '#########', '.#######.', '..#####..', '..##.##..', '.##...##.', '.#.....#.'],
    sliders: ['..#......', '#########', '..#......', '.........', '......#..', '#########', '......#..'],
  };
  ICONS.right = ICONS.left.map(r => r.split('').reverse().join(''));
  /** Draw icon `name` centred on (cx, cy) in cells of `c` px, with a one-cell drop shadow under it. */
  function icon(ctx, name, cx, cy, c, color, shadow) {
    const g = ICONS[name]; if (!g) return 0;
    const w = g[0].length * c, h = g.length * c, x0 = Math.round(cx - w / 2), y0 = Math.round(cy - h / 2);
    const paint = (dx, dy, col) => { ctx.fillStyle = col; for (let r = 0; r < g.length; r++) for (let k = 0; k < g[r].length; k++) if (g[r][k] === '#') ctx.fillRect(x0 + k * c + dx, y0 + r * c + dy, c, c); };
    if (shadow) paint(0, Math.max(2, c / 2), shadow);
    paint(0, 0, color);
    return w;
  }
  const iconW = (name, c) => ICONS[name] ? ICONS[name][0].length * c : 0;

  /**
   * A polished arcade menu button. Backward compatible with { label, x, y, w, h, hint, scale, t, hot, pressT }.
   * The face is a bevelled slab sitting on the bottom edge of the hit box: light top edge, dark bottom
   * edge, an inner highlight line, stepped bands, a crisp ink outline and a soft drop shadow. Hot (hover
   * or keyboard focus) lifts it with an accent glow, a sweeping sheen and a focus ring of corner brackets;
   * pressing sinks it and pulls the shadow in.
   * Optional: b.kind 'primary' | 'secondary', b.icon (an ICONS name), b.sub (a second line on the face),
   * b.accent (face colour for primary, ring colour for secondary), b.glyphOnly (icon without the label).
   */
  function buttonPart(ctx, b, accent, part) {
    const U = part === 'under', S = part === 'static', O = part === 'over';
    const t = b.t || 0, hot = !!b.hot, pressed = (b.pressT || 0) > 0;
    const prim = (b.kind || 'primary') === 'primary';
    const acc = b.accent || accent || (prim ? '#ffd23f' : '#7ad7ff');
    const face = prim ? acc : '#3a2f6e';
    const x = Math.round(b.x), w = Math.round(b.w), base = Math.round(b.y + b.h);
    const rest = prim ? 8 : 6, depth = pressed ? 2 : hot ? rest + 4 : rest;
    const fh = Math.round(b.h) - rest, fy = base - depth - fh, P = 4;
    ctx.save();
    // soft drop shadow: stacked, widening, fading blocks; it spreads when lifted and tucks in when pressed
    const f = hot ? mx(face, '#ffffff', 0.12) : face;
    if (S) {
    const sOff = pressed ? 2 : hot ? 12 : 7, sGrow = pressed ? 1 : hot ? 4 : 3;
    for (let k = 2; k >= 1; k--) { ctx.fillStyle = 'rgba(4,2,12,0.2)'; notch(ctx, x - k * sGrow, fy + sOff - k * sGrow + 4, w + 2 * k * sGrow, base - fy + 2 * k * sGrow, 6); }
    ctx.fillStyle = 'rgba(4,2,12,0.45)'; notch(ctx, x - 2, fy + sOff, w + 4, base - fy + 2, 4);
    }
    if (hot && U) { // the accent glow halo, breathing
      glow(ctx, x - 4, fy - 4, w + 8, base - fy + 8, acc, 0.85 + Math.sin(t * 5) * 0.15);
    }
    if (S) {
    ctx.fillStyle = MENU_INK; notch(ctx, x - 4, fy - 4, w + 8, base - fy + 8, 4);   // crisp outline
    // the slab's side (its thickness), darker at the very bottom
    ctx.fillStyle = sd(face, -0.45); ctx.fillRect(x, fy + fh, w, depth);
    ctx.fillStyle = sd(face, -0.62); ctx.fillRect(x, base - 2, w, 2);
    // the face: stepped bands, then bevel edges
    ctx.fillStyle = f; ctx.fillRect(x, fy, w, fh);
    ctx.fillStyle = mx(f, '#ffffff', 0.2); ctx.fillRect(x, fy, w, Math.round(fh * 0.22));
    ctx.fillStyle = mx(f, '#ffffff', 0.1); ctx.fillRect(x, fy + Math.round(fh * 0.22), w, Math.round(fh * 0.22));
    ctx.fillStyle = sd(f, -0.08); ctx.fillRect(x, fy + Math.round(fh * 0.7), w, Math.round(fh * 0.3));
    ctx.fillStyle = mx(f, '#ffffff', 0.6); ctx.fillRect(x, fy, w, P);                    // light top edge
    ctx.fillStyle = mx(f, '#ffffff', 0.3); ctx.fillRect(x, fy + P, P, fh - 2 * P);         // light left edge
    ctx.fillStyle = sd(f, -0.18); ctx.fillRect(x + w - P, fy + P, P, fh - 2 * P);        // dark right edge
    ctx.fillStyle = sd(f, -0.3); ctx.fillRect(x, fy + fh - P, w, P);                     // dark bottom edge
    ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fillRect(x + 3 * P, fy + P + 3, w - 6 * P, 2);   // inner highlight line
    ctx.fillStyle = MENU_INK; for (const [cx, cy] of [[x, fy], [x + w - P, fy], [x, base - P], [x + w - P, base - P]]) ctx.fillRect(cx, cy, P, P);   // stepped corners
    if (!prim) { ctx.fillStyle = hot ? acc : sd(acc, -0.35); ctx.fillRect(x + P, fy + fh - P, w - 2 * P, P); }   // a secondary button's accent lip
    if (pressed) { ctx.fillStyle = 'rgba(0,0,0,0.1)'; ctx.fillRect(x, fy, w, fh); }
    }
    if (hot && O) { // the sheen: a stepped, slanted pair of bands sweeping across the face every 1.5 s
      const k = ((t * 0.95) % 1.5) / 1.1;
      if (k < 1) {
        ctx.save(); ctx.beginPath(); ctx.rect(x + P, fy + P, w - 2 * P, fh - 2 * P); ctx.clip();
        const sx = x - 40 + k * (w + 80);
        for (let r = 0; r < fh; r += P) { const dx = Math.round((fh - r) * 0.45 / P) * P;
          ctx.fillStyle = 'rgba(255,255,255,0.38)'; ctx.fillRect(sx + dx, fy + r, 16, P);
          ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.fillRect(sx + dx + 22, fy + r, 6, P); }
        ctx.restore();
      }
    }
    // content: icon, label and an optional second line, centred as one block
    if (S) {
    const sc = b.scale || 4, ink = prim ? INK : '#f4f0ff';
    const emb = prim ? mx(f, '#ffffff', 0.55) : MENU_INK;                       // label shadow: an engraved light edge on primaries
    const cx = x + w / 2, cy = fy + fh / 2;
    const ic = b.icon ? (b.iconCell || (sc >= 4 ? 4 : 3)) : 0, iw = b.icon ? iconW(b.icon, ic) : 0;
    if (b.icon && b.glyphOnly) icon(ctx, b.icon, cx, cy, ic, ink, prim ? emb : MENU_INK);
    else {
      const ss = 2, lw = PixelFont.width(b.label, sc), sw = b.sub ? PixelFont.width(b.sub, ss) : 0, tw = Math.max(lw, sw);
      const gap = b.icon ? Math.round(sc * 3.5) : 0, x0 = cx - (iw + gap + tw) / 2, tx = x0 + iw + gap + tw / 2;
      const ly = b.sub ? cy - fh * 0.15 : cy, sy = cy + fh * 0.24;
      if (b.icon) icon(ctx, b.icon, x0 + iw / 2, cy, ic, ink, prim ? sd(f, -0.25) : MENU_INK);
      PixelFont.draw(ctx, b.label, tx, ly, { scale: sc, color: ink, shadow: Math.max(1, sc / 2), shadowColor: emb });
      if (b.sub) PixelFont.draw(ctx, b.sub, tx, sy, { scale: ss, color: prim ? sd(f, -0.62) : '#c9c3e0', shadow: 0 });
    }
    }
    if (hot && O) { // keyboard focus ring: white corner brackets just outside the outline, pulsing
      const g = 8 + Math.round((Math.sin(t * 6) + 1) * 1.5), L = 14, T = 4;
      const l = x - 4 - g, r = x + w + 4 + g, tp = fy - 4 - g, bt = base + 4 + g;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(l, tp, L, T); ctx.fillRect(l, tp, T, L); ctx.fillRect(r - L, tp, L, T); ctx.fillRect(r - T, tp, T, L);
      ctx.fillRect(l, bt - T, L, T); ctx.fillRect(l, bt - L, T, L); ctx.fillRect(r - L, bt - T, L, T); ctx.fillRect(r - T, bt - L, T, L);
    }
    if (S && b.hint) PixelFont.draw(ctx, b.hint, x + w / 2, base + 24, { scale: 2, color: hot ? '#ffffff' : '#c9c3e0', shadow: 2 });
    ctx.restore();
  }  // Each button's still image (shadow, slab, face, content, hint) is cached per state; only the glow,
  // the sheen and the focus ring are drawn live.
  const btnCache = new Map();
  function button(ctx, b, accent) {
    const k = Math.max(1, Math.min(3, ctx.getTransform().a)), pad = 28;
    const key = [b.label, b.w, b.h, b.hint, b.scale, b.kind, b.accent || accent, b.icon, b.sub, b.glyphOnly, b.iconCell, !!b.hot, (b.pressT || 0) > 0, k, window.FONT_OK ? 1 : 0].join('|');
    const ox = Math.round(b.x) - pad, oy = Math.round(b.y) - pad, cw = Math.round(b.w) + 2 * pad, ch = Math.round(b.h) + 2 * pad + 24;
    let c = btnCache.get(key);
    if (!c) {
      if (btnCache.size > 160) btnCache.clear();
      c = document.createElement('canvas'); c.width = Math.ceil(cw * k); c.height = Math.ceil(ch * k);
      const g = c.getContext('2d'); g.setTransform(k, 0, 0, k, -ox * k, -oy * k);
      buttonPart(g, b, accent, 'static'); btnCache.set(key, c);
    }
    buttonPart(ctx, b, accent, 'under');
    ctx.drawImage(c, ox, oy, cw, ch);
    buttonPart(ctx, b, accent, 'over');
  }


  /** A menu panel: soft shadow, ink outline, a dark banded body with bevel edges, an accent stripe
   *  (one colour, or o.accents for a split) and an optional title tab. */
  function panel(ctx, x, y, w, h, o = {}) {
    const acc = o.accent || '#ffd23f', P = 4;
    ctx.save();
    ctx.fillStyle = 'rgba(4,2,12,0.22)'; notch(ctx, x - 12, y + 2, w + 24, h + 22, 12);
    ctx.fillStyle = 'rgba(4,2,12,0.4)'; notch(ctx, x - 4, y + 8, w + 8, h + 10, 6);
    ctx.fillStyle = MENU_INK; notch(ctx, x - 4, y - 4, w + 8, h + 8, 4);
    const ga = ctx.globalAlpha; ctx.globalAlpha = ga * (o.alpha || 0.95);
    const bands = ['#2c2354', '#261e4b', '#211a42', '#1c1639'];
    bands.forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(x, y + Math.round(h * i / 4), w, Math.ceil(h / 4) + 1); });
    ctx.globalAlpha = ga;
    ctx.fillStyle = '#41367a'; ctx.fillRect(x, y, w, P); ctx.fillRect(x, y, P, h);               // bevel light
    ctx.fillStyle = '#120d27'; ctx.fillRect(x, y + h - P, w, P); ctx.fillRect(x + w - P, y, P, h); // bevel dark
    const acs = o.accents || [acc];
    acs.forEach((c, i) => { const sx = x + Math.round(w * i / acs.length), sw = Math.round(w / acs.length);
      ctx.fillStyle = c; ctx.fillRect(sx, y, sw, 6); ctx.fillStyle = mx(c, '#ffffff', 0.45); ctx.fillRect(sx, y, sw, 2); ctx.fillStyle = sd(c, -0.4); ctx.fillRect(sx, y + 6, sw, 2); });
    ctx.fillStyle = MENU_INK; ctx.fillRect(x, y, P, P); ctx.fillRect(x + w - P, y, P, P); ctx.fillRect(x, y + h - P, P, P); ctx.fillRect(x + w - P, y + h - P, P, P);
    ctx.fillStyle = '#4a3f86'; for (const [sx, sy] of [[x + 10, y + h - 14], [x + w - 14, y + h - 14]]) ctx.fillRect(sx, sy, 4, 4);   // corner studs
    if (o.title) {
      PixelFont.draw(ctx, o.title, x + 20, y + 30, { scale: 2, color: o.titleColor || acc, align: 'left', shadow: 2 });
      ctx.fillStyle = 'rgba(255,255,255,0.07)'; ctx.fillRect(x + 16, y + 48, w - 32, 2);
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(x + 16, y + 50, w - 32, 2);
    }
    ctx.restore();
  }

  const LEVEL_COLORS = ['#1fc2b1', '#5fd08a', '#b9dc55', '#ffd23f', '#ff9a3c', '#ff5b5b'];
  /** Colour of level `lv` of `n` (cool for easy, hot for hard). */
  const levelColor = (lv, n) => LEVEL_COLORS[Math.round((lv - 1) / Math.max(1, n - 1) * (LEVEL_COLORS.length - 1))];
  /** A segmented level bar: n segments centred on stops from x to x + w, lit up to `lv`, with a glowing knob on it. */
  function levelBar(ctx, x, y, w, lv, n, t, o = {}) {
    const seg = w / (n - 1), h = o.h || 22, left = Math.round(x - seg / 2), P = 4;
    ctx.save();
    ctx.fillStyle = MENU_INK; notch(ctx, left - 6, y - h / 2 - 6, Math.round(seg * n) + 12, h + 12, 4);
    ctx.fillStyle = '#0f0b22'; ctx.fillRect(left - 2, y - h / 2 - 2, Math.round(seg * n) + 4, h + 4);
    for (let i = 0; i < n; i++) {
      const sx = Math.round(left + i * seg + 3), sw = Math.round(seg - 6), on = i < lv, sy = Math.round(y - h / 2);
      const c = on ? levelColor(i + 1, n) : '#2c2452';
      ctx.fillStyle = c; ctx.fillRect(sx, sy, sw, h);
      ctx.fillStyle = mx(c, '#ffffff', on ? 0.4 : 0.12); ctx.fillRect(sx, sy, sw, P);
      ctx.fillStyle = sd(c, -0.3); ctx.fillRect(sx, sy + h - P, sw, P);
      if (on) { ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(sx + P, sy + P + 2, Math.max(0, sw - 2 * P), 2); }
    }
    const kx = Math.round(x + (lv - 1) * seg), kc = levelColor(lv, n), kh = h + 22;
    glow(ctx, kx - 14, y - kh / 2 - 2, 28, kh + 4, kc, 0.8 + Math.sin(t * 4) * 0.2);
    ctx.fillStyle = MENU_INK; notch(ctx, kx - 14, y - kh / 2 - 2, 28, kh + 4, 4);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(kx - 10, y - kh / 2 + 2, 20, kh - 4);
    ctx.fillStyle = '#d9d2f2'; ctx.fillRect(kx - 10, y + kh / 2 - 8, 20, 6); ctx.fillRect(kx + 6, y - kh / 2 + 2, 4, kh - 4);
    ctx.fillStyle = kc; ctx.fillRect(kx - 4, y - 8, 8, 16);
    ctx.fillStyle = sd(kc, -0.4); ctx.fillRect(kx - 4, y + 4, 8, 4);
    ctx.restore();
  }

  /** A little pixel basketball: square cells, lit from the top left, seams turning with `rot`. */
  function pixelBall(ctx, x, y, r, rot, squash = 0) {
    const c = 4, sx = 1 + squash, sy = 1 - squash, n = Math.ceil(r / c) + 1, ca = Math.cos(rot), sa = Math.sin(rot);
    const x0 = Math.round(x), y0 = Math.round(y);
    for (let j = -n; j < n; j++) for (let i = -n; i < n; i++) {
      const px = (i + 0.5) * c / sx, py = (j + 0.5) * c / sy, d = Math.hypot(px, py);
      if (d > r) continue;
      let col;
      if (d > r - c * 1.1) col = MENU_INK;
      else {
        const u = px * ca + py * sa, v = -px * sa + py * ca;
        const seam = Math.abs(u) < c * 0.55 || Math.abs(v) < c * 0.55 || Math.abs(Math.hypot(u - r * 1.05, v) - r * 0.72) < c * 0.55 || Math.abs(Math.hypot(u + r * 1.05, v) - r * 0.72) < c * 0.55;
        const lit = (-px - py) / (r * 1.4);
        col = seam ? '#3a1a0c' : lit > 0.45 ? '#ffc07a' : lit > 0.05 ? '#ff9a3c' : lit > -0.4 ? '#e8742a' : '#b5461b';
      }
      ctx.fillStyle = col; ctx.fillRect(x0 + i * c, y0 + j * c, c, c);
    }
  }

  // The logo, rendered once per word into an offscreen canvas (it only changes when the font arrives).
  const logoCache = {};
  function logoWord(word, color, dark, s, k) {
    const key = [word, color, s, k, window.FONT_OK ? 1 : 0].join('|');
    if (logoCache[key]) return logoCache[key];
    const tw = PixelFont.width(word, s) + 2 * s, pad = 50, ext = Math.round(s * 1.1), step = Math.max(2, Math.round(s / 3)), o = Math.max(3, Math.round(s * 0.5));
    const cw = tw + pad * 2, ch = s * 10 + ext + pad * 2, ax = cw / 2, ay = pad + s * 5;
    const mk = () => { const c = document.createElement('canvas'); c.width = Math.ceil(cw * k); c.height = Math.ceil(ch * k); const g = c.getContext('2d'); g.setTransform(k, 0, 0, k, 0, 0); return [c, g]; };
    const put = (g, dx, dy, col) => PixelFont.draw(g, word, ax + dx, ay + dy, { scale: s, color: col, shadow: 0 });
    const ring = (g, dy, col) => { for (const [a, b2] of [[-o, 0], [o, 0], [0, -o], [0, o], [-o, -o], [o, o], [-o, o], [o, -o]]) put(g, a, dy + b2, col); };
    // the face, with stepped bands painted only where the letters are
    const [fc, fg] = mk(); put(fg, 0, 0, color);
    const img = fg.getImageData(0, 0, fc.width, fc.height).data; let top = fc.height, bot = 0;
    for (let yy = 0; yy < fc.height; yy++) for (let xx = 0; xx < fc.width; xx += 2) if (img[(yy * fc.width + xx) * 4 + 3] > 128) { if (yy < top) top = yy; bot = yy; break; }
    top /= k; bot /= k; const gh = Math.max(1, bot - top);
    fg.globalCompositeOperation = 'source-atop';
    const band = (a, b2, col) => { fg.fillStyle = col; fg.fillRect(0, top + gh * a, cw, gh * (b2 - a) + 0.5); };
    band(0, 0.2, mx(color, '#ffffff', 0.42)); band(0.2, 0.42, mx(color, '#ffffff', 0.2)); band(0.72, 0.86, sd(color, -0.1)); band(0.86, 1.01, sd(color, -0.22));
    fg.fillStyle = 'rgba(255,255,255,0.85)'; fg.fillRect(0, top + Math.round(s * 0.55), cw, Math.max(2, Math.round(s * 0.3)));   // inner highlight line
    // everything else, under the face
    const [c, g] = mk();
    g.save(); g.shadowColor = color; g.shadowBlur = 34 * k; g.globalAlpha = 0.7; ring(g, ext / 2, color); g.restore();   // soft glow
    g.globalAlpha = 0.5; ring(g, ext + s, '#05020c'); g.globalAlpha = 1;                                              // drop shadow
    for (let d = ext; d >= 0; d -= 1) ring(g, d, MENU_INK);                                                           // outline round face and extrude
    for (let d = ext; d >= 1; d -= 1) put(g, 0, d, Math.floor(d / step) % 2 ? dark : sd(dark, -0.22));           // stepped extrude
    put(g, 0, Math.max(2, Math.round(s * 0.3)), MENU_INK);                                                           // the seam between face and side
    g.drawImage(fc, 0, 0, cw, ch);
    return (logoCache[key] = { c, cw, ch, ax, ay, top: top - ay, w: tw - 2 * s });
  }
  const easeOutBack = u => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(u - 1, 3) + c1 * Math.pow(u - 1, 2); };
  /**
   * The FLOP HOOPS title: two extruded words that slide in from the sides over the first 0.8 s of
   * `intro`, then bob gently; a pixel basketball hops along the letters. `still` (reduced motion)
   * drops the slide, the bob and the hops.
   */
  function menuLogo(ctx, W, y, t, intro, still) {
    const s = 12, gap = 22, k = Math.max(1, Math.min(3, ctx.getTransform().a));
    const A = logoWord('FLOP', TEAM_COLORS[0], TEAM_DARK[0], s, k), B = logoWord('HOOPS', TEAM_COLORS[1], TEAM_DARK[1], s, k);
    const ax = W / 2 - gap - A.w / 2, bx = W / 2 + gap + B.w / 2;
    const ea = still ? 1 : easeOutBack(clamp01(intro / 0.55)), eb = still ? 1 : easeOutBack(clamp01((intro - 0.12) / 0.55));
    const bob = still ? 0 : Math.round(Math.sin(t * 2) * 4) * clamp01((intro - 0.6) / 0.3);
    const land = still ? 0 : Math.max(0, Math.sin(clamp01((intro - 0.5) / 0.3) * Math.PI)) * 0.06;   // a squash as the words land
    const word = (L, cx, cy, e, from) => {
      if (e <= 0) return;
      ctx.save(); ctx.translate(cx + (1 - e) * from, cy); ctx.scale(1 + land, 1 - land);
      ctx.globalAlpha *= clamp01(e * 1.5); ctx.drawImage(L.c, -L.ax, -L.ay, L.cw, L.ch); ctx.restore();
    };
    word(A, ax, y + bob, ea, -760); word(B, bx, y - bob, eb, 760);
    if (still || intro < 0.7) return;
    // the ball: drops in, then hops letter to letter and back (the font is monospaced, so letters sit 6 cells apart)
    const xs = [], tops = [];
    for (let i = 0; i < 4; i++) { xs.push(ax - A.w / 2 + (i + 0.5) * 6 * s - s / 2); tops.push(y + bob + A.top); }
    for (let i = 0; i < 5; i++) { xs.push(bx - B.w / 2 + (i + 0.5) * 6 * s - s / 2); tops.push(y - bob + B.top); }
    const r = 15, hop = 0.42, tt = intro - 0.7, hn = Math.floor(tt / hop), u = (tt % hop) / hop, per = 2 * (xs.length - 1);
    const at = n => { const m = n % per; return m < xs.length ? m : per - m; };
    const i0 = at(Math.max(0, hn - 1)), i1 = at(hn);
    const fx = hn === 0 ? xs[0] - 90 : xs[i0], fy = hn === 0 ? -60 : tops[i0] - r;
    const bxp = fx + (xs[i1] - fx) * u, base = fy + (tops[i1] - r - fy) * u, by = base - Math.sin(u * Math.PI) * (hn === 0 ? 8 : 20);
    const sq = u > 0.9 ? (u - 0.9) * 2.2 : u < 0.08 ? (0.08 - u) * 2.5 : 0;
    ctx.fillStyle = 'rgba(5,2,12,0.45)'; const sw = Math.round(r * (0.6 + 0.6 * (1 - Math.sin(u * Math.PI))));
    ctx.fillRect(Math.round(xs[i1] - sw / 2), Math.round(tops[i1] - 4), sw, 4);
    pixelBall(ctx, bxp, by + r * sq, r, tt * 5, sq);
  }

  // ---- The arena behind the menus ------------------------------------------------------------
  const ARENA = { floor: 470, board: 426 };
  let arenaCache = null, hazeCache = null, crowdList = null;
  function arenaStatic(g, W, H) {
    const F = ARENA.floor, Bd = ARENA.board;
    // ceiling and the stands' back wall
    const sky = ['#06030d', '#0a0617', '#0e0920', '#120b29'];
    sky.forEach((c, i) => { g.fillStyle = c; g.fillRect(0, i * 30, W, 31); });
    g.fillStyle = '#140d2e'; g.fillRect(0, 120, W, Bd - 120);
    // the truss and its lamps
    g.fillStyle = '#1e1640'; g.fillRect(0, 22, W, 10); g.fillStyle = '#2a2056'; g.fillRect(0, 22, W, 3);
    for (let x = 0; x < W; x += 40) { g.fillStyle = '#1a1336'; g.fillRect(x, 32, 4, 12); }
    for (let x = 160; x < W; x += 320) {
      const rg = g.createRadialGradient(x, 40, 2, x, 40, 70); rg.addColorStop(0, 'rgba(255,240,200,0.35)'); rg.addColorStop(1, 'rgba(255,240,200,0)');
      g.fillStyle = rg; g.fillRect(x - 70, 0, 140, 110);
      g.fillStyle = '#fff6dc'; g.fillRect(x - 12, 34, 24, 8); g.fillStyle = '#ffffff'; g.fillRect(x - 8, 36, 16, 4);
    }
    // the ribbon board ringing the upper deck: team-colour light dashes
    g.fillStyle = MENU_INK; g.fillRect(0, 104, W, 16);
    for (let x = 0; x < W; x += 24) { g.fillStyle = sd(TEAM_COLORS[x < W / 2 ? 0 : 1], -0.35); g.fillRect(x + 4, 108, 14, 8); }
    // tiers: each row a riser with a lit step edge, darker toward the top
    for (let r = 0; r < 8; r++) {
      const y = 124 + r * 38, k = r / 7;
      g.fillStyle = mx('#0f0a22', '#1d1540', k); g.fillRect(0, y, W, 38);
      g.fillStyle = mx('#1a1236', '#2e2460', k); g.fillRect(0, y + 34, W, 4);
    }
    for (const ax of [214, 640, 1066]) { g.fillStyle = '#0b0819'; g.fillRect(ax - 14, 124, 28, Bd - 124); for (let y = 128; y < Bd; y += 19) { g.fillStyle = '#1c1538'; g.fillRect(ax - 14, y, 28, 3); } }
    // the scorer's table board (its lights are drawn live) and the floor
    g.fillStyle = MENU_INK; g.fillRect(0, Bd - 4, W, F - Bd + 4);
    g.fillStyle = '#0d0a1e'; g.fillRect(0, Bd + 2, W, F - Bd - 8);
    g.fillStyle = '#2a2056'; g.fillRect(0, Bd - 4, W, 2);
    const tones = ['#c98a4a', '#d29452', '#c07f43', '#cd8f4e', '#c68547'];
    let y = F, row = 0, hgt = 8;
    while (y < H) {
      const k = (y - F) / (H - F);
      g.fillStyle = mx(sd(tones[row % tones.length], -0.18), tones[row % tones.length], k); g.fillRect(0, y, W, hgt);
      g.fillStyle = sd(tones[row % tones.length], -0.32); g.fillRect(0, y + hgt - 2, W, 2);
      for (let x = (hash(row) * 300) | 0; x < W; x += 260 + ((hash(row * 7 + x) * 120) | 0)) g.fillRect(x, y, 3, hgt - 2);   // board ends
      y += hgt; row++; hgt = Math.round(8 + k * 16);
    }
    // painted court: team keys at the ends, the sideline, the centre line and circle
    const key = (x0, x1, col) => { g.fillStyle = col; g.globalAlpha = 0.45; g.beginPath(); g.moveTo(x0, F + 4); g.lineTo(x1, F + 4); g.lineTo(x1 + (x1 > x0 ? 60 : -60), H); g.lineTo(x0, H); g.closePath(); g.fill(); g.globalAlpha = 1; };
    key(0, 190, TEAM_DARK[0]); key(W, W - 190, TEAM_DARK[1]);
    g.fillStyle = '#f6ecd4'; g.fillRect(0, F + 4, W, 5); g.fillRect(W / 2 - 3, F + 4, 6, H - F);
    g.strokeStyle = '#f6ecd4'; g.lineWidth = 6;
    g.beginPath(); g.ellipse(W / 2, 640, 230, 78, 0, 0, Math.PI * 2); g.stroke();
    g.save(); g.beginPath(); g.ellipse(W / 2, 640, 120, 40, 0, 0, Math.PI * 2); g.clip();
    g.fillStyle = TEAM_COLORS[0]; g.globalAlpha = 0.55; g.fillRect(W / 2 - 130, 590, 130, 100); g.fillStyle = TEAM_COLORS[1]; g.fillRect(W / 2, 590, 130, 100); g.restore();
    g.beginPath(); g.ellipse(W / 2, 640, 120, 40, 0, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.ellipse(-40, F + 4, 330, 190, 0, 0, Math.PI / 2); g.stroke();
    g.beginPath(); g.ellipse(W + 40, F + 4, 330, 190, 0, Math.PI / 2, Math.PI); g.stroke();
    // the varnish: the board's glow mirrored in the floor, and a broad soft sheen
    for (const [x0, col] of [[0, TEAM_COLORS[0]], [W / 2, TEAM_COLORS[1]]]) {
      const lg = g.createLinearGradient(0, F + 6, 0, F + 90); lg.addColorStop(0, mx(col, '#000000', 0.2)); lg.addColorStop(1, 'rgba(0,0,0,0)');
      g.globalAlpha = 0.32; g.fillStyle = lg; g.fillRect(x0, F + 9, W / 2, 84); g.globalAlpha = 1;
    }
    const sh = g.createLinearGradient(0, F, 0, H); sh.addColorStop(0, 'rgba(255,240,215,0)'); sh.addColorStop(0.45, 'rgba(255,240,215,0.14)'); sh.addColorStop(0.7, 'rgba(255,240,215,0)'); sh.addColorStop(1, 'rgba(10,6,24,0.35)');
    g.fillStyle = sh; g.fillRect(0, F, W, H - F);
    // a vignette pulling the eye to the middle
    const vg = g.createRadialGradient(W / 2, H * 0.45, H * 0.35, W / 2, H * 0.45, H * 1.05); vg.addColorStop(0, 'rgba(6,3,14,0)'); vg.addColorStop(1, 'rgba(6,3,14,0.6)');
    g.fillStyle = vg; g.fillRect(0, 0, W, H);
  }
  function makeCrowd(W) {
    const list = [];
    for (let r = 0; r < 7; r++) {
      const y = 124 + (r + 1) * 38, k = r / 6;
      for (let x = 12 + (r % 2) * 14; x < W; x += 28) {
        if ([214, 640, 1066].some(a => Math.abs(x - a) < 22)) continue;
        const h = hash(r * 131 + x), team = (x < W / 2) === (h > 0.16) ? 0 : 1;
        const body = mx(TEAM_COLORS[team], '#0d0820', 0.72 - k * 0.22 - hash(x * 3 + r) * 0.1);
        list.push({ x, y, ph: h * 6.28, cheer: hash(x * 17 + r * 5) > 0.72, body, head: sd(body, -0.3), flash: hash(x + r * 999) });
      }
    }
    return list;
  }
  function makeHaze(W) {
    const c = document.createElement('canvas'); c.width = 400; c.height = 120; const g = c.getContext('2d');
    for (let i = 0; i < 9; i++) {
      const x = hash(i * 3) * 400, y = 30 + hash(i * 7) * 60, r = 50 + hash(i * 11) * 60;
      const rg = g.createRadialGradient(x, y, 0, x, y, r); rg.addColorStop(0, 'rgba(190,170,255,0.22)'); rg.addColorStop(1, 'rgba(190,170,255,0)');
      g.fillStyle = rg; g.fillRect(0, 0, 400, 120);
    }
    return c;
  }
  /**
   * The menu backdrop: a lit arena. Cached static layers (ceiling, stands, board, hardwood, court paint,
   * floor reflection) under a live crowd in both team colours, a scrolling LED board, sweeping
   * spotlights with pools on the floor, and drifting haze. Drawn at the court's pixel size.
   */
  function menuBackdrop(ctx, W, H, t) {
    const cv = ctx.canvas, tr = ctx.getTransform();
    if (!arenaCache || arenaCache.width !== cv.width || arenaCache.height !== cv.height || arenaCache.k !== tr.a) {
      arenaCache = document.createElement('canvas'); arenaCache.width = cv.width; arenaCache.height = cv.height; arenaCache.k = tr.a;
      const g = arenaCache.getContext('2d'); g.setTransform(tr); arenaStatic(g, W, H);
    }
    if (!crowdList) { crowdList = makeCrowd(W); hazeCache = makeHaze(W); }
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(arenaCache, 0, 0); ctx.restore();
    // the crowd: a gentle sway, some jumping with arms up, a wave rolling round, and camera flashes
    const wave = ((t * 300) % (W + 800)) - 400;
    for (const p of crowdList) {
      const wv = Math.max(0, 1 - Math.abs(p.x - wave) / 90);
      let dy = Math.round(Math.sin(t * 1.7 + p.ph) * 1.5);
      if (p.cheer) dy -= Math.round(Math.max(0, Math.sin(t * 4.2 + p.ph)) * 6);
      dy -= Math.round(wv * 12);
      ctx.fillStyle = p.body; ctx.fillRect(p.x - 10, p.y - 20 + dy, 20, 20 - Math.min(0, dy));
      ctx.fillStyle = p.head; ctx.fillRect(p.x - 6, p.y - 32 + dy, 12, 12);
      if (dy < -4) { ctx.fillStyle = p.body; ctx.fillRect(p.x - 14, p.y - 36 + dy, 4, 16); ctx.fillRect(p.x + 10, p.y - 36 + dy, 4, 16); }
      if (((t * 0.35 + p.flash * 17) % 1) < 0.012) { ctx.fillStyle = '#ffffff'; ctx.fillRect(p.x - 4, p.y - 28 + dy, 8, 8); }
    }
    // the LED board: chevrons running toward the middle in each team's colour, a ball at the centre
    const Bd = ARENA.board, F = ARENA.floor, by = Bd + 8, bh = F - Bd - 18;
    ctx.save(); ctx.beginPath(); ctx.rect(0, Bd + 2, W, F - Bd - 8); ctx.clip();
    const off = (t * 60) % 48;
    for (let x = -48; x < W + 48; x += 48) {
      const left = x < W / 2, cx = left ? x + off : x - off;
      if (Math.abs(cx - W / 2) < 70) continue;
      ctx.fillStyle = left ? TEAM_COLORS[0] : TEAM_COLORS[1];
      for (let j = 0; j < 4; j++) { const sx = left ? cx + j * 4 : cx + 16 - j * 4; ctx.fillRect(sx, by + j * 4, 8, 4); ctx.fillRect(sx, by + bh - 4 - j * 4, 8, 4); }
    }
    ctx.restore();
    pixelBall(ctx, W / 2, by + bh / 2, 14, t * 2, 0);
    // spotlights: warm beams sweeping from the truss, each with a pool where it meets the floor
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 4; i++) {
      const sx = 160 + i * 320, a = Math.sin(t * 0.45 + i * 1.9) * 0.5, fx = sx + Math.tan(a) * (F + 60 - 40), fy = F + 70;
      const col = i % 3 === 1 ? '255,210,140' : i === 2 ? '160,240,230' : '255,236,200';
      const lg = ctx.createLinearGradient(sx, 40, fx, fy); lg.addColorStop(0, `rgba(${col},0.22)`); lg.addColorStop(1, `rgba(${col},0.05)`);
      ctx.fillStyle = lg; ctx.beginPath(); ctx.moveTo(sx - 10, 40); ctx.lineTo(sx + 10, 40); ctx.lineTo(fx + 95, fy); ctx.lineTo(fx - 95, fy); ctx.closePath(); ctx.fill();
      ctx.fillStyle = `rgba(${col},0.08)`; ctx.beginPath(); ctx.moveTo(sx - 4, 40); ctx.lineTo(sx + 4, 40); ctx.lineTo(fx + 40, fy); ctx.lineTo(fx - 40, fy); ctx.closePath(); ctx.fill();
      ctx.fillStyle = `rgba(${col},0.12)`; ctx.beginPath(); ctx.ellipse(fx, fy, 120, 26, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = `rgba(${col},0.1)`; ctx.beginPath(); ctx.ellipse(fx, fy, 64, 13, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    // haze drifting across the stands
    ctx.save(); ctx.globalAlpha = 0.7;
    const hx = (t * 14) % W;
    ctx.drawImage(hazeCache, hx - W, 250, W, 240); ctx.drawImage(hazeCache, hx, 250, W, 240);
    ctx.globalAlpha = 0.45; ctx.drawImage(hazeCache, -((t * 9) % W), 90, W, 200); ctx.drawImage(hazeCache, W - ((t * 9) % W), 90, W, 200);
    ctx.restore();
    // a few glints on the varnish
    for (let i = 0; i < 6; i++) if (Math.sin(t * 2.3 + i * 2.1) > 0.92) { ctx.fillStyle = 'rgba(255,250,235,0.8)'; const gx = 100 + hash(i * 5) * (W - 200), gy = F + 30 + hash(i * 9) * 200; ctx.fillRect(gx - 6, gy - 1, 12, 3); ctx.fillRect(gx - 1, gy - 5, 3, 11); }
  }


  return { RAINBOW, CONTESTED, FADE_BLUE, ICE, VENUES, menuBackdrop, setFont, pose, world, player, ball, hoopBack, hoopFront, aiIcon, scoreboard, roundCard, button, panel, levelBar, levelColor, menuLogo, pixelBall, icon, keycap, crown, text, ink, rr,
    TEAM_NAMES, TEAM_COLORS, TEAM_DARK, INK, VENUES };
})();
