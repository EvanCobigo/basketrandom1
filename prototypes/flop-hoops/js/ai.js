// PROTOTYPE - NOT FOR PRODUCTION
// Question: Does one key plus floppy physics give a match that is chaotic, funny and still winnable on skill?
// Date: 2026-11-14
'use strict';
/**
 * AI: a CPU opponent that plays one team with exactly what a person has: one jump key and one
 * bounce key, pressed and released over time. It reads the world each step and returns the two
 * keys' states. Its difficulty is T.ai_level, 1 to 5: each level is quicker and more accurate
 * than the last, and adds abilities on top of the level below (LEVELS says which). From level 3
 * it also plays a random style for the match (STYLES), which tilts what it likes to try.
 *
 * How it aims: while it holds a cocked shot it asks the physics, every step, where the ball
 * would cross the rim if it let go right now (Physics.previewShot, the engine's own flight maths
 * and the real aim help), and lets go when that reaches the spot it picked. A bad shot is a
 * badly picked spot, not a bad guess at the flight, so it copes with a shooter that is moving.
 */
const AI = (() => {
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));

  /** The five difficulty levels: name, skill (0..1: reaction speed and shot accuracy), what it adds. */
  const LEVELS = [
    { name: 'ROOKIE', skill: 0.15, does: 'CHASES THE BALL AND SHOOTS WITHOUT MUCH AIM. SLOW AND OFTEN OFF TARGET.' },
    { name: 'AMATEUR', skill: 0.35, does: 'ALSO JUMPS TO BLOCK YOUR SHOTS, AND AIMS STRAIGHTER.' },
    { name: 'PRO', skill: 0.55, does: 'ALSO DRIBBLES UPCOURT TO DUNK, PASSES WHEN CROWDED, AND PLAYS A RANDOM STYLE.' },
    { name: 'ALL-STAR', skill: 0.75, does: 'ALSO DRIBBLES IN RHYTHM, STEALS, AND TRIES FADEAWAYS AND LONG SHOTS FOR 2.' },
    { name: 'LEGEND', skill: 0.95, does: 'ALSO SETS UP ALLEY-OOPS AND CLEAN PASSES. QUICK AND RARELY MISSES.' },
  ];
  /** Styles (level 3+): how much it likes each trick. 1 is the usual; the numbers scale its odds. */
  const STYLES = [
    { name: 'SHOWBOAT', fade: 1.8, long: 1.5, pass: 0.5, block: 0.8, steal: 0.8, oop: 0.8 },
    { name: 'PLAYMAKER', fade: 0.4, long: 0.7, pass: 1.8, block: 0.8, steal: 1.0, oop: 1.6 },
    { name: 'LOCKDOWN', fade: 0.5, long: 0.8, pass: 0.8, block: 1.7, steal: 1.7, oop: 0.8 },
  ];
  const BALANCED = { name: '', fade: 1, long: 1, pass: 1, block: 1, steal: 1, oop: 1 };
  const levelOf = T => clamp(Math.round(T.ai_level), 1, LEVELS.length);

  /**
   * Make a controller for `team`.
   * @param {number} team the team it plays (0 or 1)
   * @param {() => number} rng seeded random, so a replay of the same match is the same
   * @param {object} T tuning values: the level decides whether it plays a style
   * @param {number} [matchNo] which match of the session this is: successive matches cycle through the styles
   */
  function create(team, rng, T, matchNo = 0) {
    const style = T && levelOf(T) >= 3 ? STYLES[(Math.floor(rng() * STYLES.length) + matchNo) % STYLES.length] : BALANCED;
    return { team, rng, style, jump: false, bounce: false, wait: 0, holdT: 0, bholdT: 0, dribs: 0, aim: null };
  }

  /** The player of its team nearest the ball. */
  function nearest(w, team, x) {
    let best = null, bd = 1e9;
    for (const p of w.players) if (p.team === team) {
      const d = Math.abs(p.torso.position.x - x);
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  }

  /**
   * The bounce-key hold for a pass over `d` px. A longer hold throws it harder; this is the
   * distance estimate that tested best (a flown-out model of the bounces did worse: the ball
   * keeps bouncing and rolling past the first bounce in ways it does not capture).
   */
  function passHold(T, d) { return clamp(0.3 + d / 600, T.dribble_threshold + 0.05, 1) * T.bounce_charge_time; }

  /**
   * Hold a cocked shot and let go at the right moment (see the header). `a` is the aim state:
   * `off` is where it means to cross relative to the rim's centre (a little off at low skill),
   * `fade` says it is trying a fadeaway, which it starts from a lean back so the hop carries it away.
   */
  function aimStep(c, w, T, dt, level, skill) {
    const a = c.aim, hold = w.hold;
    a.t += dt;
    if (!hold || hold.p.team !== c.team) { c.aim = null; c.jump = false; return c; }   // the ball is gone
    const p = hold.p, dir = p.dir;
    if (!hold.cocking) {                                  // not pressing yet: pick the moment
      if (a.fade && !a.pressed && wrap(p.torso.angle) * dir > -0.25 && a.wait < 1.6) { a.wait += dt; c.jump = false; return c; }
      a.pressed = true; c.jump = true; return c;
    }
    const pv = Physics.previewShot(w, T, p, hold.charge);
    let release = hold.charge >= 0.995 || a.t > 2.4;
    if (!release && pv.err !== null && pv.err >= a.off - 3) {
      if (a.fade) {   // a fadeaway needs the body drifting or leaning away at the moment of release
        const fading = p.sinceGround > 0.1 && (p.torso.velocity.x * dir < -T.fade_speed || wrap(p.torso.angle) * dir < -T.fade_lean);
        release = fading || a.t > 1.1;
      } else release = true;
    }
    if (release) { c.aim = null; c.jump = false; c.wait = T.ai_react * (1.6 - skill) * 0.5; return c; }
    c.jump = true; return c;
  }

  /**
   * Decide this step's keys.
   * @param {object} c controller from create
   * @param {object} w the physics world
   * @param {object} T live tuning values
   * @param {number} dt step length in seconds
   * @param {{score: number[]}} [info] the match state it may look at: the score
   * @returns {{jump: boolean, bounce: boolean}}
   */
  function update(c, w, T, dt, info) {
    const level = levelOf(T), skill = LEVELS[level - 1].skill, ball = w.ball, hold = w.hold, st = c.style;
    const react = T.ai_react * (1.6 - skill);   // seconds between fresh decisions
    const tap = dt * 2;                          // a two-step press: a tap
    const behind = info ? info.score[1 - c.team] - info.score[c.team] : 0;   // points behind (negative: ahead)
    c.jump = false; c.bounce = false;

    if (c.aim) return aimStep(c, w, T, dt, level, skill);
    // a key being held on purpose stays down until its time is up; letting go is the action
    if (c.bholdT > 0) { c.bholdT -= dt; c.bounce = c.bholdT > 0; return c; }
    if (c.holdT > 0) { c.holdT -= dt; c.jump = c.holdT > 0; if (c.holdT <= 0) c.wait = react * 0.5; return c; }
    if (c.wait > 0) { c.wait -= dt; return c; }

    if (hold && hold.p.team === c.team) {             // ---- we have the ball
      const p = hold.p, hoop = w.hoops.find(h => h.team === c.team), dir = p.dir, span = hoop.span;
      const mate = w.players.find(q => q.team === c.team && q !== p);
      const X = Math.abs(hoop.cx - ball.position.x);
      // a defender up at the rim with a hand raised would swat the dunk: level 4+ waits for them to come down (or goes around)
      const rimFoe = w.players.find(q => q.team !== c.team && Math.abs(q.torso.position.x - hoop.cx) < T.contest_range * 0.8);
      const foeUp = rimFoe && (rimFoe.sinceGround > 0.04 || Math.abs(rimFoe.torso.position.x - hoop.cx) < 50);
      if (hold.dunkReady && foeUp && level >= 4 && hold.t < 2.2 && c.rng() < 0.5 + skill * 0.4) { c.wait = react * 0.3; return c; }
      if (hold.dunkReady) { c.jump = true; c.holdT = tap; c.dribs = 0; return c; }   // at the rim: a tap dunks
      if (!hold.armed || !hold.barmed) return c;                                      // let go once after the catch
      const foeNear = w.players.some(q => q.team !== c.team && Math.abs(q.torso.position.x - p.torso.position.x) < 90);
      const foeClose = w.players.some(q => q.team !== c.team && Math.abs(q.torso.position.x - p.torso.position.x) < 150);
      const mateAhead = mate && (mate.torso.position.x - p.torso.position.x) * dir > 40;
      const mateGap = mate ? (hoop.cx - mate.torso.position.x) * dir : -1e9;   // the teammate's distance from the rim, court side positive
      const mateAtRim = mate && mateGap >= T.dunk_min_gap && mateGap <= T.dunk_reach_x * T.oop_bonus;
      const passTo = () => { c.bounce = true; c.bholdT = passHold(T, Math.abs(mate.torso.position.x - p.torso.position.x)); c.dribs = 0; return c; };
      // the alley-oop: a teammate is at the rim, so bounce it to them; they take it in the air and dunk
      if (level >= 4 && mateAtRim && mateAhead && (level >= 5 || c.rng() < 0.5 * st.oop)) return passTo();
      // level 5 also feeds a teammate who is well ahead and much nearer the hoop: the set-up for one
      const mateX = mate ? Math.abs(hoop.cx - mate.torso.position.x) : 1e9;
      if (level >= 5 && mateAhead && mateX < X - 150 && mateX < T.dunk_reach_x * 2.2 && c.rng() < 0.6 * st.oop) return passTo();
      // level 3+: crowded, with a teammate further upcourt: pass, sometimes
      if (level >= 3 && foeNear && mateAhead && c.rng() < 0.5 * st.pass) return passTo();

      // can a full-strength throw even reach the rim from here?
      const far = Physics.previewShot(w, T, p, 1);
      const inRange = far.err !== null && far.err >= -span * 0.9;
      const ownHalf = (ball.position.x - w.cx) * dir < 0;
      // chasing the game, or showing off when ahead, makes it likelier to go for the 2-pointer
      const longOdds = clamp((level >= 4 ? 0.9 : 0.6) * st.long + Math.max(0, behind) * 0.08 + Math.max(0, -behind) * 0.04 * (st.name === 'SHOWBOAT' ? 1 : 0), 0, 1);
      const longShot = ownHalf && !foeClose && inRange && c.rng() < longOdds;
      // level 3+: too far to dunk and not shooting long: dribble upcourt, a few at a time (never into a defender)
      const maxDribs = level >= 4 ? 6 : 3;
      const gap = (hoop.cx - p.torso.position.x) * dir;                          // court side of the rim is positive
      // (one dribble carries about 50-90 px, so it stops short of the zone and lets the sway do the last bit)
      if (level >= 3 && !longShot && !foeNear && gap > T.dunk_ground_x + 60 && c.dribs < maxDribs) { c.bounce = true; c.bholdT = tap; c.dribs++; return c; }
      if (level >= 3 && !inRange && !foeNear && c.dribs < maxDribs + 2) { c.bounce = true; c.bholdT = tap; c.dribs++; return c; }   // out of range: get closer first
      // near or under the rim and not yet dunk-ready: no shot works from there, so wait for the swing to
      // carry it into the zone (the prompt then comes up and it taps); only give up after a couple of seconds
      if (level >= 2 && gap < T.dunk_ground_x + 60 && hold.t < 2.4 && !(far.err !== null && gap > T.dunk_ground_x + 20 && level < 3)) { c.wait = react * 0.5; return c; }
      // otherwise shoot: a fadeaway when a defender is on it (level 4+), else a plain jump shot
      const fade = level >= 4 && foeClose && inRange && X < 700 && c.rng() < 0.45 * st.fade;
      const noise = (c.rng() * 2 - 1) * span * 0.55 * (1.15 - skill) * (T.ai_error / 0.35);   // where it means to cross, off the centre by its skill
      c.aim = { t: 0, wait: 0, off: noise, fade, pressed: false }; c.dribs = 0;
      return aimStep(c, w, T, dt, level, skill);
    }

    // ---- our own pass is in the air: send the receiver up to meet it
    if (!hold && w.pass && w.pass.team === c.team && w.time < w.pass.until) {
      const mate = w.players.find(q => q.team === c.team && q !== w.pass.from);
      if (mate && Math.abs(ball.position.x - mate.torso.position.x) < 190 && Math.abs(ball.position.y - mate.torso.position.y) < 160 && ball.velocity.x * mate.dir >= -1) {
        c.jump = true; c.holdT = 0.3; return c;
      }
    }

    // ---- our own dribble is in the air: keep it going (the tap is queued and fires on the catch)
    const lb = w.lastBouncer;
    if (!hold && lb && lb.team === c.team && lb.dribbleT > 0) {
      const hoop = w.hoops.find(h => h.team === c.team);
      const more = (hoop.cx - lb.torso.position.x) * lb.dir > T.dunk_ground_x && c.dribs < (level >= 4 ? 6 : 3) && !lb.queued;
      // level 4+ taps in rhythm, as the ball rises; level 3 taps whenever, so its dribble gets sloppy
      if (more && (level >= 4 ? ball.velocity.y < -0.5 : c.rng() < 0.12)) { c.bounce = true; c.bholdT = tap; c.dribs++; }
      return c;
    }

    if (hold && hold.p.team !== c.team) {             // ---- they have it
      c.dribs = 0;
      const foe = hold.p;
      const gap = Math.min(...w.players.filter(q => q.team === c.team).map(q => Math.abs(q.torso.position.x - foe.torso.position.x)));
      // level 2+: a dunk is coming at our rim: jump with a straight arm to meet it (a hand or the head on the ball swats it away)
      if (level >= 2 && w.dunk && !w.dunk.slammed && w.dunk.p === foe) {
        const rimX = w.dunk.hoop.cx, cand = w.players.filter(q => q.team === c.team).sort((q1, q2) => Math.abs(q1.torso.position.x - rimX) - Math.abs(q2.torso.position.x - rimX))[0];
        if (cand && Math.abs(cand.torso.position.x - rimX) < T.contest_range && c.rng() < (0.3 + skill * 0.6) * st.block) { c.jump = true; c.holdT = 0.32; return c; }
      }
      // level 3+: the carrier is closing on our rim and the dunk prompt is up: be under it, ready to jump
      if (level >= 3 && hold.dunkReady && c.rng() < (0.2 + skill * 0.5) * st.block) { c.jump = true; c.holdT = 0.3; return c; }
      // level 2+: a shot being cocked nearby: get up so we are in the air as it is let go
      if (level >= 2 && hold.cocking && hold.charge > 0.4 && gap < 170 && c.rng() < (0.4 + skill * 0.5) * st.block) { c.jump = true; c.holdT = 0.3; return c; }
      // level 4+: right next to the carrier: raise the arm to get a hand on the ball
      if (level >= 4 && gap < 100 && c.rng() < 0.25 * st.steal) { c.jump = true; c.holdT = 0.22; return c; }
    }

    // ---- free ball, or closing down the carrier: hop toward it on the swing
    // a ball in the air is chased to where it will come down, not to where it is
    const land = !hold ? Physics.landingX(w) : null;
    const target = hold ? hold.p.torso.position.x : (land !== null && ball.position.y < w.floorY - 70 ? land : ball.position.x);
    const p = nearest(w, c.team, target);
    if (!p) return c;
    const s = Math.sign(target - p.torso.position.x) || 1, a = wrap(p.torso.angle);
    const highBall = !hold && ball.position.y < w.floorY - 220 && Math.abs(ball.position.x - p.torso.position.x) < 140;
    if (highBall) { c.jump = true; c.holdT = 0.32; return c; }                  // a full jump for a high ball
    const leaningToward = a * s > 0.22 && p.sinceFoot < 0.1;                    // the swing is tipping toward it
    if (leaningToward) { c.jump = true; c.holdT = 0.06 + c.rng() * 0.08; return c; }
    c.wait = react * 0.25;
    return c;
  }

  return { create, update, LEVELS, STYLES, levelOf };
})();
