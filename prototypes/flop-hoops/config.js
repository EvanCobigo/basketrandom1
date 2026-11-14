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
  game_speed: { value: 0.9, min: 0.3, max: 1.2, step: 0.02 }, // physics steps per real step: below 1 is slower
  card_time: { value: 1.0, min: 0.5, max: 4, step: 0.1 },      // s the round card shows before play
  score_time: { value: 1.4, min: 0.8, max: 4, step: 0.1 },     // s of celebration after a basket
  stall_time: { value: 3.5, min: 2, max: 10, step: 0.5 },      // s a still ball waits before a re-drop

  // ---- Jumping (one key) ----
  jump_height: { value: 210, min: 60, max: 320, step: 5 },     // px a fully held jump rises
  jump_tap_frac: { value: 0.6, min: 0.3, max: 1, step: 0.02 }, // share of full take-off speed a tap gives
  jump_hold_time: { value: 0.28, min: 0.05, max: 0.6, step: 0.01 }, // s of holding that lifts a jump to full height
  jump_forward: { value: 1.0, min: 0, max: 8, step: 0.1 },     // px/step push toward the hoop you attack
  jump_chase: { value: 0.9, min: 0, max: 8, step: 0.1 },       // px/step pull toward the play on each hop
  jump_spin: { value: 0.075, min: 0, max: 0.3, step: 0.005 },  // rad/step forward tip on each jump
  jump_tilt_mix: { value: 0.6, min: 0, max: 1, step: 0.05 },   // 0 = straight up, 1 = along the body
  jump_jitter: { value: 0.08, min: 0, max: 0.3, step: 0.01 },  // +- fraction of random jump strength
  jump_cooldown: { value: 0.32, min: 0.1, max: 1, step: 0.02 },// s between jumps while the key is held
  coyote_time: { value: 0.09, min: 0, max: 0.3, step: 0.01 },  // s after leaving ground a jump still counts
  spread_distance: { value: 60, min: 0, max: 160, step: 2 },   // px apart below which players are eased apart
  spread_push: { value: 0.35, min: 0, max: 2, step: 0.05 },    // px/step of that easing at zero distance

  // ---- Ball handling: grab, shoot, fadeaway, dunk, block ----
  regrab_delay: { value: 0.4, min: 0, max: 1.5, step: 0.05 },   // s before a player who let go can grab again
  palm_offset: { value: 0.55, min: 0, max: 1.2, step: 0.05 },    // ball centre past the hand, in ball radii: held in the palm
  belly_margin: { value: 6, min: 0, max: 30, step: 1 },          // px the abdomen catch reaches past the torso
  hand_box: { value: 78, min: 20, max: 120, step: 2 },          // px side of the square catch box around each hand
  shot_charge_time: { value: 1.0, min: 0.2, max: 2.5, step: 0.05 }, // s of holding to reach full shot power
  hold_max: { value: 4, min: 1, max: 6, step: 0.1 },          // s a ball can be held before it fires itself
  shot_vx_min: { value: 3.5, min: 0, max: 15, step: 0.5 },      // px/step forward speed on a quick release
  shot_vx_max: { value: 14, min: 4, max: 24, step: 0.5 },       // px/step forward speed fully cocked
  shot_vy_min: { value: 11, min: 4, max: 20, step: 0.5 },       // px/step upward speed on a quick release
  shot_vy_max: { value: 13, min: 4, max: 22, step: 0.5 },       // px/step upward speed fully cocked (barely more)
  shot_assist: { value: 0.6, min: 0, max: 1, step: 0.05 },     // pull toward the speed that drops the ball on the rim's centre (1 = always)
  fade_speed: { value: 0.8, min: 0, max: 5, step: 0.1 },        // px/step drifting away from the hoop that counts
  fade_lean: { value: 0.3, min: 0, max: 1.2, step: 0.05 },      // rad leaning back that counts
  dunk_speed: { value: 12, min: 4, max: 24, step: 0.5 },        // px/step the ball is slammed down
  dunk_body_range: { value: 175, min: 60, max: 300, step: 5 },  // px from the carrier's body to the rim where TAP TO DUNK shows (standing or flying)
  dunk_time: { value: 0.38, min: 0.08, max: 0.6, step: 0.01 },  // s the slam motion takes
  dunk_hang: { value: 0.18, min: 0, max: 0.6, step: 0.02 },      // s the dunker hangs on the rim after the slam
  dunk_lift: { value: 24, min: 0, max: 80, step: 2 },            // px the ball arcs up before coming down through
  block_window: { value: 0.9, min: 0.2, max: 2, step: 0.05 },   // s after a shot a defender's touch is a block
  block_pop: { value: 8, min: 2, max: 16, step: 0.5 },          // px/step a blocked ball flies back
  strip_speed: { value: 9, min: 3, max: 20, step: 0.5 },        // px/step hit that knocks a held ball loose
  steal_guard: { value: 0.35, min: 0, max: 1.5, step: 0.05 },   // s after a grab nobody can steal it
  bounce_charge_time: { value: 0.8, min: 0.2, max: 2, step: 0.05 }, // s of holding the bounce key for the longest pass
  bounce_vx_min: { value: 0.8, min: 0, max: 10, step: 0.5 },      // px/step forward speed of a quick dribble
  bounce_vx_max: { value: 11, min: 3, max: 20, step: 0.5 },     // px/step forward speed of a full pass
  bounce_vy_min: { value: 4, min: 0, max: 15, step: 0.5 },      // px/step downward throw of a quick dribble
  bounce_vy_max: { value: 6, min: 0, max: 15, step: 0.5 },      // px/step downward throw of a full pass
  bounce_ignore: { value: 0.35, min: 0, max: 1, step: 0.05 },    // s the bouncer's body ignores their own bounce
  dribble_reach: { value: 70, min: 0, max: 160, step: 5 },       // px from the hand a rising dribble is caught back
  bounce_regrab: { value: 0.3, min: 0, max: 1, step: 0.05 },    // s before the bouncer can catch it again
  pass_guard: { value: 0.6, min: 0, max: 2, step: 0.05 },        // s after a bounce that opponents cannot catch it
  pass_ghost: { value: 0.3, min: 0, max: 1, step: 0.05 },        // s a pass passes straight through opponents
  pass_catch_window: { value: 1.5, min: 0.3, max: 3, step: 0.1 },  // s a pass can be taken off a teammate's legs or chest
  dribble_threshold: { value: 0.25, min: 0, max: 1, step: 0.05 }, // bounce charge below which a release is a dribble
  dribble_vx: { value: 1.6, min: 0, max: 6, step: 0.1 },         // px/step forward speed of a dribble
  dribble_vy: { value: 6, min: 1, max: 14, step: 0.5 },          // px/step downward throw of a dribble
  dribble_time: { value: 0.7, min: 0.1, max: 2, step: 0.05 },    // s the dribbler hops along after a dribble
  dribble_lean: { value: 0.3, min: 0, max: 0.8, step: 0.02 },    // rad forward lean while dribbling
  dribble_slide: { value: 2.4, min: 0, max: 8, step: 0.1 },       // px/step forward slide while dribbling
  dribble_chain_time: { value: 1.2, min: 0.3, max: 3, step: 0.05 }, // s between dribbles that still counts as one chain
  dribble_error: { value: 0.9, min: 0, max: 3, step: 0.05 },      // px/step of random bounce error added per dribble in a chain
  dribble_sway: { value: 1.6, min: 0, max: 5, step: 0.1 },        // how much each dribble in a chain adds to the sway
  perfect_window: { value: 0.25, min: 0.02, max: 0.5, step: 0.01 }, // share of rim width from centre that counts as a perfect line
  perfect_graze: { value: 8, min: 0, max: 15, step: 1 },         // px a perfect shot may overlap the rim or board and still count
  soft_touch: { value: 3, min: 0, max: 10, step: 0.5 },          // px/step: a basket whose rim contact was this soft still counts as rainbow
  trail_width: { value: 1.6, min: 0.5, max: 3, step: 0.1 },        // trail block size, in ball radii
  trail_length: { value: 18, min: 0, max: 60, step: 1 },        // steps of ball trail behind a fired shot
  hustle_gap: { value: 2, min: 1, max: 10, step: 1 },           // points behind before a team hustles
  hustle_jump: { value: 1.15, min: 1, max: 1.6, step: 0.01 },   // jump height multiplier while hustling

  // ---- Ragdoll ----
  gravity: { value: 1.0, min: 0.3, max: 2, step: 0.05 },       // Matter gravity.y
  upright: { value: 26, min: 0, max: 80, step: 1 },            // rad/s^2 per rad pulling the torso upright
  upright_air: { value: 0.35, min: 0, max: 1, step: 0.05 },    // share of the upright pull in the air
  rock_angle: { value: 0.38, min: 0, max: 0.9, step: 0.01 },    // rad of the forward-and-back rock while planted
  rock_rate: { value: 0.75, min: 0.2, max: 3, step: 0.05 },      // rocks a second
  rock_follow: { value: 0.6, min: 0.05, max: 1, step: 0.05 },   // how tightly a planted body tracks its swing
  getup_time: { value: 0.7, min: 0.1, max: 3, step: 0.05 },     // s lying down before springing back up
  getup_pop: { value: 7, min: 0, max: 15, step: 0.5 },          // px/step upward pop when getting up
  body_width: { value: 28, min: 12, max: 50, step: 1 },         // px torso width
  limb_width: { value: 15, min: 5, max: 20, step: 1 },          // px leg width (arms are 0.8 of it)
  arm_width: { value: 15, min: 6, max: 30, step: 1 },           // px arm thickness
  head_size: { value: 10.7, min: 8, max: 30, step: 0.1 },           // px head half-size
  head_shape: { value: 8, min: 2, max: 12, step: 0.5 },         // head outline exponent: 2 round, 4 squircle, 8+ nearly square
  arm_length: { value: 62, min: 40, max: 140, step: 2 },        // px shoulder to fingertip: an 82" wingspan less the shoulders, halved
  torso_length: { value: 53, min: 30, max: 90, step: 1 },       // px hip to shoulder (a 6 ft 4 in player at about 2 px per inch)
  leg_length: { value: 86, min: 40, max: 120, step: 1 },        // px floor to hip
  upright_damp: { value: 3.5, min: 0, max: 15, step: 0.5 },    // 1/s damping on torso spin
  leg_stiffness: { value: 0.22, min: 0, max: 1, step: 0.01 },  // how hard legs swing back under the hips
  leg_follow: { value: 0.3, min: 0, max: 1, step: 0.05 },      // 0 floppy legs, 1 rigid legs
  arm_up_angle: { value: 2.5, min: 0.5, max: 3.1, step: 0.05 },// rad the arm lifts while the key is held
  arm_cock_angle: { value: 2.95, min: 1.5, max: 3.1, step: 0.05 }, // rad the arm swings back while cocking a shot
  arm_gain: { value: 0.3, min: 0.05, max: 1, step: 0.01 },     // arm motor gain
  arm_max_speed: { value: 0.32, min: 0.05, max: 0.8, step: 0.01 }, // rad/step arm swing limit

  // ---- Ball ----
  ball_radius: { value: 21, min: 16, max: 60, step: 1 },       // px
  ball_shape: { value: 2.6, min: 2, max: 5, step: 0.1 },        // ball outline exponent: 2 round, 4 squircle
  ball_bounce: { value: 0.8, min: 0.3, max: 0.98, step: 0.01 },// restitution
  floor_bounce: { value: 0.92, min: 0, max: 0.98, step: 0.01 },  // floor restitution: above ball_bounce makes the ball livelier off the ground only
  ball_mass: { value: 1.3, min: 0.3, max: 5, step: 0.1 },      // Matter mass units
  ball_kick: { value: 2.6, min: 0, max: 8, step: 0.1 },        // px/step extra pop off any body hit
  ball_lift: { value: 0.9, min: 0, max: 3, step: 0.05 },      // share of each hit's pop sent upward
  ball_spin: { value: 0.18, min: 0, max: 0.6, step: 0.01 },    // rad/step random spin added on hits
  ball_air: { value: 0.004, min: 0, max: 0.03, step: 0.001 },  // air drag
  ball_max_speed: { value: 26, min: 10, max: 40, step: 1 },    // px/step cap, so it never tunnels
  drop_height: { value: 430, min: 200, max: 520, step: 10 },   // px above the floor the ball drops from

  // ---- Court ----
  court_width: { value: 980, min: 900, max: 1240, step: 10 }, // px
  rim_height: { value: 235, min: 200, max: 420, step: 5 },     // px from floor to rim
  rim_span_min: { value: 40, min: 30, max: 160, step: 2 },     // px rim opening (grows with the ball)
  rim_ball_ratio: { value: 1.4, min: 1.05, max: 2, step: 0.05 }, // rim opening as a multiple of the ball's width: 1.4 balls fit
  board_height: { value: 135, min: 60, max: 200, step: 5 },    // px backboard height
  board_inset: { value: 40, min: 20, max: 120, step: 2 },      // px from side wall to backboard


  // ---- Look and juice ----
  fire_time: { value: 1.1, min: 0, max: 3, step: 0.1 },          // s the rim burns after a dunk
  spark_time: { value: 1.2, min: 0, max: 3, step: 0.1 },         // s the cold-spark machines fire on a dunk or a made fadeaway
  pixel_size: { value: 5, min: 1, max: 6, step: 1 },           // screen px per art pixel on the court
  palette_snap: { value: 1, min: 0, max: 1, step: 1 },          // 1: snap every court pixel to the round's retro palette
  scanlines: { value: 0.12, min: 0, max: 0.5, step: 0.01 },     // darkness of the CRT scanlines
  shake: { value: 16, min: 0, max: 40, step: 1 },              // px screen shake on a basket
};
