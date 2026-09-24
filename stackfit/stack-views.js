function layout(title,eye,actions,body){
  const nav=[["home","Home"],["workouts","Workouts"],["timer","Timer"],["history","Log"],["settings","More"]];
  const active=route.name==="edit"||route.name==="session"?"workouts":route.name;
  return `<aside class="sidebar"><div class="brand"><div class="brand-mark"><img src="./favicon.svg" alt=""></div><div><h1>StackFit</h1><span>Plan. Lift. Time.</span></div></div>
    <nav class="nav">${nav.map(([id,l])=>`<button class="nav-btn ${active===id?"active":""}" data-go="#/${id}">${icon(id)} ${l}</button>`).join("")}</nav>
    <div class="sidebar-foot">On this device only.</div></aside>
    <main class="main"><div class="topbar"><div><p class="eyebrow">${esc(eye)}</p><h2>${esc(title)}</h2></div><div class="row">${actions||""}</div></div>${body}</main>
    <nav class="tabs">${nav.map(([id,l])=>`<button class="tab-btn ${active===id?"active":""}" data-go="#/${id}">${icon(id)}${l}</button>`).join("")}</nav>
    ${pickerHTML()}`;
}
function pickerHTML(){
  if(!picker)return"";
  const q=(picker.q||"").toLowerCase(),cat=picker.cat||"All";
  const cats=["All",...new Set(CATALOG.map(c=>c.cat))];
  const items=CATALOG.filter(c=>(cat==="All"||c.cat===cat)&&c.name.toLowerCase().includes(q));
  return `<div class="modal-bg" data-close-picker="1"><div class="modal">
    <div class="row" style="justify-content:space-between"><h3 style="margin:0">Add exercise</h3><button class="btn ghost" data-close-picker="1">Close</button></div>
    <div class="field" style="margin:12px 0"><input id="cat-search" placeholder="Search" value="${esc(picker.q||"")}"></div>
    <div class="chip-row" style="margin-bottom:12px">${cats.map(c=>`<button class="chip ${c===cat?"on":""}" data-cat="${c}">${c}</button>`).join("")}</div>
    <div class="field"><label>Custom name</label><div class="row"><input id="custom-ex" placeholder="Pause squat" style="flex:1;background:var(--bg);border:1px solid var(--line);border-radius:12px;padding:11px 12px"><button class="btn primary" id="add-custom">Add</button></div></div>
    <div>${items.map(c=>`<div class="catalog-item"><div><strong>${esc(c.name)}</strong><div><small>${c.cat}</small></div></div><button class="btn" data-add-ex="${esc(c.name)}">Add</button></div>`).join("")||"<p>Nothing matches.</p>"}</div>
  </div></div>`;
}
function empty(t,c,cta,to){return `<div class="empty"><h3>${t}</h3><p>${c}</p>${cta?`<p style="margin-top:16px"><button class="btn primary" data-go="${to}">${cta}</button></p>`:""}</div>`}
function workoutCard(w){
  const mix=w.exercises.some(e=>e.kind==="timer")&&w.exercises.some(e=>e.kind==="sets");
  const kind=mix?"Sets + timer":w.exercises[0]?.kind==="timer"?"Timer":"Sets";
  return `<article class="card"><div class="row" style="justify-content:space-between"><h3>${esc(w.name)}</h3><span class="badge">${kind}</span></div>
    <p style="margin:8px 0 14px">${w.exercises.length} exercises${w.notes?" · "+esc(w.notes):""}</p>
    <div class="row"><button class="btn primary" data-start="${w.id}">Start</button><button class="btn ghost" data-go="#/edit/${w.id}">Edit</button></div></article>`;
}
function sessionRow(s){
  const n=s.exercises.reduce((a,e)=>a+(e.sets?.length||0),0);
  return `<div class="item"><div class="grow"><h4>${esc(s.name)}</h4><small>${fmtWhen(s.finishedAt)} · ${fmtDur(s.durationSec)} · ${n} sets</small></div>
    <button class="btn ghost" data-open-session="${s.id}">Open</button><button class="btn primary" data-repeat="${s.id}">Repeat</button></div>`;
}
function renderHome(){
  const last=db.sessions[db.sessions.length-1];
  return layout("Today",new Date().toLocaleDateString(undefined,{weekday:"long",month:"long",day:"numeric"}),
    `<button class="btn" data-go="#/timer">Timer</button><button class="btn primary" data-go="#/edit/new">New workout</button>`,
    `<div class="grid stats"><div class="card"><p>This week</p><div class="stat-value">${weekCount()}</div><p>sessions</p></div>
     <div class="card"><p>Streak</p><div class="stat-value">${streak()}</div><p>days</p></div>
     <div class="card"><p>Templates</p><div class="stat-value">${db.workouts.length}</div><p>saved</p></div></div>
     <div class="row" style="margin:22px 0 12px;justify-content:space-between"><h3 style="margin:0">Start something</h3><button class="btn" data-go="#/workouts">See all</button></div>
     <div class="grid cards">${db.workouts.map(workoutCard).join("")||empty("No workouts yet","Build a template.","Create","#/edit/new")}</div>
     <div style="margin-top:28px"><h3>Last session</h3>${last?sessionRow(last):`<div class="empty"><p>Nothing logged yet.</p></div>`}</div>`);
}
function renderWorkouts(){
  return layout("Workouts","Reusable templates",`<button class="btn primary" data-go="#/edit/new">Create</button>`,
    db.workouts.length?`<div class="list">${db.workouts.map(w=>`<div class="item"><div class="grow"><h4>${esc(w.name)}</h4><small>${w.exercises.length} exercises</small></div>
      <button class="btn ghost" data-dup="${w.id}">Copy</button><button class="btn ghost" data-go="#/edit/${w.id}">Edit</button><button class="btn primary" data-start="${w.id}">Start</button></div>`).join("")}</div>`
    :empty("No workouts yet","Save a template once.","Create","#/edit/new"));
}
function blankEx(name,kind){return kind==="timer"?{id:uid(),name,kind:"timer",workSec:20,restSec:10,rounds:8}:{id:uid(),name,kind:"sets",sets:3,reps:8,weight:"",restSec:90}}
function openEditor(id){
  if(id==="new"||!id)editor={id:"new",name:"",notes:"",exercises:[]};
  else{const w=db.workouts.find(x=>x.id===id);editor=w?JSON.parse(JSON.stringify(w)):{id:"new",name:"",notes:"",exercises:[]}}
}
function editEx(ex){
  return `<div class="ex-card"><div class="ex-head"><div><h3 style="margin:0 0 4px">${esc(ex.name)}</h3>
    <div class="chip-row"><button class="chip ${ex.kind==="sets"?"on":""}" data-kind="sets" data-ex="${ex.id}">Sets</button>
    <button class="chip ${ex.kind==="timer"?"on":""}" data-kind="timer" data-ex="${ex.id}">Timer</button></div></div>
    <div class="row"><button class="icon-btn" data-move="${ex.id}" data-dir="-1">↑</button><button class="icon-btn" data-move="${ex.id}" data-dir="1">↓</button><button class="icon-btn" data-drop-ex="${ex.id}">✕</button></div></div>
    ${ex.kind==="timer"?`<div class="row"><div class="field"><label>Work</label><input type="number" min="1" data-field="workSec" data-ex="${ex.id}" value="${ex.workSec}"></div>
      <div class="field"><label>Rest</label><input type="number" min="0" data-field="restSec" data-ex="${ex.id}" value="${ex.restSec}"></div>
      <div class="field"><label>Rounds</label><input type="number" min="1" data-field="rounds" data-ex="${ex.id}" value="${ex.rounds}"></div></div>`
    :`<div class="row"><div class="field"><label>Sets</label><input type="number" min="1" data-field="sets" data-ex="${ex.id}" value="${ex.sets}"></div>
      <div class="field"><label>Reps</label><input type="number" min="0" data-field="reps" data-ex="${ex.id}" value="${ex.reps}"></div>
      <div class="field"><label>${db.settings.unit}</label><input type="number" min="0" step="0.5" data-field="weight" data-ex="${ex.id}" value="${ex.weight}"></div>
      <div class="field"><label>Rest</label><input type="number" min="0" data-field="restSec" data-ex="${ex.id}" value="${ex.restSec}"></div></div>`}</div>`;
}
function renderEdit(){
  if(!editor)openEditor(route.id);
  return layout(editor.id==="new"?"New workout":"Edit workout","Template",`<button class="btn ghost" data-go="#/workouts">Back</button>`,
    `<div class="grid" style="grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">
      <div class="field"><label>Name</label><input id="w-name" value="${esc(editor.name)}" placeholder="Push Day"></div>
      <div class="field"><label>Notes</label><input id="w-notes" value="${esc(editor.notes||"")}"></div></div>
    <div class="list">${editor.exercises.map(editEx).join("")||`<div class="empty"><p>Add at least one exercise.</p></div>`}</div>
    <div class="row" style="margin-top:14px"><button class="btn lg" id="open-picker">Add exercise</button>
      <button class="btn primary lg" id="save-workout">Save workout</button>
      ${editor.id!=="new"?`<button class="btn danger" id="del-workout">Delete</button>`:""}</div>`);
}
