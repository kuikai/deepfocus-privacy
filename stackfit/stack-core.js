const KEY="stackfit-web-v1";
const $app=document.getElementById("app");
const $toast=document.getElementById("toast");
const CATALOG=[
  ["Barbell Bench Press","Strength"],["Incline Dumbbell Press","Strength"],["Overhead Press","Strength"],
  ["Barbell Row","Strength"],["Lat Pulldown","Strength"],["Pull-Up","Bodyweight"],["Chin-Up","Bodyweight"],
  ["Deadlift","Strength"],["Romanian Deadlift","Strength"],["Back Squat","Strength"],["Front Squat","Strength"],
  ["Bulgarian Split Squat","Strength"],["Leg Press","Strength"],["Hip Thrust","Strength"],["Barbell Curl","Strength"],
  ["Tricep Pushdown","Strength"],["Lateral Raise","Strength"],["Face Pull","Strength"],["Plank","Core"],
  ["Hanging Leg Raise","Core"],["Push-Up","Bodyweight"],["Dip","Bodyweight"],["Air Squat","Bodyweight"],
  ["Burpee","Cardio"],["Jump Rope","Cardio"],["Kettlebell Swing","Strength"],["Thruster","Strength"]
].map(([name,cat])=>({name,cat}));
const PRESETS=[
  {id:"tabata",name:"Tabata",work:20,rest:10,rounds:8,prep:10},
  {id:"40-20",name:"40 / 20",work:40,rest:20,rounds:8,prep:10},
  {id:"emom",name:"EMOM 10",work:50,rest:10,rounds:10,prep:10},
  {id:"30-30",name:"30 / 30",work:30,rest:30,rounds:10,prep:5}
];
const uid=()=>Math.random().toString(36).slice(2,10)+Date.now().toString(36).slice(-4);
const fmtDur=s=>{s=Math.max(0,Math.round(s||0));return Math.floor(s/60)+":"+String(s%60).padStart(2,"0")};
const fmtClock=s=>{s=Math.max(0,Math.ceil(s));return String(Math.floor(s/60)).padStart(2,"0")+":"+String(s%60).padStart(2,"0")};
const fmtWhen=iso=>new Date(iso).toLocaleString(undefined,{weekday:"short",month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"});
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&","<":"<",">":">",'"':""","'":"&#39;"}[c]));
function seed(){
  const S=(n,k,a)=>({id:uid(),name:n,kind:k,...a});
  return{workouts:[
    {id:"w-push",name:"Push Day",notes:"Pressing + triceps.",exercises:[
      S("Barbell Bench Press","sets",{sets:4,reps:6,weight:60,restSec:90}),
      S("Overhead Press","sets",{sets:3,reps:8,weight:40,restSec:90}),
      S("Incline Dumbbell Press","sets",{sets:3,reps:10,weight:22,restSec:75}),
      S("Tricep Pushdown","sets",{sets:3,reps:12,weight:20,restSec:60})
    ]},
    {id:"w-pull",name:"Pull Day",notes:"",exercises:[
      S("Deadlift","sets",{sets:3,reps:5,weight:100,restSec:150}),
      S("Pull-Up","sets",{sets:4,reps:6,weight:0,restSec:90}),
      S("Barbell Row","sets",{sets:4,reps:8,weight:60,restSec:90}),
      S("Face Pull","sets",{sets:3,reps:15,weight:15,restSec:45})
    ]},
    {id:"w-tabata",name:"Tabata Bodyweight",notes:"Or use the Timer tab.",exercises:[
      S("Burpee","timer",{workSec:20,restSec:10,rounds:8}),
      S("Air Squat","timer",{workSec:20,restSec:10,rounds:8}),
      S("Push-Up","timer",{workSec:20,restSec:10,rounds:8}),
      S("Plank","timer",{workSec:20,restSec:10,rounds:8})
    ]}
  ],sessions:[],settings:{theme:"dark",unit:"kg",sound:true,vibrate:true}};
}
function load(){
  try{
    const raw=localStorage.getItem(KEY);
    if(!raw)return seed();
    const d=JSON.parse(raw);
    d.workouts||=[];d.sessions||=[];
    d.settings={theme:"dark",unit:"kg",sound:true,vibrate:true,...d.settings};
    return d;
  }catch{return seed()}
}
const db=load();
function parseHash(){
  const p=(location.hash||"#/home").replace(/^#/,"").split("/").filter(Boolean);
  return{name:p[0]||"home",id:p[1]||null};
}
let route=parseHash(),editor=null,live=null,rest=null,picker=null,wakeLock=null;
let timer={running:false,presetId:"tabata",work:20,rest:10,rounds:8,prep:10,phase:"idle",round:1,remain:20,total:20,lastTick:0,startedAt:null};
const save=()=>localStorage.setItem(KEY,JSON.stringify({workouts:db.workouts,sessions:db.sessions,settings:db.settings}));
const go=path=>{location.hash=path.startsWith("#")?path:"#"+path};
function toast(msg){$toast.hidden=false;$toast.textContent=msg;clearTimeout(toast._t);toast._t=setTimeout(()=>{$toast.hidden=true},2200)}
function applyTheme(){
  document.documentElement.dataset.theme=db.settings.theme==="light"?"light":"dark";
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content",db.settings.theme==="light"?"#f3efe6":"#0E0F12");
}
async function lockWake(on){
  try{
    if(on&&"wakeLock"in navigator)wakeLock=await navigator.wakeLock.request("screen");
    else if(wakeLock){await wakeLock.release();wakeLock=null}
  }catch{}
}
function beep(kind){
  if(db.settings.sound){
    try{
      const ctx=new(window.AudioContext||window.webkitAudioContext)();
      const o=ctx.createOscillator(),g=ctx.createGain();
      o.type="sine";o.frequency.value=kind==="done"?660:kind==="work"?880:440;g.gain.value=.06;
      o.connect(g);g.connect(ctx.destination);o.start();
      setTimeout(()=>{o.stop();ctx.close()},kind==="done"?420:160);
    }catch{}
  }
  if(db.settings.vibrate&&navigator.vibrate)navigator.vibrate(kind==="work"?[40,40,80]:30);
}
function lastSetsFor(name){
  for(let i=db.sessions.length-1;i>=0;i--){
    const ex=db.sessions[i].exercises.find(e=>e.name===name);
    if(ex?.sets?.length)return ex.sets;
  }
  return[];
}
function prFor(name){
  let best=0;
  for(const s of db.sessions){
    const ex=s.exercises.find(e=>e.name===name);
    if(!ex)continue;
    for(const set of ex.sets||[])best=Math.max(best,Number(set.weight)||0);
  }
  return best;
}
function weekCount(){
  const now=new Date(),start=new Date(now);
  start.setDate(now.getDate()-((now.getDay()+6)%7));start.setHours(0,0,0,0);
  return db.sessions.filter(s=>new Date(s.finishedAt)>=start).length;
}
function streak(){
  const days=new Set(db.sessions.map(s=>s.finishedAt.slice(0,10)));
  let n=0;const d=new Date();
  for(;;){const k=d.toISOString().slice(0,10);if(days.has(k)){n++;d.setDate(d.getDate()-1)}else break}
  return n;
}
function icon(name){
  const p={
    home:"M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1z",
    workouts:"M7 6h10v3H7zm-2 5h14v3H5zm3 5h8v3H8z",
    timer:"M12 6v6l4 2M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z",
    log:"M6 4h9l5 5v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zm8 0v6h6",
    more:"M6 12h.01M12 12h.01M18 12h.01"
  };
  return `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="${p[name]}"></path></svg>`;
}
