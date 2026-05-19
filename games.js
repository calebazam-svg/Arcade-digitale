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
    "Turbo Circuit":"dodger",      "Kart Kombat":"kart",
    "FPS Arena":"shooter",         "Galaxy Blaster":"galaxy",
    "Asteroid Storm":"asteroids",  "Bubble Pop Saga":"popper",
    "Block Cascade":"stacker",     "Pixel Heist":"heist",
    "Spend 100 Million":"spend",   "Mystery Machine":"mystery"
  };
  var POOL = ["snake","muncher","runner","rocket","dungeon","quest","dodger",
              "kart","shooter","galaxy","asteroids","popper","stacker","heist","spend"];

  /* ── Shared pseudo-3D kart racer (Mario-Kart-style) ──────── */
  function makeRacer(cfg){
    var SEGLEN=200, NSEG=560, ROADW=1400, CAMH=1000;
    var CAMD=1/Math.tan((100/2)*Math.PI/180), DRAW=180;
    var trackLen=NSEG*SEGLEN;
    var segs=[];
    for(var i=0;i<NSEG;i++){
      var cv=0;
      if(i> 60&&i<120) cv= 2.6;
      if(i>180&&i<240) cv=-3.2;
      if(i>300&&i<340) cv= 4.0;
      if(i>410&&i<470) cv=-2.4;
      segs.push({ index:i, curve:cv,
        p1:{world:{z:i*SEGLEN},camera:{},screen:{}},
        p2:{world:{z:(i+1)*SEGLEN},camera:{},screen:{}} });
    }
    function project(p,camX,camY,camZ){
      p.camera.x=(p.world.x||0)-camX;
      p.camera.y=(p.world.y||0)-camY;
      p.camera.z=(p.world.z||0)-camZ;
      p.screen.scale=CAMD/p.camera.z;
      p.screen.x=Math.round(W/2 + p.screen.scale*p.camera.x*W/2);
      p.screen.y=Math.round(H/2 - p.screen.scale*p.camera.y*H/2);
      p.screen.w=Math.round(p.screen.scale*ROADW*W/2);
    }
    var pos=0, playerX=0, speed=0, maxSpd=cfg.maxSpd||12000, lap=1, laps=cfg.laps||3;
    var boostT=0, spinT=0, shieldT=0, finished=false, raceT=0;
    var item="", banner="", bannerT=0;
    var ITEMS=["boost","shell","mine","shield"];
    var rivals=[];
    for(var r=0;r<(cfg.rivals||4);r++)
      rivals.push({ z:(r+1)*900, off:rnd(-0.55,0.55), tot:0,
        spd:(cfg.maxSpd||12000)*0.6, base:0.55+Math.random()*0.12,
        item:ITEMS[ri(0,3)], icd:rnd(3,7), spin:0 });
    var boxes=[];
    for(var bx=0;bx<14;bx++) boxes.push({z:(bx+1)*(trackLen/15),off:rnd(-0.55,0.55),t:0});
    var shells=[], mines=[];
    var pads=[];
    if(cfg.boost) for(var b=0;b<10;b++) pads.push({z:rnd(0,trackLen),off:rnd(-0.5,0.5)});
    function segAt(z){ return segs[Math.floor(z/SEGLEN)%NSEG]; }
    function dzf(a,b){ return ((a-b)%trackLen+trackLen)%trackLen; }
    function flash(msg){ banner=msg; bannerT=1.4; }

    return { score:0, over:false,
      update:function(dt){
        if(finished){ this.over=true; return; }
        raceT+=dt; if(bannerT>0)bannerT-=dt;
        if(shieldT>0)shieldT-=dt;
        speed += (maxSpd*0.56 - speed*0.46)*dt;
        if(spinT>0){ spinT-=dt; speed*=Math.pow(0.12,dt); }
        if(boostT>0){ boostT-=dt; speed=Math.min(maxSpd*1.6,speed+maxSpd*1.5*dt); }
        // use item with A
        if((IN.edge.action)&&item&&spinT<=0){
          if(item==="boost"){ boostT=Math.max(boostT,1.3); flash("BOOST!"); }
          else if(item==="shell"){ shells.push({z:pos+260,off:playerX,own:-1}); flash("SHELL FIRED"); }
          else if(item==="mine"){ mines.push({z:pos-120,off:playerX}); flash("MINE DROPPED"); }
          else if(item==="shield"){ shieldT=5; flash("SHIELD UP"); }
          item="";
        }
        var steer=(speed/maxSpd)*2.6*(spinT>0?0:1);
        if(IN.held.left)  playerX-=steer*dt;
        if(IN.held.right) playerX+=steer*dt;
        playerX-=(segAt(pos).curve)*(speed/maxSpd)*dt*0.45;
        if(Math.abs(playerX)>1.05){ speed*=Math.pow(0.4,dt); }
        playerX=Math.max(-2,Math.min(2,playerX));
        // item boxes
        for(var ib=0;ib<boxes.length;ib++){
          var bo=boxes[ib];
          if(bo.t>0){ bo.t-=dt; continue; }
          if(dzf(bo.z,pos)<150 && Math.abs(bo.off-playerX)<0.34){
            if(!item){ item=ITEMS[ri(0,3)]; flash("GOT "+item.toUpperCase()); }
            bo.t=4;
          }
          for(var rq=0;rq<rivals.length;rq++)
            if(bo.t<=0 && dzf(bo.z,rivals[rq].z)<150 && Math.abs(bo.off-rivals[rq].off)<0.34){
              if(!rivals[rq].item) rivals[rq].item=ITEMS[ri(0,3)]; bo.t=4;
            }
        }
        // shells travel forward, hit any kart
        for(var s=0;s<shells.length;s++){
          var sh=shells[s]; sh.z+=maxSpd*1.7*dt;
          if(sh.own!==-1 && dzf(pos,sh.z)<140 && dzf(pos,sh.z)>=0 && Math.abs(playerX-sh.off)<0.4 && shieldT<=0 && spinT<=0){
            spinT=1.5; flash("SPUN OUT!"); sh.dead=true; continue;
          }
          for(var rk=0;rk<rivals.length;rk++){
            var rr=rivals[rk];
            if(sh.own!==rk && dzf(rr.z,sh.z)<140 && Math.abs(rr.off-sh.off)<0.4 && rr.spin<=0){
              rr.spin=1.5; sh.dead=true; if(sh.own===-1)this.score+=30; break;
            }
          }
          if(dzf(sh.z,pos)>trackLen*0.6) sh.dead=true;
        }
        shells=shells.filter(function(o){return !o.dead;});
        // mines
        for(var m=0;m<mines.length;m++){
          var mi=mines[m];
          if(dzf(mi.z,pos)<90 && Math.abs(mi.off-playerX)<0.3 && shieldT<=0 && spinT<=0){
            spinT=1.4; flash("HIT A MINE!"); mi.dead=true; continue;
          }
          for(var rm=0;rm<rivals.length;rm++)
            if(dzf(mi.z,rivals[rm].z)<90 && Math.abs(mi.off-rivals[rm].off)<0.3 && rivals[rm].spin<=0){
              rivals[rm].spin=1.4; mi.dead=true; this.score+=15; break;
            }
        }
        mines=mines.filter(function(o){return !o.dead;});
        if(cfg.boost) for(var p=0;p<pads.length;p++){
          var pd=pads[p], pdz=dzf(pd.z,pos);
          if(pdz<150 && Math.abs(pd.off-playerX)<0.34 && !pd._h){ pd._h=raceT; boostT=Math.max(boostT,0.9); this.score+=25; }
          if(pd._h && raceT-pd._h>3) pd._h=0;
        }
        // rival AI: rubber-band speed + use items + race the player
        var me=(lap-1)*trackLen+pos;
        for(var ri2=0;ri2<rivals.length;ri2++){
          var rv=rivals[ri2];
          if(rv.spin>0){ rv.spin-=dt; rv.spd*=Math.pow(0.15,dt); }
          else {
            var lead=(me - rv.tot)/trackLen;            // +ve = player ahead
            var tgt=maxSpd*(rv.base + Math.max(-0.08,Math.min(0.22,lead*0.5)));
            rv.spd += (tgt - rv.spd)*1.5*dt;
          }
          rv.icd-=dt;
          if(rv.icd<=0 && rv.spin<=0){
            rv.icd=rnd(4,8);
            if(rv.item==="boost"){ rv.spd*=1.5; rv.item=""; }
            else if(rv.item==="shell"){ shells.push({z:rv.z+200,off:rv.off,own:ri2}); rv.item=""; }
            else if(rv.item==="mine"){ mines.push({z:rv.z-100,off:rv.off}); rv.item=""; }
            else if(rv.item==="shield"){ rv.item=""; }
            else rv.item=ITEMS[ri(0,3)];
          }
          rv.z+=rv.spd*dt; rv.tot+=rv.spd*dt;
          rv.off+=(Math.sin((rv.z+ri2*400)/1400)*0.5-rv.off)*0.6*dt;
          // body-check between player and rival
          if(dzf(rv.z,pos)<150 && Math.abs(rv.off-playerX)<0.4){
            speed*=Math.pow(0.3,dt); rv.spd*=Math.pow(0.5,dt);
          }
        }
        pos+=speed*dt;
        if(pos>=trackLen){ pos-=trackLen; lap++;
          if(lap<=laps){ this.score+=200; flash("LAP "+lap); }
          if(lap>laps){ finished=true;
            var ahead=0,fin=(lap-1)*trackLen+pos;
            for(var q=0;q<rivals.length;q++) if(rivals[q].tot>fin) ahead++;
            this.score += [600,400,250,150,80][Math.min(ahead,4)];
          }
        }
      },
      draw:function(){
        var g=ctx.createLinearGradient(0,0,0,H/2);
        g.addColorStop(0,cfg.sky1);g.addColorStop(1,cfg.sky2);
        ctx.fillStyle=g;ctx.fillRect(0,0,W,H/2);
        rect(0,H/2,W,H/2,cfg.grass);
        var base=Math.floor(pos/SEGLEN)%NSEG;
        var basePct=(pos%SEGLEN)/SEGLEN;
        var x=0, dx=-(segs[base].curve*basePct), maxy=H;
        var anchor=[];
        for(var n=0;n<DRAW;n++){
          var seg=segs[(base+n)%NSEG];
          var looped=seg.index<base;
          var camZ=pos-(looped?trackLen:0);
          project(seg.p1,(playerX*ROADW)-x,     CAMH,camZ);
          project(seg.p2,(playerX*ROADW)-x-dx, CAMH,camZ);
          x+=dx; dx+=seg.curve;
          anchor[seg.index]={x:seg.p1.screen.x,y:seg.p1.screen.y,w:seg.p1.screen.w,sc:seg.p1.screen.scale};
          if(seg.p1.camera.z<=CAMD || seg.p2.screen.y>=maxy) continue;
          var y1=seg.p1.screen.y,y2=seg.p2.screen.y;
          var w1=seg.p1.screen.w,w2=seg.p2.screen.w;
          var x1=seg.p1.screen.x,x2=seg.p2.screen.x;
          var dark=((seg.index/3)|0)%2===0;
          ctx.fillStyle=dark?cfg.grass:cfg.grass2;
          ctx.fillRect(0,y2,W,y1-y2);
          ctx.fillStyle=dark?"#ffffff":"#ff3ea5";
          poly(x1-w1*1.18,y1,x1+w1*1.18,y1,x2+w2*1.18,y2,x2-w2*1.18,y2);
          ctx.fillStyle=dark?cfg.road:cfg.road2;
          poly(x1-w1,y1,x1+w1,y1,x2+w2,y2,x2-w2,y2);
          if(dark){ ctx.fillStyle="#ffffff55";
            poly(x1-w1*0.04,y1,x1+w1*0.04,y1,x2+w2*0.04,y2,x2-w2*0.04,y2); }
          maxy=y2;
        }
        function atZ(z){ return anchor[Math.floor(z/SEGLEN)%NSEG]; }
        // boost pads
        if(cfg.boost) for(var p=0;p<pads.length;p++){
          var pd=pads[p]; if(pd._h)continue;
          var a=atZ(pd.z); if(!a||a.sc<=0)continue;
          var pw=a.w*0.34; rect(a.x+pd.off*a.w-pw/2,a.y-pw*0.4,pw,pw*0.5,"#46ff9c");
        }
        // item boxes
        for(var ib=0;ib<boxes.length;ib++){
          var bo=boxes[ib]; if(bo.t>0)continue;
          var ab=atZ(bo.z); if(!ab||ab.sc<=0)continue;
          var bw=ab.w*0.3; if(bw<4)continue;
          var bcx=ab.x+bo.off*ab.w, bcy=ab.y-bw;
          rect(bcx-bw/2,bcy,bw,bw,"#27e8ff");
          rect(bcx-bw/2,bcy,bw,bw/4,"#9b6bff");
          px_txt("?",bcx,bcy+bw*0.78,Math.max(6,bw*0.5)|0,"#fff");
        }
        // mines
        for(var m=0;m<mines.length;m++){
          var mi=mines[m], am=atZ(mi.z); if(!am||am.sc<=0)continue;
          var ms=Math.max(3,am.w*0.12);
          rect(am.x+mi.off*am.w-ms/2,am.y-ms/2,ms,ms,"#ff3ea5");
        }
        // shells
        for(var s=0;s<shells.length;s++){
          var sh=shells[s], as=atZ(sh.z); if(!as||as.sc<=0)continue;
          var ss=Math.max(4,as.w*0.18);
          ctx.fillStyle="#46ff9c";
          ctx.beginPath();ctx.arc(as.x+sh.off*as.w,as.y-ss/2,ss/2,0,7);ctx.fill();
        }
        // rivals (far to near)
        var rs=rivals.slice().sort(function(a,b){ return dzf(b.z,pos)-dzf(a.z,pos); });
        for(var ri3=0;ri3<rs.length;ri3++){
          var rv=rs[ri3], a2=atZ(rv.z); if(!a2||a2.sc<=0)continue;
          var cw=a2.sc*2600, ch=cw*0.8; if(cw<3)continue;
          var rxp=a2.x+rv.off*a2.w, ryp=a2.y;
          var wob=rv.spin>0?Math.sin(raceT*30)*cw*0.18:0;
          rect(rxp-cw/2+wob,ryp-ch,cw,ch,rv.spin>0?"#ff8a8a":cfg.rival);
          rect(rxp-cw*0.34+wob,ryp-ch*0.7,cw*0.68,ch*0.4,"#1a1a2a");
        }
        // player kart
        var pwob=spinT>0?Math.sin(raceT*32)*10:0;
        var pcx=W/2+pwob+(IN.held.left?-6:IN.held.right?6:0), pcy=H-46;
        if(shieldT>0){ ctx.save();ctx.globalAlpha=.4;ctx.fillStyle="#27e8ff";
          ctx.beginPath();ctx.arc(pcx,pcy+6,42,0,7);ctx.fill();ctx.restore(); }
        rect(pcx-26,pcy-6,52,30,spinT>0?"#ff8a8a":cfg.player);
        rect(pcx-30,pcy+18,12,12,"#1a1a1a");
        rect(pcx+18,pcy+18,12,12,"#1a1a1a");
        rect(pcx-16,pcy-16,32,14,"#1a1a2a");
        if(boostT>0){ ctx.fillStyle="#ffd23e";
          ctx.beginPath();ctx.moveTo(pcx-10,pcy+24);ctx.lineTo(pcx+10,pcy+24);
          ctx.lineTo(pcx,pcy+24+12+Math.random()*8);ctx.fill(); }
        // HUD
        px_txt("LAP "+Math.min(lap,laps)+"/"+laps,8,20,8,"#fff","left");
        var place=1,me2=(lap-1)*trackLen+pos;
        for(var q=0;q<rivals.length;q++) if(rivals[q].tot>me2) place++;
        px_txt(place+(["TH","ST","ND","RD","TH"][place]||"TH"),W-8,20,9,"#ffd23e","right");
        px_txt(Math.round(speed/55)+" KM/H",W/2,H-10,7,"#fff");
        px_txt(""+this.score,W/2,20,11,"#ffd23e");
        // item slot
        ctx.strokeStyle="#9b6bff";ctx.lineWidth=2;ctx.strokeRect(W/2-22,30,44,26);
        px_txt(item?item.toUpperCase().slice(0,5):"—",W/2,48,7,item?"#46ff9c":"#5a4a7a");
        if(bannerT>0) px_txt(banner,W/2,H/2,11,"#ffd23e");
      }};
  }

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
    var CONE=Math.PI/3.2, SIGHT=118;     // half-angle & range of a guard's vision
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
      var nG=2+level, nC=3+((level/2)|0);
      for(var i=0;i<nG;i++){
        var rt=makeRoute();
        guards.push({ x:rt[0].x, y:rt[0].y, route:rt, wp:1,
          spd:42+level*4, alert:0, hd:0 });   // hd = heading angle
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

  /* 8. Turbo Circuit (pseudo-3D circuit sprint — 3 fast laps vs rivals) */
  reg("dodger","3-lap battle race vs 5 AI rivals. Steer Left/Right, drive through blue ? boxes for an item, press A to use it: BOOST, SHELL (spins a kart ahead), MINE (drop a trap), SHIELD. Rivals grab items and fight back too — finish on the podium for a big bonus.",
  function(){
    return makeRacer({
      laps:3, rivals:5, maxSpd:13000, boost:false,
      sky1:"#0a1830", sky2:"#1a2e52", grass:"#13241a", grass2:"#0f1c14",
      road:"#2a2150", road2:"#241b46", rival:"#ff3ea5", player:"#27e8ff"
    });
  });

  /* 9. Kart Kombat (Mario-Kart-style: 3 laps, rivals + green boost pads) */
  reg("kart","Mario-Kart-style item battle! Steer Left/Right, grab blue ? boxes and press A to fire your item: BOOST, SHELL (spin a kart), MINE, SHIELD. Green pads give bonus turbo. 5 AI rivals throw items back at you — survive 3 laps and beat them to the line.",
  function(){
    return makeRacer({
      laps:3, rivals:5, maxSpd:12000, boost:true,
      sky1:"#1a0e30", sky2:"#3a1a52", grass:"#0e2418", grass2:"#0a1c12",
      road:"#3a2a6b", road2:"#332459", rival:"#ffd23e", player:"#46ff9c"
    });
  });

  /* 10. FPS Arena (TRUE first-person, level/wave campaign) */
  reg("shooter","First-person arena campaign. Left/Right turns your view, A / Space fires at the crosshair. Each LEVEL has 4 waves — clear a wave (+150), beat all 4 to advance the level (+400). Armored foes from level 3 take two hits. Don't let anything reach you.",
  function(){
    var HFOV=Math.PI/3;
    var WPL=4;                          // waves per level
    var aim=0, en=[], level=1, wave=1, cd=0, flash=0, banner="LEVEL 1", bannerT=1.6;
    function spawn(){
      en=[];
      var n=Math.min(3+wave+level,11);
      for(var i=0;i<n;i++){
        var armored=level>=3 && Math.random()<0.25+level*0.03;
        en.push({ ang:rnd(-Math.PI,Math.PI), dist:rnd(640,940),
                  spd:34+wave*6+level*9, hp:armored?2:1, arm:armored, d:false });
      }
    }
    spawn();
    function angDiff(a,b){return Math.atan2(Math.sin(a-b),Math.cos(a-b));}
    return { score:0, over:false,
      update:function(dt){
        if(bannerT>0)bannerT-=dt;
        if(IN.held.left)  aim-=2.2*dt;
        if(IN.held.right) aim+=2.2*dt;
        if(aim> Math.PI)aim-=Math.PI*2;
        if(aim<-Math.PI)aim+=Math.PI*2;
        cd-=dt; flash-=dt;
        if((IN.edge.action||IN.held.action)&&cd<=0){
          cd=0.3; flash=0.06;
          var best=-1,bd=1e9;
          for(var i=0;i<en.length;i++){
            if(en[i].d)continue;
            var off=Math.abs(angDiff(en[i].ang,aim));
            if(off<0.14 && en[i].dist<bd){ bd=en[i].dist; best=i; }
          }
          if(best>=0){ en[best].hp--; if(en[best].hp<=0){ en[best].d=true; this.score+=en[best].arm?90:50; } else this.score+=10; }
        }
        for(var e=0;e<en.length;e++){
          if(en[e].d)continue;
          en[e].dist-=en[e].spd*dt;
          if(en[e].dist<=70){ this.over=true; return; }
        }
        en=en.filter(function(o){return !o.d;});
        if(!en.length){
          if(wave<WPL){ wave++; this.score+=150; banner="WAVE "+wave; bannerT=1.1; spawn(); }
          else { level++; wave=1; this.score+=400; banner="LEVEL "+level; bannerT=1.8; spawn(); }
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
        if(bannerT>0) px_txt(banner,W/2,HZ-40,14,"#27e8ff");
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
                    spd:150+time*9, sw:rnd(-.25,.25), d:false });
          spawnT=Math.max(0.45,1.3-time*0.022);
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
