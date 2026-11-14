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

**Pitch:** Two wobbly ragdoll ballers a side, one jump key each, and a court whose rules change every round.

**Genre:** arcade sports (floppy physics sport)

**Controls:** Player 1 W, Player 2 Up Arrow; each key drives both of that team's players. Tap to hop, hold to jump higher; holding while touching the ball grabs it; keep holding to charge, let go to shoot. Esc or P pauses.

**Question:** Does one key plus floppy physics give a match that is chaotic, funny and still winnable on skill?

**Hooks:** Players pitch forward and flail when they jump; a random round card changes the court before every point.

**Intent:** needs 2 players *(you said)*

## Look and references
- Look: pixelated (the court drawn at low resolution and scaled up), simple blocky characters with square heads, square eyes and block hair, thick dark outlines; tangerine vs teal teams; a bright orange seamed ball; each round a new venue (school gym, dusk rooftop, beach, night street court) in its own two-tone palette, background darker and calmer than play; signature: a big round card flips in naming the round's twist. Every figure drawn, no emoji, no plain circles. *(inferred (strong))*
- References: the floppy one-button basketball genre (Basket Random and others) for its feel only: one-key jumps, ragdoll chaos, random rounds.
- View: 2D side view · Camera: static, whole court visible, scaled to the window.

## First minute
The menu reads "W vs ↑"; Start. A round card flips: "Normal ball". Each player taps; both their ballers hop and tip forward, arms swinging. The ball drops at centre; someone headbutts it, it clangs off a rim, a scramble, and a flailing arm knocks it in: the screen shakes, the score pops, and a new card flips in, "Giant ball!".

## Challenge
Every touch is contested from second one: the skill is timing your hop against theirs. A conceded basket costs a point and resets the court. Twists add variety, not difficulty: every random range is clamped and applies to both teams equally.

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
- [x] Randomised rounds: proportions, ball size, court width, gravity/jump, bounce, venue, outfits
- [x] Menu, pause, victory screen, restart
- [ ] Synth sounds: jump, bounce, rim, swish; mute
- [x] Fixed physics timestep, requestAnimationFrame render, responsive canvas
- [x] Grab the ball by touching it with the key held; hold to charge, release to shoot
- [x] Jump height follows how long the key is held
- [x] Dunks near the rim, fadeaways when drifting or leaning away, blocks and steals by defenders
- [x] Only opponents collide; teammates pass through each other
- [x] Idle side-to-side bobble when not jumping

## Your systems
- ragdoll physics · in the slice
- randomised rounds · in the slice
- local 2-player · in the slice
- menus and game states · in the slice
- ball handling (grab, shoot, dunk, fadeaway, block) · in the slice

## Keep
-

## Avoid
- Basket Random's name, art, characters and UI
- Unfair randomness: every twist clamped and the same for both teams

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
