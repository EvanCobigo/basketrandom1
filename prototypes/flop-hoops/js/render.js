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
    if (o.stroke) { ctx.lineJoin = 'round'; ctx.lineWidth = o.stroke; ctx.strokeStyle = o.strokeColor || INK; ctx.strokeText(s, x, y); }
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

  /** The whole court: venue, hoops, players, ball, nets. */
  function world(ctx, w, al, t, W, H) {
    venue(ctx, w, W, H);
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
    if (w.dunk && w.dunk.ghosts) {   // a dunk in the air: the ball's afterimages and a swoosh through them, in the dunker's colour
      const G = w.dunk.ghosts, col = TEAM_COLORS[w.dunk.p.team];
      ctx.lineCap = 'round'; ctx.strokeStyle = col; ctx.globalAlpha = 0.8; ctx.lineWidth = r * 1.3;
      ctx.beginPath(); G.forEach((g, i) => i ? ctx.lineTo(g.x, g.y) : ctx.moveTo(g.x, g.y)); ctx.lineTo(B.x, B.y); ctx.stroke();
      ctx.strokeStyle = '#ffffff'; ctx.globalAlpha = 0.9; ctx.lineWidth = r * 0.45; ctx.stroke(); ctx.lineCap = 'butt';
      G.forEach((g, i) => { ctx.globalAlpha = 0.25 + 0.45 * i / G.length; ball(ctx, g.x, g.y, r * (0.8 + 0.2 * i / G.length), B.a, false); });
      ctx.globalAlpha = 1;
    }
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
    const cx = W / 2, y = 12, w = 600, h = 96;
    rr(ctx, cx - w / 2, y, w, h, 20); ink(ctx, '#262238', 5);
    for (const team of [0, 1]) {
      const s = team ? 1 : -1, bx = cx + s * 190;
      rr(ctx, bx - 100, y + 10, 200, h - 20, 14); ink(ctx, TEAM_COLORS[team], 4);
      text(ctx, TEAM_NAMES[team].toUpperCase(), bx - s * 28, y + 30, 17, '#ffffff', { stroke: 4 });
      if ((team === 1 && st.cpu) || (team === 0 && st.cpu0)) { const sty = team ? st.cpuStyle : st.cpuStyle0; text(ctx, 'CPU', bx - s * 28, y + (sty ? 58 : 62), 18, '#ffffff', { stroke: 4 }); if (sty) text(ctx, sty, bx - s * 28, y + 76, 12, '#ffffff', { stroke: 3 }); }   // the computer plays this side
      else { keycap(ctx, bx - s * 28 - 18, y + 62, team ? 'up' : 'W', 0.55); keycap(ctx, bx - s * 28 + 14, y + 62, team ? 'down' : 'S', 0.55); }
      const pop = st.pops[team];
      ctx.save(); ctx.translate(bx + s * 52, y + h / 2); ctx.scale(1 + pop * 0.6, 1 + pop * 0.6);
      text(ctx, String(st.score[team]), 0, 2, 52, '#ffffff', { weight: 900, stroke: 7 });
      ctx.restore();
      if (st.leader === team) crown(ctx, bx + s * 52, y - 4, 0.9);
    }
    text(ctx, `FIRST TO ${st.target}`, cx, y + 30, 15, '#ffd23f');
    text(ctx, `ROUND ${st.round}`, cx, y + 54, 20, '#ffffff');
    text(ctx, st.leader < 0 ? 'LEVEL' : `${TEAM_NAMES[st.leader].toUpperCase()} LEAD`, cx, y + 77, 13,
      st.leader < 0 ? '#c9c3e0' : TEAM_COLORS[st.leader]);
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
    ctx.fillStyle = INK; ctx.fillRect(x0 + 10, y0 + 10, pw, ph);                                  // drop shadow
    rr(ctx, x0, y0, pw, ph); ink(ctx, '#262238', 7);
    ctx.fillStyle = TEAM_COLORS[0]; ctx.fillRect(x0 + 4, y0 + 4, pw / 2 - 4, 22);
    ctx.fillStyle = TEAM_COLORS[1]; ctx.fillRect(0, y0 + 4, pw / 2 - 4, 22);
    ctx.fillStyle = INK; ctx.fillRect(x0 + 4, y0 + 26, pw - 8, 5);
    rr(ctx, x0 + 18, y0 + 46, pw - 36, ph - 64); ink(ctx, '#1d1a2b', 4);                         // inner bezel
    ctx.fillStyle = '#ffd23f';
    for (const [sx2, sy2] of [[x0 + 10, y0 + ph - 18], [x0 + pw - 18, y0 + ph - 18]]) ctx.fillRect(sx2, sy2, 8, 8);   // corner studs
    text(ctx, 'ROUND', 0, y0 + 76, 28, '#ffd23f', { weight: 900, stroke: 5 });
    text(ctx, String(S.round), 0, y0 + 142, 92, '#ffffff', { weight: 900, stroke: 10 });
    text(ctx, S.venueName.toUpperCase(), 0, y0 + 206, 15, '#c9c3e0', { weight: 700, stroke: 3 });
    ctx.restore();
  }

  /**
   * A retro menu button in the pixel font: a square block with a hard drop shadow. b.t drives an
   * idle bob, b.hot lifts it with a blinking pointer, b.pressT squashes it for a moment.
   */
  function button(ctx, b, accent) {
    const t = b.t || 0, hot = !!b.hot, press = Math.max(0, b.pressT || 0) / 0.14;
    const bob = Math.round(Math.sin(t * 3 + (b.i || 0) * 1.3) * 2), lift = hot ? -4 : 0, squash = press > 0 ? 4 : 0;
    const x = b.x, y = b.y + bob + lift + squash, w = b.w, h = b.h - squash;
    ctx.fillStyle = '#0a0618'; ctx.fillRect(x + 7, b.y + bob + 7, w, b.h);        // hard drop shadow
    ctx.fillStyle = INK; ctx.fillRect(x - 4, y - 4, w + 8, h + 8);                   // pixel border
    ctx.fillStyle = hot ? '#fff1a8' : (accent || '#ffd23f'); ctx.fillRect(x, y, w, h);
    ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.fillRect(x, y, w, 5);               // top light
    ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(x, y + h - 6, w, 6);             // bottom shade
    const sc = b.scale || 4;
    PixelFont.draw(ctx, b.label, x + w / 2, y + h / 2, { scale: sc, color: INK, shadow: Math.max(1, sc / 2), shadowColor: 'rgba(0,0,0,0.25)' });
    if (hot) { // the gleam: a bright glint circling the button's border, and a sheen sweeping over its face
      const per = 2 * (w + h + 8), sp = (t * 220) % per, seg = 22;
      const at = d => { d = ((d % per) + per) % per; const W2 = w + 8, H2 = h + 8;
        if (d < W2) return [x - 4 + d, y - 4]; d -= W2; if (d < H2) return [x + w + 4, y - 4 + d]; d -= H2; if (d < W2) return [x + w + 4 - d, y + h + 4]; d -= W2; return [x - 4, y + h + 4 - d]; };
      for (let k = 0; k < seg; k += 2) { const [gx, gy] = at(sp - k); ctx.globalAlpha = 1 - k / seg; ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.round(gx) - 3, Math.round(gy) - 3, 6, 6); }
      ctx.globalAlpha = 1;
      const sweep = ((t * 0.9) % 1.6) / 1.6;   // every 1.6 s a slanted white band slides left to right across the face
      if (sweep < 1) { ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip(); ctx.fillStyle = 'rgba(255,255,255,0.45)';
        const bx = x - 30 + sweep * (w + 60); ctx.beginPath(); ctx.moveTo(bx, y); ctx.lineTo(bx + 14, y); ctx.lineTo(bx - 6, y + h); ctx.lineTo(bx - 20, y + h); ctx.closePath(); ctx.fill(); ctx.restore(); }
    }
    if (hot && Math.floor(t * 4) % 2) { // the blinking pointer
      const px = x - 26, py = y + h / 2, s = 4;
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 4; i++) ctx.fillRect(px + i * s, py - (3 - i) * s, s, (3 - i) * 2 * s);
    }
    if (b.hint) PixelFont.draw(ctx, b.hint, x + w / 2, b.y + b.h + 22, { scale: 2, color: '#e6ddff' });
  }

  /** The menu backdrop: banded dusk sky with stars, a striped setting sun, a scrolling neon grid
   *  floor, and a little pixel basketball bouncing along it. Drawn small and scaled up. */
  function menuBackdrop(ctx, W, H, t) {
    const horizon = 440, bands = ['#140c2e', '#1d1240', '#2a1650', '#3d1a5c', '#5a1f66', '#7a2a6a', '#a3366a', '#d0506a', '#f27a5e'];
    const bh = horizon / bands.length;
    bands.forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(0, Math.floor(i * bh), W, Math.ceil(bh) + 1); });
    for (let i = 0; i < 70; i++) { // stars: fixed spots, twinkling
      const sx = (i * 197) % W, sy = (i * 113) % 260;
      if (Math.sin(t * 2 + i * 1.7) > -0.3) { ctx.fillStyle = i % 5 ? '#e6ddff' : '#ffd23f'; ctx.fillRect(sx, sy, 5, 5); }
    }
    // the sun: stripes cut through its lower half
    const sx = W / 2, sy = horizon - 40, sr = 150, cols = ['#ffe23b', '#ffc23b', '#ff9a1f', '#ff7a2a', '#ff5a3a'];
    for (let y = -sr; y < sr; y += 5) {
      const half = Math.sqrt(Math.max(0, sr * sr - y * y)), band = Math.floor((y + sr) / (2 * sr) * cols.length);
      const gap = y > 0 && Math.floor(y / 5) % Math.max(2, 6 - Math.floor(y / 30)) === 0;
      if (!gap && sy + y < horizon) { ctx.fillStyle = cols[Math.min(cols.length - 1, band)]; ctx.fillRect(sx - half, sy + y, half * 2, 5); }
    }
    // the floor and its grid, rushing toward you
    ctx.fillStyle = '#120a26'; ctx.fillRect(0, horizon, W, H - horizon);
    ctx.fillStyle = '#ff5a8a'; ctx.fillRect(0, horizon, W, 4);
    ctx.fillStyle = '#1fc2b1';
    for (let i = 0; i < 12; i++) {
      const k = ((i + (t * 0.8) % 1) / 12), y = horizon + Math.pow(k, 2.2) * (H - horizon);
      ctx.fillRect(0, Math.round(y), W, 3);
    }
    ctx.strokeStyle = '#1fc2b1'; ctx.lineWidth = 3;
    for (let i = -10; i <= 10; i++) { ctx.beginPath(); ctx.moveTo(W / 2 + i * 40, horizon); ctx.lineTo(W / 2 + i * 260, H); ctx.stroke(); }
    // a pixel basketball bouncing across the grid
    const bx = ((t * 160) % (W + 200)) - 100, by = H - 70 - Math.abs(Math.sin(t * 3.2)) * 120;
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(bx - 20, H - 52, 40, 8);
    ball(ctx, bx, by, 22, t * 4, false);
  }



  return { RAINBOW, CONTESTED, FADE_BLUE, ICE, VENUES, menuBackdrop, setFont, pose, world, player, ball, hoopBack, hoopFront, aiIcon, scoreboard, roundCard, button, keycap, crown, text, ink, rr,
    TEAM_NAMES, TEAM_COLORS, TEAM_DARK, INK, VENUES };
})();
