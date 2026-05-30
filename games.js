/* Digital Arcade – playable game engine
   window.DAGames.launchByName(title) opens the modal and starts that game.
   Every title maps to its OWN distinct engine. */
(function () {
  "use strict";
  var W = 480, H = 360;

  /* ── Input ──────────────────────────────────────────────── */
  var IN = {
    held: { left:0, right:0, up:0, down:0, action:0 },
    edge: { left:0, right:0, up:0, down:0, action:0 },
    dir: "",
    px: 0, py: 0, pclick: 0
  };
  var ACTIVE = false;

  /* Global AI difficulty (Easy / Normal / Hard) — read from localStorage */
  var DA_DIFF = (function(){ try{ return localStorage.getItem("da_diff") || "normal"; }catch(e){ return "normal"; } })();
  function diffMult(){ return DA_DIFF==="easy" ? 0.45 : DA_DIFF==="hard" ? 1.8 : 1.0; }
  function setDifficulty(d){ DA_DIFF=d; try{ localStorage.setItem("da_diff", d); }catch(e){} }
  function getDifficulty(){ return DA_DIFF; }

  var KMAP = {
    ArrowLeft:"left", ArrowRight:"right", KeyD:"right",
    ArrowUp:"up", KeyW:"up", ArrowDown:"down", KeyS:"down",
    Space:"action", Enter:"action", KeyZ:"action", KeyJ:"action", KeyA:"action"
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
    if (!ACTIVE) return;
    if (curGame && curGame.onkey) {
      var c = ev.code;
      if (/^Key[A-Z]$/.test(c)) { ev.preventDefault(); if(!ev.repeat) curGame.onkey(c.slice(3)); return; }
      if (c === "Backspace")    { ev.preventDefault(); if(!ev.repeat) curGame.onkey("BACK");  return; }
      if (c === "Enter")        { ev.preventDefault(); if(!ev.repeat) curGame.onkey("ENTER"); return; }
    }
    var n = KMAP[ev.code]; if (!n) return;
    ev.preventDefault(); if (!ev.repeat) dn(n);
  });
  window.addEventListener("keyup", function(ev) {
    var n = KMAP[ev.code]; if (!n) return; up(n);
  });

  /* ── DOM ─────────────────────────────────────────────────── */
  var modal, cv, ctx, elScore, elBest, elTitle, lbStartEl, lbEndEl, diffSelEl, domBound = false;
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
      IN.pclick = 1; IN.edge.action = 1;
    });
    lbStartEl = document.createElement("div");
    document.getElementById("ovStart").insertBefore(lbStartEl, document.getElementById("ovBtn"));
    lbEndEl = document.createElement("div");
    document.getElementById("ovEnd").insertBefore(lbEndEl, document.getElementById("ovRetry"));
    // Difficulty selector on the start overlay
    diffSelEl = document.createElement("div");
    diffSelEl.className = "da-diffsel";
    diffSelEl.innerHTML =
      '<span>AI DIFFICULTY</span>' +
      '<button data-d="easy">EASY</button>' +
      '<button data-d="normal">NORMAL</button>' +
      '<button data-d="hard">HARD</button>';
    document.getElementById("ovStart").insertBefore(diffSelEl, document.getElementById("ovBtn"));
    diffSelEl.querySelectorAll("button").forEach(function(b){
      b.addEventListener("click", function(){
        setDifficulty(b.dataset.d);
        refreshDiffSel();
        if(window.refreshDiffBtn) window.refreshDiffBtn();
      });
    });
  }
  var DIFF_GAMES = {shooter:1, galaxy:1, heist:1, pong:1, pongcup:1};
  function refreshDiffSel(){
    if(!diffSelEl) return;
    var id = curId==="mystery" ? "mystery" : curId;
    diffSelEl.style.display = DIFF_GAMES[id] ? "flex" : "none";
    diffSelEl.querySelectorAll("button").forEach(function(b){
      b.className = b.dataset.d === DA_DIFF ? "active "+DA_DIFF : "";
    });
  }

  /* ── Helpers ─────────────────────────────────────────────── */
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function ri(a, b)  { return Math.floor(rnd(a, b + 1)); }
  function aabb(ax,ay,aw,ah,bx,by,bw,bh){
    return ax < bx+bw && ax+aw > bx && ay < by+bh && ay+ah > by;
  }
  function clear(c1, c2) {
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, c1); g.addColorStop(1, c2);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  function px_txt(str, x, y, sz, col, align) {
    ctx.save();
    ctx.font = (sz || 10) + "px 'Press Start 2P', monospace";
    ctx.fillStyle = col || "#f3ecff";
    ctx.textAlign = align || "center";
    ctx.fillText(str, x, y);
    ctx.restore();
  }
  function rect(x, y, w, h, col) { ctx.fillStyle = col; ctx.fillRect(x, y, w, h); }
  function poly(x1,y1,x2,y2,x3,y3,x4,y4){
    ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);
    ctx.lineTo(x3,y3);ctx.lineTo(x4,y4);ctx.closePath();ctx.fill();
  }

  /* ── Registry ────────────────────────────────────────────── */
  var REGISTRY = {}, HOWTO = {};
  function reg(id, howto, factory) { REGISTRY[id] = factory; HOWTO[id] = howto; }

  var NAME2ID = {
    "Neon Snake":"snake",          "Maze Muncher":"muncher",
    "Pixel Jumper":"runner",       "Retro Rush":"rocket",
    "Dungeon Dash":"dungeon",      "Quest Pixels":"quest",
    "FPS Arena":"shooter",         "Galaxy Blaster":"galaxy",
    "Asteroid Storm":"asteroids",  "Bubble Pop Saga":"popper",
    "Block Cascade":"stacker",     "Pixel Heist":"heist",
    "Spend 100 Million":"spend",   "Mystery Machine":"mystery",
    "Claw Machine":"claw",         "Neon Pong":"pong",
    "Tower Siege":"tower",         "Word Rush":"wordle",
    "Map Tap":"maptap",            "Turret Survivors":"survivor",
    "Soccer Stars":"soccer",       "Pong Cup":"pongcup",
    "Diner Empire":"diner",        "Duo Pong":"duopong"
  };
  var POOL = ["snake","muncher","runner","rocket","dungeon","quest",
              "shooter","galaxy","asteroids","popper","stacker","heist","spend",
              "claw","pong","tower","wordle","maptap","survivor","soccer","pongcup"];


  /* ════════════════════ GAMES ════════════════════ */

  /* 1. Neon Snake */
  reg("snake","Arrow keys / D-pad to steer. Eat pink dots. Don't hit a wall or yourself.",
  function(){
    var CS=20, COLS=W/CS|0, ROWS=H/CS|0;
    var body=[{x:8,y:9}], dx=1,dy=0,ndx=1,ndy=0,timer=0,spd=0.13;
    function food0(){ var f; do{ f={x:ri(0,COLS-1),y:ri(0,ROWS-1)}; }
      while(body.some(function(s){return s.x===f.x&&s.y===f.y;})); return f; }
    var food=food0();
    return { score:0, over:false,
      update:function(dt){
        if(IN.dir==="L"&&dx!==1){ndx=-1;ndy=0;}
        if(IN.dir==="R"&&dx!==-1){ndx=1;ndy=0;}
        if(IN.dir==="U"&&dy!==1){ndx=0;ndy=-1;}
        if(IN.dir==="D"&&dy!==-1){ndx=0;ndy=1;}
        timer+=dt; if(timer<spd) return; timer=0; dx=ndx; dy=ndy;
        var hd={x:body[0].x+dx,y:body[0].y+dy};
        if(hd.x<0||hd.x>=COLS||hd.y<0||hd.y>=ROWS){this.over=true;return;}
        if(body.some(function(s){return s.x===hd.x&&s.y===hd.y;})){this.over=true;return;}
        body.unshift(hd);
        if(hd.x===food.x&&hd.y===food.y){ this.score+=10; spd=Math.max(0.06,spd-0.003); food=food0(); }
        else body.pop();
      },
      draw:function(){
        clear("#0a0613","#150c2b");
        ctx.strokeStyle="rgba(155,107,255,.12)";
        for(var i=0;i<=COLS;i++){ctx.beginPath();ctx.moveTo(i*CS,0);ctx.lineTo(i*CS,H);ctx.stroke();}
        for(var j=0;j<=ROWS;j++){ctx.beginPath();ctx.moveTo(0,j*CS);ctx.lineTo(W,j*CS);ctx.stroke();}
        rect(food.x*CS+4,food.y*CS+4,CS-8,CS-8,"#ff3ea5");
        for(var k=0;k<body.length;k++) rect(body[k].x*CS+1,body[k].y*CS+1,CS-2,CS-2,k===0?"#27e8ff":"#9b6bff");
        px_txt("SCORE "+this.score,W/2,H-8,9,"#9b8fc7");
      }};
  });

  /* 2. Maze Muncher (classic Pac-Man: pellets, power pellets, 3 ghosts, levels) */
  reg("muncher","Arrows / D-pad to munch every pellet. Big flashing power pellets turn the ghosts blue — chase them down for 200 each! Clearing the maze = +500 and the next level.",
  function(){
    var COLS=20, ROWS=15, TS=24;
    var BLK=[[2,2,3,4],[5,2,6,3],[8,2,8,6],[2,6,3,6],[5,5,6,6],
             [2,9,3,12],[5,9,6,10],[8,9,8,12]];
    var POW=[[1,1],[18,1],[1,13],[18,13]];
    var SPAWN=[[9,7],[10,7],[11,7]];
    var GCOL=["#ff3ea5","#27e8ff","#ffb84d"];
    var wall=[], dots=[], pellets=0, level=1;
    function isW(x,y){
      if(y===7&&(x<0||x>=COLS)) return false;          // tunnel
      if(x<0||y<0||x>=COLS||y>=ROWS) return true;
      return wall[y][x];
    }
    function buildWalls(){
      wall=[];
      for(var y=0;y<ROWS;y++){ var rw=[];
        for(var x=0;x<COLS;x++) rw.push(x===0||x===COLS-1||y===0||y===ROWS-1);
        wall.push(rw); }
      wall[7][0]=false; wall[7][COLS-1]=false;
      function block(a,b,c,d){
        for(var y=b;y<=d;y++)for(var x=a;x<=c;x++){ wall[y][x]=true; wall[y][COLS-1-x]=true; }
      }
      for(var i=0;i<BLK.length;i++) block(BLK[i][0],BLK[i][1],BLK[i][2],BLK[i][3]);
    }
    function isSpawn(x,y){ for(var i=0;i<SPAWN.length;i++) if(SPAWN[i][0]===x&&SPAWN[i][1]===y) return true; return false; }
    function fillDots(){
      dots=[]; pellets=0;
      for(var y=0;y<ROWS;y++){ var rw=[];
        for(var x=0;x<COLS;x++){
          var v=0;
          if(!isW(x,y)&&!isSpawn(x,y)&&!(x===10&&y===13)){
            v=1; for(var p=0;p<POW.length;p++) if(POW[p][0]===x&&POW[p][1]===y) v=2;
            pellets++;
          }
          rw.push(v);
        } dots.push(rw); }
    }
    buildWalls(); fillDots();
    function mkPac(){ return {tx:10,ty:13,dx:0,dy:0,p:0}; }
    function mkGhosts(){
      var g=[];
      for(var i=0;i<3;i++) g.push({tx:SPAWN[i][0],ty:SPAWN[i][1],dx:0,dy:0,p:0.5,fr:0,col:GCOL[i],home:SPAWN[i]});
      return g;
    }
    var pac=mkPac(), ghosts=mkGhosts(), frightT=0, mouth=0;
    function step(e,spd,dt,pick){
      e.p += spd*dt;
      while(e.p>=1){
        e.p-=1; e.tx+=e.dx; e.ty+=e.dy;
        if(e.tx<0)e.tx=COLS-1; if(e.tx>=COLS)e.tx=0;       // tunnel wrap
        var nd=pick(e);
        e.dx=nd[0]; e.dy=nd[1];
        if(isW(e.tx+e.dx,e.ty+e.dy)){ e.dx=0; e.dy=0; e.p=0; }
      }
    }
    return { score:0, over:false,
      update:function(dt){
        mouth=(mouth+dt*10)%2;
        if(frightT>0){ frightT-=dt; if(frightT<=0) for(var i=0;i<ghosts.length;i++) ghosts[i].fr=0; }
        var want=[pac.dx,pac.dy];
        if(IN.dir==="L")want=[-1,0]; if(IN.dir==="R")want=[1,0];
        if(IN.dir==="U")want=[0,-1]; if(IN.dir==="D")want=[0,1];
        // pac can start/turn instantly if not currently moving
        if((pac.dx===0&&pac.dy===0)&&!isW(pac.tx+want[0],pac.ty+want[1])){ pac.dx=want[0];pac.dy=want[1]; }
        step(pac, 5+level*0.3, dt, function(e){
          if(!isW(e.tx+want[0],e.ty+want[1])&&(want[0]||want[1])) return want;
          if(!isW(e.tx+e.dx,e.ty+e.dy)) return [e.dx,e.dy];
          return [0,0];
        });
        var d=dots[pac.ty]&&dots[pac.ty][pac.tx];
        if(d){ dots[pac.ty][pac.tx]=0; pellets--; this.score+=10;
          if(d===2){ this.score+=40; frightT=6; for(var gi=0;gi<ghosts.length;gi++) ghosts[gi].fr=1; }
          if(pellets<=0){ this.score+=500; level++; fillDots(); pac=mkPac(); ghosts=mkGhosts(); frightT=0; return; }
        }
        for(var g=0;g<ghosts.length;g++){
          var gh=ghosts[g];
          step(gh, (gh.fr?3.2:4.4+level*0.35), dt, function(e){
            var opts=[[1,0],[-1,0],[0,1],[0,-1]].filter(function(v){
              return !isW(e.tx+v[0],e.ty+v[1]) && !(v[0]===-e.dx&&v[1]===-e.dy);
            });
            if(!opts.length) opts=[[-e.dx,-e.dy]];
            var tgx=pac.tx,tgy=pac.ty;
            if(e.col===GCOL[1]){ tgx=pac.tx+pac.dx*3; tgy=pac.ty+pac.dy*3; }
            if(e.col===GCOL[2]){ tgx=e.fr?Math.random()*COLS:pac.tx; tgy=e.fr?Math.random()*ROWS:pac.ty; }
            opts.sort(function(a,b){
              var da=Math.hypot(e.tx+a[0]-tgx,e.ty+a[1]-tgy);
              var db=Math.hypot(e.tx+b[0]-tgx,e.ty+b[1]-tgy);
              return e.fr? db-da : da-db;
            });
            return opts[0];
          });
          if(gh.tx===pac.tx&&gh.ty===pac.ty){
            if(gh.fr){ this.score+=200; gh.tx=gh.home[0]; gh.ty=gh.home[1]; gh.dx=0; gh.dy=0; gh.p=0.5; gh.fr=0; }
            else { this.over=true; return; }
          }
        }
      },
      draw:function(){
        clear("#02030f","#06030f");
        for(var y=0;y<ROWS;y++)for(var x=0;x<COLS;x++){
          if(isW(x,y)){
            rect(x*TS+2,y*TS+2,TS-4,TS-4,"#1a1f6b");
            rect(x*TS+5,y*TS+5,TS-10,TS-10,"#0a1240");
          } else {
            var v=dots[y][x];
            if(v===1){ ctx.fillStyle="#ffd9a8";ctx.beginPath();ctx.arc(x*TS+TS/2,y*TS+TS/2,3,0,7);ctx.fill(); }
            else if(v===2 && mouth<1.4){ ctx.fillStyle="#ffd23e";ctx.beginPath();ctx.arc(x*TS+TS/2,y*TS+TS/2,7,0,7);ctx.fill(); }
          }
        }
        // pac with animated mouth
        var pcx=(pac.tx+pac.dx*pac.p)*TS+TS/2, pcy=(pac.ty+pac.dy*pac.p)*TS+TS/2;
        var ang=pac.dx<0?Math.PI:pac.dx>0?0:pac.dy<0?-Math.PI/2:Math.PI/2;
        var m=Math.abs(Math.sin(mouth*Math.PI))*0.32+0.04;
        ctx.fillStyle="#ffd23e";ctx.beginPath();
        ctx.moveTo(pcx,pcy);
        ctx.arc(pcx,pcy,TS/2-2,ang+m,ang+Math.PI*2-m);
        ctx.closePath();ctx.fill();
        // ghosts
        for(var g=0;g<ghosts.length;g++){
          var gh=ghosts[g];
          var gxp=(gh.tx+gh.dx*gh.p)*TS+TS/2, gyp=(gh.ty+gh.dy*gh.p)*TS+TS/2;
          var col=gh.fr?(frightT<2&&Math.floor(frightT*6)%2?"#fff":"#2a47ff"):gh.col;
          ctx.fillStyle=col;ctx.beginPath();
          ctx.arc(gxp,gyp-2,TS/2-4,Math.PI,0);
          ctx.lineTo(gxp+TS/2-4,gyp+TS/2-5);
          ctx.lineTo(gxp+(TS/2-4)*0.4,gyp+TS/2-9);
          ctx.lineTo(gxp,gyp+TS/2-5);
          ctx.lineTo(gxp-(TS/2-4)*0.4,gyp+TS/2-9);
          ctx.lineTo(gxp-(TS/2-4),gyp+TS/2-5);
          ctx.closePath();ctx.fill();
          ctx.fillStyle="#fff";
          ctx.beginPath();ctx.arc(gxp-4,gyp-3,3,0,7);ctx.arc(gxp+4,gyp-3,3,0,7);ctx.fill();
          ctx.fillStyle="#0a0613";
          ctx.beginPath();ctx.arc(gxp-4+gh.dx,gyp-3+gh.dy,1.5,0,7);ctx.arc(gxp+4+gh.dx,gyp-3+gh.dy,1.5,0,7);ctx.fill();
        }
        px_txt("L"+level,18,16,7,"#9b8fc7","left");
        px_txt("PELLETS "+pellets,W-8,16,7,"#9b8fc7","right");
        px_txt(""+this.score,W/2,16,9,"#ffd23e");
        if(frightT>0) px_txt("HUNT!",W/2,H-8,8,"#27e8ff");
      }};
  });

  /* 3. Pixel Jumper (FIXED collision: consistent AABB) */
  reg("runner","Press A / Space / Up to jump over the pink blocks. It speeds up — survive!",
  function(){
    var GROUND=300, PX=60, PW=30, PH=38;
    var py=GROUND-PH, vy=0, onGround=true, spd=210, obs=[], spawnT=0, dist=0;
    return { score:0, over:false,
      update:function(dt){
        if((IN.edge.action||IN.held.up)&&onGround){ vy=-490; onGround=false; }
        vy+=1500*dt; py+=vy*dt;
        if(py>=GROUND-PH){ py=GROUND-PH; vy=0; onGround=true; }
        spd+=dt*5; dist+=spd*dt; this.score=Math.floor(dist/10);
        spawnT-=dt;
        if(spawnT<=0){ obs.push({x:W+10,w:24,h:ri(22,52)}); spawnT=rnd(0.8,1.5)-Math.min(0.4,spd/1700); }
        for(var i=0;i<obs.length;i++) obs[i].x-=spd*dt;
        obs=obs.filter(function(o){return o.x>-40;});
        for(var j=0;j<obs.length;j++){
          var o=obs[j];
          // both boxes in identical world coords; only true overlap ends the run
          if(aabb(PX,py,PW,PH, o.x,GROUND-o.h,o.w,o.h)){ this.over=true; }
        }
      },
      draw:function(){
        clear("#10082a","#2a0f3a");
        rect(0,GROUND,W,H-GROUND,"#3a1a5a");
        ctx.strokeStyle="#9b6bff";ctx.lineWidth=2;
        ctx.beginPath();ctx.moveTo(0,GROUND);ctx.lineTo(W,GROUND);ctx.stroke();
        // parallax dashes
        ctx.strokeStyle="rgba(39,232,255,.25)";
        for(var i=0;i<W;i+=44){var xx=(i-(dist%44));ctx.beginPath();ctx.moveTo(xx,GROUND+10);ctx.lineTo(xx+18,H);ctx.stroke();}
        rect(PX,py,PW,PH,"#ffd23e");
        rect(PX+18,py+8,6,6,"#0a0613");
        for(var j=0;j<obs.length;j++) rect(obs[j].x,GROUND-obs[j].h,obs[j].w,obs[j].h,"#ff3ea5");
        px_txt(""+this.score,W/2,26,12,"#9b8fc7");
        if(onGround) px_txt("JUMP = A",W/2,H-10,7,"#9b8fc7");
      }};
  });

  /* 4. Retro Rush (endless vertical space-ship climber) */
  reg("rocket","Steer the ship with the D-pad / arrows. Fly up endlessly through the gaps — they get tighter & faster!",
  function(){
    var shipX=W/2, shipY=H-60, SW=22, SH2=30;
    var speed=150, walls=[], spawnT=0, dist=0, gapW=170;
    return { score:0, over:false,
      update:function(dt){
        if(IN.held.left)  shipX-=240*dt;
        if(IN.held.right) shipX+=240*dt;
        if(IN.held.up)    shipY-=200*dt;
        if(IN.held.down)  shipY+=200*dt;
        shipX=Math.max(SW/2,Math.min(W-SW/2,shipX));
        shipY=Math.max(40,Math.min(H-20,shipY));
        speed+=dt*7; gapW=Math.max(86,gapW-dt*4);
        dist+=speed*dt; this.score=Math.floor(dist/8);
        spawnT-=dt;
        if(spawnT<=0){ walls.push({y:-30,gx:rnd(40,W-40-gapW),gw:gapW,passed:false});
          spawnT=Math.max(0.85,1.7-speed/260); }
        for(var i=0;i<walls.length;i++){
          var wl=walls[i]; wl.y+=speed*dt;
          if(!wl.passed&&wl.y>shipY+SH2){ wl.passed=true; this.score+=25; }
        }
        walls=walls.filter(function(w){return w.y<H+40;});
        var bx=shipX-SW/2, by=shipY-SH2/2;
        for(var j=0;j<walls.length;j++){
          var w=walls[j];
          // wall band height 26; collide if overlapping band AND outside gap
          if(by<w.y+26 && by+SH2>w.y){
            if(bx< w.gx || bx+SW > w.gx+w.gw){ this.over=true; }
          }
        }
      },
      draw:function(){
        clear("#01030e","#0a0613");
        for(var i=0;i<46;i++){var sx=(i*113)%W,sy=(i*71+(dist*1.4)%H)%H;rect(sx,sy,2,2,"#ffffff33");}
        for(var j=0;j<walls.length;j++){
          var w=walls[j];
          rect(0,w.y,w.gx,26,"#9b6bff");
          rect(w.gx+w.gw,w.y,W-(w.gx+w.gw),26,"#9b6bff");
          rect(w.gx,w.y+11,w.gw,4,"#27e8ff44");
        }
        ctx.save();ctx.translate(shipX,shipY);
        ctx.fillStyle="#27e8ff";
        ctx.beginPath();ctx.moveTo(0,-SH2/2);ctx.lineTo(-SW/2,SH2/2);ctx.lineTo(SW/2,SH2/2);ctx.closePath();ctx.fill();
        ctx.fillStyle="#ffd23e";ctx.beginPath();
        ctx.moveTo(-5,SH2/2);ctx.lineTo(5,SH2/2);ctx.lineTo(0,SH2/2+8+Math.random()*4);ctx.fill();
        ctx.restore();
        px_txt(""+this.score,W/2,26,12,"#27e8ff");
      }};
  });

  /* 5. Pixel Heist (STEALTH: guards patrol routes, only react to sight or bodies) */
  reg("heist","Stay out of the guards' yellow vision cones! Move with the D-pad/arrows, A / Space fires where you face. Drop guards quietly, but a guard who spots you OR finds a body goes RED on the radar and hunts you. Grab all the cash to clear the level (+100).",
  function(){
    var R=22, px=W/2, py=H-46, fx=0, fy=-1, mv=120, level=1;
    var bullets=[], guards=[], bodies=[], cash=[], fireCD=0;
    var CONE=Math.PI/3.2 * diffMult(), SIGHT=118 * diffMult();
    function placeAway(size){
      var x,y,tries=0;
      do{ x=rnd(34,W-34-size); y=rnd(34,H-96); tries++; }
      while(tries<24 && Math.hypot(x-px,y-py)<110);
      return {x:x,y:y};
    }
    function makeRoute(){
      var n=ri(2,4), pts=[];
      for(var i=0;i<n;i++){ var p=placeAway(20); pts.push({x:p.x,y:p.y}); }
      return pts;
    }
    function buildLevel(){
      bullets=[]; guards=[]; bodies=[]; cash=[];
      var nG=Math.max(1, Math.round((2+level)*diffMult())), nC=3+((level/2)|0);
      for(var i=0;i<nG;i++){
        var rt=makeRoute();
        guards.push({ x:rt[0].x, y:rt[0].y, route:rt, wp:1,
          spd:(42+level*4)*diffMult(), alert:0, hd:0 });
      }
      for(var c=0;c<nC;c++){ var k=placeAway(18); cash.push({x:k.x,y:k.y}); }
    }
    buildLevel();
    function seesPlayer(g){
      var dx=px-g.x, dy=py-g.y, d=Math.hypot(dx,dy);
      if(d>SIGHT) return false;
      var ang=Math.atan2(dy,dx);
      var diff=Math.abs(Math.atan2(Math.sin(ang-g.hd),Math.cos(ang-g.hd)));
      return diff<CONE;
    }
    return { score:0, over:false,
      update:function(dt){
        var mxx=0,myy=0;
        if(IN.held.left)mxx=-1; if(IN.held.right)mxx=1;
        if(IN.held.up)myy=-1;  if(IN.held.down)myy=1;
        if(mxx||myy){ fx=mxx; fy=myy; }
        px=Math.max(R/2,Math.min(W-R/2,px+mxx*mv*dt));
        py=Math.max(R/2,Math.min(H-R/2,py+myy*mv*dt));
        fireCD-=dt;
        if((IN.edge.action||IN.held.action)&&fireCD<=0){
          var n=Math.hypot(fx,fy)||1;
          bullets.push({x:px,y:py,vx:fx/n*360,vy:fy/n*360,life:1.4});
          fireCD=0.34;
        }
        for(var b=0;b<bullets.length;b++){var bu=bullets[b];bu.x+=bu.vx*dt;bu.y+=bu.vy*dt;bu.life-=dt;}
        bullets=bullets.filter(function(o){return o.life>0&&o.x>-10&&o.x<W+10&&o.y>-10&&o.y<H+10;});

        for(var gi=0;gi<guards.length;gi++){
          var gg=guards[gi], tx,ty;
          if(gg.alert>0){
            // hunting: drive straight at the robber
            tx=px; ty=py;
          } else {
            // patrolling its fixed waypoint loop
            var wp=gg.route[gg.wp]; tx=wp.x; ty=wp.y;
            if(Math.hypot(tx-gg.x,ty-gg.y)<6) gg.wp=(gg.wp+1)%gg.route.length;
            // detection: line of sight cone
            if(seesPlayer(gg)) gg.alert=1;
            // detection: stumble onto a body
            for(var bd=0;bd<bodies.length;bd++)
              if(Math.hypot(bodies[bd].x-gg.x,bodies[bd].y-gg.y)<34){ gg.alert=1; break; }
          }
          var a=Math.atan2(ty-gg.y,tx-gg.x);
          gg.hd=a;
          var sp=gg.spd*(gg.alert>0?1.5:1);
          gg.x+=Math.cos(a)*sp*dt; gg.y+=Math.sin(a)*sp*dt;
          if(Math.hypot(gg.x-px,gg.y-py)<R){ this.over=true; }
        }

        for(var bi=0;bi<bullets.length;bi++){
          for(var g2=0;g2<guards.length;g2++){
            if(!guards[g2].dead&&!bullets[bi].dead&&Math.hypot(bullets[bi].x-guards[g2].x,bullets[bi].y-guards[g2].y)<16){
              guards[g2].dead=true; bullets[bi].dead=true; this.score+=25;
              bodies.push({x:guards[g2].x,y:guards[g2].y});
            }
          }
        }
        bullets=bullets.filter(function(o){return !o.dead;});
        guards =guards.filter(function(o){return !o.dead;});
        cash=cash.filter(function(k){
          if(Math.hypot(k.x-px,k.y-py)<R){ this.score+=15; return false; } return true;
        },this);
        if(cash.length===0){ this.score+=100; level++; buildLevel(); px=W/2; py=H-46; }
      },
      draw:function(){
        clear("#0a0613","#161024");
        ctx.strokeStyle="#3a2a6b";ctx.lineWidth=4;ctx.strokeRect(6,6,W-12,H-12);
        // bodies
        for(var bd=0;bd<bodies.length;bd++){
          ctx.save();ctx.globalAlpha=.6;
          rect(bodies[bd].x-11,bodies[bd].y-9,22,18,"#7a2540");
          ctx.restore();
          px_txt("✖",bodies[bd].x,bodies[bd].y+4,8,"#ff8a8a");
        }
        // cash
        for(var c=0;c<cash.length;c++){
          rect(cash[c].x-9,cash[c].y-7,18,14,"#ffd23e");
          px_txt("$",cash[c].x,cash[c].y+4,9,"#5a4400");
        }
        // guards + vision cones
        for(var g=0;g<guards.length;g++){
          var gu=guards[g], alerted=gu.alert>0;
          ctx.save();
          ctx.fillStyle=alerted?"rgba(255,62,165,.16)":"rgba(255,210,62,.13)";
          ctx.beginPath();ctx.moveTo(gu.x,gu.y);
          ctx.arc(gu.x,gu.y,SIGHT,gu.hd-CONE,gu.hd+CONE);
          ctx.closePath();ctx.fill();
          ctx.restore();
          var col=alerted?"#ff3ea5":"#c77dff";
          rect(gu.x-10,gu.y-10,20,20,col);
          rect(gu.x-6,gu.y-12,12,5,alerted?"#ff8a8a":"#e0b8ff");
          if(alerted) px_txt("!",gu.x,gu.y-16,8,"#ff3ea5");
        }
        // bullets
        ctx.fillStyle="#27e8ff";
        for(var b=0;b<bullets.length;b++){ctx.beginPath();ctx.arc(bullets[b].x,bullets[b].y,4,0,7);ctx.fill();}
        // robber
        rect(px-11,py-11,22,22,"#46ff9c");
        rect(px-7,py-15,14,6,"#1a1a1a");                 // hat
        var n=Math.hypot(fx,fy)||1;
        rect(px-2+fx/n*14,py-2+fy/n*14,5,5,"#f3ecff");   // gun barrel
        // radar / minimap (bottom-right)
        var RW=104,RH=72,RX=W-RW-12,RY=H-RH-12,sX=RW/W,sY=RH/H;
        ctx.save();ctx.globalAlpha=.85;
        rect(RX,RY,RW,RH,"#05030f");
        ctx.strokeStyle="#27e8ff";ctx.lineWidth=1;ctx.strokeRect(RX,RY,RW,RH);
        ctx.restore();
        px_txt("RADAR",RX+RW/2,RY-4,6,"#27e8ff");
        for(var rc=0;rc<cash.length;rc++) rect(RX+cash[rc].x*sX-1,RY+cash[rc].y*sY-1,2,2,"#ffd23e");
        for(var rg=0;rg<guards.length;rg++){
          var blip=guards[rg].alert>0?"#ff3ea5":"#c77dff";
          rect(RX+guards[rg].x*sX-2,RY+guards[rg].y*sY-2,4,4,blip);
        }
        rect(RX+px*sX-2,RY+py*sY-2,4,4,"#46ff9c");
        px_txt("LEVEL "+level,8,20,8,"#9b8fc7","left");
        px_txt("CASH "+cash.length,W-8,20,8,"#ffd23e","right");
        px_txt(""+this.score,W/2,20,10,"#46ff9c");
      }};
  });

  /* 6. Dungeon Dash (top-down: grab 3 keys, reach the exit, level up) */
  reg("dungeon","Arrows / D-pad to explore. Collect all 3 keys then reach the glowing exit. A roaming wraith chases you. Each level +150.",
  function(){
    var C=12,R=9,CS=40,grid,px,py,keys,exit,mob,pt=0,mt=0,level=1,haveKeys=0;
    function build(){
      grid=[];
      for(var y=0;y<R;y++){var row=[];for(var x=0;x<C;x++){
        var wall=(x===0||y===0||x===C-1||y===R-1)||(x%2===0&&y%2===0);
        row.push(wall?1:0);} grid.push(row);}
      px=1;py=1; keys=[]; haveKeys=0;
      var slots=[];
      for(var yy=1;yy<R-1;yy++)for(var xx=1;xx<C-1;xx++) if(grid[yy][xx]===0&&!(xx===1&&yy===1)) slots.push([xx,yy]);
      for(var s=slots.length-1;s>0;s--){var t=ri(0,s);var tmp=slots[s];slots[s]=slots[t];slots[t]=tmp;}
      keys=slots.slice(0,3).map(function(p){return {x:p[0],y:p[1]};});
      exit=slots[3]||[C-2,R-2]; exit={x:exit[0]||C-2,y:exit[1]||R-2};
      var m=slots[4]||[C-2,1]; mob={x:m[0]||C-2,y:m[1]||1};
    }
    build();
    function ok(x,y){return x>=0&&y>=0&&x<C&&y<R&&grid[y][x]!==1;}
    return { score:0, over:false,
      update:function(dt){
        pt+=dt;
        if(pt>=0.13){ pt=0;
          var nx=px,ny=py;
          if(IN.dir==="L")nx--; if(IN.dir==="R")nx++;
          if(IN.dir==="U")ny--; if(IN.dir==="D")ny++;
          if(ok(nx,ny)){px=nx;py=ny;}
          for(var k=keys.length-1;k>=0;k--) if(keys[k].x===px&&keys[k].y===py){keys.splice(k,1);haveKeys++;this.score+=20;}
          if(haveKeys>=3&&px===exit.x&&py===exit.y){ this.score+=150; level++; build(); }
        }
        mt+=dt;
        if(mt>=0.28){ mt=0;
          var d=[[1,0],[-1,0],[0,1],[0,-1]].filter(function(v){return ok(mob.x+v[0],mob.y+v[1]);});
          d.sort(function(a,b){return (Math.abs(mob.x+a[0]-px)+Math.abs(mob.y+a[1]-py))-(Math.abs(mob.x+b[0]-px)+Math.abs(mob.y+b[1]-py));});
          if(d[0]){mob.x+=d[0][0];mob.y+=d[0][1];}
        }
        if(mob.x===px&&mob.y===py) this.over=true;
      },
      draw:function(){
        clear("#070512","#0d0a1c");
        for(var y=0;y<R;y++)for(var x=0;x<C;x++)
          if(grid[y][x]===1) rect(x*CS+1,y*CS+1,CS-2,CS-2,"#2a2150");
        // exit
        ctx.fillStyle=haveKeys>=3?"#46ff9c":"#46ff9c44";
        ctx.fillRect(exit.x*CS+6,exit.y*CS+6,CS-12,CS-12);
        px_txt("EXIT",exit.x*CS+CS/2,exit.y*CS+CS/2+3,6,"#062");
        // keys
        for(var k=0;k<keys.length;k++){px_txt("🔑",keys[k].x*CS+CS/2,keys[k].y*CS+CS/2+8,16,"#ffd23e");}
        // mob
        rect(mob.x*CS+8,mob.y*CS+8,CS-16,CS-16,"#ff3ea5");
        // player
        rect(px*CS+9,py*CS+9,CS-18,CS-18,"#27e8ff");
        px_txt("KEYS "+haveKeys+"/3",8,18,7,"#ffd23e","left");
        px_txt("LV "+level,W-8,18,7,"#9b8fc7","right");
      }};
  });

  /* 7. Quest Pixels (side-scroll platformer: reach the flag each level +100) */
  reg("quest","Left/Right to walk, A / Space / Up to jump. Hop the platforms, grab coins, reach the green flag. Don't fall! Each flag +100.",
  function(){
    var PW=24,PH=28, px=40, py=0, vx=0, vy=0, onG=false, level=1;
    var plats=[], coins=[], flag, scrollX=0;
    function gen(){
      plats=[]; coins=[]; scrollX=0;
      plats.push({x:0,y:320,w:120});
      var cx=120, cy=320;
      var n=5+level;
      for(var i=0;i<n;i++){
        cx += ri(70,120);
        cy = Math.max(150,Math.min(330, cy + ri(-70,70)));
        var w=ri(60,100);
        plats.push({x:cx,y:cy,w:w});
        if(Math.random()<0.6) coins.push({x:cx+w/2,y:cy-26,got:false});
        cx += w;
      }
      flag={x:cx+40,y:cy-46};
      plats.push({x:cx+10,y:cy,w:90});
      px=40; py=320-PH; vx=0; vy=0; onG=false;
    }
    gen();
    return { score:0, over:false,
      update:function(dt){
        vx=0;
        if(IN.held.left) vx=-150;
        if(IN.held.right) vx=150;
        if((IN.edge.action||IN.edge.up)&&onG){ vy=-470; onG=false; }
        vy+=1450*dt;
        px+=vx*dt; py+=vy*dt;
        // platform collision (land on top when falling)
        onG=false;
        for(var i=0;i<plats.length;i++){
          var p=plats[i];
          if(px+PW>p.x && px<p.x+p.w){
            if(vy>=0 && py+PH>p.y && py+PH<p.y+24){
              py=p.y-PH; vy=0; onG=true;
            }
          }
        }
        if(px<0)px=0;
        if(py>H+60){ this.over=true; return; }
        for(var c=0;c<coins.length;c++){
          if(!coins[c].got && Math.abs(coins[c].x-(px+PW/2))<18 && Math.abs(coins[c].y-(py+PH/2))<22){
            coins[c].got=true; this.score+=15;
          }
        }
        if(px+PW>flag.x && px<flag.x+18 && py+PH>flag.y){
          this.score+=100; level++; gen();
        }
        // camera follows player
        scrollX = Math.max(0, px-160);
      },
      draw:function(){
        clear("#0a0820","#1a1238");
        ctx.save(); ctx.translate(-scrollX,0);
        for(var i=0;i<plats.length;i++){
          var p=plats[i];
          rect(p.x,p.y,p.w,18,"#9b6bff");
          rect(p.x,p.y,p.w,4,"#c7a8ff");
        }
        for(var c=0;c<coins.length;c++) if(!coins[c].got){
          ctx.fillStyle="#ffd23e";ctx.beginPath();ctx.arc(coins[c].x,coins[c].y,7,0,7);ctx.fill();
        }
        // flag
        rect(flag.x,flag.y,4,46,"#ccc");
        rect(flag.x+4,flag.y,22,14,"#46ff9c");
        // player
        rect(px,py,PW,PH,"#27e8ff");
        rect(px+15,py+6,5,5,"#0a0613");
        ctx.restore();
        px_txt("LEVEL "+level,8,20,8,"#9b8fc7","left");
        px_txt(""+this.score,W/2,20,10,"#ffd23e");
      }};
  });

  /* FPS Arena (first-person campaign with between-level armory shop) */
  reg("shooter","First-person arena. Left/Right turns the view, A / Space fires. Clear 4 waves per LEVEL. Between levels the ARMORY opens — spend creds on better guns (pistol → SMG → shotgun → rifle → plasma). Earn creds for every kill.",
  function(){
    var HFOV=Math.PI/3, WPL=4;
    var WEAPONS=[
      {n:"PISTOL",  cd:0.30, dmg:1, tol:0.14, multi:1, cost:0},
      {n:"SMG",     cd:0.12, dmg:1, tol:0.14, multi:1, cost:600},
      {n:"SHOTGUN", cd:0.65, dmg:1, tol:0.34, multi:3, cost:1100},
      {n:"RIFLE",   cd:0.50, dmg:3, tol:0.08, multi:1, cost:1900},
      {n:"PLASMA",  cd:0.20, dmg:4, tol:0.18, multi:1, cost:3200},
      {n:"MINIGUN", cd:0.05, dmg:2, tol:0.18, multi:1, cost:5000}
    ];
    var owned=[true,false,false,false,false,false], eq=0, creds=0;
    var aim=0, en=[], level=1, wave=1, cd=0, flash=0, banner="LEVEL 1", bannerT=1.6;
    var state="play", sel=0, SHOP_N=WEAPONS.length+1;
    function spawn(){
      en=[];
      var n=Math.max(2, Math.min(Math.round((3+wave+level)*diffMult()), 14));
      for(var i=0;i<n;i++){
        var armored=level>=3 && Math.random()<0.25+level*0.03;
        en.push({ ang:rnd(-Math.PI,Math.PI), dist:rnd(640,940),
                  spd:(34+wave*6+level*9)*diffMult(), hp:armored?2:1, arm:armored, d:false });
      }
    }
    spawn();
    function angDiff(a,b){return Math.atan2(Math.sin(a-b),Math.cos(a-b));}
    return { score:0, over:false,
      update:function(dt){
        if(bannerT>0)bannerT-=dt;
        if(state==="shop"){
          if(IN.edge.left)  sel=(sel+SHOP_N-1)%SHOP_N;
          if(IN.edge.right) sel=(sel+1)%SHOP_N;
          if(IN.edge.action){
            if(sel===SHOP_N-1){
              level++; wave=1; this.score+=400;
              banner="LEVEL "+level; bannerT=1.8; state="play"; spawn();
            } else {
              var w=WEAPONS[sel];
              if(owned[sel]) eq=sel;
              else if(creds>=w.cost){ creds-=w.cost; owned[sel]=true; eq=sel; }
            }
          }
          return;
        }
        if(IN.held.left)  aim-=2.2*dt;
        if(IN.held.right) aim+=2.2*dt;
        if(aim> Math.PI)aim-=Math.PI*2;
        if(aim<-Math.PI)aim+=Math.PI*2;
        cd-=dt; flash-=dt;
        var W0=WEAPONS[eq];
        if((IN.edge.action||IN.held.action)&&cd<=0){
          cd=W0.cd; flash=0.06;
          var picks=[];
          for(var i=0;i<en.length;i++){
            if(en[i].d)continue;
            var off=Math.abs(angDiff(en[i].ang,aim));
            if(off<W0.tol) picks.push({i:i,d:en[i].dist});
          }
          picks.sort(function(a,b){return a.d-b.d;});
          var hits=Math.min(picks.length,W0.multi);
          for(var k=0;k<hits;k++){
            var ti=picks[k].i; en[ti].hp-=W0.dmg;
            if(en[ti].hp<=0){
              en[ti].d=true;
              var pts=en[ti].arm?90:50; this.score+=pts;
              creds += en[ti].arm?50:25;
            } else this.score+=10;
          }
        }
        for(var e=0;e<en.length;e++){
          if(en[e].d)continue;
          en[e].dist-=en[e].spd*dt;
          if(en[e].dist<=70){ this.over=true; return; }
        }
        en=en.filter(function(o){return !o.d;});
        if(!en.length){
          if(wave<WPL){ wave++; this.score+=150; banner="WAVE "+wave; bannerT=1.1; spawn(); }
          else { this.score+=200; state="shop"; sel=0; banner="ARMORY"; bannerT=1.6; }
        }
      },
      draw:function(){
        // sky / floor
        var g=ctx.createLinearGradient(0,0,0,H);
        g.addColorStop(0,"#070b1e");g.addColorStop(.5,"#11163a");g.addColorStop(.5,"#1a0f24");g.addColorStop(1,"#0a0613");
        ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
        var HZ=H*0.5;
        // perspective floor grid
        ctx.strokeStyle="rgba(39,232,255,.16)";ctx.lineWidth=1;
        for(var d=1;d<=8;d++){var yy=HZ+(H-HZ)*(d/8)*(d/8);ctx.beginPath();ctx.moveTo(0,yy);ctx.lineTo(W,yy);ctx.stroke();}
        for(var vx=-4;vx<=4;vx++){ctx.beginPath();ctx.moveTo(W/2+vx*22,HZ);ctx.lineTo(W/2+vx*150,H);ctx.stroke();}
        // enemies as depth-scaled sprites
        var order=en.slice().sort(function(a,b){return b.dist-a.dist;});
        for(var i=0;i<order.length;i++){
          var en2=order[i],off=Math.atan2(Math.sin(en2.ang-aim),Math.cos(en2.ang-aim));
          if(Math.abs(off)>HFOV)continue;
          var sx=W/2+(off/HFOV)*(W/2);
          var sc=Math.max(0.2,520/en2.dist);
          var ew=42*sc, eh=46*sc, ey=HZ-eh*0.3;
          var body=en2.arm?"#9b6bff":"#ff3ea5", head=en2.arm?"#c7a8ff":"#ff8a8a";
          rect(sx-ew/2,ey,ew,eh,body);
          rect(sx-ew*0.3,ey-eh*0.22,ew*0.6,eh*0.26,head);
          if(en2.arm){ ctx.strokeStyle="#27e8ff";ctx.lineWidth=Math.max(1,2*sc);ctx.strokeRect(sx-ew/2,ey,ew,eh); }
          rect(sx-ew*0.18,ey+eh*0.3,ew*0.12,eh*0.16,"#2a0010");
          rect(sx+ew*0.06,ey+eh*0.3,ew*0.12,eh*0.16,"#2a0010");
        }
        // muzzle flash
        if(flash>0){ ctx.save();ctx.globalAlpha=.5;rect(0,0,W,H,"#ffd23e");ctx.restore(); }
        // weapon
        ctx.fillStyle="#2a2150";
        ctx.beginPath();ctx.moveTo(W/2-46,H);ctx.lineTo(W/2-14,H-58);ctx.lineTo(W/2+14,H-58);ctx.lineTo(W/2+46,H);ctx.closePath();ctx.fill();
        rect(W/2-6,H-90,12,34,"#3a2a6b");
        // crosshair
        ctx.strokeStyle="#27e8ff";ctx.lineWidth=2;
        ctx.beginPath();ctx.arc(W/2,HZ,11,0,7);ctx.stroke();
        ctx.beginPath();ctx.moveTo(W/2-18,HZ);ctx.lineTo(W/2-6,HZ);
        ctx.moveTo(W/2+6,HZ);ctx.lineTo(W/2+18,HZ);
        ctx.moveTo(W/2,HZ-18);ctx.lineTo(W/2,HZ-6);
        ctx.moveTo(W/2,HZ+6);ctx.lineTo(W/2,HZ+18);ctx.stroke();
        // compass of remaining foes
        for(var c=0;c<en.length;c++){
          var o2=Math.atan2(Math.sin(en[c].ang-aim),Math.cos(en[c].ang-aim));
          rect(W/2+Math.max(-1,Math.min(1,o2/Math.PI))*150,H-10,3,6,"#ff3ea5");
        }
        px_txt("LV "+level+"  W"+wave+"/"+WPL,8,18,8,"#9b8fc7","left");
        px_txt("FOES "+en.length,W-8,18,8,"#ff3ea5","right");
        px_txt(""+this.score,W/2,18,10,"#ffd23e");
        px_txt(WEAPONS[eq].n,8,H-22,7,"#27e8ff","left");
        px_txt("$ "+creds,8,H-10,7,"#ffd23e","left");
        if(bannerT>0 && state!=="shop") px_txt(banner,W/2,HZ-40,14,"#27e8ff");
        if(state==="shop"){
          ctx.save();ctx.globalAlpha=.85;rect(0,0,W,H,"#02030f");ctx.restore();
          px_txt("ARMORY  —  LEVEL "+level+" CLEARED",W/2,30,11,"#ffd23e");
          px_txt("CREDS: $"+creds,W/2,52,8,"#27e8ff");
          var slot=(W-12)/SHOP_N, bh=132, by=78;
          for(var i=0;i<SHOP_N;i++){
            var bx=6+i*slot, bw=slot-4, cxm=bx+bw/2;
            var sl=i===sel;
            if(i===SHOP_N-1){
              rect(bx,by,bw,bh,sl?"#1a3a20":"#10241a");
              ctx.strokeStyle=sl?"#46ff9c":"#3a2a6b";ctx.lineWidth=2;ctx.strokeRect(bx,by,bw,bh);
              px_txt("FIGHT",cxm,by+bh/2-6,8,sl?"#fff":"#46ff9c");
              px_txt("LV"+(level+1),cxm,by+bh/2+10,6,"#9b8fc7");
            } else {
              var w=WEAPONS[i];
              var have=owned[i], can=have||creds>=w.cost;
              rect(bx,by,bw,bh,sl?"#1a2350":"#160a26");
              ctx.strokeStyle=sl?"#27e8ff":(have?"#46ff9c":"#3a2a6b");ctx.lineWidth=2;ctx.strokeRect(bx,by,bw,bh);
              px_txt(w.n,cxm,by+16,6,can?"#fff":"#5a4a7a");
              px_txt("DMG"+w.dmg,cxm,by+40,6,"#ff8a8a");
              px_txt(w.cd.toFixed(2),cxm,by+54,6,"#27e8ff");
              if(w.multi>1) px_txt("x"+w.multi,cxm,by+68,6,"#ffd23e");
              if(have) px_txt(eq===i?"EQUIP":"OWNED",cxm,by+96,6,eq===i?"#46ff9c":"#9b8fc7");
              else px_txt("$"+w.cost,cxm,by+96,7,can?"#ffd23e":"#ff8a8a");
            }
          }
          px_txt("◄ ►  •  A: BUY / EQUIP / FIGHT",W/2,H-18,8,"#9b8fc7");
        }
      }};
  });

  /* 11. Galaxy Blaster (first-person cockpit: dogfight ships rushing out of deep space) */
  reg("galaxy","First-person cockpit. Move the crosshair with the D-pad / arrows, A / Space fires. Blast the enemy ships warping toward you out of deep space — don't let one slam into your canopy!",
  function(){
    var aimX=0, aimY=0, en=[], stars=[], bul=[], spawnT=0, cd=0, time=0, flash=0;
    for(var s=0;s<70;s++) stars.push({a:rnd(-1,1),b:rnd(-1,1),z:rnd(40,1000)});
    return { score:0, over:false,
      update:function(dt){
        time+=dt;
        if(IN.held.left)  aimX-=1.8*dt;
        if(IN.held.right) aimX+=1.8*dt;
        if(IN.held.up)    aimY-=1.6*dt;
        if(IN.held.down)  aimY+=1.6*dt;
        aimX=Math.max(-1,Math.min(1,aimX));
        aimY=Math.max(-1,Math.min(1,aimY));
        cd-=dt; flash-=dt;
        if((IN.edge.action||IN.held.action)&&cd<=0){
          cd=0.22; flash=0.05;
          var best=-1,bd=1e9;
          for(var i=0;i<en.length;i++){
            if(en[i].d)continue;
            var off=Math.hypot(en[i].a-aimX,en[i].b-aimY);
            if(off<0.22 && en[i].z<bd){ bd=en[i].z; best=i; }
          }
          if(best>=0){ en[best].d=true; this.score+=40; }
        }
        for(var st=0;st<stars.length;st++){ stars[st].z-=320*dt; if(stars[st].z<20){stars[st].z=1000;stars[st].a=rnd(-1,1);stars[st].b=rnd(-1,1);} }
        spawnT-=dt;
        if(spawnT<=0){
          en.push({ a:rnd(-.9,.9), b:rnd(-.7,.7), z:1000,
                    spd:(150+time*9)*diffMult(), sw:rnd(-.25,.25), d:false });
          spawnT=Math.max(0.45,1.3-time*0.022)/diffMult();
        }
        for(var e=0;e<en.length;e++){
          if(en[e].d)continue;
          en[e].z-=en[e].spd*dt;
          en[e].a+=Math.sin(time*2+e)*en[e].sw*dt;
          if(en[e].z<=26){ this.over=true; return; }
        }
        en=en.filter(function(o){return !o.d;});
      },
      draw:function(){
        clear("#01020c","#06030f");
        // warp starfield
        for(var st=0;st<stars.length;st++){
          var s=stars[st], k=420/s.z, sx=W/2+s.a*k*W*0.5, sy=H/2+s.b*k*H*0.5, r=Math.max(.5,2.4-s.z/500);
          rect(sx,sy,r,r,"#cfe6ff");
        }
        // enemy ships, far first
        var order=en.slice().sort(function(a,b){return b.z-a.z;});
        for(var i=0;i<order.length;i++){
          var e2=order[i], k2=420/e2.z;
          var sx2=W/2+e2.a*k2*W*0.5, sy2=H/2+e2.b*k2*H*0.5;
          var sc=Math.max(4,1100/e2.z);
          ctx.fillStyle="#ff3ea5";
          ctx.beginPath();
          ctx.moveTo(sx2,sy2-sc);ctx.lineTo(sx2-sc*1.3,sy2+sc*0.8);ctx.lineTo(sx2+sc*1.3,sy2+sc*0.8);
          ctx.closePath();ctx.fill();
          rect(sx2-sc*0.35,sy2-sc*0.2,sc*0.7,sc*0.5,"#27e8ff");
        }
        if(flash>0){ ctx.save();ctx.globalAlpha=.4;rect(0,0,W,H,"#46ff9c");ctx.restore(); }
        // cockpit frame
        ctx.fillStyle="#140a26";
        ctx.beginPath();ctx.moveTo(0,H);ctx.lineTo(0,H-70);ctx.lineTo(70,H);ctx.closePath();ctx.fill();
        ctx.beginPath();ctx.moveTo(W,H);ctx.lineTo(W,H-70);ctx.lineTo(W-70,H);ctx.closePath();ctx.fill();
        rect(0,H-14,W,14,"#1c1030");
        // crosshair (free-aimed)
        var cxp=W/2+aimX*W*0.42, cyp=H/2+aimY*H*0.40;
        ctx.strokeStyle=flash>0?"#46ff9c":"#27e8ff";ctx.lineWidth=2;
        ctx.beginPath();ctx.arc(cxp,cyp,12,0,7);ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cxp-20,cyp);ctx.lineTo(cxp-7,cyp);
        ctx.moveTo(cxp+7,cyp);ctx.lineTo(cxp+20,cyp);
        ctx.moveTo(cxp,cyp-20);ctx.lineTo(cxp,cyp-7);
        ctx.moveTo(cxp,cyp+7);ctx.lineTo(cxp,cyp+20);ctx.stroke();
        px_txt("SHIPS "+en.length,W-8,18,8,"#ff3ea5","right");
        px_txt(""+this.score,W/2,18,12,"#ffd23e");
      }};
  });

  /* 12. Asteroid Storm */
  reg("asteroids","Left/Right rotate, Up thrust, A / Space shoot. Blast every rock.",
  function(){
    var sh={x:W/2,y:H/2,a:-Math.PI/2,vx:0,vy:0},bul=[],rk=[],cd=0;
    function wrap(o){if(o.x<0)o.x+=W;if(o.x>W)o.x-=W;if(o.y<0)o.y+=H;if(o.y>H)o.y-=H;}
    function spawn(n,r){for(var i=0;i<n;i++)rk.push({x:rnd(0,W),y:rnd(0,H/4),vx:rnd(-55,55),vy:rnd(30,70),r:r||26});}
    spawn(5,26);
    return { score:0, over:false,
      update:function(dt){
        if(IN.held.left)sh.a-=3.2*dt; if(IN.held.right)sh.a+=3.2*dt;
        if(IN.held.up){sh.vx+=Math.cos(sh.a)*260*dt;sh.vy+=Math.sin(sh.a)*260*dt;}
        sh.vx*=0.99;sh.vy*=0.99;sh.x+=sh.vx*dt;sh.y+=sh.vy*dt;wrap(sh);
        cd-=dt;
        if((IN.edge.action||IN.held.action)&&cd<=0){bul.push({x:sh.x,y:sh.y,vx:Math.cos(sh.a)*380,vy:Math.sin(sh.a)*380,life:1.1});cd=0.28;}
        for(var i=0;i<bul.length;i++){bul[i].x+=bul[i].vx*dt;bul[i].y+=bul[i].vy*dt;bul[i].life-=dt;wrap(bul[i]);}
        bul=bul.filter(function(b){return b.life>0;});
        for(var j=0;j<rk.length;j++){rk[j].x+=rk[j].vx*dt;rk[j].y+=rk[j].vy*dt;wrap(rk[j]);}
        var nw=[];
        for(var b=0;b<bul.length;b++)for(var r2=0;r2<rk.length;r2++)
          if(!bul[b].d&&!rk[r2].d&&Math.hypot(bul[b].x-rk[r2].x,bul[b].y-rk[r2].y)<rk[r2].r){
            bul[b].d=rk[r2].d=true;this.score+=30;
            if(rk[r2].r>13){nw.push({x:rk[r2].x,y:rk[r2].y,vx:rnd(-90,90),vy:rnd(-90,90),r:rk[r2].r/2});
              nw.push({x:rk[r2].x,y:rk[r2].y,vx:rnd(-90,90),vy:rnd(-90,90),r:rk[r2].r/2});}}
        bul=bul.filter(function(b){return !b.d;});
        rk=rk.filter(function(r){return !r.d;}).concat(nw);
        for(var r3=0;r3<rk.length;r3++)if(Math.hypot(sh.x-rk[r3].x,sh.y-rk[r3].y)<rk[r3].r+7)this.over=true;
        if(!rk.length){this.score+=100;spawn(6,26);}
      },
      draw:function(){
        clear("#02030f","#0a0613");
        ctx.save();ctx.translate(sh.x,sh.y);ctx.rotate(sh.a);
        ctx.strokeStyle="#27e8ff";ctx.lineWidth=2;
        ctx.beginPath();ctx.moveTo(14,0);ctx.lineTo(-10,-9);ctx.lineTo(-10,9);ctx.closePath();ctx.stroke();
        ctx.restore();
        ctx.fillStyle="#ffd23e";for(var b=0;b<bul.length;b++){ctx.beginPath();ctx.arc(bul[b].x,bul[b].y,3,0,7);ctx.fill();}
        ctx.strokeStyle="#ff3ea5";ctx.lineWidth=2;
        for(var r=0;r<rk.length;r++){ctx.beginPath();ctx.arc(rk[r].x,rk[r].y,rk[r].r,0,7);ctx.stroke();}
        px_txt(""+this.score,W/2,22,12,"#ffd23e");
      }};
  });

  /* 13. Bubble Pop */
  reg("popper","Tap / click the bubbles before they float off the top. Miss 3 and it's over.",
  function(){
    var bb=[],spawnT=0,miss=0,el=0,COL=["#27e8ff","#ff3ea5","#ffd23e","#46ff9c","#9b6bff"];
    return { score:0, over:false,
      update:function(dt){
        el+=dt;spawnT-=dt;
        if(spawnT<=0){bb.push({x:rnd(36,W-36),y:H+30,r:rnd(18,32),c:COL[ri(0,4)],vy:rnd(52,80)+el*2});spawnT=Math.max(0.38,1.1-el*0.018);}
        for(var i=0;i<bb.length;i++)bb[i].y-=bb[i].vy*dt;
        var alive=[];
        for(var j=0;j<bb.length;j++){var b=bb[j];if(b.p)continue;if(b.y<-b.r){if(++miss>=3)this.over=true;continue;}alive.push(b);}
        if(IN.pclick)for(var k=0;k<alive.length;k++)
          if(Math.hypot(IN.px-alive[k].x,IN.py-alive[k].y)<alive[k].r){alive[k].p=true;this.score+=10;alive.splice(k,1);break;}
        bb=alive;
      },
      draw:function(){
        clear("#0a0613","#10082a");
        for(var i=0;i<bb.length;i++){var b=bb[i];
          ctx.globalAlpha=.82;ctx.fillStyle=b.c;ctx.beginPath();ctx.arc(b.x,b.y,b.r,0,7);ctx.fill();
          ctx.globalAlpha=1;ctx.fillStyle="#ffffff88";ctx.beginPath();ctx.arc(b.x-b.r*.3,b.y-b.r*.3,b.r*.18,0,7);ctx.fill();}
        px_txt(""+this.score,W/2,22,12,"#27e8ff");
        px_txt("MISS "+miss+"/3",W-8,22,8,"#ff3ea5","right");
      }};
  });

  /* 14. Block Cascade (Tetris-like) */
  reg("stacker","Left/Right move, A / Up rotate, Down soft-drop. Clear full lines.",
  function(){
    var COLS=10,ROWS=16,CS=22,OX=(W-COLS*CS)/2,OY=8;
    var SH=[[[1,1,1,1]],[[1,1],[1,1]],[[0,1,0],[1,1,1]],[[1,0,0],[1,1,1]],[[0,0,1],[1,1,1]],[[0,1,1],[1,1,0]],[[1,1,0],[0,1,1]]];
    var CL=["#27e8ff","#ffd23e","#9b6bff","#ff8a3e","#3e7dff","#46ff9c","#ff3ea5"];
    var bd=[],pc=null,dt0=0,ds=0.55,dead=false;
    for(var r=0;r<ROWS;r++){var rw=[];for(var c=0;c<COLS;c++)rw.push(0);bd.push(rw);}
    function rotate(s){var h=s.length,w=s[0].length,n=[];for(var c=0;c<w;c++){var nr=[];for(var rr=h-1;rr>=0;rr--)nr.push(s[rr][c]);n.push(nr);}return n;}
    function fits(s,x,y){for(var r=0;r<s.length;r++)for(var c=0;c<s[r].length;c++){if(!s[r][c])continue;var nx=x+c,ny=y+r;if(nx<0||nx>=COLS||ny>=ROWS)return false;if(ny>=0&&bd[ny][nx])return false;}return true;}
    function np(){var i=ri(0,6);pc={s:SH[i].map(function(r){return r.slice();}),col:CL[i],x:3,y:-1};if(!fits(pc.s,pc.x,pc.y))dead=true;}
    np();
    return { score:0, over:false,
      update:function(dt){
        if(dead){this.over=true;return;}
        if(IN.edge.left&&fits(pc.s,pc.x-1,pc.y))pc.x--;
        if(IN.edge.right&&fits(pc.s,pc.x+1,pc.y))pc.x++;
        if(IN.edge.action||IN.edge.up){var rt=rotate(pc.s);if(fits(rt,pc.x,pc.y))pc.s=rt;}
        dt0+=dt*(IN.held.down?9:1);
        if(dt0>=ds){dt0=0;
          if(fits(pc.s,pc.x,pc.y+1))pc.y++;
          else{
            for(var r=0;r<pc.s.length;r++)for(var c=0;c<pc.s[r].length;c++)if(pc.s[r][c]&&pc.y+r>=0)bd[pc.y+r][pc.x+c]=pc.col;
            var ln=0;
            for(var row=ROWS-1;row>=0;row--)if(bd[row].every(function(v){return v!==0;})){bd.splice(row,1);var z=[];for(var c2=0;c2<COLS;c2++)z.push(0);bd.unshift(z);ln++;row++;}
            if(ln)this.score+=[0,100,250,450,700][Math.min(ln,4)];
            ds=Math.max(0.18,ds-0.012*Math.max(1,ln));np();
          }}
      },
      draw:function(){
        clear("#05030f","#10082a");
        rect(OX,OY,COLS*CS,ROWS*CS,"#0d0820");
        for(var r=0;r<ROWS;r++)for(var c=0;c<COLS;c++)if(bd[r][c])rect(OX+c*CS+1,OY+r*CS+1,CS-2,CS-2,bd[r][c]);
        if(pc)for(var pr=0;pr<pc.s.length;pr++)for(var pcc=0;pcc<pc.s[pr].length;pcc++)if(pc.s[pr][pcc])rect(OX+(pc.x+pcc)*CS+1,OY+(pc.y+pr)*CS+1,CS-2,CS-2,pc.col);
        ctx.strokeStyle="#3a2a6b";ctx.strokeRect(OX,OY,COLS*CS,ROWS*CS);
        var rx=OX+COLS*CS+(W-OX-COLS*CS)/2;
        px_txt("SCORE",rx,OY+20,7,"#9b8fc7");
        px_txt(""+this.score,rx,OY+40,10,"#ffd23e");
      }};
  });

  /* 15. Spend 100 Million */
  reg("spend","D-pad to select, A to buy — or just tap an item. Blow the whole $100,000,000 before time runs out!",
  function(){
    var IT=[{n:"Coffee",p:5,e:"☕"},{n:"Sneakers",p:250,e:"👟"},{n:"Gaming PC",p:3500,e:"🖥️"},{n:"Sports Car",p:95000,e:"🏎️"},
      {n:"Diamond",p:1.2e6,e:"💎"},{n:"Mansion",p:1.2e7,e:"🏰"},{n:"Island",p:4.5e7,e:"🏝️"},{n:"Private Jet",p:6.5e7,e:"✈️"}];
    var budget=1e8,spent=0,owned=IT.map(function(){return 0;}),tleft=45,sel=0,CW=W/2,CH=56,GY=94;
    function fmt(n){return "$"+Math.round(n).toLocaleString();}
    function buy(i,g){if(budget>=IT[i].p){budget-=IT[i].p;spent+=IT[i].p;owned[i]++;g.score=Math.round(spent);}}
    return { score:0, over:false,
      update:function(dt){
        tleft-=dt;
        if(IN.edge.left)sel=(sel+7)%8; if(IN.edge.right)sel=(sel+1)%8;
        if(IN.edge.up)sel=(sel+6)%8; if(IN.edge.down)sel=(sel+2)%8;
        if(IN.edge.action)buy(sel,this);
        if(IN.pclick&&IN.py>GY){var col=IN.px<CW?0:1,row=Math.floor((IN.py-GY)/CH),idx=row*2+col;if(idx>=0&&idx<8){sel=idx;buy(idx,this);}}
        this.score=Math.round(spent);
        if(tleft<=0||budget<5)this.over=true;
      },
      draw:function(){
        clear("#0a0613","#1a1006");
        px_txt("BUDGET",W/2,22,8,"#9b8fc7");
        px_txt(fmt(budget),W/2,48,14,budget>1e7?"#46ff9c":"#ffd23e");
        px_txt("TIME "+Math.max(0,Math.ceil(tleft))+"s",W-8,78,8,"#ff3ea5","right");
        px_txt("SPENT "+fmt(spent),8,78,8,"#27e8ff","left");
        for(var i=0;i<8;i++){var cx=(i%2)*CW,cy=GY+Math.floor(i/2)*CH;
          ctx.fillStyle=i===sel?"rgba(39,232,255,.18)":"rgba(155,107,255,.07)";ctx.fillRect(cx+3,cy+2,CW-6,CH-4);
          ctx.strokeStyle=i===sel?"#27e8ff":"#3a2a6b";ctx.strokeRect(cx+3,cy+2,CW-6,CH-4);
          ctx.font="22px serif";ctx.textAlign="left";ctx.fillStyle="#fff";ctx.fillText(IT[i].e,cx+10,cy+34);
          px_txt(IT[i].n,cx+42,cy+22,7,"#f3ecff","left");
          px_txt(fmt(IT[i].p),cx+42,cy+40,7,"#ffd23e","left");
          if(owned[i])px_txt("x"+owned[i],cx+CW-10,cy+32,8,"#46ff9c","right");}
      }};
  });

  /* 16. Claw Machine (rigged 1-in-20 grab even on a perfect line-up) */
  reg("claw","Left/Right to slide the claw, A to drop it. Line the claw up EXACTLY over a prize — and even then it's a rigged 1-in-20 grab, just like a real arcade! Bag prizes for tickets before your credits run out.",
  function(){
    var clawX=W/2, state="aim", cy=46, credits=12, msg="", msgT=0, targetIdx=-1, win=false;
    var prizes=[];
    function layout(){
      prizes=[]; var em=["🧸","🎁","🎮","💎","⭐"], val=[40,60,90,140,220];
      for(var i=0;i<5;i++) prizes.push({x:74+i*84, got:false, e:em[i], val:val[i]});
    }
    layout();
    return { score:0, over:false,
      update:function(dt){
        if(msgT>0)msgT-=dt;
        if(state==="aim"){
          if(IN.held.left)  clawX-=180*dt;
          if(IN.held.right) clawX+=180*dt;
          clawX=Math.max(40,Math.min(W-40,clawX));
          if(IN.edge.action){
            state="drop"; cy=46; targetIdx=-1;
            for(var i=0;i<prizes.length;i++)
              if(!prizes[i].got && Math.abs(prizes[i].x-clawX)<20){ targetIdx=i; break; }
            win = targetIdx>=0 && Math.random()<1/20;
          }
        } else if(state==="drop"){
          cy+=270*dt;
          if(cy>=268){ cy=268;
            if(win){ prizes[targetIdx].got=true; this.score+=prizes[targetIdx].val;
              msg="WINNER  +"+prizes[targetIdx].val+" TIX"; msgT=1.7; }
            else { msg=targetIdx>=0?"SO CLOSE - IT SLIPPED!":"MISSED - LINE IT UP"; msgT=1.5; }
            state="rise";
          }
        } else if(state==="rise"){
          cy-=250*dt;
          if(cy<=46){ cy=46; state="aim"; credits--;
            if(prizes.every(function(p){return p.got;})) layout();
            if(credits<=0) this.over=true;
          }
        }
      },
      draw:function(){
        clear("#1a0e2e","#0a0613");
        ctx.strokeStyle="#9b6bff";ctx.lineWidth=4;ctx.strokeRect(10,10,W-20,H-20);
        rect(20,40,W-40,4,"#3a2a6b");
        rect(30,288,W-60,54,"#160a26");
        ctx.font="26px serif";ctx.textAlign="center";ctx.fillStyle="#fff";
        for(var i=0;i<prizes.length;i++){ if(prizes[i].got)continue;
          ctx.fillText(prizes[i].e, prizes[i].x, 322); }
        rect(clawX-1,44,2,cy-44,"#9b8fc7");
        ctx.fillStyle=win&&state==="rise"?"#46ff9c":"#27e8ff";
        ctx.beginPath();ctx.moveTo(clawX-14,cy);ctx.lineTo(clawX,cy+16);ctx.lineTo(clawX+14,cy);ctx.closePath();ctx.fill();
        rect(clawX-3,cy-8,6,10,"#27e8ff");
        if(state==="rise"&&win&&targetIdx>=0){ ctx.font="22px serif";ctx.fillStyle="#fff";ctx.fillText(prizes[targetIdx].e,clawX,cy+34); }
        px_txt("CREDITS "+credits,14,H-16,8,"#ff3ea5","left");
        px_txt("TIX "+this.score,W/2,28,11,"#ffd23e");
        if(msgT>0) px_txt(msg,W/2,H/2,9,win?"#46ff9c":"#ff8a8a");
      }};
  });

  /* 17. Neon Pong (you vs CPU — rally, score, miss = over) */
  reg("pong","Up/Down (or D-pad) to move your paddle. First to 3 wins. Every return scores; sneaking one past the CPU is a big bonus and a point. Lose 3 points first and the match is over.",
  function(){
    var PH=66, PW=10, py=H/2-PH/2, ax=W-24, ay=H/2-PH/2;
    var bx=W/2,by=H/2,bvx=-230,bvy=60, rallies=0, you=0, cpu=0;
    function serve(){ bx=W/2;by=H/2; var sp=230+rallies*6;
      bvx=-sp; bvy=rnd(-0.3,0.3)*sp; }
    return { score:0, over:false,
      update:function(dt){
        if(IN.held.up)   py-=330*dt;
        if(IN.held.down) py+=330*dt;
        py=Math.max(6,Math.min(H-6-PH,py));
        var d=diffMult(), aiCap=320*d;
        var gain = bvx>0 ? 7*d : (DA_DIFF==="easy" ? 1.4 : DA_DIFF==="hard" ? 6 : 3.5);
        var tgt=by-PH/2-ay, mv=Math.max(-aiCap,Math.min(aiCap,tgt*gain));
        ay+=mv*dt; ay=Math.max(6,Math.min(H-6-PH,ay));
        bx+=bvx*dt; by+=bvy*dt;
        if(by<8){by=8;bvy=Math.abs(bvy);} if(by>H-8){by=H-8;bvy=-Math.abs(bvy);}
        if(bvx<0 && bx-6<=24 && bx-6>=6 && by+6>=py && by-6<=py+PH){
          bvx=Math.abs(bvx)*1.05; bx=30;
          bvy+=((by-(py+PH/2))/(PH/2))*190; rallies++; this.score+=10;
        }
        if(bvx>0 && bx+6>=ax && bx+6<=ax+PW+6 && by+6>=ay && by-6<=ay+PH){
          bvx=-Math.abs(bvx)*1.05; bx=ax-6;
          bvy+=((by-(ay+PH/2))/(PH/2))*170;
        }
        bvy=Math.max(-360,Math.min(360,bvy));
        if(bx<0){ cpu++; if(cpu>=3){ this.over=true; return; } serve(); }
        if(bx>W){ you++; this.score+=120; rallies++; if(you>=3){ this.score+=300; this.over=true; return; } serve(); }
      },
      draw:function(){
        clear("#02030f","#0a0613");
        ctx.strokeStyle="#27e8ff44";ctx.setLineDash([8,12]);ctx.lineWidth=3;
        ctx.beginPath();ctx.moveTo(W/2,0);ctx.lineTo(W/2,H);ctx.stroke();ctx.setLineDash([]);
        rect(14,py,PW,PH,"#46ff9c");
        rect(ax,ay,PW,PH,"#ff3ea5");
        rect(bx-6,by-6,12,12,"#ffd23e");
        px_txt("YOU "+you+"/3",W/2-30,26,9,"#46ff9c","right");
        px_txt("CPU "+cpu+"/3",W/2+30,26,9,"#ff3ea5","left");
        px_txt(""+this.score,W/2,H-10,9,"#9b8fc7");
      }};
  });

  /* 18. Tower Siege (place towers, hold the line, survive the waves) */
  reg("tower","D-pad moves the build cursor; A drops a tower ($50) on empty ground. Towers auto-blast creeps along the path. Between waves the UPGRADE SHOP opens — spend gold on +damage, +range, faster fire, extra lives, or more gold per kill, then start the next wave.",
  function(){
    var COLS=12,ROWS=9,CS=40;
    var WP=[[0,4],[3,4],[3,1],[8,1],[8,7],[11,7]];
    var path={};
    function fill(a,b){
      var x=a[0],y=a[1],sx=Math.sign(b[0]-a[0]),sy=Math.sign(b[1]-a[1]);
      while(x!==b[0]||y!==b[1]){ path[x+","+y]=1; if(x!==b[0])x+=sx; else if(y!==b[1])y+=sy; }
      path[b[0]+","+b[1]]=1;
    }
    for(var i=0;i<WP.length-1;i++) fill(WP[i],WP[i+1]);
    var wpx=WP.map(function(c){return [c[0]*CS+CS/2,c[1]*CS+CS/2];});
    var cur={x:5,y:4}, gold=120, lives=12, wave=0, towers=[], creeps=[];
    var spawnN=0, spawnT=0, betw=2.4, alive=0;
    var dmgL=0,rngL=0,rateL=0,incomeL=0,healUses=0;
    var state="play", sel=0;
    var UPS=[
      {n:"+DAMAGE",  d:function(){return "+1 (now "+(8+dmgL+1)+")";},
        cost:function(){return Math.round(60*Math.pow(1.6,dmgL));},
        buy:function(){ dmgL++; }},
      {n:"+RANGE",   d:function(){return "+18 (now "+(96+(rngL+1)*18)+")";},
        cost:function(){return Math.round(60*Math.pow(1.6,rngL));},
        buy:function(){ rngL++; }},
      {n:"+RATE",    d:function(){return "-10% CD";},
        cost:function(){return Math.round(80*Math.pow(1.7,rateL));},
        buy:function(){ rateL++; }},
      {n:"+3 LIVES", d:function(){return "patch the breach";},
        cost:function(){return Math.round(120*Math.pow(2,healUses));},
        buy:function(){ lives+=3; healUses++; }},
      {n:"+INCOME",  d:function(){return "+5 gold/kill";},
        cost:function(){return Math.round(160*Math.pow(1.6,incomeL));},
        buy:function(){ incomeL++; }},
      {n:"NEXT WAVE",d:function(){return "send it";},
        cost:function(){return 0;}, buy:function(){ startWave(); state="play"; }}
    ];
    function startWave(){ wave++; spawnN=4+wave*2; spawnT=0; }
    startWave();
    return { score:0, over:false,
      update:function(dt){
        if(state==="shop"){
          if(IN.edge.left)  sel=(sel+UPS.length-1)%UPS.length;
          if(IN.edge.right) sel=(sel+1)%UPS.length;
          if(IN.edge.action){
            var u=UPS[sel], c=u.cost();
            if(c===0){ u.buy(); }
            else if(gold>=c){ gold-=c; u.buy(); }
          }
          return;
        }
        if(IN.edge.left) cur.x=Math.max(0,cur.x-1);
        if(IN.edge.right)cur.x=Math.min(COLS-1,cur.x+1);
        if(IN.edge.up)   cur.y=Math.max(0,cur.y-1);
        if(IN.edge.down) cur.y=Math.min(ROWS-1,cur.y+1);
        if(IN.edge.action){
          var k=cur.x+","+cur.y, taken=towers.some(function(t){return t.cx===cur.x&&t.cy===cur.y;});
          if(!path[k]&&!taken&&gold>=50){
            gold-=50; towers.push({cx:cur.x,cy:cur.y,x:cur.x*CS+CS/2,y:cur.y*CS+CS/2,cd:0,fx:0,fy:0,sh:0});
          }
        }
        if(spawnN>0){ spawnT-=dt;
          if(spawnT<=0){ spawnT=betw; spawnN--;
            creeps.push({seg:0,x:wpx[0][0],y:wpx[0][1],hp:18+wave*9,mx:18+wave*9,spd:46+wave*3}); alive++;
          }
        }
        for(var c=0;c<creeps.length;c++){
          var cr=creeps[c]; if(cr.dead)continue;
          var nx=wpx[cr.seg+1]; if(!nx){ cr.dead=true; alive--; lives--; continue; }
          var dx=nx[0]-cr.x, dy=nx[1]-cr.y, d=Math.hypot(dx,dy)||1;
          cr.x+=dx/d*cr.spd*dt; cr.y+=dy/d*cr.spd*dt;
          if(Math.hypot(nx[0]-cr.x,nx[1]-cr.y)<4){ cr.x=nx[0];cr.y=nx[1];cr.seg++; }
        }
        var TDM=8+dmgL, TRG=96+rngL*18, TCD=0.4*Math.pow(0.9,rateL), GPK=12+incomeL*5;
        for(var t=0;t<towers.length;t++){
          var tw=towers[t]; tw.cd-=dt; if(tw.sh>0)tw.sh-=dt;
          if(tw.cd<=0){
            var tgt=null,bd=TRG;
            for(var q=0;q<creeps.length;q++){ var cc=creeps[q]; if(cc.dead)continue;
              var dd=Math.hypot(cc.x-tw.x,cc.y-tw.y); if(dd<bd){bd=dd;tgt=cc;} }
            if(tgt){ tgt.hp-=TDM; tw.cd=TCD; tw.fx=tgt.x; tw.fy=tgt.y; tw.sh=0.09;
              if(tgt.hp<=0&&!tgt.dead){ tgt.dead=true; alive--; gold+=GPK; this.score+=15; } }
          }
        }
        creeps=creeps.filter(function(o){return !o.dead;});
        if(lives<=0){ this.over=true; return; }
        if(spawnN<=0 && alive<=0){ gold+=40; this.score+=60; state="shop"; sel=0; }
      },
      draw:function(){
        clear("#07120a","#0a0613");
        for(var y=0;y<ROWS;y++)for(var x=0;x<COLS;x++){
          if(path[x+","+y]) rect(x*CS+1,y*CS+1,CS-2,CS-2,"#3a2a1a");
          else rect(x*CS+1,y*CS+1,CS-2,CS-2,"#10241a");
        }
        rect(wpx[0][0]-CS/2,wpx[0][1]-CS/2,CS,CS,"#27406b");
        var ex=wpx[wpx.length-1];
        rect(ex[0]-CS/2,ex[1]-CS/2,CS,CS,"#6b2740");
        for(var t=0;t<towers.length;t++){
          var tw=towers[t];
          rect(tw.x-12,tw.y-12,24,24,"#27e8ff");
          rect(tw.x-5,tw.y-18,10,10,"#9b6bff");
          if(tw.sh>0){ ctx.strokeStyle="#ffd23e";ctx.lineWidth=2;
            ctx.beginPath();ctx.moveTo(tw.x,tw.y);ctx.lineTo(tw.fx,tw.fy);ctx.stroke(); }
        }
        for(var c=0;c<creeps.length;c++){ var cr=creeps[c];
          rect(cr.x-9,cr.y-9,18,18,"#ff3ea5");
          rect(cr.x-9,cr.y-14,18*(cr.hp/cr.mx),3,"#46ff9c");
        }
        if(state==="play"){
          ctx.strokeStyle=path[cur.x+","+cur.y]||towers.some(function(t){return t.cx===cur.x&&t.cy===cur.y;})?"#ff3ea5":"#46ff9c";
          ctx.lineWidth=2;ctx.strokeRect(cur.x*CS+2,cur.y*CS+2,CS-4,CS-4);
        }
        px_txt("$"+gold,8,16,8,"#ffd23e","left");
        px_txt("LIVES "+lives,W/2,16,8,"#ff3ea5");
        px_txt("WAVE "+wave,W-8,16,8,"#27e8ff","right");
        px_txt(""+this.score,W/2,H-10,8,"#9b8fc7");
        if(state==="shop"){
          ctx.save();ctx.globalAlpha=.86;rect(0,0,W,H,"#02030f");ctx.restore();
          px_txt("WAVE "+wave+" CLEARED — UPGRADE SHOP",W/2,32,10,"#ffd23e");
          px_txt("GOLD $"+gold,W/2,52,8,"#46ff9c");
          for(var i=0;i<UPS.length;i++){
            var bw=72, bh=140, gx=8+i*((W-16)/UPS.length), bx=gx+((W-16)/UPS.length-bw)/2, by=72;
            var sl=i===sel, u=UPS[i], cost=u.cost(), can=cost===0||gold>=cost, fight=i===UPS.length-1;
            rect(bx,by,bw,bh,sl?(fight?"#1a3a20":"#1a2350"):(fight?"#10241a":"#160a26"));
            ctx.strokeStyle=sl?(fight?"#46ff9c":"#27e8ff"):(can?"#3a2a6b":"#2a1820");
            ctx.lineWidth=2;ctx.strokeRect(bx,by,bw,bh);
            px_txt(u.n,bx+bw/2,by+18,7,can?"#fff":"#5a4a7a");
            var lines=u.d().split(" ");
            for(var ln=0;ln<lines.length;ln++) px_txt(lines[ln],bx+bw/2,by+42+ln*12,6,"#9b8fc7");
            if(fight) px_txt("▶",bx+bw/2,by+bh-30,12,"#46ff9c");
            else px_txt("$"+cost,bx+bw/2,by+bh-18,8,can?"#ffd23e":"#ff8a8a");
          }
          px_txt("◄ ►  •  A: BUY / START",W/2,H-18,8,"#9b8fc7");
        }
      }};
  });

  /* 19. Word Rush (unlimited Wordle: solve, repeat, score forever) */
  reg("wordle","Unlimited Wordle — TYPE on your keyboard. Letters fill the row, Backspace deletes, Enter submits the 5-letter guess. Green = right spot, yellow = wrong spot. 6 tries per word; solve it for points then a fresh word. One failed word ends the run.",
  function(){
    var WORDS=["APPLE","BRAVE","CRANE","DRIVE","EAGLE","FLAME","GHOST","HEART",
      "IVORY","JOKER","KNEEL","LEMON","MANGO","NIGHT","OCEAN","PIANO","QUICK",
      "RIVER","STONE","TIGER","ULTRA","VIVID","WATER","XENON","YACHT","ZEBRA",
      "PLUMB","GLYPH","CRISP","FROST","BLAZE","CHARM","DWELL","EMBER","GIANT"];
    var ROWS=6;
    var target, rows, typed, solved=0, msg="", msgT=0, revealT=0;
    function newWord(){
      target=WORDS[ri(0,WORDS.length-1)];
      rows=[]; typed="";
    }
    newWord();
    function judge(g){
      var res=[0,0,0,0,0], cnt={}, i;
      for(i=0;i<5;i++){ var ch=target[i]; cnt[ch]=(cnt[ch]||0)+1; }
      for(i=0;i<5;i++){ if(g[i]===target[i]){ res[i]=2; cnt[g[i]]--; } }
      for(i=0;i<5;i++){ if(res[i]===0 && cnt[g[i]]>0){ res[i]=1; cnt[g[i]]--; } }
      return res;
    }
    return { score:0, over:false,
      onkey:function(k){
        if(revealT>0) return;
        if(k==="BACK"){ typed=typed.slice(0,-1); return; }
        if(k==="ENTER"){
          if(typed.length!==5) return;
          var g=typed, res=judge(g);
          rows.push({g:g,r:res});
          if(g===target){
            var pts=(ROWS-rows.length+1)*90+60; this.score+=pts; solved++;
            msg="SOLVED  +"+pts; msgT=1.6; newWord();
          } else if(rows.length>=ROWS){
            msg="WORD WAS "+target; msgT=2.4; revealT=2.4;
          } else { typed=""; }
          return;
        }
        if(typed.length<5 && /^[A-Z]$/.test(k)) typed+=k;
      },
      update:function(dt){
        if(msgT>0)msgT-=dt;
        if(revealT>0){ revealT-=dt; if(revealT<=0) this.over=true; }
      },
      draw:function(){
        clear("#0a0613","#10082a");
        var BX=(W-5*54)/2, BY=40, BS=48;
        for(var r=0;r<ROWS;r++){
          for(var c=0;c<5;c++){
            var x=BX+c*54, y=BY+r*50, fill="#160a26", bord="#3a2a6b", ch="", done=r<rows.length;
            if(done){ var rr=rows[r];
              ch=rr.g[c];
              fill=rr.r[c]===2?"#46ff9c":rr.r[c]===1?"#ffd23e":"#2a2150";
              bord=fill;
            } else if(r===rows.length && revealT<=0){
              ch=typed[c]||"";
              if(c===typed.length) bord="#27e8ff";
            }
            rect(x,y,BS,BS,fill);
            ctx.strokeStyle=bord;ctx.lineWidth=2;ctx.strokeRect(x,y,BS,BS);
            if(ch) px_txt(ch,x+BS/2,y+BS/2+7,16,done?"#0a0613":"#f3ecff");
          }
        }
        px_txt("SOLVED "+solved,8,20,8,"#9b8fc7","left");
        px_txt(""+this.score,W-8,20,9,"#ffd23e","right");
        px_txt("TYPE • ENTER • BACKSPACE",W/2,H-30,7,"#5a4a7a");
        if(msgT>0) px_txt(msg,W/2,H-12,9,"#46ff9c");
      }};
  });

  /* 20. Map Tap (whack-a-mole grid — tap the lit cells, don't miss) */
  reg("maptap","Geography challenge: you're given a city and country — click where it is on the world map. You're scored on how close you are (0–100 per round, 8 rounds). The real location is revealed each round.",
  function(){
    var TOP=34;                                   // map starts below the prompt bar
    function PX(lon){ return (lon+180)/360*W; }
    function PY(lat){ return TOP + (90-lat)/180*(H-TOP); }
    function INV(ix,iy){ return [ ix/W*360-180, 90-(iy-TOP)/(H-TOP)*180 ]; }
    var LAND=[
      [[-168,66],[-140,70],[-95,71],[-80,52],[-58,48],[-66,44],[-75,30],[-97,18],[-105,23],[-118,33],[-125,48],[-140,60],[-168,66]],
      [[-81,9],[-60,11],[-50,-3],[-35,-8],[-40,-23],[-58,-35],[-71,-52],[-75,-40],[-78,-15],[-81,9]],
      [[-10,36],[-9,44],[-2,49],[-5,58],[6,62],[28,60],[40,56],[40,46],[27,41],[14,38],[-2,37],[-10,36]],
      [[-17,21],[10,35],[33,32],[43,12],[51,11],[41,-4],[40,-25],[20,-35],[12,-18],[-6,5],[-17,21]],
      [[40,46],[58,66],[100,73],[140,71],[160,62],[146,45],[122,30],[108,21],[95,8],[78,8],[68,24],[55,38],[40,46]],
      [[114,-22],[130,-12],[143,-12],[150,-25],[145,-38],[131,-32],[116,-35],[114,-22]]
    ];
    var CITIES=[
      ["Paris","France",2.35,48.85],["London","UK",-0.13,51.5],["New York","USA",-74,40.7],
      ["Tokyo","Japan",139.7,35.7],["Sydney","Australia",151.2,-33.9],["Cairo","Egypt",31.2,30.0],
      ["Rio de Janeiro","Brazil",-43.2,-22.9],["Moscow","Russia",37.6,55.75],["Beijing","China",116.4,39.9],
      ["Cape Town","South Africa",18.4,-33.9],["Mumbai","India",72.8,19.0],["Mexico City","Mexico",-99.1,19.4],
      ["Los Angeles","USA",-118.2,34.0],["Berlin","Germany",13.4,52.5],["Dubai","UAE",55.3,25.2],
      ["Toronto","Canada",-79.4,43.7],["Buenos Aires","Argentina",-58.4,-34.6],["Lagos","Nigeria",3.4,6.5],
      ["Bangkok","Thailand",100.5,13.7],["Istanbul","Turkey",29.0,41.0]
    ];
    var order=CITIES.slice(); for(var s=order.length-1;s>0;s--){var t=ri(0,s),tmp=order[s];order[s]=order[t];order[t]=tmp;}
    var ROUNDS=8, idx=0, state="ask", resT=0, cx=0, cy=0, acc=0, km=0, cur=order[0];
    return { score:0, over:false,
      update:function(dt){
        if(state==="show"){
          resT-=dt;
          if(resT<=0){
            idx++;
            if(idx>=ROUNDS){ this.over=true; return; }
            cur=order[idx%order.length]; state="ask";
          }
          return;
        }
        if(IN.pclick && IN.py>TOP){
          cx=IN.px; cy=IN.py;
          var ll=INV(cx,cy), dLat=ll[1]-cur[3];
          var dLon=(ll[0]-cur[2])*Math.cos((ll[1]+cur[3])/2*Math.PI/180);
          var deg=Math.hypot(dLat,dLon);
          km=Math.round(deg*111);
          acc=Math.max(0,Math.round(100*(1-deg/30)));
          this.score+=acc;
          state="show"; resT=1.9;
        }
      },
      draw:function(){
        var g=ctx.createLinearGradient(0,0,0,H);
        g.addColorStop(0,"#0a1430");g.addColorStop(1,"#06203a");
        ctx.fillStyle=g;ctx.fillRect(0,TOP,W,H-TOP);
        ctx.strokeStyle="rgba(39,232,255,.10)";ctx.lineWidth=1;
        for(var gl=-150;gl<=150;gl+=30){ctx.beginPath();ctx.moveTo(PX(gl),TOP);ctx.lineTo(PX(gl),H);ctx.stroke();}
        for(var ga=-60;ga<=60;ga+=30){ctx.beginPath();ctx.moveTo(0,PY(ga));ctx.lineTo(W,PY(ga));ctx.stroke();}
        for(var L=0;L<LAND.length;L++){
          ctx.fillStyle="#1f6b46";ctx.beginPath();
          for(var p=0;p<LAND[L].length;p++){ var pt=LAND[L][p];
            if(p===0)ctx.moveTo(PX(pt[0]),PY(pt[1])); else ctx.lineTo(PX(pt[0]),PY(pt[1])); }
          ctx.closePath();ctx.fill();
          ctx.strokeStyle="#46ff9c55";ctx.lineWidth=1;ctx.stroke();
        }
        // prompt bar
        rect(0,0,W,TOP,"#0a0613");
        px_txt("FIND:  "+cur[0]+", "+cur[1],W/2,22,9,"#ffd23e");
        if(state==="show"){
          var tx=PX(cur[2]), ty=PY(cur[3]);
          ctx.strokeStyle="#46ff9c";ctx.lineWidth=2;
          ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(tx,ty);ctx.stroke();
          // your click
          ctx.strokeStyle="#fff";ctx.lineWidth=3;
          ctx.beginPath();ctx.moveTo(cx-7,cy-7);ctx.lineTo(cx+7,cy+7);
          ctx.moveTo(cx+7,cy-7);ctx.lineTo(cx-7,cy+7);ctx.stroke();
          // true location
          ctx.fillStyle="#46ff9c";ctx.beginPath();ctx.arc(tx,ty,5,0,7);ctx.fill();
          ctx.strokeStyle="#46ff9c";ctx.lineWidth=2;ctx.beginPath();ctx.arc(tx,ty,11,0,7);ctx.stroke();
          px_txt(cur[0].toUpperCase(),tx,ty-16,7,"#46ff9c");
          px_txt("±"+km+" KM   "+acc+"%",W/2,H-14,10,acc>=70?"#46ff9c":acc>=35?"#ffd23e":"#ff8a8a");
        } else {
          px_txt("CLICK THE MAP",W/2,H-14,8,"#5a7a9a");
        }
        px_txt("ROUND "+Math.min(idx+1,ROUNDS)+"/"+ROUNDS,8,22,7,"#9b8fc7","left");
        px_txt(""+this.score,W-8,22,9,"#ffd23e","right");
      }};
  });

  /* 21. Turret Survivors (auto-fire survival; level up to pick 1 of 3 upgrades) */
  reg("survivor","D-pad / arrows to move. Your turret AUTO-FIRES at the nearest enemy. Every kill gives XP — at each level-up the game pauses and you pick 1 of 3 upgrades. Survive the swarm as long as you can!",
  function(){
    var px=W/2, py=H/2, pr=11, hp=10, maxhp=10, spd=130;
    var dmg=1, rate=0.45, bspd=340, pierce=1, mult=1, regenR=0;
    var bul=[], en=[], spawnT=0, fireT=0, time=0, kills=0, xp=0, lvl=1, xpNext=8;
    var state="play", choices=[], ci=0, regAcc=0, hitFlash=0;
    var UPS=[
      {n:"+DAMAGE",   d:"deal +1 damage",        a:function(){dmg+=1;}},
      {n:"+FIRE RATE",d:"-18% cooldown",         a:function(){rate=Math.max(0.07,rate*0.82);}},
      {n:"+SPEED",    d:"bullets +25% faster",   a:function(){bspd*=1.25;}},
      {n:"+PIERCE",   d:"shots hit +1 enemy",    a:function(){pierce+=1;}},
      {n:"+MULTI",    d:"fire +1 bullet at once",a:function(){mult+=1;}},
      {n:"+MAX HP",   d:"+3 max HP, heal full",  a:function(){maxhp+=3;hp=maxhp;}},
      {n:"+REGEN",    d:"regen +0.4 HP/s",       a:function(){regenR+=0.4;}},
      {n:"+MOVE",     d:"+15% move speed",       a:function(){spd*=1.15;}}
    ];
    function pickChoices(){
      var pool=UPS.slice();
      for(var s=pool.length-1;s>0;s--){var t=ri(0,s),tmp=pool[s];pool[s]=pool[t];pool[t]=tmp;}
      choices=pool.slice(0,3); ci=0;
    }
    return { score:0, over:false,
      update:function(dt){
        if(hitFlash>0)hitFlash-=dt;
        if(state==="up"){
          if(IN.edge.left)  ci=(ci+2)%3;
          if(IN.edge.right) ci=(ci+1)%3;
          if(IN.edge.action){ choices[ci].a(); state="play"; }
          return;
        }
        time+=dt;
        if(regenR>0){ regAcc+=dt*regenR; while(regAcc>=1){regAcc-=1; hp=Math.min(maxhp,hp+1);} }
        var mx=0,my=0;
        if(IN.held.left)mx=-1; if(IN.held.right)mx=1;
        if(IN.held.up)my=-1;   if(IN.held.down)my=1;
        if(mx||my){ var n=Math.hypot(mx,my); px+=mx/n*spd*dt; py+=my/n*spd*dt; }
        px=Math.max(pr,Math.min(W-pr,px));
        py=Math.max(pr,Math.min(H-pr,py));
        // spawn
        spawnT-=dt;
        if(spawnT<=0){
          var side=ri(0,3), ex,ey;
          if(side===0){ex=rnd(0,W);ey=-14;}
          else if(side===1){ex=W+14;ey=rnd(0,H);}
          else if(side===2){ex=rnd(0,W);ey=H+14;}
          else{ex=-14;ey=rnd(0,H);}
          var ehp=2+Math.floor(time/14);
          en.push({x:ex,y:ey,hp:ehp,mx:ehp,sp:46+time*1.6,r:11});
          spawnT=Math.max(0.18,1.0-time*0.012);
        }
        // enemies move + contact
        for(var e=0;e<en.length;e++){
          var ee=en[e]; var dxv=px-ee.x,dyv=py-ee.y,dd=Math.hypot(dxv,dyv)||1;
          ee.x+=dxv/dd*ee.sp*dt; ee.y+=dyv/dd*ee.sp*dt;
          if(dd<pr+ee.r){ hp-=2.2*dt; hitFlash=0.12; }
        }
        if(hp<=0){ this.over=true; return; }
        // auto-fire at nearest
        fireT-=dt;
        if(fireT<=0 && en.length){
          var best=null,bd=1e9;
          for(var i=0;i<en.length;i++){ var d2=Math.hypot(en[i].x-px,en[i].y-py); if(d2<bd){bd=d2;best=en[i];} }
          if(best){
            var ang=Math.atan2(best.y-py,best.x-px);
            for(var s=0;s<mult;s++){
              var spread=mult>1?(s-(mult-1)/2)*0.20:0;
              var a=ang+spread;
              bul.push({x:px,y:py,vx:Math.cos(a)*bspd,vy:Math.sin(a)*bspd,life:1.5,pi:pierce-1,hit:{}});
            }
            fireT=rate;
          }
        }
        // bullets
        for(var b=0;b<bul.length;b++){
          var bb=bul[b]; bb.x+=bb.vx*dt; bb.y+=bb.vy*dt; bb.life-=dt;
          for(var k=0;k<en.length;k++){
            var ek=en[k]; if(ek.dead||bb.hit[k])continue;
            if(Math.hypot(bb.x-ek.x,bb.y-ek.y)<ek.r){
              ek.hp-=dmg; bb.hit[k]=1;
              if(ek.hp<=0&&!ek.dead){ ek.dead=true; kills++; this.score+=10; xp+=1;
                if(xp>=xpNext){ xp-=xpNext; lvl++; xpNext=Math.floor(xpNext*1.4); pickChoices(); state="up"; }
              }
              if(bb.pi<=0){ bb.life=0; break; }
              bb.pi--;
            }
          }
        }
        bul=bul.filter(function(o){return o.life>0 && o.x>-12 && o.x<W+12 && o.y>-12 && o.y<H+12;});
        en =en.filter(function(o){return !o.dead;});
      },
      draw:function(){
        clear("#0a0613","#160a26");
        ctx.strokeStyle="rgba(155,107,255,.08)";ctx.lineWidth=1;
        for(var x=0;x<W;x+=24){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();}
        for(var y=0;y<H;y+=24){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}
        for(var e=0;e<en.length;e++){ var ee=en[e];
          rect(ee.x-ee.r,ee.y-ee.r,ee.r*2,ee.r*2,"#ff3ea5");
          rect(ee.x-ee.r,ee.y-ee.r-5,ee.r*2*(ee.hp/ee.mx),3,"#46ff9c");
        }
        ctx.fillStyle="#ffd23e";
        for(var b=0;b<bul.length;b++){ctx.beginPath();ctx.arc(bul[b].x,bul[b].y,3,0,7);ctx.fill();}
        // turret base + barrel toward nearest
        ctx.fillStyle=hitFlash>0?"#ff8a8a":"#27e8ff";
        ctx.beginPath();ctx.arc(px,py,12,0,7);ctx.fill();
        ctx.fillStyle="#0a0613";ctx.beginPath();ctx.arc(px,py,4,0,7);ctx.fill();
        if(en.length){
          var best=en[0],bd=1e9;
          for(var i=0;i<en.length;i++){ var d2=Math.hypot(en[i].x-px,en[i].y-py); if(d2<bd){bd=d2;best=en[i];} }
          var ang=Math.atan2(best.y-py,best.x-px);
          ctx.save();ctx.translate(px,py);ctx.rotate(ang);
          rect(0,-3,18,6,"#9b6bff");ctx.restore();
        }
        // HUD bars
        rect(8,8,140,8,"#160a26");
        rect(8,8,140*Math.max(0,hp/maxhp),8,"#46ff9c");
        px_txt("HP "+Math.max(0,Math.ceil(hp))+"/"+maxhp,12,26,7,"#46ff9c","left");
        rect(W-148,8,140,8,"#160a26");
        rect(W-148,8,140*(xp/xpNext),8,"#27e8ff");
        px_txt("LV "+lvl,W-12,26,7,"#27e8ff","right");
        px_txt(""+this.score,W/2,18,11,"#ffd23e");
        px_txt(Math.floor(time)+"s   "+kills+" KILLS",W/2,H-8,7,"#9b8fc7");
        if(state==="up"){
          ctx.save();ctx.globalAlpha=.86;rect(0,0,W,H,"#02030f");ctx.restore();
          px_txt("LEVEL "+lvl+"  —  PICK AN UPGRADE",W/2,52,11,"#ffd23e");
          for(var i=0;i<3;i++){
            var bw=130, bx=18+i*(bw+16), by=98;
            var sl=i===ci;
            rect(bx,by,bw,160,sl?"#1a2350":"#160a26");
            ctx.strokeStyle=sl?"#27e8ff":"#3a2a6b";ctx.lineWidth=2;ctx.strokeRect(bx,by,bw,160);
            px_txt(choices[i].n,bx+bw/2,by+30,9,sl?"#fff":"#9b8fc7");
            var words=choices[i].d.split(" ");
            for(var w=0;w<words.length;w++) px_txt(words[w],bx+bw/2,by+62+w*14,7,"#9b8fc7");
          }
          px_txt("◄ ►  •  A: SELECT",W/2,H-18,8,"#9b8fc7");
        }
      }};
  });

  /* 22. Soccer Stars (Soccer-Legends-style 1v1 knockout tournament) */
  reg("soccer","Soccer-Legends-style 1v1! Left/Right run, Up to jump & header, A to kick. Pick a difficulty and your team, then fight through a 3-round knockout — each match is 90 seconds. Outscore the CPU to advance; win the final to lift the trophy.",
  function(){
    var GY=300, RB=22, RBALL=10, GTOP=196, GL=12;
    var TEAMS=[
      {n:"CRIMSON",c:"#ff3ea5"},{n:"AZURE",c:"#27e8ff"},{n:"LIME",c:"#46ff9c"},
      {n:"GOLD",c:"#ffd23e"},{n:"VIOLET",c:"#9b6bff"},{n:"ORANGE",c:"#ff8a3e"},
      {n:"TEAL",c:"#2ad6c0"},{n:"ROSE",c:"#ff6b9b"}
    ];
    var DIFFS=[
      {n:"EASY",   asp:120, akick:320, react:0.34},
      {n:"NORMAL", asp:170, akick:390, react:0.16},
      {n:"HARD",   asp:215, akick:450, react:0.05}
    ];
    var state="diff", diSel=1, tmSel=0, round=1, opp=null, diff=DIFFS[1];
    var clock=90, ps=0, as=0, golden=false, msg="", msgT=0, win=false, tally=0;
    var P, A, ball, pauseT=0;
    function resetPos(){
      P={x:W*0.32,y:GY-RB,vx:0,vy:0,g:true,face:1,kc:0};
      A={x:W*0.68,y:GY-RB,vx:0,vy:0,g:true,face:-1,kc:0,tmr:0,tx:W/2};
      ball={x:W/2,y:120,vx:rnd(-40,40),vy:0};
    }
    function newMatch(){
      var pool=[]; for(var i=0;i<TEAMS.length;i++) if(i!==tmSel) pool.push(TEAMS[i]);
      opp=pool[ri(0,pool.length-1)];
      clock=90; ps=0; as=0; golden=false; resetPos();
    }
    function bump(pl){
      var dx=ball.x-pl.x, dy=ball.y-pl.y, d=Math.hypot(dx,dy)||1;
      if(d<RB+RBALL){
        var nx=dx/d, ny=dy/d, ov=RB+RBALL-d;
        ball.x+=nx*ov; ball.y+=ny*ov;
        ball.vx=nx*250 + pl.vx*0.85;
        ball.vy=ny*250 + pl.vy*0.5 - 70;
      }
    }
    function kick(pl,dir,pow){
      var dx=ball.x-pl.x, dy=ball.y-pl.y, d=Math.hypot(dx,dy)||1;
      if(d<RB+RBALL+16){ ball.vx=dir*pow + ball.vx*0.2; ball.vy=-280 - Math.random()*60; return true; }
      return false;
    }
    function physics(dt){
      // ---- player ----
      P.vx=0;
      if(IN.held.left){ P.vx=-210; P.face=-1; }
      if(IN.held.right){ P.vx=210; P.face=1; }
      if(IN.held.up && P.g){ P.vy=-560; P.g=false; }
      P.kc-=dt;
      if(IN.edge.action && P.kc<=0){ if(kick(P,1,440)) P.kc=0.3; }
      // ---- AI ----
      A.tmr-=dt;
      if(A.tmr<=0){ A.tmr=diff.react; A.tx=ball.x+ball.vx*0.12; }
      A.vx=0;
      if(A.x < A.tx-8){ A.vx=diff.asp; A.face=1; }
      else if(A.x > A.tx+8){ A.vx=-diff.asp; A.face=-1; }
      if(A.g && ball.y < A.y-30 && Math.abs(ball.x-A.x)<70) { A.vy=-540; A.g=false; }
      A.kc-=dt;
      if(A.kc<=0 && Math.abs(ball.x-A.x)<RB+RBALL+10){ if(kick(A,-1,diff.akick)) A.kc=0.3; }
      // integrate players
      [P,A].forEach(function(pl){
        pl.vy+=1500*dt; pl.x+=pl.vx*dt; pl.y+=pl.vy*dt;
        if(pl.y>=GY-RB){ pl.y=GY-RB; pl.vy=0; pl.g=true; }
        pl.x=Math.max(RB,Math.min(W-RB,pl.x));
      });
      // ball
      ball.vy+=900*dt; ball.x+=ball.vx*dt; ball.y+=ball.vy*dt;
      bump(P); bump(A);
      // ground
      if(ball.y>GY-RBALL){ ball.y=GY-RBALL; ball.vy*=-0.55; ball.vx*=0.86; if(Math.abs(ball.vy)<40)ball.vy=0; }
      // ceiling
      if(ball.y<RBALL){ ball.y=RBALL; ball.vy*=-0.6; }
      // goals / side walls
      if(ball.x-RBALL<GL){
        if(ball.y>GTOP) return "A";          // CPU scores in left goal
        ball.x=GL+RBALL; ball.vx*=-0.7;
      }
      if(ball.x+RBALL>W-GL){
        if(ball.y>GTOP) return "P";          // player scores in right goal
        ball.x=W-GL-RBALL; ball.vx*=-0.7;
      }
      return "";
    }
    function drawField(){
      var g=ctx.createLinearGradient(0,0,0,H);
      g.addColorStop(0,"#0a1a30");g.addColorStop(1,"#06120a");
      ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
      rect(0,GY,W,H-GY,"#13351f");
      ctx.strokeStyle="#46ff9c33";ctx.lineWidth=2;
      ctx.beginPath();ctx.moveTo(0,GY);ctx.lineTo(W,GY);ctx.stroke();
      ctx.setLineDash([6,10]);ctx.beginPath();ctx.moveTo(W/2,GY);ctx.lineTo(W/2,H);ctx.stroke();ctx.setLineDash([]);
      // goals
      function goal(side){
        var x0=side<0?0:W-GL;
        ctx.strokeStyle="#f3ecff";ctx.lineWidth=3;
        ctx.strokeRect(x0,GTOP,GL,GY-GTOP);
        ctx.strokeStyle="#ffffff33";ctx.lineWidth=1;
        for(var yy=GTOP;yy<GY;yy+=8){ctx.beginPath();ctx.moveTo(x0,yy);ctx.lineTo(x0+GL,yy);ctx.stroke();}
      }
      goal(-1); goal(1);
    }
    function drawPlayer(pl,col){
      ctx.save();ctx.globalAlpha=.3;ctx.fillStyle="#000";
      ctx.beginPath();ctx.ellipse(pl.x,GY-2,18,5,0,0,7);ctx.fill();ctx.restore();
      rect(pl.x-4,pl.y+8,3,RB-8,"#1a1a1a");          // legs
      rect(pl.x+2,pl.y+8,3,RB-8,"#1a1a1a");
      rect(pl.x-12,pl.y-10,24,24,col);               // body
      ctx.fillStyle=col;ctx.beginPath();ctx.arc(pl.x,pl.y-20,12,0,7);ctx.fill();  // head
      ctx.fillStyle="#0a0613";ctx.beginPath();ctx.arc(pl.x+pl.face*5,pl.y-22,2.5,0,7);ctx.fill();
    }
    return { score:0, over:false,
      update:function(dt){
        this.score=tally;
        if(msgT>0)msgT-=dt;
        if(state==="diff"){
          if(IN.edge.left)  diSel=(diSel+2)%3;
          if(IN.edge.right) diSel=(diSel+1)%3;
          if(IN.edge.action){ diff=DIFFS[diSel]; state="team"; }
          return;
        }
        if(state==="team"){
          if(IN.edge.left)  tmSel=(tmSel+7)%8;
          if(IN.edge.right) tmSel=(tmSel+1)%8;
          if(IN.edge.up)    tmSel=(tmSel+4)%8;
          if(IN.edge.down)  tmSel=(tmSel+4)%8;
          if(IN.edge.action){ newMatch(); state="bracket"; }
          return;
        }
        if(state==="bracket"){
          if(IN.edge.action){ state="play"; }
          return;
        }
        if(state==="result"){
          if(IN.edge.action){
            if(win){ if(round>=3){ tally+=600; state="champion"; } else { round++; newMatch(); state="bracket"; } }
            else { this.over=true; }
          }
          return;
        }
        if(state==="champion"){
          if(IN.edge.action){ this.over=true; }
          return;
        }
        if(state==="goal"){
          pauseT-=dt; if(pauseT<=0){ resetPos(); state="play"; }
          return;
        }
        // ---- play ----
        if(!golden){ clock-=dt; if(clock<0)clock=0; }
        var who=physics(dt);
        if(who==="P"){ ps++; tally+=30; msg="GOAL!"; msgT=1.4; pauseT=1.3; state="goal";
          if(golden){ win=true; tally+=200; state="result"; } }
        else if(who==="A"){ as++; msg="CPU SCORES"; msgT=1.4; pauseT=1.3; state="goal";
          if(golden){ win=false; state="result"; } }
        if(state==="play" && clock<=0){
          if(ps>as){ win=true; tally+=200; state="result"; }
          else if(as>ps){ win=false; state="result"; }
          else { golden=true; msg="GOLDEN GOAL"; msgT=2.0; }
        }
      },
      draw:function(){
        if(state==="diff"){
          clear("#0a1a30","#06120a");
          px_txt("SOCCER STARS",W/2,60,16,"#46ff9c");
          px_txt("SELECT DIFFICULTY",W/2,110,9,"#9b8fc7");
          for(var i=0;i<3;i++){
            var bw=120,bx=20+i*(bw+14),by=150,sl=i===diSel;
            rect(bx,by,bw,90,sl?"#1a3a20":"#160a26");
            ctx.strokeStyle=sl?"#46ff9c":"#3a2a6b";ctx.lineWidth=2;ctx.strokeRect(bx,by,bw,90);
            px_txt(DIFFS[i].n,bx+bw/2,by+50,11,sl?"#fff":"#9b8fc7");
          }
          px_txt("◄ ►  •  A: CONFIRM",W/2,H-26,8,"#9b8fc7");
          return;
        }
        if(state==="team"){
          clear("#0a1a30","#06120a");
          px_txt("SELECT YOUR TEAM",W/2,40,11,"#46ff9c");
          for(var i=0;i<8;i++){
            var c=i%4,r=Math.floor(i/4),bw=104,bh=92;
            var bx=12+c*(bw+8),by=70+r*(bh+10),sl=i===tmSel;
            rect(bx,by,bw,bh,sl?"#1a2350":"#160a26");
            ctx.strokeStyle=sl?"#27e8ff":"#3a2a6b";ctx.lineWidth=2;ctx.strokeRect(bx,by,bw,bh);
            ctx.fillStyle=TEAMS[i].c;ctx.beginPath();ctx.arc(bx+bw/2,by+34,18,0,7);ctx.fill();
            px_txt(TEAMS[i].n,bx+bw/2,by+72,7,sl?"#fff":"#9b8fc7");
          }
          px_txt("◄ ► ▲ ▼  •  A: CONFIRM",W/2,H-16,8,"#9b8fc7");
          return;
        }
        if(state==="bracket"){
          clear("#0a1a30","#06120a");
          var rn=["","QUARTER-FINAL","SEMI-FINAL","FINAL"][round]||("ROUND "+round);
          px_txt(rn,W/2,70,12,"#ffd23e");
          ctx.fillStyle=TEAMS[tmSel].c;ctx.beginPath();ctx.arc(W/2-90,150,26,0,7);ctx.fill();
          ctx.fillStyle=opp.c;ctx.beginPath();ctx.arc(W/2+90,150,26,0,7);ctx.fill();
          px_txt(TEAMS[tmSel].n,W/2-90,200,8,"#fff");
          px_txt("VS",W/2,156,12,"#ff3ea5");
          px_txt(opp.n,W/2+90,200,8,"#fff");
          px_txt("90 SECONDS  ·  "+diff.n,W/2,240,8,"#9b8fc7");
          px_txt("PRESS A TO KICK OFF",W/2,H-30,9,"#46ff9c");
          return;
        }
        // play / goal / result / champion all show the pitch
        drawField();
        drawPlayer(P,TEAMS[tmSel].c);
        drawPlayer(A,opp.c);
        ctx.fillStyle="#fff";ctx.beginPath();ctx.arc(ball.x,ball.y,RBALL,0,7);ctx.fill();
        ctx.fillStyle="#0a0613";ctx.beginPath();ctx.arc(ball.x,ball.y,3,0,7);ctx.fill();
        // scoreboard
        rect(W/2-70,4,140,22,"#02030f");
        px_txt(TEAMS[tmSel].n.slice(0,4)+" "+ps+"-"+as+" "+opp.n.slice(0,4),W/2,19,8,"#f3ecff");
        px_txt(golden?"GG":Math.ceil(clock)+"\"",W/2,40,9,golden?"#ff3ea5":"#ffd23e");
        if(msgT>0) px_txt(msg,W/2,H/2-30,14,msg.indexOf("CPU")>=0?"#ff8a8a":"#ffd23e");
        if(state==="result"){
          ctx.save();ctx.globalAlpha=.85;rect(0,0,W,H,"#02030f");ctx.restore();
          px_txt(win?"YOU WIN!":"ELIMINATED",W/2,140,16,win?"#46ff9c":"#ff3ea5");
          px_txt(ps+" - "+as,W/2,180,12,"#fff");
          px_txt(win?"PRESS A TO CONTINUE":"PRESS A TO FINISH",W/2,230,8,"#9b8fc7");
        }
        if(state==="champion"){
          ctx.save();ctx.globalAlpha=.9;rect(0,0,W,H,"#02030f");ctx.restore();
          px_txt("CHAMPIONS!",W/2,120,18,"#ffd23e");
          ctx.font="44px serif";ctx.textAlign="center";ctx.fillStyle="#fff";ctx.fillText("🏆",W/2,185);
          px_txt(TEAMS[tmSel].n+" WIN THE CUP",W/2,225,9,TEAMS[tmSel].c);
          px_txt("PRESS A",W/2,265,9,"#46ff9c");
        }
      }};
  });

  /* 23. Pong Cup (16-team knockout, best-of-7 series each round) */
  reg("pongcup","Tournament Pong! Pick your team and battle a 16-team knockout bracket — and watch the WHOLE bracket fill in (the other matches are simulated). Every round is a BEST-OF-7 series (first to 4 game wins); each game is first to 5 points. Up/Down move your paddle, A serves. The CPU gets tougher every round — win the final to take the cup.",
  function(){
    var PH=64, PW=10, GP=5, NEED=4;
    var TEAMS=[
      {n:"ACES",c:"#27e8ff"},{n:"BOLTS",c:"#ffd23e"},{n:"COBRAS",c:"#46ff9c"},{n:"DRAGONS",c:"#ff3ea5"},
      {n:"EAGLES",c:"#9b6bff"},{n:"FALCONS",c:"#ff8a3e"},{n:"GHOSTS",c:"#2ad6c0"},{n:"HAWKS",c:"#ff6b9b"},
      {n:"IONS",c:"#7dd3ff"},{n:"JOKERS",c:"#c77dff"},{n:"KINGS",c:"#ffe27d"},{n:"LASERS",c:"#7dffb0"},
      {n:"MAGMA",c:"#ff5e5e"},{n:"NOVA",c:"#5e9bff"},{n:"OMEGA",c:"#b0ff5e"},{n:"PULSE",c:"#ff5ec4"}
    ];
    var ROUNDS=["","ROUND OF 16","QUARTER-FINAL","SEMI-FINAL","FINAL"];
    var state="team", tmSel=0, round=1, tally=0;
    var roundTeams=[], seriesResults=[], playerSlot=0, oppIdx=0, champIdx=-1;
    var sYou=0, sOpp=0, pPts=0, aPts=0, win=false;
    var py=H/2-PH/2, ax=W-24, ay=H/2-PH/2, bx=W/2, by=H/2, bvx=0, bvy=0, rallies=0, served=false;
    function aiSpd(){ return (250+round*38) * diffMult(); }
    function serve(){ bx=W/2; by=H/2; var sp=210+round*8+rallies*5; bvx=-sp; bvy=rnd(-0.3,0.3)*sp; served=true; }
    function newGame(){ pPts=0; aPts=0; py=H/2-PH/2; ay=H/2-PH/2; served=false; bvx=0; bvy=0; bx=W/2; by=H/2; rallies=0; }
    // resolve a round: returns winners + per-match [winnerGames, loserGames]
    function resolveRound(arr,pmi,forced,gw,gl){
      var wins=[], scs=[];
      for(var j=0;j*2<arr.length;j++){
        var a=arr[2*j], b=arr[2*j+1];
        if(j===pmi && pmi>=0){ wins.push(forced); scs.push([gw,gl]); }
        else { wins.push(Math.random()<0.5?a:b); scs.push([4,ri(0,3)]); }
      }
      return {w:wins, s:scs};
    }
    function newCup(){
      var others=[]; for(var i=0;i<16;i++) if(i!==tmSel) others.push(i);
      for(var s=others.length-1;s>0;s--){var t=ri(0,s),tmp=others[s];others[s]=others[t];others[t]=tmp;}
      roundTeams=[[tmSel].concat(others)]; seriesResults=[];
      round=1; playerSlot=0; oppIdx=roundTeams[0][1]; champIdx=-1; sYou=0; sOpp=0; newGame();
    }
    function advanceWin(){
      tally+=200;
      var pmi=Math.floor(playerSlot/2);
      var r=resolveRound(roundTeams[round-1],pmi,tmSel,sYou,sOpp);
      roundTeams[round]=r.w; seriesResults[round]=r.s;
      playerSlot=pmi;
      if(round>=4){ tally+=800; champIdx=tmSel; state="champion"; }
      else { round++; oppIdx=roundTeams[round-1][playerSlot^1]; sYou=0; sOpp=0; newGame(); state="bracketview"; }
    }
    function loseOut(){
      var pmi=Math.floor(playerSlot/2);
      var r0=resolveRound(roundTeams[round-1],pmi,oppIdx,sOpp,sYou);
      roundTeams[round]=r0.w; seriesResults[round]=r0.s;
      var r=round;
      while(roundTeams[r].length>1){
        var rr=resolveRound(roundTeams[r],-1,-1,0,0);
        roundTeams[r+1]=rr.w; seriesResults[r+1]=rr.s; r++;
      }
      champIdx=roundTeams[r][0];
      state="result";
    }
    // two-sided bracket position for round r (0..4), global index k
    function posOf(r,k){
      var colW=W/9, top=56, bot=H-10, rangeH=bot-top;
      if(r===4){ var ch0=18, cy0=top+rangeH/2, slot4=4;
        return {x:slot4*colW+1,y:cy0-ch0/2,w:colW-3,h:ch0,cx:slot4*colW+1+(colW-3)/2,cy:cy0}; }
      var per=[8,4,2,1][r], side=k<per?0:1, i=side===0?k:k-per, N=per;
      var slot=side===0?[0,1,2,3][r]:[8,7,6,5][r];
      var chH=Math.min(18,rangeH/N-2), cy=top+(i+0.5)*rangeH/N, x=slot*colW+1, w=colW-3;
      return {x:x,y:cy-chH/2,w:w,h:chH,cx:x+w/2,cy:cy};
    }
    function teamChip(c,idx,ol,score){
      var t=TEAMS[idx];
      rect(c.x,c.y,c.w,c.h, idx===tmSel?"#16233f":"#100a1c");
      ctx.fillStyle=t.c; ctx.fillRect(c.x,c.y,4,c.h);
      var nm = score ? t.n.slice(0,4) : t.n.slice(0,6);
      px_txt(nm, c.x+8, c.y+c.h-5, score?6:7, idx===tmSel?"#fff":"#e6dcff","left");
      if(score) px_txt(score, c.x+c.w-3, c.y+c.h-5, 5, "#ffd23e","right");
      if(ol){ ctx.strokeStyle=ol;ctx.lineWidth=1.5;ctx.strokeRect(c.x,c.y,c.w,c.h); }
    }
    function drawBracket(){
      var colW=W/9, labL=["R16","QF","SF","F"];
      for(var c=0;c<4;c++){ px_txt(labL[c],c*colW+colW/2,50,6,"#7da3c7"); px_txt(labL[c],(8-c)*colW+colW/2,50,6,"#7da3c7"); }
      px_txt("CUP",4*colW+colW/2,50,6,"#ffd23e");
      // connectors (child to its two parents)
      ctx.strokeStyle="rgba(155,107,255,.28)";ctx.lineWidth=1;
      for(var r=1;r<roundTeams.length;r++){
        for(var k=0;k<roundTeams[r].length;k++){
          var cc=posOf(r,k), pa=posOf(r-1,2*k), pb=posOf(r-1,2*k+1);
          ctx.beginPath();ctx.moveTo(cc.cx,cc.cy);ctx.lineTo(pa.cx,pa.cy);
          ctx.moveTo(cc.cx,cc.cy);ctx.lineTo(pb.cx,pb.cy);ctx.stroke();
        }
      }
      // chips
      for(var rr=0;rr<roundTeams.length;rr++){
        for(var kk=0;kk<roundTeams[rr].length;kk++){
          var co=posOf(rr,kk), idx=roundTeams[rr][kk];
          var ol=idx===tmSel?"#27e8ff":(rr===4?"#ffd23e":null);
          var sc=(rr>=1&&seriesResults[rr])?(seriesResults[rr][kk][0]+"-"+seriesResults[rr][kk][1]):"";
          teamChip(co,idx,ol,sc);
        }
      }
    }
    return { score:0, over:false,
      update:function(dt){
        this.score=tally;
        if(state==="team"){
          if(IN.edge.left)  tmSel=(tmSel+15)%16;
          if(IN.edge.right) tmSel=(tmSel+1)%16;
          if(IN.edge.up)    tmSel=(tmSel+12)%16;
          if(IN.edge.down)  tmSel=(tmSel+4)%16;
          if(IN.edge.action){ newCup(); state="bracketview"; }
          return;
        }
        if(state==="bracketview"){ if(IN.edge.action){ newGame(); state="play"; } return; }
        if(state==="result"){ if(IN.edge.action) this.over=true; return; }
        if(state==="champion"){ if(IN.edge.action) this.over=true; return; }
        // ---- play ----
        if(!served){ if(IN.edge.action) serve(); return; }
        if(IN.held.up)   py-=340*dt;
        if(IN.held.down) py+=340*dt;
        py=Math.max(6,Math.min(H-6-PH,py));
        var sp=aiSpd();
        var gain = bvx>0 ? 7*diffMult() : (DA_DIFF==="easy" ? 1.4 : DA_DIFF==="hard" ? 6 : 3.5);
        var tgt=by-PH/2-ay, mv=Math.max(-sp,Math.min(sp,tgt*gain));
        ay+=mv*dt; ay=Math.max(6,Math.min(H-6-PH,ay));
        bx+=bvx*dt; by+=bvy*dt;
        if(by<8){by=8;bvy=Math.abs(bvy);} if(by>H-8){by=H-8;bvy=-Math.abs(bvy);}
        if(bvx<0 && bx-6<=24 && bx-6>=6 && by+6>=py && by-6<=py+PH){
          bvx=Math.abs(bvx)*1.05; bx=30; bvy+=((by-(py+PH/2))/(PH/2))*200; rallies++;
        }
        if(bvx>0 && bx+6>=ax && bx+6<=ax+PW+6 && by+6>=ay && by-6<=ay+PH){
          bvx=-Math.abs(bvx)*1.05; bx=ax-6; bvy+=((by-(ay+PH/2))/(PH/2))*180;
        }
        bvy=Math.max(-380,Math.min(380,bvy));
        var scored=false;
        if(bx<0){ aPts++; scored=true; }
        if(bx>W){ pPts++; tally+=10; scored=true; }
        if(scored){
          if(pPts>=GP){ sYou++; if(sYou>=NEED){ win=true; advanceWin(); } else newGame(); }
          else if(aPts>=GP){ sOpp++; if(sOpp>=NEED){ win=false; loseOut(); } else newGame(); }
          else serve();
        }
      },
      draw:function(){
        if(state==="team"){
          clear("#02030f","#0a0613");
          px_txt("PONG CUP",W/2,40,16,"#27e8ff");
          px_txt("PICK YOUR TEAM",W/2,72,8,"#9b8fc7");
          for(var i=0;i<16;i++){
            var c=i%4,r=Math.floor(i/4),bw=104,bh=52;
            var bx0=12+c*(bw+8),by0=88+r*(bh+8),sl=i===tmSel;
            rect(bx0,by0,bw,bh,sl?"#1a2350":"#160a26");
            ctx.strokeStyle=sl?"#27e8ff":"#3a2a6b";ctx.lineWidth=2;ctx.strokeRect(bx0,by0,bw,bh);
            ctx.fillStyle=TEAMS[i].c;ctx.fillRect(bx0+8,by0+18,16,16);
            px_txt(TEAMS[i].n,bx0+30,by0+30,7,sl?"#fff":"#9b8fc7","left");
          }
          px_txt("◄ ► ▲ ▼  •  A: CONFIRM",W/2,H-14,8,"#9b8fc7");
          return;
        }
        if(state==="bracketview"){
          clear("#02030f","#0a0613");
          px_txt("PONG CUP — "+(ROUNDS[round]||""),W/2,18,8,"#ffd23e");
          drawBracket();
          px_txt("YOU: "+TEAMS[tmSel].n+"  VS  "+TEAMS[oppIdx].n+"   SERIES "+sYou+"-"+sOpp,W/2,H-16,6,"#fff");
          px_txt("A: PLAY GAME "+(sYou+sOpp+1)+" (BEST OF 7)",W/2,H-6,6,"#46ff9c");
          return;
        }
        if(state==="result"||state==="champion"){
          clear("#02030f","#0a0613");
          drawBracket();
          ctx.save();ctx.globalAlpha=.82;rect(40,120,W-80,110,"#02030f");ctx.restore();
          ctx.strokeStyle=state==="champion"?"#ffd23e":"#ff3ea5";ctx.lineWidth=2;ctx.strokeRect(40,120,W-80,110);
          if(state==="champion"){
            px_txt("YOU WIN THE CUP!",W/2,150,12,"#ffd23e");
            px_txt(TEAMS[tmSel].n+" — CHAMPIONS",W/2,178,8,TEAMS[tmSel].c);
          } else {
            px_txt("KNOCKED OUT",W/2,150,12,"#ff3ea5");
            px_txt("CHAMPION: "+TEAMS[champIdx].n,W/2,178,9,TEAMS[champIdx].c);
          }
          px_txt("PRESS A",W/2,212,8,"#9b8fc7");
          return;
        }
        // ---- court ----
        clear("#02030f","#0a0613");
        ctx.strokeStyle="#27e8ff44";ctx.setLineDash([8,12]);ctx.lineWidth=3;
        ctx.beginPath();ctx.moveTo(W/2,30);ctx.lineTo(W/2,H);ctx.stroke();ctx.setLineDash([]);
        rect(14,py,PW,PH,TEAMS[tmSel].c);
        rect(ax,ay,PW,PH,TEAMS[oppIdx].c);
        rect(bx-6,by-6,12,12,"#ffd23e");
        px_txt(TEAMS[tmSel].n+" "+pPts,W/2-44,20,8,TEAMS[tmSel].c,"right");
        px_txt(pPts+"-"+aPts,W/2,20,9,"#fff");
        px_txt(aPts+" "+TEAMS[oppIdx].n,W/2+44,20,8,TEAMS[oppIdx].c,"left");
        px_txt("SERIES "+sYou+"-"+sOpp+"  •  "+(ROUNDS[round]||""),W/2,H-8,7,"#9b8fc7");
        if(!served) px_txt("PRESS A TO SERVE",W/2,H/2-30,9,"#46ff9c");
      }};
  });

  /* 25. Diner Empire (offline restaurant tycoon with persistent save + fake online world) */
  reg("diner",
  "Restaurant tycoon — progress saves. You have $50K. Pick a LOCATION on the map ($1K dump → $2M villa), choose a CUISINE GENRE, NAME your place via the on-screen keyboard (or hit RANDOM), then run SERVICE: customers order from your menu, you cook a multi-station minigame with real food sprites — better cooking = 5★ reviews + tips. Spend earnings on supplies, trucks, marketing, upgrades; visit the WORLD screen to buy from other (simulated) restaurants. Grow your chain.",
  function(){
    var SAVE_KEY="da_rest_save";

    var LOCS=[
      {n:"Abandoned Gas Station", p:1000,    dens:0.35, lux:0, desc:"A dump. Brave eaters only."},
      {n:"Food Truck Stop",       p:5000,    dens:0.70, lux:0, desc:"Truckers want fast & cheap."},
      {n:"Strip Mall Corner",     p:20000,   dens:0.90, lux:1, desc:"Steady weekday foot traffic."},
      {n:"Hipster Pop-up",        p:40000,   dens:1.00, lux:2, desc:"Edgy crowd, will post photos."},
      {n:"Suburban Plaza",        p:80000,   dens:1.10, lux:2, desc:"Families & casual diners."},
      {n:"College Cafeteria",     p:150000,  dens:1.60, lux:1, desc:"Huge volume, low expectations."},
      {n:"Downtown Storefront",   p:250000,  dens:1.40, lux:2, desc:"Busy lunch crowd, pickier."},
      {n:"Airport Terminal",      p:450000,  dens:1.70, lux:3, desc:"Captive travellers, premium prices."},
      {n:"Trendy Loft District",  p:600000,  dens:1.30, lux:3, desc:"Hip foodies, look-conscious."},
      {n:"Casino Restaurant",     p:850000,  dens:1.25, lux:4, desc:"High rollers, big tippers."},
      {n:"Waterfront Bistro",     p:1100000, dens:1.20, lux:4, desc:"Tourists tip well, expect quality."},
      {n:"Hills Villa",           p:2000000, dens:0.90, lux:5, desc:"Elite clientele. Very high standards."}
    ];

    var GENRES=[
      {id:"american", n:"AMERICAN",  c:"#ff3ea5", menu:["burger","sandwich","cake","coffee"]},
      {id:"italian",  n:"ITALIAN",   c:"#46ff9c", menu:["pizza","pasta","salad","cake"]},
      {id:"japanese", n:"JAPANESE",  c:"#27e8ff", menu:["sushi","ramen","soup"]},
      {id:"mexican",  n:"MEXICAN",   c:"#ffd23e", menu:["taco","burger","soup","coffee"]},
      {id:"french",   n:"FRENCH",    c:"#c77dff", menu:["steak","soup","cake","coffee"]},
      {id:"fastfood", n:"FAST FOOD", c:"#ff8a3e", menu:["burger","pizza","sandwich","coffee"]},
      {id:"cafe",     n:"CAFE",      c:"#7dffb0", menu:["coffee","toast","sandwich","cake","salad"]},
      {id:"seafood",  n:"SEAFOOD",   c:"#5e9bff", menu:["lobster","soup","salad","sushi"]}
    ];

    var STATIONS={
      pour:  {type:"timing", label:"POUR",   lo:0.50, hi:0.85, spd:0.45, icon:"coffeepot"},
      prep:  {type:"rhythm", label:"PREP",   taps:4,  spd:0.34, zoneW:0.05, icon:"board"},
      chop:  {type:"rhythm", label:"CHOP",   taps:5,  spd:0.42, zoneW:0.045, icon:"knife"},
      season:{type:"rhythm", label:"SEASON", taps:3,  spd:0.36, zoneW:0.055, icon:"salt"},
      cook:  {type:"timing", label:"COOK",   lo:0.55, hi:0.78, spd:0.50, icon:"stove"},
      fry:   {type:"timing", label:"FRY",    lo:0.60, hi:0.78, spd:0.55, icon:"pan"},
      boil:  {type:"timing", label:"BOIL",   lo:0.50, hi:0.82, spd:0.40, icon:"pot"},
      slice: {type:"prec",   label:"SLICE",  spd:0.55, zone:0.08, icon:"knife"},
      plate: {type:"prec",   label:"PLATE",  spd:0.45, zone:0.12, icon:"plate"}
    };

    function drawTool(name,x,y,s){
      if(name==="stove"){
        rect(x,y+s*0.6,s,s*0.4,"#1a1a1a");
        rect(x+s*0.08,y+s*0.45,s*0.36,s*0.18,"#222");
        rect(x+s*0.56,y+s*0.45,s*0.36,s*0.18,"#222");
        fillC("#ff8a3e");
        ctx.beginPath();ctx.moveTo(x+s*0.18,y+s*0.45);
        ctx.lineTo(x+s*0.26,y+s*0.28);ctx.lineTo(x+s*0.34,y+s*0.42);ctx.lineTo(x+s*0.4,y+s*0.45);
        ctx.closePath();ctx.fill();
        fillC("#ffd23e");
        ctx.beginPath();ctx.arc(x+s*0.26,y+s*0.38,3,0,7);ctx.fill();
        fillC("#444");
        ctx.beginPath();ctx.arc(x+s*0.3,y+s*0.85,3,0,7);ctx.fill();
        ctx.beginPath();ctx.arc(x+s*0.7,y+s*0.85,3,0,7);ctx.fill();
      } else if(name==="pan"){
        fillC("#222");
        ctx.beginPath();ctx.ellipse(x+s*0.45,y+s*0.65,s*0.34,s*0.1,0,0,7);ctx.fill();
        fillC("#ffd23e88");
        ctx.beginPath();ctx.ellipse(x+s*0.45,y+s*0.6,s*0.3,s*0.07,0,0,7);ctx.fill();
        rect(x+s*0.78,y+s*0.6,s*0.22,s*0.06,"#444");
        // sizzle dots
        fillC("#ffaa3e");
        ctx.beginPath();ctx.arc(x+s*0.4,y+s*0.55,2,0,7);ctx.fill();
        ctx.beginPath();ctx.arc(x+s*0.55,y+s*0.58,2,0,7);ctx.fill();
      } else if(name==="pot"){
        rect(x+s*0.2,y+s*0.45,s*0.6,s*0.38,"#444");
        rect(x+s*0.18,y+s*0.4,s*0.64,s*0.08,"#555");
        rect(x+s*0.05,y+s*0.5,s*0.13,s*0.05,"#333");
        rect(x+s*0.82,y+s*0.5,s*0.13,s*0.05,"#333");
        fillC("#fff");
        for(var i=0;i<3;i++){
          ctx.beginPath();ctx.arc(x+s*(0.32+i*0.18),y+s*0.36,3+i,0,7);ctx.fill();
        }
      } else if(name==="knife"){
        rect(x+s*0.05,y+s*0.7,s*0.9,s*0.13,"#8a5a3a");
        rect(x+s*0.05,y+s*0.7,s*0.9,s*0.03,"#aa7a4a");
        fillC("#ccc");
        ctx.beginPath();
        ctx.moveTo(x+s*0.15,y+s*0.55);
        ctx.lineTo(x+s*0.7,y+s*0.48);
        ctx.lineTo(x+s*0.74,y+s*0.6);
        ctx.lineTo(x+s*0.2,y+s*0.65);
        ctx.closePath();ctx.fill();
        rect(x+s*0.7,y+s*0.48,s*0.2,s*0.13,"#5a3a1a");
      } else if(name==="board"){
        rect(x+s*0.05,y+s*0.55,s*0.9,s*0.3,"#8a5a3a");
        rect(x+s*0.05,y+s*0.55,s*0.9,s*0.04,"#aa7a4a");
        // chopped veg
        fillC("#46ff9c");
        for(var i=0;i<4;i++){ rect(x+s*(0.15+i*0.18),y+s*0.65,s*0.06,s*0.06,"#46ff9c"); }
        fillC("#ff8a3e");
        for(var i=0;i<3;i++){ rect(x+s*(0.2+i*0.22),y+s*0.74,s*0.06,s*0.06,"#ff8a3e"); }
      } else if(name==="salt"){
        fillC("#ccc");
        ctx.beginPath();
        ctx.moveTo(x+s*0.32,y+s*0.45);
        ctx.bezierCurveTo(x+s*0.26,y+s*0.45,x+s*0.26,y+s*0.85,x+s*0.32,y+s*0.85);
        ctx.lineTo(x+s*0.68,y+s*0.85);
        ctx.bezierCurveTo(x+s*0.74,y+s*0.85,x+s*0.74,y+s*0.45,x+s*0.68,y+s*0.45);
        ctx.closePath();ctx.fill();
        rect(x+s*0.32,y+s*0.4,s*0.36,s*0.07,"#444");
        fillC("#222");
        ctx.beginPath();ctx.arc(x+s*0.42,y+s*0.43,1.2,0,7);ctx.fill();
        ctx.beginPath();ctx.arc(x+s*0.5,y+s*0.43,1.2,0,7);ctx.fill();
        ctx.beginPath();ctx.arc(x+s*0.58,y+s*0.43,1.2,0,7);ctx.fill();
        // sprinkle particles
        fillC("#fff");
        for(var i=0;i<6;i++){
          var sx=x+s*0.5+Math.cos(i*1.3)*8;
          var sy=y+s*0.3-i*1.5+((sizzleT*60+i*7)%10);
          ctx.beginPath();ctx.arc(sx,sy,1.2,0,7);ctx.fill();
        }
      } else if(name==="plate"){
        fillC("#aaa");
        ctx.beginPath();ctx.ellipse(x+s*0.5,y+s*0.72,s*0.42,s*0.1,0,0,7);ctx.fill();
        fillC("#fff");
        ctx.beginPath();ctx.ellipse(x+s*0.5,y+s*0.66,s*0.32,s*0.07,0,0,7);ctx.fill();
        // spoon
        fillC("#ccc");
        ctx.beginPath();ctx.ellipse(x+s*0.8,y+s*0.4,s*0.1,s*0.05,0.5,0,7);ctx.fill();
        rect(x+s*0.7,y+s*0.42,s*0.15,s*0.025,"#ccc");
      } else if(name==="coffeepot"){
        fillC("#3a2a1a");
        ctx.beginPath();
        ctx.moveTo(x+s*0.28,y+s*0.42);
        ctx.lineTo(x+s*0.22,y+s*0.82);
        ctx.lineTo(x+s*0.66,y+s*0.82);
        ctx.lineTo(x+s*0.72,y+s*0.42);
        ctx.closePath();ctx.fill();
        ctx.strokeStyle="#3a2a1a";ctx.lineWidth=3;
        ctx.beginPath();ctx.arc(x+s*0.78,y+s*0.6,s*0.12,-Math.PI*0.4,Math.PI*0.4);ctx.stroke();
        fillC("#3a2a1a");
        ctx.beginPath();
        ctx.moveTo(x+s*0.22,y+s*0.46);
        ctx.lineTo(x+s*0.08,y+s*0.4);
        ctx.lineTo(x+s*0.1,y+s*0.52);
        ctx.lineTo(x+s*0.24,y+s*0.56);
        ctx.fill();
        rect(x+s*0.28,y+s*0.42,s*0.44,s*0.04,"#5a4a2a");
      }
    }

    var ITEMS=[
      {id:"coffee",  n:"COFFEE",   cost:0, sell:3,  unlock:0,     steps:["pour"]},
      {id:"toast",   n:"TOAST",    cost:1, sell:4,  unlock:0,     steps:["cook"]},
      {id:"sandwich",n:"SANDWICH", cost:2, sell:7,  unlock:200,   steps:["prep","plate"]},
      {id:"salad",   n:"SALAD",    cost:2, sell:9,  unlock:250,   steps:["chop","plate"]},
      {id:"taco",    n:"TACOS",    cost:2, sell:8,  unlock:200,   steps:["prep","plate"]},
      {id:"soup",    n:"SOUP",     cost:2, sell:8,  unlock:250,   steps:["chop","boil"]},
      {id:"burger",  n:"BURGER",   cost:3, sell:11, unlock:800,   steps:["prep","fry","plate"]},
      {id:"pizza",   n:"PIZZA",    cost:5, sell:16, unlock:1200,  steps:["prep","cook","slice"]},
      {id:"pasta",   n:"PASTA",    cost:4, sell:14, unlock:1000,  steps:["boil","plate","season"]},
      {id:"ramen",   n:"RAMEN",    cost:3, sell:13, unlock:900,   steps:["chop","boil","plate"]},
      {id:"cake",    n:"CAKE",     cost:4, sell:12, unlock:800,   steps:["prep","cook","plate"]},
      {id:"sushi",   n:"SUSHI",    cost:7, sell:24, unlock:3500,  steps:["slice","season","plate"]},
      {id:"steak",   n:"STEAK",    cost:10,sell:36, unlock:6000,  steps:["season","fry","plate"]},
      {id:"lobster", n:"LOBSTER",  cost:18,sell:65, unlock:15000, steps:["boil","slice","plate"]}
    ];

    var EMPLOYEES=[
      {id:"linecook", n:"LINE COOK", cost:8000,  desc:"One cook also serves a 2nd customer"},
      {id:"waiter",   n:"WAITER",    cost:5000,  desc:"Patience +66% (15s before walkoff)"},
      {id:"host",     n:"HOST",      cost:6000,  desc:"+25% customers per day"},
      {id:"marketer", n:"MARKETER",  cost:12000, desc:"+0.3 review boost"},
      {id:"manager",  n:"MANAGER",   cost:10000, desc:"Earns passive income while you work elsewhere"}
    ];

    // Interior decor — pure visual + customer flow boost
    function decCarpet(){
      rect(48,196,W-96,24,"#7a1a3a");
      rect(52,200,W-104,16,"#aa2a4a");
      for(var i=0;i<7;i++) rect(56+i*52,206,28,4,"#cd3a5a");
    }
    function decTables(){
      for(var i=0;i<3;i++){
        var tx=110+i*120, ty=178;
        rect(tx-18,ty,36,5,"#3a2a1a");
        rect(tx-3,ty+5,6,16,"#5a4a3a");
        rect(tx-25,ty+9,8,4,"#5a3a3a");
        rect(tx+17,ty+9,8,4,"#5a3a3a");
        rect(tx-25,ty+13,8,9,"#3a2a3a");
        rect(tx+17,ty+13,8,9,"#3a2a3a");
      }
    }
    function decPlants(){
      [[26,176],[W-44,176]].forEach(function(p){
        rect(p[0],p[1],18,18,"#5a3a2a");
        rect(p[0]+2,p[1]+2,14,4,"#7a4a2a");
        fillC("#2a6a3a");
        ctx.beginPath();ctx.arc(p[0]+9,p[1]-3,14,0,7);ctx.fill();
        fillC("#4a8a4a");
        ctx.beginPath();ctx.arc(p[0]+5,p[1]-7,7,0,7);ctx.fill();
        ctx.beginPath();ctx.arc(p[0]+13,p[1]-9,7,0,7);ctx.fill();
      });
    }
    function decLights(){
      for(var i=0;i<3;i++){
        var lx=110+i*120;
        rect(lx-1,30,2,24,"#1a1a1a");
        fillC("#1a1a1a");
        ctx.beginPath();ctx.arc(lx,58,9,Math.PI,0);ctx.fill();
        fillC("#ffd23e");
        ctx.beginPath();ctx.arc(lx,60,5,0,7);ctx.fill();
        ctx.save();ctx.globalAlpha=.25;fillC("#ffd23e");
        ctx.beginPath();ctx.arc(lx,62,20,0,7);ctx.fill();ctx.restore();
      }
    }
    function decArt(){
      rect(20,80,42,32,"#7a4a2a");
      rect(23,83,36,26,"#2a4a7a");
      fillC("#46ff9c");
      ctx.beginPath();ctx.arc(33,98,5,0,7);ctx.fill();
      rect(38,100,16,4,"#ffd23e");
      rect(W-62,80,42,32,"#7a4a2a");
      rect(W-59,83,36,26,"#5a2a4a");
      fillC("#ffd23e");
      ctx.beginPath();ctx.moveTo(W-48,86);ctx.lineTo(W-62,106);ctx.lineTo(W-32,106);ctx.closePath();ctx.fill();
    }
    function decTV(){
      rect(W/2-36,76,72,42,"#1a1a1a");
      rect(W/2-33,79,66,36,"#1a3a5a");
      fillC("#27e8ff");ctx.fillRect(W/2-30,82,60,30);
      fillC("#ff3ea5");rect(W/2-20,86,12,8,"#ff3ea5");
      fillC("#ffd23e");rect(W/2-5,90,14,12,"#ffd23e");
      fillC("#46ff9c");rect(W/2+12,94,8,12,"#46ff9c");
    }
    function decBar(){
      rect(20,130,140,50,"#3a1a1a");
      rect(20,130,140,8,"#5a2a1a");
      rect(20,178,140,4,"#1a0a0a");
      var cols=["#46ff9c","#27e8ff","#ffd23e","#ff3ea5","#9b6bff","#ff8a3e"];
      for(var i=0;i<6;i++){
        var bx=26+i*22;
        rect(bx,110,10,22,cols[i]);
        rect(bx+1,106,8,6,"#222");
      }
    }
    function decJuke(){
      rect(W-58,128,40,52,"#5a1a3a");
      rect(W-55,131,34,18,"#0a0613");
      rect(W-50,135,10,10,"#ffd23e");
      ctx.save();ctx.globalAlpha=.6;fillC("#fff");
      ctx.beginPath();ctx.arc(W-45,140,3,0,7);ctx.fill();ctx.restore();
      rect(W-55,154,34,4,"#ff8a3e");
      for(var i=0;i<4;i++) rect(W-52+i*8,164,5,4,["#27e8ff","#46ff9c","#ffd23e","#ff3ea5"][i]);
    }
    function decBooths(){
      for(var i=0;i<2;i++){
        var by=128+i*28;
        rect(180,by,90,5,"#5a2a3a");
        rect(180,by+5,90,18,"#7a3a4a");
        rect(184,by+8,82,12,"#aa4a5a");
        rect(180,by+23,90,3,"#2a1a2a");
      }
    }
    function decChandelier(){
      var cx=W/2, cy=30;
      rect(cx-1,cy,2,18,"#3a2a3a");
      fillC("#ffd23e");
      ctx.beginPath();
      ctx.moveTo(cx-22,cy+18);ctx.lineTo(cx+22,cy+18);
      ctx.lineTo(cx+30,cy+30);ctx.lineTo(cx-30,cy+30);
      ctx.closePath();ctx.fill();
      for(var i=0;i<6;i++){
        var crx=cx-25+i*10;
        fillC("#fff");
        ctx.beginPath();ctx.moveTo(crx,cy+30);ctx.lineTo(crx-3,cy+44);ctx.lineTo(crx+3,cy+44);ctx.closePath();ctx.fill();
      }
      ctx.save();ctx.globalAlpha=.3;fillC("#ffd23e");
      ctx.beginPath();ctx.arc(cx,cy+34,38,0,7);ctx.fill();ctx.restore();
    }

    var DECOR=[
      {id:"carpet",     n:"CARPET",         cost:600,   score:1, place:decCarpet},
      {id:"plants",     n:"POTTED PLANTS",  cost:300,   score:1, place:decPlants},
      {id:"tables",     n:"NICE TABLES",    cost:800,   score:2, place:decTables},
      {id:"lights",     n:"PENDANT LIGHTS", cost:1200,  score:2, place:decLights},
      {id:"artwork",    n:"WALL ART",       cost:1500,  score:2, place:decArt},
      {id:"tv",         n:"FLAT-SCREEN TV", cost:2000,  score:3, place:decTV},
      {id:"jukebox",    n:"JUKEBOX",        cost:3500,  score:3, place:decJuke},
      {id:"booths",     n:"BOOTH SEATING",  cost:5000,  score:4, place:decBooths},
      {id:"bar",        n:"FULL BAR",       cost:8000,  score:5, place:decBar},
      {id:"chandelier", n:"CHANDELIER",     cost:15000, score:6, place:decChandelier}
    ];

    var MKT=[
      {n:"NONE",       cost:0,     mult:1.0},
      {n:"LEAFLETS",   cost:500,   mult:1.3},
      {n:"RADIO ADS",  cost:3000,  mult:1.7},
      {n:"SOCIAL",     cost:12000, mult:2.2},
      {n:"BILLBOARDS", cost:50000, mult:3.0}
    ];
    var TRUCK=[
      {n:"NONE",         cost:0,     cap:40},
      {n:"USED VAN",     cost:2000,  cap:120},
      {n:"REFRIGERATED", cost:8000,  cap:280},
      {n:"FLEET",        cost:30000, cap:700}
    ];
    var UPS=[
      {id:"stove", n:"PRO STOVE",  cost:5000,  desc:"Wider green zone, faster cook"},
      {id:"decor", n:"DECOR",      cost:8000,  desc:"+1 star bias on close calls"},
      {id:"seats", n:"MORE SEATS", cost:12000, desc:"+50% customer flow"},
      {id:"sous",  n:"SOUS CHEF",  cost:25000, desc:"Auto-handles cooking step 1"}
    ];

    var BRAND_PRE=["NEON","RETRO","PIXEL","CHROME","ARCADE","BYTE","GOLDEN","TURBO","ULTRA","CRISP","MIDNIGHT","COSMIC","STEEL","GLOW","RAPID","SUNSET"];
    var BRAND_POST=["BISTRO","DINER","KITCHEN","GRILL","TAVERN","CAFE","HOUSE","SPOT","FORK","TABLE","HARBOR","STREET","JOINT","STUDIO","CLUB","ROOM"];
    var CITY_NAMES=["NEO YORK","BYTE BEACH","PIXEL CITY","ARCADE BAY","NEON HEIGHTS","RETRO HARBOR","BIT SPRINGS","GLOW CREEK","SYNTH FALLS","CHROME HILL"];
    var KB_KEYS=["A","B","C","D","E","F","G",
                 "H","I","J","K","L","M","N",
                 "O","P","Q","R","S","T","U",
                 "V","W","X","Y","Z","_","<"];

    // -------- Food sprites (drawn at any size s) --------
    function fillC(c){ ctx.fillStyle=c; }
    function strokeC(c,lw){ ctx.strokeStyle=c; ctx.lineWidth=lw||1; }

    function spCoffee(x,y,s){
      rect(x+s*0.15,y+s*0.3,s*0.6,s*0.6,"#7a3a1a");
      rect(x+s*0.18,y+s*0.33,s*0.54,s*0.54,"#aa5a3a");
      rect(x+s*0.78,y+s*0.4,s*0.15,s*0.32,"#7a3a1a");
      rect(x+s*0.81,y+s*0.45,s*0.09,s*0.22,"#aa5a3a");
      rect(x+s*0.21,y+s*0.36,s*0.48,s*0.1,"#3a1a08");
      strokeC("#ffffff66",2);
      ctx.beginPath();ctx.moveTo(x+s*0.35,y+s*0.22);ctx.bezierCurveTo(x+s*0.3,y+s*0.12,x+s*0.45,y+s*0.1,x+s*0.4,y+s*0.02);ctx.stroke();
      ctx.beginPath();ctx.moveTo(x+s*0.55,y+s*0.22);ctx.bezierCurveTo(x+s*0.5,y+s*0.12,x+s*0.65,y+s*0.1,x+s*0.6,y+s*0.02);ctx.stroke();
    }
    function spToast(x,y,s){
      rect(x+s*0.1,y+s*0.3,s*0.8,s*0.55,"#8a5a2a");
      rect(x+s*0.13,y+s*0.33,s*0.74,s*0.49,"#d4a85a");
      rect(x+s*0.16,y+s*0.36,s*0.68,s*0.43,"#f4cc7a");
      rect(x+s*0.3,y+s*0.42,s*0.25,s*0.12,"#ffd23e");
      strokeC("#a86c1a",1);
      ctx.beginPath();ctx.moveTo(x+s*0.16,y+s*0.55);ctx.lineTo(x+s*0.84,y+s*0.55);ctx.stroke();
    }
    function spSandwich(x,y,s){
      rect(x+s*0.1,y+s*0.22,s*0.8,s*0.16,"#d4a23a");
      rect(x+s*0.12,y+s*0.24,s*0.76,s*0.12,"#e8c060");
      rect(x+s*0.08,y+s*0.36,s*0.84,s*0.08,"#46ff9c");
      rect(x+s*0.08,y+s*0.44,s*0.84,s*0.08,"#ff8a3e");
      rect(x+s*0.08,y+s*0.52,s*0.84,s*0.1,"#aa3a3a");
      rect(x+s*0.08,y+s*0.62,s*0.84,s*0.08,"#46ff9c");
      rect(x+s*0.1,y+s*0.7,s*0.8,s*0.16,"#d4a23a");
      rect(x+s*0.12,y+s*0.72,s*0.76,s*0.12,"#b88a30");
    }
    function spSalad(x,y,s){
      fillC("#5a3a3a");
      ctx.beginPath();ctx.arc(x+s*0.5,y+s*0.6,s*0.42,0,Math.PI);ctx.fill();
      fillC("#3a2a2a");
      ctx.beginPath();ctx.arc(x+s*0.5,y+s*0.6,s*0.38,0,Math.PI);ctx.fill();
      rect(x+s*0.18,y+s*0.38,s*0.64,s*0.22,"#46ff9c");
      rect(x+s*0.22,y+s*0.32,s*0.56,s*0.14,"#3acc7a");
      fillC("#ff3ea5");
      ctx.beginPath();ctx.arc(x+s*0.32,y+s*0.5,s*0.07,0,7);ctx.fill();
      ctx.beginPath();ctx.arc(x+s*0.6,y+s*0.45,s*0.07,0,7);ctx.fill();
      ctx.beginPath();ctx.arc(x+s*0.48,y+s*0.55,s*0.06,0,7);ctx.fill();
      fillC("#ffd23e");
      ctx.beginPath();ctx.arc(x+s*0.42,y+s*0.42,s*0.04,0,7);ctx.fill();
      ctx.beginPath();ctx.arc(x+s*0.66,y+s*0.55,s*0.04,0,7);ctx.fill();
    }
    function spTaco(x,y,s){
      fillC("#d4a23a");
      ctx.beginPath();
      ctx.moveTo(x+s*0.12,y+s*0.78);
      ctx.lineTo(x+s*0.5,y+s*0.28);
      ctx.lineTo(x+s*0.88,y+s*0.78);
      ctx.lineTo(x+s*0.85,y+s*0.86);
      ctx.lineTo(x+s*0.15,y+s*0.86);
      ctx.closePath();
      ctx.fill();
      fillC("#b88a30");
      ctx.beginPath();
      ctx.moveTo(x+s*0.2,y+s*0.78);
      ctx.lineTo(x+s*0.5,y+s*0.38);
      ctx.lineTo(x+s*0.8,y+s*0.78);
      ctx.closePath();
      ctx.fill();
      rect(x+s*0.28,y+s*0.5,s*0.44,s*0.18,"#aa3a3a");
      rect(x+s*0.28,y+s*0.46,s*0.44,s*0.06,"#46ff9c");
      rect(x+s*0.34,y+s*0.58,s*0.32,s*0.04,"#ffd23e");
    }
    function spSoup(x,y,s){
      fillC("#3a2a3a");
      ctx.beginPath();ctx.arc(x+s*0.5,y+s*0.62,s*0.42,0,Math.PI);ctx.fill();
      fillC("#1a0a1a");
      ctx.beginPath();ctx.ellipse(x+s*0.5,y+s*0.55,s*0.42,s*0.1,0,0,Math.PI);ctx.fill();
      fillC("#ff8a3e");
      ctx.beginPath();ctx.ellipse(x+s*0.5,y+s*0.55,s*0.38,s*0.09,0,0,7);ctx.fill();
      fillC("#ffd23e");
      ctx.beginPath();ctx.arc(x+s*0.4,y+s*0.55,s*0.05,0,7);ctx.fill();
      ctx.beginPath();ctx.arc(x+s*0.6,y+s*0.55,s*0.04,0,7);ctx.fill();
      strokeC("#ffffff88",2);
      ctx.beginPath();ctx.moveTo(x+s*0.36,y+s*0.32);ctx.bezierCurveTo(x+s*0.32,y+s*0.22,x+s*0.42,y+s*0.18,x+s*0.38,y+s*0.08);ctx.stroke();
      ctx.beginPath();ctx.moveTo(x+s*0.6,y+s*0.32);ctx.bezierCurveTo(x+s*0.56,y+s*0.22,x+s*0.66,y+s*0.18,x+s*0.62,y+s*0.08);ctx.stroke();
    }
    function spBurger(x,y,s){
      fillC("#d4a23a");
      ctx.beginPath();ctx.arc(x+s*0.5,y+s*0.32,s*0.42,Math.PI,0);ctx.fill();
      rect(x+s*0.08,y+s*0.32,s*0.84,s*0.06,"#d4a23a");
      fillC("#fff");
      ctx.beginPath();ctx.arc(x+s*0.32,y+s*0.2,2,0,7);ctx.fill();
      ctx.beginPath();ctx.arc(x+s*0.5,y+s*0.16,2,0,7);ctx.fill();
      ctx.beginPath();ctx.arc(x+s*0.66,y+s*0.2,2,0,7);ctx.fill();
      rect(x+s*0.06,y+s*0.4,s*0.88,s*0.06,"#46ff9c");
      rect(x+s*0.06,y+s*0.46,s*0.88,s*0.05,"#ffd23e");
      rect(x+s*0.06,y+s*0.51,s*0.88,s*0.12,"#5a2a1a");
      rect(x+s*0.06,y+s*0.51,s*0.88,s*0.02,"#7a3a1a");
      rect(x+s*0.06,y+s*0.63,s*0.88,s*0.04,"#aa3a3a");
      rect(x+s*0.08,y+s*0.67,s*0.84,s*0.12,"#d4a23a");
      rect(x+s*0.08,y+s*0.67,s*0.84,s*0.04,"#e8c060");
    }
    function spPizza(x,y,s){
      fillC("#8a4a2a");
      ctx.beginPath();
      ctx.moveTo(x+s*0.5,y+s*0.15);
      ctx.lineTo(x+s*0.08,y+s*0.78);
      ctx.lineTo(x+s*0.92,y+s*0.78);
      ctx.closePath();
      ctx.fill();
      fillC("#ffd23e");
      ctx.beginPath();
      ctx.moveTo(x+s*0.5,y+s*0.22);
      ctx.lineTo(x+s*0.16,y+s*0.74);
      ctx.lineTo(x+s*0.84,y+s*0.74);
      ctx.closePath();
      ctx.fill();
      fillC("#ff3ea5");
      ctx.beginPath();ctx.arc(x+s*0.42,y+s*0.55,s*0.06,0,7);ctx.fill();
      ctx.beginPath();ctx.arc(x+s*0.58,y+s*0.58,s*0.06,0,7);ctx.fill();
      ctx.beginPath();ctx.arc(x+s*0.5,y+s*0.44,s*0.05,0,7);ctx.fill();
      ctx.beginPath();ctx.arc(x+s*0.35,y+s*0.68,s*0.05,0,7);ctx.fill();
      ctx.beginPath();ctx.arc(x+s*0.65,y+s*0.68,s*0.05,0,7);ctx.fill();
      fillC("#fff8");
      ctx.beginPath();ctx.arc(x+s*0.5,y+s*0.5,s*0.03,0,7);ctx.fill();
      ctx.beginPath();ctx.arc(x+s*0.46,y+s*0.62,s*0.03,0,7);ctx.fill();
    }
    function spPasta(x,y,s){
      fillC("#3a2a3a");
      ctx.beginPath();ctx.arc(x+s*0.5,y+s*0.62,s*0.42,0,Math.PI);ctx.fill();
      fillC("#1a0a1a");
      ctx.beginPath();ctx.ellipse(x+s*0.5,y+s*0.55,s*0.42,s*0.1,0,0,Math.PI);ctx.fill();
      strokeC("#ffd23e",2);
      for(var i=0;i<5;i++){
        ctx.beginPath();
        ctx.moveTo(x+s*0.18,y+s*0.45+i*3);
        ctx.bezierCurveTo(x+s*0.35,y+s*0.4+i*3,x+s*0.55,y+s*0.55+i*3,x+s*0.82,y+s*0.45+i*3);
        ctx.stroke();
      }
      fillC("#ff3ea5");
      ctx.beginPath();ctx.arc(x+s*0.5,y+s*0.52,s*0.05,0,7);ctx.fill();
      ctx.beginPath();ctx.arc(x+s*0.38,y+s*0.58,s*0.04,0,7);ctx.fill();
      ctx.beginPath();ctx.arc(x+s*0.62,y+s*0.55,s*0.04,0,7);ctx.fill();
    }
    function spRamen(x,y,s){
      fillC("#2a1a2a");
      ctx.beginPath();ctx.arc(x+s*0.5,y+s*0.62,s*0.42,0,Math.PI);ctx.fill();
      fillC("#0a0613");
      ctx.beginPath();ctx.ellipse(x+s*0.5,y+s*0.55,s*0.42,s*0.1,0,0,Math.PI);ctx.fill();
      fillC("#ff8a3e");
      ctx.beginPath();ctx.ellipse(x+s*0.5,y+s*0.55,s*0.38,s*0.09,0,0,7);ctx.fill();
      strokeC("#fff5a8",2);
      for(var i=0;i<4;i++){
        ctx.beginPath();
        ctx.arc(x+s*0.42,y+s*0.5+i*2,5+i,Math.PI*0.2,Math.PI*0.8);
        ctx.stroke();
      }
      fillC("#fff");
      ctx.beginPath();ctx.arc(x+s*0.65,y+s*0.5,s*0.08,0,7);ctx.fill();
      fillC("#ffd23e");
      ctx.beginPath();ctx.arc(x+s*0.65,y+s*0.5,s*0.045,0,7);ctx.fill();
      fillC("#46ff9c");
      for(var i=0;i<5;i++){ rect(x+s*0.28+i*4,y+s*0.48,3,3,"#46ff9c"); }
      fillC("#aa3a3a");
      ctx.beginPath();ctx.arc(x+s*0.36,y+s*0.52,s*0.04,0,7);ctx.fill();
    }
    function spCake(x,y,s){
      fillC("#cdbff0");
      ctx.beginPath();ctx.ellipse(x+s*0.5,y+s*0.82,s*0.42,s*0.06,0,0,7);ctx.fill();
      rect(x+s*0.2,y+s*0.55,s*0.6,s*0.25,"#ff8a3e");
      rect(x+s*0.2,y+s*0.55,s*0.6,s*0.04,"#ffaa5a");
      rect(x+s*0.2,y+s*0.6,s*0.6,s*0.02,"#aa3a3a");
      rect(x+s*0.2,y+s*0.67,s*0.6,s*0.02,"#aa3a3a");
      fillC("#fff");
      ctx.beginPath();
      ctx.moveTo(x+s*0.2,y+s*0.55);
      for(var i=0;i<7;i++){
        ctx.quadraticCurveTo(x+s*(0.225+i*0.085),y+s*0.46,x+s*(0.285+i*0.085),y+s*0.55);
      }
      ctx.lineTo(x+s*0.8,y+s*0.45);
      ctx.lineTo(x+s*0.2,y+s*0.45);
      ctx.closePath();
      ctx.fill();
      fillC("#ff3ea5");
      ctx.beginPath();ctx.arc(x+s*0.5,y+s*0.4,s*0.07,0,7);ctx.fill();
      strokeC("#5a2a3a",1);
      ctx.beginPath();ctx.moveTo(x+s*0.5,y+s*0.34);ctx.lineTo(x+s*0.5,y+s*0.4);ctx.stroke();
    }
    function spSushi(x,y,s){
      fillC("#cdbff0");
      ctx.beginPath();ctx.ellipse(x+s*0.5,y+s*0.82,s*0.45,s*0.06,0,0,7);ctx.fill();
      fillC("#fff");
      ctx.beginPath();
      ctx.moveTo(x+s*0.18,y+s*0.62);
      ctx.quadraticCurveTo(x+s*0.16,y+s*0.78,x+s*0.22,y+s*0.8);
      ctx.lineTo(x+s*0.78,y+s*0.8);
      ctx.quadraticCurveTo(x+s*0.84,y+s*0.78,x+s*0.82,y+s*0.62);
      ctx.closePath();
      ctx.fill();
      fillC("#ff8a8a");
      rect(x+s*0.14,y+s*0.42,s*0.72,s*0.22,"#ff8a8a");
      strokeC("#ffaaaa",1);
      for(var i=0;i<4;i++){
        ctx.beginPath();
        ctx.moveTo(x+s*0.18,y+s*0.46+i*4);
        ctx.lineTo(x+s*0.82,y+s*0.46+i*4);
        ctx.stroke();
      }
      rect(x+s*0.42,y+s*0.42,s*0.16,s*0.4,"#1a3a1a");
      rect(x+s*0.42,y+s*0.42,s*0.16,s*0.02,"#3a5a3a");
    }
    function spSteak(x,y,s){
      fillC("#cdbff0");
      ctx.beginPath();ctx.ellipse(x+s*0.5,y+s*0.72,s*0.45,s*0.1,0,0,7);ctx.fill();
      fillC("#3a0808");
      ctx.beginPath();
      ctx.moveTo(x+s*0.2,y+s*0.55);
      ctx.bezierCurveTo(x+s*0.14,y+s*0.4,x+s*0.5,y+s*0.32,x+s*0.86,y+s*0.42);
      ctx.bezierCurveTo(x+s*0.92,y+s*0.6,x+s*0.72,y+s*0.72,x+s*0.5,y+s*0.7);
      ctx.bezierCurveTo(x+s*0.28,y+s*0.72,x+s*0.16,y+s*0.66,x+s*0.2,y+s*0.55);
      ctx.closePath();
      ctx.fill();
      fillC("#5a1a1a");
      ctx.beginPath();
      ctx.moveTo(x+s*0.24,y+s*0.5);
      ctx.bezierCurveTo(x+s*0.2,y+s*0.42,x+s*0.5,y+s*0.36,x+s*0.82,y+s*0.46);
      ctx.bezierCurveTo(x+s*0.86,y+s*0.6,x+s*0.7,y+s*0.68,x+s*0.5,y+s*0.66);
      ctx.bezierCurveTo(x+s*0.3,y+s*0.68,x+s*0.2,y+s*0.62,x+s*0.24,y+s*0.5);
      ctx.closePath();
      ctx.fill();
      strokeC("#1a0a0a",3);
      ctx.beginPath();ctx.moveTo(x+s*0.28,y+s*0.46);ctx.lineTo(x+s*0.72,y+s*0.62);ctx.stroke();
      ctx.beginPath();ctx.moveTo(x+s*0.4,y+s*0.4);ctx.lineTo(x+s*0.84,y+s*0.54);ctx.stroke();
      ctx.beginPath();ctx.moveTo(x+s*0.22,y+s*0.58);ctx.lineTo(x+s*0.66,y+s*0.7);ctx.stroke();
    }
    function spLobster(x,y,s){
      fillC("#cdbff0");
      ctx.beginPath();ctx.ellipse(x+s*0.5,y+s*0.82,s*0.45,s*0.06,0,0,7);ctx.fill();
      fillC("#ff3ea5");
      ctx.beginPath();
      ctx.moveTo(x+s*0.28,y+s*0.4);
      ctx.bezierCurveTo(x+s*0.18,y+s*0.5,x+s*0.18,y+s*0.7,x+s*0.4,y+s*0.74);
      ctx.lineTo(x+s*0.6,y+s*0.74);
      ctx.bezierCurveTo(x+s*0.82,y+s*0.7,x+s*0.82,y+s*0.5,x+s*0.72,y+s*0.4);
      ctx.bezierCurveTo(x+s*0.65,y+s*0.35,x+s*0.35,y+s*0.35,x+s*0.28,y+s*0.4);
      ctx.closePath();
      ctx.fill();
      fillC("#aa1a3a");
      for(var i=0;i<3;i++){
        ctx.beginPath();
        ctx.ellipse(x+s*0.5,y+s*0.5+i*0.07,s*0.25-i*0.02,s*0.025,0,0,Math.PI*2);
        ctx.fill();
      }
      fillC("#cc1a4a");
      ctx.beginPath();
      ctx.moveTo(x+s*0.65,y+s*0.7);
      ctx.lineTo(x+s*0.9,y+s*0.55);
      ctx.lineTo(x+s*0.95,y+s*0.7);
      ctx.lineTo(x+s*0.92,y+s*0.78);
      ctx.lineTo(x+s*0.7,y+s*0.74);
      ctx.closePath();
      ctx.fill();
      fillC("#ff3ea5");
      ctx.beginPath();ctx.arc(x+s*0.22,y+s*0.42,s*0.08,0,7);ctx.fill();
      ctx.beginPath();ctx.arc(x+s*0.78,y+s*0.42,s*0.08,0,7);ctx.fill();
      fillC("#aa1a3a");
      ctx.beginPath();ctx.arc(x+s*0.22,y+s*0.42,s*0.04,0,7);ctx.fill();
      ctx.beginPath();ctx.arc(x+s*0.78,y+s*0.42,s*0.04,0,7);ctx.fill();
      strokeC("#5a0a1a",1);
      ctx.beginPath();ctx.moveTo(x+s*0.44,y+s*0.38);ctx.lineTo(x+s*0.34,y+s*0.22);ctx.stroke();
      ctx.beginPath();ctx.moveTo(x+s*0.56,y+s*0.38);ctx.lineTo(x+s*0.66,y+s*0.22);ctx.stroke();
      fillC("#0a0613");
      ctx.beginPath();ctx.arc(x+s*0.44,y+s*0.42,2,0,7);ctx.fill();
      ctx.beginPath();ctx.arc(x+s*0.56,y+s*0.42,2,0,7);ctx.fill();
    }

    var FOOD_SPRITES={coffee:spCoffee,toast:spToast,sandwich:spSandwich,salad:spSalad,
      taco:spTaco,soup:spSoup,burger:spBurger,pizza:spPizza,pasta:spPasta,ramen:spRamen,
      cake:spCake,sushi:spSushi,steak:spSteak,lobster:spLobster};

    function drawFood(itemId,x,y,s){
      var f=FOOD_SPRITES[itemId]; if(f) f(x,y,s);
      else { fillC("#9b6bff"); ctx.fillRect(x+s*0.2,y+s*0.2,s*0.6,s*0.6); }
    }

    // -------- Location image renderers --------
    function clipBox(x,y,w,h){ ctx.save(); ctx.beginPath(); ctx.rect(x,y,w,h); ctx.clip(); }
    function unclip(){ ctx.restore(); }

    function drawGasStation(x,y,w,h){
      clipBox(x,y,w,h);
      rect(x,y,w,h*0.7,"#1a1a2a");
      rect(x,y+h*0.7,w,h*0.3,"#3a3a2a");
      rect(x+w*0.1,y+h*0.45,4,h*0.35,"#6a4a2a");
      rect(x+w*0.04,y+h*0.4,w*0.22,h*0.15,"#aa6a3a");
      px_txt("GAS",x+w*0.15,y+h*0.5,5,"#1a1a1a");
      rect(x+w*0.55,y+h*0.55,w*0.12,h*0.25,"#666");
      rect(x+w*0.56,y+h*0.58,w*0.1,h*0.04,"#222");
      strokeC("#1a1a1a",1);
      ctx.beginPath();ctx.moveTo(x+w*0.61,y+h*0.62);ctx.lineTo(x+w*0.7,y+h*0.78);ctx.stroke();
      strokeC("#3a6a3a",1);
      for(var i=0;i<5;i++){
        var wx=x+w*0.78+i*4;
        ctx.beginPath();ctx.moveTo(wx,y+h*0.92);ctx.lineTo(wx,y+h*0.82);ctx.stroke();
      }
      unclip();
    }
    function drawTruckStop(x,y,w,h){
      clipBox(x,y,w,h);
      var g=ctx.createLinearGradient(x,y,x,y+h*0.6);
      g.addColorStop(0,"#3a2a5a"); g.addColorStop(1,"#aa6a4a");
      ctx.fillStyle=g; ctx.fillRect(x,y,w,h*0.6);
      rect(x,y+h*0.6,w,h*0.4,"#2a2a2a");
      rect(x+w*0.15,y+h*0.35,w*0.7,h*0.3,"#ffd23e");
      rect(x+w*0.1,y+h*0.3,w*0.8,h*0.08,"#ff3ea5");
      fillC("#1a1a1a");
      ctx.beginPath();ctx.arc(x+w*0.25,y+h*0.7,h*0.06,0,7);ctx.fill();
      ctx.beginPath();ctx.arc(x+w*0.75,y+h*0.7,h*0.06,0,7);ctx.fill();
      rect(x+w*0.18,y+h*0.4,w*0.18,h*0.12,"#27e8ff");
      px_txt("FOOD",x+w*0.6,y+h*0.5,5,"#1a1a1a");
      unclip();
    }
    function drawStripMall(x,y,w,h){
      clipBox(x,y,w,h);
      rect(x,y,w,h*0.5,"#2a3a5a");
      rect(x,y+h*0.85,w,h*0.15,"#2a2a2a");
      var pw=w/3;
      var cols=["#9b6bff","#46ff9c","#ffd23e"];
      for(var i=0;i<3;i++){
        rect(x+i*pw,y+h*0.5,pw-1,h*0.35,"#3a2a3a");
        rect(x+i*pw+2,y+h*0.55,pw-5,4,cols[i]);
        rect(x+i*pw+pw*0.15,y+h*0.62,pw*0.7,h*0.18,"#0a0613");
      }
      strokeC("#fff",1);ctx.setLineDash([4,4]);
      ctx.beginPath();ctx.moveTo(x,y+h*0.92);ctx.lineTo(x+w,y+h*0.92);ctx.stroke();ctx.setLineDash([]);
      unclip();
    }
    function drawPlaza(x,y,w,h){
      clipBox(x,y,w,h);
      rect(x,y,w,h*0.45,"#2a4a7a");
      rect(x+w*0.05,y+h*0.3,w*0.9,h*0.5,"#5a5a7a");
      fillC("#3a2a3a");
      ctx.beginPath();ctx.moveTo(x+w*0.02,y+h*0.32);ctx.lineTo(x+w*0.5,y+h*0.18);ctx.lineTo(x+w*0.98,y+h*0.32);ctx.closePath();ctx.fill();
      for(var i=0;i<5;i++){ rect(x+w*(0.15+i*0.15),y+h*0.45,w*0.08,h*0.1,"#ffd23e"); }
      rect(x+w*0.45,y+h*0.6,w*0.1,h*0.2,"#4a3a3a");
      rect(x,y+h*0.8,w,h*0.2,"#3a3a3a");
      strokeC("#fff",1);
      for(var i=0;i<4;i++){
        ctx.beginPath();ctx.moveTo(x+i*w*0.25+w*0.05,y+h*0.85);ctx.lineTo(x+i*w*0.25+w*0.05,y+h*0.95);ctx.stroke();
      }
      unclip();
    }
    function drawDowntown(x,y,w,h){
      clipBox(x,y,w,h);
      var g=ctx.createLinearGradient(x,y,x,y+h);
      g.addColorStop(0,"#0a0a3a"); g.addColorStop(1,"#3a0a3a");
      ctx.fillStyle=g; ctx.fillRect(x,y,w,h);
      var hh=[h*0.5,h*0.7,h*0.45,h*0.6,h*0.55,h*0.4,h*0.65];
      for(var i=0;i<hh.length;i++){
        var bx=x+i*(w/hh.length), bw=w/hh.length, bh=hh[i];
        rect(bx,y+h-bh,bw-2,bh,"#1a1a3a");
        for(var wy=0;wy<bh/12;wy++)
          for(var wx=0;wx<2;wx++)
            if(((i*7+wy*3+wx*11)%5)<2) rect(bx+2+wx*5,y+h-bh+wy*8+4,3,3,"#ffd23e");
      }
      rect(x+w*0.3,y+h*0.7,w*0.4,h*0.25,"#1a0613");
      rect(x+w*0.3,y+h*0.7,w*0.4,4,"#ff3ea5");
      rect(x+w*0.3,y+h*0.93,w*0.4,4,"#ff3ea5");
      px_txt("DINER",x+w*0.5,y+h*0.85,6,"#ff3ea5");
      unclip();
    }
    function drawLoft(x,y,w,h){
      clipBox(x,y,w,h);
      rect(x,y,w,h,"#9b4a4a");
      strokeC("#5a2a2a",1);
      for(var ry=0;ry<h;ry+=8){
        var off=(Math.floor(ry/8)%2)*6;
        for(var rx=-6;rx<w;rx+=12){
          ctx.strokeRect(x+rx+off,y+ry,12,8);
        }
      }
      rect(x+w*0.1,y+h*0.25,w*0.35,h*0.5,"#27e8ff");
      rect(x+w*0.55,y+h*0.25,w*0.35,h*0.5,"#27e8ff");
      strokeC("#1a1a1a",2);
      ctx.strokeRect(x+w*0.1,y+h*0.25,w*0.35,h*0.5);
      ctx.strokeRect(x+w*0.55,y+h*0.25,w*0.35,h*0.5);
      ctx.beginPath();ctx.moveTo(x+w*0.275,y+h*0.25);ctx.lineTo(x+w*0.275,y+h*0.75);ctx.stroke();
      ctx.beginPath();ctx.moveTo(x+w*0.725,y+h*0.25);ctx.lineTo(x+w*0.725,y+h*0.75);ctx.stroke();
      fillC("#3a6a3a");ctx.beginPath();ctx.arc(x+w*0.05,y+h*0.85,h*0.08,0,7);ctx.fill();
      unclip();
    }
    function drawWaterfront(x,y,w,h){
      clipBox(x,y,w,h);
      var g=ctx.createLinearGradient(x,y,x,y+h*0.6);
      g.addColorStop(0,"#3a2a6b"); g.addColorStop(1,"#ff8a3e");
      ctx.fillStyle=g; ctx.fillRect(x,y,w,h*0.6);
      fillC("#ffd23e");
      ctx.beginPath();ctx.arc(x+w*0.7,y+h*0.4,h*0.1,0,7);ctx.fill();
      rect(x,y+h*0.6,w,h*0.4,"#2a4a7a");
      strokeC("#ffd23e88",2);
      for(var i=0;i<6;i++){
        var wy=y+h*0.65+i*4;
        ctx.beginPath();ctx.moveTo(x+w*0.6,wy);ctx.lineTo(x+w*0.8,wy);ctx.stroke();
      }
      rect(x+w*0.1,y+h*0.45,w*0.35,h*0.2,"#5a3a3a");
      rect(x+w*0.08,y+h*0.4,w*0.4,h*0.06,"#ff3ea5");
      rect(x+w*0.1,y+h*0.65,3,h*0.3,"#3a2a1a");
      rect(x+w*0.42,y+h*0.65,3,h*0.3,"#3a2a1a");
      unclip();
    }
    function drawVilla(x,y,w,h){
      clipBox(x,y,w,h);
      var g=ctx.createLinearGradient(x,y,x,y+h);
      g.addColorStop(0,"#ff8a3e"); g.addColorStop(0.5,"#ff3ea5"); g.addColorStop(1,"#3a1a52");
      ctx.fillStyle=g; ctx.fillRect(x,y,w,h);
      fillC("#3a1a3a");
      ctx.beginPath();
      ctx.moveTo(x,y+h*0.65);
      ctx.lineTo(x+w*0.2,y+h*0.4);
      ctx.lineTo(x+w*0.4,y+h*0.55);
      ctx.lineTo(x+w*0.7,y+h*0.3);
      ctx.lineTo(x+w,y+h*0.5);
      ctx.lineTo(x+w,y+h);
      ctx.lineTo(x,y+h);
      ctx.closePath();
      ctx.fill();
      rect(x+w*0.35,y+h*0.6,w*0.35,h*0.25,"#eeeedd");
      fillC("#aa3a3a");
      ctx.beginPath();
      ctx.moveTo(x+w*0.32,y+h*0.62);
      ctx.lineTo(x+w*0.525,y+h*0.5);
      ctx.lineTo(x+w*0.73,y+h*0.62);
      ctx.closePath();
      ctx.fill();
      rect(x+w*0.4,y+h*0.65,w*0.08,h*0.08,"#27e8ff");
      rect(x+w*0.57,y+h*0.65,w*0.08,h*0.08,"#27e8ff");
      rect(x+w*0.49,y+h*0.72,w*0.07,h*0.13,"#4a2a1a");
      unclip();
    }

    function drawHipster(x,y,w,h){
      clipBox(x,y,w,h);
      var g=ctx.createLinearGradient(x,y,x,y+h);
      g.addColorStop(0,"#3a2a52"); g.addColorStop(1,"#1a0a26");
      ctx.fillStyle=g;ctx.fillRect(x,y,w,h);
      rect(x+w*0.1,y+h*0.5,w*0.8,h*0.4,"#8a5a3a");
      strokeC("#ffd23e88",1);
      for(var i=0;i<6;i++){
        var lx=x+w*(0.15+i*0.13);
        ctx.beginPath();ctx.arc(lx,y+h*(0.42+Math.sin(i)*0.04),2,0,7);ctx.fill();
      }
      strokeC("#aa8a6a",1);
      ctx.beginPath();ctx.moveTo(x+w*0.1,y+h*0.42);ctx.lineTo(x+w*0.9,y+h*0.42);ctx.stroke();
      rect(x+w*0.15,y+h*0.55,w*0.7,h*0.05,"#cd9a5a");
      rect(x+w*0.3,y+h*0.62,w*0.18,h*0.12,"#1a0613");
      rect(x+w*0.55,y+h*0.62,w*0.18,h*0.12,"#1a0613");
      fillC("#3a8a3a");
      ctx.beginPath();ctx.arc(x+w*0.85,y+h*0.78,h*0.1,0,7);ctx.fill();
      unclip();
    }
    function drawCollege(x,y,w,h){
      clipBox(x,y,w,h);
      rect(x,y,w,h*0.4,"#5a8aff");
      rect(x,y+h*0.85,w,h*0.15,"#3a5a3a");
      rect(x+w*0.05,y+h*0.3,w*0.9,h*0.55,"#cdbf9a");
      fillC("#8a5a3a");
      ctx.beginPath();ctx.moveTo(x+w*0.02,y+h*0.32);ctx.lineTo(x+w*0.5,y+h*0.18);ctx.lineTo(x+w*0.98,y+h*0.32);ctx.closePath();ctx.fill();
      rect(x+w*0.4,y+h*0.6,w*0.2,h*0.25,"#4a2a1a");
      rect(x+w*0.42,y+h*0.62,w*0.05,h*0.08,"#ffd23e");
      for(var i=0;i<4;i++){
        rect(x+w*(0.1+i*0.18),y+h*0.42,w*0.08,h*0.1,"#27e8ff");
      }
      rect(x+w*0.2,y+h*0.36,w*0.6,4,"#ff3ea5");
      px_txt("U",x+w*0.5,y+h*0.34,5,"#fff");
      unclip();
    }
    function drawAirport(x,y,w,h){
      clipBox(x,y,w,h);
      var g=ctx.createLinearGradient(x,y,x,y+h);
      g.addColorStop(0,"#5aaaff"); g.addColorStop(1,"#aacddd");
      ctx.fillStyle=g;ctx.fillRect(x,y,w,h*0.7);
      rect(x,y+h*0.7,w,h*0.3,"#3a3a4a");
      strokeC("#fff",1);ctx.setLineDash([6,6]);
      ctx.beginPath();ctx.moveTo(x,y+h*0.85);ctx.lineTo(x+w,y+h*0.85);ctx.stroke();ctx.setLineDash([]);
      rect(x+w*0.05,y+h*0.5,w*0.9,h*0.2,"#7a8aaa");
      rect(x+w*0.05,y+h*0.5,w*0.9,h*0.04,"#5a6a8a");
      for(var i=0;i<8;i++){ rect(x+w*(0.08+i*0.11),y+h*0.56,w*0.08,h*0.1,"#27e8ff"); }
      fillC("#cdcdcd");
      ctx.beginPath();
      ctx.moveTo(x+w*0.2,y+h*0.32);
      ctx.lineTo(x+w*0.55,y+h*0.32);
      ctx.lineTo(x+w*0.7,y+h*0.36);
      ctx.lineTo(x+w*0.65,y+h*0.42);
      ctx.lineTo(x+w*0.5,y+h*0.42);
      ctx.lineTo(x+w*0.18,y+h*0.38);
      ctx.closePath();
      ctx.fill();
      fillC("#aaaaaa");
      ctx.beginPath();ctx.moveTo(x+w*0.4,y+h*0.32);ctx.lineTo(x+w*0.5,y+h*0.22);ctx.lineTo(x+w*0.52,y+h*0.32);ctx.closePath();ctx.fill();
      unclip();
    }
    function drawCasino(x,y,w,h){
      clipBox(x,y,w,h);
      var g=ctx.createLinearGradient(x,y,x,y+h);
      g.addColorStop(0,"#1a0613"); g.addColorStop(1,"#3a0a3a");
      ctx.fillStyle=g;ctx.fillRect(x,y,w,h);
      rect(x+w*0.05,y+h*0.45,w*0.9,h*0.5,"#5a1a3a");
      strokeC("#ffd23e",2);ctx.strokeRect(x+w*0.05,y+h*0.45,w*0.9,h*0.5);
      rect(x+w*0.2,y+h*0.2,w*0.6,h*0.2,"#1a0a1a");
      strokeC("#ff3ea5",3);ctx.strokeRect(x+w*0.2,y+h*0.2,w*0.6,h*0.2);
      px_txt("CASINO",x+w*0.5,y+h*0.32,7,"#ff3ea5");
      for(var i=0;i<5;i++){
        var sx=x+w*(0.15+i*0.18), sy=y+h*0.42;
        fillC("#ffd23e");
        ctx.beginPath();ctx.arc(sx,sy,3,0,7);ctx.fill();
      }
      rect(x+w*0.4,y+h*0.55,w*0.2,h*0.3,"#1a0613");
      strokeC("#ffd23e",1);ctx.strokeRect(x+w*0.4,y+h*0.55,w*0.2,h*0.3);
      px_txt("$",x+w*0.5,y+h*0.74,12,"#ffd23e");
      for(var i=0;i<6;i++){
        rect(x+w*(0.08+i*0.15),y+h*0.62,w*0.06,h*0.1,"#27e8ff");
      }
      unclip();
    }

    var LOC_DRAW=[drawGasStation,drawTruckStop,drawStripMall,drawHipster,drawPlaza,drawCollege,drawDowntown,drawAirport,drawLoft,drawCasino,drawWaterfront,drawVilla];

    var LOC_PINS=[
      {x:55,  y:200},  // 0  gas station
      {x:155, y:195},  // 1  food truck
      {x:215, y:135},  // 2  strip mall
      {x:280, y:175},  // 3  hipster pop-up
      {x:345, y:140},  // 4  suburban plaza
      {x:425, y:150},  // 5  college cafeteria
      {x:230, y:80},   // 6  downtown
      {x:370, y:90},   // 7  airport terminal
      {x:115, y:75},   // 8  trendy loft
      {x:290, y:50},   // 9  casino
      {x:400, y:200},  // 10 waterfront
      {x:430, y:50}    // 11 hills villa
    ];

    function itemById(id){ for(var i=0;i<ITEMS.length;i++) if(ITEMS[i].id===id) return ITEMS[i]; return null; }
    function genreById(id){ for(var i=0;i<GENRES.length;i++) if(GENRES[i].id===id) return GENRES[i]; return null; }

    function loadSave(){
      try{var s=localStorage.getItem(SAVE_KEY); if(s){var d=JSON.parse(s); if(d&&typeof d.cash==="number"&&Array.isArray(d.restaurants)) return d;}}catch(e){}
      return null;
    }
    function saveAll(){ try{localStorage.setItem(SAVE_KEY,JSON.stringify(save));}catch(e){} }
    function freshSave(){
      var seed = Math.floor(Math.random()*4294967296);
      return {v:4, cash:50000, restaurants:[], activeIdx:-1, worldSeed:seed, daysCompleted:0, unlocked:["coffee","toast"]};
    }
    function newRestaurant(locIdx, genreIdx, name){
      var g=GENRES[genreIdx];
      // Auto-unlock the genre's starter menu items so the player can actually serve them
      if(!save.unlocked) save.unlocked=["coffee","toast"];
      for(var u=0;u<g.menu.length;u++){
        if(save.unlocked.indexOf(g.menu[u])<0) save.unlocked.push(g.menu[u]);
      }
      return { name:name, locId:locIdx, genre:g.id, menu:g.menu.slice(),
        mkt:0, truck:0, ups:{}, employees:{}, decor:{}, supplies:40, reviews:[], served:0, revenue:0 };
    }
    function isUnlocked(id){ return (save.unlocked||["coffee","toast"]).indexOf(id)>=0; }
    function decorScore(r){
      if(!r||!r.decor) return 0;
      var s=0;
      for(var i=0;i<DECOR.length;i++) if(r.decor[DECOR[i].id]) s+=DECOR[i].score;
      return s;
    }
    // Manager passive income: ~55% of what an active day would yield, no skill check
    function passiveIncome(r){
      if(!r||!r.employees||!r.employees.manager) return 0;
      var rt=ratingOf(r)||3, loc=LOCS[r.locId];
      var seats=r.ups.seats?1.5:1;
      var dec=1+decorScore(r)*0.06;
      var base=loc.dens*mktMult(r)*seats*(1+(rt-3)*0.25)*dec;
      var quota=base*5+2;
      if(r.employees.host) quota*=1.25;
      var avgPrice=0,cnt=0;
      for(var i=0;i<r.menu.length;i++){
        var it=itemById(r.menu[i]);
        if(it){ avgPrice+=it.sell; cnt++; }
      }
      avgPrice = cnt ? avgPrice/cnt : 5;
      var tierMult=1+LOCS[r.locId].lux*0.6;
      var avgStars=r.employees.marketer?4.0:3.5;
      var avgPay=avgPrice*4*tierMult*(0.4+avgStars*0.12);
      return Math.round(quota*avgPay*0.55);
    }
    function unlockItem(id){
      if(!save.unlocked) save.unlocked=["coffee","toast"];
      if(save.unlocked.indexOf(id)<0) save.unlocked.push(id);
    }
    function activeR(){ return save && save.restaurants[save.activeIdx]; }
    function ratingOf(r){ if(!r||!r.reviews.length)return 0; var s=0; for(var i=0;i<r.reviews.length;i++) s+=r.reviews[i].s; return s/r.reviews.length; }
    function maxSupplies(r){ return TRUCK[r.truck].cap; }
    function mktMult(r){ return MKT[r.mkt].mult; }
    function netWorth(){ if(!save)return 0; var n=save.cash; for(var i=0;i<save.restaurants.length;i++) n+=LOCS[save.restaurants[i].locId].p*0.5; return n|0; }
    function fmt$(n){ n=n|0; if(n>=1000000) return "$"+(n/1000000).toFixed(n%1000000?1:0)+"M";
      if(n>=10000) return "$"+(n/1000).toFixed(0)+"K"; if(n>=1000) return "$"+(n/1000).toFixed(1)+"K"; return "$"+n; }
    function randomName(){
      var a=BRAND_PRE[ri(0,BRAND_PRE.length-1)], b=BRAND_POST[ri(0,BRAND_POST.length-1)];
      return a+" "+b;
    }

    // -------- Fake online world (seeded AI restaurants) --------
    function genWorld(){
      if(!save) return [];
      var seed=save.worldSeed>>>0;
      function rng(){ seed=(seed*1664525+1013904223)>>>0; return seed/4294967296; }
      function pick(arr){ return arr[Math.floor(rng()*arr.length)]; }
      var list=[];
      for(var i=0;i<16;i++){
        var name = pick(BRAND_PRE)+" "+pick(BRAND_POST);
        var city = pick(CITY_NAMES);
        var gIdx = Math.floor(rng()*GENRES.length);
        var lIdx = Math.floor(rng()*LOCS.length);
        var rating = Math.round((1.5+rng()*3.5)*10)/10;
        var bulkAmt = 20+Math.floor(rng()*60);
        var pricePer = 0.8 + rng()*1.6;
        var price = Math.max(15, Math.floor(bulkAmt*pricePer));
        // tier scaling for higher cities
        if(lIdx>=5){ price *= 4; bulkAmt = Math.floor(bulkAmt*1.5); }
        if(lIdx>=7){ price *= 2.5; bulkAmt = Math.floor(bulkAmt*1.5); }
        var hasRecipe = rng()<0.35;
        var recipeId = hasRecipe ? pick(ITEMS).id : null;
        list.push({name:name, city:city, genre:GENRES[gIdx].id, gColor:GENRES[gIdx].c, locId:lIdx,
          rating:rating, supplies:bulkAmt, price:price|0, recipeId:recipeId});
      }
      return list;
    }

    var save=loadSave();
    var screen, sel=0, msg="", msgT=0, nameBuf="";
    var kbSel=0, genreSel=0, mapSel=0, pendingLocIdx=-1;
    var shopItems=[];
    var cust=null, customerT=0;
    var cookActive=false, cookStepIdx=0, cookSteps=1, cookStation=null, cookStepData=null, cookResults=[];
    var worldList=[], worldSel=0;
    var resetConfirm=false;
    var sizzleT=0; // cooking visual effect timer
    var dayState="idle", dayQuota=0, dayServed=0, dayLost=0, dayRev=0;
    var dayPassive=0, dayManaged=0;
    var custWaited=0;
    var mapConfirm=false;

    if(!save){ screen="intro"; }
    else if(save.activeIdx<0||!save.restaurants.length){ screen="map"; }
    else { screen="hub"; }

    function setMsg(s){ msg=s; msgT=2.0; }
    function genCustomer(r){
      if(!r||!r.menu.length) return null;
      // Weight selection by sell price — expensive items get ordered way more often
      var totalW=0, picks=[];
      for(var i=0;i<r.menu.length;i++){
        var it=itemById(r.menu[i]);
        if(!it) continue;
        var w = it.sell;            // raw price as weight (lobster ~21x more likely than coffee)
        picks.push({it:it, w:w});
        totalW += w;
      }
      if(!picks.length) return null;
      var roll = Math.random()*totalW, acc=0;
      for(var j=0;j<picks.length;j++){
        acc += picks[j].w;
        if(roll<=acc) return {item:picks[j].it, waited:0};
      }
      return {item:picks[picks.length-1].it, waited:0};
    }
    function nextCustomer(){ var r=activeR(); cust = (r&&r.supplies>0) ? genCustomer(r) : null; }

    function loadCookStep(){
      var item=cust.item, stId=item.steps[cookStepIdx];
      cookStation=STATIONS[stId];
      var r=activeR(), pro=!!r.ups.stove;
      // Difficulty scales with item value: cheap items are easy, expensive ones are tight
      var diff = Math.min(1.7, 0.6 + item.sell/55);
      var t=cookStation.type;
      if(t==="timing"){
        // shrink green zone around its centre based on difficulty
        var c=(cookStation.lo+cookStation.hi)/2;
        var halfRange=(cookStation.hi-cookStation.lo)/(2*diff);
        cookStepData={ bar:0,
          lo: c - halfRange - (pro?0.04:0),
          hi: c + halfRange + (pro?0.04:0),
          spd: cookStation.spd * diff * (pro?0.82:1) };
      } else if(t==="rhythm"){
        cookStepData={ taps:cookStation.taps, done:0, results:[], pos:0,
          spd: cookStation.spd * diff * (pro?0.85:1),
          zoneW: cookStation.zoneW * (pro?1.4:1) / diff };
      } else if(t==="prec"){
        cookStepData={ pos:0, dir:1,
          spd: cookStation.spd * diff * (pro?0.85:1),
          zone: cookStation.zone * (pro?1.4:1) / diff,
          target: 0.4 + Math.random()*0.2 };
      }
    }

    function startCook(){
      var r=activeR(); if(!cust) return;
      if(r.supplies<=0){ setMsg("OUT OF SUPPLIES"); return; }
      cookActive=true; cookStepIdx=0; cookSteps=cust.item.steps.length; cookResults=[];
      if(r.ups.sous && cookSteps>1){ cookResults.push(0.85); cookStepIdx=1; }
      loadCookStep();
    }

    function recordStepResult(acc){
      cookResults.push(acc);
      cookStepIdx++;
      if(cookStepIdx>=cookSteps) endCook();
      else loadCookStep();
    }

    function tickCook(dt){
      sizzleT+=dt;
      var t=cookStation.type, d=cookStepData;
      if(t==="timing"){
        d.bar += d.spd*dt;
        if(d.bar>=1){ recordStepResult(0); return; }
        if(IN.edge.action){
          var center=(d.lo+d.hi)/2, halfZone=(d.hi-d.lo)/2;
          var dist=Math.abs(d.bar-center);
          var acc = dist<=halfZone ? 1 : Math.max(0, 1-(dist-halfZone)/0.3);
          recordStepResult(acc);
        }
      } else if(t==="prec"){
        d.pos += d.dir*d.spd*dt;
        if(d.pos>=1){ d.pos=1; d.dir=-1; }
        if(d.pos<=0){ d.pos=0; d.dir=1; }
        if(IN.edge.action){
          var dist=Math.abs(d.pos-d.target);
          var acc = dist<=d.zone ? 1 : Math.max(0, 1-(dist-d.zone)/0.3);
          recordStepResult(acc);
        }
      } else if(t==="rhythm"){
        d.pos += d.spd*dt;
        while(d.done < d.taps){
          var tgt=(d.done+1)/(d.taps+1);
          if(d.pos > tgt + d.zoneW){ d.results.push(0); d.done++; }
          else break;
        }
        if(IN.edge.action && d.done < d.taps){
          var tgt2=(d.done+1)/(d.taps+1);
          var dist2=Math.abs(d.pos-tgt2);
          var acc2 = dist2<=d.zoneW ? 1 : Math.max(0, 1-(dist2-d.zoneW)/0.1);
          d.results.push(acc2); d.done++;
        }
        if(d.done>=d.taps || d.pos>=1){
          while(d.results.length<d.taps) d.results.push(0);
          var s=0;
          for(var i=0;i<d.taps;i++) s+=d.results[i];
          recordStepResult(s/d.taps);
        }
      }
    }

    function endCook(){
      cookActive=false;
      var r=activeR();
      r.supplies=Math.max(0, r.supplies-1);
      var sum=0; for(var i=0;i<cookResults.length;i++) sum+=cookResults[i];
      var acc = cookResults.length?sum/cookResults.length:0;
      var stars = acc>=0.85?5:acc>=0.65?4:acc>=0.45?3:acc>=0.25?2:1;
      if(r.ups.decor && stars<5 && Math.random()<0.45) stars++;
      if(r.employees && r.employees.marketer && stars<5 && Math.random()<0.35) stars++;
      if(LOCS[r.locId].lux>=3 && stars<3 && Math.random()<0.3) stars=Math.max(1,stars-1);
      // tier multiplier — higher-tier locations charge way more per dish
      var tierMult = 1 + LOCS[r.locId].lux * 0.6;
      var price = cust.item.sell * 4 * tierMult;
      var cost = cust.item.cost * 2;
      var tip = stars===5?Math.round(price*0.4):stars===4?Math.round(price*0.15):0;
      var pay = stars>=2 ? Math.round(price*(0.4+stars*0.12) - cost + tip) : 0;
      pay = Math.max(0,pay);
      save.cash += pay; r.revenue += pay; r.served++;
      dayServed++; dayRev += pay;
      r.reviews.push({s:stars, w:Date.now(), it:cust.item.id});
      if(r.reviews.length>30) r.reviews.shift();
      // Line cook: same cook serves a second waiting customer for free
      if(r.employees && r.employees.linecook && (dayServed+dayLost) < dayQuota){
        save.cash += pay; r.revenue += pay; r.served++;
        dayServed++; dayRev += pay;
        r.reviews.push({s:stars, w:Date.now(), it:cust.item.id});
        if(r.reviews.length>30) r.reviews.shift();
        setMsg(stars+"★ x2  +"+fmt$(pay*2)+"  LINE COOK");
      } else {
        setMsg(stars+"★  +"+fmt$(pay));
      }
      cust=null;
      saveAll();
    }

    function buildShopItems(){
      var items=[], r=activeR(), bulk=20, sCost=bulk*1;
      items.push({type:"sup", label:"SUPPLIES +"+bulk, sub:"have "+r.supplies+"/"+maxSupplies(r), cost:sCost});
      if(r.truck<TRUCK.length-1){ var nt=TRUCK[r.truck+1];
        items.push({type:"truck", label:"TRUCK "+nt.n, sub:"cap "+TRUCK[r.truck].cap+" → "+nt.cap, cost:nt.cost}); }
      if(r.mkt<MKT.length-1){ var nm=MKT[r.mkt+1];
        items.push({type:"mkt", label:"MKT "+nm.n, sub:"x"+nm.mult.toFixed(1)+" customers", cost:nm.cost}); }
      for(var u=0;u<UPS.length;u++){ var up=UPS[u];
        if(!r.ups[up.id]) items.push({type:"up", upId:up.id, label:up.n, sub:up.desc, cost:up.cost}); }
      items.push({type:"back", label:"BACK", sub:"", cost:0});
      return items;
    }
    function buyShopItem(it){
      var r=activeR();
      if(it.type==="back"){ screen="hub"; sel=0; return true; }
      if(save.cash<it.cost) return false;
      if(it.type==="sup"){ if(r.supplies>=maxSupplies(r)) return false;
        save.cash-=it.cost; r.supplies=Math.min(maxSupplies(r), r.supplies+20); }
      else if(it.type==="truck"){ save.cash-=it.cost; r.truck++; }
      else if(it.type==="mkt"){ save.cash-=it.cost; r.mkt++; }
      else if(it.type==="up"){ save.cash-=it.cost; r.ups[it.upId]=true; }
      saveAll(); return true;
    }
    function commitName(){
      var r=activeR();
      if(r && nameBuf.trim()){ r.name=nameBuf.trim().toUpperCase(); saveAll(); setMsg("RENAMED"); }
      nameBuf=""; kbSel=0;
      screen="hub"; sel=0;
    }

    function buyFromWorld(idx){
      var w=worldList[idx]; if(!w) return false;
      var r=activeR();
      if(save.cash<w.price) return false;
      if(r.supplies>=maxSupplies(r)) return false;
      save.cash-=w.price;
      var got=Math.min(w.supplies, maxSupplies(r)-r.supplies);
      // quality based on rating
      if(w.rating<2.5){ got=Math.floor(got*(0.5+Math.random()*0.3)); }
      r.supplies+=got;
      saveAll();
      setMsg("BOUGHT "+got+" SUPPLIES");
      return true;
    }

    function doReset(){
      try{ localStorage.removeItem(SAVE_KEY); }catch(e){}
      save=null;
      screen="intro";
      sel=0; nameBuf=""; cust=null; cookActive=false;
    }

    // -------- Draw helpers --------
    function drawHeader(showExit){
      rect(0,0,W,30,"#02030f");
      px_txt("$"+save.cash.toLocaleString(),10,18,9,"#46ff9c","left");
      px_txt("CHAIN "+save.restaurants.length,W/2,18,7,"#9b8fc7");
      if(showExit){
        drawExitBtn();
      } else {
        var r=activeR();
        if(r){ var rt=ratingOf(r); px_txt(r.name.slice(0,12)+(rt?" "+rt.toFixed(1)+"★":""),W-10,18,7,"#ffd23e","right"); }
      }
    }
    function drawExitBtn(){
      rect(W-62,4,58,22,"#3a1a3a");
      ctx.strokeStyle="#ff8a8a"; ctx.lineWidth=2;
      ctx.strokeRect(W-62,4,58,22);
      px_txt("✕ EXIT",W-33,18,8,"#ff8a8a");
    }
    function exitBtnClicked(){
      return IN.pclick && IN.px>W-62 && IN.px<W-4 && IN.py>4 && IN.py<26;
    }
    function drawInterior(r){
      // base scene
      var g=ctx.createLinearGradient(0,30,0,170);
      g.addColorStop(0,"#3a2a4a"); g.addColorStop(1,"#5a4a6a");
      ctx.fillStyle=g; ctx.fillRect(0,30,W,140);
      rect(0,170,W,50,"#6a4a2a");
      rect(0,170,W,3,"#8a6a3a");
      // back kitchen counter outline (drawn behind decor)
      rect(W-180,150,170,22,"#3a2a2a");
      rect(W-180,150,170,3,"#5a4a4a");
      // owned decor layered floor → wall → ceiling
      var order=["carpet","artwork","tv","bar","plants","jukebox","booths","tables","lights","chandelier"];
      for(var i=0;i<order.length;i++){
        if(r.decor && r.decor[order[i]]){
          var d=null;
          for(var j=0;j<DECOR.length;j++) if(DECOR[j].id===order[i]){ d=DECOR[j]; break; }
          if(d) d.place();
        }
      }
      // bottom divider
      rect(0,220,W,2,"#27e8ff");
    }

    function drawCustomer(x,y){
      rect(x-12,y-30,24,4,"#9b6bff");
      fillC("#ffd9a8");ctx.beginPath();ctx.arc(x,y-16,12,0,7);ctx.fill();
      fillC("#0a0613");ctx.beginPath();ctx.arc(x-4,y-18,1.5,0,7);ctx.arc(x+4,y-18,1.5,0,7);ctx.fill();
      strokeC("#0a0613",1.5);ctx.beginPath();ctx.arc(x,y-14,5,0.2,Math.PI-0.2);ctx.stroke();
      rect(x-14,y-4,28,30,"#27e8ff");
    }
    function drawSpeechBubble(cx,cy,iconItem){
      var bw=70,bh=70, bx=cx-bw/2, by=cy-bh-10;
      fillC("#fff");
      ctx.beginPath();
      ctx.moveTo(bx,by+bh-12);
      ctx.lineTo(bx,by);
      ctx.lineTo(bx+bw,by);
      ctx.lineTo(bx+bw,by+bh-12);
      ctx.lineTo(cx+8,by+bh-12);
      ctx.lineTo(cx,by+bh);
      ctx.lineTo(cx-8,by+bh-12);
      ctx.closePath();
      ctx.fill();
      strokeC("#0a0613",2);
      ctx.stroke();
      // food sprite inside
      drawFood(iconItem, bx+6, by+6, bw-12);
    }

    function drawDishProgress(){
      // Show recipe chain at top: completed steps in green, current yellow, pending gray
      var item = cust && cust.item;
      if(!item) return;
      var n = item.steps.length;
      var sz = 22, gap=8;
      var total = n*sz + (n-1)*gap;
      var startX = W/2 - total/2;
      for(var i=0;i<n;i++){
        var bx = startX + i*(sz+gap);
        var by = 42;
        var fill = i<cookStepIdx ? "#46ff9c" : (i===cookStepIdx ? "#ffd23e" : "#3a2a6b");
        rect(bx,by,sz,sz,fill);
        var lbl = STATIONS[item.steps[i]].label.slice(0,3);
        px_txt(lbl, bx+sz/2, by+sz-6, 5, i<cookStepIdx ? "#0a0613" : i===cookStepIdx ? "#0a0613" : "#cdbff0");
      }
    }
    function drawCookStep(){
      var t=cookStation.type, d=cookStepData, item=cust.item;
      drawDishProgress();
      // Left: tool sprite for this station (stove, salt, knife, etc.)
      var txc = W/2-100, tyc=70;
      rect(txc-2,tyc-2,60,60,"#0a0613");
      strokeC("#3a2a6b",1); ctx.strokeRect(txc-2,tyc-2,60,60);
      drawTool(cookStation.icon, txc, tyc, 56);
      // Right: the dish itself
      var sxc = W/2+44, syc=70;
      rect(sxc-2,syc-2,60,60,"#0a0613");
      strokeC("#3a2a6b",1); ctx.strokeRect(sxc-2,syc-2,60,60);
      drawFood(item.id, sxc, syc, 56);
      // sizzle/sparkle/steam from tool toward dish
      if(t==="timing"){
        fillC("#ff8a3e");
        for(var i=0;i<5;i++){
          var px2 = txc+30 + ((sizzleT*40+i*18)%80);
          var py2 = tyc+30 - Math.abs(Math.sin(sizzleT*3+i)*10);
          ctx.beginPath();ctx.arc(px2,py2,2,0,7);ctx.fill();
        }
      } else if(t==="rhythm"){
        strokeC("#fff",2);
        var kx=txc+30+Math.sin(sizzleT*8)*10;
        ctx.beginPath();ctx.moveTo(kx-5,tyc+20);ctx.lineTo(kx+5,tyc+10);ctx.stroke();
      } else if(t==="prec"){
        fillC("#27e8ff");
        ctx.beginPath();ctx.arc(txc+55+Math.sin(sizzleT*4)*4,tyc+30,3,0,7);ctx.fill();
      }
      px_txt(cookStation.label+" • "+item.n,W/2,92,9,"#ffd23e");
      px_txt("STEP "+(cookStepIdx+1)+"/"+cookSteps,W/2,108,6,"#9b8fc7");
      // minigame bar
      var bw=320, bh=28, bx=W/2-bw/2, by=148;
      rect(bx,by,bw,bh,"#160a26");
      strokeC("#3a2a6b",2); ctx.strokeRect(bx,by,bw,bh);
      if(t==="timing"){
        rect(bx+d.lo*bw, by, (d.hi-d.lo)*bw, bh, "#46ff9c");
        rect(bx+d.bar*bw-2, by-4, 4, bh+8, "#27e8ff");
        px_txt("PRESS A IN THE GREEN!",W/2,200,9,"#46ff9c");
      } else if(t==="prec"){
        rect(bx+(d.target-d.zone)*bw, by, d.zone*2*bw, bh, "#46ff9c");
        rect(bx+d.pos*bw-2, by-4, 4, bh+8, "#27e8ff");
        px_txt("PRESS A WHEN ON TARGET!",W/2,200,9,"#46ff9c");
      } else if(t==="rhythm"){
        for(var i=0;i<d.taps;i++){
          var tgt=(i+1)/(d.taps+1);
          var col = i<d.done
            ? (d.results[i]>=0.7?"#46ff9c":d.results[i]>0?"#ffd23e":"#ff3ea5")
            : "#ffd23e";
          rect(bx+tgt*bw-2, by-6, 4, bh+12, col);
        }
        rect(bx+d.pos*bw-2, by-4, 4, bh+8, "#27e8ff");
        px_txt("TAP A ON EACH MARKER!",W/2,200,9,"#46ff9c");
        px_txt("HITS "+d.done+"/"+d.taps,W/2,218,7,"#9b8fc7");
      }
    }

    function drawMap(){
      var top=30, bot=228;
      var g=ctx.createLinearGradient(0,top,0,bot);
      g.addColorStop(0,"#0a1430"); g.addColorStop(0.5,"#1a0e30"); g.addColorStop(1,"#0a0613");
      ctx.fillStyle=g; ctx.fillRect(0,top,W,bot-top);
      fillC("#2a1a3a");
      ctx.beginPath();ctx.moveTo(280,top+30);ctx.lineTo(360,top+10);ctx.lineTo(420,top+18);ctx.lineTo(W,top+38);ctx.lineTo(W,top+60);ctx.lineTo(280,top+60);ctx.closePath();ctx.fill();
      strokeC("rgba(155,107,255,0.18)",1);
      for(var x=0; x<W; x+=40) { ctx.beginPath(); ctx.moveTo(x,top+60); ctx.lineTo(x,bot-25); ctx.stroke(); }
      for(var y=top+60; y<=bot-25; y+=22) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }
      rect(0,bot-25,W,25,"#1a3a5a");
      strokeC("rgba(39,232,255,0.4)",1);
      for(var i=0;i<2;i++){
        var wy=bot-18+i*8;
        ctx.beginPath();
        for(var wx=0;wx<W;wx+=14){ ctx.lineTo(wx+7, wy + (i%2)*2); }
        ctx.stroke();
      }
      fillC("#3a2a1a");
      ctx.fillRect(0,bot-25,120,25);
      for(var i=0; i<LOC_PINS.length; i++){
        var pin=LOC_PINS[i], can=save.cash>=LOCS[i].p, hi=i===mapSel;
        ctx.fillStyle = can ? (hi?"#46ff9c":"#ffd23e") : "#ff3ea5";
        ctx.beginPath(); ctx.arc(pin.x, pin.y, hi?7:5, 0, 7); ctx.fill();
        if(hi){
          strokeC("#fff",2);
          ctx.beginPath();ctx.arc(pin.x,pin.y,11,0,7);ctx.stroke();
        }
        px_txt(LOCS[i].n.slice(0,5).toUpperCase(), pin.x, pin.y-12, 5, can?"#fff":"#ff8a8a");
      }
      px_txt("PICK A LOCATION",W/2,46,10,"#27e8ff");
    }

    function drawMapDetail(){
      var py=232, ph=H-py-8;
      rect(0,py-2,W,2,"#27e8ff");
      rect(0,py,W,ph,"#02030f");
      var ix=8,iy=py+8,iw=112,ih=ph-16;
      rect(ix,iy,iw,ih,"#0a0613");
      strokeC("#3a2a6b",1);ctx.strokeRect(ix,iy,iw,ih);
      LOC_DRAW[mapSel](ix,iy,iw,ih);
      var tx=ix+iw+10;
      var l=LOCS[mapSel];
      px_txt(l.n,tx,py+22,9,"#ffd23e","left");
      px_txt(fmt$(l.p),tx,py+42,11,save.cash>=l.p?"#46ff9c":"#ff8a8a","left");
      var words=l.desc.split(" "), line="", lineY=py+60;
      for(var i=0;i<words.length;i++){
        if((line+" "+words[i]).length > 32){
          px_txt(line,tx,lineY,6,"#cdbff0","left");
          line=words[i]; lineY+=11;
        } else {
          line = line ? line+" "+words[i] : words[i];
        }
      }
      if(line) px_txt(line,tx,lineY,6,"#cdbff0","left");
      var canBuy=save.cash>=l.p;
      px_txt(canBuy?"A: BUY":"NOT ENOUGH",tx,py+ph-8,7,canBuy?"#46ff9c":"#ff3ea5","left");
      px_txt("◄ ► / ▲ ▼ TO PICK",W/2,py+ph-2,5,"#5a7a9a");
    }

    function drawGenreScreen(){
      px_txt("CHOOSE YOUR CUISINE",W/2,46,11,"#ffd23e");
      var cw=110, ch=72;
      for(var i=0;i<GENRES.length;i++){
        var col=i%4, row=Math.floor(i/4);
        var bx=10+col*(cw+6), by=72+row*(ch+8);
        var hi=i===genreSel, gn=GENRES[i];
        rect(bx,by,cw,ch,hi?"#1a2350":"#160a26");
        strokeC(hi?gn.c:"#3a2a6b",2);ctx.strokeRect(bx,by,cw,ch);
        fillC(gn.c);
        rect(bx+cw/2-12,by+8,24,24,gn.c);
        px_txt(gn.n,bx+cw/2,by+ch-22,7,hi?"#fff":"#cdbff0");
        var preview="";
        for(var k=0;k<gn.menu.length&&k<3;k++){ var it=itemById(gn.menu[k]); if(it){ preview += (k?" ":"")+it.n.slice(0,3); } }
        px_txt(preview,bx+cw/2,by+ch-8,5,"#9b8fc7");
      }
      px_txt("◄ ► ▲ ▼   A: SELECT",W/2,H-14,7,"#46ff9c");
    }

    function drawKeyboard(){
      rect(W/2-160,46,320,30,"#160a26");
      strokeC("#27e8ff",2);ctx.strokeRect(W/2-160,46,320,30);
      px_txt((nameBuf||"")+"_",W/2,68,11,"#fff");
      var kbY=92, cellW=(W-32)/7, cellH=28;
      for(var i=0;i<28;i++){
        var col=i%7, row=Math.floor(i/7);
        var x=16+col*cellW, y=kbY+row*cellH;
        var hi=i===kbSel;
        rect(x+1,y+1,cellW-2,cellH-2,hi?"#1a3a52":"#160a26");
        strokeC(hi?"#27e8ff":"#3a2a6b",1.5);ctx.strokeRect(x+1,y+1,cellW-2,cellH-2);
        var c=KB_KEYS[i];
        var label = c==="<" ? "DEL" : c==="_" ? "SP" : c;
        px_txt(label, x+cellW/2, y+cellH/2+4, c.length>1?7:10, hi?"#fff":"#cdbff0");
      }
      // Bottom buttons: CONFIRM (left) + RANDOM (right)
      var btnY = kbY + 4*cellH + 8, btnH = 24, btnW = 130;
      var lbx = W/2 - btnW - 6;
      var rbx = W/2 + 6;
      var okHi = kbSel === -1, rdHi = kbSel === -2;
      rect(lbx, btnY, btnW, btnH, okHi?"#1a3a20":"#10241a");
      strokeC(okHi?"#46ff9c":"#3a2a6b",2);ctx.strokeRect(lbx,btnY,btnW,btnH);
      px_txt("CONFIRM",lbx+btnW/2,btnY+16,8,okHi?"#fff":"#46ff9c");
      rect(rbx, btnY, btnW, btnH, rdHi?"#3a1a3a":"#241a24");
      strokeC(rdHi?"#ff8a3e":"#3a2a6b",2);ctx.strokeRect(rbx,btnY,btnW,btnH);
      px_txt("RANDOM",rbx+btnW/2,btnY+16,8,rdHi?"#fff":"#ff8a3e");
    }

    function drawWorld(){
      px_txt("ONLINE MARKETPLACE",W/2,46,11,"#27e8ff");
      px_txt("BUY SUPPLIES FROM OTHER OWNERS",W/2,62,6,"#9b8fc7");
      var top=78, h=24, max=Math.min(worldList.length,10);
      var startIdx=Math.max(0, Math.min(worldList.length-max, worldSel-Math.floor(max/2)));
      for(var i=0;i<max;i++){
        var idx=startIdx+i, w=worldList[idx], y=top+i*h, hi=idx===worldSel;
        if(hi) rect(8,y-13,W-16,h,"#1a2350");
        // genre color chip
        fillC(w.gColor); ctx.fillRect(12,y-7,12,12);
        px_txt(w.name,30,y+3,7,hi?"#fff":"#cdbff0","left");
        px_txt(w.city+" · "+(w.rating.toFixed(1))+"★",30,y+14,5,w.rating>=4?"#46ff9c":w.rating>=2.5?"#ffd23e":"#ff8a8a","left");
        px_txt(w.supplies+" SUP",W-100,y+3,7,"#27e8ff","right");
        px_txt(fmt$(w.price),W-12,y+3,8,save.cash>=w.price?"#ffd23e":"#ff8a8a","right");
      }
      px_txt("◄ BACK   A: BUY",W/2,H-10,7,"#46ff9c");
    }

    function drawReset(){
      ctx.save();ctx.globalAlpha=.92;rect(0,0,W,H,"#0a0613");ctx.restore();
      px_txt("RESET GAME?",W/2,120,16,"#ff3ea5");
      px_txt("This will WIPE your save:",W/2,160,8,"#fff");
      px_txt("cash, restaurants, upgrades.",W/2,178,8,"#fff");
      px_txt("Can't be undone.",W/2,200,8,"#ff8a8a");
      px_txt("A: CONFIRM RESET   ◄ CANCEL",W/2,260,9,"#46ff9c");
    }

    return {
      score:0, over:false,
      onkey:function(k){
        if(screen==="rename"){
          if(k==="ENTER") commitName();
          else if(k==="BACK") nameBuf=nameBuf.slice(0,-1);
          else if(nameBuf.length<16 && /^[A-Z]$/.test(k)) nameBuf+=k;
          return;
        }
        if(k==="A"||k==="Z"||k==="J"||k==="ENTER") IN.edge.action=1;
      },
      update:function(dt){
        if(msgT>0) msgT-=dt;
        this.score = netWorth();

        if(screen==="intro"){
          if(IN.edge.action){ save=freshSave(); saveAll(); screen="map"; mapSel=0; }
          return;
        }

        // Universal EXIT button — tap the X in the corner to leave any sub-screen
        if(screen!=="hub" && exitBtnClicked()){
          if(dayState==="summary"){ save.daysCompleted=(save.daysCompleted||0)+1; }
          cookActive=false; cust=null; mapConfirm=false;
          dayState="idle"; dayQuota=0;
          screen="hub"; sel=0; saveAll();
          return;
        }

        if(screen==="reset"){
          if(IN.edge.action){ doReset(); return; }
          if(IN.edge.left){ screen="hub"; sel=0; return; }
          return;
        }

        if(screen==="map"){
          if(mapConfirm){
            if(IN.edge.action){
              var l=LOCS[mapSel];
              save.cash-=l.p;
              pendingLocIdx=mapSel; genreSel=0;
              screen="genre"; mapConfirm=false; saveAll();
              setMsg("BOUGHT! PICK A CUISINE");
            }
            if(IN.edge.left){ mapConfirm=false; setMsg("CANCELLED"); }
            return;
          }
          if(IN.edge.up) mapSel=(mapSel+LOCS.length-1)%LOCS.length;
          if(IN.edge.down) mapSel=(mapSel+1)%LOCS.length;
          if(IN.edge.right) mapSel=(mapSel+1)%LOCS.length;
          if(IN.edge.left){
            if(save.activeIdx>=0){ screen="hub"; sel=0; return; }
            mapSel=(mapSel+LOCS.length-1)%LOCS.length;
          }
          if(IN.edge.action){
            var l=LOCS[mapSel];
            if(save.cash>=l.p){ mapConfirm=true; }
            else setMsg("NOT ENOUGH CASH");
          }
          return;
        }

        if(screen==="genre"){
          if(IN.edge.right) genreSel=(genreSel+1)%GENRES.length;
          if(IN.edge.left) genreSel=(genreSel+GENRES.length-1)%GENRES.length;
          if(IN.edge.up) genreSel=(genreSel+GENRES.length-4)%GENRES.length;
          if(IN.edge.down) genreSel=(genreSel+4)%GENRES.length;
          if(IN.edge.action){
            var r=newRestaurant(pendingLocIdx, genreSel, "RESTAURANT "+(save.restaurants.length+1));
            save.restaurants.push(r);
            save.activeIdx=save.restaurants.length-1;
            saveAll();
            screen="rename"; kbSel=0; nameBuf="";
          }
          return;
        }

        if(screen==="rename"){
          if(kbSel===-1){
            if(IN.edge.up) kbSel=24;
            if(IN.edge.right) kbSel=-2;
            if(IN.edge.action) commitName();
          } else if(kbSel===-2){
            if(IN.edge.up) kbSel=26;
            if(IN.edge.left) kbSel=-1;
            if(IN.edge.action){ nameBuf=randomName().slice(0,16); }
          } else {
            var col=kbSel%7, row=Math.floor(kbSel/7);
            if(IN.edge.left) kbSel = row*7 + (col===0?6:col-1);
            if(IN.edge.right) kbSel = row*7 + (col===6?0:col+1);
            if(IN.edge.up && row>0) kbSel-=7;
            if(IN.edge.down){
              if(row<3) kbSel+=7;
              else kbSel = col<4 ? -1 : -2;
            }
            if(IN.edge.action){
              var c=KB_KEYS[kbSel];
              if(c==="<") nameBuf=nameBuf.slice(0,-1);
              else if(c==="_"){ if(nameBuf.length<16) nameBuf+=" "; }
              else if(nameBuf.length<16) nameBuf+=c;
            }
          }
          return;
        }

        if(screen==="hub"){
          var opts=["SERVICE","MENU","STAFF","INTERIOR","SHOP","WORLD","REVIEWS","TRAVEL","BUY LOCATION","RENAME","RESET","QUIT"];
          if(IN.edge.up) sel=(sel+opts.length-1)%opts.length;
          if(IN.edge.down) sel=(sel+1)%opts.length;
          if(IN.edge.action){
            var o=opts[sel];
            if(o==="SERVICE"){ screen="service"; customerT=1.2; cust=null; cookActive=false; }
            else if(o==="MENU"){ screen="menu"; sel=0; }
            else if(o==="STAFF"){ screen="staff"; sel=0; }
            else if(o==="INTERIOR"){ screen="interior"; sel=0; }
            else if(o==="SHOP"){ screen="shop"; sel=0; shopItems=buildShopItems(); }
            else if(o==="WORLD"){ screen="world"; worldList=genWorld(); worldSel=0; }
            else if(o==="REVIEWS"){ screen="reviews"; }
            else if(o==="TRAVEL"){ screen="travel"; sel=save.activeIdx; }
            else if(o==="BUY LOCATION"){ screen="map"; mapSel=0; }
            else if(o==="RENAME"){ screen="rename"; kbSel=0; nameBuf=activeR().name||""; }
            else if(o==="RESET"){ screen="reset"; }
            else if(o==="QUIT"){ saveAll(); this.over=true; }
          }
          return;
        }

        if(screen==="service"){
          if(dayState==="idle"){
            var r=activeR(), rt=ratingOf(r)||3, loc=LOCS[r.locId];
            var seats=r.ups.seats?1.5:1;
            var dec = 1 + decorScore(r)*0.06;     // each decor point = +6% customers
            var base=loc.dens*mktMult(r)*seats*(1+(rt-3)*0.25)*dec;
            dayQuota=Math.max(3, Math.round(base*5*(0.85+Math.random()*0.3)+2));
            if(r.employees && r.employees.host) dayQuota = Math.round(dayQuota*1.25);
            dayServed=0; dayLost=0; dayRev=0;
            dayState="running"; customerT=1.0; cust=null; cookActive=false; custWaited=0;
          }
          if(dayState==="summary"){
            if(IN.edge.action){
              save.daysCompleted=(save.daysCompleted||0)+1;
              dayState="idle"; dayQuota=0;
              saveAll();
              return;
            }
            if(IN.edge.left){ screen="hub"; sel=0; dayState="idle"; dayQuota=0; saveAll(); return; }
            return;
          }
          if(IN.edge.left){ screen="hub"; sel=0; cookActive=false; cust=null; saveAll(); return; }
          if(cookActive){
            tickCook(dt);
          } else if(cust){
            custWaited+=dt;
            var rA=activeR();
            var patience = (rA.employees && rA.employees.waiter) ? 15 : 9;
            if(custWaited>patience){
              cust=null; custWaited=0; dayLost++;
              var rr=activeR();
              rr.reviews.push({s:1, w:Date.now(), it:"-"});
              if(rr.reviews.length>30) rr.reviews.shift();
              setMsg("WALKED OFF - 1★");
              saveAll();
            } else if(IN.edge.action){ startCook(); custWaited=0; }
          } else {
            if(dayServed+dayLost >= dayQuota){
              dayState="summary";
              // Payouts from managers at the OTHER restaurants you're not working at today
              dayPassive=0; dayManaged=0;
              if(save.restaurants.length>1){
                for(var pi=0; pi<save.restaurants.length; pi++){
                  if(pi===save.activeIdx) continue;
                  var pr=save.restaurants[pi];
                  if(pr.employees && pr.employees.manager){
                    var inc=passiveIncome(pr);
                    if(inc>0){ pr.revenue+=inc; dayPassive+=inc; dayManaged++; }
                  }
                }
                if(dayPassive>0){ save.cash+=dayPassive; saveAll(); }
              }
              return;
            }
            customerT-=dt;
            if(customerT<=0){
              var r=activeR(), loc=LOCS[r.locId];
              customerT=Math.max(0.9, 3.2/(loc.dens*mktMult(r)));
              nextCustomer();
              if(!cust){ dayLost++; setMsg("NO SUPPLIES - LEFT"); }
              else { custWaited=0; }
            }
          }
          return;
        }

        if(screen==="menu"){
          if(IN.edge.up) sel=(sel+ITEMS.length-1)%ITEMS.length;
          if(IN.edge.down) sel=(sel+1)%ITEMS.length;
          if(IN.edge.action){
            var rr=activeR(), item=ITEMS[sel], id=item.id;
            if(!isUnlocked(id)){
              if(save.cash >= item.unlock){
                save.cash -= item.unlock;
                unlockItem(id);
                if(rr.menu.indexOf(id)<0) rr.menu.push(id);
                setMsg("UNLOCKED "+item.n);
              } else setMsg("NOT ENOUGH CASH");
            } else {
              var idx=rr.menu.indexOf(id);
              if(idx>=0){ if(rr.menu.length>1) rr.menu.splice(idx,1); else setMsg("KEEP AT LEAST 1 ITEM"); }
              else rr.menu.push(id);
            }
            saveAll();
          }
          if(IN.edge.left){ screen="hub"; sel=0; }
          return;
        }

        if(screen==="staff"){
          if(exitBtnClicked()){ screen="hub"; sel=0; return; }
          if(IN.edge.up) sel=(sel+EMPLOYEES.length-1)%EMPLOYEES.length;
          if(IN.edge.down) sel=(sel+1)%EMPLOYEES.length;
          if(IN.edge.action){
            var rr=activeR(), emp=EMPLOYEES[sel];
            if(rr.employees && rr.employees[emp.id]) setMsg("ALREADY HIRED");
            else if(save.cash>=emp.cost){
              save.cash-=emp.cost;
              if(!rr.employees) rr.employees={};
              rr.employees[emp.id]=true;
              saveAll();
              setMsg("HIRED "+emp.n);
            } else setMsg("NOT ENOUGH CASH");
          }
          if(IN.edge.left){ screen="hub"; sel=0; }
          return;
        }

        if(screen==="interior"){
          if(exitBtnClicked()){ screen="hub"; sel=0; return; }
          if(IN.edge.up) sel=(sel+DECOR.length-1)%DECOR.length;
          if(IN.edge.down) sel=(sel+1)%DECOR.length;
          if(IN.edge.action){
            var rr2=activeR(), dc=DECOR[sel];
            if(rr2.decor && rr2.decor[dc.id]) setMsg("ALREADY OWNED");
            else if(save.cash>=dc.cost){
              save.cash-=dc.cost;
              if(!rr2.decor) rr2.decor={};
              rr2.decor[dc.id]=true;
              saveAll();
              setMsg("INSTALLED "+dc.n);
            } else setMsg("NOT ENOUGH CASH");
          }
          if(IN.edge.left){ screen="hub"; sel=0; }
          return;
        }

        if(screen==="shop"){
          if(IN.edge.up) sel=(sel+shopItems.length-1)%shopItems.length;
          if(IN.edge.down) sel=(sel+1)%shopItems.length;
          if(IN.edge.action){
            var it=shopItems[sel];
            if(buyShopItem(it)){ if(it.type!=="back"){ shopItems=buildShopItems(); setMsg("BOUGHT"); } }
            else setMsg("CAN'T BUY THAT");
          }
          if(IN.edge.left){ screen="hub"; sel=0; }
          return;
        }

        if(screen==="world"){
          if(IN.edge.up) worldSel=(worldSel+worldList.length-1)%worldList.length;
          if(IN.edge.down) worldSel=(worldSel+1)%worldList.length;
          if(IN.edge.action){
            if(buyFromWorld(worldSel)){ /* msg set */ }
            else setMsg("CAN'T BUY (CASH OR FULL)");
          }
          if(IN.edge.left){ screen="hub"; sel=0; }
          return;
        }

        if(screen==="reviews"){
          if(IN.edge.left||IN.edge.action){ screen="hub"; sel=0; }
          return;
        }

        if(screen==="travel"){
          if(!save.restaurants.length){ screen="map"; mapSel=0; return; }
          if(IN.edge.up) sel=(sel+save.restaurants.length-1)%save.restaurants.length;
          if(IN.edge.down) sel=(sel+1)%save.restaurants.length;
          if(IN.edge.action){ save.activeIdx=sel; saveAll(); screen="hub"; sel=0; setMsg("TRAVELED"); }
          if(IN.edge.left){ screen="hub"; sel=0; }
          return;
        }
      },
      draw:function(){
        clear("#0a0820","#160a26");

        if(screen==="intro"){
          px_txt("DINER EMPIRE",W/2,80,18,"#ffd23e");
          px_txt("OFFLINE RESTAURANT TYCOON",W/2,110,7,"#27e8ff");
          px_txt("Your progress saves automatically.",W/2,150,8,"#46ff9c");
          px_txt("Start with $50,000.",W/2,170,8,"#fff");
          px_txt("Pick a location on the map,",W/2,196,7,"#cdbff0");
          px_txt("choose a cuisine, name your place,",W/2,210,7,"#cdbff0");
          px_txt("cook orders, grow your chain.",W/2,224,7,"#cdbff0");
          px_txt("PRESS A TO BEGIN",W/2,272,11,"#46ff9c");
          return;
        }

        drawHeader(screen!=="hub");

        if(screen==="map"){
          drawMap();
          drawMapDetail();
          if(mapConfirm){
            var l=LOCS[mapSel];
            ctx.save();ctx.globalAlpha=.88;rect(0,0,W,H,"#02030f");ctx.restore();
            px_txt("CONFIRM PURCHASE?",W/2,90,12,"#ffd23e");
            // image preview
            rect(W/2-70,110,140,90,"#0a0613");
            ctx.strokeStyle="#27e8ff";ctx.lineWidth=2;ctx.strokeRect(W/2-70,110,140,90);
            LOC_DRAW[mapSel](W/2-70,110,140,90);
            px_txt(l.n,W/2,222,9,"#fff");
            px_txt(fmt$(l.p),W/2,244,13,"#46ff9c");
            px_txt("A: BUY   ◄ CANCEL",W/2,H-22,9,"#46ff9c");
          }
          if(msgT>0) px_txt(msg,W/2,H-2,6,"#ff8a8a");
          return;
        }

        if(screen==="genre"){
          drawGenreScreen();
          return;
        }

        if(screen==="rename"){
          px_txt("NAME YOUR RESTAURANT",W/2,42,9,"#ffd23e");
          drawKeyboard();
          return;
        }

        if(screen==="reset"){
          drawReset();
          return;
        }

        if(screen==="hub"){
          var r=activeR();
          var rg=genreById(r.genre);
          px_txt((r.name||"UNNAMED").toUpperCase().slice(0,20),W/2,50,11,"#ffd23e");
          px_txt(LOCS[r.locId].n+(rg?" · "+rg.n:""),W/2,68,7,"#9b8fc7");
          var rat=ratingOf(r);
          px_txt("DAY "+((save.daysCompleted||0)+1),W/2,82,7,"#27e8ff");
          px_txt(rat?rat.toFixed(1)+"★":"NO REVIEWS",96,96,7,rat>=4?"#46ff9c":rat>=2.5?"#ffd23e":"#ff8a8a");
          px_txt("SERVED "+r.served,W/2,96,7,"#27e8ff");
          px_txt("SUP "+r.supplies+"/"+maxSupplies(r),W-96,96,7,r.supplies>10?"#fff":"#ff8a8a");
          var opts=["SERVICE","MENU","STAFF","INTERIOR","SHOP","WORLD","REVIEWS","TRAVEL","BUY LOCATION","RENAME","RESET","QUIT"];
          var top=108, h=16;
          for(var i=0;i<opts.length;i++){
            var y=top+i*h, hi=i===sel;
            if(hi) rect(W/2-114,y-11,228,h,"#1a2350");
            var col = hi?"#fff" : (opts[i]==="RESET"?"#ff8a8a":"#cdbff0");
            px_txt(opts[i],W/2,y+2,8,col);
          }
          if(msgT>0) px_txt(msg,W/2,H-10,7,"#46ff9c");
          return;
        }

        if(screen==="service"){
          var r=activeR();
          rect(0,30,W,H-30,"#080518");
          // day banner
          var dayN=(save.daysCompleted||0)+1;
          rect(0,30,W,18,"#1a0a26");
          px_txt("DAY "+dayN+"   "+(dayServed+dayLost)+"/"+dayQuota+" CUSTOMERS   "+fmt$(dayRev)+" EARNED",W/2,44,7,"#27e8ff");
          // summary screen
          if(dayState==="summary"){
            rect(20,70,W-40,H-100,"#0a0613");
            ctx.strokeStyle="#ffd23e"; ctx.lineWidth=2; ctx.strokeRect(20,70,W-40,H-100);
            px_txt("DAY "+dayN+" COMPLETE!",W/2,96,12,"#ffd23e");
            px_txt("SERVED: "+dayServed,W/2,128,9,"#46ff9c");
            px_txt("WALKED OFF: "+dayLost,W/2,150,9,dayLost>0?"#ff8a8a":"#9b8fc7");
            px_txt("REVENUE: "+fmt$(dayRev),W/2,176,11,"#ffd23e");
            if(dayPassive>0){
              px_txt("MANAGERS ("+dayManaged+"): +"+fmt$(dayPassive),W/2,198,8,"#27e8ff");
              px_txt("TOTAL: "+fmt$(dayRev+dayPassive),W/2,214,9,"#46ff9c");
            }
            var rt=ratingOf(r);
            px_txt(rt?"RATING "+rt.toFixed(1)+"★":"",W/2,234,7,rt>=4?"#46ff9c":rt>=2.5?"#ffd23e":"#ff8a8a");
            px_txt("A: NEXT DAY   ◄ EXIT",W/2,H-50,9,"#46ff9c");
            return;
          }
          rect(0,200,W,4,"#3a2a6b");
          px_txt(r.name.toUpperCase().slice(0,18),W/2,66,8,"#ffd23e");
          px_txt("◄ EXIT",80,H-10,7,"#9b8fc7","left");
          px_txt("SUP "+r.supplies,W-12,H-10,7,r.supplies>10?"#27e8ff":"#ff8a8a","right");
          if(cookActive) drawCookStep();
          else if(cust){
            drawCustomer(W/2,178);
            drawSpeechBubble(W/2,160,cust.item.id);
            px_txt(cust.item.n,W/2,116,9,"#fff");
            var stepsStr="";
            for(var k=0;k<cust.item.steps.length;k++){
              if(k) stepsStr+=" → ";
              stepsStr+=STATIONS[cust.item.steps[k]].label;
            }
            px_txt(stepsStr,W/2,130,5,"#9b8fc7");
            // patience bar
            var patience = (r.employees && r.employees.waiter) ? 15 : 9;
            var pw=200, pbx=W/2-pw/2, pby=H-40, frac=Math.max(0,Math.min(1,1-custWaited/patience));
            rect(pbx,pby,pw,4,"#3a2a6b");
            rect(pbx,pby,pw*frac,4,frac>0.5?"#46ff9c":frac>0.25?"#ffd23e":"#ff3ea5");
            px_txt("PRESS A TO COOK",W/2,235,9,"#46ff9c");
          } else {
            px_txt("NEXT CUSTOMER ARRIVING...",W/2,160,9,"#9b8fc7");
            if(r.supplies<=0) px_txt("OUT OF SUPPLIES - HIT SHOP",W/2,180,8,"#ff8a8a");
          }
          if(msgT>0) px_txt(msg,W/2,92,10,msg.indexOf("★")>=0?"#ffd23e":"#46ff9c");
          return;
        }

        if(screen==="menu"){
          px_txt("MENU EDITOR",W/2,46,11,"#27e8ff");
          var r=activeR();
          var top=70, h=20;
          for(var i=0;i<ITEMS.length;i++){
            var item=ITEMS[i], y=top+i*h, hi=i===sel;
            var unlocked=isUnlocked(item.id), on=r.menu.indexOf(item.id)>=0;
            if(hi) rect(8,y-14,W-16,h,"#1a2350");
            drawFood(item.id, 12, y-12, 18);
            if(unlocked){
              px_txt((on?"[X] ":"[ ] ")+item.n, 38, y+2, 7, on?"#46ff9c":"#9b8fc7","left");
              px_txt("$"+item.sell+"  "+item.steps.length+"STEP", W-12, y+2, 6, "#ffd23e","right");
            } else {
              var can=save.cash>=item.unlock;
              px_txt("[$] "+item.n, 38, y+2, 7, can?"#ffaa5a":"#5a4a7a","left");
              px_txt("UNLOCK "+fmt$(item.unlock), W-12, y+2, 6, can?"#46ff9c":"#ff8a8a","right");
            }
          }
          px_txt("◄ BACK   A: BUY / TOGGLE",W/2,H-10,7,"#46ff9c");
          if(msgT>0) px_txt(msg,W/2,H-22,7,"#ff8a8a");
          return;
        }

        if(screen==="staff"){
          px_txt("STAFF — HIRE TO SCALE UP",W/2,46,10,"#27e8ff");
          var r=activeR();
          var top=84, h=46;
          for(var i=0;i<EMPLOYEES.length;i++){
            var emp=EMPLOYEES[i], y=top+i*h, hi=i===sel;
            var hired = r.employees && r.employees[emp.id];
            if(hi) rect(8,y-14,W-16,h-4,"#1a2350");
            ctx.strokeStyle=hi?"#27e8ff":(hired?"#46ff9c":"#3a2a6b");ctx.lineWidth=1;
            ctx.strokeRect(8,y-14,W-16,h-4);
            px_txt(emp.n,16,y+2,9,hired?"#46ff9c":hi?"#fff":"#cdbff0","left");
            px_txt(emp.desc,16,y+18,5,"#9b8fc7","left");
            if(hired) px_txt("HIRED",W-16,y+2,8,"#46ff9c","right");
            else px_txt(fmt$(emp.cost),W-16,y+2,9,save.cash>=emp.cost?"#ffd23e":"#ff8a8a","right");
          }
          px_txt("◄ BACK   A: HIRE",W/2,H-10,7,"#46ff9c");
          if(msgT>0) px_txt(msg,W/2,H-22,7,"#46ff9c");
          return;
        }

        if(screen==="interior"){
          var r=activeR();
          drawInterior(r);
          // header info row
          px_txt("INTERIOR — DECOR +"+decorScore(r),W/2,46,9,"#ffd23e");
          // decor selector strip below scene
          var listY=226, h=22, maxV=5;
          var startI=Math.max(0, Math.min(DECOR.length-maxV, sel-Math.floor(maxV/2)));
          for(var i=0;i<maxV && (startI+i)<DECOR.length;i++){
            var idx=startI+i, item=DECOR[idx], y=listY+i*h, hi=idx===sel;
            var owned = r.decor && r.decor[item.id];
            var can = owned || save.cash>=item.cost;
            if(hi) rect(8,y-13,W-16,h,"#1a2350");
            px_txt(item.n,16,y+2,7,hi?"#fff":(owned?"#46ff9c":(can?"#cdbff0":"#5a4a7a")),"left");
            px_txt("+"+item.score,180,y+2,6,"#9b6bff","left");
            if(owned) px_txt("OWNED",W-16,y+2,7,"#46ff9c","right");
            else px_txt(fmt$(item.cost),W-16,y+2,8,can?"#ffd23e":"#ff8a8a","right");
          }
          if(msgT>0) px_txt(msg,W/2,H-6,6,"#46ff9c");
          return;
        }

        if(screen==="shop"){
          px_txt("SHOP & UPGRADES",W/2,46,11,"#27e8ff");
          var top=70, h=20;
          for(var i=0;i<shopItems.length;i++){
            var y=top+i*h, hi=i===sel, it=shopItems[i], back=it.type==="back", can = back||save.cash>=it.cost;
            if(hi) rect(8,y-13,W-16,h,"#1a2350");
            px_txt(it.label,16,y+2,8,hi?"#fff":(back?"#9b8fc7":(can?"#cdbff0":"#5a4a7a")),"left");
            if(it.sub) px_txt(it.sub,16,y+13,5,"#9b8fc7","left");
            if(!back) px_txt(fmt$(it.cost),W-16,y+2,8,can?"#ffd23e":"#ff8a8a","right");
          }
          if(msgT>0) px_txt(msg,W/2,H-10,7,"#46ff9c");
          return;
        }

        if(screen==="world"){
          drawWorld();
          if(msgT>0) px_txt(msg,W/2,H-24,7,"#ffd23e");
          return;
        }

        if(screen==="reviews"){
          px_txt("RECENT REVIEWS",W/2,46,11,"#27e8ff");
          var r=activeR(), revs=r.reviews.slice().reverse();
          if(!revs.length){
            px_txt("No reviews yet - serve customers!",W/2,160,8,"#9b8fc7");
          } else {
            var top=70, h=18;
            for(var i=0;i<Math.min(revs.length,12);i++){
              var rv=revs[i], y=top+i*h, it=itemById(rv.it);
              var stars="★★★★★".slice(0,rv.s);
              px_txt(stars,16,y+3,8,rv.s>=4?"#46ff9c":rv.s>=3?"#ffd23e":"#ff8a8a","left");
              var blurb=rv.s===5?"AMAZING!":rv.s===4?"GREAT":rv.s===3?"DECENT":rv.s===2?"MEH":"AWFUL";
              px_txt((it?it.n:"")+" - "+blurb,90,y+3,7,"#cdbff0","left");
            }
          }
          px_txt("◄ / A: BACK",W/2,H-10,8,"#46ff9c");
          return;
        }

        if(screen==="travel"){
          px_txt("YOUR RESTAURANTS",W/2,46,11,"#27e8ff");
          var top=70, h=26;
          for(var i=0;i<save.restaurants.length;i++){
            var R=save.restaurants[i], y=top+i*h, hi=i===sel, cur=i===save.activeIdx;
            var mgr = R.employees && R.employees.manager;
            if(hi) rect(8,y-13,W-16,h,"#1a2350");
            px_txt((cur?"> ":"")+R.name,16,y+2,8,hi?"#fff":"#cdbff0","left");
            px_txt(LOCS[R.locId].n,16,y+14,6,"#9b8fc7","left");
            var rt=ratingOf(R);
            px_txt(rt?rt.toFixed(1)+"★":"--",W-16,y+2,8,"#ffd23e","right");
            if(mgr){
              if(cur) px_txt("[MGR]",W-16,y+14,5,"#9b8fc7","right");
              else px_txt("[MGR +"+fmt$(passiveIncome(R))+"/DAY]",W-16,y+14,5,"#27e8ff","right");
            }
          }
          px_txt("◄ BACK   A: TRAVEL",W/2,H-10,7,"#46ff9c");
          return;
        }
      }
    };
  });
  /* 26. Duo Pong (local 2-player on one keyboard) */
  reg("duopong","Local 2-player Pong. PLAYER 1 uses W (up) / S (down). PLAYER 2 uses ↑ / ↓. First to 5 points wins the match. Ball speeds up every rally. (P2 can also use the on-screen up/down pad if a keyboard isn't handy.)",
  function(){
    var PH=66, PW=10, p1y=H/2-PH/2, p2y=H/2-PH/2;
    var bx=W/2, by=H/2, bvx=-240, bvy=60, rallies=0;
    var p1score=0, p2score=0, winner=0;
    var p1u=false, p1d=false, p2u_kb=false, p2d_kb=false;

    function onKD(ev){
      var c=ev.code;
      if(c==="KeyW"){ p1u=true; ev.preventDefault(); ev.stopImmediatePropagation(); }
      else if(c==="KeyS"){ p1d=true; ev.preventDefault(); ev.stopImmediatePropagation(); }
      else if(c==="ArrowUp"){ p2u_kb=true; ev.preventDefault(); ev.stopImmediatePropagation(); }
      else if(c==="ArrowDown"){ p2d_kb=true; ev.preventDefault(); ev.stopImmediatePropagation(); }
    }
    function onKU(ev){
      var c=ev.code;
      if(c==="KeyW") p1u=false;
      else if(c==="KeyS") p1d=false;
      else if(c==="ArrowUp") p2u_kb=false;
      else if(c==="ArrowDown") p2d_kb=false;
    }
    window.addEventListener("keydown", onKD, true);
    window.addEventListener("keyup",   onKU, true);

    function serve(dir){
      bx=W/2; by=H/2;
      var sp=240+rallies*8;
      bvx = (dir||-1) * sp;
      bvy = rnd(-0.3,0.3)*sp;
    }

    return {
      score:0, over:false,
      dispose:function(){
        window.removeEventListener("keydown", onKD, true);
        window.removeEventListener("keyup",   onKU, true);
      },
      update:function(dt){
        if(winner){
          if(IN.edge.action){
            p1score=0; p2score=0; rallies=0; winner=0;
            p1y=H/2-PH/2; p2y=H/2-PH/2; serve(-1);
          }
          return;
        }
        // Player 1 (W/S only)
        if(p1u) p1y -= 360*dt;
        if(p1d) p1y += 360*dt;
        p1y = Math.max(6, Math.min(H-6-PH, p1y));
        // Player 2 (arrow keys or on-screen up/down pad)
        var p2u = p2u_kb || IN.held.up;
        var p2d = p2d_kb || IN.held.down;
        if(p2u) p2y -= 360*dt;
        if(p2d) p2y += 360*dt;
        p2y = Math.max(6, Math.min(H-6-PH, p2y));
        // Ball
        bx += bvx*dt; by += bvy*dt;
        if(by<8){ by=8; bvy=Math.abs(bvy); }
        if(by>H-8){ by=H-8; bvy=-Math.abs(bvy); }
        if(bvx<0 && bx-6<=24 && bx-6>=6 && by+6>=p1y && by-6<=p1y+PH){
          bvx=Math.abs(bvx)*1.05; bx=30;
          bvy+=((by-(p1y+PH/2))/(PH/2))*200; rallies++;
        }
        var ax=W-24;
        if(bvx>0 && bx+6>=ax && bx+6<=ax+PW+6 && by+6>=p2y && by-6<=p2y+PH){
          bvx=-Math.abs(bvx)*1.05; bx=ax-6;
          bvy+=((by-(p2y+PH/2))/(PH/2))*200; rallies++;
        }
        bvy = Math.max(-380, Math.min(380, bvy));
        this.score = (p1score+p2score)*50 + rallies*5;
        if(bx<0){
          p2score++;
          if(p2score>=5){ winner=2; }
          else { rallies++; serve(1); }
        }
        if(bx>W){
          p1score++;
          if(p1score>=5){ winner=1; this.score+=200; }
          else { rallies++; serve(-1); }
        }
      },
      draw:function(){
        clear("#02030f","#0a0613");
        ctx.strokeStyle="#27e8ff44";ctx.setLineDash([8,12]);ctx.lineWidth=3;
        ctx.beginPath();ctx.moveTo(W/2,0);ctx.lineTo(W/2,H);ctx.stroke();ctx.setLineDash([]);
        rect(14, p1y, PW, PH, "#27e8ff");
        rect(W-24, p2y, PW, PH, "#ff3ea5");
        rect(bx-6, by-6, 12, 12, "#ffd23e");
        px_txt("P1  "+p1score, W/2-50, 28, 12, "#27e8ff", "right");
        px_txt(p1score+"-"+p2score, W/2, 28, 11, "#fff");
        px_txt(p2score+"  P2", W/2+50, 28, 12, "#ff3ea5", "left");
        px_txt("P1: W / S", 12, H-12, 7, "#27e8ff", "left");
        px_txt("FIRST TO 5", W/2, H-12, 7, "#9b8fc7");
        px_txt("P2: ↑ / ↓", W-12, H-12, 7, "#ff3ea5", "right");
        if(winner){
          ctx.save();ctx.globalAlpha=.85;rect(0,0,W,H,"#02030f");ctx.restore();
          var c = winner===1?"#27e8ff":"#ff3ea5";
          px_txt("PLAYER "+winner+" WINS!", W/2, 150, 16, c);
          px_txt(p1score+" - "+p2score, W/2, 184, 13, "#fff");
          px_txt("PRESS A TO PLAY AGAIN", W/2, 232, 9, "#46ff9c");
        }
      }
    };
  });

  /* Mystery handled in startGame() */

  /* ════════════════════ LOOP / MODAL ════════════════════ */
  var curGame=null, rafID=0, curId="", prevTS=null;

  function loop(ts) {
    if(!curGame) return;
    var dt = prevTS===null ? 0.016 : Math.min((ts-prevTS)/1000, 0.05);
    prevTS = ts;
    try {
      if(!curGame.over) curGame.update(dt);
      curGame.draw();
      elScore.textContent = curGame.score|0;
      clearEdges();
      if(curGame.over){ gameOver(); return; }
      rafID = requestAnimationFrame(loop);
    } catch(err) {
      console.error("[DA] game error:", err);
      gameOver();
    }
  }
  function startGame() {
    var id = curId;
    if(id==="mystery"){ id = POOL[ri(0,POOL.length-1)]; elTitle.textContent = "MYSTERY ▸ "+id.toUpperCase(); }
    hide("ovStart"); hide("ovEnd");
    curGame = REGISTRY[id]();
    curGame.score = curGame.score||0; curGame.over=false; curGame._id=id;
    elBest.textContent = loadBest(id); elScore.textContent = 0;
    cancelAnimationFrame(rafID); prevTS=null;
    rafID = requestAnimationFrame(loop);
  }
  function gameOver() {
    cancelAnimationFrame(rafID);
    var id=curGame._id, sc=curGame.score|0, best=loadBest(id);
    if(sc>best){ saveBest(id,sc); elBest.textContent=sc; best=sc; }
    var t="Score: "+sc; if(sc>=best&&sc>0)t+="  ★ NEW BEST!";
    document.getElementById("ovFinal").textContent=t;
    if(lbEndEl) lbEndEl.innerHTML = lbHTML(id, recordScore(id, sc), sc);
    if(curGame.dispose){ try{curGame.dispose();}catch(e){} }
    curGame=null; show("ovEnd");
  }
  function closeModal() {
    cancelAnimationFrame(rafID);
    if(curGame && curGame.dispose){ try{curGame.dispose();}catch(e){} }
    curGame=null; ACTIVE=false; prevTS=null; clearEdges();
    for(var k in IN.held) IN.held[k]=0;
    modal.classList.remove("open"); modal.setAttribute("aria-hidden","true");
  }
  function loadBest(id){ return +(localStorage.getItem("da_b_"+id)||0); }
  function saveBest(id,n){ try{ localStorage.setItem("da_b_"+id,n); }catch(e){} }

  /* ── Per-game leaderboards (your local high scores only) ── */
  function lbKey(id){ return "da_lb_"+id; }
  function saveLB(id,a){ try{ localStorage.setItem(lbKey(id), JSON.stringify(a)); }catch(e){} }
  function loadLB(id){
    try{
      var s=localStorage.getItem(lbKey(id));
      if(s){
        var a=JSON.parse(s);
        if(Array.isArray(a)){
          var clean=[];
          for(var i=0;i<a.length;i++){
            var v=a[i];
            if(typeof v==="number" && isFinite(v) && v>0) clean.push(v|0);
            else if(v && typeof v==="object" && typeof v.s==="number" && v.s>0) clean.push(v.s|0);
          }
          clean.sort(function(x,y){return y-x;});
          if(clean.length>5) clean=clean.slice(0,5);
          return clean;
        }
      }
    }catch(e){}
    return [];
  }
  function recordScore(id,score){
    var lb=loadLB(id), v=score|0;
    if(v>0){ lb.push(v); lb.sort(function(a,b){return b-a;}); if(lb.length>5) lb=lb.slice(0,5); }
    saveLB(id,lb); return lb;
  }
  function fmtN(n){ return (n|0).toLocaleString(); }
  function lbHTML(id,pre,justScore){
    var lb=pre||loadLB(id), rows="";
    for(var i=0;i<lb.length;i++){
      var newest = justScore!==undefined && lb[i]===justScore && rows.indexOf("you")<0 ? ' class="you"':'';
      rows+='<li'+newest+'><span class="r">#'+(i+1)+'</span>'+
            '<span class="n">'+(i===0?"BEST":"")+'</span><span class="s">'+fmtN(lb[i])+'</span></li>';
    }
    if(!rows) rows='<li><span class="r"></span><span class="n">No scores yet</span><span class="s">—</span></li>';
    return '<div class="da-lb"><h4>YOUR TOP SCORES</h4><ol>'+rows+'</ol></div>';
  }
  function hide(id){ document.getElementById(id).classList.add("hidden"); }
  function show(id){ document.getElementById(id).classList.remove("hidden"); }

  function launchByName(name) {
    bindDOM();
    curId = NAME2ID[name] || "snake";
    elTitle.textContent = name.toUpperCase();
    elScore.textContent = 0;
    elBest.textContent  = loadBest(curId==="mystery"?"mystery":curId);
    document.getElementById("ovTitle").textContent = name;
    document.getElementById("ovHow").textContent   = HOWTO[curId] || "Use the controls below.";
    if(lbStartEl) lbStartEl.innerHTML = lbHTML(curId);
    refreshDiffSel();
    show("ovStart"); hide("ovEnd");
    if(ctx){ clear("#0a0613","#150c2b"); px_txt("READY?",W/2,H/2-10,16,"#27e8ff"); }
    modal.classList.add("open"); modal.setAttribute("aria-hidden","false");
    ACTIVE = true;
  }

  window.DAGames = {
    launchByName: launchByName,
    setDifficulty: setDifficulty,
    getDifficulty: getDifficulty
  };
})();
