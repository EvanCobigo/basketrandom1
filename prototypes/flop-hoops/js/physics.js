// PROTOTYPE - NOT FOR PRODUCTION
// Question: Does one key plus floppy physics give a match that is chaotic, funny and still winnable on skill?
// Date: 2026-11-14
'use strict';
/**
 * Physics: builds one round's Matter.js world (court, hoops, ball, four ragdolls) and steps it.
 * It drives the ragdolls and the ball's possession from two held / not-held inputs, one per team:
 * rocking, jumps, catches, cock-back shots, fadeaways, dunks, steals and blocks. It never draws and
 * never reads the keyboard: input arrives as booleans, sounds and callouts leave through `onEvent`.
 */
const Physics = (() => {
  const { Engine, Bodies, Body, Composite, Constraint, Events } = Matter;
  // Teammates never collide with each other: each team has its own category and only hits the other.
  const CAT = { STATIC: 0x1, TEAM0: 0x2, TEAM1: 0x4, BALL: 0x8 };
  const TEAM_CAT = [CAT.TEAM0, CAT.TEAM1];
  const DELTA = 1000 / 60;   // ms per engine update: one physics step
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

  /** Points of a squircle (superellipse, exponent 4) of half-size r, for the ball's body and drawing. */
  function squircle(r, n = 28) {
    const pts = [];
    for (let i = 0; i < n; i++) {
      const t = (i / n) * Math.PI * 2, c = Math.cos(t), s = Math.sin(t);
      pts.push({ x: r * Math.sign(c) * Math.sqrt(Math.abs(c)), y: r * Math.sign(s) * Math.sqrt(Math.abs(s)) });
    }
    return pts;
  }

  /** One slim ragdoll: torso, squircle head, two legs and one long arm, pinned together. */
  function makePlayer(x, team, idx, S, look, T) {
    const dir = team === 0 ? 1 : -1;
    const d = {
      torsoW: T.body_width, torsoH: 62 * S.torso, headR: 21 * S.head,
      legL: 52 * S.leg, legW: T.limb_width, armL: T.arm_length * S.arm, armW: T.limb_width * 0.8,
    };
    d.headS = d.headR * 1.8;   // squircle head, side length
    const hipY = FLOOR_Y - d.legL + 3;
    const torsoY = hipY - d.torsoH / 2 + 6;
    const torsoTop = torsoY - d.torsoH / 2;
    const headY = torsoTop - d.headS * 0.42;
    const shoulderY = torsoTop + 10;
    const group = Body.nextGroup(true); // a player's own parts never collide with each other
    const filt = { group, category: TEAM_CAT[team], mask: CAT.STATIC | CAT.BALL | TEAM_CAT[1 - team] };
    const torso = Bodies.rectangle(x, torsoY, d.torsoW, d.torsoH, { chamfer: { radius: d.torsoW * 0.3 },
      density: 0.0036, friction: 0.5, frictionAir: 0.012, restitution: 0.1, collisionFilter: filt });
    const head = Bodies.rectangle(x, headY, d.headS, d.headS, { chamfer: { radius: d.headS * 0.32 },
      density: 0.0011, friction: 0.3, frictionAir: 0.01, restitution: 0.3, collisionFilter: filt });
    const legs = [-1, 1].map(s => Bodies.rectangle(x + s * d.torsoW * 0.22, hipY + d.legL / 2 - 4, d.legW, d.legL, {
      chamfer: { radius: 3 }, density: 0.003, friction: 1.4, frictionStatic: 2, frictionAir: 0.012, restitution: 0, collisionFilter: filt }));
    const arm = Bodies.rectangle(x, shoulderY + d.armL / 2 - 5, d.armW, d.armL, { chamfer: { radius: 3 },
      density: 0.0024, friction: 0.4, frictionAir: 0.01, restitution: 0.2, collisionFilter: filt });

    const p = { team, idx, dir, torso, head, legs, arm, dims: d, look, group,
      parts: [torso, head, legs[0], legs[1], arm],
      touch: false, foot: false, sinceGround: 0, sinceFoot: 0, sinceJump: 9, cd: 0, grabCD: 0, downT: 0,
      prevHeld: false, boosting: false };
    tag(torso, 'torso', p); tag(head, 'head', p); legs.forEach(l => tag(l, 'leg', p)); tag(arm, 'arm', p);

    const hx = d.torsoW * 0.22;
    p.joints = [
      Constraint.create({ bodyA: torso, pointA: { x: 0, y: -d.torsoH / 2 - d.headS * 0.42 }, bodyB: head,
        pointB: { x: 0, y: 0 }, length: 0, stiffness: 0.7, damping: 0.05 }),
      ...legs.map((leg, i) => Constraint.create({ bodyA: torso, pointA: { x: (i ? hx : -hx), y: d.torsoH / 2 - 6 },
        bodyB: leg, pointB: { x: 0, y: -d.legL / 2 + 4 }, length: 0, stiffness: 1 })),
      Constraint.create({ bodyA: torso, pointA: { x: 0, y: -d.torsoH / 2 + 10 }, bodyB: arm,
        pointB: { x: 0, y: -d.armL / 2 + 5 }, length: 0, stiffness: 1 }),
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
      box(CX, FLOOR_Y + 200, 4000, 400, 'floor', { friction: 1 }),
      box(L - 100, 0, 200, 3000, 'wall'),
      box(R + 100, 0, 200, 3000, 'wall'),
      box(CX, -950, 4000, 200, 'wall'),
    ];
    const span = Math.max(T.rim_span_min, S.ballR * 2 * T.rim_ball_ratio);
    const rimY = FLOOR_Y - T.rim_height * S.hoop;
    for (const side of [-1, 1]) {
      const boardX = side < 0 ? L + T.board_inset : R - T.board_inset;
      const inward = -side;
      const backX = boardX + inward * 5, frontX = backX + inward * span;
      const boardTop = rimY - T.board_height * 0.82, boardBot = rimY + T.board_height * 0.18;
      const board = box(boardX, (boardTop + boardBot) / 2, 10, boardBot - boardTop, 'board', { restitution: 0.4, friction: 0.3 });
      const rim = tag(Bodies.circle(frontX, rimY, 5, { isStatic: true, restitution: 0.5, friction: 0.1,
        collisionFilter: staticFilter }), 'rim');
      // team 0 (left, Tangerines) attacks the right hoop; team 1 attacks the left one
      const hoop = { side, boardX, rimY, backX, frontX, span, boardTop, boardBot,
        x1: Math.min(backX, frontX), x2: Math.max(backX, frontX),
        cx: (backX + frontX) / 2, team: side > 0 ? 0 : 1, wobble: 0, sway: 0 };
      board.plugin.hoop = hoop; rim.plugin.hoop = hoop;
      w.hoops.push(hoop);
      statics.push(board, rim);
    }

    // a squircle ball: it rolls with a slight lumpy wobble
    w.ball = tag(Bodies.fromVertices(CX, FLOOR_Y - T.drop_height, [squircle(S.ballR)], { restitution: S.bounce,
      friction: 0.05, frictionStatic: 0.1, frictionAir: T.ball_air,
      collisionFilter: { group: 0, category: CAT.BALL, mask: CAT.STATIC | CAT.TEAM0 | CAT.TEAM1 } }), 'ball');
    w.ball.r = S.ballR;
    Body.setMass(w.ball, T.ball_mass);
    w.ball.shot = null;

    const k = S.courtW / 1160;
    for (const team of [0, 1]) for (const idx of [0, 1]) {
      const off = (idx === 0 ? 330 : 150) * k;
      w.players.push(makePlayer(CX + (team === 0 ? -off : off), team, idx, S, S.looks[team][idx], T));
    }
    w.dynamic = [w.ball, ...w.players.flatMap(p => p.parts)];
    Composite.add(engine.world, [...statics, w.ball, ...w.players.flatMap(p => [...p.parts, ...p.joints])]);
    dropBall(w, T);

    const touchPair = (a, b) => {
      for (const [x, y] of [[a, b], [b, a]]) {
        const pl = x.plugin && x.plugin.player;
        if (!pl || y.plugin.kind === 'ball' || y.plugin.player === pl) continue;
        if (x.plugin.kind === 'leg') { pl.touch = true; if (y.plugin.kind === 'floor') pl.foot = true; }
        else if (x.plugin.kind === 'torso' || x.plugin.kind === 'head') pl.touch = true;
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
    Body.setAngle(w.ball, 0);
    w.ball.shot = null;
    w.ball._px = undefined;
  }

  function gravityPx(w) { return w.engine.gravity.y * w.engine.gravity.scale * DELTA * DELTA; }
  /** The tip of a player's arm, where the hand is. */
  function handPos(p) {
    const a = p.arm.angle, h = p.dims.armL / 2;
    return { x: p.arm.position.x - Math.sin(a) * h, y: p.arm.position.y + Math.cos(a) * h };
  }
  /**
   * Share of the ball inside a player's hand box: a square of side T.hand_box centred on the hand
   * and turned with the arm. Sampled on a 7x7 grid over the ball's disc.
   */
  function shareInHandBox(p, ball, T) {
    const hp = handPos(p), a = p.arm.angle, c = Math.cos(-a), s = Math.sin(-a), r = ball.r, half = T.hand_box / 2;
    let inside = 0, total = 0;
    for (let i = -3; i <= 3; i++) for (let j = -3; j <= 3; j++) {
      const ox = (i / 3) * r, oy = (j / 3) * r;
      if (ox * ox + oy * oy > r * r) continue;
      total++;
      const dx = ball.position.x + ox - hp.x, dy = ball.position.y + oy - hp.y;
      const lx = dx * c - dy * s, ly = dx * s + dy * c;
      if (Math.abs(lx) <= half && Math.abs(ly) <= half) inside++;
    }
    return inside / total;
  }
  function attackedHoop(w, p) { return w.hoops.find(h => h.team === p.team); }
  const carrier = w => (w.hold ? w.hold.p : null);

  /** Steer one ragdoll: planted rocking, floppy legs, getting up, arm motor, and the jump. */
  function drive(w, p, held, T, dt) {
    const S = w.S, g = gravityPx(w), grounded = p.sinceGround <= T.coyote_time;
    const planted = p.sinceFoot <= T.coyote_time;
    const h = w.hold && w.hold.p === p ? w.hold : null;
    p.cd -= dt; p.grabCD -= dt; p.sinceJump += dt;
    const torso = p.torso, a = wrap(torso.angle);

    // Feet on the floor: a strong upright spring around a target that rocks forwards and
    // backwards. The rock is the steering: jump as it tips forward to go forward.
    const rock = planted ? Math.sin(w.time * T.rock_rate * Math.PI * 2 + p.idx * 1.9 + p.team * 0.7) * T.rock_angle : 0;
    const k = planted ? T.upright_planted : grounded ? T.upright : T.upright * T.upright_air;
    let omega = torso.angularVelocity * 60;
    omega += (-wrap(a - rock) * k - omega * T.upright_damp) * dt;
    Body.setAngularVelocity(torso, omega / 60);
    const tav = torso.angularVelocity;

    // Down on the floor for a while: spring back up.
    p.downT = Math.abs(a) > 1.1 && p.sinceGround < 0.2 ? p.downT + dt : 0;
    if (p.downT > T.getup_time) {
      for (const part of p.parts) Body.setVelocity(part, { x: part.velocity.x * 0.3, y: -T.getup_pop });
      Body.setAngularVelocity(torso, -a * 0.09);
      p.downT = 0;
    }

    p.legs.forEach((leg, i) => {
      const rest = (i ? 1 : -1) * 0.1;
      const rel = wrap(leg.angle - torso.angle - rest);
      Body.setAngularVelocity(leg, lerp(leg.angularVelocity, tav - rel * T.leg_stiffness, T.leg_follow));
      if (planted && p.sinceJump > 0.15) Body.setVelocity(leg, { x: leg.velocity.x * (1 - T.foot_grip), y: leg.velocity.y });
    });

    // Arm: cocked back behind the head while charging a shot, raised while the key is held,
    // hanging otherwise. Letting go slaps it down through the front.
    const cocking = h && h.armed && held;
    const target = cocking ? -p.dir * T.arm_cock_angle : held ? -p.dir * T.arm_up_angle : p.dir * 0.15;
    const rel = wrap(p.arm.angle - torso.angle);
    const err = wrap(target - rel);
    const want = tav + clamp(err * T.arm_gain, -T.arm_max_speed, T.arm_max_speed);
    Body.setAngularVelocity(p.arm, lerp(p.arm.angularVelocity, want, 0.55));

    // Jump: a tap is a short hop; keeping the key down lifts it to full height. Holding keeps
    // hopping on landing, except for a ball carrier, who is busy with the ball.
    const vFull = Math.sqrt(2 * g * T.jump_height * S.jump);
    const fresh = held && !p.prevHeld;
    if (held && grounded && p.cd <= 0 && (!h || fresh)) {
      const v = vFull * T.jump_tap_frac * (1 + (w.rng() * 2 - 1) * T.jump_jitter);
      const m = T.jump_tilt_mix;
      let jx = Math.sin(a) * m, jy = -(1 - m) - Math.cos(a) * m;
      if (jy > -0.35) jy = -0.35;            // even upside down, a jump goes up a little
      const n = Math.hypot(jx, jy); jx /= n; jy /= n;
      const c = carrier(w);
      const goalX = c && c.team === p.team ? attackedHoop(w, p).cx : w.ball.position.x;
      const chase = clamp((goalX - torso.position.x) / 200, -1, 1) * T.jump_chase;
      const vx = jx * v + p.dir * T.jump_forward + chase, vy = jy * v;
      for (const part of p.parts) {
        Body.setVelocity(part, { x: part.velocity.x * 0.25 + vx, y: Math.min(part.velocity.y, 0) * 0.25 + vy });
      }
      Body.setAngularVelocity(torso, torso.angularVelocity + p.dir * T.jump_spin);
      p.cd = T.jump_cooldown; p.sinceJump = 0; p.sinceGround = 99; p.sinceFoot = 99; p.boosting = true;
      w.onEvent({ type: 'jump', team: p.team });
    } else if (p.boosting && held && p.sinceJump < T.jump_hold_time && torso.velocity.y < 0) {
      const add = vFull * (1 - T.jump_tap_frac) / (T.jump_hold_time * 60);
      for (const part of p.parts) Body.setVelocity(part, { x: part.velocity.x, y: part.velocity.y - add });
    } else if (!held) p.boosting = false;
    p.prevHeld = held;
  }

  /** Players crowding one spot are eased apart, so they never melt into one blob. */
  function spread(w, T) {
    const ps = w.players;
    for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) {
      const a = ps[i].torso, b = ps[j].torso, dx = b.position.x - a.position.x;
      if (Math.abs(dx) > T.spread_distance) continue;
      const push = (1 - Math.abs(dx) / T.spread_distance) * T.spread_push * (dx >= 0 ? 1 : -1);
      for (const part of ps[i].parts) Body.setVelocity(part, { x: part.velocity.x - push, y: part.velocity.y });
      for (const part of ps[j].parts) Body.setVelocity(part, { x: part.velocity.x + push, y: part.velocity.y });
    }
  }

  // ---- Possession: catch, cock back and fire, fadeaway, dunk, steal, block -----------------
  /** The ball jumps into the player's hand. A catch made with the key down must be let go of
   *  before the shot can be cocked: `armed` turns true on the first release. */
  function grab(w, p, T, how, held) {
    const ball = w.ball, hand = handPos(p);
    if (w.hold) release(w, T, 0);
    Body.setPosition(ball, hand);
    Body.setVelocity(ball, { x: p.arm.velocity.x, y: p.arm.velocity.y });
    ball._px = undefined;
    ball.collisionFilter.group = p.group;           // the carrier's own body never knocks it out of the hand
    const con = Constraint.create({ bodyA: p.arm, pointA: { x: 0, y: p.dims.armL / 2 }, bodyB: ball,
      pointB: { x: 0, y: 0 }, length: 0, stiffness: 0.6, damping: 0.1 });
    Composite.add(w.engine.world, con);
    w.hold = { p, con, t: 0, charge: 0, armed: !held, cocking: false };
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

  /**
   * Fire the held ball. Cock-back time grows the forward speed a lot and the upward speed only a
   * little. A fadeaway (drifting or leaning away from the hoop in the air) lofts it higher with
   * more aim help.
   */
  function shoot(w, T) {
    const h = w.hold, p = h.p, ball = w.ball, hoop = attackedHoop(w, p);
    const airborne = p.sinceGround > 0.1, a = wrap(p.torso.angle);
    const fade = airborne && (p.torso.velocity.x * p.dir < -T.fade_speed || a * p.dir < -T.fade_lean);
    let vx = lerp(T.shot_vx_min, T.shot_vx_max, h.charge) * (fade ? T.fade_vx_mul : 1);
    const vy = lerp(T.shot_vy_min, T.shot_vy_max, h.charge) + (fade ? T.fade_vy_bonus : 0);
    // aim help: nudge the forward speed toward one that drops the ball on the rim
    const g = gravityPx(w), X = (hoop.cx - ball.position.x) * p.dir, Y = ball.position.y - (hoop.rimY - 8);
    const disc = vy * vy - 2 * g * Y;
    if (X > 30 && disc > 0) vx = lerp(vx, X / ((vy + Math.sqrt(disc)) / g), fade ? T.fade_assist : T.shot_assist);
    // the body's lean turns the throw with it: tipped forward flattens it, leaning back lofts it
    const tilt = a * T.shot_tilt, ct = Math.cos(tilt), st = Math.sin(tilt);
    const x0 = vx * p.dir, y0 = -vy;
    release(w, T, 0.2);
    Body.setVelocity(ball, { x: x0 * ct - y0 * st + p.torso.velocity.x * 0.25, y: x0 * st + y0 * ct });
    Body.setAngularVelocity(ball, -p.dir * 0.2);
    ball.shot = { team: p.team, t: w.time, kind: fade ? 'fade' : 'shot', dir: p.dir };
    w.onEvent({ type: fade ? 'fadeaway' : 'shoot', team: p.team, charge: h.charge });
  }

  /** Slam it: the ball is pushed down through the rim from above. */
  function dunk(w, T, hoop) {
    const p = w.hold.p, ball = w.ball;
    release(w, T, 0.3);
    Body.setPosition(ball, { x: hoop.cx, y: hoop.rimY - ball.r - 2 });
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
    const canCatch = p => p.grabCD <= 0 && w.time >= w.ignoreUntil;

    // body hits on the ball
    for (const kk of w.kicks) {
      const pl = kk.part.plugin.player, kind = kk.part.plugin.kind;
      if (w.hold) {
        if (pl.team === w.hold.p.team || w.hold.t < T.steal_guard) continue;
        if (kind === 'torso' || kind === 'arm') { grab(w, pl, T, 'steal', held[pl.team]); return; }
        if (kk.rel > T.strip_speed) {
          release(w, T, 0.1);   // knocked loose, toward the hoop the hitter attacks
          Body.setVelocity(ball, { x: ball.velocity.x + pl.dir * 5, y: ball.velocity.y - 5 });
          w.onEvent({ type: 'strip', team: pl.team });
        }
        continue;
      }
      const shot = ball.shot;
      if (shot && shot.kind !== 'dunk' && shot.team !== pl.team && w.time - shot.t < T.block_window && kind !== 'leg') {
        // a fresh shot hit by a defender: swatted back the way it came
        Body.setVelocity(ball, { x: -shot.dir * T.block_pop, y: -T.block_pop * 0.55 });
        ball.shot = null;
        w.onEvent({ type: 'block', team: pl.team });
        continue;
      }
      // the ball meets an abdomen: caught, straight into the hand (feet never catch)
      if (kind === 'torso' && canCatch(pl)) { grab(w, pl, T, 'grab', held[pl.team]); return; }
      const dx = ball.position.x - kk.part.position.x, dy = ball.position.y - kk.part.position.y;
      const n = Math.hypot(dx, dy) || 1;
      const boost = T.ball_kick * clamp(kk.rel / 10, 0.3, 1.3);
      const low = ball.position.y > w.floorY - ball.r * 3 ? 1.5 : 1; // a ball near the floor pops up harder
      Body.setVelocity(ball, { x: ball.velocity.x + dx / n * boost, y: ball.velocity.y + dy / n * boost - boost * T.ball_lift * low });
      Body.setAngularVelocity(ball, ball.angularVelocity + (w.rng() - 0.5) * T.ball_spin);
      if (shot && shot.team !== pl.team) ball.shot = null;
    }

    if (w.hold) {
      const h = w.hold, p = h.p, k = held[p.team];
      h.t += dt;
      // fire sequence: (let go once after a catch made with the key down) → hold to cock back → let go to fire
      if (!h.armed) { if (!k) h.armed = true; }
      else if (k) { h.cocking = true; h.charge = Math.min(1, h.charge + dt / T.shot_charge_time); }
      const hoop = attackedHoop(w, p), r = ball.r;
      const near = Math.abs(ball.position.x - hoop.cx) < hoop.span / 2 + r + T.dunk_reach
        && ball.position.y < hoop.rimY + T.dunk_below && ball.position.y > hoop.rimY - T.dunk_height;
      if (p.sinceGround > 0.1 && near) { dunk(w, T, hoop); return; }
      if ((h.cocking && !k) || h.t > T.hold_max) { shoot(w, T); return; }
      for (const q of w.players) { // a defender's hand box over the held ball: stolen
        if (q.team === p.team || h.t < T.steal_guard || !canCatch(q)) continue;
        if (shareInHandBox(q, ball, T) > 0.5) { grab(w, q, T, 'steal', held[q.team]); return; }
      }
      return;
    }
    // a free ball: more than half of it inside someone's hand box snaps it to that hand
    for (const p of w.players) {
      if (canCatch(p) && shareInHandBox(p, ball, T) > 0.5) { grab(w, p, T, 'grab', held[p.team]); break; }
    }
  }

  function capSpeed(b, max) {
    const s = Math.hypot(b.velocity.x, b.velocity.y);
    if (s > max) Body.setVelocity(b, { x: b.velocity.x * max / s, y: b.velocity.y * max / s });
  }

  /**
   * Advance the world one physics step.
   * @param {object} w world from createWorld
   * @param {boolean[]} held [team 0 key held, team 1 key held]
   * @param {object} T live tuning values
   * @param {number} dt step length in seconds of game time
   */
  function step(w, held, T, dt) {
    w.time += dt;
    for (const b of w.dynamic) { b._px = b.position.x; b._py = b.position.y; b._pa = b.angle; }
    for (const p of w.players) drive(w, p, held[p.team], T, dt);
    spread(w, T);
    w.kicks.length = 0;
    Engine.update(w.engine, DELTA);
    for (const p of w.players) {
      p.sinceGround = p.touch ? 0 : p.sinceGround + dt; p.touch = false;
      p.sinceFoot = p.foot ? 0 : p.sinceFoot + dt; p.foot = false;
    }

    possession(w, held, T, dt);
    const ball = w.ball;
    capSpeed(ball, T.ball_max_speed);
    for (const p of w.players) for (const part of p.parts) capSpeed(part, 30);

    for (const h of w.hoops) {   // the net drags a free ball passing through it: the swish
      if (!w.hold && ball.position.x > h.x1 && ball.position.x < h.x2 && ball.position.y > h.rimY && ball.position.y < h.rimY + 46) {
        Body.setVelocity(ball, { x: ball.velocity.x * 0.86, y: ball.velocity.y * 0.96 });
        h.sway = Math.min(1.5, h.sway + 0.12);
      }
      h.wobble *= 0.93; h.sway *= 0.95;
    }
  }

  return { FLOOR_Y, CX, DELTA, createWorld, step, dropBall, handPos, squircle };
})();
