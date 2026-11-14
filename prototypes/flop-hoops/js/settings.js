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
    ['MATCH', ['volume', 'win_score', 'game_speed', 'card_time', 'score_time', 'stall_time']],
    ['CPU OPPONENT', k => k.startsWith('ai_')],
    ['JUMPING AND MOVING', k => k.startsWith('jump_') || ['hop_reach', 'coyote_time', 'spread_distance', 'spread_push', 'hustle_gap', 'hustle_jump'].includes(k)],
    ['CATCHING', ['regrab_delay', 'palm_offset', 'belly_margin', 'hand_box', 'steal_guard', 'strip_speed', 'block_window', 'block_pop']],
    ['SHOOTING', k => k.startsWith('shot_') || k.startsWith('fade_') || k === 'hold_max'],
    ['DUNKS', k => k.startsWith('dunk_')],
    ['PASSING AND DRIBBLING', k => k.startsWith('bounce_') || k.startsWith('pass_') || k.startsWith('dribble_')],
    ['TRAILS', k => k.startsWith('perfect_') || k.startsWith('trail_') || k === 'soft_touch'],
    ['RAGDOLL', k => k.startsWith('upright') || k.startsWith('rock_') || k.startsWith('leg_') && k !== 'leg_length' && k !== 'leg_closer_px' || k.startsWith('arm_') && k !== 'arm_length' && k !== 'arm_width' || ['gravity', 'player_max_speed', 'getup_time', 'getup_pop'].includes(k)],
    ['BODY (NEXT ROUND)', ['body_width', 'limb_width', 'arm_width', 'head_size', 'head_shape', 'head_extra_px', 'leg_closer_px', 'arm_length', 'torso_length', 'leg_length']],
    ['BALL', k => k.startsWith('ball_') || ['floor_bounce', 'drop_height'].includes(k)],
    ['COURT (NEXT ROUND)', ['court_width', 'rim_height', 'rim_span_min', 'rim_ball_ratio', 'board_height', 'board_inset']],
    ['LOOK AND EFFECTS', () => true],
  ];
  const tunable = k => CONFIG[k] && typeof CONFIG[k] === 'object' && 'value' in CONFIG[k] && 'min' in CONFIG[k];
  const defaults = {};
  for (const k of Object.keys(CONFIG)) if (tunable(k)) defaults[k] = CONFIG[k].value;

  /** Rows for the menu: section headers and value rows, in order. */
  function rows() {
    const left = new Set(Object.keys(defaults)), out = [];
    for (const [title, test] of SECTIONS) {
      const keys = [...left].filter(k => Array.isArray(test) ? test.includes(k) : test(k));
      if (!keys.length) continue;
      out.push({ header: title });
      for (const k of keys) { out.push({ key: k }); left.delete(k); }
    }
    return out;
  }

  /** "jump_tap_frac" -> "JUMP TAP FRAC". */
  const label = k => k.replace(/_/g, ' ').toUpperCase();

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

  return { rows, label, show, set, nudge, share, load, reset, changed };
})();
