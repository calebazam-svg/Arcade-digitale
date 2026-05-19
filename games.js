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

  /* ── DOM ─────────────────────────────────────────────────── */
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
      IN.pclick = 1; IN.edge.action = 1;
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

  /* ── Registry ────────────────────────────────────────────── */
  var REGISTRY = {}, HOWTO = {};
  function reg(id, howto, factory) { REGISTRY[id] = factory; HOWTO[id] = howto; }

  var NAME2ID = {
    "Neon Snake":"snake",          "Maze Muncher":"muncher",
    "Pixel Jumper":"runner",       "Retro Rush":"rocket",
    "Dungeon Dash":"dungeon",      "Quest Pixels":"quest",
    "Turbo Circuit":"dodger",      "Kart Kombat":"kart",
    "FPS Arena":"shooter",         "Galaxy Blaster":"galaxy",
    "Asteroid Storm":"asteroids",  "Bubble Pop Saga":"popper",
    "Block Cascade":"stacker",     "Pixel Heist":"heist",
    "Spend 100 Million":"spend",   "Mystery Machine":"mystery"
  };
  var POOL = ["snake","muncher","runner","rocket","dungeon","quest","dodger",
              "kart","shooter","galaxy","asteroids","popper","stacker","heist","spend"];

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

  /* 2. Maze Muncher (endless pellet eater + ghost) */
  reg("muncher","Arrow keys / D-pad to move. Eat every pellet, dodge the pink ghost. Clear board = +300.",
  function(){
    var C=8,R=6,CS=60,grid,pellets,px,py,wdx=0,wdy=0,gx,gy,pt=0,gt=0;
    function build(){
      grid=[];pellets=0;
      for(var y=0;y<R;y++){var row=[];for(var x=0;x<C;x++){
        var wall=(x===0||y===0||x===C-1||y===R-1)||(x%2===0&&y%2===0&&x>1&&x<C-2&&y>1&&y<R-2);
        row.push(wall?1:2); if(!wall)pellets++; } grid.push(row);}
      px=1;py=1; if(grid[1][1]===2){grid[1][1]=0;pellets--;}
      gx=C-2;gy=R-2; if(grid[gy][gx]===2){grid[gy][gx]=0;pellets--;}
    }
    build();
    function ok(x,y){return x>=0&&y>=0&&x<C&&y<R&&grid[y][x]!==1;}
    return { score:0, over:false,
      update:function(dt){
        if(IN.dir==="L"){wdx=-1;wdy=0;} if(IN.dir==="R"){wdx=1;wdy=0;}
        if(IN.dir==="U"){wdx=0;wdy=-1;} if(IN.dir==="D"){wdx=0;wdy=1;}
        pt+=dt; if(pt>=0.18){ pt=0;
          if((wdx||wdy)&&ok(px+wdx,py+wdy)){ px+=wdx;py+=wdy;
            if(grid[py][px]===2){grid[py][px]=0;pellets--;this.score+=10;
              if(pellets<=0){this.score+=300;build();}}}}
        gt+=dt; if(gt>=0.26){ gt=0;
          var d=[[1,0],[-1,0],[0,1],[0,-1]].filter(function(v){return ok(gx+v[0],gy+v[1]);});
          d.sort(function(a,b){return (Math.abs(gx+a[0]-px)+Math.abs(gy+a[1]-py))-(Math.abs(gx+b[0]-px)+Math.abs(gy+b[1]-py));});
          if(d[0]){gx+=d[0][0];gy+=d[0][1];}}
        if(gx===px&&gy===py)this.over=true;
      },
      draw:function(){
        clear("#05030f","#0a0613");
        for(var y=0;y<R;y++)for(var x=0;x<C;x++){
          if(grid[y][x]===1)rect(x*CS+2,y*CS+2,CS-4,CS-4,"#3a2a6b");
          else if(grid[y][x]===2){ctx.fillStyle="#ffd23e";ctx.beginPath();ctx.arc(x*CS+CS/2,y*CS+CS/2,5,0,7);ctx.fill();}}
        ctx.fillStyle="#27e8ff";ctx.beginPath();
        ctx.moveTo(px*CS+CS/2,py*CS+CS/2);
        ctx.arc(px*CS+CS/2,py*CS+CS/2,CS/2-8,0.3,Math.PI*2-0.3);
        ctx.closePath();ctx.fill();
        ctx.fillStyle="#ff3ea5";ctx.beginPath();
        ctx.arc(gx*CS+CS/2,gy*CS+CS/2-4,CS/2-8,Math.PI,0);
        ctx.rect(gx*CS+8,gy*CS+CS/2-12,CS-16,CS/2-2);ctx.fill();
        px_txt("PELLETS "+pellets,W/2,H-8,7,"#9b8fc7");
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

  /* 5. Pixel Heist (robber strategy: shoot guards, grab cash, clear levels +100) */
  reg("heist","D-pad / arrows to move the robber. A / Space fires in the way you're facing. Shoot guards, grab all the cash, clear the level (+100). It gets tougher each level.",
  function(){
    var R=22, px=W/2, py=H-50, fx=0, fy=-1, mv=110, level=1;
    var bullets=[], guards=[], cash=[], fireCD=0;
    function placeAway(size){
      var x,y,tries=0;
      do{ x=rnd(30,W-30-size); y=rnd(30,H-90); tries++; }
      while(tries<20 && Math.hypot(x-px,y-py)<90);
      return {x:x,y:y};
    }
    function buildLevel(){
      bullets=[]; guards=[]; cash=[];
      var nG=2+level, nC=3+((level/2)|0);
      for(var i=0;i<nG;i++){ var g=placeAway(20); guards.push({x:g.x,y:g.y,spd:46+level*5}); }
      for(var c=0;c<nC;c++){ var k=placeAway(18); cash.push({x:k.x,y:k.y}); }
    }
    buildLevel();
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
          bullets.push({x:px,y:py,vx:fx/n*340,vy:fy/n*340,life:1.4});
          fireCD=0.32;
        }
        for(var b=0;b<bullets.length;b++){var bu=bullets[b];bu.x+=bu.vx*dt;bu.y+=bu.vy*dt;bu.life-=dt;}
        bullets=bullets.filter(function(o){return o.life>0&&o.x>-10&&o.x<W+10&&o.y>-10&&o.y<H+10;});
        for(var gi=0;gi<guards.length;gi++){
          var gg=guards[gi], a=Math.atan2(py-gg.y,px-gg.x);
          gg.x+=Math.cos(a)*gg.spd*dt; gg.y+=Math.sin(a)*gg.spd*dt;
          if(Math.hypot(gg.x-px,gg.y-py)<R){ this.over=true; }
        }
        for(var bi=0;bi<bullets.length;bi++){
          for(var g2=0;g2<guards.length;g2++){
            if(!guards[g2].dead&&!bullets[bi].dead&&Math.hypot(bullets[bi].x-guards[g2].x,bullets[bi].y-guards[g2].y)<16){
              guards[g2].dead=true; bullets[bi].dead=true; this.score+=25;
            }
          }
        }
        bullets=bullets.filter(function(o){return !o.dead;});
        guards =guards.filter(function(o){return !o.dead;});
        cash=cash.filter(function(k){
          if(Math.hypot(k.x-px,k.y-py)<R){ this.score+=15; return false; } return true;
        },this);
        if(cash.length===0){ this.score+=100; level++; buildLevel(); px=W/2; py=H-50; }
      },
      draw:function(){
        clear("#0a0613","#161024");
        ctx.strokeStyle="#3a2a6b";ctx.lineWidth=4;ctx.strokeRect(6,6,W-12,H-12);
        // cash
        for(var c=0;c<cash.length;c++){
          rect(cash[c].x-9,cash[c].y-7,18,14,"#ffd23e");
          px_txt("$",cash[c].x,cash[c].y+4,9,"#5a4400");
        }
        // guards
        for(var g=0;g<guards.length;g++){
          rect(guards[g].x-10,guards[g].y-10,20,20,"#ff3ea5");
          rect(guards[g].x-6,guards[g].y-12,12,5,"#ff8a8a");
        }
        // bullets
        ctx.fillStyle="#27e8ff";
        for(var b=0;b<bullets.length;b++){ctx.beginPath();ctx.arc(bullets[b].x,bullets[b].y,4,0,7);ctx.fill();}
        // robber
        rect(px-11,py-11,22,22,"#46ff9c");
        rect(px-7,py-15,14,6,"#1a1a1a");                 // hat
        // gun barrel showing facing
        var n=Math.hypot(fx,fy)||1;
        rect(px-2+fx/n*14,py-2+fy/n*14,5,5,"#f3ecff");
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

  /* 8. Turbo Circuit (discrete 4-lane traffic dodge) */
  reg("dodger","Left/Right to switch lanes. Dodge oncoming traffic — speed climbs forever.",
  function(){
    var LANES=[100,200,300,400],lane=1,plx=LANES[1],spd=200,cars=[],spawnT=0,time=0;
    return { score:0, over:false,
      update:function(dt){
        if(IN.edge.left&&lane>0)lane--;
        if(IN.edge.right&&lane<3)lane++;
        plx+=(LANES[lane]-plx)*Math.min(1,dt*14);
        spd+=dt*7; time+=dt; this.score=Math.floor(time*10);
        spawnT-=dt;
        if(spawnT<=0){cars.push({x:LANES[ri(0,3)],y:-60});spawnT=rnd(0.5,1)-Math.min(0.28,spd/2000);}
        for(var i=0;i<cars.length;i++)cars[i].y+=spd*dt;
        cars=cars.filter(function(c){return c.y<H+60;});
        for(var j=0;j<cars.length;j++) if(Math.abs(cars[j].x-plx)<40&&Math.abs(cars[j].y-290)<52)this.over=true;
      },
      draw:function(){
        clear("#07111a","#0a0613");
        rect(70,0,360,H,"#141a2e");
        ctx.strokeStyle="#ffd23e44";ctx.lineWidth=3;ctx.setLineDash([22,16]);
        [150,240,330].forEach(function(lx){ctx.beginPath();ctx.moveTo(lx,0);ctx.lineTo(lx,H);ctx.stroke();});
        ctx.setLineDash([]);
        for(var j=0;j<cars.length;j++){rect(cars[j].x-20,cars[j].y-32,40,64,"#ff3ea5");}
        rect(plx-20,262,40,64,"#27e8ff");
        px_txt(""+this.score,W/2,22,12,"#9b8fc7");
      }};
  });

  /* 9. Kart Kombat (free movement racer + boost pads) */
  reg("kart","Move freely Left/Right. Smash green boost pads for points & speed, dodge the rival karts.",
  function(){
    var kx=W/2,spd=190,items=[],spawnT=0,time=0,boost=0;
    return { score:0, over:false,
      update:function(dt){
        if(IN.held.left)kx-=300*dt;
        if(IN.held.right)kx+=300*dt;
        kx=Math.max(80,Math.min(W-80,kx));
        if(boost>0)boost-=dt;
        var sp=spd+(boost>0?160:0);
        spd+=dt*4; time+=dt; this.score=Math.floor(time*8);
        spawnT-=dt;
        if(spawnT<=0){
          var isBoost=Math.random()<0.3;
          items.push({x:rnd(90,W-90),y:-40,b:isBoost});
          spawnT=rnd(0.45,0.9);
        }
        for(var i=0;i<items.length;i++)items[i].y+=sp*dt;
        items=items.filter(function(o){return o.y<H+50;});
        for(var j=items.length-1;j>=0;j--){
          var it=items[j];
          if(Math.abs(it.x-kx)<36&&Math.abs(it.y-300)<46){
            if(it.b){ this.score+=50; boost=1.4; items.splice(j,1); }
            else { this.over=true; }
          }
        }
      },
      draw:function(){
        clear("#0a1a0e","#06120a");
        rect(64,0,W-128,H,"#13241a");
        ctx.strokeStyle="#46ff9c33";ctx.lineWidth=3;ctx.setLineDash([20,18]);
        ctx.beginPath();ctx.moveTo(W/2,0);ctx.lineTo(W/2,H);ctx.stroke();ctx.setLineDash([]);
        for(var i=0;i<items.length;i++){
          if(items[i].b){rect(items[i].x-18,items[i].y-10,36,20,"#46ff9c");}
          else{rect(items[i].x-18,items[i].y-30,36,60,"#ff3ea5");}
        }
        rect(kx-18,270,36,60,boost>0?"#ffd23e":"#27e8ff");
        px_txt(""+this.score,W/2,22,12,"#9b8fc7");
        if(boost>0)px_txt("BOOST!",W/2,H-12,10,"#ffd23e");
      }};
  });

  /* 10. FPS Arena (space-invaders wave survival) */
  reg("shooter","Left/Right to move, A / Space to fire. Clear each descending wave to advance.",
  function(){
    var sx=W/2,bul=[],en=[],edir=1,wave=1,cd=0;
    function spawn(){en=[];var rows=Math.min(3,wave),cols=6;
      for(var r=0;r<rows;r++)for(var c=0;c<cols;c++)en.push({x:80+c*56,y:40+r*40});}
    spawn();
    return { score:0, over:false,
      update:function(dt){
        if(IN.held.left)sx-=300*dt; if(IN.held.right)sx+=300*dt;
        sx=Math.max(16,Math.min(W-16,sx));
        cd-=dt;
        if((IN.edge.action||IN.held.action)&&cd<=0){bul.push({x:sx,y:310});cd=0.25;}
        for(var i=0;i<bul.length;i++)bul[i].y-=540*dt;
        bul=bul.filter(function(b){return b.y>-10;});
        var sp=24+wave*7,hit=false;
        for(var e=0;e<en.length;e++){en[e].x+=edir*sp*dt;if(en[e].x<14||en[e].x>W-14)hit=true;}
        if(hit){edir*=-1;for(var k=0;k<en.length;k++)en[k].y+=16;}
        for(var b=0;b<bul.length;b++)for(var e2=0;e2<en.length;e2++)
          if(!en[e2].d&&!bul[b].d&&Math.abs(bul[b].x-en[e2].x)<18&&Math.abs(bul[b].y-en[e2].y)<16){en[e2].d=bul[b].d=true;this.score+=50;}
        bul=bul.filter(function(b){return !b.d;}); en=en.filter(function(e){return !e.d;});
        for(var e3=0;e3<en.length;e3++)if(en[e3].y>300){this.over=true;return;}
        if(!en.length){wave++;this.score+=150;spawn();}
      },
      draw:function(){
        clear("#02030f","#0a0613");
        ctx.fillStyle="#27e8ff";ctx.beginPath();ctx.moveTo(sx,308);ctx.lineTo(sx-18,340);ctx.lineTo(sx+18,340);ctx.fill();
        for(var b=0;b<bul.length;b++)rect(bul[b].x-2,bul[b].y-10,4,14,"#ffd23e");
        for(var e=0;e<en.length;e++)rect(en[e].x-14,en[e].y-11,28,22,"#ff3ea5");
        px_txt("WAVE "+wave,8,18,8,"#9b8fc7","left");
        px_txt(""+this.score,W/2,18,10,"#ffd23e");
      }};
  });

  /* 11. Galaxy Blaster (free-roam vertical scrolling shooter) */
  reg("galaxy","Move any direction, A / Space to fire upward. Gun down the swooping invaders endlessly.",
  function(){
    var sx=W/2,sy=H-50,bul=[],en=[],spawnT=0,cd=0,time=0;
    return { score:0, over:false,
      update:function(dt){
        time+=dt;
        if(IN.held.left)sx-=260*dt; if(IN.held.right)sx+=260*dt;
        if(IN.held.up)sy-=220*dt; if(IN.held.down)sy+=220*dt;
        sx=Math.max(16,Math.min(W-16,sx)); sy=Math.max(120,Math.min(H-20,sy));
        cd-=dt;
        if((IN.edge.action||IN.held.action)&&cd<=0){bul.push({x:sx,y:sy-16});cd=0.22;}
        for(var i=0;i<bul.length;i++)bul[i].y-=520*dt;
        bul=bul.filter(function(b){return b.y>-10;});
        spawnT-=dt;
        if(spawnT<=0){en.push({x:rnd(20,W-20),y:-20,vy:60+time*3,ph:rnd(0,6)});
          spawnT=Math.max(0.35,1.1-time*0.02);}
        for(var e=0;e<en.length;e++){en[e].y+=en[e].vy*dt;en[e].x+=Math.sin((en[e].y+en[e].ph*40)/40)*1.3;}
        for(var b=0;b<bul.length;b++)for(var e2=0;e2<en.length;e2++)
          if(!en[e2].d&&!bul[b].d&&Math.hypot(bul[b].x-en[e2].x,bul[b].y-en[e2].y)<16){en[e2].d=bul[b].d=true;this.score+=40;}
        bul=bul.filter(function(b){return !b.d;});
        en=en.filter(function(e){return !e.d&&e.y<H+30;});
        for(var e3=0;e3<en.length;e3++)
          if(Math.hypot(en[e3].x-sx,en[e3].y-sy)<18){this.over=true;}
      },
      draw:function(){
        clear("#01020c","#0a0613");
        for(var i=0;i<40;i++){var px2=(i*97)%W,py2=(i*53+(time*120)%H)%H;rect(px2,py2,2,2,"#ffffff22");}
        ctx.fillStyle="#27e8ff";ctx.beginPath();ctx.moveTo(sx,sy-16);ctx.lineTo(sx-14,sy+14);ctx.lineTo(sx+14,sy+14);ctx.fill();
        for(var b=0;b<bul.length;b++)rect(bul[b].x-2,bul[b].y-8,4,12,"#46ff9c");
        for(var e=0;e<en.length;e++){rect(en[e].x-12,en[e].y-10,24,20,"#ff3ea5");rect(en[e].x-6,en[e].y-15,12,6,"#ff8a8a");}
        px_txt(""+this.score,W/2,20,12,"#ffd23e");
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
    curGame=null; show("ovEnd");
  }
  function closeModal() {
    cancelAnimationFrame(rafID);
    curGame=null; ACTIVE=false; prevTS=null; clearEdges();
    for(var k in IN.held) IN.held[k]=0;
    modal.classList.remove("open"); modal.setAttribute("aria-hidden","true");
  }
  function loadBest(id){ return +(localStorage.getItem("da_b_"+id)||0); }
  function saveBest(id,n){ try{ localStorage.setItem("da_b_"+id,n); }catch(e){} }
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
    show("ovStart"); hide("ovEnd");
    if(ctx){ clear("#0a0613","#150c2b"); px_txt("READY?",W/2,H/2-10,16,"#27e8ff"); }
    modal.classList.add("open"); modal.setAttribute("aria-hidden","false");
    ACTIVE = true;
  }

  window.DAGames = { launchByName: launchByName };
})();
