/* Digital Arcade — platform logic */
(() => {
  "use strict";
  const $ = (s) => document.querySelector(s);
  const cats = ["Trending", "Retro Legends", "Multiplayer", "New Releases", "Competitive", "Exclusives"];

  const games = [
    { n: "Maze Muncher", e: "🟡", c: ["Trending", "Retro Legends"], r: 4.9, plays: "1.2M", badge: "hot" },
    { n: "Pixel Jumper", e: "🍄", c: ["Retro Legends", "Trending"], r: 4.7, plays: "880K" },
    { n: "Block Cascade", e: "🧩", c: ["Retro Legends", "Trending"], r: 4.8, plays: "1.0M" },
    { n: "Quest Pixels", e: "🗺️", c: ["Retro Legends", "New Releases"], r: 4.5, plays: "410K" },
    { n: "FPS Arena", e: "🔫", c: ["Exclusives", "Competitive", "Trending"], r: 4.9, plays: "950K", badge: "excl" },
    { n: "Spend 100 Million", e: "💸", c: ["Exclusives", "Trending"], r: 4.8, plays: "1.4M", badge: "excl" },
    { n: "Retro Rush", e: "⚡", c: ["Exclusives", "Competitive"], r: 4.7, plays: "720K", badge: "excl" },
    { n: "Pixel Heist", e: "🦝", c: ["Exclusives", "Multiplayer"], r: 4.6, plays: "530K", badge: "excl" },
    { n: "Mystery Machine", e: "🎰", c: ["Exclusives", "New Releases"], r: 4.5, plays: "300K", badge: "new" },
    { n: "Galaxy Blaster", e: "👾", c: ["Retro Legends", "Competitive"], r: 4.7, plays: "660K" },
    { n: "Bubble Pop Saga", e: "🫧", c: ["Trending", "New Releases"], r: 4.4, plays: "280K", badge: "new" },
    { n: "Dungeon Dash", e: "🐉", c: ["Multiplayer", "New Releases"], r: 4.5, plays: "190K", badge: "new" },
    { n: "Neon Snake", e: "🐍", c: ["Retro Legends", "Trending"], r: 4.6, plays: "770K" },
    { n: "Asteroid Storm", e: "🪨", c: ["Retro Legends", "Competitive"], r: 4.5, plays: "450K" },
    { n: "Claw Machine", e: "🧸", c: ["New Releases", "Trending"], r: 4.7, plays: "320K", badge: "new" },
    { n: "Neon Pong", e: "🏓", c: ["Retro Legends", "Competitive"], r: 4.6, plays: "510K" },
    { n: "Pong Cup", e: "🏆", c: ["Competitive", "New Releases", "Trending"], r: 4.8, plays: "430K", badge: "new" },
    { n: "Tower Siege", e: "🗼", c: ["New Releases", "Competitive"], r: 4.8, plays: "260K", badge: "new" },
    { n: "Word Rush", e: "🔤", c: ["New Releases", "Trending"], r: 4.7, plays: "390K", badge: "new" },
    { n: "Map Tap", e: "🌍", c: ["New Releases", "Trending"], r: 4.5, plays: "210K", badge: "new" },
    { n: "Turret Survivors", e: "🤖", c: ["New Releases", "Trending", "Competitive"], r: 4.9, plays: "470K", badge: "hot" },
    { n: "Soccer Stars", e: "⚽", c: ["New Releases", "Multiplayer", "Competitive"], r: 4.8, plays: "560K", badge: "new" },
    { n: "Diner Empire", e: "🍳", c: ["New Releases", "Trending"], r: 4.7, plays: "380K", badge: "new" },
    { n: "Duo Pong", e: "⚔️", c: ["Multiplayer", "Competitive", "Retro Legends"], r: 4.8, plays: "290K", badge: "new" },
  ];

  const exclusives = [
    { i: "🔫", n: "FPS Arena", d: "Fast-paced arcade shooter with stacking power-ups and relentless wave survival.", t: "SHOOTER · SOLO/CO-OP" },
    { i: "💸", n: "Spend 100 Million", d: "Burn through an absurd fortune via wild choices, upgrades and ridiculous purchases.", t: "CHALLENGE · IDLE" },
    { i: "⚡", n: "Retro Rush", d: "Endless arcade survival — react fast, chain combos, chase the all-time high score.", t: "ENDLESS · ARCADE" },
    { i: "🦝", n: "Pixel Heist", d: "Team up, plan the perfect score and outsmart rivals in tense multiplayer raids.", t: "STRATEGY · MULTIPLAYER" },
    { i: "🎰", n: "Mystery Machine", d: "A random game generator that drops you into surprise modes — with bonus rewards.", t: "RANDOM · REWARDS" },
  ];

  const achievements = [
    { i: "🥇", t: "First Blood", d: "Win your first match", on: 1 },
    { i: "🔥", t: "Hot Streak", d: "7-day login streak", on: 1 },
    { i: "💯", t: "Centurion", d: "Play 100 games", on: 1 },
    { i: "👑", t: "Top 10 Global", d: "Reach the global top 10", on: 0 },
    { i: "🎯", t: "Sharpshooter", d: "90% accuracy in FPS Arena", on: 0 },
  ];

  const leaderboard = [
    { n: "xX_NeonViper_Xx", p: "182,400" },
    { n: "RetroQueen", p: "171,950" },
    { n: "GhostByte", p: "164,720" },
    { n: "PixelKnight_99", p: "158,300", you: 1 },
    { n: "ArcadeApe", p: "151,880" },
    { n: "SynthRider", p: "146,210" },
  ];

  const avatars = ["🕹️", "👾", "🤖", "🐱", "🦊", "👻", "🐉", "🦄"];

  /* ---- Render category nav + filters ---- */
  $("#catNav").innerHTML = cats.map((c, i) =>
    `<button data-cat="${c}"${i === 0 ? ' class="active"' : ""}>${c}</button>`).join("");
  $("#filters").innerHTML = `<button data-f="All" class="active">All</button>` +
    cats.map(c => `<button data-f="${c}">${c}</button>`).join("");

  /* ---- Game grid ---- */
  function gameCard(g) {
    const bd = g.badge ? `<span class="badge b-${g.badge}">${g.badge === "excl" ? "EXCLUSIVE" : g.badge.toUpperCase()}</span>` : "";
    return `<article class="gcard" data-cats="${g.c.join(",")}">
      ${bd}
      <div class="gthumb" style="background:linear-gradient(150deg,${tint(g.n)})">${g.e}</div>
      <div class="gmeta"><h3>${g.n}</h3>
        <div class="grow"><span class="star">★ ${g.r}</span><span>${g.plays} plays</span></div>
      </div></article>`;
  }
  function tint(s) {
    const palette = [["#27e8ff33", "#9b6bff22"], ["#ff3ea533", "#9b6bff22"], ["#ffd23e33", "#ff3ea522"], ["#46ff9c33", "#27e8ff22"]];
    const k = s.charCodeAt(0) % palette.length;
    return palette[k].join(",");
  }
  /* ---- Scroll reveal (must be set up before first renderGames call) ---- */
  const ro = new IntersectionObserver((entries) => {
    entries.forEach((e, i) => {
      if (e.isIntersecting) {
        setTimeout(() => e.target.classList.add("in"), (i % 8) * 60);
        ro.unobserve(e.target);
      }
    });
  }, { threshold: 0.12 });
  function revealObserve() {
    document.querySelectorAll(".gcard:not(.in)").forEach(n => ro.observe(n));
  }

  const grid = $("#gameGrid");
  function renderGames(filter) {
    const list = filter && filter !== "All" ? games.filter(g => g.c.includes(filter)) : games;
    grid.innerHTML = list.map(gameCard).join("");
    revealObserve();
  }
  renderGames("All");

  /* ---- Exclusives ---- */
  $("#exclGrid").innerHTML = exclusives.map(e =>
    `<article class="ecard"><div class="eico">${e.i}</div>
     <h3>${e.n}</h3><p>${e.d}</p><span class="etag">${e.t}</span></article>`).join("");

  /* ---- Dashboard ---- */
  $("#achList").innerHTML = achievements.map(a =>
    `<div class="ach${a.on ? "" : " locked"}"><span class="aico">${a.on ? a.i : "🔒"}</span>
     <div><b>${a.t}</b><small>${a.d}</small></div></div>`).join("");

  $("#lb").innerHTML = leaderboard.map((u, i) =>
    `<li class="${u.you ? "you" : ""}"><span class="rank">#${i + 1}</span>
     <span class="who">${u.n}${u.you ? " (You)" : ""}</span><span class="pts">${u.p}</span></li>`).join("");

  $("#avaPick").innerHTML = avatars.map((a, i) =>
    `<button class="${i === 0 ? "sel" : ""}" data-a="${a}">${a}</button>`).join("");

  const recoSrc = ["FPS Arena", "Duo Pong", "Neon Snake", "Pixel Heist", "Galaxy Blaster", "Block Cascade"];
  $("#recoRow").innerHTML = recoSrc.map(n => {
    const g = games.find(x => x.n === n);
    return `<div class="reco-card"><div class="rt">${g.e}</div><p>${g.n}</p></div>`;
  }).join("");

  /* ---- Arcade sound (WebAudio synth, no assets) ---- */
  let AC, sound = true;
  function beep(freq, dur = 0.08, type = "square", vol = 0.05) {
    if (!sound) return;
    AC = AC || new (window.AudioContext || window.webkitAudioContext)();
    const o = AC.createOscillator(), g = AC.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, AC.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, AC.currentTime + dur);
    o.connect(g).connect(AC.destination);
    o.start(); o.stop(AC.currentTime + dur);
  }
  function coinSound() { beep(880, 0.07); setTimeout(() => beep(1320, 0.12), 70); }
  $("#sndBtn").addEventListener("click", (e) => {
    sound = !sound;
    e.currentTarget.textContent = sound ? "🔊" : "🔇";
    if (sound) beep(660, 0.1);
  });

  /* ---- AI difficulty cycle (Easy / Normal / Hard) ---- */
  const DIFFS = ["easy","normal","hard"];
  function refreshDiffBtn(){
    const d = (window.DAGames && window.DAGames.getDifficulty && window.DAGames.getDifficulty()) || "normal";
    const btn = $("#diffBtn");
    btn.textContent = d.toUpperCase();
    btn.className = "diff " + d;
  }
  refreshDiffBtn();
  $("#diffBtn").addEventListener("click", () => {
    const cur = (window.DAGames && window.DAGames.getDifficulty && window.DAGames.getDifficulty()) || "normal";
    const idx = DIFFS.indexOf(cur);
    const next = DIFFS[(idx + 1) % DIFFS.length];
    if (window.DAGames && window.DAGames.setDifficulty) window.DAGames.setDifficulty(next);
    refreshDiffBtn();
    beep(700, 0.06); setTimeout(() => beep(990, 0.1), 60);
    toast("AI Difficulty: " + next.toUpperCase());
  });

  /* ---- Interactions ---- */
  function toast(msg) {
    let t = $(".toast");
    if (!t) { t = document.createElement("div"); t.className = "toast"; document.body.appendChild(t); }
    t.textContent = msg; requestAnimationFrame(() => t.classList.add("show"));
    clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("show"), 2600);
  }

  document.addEventListener("mouseover", (e) => {
    if (e.target.closest(".gcard,.ecard,.btn,.cat-nav button,.filters button")) beep(520, 0.03, "triangle", 0.025);
  });

  document.addEventListener("click", (e) => {
    const card = e.target.closest(".gcard,.ecard,.reco-card");
    if (card) {
      const name = card.querySelector("h3,p")?.textContent.trim();
      beep(740, 0.06); setTimeout(() => beep(990, 0.1), 60);
      if (window.DAGames) window.DAGames.launchByName(name);
      else toast("▶ Launching " + name + "…");
      return;
    }
    const cat = e.target.closest(".cat-nav button");
    if (cat) {
      document.querySelectorAll(".cat-nav button").forEach(b => b.classList.remove("active"));
      cat.classList.add("active");
      const f = cat.dataset.cat;
      document.querySelectorAll(".filters button").forEach(b =>
        b.classList.toggle("active", b.dataset.f === f));
      renderGames(f);
      beep(620, 0.05);
      $("#library").scrollIntoView({ behavior: "smooth" });
      return;
    }
    const flt = e.target.closest(".filters button");
    if (flt) {
      document.querySelectorAll(".filters button").forEach(b => b.classList.remove("active"));
      flt.classList.add("active");
      document.querySelectorAll(".cat-nav button").forEach(b =>
        b.classList.toggle("active", b.dataset.cat === flt.dataset.f));
      renderGames(flt.dataset.f);
      beep(620, 0.05);
      return;
    }
    const av = e.target.closest(".ava-pick button");
    if (av) {
      document.querySelectorAll(".ava-pick button").forEach(b => b.classList.remove("sel"));
      av.classList.add("sel");
      $("#avaBig").textContent = av.dataset.a;
      $("#avaMini").textContent = av.dataset.a;
      beep(700, 0.05);
    }
  });

  /* ---- Navigation: every click takes you somewhere ---- */
  function goTo(sel) {
    const t = $(sel);
    if (t) t.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  $("#profileBtn").addEventListener("click", () => { beep(680, 0.05); goTo("#dash"); });
  $("#avaMini").addEventListener("click", () => goTo("#dash"));

  const playNow = document.querySelector('.hero-actions a[href="#library"]');

  document.querySelectorAll('a[href^="#"]').forEach(a => {
    if (a === playNow) return;
    a.addEventListener("click", (ev) => {
      const id = a.getAttribute("href");
      if (id.length > 1 && $(id)) { ev.preventDefault(); beep(600, 0.04); goTo(id); }
    });
  });

  // Hero "Play Now" instantly drops you into a featured game
  if (playNow) playNow.addEventListener("click", (ev) => {
    ev.preventDefault();
    beep(740, 0.06); setTimeout(() => beep(990, 0.1), 60);
    const featured = games.filter(g => g.c.includes("Trending"));
    const pick = featured[Math.floor(Math.random() * featured.length)] || games[0];
    if (window.DAGames) window.DAGames.launchByName(pick.n);
    else goTo("#library");
  });

  /* ---- Daily reward ---- */
  let claimed = false;
  $("#streakDots").innerHTML = Array.from({ length: 7 }, (_, i) =>
    `<i class="${i < 4 ? "on" : ""}"></i>`).join("");
  $("#claimBtn").addEventListener("click", (e) => {
    if (claimed) return;
    claimed = true;
    coinSound();
    e.currentTarget.textContent = "Claimed ✓";
    e.currentTarget.style.opacity = ".6";
    $("#rwText").textContent = "+250 🪙 added! Day 5 streak — come back tomorrow.";
    $("#streakDots").children[4]?.classList.add("on");
    toast("🪙 +250 Coins Claimed!");
  });

  /* ---- Profile XP fill + count-up ---- */
  const xio = new IntersectionObserver((en) => {
    en.forEach(x => { if (x.isIntersecting) { $("#xpFill").style.width = "76.8%"; xio.disconnect(); } });
  }, { threshold: .4 });
  xio.observe($("#dash"));

  document.querySelectorAll("[data-count]").forEach(n => {
    const o = new IntersectionObserver(en => {
      if (!en[0].isIntersecting) return;
      const end = +n.dataset.count; let c = 0;
      const step = Math.max(1, Math.round(end / 35));
      const t = setInterval(() => {
        c += step; if (c >= end) { c = end; clearInterval(t); }
        n.textContent = c;
      }, 30);
      o.disconnect();
    }, { threshold: .6 });
    o.observe(n);
  });

  /* ---- Topbar + hero cabinet rotator ---- */
  addEventListener("scroll", () => $("#topbar").classList.toggle("scrolled", scrollY > 30), { passive: true });
  const demo = ["🟡", "👾", "🏎️", "🧩", "🔫", "🎰", "🐉"];
  let di = 0;
  setInterval(() => { di = (di + 1) % demo.length; $("#cabGame").textContent = demo[di]; }, 1400);
  $("#cabGame").textContent = demo[0];

  /* ---- Starfield canvas ---- */
  const cv = $("#stars"), ctx = cv.getContext("2d");
  let w, h, stars;
  function resize() {
    w = cv.width = innerWidth; h = cv.height = innerHeight;
    stars = Array.from({ length: Math.min(140, w / 12 | 0) }, () => ({
      x: Math.random() * w, y: Math.random() * h,
      z: Math.random() * 1.6 + .3, c: ["#27e8ff", "#ff3ea5", "#ffd23e", "#9b6bff"][Math.random() * 4 | 0]
    }));
  }
  function tick() {
    ctx.clearRect(0, 0, w, h);
    for (const s of stars) {
      s.y += s.z * .35; if (s.y > h) { s.y = 0; s.x = Math.random() * w; }
      ctx.globalAlpha = s.z / 2;
      ctx.fillStyle = s.c; ctx.fillRect(s.x, s.y, s.z * 1.6, s.z * 1.6);
    }
    ctx.globalAlpha = 1;
    requestAnimationFrame(tick);
  }
  if (!matchMedia("(prefers-reduced-motion: reduce)").matches) { resize(); addEventListener("resize", resize); tick(); }
})();
