'use strict';
/* ============================================================
   ENGINE — canvas, layout, game state, drawing
   ============================================================ */
const cv=$('cv'), ctx=cv.getContext('2d');
let W=360,H=640,DPR=Math.min(window.devicePixelRatio||1,2.5);
function resize(){
  W=cv.clientWidth; H=cv.clientHeight;
  cv.width=Math.round(W*DPR); cv.height=Math.round(H*DPR);
  ctx.setTransform(DPR,0,0,DPR,0,0);
  computeLayout();
}
const L={};
function computeLayout(){
  L.topH=100;
  L.beltY=L.topH+58;
  L.beltH=92;
  L.itemR=34;
  const bd=(typeof SV!=='undefined')?{cols:3+(SV.gear.bags>=1?1:0),rows:3+(SV.gear.bags>=2?1:0)}:{cols:3,rows:3};
  const panW=W/2-12;
  const cell=Math.min((panW-16)/bd.cols,38);
  L.panelH=Math.round(cell*bd.rows+30);
  L.panelY=H-88-L.panelH;
  L.panL={x:8,y:L.panelY,w:panW,h:L.panelH};
  L.panR={x:W/2+4,y:L.panelY,w:panW,h:L.panelH};
  const availH=L.panelY-10-(L.beltY+L.beltH+30);
  L.packHorse={x:W*0.50,y:L.panelY-6,s:clamp(Math.min(W/430,availH/168),0.55,1.15)};
  L.homeTou={x:W*0.50,y:L.beltY-40};
  L.carryTou={x:W*0.50,y:L.beltY+L.beltH+52};
  L.groundY=H*0.72;
  L.jHorse={x:W*0.30,y:L.groundY+36,s:clamp(W/430,0.6,1)*0.92};
  L.coinTarget={x:W-46,y:34};
}
window.addEventListener('resize',resize);

/* ---------- game state ---------- */
const G={
  state:'title', t:0,
  day:SV.day, region:REGIONS[0], tier:0,
  order:[], script:[], routeIcons:[], revealN:2, routeSet:null,
  bagL:{places:[]}, bagR:{places:[]},
  burst:0, weather:null,
  pat:50, patMax:50, patPaused:false,
  belt:[], beltTimer:0, beltOff:0, held:null,
  tou:{x:200,y:120,mode:'hover',p:0,fx:0,fy:0,tx:0,ty:0,dur:0.4,cb:null,face:1,bob:0},
  hearts:3, dayCoins:0, eventCoins:0,
  wx:0, jstate:'trot', nodeIdx:0, nodes:[], spill:false, stepT:0, stepAlt:false, celT:0,
  parts:[], shake:0, blinkT:2, idleT:0, horsePhase:0, tilt:0,
  tutStep:-1, resRows:null, viewBags:false, stunt:null,
};

/* ---------- particles ---------- */
function pText(x,y,txt,color,size){G.parts.push({tp:'txt',x,y,vx:rand(-8,8),vy:-46,life:1.15,max:1.15,txt,color:color||'#4F9A3A',size:size||17});}
function pCoin(x,y,n){for(let i=0;i<n;i++)G.parts.push({tp:'coin',x:x+rand(-14,14),y:y+rand(-10,10),vx:rand(-30,30),vy:rand(-120,-40),life:1.5,max:1.5,hom:0.25+i*0.06});}
function pPoof(x,y,col){for(let i=0;i<7;i++){const a=rand(0,TAU);G.parts.push({tp:'poof',x,y,vx:Math.cos(a)*rand(20,70),vy:Math.sin(a)*rand(20,70)-20,life:0.6,max:0.6,r:rand(4,9),color:col||'rgba(255,255,255,0.9)'});}}
function pHeart(x,y,n){for(let i=0;i<(n||3);i++)G.parts.push({tp:'txt',x:x+rand(-16,16),y:y+rand(-8,8),vx:rand(-12,12),vy:-40,life:1.2,max:1.2,txt:'❤️',size:15+rand(0,6)});}
function pMorale(x,y,n){for(let i=0;i<(n||3);i++)G.parts.push({tp:'txt',x:x+rand(-16,16),y:y+rand(-8,8),vx:rand(-12,12),vy:-46,life:1.2,max:1.2,txt:'▲',color:'#4F9A3A',size:16+rand(0,6)});}
function pSpark(x,y,n){for(let i=0;i<(n||6);i++){const a=rand(0,TAU);G.parts.push({tp:'spark',x,y,vx:Math.cos(a)*rand(30,90),vy:Math.sin(a)*rand(30,90),life:0.5,max:0.5,color:choice(['#FFD166','#FFF3B0','#FFB627'])});}}
function pConfetti(){for(let i=0;i<46;i++)G.parts.push({tp:'conf',x:rand(0,W),y:rand(-80,-10),vx:rand(-25,25),vy:rand(60,140),life:2.6,max:2.6,color:choice(RAINBOW),r:rand(3,6),sp:rand(2,7)});}
function pDust(x,y){G.parts.push({tp:'poof',x,y,vx:rand(-34,-12),vy:rand(-14,-2),life:0.5,max:0.5,r:rand(3,6),color:'rgba(120,100,70,0.35)'});}
function updateParts(dt){
  for(let i=G.parts.length-1;i>=0;i--){const p=G.parts[i];
    p.life-=dt;
    if(p.tp==='coin'){
      if(p.hom>0){p.hom-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=260*dt;}
      else{const dx=L.coinTarget.x-p.x,dy=L.coinTarget.y-p.y,d=Math.hypot(dx,dy);
        p.x+=dx/d*760*dt;p.y+=dy/d*760*dt;
        if(d<24){G.parts.splice(i,1);coinPing();continue;}}
    }else if(p.tp==='conf'){p.x+=p.vx*dt+Math.sin(p.life*p.sp)*1.4;p.y+=p.vy*dt;}
    else{p.x+=p.vx*dt;p.y+=p.vy*dt;if(p.tp==='poof'){p.vx*=0.92;p.vy*=0.92;}if(p.tp==='txt')p.vy+=14*dt;}
    if(p.life<=0)G.parts.splice(i,1);}
}
function drawParts(c){
  for(const p of G.parts){const a=clamp(p.life/p.max,0,1);
    c.save();c.globalAlpha=a;
    if(p.tp==='txt'){c.font='700 '+p.size+'px Fredoka, sans-serif';c.textAlign='center';
      if(p.color){c.lineWidth=3.5;c.strokeStyle='rgba(255,255,255,0.85)';c.strokeText(p.txt,p.x,p.y);c.fillStyle=p.color;}
      c.fillText(p.txt,p.x,p.y);}
    else if(p.tp==='coin'){c.font='16px sans-serif';c.textAlign='center';c.fillText('🪙',p.x,p.y);}
    else if(p.tp==='poof'){c.fillStyle=p.color;c.beginPath();c.arc(p.x,p.y,p.r*(0.5+a*0.8),0,TAU);c.fill();}
    else if(p.tp==='spark'){c.fillStyle=p.color;c.beginPath();c.arc(p.x,p.y,2.6*a+1,0,TAU);c.fill();}
    else if(p.tp==='conf'){c.fillStyle=p.color;c.fillRect(p.x,p.y,p.r,p.r*1.5);}
    c.restore();}
}

/* ---------- hats ---------- */
function drawHat(c,id,s){
  if(!id||id==='none')return;
  c.save();c.scale(s,s);c.lineWidth=2.5/s>3?3:2.5;c.strokeStyle='#432818';c.lineJoin='round';
  if(id==='straw'){
    c.fillStyle='#E9C46A';c.beginPath();c.ellipse(0,2,20,6,0,0,TAU);c.fill();c.stroke();
    c.beginPath();c.ellipse(0,-4,11,8,0,Math.PI,0);c.lineTo(11,2);c.lineTo(-11,2);c.closePath();c.fill();c.stroke();
    c.fillStyle='#C1442E';c.fillRect(-11,-2,22,4);
  }else if(id==='flower'){
    const cols=['#F4A9C7','#FFF3B0','#F4A9C7','#B8E0D2','#F4A9C7'];
    for(let i=0;i<5;i++){const x=-14+i*7;c.fillStyle=cols[i];
      c.beginPath();c.arc(x,0,4.4,0,TAU);c.fill();
      c.fillStyle='#FFB627';c.beginPath();c.arc(x,0,1.8,0,TAU);c.fill();}
  }else if(id==='top'){
    c.fillStyle='#23272F';c.beginPath();c.ellipse(0,2,16,4.5,0,0,TAU);c.fill();c.stroke();
    c.fillStyle='#23272F';c.beginPath();c.roundRect(-10,-18,20,20,3);c.fill();c.stroke();
    c.fillStyle='#C1442E';c.fillRect(-10,-4,20,5);
  }else if(id==='wizard'){
    c.fillStyle='#5A4FCF';c.beginPath();c.ellipse(0,2,17,5,0,0,TAU);c.fill();c.stroke();
    c.beginPath();c.moveTo(-11,2);c.quadraticCurveTo(-2,-10,3,-26);c.quadraticCurveTo(4,-12,11,2);c.closePath();c.fill();c.stroke();
    c.fillStyle='#FFD166';c.font='8px sans-serif';c.textAlign='center';c.fillText('✦',0,-8);c.fillText('✧',4,-17);
  }else if(id==='crown'){
    c.fillStyle='#FFD166';c.beginPath();
    c.moveTo(-13,2);c.lineTo(-13,-9);c.lineTo(-7,-3);c.lineTo(0,-12);c.lineTo(7,-3);c.lineTo(13,-9);c.lineTo(13,2);c.closePath();
    c.fill();c.stroke();
    c.fillStyle='#E4572E';c.beginPath();c.arc(0,-2,2.4,0,TAU);c.fill();
  }else if(id==='party'){
    c.fillStyle='#E4572E';c.beginPath();c.moveTo(-10,2);c.lineTo(0,-24);c.lineTo(10,2);c.closePath();c.fill();c.stroke();
    c.fillStyle='#FFF3B0';c.beginPath();c.arc(-3,-5,2,0,TAU);c.fill();
    c.beginPath();c.arc(4,-11,2,0,TAU);c.fill();
    c.fillStyle='#7FD8C9';c.beginPath();c.arc(0,-24,4,0,TAU);c.fill();c.stroke();
  }else if(id==='bow'){
    c.fillStyle='#F06292';
    c.beginPath();c.moveTo(-2,-2);c.lineTo(-14,-10);c.lineTo(-12,5);c.closePath();c.fill();c.stroke();
    c.beginPath();c.moveTo(2,-2);c.lineTo(14,-10);c.lineTo(12,5);c.closePath();c.fill();c.stroke();
    c.fillStyle='#E4572E';c.beginPath();c.arc(0,-2,4,0,TAU);c.fill();c.stroke();
  }
  c.restore();
}

/* ---------- BISCUIT the horse ---------- */
function drawHorse(c,x,y,s,o){
  o=o||{};
  const coat=COATS[o.coat||SV.eq.coat]||COATS.chestnut;
  const mane=MANES[o.mane||SV.eq.mane]||MANES.cocoa;
  const hat=o.hat!==undefined?o.hat:SV.eq.hat;
  const ph=o.phase||0, mv=o.moving?1:0, idle=o.idleT||0;
  const bob=mv?Math.abs(Math.sin(ph))*3.4:Math.sin(idle*1.7)*1.6;
  const rest=o.resting;
  c.save();c.translate(x,y);
  if(o.tilt)c.rotate(o.tilt);
  c.scale(s,s);c.translate(0,-bob);
  c.lineWidth=3;c.strokeStyle='#432818';c.lineJoin='round';c.lineCap='round';
  // tail
  const tw=Math.sin(idle*2.1+1)*0.14+(mv?Math.sin(ph*0.5)*0.1:0);
  c.save();c.translate(-52,-94);c.rotate(tw);
  c.fillStyle=(mane.pat==='rainbow')?RAINBOW[3]:mane.a;
  c.beginPath();c.moveTo(0,-4);
  c.quadraticCurveTo(-22,8,-19,40);c.quadraticCurveTo(-12,46,-8,38);
  c.quadraticCurveTo(-11,18,4,6);c.closePath();c.fill();c.stroke();
  if(mane.pat==='rainbow'){c.save();c.clip();for(let i=0;i<5;i++){c.fillStyle=RAINBOW[i];c.fillRect(-24,-6+i*10,30,10);}c.restore();c.stroke();}
  c.restore();
  // far legs — two segments hinged at a knee/hock so the gallop actually folds, not just swings rigid
  const upLen=30,loLen=27;
  function leg(hx,ang,col){
    const sw=mv?Math.sin(ang)*0.5:0;
    const fold=mv?Math.max(0,Math.sin(ang))*1.0:0;
    c.save();c.translate(hx,-56);c.rotate(sw);
    c.fillStyle=col;c.beginPath();c.roundRect(-5.5,-2,11,upLen+2,5.5);c.fill();c.stroke();
    c.save();c.translate(0,upLen);c.rotate(fold);
    c.fillStyle=col;c.beginPath();c.roundRect(-5,-1,10,loLen,4.5);c.fill();c.stroke();
    c.fillStyle='#3B2417';c.beginPath();c.roundRect(-6,loLen-8,12,9,3);c.fill();
    c.restore();
    c.restore();
  }
  if(!rest){
    leg(-32,ph+Math.PI+0.4,coat.b);
    leg(30,ph+Math.PI,coat.b);
  }
  // body
  c.fillStyle=coat.a;c.beginPath();c.ellipse(0,-82,55,31,0,0,TAU);c.fill();c.stroke();
  if(coat.pat==='dapple'){c.save();c.beginPath();c.ellipse(0,-82,55,31,0,0,TAU);c.clip();
    c.fillStyle='rgba(255,255,255,0.4)';
    [[-30,-88,7],[-12,-72,6],[8,-90,8],[26,-76,6],[-2,-98,5],[38,-92,5],[-42,-74,5]].forEach(d=>{c.beginPath();c.arc(d[0],d[1],d[2],0,TAU);c.fill();});c.restore();}
  if(coat.pat==='pinto'){c.save();c.beginPath();c.ellipse(0,-82,55,31,0,0,TAU);c.clip();
    c.fillStyle=coat.c;
    c.beginPath();c.ellipse(-24,-92,20,15,0.4,0,TAU);c.fill();
    c.beginPath();c.ellipse(22,-70,18,13,-0.3,0,TAU);c.fill();c.restore();}
  // belly highlight
  c.save();c.globalAlpha=0.18;c.fillStyle='#fff';c.beginPath();c.ellipse(-4,-98,40,12,0.05,0,TAU);c.fill();c.restore();
  // near legs
  if(!rest){
    leg(-26,ph+0.4,coat.a);
    leg(36,ph,coat.a);
  }else{
    // folded legs
    c.fillStyle=coat.a;c.beginPath();c.roundRect(-44,-62,36,14,7);c.fill();c.stroke();
    c.beginPath();c.roundRect(12,-62,36,14,7);c.fill();c.stroke();
  }
  // mane — one flowing scalloped shape hugging the crest (drawn behind neck)
  c.fillStyle=(mane.pat==='rainbow')?RAINBOW[2]:mane.a;
  c.beginPath();
  c.moveTo(52,-136);
  c.lineTo(41,-149);
  c.quadraticCurveTo(27,-147,29,-133);
  c.quadraticCurveTo(15,-131,18,-117);
  c.quadraticCurveTo(5,-114,11,-101);
  c.quadraticCurveTo(13,-92,26,-95);
  c.closePath();c.fill();c.stroke();
  if(mane.pat==='rainbow'){c.save();c.beginPath();
    c.moveTo(52,-136);c.lineTo(41,-149);c.quadraticCurveTo(27,-147,29,-133);
    c.quadraticCurveTo(15,-131,18,-117);c.quadraticCurveTo(5,-114,11,-101);
    c.quadraticCurveTo(13,-92,26,-95);c.closePath();c.clip();
    for(let i=0;i<5;i++){c.fillStyle=RAINBOW[i];
      c.beginPath();c.moveTo(-4,-152+i*12);c.lineTo(60,-140+i*12);
      c.lineTo(60,-128+i*12);c.lineTo(-4,-140+i*12);c.closePath();c.fill();}
    c.restore();}
  // neck — rises from the chest/shoulder, leans forward
  c.fillStyle=coat.a;c.beginPath();
  c.moveTo(20,-100);
  c.quadraticCurveTo(30,-122,44,-142);
  c.lineTo(66,-128);
  c.quadraticCurveTo(56,-102,48,-72);
  c.closePath();c.fill();c.stroke();
  // head — carried forward, nose dipped
  c.save();c.translate(56,-134);c.rotate(0.30);
  // far ear
  c.fillStyle=coat.b;c.beginPath();c.moveTo(-15,-9);c.lineTo(-12,-27);c.lineTo(-4,-11);c.closePath();c.fill();c.stroke();
  c.fillStyle=coat.a;c.beginPath();c.ellipse(0,0,19,14,0.05,0,TAU);c.fill();c.stroke();
  // muzzle
  c.fillStyle=coat.c;c.beginPath();c.roundRect(9,-10,28,20,10);c.fill();c.stroke();
  c.fillStyle='#432818';c.beginPath();c.arc(30,-2,2,0,TAU);c.fill();
  // mouth
  c.beginPath();c.moveTo(27,7);c.quadraticCurveTo(31,9,35,6);c.stroke();
  // near ear
  c.fillStyle=coat.a;c.beginPath();c.moveTo(-7,-11);c.lineTo(-1,-29);c.lineTo(6,-12);c.closePath();c.fill();c.stroke();
  // eye
  const blink=o.blink||rest;
  if(blink){c.beginPath();c.moveTo(-3,-4);c.quadraticCurveTo(1,-1,5,-4);c.stroke();}
  else{c.fillStyle='#2b1a0e';c.beginPath();c.ellipse(1,-4,3.6,4,0,0,TAU);c.fill();
    c.fillStyle='#fff';c.beginPath();c.arc(2.3,-5.6,1.3,0,TAU);c.fill();}
  // forelock
  c.fillStyle=(mane.pat==='rainbow')?RAINBOW[0]:mane.a;
  c.beginPath();c.ellipse(-9,-11,9.5,6,-0.4,0,TAU);c.fill();c.stroke();
  // hat sits on head (counter-rotated so it stays level)
  c.save();c.translate(-4,-20);c.rotate(-0.26);drawHat(c,hat,1);c.restore();
  c.restore();
  // saddle blanket (cosmetic) + saddle
  const bl=BLANKETS[o.blanket||SV.eq.blanket]||BLANKETS.crimson;
  c.fillStyle=bl.a;c.beginPath();c.roundRect(-28,-110,48,24,5);c.fill();c.stroke();
  if(bl.pat==='star'){c.fillStyle=bl.t;c.font='8px sans-serif';c.textAlign='center';c.textBaseline='middle';
    c.fillText('✦',-18,-100);c.fillText('✦',-5,-93);c.fillText('✦',8,-101);c.fillText('✦',15,-92);}
  // trim stripe clipped to the blanket's own rounded silhouette so it doesn't poke past the corners
  c.save();c.beginPath();c.roundRect(-28,-110,48,24,5);c.clip();
  c.fillStyle=bl.t;c.fillRect(-28,-90,48,4);
  c.restore();
  c.fillStyle='#7A3020';c.beginPath();c.ellipse(-4,-110,17,7,0,Math.PI,0);c.fill();c.stroke();
  // saddlebag (near side, rear) — bulges with load
  const wl=(o.wl||0)+(o.wr||0);
  const bulge=clamp(wl*1.1,0,12);
  c.fillStyle='#8C5E3C';c.beginPath();c.roundRect(-52,-92,26,26+bulge,8);c.fill();c.stroke();
  c.fillStyle='#6E4425';c.beginPath();c.roundRect(-52,-92,26,10,{tl:8,tr:8,br:2,bl:2});c.fill();c.stroke();
  c.fillStyle='#FFD166';c.beginPath();c.arc(-39,-80,2.5,0,TAU);c.fill();c.stroke();
  // strap
  c.beginPath();c.moveTo(-24,-88);c.quadraticCurveTo(-20,-60,-14,-54);c.stroke();
  // sweat / zzz
  if(o.sweat){c.fillStyle='#4EA5D9';c.beginPath();
    const sy=-150+((idle*40)%26);
    c.ellipse(66,sy,3,4.4,0,0,TAU);c.fill();}
  c.restore();
}

/* ---------- PIP the toucan ---------- */
function drawToucan(c,x,y,s,o){
  o=o||{};
  const bk=BEAKS[o.beak||SV.eq.beak]||BEAKS.classic;
  const hat=o.hat!==undefined?o.hat:SV.eq.hat;
  const flap=o.flap!==undefined?o.flap:Math.sin((o.t||0)*11)*0.55;
  const face=o.face||1;
  c.save();c.translate(x,y);c.rotate(o.rot||0);c.scale(s*face,s);
  c.lineWidth=2.6;c.strokeStyle='#101318';c.lineJoin='round';c.lineCap='round';
  // tail
  c.save();c.translate(-13,12);c.rotate(-0.5+Math.sin((o.t||0)*3)*0.06);
  c.fillStyle='#20242C';c.beginPath();c.roundRect(-14,-4,16,9,4);c.fill();c.stroke();
  c.fillStyle='#D7263D';c.beginPath();c.roundRect(-13,3,10,5,2.5);c.fill();
  c.restore();
  // carried item (behind feet)
  if(o.carry){
    const sway=Math.sin((o.t||0)*4)*0.1;
    c.save();c.translate(2,30);c.rotate(sway);
    c.font='26px sans-serif';c.textAlign='center';c.textBaseline='middle';
    c.save();c.scale(face,1);c.fillText(ITEMS[o.carry].e,0,2);c.restore();
    c.restore();
    // gripping feet
    c.strokeStyle='#5A7684';c.lineWidth=3.4;
    c.beginPath();c.moveTo(-2,17);c.lineTo(-1,25);c.moveTo(6,17);c.lineTo(5,25);c.stroke();
    c.strokeStyle='#101318';c.lineWidth=2.6;
  }else{
    c.strokeStyle='#5A7684';c.lineWidth=3.4;
    c.beginPath();c.moveTo(-1,18);c.lineTo(-2,24);c.moveTo(6,18);c.lineTo(6,24);c.stroke();
    c.strokeStyle='#101318';c.lineWidth=2.6;
  }
  // body
  c.fillStyle='#20242C';c.beginPath();c.ellipse(0,0,15.5,20,0.08,0,TAU);c.fill();c.stroke();
  // chest/face patch
  c.fillStyle='#FFF8E1';c.beginPath();c.ellipse(6.5,-3,10,13.5,0.12,0,TAU);c.fill();
  c.strokeStyle='rgba(16,19,24,0.35)';c.stroke();c.strokeStyle='#101318';
  // wing — anchored at the shoulder so the tip sweeps a real flap arc, not just a shrug
  c.save();c.translate(-4,-6);c.rotate(flap*1.1-0.2);
  c.fillStyle='#171B22';c.beginPath();
  c.moveTo(3,-1);
  c.quadraticCurveTo(-10,-5,-21,3);
  c.quadraticCurveTo(-16,13,-3,12);
  c.quadraticCurveTo(5,6,3,-1);
  c.closePath();c.fill();c.stroke();
  c.fillStyle='#D7263D';c.beginPath();
  c.moveTo(-14,6);c.quadraticCurveTo(-16,10,-13,11.5);c.quadraticCurveTo(-9,9,-9,6);c.closePath();c.fill();
  c.restore();
  // eye
  c.fillStyle='#59C3E3';c.beginPath();c.arc(8,-9,4.6,0,TAU);c.fill();c.stroke();
  c.fillStyle='#101318';c.beginPath();c.arc(9,-9,2.1,0,TAU);c.fill();
  c.fillStyle='#fff';c.beginPath();c.arc(9.8,-10,0.8,0,TAU);c.fill();
  // beak
  c.fillStyle=bk.a;c.beginPath();
  c.moveTo(13,-13);
  c.quadraticCurveTo(38,-15,45,-6);
  c.quadraticCurveTo(46,-3,43,-2);
  c.lineTo(14,-1);c.closePath();c.fill();c.stroke();
  // lower beak
  c.fillStyle=bk.a;c.beginPath();
  c.moveTo(14,-1);c.lineTo(40,-2);c.quadraticCurveTo(38,5,28,5);c.quadraticCurveTo(18,5,14,1);c.closePath();c.fill();c.stroke();
  // ridge + tip
  c.fillStyle=bk.b;c.beginPath();
  c.moveTo(14,-12.5);c.quadraticCurveTo(36,-14.5,43,-7);c.quadraticCurveTo(36,-11,15,-9.5);c.closePath();c.fill();
  c.fillStyle=bk.c;c.beginPath();c.ellipse(42.5,-4.5,3.6,4.2,0.3,0,TAU);c.fill();
  c.strokeStyle='rgba(16,19,24,0.5)';c.beginPath();c.moveTo(14,-1);c.lineTo(40,-2);c.stroke();c.strokeStyle='#101318';
  // tiny hat
  c.save();c.translate(1,-17);c.rotate(-0.05);drawHat(c,hat,0.55);c.restore();
  c.restore();
}

/* ---------- scene helpers ---------- */
function skyGrad(c,cols,y0,y1){const g=c.createLinearGradient(0,y0,0,y1);g.addColorStop(0,cols[0]);g.addColorStop(1,cols[1]);return g;}
function drawCloud(c,x,y,s,alpha){c.save();c.globalAlpha=alpha;c.fillStyle='#fff';
  c.beginPath();c.arc(x,y,14*s,0,TAU);c.arc(x+16*s,y-6*s,17*s,0,TAU);c.arc(x+34*s,y,13*s,0,TAU);
  c.arc(x+17*s,y+6*s,15*s,0,TAU);c.fill();c.restore();}
function hash(i){let h=(i*2654435761)%4294967296;h=(h^(h>>13))*1274126177;return ((h^(h>>16))>>>0)/4294967296;}

function drawBunting(c,y,off){
  const cols=['#E4572E','#FFB627','#7DC95E','#4EA5D9','#CE8BE0'];
  c.strokeStyle='rgba(90,50,20,0.55)';c.lineWidth=2;
  c.beginPath();c.moveTo(-10,y);
  for(let x=-10;x<W+20;x+=26)c.quadraticCurveTo(x+13,y+7,x+26,y);
  c.stroke();
  let ci=0;
  for(let x=-10;x<W+14;x+=26){
    c.fillStyle=cols[(ci+off)%5];ci++;
    c.beginPath();c.moveTo(x+7,y+3);c.lineTo(x+19,y+3);c.lineTo(x+13,y+15);c.closePath();c.fill();
  }
}

/* ---------- market (pack) scene ---------- */
function drawPackScene(c){
  // warm sky
  c.fillStyle=skyGrad(c,['#FFD98E','#FFE9B8'],0,H*0.5);c.fillRect(0,0,W,H*0.55);
  // ground
  c.fillStyle='#E8C27C';c.fillRect(0,H*0.42,W,H*0.58);
  c.fillStyle='rgba(140,94,60,0.14)';
  for(let i=0;i<7;i++){const yy=H*0.5+i*(H*0.5/7);c.fillRect(0,yy,W,2);}
  drawCloud(c,W*0.16+Math.sin(G.t*0.1)*10,44,0.8,0.7);
  drawCloud(c,W*0.74+Math.sin(G.t*0.13+2)*12,66,0.6,0.6);
  // stalls behind belt
  const sy=L.beltY+L.beltH+8;
  function stall(x,w,col1,col2){
    c.fillStyle='#8C5E3C';c.fillRect(x+4,sy+16,6,42);c.fillRect(x+w-10,sy+16,6,42);
    c.fillStyle='#A9744B';c.beginPath();c.roundRect(x-2,sy+42,w+4,16,4);c.fill();
    for(let i=0;i<Math.ceil((w+8)/22);i++){
      const sx=x-4+i*22, sw=Math.min(22,(w+8)-i*22);
      c.fillStyle=i%2?col2:col1;
      c.fillRect(sx,sy,sw,16);
      c.beginPath();c.arc(sx+sw/2,sy+16,sw/2,0,Math.PI);c.fill();
    }
  }
  stall(W*0.06,W*0.34,'#E4572E','#FFF3D6');
  stall(W*0.58,W*0.34,'#4EA5D9','#FFF3D6');
  drawBunting(c,L.topH+8,0);
  // conveyor belt
  const by=L.beltY;
  c.fillStyle='#8C5E3C';c.beginPath();c.roundRect(-8,by,W+16,L.beltH,14);c.fill();
  c.fillStyle='#A9744B';c.beginPath();c.roundRect(-8,by+6,W+16,L.beltH-16,10);c.fill();
  // moving slats
  c.strokeStyle='rgba(90,50,20,0.35)';c.lineWidth=3;
  const so=((G.beltOff)%34+34)%34;
  for(let x=-so;x<W+34;x+=34){c.beginPath();c.moveTo(x,by+8);c.lineTo(x-8,by+L.beltH-12);c.stroke();}
  // belt items
  for(const it of G.belt)drawBeltItem(c,it);
  // rollers
  c.fillStyle='#6E4425';
  for(let x=14;x<W;x+=W/5){c.beginPath();c.arc(x,by+L.beltH+7,7,0,TAU);c.fill();}
}
function drawBeltItem(c,it){
  const d=ITEMS[it.id];
  const bobY=Math.sin(G.t*3+it.seed*9)*2;
  const cy=L.beltY+L.beltH/2+bobY-2;
  c.save();c.translate(it.x,cy);
  // crate
  c.fillStyle='#DFA45E';c.strokeStyle='#8C5E3C';c.lineWidth=3;
  c.beginPath();c.roundRect(-30,-30,60,60,11);c.fill();c.stroke();
  c.strokeStyle='rgba(140,94,60,0.5)';c.lineWidth=2;
  c.beginPath();c.moveTo(-30,-10);c.lineTo(30,-10);c.moveTo(-30,10);c.lineTo(30,10);c.stroke();
  // emoji
  c.font='34px sans-serif';c.textAlign='center';c.textBaseline='middle';
  c.fillText(d.e,0,-2);
  // footprint (grid cells this item occupies)
  c.fillStyle='#6E4425';
  const cs=6.5, ox=-(d.fw*(cs+2)-2)/2, oy=d.fh>1?11:17;
  for(let rr=0;rr<d.fh;rr++)for(let cc=0;cc<d.fw;cc++){
    c.beginPath();c.roundRect(ox+cc*(cs+2),oy+rr*(cs+2),cs,cs,1.5);c.fill();
  }
  // useful-on-route badge
  if(it.useful){
    c.fillStyle='#4EA5D9';c.strokeStyle='#1A759F';c.lineWidth=2.4;
    c.beginPath();c.arc(-23,-23,10.5,0,TAU);c.fill();c.stroke();
    c.fillStyle='#fff';c.font='700 14px Fredoka, sans-serif';c.fillText('✓',-23,-22);
    c.strokeStyle='#8C5E3C';
  }
  // order badge
  if(it.want){
    c.save();c.translate(23,-23);c.rotate(Math.sin(G.t*4+it.seed)*0.15);
    c.fillStyle='#FFD166';c.strokeStyle='#C4820A';c.lineWidth=2.6;
    c.beginPath();c.arc(0,0,11.5,0,TAU);c.fill();c.stroke();
    c.fillStyle='#7A4A21';c.font='700 14px Fredoka, sans-serif';c.fillText('!',0,1);
    c.restore();
  }
  if(it.id==='gem'&&Math.sin(G.t*5+it.seed*7)>0.55){
    c.fillStyle='#fff';c.font='15px sans-serif';c.fillText('✨',14,-16);
  }
  // price tag
  const afford=walletLeft()>=d.cost;
  c.fillStyle=afford?'#FFD166':'#E85D4A';c.strokeStyle='#3d2410';c.lineWidth=2.6;
  c.beginPath();c.roundRect(-20,33,40,18,8.5);c.fill();c.stroke();
  c.fillStyle=afford?'#5c3a10':'#fff';c.font='700 13px Fredoka, sans-serif';
  c.textAlign='center';c.textBaseline='middle';
  c.fillText('🪙'+d.cost,0,42);
  c.restore();
}
function bagDims(){return {cols:3+(SV.gear.bags>=1?1:0), rows:3+(SV.gear.bags>=2?1:0)};}
function bagW(bag){return bag.places.reduce((a,p)=>a+p.w*p.h,0);} // cells used
function bagGridOcc(bag){const {cols,rows}=bagDims();
  const g=Array.from({length:rows},()=>Array(cols).fill(-1));
  bag.places.forEach((p,i)=>{for(let r=0;r<p.h;r++)for(let c=0;c<p.w;c++)g[p.r+r][p.c+c]=i;});
  return g;}
function fitInto(bag,id){const it=ITEMS[id];const {cols,rows}=bagDims();const g=bagGridOcc(bag);
  const shapes=(it.fw===it.fh)?[[it.fw,it.fh]]:[[it.fw,it.fh],[it.fh,it.fw]];
  for(const [w,h] of shapes)
    for(let r=0;r<=rows-h;r++)for(let c=0;c<=cols-w;c++){
      let ok=true;
      for(let rr=0;rr<h&&ok;rr++)for(let cc=0;cc<w;cc++)if(g[r+rr][c+cc]>=0){ok=false;break;}
      if(ok)return {r,c,w,h};
    }
  return null;}
function bagLayout(r){const {cols,rows}=bagDims();
  const cell=Math.min((r.w-16)/cols,(r.h-30)/rows);
  const gx=r.x+(r.w-cell*cols)/2, gy=r.y+22;
  return {cols,rows,cell,gx,gy};}
function bagItemAt(side,x,y){
  const bag=side<0?G.bagL:G.bagR, r=side<0?L.panL:L.panR;
  if(x<r.x||x>r.x+r.w||y<r.y-24||y>r.y+r.h)return -1;
  const {cell,gx,gy}=bagLayout(r);
  for(let i=0;i<bag.places.length;i++){const p=bag.places[i];
    if(x>=gx+p.c*cell&&x<=gx+(p.c+p.w)*cell&&y>=gy+p.r*cell&&y<=gy+(p.r+p.h)*cell)return i;
  }
  return -1;
}
function drawBagPanel(c,r,bag,label,side){
  const {cols,rows}=bagDims();
  const fits=G.held?fitInto(bag,G.held):null;
  const hot=G.held&&fits, dead=G.held&&!fits;
  c.save();
  if(hot){c.shadowColor='#FFD166';c.shadowBlur=10+Math.sin(G.t*7)*6;}
  c.fillStyle='#FFF3D6';c.strokeStyle=hot?'#FFB627':dead?'#D9958A':'#C98B4B';c.lineWidth=hot?4:3;
  c.beginPath();c.roundRect(r.x,r.y,r.w,r.h,14);c.fill();c.stroke();
  c.shadowBlur=0;
  // header
  c.fillStyle='#7A4A21';c.font='700 13px Fredoka, sans-serif';c.textAlign=side<0?'left':'right';
  c.fillText(label,side<0?r.x+10:r.x+r.w-10,r.y+16);
  c.font='700 12px Fredoka, sans-serif';c.textAlign=side<0?'right':'left';
  c.fillStyle=dead?'#C1442E':'#a8703a';
  c.fillText(dead?'no room!':bagW(bag)+'/'+(cols*rows),side<0?r.x+r.w-10:r.x+10,r.y+16);
  // grid
  const {cell,gx,gy}=bagLayout(r);
  c.strokeStyle='rgba(201,139,75,0.45)';c.lineWidth=1.5;
  for(let rr=0;rr<rows;rr++)for(let cc=0;cc<cols;cc++){
    c.fillStyle='rgba(255,255,255,0.55)';
    c.beginPath();c.roundRect(gx+cc*cell+1.5,gy+rr*cell+1.5,cell-3,cell-3,5);c.fill();c.stroke();
  }
  // items span their cells
  c.textAlign='center';c.textBaseline='middle';
  for(const p of bag.places){
    const px=gx+p.c*cell, py=gy+p.r*cell, pw=p.w*cell, ph=p.h*cell;
    c.fillStyle='#FFE9B8';c.strokeStyle='#C98B4B';c.lineWidth=2;
    c.beginPath();c.roundRect(px+2,py+2,pw-4,ph-4,7);c.fill();c.stroke();
    c.font=Math.min(pw,ph)*0.62+'px sans-serif';
    c.fillText(ITEMS[p.id].e,px+pw/2,py+ph/2+1);
  }
  c.restore();
}

/* ---------- journey scene ---------- */
function drawJourneyScene(c){
  const R=G.region, gy=L.groundY;
  c.fillStyle=skyGrad(c,R.sky,0,gy);c.fillRect(0,0,W,gy);
  // celestial
  if(R.prop==='bay'){
    c.fillStyle='#FFF3B0';c.beginPath();c.arc(W*0.78,70,22,0,TAU);c.fill();
    c.fillStyle=R.sky[0];c.beginPath();c.arc(W*0.78-9,64,19,0,TAU);c.fill();
    c.fillStyle='rgba(255,255,255,0.9)';
    for(let i=0;i<24;i++){const sx=(hash(i)*W),syy=hash(i+50)*gy*0.55;
      c.globalAlpha=0.4+Math.sin(G.t*2+i)*0.35;c.fillRect(sx,syy,2,2);}
    c.globalAlpha=1;
  }else{
    c.fillStyle='rgba(255,243,176,0.95)';c.beginPath();c.arc(W*0.82,64,24,0,TAU);c.fill();
  }
  drawCloud(c,((W*0.2-G.wx*0.12)%(W+160)+W+160)%(W+160)-80,54,0.75,0.8);
  drawCloud(c,((W*0.7-G.wx*0.09)%(W+160)+W+160)%(W+160)-80,96,0.55,0.65);
  // distant birds
  for(let i=0;i<3;i++){
    const bx=((i*167+40-G.wx*0.35)%(W+80)+W+80)%(W+80)-40, byy=52+hash(i+7)*88;
    const fl=Math.sin(G.t*6+i*2)*3;
    c.strokeStyle='rgba(70,55,40,0.5)';c.lineWidth=2;
    c.beginPath();c.moveTo(bx-6,byy+fl);c.quadraticCurveTo(bx,byy-3,bx,byy);
    c.quadraticCurveTo(bx,byy-3,bx+6,byy+fl);c.stroke();
  }
  // far layer
  drawFar(c,R,gy);
  // mid props
  drawMid(c,R,gy);
  // ground
  c.fillStyle=R.ground;c.fillRect(0,gy,W,H-gy);
  c.fillStyle='rgba(0,0,0,0.10)';c.fillRect(0,gy,W,5);
  // road
  c.fillStyle='rgba(120,90,55,0.5)';c.fillRect(0,gy+16,W,26);
  c.strokeStyle='rgba(255,248,231,0.5)';c.lineWidth=3;c.setLineDash([18,16]);
  c.lineDashOffset=G.wx%34;
  c.beginPath();c.moveTo(0,gy+29);c.lineTo(W,gy+29);c.stroke();c.setLineDash([]);
  // ground tufts
  for(let i=0;i<9;i++){
    const spacing=W/6;
    const xr=((i*spacing-G.wx)%(W+spacing)+W+spacing)%(W+spacing)-spacing/2;
    const yr=gy+52+hash(i)*(H-gy-70);
    c.fillStyle='rgba(255,255,255,0.10)';
    c.beginPath();c.ellipse(xr,yr,9+hash(i+9)*7,2.6,0,0,TAU);c.fill();
  }
  // landmarks
  for(const nd of G.nodes)drawLandmark(c,nd,gy);
}
function drawWeather(c){
  if(!(G.weather&&(G.state==='journey')))return;
  const id=G.weather.id, a=clamp(G.weather.t,0,1);
  c.save();c.globalAlpha=a;
  if(id==='rain'||id==='river'){
    c.strokeStyle='rgba(80,120,200,0.55)';c.lineWidth=2;
    for(let i=0;i<34;i++){
      const rx=(hash(i)*W+G.t*260)%W, ry=((hash(i+40)*H)+G.t*430)%H;
      c.beginPath();c.moveTo(rx,ry);c.lineTo(rx-4,ry+14);c.stroke();}
  }else if(id==='cold'){
    c.fillStyle='rgba(255,255,255,0.85)';
    for(let i=0;i<26;i++){
      const sx=(hash(i)*W+Math.sin(G.t*1.5+i)*30+G.t*30)%W, sy=(hash(i+60)*H+G.t*62)%H;
      c.beginPath();c.arc(sx,sy,2.2+hash(i+9)*2,0,TAU);c.fill();}
  }else if(id==='dark'){
    const g=c.createRadialGradient(L.jHorse.x,L.jHorse.y-80,90,L.jHorse.x,L.jHorse.y-80,Math.max(W,H)*0.75);
    g.addColorStop(0,'rgba(10,10,30,0)');g.addColorStop(1,'rgba(10,10,30,0.72)');
    c.fillStyle=g;c.fillRect(0,0,W,H);
  }else if(id==='bees'){
    c.font='15px sans-serif';c.textAlign='center';
    for(let i=0;i<7;i++){
      const bx=L.jHorse.x+150+Math.sin(G.t*3+i*2.2)*60+i*8, by=L.jHorse.y-140+Math.cos(G.t*4+i*1.7)*40;
      c.fillText('🐝',bx,by);}
  }
  c.restore();
}
function spawnTrail(x,y){
  const tr=SV.eq.trail;if(!tr||tr==='none')return;
  G.trailT=(G.trailT||0)-1;if(G.trailT>0)return;G.trailT=2;
  if(tr==='sparkle')G.parts.push({tp:'spark',x:x+rand(-4,4),y:y+rand(-4,4),vx:rand(-14,14),vy:rand(-6,20),life:0.5,max:0.5,color:choice(['#FFD166','#FFF3B0','#fff'])});
  else if(tr==='hearts')G.parts.push({tp:'txt',x,y,vx:rand(-10,10),vy:rand(6,22),life:0.6,max:0.6,txt:'💗',size:11});
  else if(tr==='rainbow')G.parts.push({tp:'poof',x,y,vx:rand(-8,8),vy:rand(4,16),life:0.55,max:0.55,r:4,color:choice(RAINBOW)});
}
/* Pip's "improvise" stunt — a little loop or dance while a risky choice resolves */
function startPipStunt(){G.stunt={t:1.0,dur:1.0,kind:choice(['loop','dance']),seed:rand(0,TAU)};}
function pipStuntOffset(){
  if(!G.stunt)return null;
  const p=1-clamp(G.stunt.t/G.stunt.dur,0,1);
  if(G.stunt.kind==='loop'){
    const ang=G.stunt.seed+p*TAU*2.4;
    return {dx:Math.cos(ang)*32,dy:Math.sin(ang)*24-14,rot:ang+Math.PI/2,face:Math.cos(ang)>=0?1:-1};
  }
  const ang=p*TAU*3.2;
  return {dx:Math.sin(ang)*24,dy:-Math.abs(Math.sin(ang*1.5))*16,rot:Math.sin(ang)*0.6,face:Math.cos(ang)>=0?1:-1};
}
function pipJourneyPos(jh){
  let x=jh.x+92*jh.s+Math.sin(G.t*1.3)*8;
  let y=jh.y-224*jh.s+Math.sin(G.t*2.2)*10;
  let rot=0,face=1;
  const st=pipStuntOffset();
  if(st){x+=st.dx*jh.s;y+=st.dy*jh.s;rot=st.rot;face=st.face;}
  return {x,y,rot,face};
}
function drawFar(c,R,gy){
  const off=G.wx*0.25, sp=190;
  c.fillStyle=R.far;
  for(let i=Math.floor(off/sp)-1;i<Math.floor((off+W)/sp)+2;i++){
    const x=i*sp-off, h1=44+hash(i)*70;
    if(R.prop==='pass'){
      c.fillStyle=R.far;
      c.beginPath();c.moveTo(x-80,gy);c.lineTo(x+15,gy-h1-46);c.lineTo(x+110,gy);c.closePath();c.fill();
      c.fillStyle='#fff';
      c.beginPath();c.moveTo(x-8,gy-h1-24);c.lineTo(x+15,gy-h1-46);c.lineTo(x+38,gy-h1-24);
      c.lineTo(x+28,gy-h1-18);c.lineTo(x+15,gy-h1-27);c.lineTo(x+2,gy-h1-17);c.closePath();c.fill();
    }else if(R.prop==='bay'){
      c.fillStyle=R.mid;c.fillRect(0,gy-34,W,34);
      c.fillStyle='rgba(255,255,255,0.25)';
      const wv=Math.sin(G.t*2+i)*3;
      c.fillRect(x-off%1,gy-20+wv,60,2.5);
      break;
    }else{
      c.fillStyle=R.far;
      c.beginPath();c.ellipse(x,gy+22,120,64+h1*0.5,0,Math.PI,0);c.fill();
    }
  }
  if(R.prop==='bay'){
    const bx=((W*0.6-G.wx*0.25)%(W+200)+W+200)%(W+200)-100;
    c.fillStyle='#FFF8E1';c.beginPath();c.moveTo(bx,gy-38);c.lineTo(bx,gy-64);c.lineTo(bx+20,gy-40);c.closePath();c.fill();
    c.fillStyle='#8C5E3C';c.fillRect(bx-12,gy-38,32,7);
  }
}
function drawMid(c,R,gy){
  const off=G.wx*0.55, sp=240;
  for(let i=Math.floor(off/sp)-1;i<Math.floor((off+W)/sp)+2;i++){
    const x=i*sp-off+hash(i+30)*90, r=hash(i+3);
    if(R.prop==='meadow'){
      c.fillStyle=R.mid;
      c.beginPath();c.arc(x,gy-8,20+r*12,0,TAU);c.arc(x+22,gy-4,16+r*8,0,TAU);c.fill();
      c.fillStyle='#F4A9C7';c.beginPath();c.arc(x+8,gy-22-r*8,3,0,TAU);c.fill();
    }else if(R.prop==='woods'){
      const th=66+r*46;
      c.fillStyle='#5C3A21';c.fillRect(x-5,gy-16,10,16);
      c.fillStyle=R.mid;
      c.beginPath();c.moveTo(x-30,gy-10);c.lineTo(x,gy-th);c.lineTo(x+30,gy-10);c.closePath();c.fill();
      c.beginPath();c.moveTo(x-22,gy-th*0.55);c.lineTo(x,gy-th-18);c.lineTo(x+22,gy-th*0.55);c.closePath();c.fill();
    }else if(R.prop==='pass'){
      c.fillStyle=R.mid;
      c.beginPath();c.moveTo(x-26,gy);c.lineTo(x-6,gy-34-r*22);c.lineTo(x+22,gy);c.closePath();c.fill();
    }else if(R.prop==='festival'){
      const tc=['#E4572E','#4EA5D9','#CE8BE0','#FFB627'][i&3];
      c.fillStyle=tc;
      c.beginPath();c.moveTo(x-30,gy);c.lineTo(x,gy-52-r*18);c.lineTo(x+30,gy);c.closePath();c.fill();
      c.fillStyle='rgba(255,255,255,0.75)';
      c.beginPath();c.moveTo(x-12,gy);c.lineTo(x,gy-24);c.lineTo(x+12,gy);c.closePath();c.fill();
      c.fillStyle='#FFD166';c.beginPath();c.arc(x,gy-56-r*18,4,0,TAU);c.fill();
    }else if(R.prop==='bay'){
      c.fillStyle=R.mid;
      c.beginPath();c.arc(x,gy,16+r*10,Math.PI,0);c.fill();
      c.fillStyle='#7FD8C9';c.beginPath();c.arc(x+8,gy-10-r*8,3,0,TAU);c.fill();
    }
  }
}
function drawLandmark(c,nd,gy){
  const x=nd.x-G.wx+L.jHorse.x;
  if(x<-90||x>W+90)return;
  c.save();c.translate(x,gy+14);
  if(nd.type==='arrive'){
    // destination gate
    c.fillStyle='#8C5E3C';c.strokeStyle='#5C3A21';c.lineWidth=3;
    c.beginPath();c.roundRect(-58,-128,12,128,4);c.fill();c.stroke();
    c.beginPath();c.roundRect(46,-128,12,128,4);c.fill();c.stroke();
    c.fillStyle='#FFF3D6';c.beginPath();c.roundRect(-66,-152,132,36,10);c.fill();c.stroke();
    c.font='22px sans-serif';c.textAlign='center';c.textBaseline='middle';
    c.fillText(G.region.icon,0,-134);
    const cols=['#E4572E','#FFB627','#7DC95E','#4EA5D9'];
    for(let i=0;i<4;i++){c.fillStyle=cols[i];
      c.beginPath();c.moveTo(-46+i*26,-116);c.lineTo(-30+i*26,-116);c.lineTo(-38+i*26,-102);c.closePath();c.fill();}
  }else if(nd.type==='fork'){
    // signpost
    c.fillStyle='#8C5E3C';c.strokeStyle='#5C3A21';c.lineWidth=3;
    c.beginPath();c.roundRect(-5,-74,10,74,3);c.fill();c.stroke();
    c.fillStyle='#FFF3D6';c.beginPath();c.roundRect(-34,-102,68,34,8);c.fill();c.stroke();
    c.font='21px sans-serif';c.textAlign='center';c.textBaseline='middle';
    c.fillText(nd.done?'✅':'🔀',0,-85);
  }else if(!nd.done&&nd.ev){
    // the encounter itself stands on the road ahead, mounted on a little vector badge
    const ev=EVENTS[nd.ev];
    const floaty=['rain','cold','dark','rainbow','bees'].includes(nd.ev);
    const bob=Math.sin(G.t*3+nd.x)*(floaty?6:3);
    c.translate(0,22); // road level
    if(!floaty){
      const by=-34+bob; // badge center
      c.fillStyle='rgba(0,0,0,0.18)';c.beginPath();c.ellipse(0,2,20,5,0,0,TAU);c.fill();
      // wooden post holding the badge up
      const postTop=by+21;
      c.fillStyle='#8C5E3C';c.strokeStyle='#5C3A21';c.lineWidth=2.2;
      c.fillRect(-3,postTop,6,-postTop);c.strokeRect(-3,postTop,6,-postTop);
      // round plaque
      c.fillStyle='#FFF3D6';c.beginPath();c.arc(0,by,23,0,TAU);c.fill();
      c.strokeStyle='#8C5E3C';c.lineWidth=3;c.stroke();
      c.font='28px sans-serif';c.textAlign='center';c.textBaseline='middle';
      c.fillText(ev.icon,0,by+2);
      if(Math.abs(x-L.jHorse.x)<W*0.7){
        c.font='15px sans-serif';c.globalAlpha=0.55+Math.sin(G.t*5)*0.35;
        c.fillText('❗',22,by-20);c.globalAlpha=1;
      }
    }else{
      const by=-58+bob; // floating sky badge
      const g=c.createRadialGradient(0,by,4,0,by,26);
      g.addColorStop(0,'rgba(255,255,255,0.9)');g.addColorStop(1,'rgba(255,255,255,0.16)');
      c.fillStyle=g;c.beginPath();c.arc(0,by,25,0,TAU);c.fill();
      c.strokeStyle='rgba(255,255,255,0.65)';c.lineWidth=2;c.beginPath();c.arc(0,by,25,0,TAU);c.stroke();
      c.font='28px sans-serif';c.textAlign='center';c.textBaseline='middle';
      c.fillText(ev.icon,0,by+2);
      if(Math.abs(x-L.jHorse.x)<W*0.7){
        c.font='15px sans-serif';c.globalAlpha=0.55+Math.sin(G.t*5)*0.35;
        c.fillText('❗',22,by-24);c.globalAlpha=1;
      }
    }
  }
  c.restore();
}

/* ---------- title / shop scenes ---------- */
function drawMeadowIdle(c,horseX,horseY,horseS){
  c.fillStyle=skyGrad(c,['#8ED6FF','#EAF9E0'],0,H*0.6);c.fillRect(0,0,W,H*0.6);
  c.fillStyle='rgba(255,243,176,0.95)';c.beginPath();c.arc(W*0.82,70,26,0,TAU);c.fill();
  drawCloud(c,W*0.18+Math.sin(G.t*0.12)*12,70,0.9,0.85);
  drawCloud(c,W*0.62+Math.sin(G.t*0.09+3)*14,120,0.65,0.7);
  c.fillStyle='#A8D971';c.beginPath();c.ellipse(W*0.25,H*0.62,W*0.5,90,0,Math.PI,0);c.fill();
  c.fillStyle='#96CD60';c.beginPath();c.ellipse(W*0.85,H*0.62,W*0.45,70,0,Math.PI,0);c.fill();
  c.fillStyle='#8CC152';c.fillRect(0,H*0.6,W,H*0.4);
  for(let i=0;i<12;i++){
    const fx=hash(i+70)*W, fy=H*0.64+hash(i+90)*(H*0.3);
    c.fillStyle=['#F4A9C7','#FFF3B0','#fff'][i%3];
    c.beginPath();c.arc(fx,fy,3.2,0,TAU);c.fill();
  }
  // biscuit idle
  drawHorse(c,horseX,horseY,horseS,{idleT:G.idleT,blink:G.blinkT<0.13,wl:0,wr:0});
  // pip circles overhead
  const px=horseX+Math.sin(G.t*0.9)*W*0.24;
  const py=horseY-228*horseS+Math.sin(G.t*1.7)*14;
  drawToucan(c,px,py,0.95,{t:G.t,face:Math.cos(G.t*0.9)>0?1:-1});
}

/* ---------- render dispatch ---------- */
function render(){
  ctx.clearRect(0,0,W,H);
  ctx.save();
  if(G.shake>0){ctx.translate(rand(-1,1)*G.shake*6,rand(-1,1)*G.shake*5);}
  if(G.state==='title'){
    drawMeadowIdle(ctx,W*0.5,H*0.66,clamp(W/430,0.6,1)*1.05);
  }else if(G.state==='debugH'){
    ctx.fillStyle='#EAF9E0';ctx.fillRect(0,0,W,H);
    drawHorse(ctx,W*0.5,H*0.40,1.9,{idleT:G.idleT,blink:G.blinkT<0.13});
    drawHorse(ctx,W*0.5,H*0.78,1.5,{phase:G.t*8,moving:1,wl:4,wr:3});
  }else if(G.state==='shop'){
    ctx.fillStyle=skyGrad(ctx,['#8ED6FF','#EAF9E0'],0,H*0.36);ctx.fillRect(0,0,W,H*0.36);
    ctx.fillStyle='#8CC152';ctx.fillRect(0,H*0.28,W,H*0.14);
    drawHorse(ctx,W*0.42,H*0.315,0.72,{idleT:G.idleT,blink:G.blinkT<0.13});
    drawToucan(ctx,W*0.74,H*0.17+Math.sin(G.t*1.6)*7,1.0,{t:G.t,face:-1});
  }else if(G.state==='pack'){
    drawPackScene(ctx);
    const hp=L.packHorse;
    const wl=bagW(G.bagL),wr=bagW(G.bagR);
    G.tilt=lerp(G.tilt,clamp((wr-wl)*0.014,-0.09,0.09),0.1);
    drawHorse(ctx,hp.x,hp.y,hp.s,{idleT:G.idleT,blink:G.blinkT<0.13,tilt:G.tilt,wl,wr,
      sweat:G.pat<12&&G.pat>0});
    drawBagPanel(ctx,L.panL,G.bagL,'◀ LEFT BAG',-1);
    drawBagPanel(ctx,L.panR,G.bagR,'RIGHT BAG ▶',1);
    // toucan on top
    const t=G.tou;
    drawToucan(ctx,t.x,t.y,1.05,{t:G.t,face:t.face,carry:G.held,rot:t.rot||0});
    // toss-back X while carrying
    if(G.held&&t.mode==='carryHover'){
      ctx.save();ctx.translate(t.x-(t.face||1)*48,t.y+4);
      ctx.fillStyle='rgba(228,87,46,0.95)';ctx.beginPath();ctx.arc(0,0,13,0,TAU);ctx.fill();
      ctx.strokeStyle='#fff';ctx.lineWidth=3;ctx.beginPath();
      ctx.moveTo(-4.5,-4.5);ctx.lineTo(4.5,4.5);ctx.moveTo(4.5,-4.5);ctx.lineTo(-4.5,4.5);ctx.stroke();
      ctx.restore();
    }
  }else if(G.state==='journey'||G.state==='results'){
    drawJourneyScene(ctx);
    const jh=L.jHorse;
    const moving=G.jstate==='trot';
    drawHorse(ctx,jh.x,jh.y,jh.s,{phase:G.horsePhase,moving,idleT:G.idleT,blink:G.blinkT<0.13,
      wl:bagW(G.bagL),wr:bagW(G.bagR),resting:G.jstate==='rest'});
    const pp=pipJourneyPos(jh);
    drawToucan(ctx,pp.x,pp.y,1.0,{t:G.t,face:pp.face,rot:pp.rot});
    drawWeather(ctx);
    if(G.viewBags&&G.state==='journey'){
      ctx.fillStyle='rgba(0,0,0,0.45)';ctx.fillRect(0,0,W,H);
      drawBagPanel(ctx,L.panL,G.bagL,'◀ LEFT BAG',-1);
      drawBagPanel(ctx,L.panR,G.bagR,'RIGHT BAG ▶',1);
    }
  }
  drawParts(ctx);
  ctx.restore();
}

/* ---------- main loop ---------- */
let lastTs=0;
function frame(ts){
  const dt=Math.min((ts-lastTs)/1000,0.05)||0.016;lastTs=ts;
  G.t+=dt;G.idleT+=dt;
  G.blinkT-=dt;if(G.blinkT<0)G.blinkT=rand(1.6,4.2);
  if(G.shake>0)G.shake=Math.max(0,G.shake-dt*3);
  if(G.state==='pack')updatePack(dt);
  else if(G.state==='journey')updateJourney(dt);
  updateTou(dt);
  updateParts(dt);
  render();
  requestAnimationFrame(frame);
}
