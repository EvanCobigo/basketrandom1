// PROTOTYPE - NOT FOR PRODUCTION
// Question: Does one key plus floppy physics give a match that is chaotic, funny and still winnable on skill?
// Date: 2026-11-14
'use strict';
/**
 * AI: a CPU opponent that plays one team with exactly what a person has: one jump key and one
 * bounce key, pressed and released over time. It reads the world each step and returns the two
 * keys' states. Its difficulty is T.ai_level, 1 to 5: each level is quicker and more accurate
 * than the last, and adds abilities on top of the level below (LEVELS says which).
 */
const AI = (() => {
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));

  /** The five difficulty levels: name, skill (0..1: reaction speed and shot accuracy), what it adds. */
  const LEVELS = [
    { name: 'ROOKIE', skill: 0.15, does: 'CHASES THE BALL AND SHOOTS FROM WHERE IT STANDS. SLOW AND OFTEN OFF TARGET.' },
    { name: 'AMATEUR', skill: 0.35, does: 'ALSO JUMPS TO BLOCK YOUR SHOTS, AND SHOOTS STRAIGHTER.' },
    { name: 'PRO', skill: 0.55, does: 'ALSO DRIBBLES UPCOURT TO DUNK, AND PASSES WHEN YOU CROWD IT.' },
    { name: 'ALL-STAR', skill: 0.75, does: 'ALSO DRIBBLES IN RHYTHM, PICKS ITS LONG SHOTS FOR 2, REACHES IN TO STEAL.' },
    { name: 'LEGEND', skill: 0.95, does: 'ALSO THROWS ALLEY-OOPS TO A TEAMMATE AT THE RIM. FAST AND RARELY MISSES.' },
  ];
  const levelOf = T => clamp(Math.round(T.ai_level), 1, LEVELS.length);

  /**
   * Make a controller for `team`.
   * @param {number} team the team it plays (0 or 1)
   * @param {() => number} rng seeded random, so a replay of the same match is the same
   */
  function create(team, rng) {
    return { team, rng, jump: false, bounce: false, wait: 0, holdT: 0, bholdT: 0, dribs: 0 };
  }

  /** The player of its team nearest the ball. */
  function nearest(w, team) {
    let best = null, bd = 1e9;
    for (const p of w.players) if (p.team === team) {
      const d = Math.abs(p.torso.position.x - w.ball.position.x);
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  }

  /**
   * Decide this step's keys.
   * @param {object} c controller from create
   * @param {object} w the physics world
   * @param {object} T live tuning values
   * @param {number} dt step length in seconds
   * @returns {{jump: boolean, bounce: boolean}}
   */
  function update(c, w, T, dt) {
    const level = levelOf(T), skill = LEVELS[level - 1].skill, ball = w.ball, hold = w.hold;
    const react = T.ai_react * (1.6 - skill);   // seconds between fresh decisions
    const tap = dt * 2;                          // a two-step press: a tap
    c.jump = false; c.bounce = false;

    // a key being held on purpose stays down until its time is up; letting go is the action
    if (c.bholdT > 0) { c.bholdT -= dt; c.bounce = c.bholdT > 0; return c; }
    if (c.holdT > 0) { c.holdT -= dt; c.jump = c.holdT > 0; if (c.holdT <= 0) c.wait = react * 0.5; return c; }
    if (c.wait > 0) { c.wait -= dt; return c; }

    if (hold && hold.p.team === c.team) {             // ---- we have the ball
      const p = hold.p, hoop = w.hoops.find(h => h.team === c.team), dir = p.dir;
      const mate = w.players.find(q => q.team === c.team && q !== p);
      const X = Math.abs(hoop.cx - ball.position.x);
      if (hold.dunkReady) { c.jump = true; c.holdT = tap; c.dribs = 0; return c; }   // at the rim: a tap dunks
      if (!hold.armed || !hold.barmed) return c;                                      // let go once after the catch
      const foeNear = w.players.some(q => q.team !== c.team && Math.abs(q.torso.position.x - p.torso.position.x) < 90);
      const foeClose = w.players.some(q => q.team !== c.team && Math.abs(q.torso.position.x - p.torso.position.x) < 150);
      const mateAhead = mate && (mate.torso.position.x - p.torso.position.x) * dir > 40;
      const mateGap = mate ? (hoop.cx - mate.torso.position.x) * dir : -1e9;   // the teammate's distance from the rim, court side positive
      const mateAtRim = mate && mateGap >= T.dunk_min_gap && mateGap <= T.dunk_reach_x * T.oop_bonus;
      const passFor = d => clamp(0.3 + d / 600, T.dribble_threshold + 0.05, 1) * T.bounce_charge_time;   // how long to wind a pass of d px
      // level 5: the alley-oop. A teammate is at the rim: bounce it to them; the catch brings up the dunk
      if (level >= 5 && mateAtRim && mateAhead) { c.bounce = true; c.bholdT = passFor(Math.abs(mate.torso.position.x - p.torso.position.x)); c.dribs = 0; return c; }
      // level 5 also feeds a teammate who is well ahead and much nearer the hoop: the set-up for one
      const mateX = mate ? Math.abs(hoop.cx - mate.torso.position.x) : 1e9;
      if (level >= 5 && mateAhead && mateX < X - 150 && mateX < T.dunk_reach_x * 2.2 && c.rng() < 0.6) { c.bounce = true; c.bholdT = passFor(Math.abs(mate.torso.position.x - p.torso.position.x)); c.dribs = 0; return c; }
      // level 3+: crowded, with a teammate further upcourt: pass, sometimes
      if (level >= 3 && foeNear && mateAhead && c.rng() < 0.5) { c.bounce = true; c.bholdT = passFor(Math.abs(mate.torso.position.x - p.torso.position.x)); c.dribs = 0; return c; }
      // open on its own half: the long shot is worth 2, so it is taken rather than dribbled away
      // (level 3 mostly, level 4+ always); the dribble is for the far half, on the way to a dunk
      const ownHalf = (ball.position.x - w.cx) * dir < 0;
      const longShot = ownHalf && !foeClose && (level >= 4 || c.rng() < 0.7);
      // level 3+: too far to dunk and not shooting long: dribble upcourt, a few at a time
      const maxDribs = level >= 4 ? 6 : 3;
      // (never into a defender: crowded, it shoots or passes instead of dribbling the ball away)
      const gap = (hoop.cx - p.torso.position.x) * dir;                          // court side of the rim is positive
      if (level >= 3 && !longShot && !foeNear && gap > T.dunk_ground_x && c.dribs < maxDribs) { c.bounce = true; c.bholdT = tap; c.dribs++; return c; }
      // otherwise shoot: cock back for a time that fits the distance, misjudged more at low levels
      const want = clamp((X - 140) / 620, 0.05, 1) + (c.rng() * 2 - 1) * T.ai_error * (1 - skill);
      c.jump = true; c.holdT = clamp(want, 0.03, 1) * T.shot_charge_time; c.dribs = 0;
      return c;
    }

    // ---- our own dribble is in the air: keep it going (the tap is queued and fires on the catch)
    const lb = w.lastBouncer;
    if (!hold && lb && lb.team === c.team && lb.dribbleT > 0) {
      const hoop = w.hoops.find(h => h.team === c.team), X = Math.abs(hoop.cx - lb.torso.position.x);
      const more = (hoop.cx - lb.torso.position.x) * lb.dir > T.dunk_ground_x && c.dribs < (level >= 4 ? 6 : 3) && !lb.queued;
      // level 4+ taps in rhythm, as the ball rises; level 3 taps whenever, so its dribble gets sloppy
      if (more && (level >= 4 ? ball.velocity.y < -0.5 : c.rng() < 0.12)) { c.bounce = true; c.bholdT = tap; c.dribs++; }
      return c;
    }

    if (hold && hold.p.team !== c.team) {             // ---- they have it
      c.dribs = 0;
      const foe = hold.p;
      const gap = Math.min(...w.players.filter(q => q.team === c.team).map(q => Math.abs(q.torso.position.x - foe.torso.position.x)));
      // level 2+: a shot being cocked nearby: get up to block it
      if (level >= 2 && hold.cocking && gap < 170 && c.rng() < 0.4 + skill * 0.5) { c.jump = true; c.holdT = 0.3; return c; }
      // level 4+: right next to the carrier: raise the arm to get a hand on the ball
      if (level >= 4 && gap < 100 && c.rng() < 0.25) { c.jump = true; c.holdT = 0.22; return c; }
    }

    // ---- free ball, or closing down the carrier: hop toward it on the swing
    const p = nearest(w, c.team);
    if (!p) return c;
    const target = hold ? hold.p.torso.position.x : ball.position.x;
    const s = Math.sign(target - p.torso.position.x) || 1, a = wrap(p.torso.angle);
    const highBall = !hold && ball.position.y < w.floorY - 220 && Math.abs(ball.position.x - p.torso.position.x) < 140;
    if (highBall) { c.jump = true; c.holdT = 0.32; return c; }                  // a full jump for a high ball
    const leaningToward = a * s > 0.22 && p.sinceFoot < 0.1;                    // the swing is tipping toward it
    if (leaningToward) { c.jump = true; c.holdT = 0.06 + c.rng() * 0.08; return c; }
    c.wait = react * 0.25;
    return c;
  }

  return { create, update, LEVELS, levelOf };
})();
