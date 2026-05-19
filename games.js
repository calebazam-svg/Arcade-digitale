/* Digital Arcade – playable game engine
   window.DAGames.launchByName(title) opens the modal and starts that game. */
(function () {
  "use strict";
  var W = 480, H = 360;

  /* ── Input ──────────────────────────────────────────────── */
  var IN = {
    held: { left:0, right:0, up:0, down:0, action:0 },
    edge: { left:0, right:0, up:0, down:0, action:0 },
    dir: "",                        // "L" "R" "U" "D" – last pressed dir
    px: 0, py: 0, pclick: 0        // pointer coords + one-shot click
  };
  var ACTIVE = false;

  var KMAP = {
    ArrowLeft:"left", KeyA:"left", ArrowRight:"right", KeyD:"right",
    ArrowUp:"up", KeyW:"up", ArrowDown:"down", KeyS:"down",
    Space:"action", Enter:"action", KeyZ:"action", KeyJ:"action"
  };
  var DIRCH = { left:"L", right:"R", up:"U", down:"D" };

  function dn(n) {
    if (!(n in IN.held)) return;
    if (!IN.held[n]) IN.edge[n] = 1;
    IN.held[n] = 1;
    if (DIRCH[n]) IN.dir = DIRCH[n];
  }
  function up(n) { if (n in IN.held) IN.held[n] = 0; }
  function clearEdges() {
    IN.edge.left = IN.edge.right = IN.edge.up = IN.edge.down = IN.edge.action = 0;
    IN.pclick = 0;
  }

  window.addEventListener("keydown", function(ev) {
    var n = KMAP[ev.code]; if (!n || !ACTIVE) return;
    ev.preventDefault(); if (!ev.repeat) dn(n);
  });
  window.addEventListener("keyup", function(ev) {
    var n = KMAP[ev.code]; if (!n) return; up(n);
  });

  /* ── DOM refs (set once on first open) ─────────────────── */
  var modal, cv, ctx, elScore, elBest, elTitle, domBound = false;

  function bindDOM() {
    if (domBound) return;
    domBound = true;
    modal   = document.getElementById("modal");
    cv      = document.getElementById("screen");
    ctx     = cv.getContext("2d");
    elScore = document.getElementById("mScore");
    elBest  = document.getElementById("mBest");
    elTitle = document.getElementById("mTitle");

    document.getElementById("mClose").addEventListener("click", closeModal);
    modal.addEventListener("click", function(e){ if (e.target === modal) closeModal(); });
    document.getElementById("ovBtn").addEventListener("click", startGame);
    document.getElementById("ovRetry").addEventListener("click", startGame);

    document.querySelectorAll(".pad button").forEach(function(b) {
      var n = b.dataset.k;
      b.addEventListener("pointerdown", function(e){ e.preventDefault(); dn(n); b.classList.add("hit"); });
      b.addEventListener("pointerup",     function(){ up(n); b.classList.remove("hit"); });
      b.addEventListener("pointerleave",  function(){ up(n); b.classList.remove("hit"); });
      b.addEventListener("pointercancel", function(){ up(n); b.classList.remove("hit"); });
    });

    cv.addEventListener("pointerdown", function(e) {
      e.preventDefault();
      var r = cv.getBoundingClientRect();
      IN.px = (e.clientX - r.left) * W / r.width;
      IN.py = (e.clientY - r.top)  * H / r.height;
      IN.pclick = 1;
      IN.edge.action = 1;
    });
  }

  /* ── Helpers ─────────────────────────────────────────────── */
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function ri(a, b)  { return Math.floor(rnd(a, b + 1)); }

  function clear(c1, c2) {
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, c1); g.addColorStop(1, c2);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }
  function px_txt(str, x, y, sz, col, align) {
    ctx.save();
    ctx.font      = (sz || 10) + "px 'Press Start 2P', monospace";
    ctx.fillStyle = col   || "#f3ecff";
    ctx.textAlign = align || "center";
    ctx.fillText(str, x, y);
    ctx.restore();
  }
  function rect(x, y, w, h, col) {
    ctx.fillStyle = col;
    ctx.fillRect(x, y, w, h);
  }

  /* ── Game registry ───────────────────────────────────────── */
  var REGISTRY = {};   // id -> factory()
  var HOWTO    = {};   // id -> string
  function reg(id, howto, factory) { REGISTRY[id] = factory; HOWTO[id] = howto; }

  var NAME2ID = {
    "Neon Snake":"snake",         "Maze Muncher":"muncher",
    "Pixel Jumper":"runner",      "Retro Rush":"runner",
    "Dungeon Dash":"runner",      "Quest Pixels":"runner",
    "Turbo Circuit":"dodger",     "Kart Kombat":"dodger",
    "FPS Arena":"shooter",        "Galaxy Blaster":"shooter",
    "Asteroid Storm":"asteroids", "Bubble Pop Saga":"popper",
    "Block Cascade":"stacker",    "Pixel Heist":"heist",
    "Spend 100 Million":"spend",  "Mystery Machine":"mystery",
  };
  var POOL = ["snake","runner","dodger","muncher","shooter","asteroids","popper","heist","stacker","spend"];

  /* ════════════════════════════════════════════════════════════
     GAME DEFINITIONS – each factory() returns { update(dt), draw(), score, over }
     ════════════════════════════════════════════════════════════ */

  /* ── 1. Neon Snake ─────────────────────────────────────── */
  reg("snake",
    "Arrow keys or D-pad to steer. Eat the pink dots. Don't hit a wall or yourself.",
    function() {
      var CS = 20, COLS = W/CS|0, ROWS = H/CS|0;
      var body = [{x:8,y:9}], dx=1, dy=0, ndx=1, ndy=0, timer=0, spd=0.13;
      var food = randFood();

      function randFood() {
        var f;
        do { f = {x:ri(0,COLS-1), y:ri(0,ROWS-1)}; }
        while (body.some(function(s){ return s.x===f.x && s.y===f.y; }));
        return f;
      }

      return {
        score: 0, over: false,
        update: function(dt) {
          if (IN.dir==="L" && dx!==1) { ndx=-1; ndy=0; }
          if (IN.dir==="R" && dx!==-1){ ndx=1;  ndy=0; }
          if (IN.dir==="U" && dy!==1) { ndx=0;  ndy=-1; }
          if (IN.dir==="D" && dy!==-1){ ndx=0;  ndy=1;  }
          timer += dt;
          if (timer < spd) return;
          timer = 0; dx = ndx; dy = ndy;
          var hd = {x: body[0].x+dx, y: body[0].y+dy};
          if (hd.x<0||hd.x>=COLS||hd.y<0||hd.y>=ROWS) { this.over=true; return; }
          if (body.some(function(s){ return s.x===hd.x&&s.y===hd.y; })) { this.over=true; return; }
          body.unshift(hd);
          if (hd.x===food.x && hd.y===food.y) {
            this.score += 10;
            spd = Math.max(0.06, spd-0.003);
            food = randFood();
          } else {
            body.pop();
          }
        },
        draw: function() {
          clear("#0a0613","#150c2b");
          // grid lines
          ctx.strokeStyle = "rgba(155,107,255,.12)"; ctx.lineWidth=1;
          for(var i=0;i<COLS;i++){ctx.beginPath();ctx.moveTo(i*CS,0);ctx.lineTo(i*CS,H);ctx.stroke();}
          for(var j=0;j<ROWS;j++){ctx.beginPath();ctx.moveTo(0,j*CS);ctx.lineTo(W,j*CS);ctx.stroke();}
          // food
          rect(food.x*CS+4, food.y*CS+4, CS-8, CS-8, "#ff3ea5");
          // snake
          for(var k=0;k<body.length;k++) {
            ctx.fillStyle = k===0 ? "#27e8ff" : "#9b6bff";
            ctx.fillRect(body[k].x*CS+1, body[k].y*CS+1, CS-2, CS-2);
          }
          px_txt("SCORE "+this.score, W/2, H-8, 9, "#9b8fc7");
        }
      };
    }
  );

  /* ── 2. Endless Runner ─────────────────────────────────── */
  reg("runner",
    "Press A, Space, or Up to jump. Leap over obstacles — it speeds up!",
    function() {
      var GY=292, py=GY, vy=0, jumping=false, spd=220, obs=[], spawnT=0, dist=0;
      return {
        score:0, over:false,
        update: function(dt) {
          if ((IN.edge.action||IN.held.up) && !jumping) { vy=-440; jumping=true; }
          vy += 1400*dt; py += vy*dt;
          if (py>=GY) { py=GY; vy=0; jumping=false; }
          spd += dt*5; dist += spd*dt;
          this.score = Math.floor(dist/10);
          spawnT -= dt;
          if (spawnT<=0) {
            obs.push({x:W+10, h:ri(24,50)});
            spawnT = rnd(0.75,1.4) - Math.min(0.35, spd/1800);
          }
          for(var i=0;i<obs.length;i++) obs[i].x -= spd*dt;
          obs = obs.filter(function(o){ return o.x>-30; });
          var px=70;
          for(var j=0;j<obs.length;j++) {
            var o=obs[j];
            if (px+16>o.x && px-16<o.x+26 && py+18>GY-o.h) this.over=true;
          }
        },
        draw: function() {
          clear("#10082a","#2a0f3a");
          // ground
          rect(0,GY+20,W,H-GY-20,"#3a1a5a");
          // ground line
          ctx.strokeStyle="#9b6bff"; ctx.lineWidth=2;
          ctx.beginPath(); ctx.moveTo(0,GY+20); ctx.lineTo(W,GY+20); ctx.stroke();
          // player
          rect(54,py-20,32,40,"#ffd23e");
          // eyes
          rect(74,py-14,6,6,"#0a0613");
          // obstacles
          ctx.fillStyle="#ff3ea5";
          for(var i=0;i<obs.length;i++) rect(obs[i].x,GY+20-obs[i].h,26,obs[i].h,"#ff3ea5");
          px_txt(""+this.score, W/2, 24, 12, "#9b8fc7");
        }
      };
    }
  );

  /* ── 3. Traffic Dodger ─────────────────────────────────── */
  reg("dodger",
    "Left/Right arrow keys or D-pad to change lanes. Dodge the oncoming cars.",
    function() {
      var LANES=[100,200,300,400], lane=1, plx=LANES[1];
      var spd=200, cars=[], spawnT=0, time=0;
      return {
        score:0, over:false,
        update: function(dt) {
          if (IN.edge.left  && lane>0) lane--;
          if (IN.edge.right && lane<3) lane++;
          plx += (LANES[lane]-plx)*Math.min(1,dt*14);
          spd += dt*7; time += dt;
          this.score = Math.floor(time*10);
          spawnT -= dt;
          if (spawnT<=0) {
            cars.push({x:LANES[ri(0,3)], y:-60});
            spawnT = rnd(0.5,1.0) - Math.min(0.28,spd/2000);
          }
          for(var i=0;i<cars.length;i++) cars[i].y += spd*dt;
          cars = cars.filter(function(c){ return c.y<H+60; });
          for(var j=0;j<cars.length;j++) {
            var c=cars[j];
            if (Math.abs(c.x-plx)<40 && Math.abs(c.y-290)<52) this.over=true;
          }
        },
        draw: function() {
          clear("#07111a","#0a0613");
          // road
          rect(70,0,360,H,"#141a2e");
          // lane markings
          ctx.strokeStyle="#ffd23e44"; ctx.lineWidth=3; ctx.setLineDash([22,16]);
          var lx=[150,240,330];
          for(var i=0;i<lx.length;i++){
            ctx.beginPath(); ctx.moveTo(lx[i],0); ctx.lineTo(lx[i],H); ctx.stroke();
          }
          ctx.setLineDash([]);
          // enemy cars
          for(var j=0;j<cars.length;j++) {
            rect(cars[j].x-20,cars[j].y-32,40,64,"#ff3ea5");
            rect(cars[j].x-14,cars[j].y-24,28,20,"#ff8a8a44");
          }
          // player car
          rect(plx-20,262,40,64,"#27e8ff");
          rect(plx-14,270,28,20,"#9be8ff44");
          px_txt(""+this.score, W/2, 22, 12, "#9b8fc7");
        }
      };
    }
  );

  /* ── 4. Maze Muncher ───────────────────────────────────── */
  reg("muncher",
    "Arrow keys or D-pad to move. Eat all the yellow pellets. Avoid the pink ghost!",
    function() {
      var C=8, R=6, CS=60;
      var grid, pellets, px, py, wdx=0, wdy=0, gx, gy, ptimer=0, gtimer=0;

      function build() {
        grid=[]; pellets=0;
        for(var y=0;y<R;y++){
          var row=[];
          for(var x=0;x<C;x++){
            var wall = (x===0||y===0||x===C-1||y===R-1) ||
              (x%2===0&&y%2===0&&x>1&&x<C-2&&y>1&&y<R-2);
            row.push(wall?1:2);
            if(!wall) pellets++;
          }
          grid.push(row);
        }
        px=1; py=1;
        if(grid[py][px]===2){ grid[py][px]=0; pellets--; }
        gx=C-2; gy=R-2;
        if(grid[gy][gx]===2){ grid[gy][gx]=0; pellets--; }
      }
      build();

      function passable(x,y){ return x>=0&&y>=0&&x<C&&y<R&&grid[y][x]!==1; }

      return {
        score:0, over:false,
        update: function(dt) {
          if(IN.dir==="L"){ wdx=-1; wdy=0; }
          if(IN.dir==="R"){ wdx=1;  wdy=0; }
          if(IN.dir==="U"){ wdx=0;  wdy=-1; }
          if(IN.dir==="D"){ wdx=0;  wdy=1;  }
          ptimer+=dt;
          if(ptimer>=0.18) {
            ptimer=0;
            if((wdx||wdy)&&passable(px+wdx,py+wdy)){
              px+=wdx; py+=wdy;
              if(grid[py][px]===2){
                grid[py][px]=0; pellets--;
                this.score+=10;
                if(pellets<=0){ this.score+=300; build(); }
              }
            }
          }
          gtimer+=dt;
          if(gtimer>=0.26){
            gtimer=0;
            var dirs=[[1,0],[-1,0],[0,1],[0,-1]].filter(function(d){ return passable(gx+d[0],gy+d[1]); });
            dirs.sort(function(a,b){
              return (Math.abs(gx+a[0]-px)+Math.abs(gy+a[1]-py))
                    -(Math.abs(gx+b[0]-px)+Math.abs(gy+b[1]-py));
            });
            if(dirs[0]){ gx+=dirs[0][0]; gy+=dirs[0][1]; }
          }
          if(gx===px&&gy===py) this.over=true;
        },
        draw: function() {
          clear("#05030f","#0a0613");
          for(var y=0;y<R;y++) for(var x=0;x<C;x++){
            var cx=x*CS, cy=y*CS;
            if(grid[y][x]===1){
              rect(cx+2,cy+2,CS-4,CS-4,"#3a2a6b");
            } else if(grid[y][x]===2){
              ctx.fillStyle="#ffd23e";
              ctx.beginPath(); ctx.arc(cx+CS/2,cy+CS/2,5,0,Math.PI*2); ctx.fill();
            }
          }
          // player (pac-man shape)
          ctx.fillStyle="#27e8ff";
          ctx.beginPath();
          ctx.moveTo(px*CS+CS/2, py*CS+CS/2);
          ctx.arc(px*CS+CS/2, py*CS+CS/2, CS/2-8, 0.3, Math.PI*2-0.3);
          ctx.closePath(); ctx.fill();
          // ghost
          ctx.fillStyle="#ff3ea5";
          ctx.beginPath();
          ctx.arc(gx*CS+CS/2, gy*CS+CS/2-4, CS/2-8, Math.PI,0);
          ctx.rect(gx*CS+8, gy*CS+CS/2-12, CS-16, CS/2-2);
          ctx.fill();
          px_txt("PELLETS "+pellets, W/2, H-8, 7, "#9b8fc7");
        }
      };
    }
  );

  /* ── 5. Wave Shooter ───────────────────────────────────── */
  reg("shooter",
    "Left/Right to move, A or Space to shoot. Clear every wave to advance.",
    function() {
      var shipX=W/2, bullets=[], enemies=[], edir=1, wave=1, fireCD=0;

      function spawnWave() {
        enemies=[];
        var rows=Math.min(3,wave), cols=6;
        for(var r=0;r<rows;r++) for(var c=0;c<cols;c++)
          enemies.push({x:80+c*56, y:40+r*40, dead:false});
      }
      spawnWave();

      return {
        score:0, over:false,
        update: function(dt) {
          if(IN.held.left)  shipX -= 300*dt;
          if(IN.held.right) shipX += 300*dt;
          shipX = Math.max(16,Math.min(W-16,shipX));
          fireCD -= dt;
          if((IN.edge.action||IN.held.action) && fireCD<=0){
            bullets.push({x:shipX,y:310}); fireCD=0.25;
          }
          for(var i=0;i<bullets.length;i++) bullets[i].y -= 540*dt;
          bullets = bullets.filter(function(b){ return b.y>-10; });

          var sp=24+wave*7, hit=false;
          for(var e=0;e<enemies.length;e++){
            enemies[e].x += edir*sp*dt;
            if(enemies[e].x<14||enemies[e].x>W-14) hit=true;
          }
          if(hit){ edir*=-1; for(var ee=0;ee<enemies.length;ee++) enemies[ee].y+=16; }

          for(var bi=0;bi<bullets.length;bi++){
            for(var ei=0;ei<enemies.length;ei++){
              if(!enemies[ei].dead && !bullets[bi].dead &&
                 Math.abs(bullets[bi].x-enemies[ei].x)<18 &&
                 Math.abs(bullets[bi].y-enemies[ei].y)<16){
                enemies[ei].dead=true; bullets[bi].dead=true;
                this.score+=50;
              }
            }
          }
          bullets  = bullets.filter(function(b){ return !b.dead; });
          enemies  = enemies.filter(function(e){ return !e.dead; });
          for(var ei2=0;ei2<enemies.length;ei2++){
            if(enemies[ei2].y>300){ this.over=true; return; }
          }
          if(enemies.length===0){ wave++; this.score+=150; spawnWave(); }
        },
        draw: function() {
          clear("#02030f","#0a0613");
          // stars
          for(var i=0;i<30;i++){
            var sx=(i*97+Date.now()/40)%W, sy=(i*137)%H;
            rect(sx,sy,2,2,"#ffffff22");
          }
          // ship
          ctx.fillStyle="#27e8ff";
          ctx.beginPath(); ctx.moveTo(shipX,308); ctx.lineTo(shipX-18,340); ctx.lineTo(shipX+18,340); ctx.fill();
          rect(shipX-3,298,6,14,"#9be8ff");
          // bullets
          for(var bi=0;bi<bullets.length;bi++) rect(bullets[bi].x-2,bullets[bi].y-10,4,14,"#ffd23e");
          // enemies
          ctx.fillStyle="#ff3ea5";
          for(var ei=0;ei<enemies.length;ei++){
            var e=enemies[ei];
            rect(e.x-14,e.y-11,28,22,"#ff3ea5");
            rect(e.x-8, e.y-17,6,8,"#ff3ea5");
            rect(e.x+2,  e.y-17,6,8,"#ff3ea5");
          }
          px_txt("WAVE "+wave, 8, 18, 8, "#9b8fc7","left");
          px_txt(""+this.score, W/2, 18, 10, "#ffd23e");
        }
      };
    }
  );

  /* ── 6. Asteroids ──────────────────────────────────────── */
  reg("asteroids",
    "Left/Right to rotate, Up to thrust, A or Space to shoot. Blast all rocks.",
    function() {
      var ship={x:W/2,y:H/2,a:-Math.PI/2,vx:0,vy:0};
      var bullets=[], rocks=[], fireCD=0;

      function wrap(o){
        if(o.x<0) o.x+=W; if(o.x>W) o.x-=W;
        if(o.y<0) o.y+=H; if(o.y>H) o.y-=H;
      }
      function spawnRocks(n,r){
        for(var i=0;i<n;i++)
          rocks.push({x:rnd(0,W),y:rnd(0,H/4),vx:rnd(-55,55),vy:rnd(30,70),r:r||26});
      }
      spawnRocks(5,26);

      return {
        score:0, over:false,
        update: function(dt) {
          if(IN.held.left)  ship.a -= 3.2*dt;
          if(IN.held.right) ship.a += 3.2*dt;
          if(IN.held.up){
            ship.vx += Math.cos(ship.a)*260*dt;
            ship.vy += Math.sin(ship.a)*260*dt;
          }
          ship.vx*=0.99; ship.vy*=0.99;
          ship.x+=ship.vx*dt; ship.y+=ship.vy*dt; wrap(ship);
          fireCD-=dt;
          if((IN.edge.action||IN.held.action)&&fireCD<=0){
            bullets.push({x:ship.x,y:ship.y,
              vx:Math.cos(ship.a)*380,vy:Math.sin(ship.a)*380,life:1.1});
            fireCD=0.28;
          }
          for(var bi=0;bi<bullets.length;bi++){
            var b=bullets[bi];
            b.x+=b.vx*dt; b.y+=b.vy*dt; b.life-=dt; wrap(b);
          }
          bullets=bullets.filter(function(b){ return b.life>0; });
          for(var ri2=0;ri2<rocks.length;ri2++){
            var rk=rocks[ri2];
            rk.x+=rk.vx*dt; rk.y+=rk.vy*dt; wrap(rk);
          }
          // collisions
          var newRocks=[];
          for(var bi2=0;bi2<bullets.length;bi2++){
            for(var ri3=0;ri3<rocks.length;ri3++){
              var b2=bullets[bi2], rk2=rocks[ri3];
              if(!b2.dead&&!rk2.dead&&Math.hypot(b2.x-rk2.x,b2.y-rk2.y)<rk2.r){
                b2.dead=true; rk2.dead=true; this.score+=30;
                if(rk2.r>13){
                  newRocks.push({x:rk2.x,y:rk2.y,vx:rnd(-90,90),vy:rnd(-90,90),r:rk2.r/2});
                  newRocks.push({x:rk2.x,y:rk2.y,vx:rnd(-90,90),vy:rnd(-90,90),r:rk2.r/2});
                }
              }
            }
          }
          bullets=bullets.filter(function(b){ return !b.dead; });
          rocks  =rocks.filter(function(r){ return !r.dead; }).concat(newRocks);
          for(var ri4=0;ri4<rocks.length;ri4++){
            if(Math.hypot(ship.x-rocks[ri4].x,ship.y-rocks[ri4].y)<rocks[ri4].r+7) this.over=true;
          }
          if(rocks.length===0){ this.score+=100; spawnRocks(6,26); }
        },
        draw: function() {
          clear("#02030f","#0a0613");
          ctx.save(); ctx.translate(ship.x,ship.y); ctx.rotate(ship.a);
          ctx.strokeStyle="#27e8ff"; ctx.lineWidth=2;
          ctx.beginPath(); ctx.moveTo(14,0); ctx.lineTo(-10,-9); ctx.lineTo(-10,9); ctx.closePath(); ctx.stroke();
          if(IN.held.up){
            ctx.fillStyle="#ff8a3e";
            ctx.beginPath(); ctx.moveTo(-10,-4); ctx.lineTo(-10,4); ctx.lineTo(-22,0); ctx.fill();
          }
          ctx.restore();
          ctx.fillStyle="#ffd23e";
          for(var bi=0;bi<bullets.length;bi++) { ctx.beginPath(); ctx.arc(bullets[bi].x,bullets[bi].y,3,0,Math.PI*2); ctx.fill(); }
          ctx.strokeStyle="#ff3ea5"; ctx.lineWidth=2;
          for(var ri2=0;ri2<rocks.length;ri2++){
            ctx.beginPath(); ctx.arc(rocks[ri2].x,rocks[ri2].y,rocks[ri2].r,0,Math.PI*2); ctx.stroke();
          }
          px_txt(""+this.score, W/2, 22, 12, "#ffd23e");
        }
      };
    }
  );

  /* ── 7. Bubble Pop ─────────────────────────────────────── */
  reg("popper",
    "Tap or click the bubbles before they float away. Miss 3 and it's over.",
    function() {
      var bubbles=[], spawnT=0, miss=0, elapsed=0;
      var COLS=["#27e8ff","#ff3ea5","#ffd23e","#46ff9c","#9b6bff"];
      return {
        score:0, over:false,
        update: function(dt) {
          elapsed+=dt; spawnT-=dt;
          if(spawnT<=0){
            bubbles.push({x:rnd(36,W-36),y:H+30,r:rnd(18,32),
              c:COLS[ri(0,4)], vy:rnd(52,80)+elapsed*2});
            spawnT=Math.max(0.38,1.1-elapsed*0.018);
          }
          for(var i=0;i<bubbles.length;i++) bubbles[i].y -= bubbles[i].vy*dt;
          var alive=[];
          for(var j=0;j<bubbles.length;j++){
            var b=bubbles[j];
            if(b.popped) continue;
            if(b.y<-b.r){ if(++miss>=3) this.over=true; continue; }
            alive.push(b);
          }
          if(IN.pclick){
            for(var k=0;k<alive.length;k++){
              if(Math.hypot(IN.px-alive[k].x,IN.py-alive[k].y)<alive[k].r){
                alive[k].popped=true; this.score+=10;
                alive.splice(k,1); break;
              }
            }
          }
          bubbles=alive;
        },
        draw: function() {
          clear("#0a0613","#10082a");
          for(var i=0;i<bubbles.length;i++){
            var b=bubbles[i];
            ctx.globalAlpha=0.82;
            ctx.fillStyle=b.c;
            ctx.beginPath(); ctx.arc(b.x,b.y,b.r,0,Math.PI*2); ctx.fill();
            ctx.globalAlpha=1;
            ctx.fillStyle="#ffffff88";
            ctx.beginPath(); ctx.arc(b.x-b.r*.3,b.y-b.r*.3,b.r*.18,0,Math.PI*2); ctx.fill();
          }
          px_txt(""+this.score, W/2, 22, 12, "#27e8ff");
          px_txt("MISS "+miss+"/3", W-8, 22, 8, "#ff3ea5","right");
        }
      };
    }
  );

  /* ── 8. Pixel Heist ────────────────────────────────────── */
  reg("heist",
    "Press A or Space when the moving bar is inside the green zone. Don't trigger 3 alarms!",
    function() {
      var pos=0,dir=1,spd=1.0,center=0.5,half=0.16,alarm=0,cracks=0,vault=1,flash=0;
      return {
        score:0, over:false,
        update: function(dt) {
          pos+=dir*spd*dt;
          if(pos>1){pos=1;dir=-1;} if(pos<0){pos=0;dir=1;}
          if(flash>0) flash-=dt;
          if(IN.edge.action){
            if(Math.abs(pos-center)<=half){
              this.score+=100; cracks++;
              half=Math.max(0.05,half*0.86); spd*=1.12;
              center=rnd(0.15,0.85); flash=0.3;
              if(cracks%5===0){ vault++; this.score+=300; half=Math.min(0.18,half+0.06); }
            } else {
              if(++alarm>=3) this.over=true; flash=0.28;
            }
          }
        },
        draw: function() {
          clear("#05030f","#150c2b");
          // vault door
          ctx.strokeStyle="#9b6bff"; ctx.lineWidth=3;
          ctx.strokeRect(160,30,160,120);
          ctx.strokeRect(170,40,140,100);
          ctx.fillStyle=flash>0?"#ff3ea5":"#27e8ff88";
          ctx.fillRect(220,70,40,40);
          px_txt("VAULT "+vault, W/2, 180, 12, "#ffd23e");
          px_txt("CRACKS "+cracks+"  ALARM "+alarm+"/3", W/2, 204, 8, "#9b8fc7");
          // bar track
          var bx=60,bw=360,by=240;
          rect(bx,by,bw,28,"#1a1233");
          // target zone
          rect(bx+(center-half)*bw,by,half*2*bw,28,"#46ff9c");
          // moving needle
          ctx.fillStyle=flash>0?"#ff3ea5":"#ffffff";
          rect(bx+pos*bw-3,by-8,6,44,"#ffffff");
          px_txt("PRESS  A  TO  CRACK", W/2, 318, 9, "#f3ecff");
        }
      };
    }
  );

  /* ── 9. Block Cascade (Tetris-like) ───────────────────── */
  reg("stacker",
    "Left/Right to move, A or Up to rotate, Down to drop faster.",
    function() {
      var COLS=10, ROWS=16, CS=22, OX=(W-COLS*CS)/2, OY=8;
      var SHAPES=[
        [[1,1,1,1]],
        [[1,1],[1,1]],
        [[0,1,0],[1,1,1]],
        [[1,0,0],[1,1,1]],
        [[0,0,1],[1,1,1]],
        [[0,1,1],[1,1,0]],
        [[1,1,0],[0,1,1]]
      ];
      var COLORS=["#27e8ff","#ffd23e","#9b6bff","#ff8a3e","#3e7dff","#46ff9c","#ff3ea5"];
      var board = [], piece=null, dropT=0, dropSpd=0.55, dead=false;
      for(var r=0;r<ROWS;r++){ var row=[]; for(var c=0;c<COLS;c++) row.push(0); board.push(row); }

      function rotate(s){
        var h=s.length,w=s[0].length;
        var n=[];
        for(var c=0;c<w;c++){ var nr=[]; for(var r2=h-1;r2>=0;r2--) nr.push(s[r2][c]); n.push(nr); }
        return n;
      }
      function fits(s,x,y){
        for(var r=0;r<s.length;r++) for(var c=0;c<s[r].length;c++){
          if(!s[r][c]) continue;
          var nx=x+c, ny=y+r;
          if(nx<0||nx>=COLS||ny>=ROWS) return false;
          if(ny>=0&&board[ny][nx]) return false;
        }
        return true;
      }
      function lock(){
        for(var r=0;r<piece.s.length;r++) for(var c=0;c<piece.s[r].length;c++){
          if(piece.s[r][c]&&piece.y+r>=0) board[piece.y+r][piece.x+c]=piece.col;
        }
        var lines=0;
        for(var row=ROWS-1;row>=0;row--){
          if(board[row].every(function(v){ return v!==0; })){
            board.splice(row,1);
            var newRow=[]; for(var c2=0;c2<COLS;c2++) newRow.push(0);
            board.unshift(newRow);
            lines++; row++;
          }
        }
        return lines;
      }
      function newPiece(){
        var i=ri(0,6);
        piece={s:SHAPES[i].map(function(r){ return r.slice(); }),col:COLORS[i],x:3,y:-1};
        if(!fits(piece.s,piece.x,piece.y)) dead=true;
      }
      newPiece();

      return {
        score:0, over:false,
        update: function(dt) {
          if(dead){ this.over=true; return; }
          if(IN.edge.left  && fits(piece.s,piece.x-1,piece.y)) piece.x--;
          if(IN.edge.right && fits(piece.s,piece.x+1,piece.y)) piece.x++;
          if(IN.edge.action||IN.edge.up){
            var rot=rotate(piece.s);
            if(fits(rot,piece.x,piece.y)) piece.s=rot;
          }
          dropT+=dt*(IN.held.down?9:1);
          if(dropT>=dropSpd){
            dropT=0;
            if(fits(piece.s,piece.x,piece.y+1)){
              piece.y++;
            } else {
              var lines=lock();
              if(lines) this.score+=[0,100,250,450,700][Math.min(lines,4)];
              dropSpd=Math.max(0.18,dropSpd-0.012*Math.max(1,lines));
              newPiece();
            }
          }
        },
        draw: function() {
          clear("#05030f","#10082a");
          // board bg
          rect(OX,OY,COLS*CS,ROWS*CS,"#0d0820");
          // placed blocks
          for(var r=0;r<ROWS;r++) for(var c=0;c<COLS;c++){
            if(board[r][c]) rect(OX+c*CS+1,OY+r*CS+1,CS-2,CS-2,board[r][c]);
          }
          // active piece
          if(piece){
            for(var pr=0;pr<piece.s.length;pr++) for(var pc=0;pc<piece.s[pr].length;pc++){
              if(piece.s[pr][pc])
                rect(OX+(piece.x+pc)*CS+1, OY+(piece.y+pr)*CS+1, CS-2, CS-2, piece.col);
            }
          }
          ctx.strokeStyle="#3a2a6b"; ctx.lineWidth=1;
          ctx.strokeRect(OX,OY,COLS*CS,ROWS*CS);
          px_txt(""+this.score, OX+COLS*CS+10+(W-OX-COLS*CS)/2, OY+40, 10, "#ffd23e");
          px_txt("SCORE", OX+COLS*CS+10+(W-OX-COLS*CS)/2, OY+20, 7, "#9b8fc7");
        }
      };
    }
  );

  /* ── 10. Spend 100 Million ─────────────────────────────── */
  reg("spend",
    "Select an item with the D-pad and press A, or just tap/click it. Blow $100M before time runs out!",
    function() {
      var ITEMS=[
        {n:"Coffee",       p:5,       e:"☕"},
        {n:"Sneakers",     p:250,     e:"👟"},
        {n:"Gaming PC",    p:3500,    e:"🖥️"},
        {n:"Sports Car",   p:95000,   e:"🏎️"},
        {n:"Diamond",      p:1.2e6,   e:"💎"},
        {n:"Mansion",      p:1.2e7,   e:"🏰"},
        {n:"Island",       p:4.5e7,   e:"🏝️"},
        {n:"Private Jet",  p:6.5e7,   e:"✈️"},
      ];
      var budget=1e8, spent=0, owned=ITEMS.map(function(){return 0;}), tleft=45, sel=0;
      var CW=W/2, CH=56, GY=94;

      function fmt(n){ return "$"+Math.round(n).toLocaleString(); }
      function tryBuy(i, g){
        if(budget>=ITEMS[i].p){ budget-=ITEMS[i].p; spent+=ITEMS[i].p; owned[i]++; g.score=Math.round(spent); }
      }

      return {
        score:0, over:false,
        update: function(dt) {
          tleft-=dt;
          if(IN.edge.left)  sel=(sel+7)%8;
          if(IN.edge.right) sel=(sel+1)%8;
          if(IN.edge.up)    sel=(sel+6)%8;
          if(IN.edge.down)  sel=(sel+2)%8;
          if(IN.edge.action) tryBuy(sel, this);
          if(IN.pclick && IN.py>GY){
            var col=IN.px<CW?0:1;
            var row=Math.floor((IN.py-GY)/CH);
            var idx=row*2+col;
            if(idx>=0&&idx<8){ sel=idx; tryBuy(idx,this); }
          }
          this.score=Math.round(spent);
          if(tleft<=0||budget<5) this.over=true;
        },
        draw: function() {
          clear("#0a0613","#1a1006");
          px_txt("BUDGET", W/2, 22, 8, "#9b8fc7");
          px_txt(fmt(budget), W/2, 48, 14, budget>1e7?"#46ff9c":"#ffd23e");
          px_txt("TIME "+Math.max(0,Math.ceil(tleft))+"s", W-8, 78, 8, "#ff3ea5","right");
          px_txt("SPENT "+fmt(spent), 8, 78, 8, "#27e8ff","left");
          for(var i=0;i<8;i++){
            var cx=(i%2)*CW, cy=GY+Math.floor(i/2)*CH;
            ctx.fillStyle = i===sel?"rgba(39,232,255,.18)":"rgba(155,107,255,.07)";
            ctx.fillRect(cx+3,cy+2,CW-6,CH-4);
            ctx.strokeStyle = i===sel?"#27e8ff":"#3a2a6b"; ctx.lineWidth=1;
            ctx.strokeRect(cx+3,cy+2,CW-6,CH-4);
            // emoji
            ctx.font="22px serif"; ctx.textAlign="left";
            ctx.fillStyle="#fff"; ctx.fillText(ITEMS[i].e, cx+10, cy+34);
            // name
            px_txt(ITEMS[i].n, cx+42, cy+22, 7, "#f3ecff","left");
            px_txt(fmt(ITEMS[i].p), cx+42, cy+40, 7, "#ffd23e","left");
            if(owned[i]) px_txt("x"+owned[i], cx+CW-10, cy+32, 8, "#46ff9c","right");
          }
        }
      };
    }
  );

  /* ── 11. Mystery Machine ───────────────────────────────── */
  // handled in startGame() — picks random engine

  /* ════════════════════════════════════════════════════════════
     GAME LOOP & MODAL CONTROLLER
     ════════════════════════════════════════════════════════════ */
  var curGame=null, rafID=0, curId="", prevTS=null;

  function loop(ts) {
    if(!curGame) return;
    var dt = prevTS===null ? 0.016 : Math.min((ts-prevTS)/1000, 0.08);
    prevTS = ts;
    try {
      if(!curGame.over) curGame.update(dt);
      curGame.draw();
      elScore.textContent = curGame.score|0;
      clearEdges();
      if(curGame.over){ gameOver(); return; }
      rafID = requestAnimationFrame(loop);
    } catch(err) {
      console.error("[DA] Game error:", err);
      gameOver();
    }
  }

  function startGame() {
    var id = curId;
    if(id==="mystery"){
      id = POOL[ri(0,POOL.length-1)];
      elTitle.textContent = "MYSTERY ▸ "+id.toUpperCase();
    }
    hide("ovStart"); hide("ovEnd");
    curGame = REGISTRY[id]();
    curGame.score = curGame.score||0;
    curGame.over  = false;
    curGame._id   = id;
    elBest.textContent = loadBest(id);
    elScore.textContent = 0;
    cancelAnimationFrame(rafID);
    prevTS = null;
    rafID = requestAnimationFrame(loop);
  }

  function gameOver() {
    cancelAnimationFrame(rafID);
    var id=curGame._id, sc=curGame.score|0;
    var best=loadBest(id);
    if(sc>best){ saveBest(id,sc); elBest.textContent=sc; best=sc; }
    var txt = "Score: "+sc;
    if(sc>=best&&sc>0) txt+="  ★ NEW BEST!";
    document.getElementById("ovFinal").textContent = txt;
    curGame = null;
    show("ovEnd");
  }

  function closeModal() {
    cancelAnimationFrame(rafID);
    curGame=null; ACTIVE=false; prevTS=null;
    clearEdges();
    for(var k in IN.held) IN.held[k]=0;
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden","true");
  }

  function loadBest(id){ return +(localStorage.getItem("da_b_"+id)||0); }
  function saveBest(id,n){ try{ localStorage.setItem("da_b_"+id,n); }catch(e){} }
  function hide(id){ document.getElementById(id).classList.add("hidden"); }
  function show(id){ document.getElementById(id).classList.remove("hidden"); }

  /* ════════════════════════════════════════════════════════════
     PUBLIC API
     ════════════════════════════════════════════════════════════ */
  function launchByName(name) {
    bindDOM();
    curId = NAME2ID[name] || "snake";
    elTitle.textContent = name.toUpperCase();
    elScore.textContent = 0;
    elBest.textContent  = loadBest(curId==="mystery"?"mystery":curId);
    document.getElementById("ovTitle").textContent = name;
    document.getElementById("ovHow").textContent   = HOWTO[curId] || "Use the controls below.";
    show("ovStart"); hide("ovEnd");
    // draw a background frame so canvas isn't blank
    if(ctx) { clear("#0a0613","#150c2b"); px_txt("READY?",W/2,H/2-10,16,"#27e8ff"); }
    modal.classList.add("open");
    modal.setAttribute("aria-hidden","false");
    ACTIVE = true;
  }

  window.DAGames = { launchByName: launchByName };
})();
