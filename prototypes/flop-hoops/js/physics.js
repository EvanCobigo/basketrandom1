// PROTOTYPE - NOT FOR PRODUCTION
// Question: Does one key plus floppy physics give a match that is chaotic, funny and still winnable on skill?
// Date: 2026-11-14
'use strict';
/**
 * Physics: builds one round's Matter.js world (court, hoops, ball, four ragdolls) and steps it.
 * It drives the ragdolls and the ball's possession from two held / not-held inputs, one per team:
 * jumps, grabs, shots, fadeaways, dunks, steals and blocks. It never draws and never reads the
 * keyboard: input arrives as booleans, sounds and callouts leave as events through `onEvent`.
 */
const Physics = (() => {
  const { Engine, Bodies, Body, Composite, Constraint, Events } = Matter;
  // Teammates never collide with each other: each team has its own category and only hits the other.
  const CAT = { STATIC: 0x1, TEAM0: 0x2, TEAM1: 0x4, BALL: 0x8 };
  const TEAM_CAT = [CAT.TEAM0, CAT.TEAM1];
  const DELTA = 1000 / 60;   // ms per engine update: exactly one game step
  const FLOOR_Y = 640;       // court floor, logical px
  const CX = 640;            // court centre, logical px
  const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const staticFilter = { category: CAT.STATIC, mask: CAT.TEAM0 | CAT.TEAM1 | CAT.BALL };

  function tag(b, kind, player = null) { b.plugin = { kind, player }; return b; }
  function box(x, y, w, h, kind, extra) {
    return tag(Bodies.rectangle(x, y, w, h, Object.assign(
      { isStatic: true, friction: 0.8, restitution: 0.1, collisionFilter: staticFilter }, extra)), kind);
  }

  /** One ragdoll: torso, blocky head, two legs and one swinging arm, pinned together. */
  function makePlayer(x, team, idx, S, look) {
    const dir = team === 0 ? 1 : -1;
    const d = {
      torsoW: 44, torsoH: 64 * S.torso, headR: 24 * S.head,
      legL: 50 * S.leg, legW: 16, armL: 56 * S.arm, armW: 14,
    };
    d.headS = d.headR * 1.8;   // square head, side length
    const hipY = FLOOR_Y - d.legL + 3;
    const torsoY = hipY - d.torsoH / 2 + 8;
    const torsoTop = torsoY - d.torsoH / 2;
    const headY = torsoTop - d.headS * 0.42;
    const shoulderY = torsoTop + 14;
    const group = Body.nextGroup(true); // a player's own parts never collide with each other
    const filt = { group, category: TEAM_CAT[team], mask: CAT.STATIC | CAT.BALL | TEAM_CAT[1 - team] };
    const torso = Bodies.rectangle(x, torsoY, d.torsoW, d.torsoH, { chamfer: { radius: 6 },
      density: 0.0022, friction: 0.5, frictionAir: 0.012, restitution: 0.1, collisionFilter: filt });
    const head = Bodies.rectangle(x, headY, d.headS, d.headS, { chamfer: { radius: d.headS * 0.18 },
      density: 0.0011, friction: 0.3, frictionAir: 0.01, restitution: 0.3, collisionFilter: filt });
    const legs = [-1, 1].map(s => Bodies.rectangle(x + s * 10, hipY + d.legL / 2 - 4, d.legW, d.legL, {
      chamfer: { radius: 4 }, density: 0.002, friction: 1.1, frictionAir: 0.012, restitution: 0.05, collisionFilter: filt }));
    const arm = Bodies.rectangle(x, shoulderY + d.armL / 2 - 6, d.armW, d.armL, { chamfer: { radius: 4 },
      density: 0.0024, friction: 0.4, frictionAir: 0.01, restitution: 0.2, collisionFilter: filt });

    const p = { team, idx, dir, torso, head, legs, arm, dims: d, look, group,
      parts: [torso, head, legs[0], legs[1], arm],
      touch: false, sinceGround: 0, sinceJump: 9, cd: 0, grabCD: 0, prevHeld: false, boosting: false };
    tag(torso, 'torso', p); tag(head, 'head', p); legs.forEach(l => tag(l, 'leg', p)); tag(arm, 'arm', p);

    p.joints = [
      Constraint.create({ bodyA: torso, pointA: { x: 0, y: -d.torsoH / 2 - d.headS * 0.42 }, bodyB: head,
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
   * @param {(ev: object) => void} onEvent receives {type, ...} for sound and callouts
   */
  function createWorld(S, T, rng, onEvent) {
    const engine = Engine.create({ enableSleeping: false });
    engine.gravity.y = T.gravity * S.grav;
    engine.positionIterations = 10; engine.velocityIterations = 8; engine.constraintIterations = 4;
    const half = S.courtW / 2, L = CX - half, R = CX + half;
    const w = { engine, S, L, R, cx: CX, floorY: FLOOR_Y, players: [], hoops: [], kicks: [], rng, onEvent,
      time: 0, hold: null, ignoreUntil: 0 };

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
        cx: (backX + frontX) / 2, team: side > 0 ? 0 : 1, wobble: 0, sway: 0 };
      board.plugin.hoop = hoop; rim.plugin.hoop = hoop;
      w.hoops.push(hoop);
      statics.push(board, rim);
    }

    w.ball = tag(Bodies.circle(CX, FLOOR_Y - T.drop_height, S.ballR, { restitution: S.bounce,
      friction: 0.04, frictionStatic: 0.1, frictionAir: T.ball_air,
      collisionFilter: { group: 0, category: CAT.BALL, mask: CAT.STATIC | CAT.TEAM0 | CAT.TEAM1 } }), 'ball');
    Body.setMass(w.ball, T.ball_mass);
    w.ball.shot = null;

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
        else if (other.plugin.kind === 'floor') ball.shot = null; // a shot that lands is no longer a shot
        onEvent({ type: 'hit', on: other.plugin.player ? 'player' : other.plugin.kind, speed: rel,
          team: other.plugin.player ? other.plugin.player.team : -1, hoop: other.plugin.hoop || null });
      }
    });
    Events.on(engine, 'collisionActive', e => { for (const pr of e.pairs) touchPair(pr.bodyA, pr.bodyB); });
    return w;
  }

  /** Put the ball back above centre court with a small random drift. */
  function dropBall(w, T) {
    if (w.hold) release(w, T, 0);
    Body.setPosition(w.ball, { x: w.cx, y: w.floorY - T.drop_height });
    Body.setVelocity(w.ball, { x: (w.rng() - 0.5) * 2.4, y: 0 });
    Body.setAngularVelocity(w.ball, (w.rng() - 0.5) * 0.2);
    w.ball.shot = null;
    w.ball._px = undefined;
  }

  function gravityPx(w) { return w.engine.gravity.y * w.engine.gravity.scale * DELTA * DELTA; }
  /** The tip of a player's arm, where the hand is. */
  function handPos(p) {
    const a = p.arm.angle, h = p.dims.armL / 2;
    return { x: p.arm.position.x - Math.sin(a) * h, y: p.arm.position.y + Math.cos(a) * h };
  }
  function attackedHoop(w, p) { return w.hoops.find(h => h.team === p.team); }
  const carrier = w => (w.hold ? w.hold.p : null);

  /** Steer one ragdoll: upright spring with an idle bobble, floppy legs, arm motor, and the jump. */
  function drive(w, p, held, T, dt) {
    const S = w.S, g = gravityPx(w), grounded = p.sinceGround <= T.coyote_time;
    const carrying = carrier(w) === p;
    p.cd -= dt; p.grabCD -= dt; p.sinceJump += dt;
    const torso = p.torso, a = wrap(torso.angle);

    // Upright spring in rad/s, weaker in the air so jumps tumble. Standing still, the target
    // rocks side to side: the idle bobble.
    const idle = grounded && !held && p.sinceJump > 0.35;
    const bob = idle ? Math.sin(w.time * T.bob_rate * Math.PI * 2 + p.idx * 1.9 + p.team * 0.7) * T.bob_angle : 0;
    const k = T.upright * (grounded ? 1 : T.upright_air);
    let omega = torso.angularVelocity * 60;
    omega += (-wrap(a - bob) * k - omega * T.upright_damp) * dt;
    Body.setAngularVelocity(torso, omega / 60);
    const tav = torso.angularVelocity;

    p.legs.forEach((leg, i) => {
      const rest = (i ? 1 : -1) * 0.12;
      const rel = wrap(leg.angle - torso.angle - rest);
      Body.setAngularVelocity(leg, lerp(leg.angularVelocity, tav - rel * T.leg_stiffness, T.leg_follow));
    });

    // Held: the arm swings up through the front (with the ball it winds back further as the shot
    // charges). Let go: it slaps back down through the front.
    const wind = carrying && held ? Math.min(3.05, T.arm_up_angle + 0.5 * w.hold.charge) : T.arm_up_angle;
    const target = held ? -p.dir * wind : p.dir * 0.15;
    const rel = wrap(p.arm.angle - torso.angle);
    const err = wrap(target - rel);
    const want = tav + clamp(err * T.arm_gain, -T.arm_max_speed, T.arm_max_speed);
    Body.setAngularVelocity(p.arm, lerp(p.arm.angularVelocity, want, 0.55));

    // Jump: a tap is a short hop; keeping the key down lifts it to full height. Holding keeps
    // hopping on landing, except for a ball carrier, who is charging a shot.
    const vFull = Math.sqrt(2 * g * T.jump_height * S.jump);
    const fresh = held && !p.prevHeld;
    if (held && grounded && p.cd <= 0 && (!carrying || fresh)) {
      const v = vFull * T.jump_tap_frac * (1 + (w.rng() * 2 - 1) * T.jump_jitter);
      const m = T.jump_tilt_mix;
      let jx = Math.sin(a) * m, jy = -(1 - m) - Math.cos(a) * m;
      if (jy > -0.35) jy = -0.35;            // even upside down, a jump goes up a little
      const n = Math.hypot(jx, jy); jx /= n; jy /= n;
      // each hop leans toward where the play is: the ball, or the hoop when your team has it
      const c = carrier(w);
      const goalX = c && c.team === p.team ? attackedHoop(w, p).cx : w.ball.position.x;
      const chase = clamp((goalX - torso.position.x) / 140, -1, 1) * T.jump_chase;
      const vx = jx * v + p.dir * T.jump_forward + chase, vy = jy * v;
      for (const part of p.parts) {
        Body.setVelocity(part, { x: part.velocity.x * 0.25 + vx, y: Math.min(part.velocity.y, 0) * 0.25 + vy });
      }
      Body.setAngularVelocity(torso, torso.angularVelocity + p.dir * T.jump_spin);
      p.cd = T.jump_cooldown; p.sinceJump = 0; p.sinceGround = 99; p.boosting = true;
      w.onEvent({ type: 'jump', team: p.team });
    } else if (p.boosting && held && p.sinceJump < T.jump_hold_time && torso.velocity.y < 0) {
      const add = vFull * (1 - T.jump_tap_frac) / (T.jump_hold_time * 60);
      for (const part of p.parts) Body.setVelocity(part, { x: part.velocity.x, y: part.velocity.y - add });
    } else if (!held) p.boosting = false;
    p.prevHeld = held;
  }

  // ---- Possession: grab, shoot, fadeaway, dunk, steal, block -------------------------------
  function grab(w, p, T, how) {
    const ball = w.ball, hand = handPos(p);
    if (w.hold) release(w, T, 0);
    Body.setPosition(ball, hand);
    Body.setVelocity(ball, { x: p.arm.velocity.x, y: p.arm.velocity.y });
    ball.collisionFilter.group = p.group;           // the carrier's own body never knocks it out of the hand
    const con = Constraint.create({ bodyA: p.arm, pointA: { x: 0, y: p.dims.armL / 2 }, bodyB: ball,
      pointB: { x: 0, y: 0 }, length: 0, stiffness: 0.5, damping: 0.1 });
    Composite.add(w.engine.world, con);
    w.hold = { p, con, t: 0, charge: 0 };
    ball.shot = null;
    w.onEvent({ type: how, team: p.team });
  }

  /** Let go of the ball. It ignores the old carrier's body for `ignoreFor` seconds. */
  function release(w, T, ignoreFor) {
    const h = w.hold;
    Composite.remove(w.engine.world, h.con);
    h.p.grabCD = T.regrab_delay;
    w.hold = null;
    w.ignoreUntil = w.time + ignoreFor;
    if (ignoreFor <= 0) w.ball.collisionFilter.group = 0;
  }

  /** Release the held ball as a shot: the charge sets the power, the body's lean bends the arc. */
  function shoot(w, T) {
    const h = w.hold, p = h.p, ball = w.ball, hoop = attackedHoop(w, p);
    const airborne = p.sinceGround > 0.1, a = wrap(p.torso.angle);
    const fade = airborne && (p.torso.velocity.x * p.dir < -T.fade_speed || a * p.dir < -T.fade_lean);
    const theta = (fade ? T.fade_angle : T.shot_angle) * Math.PI / 180 - a * p.dir * T.shot_tilt;
    let v = lerp(T.shot_min, T.shot_max, h.charge) * (fade ? T.fade_power : 1);
    // aim help toward the rim: a little on every shot, more on a fadeaway
    const X = (hoop.cx - ball.position.x) * p.dir, Y = ball.position.y - (hoop.rimY - 12);
    const denom = 2 * Math.cos(theta) ** 2 * (X * Math.tan(theta) - Y);
    if (X > 40 && denom > 0) v = lerp(v, Math.sqrt(gravityPx(w) * X * X / denom), fade ? T.fade_assist : T.shot_assist);
    release(w, T, 0.18);
    Body.setVelocity(ball, { x: Math.cos(theta) * v * p.dir + p.torso.velocity.x * 0.3, y: -Math.sin(theta) * v });
    Body.setAngularVelocity(ball, -p.dir * 0.25);
    ball.shot = { team: p.team, t: w.time, kind: fade ? 'fade' : 'shot', dir: p.dir };
    w.onEvent({ type: fade ? 'fadeaway' : 'shoot', team: p.team, charge: h.charge });
  }

  /** Slam it: the ball is pushed down through the rim from above. */
  function dunk(w, T, hoop) {
    const p = w.hold.p, ball = w.ball;
    release(w, T, 0.3);
    Body.setPosition(ball, { x: hoop.cx, y: hoop.rimY - ball.circleRadius - 2 });
    Body.setVelocity(ball, { x: 0, y: T.dunk_speed });
    ball._px = undefined;
    ball.shot = { team: p.team, t: w.time, kind: 'dunk', dir: p.dir };
    hoop.wobble = 2;
    for (const part of p.parts) Body.setVelocity(part, { x: part.velocity.x * 0.5, y: Math.max(part.velocity.y, 2) });
    w.onEvent({ type: 'dunk', team: p.team });
  }

  function possession(w, held, T, dt) {
    const ball = w.ball;
    if (w.ignoreUntil && w.time >= w.ignoreUntil && !w.hold) { ball.collisionFilter.group = 0; w.ignoreUntil = 0; }

    // body hits on the ball
    for (const kk of w.kicks) {
      const pl = kk.part.plugin.player;
      if (w.hold) {
        if (pl.team === w.hold.p.team) continue;
        if (w.hold.t > T.steal_guard && held[pl.team] && kk.part.plugin.kind === 'arm') { grab(w, pl, T, 'steal'); return; }
        if (kk.rel > T.strip_speed && w.hold.t > T.steal_guard) {
          release(w, T, 0.1);   // knocked loose, toward the hoop the hitter attacks
          Body.setVelocity(ball, { x: ball.velocity.x + pl.dir * 5, y: ball.velocity.y - 5 });
          w.onEvent({ type: 'strip', team: pl.team });
        }
        continue;
      }
      const shot = ball.shot;
      if (shot && shot.kind !== 'dunk' && shot.team !== pl.team && w.time - shot.t < T.block_window) {
        // a fresh shot hit by a defender: swatted back the way it came
        Body.setVelocity(ball, { x: -shot.dir * T.block_pop, y: -T.block_pop * 0.55 });
        ball.shot = null;
        w.onEvent({ type: 'block', team: pl.team });
        continue;
      }
      // key down and the ball meets your hands, head or body (not your feet): you catch it
      if (held[pl.team] && pl.grabCD <= 0 && kk.part.plugin.kind !== 'leg' && w.time >= w.ignoreUntil) { grab(w, pl, T, 'grab'); return; }
      const dx = ball.position.x - kk.part.position.x, dy = ball.position.y - kk.part.position.y;
      const n = Math.hypot(dx, dy) || 1;
      const boost = T.ball_kick * clamp(kk.rel / 10, 0.3, 1.3);
      const low = ball.position.y > w.floorY - ball.circleRadius * 3 ? 1.5 : 1; // a ball near the floor pops up harder
      Body.setVelocity(ball, { x: ball.velocity.x + dx / n * boost, y: ball.velocity.y + dy / n * boost - boost * T.ball_lift * low });
      Body.setAngularVelocity(ball, ball.angularVelocity + (w.rng() - 0.5) * T.ball_spin);
      if (shot && shot.team !== pl.team) ball.shot = null;
    }

    if (w.hold) {
      const h = w.hold, p = h.p;
      h.t += dt;
      if (held[p.team]) h.charge = Math.min(1, h.charge + dt / T.shot_charge_time);
      const hoop = attackedHoop(w, p), hand = handPos(p), r = ball.circleRadius;
      const near = Math.abs(hand.x - hoop.cx) < hoop.span / 2 + r + T.dunk_reach
        && ball.position.y < hoop.rimY + T.dunk_below && ball.position.y > hoop.rimY - T.dunk_height;
      if (p.sinceGround > 0.1 && near) dunk(w, T, hoop);
      else if (!held[p.team] || h.t > T.hold_max) shoot(w, T);
      else for (const q of w.players) { // a defender's hand on the ball, key down: stolen
        if (q.team === p.team || !held[q.team] || h.t < T.steal_guard) continue;
        const hq = handPos(q);
        if (Math.hypot(hq.x - ball.position.x, hq.y - ball.position.y) < r + T.grab_reach * 0.6) { grab(w, q, T, 'steal'); break; }
      }
      return;
    }
    // a free ball: the first hand that reaches it with its key down takes it
    if (w.time < w.ignoreUntil) return;
    for (const p of w.players) {
      if (!held[p.team] || p.grabCD > 0) continue;
      const hp = handPos(p);
      if (Math.hypot(hp.x - ball.position.x, hp.y - ball.position.y) < ball.circleRadius + T.grab_reach) { grab(w, p, T, 'grab'); break; }
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
    w.time += dt;
    for (const b of w.dynamic) { b._px = b.position.x; b._py = b.position.y; b._pa = b.angle; }
    for (const p of w.players) drive(w, p, held[p.team], T, dt);
    w.kicks.length = 0;
    Engine.update(w.engine, DELTA);
    for (const p of w.players) { p.sinceGround = p.touch ? 0 : p.sinceGround + dt; p.touch = false; }

    possession(w, held, T, dt);
    const ball = w.ball;
    capSpeed(ball, T.ball_max_speed);
    for (const p of w.players) for (const part of p.parts) capSpeed(part, 30);

    for (const h of w.hoops) {   // the net drags a free ball passing through it: the swish
      if (!w.hold && ball.position.x > h.x1 && ball.position.x < h.x2 && ball.position.y > h.rimY && ball.position.y < h.rimY + 62) {
        Body.setVelocity(ball, { x: ball.velocity.x * 0.86, y: ball.velocity.y * 0.96 });
        h.sway = Math.min(1.5, h.sway + 0.12);
      }
      h.wobble *= 0.93; h.sway *= 0.95;
    }
  }

  return { FLOOR_Y, CX, DELTA, createWorld, step, dropBall, handPos };
})();
