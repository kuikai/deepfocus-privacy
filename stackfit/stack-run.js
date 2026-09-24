function startFromWorkout(id){
  const w=db.workouts.find(x=>x.id===id);if(!w)return;
  live={id:uid(),workoutId:w.id,name:w.name,startedAt:new Date().toISOString(),exercises:w.exercises.map(ex=>({
    id:uid(),name:ex.name,kind:ex.kind,restSec:Number(ex.restSec)||0,workSec:Number(ex.workSec)||0,rounds:Number(ex.rounds)||0,
    sets:ex.kind==="timer"?Array.from({length:Number(ex.rounds)||1},()=>({reps:"",weight:"",done:false}))
      :Array.from({length:Number(ex.sets)||3},()=>({reps:ex.reps??"",weight:ex.weight??"",done:false}))
  }))};
  rest=null;lockWake(true);go("/session");
}
function startEmpty(){live={id:uid(),workoutId:null,name:"Quick session",startedAt:new Date().toISOString(),exercises:[]};lockWake(true);go("/session")}
function liveEx(ex){
  const prev=lastSetsFor(ex.name),best=prFor(ex.name);
  return `<section class="ex-card"><div class="ex-head"><div><h3 style="margin:0">${esc(ex.name)}</h3><small class="prev">Previous in grey</small></div>
    <button class="icon-btn" data-drop-live="${ex.id}">✕</button></div>
    <table class="set-table"><thead><tr><th></th><th>Prev</th><th>${db.settings.unit}</th><th>Reps</th><th></th></tr></thead><tbody>
    ${ex.sets.map((s,i)=>{const p=prev[i];const pr=s.done&&Number(s.weight)>0&&Number(s.weight)>=best&&best>0;
      return `<tr><td><button class="check ${s.done?"on":""}" data-toggle-set="${ex.id}:${i}">${s.done?"✓":""}</button></td>
        <td class="prev">${p?`${p.weight||"—"} × ${p.reps||"—"}`:"—"}</td>
        <td><input type="number" min="0" step="0.5" value="${s.weight}" data-live-field="weight" data-live="${ex.id}:${i}"></td>
        <td><input type="number" min="0" value="${s.reps}" data-live-field="reps" data-live="${ex.id}:${i}"></td>
        <td>${pr?`<span class="badge pr">PR</span>`:""}</td></tr>`}).join("")}
    </tbody></table><button class="btn" style="margin-top:8px" data-add-set="${ex.id}">+ Set</button></section>`;
}
function renderSession(){
  if(!live)return layout("Session","Nothing running",`<button class="btn primary" data-go="#/workouts">Pick a workout</button>`,empty("No live session","Start a template.","Empty session","#/session-new"));
  const elapsed=(Date.now()-new Date(live.startedAt).getTime())/1000;
  return layout(live.name,"Live log",`<button class="btn ghost" id="rename-session">Rename</button>`,
    `<p class="eyebrow">${fmtDur(elapsed)} elapsed</p><div class="list">${live.exercises.map(liveEx).join("")||`<div class="empty"><p>Add an exercise.</p></div>`}</div>
    <div class="row" style="margin-top:12px"><button class="btn" id="open-picker">Add exercise</button></div>
    ${rest?`<div class="rest-bar"><div><div class="eyebrow">Rest</div><strong>${fmtClock(rest.remain)}</strong></div>
      <div class="row"><button class="btn" id="rest-pause">${rest.paused?"Resume":"Pause"}</button><button class="btn primary" id="rest-skip">Skip rest</button></div></div>`:""}
    <div class="session-actions"><button class="btn danger lg" id="discard-session">Discard</button><button class="btn good lg block" id="finish-session">Finish & save</button></div>`);
}
function beginRest(sec){if(sec)rest={remain:sec,total:sec,paused:false,last:performance.now()}}
function finishLive(also){
  if(!live)return;
  db.sessions.push({id:live.id,workoutId:live.workoutId,name:live.name,startedAt:live.startedAt,finishedAt:new Date().toISOString(),
    durationSec:Math.round((Date.now()-new Date(live.startedAt).getTime())/1000),
    exercises:live.exercises.map(e=>({name:e.name,kind:e.kind,sets:e.sets.filter(s=>s.done||s.weight||s.reps).map(s=>({weight:s.weight,reps:s.reps,done:!!s.done}))}))});
  if(also)db.workouts.push({id:uid(),name:live.name,notes:"Saved from a session",exercises:live.exercises.map(e=>e.kind==="timer"
    ?{id:uid(),name:e.name,kind:"timer",workSec:e.workSec||20,restSec:e.restSec||10,rounds:e.sets.length}
    :{id:uid(),name:e.name,kind:"sets",sets:e.sets.length,reps:Number(e.sets[0]?.reps)||8,weight:e.sets[0]?.weight||"",restSec:e.restSec||90})});
  save();live=null;rest=null;lockWake(false);beep("done");toast("Session saved");go("/history");
}
function renderHistory(){
  const list=[...db.sessions].reverse();
  return layout("Log","Finished sessions",`<button class="btn" data-empty-session="1">Empty session</button>`,
    list.length?`<div class="list">${list.map(sessionRow).join("")}</div>`:empty("No history","Finish a workout or timer."));
}
function renderSessionDetail(id){
  const s=db.sessions.find(x=>x.id===id);if(!s)return renderHistory();
  return layout(s.name,fmtWhen(s.finishedAt)+" · "+fmtDur(s.durationSec),
    `<button class="btn danger" data-del-session="${s.id}">Delete</button><button class="btn primary" data-repeat="${s.id}">Repeat</button>`,
    `<div class="list">${s.exercises.map(e=>`<div class="ex-card"><h3>${esc(e.name)}</h3>${(e.sets||[]).map((set,i)=>`<p>Set ${i+1}: ${set.weight||"—"} ${db.settings.unit} × ${set.reps||"—"}</p>`).join("")||"<p class='prev'>No sets</p>"}</div>`).join("")}</div>`);
}
function applyPreset(p){timer.presetId=p.id;timer.work=p.work;timer.rest=p.rest;timer.rounds=p.rounds;timer.prep=p.prep;if(timer.phase==="idle"||timer.phase==="done"){timer.remain=p.prep||p.work;timer.total=timer.remain}}
function renderTimer(){
  const ph=timer.phase,label=ph==="idle"?"Ready":ph==="prep"?"PREP":ph==="work"?"WORK":ph==="rest"?"REST":"DONE";
  const r=46,c=2*Math.PI*r,ratio=timer.total?1-timer.remain/timer.total:0;
  return layout("Timer","Tabata and intervals","",
    `<div class="chip-row" style="margin-bottom:16px">${PRESETS.map(p=>`<button class="chip ${timer.presetId===p.id?"on":""}" data-preset="${p.id}">${p.name}</button>`).join("")}
      <button class="chip ${timer.presetId==="custom"?"on":""}" data-preset="custom">Custom</button></div>
    <section class="timer-stage"><div class="phase ${ph==="idle"?"prep":ph}">${label}</div>
      <div class="clock">${ph==="done"?"00:00":fmtClock(timer.remain)}</div>
      <div class="ring-wrap"><svg class="ring" viewBox="0 0 100 100"><circle class="track" cx="50" cy="50" r="${r}"></circle>
        <circle class="prog" cx="50" cy="50" r="${r}" stroke-dasharray="${c}" stroke-dashoffset="${c*(1-ratio)}"></circle></svg></div>
      <p>${ph==="done"?"Block finished":`Round ${Math.min(timer.round,timer.rounds)} of ${timer.rounds}`}</p>
      <div class="row" style="justify-content:center;margin-top:16px">${ph==="idle"||ph==="done"?`<button class="btn primary lg" id="timer-start">Start</button>`
        :`<button class="btn lg" id="timer-pause">${timer.running?"Pause":"Resume"}</button><button class="btn lg" id="timer-skip">Skip</button><button class="btn lg" id="timer-reset">Reset</button>`}</div></section>
    <div class="grid" style="grid-template-columns:repeat(4,1fr);margin-top:16px">
      <div class="field"><label>Work</label><input type="number" min="1" id="t-work" value="${timer.work}"></div>
      <div class="field"><label>Rest</label><input type="number" min="0" id="t-rest" value="${timer.rest}"></div>
      <div class="field"><label>Rounds</label><input type="number" min="1" id="t-rounds" value="${timer.rounds}"></div>
      <div class="field"><label>Prep</label><input type="number" min="0" id="t-prep" value="${timer.prep}"></div></div>`);
}
function num(id,fb){const el=document.getElementById(id);const v=el?Number(el.value):fb;return Number.isFinite(v)&&v>=0?v:fb}
function setPhase(ph,sec){timer.phase=ph;timer.remain=sec;timer.total=sec||1;timer.lastTick=performance.now()}
function startTimer(){
  timer.work=num("t-work",timer.work);timer.rest=num("t-rest",timer.rest);timer.rounds=num("t-rounds",timer.rounds);timer.prep=num("t-prep",timer.prep);
  timer.round=1;timer.startedAt=Date.now();timer.prep>0?setPhase("prep",timer.prep):setPhase("work",timer.work);timer.running=true;lockWake(true);beep("prep");
}
function nextPhase(){
  if(timer.phase==="prep"){setPhase("work",timer.work);beep("work");return}
  if(timer.phase==="work"){
    if(timer.round>=timer.rounds){
      timer.phase="done";timer.running=false;timer.remain=0;lockWake(false);beep("done");
      const dur=Math.round((Date.now()-(timer.startedAt||Date.now()))/1000);
      if(confirm("Save this timer block to your log?")){
        db.sessions.push({id:uid(),workoutId:null,name:(PRESETS.find(p=>p.id===timer.presetId)?.name||"Timer")+" block",
          startedAt:new Date(timer.startedAt).toISOString(),finishedAt:new Date().toISOString(),durationSec:dur,
          exercises:[{name:"Interval",kind:"timer",sets:[{weight:"",reps:`${timer.work}s × ${timer.rounds}`,done:true}]}]});
        save();toast("Timer saved");
      }
      return;
    }
    if(timer.rest>0){setPhase("rest",timer.rest);beep("rest")}else{timer.round+=1;setPhase("work",timer.work);beep("work")}
    return;
  }
  if(timer.phase==="rest"){timer.round+=1;setPhase("work",timer.work);beep("work")}
}
function renderSettings(){
  return layout("More","Theme, units, backup","",
    `<div class="card"><h3>Preferences</h3>
      <div class="row" style="margin-top:12px"><button class="chip ${db.settings.theme==="dark"?"on":""}" data-theme="dark">Dark</button><button class="chip ${db.settings.theme==="light"?"on":""}" data-theme="light">Light</button></div>
      <div class="row" style="margin-top:10px"><button class="chip ${db.settings.unit==="kg"?"on":""}" data-unit="kg">Kilograms</button><button class="chip ${db.settings.unit==="lb"?"on":""}" data-unit="lb">Pounds</button></div>
      <div class="row" style="margin-top:10px"><button class="chip ${db.settings.sound?"on":""}" id="tog-sound">Sound ${db.settings.sound?"on":"off"}</button><button class="chip ${db.settings.vibrate?"on":""}" id="tog-vib">Vibrate ${db.settings.vibrate?"on":"off"}</button></div></div>
    <div class="card" style="margin-top:14px"><h3>Backup</h3><p style="margin:8px 0 14px">Everything lives in this browser.</p>
      <div class="row"><button class="btn" id="export-data">Export JSON</button>
        <label class="btn ghost">Import JSON<input id="import-data" type="file" accept="application/json" hidden></label>
        <button class="btn danger" id="wipe-data">Clear all</button></div></div>`);
}
function render(){
  applyTheme();
  let html;
  switch(route.name){
    case"workouts":html=renderWorkouts();break;
    case"edit":html=renderEdit();break;
    case"session":html=renderSession();break;
    case"history":html=renderHistory();break;
    case"detail":html=renderSessionDetail(route.id);break;
    case"timer":html=renderTimer();break;
    case"settings":html=renderSettings();break;
    default:html=renderHome();
  }
  $app.innerHTML=html;
}
