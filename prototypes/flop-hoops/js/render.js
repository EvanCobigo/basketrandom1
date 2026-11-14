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
    ctx.font = `${o.weight || 800} ${size}px ${FONT}`;
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
      }
    }
  }

  function venue(ctx, w, W, H) {
    const v = VENUES[w.S.venue], f = F();
    ctx.fillStyle = v.sky; ctx.fillRect(0, 0, W, f);
    ctx.fillStyle = v.band; ctx.fillRect(0, f - 150, W, 150);
    crowd(ctx, w, W, f, v);
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
    const b1 = top1 + inset + sway, b2 = top2 - inset + sway, depth = 54 + h.sway * 6;
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
    const dy = Math.sin(t * 40) * 2 * h.wobble;
    ctx.beginPath(); ctx.ellipse(h.cx, h.rimY + dy, (h.x2 - h.x1) / 2, 6, 0, 0, Math.PI);
    ctx.lineWidth = 9; ctx.strokeStyle = INK; ctx.stroke(); ctx.lineWidth = 5; ctx.strokeStyle = '#ef4b35'; ctx.stroke();
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
    ctx.beginPath(); ctx.rect(-d.armW * 0.6, d.armL / 2 - d.armW * 0.5, d.armW * 1.2, d.armW * 1.1); ink(ctx, look.skin, 4); // a small hand
    ctx.restore();
  }

  // ---- Ball -----------------------------------------------------------------------------
  /** The squircle ball with its seams. */
  function ball(ctx, x, y, r, a, withShadow = true) {
    if (withShadow) shadow(ctx, x, y, r);
    ctx.save(); ctx.translate(x, y); ctx.rotate(a);
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
  const FADE_BLUE = '#5aa8ff'; // the trail of a fadeaway that is going in
  const ICE = ['#ffd2a0', '#ff8a3a', '#ff4a2a']; // the spark machines' sparks: warm reds and oranges
  /** The fired ball's trail: blocks that shrink toward the tail; white, rainbow on a perfect line, green when contested. */
  function trail(ctx, tr, r, t) {
    const n = tr.pts.length;
    for (let i = 0; i < n; i++) {
      const q = tr.pts[i], k = (i + 1) / n, sz = Math.max(6, r * CONFIG.trail_width.value * k);
      ctx.fillStyle = tr.mode === 'rainbow' ? RAINBOW[(i + Math.floor(t * 20)) % RAINBOW.length] : tr.mode === 'green' ? CONTESTED : tr.mode === 'blue' ? FADE_BLUE : '#ffffff';
      ctx.globalAlpha = 0.35 + 0.6 * k;
      ctx.fillRect(q.x - sz / 2, q.y - sz / 2, sz, sz);
    }
    ctx.globalAlpha = 1;
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
    const B = pose(w.ball, al), r = w.ball.r;
    for (const p of w.players) {
      if (w.hustle[p.team]) { // a trailing team's hustle: a flickering block glow at the feet
        const T = pose(p.torso, al), on = Math.floor(t * 8) % 2;
        ctx.fillStyle = on ? '#ffd23f' : '#ff9a3c'; ctx.fillRect(T.x - 18, F() - 6, 36, 6);
      }
      player(ctx, p, al, w.S.kits[p.team]);
    }
    if (w.trail) trail(ctx, w.trail, r, t);
    ball(ctx, B.x, B.y, r, B.a);
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
      if (team === 1 && st.cpu) text(ctx, 'CPU', bx - s * 28, y + 62, 18, '#ffffff', { stroke: 4 });   // the computer plays this side
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
    ctx.beginPath(); ctx.arc(0, 0, 175, 0, Math.PI * 2); ink(ctx, '#fff3d6', 7);
    ctx.setLineDash([10, 9]); ctx.beginPath(); ctx.arc(0, 0, 155, 0, Math.PI * 2); ctx.lineWidth = 3; ctx.strokeStyle = '#e8591a'; ctx.stroke(); ctx.setLineDash([]);
    text(ctx, 'ROUND', 0, -60, 30, '#e8591a', { weight: 900 });
    text(ctx, String(S.round), 0, 10, 96, INK, { weight: 900 });
    text(ctx, S.venueName, 0, 104, 16, '#8a83a8', { weight: 700 });
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



  return { RAINBOW, CONTESTED, FADE_BLUE, ICE, VENUES, menuBackdrop, setFont, pose, world, player, ball, hoopBack, hoopFront, scoreboard, roundCard, button, keycap, crown, text, ink, rr,
    TEAM_NAMES, TEAM_COLORS, TEAM_DARK, INK, VENUES };
})();
