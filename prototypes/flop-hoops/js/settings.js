// PROTOTYPE - NOT FOR PRODUCTION
// Question: Does one key plus floppy physics give a match that is chaotic, funny and still winnable on skill?
// Date: 2026-11-14
'use strict';
/**
 * Settings: the data side of the in-game settings menu. Every value in CONFIG that has value,
 * min, max and step is listed here under a section, readable by name; changes are clamped,
 * snapped to the step and kept in this browser's storage (a per-viewer convenience: the game
 * plays the same without it). The menu itself is a scene in index.html.
 */
const Settings = (() => {
  const KEY = 'flophoops.settings.v1';
  // Sections by key prefix or name; anything not matched lands in the last one, so a new value
  // added to config.js always shows up somewhere.
  const SECTIONS = [
    ['SOUND', ['volume', 'sfx_volume', 'crowd_volume', 'ui_volume', 'reverb', 'sfx_warmth', 'sfx_variation']],
    ['MATCH', ['win_score', 'game_speed', 'card_time', 'score_time', 'stall_time']],
    ['CPU OPPONENT', k => k.startsWith('ai_')],
    ['JUMPING AND MOVING', k => k.startsWith('jump_') || ['hop_reach', 'coyote_time', 'spread_distance', 'spread_push', 'hustle_gap', 'hustle_jump'].includes(k)],
    ['CATCHING', ['regrab_delay', 'palm_offset', 'belly_margin', 'hand_box', 'steal_guard', 'strip_speed', 'block_window', 'block_pop']],
    ['SHOOTING', k => k.startsWith('shot_') || k.startsWith('fade_') || k.startsWith('fake_')],
    ['TWO-POINT LINE (NEXT ROUND)', k => k.startsWith('line_')],
    ['DUNKS', k => k.startsWith('dunk_')],
    ['PASSING AND DRIBBLING', k => k.startsWith('bounce_') || k.startsWith('pass_') || k.startsWith('dribble_')],
    ['TRAILS', k => k.startsWith('perfect_') || k.startsWith('trail_') || k === 'soft_touch'],
    ['RAGDOLL', k => k.startsWith('upright') || k.startsWith('rock_') || k.startsWith('leg_') && k !== 'leg_length' && k !== 'leg_closer_px' || k.startsWith('arm_') && k !== 'arm_length' && k !== 'arm_width' || k.startsWith('fold_') || k.startsWith('hand_') || k === 'seat_margin' || k.startsWith('rim_') && !['rim_height', 'rim_span_min', 'rim_ball_ratio'].includes(k) || ['gravity', 'player_max_speed', 'getup_time', 'getup_pop'].includes(k)],
    ['BODY (NEXT ROUND)', ['body_width', 'limb_width', 'arm_width', 'head_size', 'head_shape', 'head_extra_px', 'leg_closer_px', 'arm_length', 'torso_length', 'leg_length']],
    ['BALL', k => k.startsWith('ball_') || ['floor_bounce', 'drop_height'].includes(k)],
    ['COURT (NEXT ROUND)', ['court_width', 'rim_height', 'rim_span_min', 'rim_ball_ratio', 'board_height', 'board_inset']],
    ['LOOK AND EFFECTS', () => true],
  ];
  const tunable = k => CONFIG[k] && typeof CONFIG[k] === 'object' && 'value' in CONFIG[k] && 'min' in CONFIG[k];
  const defaults = {};
  for (const k of Object.keys(CONFIG)) if (tunable(k)) defaults[k] = CONFIG[k].value;

  // The short list the menu opens with: plain names, a plain line about each, and a plain way to
  // read the value. Everything else stays in the full list behind ADVANCED.
  const pct = (v, k) => Math.round(v / defaults[k] * 100) + '%';
  const level = v => v <= 0 ? 'OFF' : v <= 0.75 ? 'LOW' : v <= 1.5 ? 'NORMAL' : 'LOTS';
  // Three tabs, each a short list with big controls. A row is { key, label, desc, fmt, tab }; fmt turns the value into plain words
  // (an ON/OFF switch needs none: any 0-or-1 value is drawn as a switch).
  const TABS = ['MATCH', 'FEEL', 'LOOK AND SOUND'];
  const styleName = v => v <= 0 ? 'RANDOM' : (typeof AI !== 'undefined' && AI.STYLES[v - 1] ? AI.STYLES[v - 1].name : String(v));
  const SIMPLE = [
    { tab: 0, key: 'win_score', label: 'POINTS TO WIN', desc: 'FIRST TEAM TO THIS MANY POINTS WINS. A SHOT FROM BEYOND THE TWO-POINT LINE IS WORTH 2.', fmt: v => v + ' POINTS' },
    { tab: 0, key: 'game_speed', label: 'GAME SPEED', desc: 'SLOWER IS EASIER TO FOLLOW, FASTER IS MORE FRANTIC.', fmt: (v, k) => pct(v, k) },
    { tab: 0, key: 'ai_level', label: 'CPU LEVEL', desc: 'HOW GOOD THE COMPUTER IS IN A VS CPU MATCH, FROM ROOKIE TO MYTHIC.', fmt: v => ['ROOKIE', 'AMATEUR', 'PRO', 'ALL-STAR', 'LEGEND', 'MYTHIC'][v - 1] || String(v) },
    { tab: 0, key: 'ai_style', label: 'CPU STYLE', desc: 'HOW THE COMPUTER LIKES TO PLAY. RANDOM PICKS A NEW STYLE EACH MATCH; STREET BALL GOES FOR FLASHY PLAYS.', fmt: styleName },
    { tab: 0, key: 'ai_air_miss', label: 'CPU AIM IN THE AIR', desc: 'HOW MUCH THE COMPUTER MISSES SHOTS TAKEN HIGH IN A JUMP. A SHOT FROM THE FLOOR IS ITS BEST ONE. 0 TURNS IT OFF.', fmt: v => v <= 0 ? 'OFF' : v <= 35 ? 'LOW' : v <= 75 ? 'NORMAL' : 'HIGH' },
    { tab: 1, key: 'line_frac', label: '2-POINT LINE', desc: 'HOW FAR OUT EACH TEAM\'S TWO-POINT LINE IS FROM THE BASKET IT ATTACKS, AS A SHARE OF THE WAY TO THE CENTRE LINE. APPLIES FROM THE NEXT ROUND.', fmt: v => Math.round(v * 100) + '% OUT' },
    { tab: 1, key: 'jump_height', label: 'JUMP POWER', desc: 'HOW HIGH A FULL JUMP GOES.', fmt: (v, k) => pct(v, k) },
    { tab: 1, key: 'dunk_reach_x', label: 'DUNK REACH', desc: 'HOW CLOSE TO THE RIM YOU NEED TO BE TO DUNK. SMALLER IS HARDER.', fmt: (v, k) => pct(v, k) },
    { tab: 1, key: 'fold_stiffness', label: 'BODY STIFFNESS', desc: 'HOW STIFF THE HIPS ARE. HIGHER FOLDS LESS, LOWER IS FLOPPIER.', fmt: v => Math.round(v * 100) + '%' },
    { tab: 1, key: 'dribble_rock', label: 'DRIBBLE WOBBLE', desc: 'HOW MUCH THE BODY ROCKS WHILE DRIBBLING. 0% HOLDS IT STEADY, 100% IS THE NORMAL ROCK.', fmt: v => Math.round(v * 100) + '%' },
    { tab: 2, key: 'volume', label: 'SOUND VOLUME', desc: 'HOW LOUD THE GAME IS. THE M KEY MUTES IT.', fmt: v => v <= 0 ? 'OFF' : Math.round(v * 100) + '%' },
    { tab: 2, key: 'particles', label: 'PARTICLES', desc: 'HOW MANY SPARKS, DUST PUFFS AND CONFETTI THE EFFECTS MAKE.', fmt: level },
    { tab: 2, key: 'shake', label: 'SCREEN SHAKE', desc: 'HOW HARD THE SCREEN SHAKES ON BIG PLAYS.', fmt: v => v <= 0 ? 'OFF' : v <= 8 ? 'LOW' : v <= 20 ? 'NORMAL' : 'HIGH' },
    { tab: 2, key: 'crowd_rows', label: 'CROWD SIZE', desc: 'HOW MANY ROWS OF FANS WATCH THE GAME.', fmt: v => v <= 0 ? 'NONE' : v + (v === 1 ? ' ROW' : ' ROWS') },
    { tab: 2, key: 'pixel_size', label: 'PIXEL SIZE', desc: 'BIGGER MEANS CHUNKIER, MORE RETRO GRAPHICS.', fmt: v => v.toFixed(1) },
    { tab: 2, key: 'scanlines', label: 'SCANLINES', desc: 'THE FAINT TV LINES OVER THE COURT.', fmt: v => v <= 0 ? 'OFF' : Math.round(v / 0.5 * 100) + '%' },
  ];
  const simpleOf = k => SIMPLE.find(x => x.key === k);

  /** Rows for the menu: section headers and value rows, in order (or just the short list). */
  function rows(simple, tab = 0) {
    if (simple) return SIMPLE.filter(x => x.tab === tab && tunable(x.key)).map(x => ({ key: x.key }));
    const left = new Set(Object.keys(defaults)), out = [];
    for (const [title, test] of SECTIONS) {
      const keys = [...left].filter(k => Array.isArray(test) ? test.includes(k) : test(k));
      if (!keys.length) continue;
      out.push({ header: title });
      for (const k of keys) { out.push({ key: k }); left.delete(k); }
    }
    return out;
  }

  /** "jump_tap_frac" -> "JUMP TAP FRAC"; the short list has its own plain names. */
  const label = (k, simple) => simple && simpleOf(k) ? simpleOf(k).label : k.replace(/_/g, ' ').toUpperCase();
  const EXTRA_DESC = { ai_level: 'WHICH BRAIN THE CPU PLAYS WITH. EACH LEVEL HAS ITS OWN REACTION TIME AND AIM.' };
  const describe = k => simpleOf(k) ? simpleOf(k).desc : EXTRA_DESC[k] || '';
  /** The value in plain words, for the short list. */
  const showSimple = k => simpleOf(k).fmt(CONFIG[k].value, k);
  /** A 0-or-1 value is an ON/OFF switch. */
  const isToggle = k => CONFIG[k].min === 0 && CONFIG[k].max === 1 && CONFIG[k].step === 1;
  /** A value with a few named stops (not a smooth range): the bar is drawn with a notch at each. */
  const stops = k => { const c = CONFIG[k], n = Math.round((c.max - c.min) / c.step); return n >= 1 && n <= 12 ? n + 1 : 0; };
  /** The value as words wherever there are words for it: the short list's, an ON/OFF for a switch, else the number. */
  const plain = k => simpleOf(k) ? showSimple(k) : isToggle(k) ? (CONFIG[k].value >= 1 ? 'ON' : 'OFF') : show(k);
  const defaultShare = k => (defaults[k] - CONFIG[k].min) / (CONFIG[k].max - CONFIG[k].min || 1);
  const defaultText = k => { const v = CONFIG[k].value; CONFIG[k].value = defaults[k]; const t = plain(k); CONFIG[k].value = v; return t; };

  /** The value as the menu shows it: whole numbers plain, otherwise to the step's decimals. */
  function show(k) {
    const c = CONFIG[k], dec = Math.max(0, Math.min(3, (String(c.step).split('.')[1] || '').length));
    return c.value.toFixed(dec);
  }

  /** Set a value, clamped to min..max and snapped to the step; saved and announced. */
  function set(k, v) {
    const c = CONFIG[k];
    v = Math.min(c.max, Math.max(c.min, v));
    v = Math.round((v - c.min) / c.step) * c.step + c.min;
    c.value = +v.toFixed(6);
    save();
    dispatchEvent(new Event('tune'));
  }
  const nudge = (k, n) => set(k, CONFIG[k].value + n * CONFIG[k].step);
  const share = k => (CONFIG[k].value - CONFIG[k].min) / (CONFIG[k].max - CONFIG[k].min || 1);

  function save() {
    try {
      const out = {};
      for (const k of Object.keys(defaults)) if (CONFIG[k].value !== defaults[k]) out[k] = CONFIG[k].value;
      localStorage.setItem(KEY, JSON.stringify(out));
    } catch (e) { /* storage blocked: settings just last this visit */ }
  }
  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) || '{}');
      for (const k of Object.keys(saved)) if (k in defaults && typeof saved[k] === 'number') CONFIG[k].value = Math.min(CONFIG[k].max, Math.max(CONFIG[k].min, saved[k]));
    } catch (e) { /* nothing saved, or storage blocked */ }
  }
  function reset() { for (const k of Object.keys(defaults)) CONFIG[k].value = defaults[k]; save(); dispatchEvent(new Event('tune')); }
  const changed = k => CONFIG[k].value !== defaults[k];

  return { TABS, rows, label, describe, showSimple, plain, isToggle, stops, defaultShare, defaultText, show, set, nudge, share, load, reset, changed };
})();
