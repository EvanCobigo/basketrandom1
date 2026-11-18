// PROTOTYPE - NOT FOR PRODUCTION
// Question: Does one key plus floppy physics give a match that is chaotic, funny and still winnable on skill?
// Date: 2026-11-15
'use strict';
/**
 * AI: a CPU opponent that plays one team with exactly what a person has: one jump key and one
 * bounce key, pressed and released over time. It reads the world each step and returns the two
 * keys' states, and a line saying what it is trying to do (`c.intent`, drawn under the scoreboard).
 *
 * The brain is split in three, each in its own function:
 *   offense()  it has the ball: it scores every option (dunk, shot, long shot, fadeaway, dribble, pass,
 *              alley-oop, wait) as expected points minus risk, plus its personality's taste, plus a
 *              little noise (more at low levels), and takes the best, sticking to it for a moment.
 *   defense()  they have the ball: it predicts what they are about to do (release a shot, enter the dunk
 *              zone, pass) up to LEVELS[].look steps ahead, and answers before they act; every answer is
 *              rolled once per incident at DEFENSE x its weight, then waits out a reaction delay.
 *   chase()    positioning and loose balls: it stands between the carrier and its rim, works out where a
 *              loose ball will be (Physics.ballPath), and times steals against a dribble in the air.
 * What it learns: `c.profile` remembers what the opponent does this match (shots, long shots, dunks,
 * passes, how far out they shoot, which way they drive, how they score when pressed vs left open) and
 * defence leans on it gradually: the more it has seen, the more it moves. It steps up to the spot they
 * like to shoot from and leads further against a carrier who keeps driving at the rim. `c.mine` keeps its
 * own record (shots, long shots, fadeaways, dunks), `c.swipes` how its steal swipes fare and `c.dribRec`
 * how many of its dribbles were lost; a level's `learn` sets how much any of it moves the next choice.
 * The match state: the score margin tilts its risk on a smooth curve that steepens toward the end, and
 * `c.mood` (the run of baskets) warms or cools it the way its personality would.
 * Slips: slip() rolls the level's slip rate for a shot, a defensive answer, a dribble tap, a pass and a
 * rebound read; how bad each is shrinks with skill, so a Legend's are rare and small. Press I in a match
 * to see what it thinks (AI.summary, from c.dbg and the books above).
 * Patience: there is no shot clock, so past PATIENCE the waiting option can never win (see offense()).
 * Ball rules (iteration 38): dribbles per possession are HARD-capped (BUDGETS) and never start from a seated player
 * (Physics.seated); under or beyond the basket it DEFENDS it never shoots or dribbles, it passes out (to a teammate
 * ahead, else an outlet: a self-pass at levels 5-6, a medium pass off the wall below); stuck with nothing on target
 * and nobody ahead it takes the same outlet instead of standing; a carrier in a worse spot than an open teammate
 * passes (from level 2). It shoots through pressure more readily, and makes room first with pump fakes (level 2+),
 * fadeaways (3+) and screens (3+). AI.brief() gives the intent in a word or two for the HUD.
 *
 * The Mythic (level 6) is the Legend plus refinements, each a field of its LEVELS entry or an X.m6 test: defence that reads a dunk
 * `rimLead` steps early and drops back only for a near one, a swipe rate capped at the Legend's, a halved-blind-spot personality,
 * trust in a sighting after two (not four), a pump fake that follows how its own fakes have fared, a pass that leads the receiver,
 * a rim protector it waits out (1.6 s at most, taking an open pass or lob instead), three seconds of patience (not four) and a way out that takes the best shot left, and the
 * self-pass: from halfway to the rim it throws the ball ahead, hops after it, catches it in the air itself and dunks (selfStep).
 * Iteration 46: it dribbles only inside its dribble zone (w.dribZone: the middle third of the court, never down to the rim), and pumps
 * (a fake or a pump-out, both a dribble) only with its feet on the floor: one decided in the air holds the cocked ball through the landing.
 *
 * How it aims: while it holds a cocked shot it asks the physics, every step, where the ball
 * would cross the rim if it let go right now (Physics.previewShot, the engine's own flight maths
 * and the real aim help), and lets go when that reaches the spot it picked. Every level takes the first line that is on;
 * from level 4 a line already carried well past its spot is not let go (it pumps out instead, while it may dribble).
 * Iteration 40: no lining up for a perfect line at any level, alley-oop lobs let go only when the teammate's jump can meet
 * them, fadeaways only with room behind them (never drifting into its own rim), no pass from the air under its own rim, a
 * last-resort clearing shot from over its own rim, quick outlets, short self-pass outlets, timed swats and steals from level 5.
 */
const AI = (() => {
  const PATIENCE = 4;   // s the CPU holds the ball before it feels pushed to act (it has no shot clock to run out)
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));

  /**
   * The six difficulty levels. skill: 0..1, how well it reacts and aims. defense: doubles per level.
   * look: how many steps ahead it can read the opponent (0: none). learn: how fast it adapts to them.
   * slip: the chance a play goes wrong on its own (a misread, a rushed shot). noise: how much its
   * choices wobble. Nobody is infallible: even a Legend slips, just rarely and mildly.
   * react: s it pauses between fresh decisions (and after an action), shorter at every step up by a wider margin. aimSpread: how far off the rim's
   *   centre it may aim a shot, in rim spans (a Rookie's 2.5 misses most of the time, the top levels' is almost none). releaseLag: up to
   *   this many steps late it lets go (its hands; the preview cannot see it). shotTrust: how much it believes in its own shot when choosing.
   *   All belong to the level; there is no setting.
   * rimLead: steps before a predicted dunk that its rim defender is already up (0: waits for the dunk to be ready).
   * sagWithin: a dunk predicted within this many steps makes it drop back to the rim (the Mythic does not sag for one far off).
   * lobGuard: px from the rim within which a defender stops it lobbing (unset: T.ai_lob_guard from level 4). patience: s it holds before it must act.
   * selfPass: it may throw the ball ahead, hop after it, catch it itself and dunk (see offense).
   * swipeCap: the most a swipe or a timed steal is scaled by (a swing at everything only loses position, so the Mythic keeps them at the Legend's rate).
   * tame: keeps its personality's flavour but halves its blind spots. fakeBase, screenP, screenR: how often it pumps and screens.
   * rimGuard, guardFrac: a carrier within rimGuard px of its rim is met guardFrac of the way back to the rim (a dribbler walks past a man
   *   who only stands in front of him; the rim is what has to be defended).
   */
  const LEVELS = [
    { name: 'ROOKIE', skill: 0.15, react: 0.26, aimSpread: 2.5, releaseLag: 6, shotTrust: 0.45, defense: 1 / 16, look: 0, learn: 0, slip: 0.5, noise: 0.5, rimLead: 0, sagWithin: 99, rimGuard: 0, guardFrac: 0, does: 'CHASES THE BALL, MISSES A LOT, REACTS SLOWLY. DRIBBLES A LITTLE.' },
    { name: 'AMATEUR', skill: 0.35, react: 0.24, aimSpread: 1.7, releaseLag: 4, shotTrust: 0.6, defense: 1 / 8, look: 4, learn: 0, slip: 0.3, noise: 0.35, rimLead: 0, sagWithin: 99, rimGuard: 0, guardFrac: 0, does: 'KNOWS BASIC SHOOTING AND BLOCKING, AND DRIBBLES UPCOURT.' },
    { name: 'PRO', skill: 0.55, react: 0.21, aimSpread: 1.2, releaseLag: 3, shotTrust: 0.72, defense: 1 / 4, look: 10, learn: 0.25, slip: 0.2, noise: 0.22, rimLead: 0, sagWithin: 99, rimGuard: 0, guardFrac: 0, does: 'DRIBBLES, PASSES AND DUNKS, SPOTS OPEN CHANCES, HAS A PERSONALITY.' },
    { name: 'ALL-STAR', skill: 0.75, react: 0.17, aimSpread: 0.8, releaseLag: 2, shotTrust: 0.85, defense: 1 / 2, look: 22, learn: 0.7, slip: 0.12, noise: 0.12, rimLead: 0, sagWithin: 99, rimGuard: 0, guardFrac: 0, selfPass: true, does: 'PREDICTS FLIGHTS, TIMES STEALS, ADAPTS TO HOW YOU PLAY.' },
    { name: 'LEGEND', skill: 0.95, react: 0.10, aimSpread: 0.0165, releaseLag: 0, shotTrust: 1, defense: 1, look: 40, learn: 1, slip: 0.06, noise: 0.06, rimLead: 6, sagWithin: 99, rimGuard: 0, guardFrac: 0, selfPass: true, does: 'CLEAN LINES, FAST BREAKS, READS YOUR PLAYS. STILL MAKES MISTAKES.' },
    { name: 'MYTHIC', skill: 1, react: 0.02, aimSpread: 0.00275, releaseLag: 0, shotTrust: 1, defense: 2, look: 60, learn: 1.6, slip: 0.025, noise: 0.03, rimLead: 12, sagWithin: 30, rimGuard: 520, guardFrac: 0.62, patience: 3, tame: true, swipeCap: 1, selfPass: true, fakeBase: 0.12, screenP: 0.9, screenR: 220, does: 'SELF-PASS FAST BREAKS, BLOCKS MORE, LEARNS QUICKLY. RARELY SLIPS.' },
  ];
  /**
   * Personalities (level 3+). Each weight is 1 for an even taste: attack (drives, dunks), range (long
   * shots), pass (passing, alley-oops), flash (fadeaways and showy plays), guard (blocks and steals),
   * scav (rebounds, loose balls, fast breaks), read (how much it studies the opponent), risk (0 careful
   * .. 1 bold), wild (how erratic its choices are). They tilt the scores; they never dictate a play.
   */
  const STYLES = [
    { name: 'AGGRESSIVE', does: 'DRIVES AT THE RIM AND DUNKS A LOT', attack: 1.6, range: 0.7, pass: 0.7, flash: 1.0, guard: 1.0, scav: 1.0, read: 0.8, risk: 0.65, wild: 1.0 },
    { name: 'SNIPER', does: 'LOVES THE LONG SHOT', attack: 0.6, range: 1.9, pass: 0.9, flash: 0.8, guard: 0.9, scav: 0.9, read: 1.0, risk: 0.5, wild: 0.8 },
    { name: 'PLAYMAKER', does: 'PASSES AND SETS UP ALLEY-OOPS', attack: 1.0, range: 0.7, pass: 1.9, flash: 0.7, guard: 0.9, scav: 1.0, read: 1.1, risk: 0.4, wild: 0.8 },
    { name: 'SHOWBOAT', does: 'FADEAWAYS AND SHOWY PLAYS', attack: 1.2, range: 1.3, pass: 0.6, flash: 1.9, guard: 0.7, scav: 0.8, read: 0.6, risk: 0.7, wild: 1.2 },
    { name: 'DEFENSIVE', does: 'LOCKS DOWN THE RIM AND STEALS', attack: 0.8, range: 0.8, pass: 0.9, flash: 0.5, guard: 1.9, scav: 1.2, read: 1.2, risk: 0.3, wild: 0.7 },
    { name: 'RECKLESS', does: 'WILD AND UNPREDICTABLE', attack: 1.3, range: 1.2, pass: 0.8, flash: 1.3, guard: 1.0, scav: 1.0, read: 0.4, risk: 1.0, wild: 2.4 },
    { name: 'TACTICIAN', does: 'STUDIES YOUR HABITS AND ADAPTS', attack: 1.0, range: 1.0, pass: 1.1, flash: 0.8, guard: 1.1, scav: 1.0, read: 2.0, risk: 0.5, wild: 0.6 },
    { name: 'OPPORTUNIST', does: 'PROWLS FOR REBOUNDS AND LOOSE BALLS', attack: 1.1, range: 0.9, pass: 1.0, flash: 0.9, guard: 1.2, scav: 1.9, read: 1.0, risk: 0.55, wild: 1.0 },
    { name: 'STREET BALL', does: 'FLASHY: DRIBBLE MOVES, FAKES, LOBS, SELF-PASSES', street: true, attack: 1.3, range: 1.2, pass: 1.4, flash: 2.6, guard: 0.85, scav: 0.9, read: 0.5, risk: 0.9, wild: 1.5 },
  ];
  // (STYLES carries street: true on STREET BALL: flashy play. It dribbles more and anywhere, self-passes from level 3, lobs and fakes more, and gambles for steals)
  const BALANCED = { name: '', attack: 1, range: 1, pass: 1, flash: 1, guard: 1, scav: 1, read: 1, risk: 0.5, wild: 1 };
  const levelOf = T => clamp(Math.round(T.ai_level), 1, LEVELS.length);
  const MYTHIC = 6;   // the level that has every refinement below (X.m6)
  const conf = (n, k = 4) => n / (n + k);   // how much to trust a tendency seen n times (k: how many sightings it takes to trust it halfway)
  /** A Mythic keeps its personality's flavour but not its blind spots: a weakness is halved, a wild streak is calmed. */
  const tamed = new WeakMap();
  function tame(st) {
    let t = tamed.get(st);
    if (!t) {
      t = Object.assign({}, st);
      for (const k of ['attack', 'range', 'pass', 'flash', 'guard', 'scav']) if (t[k] < 1) t[k] = 1 - (1 - t[k]) * 0.5;
      t.read = Math.max(1.2, t.read); t.wild = 1 + (t.wild - 1) * 0.5;
      tamed.set(st, t);
    }
    return t;
  }
  /**
   * The weights the AI's own judgement is tuned by (what self-play adjusts: tools/ai-selfplay.js). 1 is
   * neutral except where noted. dribble: the standing taste for dribbling (0.48). shot, pass: scale the
   * value of shooting and passing. risk: scales the penalty for steal and block risk. press: scales how
   * often defence swings at pressure. stand: how far from the carrier toward the rim it stands (0.28).
   * fake: scales how often it pumps against a defender who jumps early. lob: scales how much it likes
   * the alley-oop lob when a teammate waits at the rim. role: scales the front/back tilt (the man nearer
   * the rim leans to the drive, the one behind to the shot; 0 = off). budget: unused since iteration 38 (the
   * possession's budget is a hard cap now). Each controller has its own
   * copy (c.w), so two controllers can play each other with different weights.
   */
  const DEFAULT_WEIGHTS = { dribble: 0.48, shot: 1, pass: 1, risk: 1, press: 1, stand: 0.28, fake: 1, lob: 1, role: 1, budget: 1 };
  const maxDribsOf = level => 2 + Math.round(level * 1.4);
  /**
   * The most dribbles a possession may have, rolled fresh each time it gets the ball: [fewest, most] by level.
   * A HARD cap since iteration 38 (no dribble past it, from the hand or in the air). Iteration 28's hard cap left it
   * standing with nothing to do; that cannot happen now: past its patience waiting never wins, and with no shot
   * on target and nobody ahead it passes the ball out (self-pass or wall pass) instead of standing.
   */
  const BUDGETS = [[2, 4], [2, 5], [3, 7], [4, 9], [5, 10], [5, 10]];
  /** How often a cocked shot may turn into a pump fake, by level (from level 2; a level's own fakeBase wins). */
  const FAKE_BASE = [0, 0.1, 0.16, 0.2, 0.2, 0.2];

  /**
   * A slip: this play goes wrong on its own, at the level's slip rate times `k`. Counted in c.slips (the
   * benchmark reports it). How badly is up to the caller, and every caller scales it by (1 - skill), so a
   * Legend's slips are rare and small: a hair late, a little wide.
   */
  function slip(c, X, k = 1) {
    if (c.rng() >= X.L.slip * k) return false;
    c.slips++; c.slipAt = c.tick; return true;
  }

  /**
   * Make a controller for `team`.
   * @param {number} team the team it plays (0 or 1)
   * @param {() => number} rng seeded random, so a replay of the same match is the same
   * @param {object} T tuning values: the level decides whether it has a personality
   * @param {number} [matchNo] which match of the session this is: successive matches cycle through the personalities
   * @param {object} [weights] overrides of DEFAULT_WEIGHTS
   * @param {number} [level] play at this level whatever the tuning says (two computers of different levels can play each other)
   */
  function create(team, rng, T, matchNo = 0, weights = null, level = 0) {
    const picked = T && T.ai_style >= 1 ? STYLES[Math.min(STYLES.length, Math.round(T.ai_style)) - 1] : null;   // the menu's STYLE: 0 is random
    const style = picked || (T && (level || levelOf(T)) >= 3 ? STYLES[(Math.floor(rng() * STYLES.length) + matchNo) % STYLES.length] : BALANCED);
    return {
      team, rng, style, lv: level, w: Object.assign({}, DEFAULT_WEIGHTS, weights), jump: false, bounce: false, wait: 0, holdT: 0, bholdT: 0, dribs: 0, aim: null, rolls: {},
      tick: 0, intent: '', intentAt: -99, intentSeen: -99, plan: null, press: 0, err: 0, looseOn: false, qCache: null,
      // tactical memory: what the opponent does, how they fare pressed or left open, and how my own plays fare
      profile: { shots: 0, longShots: 0, dunks: 0, passes: 0, dribbles: 0, shotDist: 0, drive: 0, side: 0, pressed: { att: 0, made: 0 }, open: { att: 0, made: 0 } },
      mine: { shot: { att: 0, made: 0 }, long: { att: 0, made: 0 }, fade: { att: 0, made: 0 }, dunk: { att: 0, made: 0 }, lob: { att: 0, made: 0 } }, lobPend: null, scout: {}, mineP: {}, closeout: null, fqCache: null, hesitated: -1, clears: 0, clearing: 0, fakeFoe: null, fakeUp: false,
      // how the opponent answers a cocked shot (how often a defender jumps at it early) and how its own fakes fare
      foeReact: { cocks: 0, jumps: 0 }, fakes: { fakes: 0, shots: 0, made: 0 }, afterFake: -999, fakeAt: -999,
      seen: {}, pending: null, myPending: null, myDunk: null, dbg: {}, threat: null,
      self: null, selfEnds: {}, selfCool: 0, selfCaughtAt: -999, selfStats: { tries: 0, caught: 0, dunks: 0 },   // the self-pass in progress and how it has gone
      // the match so far: mood (-1 cold .. +1 hot, from the run of baskets), slips made, this possession's dribble budget
      mood: 0, scoreSeen: [0, 0], slips: 0, slipAt: -999, budget: 4, hadBall: false, possN: 0,
      // how its swipes fare (a swipe that never wins leaves it out of position) and how its dribbles fare near a defender
      swipes: { tries: 0, won: 0 }, swipeAt: -999, dribRec: { n: 0, lost: 0 }, ownDribAir: false,
    };
  }

  /** The player of its team nearest x. */
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
   * What a shot from here could be (a coarse sweep of the preview over the cock-back):
   * q 2 a perfect line exists, 1 it can go in, 0 neither; `width` 0..1 how much of the sweep goes in. A wide
   * window forgives a release a step early or late, so the same q is worth more when it is wide.
   */
  function quality(c, w, T, p) {
    if (c.qCache && c.qCache.tick > c.tick - 3) return c.qCache;
    let q = 0, hits = 0, n = 0;
    for (let ch = 0.3; ch <= 1.0001; ch += 0.03) {
      const v = Physics.previewShot(w, T, p, ch);
      n++;
      if (v.onTarget) hits++;
      if (v.perfect) q = 2;
      else if (v.onTarget && q < 1) q = 1;
    }
    c.qCache = { tick: c.tick, q, width: hits / n };
    return c.qCache;
  }

  /**
   * x kept on the court side of both rims. Behind a basket nothing can be done (no dunk, no shot, nobody to pass to),
   * so the AI never walks there on purpose: its targets stop `margin` px short of either rim.
   */
  function courtSide(w, x, margin = 40) {
    let lo = -1e9, hi = 1e9;
    for (const h of w.hoops) { if (h.side < 0) lo = h.cx + margin; else hi = h.cx - margin; }
    return clamp(x, lo, hi);
  }

  /** Whether x is under (within T.ai_own_rim_zone of the rim) or beyond the basket team `c` DEFENDS: it never shoots from there. */
  function underOwnRim(c, w, T, x) {
    const d = w.hoops.find(h => h.team !== c.team);
    return Math.abs(x - d.cx) < T.ai_own_rim_zone || (x - d.cx) * (-d.side) < 0;
  }

  /**
   * Whether the held ball is under its own rim now or 3 steps from now (the release is decided a step before the ball leaves, and a
   * ball 71 px out drifting in left at 68: iteration 46's own-rim shots, from its own third where it may no longer dribble).
   */
  /**
   * A shot from here (at the cock-back it has, or `ch`) flown out: does its path keep clear of the rim and board it DEFENDS? Under
   * or behind its own basket a shot may go only when it does (a shot that clips its own rim is how the ball falls in its own basket).
   */
  function ownShotClear(c, X, p, ch) {
    const { w, T, dfn } = X, b = w.ball, r = b.r + 10;
    const v = Physics.shotVelocity(w, T, p, ch ?? (w.hold && w.hold.cocking ? Math.max(0.4, w.hold.charge) : 0.7), b.position);
    for (const q of Physics.pathFrom(w, T, b.position.x, b.position.y, v.vx * p.dir, -v.vy, 60)) {
      if (q.x > dfn.x1 - r && q.x < dfn.x2 + r && Math.abs(q.y - dfn.rimY) < r + 6) return false;
      if (Math.abs(q.x - dfn.boardX) < r && q.y > dfn.boardTop - r && q.y < dfn.boardBot + r) return false;
    }
    return true;
  }
  function ownRimSoon(c, w, T) { const b = w.ball; return underOwnRim(c, w, T, b.position.x) || underOwnRim(c, w, T, b.position.x + b.velocity.x * 3); }

  /** Say what it is doing, but not flickering: a line stays on for about half a second. */
  function say(c, text, force) {
    c.intentSeen = c.tick;                           // (still saying it: the icon over its head stays up)
    if (c.intent !== text && (force || c.tick - c.intentAt > 30)) { c.intent = text; c.intentAt = c.tick; }
  }

  /**
   * One defensive roll per incident. `cond` says the incident is on (a shot is being cocked, a dunk is
   * under way); the first step it is true the dice are thrown with chance `p`, and the answer stands
   * until the incident ends. A yes also carries a reaction delay: the move waits until `at`.
   * @returns {boolean} true once it has been decided yes and the reaction time has passed
   */
  function defend(c, w, kind, cond, p, lag, X) {
    const r = c.rolls[kind] || (c.rolls[kind] = { on: false, go: false, at: 0 });
    if (!cond) { r.on = false; return false; }
    if (!r.on) {
      r.on = true; r.go = c.rng() < clamp(p, 0, 1); r.at = w.time + lag * c.rng();
      // a mistimed answer: a little late (a Legend by a few hundredths, a Rookie by a third of a second)
      if (r.go && X && slip(c, X, 0.6)) r.at += 0.06 + 0.3 * (1 - X.skill);
    }
    return r.go && w.time >= r.at;
  }

  // ---------------------------------------------------------------- the frame: what every part reads

  function frame(c, w, T, dt, info) {
    const level = c.lv || levelOf(T), L = LEVELS[level - 1], m6 = level >= MYTHIC, st = L.tame ? tame(c.style) : c.style;
    const win = T.win_score, mine = info ? info.score[c.team] : 0, theirs = info ? info.score[1 - c.team] : 0;
    // the state of the match: how far from the end each side is decides how much risk and defence it wants
    const sit = { behind: theirs - mine, toWin: win - mine, foeToWin: win - theirs };
    const nearEnd = m6 ? 5 : 3;                         // (the Mythic feels the end coming sooner)
    sit.late = sit.toWin <= nearEnd || sit.foeToWin <= nearEnd;
    const protect = sit.behind <= -3 && sit.late;       // ahead near the end: play it safe
    const chase = sit.behind >= 3 && sit.late;          // behind near the end: gamble
    // how much the score moves its appetite for risk: a smooth curve, not a switch. The margin counts more the
    // nearer the end (lateness 0 until someone is 5 from winning, 1 at match point); ahead cools it, behind heats it
    const lateness = clamp((5 - Math.min(sit.toWin, sit.foeToWin)) / 4, 0, 1);
    const scoreTilt = clamp(sit.behind / 4, -1, 1) * 0.25 * (0.35 + 0.65 * lateness);
    // the mood: a hot hand plays bolder; a cold run makes a careful mind more careful and a bold one bolder
    const moodTilt = c.mood > 0 ? 0.12 * c.mood : 0.12 * -c.mood * (st.risk - 0.5) * 2;
    sit.lateness = lateness;
    return {
      c, w, T, dt, info, level, L, st, sit, m6, K: m6 ? 2 : 4, swipeCap: L.swipeCap || 9, selfPass: !!L.selfPass || (st.street && level >= 3), W: c.w, skill: L.skill, hold: w.hold, ball: w.ball, prof: c.profile,
      def: clamp(L.defense * (sit.foeToWin <= 2 ? 1.25 : 1), 0, L.defense > 1 ? 2.5 : 1),      // (past 1 every answer is already certain: reach and speed stop growing at 1, where a longer lunge only loses position)
      lag: 0.32 * Math.max(0, 1 - L.defense),
      react: L.react, base: L.react,
      tap: dt * 2,
      risk: clamp(st.risk + scoreTilt + moodTilt, 0, 1), protect, chase,
      atk: w.hoops.find(h => h.team === c.team),        // the hoop it shoots at
      dfn: w.hoops.find(h => h.team !== c.team),        // the hoop it guards
      foeTeam: 1 - c.team,
    };
  }

  // ---------------------------------------------------------------- memory

  /** Watch what happens and keep the books: the opponent's tendencies and the fate of its own plays. */
  function observe(c, X) {
    const { w, info, prof, dfn } = X, s = c.seen, ball = w.ball, sh = ball.shot, score = info ? info.score : [0, 0];
    // the run of baskets: each one of ours warms the mood, each of theirs cools it; older ones fade
    for (const t of [0, 1]) if (score[t] > c.scoreSeen[t]) { c.mood = clamp(c.mood * 0.7 + (t === c.team ? 0.3 : -0.3), -1, 1); c.scoreSeen[t] = score[t]; }
    if (score[0] < c.scoreSeen[0] || score[1] < c.scoreSeen[1]) { c.scoreSeen = score.slice(); c.mood = 0; }   // a new match on the same controller
    // a swipe that won the ball within ~0.7 s counts as won
    if (X.hold && X.hold.p.team === c.team && c.tick - c.swipeAt < 45) { c.swipes.won++; c.swipeAt = -999; }
    // my dribble in the air last step, and now they hold it: that dribble was lost
    if (c.ownDribAir && X.hold && X.hold.p.team !== c.team) c.dribRec.lost++;
    const lb0 = w.lastBouncer;
    c.ownDribAir = !X.hold && !!lb0 && lb0.team === c.team && lb0.dribbleT > 0;
    // a foe shot that has finished: did it go in, and was it pressed?
    if (c.pending && ball.shot !== c.pending.shot) {
      const pd = c.pending, made = score[X.foeTeam] > pd.score, bucket = pd.pressed ? prof.pressed : prof.open;
      bucket.att++; if (made) bucket.made++;
      if (pd.band !== undefined) { const sc = c.scout[pd.band] || (c.scout[pd.band] = { att: 0, made: 0, perfect: 0 }); sc.att++; if (made) { sc.made++; if (pd.shot.perfect) sc.perfect++; } }
      // pressure that is working (they shoot worse pressed) is turned up a little; pressure that is not is eased off
      const pr = prof.pressed, op = prof.open;
      if (pr.att >= (X.m6 ? 2 : 3) && op.att >= (X.m6 ? 1 : 2)) {
        const gain = op.made / op.att - pr.made / pr.att;
        c.press = clamp(c.press + (gain > 0.1 ? (X.m6 ? 0.2 : 0.12) : gain < -0.1 ? -0.1 : 0), 0, 1);
      }
      c.pending = null;
    }
    if (sh && sh.team !== c.team && sh.kind !== 'dunk' && sh !== s.shot) {
      s.shot = sh; prof.shots++;
      const dist = Math.abs(sh.fromX - dfn.cx);
      prof.shotDist = prof.shots === 1 ? dist : lerp(prof.shotDist, dist, 0.25);
      if ((sh.fromX - w.lineX[sh.team]) * sh.dir < 0) prof.longShots++;   // (beyond the shooter's two-point line)
      const pressed = w.players.some(q => q.team === c.team && Math.abs(q.torso.position.x - sh.fromX) < 130);
      // the scouting record: their long shots by distance from our rim, in 100 px bands
      c.pending = { shot: sh, pressed, score: score[X.foeTeam], band: (sh.fromX - w.lineX[sh.team]) * sh.dir < 0 ? Math.floor(dist / 100) : undefined };
    }
    if (w.dunk && w.dunk.p.team !== c.team && w.dunk !== s.dunk) { s.dunk = w.dunk; prof.dunks++; }
    if (w.pass && w.pass.team !== c.team && w.pass !== s.pass) { s.pass = w.pass; prof.passes++; }
    const lb = w.lastBouncer;
    if (lb && lb.team !== c.team && lb.dribbleT > 0 && lb.lastDribble !== s.drib) { s.drib = lb.lastDribble; prof.dribbles++; }
    if (X.hold && X.hold.p.team !== c.team) {   // the way their carrier runs: toward our rim (+) or away, and which side of the court
      const f = X.hold.p, v = f.torso.velocity.x * f.dir;
      prof.drive = lerp(prof.drive, clamp(v / 3, -1, 1), 0.01);
      prof.side = lerp(prof.side, Math.sign(f.torso.position.x - w.cx), 0.01);
    }
    // my own plays
    if (c.myPending && ball.shot !== c.myPending.shot) {
      const mp = c.myPending, rec = c.mine[mp.kind], gotIt = score[c.team] > mp.score;
      rec.att++; if (gotIt) rec.made++;
      const k2 = mp.kind + (mp.pressed ? ':p' : ':o'), r2 = c.mineP[k2] || (c.mineP[k2] = { att: 0, made: 0 }); r2.att++; if (gotIt) r2.made++;
      if (mp.bait) { c.fakes.shots++; if (gotIt) c.fakes.made++; }
      c.myPending = null;
    }
    // an alley-oop lob of mine: it worked if a teammate's dunk off it starts within 3 s
    if (sh && sh.team === c.team && sh.lob && sh !== s.myLob) { s.myLob = sh; c.mine.lob.att++; c.lobPend = c.tick; }
    if (c.lobPend !== null && w.dunk && w.dunk.p.team === c.team && w.dunk.oop) { c.mine.lob.made++; c.lobPend = null; }
    if (c.lobPend !== null && c.tick - c.lobPend > 180) c.lobPend = null;
    if (sh && sh.team === c.team && sh.kind !== 'dunk' && !sh.lob && sh !== s.myShot) {
      s.myShot = sh;
      const kind = sh.kind === 'fade' ? 'fade' : (sh.fromX - w.lineX[sh.team]) * sh.dir < 0 ? 'long' : 'shot';
      const pressedMe = w.players.some(q => q.team !== c.team && Math.abs(q.torso.position.x - sh.fromX) < 130);
      c.myPending = { shot: sh, kind, score: score[c.team], bait: c.tick - c.afterFake < 150, pressed: pressedMe };   // a shot soon after a pump fake
    }
    if (w.dunk && w.dunk.p.team === c.team && w.dunk !== s.myDunk) { s.myDunk = w.dunk; c.myDunk = { score: score[c.team], d: w.dunk }; if (c.tick - c.selfCaughtAt < 150) c.selfStats.dunks++; }
    if (c.myDunk && w.dunk !== c.myDunk.d) { c.mine.dunk.att++; if (score[c.team] > c.myDunk.score) c.mine.dunk.made++; c.myDunk = null; }
  }

  /** What the opponent tends to do, and how sure it is (0 = unseen .. 1 = well established). */
  function tendencies(prof, k = 4) {
    const sh = prof.shots, du = prof.dunks, pa = prof.passes, n = sh + du;
    return {
      longShare: sh ? prof.longShots / sh : 0, dunkShare: n ? du / n : 0, passShare: n + pa ? pa / (n + pa) : 0,
      cShot: conf(sh, k), cDunk: conf(n, k), cPass: conf(n + pa, k),
    };
  }
  /** How much it lets what it has learned move it: its level's learning rate times the personality's reading. */
  const adaptOf = X => X.L.learn * X.st.read;
  /** Its own record with a play, as -0.5..+0.5 around even, trusted by how often it has tried it. */
  function form(c, kind, k = 4) { const r = c.mine[kind]; return r.att ? (r.made / r.att - 0.5) * conf(r.att, k) : 0; }
  /** How much its own record moves it: a Rookie barely notices how its plays go, a Legend keeps count (0.3 .. 1). */
  const learnOf = X => 0.3 + 0.7 * Math.min(1, X.L.learn);

  // ---------------------------------------------------------------- aiming

  /** The opponent nearest x. */
  function nearestFoe(w, team, x) { return nearest(w, 1 - team, x); }

  /**
   * Whether p may dribble here: a team with a dribble zone (w.dribZone: the CPU's, the middle third) only with its feet `margin` px
   * inside both edges and the ball inside it (out of the hand: the hand, where the catch puts it). The physics refuses a tap outside.
   */
  function dribZoneOk(w, p, margin = 15) {
    const z = w.dribZone && w.dribZone[p.team]; if (!z) return true;
    const fx = (p.legs[0].position.x + p.legs[1].position.x) / 2, bx = w.hold && w.hold.p === p ? w.ball.position.x : Physics.handPos(p).x;
    return fx >= z.lo + margin && fx <= z.hi - margin && bx >= z.lo + 5 && bx <= z.hi - 5;
  }
  /**
   * On the floor: touching something within the last two steps, with a foot (the bottom of a leg) within 8 px of the floor (not standing on a
   * head or the rim). A little inside what counts as off the floor (0.05 s, 10 px), since the pump leaves the hand a step or two later.
   */
  function onFloor(w, p) { return p.sinceGround <= 0.03 && p.legs.some(l => l.position.y + Math.abs(Math.cos(l.angle)) * p.dims.legL / 2 >= w.floorY - 8); }
  /**
   * A pump (a dribble out of a cocked shot) is allowed: dribbles left in the budget, not sitting, not under its own rim, inside its dribble
   * zone, the dribble's path clear of defenders (dribbleRisk, at every level: a fake is a dribble) and the feet on the floor (a pump thrown
   * from the air was taken). `air`: everything but the floor, for a pump decided in the air and held through the landing.
   */
  function canPump(c, X, p, air = false) {
    // EMERGENCY COOK RESET: a cock-back about to run out (80% charged, or 80% of the hold limit gone) may pump out of the dribble
    // zone to start over, as long as it is not over its own rim and the dribble's path is safe (both checked anyway below)
    const h = X.w.hold, emergency = !!h && h.p === p && (h.charge >= 0.8 || h.t >= 0.8 * X.T.ai_hold_limit);
    return c.dribs < Math.min(maxDribsOf(X.level), c.budget) && !Physics.seated(X.w, p, X.T) && !underOwnRim(c, X.w, X.T, p.torso.position.x) && !ownRimSoon(c, X.w, X.T)
      && (dribZoneOk(X.w, p) || emergency) && (air || onFloor(X.w, p)) && dribbleRisk(c, X, p) < 0.5;
  }

  /**
   * How likely a dribble from here is to be taken, 0..1: the dribble's own flight (its speed out of the hand, as bounce() throws
   * it, from the way the body leans) flown out for 28 steps, against each defender: a defender whose body is within 55 px of
   * where the ball goes is in the way (1), within 100 px could reach it with a step or a jump (0.5), and one already in the air
   * coming down near it counts double. The lower levels read it less well (scaled by skill).
   */
  function dribbleRisk(c, X, p) {
    const { w, T } = X, b = w.ball, dir = Physics.dribbleDir(w, p), steer = clamp(wrap(p.torso.angle) / Math.max(0.05, T.rock_angle), -1, 1);   // (a dribble goes toward the two-point line)
    const sx = dir * (0.45 + 0.55 * Math.max(0, steer * dir));
    const path = Physics.pathFrom(w, T, b.position.x, b.position.y, T.dribble_vx * (sx + 0.25 * dir), T.dribble_vy, 28);
    let risk = 0;
    for (const f of w.players) {
      if (f.team === c.team) continue;
      const fx = f.torso.position.x, air = f.sinceGround > 0.1 && f.torso.velocity.y > 0;
      let near = 1e9;
      for (const q of path) near = Math.min(near, Math.abs(q.x - fx));
      const r = near < 55 ? 1 : near < 100 ? 0.5 : 0;
      risk = Math.max(risk, Math.min(1, r * (air ? 2 : 1)));
    }
    return risk * (0.4 + 0.6 * X.skill);
  }

  /**
   * Where a floor pass (bounce key held for `ch` of bounce_charge_time) thrown from the held ball now comes back down:
   * the bounce's own velocity flown out (floor and walls) to its second floor contact, the end of its first hop.
   */
  function passLanding(X, p, ch) {
    const { w, T } = X, b = w.ball;
    const path = Physics.pathFrom(w, T, b.position.x, b.position.y, lerp(T.bounce_vx_min, T.bounce_vx_max, ch) * p.dir, lerp(T.bounce_vy_min, T.bounce_vy_max, ch), 160);
    let hits = 0;
    for (let i = 1; i < path.length; i++) if (path[i].vy < 0 && path[i - 1].vy >= 0) { if (++hits === 2) return path[i].x; }
    return path[path.length - 1].x;
  }

  /**
   * The charge of an outlet (a pass out from under its own rim, nobody there to take it). With a defender within 90 px
   * the quickest pass there is (the wind-up is when it is stolen). Otherwise each charge from 0.3 to 0.7 is flown out and
   * the one landing in the most open floor (far from defenders, near a teammate), and clear of its own rim, is thrown.
   */
  function outletCharge(c, X, p) {
    const { w, T, dfn } = X, quick = T.dribble_threshold + 0.05, px = p.torso.position.x;
    const foes = w.players.filter(q => q.team !== c.team), mate = w.players.find(q => q.team === c.team && q !== p);
    if (foes.some(f => Math.abs(f.torso.position.x - px) < 90)) return quick;
    let best = quick, bu = -1e9;
    for (let ch = 0.3; ch <= 0.701; ch += 0.05) {
      const x = passLanding(X, p, ch), clear = (x - dfn.cx) * p.dir - T.ai_own_rim_zone - 60;
      const open = Math.min(...foes.map(f => Math.abs(f.torso.position.x - x)));
      const u = Math.min(open, 260) - (mate ? 0.4 * Math.abs(mate.torso.position.x - x) : 0) - (clear < 0 ? 400 : 0) - ch * 30;
      if (u > bu) { bu = u; best = ch; }
    }
    return Math.max(quick, best);
  }

  /**
   * Hold a cocked shot and let go at the right moment (see the header). `a` is the aim state:
   * `off` is where it means to cross relative to the rim's centre (a little off at low skill),
   * `fade` says it is trying a fadeaway, which it starts from a lean back so the hop carries it away.
   */
  function aimStep(c, X) {
    const { w, T, dt, level, skill, base, react } = X, a = c.aim, hold = w.hold;
    a.t += dt;
    if (!hold || hold.p.team !== c.team) { c.aim = null; c.jump = false; return c; }   // the ball is gone
    const p = hold.p, dir = p.dir;
    if (a.easy) hold.easy = true;   // (set before any preview reads the line: the physics gives the easy shot its full aim help)
    say(c, a.txt);
    // a shot drifting under the basket it defends: never let go there. With the jump still down (the shot stays
    // cocked) it holds the bounce key for a medium pass, then lets both go: the bounce goes first, so the ball is passed out
    // In the air it passes nothing (a pass thrown up there, falling past its own rim, is how the ball went in its own
    // basket): the jump stays down, so the shot stays cocked and nothing leaves the hand, until the feet are down
    // (once it has drifted in it stays committed: a ball hovering at the zone's edge, read outside one step, left from inside the next)
    if (a.outPass !== undefined || a.ownRim || (hold.cocking && ownRimSoon(c, w, T) && !ownShotClear(c, X, p))) {
      if (a.outPass === undefined) { a.ownRim = true; say(c, 'OUTLET PASS FROM UNDER OUR RIM', true); if (p.sinceGround > 0.08) { c.jump = true; c.bounce = false; return c; } a.outPass = Math.round(outletCharge(c, X, p) * T.bounce_charge_time / dt); }
      if (a.outPass-- > 0) { c.jump = true; c.bounce = true; return c; }
      c.aim = null; c.jump = false; c.bounce = false; c.wait = X.react * 0.5; return c;
    }
    if (!hold.cocking) {                                  // not pressing yet: pick the moment
      // the jump key is still down from before the catch: the shot cannot charge until it has been let go once
      if (!hold.armed) { c.jump = false; if (a.t > 1) c.aim = null; return c; }
      if (hold.dunkReady || a.t > 2.5) { c.aim = null; c.jump = false; return c; }   // a dunk is on, or the moment never came
      // a fadeaway starts from a lean back; with a defender within reach of the ball it cannot wait long for one
      const reachFoe = w.players.some(q => q.team !== c.team && Math.abs(q.torso.position.x - p.torso.position.x) < 75);
      if (a.fade && !a.pressed && wrap(p.torso.angle) * dir > -0.25 && a.wait < (reachFoe ? 0.4 : level >= 5 ? 0.6 : 1.6)) { a.wait += dt; c.jump = false; return c; }
      a.pressed = true; c.jump = true; return c;
    }
    if (a.lob) {      // the alley-oop lob: the physics aims it at the board above the rim (hold.lob); it only has to be let go once up
      hold.lob = true; c.dbg.shot = { lob: true, charge: hold.charge };
      // let go once this arc reaches the board AND the teammate is set to go up for it, late enough that his jump
      // tops out as the ball gets there (the physics plans his jump from the flight: a flight shorter than his rise is a lob to nobody)
      const plan = hold.charge >= 0.3 ? Physics.lobPlan(w, T, p, hold.charge) : null, rcv = plan ? Physics.lobReceiver(w, T, p) : null;
      if (plan && rcv && plan.steps >= rcv.n) { c.aim = null; c.jump = false; c.wait = base * 0.4; return c; }
      if (hold.charge < 0.995 && a.t < 0.9) { c.jump = true; return c; }
      // it never came on: the same cock-back becomes a jump shot if a line is there, or it pumps out of it
      hold.lob = false; a.lob = false; a.txt = 'GOING UP FOR A JUMP SHOT'; say(c, 'NO LOB: TAKING THE SHOT', true);
      const pv0 = Physics.previewShot(w, T, p, hold.charge, level >= 5 ? 1 : 0);
      if (!(pv0.onTarget) && canPump(c, X, p, true)) { if (onFloor(w, p)) a.abort = 1; else a.pumpLand = true; c.jump = true; return c; }   // (up there the pump waits for the floor, see below)
      if (!pv0.onTarget) { c.aim = null; c.jump = false; c.wait = base * 0.4; return c; }   // (no dribble allowed: it goes anyway)
      c.jump = true; return c;
    }
    // HEIGHT (iteration 49): airK is 0 planted on the floor, 1 at the top of a full jump. The aim help the physics gives this shot (hold.assist) runs
    // from ai_ground_assist down to ai_air_assist, so a shot taken high is a worse shot and one taken from the floor a better one (the preview reads the same help)
    const airK = clamp((Math.max(0, w.floorY - Math.max(...p.legs.map(l => l.position.y + Math.abs(Math.cos(l.angle)) * p.dims.legL / 2))) - 8) / Math.max(40, T.jump_height), 0, 1);
    if (!a.easy && !a.lob) hold.assist = lerp(T.ai_ground_assist, T.ai_air_assist, airK);
    const pv = Physics.previewShot(w, T, p, hold.charge, level >= 5 ? 1 : 0);   // a Legend reads the line from where the ball will be when it leaves
    const fading = p.sinceGround > 0.1 && (p.torso.velocity.x * dir < -T.fade_speed || wrap(p.torso.angle) * dir < -T.fade_lean);
    c.dbg.shot = { err: pv.err, perfect: pv.perfect, charge: hold.charge };
    if (a.abort) {    // pumping out of a shot: bounce key down for a step, then both up, which dribbles the ball instead of shooting it
      if (a.abort === 1) { a.abort = 2; c.jump = true; c.bounce = true; c.dribs++; return c; }
      // (the release waits, both keys down, for the feet to be back on the floor: a body lifted meanwhile pumps nothing from the air. Not down
      // within 8 steps, while the bounce is still a dribble's, it lets the jump go with the bounce still down: the shot goes instead)
      if (!onFloor(w, p)) {
        if ((a.floorWait = (a.floorWait || 0) + 1) <= 8) { c.jump = true; c.bounce = true; return c; }
        c.aim = null; c.jump = false; c.bounce = true; c.wait = react * 0.5; return c;
      }
      c.aim = null; c.jump = false; c.bounce = false;
      // a fake waits for the defender it baited: until he has gone up and come back down (or, if he never went, 0.25 s), at most 0.5 s
      c.wait = a.fake ? 0.5 : base * 0.5;
      if (a.fake) { c.afterFake = c.tick; c.fakes.fakes++; c.fakeFoe = nearestFoe(w, c.team, p.torso.position.x); c.fakeUp = false; }
      return c;
    }
    // the bait: a defender near has jumped at a shot not yet let go. Pump (a dribble tap), let him land, then shoot.
    const jumper = w.players.some(q => q.team !== c.team && ((q.sinceGround > 0.12 && Math.abs(q.torso.position.x - p.torso.position.x) < 190)
      || (level >= 3 && Math.abs(q.torso.position.x - p.torso.position.x) < 150 && (p.torso.position.x - q.torso.position.x) * q.torso.velocity.x > 0 && Math.abs(q.torso.velocity.x) > 3)));   // (or a closer flying at it)
    if (jumper && !a.sawJump) { a.sawJump = true; c.foeReact.jumps++; }
    // ...or, to make room, it pumps first with a defender right on it, so he jumps at a shot that is not coming
    const closeFoe = w.players.some(q => q.team !== c.team && Math.abs(q.torso.position.x - p.torso.position.x) < 110);
    // (the fake is a dribble, and it goes forward: from level 4 never with a defender's hand right there in front)
    const handInFront = level >= 4 && w.players.some(q => q.team !== c.team && q.sinceGround < 0.1 && (q.torso.position.x - p.torso.position.x) * dir > -10 && (q.torso.position.x - p.torso.position.x) * dir < 70);
    // FEET ON THE FLOOR (iteration 46): a fake thrown down from the air was taken, so a fake decided up there is carried down: the cocked
    // ball is held through the landing (no release, not even on a line) and the fake goes once the feet are down, if it still may; else the shot goes
    const ground = onFloor(w, p);
    const fakeNow = why => { if (why === 'room') c.faked = true; a.fake = true; a.abort = 1; c.jump = true; c.fakeAt = c.tick; say(c, why === 'room' ? 'PUMP FAKE: MAKING ROOM' : 'PUMP FAKE: THE DEFENDER JUMPED', true); return c; };
    if (a.fakeLand) {
      if (!ground) { c.jump = true; return c; }
      const why = a.fakeLand; a.fakeLand = null; a.fakeRoll = false;
      if (canPump(c, X, p) && (why !== 'room' || !handInFront)) return fakeNow(why);
    }
    const roomFake = !jumper && closeFoe && !handInFront && a.fakeRoll && !a.fake && !c.faked && canPump(c, X, p, true) && hold.barmed && hold.charge > 0.35 && hold.charge < 0.6;
    const baitFake = jumper && a.fakeRoll && !a.fake && canPump(c, X, p, true) && hold.barmed && hold.charge > 0.2 && hold.charge < 0.85;
    if (roomFake || baitFake) { const why = roomFake ? 'room' : 'jumper'; if (ground) return fakeNow(why); a.fakeLand = why; c.jump = true; return c; }
    // the easy one: full aim help (physics hold.easy) puts every charge's line on the centre, so what it waits for is the arc: a flat one
    // clips the front rim from close in. It lets go on a perfect arc, or on one that goes in once it is high enough (read a step ahead, at every level)
    if (a.easy) {
      hold.easy = true;
      const pe = Physics.previewShot(w, T, p, hold.charge, 1);
      if (hold.charge >= 0.5 && (pe.perfect || (pe.onTarget && (hold.charge >= 0.65 || a.t > 0.9)))) { c.aim = null; c.jump = false; c.wait = react * 0.5; return c; }
      if (hold.charge < 0.995 && a.t < 1.4) { c.jump = true; return c; }
    }
    let off = a.slip !== undefined ? a.slip : a.off;   // a slipping Legend aims off like anyone else
    // ...and a.airNoise (this shot's own luck, -1 short .. +1 long) adds up to ai_air_miss px of aim error at the top of a jump, none from the floor
    if (!a.easy && !a.lob) { if (a.airNoise === undefined) a.airNoise = c.rng() * 2 - 1; off += a.airNoise * airK * T.ai_air_miss; }
    let release = (hold.charge >= 0.995 && !a.pumpLand) || a.t > 2.4;   // (a pump-out waiting for the floor is not let go at full cock)
    // the line on: from just short of its mark to a little past it. Past that (a fade's wait for its lean, a slow read), the
    // cock-back has carried it long: from level 4 it does not let a sure miss go but pumps out of it while it may dribble
    // (far out a step of cock-back moves the line a long way: a line that jumped over the window inside one step is let go now,
    // the closest it will get; only one that was already past last step counts as gone long)
    const past = pv.err !== null && pv.err > off + X.atk.span * 0.35 && a.prevErr !== undefined && a.prevErr !== null && a.prevErr > off + X.atk.span * 0.35;
    a.prevErr = pv.err;
    if (!release && pv.err !== null && pv.err >= off - 3 && (!past || level < 4)) {
      if (a.fade) release = fading || a.t > (level >= 5 ? 0.6 : 1.1);   // a fadeaway needs the body drifting or leaning away (from level 5: not for long, then it goes straight up)
      else release = true;
    }
    // (a pump is a dribble: from the air it is held until the landing, and goes then if it still may; the hold limit shoots it first)
    if (!release && ((past && level >= 4) || a.pumpLand) && !a.fake && canPump(c, X, p, true)) {
      if (!ground) { a.pumpLand = true; c.jump = true; say(c, 'LINE GONE LONG: PUMPING OUT', true); return c; }
      a.abort = 1; c.jump = true; say(c, 'LINE GONE LONG: PUMPING OUT', true); return c;
    }
    if (a.pumpLand && ground) release = true;   // down, and the pump is off now (no dribble left, a defender in its path, out of the zone): the shot goes
    // the level's hands: a lower level lets go up to releaseLag steps after the moment it picked (the cock-back keeps charging, so it goes long)
    if (release && X.L.releaseLag && !a.easy && hold.charge < 0.995) { if (a.lag === undefined) a.lag = Math.floor(c.rng() * (X.L.releaseLag + 1)); if (a.lag-- > 0) { c.jump = true; return c; } }
    if (release) { c.aim = null; c.jump = false; c.wait = react * 0.5; return c; }
    c.jump = true; return c;
  }

  // ---------------------------------------------------------------- offense

  /** It has the ball: score the options and take the best. */
  function offense(c, X) {
    const { w, T, hold, ball, level, L, skill, st, sit, react, tap, atk } = X;
    const p = hold.p, dir = p.dir, span = atk.span, px = p.torso.position.x;
    const mate = w.players.find(q => q.team === c.team && q !== p);
    const foes = w.players.filter(q => q.team !== c.team);
    const gap = (atk.cx - px) * dir;                                    // court side of the rim is positive
    const Xd = Math.abs(atk.cx - ball.position.x);

    // a defender up at the rim with a hand raised would swat the dunk: level 4+ waits for them to come down (or goes around)
    const rimFoe = foes.find(q => Math.abs(q.torso.position.x - atk.cx) < T.contest_range * 0.8);
    const foeUp = rimFoe && (rimFoe.sinceGround > 0.04 || Math.abs(rimFoe.torso.position.x - atk.cx) < 50);
    // how long it will wait one out: then it goes anyway (or around him)
    const protector = hold.dunkReady && foeUp && level >= 4;
    if (protector && c.rimWaitHold !== hold) { c.rimWaitHold = hold; c.rimWaitAt = hold.t; }
    const waited = protector ? hold.t - c.rimWaitAt : 0, waitCap = level >= 6 ? 1.6 : level >= 5 ? 1.0 : 0.8;
    const dunkNow = () => { c.jump = true; c.holdT = tap; c.dribs = 0; say(c, 'GOING UP FOR THE DUNK', true); return c; };
    if (protector && level < 5) {
      if (waited < waitCap && c.rng() < 0.5 + skill * 0.4) { c.wait = react * 0.3; say(c, 'WAITING OUT THE RIM PROTECTOR'); return c; }
      return dunkNow();
    }
    // at the rim a tap dunks, but not without a look: a showman (flash) or a shooter (range), or an open lob, may take something
    // flashier instead (the dunk joins the options below with a strong, plain worth; ego decides the rest)
    const dunkOpt = hold.dunkReady && !protector, ego = (st.flash - 1) + 0.5 * (st.range - 1);
    if (dunkOpt && ego <= 0.05 && hold.armed) return dunkNow();
    if (dunkOpt && !hold.armed) return dunkNow();
    // (a Legend or Mythic with a protector there reads its other options below first: see the end)
    if (!hold.armed || !hold.barmed) return c;                                      // let go once after the catch
    if (dunkOpt) { /* (the dunk is added as an option, see 'dunk' below) */ }

    const near = q => Math.min(...foes.map(f => Math.abs(f.torso.position.x - q.torso.position.x)));
    const foeNear = near(p) < 90, foeClose = near(p) < 150;
    const pressure = foeNear ? 1 : foeClose ? 0.5 : 0;
    // a screen: the teammate stands between the carrier and the nearest defender ahead, so the defender is slowed
    const ahead = foes.filter(f => (f.torso.position.x - px) * dir > 0).sort((a, b) => Math.abs(a.torso.position.x - px) - Math.abs(b.torso.position.x - px))[0];
    const screened = !!(mate && ahead && (mate.torso.position.x - px) * dir > 10 && (ahead.torso.position.x - mate.torso.position.x) * dir > 0 && Math.abs(mate.torso.position.x - px) < 120);
    // a defender baited by a pump fake is out of the play for a moment
    const baited = c.tick - c.afterFake < 90;
    const press = pressure * (screened ? 0.4 : 1) * (baited ? 0.35 : 1);
    const ownHalf = (ball.position.x - w.lineX[c.team]) * dir < 0;   // (beyond its two-point line: the name is from when it was the centre line)
    const far = Physics.previewShot(w, T, p, 1);
    const inRange = far.err !== null && far.err >= -span * 0.9;
    const qi = inRange ? quality(c, w, T, p) : { q: 0, width: 0 }, q = qi.q;
    const patience = Math.min(L.patience || PATIENCE, T.ai_hold_limit - 0.7);       // (the hold limit decides sooner than any level would)
    const urg = clamp((hold.t - 1.0) / Math.max(0.5, patience - 1.0), 0, 1);     // urgency: the longer it holds, the more it must act (there is no shot clock any more: a person may hold forever)
    const pts = Math.min(ownHalf ? 2 : 1, sit.toWin);                               // a basket past the winning mark is worth no more
    const noise = L.noise * st.wild;
    const ops = [];
    const add = (name, u, run, txt, minTicks = 0) => {
      let v = u + (c.rng() * 2 - 1) * noise;
      if (c.plan && c.plan.name === name && c.tick < c.plan.until) v += 0.15;      // a decision cooldown: it does not flip-flop
      ops.push({ name, u: v, run, txt, minTicks });
    };

    // ---- the shots
    const forgive = clamp(0.85 + qi.width * 2.5, 0.85, 1.15);   // a wide on-target window is an easier shot
    const pBase = (L.shotTrust || 1) * (q === 2 ? lerp(0.5, 0.93, skill) : q === 1 ? lerp(0.25, 0.55, skill) : 0.05) * (ownHalf ? 0.8 : 1) * (q ? forgive : 1);
    // roles (a tilt, never a rule): the man nearer the rim is the front man and leans to the drive; the one
    // behind his teammate leans to the shot from out there. (Both men move on the one key, so this is a taste.)
    const mateGap0 = mate ? (atk.cx - mate.torso.position.x) * dir : 1e9;
    const role = !mate ? 0 : gap < mateGap0 ? 1 : -1;          // +1 front, -1 back
    const roleTilt = 0.07 * X.W.role * (level >= 3 ? 1 : 0);
    // a rim protector at home (on the floor under our rim): the drive is worth less, a shot over him a little more
    const rimHome = level >= 3 && foes.some(f => Math.abs(f.torso.position.x - atk.cx) < T.contest_range && f.sinceGround < 0.05);
    // under (or beyond) the basket it DEFENDS: it never shoots from there, it always passes the ball out
    const underOwn = underOwnRim(c, w, T, px);
    // (under its own basket a shot is allowed again when its flight keeps clear of that rim and board: ownShotClear)
    const ownClear = !underOwn || ownShotClear(c, X, p);
    const takesShot = inRange && ownClear;   // every level takes a good shot (no level lines up for a perfect one)
    const anyTarget = inRange && q >= 1 && ownClear;            // some line from here can go in
    const urgS = (level >= 4 && q === 0 ? 0 : 0.4 * urg) + (w.hot === p && q >= 1 ? 0.15 : 0);   // (a hot hand shoots more)   // (from level 4 the clock pushes it to pass or drive, never into a shot with no line)
    const startAim = (kind, txt, forced = false) => () => {
      const noiseOff = (c.rng() * 2 - 1) * span * L.aimSpread;   // the level's own aim: up to aimSpread rim spans off
      const slipped = slip(c, X, 0.5);            // a rushed or misread shot: aimed well off, whoever it is
      c.foeReact.cocks++;
      // how likely a pump is: only from level 4; more against a defender who has jumped at its shots before; a showman likes it
      const rate = c.foeReact.jumps / Math.max(1, c.foeReact.cocks), seen = conf(c.foeReact.cocks, X.K);
      const fk = c.fakes, fakeForm = X.m6 && fk.shots >= 3 ? (fk.made / fk.shots - 0.45) * 0.6 : 0;   // a Mythic does more of what is working
      // (a Legend or Mythic also counts how many of its fakes got to a shot at all: a fake is a dribble, and one that keeps
      // losing the ball is made less, down to a fifth as often)
      const reach = level >= 5 && fk.fakes >= 4 ? clamp(1.5 * fk.shots / fk.fakes, 0.2, 1) : 1;
      const fakeP = level >= 2 ? reach * X.W.fake * clamp((L.fakeBase || FAKE_BASE[level - 1]) + 0.6 * rate * seen + 0.2 * (st.flash - 1) + (st.street ? 0.2 : 0) + 0.1 * (X.risk - 0.5) + fakeForm, 0, 0.85) : 0;
      c.aim = { t: 0, wait: 0, off: noiseOff + (slipped ? (c.rng() < 0.5 ? -1 : 1) * span * 0.4 : 0), fade: kind === 'fade', pressed: false, txt, fakeRoll: c.rng() < fakeP, forced };
      if (level >= 5 && slipped) c.aim.slip = (c.rng() < 0.5 ? -1 : 1) * 16;
      c.dribs = 0;
      return aimStep(c, X);
    };
    // what a shot is worth, from what it has seen: its own record of this kind of shot open or pressed, blended over the prior
    // by how much it has seen (level 3+; a lower level goes by feel)
    const learned = (kind, prior) => {
      const r = c.mineP[kind + (foeNear ? ':p' : ':o')];
      if (level < 3 || !r || !r.att) return prior;
      return lerp(prior, r.made / r.att, conf(r.att, X.K + 2) * learnOf(X) * 0.7);
    };
    // a still shot on its two-point line goes in at nearly any cock-back (Physics shotVelocity): it takes it the moment it has it
    const lineBonus = p.sinceGround < 0.06 && Math.abs(wrap(p.torso.angle)) <= T.line_sway_max && Math.abs(Physics.handPos(p).x - w.lineX[c.team]) <= T.line_zone ? 0.35 : 0;
    if (takesShot) {
      const pS0 = pBase * (1 - 0.3 * press);
      const pS = learned(ownHalf ? 'long' : 'shot', pS0);   // (pressure costs a shot less than it did: it shoots through a defender more readily)
      if (ownHalf) {
        const openLong = q >= 1 && near(p) > 200 ? (level >= 5 ? 0.15 : level >= 3 ? 0.08 : 0) : 0;   // left open out there, it takes the two
        const bonus = 0.2 * (st.range - 1) + (sit.behind >= 2 ? 0.15 : 0) + form(c, 'long', X.K) * 0.3 * learnOf(X) + (foeClose ? -0.1 : 0) + openLong;
        add('long', 0.1 + X.W.shot * pS * pts + bonus + lineBonus + urgS + (role < 0 ? roleTilt : 0), startAim('long', openLong ? 'OPEN: TAKING THE TWO' : 'TAKING A LONG SHOT FOR 2'), 'LONG');
      } else {
        add('shot', 0.1 + X.W.shot * pS * pts + lineBonus + form(c, 'shot', X.K) * 0.3 * learnOf(X) + (screened ? 0.1 : 0) + (baited ? 0.35 : 0) + urgS + (role < 0 ? roleTilt : 0) + (rimHome ? 0.05 : 0), startAim('shot', 'GOING UP FOR A JUMP SHOT'), 'SHOT');
      }
      // a fadeaway when a defender is on it IN FRONT (between it and the rim): the lean takes the ball away from his hand.
      // It drifts back as it goes, so it needs room behind: never toward the rim it defends (that is how a fade ended in its own basket)
      const front = foes.map(f => (f.torso.position.x - px) * dir).filter(d => d > -10 && d < 150);
      const room = (px - X.dfn.cx) * dir > T.ai_fade_room;
      if (level >= 3 && front.length && room && Xd < 700) {
        const pF = learned('fade', pBase * (1 - 0.2 * press) * 0.92), onIt = Math.min(...front) < 110;
        add('fade', 0.1 + X.W.shot * pF * pts + 0.18 * (st.flash - 1) + (level >= 5 && !onIt ? 0.08 : 0.2) + (baited ? 0.35 : 0) + form(c, 'fade', X.K) * 0.3 * learnOf(X) + urgS, startAim('fade', 'FADING AWAY FROM THE DEFENDER'), 'FADE');
      }
    }

    // ---- under or behind the basket: nothing works from there (no dunk, no shot), so it gets the ball out to the teammate
    const behind = gap < T.dunk_min_gap + 10;
    // ---- the dribble: it likes it. It brings the ball upcourt toward a dunk and keeps defenders guessing
    const maxDribs = maxDribsOf(level) + (st.street ? 2 : 0);
    const zone = T.dunk_ground_x;
    // NO DUNK OFF THE DRIBBLE: once it has dribbled, the physics gives it no dunk until the ball leaves it (a pass, a self-pass,
    // a shot). So nothing here plays for one: no waiting at the rim, no driving at it for a dunk; near the rim it shoots or gives it up
    const noDunk = !!p.dribbled;
    if (noDunk && gap < zone + 80 && !behind) say(c, 'NO DUNK OFF THE DRIBBLE: FINDING ANOTHER WAY');
    // a HARD cap: this possession's budget (BUDGETS, rolled when the ball is won), and never from a seated player
    // and only inside its dribble zone (the middle third, w.dribZone): outside it the pass, the shot, the lob, the self-pass and the outlet take over
    if (c.dribs < Math.min(maxDribs, c.budget) && !underOwn && !Physics.seated(w, p, T) && dribZoneOk(w, p)) {   // (anywhere on the court, the rim included, but under its own rim it passes, never dribbles)
      const progress = clamp((gap - zone) / 500, 0, 1);
      const reach = foeNear ? 0.3 : foeClose ? 0.6 : 0.85;
      let u = X.W.dribble + 0.5 * clamp(st.attack * 0.62, 0, 1) * reach * (0.4 + 0.6 * progress);   // the standing taste for it is W.dribble
      u -= (1 - X.risk) * 0.35 * X.W.risk * (foeNear ? 1 : foeClose ? 0.4 : 0);                           // a steal risk, dearer to a careful player
      u -= 0.015 * c.dribs + 0.5 * urg;
      if (X.protect) u += 0.1;                                                                  // ahead near the end: run the clock
      u += (role > 0 ? roleTilt : 0) + 0.25 * form(c, 'dunk') * learnOf(X) - (rimHome ? 0.1 : 0);    // the front man drives; my dunks going in (or not) move it
      if (behind) u -= 0.25;                                                                    // (behind the basket a dribble goes nowhere)
      // THE TWO-POINT LINE (iteration 50): a dribble now carries it toward its line, from either side, and a still shot on the line is the
      // easiest one there is. So a dribble is worth taking to get there, and not once it is there; and one that would carry it back
      // away from a rim it is closing on is worth much less
      const lineGap = Math.abs(w.lineX[c.team] - px), away = Physics.dribbleDir(w, p) * dir < 0;
      u += lineGap > 30 ? 0.3 * clamp(lineGap / 220, 0, 1) : -0.45;
      if (away) u -= 0.3 + (gap < zone + 200 ? 0.3 : 0);
      if (st.street) u += 0.3;                                                                  // (street ball: the handle is the show)
      if (noDunk) u -= 0.3 * (1 - progress) + 0.15;                                              // (no dunk at the end of this drive: dribbling on is worth less, the nearer the rim the less)
      // dribbles of mine lost near a defender: dribbling into one is worth less (learned)
      const dl = c.dribRec, lossRate = dl.n ? dl.lost / dl.n : 0;
      if (foeClose) u -= 0.5 * lossRate * conf(dl.n / 3) * learnOf(X) * (foeNear ? 1 : 0.5);
      u -= dribbleRisk(c, X, p) * (level >= 3 ? 0.6 : 0.3);                                  // (a dribble into a defender's hands: it reads the path first)
      if (screened) u += 0.25;                                                                 // (pick and roll: off the screen, turn the corner)
      add('dribble', u, () => { c.bounce = true; c.bholdT = tap; c.dribs++; c.dribRec.n++; say(c, st.street && lineGap <= 30 ? 'STREET BALL: SHOWING OFF THE HANDLE' : lineGap > 30 ? 'DRIBBLING TO THE 2-POINT LINE' : 'DRIVING TO THE RIM'); return c; }, 'DRIB', 24);
    }

    // ---- the self-pass, from about halfway to the rim: it throws the ball ahead, hops after it, takes it out of the air near the rim
    // itself and dunks (about 7 in 10 from 310-400 px out in the empty-lane test; further out the catch comes too late). It needs a
    // clear lane: the ball is loose on the floor on the way, so nobody may stand between it and the rim.
    if (X.selfPass && !behind && c.tick > c.selfCool && p.sinceGround < 0.1 && gap >= 270 && gap <= 480 && !foes.some(f => { const fx = (f.torso.position.x - px) * dir; return fx > 20 && fx < gap + 40; })) {   // (from level 4, a wider window than the tested 310-420)
      const ss = c.selfStats, rate = ss.tries >= 3 ? ss.dunks / ss.tries : 0.45;   // its own record with the play
      const u = 0.9 + 0.6 * (rate - 0.4) * conf(ss.tries, 2) + 0.2 * (st.flash - 1) + 0.2 * (st.attack - 1) + (st.street ? 0.35 : 0);
      add('self', u, () => {
        const ch = c.selfCharge || clamp(0.62 + (gap - 270) / 1000, 0.62, 0.86) - 0.05 * clamp((gap - 380) / 40, 0, 1);   // (measured: 0.8 from 310-380 px out, 0.75 a little further; selfCharge lets a test override it)
        c.selfLast = { gap: Math.round(gap), ch };
        c.bounce = true; c.bholdT = ch * T.bounce_charge_time; c.dribs = 0; c.selfCool = c.tick + 120; c.selfStats.tries++;
        c.self = { t0: c.tick, from: p, thrown: false };
        say(c, 'SELF-PASS: THROWING IT AHEAD', true); return c;
      }, 'SELF');
    }

    // ---- the pass
    let catchableMate = false;
    if (mate && level >= 2) {
      const mx = mate.torso.position.x, mateGap = (atk.cx - mx) * dir;
      const open = clamp(Math.min(...foes.map(f => Math.abs(f.torso.position.x - mx))) / 220, 0, 1);
      const mateAhead = (mx - px) * dir > 40;
      const adv = clamp((gap - mateGap) / 300, -0.5, 1);
      const mateAtRim = mateGap >= T.dunk_min_gap && mateGap <= T.dunk_reach_x * T.oop_bonus;
      const runner = mateAhead && adv > 0.5 && !foes.some(f => (f.torso.position.x - mx) * dir > 0 && (atk.cx - f.torso.position.x) * dir > -10);   // a fast break: nobody back
      const passTo = (txt, lead = 0) => () => {
        c.bounce = true; c.dribs = 0;
        c.bholdT = passHold(T, Math.abs(mx - px) + lead) * (1 + (c.rng() * 2 - 1) * (1 - skill) * 0.18);   // the lower levels throw a little wide
        if (slip(c, X, 0.5)) c.bholdT *= 1 + (c.rng() < 0.5 ? -1 : 1) * (0.08 + 0.3 * (1 - skill));   // a slip: well wide (a Legend: a touch)
        say(c, txt, true); return c;
      };
      // PASS GATE (a pass to nothing is a wasted possession, so it is a last resort, and only to a man who can take it):
      //  - never when a dunk or a jump shot that can go in exists (dunkReady already returned above; here the shot, and a dunk
      //    the carrier is about to be in the zone for). Only when no line works (q === 0: out of range / nothing on target,
      //    which takesShot already excludes)
      //  - the ball is thrown forward only (physics bounce: p.dir), so the teammate must be AHEAD of the carrier, never behind
      //    him (that includes a carrier stuck behind the basket: he has no way to throw it back)
      //  - within the throw: passHold tops out at ~420 px of travel (a runner coming onto it gets a little more), and
      //    not so close that the ball is out of the hand box; and on the ground (a jumping man cannot take a floor pass)
      const shotViable = takesShot && q >= 1, dunkSoon = !p.dribbled && !behind && gap < zone + 60 && hold.t < 2.4;
      const leadX = level >= 5 ? clamp(mate.torso.velocity.x * dir * 18, -50, 90) : 0;
      const reachX = (mx - px) * dir + leadX, maxPass = 440 + (runner ? (level >= 5 ? 170 : 120) : 0);   // (a Legend or Mythic leads the receiver by where he is running)
      const catchable = mateAhead && reachX >= 60 && reachX <= maxPass && mate.sinceGround < 0.12;
      catchableMate = catchable && Math.abs(mx - px) < 800;
      // the give-and-go: the teammate passed to it and cut for the rim; the ball straight back to him (on the floor, or coming down to it) is caught as an alley-oop and dunked
      const cutter = !!w.cut && w.cut.p === mate && w.time < w.cut.until;
      // (thrown to where he will be: he is mid-run, and a pass is taken off the legs or chest, in the air or not)
      // and only once he will be within dunk reach of the rim when it gets there (an alley-oop catch's reach): caught further out it is just a pass
      const cutX = mx + mate.torso.velocity.x * 20, cutReach = (cutX - px) * dir, cutGap = (atk.cx - cutX) * dir;
      const cutOk = cutter && cutReach >= 40 && cutReach <= maxPass && cutGap <= T.dunk_ground_x * T.oop_bonus + 30;
      if (cutOk && level >= 2 && !underOwn) add('pass', (level >= 3 ? 2.1 : 0.9) + 0.15 * open + (w.hot === mate ? 0.1 : 0), passTo('GIVE-AND-GO: HITTING THE CUTTER', Math.max(0, cutReach - reachX)), 'GIVEGO');
      // he is still on his way in: hold it a moment for him (not with a defender on it, nor for longer than the cut lasts)
      else if (cutter && level >= 3 && !underOwn && !foeNear && w.cut.until - w.time > 0.3 && (mate.torso.velocity.x * dir > 1 || mate.sinceGround < 0.1))
        add('wait', cutGap < 260 ? 1.9 : 0.95, () => { c.wait = X.react * 0.5 + 0.05; say(c, 'GIVE-AND-GO: WAITING FOR THE CUTTER'); return c; }, 'WAIT');   // (nearly there: that beats any shot)
      // pass and cut: from far out, a pass to a teammate ahead sets up the give-and-go (he cuts as soon as it is caught)
      const ggSetup = level >= 3 && gap > zone + 150 && gap < zone + 480 && mateGap > zone + 20 && open > 0.25 && !cutter;
      // a hot teammate (a heat check) is fed
      const hotMate = w.hot === mate;
      // how good each spot is: mine (the shot I have, or the dunk I am about to get) against his (open, and near
      // enough the rim to dunk or shoot). A carrier in a bad spot gives it up to a teammate in a better one.
      const mine = Math.max(takesShot ? pBase * pts * (1 - 0.3 * press) : 0, dunkSoon ? 0.8 : 0);
      const theirs = open * (mateGap >= T.dunk_min_gap && mateGap <= zone + 60 ? 0.85 : clamp(1 - mateGap / 700, 0, 0.7));
      const better = theirs > mine + 0.3 && open > 0.5, pressedPoor = foeNear && !anyTarget && !dunkSoon;   // (a clear gain only: a pass is a turnover risk)
      if (Math.abs(mx - px) < 800) {
        if (catchable && (underOwn || (!shotViable && !dunkSoon) || pressedPoor || better || ggSetup || (hotMate && open > 0.4 && !dunkSoon))) {
          let u = (behind ? 0.7 : 0.18) + 0.3 * Math.max(0, theirs - mine) + (pressedPoor ? 0.1 : 0) + 0.42 * open * Math.max(0, adv) + 0.28 * pressure * open * (mateAhead ? 1 : 0.3) + 0.2 * (st.pass - 1) - (1 - X.risk) * 0.3 * X.W.risk * (1 - open) + 0.4 * urg;
          u *= X.W.pass;
          let txt = better || pressedPoor ? 'PASSING OUT OF A BAD SPOT' : 'PASSING TO THE OPEN TEAMMATE';
          let lead = 0;
          if (ggSetup && !better && !pressedPoor) { u = Math.max(u, (0.7 + 0.15 * (st.pass - 1) + (level >= 5 ? 0.1 : 0)) * X.W.pass); txt = 'GIVE-AND-GO: PASS AND CUT'; }   // (a play of its own: the pass, the cut, the ball straight back)
          if (hotMate) { u += 0.3; txt = 'FEEDING THE HOT HAND'; }
          if (runner && hold.t < 2.5) { u += 0.3 * st.scav + (level >= 5 ? 0.1 : 0); txt = 'FAST BREAK: FEEDING THE RUNNER'; lead = Math.max(0, leadX); }   // (thrown to where he will be)
          if (underOwn) { u = Math.max(u, 1.2); txt = 'OUTLET PASS FROM UNDER OUR RIM'; }   // under the basket it defends: always out
          add('pass', u, passTo(txt, lead), 'PASS');
        }
        // the alley-oop: a teammate waits near the rim, so the ball is lobbed up onto the backboard above it for him to take out of the air
        // the alley-oop: the carrier goes up and lobs it onto the backboard above the rim; the teammate's jump is timed to it
        // (the physics plans his take-off, as it does a dunk's), and he dunks it out of the air
        const lg = L.lobGuard !== undefined ? L.lobGuard : T.ai_lob_guard;
        const lobSafe = !lg || !foes.some(f => Math.abs(f.torso.position.x - atk.cx) < lg);   // a defender under the board would take it
        if (level >= 4 && lobSafe && !underOwn && mateAhead && gap > 160 && Physics.lobPlan(w, T, p, 1, 110) && Physics.lobReceiver(w, T, p)) {
          add('lob', (screened ? 0.3 : 0) + X.W.lob * (0.78 + 0.35 * open + 0.25 * (st.pass - 1) + 0.25 * (st.flash - 1) + (st.street ? 0.25 : 0) + 0.3 * (L.skill - 0.5) + (runner ? 0.15 : 0) + form(c, 'lob', X.K) * 0.4 * learnOf(X)),
            () => { c.aim = { t: 0, wait: 0, off: 0, fade: false, pressed: false, lob: true, txt: 'ALLEY-OOP: LOBBING IT OFF THE BOARD' }; c.dribs = 0; return aimStep(c, X); }, 'LOB');
        }
      }
    }

    // ---- the outlet, when nobody is ahead to take a pass: under the basket it defends (it never shoots from there), or
    // stuck lining up with nothing on target. A Legend or Mythic throws it ahead and goes after it (a self-pass);
    // below that it throws a medium pass off the wall and plays the rebound.
    // A self-pass needs a clear spot and the court in front (from behind its own rim the hop after it would carry it over that rim):
    // thrown short, the lowest charge whose landing clears the rim zone, so the wind-up is quick and the ball stays near
    const beyondOwn = (px - X.dfn.cx) * dir < 0;
    const selfOk = level >= 5 && !beyondOwn && !foes.some(f => Math.abs(f.torso.position.x - px) < 120);
    const outlet = () => {
      c.bounce = true; c.dribs = 0;
      if (selfOk) {
        let ch = 0.5;
        for (let k = 0.35; k <= 0.501; k += 0.05) if ((passLanding(X, p, k) - X.dfn.cx) * dir > T.ai_own_rim_zone + 60) { ch = k; break; }
        c.bholdT = ch * T.bounce_charge_time; c.selfCool = c.tick + 120; c.selfStats.tries++;
        c.self = { t0: c.tick, from: p, thrown: false, outlet: true };
        say(c, 'SELF-PASS: THROWING IT AHEAD', true);
      } else { c.bholdT = outletCharge(c, X, p) * T.bounce_charge_time; say(c, 'PASSING IT OFF THE WALL', true); }
      return c;
    };
    if (underOwn && !catchableMate) add('outlet', 1.0, outlet, selfOk ? 'SELF' : 'WALL');
    else if (hold.t > patience + 0.5 && !anyTarget && !catchableMate && !ops.some(o => o.name !== 'wait')) add('outlet', 5, outlet, selfOk ? 'SELF' : 'WALL');   // (no other option left: in place of the forced shot)

    // ---- waiting: near or under the rim and not yet dunk-ready no shot works, so the swing carries it into the zone
    const inZone = !noDunk && !behind && gap < zone + 60 && hold.t < 2.4 && !(far.err !== null && gap > zone + 20 && level < 3);
    add('wait', inZone ? 0.78 - 0.5 * urg : 0.14 - 0.3 * urg, () => { c.wait = react * 0.5; say(c, inZone ? 'WAITING FOR THE DUNK' : 'LOOKING FOR AN OPENING'); return c; }, 'WAIT', 12);

    // the way out: held too long with nothing but waiting on offer (no line on, nobody to pass to, dribbles used up):
    // with no shot clock to force it, it takes the shot anyway rather than stand there
    if (hold.t > patience + 0.5 && anyTarget && !ops.some(o => o.name !== 'wait')) add('shot', 5, startAim('shot', 'TAKING THE SHOT: NOTHING ELSE IS OPEN', X.m6), 'FORCED');
    if (dunkOpt) add('dunk', 1.35 - 0.25 * ego, dunkNow, 'DUNK');   // (a routine dunk: strong, but a flashy style may go past it)
    // ---- the easy one: at or under the rim with no dunk (it dribbled, or the dunk is not there) a soft short shot for 1, aimed
    // far more tightly than any other shot at every level (see aimStep: a.easy), instead of dribbling up to a dunk it cannot have
    const nearRim = !behind && gap < zone + 150 && gap >= T.dunk_min_gap && !dunkOpt;
    // (its line is read with the help the easy shot will get: close in the ordinary preview often has no line at all)
    const easyLine = () => { if (!w.hold) return false; const was = w.hold.easy; w.hold.easy = true; let ok = false; for (let ch = 0.3; ch <= 1.0001 && !ok; ch += 0.05) ok = Physics.previewShot(w, T, p, ch).onTarget; w.hold.easy = was; return ok; };
    const easyTime = hold.t < T.ai_hold_limit - 0.32 - 0.7 * T.shot_charge_time - 0.15;   // (time left to cock it to its arc before the hold runs out)
    if (nearRim && ownClear && easyTime && easyLine()) add('easy', 1.0 + (p.dribbled ? 0.45 : 0.15) + (q >= 1 ? 0.2 : 0) - 0.2 * pressure, () => {
      c.aim = { t: 0, wait: 0, off: (c.rng() * 2 - 1) * span * L.aimSpread * 0.12, fade: false, pressed: false, txt: 'EASY ONE: SOFT SHOT', fakeRoll: false, easy: true };
      c.dribs = 0; c.foeReact.cocks++; return aimStep(c, X);
    }, 'EASY');
    if (behind) say(c, 'BEHIND THE BASKET: GETTING OUT OF IT');
    if (protector) {   // a Legend or Mythic at the rim with a protector up: an open pass, a lob or a shot over him if one is good, else wait him out (for a while), else dunk
      const alt = ops.filter(o => ['pass', 'lob', 'fade', 'shot'].includes(o.name) && o.u > 0.8).sort((a, b) => b.u - a.u)[0];
      if (alt) { c.plan = { name: alt.name, until: c.tick + alt.minTicks }; return alt.run(); }
      if (waited < waitCap) { c.wait = react * 0.3; say(c, 'WAITING OUT THE RIM PROTECTOR'); return c; }
      return dunkNow();
    }
    ops.sort((a, b) => b.u - a.u);
    c.dbg.ops = ops.map(o => [o.txt, +o.u.toFixed(2)]);
    let best = ops[0];
    // and past its patience, waiting never wins, even when something else is on offer but scores lower (a dribble
    // past its budget, say: that is how iteration 28 stalled, and how this one did at seed 128 before this line):
    // it takes the best thing that is not waiting
    if (best.name === 'wait' && hold.t > patience + 0.5) best = ops.find(o => o.name !== 'wait') || best;
    // a person commits: a choice is held a while (longer at levels 3-4), and a Pro with two near-equal options hesitates a moment first
    c.plan = { name: best.name, until: c.tick + best.minTicks + (level === 3 ? 14 : level === 4 ? 10 : level === 5 ? 6 : 0) };
    const second = ops.find(o => o !== best);
    if (level === 3 && second && best.u - second.u < L.noise * 0.5 && c.hesitated !== hold && hold.t < 1.5) { c.hesitated = hold; c.wait = 0.12; say(c, 'THINKING IT OVER'); return c; }
    return best.run();
  }

  // ---------------------------------------------------------------- defense

  /**
   * What the carrier is about to do, as far ahead as this level can see.
   * shoot: steps until the cocked shot leaves (it is let go when the line is on). dunk: steps until
   * they are in the dunk zone. pass: 0..1 how likely a pass is now. conf: how sure the read is.
   */
  function threat(c, X, foe) {
    const { w, T, hold, L, prof, dfn } = X, look = L.look;
    const th = { shoot: null, dunk: null, pass: 0, conf: 0 };
    const dir = foe.dir, fx = foe.torso.position.x, vx = foe.torso.velocity.x;
    if (look > 0 && hold.cocking) {
      const dc = X.dt / T.shot_charge_time;
      for (let k = 0; k <= look; k++) {
        const ch = Math.min(1, hold.charge + k * dc), pv = Physics.previewShot(w, T, foe, ch);
        if ((pv.err !== null && pv.err >= 0) || ch >= 1) { th.shoot = k; break; }
      }
      th.conf = 0.6;
    }
    if (look > 0) {
      if (hold.dunkReady) th.dunk = 0;
      else for (let k = 0; k <= look; k++) {
        const gap = (dfn.cx - (fx + vx * k)) * dir;
        if (gap >= T.dunk_min_gap && gap <= T.dunk_reach_x) { th.dunk = k; break; }
      }
      if (th.dunk !== null && vx * dir < 0.2) th.dunk = null;                  // not actually running at the rim
    }
    const tn = tendencies(prof, X.K);
    const mate = w.players.find(q => q.team === foe.team && q !== foe);
    const crowded = w.players.some(q => q.team === c.team && Math.abs(q.torso.position.x - fx) < 110);
    const mateAhead = mate && (mate.torso.position.x - fx) * dir > 40;
    th.pass = hold.bouncing && hold.bcharge >= T.dribble_threshold ? 1 : clamp(0.1 + tn.passShare * tn.cPass * 0.5 + (crowded && mateAhead ? 0.25 : 0), 0, 0.7);
    return th;
  }

  /** What a shot from where THEY stand could be (the same sweep as quality(), run on the carrier): it sees the lines they see. */
  function foeQuality(c, w, T, foe) {
    if (c.fqCache && c.fqCache.tick > c.tick - 4 && c.fqCache.p === foe) return c.fqCache;
    let q = 0;
    for (let ch = 0.3; ch <= 1.0001; ch += 0.05) { const v = Physics.previewShot(w, T, foe, ch); if (v.perfect) { q = 2; break; } if (v.onTarget) q = 1; }
    c.fqCache = { tick: c.tick, p: foe, q };
    return c.fqCache;
  }

  /**
   * The long-shot threat (level 3+): the carrier is in his own half (a basket from there is worth two). How dangerous a shot
   * from here is: the line he has (perfect 1, on target 0.6), plus what the scouting record says of this distance (how many
   * of his long shots from it went in), trusted by how much it has seen and how much this level learns. 0..1.5.
   */
  function longThreat(c, X, foe) {
    const { w, T, dfn, level } = X;
    if (level < 3 || (foe.torso.position.x - w.lineX[foe.team]) * foe.dir >= 0) return 0;
    const fq = foeQuality(c, w, T, foe).q, dist = Math.abs(foe.torso.position.x - dfn.cx), sc = c.scout[Math.floor(dist / 100)];
    let tv = fq === 2 ? 1 : fq === 1 ? 0.6 : 0;
    if (sc && sc.att) tv += (sc.made / sc.att - 0.3) * 0.8 * conf(sc.att, X.K) * Math.min(1, X.L.learn);
    return clamp(tv, 0, 1.5);
  }

  /**
   * Close out a long shooter: the spot in front of him (between him and our rim) a hand's reach away, led by his drift.
   * When it closes out depends on the level: L3 only on a perfect line once the shot is cocked, L4 on any line on target,
   * L5+ also on a spot the scouting says he hits from, before he cocks. A closeout can overcommit (a lower level more often:
   * the level's slip): it flies past him, and a fake or a drive beats it. Returns the target x, or null.
   */
  function closeoutTarget(c, X, foe, hold) {
    const { level } = X, tv = longThreat(c, X, foe), fq = c.fqCache ? c.fqCache.q : 0;
    const on = level === 3 ? fq === 2 && hold.cocking : level === 4 ? tv >= 0.6 : tv >= 0.55;
    if (!on) { c.closeout = null; return null; }
    if (!c.closeout || c.closeout.p !== foe) c.closeout = { p: foe, over: slip(c, X, 1.5) };
    const lead = foe.torso.velocity.x * 10;
    return foe.torso.position.x + lead + foe.dir * (c.closeout.over ? -30 : 70);
  }

  /** Where it wants to stand: between the carrier and its rim, nearer the rim the more they dunk, nearer them the more they shoot long. */
  function stanceTarget(c, X, foe, th) {
    const { prof, dfn, L } = X, tn = tendencies(prof, X.K), adapt = adaptOf(X);
    let frac = X.W.stand;
    frac += adapt * (tn.cDunk * tn.dunkShare * 0.4 - tn.cShot * tn.longShare * 0.3);
    if (th && th.dunk !== null && th.dunk <= L.sagWithin) frac = Math.max(frac, 0.6);   // a dunk is coming: sag back to the rim
    // a carrier running at the rim from a way off: get under it early, the swing is slow (they cannot be caught after)
    const toRim = (dfn.cx - foe.torso.position.x) * foe.dir;
    if (L.look >= 22 && toRim > 0 && toRim < 420 && foe.torso.velocity.x * foe.dir > 0.4) frac = Math.max(frac, 0.55);
    if (L.rimGuard && toRim > 0 && toRim < L.rimGuard) frac = Math.max(frac, L.guardFrac - adapt * tn.cShot * tn.longShare * 0.25);   // near the rim: defend it (less so against a man who shoots long)
    if (X.m6) frac += adapt * 0.12 * clamp(prof.drive, 0, 1) * conf(prof.dribbles, X.K);   // the Mythic has seen which way they drive: a driver is met nearer the rim
    frac -= c.press * 0.15;                                                       // pressure that works: closer
    if (X.w.hot === foe) frac -= 0.1;                                             // a hot hand is met closer
    frac += (0.5 - X.st.risk) * 0.12;                                             // a careful mind sags, a bold one steps up
    // where they like to shoot from (learned): inside that range, step up to the shooter rather than sit on the rim
    const fx = foe.torso.position.x, dist = Math.abs(dfn.cx - fx), sd = prof.shotDist;
    const inTheirRange = tn.cShot > 0.3 && sd > 0 && dist > sd * 0.6 && dist < sd * 1.2 + 40;
    if (inTheirRange && !(th && th.dunk !== null)) frac -= adapt * tn.cShot * 0.14;
    frac = clamp(frac, 0.08, 0.7);
    // where they are going, not where they are; against a carrier who keeps driving at the rim (learned) it leads further
    const towardRim = foe.torso.velocity.x * foe.dir > 0;
    const driveLead = 1 + (towardRim ? adapt * clamp(prof.drive, 0, 1) * 0.6 : 0);
    const lead = L.look > 0 ? foe.torso.velocity.x * Math.min(L.look, 20) * 0.4 * driveLead : 0;
    return { x: fx + lead + (dfn.cx - fx) * frac, frac, inTheirRange };
  }

  /** They have the ball: read them and answer before they act. Returns true when it acted. */
  function defense(c, X) {
    const { w, T, hold, L, def, lag, st } = X, foe = hold.p;
    const mine = w.players.filter(q => q.team === c.team);
    const gap = Math.min(...mine.map(q => Math.abs(q.torso.position.x - foe.torso.position.x)));
    const th = threat(c, X, foe); c.threat = th; c.dbg.threat = th;
    const press = (1 + c.press * 0.8) * X.W.press;         // pressure that is working makes it likelier to swing
    const jumpUp = (len, txt) => { c.jump = true; c.holdT = len; say(c, txt, true); return true; };
    const lead = Math.min(L.look, 14);                      // the jump takes about this long to get a hand up
    c.dribs = 0;
    // a dunk is coming at our rim: jump with a straight arm to meet it (a hand or the head on the ball swats it away)
    if (w.dunk && !w.dunk.slammed && w.dunk.p === foe) {
      const rimX = w.dunk.hoop.cx, cand = mine.slice().sort((q1, q2) => Math.abs(q1.torso.position.x - rimX) - Math.abs(q2.torso.position.x - rimX))[0];
      // from level 5 it goes when the slam is as many steps away as its own jump takes to get the hand up there (a leap
      // made at once is often on its way down by then); the dunk's plan says when the slam comes
      const dk = w.dunk, left = dk.plan ? dk.plan.n - dk.steps : 12 - dk.steps;
      const hr = X.level >= 5 && cand ? handRise(X, cand, 40) : null;
      const riseN = hr ? Math.max(1, hr.findIndex((h, k) => k > 0 && h.y >= hr[k - 1].y)) : 0;   // steps to the top of its jump
      const timed = !hr || left <= riseN + 1 || dk.t > 0.35;
      if (cand && timed && Math.abs(cand.torso.position.x - rimX) < T.contest_range && defend(c, w, 'swat', true, def * 1.5 * st.guard * press, lag, X)) return jumpUp(0.32, 'SWATTING THE DUNK');
    } else delete c.rolls.swat;
    // the carrier is closing on our rim: from level 3 it sees that coming and is up early, before the prompt
    // (a leap long before the dunk starts comes down before the ball goes up: only the Mythic times it, and leaves the ground `rimLead` steps ahead of the carrier being ready)
    const dunkSoon = hold.dunkReady || (L.rimLead > 0 && th.dunk !== null && th.dunk <= L.rimLead);
    const underRim = mine.some(q => Math.abs(q.torso.position.x - X.dfn.cx) < T.contest_range);   // a leap from across the court gets nothing
    if (defend(c, w, 'rim', dunkSoon && underRim, def * 1.2 * st.guard * press, lag, X)) return jumpUp(0.3, 'READING THE DUNK: UP EARLY');
    // a shot being cocked nearby: from level 4 it times the jump to the release it predicts; lower levels jump at a half-cocked shot
    const stand = stanceTarget(c, X, foe, th);
    const reach = 120 + 90 * Math.min(def, 1) + (stand.inTheirRange ? 40 * adaptOf(X) : 0);   // their favourite spot: closed out from further
    const predicted = th.shoot !== null && th.shoot <= lead;
    const early = L.look < 14 && hold.cocking && hold.charge > 0.4;
    // a long shot (level 4+): fly its early path from the release it predicts, and jump when a raised hand meets it on the way up
    if (X.level >= 4 && hold.cocking && th.shoot !== null && (foe.torso.position.x - w.lineX[foe.team]) * foe.dir < 0) {
      const k0 = th.shoot, b = w.ball, ch = Math.min(1, hold.charge + k0 * X.dt / T.shot_charge_time);
      const from = { x: b.position.x + b.velocity.x * k0, y: b.position.y + b.velocity.y * k0 };
      const v = Physics.shotVelocity(w, T, foe, ch, from), path = Physics.pathFrom(w, T, from.x, from.y, v.vx * foe.dir, -v.vy, 22);
      const closer = mine.slice().sort((a1, b1) => Math.abs(a1.torso.position.x - foe.torso.position.x) - Math.abs(b1.torso.position.x - foe.torso.position.x))[0];
      const hr = handRise(X, closer, k0 + 24), rch = T.hand_box / 2 + b.r + 8;
      let meet = false;
      for (let j = 0; j < path.length && !meet; j++) { const h = hr[k0 + j + 1]; if (h && Math.abs(path[j].x - h.x) < rch && Math.abs(path[j].y - h.y) < rch) meet = true; }
      if (defend(c, w, 'lcontest', meet, def * 1.4 * st.guard * press, lag, X)) return jumpUp(0.32, 'CONTESTING THE LONG SHOT');
    } else delete c.rolls.lcontest;
    if (defend(c, w, 'contest', (predicted || early) && gap < reach, def * 1.3 * st.guard * press, lag, X)) return jumpUp(0.3, 'CONTESTING THE SHOT');
    // right next to the carrier: raise the arm to get a hand on the ball
    // (never a swipe while the carrier is at the rim: that jump comes down before the dunk, and the rim is left open)
    const atRim = (X.dfn.cx - foe.torso.position.x) * foe.dir < T.dunk_reach_x * 1.5 && th.dunk !== null && th.dunk <= L.sagWithin || hold.dunkReady;
    // its own swipes (learned): ones that keep missing leave it out of position, so it swipes less; ones that work, more
    const sw = c.swipes, swRate = sw.tries ? sw.won / sw.tries : 0.2;
    const swipeK = lerp(1, clamp(0.5 + 2.5 * swRate, 0.5, 1.4), conf(sw.tries / 2, X.K) * Math.min(1, X.L.learn)) * (st.street ? 1.3 : 1);   // (street ball gambles for the steal)
    // (from level 5 only a ball its arm can reach, and not one the carrier holds on the far side of his body: a swing at that only loses position)
    const sq = mine.slice().sort((a1, b1) => Math.abs(a1.torso.position.x - foe.torso.position.x) - Math.abs(b1.torso.position.x - foe.torso.position.x))[0];
    const bpos = w.ball.position, sh = { x: sq.torso.position.x, y: sq.torso.position.y - sq.dims.torsoH / 2 + 10 };
    const reachable = X.level < 5 || (Math.hypot(bpos.x - sh.x, bpos.y - sh.y) < sq.dims.armL + T.hand_box / 2 + w.ball.r + 6
      && !((foe.torso.position.x - sq.torso.position.x) * (bpos.x - foe.torso.position.x) > 0 && Math.abs(bpos.x - foe.torso.position.x) > 12));
    // STRIP THE CATCH (iteration 49): a ball only just picked up is not yet protected, so a hand right there goes for it at once
    if (X.level >= 3 && defend(c, w, 'strip', hold.t < 0.4 && gap < 95 && !atRim && reachable, Math.min(def, X.swipeCap) * 0.85 * st.guard * press * swipeK, lag, X)) { sw.tries++; c.swipeAt = c.tick; return jumpUp(0.22, 'STRIPPING THE CATCH'); }
    if (defend(c, w, 'swipe', gap < 60 + 50 * Math.min(def, 1) && !atRim && reachable, Math.min(def, X.swipeCap) * 0.7 * st.guard * press * swipeK, lag, X)) { sw.tries++; c.swipeAt = c.tick; return jumpUp(0.22, 'GOING FOR THE STEAL'); }
    return false;
  }

  /** A dribble in the air, theirs: when will the ball pass within a raised hand's reach? Jump so the hand is there then. */
  function timedSteal(c, X) {
    const { w, T, def, lag, st } = X;   // (T: hand_box, dribble_reach for the level-5 hand timing)
    const path = Physics.ballPath(w, T, 30);
    c.dbg.path = path.filter((_, i) => i % 3 === 0);
    const q = nearest(w, c.team, w.ball.position.x);
    if (!q) return false;
    let hit = false;
    if (X.level >= 5) {
      const lb = w.lastBouncer, hd = lb ? Physics.handPos(lb) : null, reach = T.hand_box / 2 + w.ball.r + 6, hr = handRise(X, q, 26);
      for (let k = 3; k <= 26 && !hit; k++) {
        const b = path[k]; if (!b) break;
        if (hd && b.vy < 0 && Math.hypot(b.x - hd.x, b.y - hd.y) < T.dribble_reach + w.ball.r) break;   // (its dribbler takes it back before then)
        if (Math.abs(b.x - hr[k].x) < reach && Math.abs(b.y - hr[k].y) < reach) hit = true;
      }
    } else for (let k = 9; k <= 22 && !hit; k++) {
      const b = path[k]; if (!b) break;
      if (Math.abs(b.x - q.torso.position.x) < 55 && b.y < w.floorY - 110 && b.y > w.floorY - 330) hit = true;
    }
    if (defend(c, w, 'timed', hit, Math.min(def, X.swipeCap) * 0.9 * st.guard * (1 + c.press * 0.6), lag, X)) { c.jump = true; c.holdT = 0.2; say(c, 'TIMING THE STEAL', true); return true; }
    return false;
  }

  /**
   * DEFLECT THE PASS (iteration 49): their pass is in the air and out of its guard time (they cannot be caught for a moment after it
   * leaves the hand). Fly its path; jump when a hand raised from now meets it, so the pass is knocked down or taken.
   */
  function deflectPass(c, X) {
    const { w, T, def, lag, st } = X, g = w.passGuard, q = nearest(w, c.team, w.ball.position.x);
    if (!q) return false;
    const path = Physics.ballPath(w, T, 26), hr = handRise(X, q, 26), reach = T.hand_box / 2 + w.ball.r + 4;
    const k0 = Math.max(3, g && g.team !== c.team ? Math.ceil((g.until - w.time) * 60) : 3);   // (nothing counts before the guard is over)
    let hit = false;
    for (let k = k0; k <= 26 && !hit; k++) { const b = path[k], h = hr[k]; if (b && h && Math.abs(b.x - h.x) < reach && Math.abs(b.y - h.y) < reach) hit = true; }
    c.dbg.path = path.filter((_, i) => i % 3 === 0); c.dbg.deflect = { k0, hit };
    if (defend(c, w, 'deflect', hit, Math.min(def, X.swipeCap) * 0.8 * st.guard, lag, X)) { c.jump = true; c.holdT = 0.24; say(c, 'DEFLECTING THE PASS', true); return true; }
    return false;
  }

  /**
   * Where a player's raised hand will be k steps after a held jump starts now: the torso's rise (a held jump's take-off speed,
   * drag and gravity) plus the raised arm above the shoulder. Cached per tick for the steps 0..n.
   */
  function handRise(X, q, n) {
    const { w, T } = X, g = Physics.gravityPx(w), keep = 1 - q.torso.frictionAir;
    const vFull = Math.sqrt(2 * g * T.jump_height * w.S.jump), boost = vFull * (1 - T.jump_tap_frac) / (T.jump_hold_time * 60);
    let vy = -vFull * T.jump_tap_frac, y = 0;   // (a tap's take-off, then the hold lifts it while it rises, as drive() does)
    const up = q.dims.torsoH / 2 - 10 + q.dims.armL, out = [];
    for (let k = 0; k <= n; k++) {
      out.push({ x: q.torso.position.x, y: q.torso.position.y + y - up });
      if (k < T.jump_hold_time * 60 && vy < 0) vy -= boost;
      y = Math.min(0, y + vy); vy = vy * keep + g;
    }
    return out;
  }

  // ---------------------------------------------------------------- loose ball and positioning

  /** Free ball, or closing down the carrier: hop toward where it matters on the swing. */
  function chase(c, X) {
    const { w, T, hold, ball, level, L, skill, def, lag, react, base, dfn, st } = X;
    let target, txt;
    const dead = 22 + (1 - skill) * 40;
    if (hold) {     // they have it: stand between them and our rim; a pass about to go is met at the receiver
      const foe = hold.p, th = c.threat;
      const stand = stanceTarget(c, X, foe, th);
      const stanceW = level >= 3 ? 1 : level === 2 ? 0.5 : 0;                // a Rookie just chases the carrier
      target = lerp(foe.torso.position.x, stand.x, stanceW);
      const co = closeoutTarget(c, X, foe, hold);
      if (co !== null) target = co;
      const fmate = w.players.find(q => q.team === foe.team && q !== foe);
      if (L.look > 0 && th && th.pass >= 0.7 && fmate) target = fmate.torso.position.x;
      const tn = tendencies(c.profile, X.K), adapt = adaptOf(X);
      const scB = c.scout[Math.floor(Math.abs(foe.torso.position.x - dfn.cx) / 100)];
      txt = co !== null ? (scB && scB.made >= 2 ? 'CLOSING OUT: YOU HIT FROM HERE' : c.fqCache && c.fqCache.q === 2 ? 'CLOSING OUT: YOU HAVE A CLEAN LINE' : 'CLOSING OUT ON THE LONG SHOT')
        : th && th.pass >= 0.7 ? 'WATCHING THE PASS'
        : th && th.dunk !== null ? 'PROTECTING THE RIM'
        : adapt > 0.2 && tn.cDunk > 0.5 && tn.dunkShare > 0.45 ? 'GUARDING THE RIM: YOU KEEP DUNKING'
        : adapt > 0.2 && tn.cShot > 0.5 && tn.longShare > 0.5 ? 'DEFENDING DEEP: YOU SHOOT LONG'
        : c.press > 0.4 ? 'PRESSURING YOU: IT IS WORKING' : stanceW > 0 ? 'STANDING BETWEEN YOU AND THE RIM' : 'CHASING THE BALL';
      c.dbg.target = target;
    } else {
      // the ball is loose: where it will come down, with the error a lower level makes in reading it
      if (!c.looseOn) { c.looseOn = true; c.err = (c.rng() * 2 - 1) * (1 - skill) * 110 + (slip(c, X, 0.4) ? (c.rng() * 2 - 1) * (30 + 60 * (1 - skill)) : 0); }   // a misjudged bounce: a Legend's is a few dozen px
      const path = Physics.ballPath(w, T, 100);
      c.dbg.path = path.filter((_, i) => i % 4 === 0);
      let land = null;
      for (const b of path) if (b.y >= w.floorY - ball.r - 1) { land = b.x; break; }
      if (land === null) land = path[path.length - 1].x;
      target = ball.position.y < w.floorY - 70 ? land + c.err * (level >= 3 ? 1 : 0.5) : ball.position.x;
      txt = 'CHASING THE LOOSE BALL';
      // a foe shot in the air that will miss: go to where the rebound comes off
      const sh = ball.shot;
      // our own shot that will miss: the man who did not shoot heads for the rebound and goes up for the putback
      if (sh && sh.team === c.team && !sh.lob && sh.kind !== 'dunk' && level >= 3) {
        const atk = X.atk, line = Physics.predictLine(w, T, atk);
        if (line.crossX === null || !line.onTarget) { target = atk.cx - atk.side * atk.span * (0.9 + 0.5 * (1 - skill)) + c.err * 0.5; txt = 'CRASHING FOR THE PUTBACK'; }
      }
      if (sh && sh.team !== c.team && level >= 3) {
        const line = Physics.predictLine(w, T, dfn);
        if (line.crossX === null || !line.onTarget) {
          target = dfn.cx - dfn.side * dfn.span * (0.9 + 0.5 * (1 - skill)) + c.err * 0.5;
          if (level >= 5) c.crashFloor = true;
          txt = 'CRASHING THE BOARD';
        }
      }
      c.dbg.target = target;
    }
    target = courtSide(w, target);                      // (never to the far side of a basket)
    say(c, txt);
    let p = nearest(w, c.team, target);
    if (c.crashFloor) {   // the crash goes to the man on the floor (the other may be up contesting the shot)
      const down = w.players.filter(q => q.team === c.team && q.sinceGround < 0.1);
      if (down.length === 1) p = down[0];
      c.crashFloor = false;
    }
    if (!p) return c;
    // a player stranded behind a basket is brought back before anything else that is not urgent (the swing only moves the one it follows)
    const behindRim = q => w.hoops.some(h => (q.torso.position.x - h.cx) * (-h.side) < -10);
    const stray = w.players.find(q => q.team === c.team && behindRim(q));
    if (stray && stray !== p && (hold ? Math.abs(target - p.torso.position.x) < dead + 30 : Math.abs(ball.position.x - stray.torso.position.x) > 320)) { p = stray; target = courtSide(w, p.torso.position.x < w.cx ? w.L : w.R, 90); say(c, 'GETTING BACK FROM BEHIND THE BASKET'); }
    const s = Math.sign(target - p.torso.position.x) || 1, a = wrap(p.torso.angle);
    // a high ball: from level 4 the leap is timed to where the path puts it within reach
    if (!hold) {
      const path = level >= 4 ? Physics.ballPath(w, T, 24) : null;
      const near = path && path.some((b, k) => k >= 6 && k <= 18 && Math.abs(b.x - p.torso.position.x) < 60 && b.y < w.floorY - 200);
      const highBall = level >= 4 ? near : ball.position.y < w.floorY - 220 && Math.abs(ball.position.x - p.torso.position.x) < 140;
      if (defend(c, w, 'board', !!highBall, (0.3 + 0.7 * def) * (0.9 + 0.1 * st.scav), lag, X)) { c.jump = true; c.holdT = 0.32; say(c, 'GOING UP FOR THE BOARD', true); return c; }   // a full jump for a high ball
    }
    if (hold && Math.abs(target - p.torso.position.x) < dead) { c.wait = react * 0.25; return c; }   // in position: stand
    // (a loose ball coming down right over it: stand and let it come, no hop at all, so it is not left in the air for nothing; a low ball is not waited for)
    if (!hold && ball.position.y < w.floorY - 70 && Math.abs(target - p.torso.position.x) < dead * 0.7 && T.ai_hop_rest > 0) { c.wait = react * 0.25; return c; }
    const leaningToward = a * s > 0.22 && p.sinceFoot < 0.1;                    // the swing is tipping toward it
    // a closeout is a sprint: it goes on the first sign of the swing turning its way, in longer hops that cover more floor
    // RECOVERY (iteration 49): a carrier who has got past this man toward our rim is chased in the same long hops: it hustles back first
    const sRim = Math.sign(dfn.cx - p.torso.position.x) || 1;
    const beaten = hold && level >= 3 && (hold.p.torso.position.x - p.torso.position.x) * sRim > 40 && Math.abs(dfn.cx - hold.p.torso.position.x) < Math.abs(dfn.cx - p.torso.position.x);
    const sprint = hold && (c.closeout || beaten) && Math.abs(target - p.torso.position.x) > 110;
    const hopK = T.ai_hop_air;   // (iteration 49: a movement hop is a little lower and shorter, so the CPU spends less of the match in the air; guarding jumps are not scaled)
    if (sprint && a * s > 0.08 && p.sinceFoot < 0.1) { if (beaten) say(c, 'RECOVERING: BEATEN OFF THE DRIBBLE', true); c.jump = true; c.holdT = (0.16 + c.rng() * 0.06) * hopK; return c; }
    // (a plain hop waits ai_hop_rest seconds on the floor after landing: the CPU walks the floor in fewer, lower hops; a closeout or a recovery does not wait)
    if (leaningToward && c.tick - (p.aiAirTick === undefined ? -999 : p.aiAirTick) >= T.ai_hop_rest * 60) { c.jump = true; c.holdT = (0.06 + c.rng() * 0.08) * hopK; return c; }
    c.wait = (hold ? base * Math.max(0.2, 1.7 - 1.5 * Math.min(def, 1)) : react) * 0.25;           // closing a carrier down: quicker the better the defence
    return c;
  }

  /**
   * Out of time with the ball (the hold limit): a dunk if one is ready, the cocked shot if it is legal, otherwise a
   * pass (charged past the dribble threshold, so neither the seated rule nor the dribble cap can stop it). With the
   * shot cocked the jump stays down while the bounce charges, and both go up together: the bounce goes first.
   */
  function outOfTime(c, X) {
    const { w, T, hold, dt } = X;
    let d = c.deadline;
    if (!d) {
      c.aim = null; c.wait = 0; c.holdT = 0; c.bholdT = 0; c.self = null;
      const kind = hold.dunkReady && !hold.p.dribbled ? 'dunk' : hold.cocking && (!ownRimSoon(c, w, T) || ownShotClear(c, X, hold.p)) ? 'shoot' : 'pass';
      d = c.deadline = { hold, kind, step: 0, n: Math.ceil(Math.max(T.dribble_threshold + 0.05, 0.3) * T.bounce_charge_time / dt) + 1, keepJump: hold.cocking };
      say(c, kind === 'pass' ? 'OUT OF TIME: PASSING' : kind === 'shoot' ? 'OUT OF TIME: SHOOTING' : 'GOING UP FOR THE DUNK', true);
    }
    d.step++;
    if (d.kind === 'dunk') { c.jump = d.step === 2; return c; }       // a fresh tap: up for a step, then down
    if (d.kind === 'shoot' && ownRimSoon(c, w, T) && !ownShotClear(c, X, hold.p)) d.kind = 'pass';   // (drifted under its own rim since: it passes instead)
    if (d.kind === 'shoot') { c.jump = false; return c; }             // letting go of a cocked shot shoots it
    if (!hold.barmed && !d.armed) { c.jump = d.keepJump; c.bounce = false; return c; }   // the bounce key must be up once first
    d.armed = true;
    const on = d.n-- > 0;
    c.bounce = on; c.jump = on && d.keepJump;
    return c;
  }

  // ---------------------------------------------------------------- the self-pass

  /**
   * A self-pass is on: it has thrown the ball ahead and the same player goes after it. Each time he is on the floor with the ball
   * ahead of him he hops (a held jump, so the hand gets high); the catch is the physics' own. Caught, he lets go of the key and the
   * ordinary offense takes the dunk if it is in reach (or plays on if not). It gives up when a foe is nearer the ball, the ball is past the rim, or time runs out.
   * @returns {boolean} true when it handled this step
   */
  function selfStep(c, X) {
    const { w, hold, ball, atk, tap } = X, s = c.self, p = s.from, dir = p.dir;
    if (hold) {
      if (!s.thrown) return false;                                           // (still holding it: the throw has not left yet)
      if (hold.p === p) { c.selfStats.caught++; c.selfCaughtAt = c.tick; c.self = null; c.holdT = 0; c.wait = tap; say(c, 'SELF-PASS: GOT IT', true); return true; }   // caught: the key goes up, the offense decides
      c.self = null; c.selfWhy = 'taken'; c.selfEnds.taken = (c.selfEnds.taken || 0) + 1; return false;                       // somebody else has it
    }
    s.thrown = true;
    const bx = ball.position.x, dx = (bx - p.torso.position.x) * dir;
    const foeCloser = w.players.some(q => q.team !== c.team && Math.abs(q.torso.position.x - bx) < 90 && Math.abs(q.torso.position.x - bx) < Math.abs(p.torso.position.x - bx));
    if (c.tick - s.t0 > 160 || !w.pass || w.pass.from !== p || (atk.cx - bx) * dir < -90 || foeCloser) { c.selfWhy = c.tick - s.t0 > 160 ? 'late' : !w.pass ? 'nopass' : w.pass.from !== p ? 'otherpass' : (atk.cx - bx) * dir < -90 ? 'past' : 'foe'; c.selfEnds[c.selfWhy] = (c.selfEnds[c.selfWhy] || 0) + 1; c.self = null; return false; }
    say(c, 'SELF-PASS: HOPPING AFTER IT');
    if (p.sinceGround < 0.1 && dx > 10) { c.jump = true; c.holdT = 0.3; }
    return true;
  }

  // ---------------------------------------------------------------- the step

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
    c.tick++;
    for (const q of w.players) if (q.team === c.team && q.sinceGround > 0.08) q.aiAirTick = c.tick;   // (when each of its men was last in the air: a hop's rest counts from the landing)
    const X = frame(c, w, T, dt, info), { hold, ball, level, L, st, tap } = X;
    observe(c, X);
    c.jump = false; c.bounce = false;
    c.dbg = { path: null, target: null, ops: null, threat: null, shot: null };
    if (hold) c.looseOn = false;
    if (!(hold && hold.p.team !== c.team)) { for (const k of ['swat', 'rim', 'contest', 'lcontest', 'swipe', 'strip']) delete c.rolls[k]; c.threat = null; c.closeout = null; }   // the opponent lost the ball: the next incident is rolled fresh

    // a new possession (we hold it, or our dribble or pass is up, after they had it or it was loose): roll its dribble budget
    const lb0 = w.lastBouncer;
    const ours = (hold && hold.p.team === c.team) || (!hold && ((lb0 && lb0.team === c.team && lb0.dribbleT > 0) || (w.pass && w.pass.team === c.team)));
    if (ours && !c.hadBall) { const [lo, hi] = BUDGETS[Math.min(level, BUDGETS.length) - 1]; c.budget = lo + Math.floor(c.rng() * (hi - lo + 1)) + (c.style.street ? 2 : 0); c.dribs = 0; c.faked = false; c.possN++; }
    c.hadBall = !!ours;
    // a self-pass has left the hand once its pass is in the air (a catch the very next step is still its own catch)
    if (c.self && !c.self.thrown && !hold && w.pass && w.pass.from === c.self.from) c.self.thrown = true;
    // LAST RESORT against an own goal: holding the ball up at the rim it defends, over its opening (a ball taken off a dunk or a
    // rebound right at the rim mouth), it would carry the ball through its own basket. A shot is the only way the ball goes up and
    // away from there: the key up once if it is still down from the catch, a press (it cocks), and the release. (Feet off the
    // floor is the test, not sinceGround: the rim itself counts as ground for that.)
    if (hold && hold.p.team === c.team && !w.dunk) {
      const dfn = X.dfn, b = w.ball, q = hold.p;
      const over = q.legs.every(l => l.position.y < w.floorY - 40) && b.position.x > dfn.x1 - 12 && b.position.x < dfn.x2 + 12 && b.position.y < dfn.rimY + 2 && b.position.y > dfn.rimY - 150;
      if (over || c.clearing) {
        if (!c.clearing) { c.clearing = 1; c.clears++; c.aim = null; c.wait = 0; c.holdT = 0; c.bholdT = 0; c.self = null; c.deadline = null; say(c, 'CLEARING IT FROM OVER OUR RIM', true); }
        // (a bounce already started, an out-of-time pass say, stays down: let go now it would dribble the ball out from up there)
        c.bounce = !!hold.bouncing;
        if (hold.cocking) { c.jump = false; c.clearing = 0; return c; }          // letting go of a cocked shot shoots it (the bounce key down: the shot goes first)
        c.jump = hold.armed; return c;                                           // (not armed: the key goes up first; armed: the press)
      }
    } else c.clearing = 0;
    // THE HOLD LIMIT: the CPU never holds the ball longer than T.ai_hold_limit. Near it, whatever it was doing, it gets rid of it
    if (hold && hold.p.team === c.team && !w.dunk) {
      if (c.deadline && c.deadline.hold !== hold) c.deadline = null;
      if (c.deadline || hold.t >= T.ai_hold_limit - 0.32) return outOfTime(c, X);
    } else c.deadline = null;
    if (c.aim) return aimStep(c, X);
    if (c.self && c.self.thrown && hold && hold.p === c.self.from) selfStep(c, X);   // caught it: let go of the jump key now, not when its hop runs out
    // a key being held on purpose stays down until its time is up; letting go is the action
    if (c.bholdT > 0) { c.bholdT -= dt; c.bounce = c.bholdT > 0; return c; }
    if (c.holdT > 0) { c.holdT -= dt; c.jump = c.holdT > 0; if (c.holdT <= 0) c.wait = X.react * 0.5; return c; }
    if (c.wait > 0) {
      c.wait -= dt;
      // after a pump fake: the moment the baited defender has gone up and is back down (or never went up in 0.25 s) it plays on
      const f = c.fakeFoe;
      if (f && c.tick - c.afterFake < 40) {
        if (f.sinceGround > 0.1) c.fakeUp = true;
        if ((c.fakeUp && f.sinceGround < 0.03) || (!c.fakeUp && c.tick - c.afterFake > 15)) { c.wait = 0; c.fakeFoe = null; }
      }
      return c;
    }

    if (hold && hold.p.team === c.team) return offense(c, X);             // ---- we have the ball
    if (c.self && selfStep(c, X)) return c;                              // ---- our self-pass is in the air

    // ---- our own pass is in the air: send the receiver up to meet it
    if (!hold && w.pass && w.pass.team === c.team && w.time < w.pass.until) {
      const mate = w.players.find(q => q.team === c.team && q !== w.pass.from);
      if (w.pass.lob) {   // an alley-oop lob in the air: the physics takes the teammate up for it; this just says so, and shows the ball path
        c.dbg.path = Physics.ballPath(w, T, 70).filter((_, i) => i % 3 === 0);
        say(c, w.lobPlay ? 'ALLEY-OOP: GOING UP TO DUNK IT' : 'ALLEY-OOP: WAITING UNDER THE LOB', true);
        return c;
      }
      if (mate && Math.abs(ball.position.x - mate.torso.position.x) < 190 && Math.abs(ball.position.y - mate.torso.position.y) < 160 && ball.velocity.x * mate.dir >= -1) {
        c.jump = true; c.holdT = 0.3; say(c, 'MEETING THE PASS'); return c;
      }
    }

    // ---- our own dribble is in the air: keep it going (the tap is queued and fires on the catch)
    const lb = w.lastBouncer;
    if (!hold && lb && lb.team === c.team && lb.dribbleT > 0) {
      // past the budget it mostly catches it and thinks again (a taste, not a cap)
      const keepOn = (X.atk.cx - lb.torso.position.x) * lb.dir > T.dunk_min_gap && c.dribs < maxDribsOf(level) + (st.street ? 2 : 0) && !lb.queued && c.dribs < c.budget && dribZoneOk(w, lb) && (level < 3 || dribbleRisk(c, X, lb) < 0.75);   // (the hard cap; not out of its zone; and not on into a defender)
      // level 4+ taps in rhythm, as the ball rises (a slip taps it on the way down: a sloppy one); below that it taps whenever
      if (keepOn && (level >= 4 ? ball.velocity.y < -0.5 || (ball.velocity.y > 0.5 && slip(c, X, 0.08)) : c.rng() < 0.12)) { c.bounce = true; c.bholdT = tap; c.dribs++; c.dribRec.n++; }
      // a screen: from level 4, with the ball up, the teammate hops toward the defender to cut him off from the carrier
      const mate = w.players.find(q => q.team === c.team && q !== lb);
      const f = w.players.filter(q => q.team !== c.team && (q.torso.position.x - lb.torso.position.x) * lb.dir > 0).sort((a, b) => Math.abs(a.torso.position.x - lb.torso.position.x) - Math.abs(b.torso.position.x - lb.torso.position.x))[0];
      // (the one key hops both men: from level 4 only when the dribbler's hop cannot cost him the ball: he is already up, or the
      // ball is rising into his hand so the catch comes during the hop, and he leans toward it)
      const hd = Physics.handPos(lb), bx = ball.position.x - lb.torso.position.x;
      const catchSoon = ball.velocity.y < 0 && Math.hypot(ball.position.x - hd.x, ball.position.y - hd.y) < T.dribble_reach + ball.r + 30;
      const hopSafe = level < 4 || ((lb.sinceGround > 0.1 || catchSoon) && wrap(lb.torso.angle) * (Math.sign(bx) || lb.dir) > -0.05);
      // the screen spot: just in front of the defender, between him and the rim, where it blocks his way back (not halfway between)
      if (level >= 3 && hopSafe && mate && f && Math.abs(f.torso.position.x - lb.torso.position.x) < (L.screenR || 240) && c.rng() < (L.screenP || 0.75) * Math.min(1.4, st.read) * L.skill) {
        const screenSpot = f.torso.position.x - lb.dir * 28, distToSpot = screenSpot - mate.torso.position.x, s = Math.sign(distToSpot) || 1;
        // (it reacts sooner, at a smaller lean, and hops harder so the ragdoll really plants in the defender's lane)
        if (Math.abs(distToSpot) > 30 && wrap(mate.torso.angle) * s > 0.12 && mate.sinceFoot < 0.12) { c.jump = true; c.holdT = 0.12 + c.rng() * 0.06; say(c, 'SETTING A SCREEN'); }
      }
      return c;
    }

    // ---- they dribble in the air: a timed steal (level 4+)
    if (!hold && lb && lb.team !== c.team && lb.dribbleT > 0 && level >= 4 && timedSteal(c, X)) return c;

    // ---- their pass is in the air: a hand up to deflect it (level 3+)
    if (!hold && w.pass && w.pass.team !== c.team && !w.pass.lob && level >= 3 && deflectPass(c, X)) return c;

    if (hold && hold.p.team !== c.team && defense(c, X)) return c;        // ---- they have it
    return chase(c, X);
  }

  /**
   * The little picture over a player's head for what the AI is doing: ball (dribbling), shot (a jump shot,
   * long shot, fadeaway, pump fake), shield (a block, a rim guard, standing in the way), screen (setting
   * one), pass, dunk, steal, board (rebound), or null (just chasing).
   */
  function iconOf(text) {
    if (!text) return null;
    if (/PUMP FAKE/.test(text)) return 'fake';
    if (/SCREEN/.test(text)) return 'screen';
    if (/STEAL|STRIPPING|DEFLECTING/.test(text)) return 'steal';
    if (/SWATTING|CONTESTING|PROTECTING THE RIM|GUARDING THE RIM|DEFENDING DEEP|STANDING BETWEEN|PRESSURING|READING THE DUNK|WATCHING THE PASS/.test(text)) return 'shield';
    if (/GOING UP TO DUNK/.test(text)) return 'dunk';
    if (/LOB/.test(text)) return 'lob';
    if (/PASS|ALLEY|FEEDING/.test(text)) return 'pass';
    if (/DUNK|RIM PROTECTOR/.test(text)) return 'dunk';
    if (/SHOT|FADING/.test(text)) return 'shot';
    if (/DRIBBL|DRIVING/.test(text)) return 'ball';
    if (/BOARD/.test(text)) return 'board';
    return null;
  }
  /**
   * The intent in a word or two, for the line under the scoreboard (the full sentence stays in the I panel).
   * First match wins, so the specific plays come before the general ones.
   */
  const BRIEF = [
    [/OUT OF TIME/, 'OUT OF TIME'], [/TAKING A GOOD ONE/, 'JUMP SHOT'], [/PUMP FAKE/, 'PUMP FAKE'], [/SELF-PASS/, 'SELF-PASS'], [/OFF THE WALL/, 'WALL PASS'], [/OUTLET/, 'OUTLET PASS'],
    [/GIVE-AND-GO/, 'GIVE-AND-GO'], [/PUTBACK/, 'PUTBACK'], [/HOT HAND/, 'HOT HAND'], [/FAST BREAK/, 'FAST BREAK'], [/ALLEY-OOP: GOING UP/, 'ALLEY-OOP'], [/LOB/, 'LOB'], [/WATCHING THE PASS/, 'READING PASS'],
    [/MEETING THE PASS/, 'CATCHING'], [/DEFLECTING/, 'DEFLECT'], [/STRIPPING/, 'STRIP'], [/RECOVERING/, 'RECOVER'], [/STREET BALL/, 'STREET BALL'], [/PASS/, 'PASS'], [/SCREEN/, 'SCREEN'], [/STEAL/, 'STEAL'], [/SWATTING/, 'SWAT'],
    [/NO DUNK OFF THE DRIBBLE/, 'NO DUNK'], [/CLOSING OUT/, 'CLOSEOUT'], [/CONTESTING THE LONG/, 'CONTEST 2'], [/CONTESTING/, 'CONTEST'], [/THINKING/, 'THINKING'], [/OPEN: TAKING/, 'OPEN 2'], [/READING THE DUNK|PROTECTING THE RIM|GUARDING THE RIM/, 'RIM GUARD'], [/DEFENDING DEEP/, 'DEEP D'],
    [/PRESSURING/, 'PRESSURE'], [/STANDING BETWEEN/, 'GUARDING'], [/RIM PROTECTOR|WAITING FOR THE DUNK/, 'WAITING'],
    [/GOING UP FOR THE DUNK/, 'DUNK'], [/FADING/, 'FADEAWAY'], [/LONG SHOT/, 'LONG SHOT'], [/CLEARING/, 'CLEARING IT'], [/PUMPING OUT/, 'PUMP FAKE'], [/NO LOB/, 'JUMP SHOT'],
    [/JUMP SHOT|TAKING THE SHOT/, 'JUMP SHOT'], [/DRIBBLING/, 'DRIBBLING'], [/DRIVING/, 'DRIVE'],
    [/BOARD/, 'REBOUND'], [/LOOSE BALL/, 'LOOSE BALL'], [/CHASING/, 'CHASING'], [/BEHIND THE BASKET/, 'RESETTING'], [/LOOKING/, 'LOOKING'],
  ];
  function brief(text) {
    if (!text) return '';
    for (const [re, s] of BRIEF) if (re.test(text)) return s;
    return text.split(/[ :]+/).slice(0, 2).join(' ');
  }
  /** The icon to show now and which of its players it goes over (null when it has gone stale or means nothing). */
  function marker(c, w) {
    let icon = c.tick - c.intentSeen < 45 ? iconOf(c.intent) : null;
    if (c.tick - c.fakeAt < 40) icon = 'fake';   // a pump fake is over in a blink: hold its picture a little so it reads
    if (!icon) return null;
    const mine = w.players.filter(q => q.team === c.team), lb = w.lastBouncer, hold = w.hold;
    let who;
    if (icon === 'screen') { const base = lb && lb.team === c.team ? lb : mine[0]; who = mine.find(q => q !== base) || base; }   // the teammate, not the dribbler
    else if (hold && hold.p.team === c.team && icon !== 'shield' && icon !== 'steal' && icon !== 'board') who = hold.p;
    else if (!hold && icon === 'lob' && w.pass && w.pass.team === c.team) who = w.pass.lob && /UNDER/.test(c.intent) ? nearest(w, c.team, w.ball.position.x) : w.pass.from;
    else if (!hold && lb && lb.team === c.team && (icon === 'ball' || icon === 'shot' || icon === 'fake')) who = lb;
    else who = nearest(w, c.team, hold ? hold.p.torso.position.x : w.ball.position.x);
    return who ? { icon, who } : null;
  }

  /**
   * The AI vision panel (I in a match): its options with their scores, what it reads from you, what it has
   * learned about you, and how its own plays are going. One string per line.
   */
  function summary(c, T) {
    const lv = c.lv || levelOf(T), d = c.dbg || {}, pf = c.profile, tn = tendencies(pf), L = LEVELS[lv - 1], lines = [];
    const rec = k => `${c.mine[k].made}/${c.mine[k].att}`, pct = v => `${Math.round(v * 100)}%`;
    const mood = c.mood > 0.25 ? 'HOT' : c.mood < -0.25 ? 'COLD' : 'EVEN';
    lines.push(`LEVEL ${lv} ${L.name}${c.style.name ? '  ' + c.style.name : ''}  MOOD ${mood} (${c.mood >= 0 ? '+' : ''}${c.mood.toFixed(2)})  DRIBBLE BUDGET ${c.dribs}/${c.budget}  SLIPS ${c.slips}`);
    if (d.ops) lines.push('OPTIONS ' + d.ops.map(o => `${o[0]} ${o[1]}`).join('  '));
    if (d.threat) lines.push(`READS  SHOT IN ${d.threat.shoot === null ? '-' : d.threat.shoot}  DUNK IN ${d.threat.dunk === null ? '-' : d.threat.dunk}  PASS ${pct(d.threat.pass)}`);
    lines.push(`LEARNED  SHOTS ${pf.shots} (LONG ${pct(tn.longShare)}, FROM ~${Math.round(pf.shotDist)} PX)  DUNKS ${pf.dunks}  PASSES ${pf.passes}  DRIBBLES ${pf.dribbles}  DRIVES ${pf.drive >= 0 ? '+' : ''}${pf.drive.toFixed(2)}  PRESSURE ${pct(c.press)}`);
    const pr = pf.pressed, op = pf.open;
    lines.push(`YOU PRESSED ${pr.made}/${pr.att}  OPEN ${op.made}/${op.att}  ·  MINE SHOT ${rec('shot')} LONG ${rec('long')} FADE ${rec('fade')} DUNK ${rec('dunk')}  FAKES ${c.fakes.fakes}  SWIPES ${c.swipes.won}/${c.swipes.tries}  DRIBBLES LOST ${c.dribRec.lost}/${c.dribRec.n}`);
    const bands = Object.keys(c.scout).sort((a, b) => a - b).map(k => `${k * 100}-${k * 100 + 99}PX ${c.scout[k].made}/${c.scout[k].att}${c.scout[k].perfect ? ' (' + c.scout[k].perfect + ' PERFECT)' : ''}`);
    if (bands.length) lines.push('SCOUTING YOUR LONG SHOTS  ' + bands.join('  '));
    if (c.selfStats && c.selfStats.tries) lines.push(`SELF-PASS  THROWN ${c.selfStats.tries}  CAUGHT BY HIMSELF ${c.selfStats.caught}  DUNKS AFTER ${c.selfStats.dunks}`);
    return lines;
  }

  return { create, update, LEVELS, STYLES, levelOf, tendencies, DEFAULT_WEIGHTS, BUDGETS, iconOf, marker, summary, brief };
})();
