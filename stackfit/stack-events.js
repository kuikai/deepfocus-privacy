const findEx=id=>editor?.exercises.find(e=>e.id===id);
function addExercise(name){if(!editor)openEditor(route.id);editor.exercises.push(blankEx(name,"sets"));picker=null;render()}
function addLiveExercise(name){if(!live)startEmpty();live.exercises.push({id:uid(),name,kind:"sets",restSec:90,sets:[{reps:"",weight:"",done:false},{reps:"",weight:"",done:false},{reps:"",weight:"",done:false}]});picker=null;render()}
$app.addEventListener("click",e=>{
  const goEl=e.target.closest("[data-go]");
  if(goEl){const path=goEl.dataset.go;if(path==="#/edit/new")editor={id:"new",name:"",notes:"",exercises:[]};if(path.startsWith("#/edit/")&&path!=="#/edit/new")openEditor(path.split("/")[2]);go(path);return}
  if(e.target.closest("[data-start]")){startFromWorkout(e.target.closest("[data-start]").dataset.start);return}
  if(e.target.closest("[data-empty-session]")){startEmpty();return}
  if(e.target.closest("[data-dup]")){const src=db.workouts.find(w=>w.id===e.target.closest("[data-dup]").dataset.dup);if(src){const copy=JSON.parse(JSON.stringify(src));copy.id=uid();copy.name=src.name+" copy";copy.exercises.forEach(ex=>ex.id=uid());db.workouts.push(copy);save();toast("Copied");render()}return}
  if(e.target.closest("[data-kind]")){const btn=e.target.closest("[data-kind]");const ex=findEx(btn.dataset.ex);if(ex){ex.kind=btn.dataset.kind;if(ex.kind==="timer"){ex.workSec||=20;ex.restSec=ex.restSec??10;ex.rounds||=8}else{ex.sets||=3;ex.reps||=8;ex.restSec=ex.restSec??90}render()}return}
  if(e.target.closest("[data-move]")){const btn=e.target.closest("[data-move]");const i=editor.exercises.findIndex(x=>x.id===btn.dataset.move);const j=i+Number(btn.dataset.dir);if(i>=0&&j>=0&&j<editor.exercises.length){const [row]=editor.exercises.splice(i,1);editor.exercises.splice(j,0,row);render()}return}
  if(e.target.closest("[data-drop-ex]")){editor.exercises=editor.exercises.filter(x=>x.id!==e.target.closest("[data-drop-ex]").dataset.dropEx);render();return}
  if(e.target.closest("[data-add-ex]")){const name=e.target.closest("[data-add-ex]").dataset.addEx;if(live&&route.name==="session")addLiveExercise(name);else addExercise(name);return}
  if(e.target.closest("[data-cat]")){picker.cat=e.target.closest("[data-cat]").dataset.cat;render();return}
  if(e.target.closest("[data-close-picker]")){picker=null;render();return}
  if(e.target.closest("[data-toggle-set]")){const[exId,idx]=e.target.closest("[data-toggle-set]").dataset.toggleSet.split(":");const ex=live.exercises.find(x=>x.id===exId);if(!ex)return;const set=ex.sets[Number(idx)];set.done=!set.done;if(set.done)beginRest(ex.restSec);render();return}
  if(e.target.closest("[data-add-set]")){const ex=live.exercises.find(x=>x.id===e.target.closest("[data-add-set]").dataset.addSet);if(ex){ex.sets.push({reps:ex.sets.at(-1)?.reps||"",weight:ex.sets.at(-1)?.weight||"",done:false});render()}return}
  if(e.target.closest("[data-drop-live]")){live.exercises=live.exercises.filter(x=>x.id!==e.target.closest("[data-drop-live]").dataset.dropLive);render();return}
  if(e.target.closest("[data-open-session]")){go("/detail/"+e.target.closest("[data-open-session]").dataset.openSession);return}
  if(e.target.closest("[data-repeat]")){const s=db.sessions.find(x=>x.id===e.target.closest("[data-repeat]").dataset.repeat);if(!s)return;live={id:uid(),workoutId:s.workoutId,name:s.name,startedAt:new Date().toISOString(),exercises:s.exercises.map(e2=>({id:uid(),name:e2.name,kind:e2.kind||"sets",restSec:90,sets:(e2.sets||[{reps:"",weight:""}]).map(st=>({reps:st.reps,weight:st.weight,done:false}))}))};lockWake(true);go("/session");return}
  if(e.target.closest("[data-del-session]")){if(confirm("Delete this session?")){db.sessions=db.sessions.filter(x=>x.id!==e.target.closest("[data-del-session]").dataset.delSession);save();go("/history")}return}
  if(e.target.closest("[data-preset]")){const idp=e.target.closest("[data-preset]").dataset.preset;const p=PRESETS.find(x=>x.id===idp);if(p)applyPreset(p);else timer.presetId="custom";render();return}
  if(e.target.closest("[data-theme]")){db.settings.theme=e.target.closest("[data-theme]").dataset.theme;save();render();return}
  if(e.target.closest("[data-unit]")){db.settings.unit=e.target.closest("[data-unit]").dataset.unit;save();render();return}
  const id=e.target.id;
  if(id==="open-picker"){picker={q:"",cat:"All"};render();return}
  if(id==="add-custom"){const name=document.getElementById("custom-ex").value.trim();if(!name)return;if(live&&route.name==="session")addLiveExercise(name);else addExercise(name);return}
  if(id==="save-workout"){editor.name=document.getElementById("w-name").value.trim()||"Untitled";editor.notes=document.getElementById("w-notes").value.trim();if(!editor.exercises.length){toast("Add at least one exercise");return}if(editor.id==="new"){editor.id=uid();db.workouts.push(editor)}else{const i=db.workouts.findIndex(w=>w.id===editor.id);if(i>=0)db.workouts[i]=editor;else db.workouts.push(editor)}save();toast("Workout saved");go("/workouts");return}
  if(id==="del-workout"){if(confirm("Delete this workout?")){db.workouts=db.workouts.filter(w=>w.id!==editor.id);save();go("/workouts")}return}
  if(id==="rest-skip"){rest=null;render();return}
  if(id==="rest-pause"){rest.paused=!rest.paused;rest.last=performance.now();render();return}
  if(id==="finish-session"){finishLive(confirm("Also save this as a reusable workout template?"));return}
  if(id==="discard-session"){if(confirm("Discard this session?")){live=null;rest=null;lockWake(false);go("/home")}return}
  if(id==="rename-session"){const n=prompt("Session name",live.name);if(n){live.name=n;render()}return}
  if(id==="timer-start"){startTimer();render();return}
  if(id==="timer-pause"){timer.running=!timer.running;timer.lastTick=performance.now();render();return}
  if(id==="timer-skip"){nextPhase();render();return}
  if(id==="timer-reset"){timer.running=false;timer.phase="idle";timer.round=1;timer.remain=timer.prep||timer.work;timer.total=timer.remain;lockWake(false);render();return}
  if(id==="tog-sound"){db.settings.sound=!db.settings.sound;save();render();return}
  if(id==="tog-vib"){db.settings.vibrate=!db.settings.vibrate;save();render();return}
  if(id==="export-data"){const blob=new Blob([JSON.stringify({workouts:db.workouts,sessions:db.sessions,settings:db.settings},null,2)],{type:"application/json"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="stackfit.json";a.click();return}
  if(id==="wipe-data"){if(prompt("Type DELETE to erase workouts and history")==="DELETE"){db.workouts=[];db.sessions=[];save();toast("Cleared");render()}}
});
$app.addEventListener("input",e=>{
  if(e.target.id==="cat-search"){picker.q=e.target.value;render();document.getElementById("cat-search")?.focus();return}
  if(e.target.id==="w-name")editor.name=e.target.value;
  if(e.target.id==="w-notes")editor.notes=e.target.value;
  if(e.target.dataset.field&&editor){const ex=findEx(e.target.dataset.ex);if(ex)ex[e.target.dataset.field]=e.target.value===""?"":Number(e.target.value)}
  if(e.target.dataset.live){const[exId,idx]=e.target.dataset.live.split(":");const ex=live.exercises.find(x=>x.id===exId);if(ex)ex.sets[Number(idx)][e.target.dataset.liveField]=e.target.value}
  if(["t-work","t-rest","t-rounds","t-prep"].includes(e.target.id)){timer.presetId="custom";timer.work=num("t-work",timer.work);timer.rest=num("t-rest",timer.rest);timer.rounds=num("t-rounds",timer.rounds);timer.prep=num("t-prep",timer.prep)}
});
$app.addEventListener("change",e=>{
  if(e.target.id==="import-data"&&e.target.files?.[0]){
    const reader=new FileReader();
    reader.onload=()=>{try{const data=JSON.parse(reader.result);if(Array.isArray(data.workouts)){const ids=new Set(db.workouts.map(w=>w.id));data.workouts.forEach(w=>{if(!ids.has(w.id))db.workouts.push(w)})}if(Array.isArray(data.sessions)){const ids=new Set(db.sessions.map(s=>s.id));data.sessions.forEach(s=>{if(!ids.has(s.id))db.sessions.push(s)})}save();toast("Imported");render()}catch{toast("Could not read that file")}};
    reader.readAsText(e.target.files[0]);
  }
});
window.addEventListener("hashchange",()=>{route=parseHash();if(route.name==="session-new"){startEmpty();return}if(route.name==="edit"&&!editor)openEditor(route.id);render()});
function tick(now){
  if(rest&&!rest.paused){const dt=(now-rest.last)/1000;rest.last=now;rest.remain-=dt;if(rest.remain<=0){rest=null;beep("rest");render()}else{const el=document.querySelector(".rest-bar strong");if(el)el.textContent=fmtClock(rest.remain)}}
  if(timer.running&&timer.phase!=="idle"&&timer.phase!=="done"){const dt=(now-(timer.lastTick||now))/1000;timer.lastTick=now;timer.remain-=dt;if(timer.remain<=0){nextPhase();render()}else if(route.name==="timer"){const clock=document.querySelector(".clock"),prog=document.querySelector(".ring .prog");if(clock)clock.textContent=fmtClock(timer.remain);if(prog){const r=46,c=2*Math.PI*r,ratio=timer.total?1-timer.remain/timer.total:0;prog.setAttribute("stroke-dashoffset",String(c*(1-ratio)))}}}
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
applyTheme();
if(!location.hash)location.hash="#/home";
route=parseHash();
render();
