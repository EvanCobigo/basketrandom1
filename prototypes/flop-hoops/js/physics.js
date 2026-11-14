// PROTOTYPE - NOT FOR PRODUCTION
// Question: Does one key plus floppy physics give a match that is chaotic, funny and still winnable on skill?
// Date: 2026-11-14
'use strict';
/**
 * Physics: builds one round's Matter.js world (court, hoops, ball, four ragdolls) and steps it.
 * It drives the ragdolls from two held / not-held inputs, one per team. It never draws and never
 * reads the keyboard: input arrives as booleans, sounds leave as events through `onEvent`.
 */
const Physics = (() => {
  const { Engine, Bodies, Body, Composite, Constraint, Events } = Matter;
  const CAT = { STATIC: 0x1, PLAYER: 0x2, BALL: 0x4 };
  const DELTA = 1000 / 60;   // ms per engine update: exactly one game step
  const FLOOR_Y = 640;       // court floor, logical px
  const CX = 640;            // court centre, logical px
  const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const staticFilter = { category: CAT.STATIC, mask: CAT.PLAYER | CAT.BALL };

  function tag(b, kind, player = null) { b.plugin = { kind, player }; return b; }
  function box(x, y, w, h, kind, extra) {
    return tag(Bodies.rectangle(x, y, w, h, Object.assign(
      { isStatic: true, friction: 0.8, restitution: 0.1, collisionFilter: staticFilter }, extra)), kind);
  }

  /** One ragdoll: torso, head, two legs and one swinging arm, pinned together. */
  function makePlayer(x, team, idx, S, look) {
    const dir = team === 0 ? 1 : -1;
    const d = {
      torsoW: 46, torsoH: 66 * S.torso, headR: 25 * S.head,
      legL: 50 * S.leg, legW: 17, armL: 56 * S.arm, armW: 15,
    };
    const hipY = FLOOR_Y - d.legL + 3;
    const torsoY = hipY - d.torsoH / 2 + 8;
    const torsoTop = torsoY - d.torsoH / 2;
    const headY = torsoTop - d.headR * 0.8;
    const shoulderY = torsoTop + 14;
    const group = Body.nextGroup(true); // a player's own parts never collide with each other
    const filt = { group, category: CAT.PLAYER, mask: CAT.STATIC | CAT.PLAYER | CAT.BALL };
    const torso = Bodies.rectangle(x, torsoY, d.torsoW, d.torsoH, { chamfer: { radius: 16 },
      density: 0.0022, friction: 0.5, frictionAir: 0.012, restitution: 0.1, collisionFilter: filt });
    const head = Bodies.circle(x, headY, d.headR, {
      density: 0.0012, friction: 0.3, frictionAir: 0.01, restitution: 0.3, collisionFilter: filt });
    const legs = [-1, 1].map(s => Bodies.rectangle(x + s * 10, hipY + d.legL / 2 - 4, d.legW, d.legL, {
      chamfer: { radius: 8 }, density: 0.002, friction: 1.1, frictionAir: 0.012, restitution: 0.05, collisionFilter: filt }));
    const arm = Bodies.rectangle(x, shoulderY + d.armL / 2 - 6, d.armW, d.armL, { chamfer: { radius: 7 },
      density: 0.0024, friction: 0.4, frictionAir: 0.01, restitution: 0.2, collisionFilter: filt });

    const p = { team, idx, dir, torso, head, legs, arm, dims: d, look,
      parts: [torso, head, legs[0], legs[1], arm],
      touch: false, sinceGround: 0, sinceJump: 9, cd: 0 };
    tag(torso, 'torso', p); tag(head, 'head', p); legs.forEach(l => tag(l, 'leg', p)); tag(arm, 'arm', p);

    p.joints = [
      Constraint.create({ bodyA: torso, pointA: { x: 0, y: -d.torsoH / 2 - d.headR * 0.8 }, bodyB: head,
        pointB: { x: 0, y: 0 }, length: 0, stiffness: 0.7, damping: 0.05 }),
      ...legs.map((leg, i) => Constraint.create({ bodyA: torso, pointA: { x: (i ? 10 : -10), y: d.torsoH / 2 - 8 },
        bodyB: leg, pointB: { x: 0, y: -d.legL / 2 + 4 }, length: 0, stiffness: 1 })),
      Constraint.create({ bodyA: torso, pointA: { x: 0, y: -d.torsoH / 2 + 14 }, bodyB: arm,
        pointB: { x: 0, y: -d.armL / 2 + 6 }, length: 0, stiffness: 1 }),
    ];
    return p;
  }

  /**
   * Build a round's world.
   * @param {object} S round settings from Rounds.roll
   * @param {object} T live tuning values
   * @param {() => number} rng seeded random
   * @param {(ev: object) => void} onEvent receives {type:'jump'|'hit', ...} for sound and juice
   */
  function createWorld(S, T, rng, onEvent) {
    const engine = Engine.create({ enableSleeping: false });
    engine.gravity.y = T.gravity * S.grav;
    engine.positionIterations = 10; engine.velocityIterations = 8; engine.constraintIterations = 4;
    const half = S.courtW / 2, L = CX - half, R = CX + half;
    const w = { engine, S, L, R, cx: CX, floorY: FLOOR_Y, players: [], hoops: [], kicks: [], rng, onEvent };

    const statics = [
      box(CX, FLOOR_Y + 200, 4000, 400, 'floor', { friction: 0.9 }),
      box(L - 100, 0, 200, 3000, 'wall'),
      box(R + 100, 0, 200, 3000, 'wall'),
      box(CX, -950, 4000, 200, 'wall'),
    ];
    const span = Math.max(T.rim_span_min, S.ballR * 2 * 1.7);
    const rimY = FLOOR_Y - T.rim_height * S.hoop;
    for (const side of [-1, 1]) {
      const boardX = side < 0 ? L + T.board_inset : R - T.board_inset;
      const inward = -side;
      const backX = boardX + inward * 7, frontX = backX + inward * span;
      const board = box(boardX, rimY - 62, 14, 160, 'board', { restitution: 0.4, friction: 0.3 });
      const rim = tag(Bodies.circle(frontX, rimY, 6, { isStatic: true, restitution: 0.5, friction: 0.1,
        collisionFilter: staticFilter }), 'rim');
      // team 0 (left, Tangerines) attacks the right hoop; team 1 attacks the left one
      const hoop = { side, boardX, rimY, backX, frontX, span, x1: Math.min(backX, frontX), x2: Math.max(backX, frontX),
        team: side > 0 ? 0 : 1, wobble: 0, sway: 0 };
      board.plugin.hoop = hoop; rim.plugin.hoop = hoop;
      w.hoops.push(hoop);
      statics.push(board, rim);
    }

    w.ball = tag(Bodies.circle(CX, FLOOR_Y - T.drop_height, S.ballR, { restitution: S.bounce,
      friction: 0.04, frictionStatic: 0.1, frictionAir: T.ball_air,
      collisionFilter: { category: CAT.BALL, mask: CAT.STATIC | CAT.PLAYER } }), 'ball');
    Body.setMass(w.ball, T.ball_mass);

    const k = S.courtW / 1160;
    for (const team of [0, 1]) for (const idx of [0, 1]) {
      const off = (idx === 0 ? 330 : 150) * k;
      w.players.push(makePlayer(CX + (team === 0 ? -off : off), team, idx, S, S.looks[team][idx]));
    }
    w.dynamic = [w.ball, ...w.players.flatMap(p => p.parts)];
    Composite.add(engine.world, [...statics, w.ball, ...w.players.flatMap(p => [...p.parts, ...p.joints])]);
    dropBall(w, T);

    const touchPair = (a, b) => {
      for (const [x, y] of [[a, b], [b, a]]) {
        const pl = x.plugin && x.plugin.player;
        if (pl && (x.plugin.kind === 'leg' || x.plugin.kind === 'torso') && y.plugin.kind !== 'ball' && y.plugin.player !== pl) pl.touch = true;
      }
    };
    Events.on(engine, 'collisionStart', e => {
      for (const pr of e.pairs) {
        const a = pr.bodyA, b = pr.bodyB;
        touchPair(a, b);
        const ball = a.plugin.kind === 'ball' ? a : b.plugin.kind === 'ball' ? b : null;
        if (!ball) continue;
        const other = ball === a ? b : a;
        const rel = Math.hypot(ball.velocity.x - other.velocity.x, ball.velocity.y - other.velocity.y);
        if (other.plugin.player) w.kicks.push({ part: other, rel });
        onEvent({ type: 'hit', on: other.plugin.player ? 'player' : other.plugin.kind, speed: rel,
          team: other.plugin.player ? other.plugin.player.team : -1, hoop: other.plugin.hoop || null });
      }
    });
    Events.on(engine, 'collisionActive', e => { for (const pr of e.pairs) touchPair(pr.bodyA, pr.bodyB); });
    return w;
  }

  /** Put the ball back above centre court with a small random drift. */
  function dropBall(w, T) {
    Body.setPosition(w.ball, { x: w.cx, y: w.floorY - T.drop_height });
    Body.setVelocity(w.ball, { x: (w.rng() - 0.5) * 2.4, y: 0 });
    Body.setAngularVelocity(w.ball, (w.rng() - 0.5) * 0.2);
    w.ball._px = undefined;
  }

  function gravityPx(w) { return w.engine.gravity.y * w.engine.gravity.scale * DELTA * DELTA; }

  /** Steer one ragdoll: upright spring, floppy legs, arm motor, and the jump. */
  function drive(w, p, held, T, dt) {
    const S = w.S, g = gravityPx(w), grounded = p.sinceGround <= T.coyote_time;
    p.cd -= dt; p.sinceJump += dt; p.held = held;
    const torso = p.torso, a = wrap(torso.angle);

    // Upright spring in rad/s: weaker in the air so jumps tumble.
    const k = T.upright * (grounded ? 1 : T.upright_air);
    let omega = torso.angularVelocity * 60;
    omega += (-a * k - omega * T.upright_damp) * dt;
    Body.setAngularVelocity(torso, omega / 60);
    const tav = torso.angularVelocity;

    p.legs.forEach((leg, i) => {
      const rest = (i ? 1 : -1) * 0.12;
      const rel = wrap(leg.angle - torso.angle - rest);
      Body.setAngularVelocity(leg, lerp(leg.angularVelocity, tav - rel * T.leg_stiffness, T.leg_follow));
    });

    // Held: the arm swings up through the front. Let go: it slaps back down through the front.
    const target = held ? -p.dir * T.arm_up_angle : p.dir * 0.15;
    const rel = wrap(p.arm.angle - torso.angle);
    const err = wrap(target - rel);
    const want = tav + clamp(err * T.arm_gain, -T.arm_max_speed, T.arm_max_speed);
    Body.setAngularVelocity(p.arm, lerp(p.arm.angularVelocity, want, 0.55));

    if (held && grounded && p.cd <= 0) {
      const v = Math.sqrt(2 * g * T.jump_height * S.jump) * (1 + (w.rng() * 2 - 1) * T.jump_jitter);
      const m = T.jump_tilt_mix;
      let jx = Math.sin(a) * m, jy = -(1 - m) - Math.cos(a) * m;
      if (jy > -0.35) jy = -0.35;            // even upside down, a jump goes up a little
      const n = Math.hypot(jx, jy); jx /= n; jy /= n;
      // each hop also leans toward the ball's side, so a player who overran it can turn back
      const chase = clamp((w.ball.position.x - torso.position.x) / 140, -1, 1) * T.jump_chase;
      const vx = jx * v + p.dir * T.jump_forward + chase, vy = jy * v;
      for (const part of p.parts) {
        Body.setVelocity(part, { x: part.velocity.x * 0.25 + vx, y: Math.min(part.velocity.y, 0) * 0.25 + vy });
      }
      Body.setAngularVelocity(torso, torso.angularVelocity + p.dir * T.jump_spin);
      p.cd = T.jump_cooldown; p.sinceJump = 0; p.sinceGround = 99;
      w.onEvent({ type: 'jump', team: p.team });
    } else if (held && p.sinceJump < T.hold_boost_time) {
      for (const part of p.parts) Body.setVelocity(part, { x: part.velocity.x, y: part.velocity.y - g * T.hold_boost });
    }
  }

  function capSpeed(b, max) {
    const s = Math.hypot(b.velocity.x, b.velocity.y);
    if (s > max) Body.setVelocity(b, { x: b.velocity.x * max / s, y: b.velocity.y * max / s });
  }

  /**
   * Advance the world one fixed step.
   * @param {object} w world from createWorld
   * @param {boolean[]} held [team 0 key held, team 1 key held]
   * @param {object} T live tuning values
   * @param {number} dt step length in seconds
   */
  function step(w, held, T, dt) {
    for (const b of w.dynamic) { b._px = b.position.x; b._py = b.position.y; b._pa = b.angle; }
    for (const p of w.players) drive(w, p, held[p.team], T, dt);
    w.kicks.length = 0;
    Engine.update(w.engine, DELTA);
    for (const p of w.players) { p.sinceGround = p.touch ? 0 : p.sinceGround + dt; p.touch = false; }

    const ball = w.ball;
    for (const kk of w.kicks) {   // exaggerated pop off any body part, plus a random spin
      const dx = ball.position.x - kk.part.position.x, dy = ball.position.y - kk.part.position.y;
      const n = Math.hypot(dx, dy) || 1;
      const boost = T.ball_kick * clamp(kk.rel / 10, 0.3, 1.3);
      const low = ball.position.y > w.floorY - ball.circleRadius * 3 ? 1.5 : 1; // a ball near the floor pops up harder
      Body.setVelocity(ball, { x: ball.velocity.x + dx / n * boost, y: ball.velocity.y + dy / n * boost - boost * T.ball_lift * low });
      Body.setAngularVelocity(ball, ball.angularVelocity + (w.rng() - 0.5) * T.ball_spin);
    }
    capSpeed(ball, T.ball_max_speed);
    for (const p of w.players) for (const part of p.parts) capSpeed(part, 30);

    for (const h of w.hoops) {   // the net drags a ball passing through it: the swish
      if (ball.position.x > h.x1 && ball.position.x < h.x2 && ball.position.y > h.rimY && ball.position.y < h.rimY + 62) {
        Body.setVelocity(ball, { x: ball.velocity.x * 0.86, y: ball.velocity.y * 0.96 });
        h.sway = Math.min(1.5, h.sway + 0.12);
      }
      h.wobble *= 0.93; h.sway *= 0.95;
    }
  }

  return { FLOOR_Y, CX, DELTA, createWorld, step, dropBall };
})();
