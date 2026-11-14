// PROTOTYPE - NOT FOR PRODUCTION
// Question: Does one key plus floppy physics give a match that is chaotic, funny and still winnable on skill?
// Date: 2026-11-14
'use strict';
/**
 * AI: a CPU opponent that plays one team with exactly what a person has: one jump key and one
 * bounce key, pressed and released over time. It reads the world each step and returns the two
 * keys' states. It reacts after a short delay and misjudges its shots a little, by T.ai_skill.
 */
const AI = (() => {
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));

  /**
   * Make a controller for `team`.
   * @param {number} team the team it plays (0 or 1)
   * @param {() => number} rng seeded random, so a replay of the same match is the same
   */
  function create(team, rng) {
    return { team, rng, jump: false, bounce: false, wait: 0, holdT: 0, plan: null };
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
    const skill = clamp(T.ai_skill, 0, 1), ball = w.ball, hold = w.hold;
    const react = T.ai_react * (1.6 - skill);   // seconds between fresh decisions
    c.bounce = false;

    // a key being held on purpose: keep it down until the plan says let go
    if (c.holdT > 0) { c.holdT -= dt; c.jump = c.holdT > 0; if (c.holdT <= 0) c.wait = react * 0.5; return c; }
    if (c.wait > 0) { c.wait -= dt; c.jump = false; return c; }

    if (hold && hold.p.team === c.team) {             // ---- we have the ball
      const p = hold.p, hoop = w.hoops.find(h => h.team === c.team);
      if (hold.dunkReady) { c.jump = true; c.holdT = dt * 2; return c; }       // a tap: dunk
      if (!hold.armed) { c.jump = false; return c; }                           // let go once after the catch
      const X = Math.abs(hoop.cx - ball.position.x);
      // far away and an opponent standing close: bounce a pass forward instead, sometimes
      const foeNear = w.players.some(q => q.team !== c.team && Math.abs(q.torso.position.x - p.torso.position.x) < 90);
      if (X > 520 && foeNear && c.rng() < 0.3) { c.bounce = true; c.wait = 0.25; return c; }
      // cock back for a time that fits the distance, misjudged a little
      const want = clamp((X - 140) / 620, 0.05, 1) + (c.rng() * 2 - 1) * T.ai_error * (1 - skill);
      c.jump = true; c.holdT = clamp(want, 0.03, 1) * T.shot_charge_time;
      return c;
    }

    if (hold && hold.p.team !== c.team) {             // ---- they have it: get up to block a shot
      const foe = hold.p;
      const close = w.players.some(q => q.team === c.team && Math.abs(q.torso.position.x - foe.torso.position.x) < 170);
      if (hold.cocking && close && c.rng() < 0.4 + skill * 0.5) { c.jump = true; c.holdT = 0.3; return c; }
    }

    // ---- free ball, or closing down the carrier: hop toward it on the swing
    const p = nearest(w, c.team);
    if (!p) { c.jump = false; return c; }
    const target = hold ? hold.p.torso.position.x : ball.position.x;
    const s = Math.sign(target - p.torso.position.x) || 1, a = wrap(p.torso.angle);
    const highBall = !hold && ball.position.y < w.floorY - 220 && Math.abs(ball.position.x - p.torso.position.x) < 140;
    if (highBall) { c.jump = true; c.holdT = 0.32; return c; }                  // a full jump for a high ball
    const leaningToward = a * s > 0.22 && p.sinceFoot < 0.1;                     // the swing is tipping toward it
    if (leaningToward) { c.jump = true; c.holdT = 0.06 + c.rng() * 0.08; return c; }
    c.jump = false; c.wait = react * 0.25;
    return c;
  }

  return { create, update };
})();
