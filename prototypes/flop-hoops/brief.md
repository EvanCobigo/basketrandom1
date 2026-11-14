# Game Brief: Flop Hoops

## In your words
Build a Complete Basket Random Clone. Act as a senior full-stack game developer specializing in browser-based physics games. Build a fully playable clone of Basket Random, recreating its core gameplay, physics, visual style, controls, and multiplayer experience. The objective is to reproduce the original game's feel as closely as possible while using original implementation code and assets.

1. Core Gameplay: Create a 2D physics-based basketball game featuring: Two teams, each consisting of two characters. One basketball. A basketball court with two hoops, one on each side. Characters with intentionally chaotic, floppy, ragdoll-like physics. Unpredictable jumping, collisions, ball interactions, and movement. First team to reach 5 points wins. Automatic round resets after a basket. A visible scoreboard. The gameplay should capture Basket Random's defining characteristic: simple controls combined with chaotic physics that produce unpredictable and entertaining outcomes.
2. Controls: Implement local multiplayer: Player 1: W to jump. Player 2: Up Arrow to jump. Each player controls both characters on their respective team simultaneously. Characters should jump and interact with the ball through physics-based collisions. Holding a jump key should produce appropriate repeated or variable jumping behavior. Include keyboard input handling that works reliably throughout the match.
3. Physics Engine: Physics is the most important part of this project. Implement: Gravity. Character-body collisions. Ball-to-character collisions. Ball-to-ground collisions. Hoop and backboard collisions. Angular velocity and rotational movement. Ragdoll-like character movement. Impulse-based jumping. Friction and restitution. Realistic ball bouncing with deliberately exaggerated physics. Characters should have articulated or multi-body physics rather than behaving like rigid rectangles. The ball must respond naturally to character impacts, jumps, and environmental collisions. Avoid overly predictable trajectories. The game should feel chaotic but remain controllable.
4. Randomized Rounds: At the beginning of each round, randomly select environmental variations. Include: Different character proportions. Different basketball sizes. Different court dimensions. Different gravity and jump characteristics. Different ball elasticity. Different visual environments. Randomized character appearance. Randomization should create meaningful gameplay variation without making the game unfair or unplayable.
5. Visual Design: Recreate the recognizable minimalist aesthetic of Basket Random. Visual requirements: Simple, colorful 2D graphics. Exaggerated character proportions. Circular or simplified character heads. Distinct team colors. Clearly visible basketball. Basketball hoops with recognizable backboards and rims. Minimalist court background. Smooth animations. Scoreboard positioned prominently at the top. Use Canvas or another suitable rendering technology. Do not use copyrighted assets from the original game. Create original shapes, animations, and visual assets.
6. Game States: Main menu. Start game. Active gameplay. Scoring animation. Round reset. Victory screen. Restart functionality. Include a pause mechanism and a clear indication of whose turn or score is currently leading.
7. Technical Requirements: HTML5, CSS3, JavaScript or TypeScript, Canvas for rendering, Matter.js or an equivalent physics engine. Architecture should separate: physics simulation, rendering, input handling, collision detection, scoring, round randomization, game state management. Consistent physics timestep. Smooth rendering using requestAnimationFrame. Responsive browser layout. No unnecessary dependencies. Clean, modular, maintainable code. No placeholder mechanics. No nonfunctional buttons.
8. Gameplay Polish: character responsiveness, chaotic but believable collisions, basketball trajectory, scoring detection, character-to-character interaction, jump timing, round transitions, overall game pacing. Add small visual effects when scoring, including a brief screen shake and score animation. Add simple sound effects for jumping, ball impacts, and scoring if feasible.
9–10. Run the application, test it, identify problems, and iterate until the game works. Most important: The physics and gameplay should feel recognizably like Basket Random.

Answers: Not a copy: Original in the genre. Build this?: Build it.

After play: Allow for the character to grab the ball. Only allow collisions between enemies, not teammates. Make it look more pixelated. Make the characters look less make them look more just like simplistic. Allow the characters to grab the balls when you press the jump key. Make it so that the amount of time you hold on the jump key coincides with the amount of jump or the height of the jump. Then same thing, you keep holding to fire. Make the characters bobble side to side when they're not currently jumping, and eyes, as well as the cartoonish details, make them look a little bit more blocky. Implement dunking mechanics, as well as fadeaway mechanics, and blocks.

After play: create a hitbox that surrounds the hand of the character, if more than half of the basketball is inside the box, the ball is teleported to the player's hand. Same process if the ball touches the abdomen, but not the foot. make the game speed slower, The player should be rocking forwards and backwards when feet are touching the floor. The vertical coefficient shouldn't be affected as much by the amount of cockback as opposed to the horizontal coefficient. Make the characters much slimmer and the hoops much smaller. Make it really look retro. The characters are currently just accumulating in a little blob at a certain point. If the foot hitbox is touching the floor, keep it grounded instead of slipping and allowing character to fall over eternally and never get back to bobbling back and forth to allow for character movement. Make it so that whenever the player holds on the key and the ball is in hand, the ball is in its cockback firing phase. When the ball is picked up out of air, the movement key needs to be let go, then the ball can be fired. Make the characters not have faces at all, just make them have a squircle shaped heads. The ball should be squircle shaped as well. Arms should be much longer, and shirts shouldn't have detail. we'll add that later.

After play: shorten the height of the rims, and remove all modifiers. make the heads smaller. make it much more retro without as much detail, specifically the background, keep it simplistic like the jerseys. have the ball have a white trail on firing. The trail should be a rainbow if it is perfectly alligned with the goal. Make the firing a bit slower, and the arms beefier now. allow for backwards swinging, the characters should be pivoting off their foot, but swinging both left to right, not only middle to right and slowly slowing down, it should never be slowing down. add some more features you deem fit. the characters are not picking up the balls consistently currently.

After play: make the ball rounder, the hands smaller, the arms shorter, make the court smaller, basketball hoop is of good size. bring ball mechanics back to what they were like earlier. make the human proportions seem to be of someone of about 6'6 height, with +4 wingspan.
Answer: Which earlier ball mechanics: Iteration 2 shots.

**Pitch:** Two wobbly ragdoll ballers a side, one jump key each, swinging on their feet and hurling a squircle ball.

**Genre:** arcade sports (floppy physics sport)

**Controls:** Player 1 W, Player 2 Up Arrow; each key drives both of that team's players. Planted players swing evenly forward and back about their feet: hop on the swing to move that way. Tap to hop, hold to jump higher. The ball snaps to a hand when over half of it is in the hand box, or when it hits the abdomen (never the feet). With the ball, hold to cock back and let go to fire; after a catch made with the key down, let go once first. Esc or P pauses.

**Question:** Does one key plus floppy physics give a match that is chaotic, funny and still winnable on skill?

**Hooks:** Players swing back and forth on their feet: the hop's timing is the steering; a perfectly lined-up shot leaves a rainbow trail.

**Intent:** needs 2 players *(you said)*

## Look and references
- Look: really retro: the court drawn at low resolution, snapped to each round's small palette and scaled up under scanlines, with a monospace square-cornered HUD; flat plain backgrounds (sky, one horizon band, floor, centre line); slim faceless characters built like a 6 ft 6 in player with a +4 in wingspan (long legs, small squircle heads, small hands, plain shirts); a rounded ball with a white trail when fired (rainbow on a perfect line); hoops kept at their size (65 px rim, 10 ft high) on a narrower court; thick dark outlines; tangerine vs teal teams; a bright orange seamed ball; each round a new venue (school gym, dusk rooftop, beach, night street court) in its own two-tone palette, background darker and calmer than play; signature: the rainbow trail of a perfectly lined-up shot. Every figure drawn, no emoji, no plain circles. *(inferred (strong))*
- References: the floppy one-button basketball genre (Basket Random and others) for its feel only: one-key jumps, ragdoll chaos, random rounds.
- View: 2D side view · Camera: static, whole court visible, scaled to the window.

## First minute
The menu reads "W vs ↑"; Start. A round card flips: "Normal ball". Each player taps; both their ballers hop and tip forward, arms swinging. The ball drops at centre; someone headbutts it, it clangs off a rim, a scramble, and a flailing arm knocks it in: the screen shakes, the score pops, and a new card flips in, "Giant ball!".

## Challenge
Every touch is contested from second one: the skill is timing your hop against theirs. A conceded basket costs a point and resets the court. Every round plays to the same rules; a team two points behind hustles with higher jumps.

## Core loop
- Time hops to tip and shove the ball toward the opponent's hoop
- Score → score animation → round reset with new random settings
- First to 5 → victory screen → rematch

## Goal & fail state
- Win: first team to 5 baskets. Lose: the other team reaches 5 first.

## Features
- [x] Multi-body ragdoll players (head, torso, arms, legs) on one key per team
- [x] Ball physics with ground, player, rim and backboard collisions
- [x] Basket detection, scoreboard, score animation, screen shake, round reset
- [x] Rounds: same rules every round (no modifiers); venue colours and player looks change
- [x] Menu, pause, victory screen, restart
- [ ] Synth sounds: jump, bounce, rim, swish; mute
- [x] Fixed physics timestep, requestAnimationFrame render, responsive canvas
- [x] Catch: hand hitbox (over half the ball inside) or abdomen contact snaps the ball to the hand; feet never catch
- [x] Hold with the ball to cock back, let go to fire; a catch made with the key down needs one let-go first; cock-back grows forward speed far more than height
- [x] Jump height follows how long the key is held
- [x] Dunks near the rim, fadeaways when drifting or leaning away, blocks and steals by defenders
- [x] Only opponents collide; teammates pass through each other
- [x] Planted players pivot on their feet, swinging evenly forward and back at a beat that never fades; fallen players get back up
- [x] Shots as in iteration 2: forward 3.5-14, up 11-13, 1 s cock-back, body lean bends the throw
- [x] Slower game speed; players eased apart so they never pile into one blob
- [x] Fired ball trail: white, rainbow with a PERFECT! callout when lined up with the rim
- [x] SWISH and PERFECT SWISH baskets; HUSTLE higher jumps for a team 2+ points behind; pickup flash
- [x] Catches checked every step: larger hand box, abdomen overlap

## Your systems
- ragdoll physics · in the slice
- round venues and looks · in the slice
- local 2-player · in the slice
- menus and game states · in the slice
- ball handling (grab, shoot, dunk, fadeaway, block) · in the slice

## Keep
-

## Avoid
- Basket Random's name, art, characters and UI
- Round modifiers (removed after play)

## Out of scope
- An AI opponent: change it after play
- Online play: needs a server, not built yet (two players on one keyboard instead)
- Leagues and seasons: grow it

## Build order
1. One full match: ragdolls, ball, hoops, scoring to 5, random rounds, menu, pause, victory.

---
**Kill condition:** if after two tuning rounds the jumps feel random instead of chaotic-but-steerable.

**Who it's for / what they feel:** two friends on one keyboard laughing at an unlikely dunk.

**Games you love / don't:** "a clone of Basket Random" (you said).
