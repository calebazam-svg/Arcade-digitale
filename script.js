/* Digital Arcade — interactive layer */
(() => {
  "use strict";

  /* ---------- Data ---------- */
  const ads = [
    { t: "VR GALAXY RAID", s: "NEW IMMERSIVE WORLD", c: "#00f0ff" },
    { t: "FRIDAY ESPORTS FINALS", s: "$10,000 PRIZE POOL", c: "#ff2bd6" },
    { t: "AI BOSS CHALLENGE", s: "BEAT THE NEURAL CORE", c: "#b6ff3c" },
    { t: "DOUBLE TICKET HOUR", s: "EVERY DAY · 6–7 PM", c: "#ffcf3c" },
    { t: "RETRO NIGHT", s: "CLASSICS UNLOCKED", c: "#8a3cff" },
  ];

  const zones = [
    { i: "🕶️", h: "VR Gaming Arenas", p: "Free-roam holodecks with haptic suits and 360° tracking. Step into worlds, not screens.", g: "Immersive" },
    { i: "🏆", h: "Esports Stages", p: "Tournament-grade rigs facing a 12-meter LED wall with live casting and crowd seating.", g: "Competitive" },
    { i: "👾", h: "Retro Arcade Row", p: "Restored classics and pixel legends under glowing chrome — nostalgia, recharged.", g: "Classic" },
    { i: "🤖", h: "AI Game Stations", p: "Adaptive opponents that learn your style and scale the challenge in real time.", g: "Smart" },
    { i: "🏎️", h: "Racing Simulators", p: "Hydraulic motion rigs, triple-curved displays, and force-feedback wheels.", g: "Adrenaline" },
    { i: "🤸", h: "Motion Games", p: "Full-body courts where dancing, dodging and reflexes earn the score.", g: "Active" },
    { i: "🪝", h: "Hi-Tech Claw Machines", p: "Win drones, earbuds and collectibles from precision-engineered grab zones.", g: "Win Big" },
    { i: "🧊", h: "Interactive Walls", p: "Reactive light surfaces that turn touch and movement into living art and play.", g: "Sensory" },
    { i: "🎟️", h: "Digital Reward Hub", p: "Tap your band — tickets, XP and streaks sync instantly to your profile.", g: "Connected" },
    { i: "🛰️", h: "Mixed-Reality Lounge", p: "AR tables and holo-board games where the digital and physical collide.", g: "Next-Gen" },
  ];

  const prizes = [
    { p: "🎧", h: "Pro Gaming Headset", x: "12,000 TIX", s: "Surround · low-latency" },
    { p: "🎮", h: "Next-Gen Controller", x: "8,500 TIX", s: "Haptic triggers" },
    { p: "🚁", h: "FPV Camera Drone", x: "45,000 TIX", s: "4K · auto-follow" },
    { p: "⌚", h: "Smartwatch X", x: "30,000 TIX", s: "Health + gaming" },
    { p: "🕹️", h: "Mini Arcade Cab", x: "60,000 TIX", s: "Collector edition" },
    { p: "🎨", h: "Limited Figure Set", x: "15,000 TIX", s: "Exclusive drop" },
    { p: "💻", h: "Handheld Console", x: "90,000 TIX", s: "Grand prize" },
    { p: "🔋", h: "Gaming Gear Bundle", x: "20,000 TIX", s: "Mat · stand · cables" },
  ];

  const tiers = [
    { l: "TIER 01", h: "Rookie", f: ["Free day pass", "Standard ticket rate", "Profile + XP tracking"] },
    { l: "TIER 02", h: "Pro", f: ["+25% ticket bonus", "Priority queue", "Monthly prize drop"], feat: true },
    { l: "TIER 03", h: "Elite", f: ["+50% ticket bonus", "Free VR sessions", "Tournament entries"] },
    { l: "TIER 04", h: "Legend", f: ["2× tickets all day", "Private esports booth", "Exclusive rewards"] },
  ];

  const tickerItems = [
    "PLAY THE FUTURE", "VR GALAXY RAID — LIVE", "DOUBLE TICKETS 6–7PM",
    "ESPORTS FINALS FRIDAY", "AI BOSS CHALLENGE OPEN", "NEW PRIZE DROP",
    "24/7 GAMING PARADISE", "MEMBERS EARN 2× XP",
  ];

  /* ---------- Render ---------- */
  const el = (s) => document.querySelector(s);

  el("#adRail").innerHTML = ads.concat(ads[0])
    .map(a => `<div class="ad" style="color:${a.c};text-shadow:0 0 26px ${a.c}88">
      ${a.t}<small style="color:#cfe">${a.s}</small></div>`).join("");

  el("#crowd").innerHTML = Array.from({ length: 9 }, (_, i) =>
    `<div class="person" style="animation-delay:${(i * 0.3).toFixed(2)}s;height:${14 + (i % 3) * 4}px"></div>`).join("");

  el("#zoneGrid").innerHTML = zones.map(z =>
    `<article class="card"><div class="ico">${z.i}</div>
     <h3>${z.h}</h3><p>${z.p}</p><span class="tag">${z.g}</span></article>`).join("");

  el("#prizeGrid").innerHTML = prizes.map(p =>
    `<article class="prize"><div class="pic">${p.p}</div>
     <h3>${p.h}</h3><div class="tix">${p.x}</div><small>${p.s}</small></article>`).join("");

  el("#tierRow").innerHTML = tiers.map(t =>
    `<div class="tier${t.feat ? " featured" : ""}"><div class="lvl">${t.l}</div>
     <h3>${t.h}</h3><ul>${t.f.map(x => `<li>${x}</li>`).join("")}</ul></div>`).join("");

  const tk = tickerItems.concat(tickerItems)
    .map(t => `<span>◆</span><b>${t}</b>`).join(" ");
  el("#ticker").innerHTML = tk;

  /* ---------- Nav scroll ---------- */
  const nav = el("#nav");
  addEventListener("scroll", () => nav.classList.toggle("scrolled", scrollY > 40), { passive: true });

  /* ---------- Scroll reveal ---------- */
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e, idx) => {
      if (e.isIntersecting) {
        setTimeout(() => e.target.classList.add("in"), (idx % 6) * 80);
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0.15 });
  document.querySelectorAll(".card,.prize").forEach(n => io.observe(n));

  /* ---------- Count-up stats ---------- */
  const counters = document.querySelectorAll("[data-count]");
  const cio = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      const n = e.target, end = +n.dataset.count;
      let cur = 0;
      const step = Math.max(1, Math.round(end / 40));
      const t = setInterval(() => {
        cur += step;
        if (cur >= end) { cur = end; clearInterval(t); }
        n.textContent = cur + (end >= 24 && n.dataset.count === "24" ? "/7" : "+");
      }, 28);
      cio.unobserve(n);
    });
  }, { threshold: 0.6 });
  counters.forEach(n => cio.observe(n));

  /* ---------- Live esports score ---------- */
  const sA = el("#scoreA"), sB = el("#scoreB");
  setInterval(() => {
    if (Math.random() > 0.5) sA.textContent = +sA.textContent + 1;
    else sB.textContent = +sB.textContent + 1;
    if (+sA.textContent > 24 || +sB.textContent > 24) { sA.textContent = 14; sB.textContent = 12; }
  }, 3200);

  /* ---------- Signup ---------- */
  el("#signup").addEventListener("submit", (ev) => {
    ev.preventDefault();
    el("#formNote").textContent = "⚡ Day pass sent! Check your inbox and Play the Future.";
    el("#formNote").style.color = "#b6ff3c";
    ev.target.reset();
  });

  /* ---------- Canvas particle FX ---------- */
  const cv = el("#fx"), ctx = cv.getContext("2d");
  let w, h, parts;
  const colors = ["#00f0ff", "#ff2bd6", "#8a3cff", "#b6ff3c"];
  function resize() {
    w = cv.width = innerWidth; h = cv.height = innerHeight;
    parts = Array.from({ length: Math.min(90, Math.floor(w / 16)) }, () => ({
      x: Math.random() * w, y: Math.random() * h,
      r: Math.random() * 2 + 0.5,
      vx: (Math.random() - 0.5) * 0.4, vy: (Math.random() - 0.5) * 0.4,
      c: colors[(Math.random() * colors.length) | 0],
    }));
  }
  function loop() {
    ctx.clearRect(0, 0, w, h);
    for (const p of parts) {
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0 || p.x > w) p.vx *= -1;
      if (p.y < 0 || p.y > h) p.vy *= -1;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, 7);
      ctx.fillStyle = p.c;
      ctx.shadowBlur = 12; ctx.shadowColor = p.c;
      ctx.fill();
    }
    requestAnimationFrame(loop);
  }
  if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
    resize(); addEventListener("resize", resize); loop();
  }
})();
