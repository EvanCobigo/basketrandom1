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
  const CONTACT = 5.2;       // px beyond the ball's radius at which its centre first touches the rim ring or the board (measured)
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

  /**
   * Points of a superellipse of half-size r: exponent e = 2 is a circle, 4 a squircle. Used for
   * the ball's body and for drawing the ball and heads.
   */
  function squircle(r, n = 28, e = 4) {
    const pts = [], k = 2 / e;
    for (let i = 0; i < n; i++) {
      const t = (i / n) * Math.PI * 2, c = Math.cos(t), s = Math.sin(t);
      pts.push({ x: r * Math.sign(c) * Math.abs(c) ** k, y: r * Math.sign(s) * Math.abs(s) ** k });
    }
    return pts;
  }

  /** One slim ragdoll: torso, squircle head, two legs and one long arm, pinned together. */
  function makePlayer(x, team, idx, S, look, T) {
    const dir = team === 0 ? 1 : -1;
    const d = {
      torsoW: T.body_width, torsoH: T.torso_length * S.torso, headR: T.head_size * S.head,
      legL: T.leg_length * S.leg, legW: T.limb_width, armL: T.arm_length * S.arm, armW: T.arm_width,
    };
    d.headS = d.headR * 1.8;   // squircle head, side length
    d.headW = d.headS + T.pixel_size * T.head_extra_px;   // a little wider than tall, in whole art pixels
    d.hipX = d.torsoW * 0.22 - T.pixel_size * T.leg_closer_px / 2;   // legs pulled together by whole art pixels
    const hipY = FLOOR_Y - d.legL + 3;
    const torsoY = hipY - d.torsoH / 2 + 6;
    const torsoTop = torsoY - d.torsoH / 2;
    const headY = torsoTop - d.headS * 0.42;
    const shoulderY = torsoTop + 10;
    const group = Body.nextGroup(true); // a player's own parts never collide with each other
    const filt = { group, category: TEAM_CAT[team], mask: CAT.STATIC | CAT.BALL | TEAM_CAT[1 - team] };
    const torso = Bodies.rectangle(x, torsoY, d.torsoW, d.torsoH, { chamfer: { radius: d.torsoW * 0.3 },
      density: 0.0036, friction: 0.5, frictionAir: 0.012, restitution: 0.1, collisionFilter: filt });
    const head = Bodies.rectangle(x, headY, d.headW, d.headS, { chamfer: { radius: d.headS * 0.12 },
      density: 0.0011, friction: 0.3, frictionAir: 0.01, restitution: 0.3, collisionFilter: filt });
    const legs = [-1, 1].map(s => Bodies.rectangle(x + s * d.hipX, hipY + d.legL / 2 - 4, d.legW, d.legL, {
      chamfer: { radius: 3 }, density: 0.003, friction: 1.4, frictionStatic: 2, frictionAir: 0.012, restitution: 0, collisionFilter: filt }));
    const arm = Bodies.rectangle(x, shoulderY + d.armL / 2 - 5, d.armW, d.armL, { chamfer: { radius: 3 },
      density: 0.0024, friction: 0.4, frictionAir: 0.01, restitution: 0.2, collisionFilter: filt });

    const p = { team, idx, dir, torso, head, legs, arm, dims: d, look, group,
      parts: [torso, head, legs[0], legs[1], arm],
      touch: false, foot: false, sinceGround: 0, sinceFoot: 0, sinceJump: 9, cd: 0, grabCD: 0, downT: 0,
      prevHeld: false, boosting: false, dribbleT: 0, followT: 0, back: 0, slamRel: null, windSpin: null };
    tag(torso, 'torso', p); tag(head, 'head', p); legs.forEach(l => tag(l, 'leg', p)); tag(arm, 'arm', p);

    const hx = d.hipX;
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
    const rawEvent = onEvent;
    onEvent = ev => { if (ev.x === undefined && wRef.ball) { ev.x = wRef.ball.position.x; ev.y = wRef.ball.position.y; } rawEvent(ev); };
    const wRef = {};
    const engine = Engine.create({ enableSleeping: false });
    engine.gravity.y = T.gravity * S.grav;
    engine.positionIterations = 10; engine.velocityIterations = 8; engine.constraintIterations = 4;
    const half = S.courtW / 2, L = CX - half, R = CX + half;
    const w = Object.assign(wRef, { engine, S, L, R, cx: CX, floorY: FLOOR_Y, players: [], hoops: [], kicks: [], rng, onEvent,
      time: 0, hold: null, ignoreUntil: 0, trail: null, dunk: null, dribbleBall: null, passGuard: null, prevB: [false, false], bheld: [false, false], hustle: [false, false] });

    const statics = [
      box(CX, FLOOR_Y + 200, 4000, 400, 'floor', { friction: 1 }),
      box(L - 100, 0, 200, 3000, 'wall'),
      box(R + 100, 0, 200, 3000, 'wall'),
      box(CX, -950, 4000, 200, 'wall'),
    ];
    // The floor's own bounce. Matter zeroes a static body's restitution when it is made, so it is
    // set here, after. A pair bounces by the livelier of its two, so this lifts only floor
    // bounces; the rim and backboard (left at zero) still bounce the ball by its own value.
    statics[0].restitution = T.floor_bounce;
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
    w.ball = tag(Bodies.fromVertices(CX, FLOOR_Y - T.drop_height, [squircle(S.ballR, 28, T.ball_shape)], { restitution: S.bounce,
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
        if (other.plugin.player) {
          w.kicks.push({ part: other, rel });
          // a hand, head or body on a shot in flight (not the shooter's own, which the release ignores): it no longer follows its line
          if (ball.shot && ball.shot.kind !== 'dunk' && !w.hold && other.plugin.player !== w.ignoreP) { ball.shot.deflected = true; ball.shot.perfect = false; if (w.trail && w.trail.shot === ball.shot && w.trail.mode === 'rainbow') w.trail.mode = 'white'; }
        }
        else if (other.plugin.kind === 'floor') ball.shot = null; // a shot that lands is no longer a shot
        else if (ball.shot && (other.plugin.kind === 'rim' || other.plugin.kind === 'board') && ball.position.y < other.plugin.hoop.rimY) {
          // touched before it was through the rim plane: remember how hard (the trail colour is settled if it scores)
          ball.shot.clean = false;
          ball.shot.hardest = Math.max(ball.shot.hardest || 0, rel);
          if (w.trail && w.trail.shot === ball.shot && (w.trail.mode === 'blue' || w.trail.mode === 'rainbow') && rel > T.soft_touch) { w.trail.mode = 'white'; ball.shot.perfect = false; }   // a hard knock ends the perfect line
        }
        onEvent({ type: 'hit', on: other.plugin.player ? 'player' : other.plugin.kind, speed: rel, x: ball.position.x, y: ball.position.y,
          team: other.plugin.player ? other.plugin.player.team : -1, hoop: other.plugin.hoop || null });
      }
    });
    Events.on(engine, 'collisionActive', e => { for (const pr of e.pairs) touchPair(pr.bodyA, pr.bodyB); });
    return w;
  }

  /** Put the ball back above centre court with a small random drift. */
  function dropBall(w, T) {
    if (w.hold) release(w, T, 0);
    if (w.dunk) endDunk(w);
    w.dribbleBall = null;
    w.ball.collisionFilter.mask = 0x1 | 0x2 | 0x4; w.ghostUntil = 0;
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
   * Sitting: the bottom edge of the torso (where the hips are) within T.seat_margin of the floor. A seated
   * player cannot dribble (a pass still goes).
   */
  function seated(w, p, T) {
    const t = p.torso, hh = p.dims.torsoH / 2;
    return t.position.y + Math.cos(t.angle) * hh >= w.floorY - T.seat_margin - p.dims.torsoW * 0.5 * Math.abs(Math.sin(t.angle));
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
  /** Whether the ball overlaps a player's torso box, grown by T.belly_margin. */
  function touchesAbdomen(p, ball, T) {
    const t = p.torso, a = -t.angle, dx = ball.position.x - t.position.x, dy = ball.position.y - t.position.y;
    const lx = dx * Math.cos(a) - dy * Math.sin(a), ly = dx * Math.sin(a) + dy * Math.cos(a);
    const hw = p.dims.torsoW / 2 + T.belly_margin, hh = p.dims.torsoH / 2 + T.belly_margin;
    const qx = Math.max(-hw, Math.min(hw, lx)), qy = Math.max(-hh, Math.min(hh, ly));
    return (lx - qx) ** 2 + (ly - qy) ** 2 <= ball.r * ball.r;
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

    // Feet on the floor: the whole body swings about its feet, evenly forwards and backwards at
    // a steady beat that never fades. The swing is the steering: hop as it tips one way to go that way.
    const base = w.time * T.rock_rate * Math.PI * 2 + p.idx * 1.9 + p.team * 0.7;
    // A HARD RULE: a hand on the floor always pushes off it. Every step the hand touches, unless the body is already
    // turning away fast enough, the wobble is turned round the other way (p.rockOff shifts the swing's beat), so a body
    // can never rest propped on its hand at an angle waiting for a jump
    const awaySpeed = -Math.sign(a || 1) * torso.angularVelocity;
    if (handPos(p).y >= w.floorY - T.hand_floor_px && awaySpeed < T.hand_push * 0.5) {
      const amp = Math.max(0.05, T.rock_angle * (p.dribRock ?? 1)), sn = Math.asin(clamp(a / amp, -1, 1));
      p.rockOff = wrap((a > 0 ? Math.PI - sn : sn) - base);                  // the beat where the swing is here, heading back
      Body.setAngularVelocity(torso, -Math.sign(a || 1) * T.hand_push);    // and the push itself, swinging or not
      if (Math.abs(a) > 1.3) Body.setVelocity(torso, { x: torso.velocity.x, y: Math.min(torso.velocity.y, -1) });   // lying flat: lift a little so it can turn off the floor
      w.onEvent({ type: 'handpush', team: p.team });
    }
    const phase = base + (p.rockOff || 0);
    const dribbling = p.dribbleT > 0;
    if (dribbling) p.dribbleT -= dt;
    // the swing only takes over once the body is fairly upright: a player who lands tilted is
    // righted gently by the upright spring first, never snapped round in one step
    const swinging = planted && p.sinceJump > 0.2 && Math.abs(a) < T.rock_engage;   // dribbling too: the swing steers it
    if (swinging) {
      // the dribble wobble: while a dribble chain is on, the swing grows or shrinks by T.dribble_rock (eased, so it never snaps)
      const chain = dribbling || w.time - (p.lastDribble ?? -9) < T.dribble_chain_time;
      p.dribRock = (p.dribRock ?? 1) + ((chain ? T.dribble_rock : 1) - (p.dribRock ?? 1)) * 0.12;
      const next = Math.sin(phase + T.rock_rate * Math.PI * 2 * dt) * T.rock_angle * p.dribRock;   // where the swing should be next step
      const om = clamp(lerp(torso.angularVelocity, wrap(next - a), T.rock_follow), -T.rock_max_turn, T.rock_max_turn); // rad/step, never faster than the swing itself
      const piv = p.legs.reduce((q, l) => {
        const c = Math.cos(l.angle), sn = Math.sin(l.angle), hl = p.dims.legL / 2;
        return { x: q.x + (l.position.x - sn * hl) / 2, y: q.y + (l.position.y + c * hl) / 2 };
      }, { x: 0, y: 0 });
      const slide = dribbling ? (p.dribbleSteer || 0) * T.dribble_slide : 0;   // a dribble carries the whole swinging body along
      for (const part of [torso, p.head, ...p.legs]) {
        Body.setVelocity(part, { x: clamp(-om * (part.position.y - piv.y), -T.rock_max_speed, T.rock_max_speed) + slide, y: clamp(om * (part.position.x - piv.x), -T.rock_max_speed, T.rock_max_speed) });
        Body.setAngularVelocity(part, om);
      }
    } else {
      const k = grounded || p.slam ? T.upright : T.upright * T.upright_air;   // (a dunker stays upright in the air)
      // dribbling off the ground: sloppy taps make the body sway
      const lean = dribbling ? Math.sin(w.time * 9 + p.idx) * T.dribble_sway * Math.min(p.sloppy || 0, 8) * 0.05 : 0;
      let omega = torso.angularVelocity * 60;
      omega += (-wrap(a - lean) * k - omega * T.upright_damp) * dt;
      Body.setAngularVelocity(torso, omega / 60);
    }
    const tav = torso.angularVelocity;

    // Down on the floor for a while: spring back up.
    p.downT = Math.abs(a) > 1.1 && p.sinceGround < 0.2 ? p.downT + dt : 0;
    if (p.downT > T.getup_time) {
      for (const part of p.parts) Body.setVelocity(part, { x: part.velocity.x * 0.3, y: -T.getup_pop });
      Body.setAngularVelocity(torso, -a * 0.09);
      p.downT = 0;
    }

    if (!swinging) p.legs.forEach((leg, i) => {
      const rest = (i ? 1 : -1) * 0.1;
      const rel = wrap(leg.angle - torso.angle - rest), fold = T.fold_stiffness;   // the hip: fold_stiffness above 1 folds less and springs back less
      Body.setAngularVelocity(leg, lerp(leg.angularVelocity, tav - rel * T.leg_stiffness * fold, Math.min(1, T.leg_follow * fold)));
    });

    // Arm: cocked back behind the head while charging a shot, raised while the key is held,
    // hanging otherwise. Letting go slaps it down through the front.
    const cocking = h && h.armed && held;
    const winding = h && h.barmed && h.bouncing;
    if (p.followT > 0) p.followT -= dt;
    const following = p.followT > 0, slamming = p.slamRel != null;
    // a defender near a dunk puts the arm straight up: a hand in the way of the ball
    const contest = w.dunk && !w.dunk.slammed && w.dunk.p.team !== p.team && Math.abs(torso.position.x - w.dunk.hoop.cx) < T.contest_range;
    // dunking: the arm tracks the ball; after a shot: it trails forward in the follow-through
    const target = contest ? wrap(Math.PI - torso.angle) : slamming ? p.slamRel : following ? -p.dir * T.follow_angle : cocking ? -p.dir * T.arm_cock_angle
      : winding ? -p.dir * 1.3 : held ? -p.dir * T.arm_up_angle : p.dir * 0.15 - a * T.arm_hang;   // idle: hangs toward straight down, so it sways little
    const rel = wrap(p.arm.angle - torso.angle);
    const err = wrap(target - rel);
    const fast = slamming || contest, amax = contest ? 0.9 : slamming ? T.dunk_arm_speed : T.arm_max_speed;
    const want = tav + clamp(err * (fast ? 0.6 : T.arm_gain), -amax, amax);
    if (p.windSpin != null) Body.setAngularVelocity(p.arm, tav + p.windSpin);   // a windmill: the arm is turned, at full length, all the way round
    else Body.setAngularVelocity(p.arm, lerp(p.arm.angularVelocity, want, fast ? 0.9 : 0.55));
    // The back arm is drawn only (no body): its angle from the torso eases toward a pose. It
    // guides the ball up while cocking, then stays extended behind, lagging, through the release.
    // (a real jump shot moves the off arm very little: it lifts a bit as a guide and settles back)
    const backTarget = slamming ? rel * 0.4 : cocking || following ? -p.dir * T.back_arm_guide : -a * T.arm_hang;
    p.back = lerp(p.back || 0, backTarget, cocking || following || slamming ? 0.12 : 0.4);   // idle: keeps up with the body, so it hangs still

    // Jump: a tap is a short hop; keeping the key down lifts it to full height. Holding keeps
    // hopping on landing, except for a ball carrier, who is busy with the ball.
    if (dribbling && grounded && !held) {   // sliding along the floor with the dribble, the way the body leans
      for (const part of p.parts) Body.setVelocity(part, { x: lerp(part.velocity.x, (p.dribbleSteer || 0) * T.dribble_slide, 0.25), y: part.velocity.y });
    }
    const vFull = Math.sqrt(2 * g * T.jump_height * S.jump * (w.hustle && w.hustle[p.team] ? T.hustle_jump : 1));
    const fresh = held && !p.prevHeld;
    // (a press made while the dunk prompt is showing is the dunk's own take-off: no ordinary hop first)
    if (held && grounded && p.cd <= 0 && (!h || fresh) && !p.slam && !(h && h.wasReady && fresh)) {
      const v = vFull * T.jump_tap_frac * (1 + (w.rng() * 2 - 1) * T.jump_jitter);
      const m = T.jump_tilt_mix;
      const ja = clamp(a, -T.rock_angle, T.rock_angle);   // a tumbling body steers no harder than a full swing
      let jx = Math.sin(ja) * m, jy = -(1 - m) - Math.cos(ja) * m;
      if (jy > -0.35) jy = -0.35;            // even upside down, a jump goes up a little
      const n = Math.hypot(jx, jy); jx /= n; jy /= n;
      const c = carrier(w);
      const goalX = c && c.team === p.team ? attackedHoop(w, p).cx : w.ball.position.x;
      const chase = clamp((goalX - torso.position.x) / 200, -1, 1) * T.jump_chase;
      // the swing steers the hop: lean one way and the hop carries you that way, up to hop_reach
      const vx = jx * v + Math.sin(ja) / Math.sin(T.rock_angle) * T.hop_reach + p.dir * T.jump_forward + chase, vy = jy * v;
      for (const part of p.parts) {
        Body.setVelocity(part, { x: part.velocity.x * 0.25 + vx, y: Math.min(part.velocity.y, 0) * 0.25 + vy });
      }
      Body.setAngularVelocity(torso, torso.angularVelocity + p.dir * T.jump_spin);
      p.cd = T.jump_cooldown; p.sinceJump = 0; p.sinceGround = 99; p.sinceFoot = 99; p.boosting = true;
      w.onEvent({ type: 'jump', team: p.team, x: p.torso.position.x, y: w.floorY });
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
    const bheldNow = !!(w.bheld && w.bheld[p.team]);
    const ball = w.ball;
    if (w.hold) release(w, T, 0);
    const pr = p.dims.armL / 2 + ball.r * T.palm_offset;
    Body.setPosition(ball, { x: p.arm.position.x - Math.sin(p.arm.angle) * pr, y: p.arm.position.y + Math.cos(p.arm.angle) * pr });
    Body.setVelocity(ball, { x: p.arm.velocity.x, y: p.arm.velocity.y });
    ball._px = undefined;
    ball.collisionFilter.group = p.group;           // the carrier's own body never knocks it out of the hand
    // the hold point is given in world orientation, so it is turned to the arm's angle right now:
    // the ball sits in the palm, just past the hand, wherever the arm points at the catch
    const reach = p.dims.armL / 2 + ball.r * T.palm_offset, aa = p.arm.angle;
    const con = Constraint.create({ bodyA: p.arm, pointA: { x: -Math.sin(aa) * reach, y: Math.cos(aa) * reach }, bodyB: ball,
      pointB: { x: 0, y: 0 }, length: 0, stiffness: 0.6, damping: 0.1 });
    Composite.add(w.engine.world, con);
    if (w.dribbleBall) { w.dribbleBall = null; ball.collisionFilter.mask = 0x1 | 0x2 | 0x4; }
    const fromPass = !!(w.pass && w.pass.team === p.team && w.pass.from !== p && w.time < w.pass.until);   // caught off a teammate's pass
    const ownDribble = how === 'dribble' || (w.lastBouncer === p && p.dribbleT > 0);
    w.lastBouncer = null; w.passGuard = null; w.pass = null;
    if (!ownDribble) for (const q of w.players) { q.dribbleT = 0; q.dribbleChain = 0; }
    w.hold = { p, con, fromPass, t: 0, prevK: held, charge: 0, armed: !held, cocking: false, bcharge: 0, barmed: !bheldNow || ownDribble, bouncing: false, dunkReady: false };
    ball.shot = null;
    w.onEvent({ type: how, team: p.team });
  }

  /** Let go of the ball. It ignores the old carrier's body for `ignoreFor` seconds. */
  function release(w, T, ignoreFor) {
    const h = w.hold;
    Composite.remove(w.engine.world, h.con);
    h.p.grabCD = T.regrab_delay;
    w.hold = null;
    w.ignoreUntil = w.time + ignoreFor; w.ignoreP = h.p;
    if (ignoreFor <= 0) w.ball.collisionFilter.group = 0;
  }

  /**
   * The ball's flight from (x, y) with velocity (vx, vy), stepped exactly as the engine steps it
   * (air drag on the velocity, then gravity, then the move) until it drops through rim height.
   * Returns the x where it crosses (or null if it never does), and whether on the way it came
   * within the ball's radius of the front rim or the backboard, beyond a slight graze.
   */
  function flightTo(w, T, hoop, x, y, vx, vy, plane) {
    const g = gravityPx(w), keep = 1 - w.ball.frictionAir, r = w.ball.r, py = plane === undefined ? hoop.rimY : plane;   // the height it is judged at: the rim, or a lob's target
    let touched = false;
    for (let i = 0; i < 400; i++) {
      vx *= keep; vy = vy * keep + g;
      const ny = y + vy, nx = x + vx;
      // measured against the real engine (a few hundred flown shots): the ball first touches the rim ring (radius 5) or the
      // board (half its 10 px thickness) when its centre is about r + 5 away, so that is the line, less any allowed graze
      if (Math.hypot(nx - hoop.frontX, ny - hoop.rimY) < r + CONTACT - T.perfect_graze) touched = true;   // front rim
      if (Math.abs(nx - hoop.boardX) < r + CONTACT - T.perfect_graze && ny > hoop.boardTop - r && ny < hoop.boardBot + r) touched = true;   // backboard
      if (nx > w.R - r || nx < w.L + r || ny < -400) touched = true;   // a side wall or the ceiling: the flight past it is not real
      if (vy > 0 && y < py && ny >= py) return { crossX: x + (nx - x) * (py - y) / (ny - y), touched, steps: i + 1 };
      x = nx; y = ny;
      if (y > w.floorY) break;
    }
    return { crossX: null, touched };
  }

  /**
   * The forward speed that makes a shot with upward speed `vy` from (x, y) cross the rim plane at
   * `target`: found by bisection on the exact flight, so drag and the shot's real height are
   * accounted for. `dir` is +1 for a hoop on the right. Returns null if no speed can do it.
   */
  function solveVx(w, T, hoop, x, y, vy, dir, target, plane) {
    const at = vx => { const f = flightTo(w, T, hoop, x, y, vx * dir, -vy, plane); return f.crossX === null ? null : (f.crossX - target) * dir; };
    let lo = 0, hi = 40, flo = at(lo), fhi = at(hi);
    if (fhi === null || fhi < 0) return null;                  // even the hardest throw falls short
    if (flo !== null && flo >= 0) return 0;                     // even a drop already carries past it
    for (let i = 0; i < 28; i++) {
      const mid = (lo + hi) / 2, f = at(mid);
      if (f === null || f > 0) hi = mid; else lo = mid;
    }
    return (lo + hi) / 2;
  }

  /**
   * The launch velocity a shot at `charge` (0..1) would get from `from` by player `p`: the throw
   * for that cock-back, with the aim help pulling the forward speed toward the exact solution.
   * Lean, drift and momentum change nothing: one arc for a given cock-back and spot.
   */
  function shotVelocity(w, T, p, charge, from, lob) {
    const hoop = attackedHoop(w, p);
    let vx = lerp(T.shot_vx_min, T.shot_vx_max, charge);
    const vy = lerp(T.shot_vy_min, T.shot_vy_max, charge);
    if (lob) {   // an alley-oop lob: thrown to touch the board above the rim, where the teammate waits to take it out of the air
      const sol = solveVx(w, T, hoop, from.x, from.y, vy, p.dir, lobTarget(w, T, p, hoop).x, hoop.rimY - T.lob_height);
      if (sol !== null) return { vx: sol, vy };
    }
    if (T.shot_assist > 0 && (hoop.cx - from.x) * p.dir > 30) {
      // a ball dropped on the exact centre clips the front rim on a shallow arc, so the help aims a little toward the board
      const sol = solveVx(w, T, hoop, from.x, from.y, vy, p.dir, hoop.cx + p.dir * T.aim_bias);
      if (sol !== null) vx = lerp(vx, sol, T.shot_assist);
    }
    return { vx, vy };
  }

  /**
   * The lob a cock-back would throw, from `lift` px higher than the ball is now (the jump): its forward speed and
   * how many steps it flies before it reaches the board's height; null when no speed gets it there.
   */
  function lobPlan(w, T, p, charge, lift = 0) {
    const hoop = attackedHoop(w, p), b = w.ball, vy = lerp(T.shot_vy_min, T.shot_vy_max, charge), y = b.position.y - lift;
    const tx = lobTarget(w, T, p, hoop).x, plane = hoop.rimY - T.lob_height;
    const vx = solveVx(w, T, hoop, b.position.x, y, vy, p.dir, tx, plane);
    if (vx === null) return null;
    const f = flightTo(w, T, hoop, b.position.x, y, vx * p.dir, -vy, plane);
    return { vx, steps: f.steps || 0 };
  }
  const lobPossible = (w, T, p, charge, lift = 0) => lobPlan(w, T, p, charge, lift) !== null;

  /** The angle the planted swing would have `secs` seconds from now (the swing is a steady beat, so it can be foreseen). */
  function swingAt(w, T, p, secs) {
    return Math.sin((w.time + secs) * T.rock_rate * Math.PI * 2 + p.idx * 1.9 + p.team * 0.7) * T.rock_angle;
  }

  /** Where an alley-oop lob is aimed: the ball just touching the board's face, T.lob_height above the rim. */
  function lobTarget(w, T, p, hoop) { return { x: hoop.backX - p.dir * (w.ball.r + 2), y: hoop.rimY - T.lob_height }; }

  /**
   * The teammate who takes an alley-oop lob: standing on the court side of the rim, and able to jump (a planned
   * jump, like a dunk's) so that his hand is at the ball where it touches the board. Returns the jump, or null.
   * `from` is the shooter (for his direction and hoop).
   */
  function lobReceiver(w, T, from) {
    const hoop = attackedHoop(w, from), dir = from.dir, q = w.players.find(o => o.team === from.team && o !== from);
    if (!q || (w.hold && w.hold.p === q) || w.dunk) return null;
    const gapQ = (hoop.cx - q.torso.position.x) * dir;
    if (gapQ < T.dunk_min_gap || gapQ > 260 || q.sinceGround > 0.15) return null;
    const tgt = lobTarget(w, T, from, hoop), r = w.ball.r, t = q.torso, g = gravityPx(w), keep = 1 - t.frictionAir;
    const L = q.dims.armL - 5 + r * T.palm_offset, sOff = -q.dims.torsoH / 2 + 10, dx = T.dunk_arm_dx * L;
    const dy = Math.sqrt(Math.max(1, (T.dunk_arm_ext * L) ** 2 - dx * dx));
    const apexX = tgt.x - dir * dx, apexY = tgt.y + dy - sOff, rise = t.position.y - apexY;
    if (rise < 6 || rise > T.jump_height * w.S.jump) return null;
    let lo = 1, hi = 22; for (let k = 0; k < 24; k++) { const mid = (lo + hi) / 2; if (riseOf(mid, g, keep).rise < rise) lo = mid; else hi = mid; }
    const v = (lo + hi) / 2, n = riseOf(v, g, keep).steps, S = (1 - Math.pow(keep, n)) / (1 - keep), vx = (apexX - t.position.x) / S;
    if (Math.abs(vx) > T.dunk_vx_max) return null;
    return { q, apexX, apexY, v, vx, n };
  }

  /** The lob's receiver, one step: take off in time for the ball to come to his hand, steer the jump, reach for the ball. */
  function stepLob(w, T) {
    const L = w.lobPlay; if (!L) return;
    const q = L.q, t = q.torso, ball = w.ball, g = gravityPx(w), keep = 1 - t.frictionAir;
    const done = () => { if (!w.dunk) { q.slam = false; q.slamRel = null; } w.lobPlay = null; };
    L.steps++;
    if (w.hold || w.dunk || L.steps > 300) { done(); return; }          // the ball is held by someone (or already dunked): the play is over
    if (!L.launched) {
      if (L.steps >= L.startIn && q.sinceGround <= 0.15) {              // time to go: the jump tops out as the ball arrives
        for (const part of q.parts) Body.setVelocity(part, { x: L.vx, y: -L.v });
        q.sinceGround = 99; q.sinceFoot = 99; q.cd = T.jump_cooldown; q.sinceJump = 0; L.launched = true; L.age = 0;
        w.onEvent({ type: 'jump', team: q.team, x: t.position.x, y: w.floorY });
      }
      return;
    }
    L.age++;
    q.slam = true; q.slamRel = armToward(q, ball.position.x, ball.position.y);   // the hand goes to the ball
    if (t.velocity.y < 0) {                                              // keep the rest of the rise on its line
      const rise = t.position.y - L.apexY;
      if (rise > 2) {
        let lo = 1, hi = 22; for (let k = 0; k < 18; k++) { const mid = (lo + hi) / 2; if (riseOf(mid, g, keep).rise < rise) lo = mid; else hi = mid; }
        const v = (lo + hi) / 2, n = riseOf(v, g, keep).steps, S = (1 - Math.pow(keep, n)) / (1 - keep), vx = clamp((L.apexX - t.position.x) / S, -T.dunk_vx_max, T.dunk_vx_max);
        for (const part of [t, q.head, ...q.legs]) Body.setVelocity(part, { x: lerp(part.velocity.x, vx, 0.9), y: lerp(part.velocity.y, -v, 0.6) });
      }
    }
    if (L.age > L.n + 30) done();
  }

  /**
   * Fire the held ball. A fadeaway (drifting or leaning away from the hoop in the air) is only
   * a name for a shot taken that way: the arc is the same.
   */
  function shoot(w, T) {
    const h = w.hold, p = h.p, ball = w.ball, hoop = attackedHoop(w, p);
    const airborne = p.sinceGround > 0.1, a = wrap(p.torso.angle);
    const lob = !!h.lob && !w.dunk;
    const fade = !lob && airborne && (p.torso.velocity.x * p.dir < -T.fade_speed || a * p.dir < -T.fade_lean);
    const { vx, vy } = shotVelocity(w, T, p, h.charge, ball.position, lob);
    release(w, T, 0.2);
    p.followT = T.follow_time;   // classic form: shooting arm trails forward, wrist bent, palm down
    Body.setVelocity(ball, { x: vx * p.dir, y: -vy });
    Body.setAngularVelocity(ball, -p.dir * 0.2);
    const line = lob ? { perfect: false, onTarget: false, crossX: null, touched: true } : predictLine(w, T, hoop);
    if (lob) {
      w.pass = { team: p.team, from: p, until: w.time + 2.2 + T.pass_catch_window, lob: true };   // the teammate takes it like a pass: a dunk off it is an alley-oop
      const rcv = lobReceiver(w, T, p);
      if (rcv) {   // the teammate's jump is timed to the ball: it reaches the board's height after `steps`, and his jump takes rcv.n to top out
        const f = flightTo(w, T, hoop, ball.position.x, ball.position.y, vx * p.dir, -vy, hoop.rimY - T.lob_height);
        w.lobPlay = { ...rcv, startIn: Math.max(0, (f.steps || 0) - rcv.n), steps: 0, launched: false, age: 0 };
      }
    }
    w.prevBallX = ball.position.x; w.prevBallY = ball.position.y;
    ball.shot = { team: p.team, t: w.time, kind: fade ? 'fade' : 'shot', dir: p.dir, perfect: line.perfect, onTarget: line.onTarget, clean: true,
      crossX: line.crossX, freeFlight: !line.touched, lob, fromX: ball.position.x };   // where it was released: past the centre line, it is worth two
    // white by default; rainbow on a clean perfect line; blue for a fadeaway heading in; settled again at the basket
    w.trail = { pts: [], mode: lob ? 'lob' : line.perfect ? 'rainbow' : fade && line.onTarget ? 'blue' : 'white', t: 0, shot: ball.shot };
    w.onEvent({ type: lob ? 'lob' : fade ? 'fadeaway' : 'shoot', team: p.team, charge: h.charge, perfect: line.perfect, x: ball.position.x, y: ball.position.y });
  }

  /**
   * Whether the ball, flying free from here with drag and gravity, drops through the middle of
   * the rim. onTarget: its centre crosses inside the rim opening. perfect: it crosses within
   * T.perfect_window of the rim's width from the centre AND never touches the front rim or the
   * backboard on the way (touching is judged at the distance the engine really collides at, see
   * CONTACT). crossX is where it crosses.
   */
  function predictFlight(w, T, hoop, x, y, vx, vy) {
    const r = w.ball.r, f = flightTo(w, T, hoop, x, y, vx, vy);
    if (f.crossX === null) return { onTarget: false, perfect: false, crossX: null, touched: f.touched };
    const off = Math.abs(f.crossX - hoop.cx);
    return { onTarget: off < hoop.span / 2, perfect: !f.touched && off < hoop.span * T.perfect_window, crossX: f.crossX, touched: f.touched };   // no touch on the way is the whole clearance test
  }
  function predictLine(w, T, hoop) { const b = w.ball; return predictFlight(w, T, hoop, b.position.x, b.position.y, b.velocity.x, b.velocity.y); }

  /**
   * A shot that has not been taken yet: what would happen if player `p`, holding the ball with
   * a cock-back of `charge`, let go right now. Returns where it crosses the rim plane and how far
   * from the rim's centre that is (err, positive meaning past the centre, away from the shooter).
   * `lead` is how many steps ahead of now the ball leaves (0 = from where it is this instant).
   */
  function previewShot(w, T, p, charge, lead = 0) {
    // `lead` steps ahead: a shot let go this step leaves from where the held ball will be next step
    const hoop = attackedHoop(w, p), b = w.ball, at = { x: b.position.x + b.velocity.x * lead, y: b.position.y + b.velocity.y * lead };
    const v = shotVelocity(w, T, p, charge, at);
    const f = predictFlight(w, T, hoop, at.x, at.y, v.vx * p.dir, -v.vy);
    return Object.assign(f, { err: f.crossX === null ? null : (f.crossX - hoop.cx) * p.dir, vx: v.vx, vy: v.vy });
  }

  /**
   * The free ball's next `n` steps, stepped as the engine steps it, bouncing off the floor and the side
   * walls (the floor with its livelier bounce). Not a promise: players, the rim and the board are not in it.
   * @returns {{x: number, y: number, vx: number, vy: number}[]} one entry per step, the first being the next step
   */
  function ballPath(w, T, n) {
    const g = gravityPx(w), b = w.ball, keep = 1 - b.frictionAir, floor = w.floorY - b.r, rest = Math.max(b.restitution, T.floor_bounce);
    let x = b.position.x, y = b.position.y, vx = b.velocity.x, vy = b.velocity.y;
    const out = [];
    for (let i = 0; i < n; i++) {
      vx *= keep; vy = vy * keep + g; x += vx; y += vy;
      if (x < w.L + b.r) { x = w.L + b.r; vx = -vx * 0.6; } else if (x > w.R - b.r) { x = w.R - b.r; vx = -vx * 0.6; }
      if (y >= floor && vy > 0) { y = floor; vy = Math.abs(vy) < 1.2 ? 0 : -vy * rest; }
      out.push({ x, y, vx, vy });
    }
    return out;
  }

  /** Where a free ball, flying as it is now, comes down to the floor (null if it is already there). */
  function landingX(w) {
    const g = gravityPx(w), b = w.ball, keep = 1 - b.frictionAir, floor = w.floorY - b.r;
    let x = b.position.x, y = b.position.y, vx = b.velocity.x, vy = b.velocity.y;
    if (y >= floor - 2 && Math.abs(vy) < 1) return null;
    for (let i = 0; i < 300; i++) {
      vx *= keep; vy = vy * keep + g; x += vx; y += vy;
      if (x < w.L + b.r) { x = w.L + b.r; vx = -vx * 0.6; } else if (x > w.R - b.r) { x = w.R - b.r; vx = -vx * 0.6; }   // the side walls
      if (vy > 0 && y >= floor) return x;
    }
    return x;
  }

  /**
   * Bounce the held ball off the floor: forward toward the attacked hoop, farther the longer the
   * bounce key was held. Short holds are dribbles the carrier can catch again; long ones are passes.
   */
  function bounce(w, T) {
    const h = w.hold, p = h.p, ball = w.ball, c = h.bcharge;
    release(w, T, T.bounce_ignore);   // the bouncer's own legs never kick their own dribble away
    p.grabCD = T.bounce_regrab;
    w.lastBouncer = p;
    w.passGuard = { team: p.team, until: w.time + T.pass_guard };   // opponents can't catch it yet
    const dribble = c < T.dribble_threshold;
    if (dribble) {
      // A dribble goes the way the body leans in its swing. Its rhythm decides how wild it gets:
      // a tap made while the ball was rising back to the hand is clean (sloppiness eases off);
      // a tap made while it was still falling is sloppy (sloppiness builds). Long chains add a
      // little too, so a dribble can't run for ever.
      const quality = p.tapQuality || 'hand'; p.tapQuality = null;
      const chained = w.time - (p.lastDribble ?? -9) < T.dribble_chain_time;
      p.dribbleChain = chained ? (p.dribbleChain || 0) + 1 : 1;
      if (!chained) p.sloppy = 0;
      p.sloppy = Math.max(0, (p.sloppy || 0) + (quality === 'sloppy' ? 2 : quality === 'clean' ? -1 : 0));
      p.lastDribble = w.time;
      const wild = (p.sloppy + Math.max(0, p.dribbleChain - T.dribble_safe_chain) * 0.5) * T.dribble_error;
      const steer = clamp(wrap(p.torso.angle) / T.rock_angle, -1, 1);
      // every dribble carries you a little forward; leaning forward in the swing carries you further
      p.dribbleSteer = p.dir * (0.45 + 0.55 * Math.max(0, steer * p.dir));
      // a dribbled ball passes through opponents' bodies: only an opponent's hand can take it
      ball.collisionFilter.mask = 0x1 | TEAM_CAT[p.team];
      w.dribbleBall = { team: p.team, until: w.time + T.dribble_time + 0.6 };
      Body.setVelocity(ball, { x: T.dribble_vx * (p.dribbleSteer + 0.25 * p.dir) + (w.rng() * 2 - 1) * wild, y: T.dribble_vy + (w.rng() * 2 - 1) * wild * 0.5 });
      Body.setAngularVelocity(p.torso, p.torso.angularVelocity + (w.rng() * 2 - 1) * T.dribble_sway * p.sloppy * 0.01);
      p.dribbleT = T.dribble_time; p.cd = 0;
      p.lastQuality = quality;
    } else {
      Body.setVelocity(ball, { x: lerp(T.bounce_vx_min, T.bounce_vx_max, c) * p.dir, y: lerp(T.bounce_vy_min, T.bounce_vy_max, c) });
      ball.collisionFilter.mask = 0x1 | TEAM_CAT[p.team];   // a pass slips through opponents for a moment
      w.ghostUntil = w.time + T.pass_ghost;
    }
    Body.setAngularVelocity(ball, p.dir * 0.15);
    if (!dribble) w.pass = { team: p.team, from: p, until: w.time + T.pass_catch_window };
    w.onEvent({ type: dribble ? 'dribbleout' : 'bounce', team: p.team, charge: c, chain: p.dribbleChain || 0, quality: p.lastQuality, sloppy: p.sloppy || 0 });
  }

  /**
   * Where a body flying with this position and velocity tops out, with the body's air drag.
   * Returns {x, y, steps}; a body already falling is at its top now.
   */
  function apexOf(x, y, vx, vy, g, air) {
    const keep = 1 - air;
    let steps = 0;
    while (vy < 0 && steps < 200) { x += vx; y += vy; vx *= keep; vy = vy * keep + g; steps++; }
    return { x, y, steps, vy };
  }

  /** The apex rise (px) and its step count of a jump leaving the floor at vertical speed v (px/step). */
  function riseOf(v, g, keep) {
    let y = 0, vy = -v, steps = 0;
    while (vy < 0 && steps < 300) { y += vy; vy = vy * keep + g; steps++; }
    return { rise: -y, steps };
  }

  /**
   * Plan the jump of a dunk from the floor: a take-off velocity that tops the body out exactly
   * where the arm, at 90% of its length, can put the ball just over the rim (the body a little
   * short of the rim, the arm reaching up and forward). The jump is only as high as the dunk needs.
   * Returns null if the rim is out of reach of a jump (too high, or too far to cover).
   */
  function planDunk(w, T, p, hoop) {
    const t = p.torso, dir = p.dir, g = gravityPx(w), keep = 1 - t.frictionAir, r = w.ball.r;
    const L = p.dims.armL - 5 + r * T.palm_offset;                        // shoulder to ball centre, arm straight
    const sOff = -p.dims.torsoH / 2 + 10;                                  // the shoulder sits this far above the torso's centre
    const slot = { x: hoop.cx, y: hoop.rimY - r - T.dunk_slot };           // where the ball's centre must be: just over the rim
    const dx = T.dunk_arm_dx * L, dy = Math.sqrt(Math.max(1, (T.dunk_arm_ext * L) ** 2 - dx * dx));
    const apexX = hoop.cx - dir * dx, apexY = slot.y + dy - sOff;          // where the torso's centre should be at the top
    const rise = Math.max(6, t.position.y - apexY);
    if (rise > T.jump_height * w.S.jump) return null;
    let lo = 1, hi = 22;                                                   // bisect the take-off speed for that rise
    for (let k = 0; k < 24; k++) { const mid = (lo + hi) / 2; if (riseOf(mid, g, keep).rise < rise) lo = mid; else hi = mid; }
    const v = (lo + hi) / 2, n = riseOf(v, g, keep).steps, S = (1 - Math.pow(keep, n)) / (1 - keep);
    const vx = (apexX - t.position.x) / S;
    if (Math.abs(vx) > T.dunk_vx_max) return null;
    return { vx, vy: -v, n, apexX, apexY, slot, L, sOff };
  }

  /** Where the dunker's torso should be while the arm puts the ball just over the rim: the same spot planDunk jumps to. */
  function dunkAnchor(w, T, p, hoop) {
    const dir = p.dir, r = w.ball.r, L = p.dims.armL - 5 + r * T.palm_offset, sOff = -p.dims.torsoH / 2 + 10;
    const slotY = hoop.rimY - r - T.dunk_slot, dx = T.dunk_arm_dx * L, dy = Math.sqrt(Math.max(1, (T.dunk_arm_ext * L) ** 2 - dx * dx));
    return { x: hoop.cx - dir * dx, y: slotY + dy - sOff };
  }

  /**
   * Whether the carrier can start a dunk now. Dunks are close-range and one-sided:
   *  - the body must be on the court side of the rim, at least T.dunk_min_gap from it (under or
   *    behind the rim is never a dunk);
   *  - on the floor: within T.dunk_ground_x of the rim, and a jump can be planned that tops out
   *    where the arm can put the ball over the rim;
   *  - in the air: only while moving toward the rim and not leaning back (a player falling backwards
   *    gets no dunk), the real flight topping out within T.dunk_reach_x of the rim with the hand
   *    above it (a falling one may be a little below: the dunk holds him up, see T.dunk_air_assist),
   *    and not already dropping faster than T.dunk_fall_limit;
   *  - a catch straight off a teammate's pass (alley-oop) gets T.oop_bonus times the reach.
   */
  function dunkReady(w, T, p, hoop, fromPass) {
    const t = p.torso, dir = p.dir, bonus = fromPass ? T.oop_bonus : 1;
    const gap = (hoop.cx - t.position.x) * dir;
    if (gap < T.dunk_min_gap) return false;
    const lean = wrap(t.angle) * dir;                                        // positive: leaning toward the rim
    if (p.sinceGround <= 0.08) return gap <= T.dunk_ground_x * bonus && Math.abs(lean) < 1.1 && planDunk(w, T, p, hoop) !== null;
    if (t.velocity.x * dir < T.dunk_toward_vx || lean < T.dunk_lean_min) return false;   // drifting or leaning away: no dunk
    if (t.velocity.y > T.dunk_fall_limit) return false;                      // already dropping too fast
    const top = apexOf(t.position.x, t.position.y, t.velocity.x, t.velocity.y, gravityPx(w), t.frictionAir);
    const apexGap = (hoop.cx - top.x) * dir;
    const handTop = top.y - p.dims.torsoH / 2 + 10 - p.dims.armL;
    const slack = t.velocity.y > 0 ? T.dunk_air_slack * T.dunk_air_assist : 0;   // falling: the assist will lift him, so the hand may start lower
    return apexGap >= T.dunk_min_gap && apexGap <= T.dunk_reach_x * bonus && handTop <= hoop.rimY - w.ball.r * 0.4 + slack;
  }

  const DUNK_STYLES = ['tomahawk', 'windmill', 'elbow'];
  /** Where the arm must point (as an angle from the torso) for the ball to be at (x, y). */
  function armToward(p, x, y) {
    const t = p.torso, a = t.angle, oy = -p.dims.torsoH / 2 + 10;
    const sx = t.position.x - Math.sin(a) * oy, sy = t.position.y + Math.cos(a) * oy;   // the shoulder
    return wrap(Math.atan2(-(x - sx), y - sy) - a);
  }

  /**
   * Start a dunk. From the floor the player takes a small jump planned to top out at exactly the
   * height the dunk needs; in the air they simply go for it from where they are. Either way the
   * ARM does the work: it carries the ball up to the rim in the dunk's style (tomahawk: cocked back
   * behind the head, then swung down; windmill: a full clockwise circle at full arm length, mirrored
   * for the team attacking left; honey dip: straight in, then hanging by the forearm inside the rim),
   * and when the ball is over the rim's opening it is slammed down through it. If the arm misses,
   * the ball hits the rim and pops out of the hand. Tomahawks and windmills hang on the rim by the
   * hand afterwards with chance T.dunk_hang_chance; a honey dip always hangs.
   */
  function startDunk(w, T, hoop) {
    const p = w.hold.p, grounded = p.sinceGround <= 0.08;
    const plan = grounded ? planDunk(w, T, p, hoop) : null;
    if (grounded && !plan) return false;
    const style = DUNK_STYLES[Math.floor(w.rng() * DUNK_STYLES.length) % DUNK_STYLES.length];
    const hang = style === 'elbow' || w.rng() < T.dunk_hang_chance;
    const oop = w.hold.fromPass && w.hold.t < T.oop_window;   // alley-oop: dunked straight off a pass
    w.dunk = { p, hoop, style, hang, oop, plan, grounded, t: 0, slammed: false, y0: p.torso.position.y, done: false, hangT: 0, con: null, turn: null, steps: 0 };
    p.slam = true; p.windSpin = null;
    if (plan) { for (const part of p.parts) Body.setVelocity(part, { x: plan.vx, y: plan.vy }); p.sinceGround = 99; p.sinceFoot = 99; p.cd = T.jump_cooldown; }
    w.onEvent({ type: 'dunkstart', team: p.team, style, oop, x: w.ball.position.x, y: w.ball.position.y });
    return true;
  }

  function endDunk(w) {
    const d = w.dunk; if (!d) return;
    if (d.con) Composite.remove(w.engine.world, d.con);
    d.p.slam = false; d.p.slamRel = null; d.p.windSpin = null; w.dunk = null;
  }

  /** A defender's hand or head met the ball on its way into the rim: swatted back out, away from the hoop. */
  function swat(w, T, q) {
    const d = w.dunk, ball = w.ball;
    if (w.hold) release(w, T, 0);
    Body.setVelocity(ball, { x: -d.p.dir * T.swat_speed, y: -T.swat_speed * 0.45 });
    Body.setAngularVelocity(ball, -d.p.dir * 0.3);
    ball.shot = null; d.p.grabCD = 0.5;
    w.onEvent({ type: 'block', team: q.team, dunk: true, x: ball.position.x, y: ball.position.y });
    endDunk(w);
  }

  /** The dunk, one step: steer the jump, aim the arm, slam when the ball is over the rim, hang on. */
  function stepDunk(w, T, dt) {
    const d = w.dunk, p = d.p, h = d.hoop, ball = w.ball, t = p.torso, r = ball.r, dir = p.dir;
    d.t += dt; d.steps++; d.topY = Math.min(d.topY === undefined ? 1e9 : d.topY, t.position.y);
    const g = gravityPx(w), keep = 1 - t.frictionAir;
    const slot = d.plan ? d.plan.slot : { x: h.cx, y: h.rimY - r - T.dunk_slot };
    if (!d.slammed) {
      // opponents: a hand or the head on the ball swats it away
      for (const q of w.players) {
        if (q.team === p.team) continue;
        const hq = handPos(q), head = q.head.position;
        if (shareInHandBox(q, ball, T) > 0.25 || Math.hypot(head.x - ball.position.x, head.y - ball.position.y) < r + q.dims.headS * 0.45 || Math.hypot(hq.x - ball.position.x, hq.y - ball.position.y) < r + 8) { swat(w, T, q); return; }
      }
      // the jump: keep it on its planned line (vertical speed re-solved for the rise left, sideways speed for the spot)
      if (d.plan && d.grounded && t.velocity.y < 0) {
        const rise = t.position.y - d.plan.apexY;
        if (rise > 2) {
          let lo = 1, hi = 22; for (let k = 0; k < 18; k++) { const mid = (lo + hi) / 2; if (riseOf(mid, g, keep).rise < rise) lo = mid; else hi = mid; }
          const v = (lo + hi) / 2, n = riseOf(v, g, keep).steps, S = (1 - Math.pow(keep, n)) / (1 - keep);
          const vx = clamp((d.plan.apexX - t.position.x) / S, -T.dunk_vx_max, T.dunk_vx_max);
          for (const part of [t, p.head, ...p.legs]) Body.setVelocity(part, { x: lerp(part.velocity.x, vx, 0.9), y: lerp(part.velocity.y, -v, 0.6) });   // (the arm's swing pushes the body; this pushes back)
        }
      }
      // from the air (no planned jump): steer him over the rim and hold him up, so a dunker already falling still gets there
      if (!d.plan && !d.grounded && T.dunk_air_assist > 0) {
        const A = d.air || (d.air = dunkAnchor(w, T, p, h)), k = T.dunk_air_assist;
        const vx = clamp((A.x - t.position.x) / 9, -T.dunk_vx_max, T.dunk_vx_max);
        const below = t.position.y - A.y;                                  // positive: lower than where the arm needs him
        const vyT = below > 3 ? -Math.min(9, below * 0.3) : Math.min(t.velocity.y, 1);
        for (const part of [t, p.head, ...p.legs]) Body.setVelocity(part, { x: lerp(part.velocity.x, vx, 0.6 * k), y: lerp(part.velocity.y, vyT, 0.7 * k) });
      }
      // the arm: where the ball has to go, by style
      const aim = armToward(p, slot.x, slot.y);
      const u = d.plan ? clamp((d.y0 - t.position.y) / Math.max(1, d.y0 - d.plan.apexY), 0, 1) : clamp(d.t / 0.3, 0, 1);
      p.windSpin = null;
      if (d.style === 'tomahawk') p.slamRel = u < 0.55 ? -dir * T.arm_cock_angle : aim;              // back behind the head, then down
      else if (d.style === 'windmill') {                                                              // a full circle, clockwise (mirrored)
        const rel = wrap(p.arm.angle - t.angle);
        if (d.turn === null) d.turn = ((((aim - rel) * dir) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI) + 2 * Math.PI;
        const left = Math.max(3, (d.plan ? d.plan.n : 16) - d.steps);
        if (u < 0.82 && d.turn > 0.3) { const spin = d.turn / left; d.turn = Math.max(0, d.turn - spin); p.windSpin = dir * spin; p.slamRel = aim; }
        else p.slamRel = aim;
      } else {                                                                                        // honey dip: a steady sweep straight to the slot, paced to arrive with the top of the jump
        const direct = wrap(aim - wrap(p.arm.angle - t.angle));
        const front = ((((aim - wrap(p.arm.angle - t.angle)) * dir) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI) * dir;   // the way round past the chest, not back through the head
        const err = Math.abs(direct) > 0.8 && Math.abs(front) < 4.3 && !d.backed ? front : direct;   // (swings up in front of the body, then settles)
        p.slamRel = aim; if (Math.abs(err) > 0.03) p.windSpin = clamp(err * 0.3, -0.45, 0.45);
      }
      const dist = Math.hypot(ball.position.x - slot.x, ball.position.y - slot.y);   // (kept for the miss report: how close the arm ever got)
      if (!d.best || dist < d.best.dist) d.best = { dist, dx: Math.round(ball.position.x - slot.x), dy: Math.round(ball.position.y - slot.y), tx: Math.round(t.position.x - (d.plan ? d.plan.apexX : t.position.x)), ty: Math.round(t.position.y - (d.plan ? d.plan.apexY : t.position.y)), top: d.plan ? Math.round(d.topY - d.plan.apexY) : 0, t: +d.t.toFixed(2), vy: +t.velocity.y.toFixed(1) };
      // the slam: the ball is over the rim's opening, at or past the top of the jump
      const fit = Math.max(2, h.span / 2 - r * 1.09);   // how far off the centre a ball can be and still drop in without touching the rim
      const above = ball.position.y <= h.rimY - r * 0.3 && Math.abs(ball.position.x - h.cx) <= fit + T.dunk_slot_tol;
      if (above && t.velocity.y > -T.dunk_apex_vy) {
        release(w, T, 0.35);
        Body.setVelocity(ball, { x: clamp((h.cx - ball.position.x) * 0.5, -5, 5), y: T.dunk_speed });
        ball.shot = { team: p.team, t: w.time, kind: 'dunk', style: d.style, oop: d.oop, dir, clean: true };
        d.slammed = true; d.hangT = 0; h.wobble = 2; p.windSpin = null;
        if (d.hang) {   // hang by the hand: a pin from the hand to the rim (a honey dip puts the forearm inside the basket)
          const hp = d.style === 'elbow' ? { x: h.cx + dir * 0, y: h.rimY + 8 } : { x: h.frontX, y: h.rimY };
          const aa = p.arm.angle, tip = p.dims.armL / 2;
          d.con = Constraint.create({ bodyA: p.arm, pointA: { x: -Math.sin(aa) * tip, y: Math.cos(aa) * tip }, pointB: hp, length: 0, stiffness: 0.9, damping: 0.08 });
          Composite.add(w.engine.world, d.con);
        }
        w.onEvent({ type: 'dunk', team: p.team, x: h.cx, y: h.rimY, style: d.style, hang: d.hang, oop: d.oop });
        return;
      }
      // a miss: the arm never got the ball over the rim: the ball pops out of the hand (it has hit the rim or board),
      // or the player is back on the floor, or time is up
      const pal = { x: handPos(p).x + (handPos(p).x - p.arm.position.x) * 0.0, y: handPos(p).y };
      const stretch = Math.hypot(ball.position.x - pal.x, ball.position.y - pal.y);
      if (stretch > T.dunk_pop || d.t > T.dunk_timeout || (d.t > 0.25 && p.sinceGround < 0.03)) {
        if (w.hold) release(w, T, 0.1);
        w.onEvent({ type: 'dunkmiss', team: p.team, reason: stretch > T.dunk_pop ? 'knocked from the hand' : d.t > T.dunk_timeout ? 'timeout' : 'landed', style: d.style, grounded: d.grounded, best: d.best, dx: Math.round(ball.position.x - h.cx), dy: Math.round(ball.position.y - h.rimY), tx: d.plan ? Math.round(t.position.x - d.plan.apexX) : 0, ty: d.plan ? Math.round(d.topY - d.plan.apexY) : 0, t: +d.t.toFixed(2) });
        endDunk(w); return;
      }
      return;
    }
    // after the slam: hanging on the rim, swaying, then letting go
    d.hangT += dt;
    if (d.hang) { h.wobble = Math.max(h.wobble, 0.5); p.slamRel = armToward(p, h.frontX, h.rimY); }
    const hangFor = d.hang ? T.dunk_rim_hang * (d.style === 'elbow' ? 1.2 : 1) : T.dunk_hang;
    if (d.hangT >= hangFor) endDunk(w);
  }

  /**
   * A rim that someone stays on overheats: heat builds while a player (off the floor) is on or in it, over
   * T.rim_heat_time, and cools when it is left. Full heat starts the gleam (T.rim_gleam_time); at its end the rim
   * blows: everyone on it is sent down (T.rim_blast px/step, not hard) and a little away from the board, and a hang
   * is let go. Longer than a hanging dunk (dunk_rim_hang), so an ordinary hang never blows.
   */
  function rimHeat(w, T, dt) {
    for (const h of w.hoops) {
      // (off the floor: both feet clear of it. Not sinceGround: the rim and board count as ground for that)
      const on = w.players.filter(p => p.legs.every(l => l.position.y < w.floorY - 40) && p.parts.some(b => b.position.x > h.x1 - 14 && b.position.x < h.x2 + 14 && b.position.y > h.rimY - 50 && b.position.y < h.rimY + 60));
      h.heat = h.heat || 0;
      if (h.gleam !== undefined && h.gleam !== null) {
        h.gleam += dt;
        if (h.gleam >= T.rim_gleam_time) {
          if (w.dunk && w.dunk.hoop === h) endDunk(w);
          for (const p of on) for (const b of p.parts) Body.setVelocity(b, { x: b.velocity.x * 0.3 - h.side * 2, y: Math.max(b.velocity.y, 0) + T.rim_blast });
          w.onEvent({ type: 'rimblast', team: on.length ? on[0].team : -1, x: h.cx, y: h.rimY, n: on.length });
          h.gleam = null; h.heat = 0; h.wobble = 2;
        }
        continue;
      }
      h.heat = clamp(h.heat + (on.length ? dt / T.rim_heat_time : -dt / T.rim_cool_time), 0, 1);
      if (h.heat >= 1) h.gleam = 0;
    }
  }

  function possession(w, held, bheld, T, dt) {
    const ball = w.ball;
    if (w.dunk) { stepDunk(w, T, dt); if (w.dunk && !w.dunk.slammed) return; }   // a dunk in progress: the ball is in the dunker's hand until the slam
    if (w.ignoreUntil && w.time >= w.ignoreUntil && !w.hold) { ball.collisionFilter.group = 0; w.ignoreUntil = 0; }
    for (const team of [0, 1]) {   // a bounce tap while your own dribble is in the air is queued
      const fresh = bheld[team] && !w.prevB[team];
      if (fresh && !w.hold && w.lastBouncer && w.lastBouncer.team === team && w.lastBouncer.dribbleT > 0) {
        w.lastBouncer.queued = true;
        // in rhythm: on the way back up; one tap on the way down makes this dribble sloppy, whatever follows
        if (w.lastBouncer.tapQuality !== 'sloppy') w.lastBouncer.tapQuality = w.ball.velocity.y < 0 ? 'clean' : 'sloppy';
      }
    }
    w.prevB = bheld.slice();
    const guarded = p => w.passGuard && p.team !== w.passGuard.team && w.time < w.passGuard.until;
    const canCatch = p => p.grabCD <= 0 && !(p === w.ignoreP && w.time < w.ignoreUntil) && !guarded(p);

    // body hits on the ball
    for (const kk of w.kicks) {
      const pl = kk.part.plugin.player, kind = kk.part.plugin.kind;
      if (w.dunk && !w.dunk.slammed && pl.team !== w.dunk.p.team && (kind === 'arm' || kind === 'head')) { swat(w, T, pl); return; }
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
      // a pass reaching the teammate it was meant for: legs or chest take it straight into the hand
      if (w.pass && pl.team === w.pass.team && pl !== w.pass.from && w.time < w.pass.until && (kind === 'leg' || kind === 'torso') && pl.grabCD <= 0) { grab(w, pl, T, 'grab', held[pl.team]); return; }
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
      // bounce key: (let go once after a catch made with it down) → hold to wind up → let go to bounce
      const bk = bheld[p.team];
      if (!h.barmed) { if (!bk) h.barmed = true; }
      else if (bk) { h.bouncing = true; h.bcharge = Math.min(1, h.bcharge + dt / T.bounce_charge_time); }
      if (h.bouncing && !bk) {
        // no dribble from a seated player: the tap is lost and the ball stays in the hand (a pass still goes)
        if (h.bcharge < T.dribble_threshold && seated(w, p, T)) { h.bouncing = false; h.bcharge = 0; w.onEvent({ type: 'seatedtap', team: p.team }); }
        else { bounce(w, T); return; }
      }
      const hoop = attackedHoop(w, p);
      h.dunkReady = !w.dunk && dunkReady(w, T, p, hoop, h.fromPass && h.t < T.oop_window);
      // near the rim: a tap of jump dunks. The prompt that was showing a step ago counts too, since the
      // same press also takes off, and by now the player is already in the air
      if ((h.dunkReady || h.wasReady) && k && !h.prevK && startDunk(w, T, hoop)) return;
      h.wasReady = h.dunkReady;
      h.prevK = k;
      if (h.cocking && !k) { shoot(w, T); return; }
      for (const q of w.players) { // a defender's hand box over the held ball: stolen
        if (q.team === p.team || h.t < T.steal_guard || !canCatch(q)) continue;
        if (shareInHandBox(q, ball, T) > 0.5) { grab(w, q, T, 'steal', held[q.team]); return; }
      }
      return;
    }
    // a free ball: more than half of it inside someone's hand box, or touching an abdomen,
    // snaps it to that hand. Checked every step, so a ball resting against a player is caught too.
    for (const p of w.players) {
      if (w.dribbleBall && p.team !== w.dribbleBall.team) {   // a dribble: opponents take it with a hand, or not at all
        if (p.grabCD <= 0 && shareInHandBox(p, ball, T) > 0.5) { grab(w, p, T, 'steal', held[p.team]); break; }
        continue;
      }
      if (!canCatch(p)) continue;
      // a dribbler gets their own bounce back on its way up, within reach of the hand
      const own = p === w.lastBouncer && ball.velocity.y < 0 && (() => { const hp = handPos(p); return Math.hypot(hp.x - ball.position.x, hp.y - ball.position.y) < ball.r + T.dribble_reach; })();
      if (own || shareInHandBox(p, ball, T) > 0.5 || touchesAbdomen(p, ball, T)) {
        const again = p === w.lastBouncer && p.queued; p.queued = false;   // a queued dribble tap fires however the dribbler catches it
        grab(w, p, T, own ? 'dribble' : 'grab', held[p.team]);
        if (again && !seated(w, p, T)) { w.hold.bcharge = 0; bounce(w, T); }   // (not from a seated catch: no dribbling sitting down)   // the queued tap: back down at once
        break;
      }
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
   * @param {boolean[]} bheld [team 0 bounce key held, team 1 bounce key held]
   */
  function step(w, held, T, dt, bheld = [false, false]) {
    w.time += dt;
    w.bheld = bheld;
    if (w.ghostUntil && w.time >= w.ghostUntil) { w.ghostUntil = 0; if (!w.dunk && !w.dribbleBall) w.ball.collisionFilter.mask = 0x1 | 0x2 | 0x4; }
    if (w.dribbleBall && w.time >= w.dribbleBall.until) { w.dribbleBall = null; if (!w.dunk && !w.hold) w.ball.collisionFilter.mask = 0x1 | 0x2 | 0x4; }   // a dribble that got away is a loose ball again
    for (const b of w.dynamic) { b._px = b.position.x; b._py = b.position.y; b._pa = b.angle; }
    // while a team has the ball, its key belongs to the carrier: the teammate stays planted
    const busy = q => (w.hold && w.hold.p.team === q.team && w.hold.p !== q) || (w.dunk && w.dunk.p.team === q.team && w.dunk.p !== q);
    stepLob(w, T);
    for (const p of w.players) drive(w, p, busy(p) ? false : held[p.team], T, dt);
    spread(w, T);
    w.kicks.length = 0;
    Engine.update(w.engine, DELTA);
    for (const p of w.players) {
      if (p.foot && p.sinceFoot > 0.25 && p.torso.velocity.y > 3) w.onEvent({ type: 'land', x: p.torso.position.x, y: w.floorY, speed: p.torso.velocity.y });
      p.sinceGround = p.touch ? 0 : p.sinceGround + dt; p.touch = false;
      p.sinceFoot = p.foot ? 0 : p.sinceFoot + dt; p.foot = false;
    }

    possession(w, held, bheld, T, dt);
    rimHeat(w, T, dt);
    const ball = w.ball;
    if (w.trail) {
      w.trail.t += dt;
      { const sh = ball.shot;   // where the ball really crosses the rim plane (what decides the rainbow, not the prediction)
        if (sh && sh.kind !== 'dunk' && sh.crossOff === undefined && ball.velocity.y > 0 && w.prevBallY !== undefined && w.prevBallY < ball.position.y) {
          const hp = w.hoops.find(q => q.team === sh.team);
          if (hp && w.prevBallY < hp.rimY && ball.position.y >= hp.rimY) {
            const f = (hp.rimY - w.prevBallY) / (ball.position.y - w.prevBallY), cx = w.prevBallX + (ball.position.x - w.prevBallX) * f;
            sh.crossOff = Math.abs(cx - hp.cx); sh.crossPerfect = sh.crossOff < hp.span * T.perfect_window;   // (a hard touch on the way still disqualifies it, in index.html)
          }
        } }
      if (ball.shot && ball.shot === w.trail.shot && !w.hold) { w.trail.pts.push({ x: ball.position.x, y: ball.position.y }); if (w.trail.pts.length > T.trail_length) w.trail.pts.shift(); }
      else if (w.trail.pts.length) w.trail.pts.shift();
      else w.trail = null;
    }
    w.prevBallX = ball.position.x; w.prevBallY = ball.position.y;
    capSpeed(ball, T.ball_max_speed);
    for (const p of w.players) if (!(w.dunk && w.dunk.p === p)) for (const part of p.parts) capSpeed(part, T.player_max_speed);

    for (const h of w.hoops) {   // the net drags a free ball passing through it: the swish
      if (!w.hold && ball.position.x > h.x1 && ball.position.x < h.x2 && ball.position.y > h.rimY && ball.position.y < h.rimY + 56) {
        Body.setVelocity(ball, { x: ball.velocity.x * 0.86, y: ball.velocity.y * 0.96 });
        h.sway = Math.min(1.5, h.sway + 0.12);
      }
      h.wobble *= 0.93; h.sway *= 0.95;
    }
  }

  return { FLOOR_Y, CX, DELTA, seated, handPos, createWorld, step, dropBall, squircle, dunkReady, previewShot, predictLine, ballPath, landingX, shotVelocity, lobTarget, lobPossible, lobPlan, lobReceiver, swingAt };
})();
