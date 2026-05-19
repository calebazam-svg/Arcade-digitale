/* Digital Arcade — playable game engine
   A modal-driven arcade with several distinct canvas games.
   Public API: window.DAGames.launchByName(name) */
(() => {
  "use strict";
  const W = 480, H = 360;

  /* ---------- Shared input ---------- */
  const IN = {
    h: { left: 0, right: 0, up: 0, down: 0, action: 0 },
    e: { left: 0, right: 0, up: 0, down: 0, action: 0 },
    dir: "", p: { x: 0, y: 0, click: 0 },
  };
  const DIR = { left: "L", right: "R", up: "U", down: "D" };
  let active = false;

  function press(n) {
    if (!(n in IN.h)) return;
    if (!IN.h[n]) IN.e[n] = 1;
    IN.h[n] = 1;
    if (DIR[n]) IN.dir = DIR[n];
  }
  function release(n) { if (n in IN.h) IN.h[n] = 0; }

  const KMAP = {
    ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right",
    ArrowUp: "up", KeyW: "up", ArrowDown: "down", KeyS: "down",
    Space: "action", Enter: "action", KeyJ: "action", KeyZ: "action",
  };
  addEventListener("keydown", (ev) => {
    const n = KMAP[ev.code]; if (!n || !active) return;
    ev.preventDefault(); if (!ev.repeat) press(n);
  });
  addEventListener("keyup", (ev) => {
    const n = KMAP[ev.code]; if (!n) return; release(n);
  });

  /* ---------- DOM ---------- */
  const $ = (s) => document.querySelector(s);
  let modal, cv, ctx, elScore, elBest, elTitle;
  let raf = 0, game = null, acc = 0, last = 0, curId = "";

  function bindDOM() {
    modal = $("#modal"); cv = $("#screen"); ctx = cv.getContext("2d");
    elScore = $("#mScore"); elBest = $("#mBest"); elTitle = $("#mTitle");
    ctx.imageSmoothingEnabled = false;

    $("#mClose").onclick = close;
    modal.addEventListener("click", (e) => { if (e.target === modal) close(); });
    $("#ovBtn").onclick = start;
    $("#ovRetry").onclick = start;

    document.querySelectorAll(".pad button").forEach((b) => {
      const n = b.dataset.k;
      const dn = (e) => { e.preventDefault(); press(n); b.classList.add("hit"); };
      const up = () => { release(n); b.classList.remove("hit"); };
      b.addEventListener("pointerdown", dn);
      b.addEventListener("pointerup", up);
      b.addEventListener("pointerleave", up);
      b.addEventListener("pointercancel", up);
    });

    cv.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      const r = cv.getBoundingClientRect();
      IN.p.x = (e.clientX - r.left) * W / r.width;
      IN.p.y = (e.clientY - r.top) * H / r.height;
      IN.p.click = 1; IN.e.action = 1;
    });
  }

  /* ---------- Game registry ---------- */
  const GAMES = {};
  const HOW = {};
  function def(id, how, factory) { GAMES[id] = factory; HOW[id] = how; }

  const NAME2ID = {
    "Maze Muncher": "muncher", "Pixel Jumper": "runner", "Turbo Circuit": "dodger",
    "Block Cascade": "stacker", "Quest Pixels": "runner", "FPS Arena": "shooter",
    "Spend 100 Million": "spend", "Retro Rush": "runner", "Pixel Heist": "heist",
    "Mystery Machine": "mystery", "Galaxy Blaster": "shooter", "Bubble Pop Saga": "popper",
    "Kart Kombat": "dodger", "Dungeon Dash": "runner", "Neon Snake": "snake",
    "Asteroid Storm": "asteroids",
  };
  const POOL = ["snake", "runner", "dodger", "muncher", "shooter", "asteroids", "popper", "heist", "stacker"];

  /* ---------- Helpers ---------- */
  const rnd = (a, b) => a + Math.random() * (b - a);
  const ri = (a, b) => Math.floor(rnd(a, b + 1));
  function txt(s, x, y, sz = 10, c = "#f3ecff", al = "center") {
    ctx.fillStyle = c; ctx.textAlign = al;
    ctx.font = sz + "px 'Press Start 2P', monospace";
    ctx.fillText(s, x, y);
  }
  function bg(c1, c2) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, c1); g.addColorStop(1, c2);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }

  /* ================= GAMES ================= */

  /* Neon Snake */
  def("snake", "Steer with the D-pad / arrow keys. Eat the pellets, don't bite your tail or hit a wall.", () => {
    const cs = 20, cols = W / cs, rows = H / cs;
    let s = [{ x: 8, y: 9 }], d = { x: 1, y: 0 }, nd = d, food = newFood(), t = 0, step = 0.13;
    function newFood() {
      let f; do { f = { x: ri(0, cols - 1), y: ri(0, rows - 1) }; }
      while (s.some(p => p.x === f.x && p.y === f.y)); return f;
    }
    return {
      step(dt) {
        if (IN.dir === "L" && d.x !== 1) nd = { x: -1, y: 0 };
        if (IN.dir === "R" && d.x !== -1) nd = { x: 1, y: 0 };
        if (IN.dir === "U" && d.y !== 1) nd = { x: 0, y: -1 };
        if (IN.dir === "D" && d.y !== -1) nd = { x: 0, y: 1 };
        t += dt; if (t < step) return; t = 0; d = nd;
        const hd = { x: s[0].x + d.x, y: s[0].y + d.y };
        if (hd.x < 0 || hd.y < 0 || hd.x >= cols || hd.y >= rows ||
          s.some(p => p.x === hd.x && p.y === hd.y)) { this.over = 1; return; }
        s.unshift(hd);
        if (hd.x === food.x && hd.y === food.y) {
          this.score += 10; step = Math.max(0.06, step - 0.004); food = newFood();
        } else s.pop();
      },
      draw() {
        bg("#0a0613", "#150c2b");
        ctx.fillStyle = "#ff3ea5"; ctx.shadowColor = "#ff3ea5"; ctx.shadowBlur = 12;
        ctx.fillRect(food.x * cs + 3, food.y * cs + 3, cs - 6, cs - 6);
        ctx.shadowBlur = 0;
        s.forEach((p, i) => {
          ctx.fillStyle = i === 0 ? "#27e8ff" : "#9b6bff";
          ctx.fillRect(p.x * cs + 1, p.y * cs + 1, cs - 2, cs - 2);
        });
      },
    };
  });

  /* Endless runner (Pixel Jumper / Retro Rush / Dungeon Dash / Quest Pixels) */
  def("runner", "Press A / Space / Up to jump. Clear the obstacles — it gets faster!", () => {
    const gy = 300;
    let px = 70, py = gy, vy = 0, jumping = 0, spd = 240, obs = [], spawn = 0, dist = 0;
    return {
      step(dt) {
        if ((IN.e.action || IN.h.up) && !jumping) { vy = -430; jumping = 1; }
        vy += 1300 * dt; py += vy * dt;
        if (py >= gy) { py = gy; vy = 0; jumping = 0; }
        spd += dt * 6; dist += spd * dt;
        this.score = Math.floor(dist / 10);
        spawn -= dt;
        if (spawn <= 0) { obs.push({ x: W + 20, h: ri(22, 46) }); spawn = rnd(0.7, 1.3) - Math.min(0.4, spd / 1500); }
        for (const o of obs) o.x -= spd * dt;
        obs = obs.filter(o => o.x > -30);
        for (const o of obs)
          if (px + 18 > o.x && px - 18 < o.x + 24 && py + 18 > gy - o.h) { this.over = 1; }
      },
      draw() {
        bg("#10082a", "#2a0f3a");
        ctx.strokeStyle = "#27e8ff"; ctx.globalAlpha = .35;
        for (let i = 0; i < W; i += 40) { ctx.beginPath(); ctx.moveTo(i - (dist % 40), gy + 20); ctx.lineTo(i + 20 - (dist % 40), H); ctx.stroke(); }
        ctx.globalAlpha = 1;
        ctx.fillStyle = "#9b6bff"; ctx.fillRect(0, gy + 20, W, H);
        ctx.fillStyle = "#ffd23e"; ctx.shadowColor = "#ffd23e"; ctx.shadowBlur = 14;
        ctx.fillRect(px - 16, py - 16, 32, 36); ctx.shadowBlur = 0;
        ctx.fillStyle = "#ff3ea5";
        for (const o of obs) ctx.fillRect(o.x, gy + 20 - o.h, 24, o.h);
      },
    };
  });

  /* Top-down dodger (Turbo Circuit / Kart Kombat) */
  def("dodger", "Steer left/right with the D-pad or arrow keys. Dodge oncoming traffic.", () => {
    const lanes = [120, 200, 280, 360];
    let lane = 1, px = lanes[1], spd = 230, cars = [], spawn = 0, t = 0;
    return {
      step(dt) {
        if (IN.e.left && lane > 0) lane--;
        if (IN.e.right && lane < 3) lane++;
        px += (lanes[lane] - px) * Math.min(1, dt * 12);
        spd += dt * 8; t += dt; this.score = Math.floor(t * 10);
        spawn -= dt;
        if (spawn <= 0) { cars.push({ x: lanes[ri(0, 3)], y: -50 }); spawn = rnd(0.55, 1.0) - Math.min(0.3, spd / 2000); }
        for (const c of cars) c.y += spd * dt;
        cars = cars.filter(c => c.y < H + 60);
        for (const c of cars)
          if (Math.abs(c.x - px) < 38 && Math.abs(c.y - 310) < 46) this.over = 1;
      },
      draw() {
        bg("#07111a", "#0a0613");
        ctx.fillStyle = "#141a2e"; ctx.fillRect(90, 0, 320, H);
        ctx.strokeStyle = "#ffd23e"; ctx.setLineDash([18, 16]); ctx.lineWidth = 4;
        for (const lx of [160, 240, 320]) {
          ctx.beginPath(); ctx.moveTo(lx, (t * 260) % 34 - 34); ctx.lineTo(lx, H); ctx.stroke();
        }
        ctx.setLineDash([]);
        ctx.fillStyle = "#ff3ea5";
        for (const c of cars) { ctx.fillRect(c.x - 22, c.y - 30, 44, 60); }
        ctx.fillStyle = "#27e8ff"; ctx.shadowColor = "#27e8ff"; ctx.shadowBlur = 16;
        ctx.fillRect(px - 22, 280, 44, 60); ctx.shadowBlur = 0;
      },
    };
  });

  /* Maze Muncher (Pac-Man-like) */
  def("muncher", "Move with the D-pad / arrows. Eat every pellet. Avoid the ghost!", () => {
    const C = 8, R = 6, cs = 60;
    let grid, px, py, dx = 0, dy = 0, gx, gy, t = 0, gt = 0, left = 0;
    function build() {
      grid = []; left = 0;
      for (let y = 0; y < R; y++) { const row = []; for (let x = 0; x < C; x++) {
        const wall = x === 0 || y === 0 || x === C - 1 || y === R - 1 ||
          ((x % 2 === 0) && (y % 2 === 0) && x > 1 && x < C - 2 && y > 1 && y < R - 2);
        row.push(wall ? 1 : 2); if (!wall) left++;
      } grid.push(row); }
      px = 1; py = 1; grid[1][1] = 0; left--; gx = C - 2; gy = R - 2; grid[gy][gx] = 0; left--;
    }
    build();
    const open = (x, y) => x >= 0 && y >= 0 && x < C && y < R && grid[y][x] !== 1;
    return {
      step(dt) {
        if (IN.dir === "L") { dx = -1; dy = 0; } if (IN.dir === "R") { dx = 1; dy = 0; }
        if (IN.dir === "U") { dx = 0; dy = -1; } if (IN.dir === "D") { dx = 0; dy = 1; }
        t += dt; gt += dt;
        if (t >= 0.16) {
          t = 0;
          if ((dx || dy) && open(px + dx, py + dy)) {
            px += dx; py += dy;
            if (grid[py][px] === 2) { grid[py][px] = 0; this.score += 10; if (--left <= 0) { this.score += 300; build(); } }
          }
        }
        if (gt >= 0.22) {
          gt = 0;
          const opts = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([ox, oy]) => open(gx + ox, gy + oy));
          opts.sort((a, b) => (Math.abs(gx + a[0] - px) + Math.abs(gy + a[1] - py)) -
            (Math.abs(gx + b[0] - px) + Math.abs(gy + b[1] - py)));
          if (opts[0]) { gx += opts[0][0]; gy += opts[0][1]; }
        }
        if (gx === px && gy === py) this.over = 1;
      },
      draw() {
        bg("#05030f", "#0a0613");
        for (let y = 0; y < R; y++) for (let x = 0; x < C; x++) {
          if (grid[y][x] === 1) { ctx.fillStyle = "#3a2a6b"; ctx.fillRect(x * cs + 2, y * cs + 2, cs - 4, cs - 4); }
          else if (grid[y][x] === 2) { ctx.fillStyle = "#ffd23e"; ctx.beginPath(); ctx.arc(x * cs + cs / 2, y * cs + cs / 2, 5, 0, 7); ctx.fill(); }
        }
        ctx.fillStyle = "#27e8ff"; ctx.beginPath();
        ctx.arc(px * cs + cs / 2, py * cs + cs / 2, cs / 2 - 8, 0.25 * Math.PI, 1.75 * Math.PI); ctx.lineTo(px * cs + cs / 2, py * cs + cs / 2); ctx.fill();
        ctx.fillStyle = "#ff3ea5"; ctx.beginPath();
        ctx.arc(gx * cs + cs / 2, gy * cs + cs / 2, cs / 2 - 8, Math.PI, 0); ctx.fill();
        ctx.fillRect(gx * cs + 8, gy * cs + cs / 2, cs - 16, cs / 2 - 8);
      },
    };
  });

  /* Wave shooter (FPS Arena / Galaxy Blaster) */
  def("shooter", "Move left/right. Press A / Space to fire. Survive the waves.", () => {
    let px = W / 2, bul = [], en = [], edir = 1, wave = 1, fc = 0;
    function spawn() {
      en = []; const rows = Math.min(4, 1 + wave), cols = 7;
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++)
        en.push({ x: 70 + c * 50, y: 40 + r * 38 });
    }
    spawn();
    return {
      step(dt) {
        if (IN.h.left) px -= 280 * dt; if (IN.h.right) px += 280 * dt;
        px = Math.max(20, Math.min(W - 20, px));
        fc -= dt;
        if ((IN.e.action || IN.h.action) && fc <= 0) { bul.push({ x: px, y: 320 }); fc = 0.28; }
        for (const b of bul) b.y -= 520 * dt;
        bul = bul.filter(b => b.y > -10);
        const sp = 26 + wave * 8; let edge = 0;
        for (const e of en) { e.x += edir * sp * dt; if (e.x < 18 || e.x > W - 18) edge = 1; }
        if (edge) { edir *= -1; for (const e of en) e.y += 18; }
        for (const b of bul) for (const e of en)
          if (!e.dead && Math.abs(b.x - e.x) < 18 && Math.abs(b.y - e.y) < 16) { e.dead = b.dead = 1; this.score += 50; }
        bul = bul.filter(b => !b.dead); en = en.filter(e => !e.dead);
        for (const e of en) if (e.y > 300) this.over = 1;
        if (!en.length) { wave++; this.score += 100; spawn(); }
      },
      draw() {
        bg("#02030f", "#0a0613");
        for (let i = 0; i < 40; i++) { ctx.fillStyle = "#2a2050"; ctx.fillRect((i * 53) % W, (i * 71 + (Date.now() / 20 % H)) % H, 2, 2); }
        ctx.fillStyle = "#27e8ff"; ctx.shadowColor = "#27e8ff"; ctx.shadowBlur = 12;
        ctx.beginPath(); ctx.moveTo(px, 318); ctx.lineTo(px - 16, 344); ctx.lineTo(px + 16, 344); ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = "#ffd23e"; for (const b of bul) ctx.fillRect(b.x - 2, b.y - 8, 4, 12);
        ctx.fillStyle = "#ff3ea5"; for (const e of en) ctx.fillRect(e.x - 15, e.y - 12, 30, 24);
        txt("WAVE " + wave, W - 8, 20, 9, "#9b8fc7", "right");
      },
    };
  });

  /* Asteroids (Asteroid Storm) */
  def("asteroids", "Left/Right rotate, Up thrusts, A / Space shoots. Blast the rocks.", () => {
    let s = { x: W / 2, y: H / 2, a: -Math.PI / 2, vx: 0, vy: 0 }, bul = [], rocks = [], fc = 0;
    for (let i = 0; i < 5; i++) rocks.push({ x: rnd(0, W), y: rnd(0, 80), vx: rnd(-60, 60), vy: rnd(30, 70), r: 28 });
    const wrap = (o) => { if (o.x < 0) o.x += W; if (o.x > W) o.x -= W; if (o.y < 0) o.y += H; if (o.y > H) o.y -= H; };
    return {
      step(dt) {
        if (IN.h.left) s.a -= 3.4 * dt; if (IN.h.right) s.a += 3.4 * dt;
        if (IN.h.up) { s.vx += Math.cos(s.a) * 240 * dt; s.vy += Math.sin(s.a) * 240 * dt; }
        s.vx *= 0.99; s.vy *= 0.99; s.x += s.vx * dt; s.y += s.vy * dt; wrap(s);
        fc -= dt;
        if ((IN.e.action || IN.h.action) && fc <= 0) { bul.push({ x: s.x, y: s.y, vx: Math.cos(s.a) * 360, vy: Math.sin(s.a) * 360, life: 1.1 }); fc = 0.3; }
        for (const b of bul) { b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt; wrap(b); }
        bul = bul.filter(b => b.life > 0);
        for (const r of rocks) { r.x += r.vx * dt; r.y += r.vy * dt; wrap(r); }
        for (const b of bul) for (const r of rocks)
          if (!r.dead && Math.hypot(b.x - r.x, b.y - r.y) < r.r) {
            r.dead = b.dead = 1; this.score += 30;
            if (r.r > 16) for (let k = 0; k < 2; k++) rocks.push({ x: r.x, y: r.y, vx: rnd(-90, 90), vy: rnd(-90, 90), r: r.r / 2 });
          }
        bul = bul.filter(b => !b.dead); rocks = rocks.filter(r => !r.dead);
        for (const r of rocks) if (Math.hypot(s.x - r.x, s.y - r.y) < r.r + 8) this.over = 1;
        if (!rocks.length) { for (let i = 0; i < 6; i++) rocks.push({ x: rnd(0, W), y: rnd(0, 60), vx: rnd(-80, 80), vy: rnd(40, 90), r: 28 }); this.score += 100; }
      },
      draw() {
        bg("#02030f", "#0a0613");
        ctx.strokeStyle = "#27e8ff"; ctx.lineWidth = 2;
        ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.a);
        ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(-10, -9); ctx.lineTo(-10, 9); ctx.closePath(); ctx.stroke(); ctx.restore();
        ctx.fillStyle = "#ffd23e"; for (const b of bul) ctx.fillRect(b.x - 2, b.y - 2, 4, 4);
        ctx.strokeStyle = "#ff3ea5";
        for (const r of rocks) { ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, 7); ctx.stroke(); }
      },
    };
  });

  /* Bubble Pop (Bubble Pop Saga) */
  def("popper", "Tap / click the bubbles before they float off the top. 3 escapes and it's over.", () => {
    let b = [], spawn = 0, miss = 0, t = 0;
    const cols = ["#27e8ff", "#ff3ea5", "#ffd23e", "#46ff9c", "#9b6bff"];
    return {
      step(dt) {
        t += dt; spawn -= dt;
        if (spawn <= 0) { b.push({ x: rnd(40, W - 40), y: H + 30, r: rnd(20, 34), c: cols[ri(0, 4)], vy: rnd(50, 80) + t * 2 }); spawn = Math.max(0.4, 1.1 - t * 0.02); }
        for (const o of b) o.y -= o.vy * dt;
        for (const o of b) if (o.y < -o.r && !o.gone) { o.gone = 1; if (++miss >= 3) this.over = 1; }
        b = b.filter(o => !o.gone && !o.pop);
        if (IN.p.click) for (const o of b)
          if (Math.hypot(IN.p.x - o.x, IN.p.y - o.y) < o.r) { o.pop = 1; this.score += 10; break; }
      },
      draw() {
        bg("#0a0613", "#10082a");
        for (const o of b) {
          ctx.fillStyle = o.c; ctx.globalAlpha = .85; ctx.beginPath(); ctx.arc(o.x, o.y, o.r, 0, 7); ctx.fill();
          ctx.globalAlpha = 1; ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(o.x - o.r / 3, o.y - o.r / 3, o.r / 5, 0, 7); ctx.fill();
        }
        txt("MISS " + miss + "/3", W - 8, 20, 9, "#ff3ea5", "right");
      },
    };
  });

  /* Pixel Heist (timing) */
  def("heist", "Press A / Space when the marker is inside the green zone to crack the vault.", () => {
    let pos = 0, dir = 1, spd = 0.9, cen = 0.5, half = 0.16, alarm = 0, cracks = 0, vault = 1, flash = 0;
    return {
      step(dt) {
        pos += dir * spd * dt; if (pos > 1) { pos = 1; dir = -1; } if (pos < 0) { pos = 0; dir = 1; }
        if (flash > 0) flash -= dt;
        if (IN.e.action) {
          if (Math.abs(pos - cen) <= half) {
            this.score += 100; cracks++; half = Math.max(0.05, half * 0.86); spd *= 1.13; cen = rnd(0.2, 0.8); flash = 0.25;
            if (cracks % 5 === 0) { vault++; this.score += 300; half = Math.min(0.18, half + 0.06); }
          } else { if (++alarm >= 3) this.over = 1; flash = 0.25; }
        }
      },
      draw() {
        bg("#05030f", "#150c2b");
        txt("VAULT " + vault, W / 2, 70, 14, "#ffd23e");
        txt("CRACKS " + cracks + "   ALARM " + alarm + "/3", W / 2, 100, 9, "#9b8fc7");
        const bx = 60, bw = W - 120, by = 190;
        ctx.fillStyle = "#1a1233"; ctx.fillRect(bx, by, bw, 30);
        ctx.fillStyle = "#46ff9c"; ctx.fillRect(bx + (cen - half) * bw, by, half * 2 * bw, 30);
        ctx.fillStyle = flash > 0 ? "#ff3ea5" : "#27e8ff"; ctx.fillRect(bx + pos * bw - 3, by - 10, 6, 50);
        txt("PRESS  A", W / 2, 280, 11, "#f3ecff");
      },
    };
  });

  /* Block Cascade (stacker) */
  def("stacker", "Left/Right move, Down soft-drop, A / Up rotate. Clear full lines.", () => {
    const COL = 10, ROW = 16, cell = 22, ox = (W - COL * cell) / 2, oy = 10;
    const SH = [
      [[1, 1, 1, 1]], [[1, 1], [1, 1]], [[0, 1, 0], [1, 1, 1]],
      [[1, 0, 0], [1, 1, 1]], [[0, 0, 1], [1, 1, 1]], [[0, 1, 1], [1, 1, 0]], [[1, 1, 0], [0, 1, 1]],
    ];
    const COLR = ["#27e8ff", "#ffd23e", "#9b6bff", "#ff8a3e", "#3e7dff", "#46ff9c", "#ff3ea5"];
    const bd = Array.from({ length: ROW }, () => Array(COL).fill(0));
    let pc, drop = 0, di = 0.55;
    function np() { const i = ri(0, 6); pc = { s: SH[i].map(r => r.slice()), c: COLR[i], x: 3, y: 0 }; if (hit(pc.s, pc.x, pc.y)) gameOver = 1; }
    function hit(s, x, y) {
      for (let r = 0; r < s.length; r++) for (let c = 0; c < s[r].length; c++)
        if (s[r][c]) { const nx = x + c, ny = y + r; if (nx < 0 || nx >= COL || ny >= ROW || (ny >= 0 && bd[ny][nx])) return 1; }
      return 0;
    }
    function rot(s) { const h = s.length, w = s[0].length, n = Array.from({ length: w }, () => Array(h).fill(0)); for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) n[c][h - 1 - r] = s[r][c]; return n; }
    let gameOver = 0; np();
    return {
      step(dt) {
        if (gameOver) { this.over = 1; return; }
        if (IN.e.left && !hit(pc.s, pc.x - 1, pc.y)) pc.x--;
        if (IN.e.right && !hit(pc.s, pc.x + 1, pc.y)) pc.x++;
        if (IN.e.action || IN.e.up) { const r = rot(pc.s); if (!hit(r, pc.x, pc.y)) pc.s = r; }
        drop += dt * (IN.h.down ? 8 : 1);
        if (drop >= di) {
          drop = 0;
          if (!hit(pc.s, pc.x, pc.y + 1)) pc.y++;
          else {
            pc.s.forEach((row, r) => row.forEach((v, c) => { if (v && pc.y + r >= 0) bd[pc.y + r][pc.x + c] = pc.c; }));
            let lines = 0;
            for (let r = ROW - 1; r >= 0; r--) if (bd[r].every(v => v)) { bd.splice(r, 1); bd.unshift(Array(COL).fill(0)); lines++; r++; }
            if (lines) { this.score += [0, 100, 250, 450, 700][lines]; di = Math.max(0.18, di - 0.015 * lines); }
            np();
          }
        }
      },
      draw() {
        bg("#05030f", "#10082a");
        ctx.fillStyle = "#0d0820"; ctx.fillRect(ox, oy, COL * cell, ROW * cell);
        for (let r = 0; r < ROW; r++) for (let c = 0; c < COL; c++) if (bd[r][c]) {
          ctx.fillStyle = bd[r][c]; ctx.fillRect(ox + c * cell + 1, oy + r * cell + 1, cell - 2, cell - 2);
        }
        ctx.fillStyle = pc.c;
        pc.s.forEach((row, r) => row.forEach((v, c) => { if (v) ctx.fillRect(ox + (pc.x + c) * cell + 1, oy + (pc.y + r) * cell + 1, cell - 2, cell - 2); }));
        ctx.strokeStyle = "#3a2a6b"; ctx.strokeRect(ox, oy, COL * cell, ROW * cell);
      },
    };
  });

  /* Spend 100 Million */
  def("spend", "Tap items to buy them (D-pad to select, A to buy). Blow the whole $100,000,000 before time runs out!", () => {
    const items = [
      ["Coffee", 5, "☕"], ["Sneakers", 250, "👟"], ["Gaming PC", 3500, "🖥️"], ["Sports Car", 95000, "🏎️"],
      ["Diamond", 1.2e6, "💎"], ["Mansion", 1.2e7, "🏰"], ["Island", 4.5e7, "🏝️"], ["Private Jet", 6.5e7, "✈️"],
    ];
    let budget = 1e8, spent = 0, owned = Array(8).fill(0), tleft = 45, sel = 0;
    const fmt = (n) => "$" + Math.round(n).toLocaleString("en-US");
    function buy(i) { if (budget >= items[i][1]) { budget -= items[i][1]; spent += items[i][1]; owned[i]++; this.score = Math.round(spent); } }
    const cellW = W / 2, cellH = 56, gy0 = 96;
    return {
      step(dt) {
        tleft -= dt;
        if (IN.e.left) sel = (sel + 7) % 8; if (IN.e.right) sel = (sel + 1) % 8;
        if (IN.e.up) sel = (sel + 6) % 8; if (IN.e.down) sel = (sel + 2) % 8;
        if (IN.e.action) buy.call(this, sel);
        if (IN.p.click && IN.p.y > gy0) {
          const col = IN.p.x < cellW ? 0 : 1, row = Math.floor((IN.p.y - gy0) / cellH);
          const idx = row * 2 + col; if (idx >= 0 && idx < 8) { sel = idx; buy.call(this, idx); }
        }
        this.score = Math.round(spent);
        if (tleft <= 0 || budget < 5) this.over = 1;
      },
      draw() {
        bg("#0a0613", "#1a1006");
        txt("BUDGET LEFT", W / 2, 28, 9, "#9b8fc7");
        txt(fmt(budget), W / 2, 54, 16, budget > 1e7 ? "#46ff9c" : "#ffd23e");
        txt("TIME " + Math.max(0, Math.ceil(tleft)) + "s", W - 10, 80, 9, "#ff3ea5", "right");
        txt("SPENT " + fmt(spent), 10, 80, 9, "#27e8ff", "left");
        for (let i = 0; i < 8; i++) {
          const cx = (i % 2) * cellW, cy = gy0 + Math.floor(i / 2) * cellH;
          ctx.fillStyle = i === sel ? "rgba(39,232,255,.18)" : "rgba(155,107,255,.07)";
          ctx.fillRect(cx + 4, cy + 3, cellW - 8, cellH - 6);
          ctx.strokeStyle = i === sel ? "#27e8ff" : "#3a2a6b"; ctx.strokeRect(cx + 4, cy + 3, cellW - 8, cellH - 6);
          ctx.textAlign = "left"; ctx.font = "20px serif"; ctx.fillStyle = "#fff";
          ctx.fillText(items[i][2], cx + 14, cy + 36);
          txt(items[i][0], cx + 44, cy + 24, 8, "#f3ecff", "left");
          txt(fmt(items[i][1]), cx + 44, cy + 42, 8, "#ffd23e", "left");
          if (owned[i]) txt("x" + owned[i], cx + cellW - 16, cy + 34, 9, "#46ff9c", "right");
        }
      },
    };
  });

  /* Mystery Machine — random game with bonus */
  GAMES.mystery = null;
  HOW.mystery = "A surprise game loads at random. Same controls — give it a shot!";

  /* ---------- Framework ---------- */
  function loop(ts) {
    if (!game) return;
    if (!last) last = ts;
    let dt = (ts - last) / 1000; last = ts; if (dt > 0.1) dt = 0.1;
    acc += dt;
    while (acc >= 1 / 60) {
      if (!game.over) game.step(1 / 60);
      IN.e.left = IN.e.right = IN.e.up = IN.e.down = IN.e.action = 0;
      IN.p.click = 0;
      acc -= 1 / 60;
    }
    game.draw();
    elScore.textContent = game.score | 0;
    if (game.over) { end(); return; }
    raf = requestAnimationFrame(loop);
  }

  function bestKey(id) { return "da_best_" + id; }
  function start() {
    let id = curId;
    if (id === "mystery") { id = POOL[ri(0, POOL.length - 1)]; elTitle.textContent = "MYSTERY ▸ " + id.toUpperCase(); }
    $("#ovStart").classList.add("hidden");
    $("#ovEnd").classList.add("hidden");
    game = GAMES[id]();
    game.score = game.score || 0; game.over = 0; game._id = id;
    elBest.textContent = +localStorage.getItem(bestKey(id)) || 0;
    elScore.textContent = 0;
    acc = 0; last = 0;
    cancelAnimationFrame(raf); raf = requestAnimationFrame(loop);
  }
  function end() {
    cancelAnimationFrame(raf);
    const id = game._id, sc = game.score | 0;
    const best = +localStorage.getItem(bestKey(id)) || 0;
    if (sc > best) { localStorage.setItem(bestKey(id), sc); elBest.textContent = sc; }
    $("#ovFinal").textContent = "Score: " + sc + (sc > best ? "  ★ NEW BEST!" : "");
    $("#ovEnd").classList.remove("hidden");
    game = null;
  }
  function close() {
    cancelAnimationFrame(raf); game = null; active = false;
    modal.classList.remove("open"); modal.setAttribute("aria-hidden", "true");
    for (const k in IN.h) IN.h[k] = 0;
  }

  function launchByName(name) {
    if (!modal) bindDOM();
    curId = NAME2ID[name] || "snake";
    elTitle.textContent = name.toUpperCase();
    elScore.textContent = 0;
    elBest.textContent = +localStorage.getItem(bestKey(curId === "mystery" ? "mystery" : curId)) || 0;
    $("#ovTitle").textContent = name;
    $("#ovHow").textContent = HOW[curId] || "Use the controls below.";
    $("#ovStart").classList.remove("hidden");
    $("#ovEnd").classList.add("hidden");
    bg("#0a0613", "#150c2b");
    modal.classList.add("open"); modal.setAttribute("aria-hidden", "false");
    active = true;
  }

  window.DAGames = { launchByName };
})();
