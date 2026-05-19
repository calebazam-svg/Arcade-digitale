# Digital Arcade — "Classic Games. New Adventures."

An online gaming **platform** for iconic retro games and exclusive Digital
Arcade originals. Nostalgic arcade energy meets a sleek, modern interface.

## Features

- **Neon arcade homepage** — glowing neon sign, pixel font, scanlines,
  perspective grid floor, animated starfield, and a rotating arcade cabinet.
- **Arcade sounds** — WebAudio synth blips on hover/click and a coin jingle
  on reward claim (toggle in the top bar — no audio files needed).
- **Playable games** — every title launches a real, playable canvas game
  in an arcade modal with keyboard **and** on-screen D-pad/action controls,
  live score, and per-game high scores (saved locally). Engines: Neon Snake,
  a full Pac-Man-style Maze Muncher (pellets, power pellets, 3 chasing
  ghosts, frightened mode, tunnel & levels), Pixel Jumper, Retro Rush
  (vertical climber), Quest Pixels (platformer), Dungeon Dash, two
  pseudo-3D Mario-Kart-style item-battle racers (Turbo Circuit & Kart
  Kombat — laps, AI rivals, ? boxes with boost/shell/mine/shield), two
  first-person shooters (FPS Arena with a level + wave campaign & armored
  foes, Galaxy Blaster), Asteroids, Bubble Pop, a stealth Pixel Heist
  (guard patrol routes, vision cones, body detection & radar), Block
  Cascade (stacker), Spend 100 Million, and a Mystery Machine that loads a
  random game. Keyboard: WASD/arrows to move, **A** or Space to act.
- **Game library** — 16 games with thumbnails, ratings, play counts and
  badges (NEW / HOT / EXCLUSIVE), filterable by category.
- **Categories** — Trending, Retro Legends, Multiplayer, New Releases,
  Competitive, Exclusives (top nav + in-section filters stay in sync).
- **Featured retro titles** — Maze Muncher, Pixel Jumper, Turbo Circuit,
  Block Cascade, Quest Pixels, and more.
- **Digital Arcade Originals** — FPS Arena, Spend 100 Million, Retro Rush,
  Pixel Heist, Mystery Machine.
- **Player Hub** — profile with selectable avatars, level/XP bar,
  achievements (locked/unlocked), global leaderboard (with your rank
  highlighted), and play-history-based recommendations.
- **Daily rewards** — 7-day streak tracker with a claimable coin bonus.
- Polished hover animations, realistic shadows, count-up stats, scroll
  reveals; responsive and `prefers-reduced-motion` friendly.

Vanilla HTML/CSS/JS — no build step, no dependencies.

## Run it

Open `index.html`, or serve locally:

```bash
python3 -m http.server 8000   # then visit http://localhost:8000
```

## Files

| File         | Purpose                                   |
|--------------|-------------------------------------------|
| `index.html` | Page structure & sections                 |
| `styles.css` | Retro-neon theme, layout & animations     |
| `script.js`  | Game data, filtering, sound, dashboard FX |
