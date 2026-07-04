'use strict';
/* ============================================================
   SADDLEBAGS — Pip & Biscuit's Delivery Co.
   A toucan packs, a horse trots, adventures happen.
   ============================================================ */
const $=id=>document.getElementById(id);
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const lerp=(a,b,t)=>a+(b-a)*t;
const rand=(a,b)=>a+Math.random()*(b-a);
const randi=(a,b)=>Math.floor(rand(a,b+1));
const choice=arr=>arr[Math.floor(Math.random()*arr.length)];
const TAU=Math.PI*2;
function shuffled(a){a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
if(!CanvasRenderingContext2D.prototype.roundRect){
  CanvasRenderingContext2D.prototype.roundRect=function(x,y,w,h,r){
    if(typeof r==='number')r={tl:r,tr:r,br:r,bl:r};else if(Array.isArray(r))r={tl:r[0],tr:r[1]||r[0],br:r[2]||r[0],bl:r[3]||r[1]||r[0]};
    this.moveTo(x+r.tl,y);this.arcTo(x+w,y,x+w,y+h,r.tr);this.arcTo(x+w,y+h,x,y+h,r.br);
    this.arcTo(x,y+h,x,y,r.bl);this.arcTo(x,y,x+w,y,r.tl);this.closePath();return this;};
}

/* ---------- safe storage (Safari file:// throws) ---------- */
let memStore={};
const Store={
  get(k){try{return localStorage.getItem(k);}catch(e){return memStore[k]||null;}},
  set(k,v){try{localStorage.setItem(k,v);}catch(e){memStore[k]=v;}}
};
const SAVE_KEY='saddlebags_v1';
function defaultSave(){return{
  coins:12, day:1, bestDay:0, totalEarned:0, deliveries:0, mute:0, tut:0,
  owned:{coat:['chestnut'],mane:['cocoa'],beak:['classic'],hat:['none'],blanket:['crimson'],trail:['none']},
  eq:{coat:'chestnut',mane:'cocoa',beak:'classic',hat:'none',blanket:'crimson',trail:'none'},
  gear:{bags:0,saddle:0,shoe:0,spy:0,pouch:0,charm:0}
};}
let SV=defaultSave();
try{const raw=Store.get(SAVE_KEY);if(raw){const p=JSON.parse(raw);SV=Object.assign(defaultSave(),p);
  SV.owned=Object.assign(defaultSave().owned,p.owned);SV.eq=Object.assign(defaultSave().eq,p.eq);
  SV.gear=Object.assign(defaultSave().gear,p.gear);}}catch(e){}
function save(){Store.set(SAVE_KEY,JSON.stringify(SV));}

/* ---------- sound (tiny webaudio synth) ---------- */
const Sound={
  ctx:null,
  ensure(){if(!this.ctx){try{this.ctx=new (window.AudioContext||window.webkitAudioContext)();}catch(e){this.ctx=null;}}
    if(this.ctx&&this.ctx.state==='suspended')this.ctx.resume();return this.ctx;},
  tone(type,f0,f1,dur,vol,when){const c=this.ctx;if(!c||SV.mute)return;
    const t=c.currentTime+(when||0);const o=c.createOscillator(),g=c.createGain();
    o.type=type;o.frequency.setValueAtTime(f0,t);
    if(f1&&f1!==f0)o.frequency.exponentialRampToValueAtTime(Math.max(f1,1),t+dur);
    g.gain.setValueAtTime(0.0001,t);g.gain.exponentialRampToValueAtTime(vol,t+0.012);
    g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
    o.connect(g);g.connect(c.destination);o.start(t);o.stop(t+dur+0.05);},
  noise(dur,vol,fc,when){const c=this.ctx;if(!c||SV.mute)return;
    const t=c.currentTime+(when||0);const n=Math.floor(c.sampleRate*dur);
    const buf=c.createBuffer(1,n,c.sampleRate),d=buf.getChannelData(0);
    for(let i=0;i<n;i++)d[i]=(Math.random()*2-1)*(1-i/n);
    const s=c.createBufferSource();s.buffer=buf;
    const f=c.createBiquadFilter();f.type='lowpass';f.frequency.value=fc||900;
    const g=c.createGain();g.gain.value=vol;
    s.connect(f);f.connect(g);g.connect(c.destination);s.start(t);},
  click(){this.tone('triangle',680,680,0.05,0.08);},
  pop(){this.tone('sine',340,760,0.10,0.14);},
  stow(){this.tone('sine',170,110,0.10,0.16);this.noise(0.06,0.06,600);},
  coin(n){for(let i=0;i<(n||1);i++){const w=i*0.075;
    this.tone('triangle',1100,2200,0.10,0.09,w);
    this.tone('sine',1760,1760,0.09,0.05,w+0.045);
    this.noise(0.035,0.05,5200,w+0.01);
  }},
  munch(){this.noise(0.08,0.12,500);this.noise(0.08,0.10,420,0.11);},
  whoosh(){this.noise(0.22,0.10,1600);},
  err(){this.tone('square',150,120,0.14,0.10);},
  sad(){this.tone('sawtooth',330,190,0.42,0.07);},
  heart(){this.tone('sine',660,880,0.16,0.09);},
  clip(alt){this.noise(0.035,0.08,alt?800:650);},
  fanfare(){const n=[523,659,784,1047];n.forEach((f,i)=>this.tone('triangle',f,f,0.18,0.10,i*0.09));
    this.tone('triangle',1319,1319,0.32,0.09,0.38);},
  spark(){this.tone('sine',1200,1900,0.12,0.06);}
};

/* ============================================================
   DATA — items, events, regions, cosmetics, gear
   ============================================================ */
const ITEMS={
  apple:    {e:'🍎',n:'Apple',    w:1,food:6, sell:3, cost:2},
  carrot:   {e:'🥕',n:'Carrot',   w:1,food:4, sell:2, cost:1},
  bread:    {e:'🥖',n:'Bread',    w:1,food:5, sell:3, cost:2},
  cheese:   {e:'🧀',n:'Cheese',   w:1,        sell:4, cost:2},
  sunflower:{e:'🌻',n:'Sunflower',w:1,        sell:3, cost:2},
  scarf:    {e:'🧣',n:'Scarf',    w:1,        sell:4, cost:2},
  hat:      {e:'🎩',n:'Fancy Hat',w:1,        sell:6, cost:4},
  map:      {e:'🗺️',n:'Map',     w:1,        sell:4, cost:3},
  honey:    {e:'🍯',n:'Honey',    w:1,        sell:8, cost:5},
  bell:     {e:'🔔',n:'Bell',     w:1,        sell:5, cost:3},
  gem:      {e:'💎',n:'Gem',      w:1,        sell:25,cost:16},
  umbrella: {e:'☂️',n:'Umbrella', w:2,fw:2,   sell:5, cost:3},
  lantern:  {e:'🔦',n:'Lantern',  w:2,fw:2,   sell:5, cost:3},
  rope:     {e:'🪢',n:'Rope',     w:2,fw:2,   sell:5, cost:3},
  trumpet:  {e:'🎺',n:'Trumpet',  w:2,fw:2,   sell:6, cost:4},
  plank:    {e:'🪵',n:'Plank',    w:2,fw:2,   sell:4, cost:2},
  sus:      {e:'🍈',n:'Odd Melon',w:2,fw:2,   sell:1, cost:1},
  melon:    {e:'🍉',n:'Melon',    w:4,fw:2,fh:2,food:12,sell:10,cost:6},
  parcel:   {e:'📦',n:'Big Parcel',w:3,fw:3,   sell:11,cost:6},
};
for(const k in ITEMS){ITEMS[k].fw=ITEMS[k].fw||1;ITEMS[k].fh=ITEMS[k].fh||1;}
const RARE_WEIGHTS={melon:0.6,gem:0.22,sus:0.35,map:0.5,hat:0.7,honey:0.85,plank:0.9,bell:0.8,parcel:0.45};

const EVENTS={
  rain:{icon:'🌧️',title:'Sudden downpour!',desc:'Fat raindrops drum on the road.',
    opts:[
      {item:'umbrella',label:'Pop the umbrella',coins:14,text:'Biscuit trots along dry and extremely smug.'},
      {item:'scarf',label:'Scarf poncho',coins:7,text:'Damp, but dignified.'},
      {risky:1,label:'Gallop through!',good:{coins:10,text:'Splash sprint! That was weirdly fun.'},bad:{heart:-1,text:'Soaked to the bone. Biscuit glares at Pip.'}},
    ]},
  goat:{icon:'🐐',title:'A grumpy goat blocks the road',desc:'It has decided this road is its road now.',
    opts:[
      {item:'apple',label:'Bribe with an apple',coins:12,text:'Crunch. The goat steps aside, satisfied.'},
      {item:'carrot',label:'Bribe with a carrot',coins:12,text:'The goat accepts your tribute and departs.'},
      {item:'trumpet',label:'Trumpet blast',coins:8,text:'The goat leaves, startled and mildly offended.'},
      {risky:1,label:'Stare it down',good:{coins:8,text:'Biscuit wins the staring contest. Barely.'},bad:{heart:-1,text:'The goat headbutts a saddlebag. Rude.'}},
    ]},
  wolves:{icon:'🐺',title:'Wolves in the shadows',desc:'Yellow eyes glint between the trees.',
    opts:[
      {item:'trumpet',label:'Pip plays a solo',coins:16,text:'The pack scatters. Pip takes a bow mid-air.'},
      {item:'bread',label:'Toss the bread',coins:9,text:'They take the bread and trot off, tails wagging?!'},
      {item:'lantern',label:'Raise the lantern',coins:8,text:'Wolves hate spotlight. They slink away.'},
      {risky:1,label:'Trot past casually',good:{coins:10,text:'Confidence is armor. They let you pass.'},bad:{heart:-1,text:'One nips at Biscuit’s tail. Undignified sprinting follows.'}},
    ]},
  dark:{icon:'🌑',title:'A pitch-black hollow',desc:'The road dives into deep, inky shade.',
    opts:[
      {item:'lantern',label:'Light the lantern',coins:14,text:'A warm circle of light. Somewhere, an owl approves.'},
      {risky:1,label:'Feel the way through',good:{coins:6,text:'Biscuit memorized the path. Show-off.'},bad:{heart:-1,text:'THUMP. A stubbed hoof echoes: “ow.”'}},
    ]},
  cliff:{icon:'🕳️',title:'The bridge is out!',desc:'A gap yawns where planks used to be.',
    opts:[
      {item:'rope',label:'Rig a rope line',coins:16,text:'Pip strings a guide line. Smooth crossing.'},
      {item:'plank',label:'Makeshift bridge',coins:12,text:'It wobbles. Nobody looks down.'},
      {risky:1,label:'LEAP IT',good:{coins:14,text:'A LEGENDARY leap. Pip screams with joy.'},bad:{heart:-1,text:'Scramble down, scramble up. Everything is dusty.'}},
    ]},
  cold:{icon:'❄️',title:'A bitter wind howls',desc:'The kind of cold that gets in your bones.',
    opts:[
      {item:'scarf',label:'Wrap the scarf',coins:12,text:'Cozy. Biscuit looks fantastic in it, too.'},
      {risky:1,label:'Power through',good:{coins:6,text:'Brisk! Invigorating! (They’re both lying.)'},bad:{heart:-1,text:'T-t-teeth chattering all the way.'}},
    ]},
  donkey:{icon:'🫏',title:'A very sad donkey',desc:'It sighs the deepest sigh you’ve ever heard.',
    opts:[
      {item:'sunflower',label:'Gift a sunflower',coins:14,heart:1,text:'The donkey BEAMS. Hearts, warmed.'},
      {item:'carrot',label:'Share a carrot',coins:8,text:'A small smile. Progress.'},
      {skip:1,label:'Trot on past',coins:0,text:'You feel a little bad about that one.'},
    ]},
  traveler:{icon:'🧑‍🌾',title:'A hungry traveler',desc:'“Haven’t eaten since Tuesday,” they say. It’s Tuesday.',
    opts:[
      {item:'bread',label:'Share the bread',coins:12,text:'They insist on paying. And hugging Biscuit.'},
      {item:'apple',label:'Offer an apple',coins:8,text:'Received with an ovation of one.'},
      {skip:1,label:'Wave politely',coins:0,text:'They wave back. Politeness costs nothing.'},
    ]},
  mice:{icon:'🐭',title:'Mouse stampede!',desc:'Hundreds of tiny feet, all in a hurry.',
    opts:[
      {item:'cheese',label:'Deploy the cheese',coins:14,text:'Pied-piper Pip leads the horde off-road.'},
      {risky:1,label:'Tip-toe through',good:{coins:6,text:'A 500kg horse tip-toeing. Majestic.'},bad:{heart:-1,text:'They run UP Biscuit’s legs. Absolute chaos.'}},
    ]},
  noble:{icon:'👑',title:'A noble’s parade passes',desc:'Silks, banners, and extremely judgmental eyebrows.',
    opts:[
      {item:'hat',label:'Don the fancy hat',coins:20,text:'The noble applauds your style. Coins rain.'},
      {item:'sunflower',label:'Present a flower',coins:10,text:'Charming! You may keep your head AND get paid.'},
      {skip:1,label:'Bow and wait',coins:2,text:'The parade passes. Your neck hurts slightly.'},
    ]},
  bees:{icon:'🐝',title:'An indignant bee cloud',desc:'You appear to be between them and their flowers.',
    opts:[
      {item:'honey',label:'Offer the honey',coins:16,text:'The bees accept your tribute and even escort you a while.'},
      {item:'umbrella',label:'Umbrella shield',coins:10,text:'They bounce off politely and move along.'},
      {risky:1,label:'RUN!!',good:{coins:8,text:'Outran the bees. New personal best.'},bad:{heart:-1,text:'Three stings. Pip’s beak is fine, thanks for asking.'}},
    ]},
  mud:{icon:'🟤',title:'A sea of mud',desc:'The road has opinions today, and they are all mud.',
    opts:[
      {item:'plank',label:'Lay the plank',coins:12,text:'A dignified boardwalk crossing.'},
      {item:'rope',label:'Winch across',coins:12,text:'Pip anchors the rope. Boots stay clean-ish.'},
      {risky:1,label:'Squelch through',good:{coins:7,text:'Squelch squelch squelch. Victory.'},bad:{heart:-1,text:'Mud. Everywhere. EVERYWHERE.'}},
    ]},
  river:{icon:'🌊',title:'A rushing river',desc:'The ford is deeper than it looks. And louder.',
    opts:[
      {item:'plank',label:'Plank bridge',coins:14,text:'It creaks dramatically but holds.'},
      {item:'rope',label:'Rope ferry',coins:14,text:'Pip rigs a line. Very nautical. Very dry.'},
      {risky:1,label:'Swim for it!',good:{coins:12,text:'Biscuit is secretly an excellent swimmer.'},bad:{heart:-1,text:'Everything is soggy, including morale.'}},
    ]},
  wheel:{icon:'🛞',title:'A cart lost its wheel',desc:'A merchant fusses beside a very tilted cart.',
    opts:[
      {item:'rope',label:'Lash it back on',coins:14,text:'Good as new! The merchant tips generously.'},
      {item:'plank',label:'Prop and roll',coins:12,text:'Physics! It works! Everyone is surprised.'},
      {skip:1,label:'Wish them luck',coins:2,text:'They appreciate the sentiment. Sort of.'},
    ]},
  guard:{icon:'💂',title:'The toll guard is asleep',desc:'The gate is shut and the snoring is heroic.',
    opts:[
      {item:'bell',label:'Ring the bell',coins:14,text:'DING! The guard salutes and opens the gate.'},
      {item:'trumpet',label:'Reveille!',coins:12,text:'The guard wakes mid-salute. Muscle memory.'},
      {risky:1,label:'Tiptoe around',good:{coins:10,text:'Silent as a 500kg cat.'},bad:{heart:-1,text:'The guard wakes up grumpy. Paperwork ensues.'}},
    ]},
  bear:{icon:'🐻',title:'A bear smells snacks',desc:'It is being very polite about it. So far.',
    opts:[
      {item:'honey',label:'Honey diplomacy',coins:18,text:'The bear bows. You may pass, honored guests.'},
      {item:'bread',label:'Bread offering',coins:8,text:'Accepted, with a small disappointed glance.'},
      {risky:1,label:'Back away slowly',good:{coins:8,text:'The bear respects the technique.'},bad:{heart:-1,text:'The bear wanted a hug. Biscuit did not.'}},
    ]},
  dance:{icon:'💃',title:'A dance-off blocks the street',desc:'The crowd demands a contestant.',
    opts:[
      {item:'trumpet',label:'Pip provides the beat',coins:16,text:'The plaza ERUPTS. Coins rain from balconies.'},
      {item:'hat',label:'Style points',coins:12,text:'The hat does most of the dancing. It wins.'},
      {risky:1,label:'Biscuit breakdances',good:{coins:14,text:'THE WINDMILL. HE DID THE WINDMILL.'},bad:{heart:-1,text:'The less said about it, the better.'}},
    ]},
  rainbow:{icon:'🌈',title:'A rainbow arcs the valley',desc:'Legends say something glitters at its end.',
    opts:[
      {risky:1,label:'Chase it!',good:{coins:15,text:'A pot of— coins! Close enough!'},bad:{coins:0,text:'It kept moving. Rude.'}},
      {skip:1,label:'Just admire it',coins:4,text:'Souls: restored. Onward.'},
    ]},
  trade:{icon:'🛖',title:'A wandering trader',desc:'“Pssst. I collect heavy things. Trade you a gem.”',special:'trade'},
  chest:{icon:'🎁',title:'A gift chest?!',desc:'Sitting in the road, slightly sparkly, definitely not a trap.',special:'chest'},
};

const REGIONS=[
  {id:'meadow', name:'Meadow Market', icon:'🌾', pool:['rain','goat','donkey','traveler','mud','wheel'],
   orders:['bread','apple','cheese','sunflower'],
   sky:['#8ED6FF','#EAF9E0'], far:'#A8D971', mid:'#8CC152', ground:'#7CB342', prop:'meadow',
   arrive:'The market crowd cheers as Biscuit trots in!'},
  {id:'woods', name:'Whispering Woods', icon:'🌲', pool:['wolves','dark','mice','bees','donkey','bear','river'],
   orders:['bread','cheese','melon','honey'],
   sky:['#5E9C8F','#D8EFC0'], far:'#4E8A66', mid:'#3E7C59', ground:'#4F7A4A', prop:'woods',
   arrive:'The woodland cabin lights up as you arrive!'},
  {id:'pass', name:'Windy Pass', icon:'⛰️', pool:['cold','cliff','goat','rain','river','rainbow'],
   orders:['scarf','bread','melon','cheese'],
   sky:['#9FB8E8','#EDEAF4'], far:'#8E97AD', mid:'#707A94', ground:'#8A8F78', prop:'pass',
   arrive:'The mountain village rings its little bell for you!'},
  {id:'festival', name:'Sunfair Festival', icon:'🎪', pool:['noble','traveler','mice','bees','trade','dance','guard'],
   orders:['melon','hat','sunflower','honey'],
   sky:['#FFB88C','#FFF3B0'], far:'#E8A05C', mid:'#D9A45B', ground:'#C79452', prop:'festival',
   arrive:'The festival crowd lifts Pip onto their shoulders!'},
  {id:'bay', name:'Moonlight Bay', icon:'🌊', pool:['dark','rain','cliff','trade','river','guard','rainbow'],
   orders:['lantern','bread','melon','gem'],
   sky:['#2E3A67','#8B79B8'], far:'#4A5580', mid:'#3E5F8A', ground:'#5C6B7A', prop:'bay',
   arrive:'The lighthouse keeper waves her hat from the tower!'},
];

const COATS={
  chestnut:{n:'Chestnut',a:'#B0693C',b:'#8C4E27',c:'#D9A176',price:0},
  cream:   {n:'Cream',   a:'#F1E3C8',b:'#D6BF9C',c:'#FAF3E3',price:60},
  midnight:{n:'Midnight',a:'#4A5065',b:'#353a4d',c:'#6E7488',price:80},
  palomino:{n:'Palomino',a:'#E3B04B',b:'#C4913A',c:'#F5E1B8',price:100},
  dapple:  {n:'Dapple Gray',a:'#B9C0C9',b:'#98A1AC',c:'#D8DDE3',price:140,pat:'dapple'},
  pinto:   {n:'Pinto',   a:'#8C5A33',b:'#6E4425',c:'#F5EDE0',price:180,pat:'pinto'},
  rose:    {n:'Rosé',    a:'#F0B7C6',b:'#D391A6',c:'#FADDE6',price:250},
  golden:  {n:'Golden',  a:'#FFC93C',b:'#E0A517',c:'#FFE8A0',price:400},
};
const MANES={
  cocoa:  {n:'Cocoa',  a:'#5C3A21',price:0},
  blonde: {n:'Blonde', a:'#F2D8A0',price:40},
  black:  {n:'Raven',  a:'#23272F',price:40},
  fire:   {n:'Fire',   a:'#E85D2F',price:90},
  seafoam:{n:'Seafoam',a:'#7FD8C9',price:120},
  rainbow:{n:'Rainbow',a:'#E85D2F',price:300,pat:'rainbow'},
};
const RAINBOW=['#E4572E','#FFB627','#7DC95E','#4EA5D9','#9B5DE5'];
const BEAKS={
  classic:{n:'Classic',a:'#FF9F1C',b:'#FFD166',c:'#E63946',price:0},
  sunset: {n:'Sunset', a:'#FF6B35',b:'#FFB627',c:'#C81D25',price:50},
  berry:  {n:'Berry',  a:'#B565A7',b:'#E5A9E0',c:'#5F0F40',price:90},
  mint:   {n:'Mint',   a:'#4ECDC4',b:'#C7F9CC',c:'#1A759F',price:120},
  gilded: {n:'Gilded', a:'#FFD700',b:'#FFF3B0',c:'#B8860B',price:350},
};
const HATS={
  none:  {n:'No Hat',e:'🚫',price:0},
  bow:   {n:'Bow',e:'🎀',price:60},
  straw: {n:'Straw Hat',e:'👒',price:70},
  party: {n:'Party Cone',e:'🥳',price:90},
  flower:{n:'Flower Crown',e:'🌸',price:120},
  top:   {n:'Top Hat',e:'🎩',price:160},
  wizard:{n:'Wizard Hat',e:'🧙',price:220},
  crown: {n:'Crown',e:'👑',price:500},
};
const BLANKETS={
  crimson:{n:'Crimson',a:'#C1442E',t:'#FFD166',price:0},
  sky:    {n:'Sky',    a:'#4EA5D9',t:'#FFF8E1',price:50},
  forest: {n:'Forest', a:'#3E7C59',t:'#C7F9CC',price:90},
  violet: {n:'Violet', a:'#8E5CD9',t:'#FFD166',price:120},
  gold:   {n:'Royal Gold',a:'#D9A413',t:'#7A3020',price:200},
  star:   {n:'Starry Night',a:'#2E3A67',t:'#FFD166',price:300,pat:'star'},
};
const TRAILS={
  none:   {n:'None',e:'🚫',price:0},
  sparkle:{n:'Sparkle',e:'✨',price:150},
  hearts: {n:'Hearts',e:'💗',price:250},
  rainbow:{n:'Rainbow',e:'🌈',price:450},
};
const GEAR={
  bags:  {n:'Bigger Bags',  e:'🎒',max:2,price:[120,260],ds:l=>l<=1?'Bags widen: 3×3 → 4×3':'Bags deepen: 4×3 → 4×4'},
  saddle:{n:'Comfy Saddle', e:'🪑',max:2,price:[80,200], ds:l=>'+'+(l*10)+'s packing patience'},
  shoe:  {n:'Lucky Horseshoe',e:'🍀',max:1,price:[150],  ds:l=>'+12% on risky choices'},
  spy:   {n:'Spyglass',     e:'🔭',max:1,price:[120],    ds:l=>'Reveals one more route event'},
  pouch: {n:'Snack Pouch',  e:'👝',max:1,price:[100],    ds:l=>'Start each day with a free apple'},
  charm: {n:'Mood Charm',   e:'🧿',max:1,price:[180],    ds:l=>'+6% on risky choices'},
};
