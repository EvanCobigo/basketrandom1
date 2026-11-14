// PROTOTYPE - NOT FOR PRODUCTION
// Question: Does one key plus floppy physics give a match that is chaotic, funny and still winnable on skill?
// Date: 2026-11-14
// Every tuning value lives here, each with value, min, max and step. The game reads them live
// through tune.<name> (index.html); the tweak panel, an add-on, writes them back here.
// Physics units follow Matter.js: px, and px per step / rad per step for speeds (60 steps a second).
window.CONFIG = {
  seed: 1, // every gameplay random call reads rng(), seeded from this (or ?seed= in the address)
  volume: { value: 0.5, min: 0, max: 1, step: 0.05 },

  // ---- Match ----
  win_score: { value: 5, min: 1, max: 11, step: 1 },          // baskets to win
  card_time: { value: 1.5, min: 0.5, max: 4, step: 0.1 },      // s the round card shows before play
  score_time: { value: 2.0, min: 0.8, max: 4, step: 0.1 },     // s of celebration after a basket
  stall_time: { value: 4.5, min: 2, max: 10, step: 0.5 },      // s a still ball waits before a re-drop

  // ---- Jumping (one key) ----
  jump_height: { value: 210, min: 60, max: 320, step: 5 },     // px a fully held jump rises
  jump_tap_frac: { value: 0.6, min: 0.3, max: 1, step: 0.02 }, // share of full take-off speed a tap gives
  jump_hold_time: { value: 0.28, min: 0.05, max: 0.6, step: 0.01 }, // s of holding that lifts a jump to full height
  jump_forward: { value: 2.6, min: 0, max: 8, step: 0.1 },     // px/step push toward the hoop you attack
  jump_chase: { value: 3.4, min: 0, max: 8, step: 0.1 },       // px/step pull toward the play on each hop
  jump_spin: { value: 0.075, min: 0, max: 0.3, step: 0.005 },  // rad/step forward tip on each jump
  jump_tilt_mix: { value: 0.6, min: 0, max: 1, step: 0.05 },   // 0 = straight up, 1 = along the body
  jump_jitter: { value: 0.08, min: 0, max: 0.3, step: 0.01 },  // +- fraction of random jump strength
  jump_cooldown: { value: 0.32, min: 0.1, max: 1, step: 0.02 },// s between jumps while the key is held
  coyote_time: { value: 0.09, min: 0, max: 0.3, step: 0.01 },  // s after leaving ground a jump still counts

  // ---- Ball handling: grab, shoot, fadeaway, dunk, block ----
  grab_reach: { value: 16, min: 0, max: 50, step: 1 },          // px from hand to ball surface that grabs
  regrab_delay: { value: 0.4, min: 0, max: 1.5, step: 0.05 },   // s before a player who let go can grab again
  shot_charge_time: { value: 0.9, min: 0.2, max: 2.5, step: 0.05 }, // s of holding to reach full shot power
  hold_max: { value: 2.6, min: 1, max: 6, step: 0.1 },          // s a ball can be held before it fires itself
  shot_min: { value: 8, min: 3, max: 20, step: 0.5 },           // px/step shot speed on a quick release
  shot_max: { value: 19, min: 8, max: 26, step: 0.5 },          // px/step shot speed fully charged
  shot_angle: { value: 55, min: 25, max: 80, step: 1 },         // degrees up from flat
  shot_tilt: { value: 0.6, min: 0, max: 1.5, step: 0.05 },      // how much body lean bends the arc
  shot_assist: { value: 0.25, min: 0, max: 1, step: 0.05 },     // pull toward a speed that reaches the rim
  fade_angle: { value: 66, min: 40, max: 85, step: 1 },         // degrees: a fadeaway's higher arc
  fade_power: { value: 1.08, min: 0.8, max: 1.4, step: 0.02 },  // fadeaway speed multiplier
  fade_assist: { value: 0.6, min: 0, max: 1, step: 0.05 },      // a fadeaway's extra aim help
  fade_speed: { value: 0.8, min: 0, max: 5, step: 0.1 },        // px/step drifting away from the hoop that counts
  fade_lean: { value: 0.3, min: 0, max: 1.2, step: 0.05 },      // rad leaning back that counts
  dunk_reach: { value: 14, min: 0, max: 60, step: 1 },          // px beyond the rim's edge a dunk still catches
  dunk_height: { value: 120, min: 40, max: 220, step: 5 },      // px above the rim the ball may be to dunk
  dunk_below: { value: 70, min: 0, max: 120, step: 5 },        // px below the rim the ball may still be to dunk
  dunk_speed: { value: 12, min: 4, max: 24, step: 0.5 },        // px/step the ball is slammed down
  block_window: { value: 0.9, min: 0.2, max: 2, step: 0.05 },   // s after a shot a defender's touch is a block
  block_pop: { value: 8, min: 2, max: 16, step: 0.5 },          // px/step a blocked ball flies back
  strip_speed: { value: 9, min: 3, max: 20, step: 0.5 },        // px/step hit that knocks a held ball loose
  steal_guard: { value: 0.35, min: 0, max: 1.5, step: 0.05 },   // s after a grab nobody can steal it

  // ---- Ragdoll ----
  gravity: { value: 1.0, min: 0.3, max: 2, step: 0.05 },       // Matter gravity.y before the round twist
  upright: { value: 26, min: 0, max: 80, step: 1 },            // rad/s^2 per rad pulling the torso upright
  upright_air: { value: 0.35, min: 0, max: 1, step: 0.05 },    // share of the upright pull in the air
  bob_angle: { value: 0.2, min: 0, max: 0.6, step: 0.01 },      // rad of the side-to-side idle bobble
  bob_rate: { value: 1.3, min: 0.2, max: 4, step: 0.1 },        // bobbles a second
  upright_damp: { value: 3.5, min: 0, max: 15, step: 0.5 },    // 1/s damping on torso spin
  leg_stiffness: { value: 0.22, min: 0, max: 1, step: 0.01 },  // how hard legs swing back under the hips
  leg_follow: { value: 0.3, min: 0, max: 1, step: 0.05 },      // 0 floppy legs, 1 rigid legs
  arm_up_angle: { value: 2.5, min: 0.5, max: 3.1, step: 0.05 },// rad the arm lifts while the key is held
  arm_gain: { value: 0.3, min: 0.05, max: 1, step: 0.01 },     // arm motor gain
  arm_max_speed: { value: 0.32, min: 0.05, max: 0.8, step: 0.01 }, // rad/step arm swing limit

  // ---- Ball ----
  ball_radius: { value: 29, min: 16, max: 60, step: 1 },       // px before the round twist
  ball_bounce: { value: 0.8, min: 0.3, max: 0.98, step: 0.01 },// restitution before the round twist
  ball_mass: { value: 1.3, min: 0.3, max: 5, step: 0.1 },      // Matter mass units
  ball_kick: { value: 2.6, min: 0, max: 8, step: 0.1 },        // px/step extra pop off any body hit
  ball_lift: { value: 0.9, min: 0, max: 3, step: 0.05 },      // share of each hit's pop sent upward
  ball_spin: { value: 0.18, min: 0, max: 0.6, step: 0.01 },    // rad/step random spin added on hits
  ball_air: { value: 0.004, min: 0, max: 0.03, step: 0.001 },  // air drag
  ball_max_speed: { value: 26, min: 10, max: 40, step: 1 },    // px/step cap, so it never tunnels
  drop_height: { value: 430, min: 200, max: 520, step: 10 },   // px above the floor the ball drops from

  // ---- Court ----
  court_width: { value: 1160, min: 900, max: 1240, step: 10 }, // px before the round twist
  rim_height: { value: 300, min: 200, max: 420, step: 5 },     // px from floor to rim
  rim_span_min: { value: 96, min: 60, max: 160, step: 2 },     // px rim opening (grows with the ball)
  board_inset: { value: 48, min: 20, max: 120, step: 2 },      // px from side wall to backboard

  // ---- Random rounds ----
  twist_strength: { value: 1, min: 0, max: 1.5, step: 0.05 },  // 0 = twists off, 1 = as listed in rounds.js
  jitter: { value: 0.07, min: 0, max: 0.2, step: 0.01 },       // +- fraction every round value wanders
  double_twist_chance: { value: 0.35, min: 0, max: 1, step: 0.05 }, // from round 3, chance of two twists

  // ---- Look and juice ----
  pixel_size: { value: 3, min: 1, max: 6, step: 1 },           // screen px per art pixel on the court
  shake: { value: 16, min: 0, max: 40, step: 1 },              // px screen shake on a basket
};
