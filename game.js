'use strict';
/* ============================================================
   GAME LOGIC — packing, journey, encounters, shop, boot
   ============================================================ */
const elTopbar=$('topbar'),elTbTop=$('tbTop'),elTbSub=$('tbSub'),elPatwrap=$('patwrap'),elPatbar=$('patbar');
const elDepart=$('departBtn'),elCard=$('card'),elToast=$('toast'),elHint=$('hint');
let toastTimer=null,shopReturn='title',shopTab='coat';

function showToast(msg,ms){elToast.textContent=msg;elToast.classList.add('on');
  clearTimeout(toastTimer);toastTimer=setTimeout(()=>elToast.classList.remove('on'),ms||1800);}
function vibe(ms){try{if(navigator.vibrate)navigator.vibrate(ms);}catch(e){}}
function coinPing(){Sound.coin(1);}

/* ---------- inventory helpers ---------- */
function countItem(id){return G.bagL.places.filter(p=>p.id===id).length+G.bagR.places.filter(p=>p.id===id).length;}
function totalItems(){return G.bagL.places.length+G.bagR.places.length;}
function removeItem(id){
  const l=bagW(G.bagL)>=bagW(G.bagR)?[G.bagL,G.bagR]:[G.bagR,G.bagL];
  for(const bag of l){const ix=bag.places.findIndex(p=>p.id===id);if(ix>=0){bag.places.splice(ix,1);return true;}}
  return false;}
function heaviestItem(){let best=null,bw=-1;
  for(const bag of[G.bagL,G.bagR])for(const p of bag.places)if(ITEMS[p.id].w>bw&&p.id!=='gem'){bw=ITEMS[p.id].w;best=p.id;}
  return best;}
function eachPacked(fn){for(const bag of[G.bagL,G.bagR])for(const p of bag.places)fn(p.id);}
function riskP(){return clamp(0.55+(SV.gear.shoe?0.12:0)+(SV.gear.charm?0.06:0)+(G.hearts-1.5)*0.04-Math.min(G.tier*0.03,0.09),0.2,0.95);}
function walletLeft(){return Math.max(0,SV.coins-G.daySpent);}

/* ---------- day building ---------- */
function buildDay(){
  const day=G.day;
  G.region=REGIONS[(day-1)%REGIONS.length];
  G.tier=Math.floor((day-1)/REGIONS.length);
  G.patMax=50+SV.gear.saddle*10-Math.min(G.tier*3,12);
  G.pat=G.patMax;
  // order
  if(day===1){
    G.order=['apple','apple','apple'];
  }else{
    const oSize=Math.min(3,2+(G.tier>=1?1:0));
    G.order=[];
    const opool=G.region.orders.filter(id=>id!=='gem'||G.tier>=1);
    for(let i=0;i<oSize;i++)G.order.push(choice(opool));
  }
  // events
  const evCount=Math.min(4+(G.tier>=1?1:0),5);
  let pool=shuffled(G.region.pool);
  const allIds=Object.keys(EVENTS).filter(k=>k!=='chest');
  while(pool.length<evCount+4)pool.push(choice(allIds.filter(k=>!pool.includes(k))));
  const main=pool.slice(0,evCount);
  // node layout: 2 events, fork, fork-event, remaining events, arrive
  G.nodes=[];let d=360;const sp=430;
  G.nodes.push({type:'ev',ev:main[0],x:d});d+=sp;
  G.nodes.push({type:'ev',ev:main[1],x:d});d+=sp;
  G.nodes.push({type:'fork',x:d});d+=sp*0.8;
  G.nodes.push({type:'ev',ev:null,x:d});d+=sp; // set by fork
  for(let i=2;i<main.length;i++){G.nodes.push({type:'ev',ev:main[i],x:d});d+=sp;}
  if(Math.random()<0.22){G.nodes.push({type:'ev',ev:'chest',x:d-sp/2});}
  G.nodes.push({type:'arrive',x:d+140});
  G.routeIcons=main.map(id=>EVENTS[id].icon);
  G.routeEvs=main;
  G.forkOpts=pool.slice(evCount,evCount+4);
  G.revealN=2+(SV.gear.spy?1:0);
  // items that solve the *revealed* route events get a blue badge on the belt
  G.routeSet=new Set();
  main.slice(0,G.revealN).forEach(id=>{const ev=EVENTS[id];
    if(ev.opts)for(const o of ev.opts)if(o.item)G.routeSet.add(o.item);});
  // reset day state
  G.bagL={places:[]};G.bagR={places:[]};
  G.hearts=3;G.dayCoins=0;G.eventCoins=0;G.daySpent=0;G.rescued=false;
  G.burst=0;G.weather=null;
  G.belt=[];G.beltTimer=0;G.held=null;G.spill=false;G.nodeIdx=0;G.wx=0;G.stunt=null;
  if(SV.gear.pouch){const f=fitInto(G.bagL,'apple');if(f)G.bagL.places.push(Object.assign({id:'apple'},f));}
  buildBeltPool();
}
function buildBeltPool(){
  const boost={};
  for(const id of G.order)boost[id]=(boost[id]||0)+2.4;
  for(const nd of G.nodes){if(nd.type!=='ev'||!nd.ev)continue;const ev=EVENTS[nd.ev];
    if(ev.opts)for(const o of ev.opts)if(o.item)boost[o.item]=(boost[o.item]||0)+1.2;}
  for(const o of G.forkOpts){const ev=EVENTS[o];if(ev&&ev.opts)for(const op of ev.opts)if(op.item)boost[op.item]=(boost[op.item]||0)+0.5;}
  G.beltPool=[];let acc=0;
  for(const id in ITEMS){
    let w=(RARE_WEIGHTS[id]!==undefined?RARE_WEIGHTS[id]:1)+(boost[id]||0);
    acc+=w;G.beltPool.push([id,acc]);
  }
  G.beltAcc=acc;
}
function pickBeltItem(){
  const r=Math.random()*G.beltAcc;
  for(const[id,a]of G.beltPool)if(r<=a)return id;
  return 'apple';
}

/* ---------- topbar / HUD ---------- */
function pill(html,id,cls){return '<span class="pill'+(cls?' '+cls:'')+'"'+(id?' id="'+id+'"':'')+'>'+html+'</span>';}
function orderHtml(){
  return G.order.map(id=>{
    const have=countItem(id)>0;
    // count-aware: mark greyed until enough packed
    return '<span style="'+(have?'':'filter:grayscale(1);opacity:.6;')+'">'+ITEMS[id].e+'</span>';
  }).join('');
}
function orderHtmlSmart(){
  const packed={};
  eachPacked(id=>packed[id]=(packed[id]||0)+1);
  const used={};
  return G.order.map(id=>{
    used[id]=(used[id]||0)+1;
    const ok=(packed[id]||0)>=used[id];
    return '<span style="'+(ok?'':'filter:grayscale(1);opacity:.55;')+'">'+ITEMS[id].e+'</span>';
  }).join(' ');
}
function routeHtml(){
  return G.routeIcons.map((ic,i)=>i<G.revealN?ic:'❓').join(' ');
}
function updateTopbar(){
  if(G.state==='pack'){
    elTopbar.classList.remove('hide');elPatwrap.classList.remove('hide');
    elTbTop.innerHTML=
      pill('🏠','homeBtn')+
      pill('<b>Day '+G.day+'</b> '+G.region.icon+' '+G.region.name)+
      pill('🪙 <b id="coinsTxt">'+walletLeft()+'</b>','','gold')+
      pill(SV.mute?'🔇':'🔊','muteBtn');
    elTbSub.innerHTML=
      pill('Order: <b id="orderTxt">'+orderHtmlSmart()+'</b>','','gold')+
      pill('Route: '+routeHtml()+' <b>▾</b>','routePill','gold');
    $('homeBtn').addEventListener('click',goHome);
    $('muteBtn').addEventListener('click',toggleMute);
    $('routePill').addEventListener('click',showRouteCard);
  }else if(G.state==='journey'||G.state==='results'){
    elTopbar.classList.remove('hide');elPatwrap.classList.add('hide');
    let morale='';for(let i=0;i<3;i++)morale+='<span style="color:'+(i<G.hearts?'var(--greenD)':'rgba(74,44,26,.25)')+'">▲</span>';
    const seen=Math.min(G.nodeIdx,G.nodes.length);
    elTbTop.innerHTML=
      pill(morale,'heartsTxt')+
      pill('📍 '+seen+'/'+G.nodes.length)+
      pill('🪙 <b id="coinsTxt">+'+G.dayCoins+'</b>','','gold')+
      (G.state==='journey'?pill('🎒','bagBtn'):'')+
      pill(SV.mute?'🔇':'🔊','muteBtn');
    elTbSub.innerHTML=pill(G.region.icon+' To '+G.region.name+'…');
    $('muteBtn').addEventListener('click',toggleMute);
    if(G.state==='journey')$('bagBtn').addEventListener('click',toggleBagView);
  }else{
    elTopbar.classList.add('hide');elPatwrap.classList.add('hide');
  }
}
function refreshCoins(){const el=$('coinsTxt');if(!el)return;
  el.innerHTML=G.state==='pack'?walletLeft():'+'+G.dayCoins;}
function refreshOrder(){const el=$('orderTxt');if(el)el.innerHTML=orderHtmlSmart();}
function updateDepartBtn(){
  if(G.state!=='pack'){elDepart.classList.add('hide');return;}
  elDepart.classList.remove('hide');
  const imb=Math.abs(bagW(G.bagL)-bagW(G.bagR));
  if(imb>=4){elDepart.classList.add('warn');elDepart.innerHTML='DEPART ⚠️ lopsided!';}
  else{elDepart.classList.remove('warn');elDepart.innerHTML='DEPART ▶';}
}
function toggleMute(){SV.mute=SV.mute?0:1;save();Sound.click();updateTopbar();updateTitleUI();}
function toggleBagView(){G.viewBags=!G.viewBags;Sound.click();}

/* ---------- pack phase ---------- */
function startDay(){
  buildDay();
  G.state='pack';G.tilt=0;
  hideAll();updateTopbar();updateDepartBtn();
  G.tou.mode='hover';G.tou.x=L.homeTou.x;G.tou.y=L.homeTou.y;
  showToast('Day '+G.day+': deliver to '+G.region.icon+' '+G.region.name+'!');
  if(G.day===1&&!SV.tut){G.tutStep=0;G.patPaused=true;showTutStep();}
  else{G.tutStep=-1;G.patPaused=false;}
}
function showTutStep(){
  const steps=[
    '📦 Today’s <b>ORDER</b> is up top — pack those items for big coins! Tap <b>Route ▾</b> to see what’s ahead (blue ✓ crates solve it).<small>tap to continue</small>',
    '👆 Tap a drifting crate to buy it — Pip will snatch it! Watch your 🪙 up top.<small>go on, tap one!</small>',
    '🎒 Now tap a <b>saddlebag</b>! Items take up grid space — big things need big gaps. Keep both bags even!',
    '🍎 Tip: tap <b>Biscuit’s head</b> while holding food to feed him — it restores his patience. Pack smart, then DEPART!<small>tap to start the clock</small>',
  ];
  if(G.tutStep<0||G.tutStep>=steps.length){elHint.classList.add('hide');return;}
  elHint.innerHTML=steps[G.tutStep];
  elHint.style.top=(G.tutStep===0?'18%':G.tutStep===1?'34%':G.tutStep===2?'46%':'30%');
  elHint.classList.remove('hide');
}
elHint.addEventListener('click',()=>{
  if(G.tutStep===0){G.tutStep=1;showTutStep();}
  else if(G.tutStep===3){G.tutStep=-1;G.patPaused=false;SV.tut=1;save();showTutStep();}
});
function tutAdvance(from){
  if(G.tutStep===1&&from==='grab'){G.tutStep=2;showTutStep();}
  else if(G.tutStep===2&&from==='stow'){G.tutStep=3;showTutStep();}
}

function updatePack(dt){
  // belt
  const speed=46+Math.min(G.day*2,22);
  G.beltOff+=speed*dt;
  G.beltTimer-=dt;
  if(G.beltTimer<=0&&G.belt.length<7){
    G.beltTimer=rand(1.25,1.9);
    G.belt.push({id:pickBeltItem(),x:W+44,seed:Math.random()*10});
  }
  for(let i=G.belt.length-1;i>=0;i--){
    const it=G.belt[i];it.x-=speed*dt;
    if(it.x<-46)G.belt.splice(i,1);
  }
  // flag wanted items
  const packed={};eachPacked(id=>packed[id]=(packed[id]||0)+1);
  const need={};for(const id of G.order)need[id]=(need[id]||0)+1;
  for(const it of G.belt){
    it.want=!!(need[it.id]&&(packed[it.id]||0)<need[it.id]);
    it.useful=G.routeSet.has(it.id);
  }
  // patience
  if(!G.patPaused){
    G.pat-=dt;
    elPatbar.style.width=clamp(G.pat/G.patMax*100,0,100)+'%';
    if(G.pat<=12)elPatbar.style.background='linear-gradient(90deg,#E4572E,#F58549)';
    else elPatbar.style.background='linear-gradient(90deg,#7DC95E,#B5E655)';
    if(G.pat<=0){showToast('Biscuit’s patience ran out — off we go! 🐴');depart(true);}
  }
}

/* ---------- toucan FSM ---------- */
function touGoto(mode,tx,ty,dur,cb){const t=G.tou;
  t.mode=mode;t.fx=t.x;t.fy=t.y;t.tx=tx;t.ty=ty;t.p=0;t.dur=dur;t.cb=cb;
  t.face=tx>=t.x?1:-1;}
function updateTou(dt){
  const t=G.tou;t.bob+=dt;
  if(G.state!=='pack'){return;}
  if(t.mode==='hover'){
    t.x=lerp(t.x,L.homeTou.x+Math.sin(t.bob*1.4)*W*0.16,0.05);
    t.y=lerp(t.y,L.homeTou.y+Math.sin(t.bob*2.6)*7,0.08);
    t.face=Math.cos(t.bob*1.4)>=0?1:-1;t.rot=0;
  }else if(t.mode==='carryHover'){
    t.x=lerp(t.x,L.carryTou.x,0.12);
    t.y=lerp(t.y,L.carryTou.y+Math.sin(t.bob*3)*5,0.12);t.rot=0;
  }else{
    t.p=Math.min(1,t.p+dt/t.dur);
    const e=t.p<0.5?2*t.p*t.p:1-Math.pow(-2*t.p+2,2)/2;
    // live-track moving target for dives
    if(t.mode==='toItem'&&t.target){t.tx=t.target.x;t.ty=L.beltY+L.beltH/2-6;}
    t.x=lerp(t.fx,t.tx,e);t.y=lerp(t.fy,t.ty,e);
    t.rot=(t.mode==='toItem')?(t.face*0.35*Math.sin(t.p*Math.PI)):0;
    spawnTrail(t.x-10,t.y+8);
    if(t.p>=1){const cb=t.cb;t.cb=null;if(cb)cb();}
  }
}
function grabItem(it){
  const d=ITEMS[it.id];
  if(walletLeft()<d.cost){Sound.err();showToast('Can’t afford '+d.e+' '+d.n+' (🪙'+d.cost+')!');G.shake=0.3;return;}
  const t=G.tou;t.target=it;
  touGoto('toItem',it.x,L.beltY+L.beltH/2-6,0.38,()=>{
    const ix=G.belt.indexOf(it);
    if(ix<0){touGoto('return',L.homeTou.x,L.homeTou.y,0.3,()=>{G.tou.mode='hover';});return;}
    G.belt.splice(ix,1);
    G.daySpent+=d.cost;refreshCoins();
    G.held=it.id;Sound.pop();vibe(12);pSpark(t.x,t.y,5);
    touGoto('carryHover2',L.carryTou.x,L.carryTou.y,0.32,()=>{G.tou.mode='carryHover';});
    tutAdvance('grab');
  });
}
function stowTo(side){
  const id=G.held;
  const bag=side<0?G.bagL:G.bagR, r=side<0?L.panL:L.panR;
  const fit=fitInto(bag,id);
  if(!fit){Sound.err();showToast('No room in the '+(side<0?'left':'right')+' bag for '+ITEMS[id].e+'!');G.shake=0.4;return;}
  touGoto('toBag',r.x+r.w/2,r.y-16,0.3,()=>{
    bag.places.push(Object.assign({id},fit));G.held=null;Sound.stow();vibe(8);
    pPoof(r.x+r.w/2,r.y+18,'rgba(255,220,150,0.8)');
    refreshOrder();updateDepartBtn();tutAdvance('stow');
    touGoto('return',L.homeTou.x,L.homeTou.y,0.35,()=>{G.tou.mode='hover';});
  });
}
function pickupFromBag(side,idx){
  const bag=side<0?G.bagL:G.bagR, r=side<0?L.panL:L.panR;
  const p=bag.places[idx],id=p.id;
  const {cell,gx,gy}=bagLayout(r);
  const px=gx+(p.c+p.w/2)*cell, py=gy+(p.r+p.h/2)*cell;
  touGoto('toStowed',px,py,0.28,()=>{
    const t=G.tou;
    bag.places.splice(idx,1);
    G.held=id;Sound.pop();vibe(10);pSpark(t.x,t.y,4);
    updateDepartBtn();
    touGoto('carryHover2',L.carryTou.x,L.carryTou.y,0.28,()=>{G.tou.mode='carryHover';});
  });
}
function feedHorse(){
  const id=G.held,d=ITEMS[id];
  const hp=L.packHorse;
  touGoto('toMouth',hp.x+80*hp.s,hp.y-152*hp.s,0.35,()=>{
    G.held=null;Sound.munch();vibe(12);
    G.pat=Math.min(G.patMax,G.pat+d.food);
    pText(hp.x+70*hp.s,hp.y-160*hp.s,'+'+d.food+'s ⏳','#4F9A3A',18);
    pHeart(hp.x+40*hp.s,hp.y-150*hp.s,2);
    touGoto('return',L.homeTou.x,L.homeTou.y,0.35,()=>{G.tou.mode='hover';});
  });
}
function tossHeld(){
  Sound.whoosh();pPoof(G.tou.x,G.tou.y+30);
  G.held=null;
  touGoto('return',L.homeTou.x,L.homeTou.y,0.3,()=>{G.tou.mode='hover';});
}

/* ---------- tap routing ---------- */
function handleTap(x,y){
  if(G.state==='journey'){
    if(G.viewBags){G.viewBags=false;Sound.click();return;}
    if(G.jstate==='trot'){G.burst=1;Sound.whoosh();vibe(8);
      for(let i=0;i<3;i++)pDust(L.jHorse.x-24+i*20,L.jHorse.y-4);}
    return;
  }
  if(G.state!=='pack')return;
  const t=G.tou;
  if(G.tutStep===0)return; // waiting for hint tap
  if(t.mode==='carryHover'&&G.held){
    // toss X
    if(Math.hypot(x-(t.x-(t.face||1)*48),y-(t.y+4))<22){tossHeld();return;}
    // bags
    if(x>=L.panL.x&&x<=L.panL.x+L.panL.w&&y>=L.panL.y-24){stowTo(-1);return;}
    if(x>=L.panR.x&&x<=L.panR.x+L.panR.w&&y>=L.panR.y-24){stowTo(1);return;}
    // feed
    const hp=L.packHorse,d=ITEMS[G.held];
    if(d.food&&Math.hypot(x-(hp.x+58*hp.s),y-(hp.y-132*hp.s))<52*hp.s+16){feedHorse();return;}
    return;
  }
  if(t.mode==='hover'){
    // nearest belt item
    let best=null,bd=44;
    for(const it of G.belt){
      const d=Math.hypot(x-it.x,y-(L.beltY+L.beltH/2));
      if(d<bd){bd=d;best=it;}
    }
    if(best){grabItem(best);return;}
    // pick an already-stowed item back up to rearrange it
    let hit=bagItemAt(-1,x,y);
    if(hit>=0){pickupFromBag(-1,hit);return;}
    hit=bagItemAt(1,x,y);
    if(hit>=0){pickupFromBag(1,hit);return;}
    // tapping horse with no item: little whinny of impatience
    const hp=L.packHorse;
    if(Math.hypot(x-hp.x,y-(hp.y-90*hp.s))<80*hp.s){
      Sound.clip();pText(hp.x,hp.y-180*hp.s,'🐴?','#7A4A21',18);
    }
  }
}
cv.addEventListener('pointerdown',e=>{
  Sound.ensure();
  const r=cv.getBoundingClientRect();
  handleTap(e.clientX-r.left,e.clientY-r.top);
});

/* ---------- depart & journey ---------- */
function depart(auto){
  if(G.state!=='pack')return;
  if(totalItems()===0&&!auto){Sound.err();showToast('Pack something first — the client is waiting!');G.shake=0.4;return;}
  if(G.held)tossHeld();
  G.spill=Math.abs(bagW(G.bagL)-bagW(G.bagR))>=4;
  G.spillDone=false;
  G.state='journey';G.jstate='trot';G.wx=0;G.nodeIdx=0;G.stepT=0;G.viewBags=false;
  Sound.whoosh();Sound.fanfare();
  hideAll();updateTopbar();updateDepartBtn();
  showToast(G.spill?'The bags are lopsided… hold on tight! ⚠️':'Off we go! 🐴🪶');
}
elDepart.addEventListener('click',()=>{Sound.click();depart(false);});
function goHome(){Sound.click();G.state='title';hideAll();updateTopbar();updateDepartBtn();updateTitleUI();$('title').classList.remove('hide');}

function updateJourney(dt){
  if(G.stunt){G.stunt.t-=dt;if(G.stunt.t<=0)G.stunt=null;}
  if(G.weather&&G.jstate==='trot'){G.weather.t-=dt;if(G.weather.t<=0)G.weather=null;}
  if(G.jstate==='trot'){
    G.burst=Math.max(0,G.burst-dt*0.7);
    const spd=205*(1+0.85*G.burst);
    G.wx+=spd*dt;G.horsePhase+=dt*(8.5+G.burst*5);
    const jh=L.jHorse;
    const pp=pipJourneyPos(jh);
    spawnTrail(pp.x,pp.y+10);
    G.stepT-=dt;
    if(G.stepT<=0){G.stepT=0.31/(1+G.burst*0.7);G.stepAlt=!G.stepAlt;Sound.clip(G.stepAlt);
      pDust(L.jHorse.x-30*L.jHorse.s,L.jHorse.y-4);
      if(G.burst>0.3)pDust(L.jHorse.x+30*L.jHorse.s,L.jHorse.y-4);}
    // spill halfway to first node
    if(G.spill&&!G.spillDone&&G.wx>G.nodes[0].x*0.55){
      G.spillDone=true;
      const heavy=bagW(G.bagL)>=bagW(G.bagR)?G.bagL:G.bagR;
      if(heavy.places.length){
        let pi=0;heavy.places.forEach((p,i)=>{if(p.w*p.h>heavy.places[pi].w*heavy.places[pi].h)pi=i;});
        const id=heavy.places[pi].id;
        heavy.places.splice(pi,1);
        Sound.err();G.shake=0.6;vibe(30);
        pText(L.jHorse.x,L.jHorse.y-190*L.jHorse.s,ITEMS[id].e+' fell off!','#E4572E',19);
        pPoof(L.jHorse.x-40,L.jHorse.y-60);
        showToast('The lopsided bags lurched — '+ITEMS[id].n+' tumbled away! ⚖️');
      }
    }
    const nd=G.nodes[G.nodeIdx];
    if(nd&&G.wx>=nd.x){
      if(nd.type==='arrive'){arrive();}
      else if(nd.done){G.nodeIdx++;}
      else{G.jstate='card';openNode(nd);}
    }
  }else if(G.jstate==='celebrate'){
    G.celT-=dt;G.horsePhase+=dt*4;
    if(G.celT<=0)showResults();
  }
}
function openNode(nd){
  if(nd.type==='fork')showForkCard(nd);
  else showEventCard(nd);
}
function resumeTrot(nd){
  nd.done=true;G.nodeIdx++;G.jstate='trot';
  elCard.classList.add('hide');
  updateTopbar();
  if(G.hearts<=0&&!G.rescued){
    G.rescued=true;
    for(const n of G.nodes)if(n.type!=='arrive')n.done=true;
    showToast('A kind farmer’s cart carries you the rest of the way! 🛒');
  }
}

/* ---------- route plan (pack-phase strategy view) ---------- */
function showRouteCard(){
  if(G.state!=='pack')return;
  Sound.click();
  let html='<div class="cicon">🗺️</div><h2>'+G.region.icon+' Route plan</h2>'+
    '<div class="cdesc">Pip’s scouting report — pack accordingly!</div>';
  G.routeEvs.forEach((id,i)=>{
    if(i<G.revealN){
      const ev=EVENTS[id];
      const sol=(ev.opts||[]).filter(o=>o.item).map(o=>ITEMS[o.item].e).join(' ');
      html+='<div class="opt" style="pointer-events:none;"><span class="oe">'+ev.icon+'</span><span class="ol">'+ev.title+
        '<small>'+(sol?'solved by: '+sol:'no item needed — just vibes')+'</small></span></div>';
    }else{
      html+='<div class="opt" style="pointer-events:none;opacity:.6;"><span class="oe">❓</span><span class="ol">Surprise ahead'+
        '<small>'+(SV.gear.spy?'even the spyglass can’t see this far':'a 🔭 Spyglass reveals one more')+'</small></span></div>';
    }
  });
  html+='<div class="opt" style="pointer-events:none;"><span class="oe">🔀</span><span class="ol">A fork in the road'+
    '<small>pack a 🗺️ Map to reveal both paths</small></span></div>';
  html+='<button class="bigbtn small" id="routeOk">Got it ✓</button>';
  elCard.innerHTML=html;elCard.classList.remove('hide');
  $('routeOk').addEventListener('click',()=>{Sound.click();elCard.classList.add('hide');});
}

/* ---------- encounter cards ---------- */
function optBtn(inner,cls){return '<button class="opt '+(cls||'')+'">'+inner+'</button>';}
const ITEM_FAILS=['Nice try — that didn’t quite land.','Almost! Not this time.','Huh. That fizzled.','Worth a shot — no dice.'];
function showEventCard(nd){
  const ev=EVENTS[nd.ev];
  let html='<div class="cicon">'+ev.icon+'</div><h2>'+ev.title+'</h2><div class="cdesc">'+ev.desc+'</div>';
  const acts=[];
  if(ev.special==='trade'){
    const hv=heaviestItem();
    if(hv){html+=optBtn('<span class="oe">💎</span><span class="ol">Trade your '+ITEMS[hv].n+' '+ITEMS[hv].e+' for a gem<small>gems sell for 25🪙</small></span><span class="on">swap</span>');
      acts.push(()=>{removeItem(hv);addToBags('gem',true);Sound.spark();
        outcome(ev,'Deal! The trader vanishes in a puff of paperwork.','💎 +1',false);});}
    html+=optBtn('<span class="oe">👋</span><span class="ol">Politely decline</span><span class="on">—</span>');
    acts.push(()=>outcome(ev,'The trader nods respectfully and rolls away.','',false));
  }else if(ev.special==='chest'){
    const gift=choice(['apple','bread','cheese','scarf','rope','hat','gem']);
    const room=!!(fitInto(G.bagL,gift)||fitInto(G.bagR,gift));
    if(room){html+=optBtn('<span class="oe">'+ITEMS[gift].e+'</span><span class="ol">Take the '+ITEMS[gift].n+'!</span><span class="on">free!</span>');
      acts.push(()=>{addToBags(gift,true);Sound.spark();pConfetti();
        outcome(ev,'It’s a '+ITEMS[gift].n+'! Pip stows it with a flourish.',ITEMS[gift].e+' +1',false);});}
    else{html+=optBtn('<span class="oe">😔</span><span class="ol">Bags are full… leave it</span><span class="on">—</span>');
      acts.push(()=>outcome(ev,'You gaze at it longingly and trot on.','',false));}
  }else{
    for(const o of ev.opts){
      if(o.item){
        const has=countItem(o.item)>0,d=ITEMS[o.item];
        html+='<button class="opt"'+(has?'':' disabled')+'><span class="oe">'+d.e+'</span><span class="ol">'+o.label+
          '<small>'+(has?'uses 1 '+d.n+' · usually works':'you didn’t pack a '+d.n)+'</small></span><span class="on">+'+o.coins+'🪙'+(o.heart?' <span style="color:var(--greenD)">▲</span>':'')+'</span></button>';
        acts.push(has?()=>{removeItem(o.item);
          if(Math.random()<0.82)applyOutcome(ev,o.coins,o.heart||0,o.text);
          else applyOutcome(ev,0,-1,choice(ITEM_FAILS),true);
        }:null);
      }else if(o.risky){
        const p=riskP();
        html+='<button class="opt risky"><span class="oe">🎲</span><span class="ol">'+o.label+
          '<small>risky — Pip improvises</small></span><span class="on">'+Math.round(p*100)+'%</span></button>';
        acts.push(()=>{
          startPipStunt();
          if(Math.random()<p)applyOutcome(ev,o.good.coins||0,o.good.heart||0,o.good.text,false);
          else applyOutcome(ev,o.bad.coins||0,o.bad.heart||0,o.bad.text,true);
        });
      }else if(o.skip){
        html+='<button class="opt"><span class="oe">💨</span><span class="ol">'+o.label+'</span><span class="on">'+(o.coins?'+'+o.coins+'🪙':'—')+'</span></button>';
        acts.push(()=>applyOutcome(ev,o.coins||0,0,o.text));
      }
    }
  }
  elCard.innerHTML=html;
  elCard.classList.remove('hide');
  const btns=elCard.querySelectorAll('.opt');
  btns.forEach((b,i)=>{if(acts[i])b.addEventListener('click',()=>{Sound.click();acts[i]();});});
  G.curNode=nd;
  if(['rain','cold','dark','bees','river'].includes(nd.ev))G.weather={id:nd.ev,t:1.4};
}
function addToBags(id,silent){
  const bags=bagW(G.bagL)<=bagW(G.bagR)?[G.bagL,G.bagR]:[G.bagR,G.bagL];
  for(const bag of bags){const f=fitInto(bag,id);if(f){bag.places.push(Object.assign({id},f));return true;}}
  if(!silent)showToast('No room!');
  return false;
}
function applyOutcome(ev,coins,heart,text,isBad){
  let big='';
  if(coins>0){G.dayCoins+=coins;G.eventCoins+=coins;
    pCoin(L.jHorse.x,L.jHorse.y-120*L.jHorse.s,Math.min(coins,7));Sound.coin(Math.min(Math.ceil(coins/5),3));
    big='+'+coins+' 🪙';}
  if(heart>0){G.hearts=Math.min(3,G.hearts+heart);Sound.heart();pMorale(L.jHorse.x,L.jHorse.y-160*L.jHorse.s,4);
    big+=(big?'  ':'')+'▲';}
  if(heart<0){G.hearts=Math.max(0,G.hearts+heart);Sound.sad();G.shake=0.7;vibe(40);
    big+=(big?'  ':'')+'▼';}
  if(isBad&&!big)big='phew…';
  const nd=G.curNode;
  if(nd&&nd.ev&&!isBad){
    G.parts.push({tp:'txt',x:L.jHorse.x+130,y:L.jHorse.y-70,vx:70,vy:-170,life:1.0,max:1.0,txt:EVENTS[nd.ev].icon,size:30});
    pSpark(L.jHorse.x+130,L.jHorse.y-80,8);
  }
  outcome(ev,text,big,isBad);
}
function outcome(ev,text,big,isBad){
  elCard.innerHTML='<div class="cicon">'+ev.icon+'</div><h2>'+ev.title+'</h2>'+
    '<div class="outcome">'+text+(big?'<span class="big'+(isBad?' bad':'')+'">'+big+'</span>':'')+'</div>';
  updateTopbar();refreshCoins();
  setTimeout(()=>resumeTrot(G.curNode),1100);
}
const FORK_FLAVORS=[
  {icon:'🌤️',label:'Sunny shortcut'},
  {icon:'🌿',label:'Scenic loop'},
  {icon:'🪨',label:'Rocky trail'},
  {icon:'🌾',label:'Wildflower path'},
];
function showForkCard(nd){
  const hasMap=countItem('map')>0;
  let html='<div class="cicon">🔀</div><h2>The road forks!</h2><div class="cdesc">'+
    (hasMap?'Pip unfolds the map 🗺️ — every path revealed!':'Which way? (a 🗺️ Map would reveal what’s ahead…)')+'</div>';
  G.forkOpts.forEach((id,i)=>{
    const ev=EVENTS[id],f=FORK_FLAVORS[i];
    html+=optBtn('<span class="oe">'+f.icon+'</span><span class="ol">'+f.label+'<small>ahead: '+(hasMap?ev.icon+' '+ev.title:'❓ unknown')+'</small></span><span class="on">go</span>');
  });
  elCard.innerHTML=html;elCard.classList.remove('hide');
  const btns=elCard.querySelectorAll('.opt');
  btns.forEach((b,i)=>b.addEventListener('click',()=>{Sound.click();pickFork(nd,G.forkOpts[i]);}));
  G.curNode=nd;
}
function pickFork(nd,ev){
  const next=G.nodes[G.nodes.indexOf(nd)+1];
  if(next&&next.type==='ev')next.ev=ev;
  resumeTrot(nd);
}

/* ---------- arrival & results ---------- */
function arrive(){
  G.jstate='celebrate';G.celT=1.7;
  pConfetti();Sound.fanfare();vibe([30,60,30]);
  showToast(G.region.arrive);
}
function showResults(){
  if(G.state==='results')return; // never double-tally a day
  const rows=[];let total=0;
  // stock spend (charged now — coins were reserved, not deducted, while packing)
  if(G.daySpent>0){total-=G.daySpent;rows.push(['🛒 Spent on stock','−'+G.daySpent]);}
  // delivery
  const need={};for(const id of G.order)need[id]=(need[id]||0)+1;
  let delivered=0,dCoins=0,missing=0;
  for(const id in need){
    let got=0;
    for(let i=0;i<need[id];i++){if(removeItem(id)){got++;delivered++;}else missing++;}
    if(got>0){const v=got*(16+6*ITEMS[id].w);dCoins+=v;
      rows.push(['📦 Delivered '+ITEMS[id].e+'×'+got,'+'+v]);}
    if(got<need[id])rows.push(['😶 '+ITEMS[id].e+' missing ×'+(need[id]-got),'+0']);
  }
  total+=dCoins;
  if(missing===0&&delivered>0){const sb=20+10*delivered;total+=sb;rows.push(['🎉 Full order bonus','+'+sb]);}
  // odd melons
  let susN=0;while(removeItem('sus'))susN++;
  for(let i=0;i<susN;i++){
    const r=Math.random();
    if(r<0.5){total+=40;rows.push(['🍈 The odd melon had GOLD inside?!','+40']);}
    else if(r<0.8){rows.push(['🍈 The odd melon was full of bees. Bees!','+0']);}
    else{total+=4;rows.push(['🍈 A remarkably normal melon','+4']);}
  }
  // leftovers
  let leftV=0;const leftN=totalItems();
  eachPacked(id=>leftV+=ITEMS[id].sell);
  G.bagL={places:[]};G.bagR={places:[]};
  if(leftN>0){total+=leftV;rows.push(['🧺 Sold '+leftN+' leftover'+(leftN>1?'s':''),'+'+leftV]);}
  // adventures
  if(G.eventCoins>0){total+=G.eventCoins;rows.push(['🗺️ Road adventures','+'+G.eventCoins]);}
  if(G.rescued)rows.push(['🛒 Farmer’s rescue fee','−0 (he refused payment)']);
  rows.push(['total','🪙 '+total]);
  // bank it
  SV.coins+=total;SV.totalEarned+=total;
  if(total>SV.bestDay)SV.bestDay=total;
  if(missing===0&&delivered>0)SV.deliveries++;
  SV.day=G.day+1;save();
  // render
  $('resIcon').textContent=G.rescued?'🛌':'🏁';
  $('resTitle').textContent=G.rescued?'Home safe (barely!)':'Day '+G.day+' complete!';
  const tl=$('resTally');tl.innerHTML='';
  rows.forEach((r,i)=>{
    const div=document.createElement('div');
    div.className='trow'+(r[0]==='total'?' total':'');
    div.innerHTML='<span>'+(r[0]==='total'?'TOTAL':r[0])+'</span><span class="tv">'+r[1]+'</span>';
    tl.appendChild(div);
    setTimeout(()=>{div.classList.add('show');if(r[0]==='total'){Sound.fanfare();pCoin(W/2,H/2,8);}else Sound.coin(1);},250+i*260);
  });
  $('resFlavor').textContent=total>=SV.bestDay&&total>30?'★ New best day! Pip does a barrel roll. ★':
    G.rescued?'Biscuit is already asleep. Pip tucks him in.':'Pip counts the coins twice. Biscuit naps.';
  $('resNextBtn').textContent='Start Day '+(G.day+1)+' ▶';
  G.state='results';
  hideAll();updateTopbar();
  $('results').classList.remove('hide');
}
$('resNextBtn').addEventListener('click',()=>{Sound.click();G.day=SV.day;startDay();});
$('resShopBtn').addEventListener('click',()=>{openShop('results');});

/* ---------- shop ---------- */
const TABS=[['coat','🐴 Coat'],['mane','💇 Mane'],['blanket','🧺 Blanket'],['beak','🪶 Beak'],['hat','🎩 Hats'],['trail','✨ Trail'],['gear','🎒 Gear']];
function openShop(from){
  Sound.click();shopReturn=from;
  G.prevState=G.state;G.state='shop';
  hideAll();
  updateTopbar();updateDepartBtn();
  $('shop').classList.remove('hide');
  renderShopTabs();renderShop();
}
function closeShop(){
  Sound.click();$('shop').classList.add('hide');
  if(shopReturn==='results'){G.state='results';$('results').classList.remove('hide');updateTopbar();}
  else{G.state='title';updateTitleUI();$('title').classList.remove('hide');}
}
$('shopClose').addEventListener('click',closeShop);
function renderShopTabs(){
  const t=$('tabs');t.innerHTML='';
  for(const[id,label]of TABS){
    const b=document.createElement('button');
    b.className='tab'+(shopTab===id?' on':'');b.textContent=label;
    b.addEventListener('click',()=>{Sound.click();shopTab=id;renderShopTabs();renderShop();});
    t.appendChild(b);
  }
}
function shopSets(){return{coat:COATS,mane:MANES,blanket:BLANKETS,beak:BEAKS,hat:HATS,trail:TRAILS};}
function renderShop(){
  $('shopCoins').textContent='🪙 '+SV.coins;
  const g=$('shopGrid');g.innerHTML='';
  if(shopTab==='gear'){
    g.classList.add('rows');
    for(const id in GEAR){
      const gr=GEAR[id],lv=SV.gear[id],maxed=lv>=gr.max;
      const price=maxed?0:gr.price[lv];
      const row=document.createElement('div');row.className='gearrow';
      row.innerHTML='<div class="ge">'+gr.e+'</div><div class="gi"><div class="nm">'+gr.n+
        (gr.max>1?' <span style="color:#a8703a;font-size:12px;">'+lv+'/'+gr.max+'</span>':'')+
        '</div><div class="ds">'+gr.ds(maxed?lv:lv+1)+'</div></div>'+
        '<button '+(maxed||SV.coins<price?'disabled':'')+'>'+(maxed?'MAX ✓':'🪙 '+price)+'</button>';
      row.querySelector('button').addEventListener('click',()=>{
        if(maxed||SV.coins<price)return;
        SV.coins-=price;SV.gear[id]++;save();Sound.fanfare();pSpark(W/2,H*0.5,10);computeLayout();renderShop();
      });
      g.appendChild(row);
    }
    return;
  }
  g.classList.remove('rows');
  const set=shopSets()[shopTab];
  for(const id in set){
    const it=set[id];
    const owned=SV.owned[shopTab].includes(id),eq=SV.eq[shopTab]===id;
    const cell=document.createElement('div');
    cell.className='cell'+(eq?' eq':owned?'':' locked')+(!owned&&SV.coins<it.price?' cant':'');
    let sw;
    if(shopTab==='hat'||shopTab==='trail')sw='<div class="se">'+it.e+'</div>';
    else sw='<div class="sw" style="background:'+(it.pat==='rainbow'?'linear-gradient(135deg,'+RAINBOW.join(',')+')':it.a)+';"></div>';
    cell.innerHTML=sw+'<div class="nm">'+it.n+'</div><div class="pr">'+(eq?'WEARING ✓':owned?'tap to wear':'🪙 '+it.price)+'</div>';
    cell.addEventListener('click',()=>{
      if(eq)return;
      if(owned){SV.eq[shopTab]=id;save();Sound.pop();renderShop();return;}
      if(SV.coins<it.price){Sound.err();showToast('Not enough coins — run more deliveries!');return;}
      SV.coins-=it.price;SV.owned[shopTab].push(id);SV.eq[shopTab]=id;save();
      Sound.fanfare();pConfetti();renderShop();
    });
    g.appendChild(cell);
  }
}

/* ---------- title & boot ---------- */
function hideAll(keepResults){
  $('title').classList.add('hide');
  if(!keepResults)$('results').classList.add('hide');
  $('shop').classList.add('hide');
  elCard.classList.add('hide');elHint.classList.add('hide');
}
function updateTitleUI(){
  $('startBtn').innerHTML='▶ &nbsp;Start Day '+SV.day;
  $('soundBtn').innerHTML=SV.mute?'🔇 &nbsp;Sound Off':'🔊 &nbsp;Sound On';
  $('titleStats').innerHTML=SV.bestDay>0?
    'Best day: 🪙 '+SV.bestDay+' &nbsp;•&nbsp; Orders delivered: '+SV.deliveries+'<br>Wallet: 🪙 '+SV.coins:
    'A toucan packs. A horse trots.<br>Adventures happen.';
}
$('startBtn').addEventListener('click',()=>{Sound.ensure();Sound.click();G.day=SV.day;startDay();});
$('wardrobeBtn').addEventListener('click',()=>{Sound.ensure();openShop('title');});
$('soundBtn').addEventListener('click',()=>{Sound.ensure();toggleMute();});

/* debug hooks (harmless in production) */
window.__sb={G,L,SV,tap:handleTap,depart:()=>depart(false),startDay,showResults};

resize();
updateTitleUI();
requestAnimationFrame(frame);
