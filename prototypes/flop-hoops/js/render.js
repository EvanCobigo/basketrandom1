// PROTOTYPE - NOT FOR PRODUCTION
// Question: Does one key plus floppy physics give a match that is chaotic, funny and still winnable on skill?
// Date: 2026-11-14
'use strict';
/**
 * Render: draws a round's world, the HUD and the overlays on a 2D canvas, in flat cut-out vector
 * with thick ink outlines. It reads physics bodies and game state; it never changes either.
 */
const Render = (() => {
  const INK = '#1d1a2b', LW = 4.5;
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
    ctx.lineWidth = lw; ctx.strokeStyle = INK; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke();
  }
  function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }
  function text(ctx, s, x, y, size, fill, o = {}) {
    ctx.font = `${o.weight || 800} ${size}px ${FONT}`;
    ctx.textAlign = o.align || 'center'; ctx.textBaseline = 'middle';
    if (o.stroke) { ctx.lineJoin = 'round'; ctx.lineWidth = o.stroke; ctx.strokeStyle = o.strokeColor || INK; ctx.strokeText(s, x, y); }
    ctx.fillStyle = fill; ctx.fillText(s, x, y);
  }

  // ---- Venues: background darker and calmer than play --------------------------------------
  const VENUES = {
    gym: { top: '#4b2734', bottom: '#6e3a48', floor: '#c58b51', edge: '#8e5a2f', line: '#f3e3c3', key: 'rgba(120,40,60,0.35)', side: '#3a2230', accent: '#ffd36b' },
    rooftop: { top: '#2f2a5a', bottom: '#d77a6b', floor: '#7f7889', edge: '#57506a', line: '#f1efe6', key: 'rgba(60,40,110,0.3)', side: '#2a2442', accent: '#ffb38a' },
    beach: { top: '#7ccbe0', bottom: '#cfeee8', floor: '#e3c78c', edge: '#b9975a', line: '#fffaf0', key: 'rgba(30,120,150,0.22)', side: '#3d8d9a', accent: '#ffe27a' },
    street: { top: '#111a33', bottom: '#2a3563', floor: '#3a3e4c', edge: '#262935', line: '#f5d34f', key: 'rgba(245,211,79,0.12)', side: '#171c2e', accent: '#9fd8ff' },
  };

  function venue(ctx, w, W, H, t) {
    const S = w.S, v = VENUES[S.venue], d = S.deco, f = F();
    const g = ctx.createLinearGradient(0, 0, 0, f);
    g.addColorStop(0, v.top); g.addColorStop(1, v.bottom);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, f);
    DECOR[S.venue](ctx, w, v, d, W, t);

    ctx.fillStyle = v.floor; ctx.fillRect(0, f, W, H - f);
    FLOOR[S.venue](ctx, w, v, d, W, H);
    ctx.fillStyle = v.edge; ctx.fillRect(0, f, W, 7);
    // court paint: keys under the hoops and the centre circle, flattened for the side view
    ctx.fillStyle = v.key;
    ctx.fillRect(w.L, f + 7, 200, H - f); ctx.fillRect(w.R - 200, f + 7, 200, H - f);
    ctx.strokeStyle = v.line; ctx.lineWidth = 4; ctx.globalAlpha = 0.8;
    ctx.beginPath(); ctx.moveTo(w.cx, f + 8); ctx.lineTo(w.cx, H); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(w.cx, f + 42, 96, 22, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(w.L + 200, f + 8); ctx.lineTo(w.L + 200, H); ctx.moveTo(w.R - 200, f + 8); ctx.lineTo(w.R - 200, H); ctx.stroke();
    ctx.globalAlpha = 1;
    // padded side walls beyond the court
    for (const [x0, x1] of [[0, w.L], [w.R, W]]) {
      if (x1 - x0 < 1) continue;
      ctx.fillStyle = v.side; ctx.fillRect(x0, 0, x1 - x0, H);
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      for (let y = 30; y < H; y += 90) ctx.fillRect(x0, y, x1 - x0, 40);
    }
    ctx.fillStyle = INK; ctx.fillRect(w.L - 3, 0, 4, H); ctx.fillRect(w.R - 1, 0, 4, H);
  }

  const DECOR = {
    gym(ctx, w, v, d) {
      // high windows
      ctx.fillStyle = 'rgba(255,230,190,0.13)';
      for (let i = 0; i < 6; i++) { rr(ctx, 150 + i * 180, 150, 110, 70, 10); ctx.fill(); }
      // pennant string
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(w.L, 262); ctx.quadraticCurveTo(w.cx, 312, w.R, 262); ctx.stroke();
      const cols = ['#c9584e', '#d9a441', '#4f8d84', '#7a6cb8'];
      for (let i = 0; i < 18; i++) {
        const x = lerp(w.L + 20, w.R - 20, i / 17), sag = 50 * (1 - Math.pow((x - w.cx) / (w.R - w.cx), 2));
        const y = 262 + sag;
        ctx.beginPath(); ctx.moveTo(x - 14, y); ctx.lineTo(x + 14, y); ctx.lineTo(x, y + 30); ctx.closePath();
        ctx.fillStyle = cols[i % 4]; ctx.globalAlpha = 0.55; ctx.fill(); ctx.globalAlpha = 1;
      }
      // bleachers with a bumpy crowd silhouette
      for (let r = 0; r < 4; r++) {
        const y = 440 + r * 50;
        ctx.fillStyle = r % 2 ? '#5a2f3c' : '#643543'; ctx.fillRect(0, y, 1280, 50);
        ctx.fillStyle = r % 2 ? '#4a2632' : '#532b38';
        ctx.beginPath(); ctx.moveTo(0, y);
        for (let x = 0; x <= 1280; x += 26) {
          const hgt = 14 + d[(x / 26 + r * 5) % 24 | 0] * 12;
          ctx.quadraticCurveTo(x + 13, y - hgt, x + 26, y);
        }
        ctx.fill();
      }
    },
    rooftop(ctx, w, v, d) {
      ctx.fillStyle = 'rgba(255,214,150,0.85)';
      ctx.beginPath(); ctx.arc(300 + d[0] * 680, 470, 70, Math.PI, 0); ctx.fill();
      let x = 0, i = 0;
      while (x < 1280) {
        const bw = 60 + d[i % 24] * 90, bh = 120 + d[(i + 7) % 24] * 220;
        ctx.fillStyle = i % 2 ? '#2b2346' : '#352b55';
        ctx.fillRect(x, 600 - bh, bw - 6, bh);
        ctx.fillStyle = 'rgba(255,214,120,0.35)';
        for (let wy = 600 - bh + 16; wy < 580; wy += 26) for (let wx = x + 10; wx < x + bw - 20; wx += 20) {
          if (d[(wx + wy) % 24 | 0] > 0.45) ctx.fillRect(wx, wy, 8, 12);
        }
        if (i === 3) { // a water tower
          ctx.fillStyle = '#251e3c'; ctx.fillRect(x + 10, 600 - bh - 60, bw - 26, 40);
          ctx.fillRect(x + 16, 600 - bh - 20, 4, 20); ctx.fillRect(x + bw - 26, 600 - bh - 20, 4, 20);
          ctx.beginPath(); ctx.moveTo(x + 6, 600 - bh - 60); ctx.lineTo(x + bw / 2 - 8, 600 - bh - 80); ctx.lineTo(x + bw - 12, 600 - bh - 60); ctx.fill();
        }
        x += bw; i++;
      }
      // railing
      ctx.strokeStyle = '#4a4262'; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(0, 590); ctx.lineTo(1280, 590); ctx.stroke();
      ctx.lineWidth = 3; for (let rx = 10; rx < 1280; rx += 40) { ctx.beginPath(); ctx.moveTo(rx, 590); ctx.lineTo(rx, 640); ctx.stroke(); }
    },
    beach(ctx, w, v, d, W, t) {
      ctx.fillStyle = 'rgba(255,240,170,0.5)'; ctx.beginPath(); ctx.arc(980, 200, 90, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffe9a0'; ctx.beginPath(); ctx.arc(980, 200, 56, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#5fae9b'; // far islands
      ctx.beginPath(); ctx.ellipse(250, 440, 160, 30, 0, Math.PI, 0); ctx.fill();
      ctx.beginPath(); ctx.ellipse(1100, 440, 120, 22, 0, Math.PI, 0); ctx.fill();
      ctx.fillStyle = '#3a9fb3'; ctx.fillRect(0, 440, 1280, 200);
      ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 3;
      for (let r = 0; r < 5; r++) {
        const y = 470 + r * 34;
        ctx.beginPath();
        for (let x = 0; x <= 1280; x += 40) {
          const yy = y + Math.sin(x / 60 + r + t * 0.8) * 4;
          x ? ctx.lineTo(x, yy) : ctx.moveTo(x, yy);
        }
        ctx.stroke();
      }
      palm(ctx, w.L + 120 + d[2] * 60, 1); palm(ctx, w.R - 120 - d[3] * 60, -1);
    },
    street(ctx, w, v, d) {
      let x = -20, i = 0;
      while (x < 1300) {
        const bw = 120 + d[i % 24] * 120, bh = 260 + d[(i + 4) % 24] * 200;
        ctx.fillStyle = i % 2 ? '#18203d' : '#1d2648'; ctx.fillRect(x, 640 - bh, bw - 4, bh);
        ctx.fillStyle = 'rgba(159,216,255,0.18)';
        for (let wy = 640 - bh + 20; wy < 360; wy += 34) for (let wx = x + 14; wx < x + bw - 30; wx += 30) {
          if (d[(wx * 3 + wy) % 24 | 0] > 0.5) ctx.fillRect(wx, wy, 14, 18);
        }
        x += bw; i++;
      }
      // chain-link fence
      ctx.strokeStyle = 'rgba(190,200,230,0.22)'; ctx.lineWidth = 2;
      ctx.beginPath();
      for (let fx = -400; fx < 1700; fx += 26) { ctx.moveTo(fx, 360); ctx.lineTo(fx + 280, 640); ctx.moveTo(fx + 280, 360); ctx.lineTo(fx, 640); }
      ctx.stroke();
      ctx.strokeStyle = 'rgba(190,200,230,0.4)'; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(0, 360); ctx.lineTo(1280, 360); ctx.stroke();
      for (let px = 40; px < 1280; px += 240) { ctx.beginPath(); ctx.moveTo(px, 360); ctx.lineTo(px, 640); ctx.stroke(); }
      // street lamp and its glow
      const lx = w.cx + (d[5] > 0.5 ? 1 : -1) * 260;
      const glow = ctx.createRadialGradient(lx, 170, 10, lx, 170, 260);
      glow.addColorStop(0, 'rgba(255,220,140,0.35)'); glow.addColorStop(1, 'rgba(255,220,140,0)');
      ctx.fillStyle = glow; ctx.fillRect(lx - 260, 0, 520, 640);
      ctx.fillStyle = '#0d1226'; ctx.fillRect(lx - 4, 170, 8, 470);
      rr(ctx, lx - 26, 156, 52, 16, 6); ctx.fill();
      ctx.fillStyle = '#ffe6a6'; rr(ctx, lx - 18, 170, 36, 6, 3); ctx.fill();
    },
  };

  const FLOOR = {
    gym(ctx, w, v, d, W, H) {
      ctx.strokeStyle = 'rgba(110,60,25,0.35)'; ctx.lineWidth = 2;
      for (let y = F() + 20; y < H; y += 20) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
        for (let x = ((y / 20) % 2) * 60; x < W; x += 120) { ctx.beginPath(); ctx.moveTo(x, y - 20); ctx.lineTo(x, y); ctx.stroke(); }
      }
    },
    rooftop(ctx, w, v, d, W, H) {
      ctx.strokeStyle = 'rgba(40,30,60,0.3)'; ctx.lineWidth = 2;
      for (let x = 0; x < W; x += 160) { ctx.beginPath(); ctx.moveTo(x, F()); ctx.lineTo(x - 40, H); ctx.stroke(); }
    },
    beach(ctx, w, v, d, W, H) {
      ctx.fillStyle = 'rgba(160,120,60,0.35)';
      for (let i = 0; i < 60; i++) ctx.fillRect((i * 97 + d[i % 24] * 80) % W, F() + 12 + (i * 37) % (H - F() - 16), 4, 3);
    },
    street(ctx, w, v, d, W, H) {
      ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(200, F() + 30); ctx.lineTo(260, F() + 50); ctx.lineTo(250, F() + 75);
      ctx.moveTo(900, F() + 20); ctx.lineTo(950, F() + 44); ctx.lineTo(1010, F() + 50); ctx.stroke();
    },
  };

  function palm(ctx, x, s) {
    const f = F();
    ctx.beginPath(); ctx.moveTo(x - 8, f); ctx.quadraticCurveTo(x + s * 10, f - 140, x + s * 50, f - 260);
    ctx.lineTo(x + s * 62, f - 256); ctx.quadraticCurveTo(x + s * 24, f - 140, x + 10, f); ctx.closePath();
    ctx.fillStyle = 'rgba(120,80,50,0.75)'; ctx.fill();
    ctx.fillStyle = 'rgba(40,120,80,0.8)';
    for (let i = 0; i < 6; i++) {
      const a = -Math.PI / 2 + (i - 2.5) * 0.55;
      ctx.save(); ctx.translate(x + s * 56, f - 262); ctx.rotate(a);
      ctx.beginPath(); ctx.ellipse(48, 0, 52, 11, 0.25, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
  }

  // ---- Hoops ----------------------------------------------------------------------------
  /** Pole, backboard face and the back half of the rim: drawn behind the players. */
  function hoopBack(ctx, h) {
    const f = F(), outward = h.side, poleX = h.boardX + outward * 26;
    ctx.beginPath(); ctx.rect(poleX - 8, h.rimY - 40, 16, f - h.rimY + 40); ink(ctx, '#8d93a8');
    rr(ctx, poleX - 15, f - 70, 30, 70, 6); ink(ctx, '#3d4a7a');
    ctx.beginPath(); ctx.rect(Math.min(poleX, h.boardX), h.rimY - 50, Math.abs(poleX - h.boardX), 12); ink(ctx, '#8d93a8');
    // backboard face, seen at a slight angle
    const fx = h.boardX, fw = outward * 30;
    ctx.beginPath();
    ctx.moveTo(fx, h.rimY - 142); ctx.lineTo(fx + fw, h.rimY - 150); ctx.lineTo(fx + fw, h.rimY + 10); ctx.lineTo(fx, h.rimY + 18); ctx.closePath();
    ink(ctx, '#f4f6fb');
    ctx.beginPath();
    ctx.moveTo(fx + fw * 0.2, h.rimY - 60); ctx.lineTo(fx + fw * 0.8, h.rimY - 62); ctx.lineTo(fx + fw * 0.8, h.rimY - 8); ctx.lineTo(fx + fw * 0.2, h.rimY - 6); ctx.closePath();
    ctx.lineWidth = 4; ctx.strokeStyle = '#e04a3a'; ctx.stroke();
    rr(ctx, h.boardX - 7, h.rimY - 142, 14, 160, 4); ink(ctx, '#ffffff');
    // back half of the rim
    const cx = (h.x1 + h.x2) / 2, rx = (h.x2 - h.x1) / 2;
    ctx.beginPath(); ctx.ellipse(cx, h.rimY, rx, 8, 0, Math.PI, 0);
    ctx.lineWidth = 9; ctx.strokeStyle = INK; ctx.stroke(); ctx.lineWidth = 4; ctx.strokeStyle = '#c23c2c'; ctx.stroke();
  }

  /** Net and the front half of the rim: drawn over the ball, so a basket goes in. */
  function hoopFront(ctx, h, t) {
    const sway = Math.sin(t * 18) * 6 * h.sway + Math.sin(t * 30) * 3 * h.wobble;
    const top1 = h.x1 + 5, top2 = h.x2 - 5, inset = (top2 - top1) * 0.18;
    const b1 = top1 + inset + sway, b2 = top2 - inset + sway, depth = 62 + h.sway * 8;
    ctx.strokeStyle = 'rgba(255,255,255,0.92)'; ctx.lineWidth = 2.5;
    ctx.beginPath();
    const n = 5;
    for (let i = 0; i <= n; i++) {
      const tx = lerp(top1, top2, i / n), bx = lerp(b1, b2, i / n);
      ctx.moveTo(tx, h.rimY); ctx.lineTo(bx, h.rimY + depth);
      if (i < n) { ctx.moveTo(tx, h.rimY); ctx.lineTo(lerp(b1, b2, (i + 1) / n), h.rimY + depth); }
      if (i > 0) { ctx.moveTo(tx, h.rimY); ctx.lineTo(lerp(b1, b2, (i - 1) / n), h.rimY + depth); }
    }
    ctx.moveTo(lerp(top1, b1, 0.5), h.rimY + depth / 2); ctx.lineTo(lerp(top2, b2, 0.5), h.rimY + depth / 2);
    ctx.moveTo(b1, h.rimY + depth); ctx.lineTo(b2, h.rimY + depth);
    ctx.stroke();
    const cx = (h.x1 + h.x2) / 2, rx = (h.x2 - h.x1) / 2, dy = Math.sin(t * 40) * 2 * h.wobble;
    ctx.beginPath(); ctx.ellipse(cx, h.rimY + dy, rx, 8, 0, 0, Math.PI);
    ctx.lineWidth = 10; ctx.strokeStyle = INK; ctx.stroke(); ctx.lineWidth = 5; ctx.strokeStyle = '#ef4b35'; ctx.stroke();
  }

  // ---- Players --------------------------------------------------------------------------
  function shadow(ctx, x, y, r) {
    const f = F(), k = Math.max(0.25, 1 - (f - y) / 500);
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath(); ctx.ellipse(x, f + 6, r * k, 7 * k, 0, 0, Math.PI * 2); ctx.fill();
  }

  /** Draw one ragdoll. `kit` is the team's colours, `look` the player's own; eyes track `target`. */
  function player(ctx, p, al, kit, target) {
    const d = p.dims, look = p.look, dir = p.dir;
    const T = pose(p.torso, al), Hd = pose(p.head, al), A = pose(p.arm, al);
    shadow(ctx, T.x, T.y + d.torsoH, 30);

    for (const leg of p.legs) {
      const P = pose(leg, al);
      ctx.save(); ctx.translate(P.x, P.y); ctx.rotate(P.a);
      rr(ctx, -d.legW / 2, -d.legL / 2, d.legW, d.legL, d.legW / 2); ink(ctx, look.skin);
      rr(ctx, -d.legW / 2, d.legL / 2 - 17, d.legW, 9, 3); ink(ctx, '#ffffff', 3);
      ctx.beginPath(); // shoe, toe pointing the way the team attacks
      ctx.moveTo(-d.legW / 2 - dir * 2, d.legL / 2 - 8);
      ctx.quadraticCurveTo(dir * (d.legW + 6), d.legL / 2 - 10, dir * (d.legW + 4), d.legL / 2 + 3);
      ctx.lineTo(-dir * (d.legW / 2 + 2), d.legL / 2 + 4); ctx.closePath();
      ink(ctx, look.shoe, 3.5);
      ctx.restore();
    }

    // torso: jersey over shorts, a side stripe and the number
    ctx.save(); ctx.translate(T.x, T.y); ctx.rotate(T.a);
    rr(ctx, -d.torsoW / 2, -d.torsoH / 2, d.torsoW, d.torsoH, 16);
    ctx.save(); ctx.clip();
    ctx.fillStyle = kit.jersey; ctx.fillRect(-d.torsoW / 2, -d.torsoH / 2, d.torsoW, d.torsoH);
    ctx.fillStyle = kit.shorts; ctx.fillRect(-d.torsoW / 2, d.torsoH / 2 - d.torsoH * 0.34, d.torsoW, d.torsoH);
    ctx.fillStyle = kit.trim; ctx.fillRect(-d.torsoW / 2, d.torsoH / 2 - d.torsoH * 0.34 - 4, d.torsoW, 5);
    ctx.fillRect(-dir * d.torsoW / 2 - 3, -d.torsoH / 2, 8 * dir, d.torsoH);
    ctx.restore();
    ink(ctx, null);
    ctx.beginPath(); ctx.arc(0, -d.torsoH / 2, 11, 0, Math.PI); ctx.lineWidth = 3; ctx.strokeStyle = kit.trim; ctx.stroke();
    text(ctx, String(look.num), dir * 3, -4, 20, kit.trim, { stroke: 4 });
    ctx.restore();

    head(ctx, Hd.x, Hd.y, d.headR, T.a * 0.7, dir, look, kit, target, p.sinceGround > 0.15);

    // the arm, on top: sleeve, skinny arm, mitten hand
    ctx.save(); ctx.translate(A.x, A.y); ctx.rotate(A.a);
    rr(ctx, -d.armW / 2, -d.armL / 2, d.armW, d.armL, d.armW / 2); ink(ctx, look.skin);
    rr(ctx, -d.armW / 2 - 2, -d.armL / 2 - 2, d.armW + 4, 16, 6); ink(ctx, kit.jersey, 3.5);
    ctx.beginPath(); ctx.ellipse(0, d.armL / 2 - 1, d.armW * 0.75, d.armW * 0.62, 0, 0, Math.PI * 2); ink(ctx, look.skin, 3.5);
    ctx.restore();
  }

  function head(ctx, x, y, r, a, dir, look, kit, target, air) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(a);
    const st = look.style;
    if (st === 'puff') { // big round hair behind the head
      ctx.beginPath();
      for (let i = 0; i < 9; i++) { const q = Math.PI * (0.85 + i * 0.165); ctx.arc(Math.cos(q) * r * 0.85 - dir * 3, Math.sin(q) * r * 0.85 - r * 0.15, r * 0.42, 0, Math.PI * 2); }
      ctx.fillStyle = look.hair; ctx.fill();
      ctx.beginPath(); ctx.ellipse(-dir * 3, -r * 0.2, r * 1.22, r * 1.1, 0, 0, Math.PI * 2); ink(ctx, look.hair);
    }
    if (st === 'bun') { ctx.beginPath(); ctx.ellipse(-dir * r * 0.5, -r * 1.05, r * 0.42, r * 0.36, 0, 0, Math.PI * 2); ink(ctx, look.hair); }
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ink(ctx, look.skin);
    ctx.beginPath(); ctx.ellipse(-dir * r * 0.55, r * 0.08, r * 0.17, r * 0.24, 0, 0, Math.PI * 2); ink(ctx, look.skin, 3); // ear

    // hair and hats on top
    if (st === 'spikes') {
      ctx.beginPath(); ctx.moveTo(-r * 0.95, -r * 0.15);
      const n = 5;
      for (let i = 0; i <= n; i++) {
        const q = Math.PI + (i / n) * Math.PI;
        const px = Math.cos(q) * r * 1.0, py = Math.sin(q) * r * 1.0;
        const sx = Math.cos(q + 0.3) * r * 1.45, sy = Math.sin(q + 0.3) * r * 1.45;
        ctx.lineTo(px, py); if (i < n) ctx.lineTo(sx - dir * 4, sy);
      }
      ctx.lineTo(r * 0.95, -r * 0.15); ctx.quadraticCurveTo(0, -r * 0.55, -r * 0.95, -r * 0.15); ink(ctx, look.hair, 3.5);
    } else if (st === 'cap') {
      ctx.beginPath(); ctx.arc(0, -r * 0.12, r * 1.02, Math.PI, 0); ctx.closePath(); ink(ctx, kit.shorts);
      ctx.beginPath(); ctx.moveTo(dir * r * 0.6, -r * 0.2); ctx.quadraticCurveTo(dir * r * 1.6, -r * 0.22, dir * r * 1.75, -r * 0.05);
      ctx.lineTo(dir * r * 0.6, -r * 0.05); ctx.closePath(); ink(ctx, kit.shorts, 3.5);
      ctx.beginPath(); ctx.arc(0, -r * 1.12, r * 0.13, 0, Math.PI * 2); ink(ctx, kit.trim, 2.5);
    } else if (st === 'mohawk') {
      ctx.beginPath(); ctx.moveTo(-dir * r * 0.5, -r * 0.85);
      ctx.quadraticCurveTo(-dir * r * 0.1, -r * 1.9, dir * r * 0.5, -r * 1.55);
      ctx.quadraticCurveTo(dir * r * 0.3, -r * 1.1, dir * r * 0.45, -r * 0.88); ctx.closePath(); ink(ctx, look.hair, 3.5);
    } else if (st === 'band' || st === 'bun' || st === 'puff') {
      if (st !== 'puff') { ctx.beginPath(); ctx.arc(0, 0, r, Math.PI * 1.05, Math.PI * 1.95); ctx.closePath(); ink(ctx, look.hair, 3.5); }
      ctx.save(); ctx.beginPath(); ctx.arc(0, 0, r - 1, 0, Math.PI * 2); ctx.clip();
      ctx.fillStyle = kit.trim === '#1d1a2b' ? '#ffffff' : kit.trim; ctx.fillRect(-r, -r * 0.5, r * 2, r * 0.26);
      ctx.restore();
      if (st === 'band') { ctx.beginPath(); ctx.moveTo(-dir * r * 0.9, -r * 0.38); ctx.lineTo(-dir * r * 1.45, -r * 0.1); ctx.lineTo(-dir * r * 1.35, -r * 0.48); ctx.closePath(); ink(ctx, kit.jersey, 3); }
    }

    // eyes look at the ball
    const la = Math.atan2(target.y - y, target.x - x) - a;
    const ex = Math.cos(la) * r * 0.07, ey = Math.sin(la) * r * 0.07;
    for (const [px, s] of [[dir * r * 0.22, 1], [dir * r * 0.64, 0.85]]) {
      ctx.beginPath(); ctx.ellipse(px, -r * 0.05, r * 0.19 * s, r * 0.24, 0, 0, Math.PI * 2); ink(ctx, '#ffffff', 2.5);
      ctx.beginPath(); ctx.ellipse(px + ex * 1.6, -r * 0.05 + ey * 1.8, r * 0.08, r * 0.11, 0, 0, Math.PI * 2); ctx.fillStyle = INK; ctx.fill();
    }
    ctx.lineWidth = 3; ctx.strokeStyle = INK;
    if (air) { ctx.beginPath(); ctx.ellipse(dir * r * 0.48, r * 0.45, r * 0.11, r * 0.15, 0, 0, Math.PI * 2); ctx.fillStyle = '#7a2a35'; ctx.fill(); ctx.stroke(); }
    else { ctx.beginPath(); ctx.arc(dir * r * 0.42, r * 0.28, r * 0.22, 0.2 * Math.PI, 0.8 * Math.PI); ctx.stroke(); }
    ctx.restore();
  }

  // ---- Ball -----------------------------------------------------------------------------
  function ball(ctx, x, y, r, a, withShadow = true) {
    if (withShadow) shadow(ctx, x, y, r);
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ink(ctx, '#e8591a', Math.max(3, r * 0.14));
    ctx.save(); ctx.beginPath(); ctx.arc(x, y, r - 1, 0, Math.PI * 2); ctx.clip();
    ctx.translate(x, y); ctx.rotate(a);
    ctx.strokeStyle = INK; ctx.lineWidth = Math.max(2, r * 0.09);
    ctx.beginPath(); ctx.moveTo(-r, 0); ctx.lineTo(r, 0); ctx.moveTo(0, -r); ctx.lineTo(0, r);
    ctx.moveTo(-r * 0.35, -r); ctx.quadraticCurveTo(-r * 0.95, 0, -r * 0.35, r);
    ctx.moveTo(r * 0.35, -r); ctx.quadraticCurveTo(r * 0.95, 0, r * 0.35, r);
    ctx.stroke();
    ctx.restore();
    ctx.beginPath(); ctx.arc(x - r * 0.3, y - r * 0.32, r * 0.5, Math.PI * 1.05, Math.PI * 1.5);
    ctx.lineWidth = r * 0.14; ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.stroke();
  }

  /** The whole court: venue, hoops, players, ball, nets. */
  function world(ctx, w, al, t, W, H, hud) {
    venue(ctx, w, W, H, t);
    for (const h of w.hoops) hoopBack(ctx, h);
    if (hud) hud();
    const B = pose(w.ball, al);
    for (const p of w.players) player(ctx, p, al, w.S.kits[p.team], B);
    ball(ctx, B.x, B.y, w.ball.circleRadius, B.a);
    for (const h of w.hoops) hoopFront(ctx, h, t);
    if (B.y + w.ball.circleRadius < 0) { // ball above the screen: a marker at the top edge
      const x = Math.max(30, Math.min(W - 30, B.x));
      ctx.beginPath(); ctx.moveTo(x, 6); ctx.lineTo(x - 14, 30); ctx.lineTo(x + 14, 30); ctx.closePath(); ink(ctx, '#e8591a', 3);
    }
  }

  // ---- HUD ------------------------------------------------------------------------------
  function keycap(ctx, x, y, label, s = 1) {
    rr(ctx, x - 22 * s, y - 20 * s, 44 * s, 42 * s, 9 * s); ink(ctx, '#f7f3ea', 3.5 * s);
    rr(ctx, x - 22 * s, y + 14 * s, 44 * s, 8 * s, 4 * s); ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.fill();
    if (label === 'up') { // a drawn arrow, not a font symbol
      ctx.beginPath(); ctx.moveTo(x, y - 11 * s); ctx.lineTo(x + 10 * s, y + 1 * s); ctx.lineTo(x + 4 * s, y + 1 * s);
      ctx.lineTo(x + 4 * s, y + 11 * s); ctx.lineTo(x - 4 * s, y + 11 * s); ctx.lineTo(x - 4 * s, y + 1 * s); ctx.lineTo(x - 10 * s, y + 1 * s); ctx.closePath();
      ctx.fillStyle = INK; ctx.fill();
    } else text(ctx, label, x, y, 24 * s, INK, { weight: 900 });
  }

  function crown(ctx, x, y, s = 1) {
    ctx.beginPath();
    ctx.moveTo(x - 20 * s, y + 10 * s); ctx.lineTo(x - 22 * s, y - 10 * s); ctx.lineTo(x - 10 * s, y);
    ctx.lineTo(x, y - 16 * s); ctx.lineTo(x + 10 * s, y); ctx.lineTo(x + 22 * s, y - 10 * s); ctx.lineTo(x + 20 * s, y + 10 * s); ctx.closePath();
    ink(ctx, '#ffd23f', 3.5 * s);
  }

  /** Scoreboard at the top: names, keys, big scores that pop, the round and its twist. */
  function scoreboard(ctx, W, st) {
    const cx = W / 2, y = 12, w = 600, h = 96;
    rr(ctx, cx - w / 2, y, w, h, 20); ink(ctx, '#262238', 5);
    for (const team of [0, 1]) {
      const s = team ? 1 : -1, bx = cx + s * 190;
      rr(ctx, bx - 100, y + 10, 200, h - 20, 14); ink(ctx, TEAM_COLORS[team], 4);
      text(ctx, TEAM_NAMES[team].toUpperCase(), bx - s * 28, y + 30, 17, '#ffffff', { stroke: 4 });
      keycap(ctx, bx - s * 28 - 2, y + 62, team ? 'up' : 'W', 0.62);
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

  /** The round card: flips in, names the twist, ends on GO. */
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
    text(ctx, `ROUND ${S.round}`, 0, -98, 22, '#e8591a');
    const title = S.title.toUpperCase(), size = title.length > 14 ? 30 : 44;
    if (title.includes(' + ')) {
      const [a, b] = title.split(' + ');
      text(ctx, a, 0, -40, 34, INK, { weight: 900 }); text(ctx, '+', 0, -6, 28, '#e8591a'); text(ctx, b, 0, 28, 34, INK, { weight: 900 });
    } else text(ctx, title, 0, -20, size, INK, { weight: 900 });
    text(ctx, S.sub, 0, title.includes(' + ') ? 70 : 30, 18, '#4b4566', { weight: 700 });
    text(ctx, S.venueName, 0, 104, 16, '#8a83a8', { weight: 700 });
    ctx.restore();
  }

  function button(ctx, b, accent) {
    rr(ctx, b.x, b.y + 6, b.w, b.h, 16); ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fill();
    rr(ctx, b.x, b.y, b.w, b.h, 16); ink(ctx, accent || '#ffd23f', 5);
    text(ctx, b.label, b.x + b.w / 2, b.y + b.h / 2 + 1, b.size || 28, INK, { weight: 900 });
    if (b.hint) text(ctx, b.hint, b.x + b.w / 2, b.y + b.h + 22, 16, '#ffffff', { weight: 700, stroke: 4 });
  }

  return { setFont, pose, world, player, ball, hoopBack, hoopFront, scoreboard, roundCard, button, keycap, crown, text, ink, rr,
    TEAM_NAMES, TEAM_COLORS, TEAM_DARK, INK, VENUES };
})();
