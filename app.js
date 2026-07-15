const BAND_LABELS = { Peak:'Premium', Core:'Estándar', Chill:'Descanso' };
const ERA_ORDER = ['Dorada','Modernos','Clasicos'];
const BAND_ORDER = ['Peak','Core','Chill'];
const REP_EVERY = 3;

let MAIN_POOL = [], LARGA_POOL = [], ADULTO_POOL = [], REP_POOL = [], NUEVAS_TEMP = [];
let QUOTA = {};
let CLASICOS_W = { Peak:0.34, Core:0.33, Chill:0.33 };

function esc(s){ return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function wait(ms){ return new Promise(r=>setTimeout(r,ms)); }
function isAvailable(plat){
  if(!plat) return false;
  if(/\bX\b/.test(plat)) return false;
  if(/Descargar/i.test(plat)) return false;
  return true;
}
const PLATFORM_ICONS = {
  netflix: 'netflix', crunchyroll: 'crunchyroll', prime: 'primevideo',
  disney: 'disneyplus', max: 'max'
};
const PLATFORM_EMOJI = { netflix:'🔴', crunchyroll:'🟠', prime:'🔵', disney:'⭐', max:'🟣' };
function detectPlatformKeys(plat){
  const p = (plat||'').toLowerCase();
  return Object.keys(PLATFORM_ICONS).filter(k => p.includes(k));
}
function platformIconsHtml(plat){
  const keys = detectPlatformKeys(plat);
  if(keys.length===0) return `<span>📺 ${esc(plat||'')}</span>`;
  return keys.map(k => `<img src="https://cdn.simpleicons.org/${PLATFORM_ICONS[k]}" alt="${k}"
    onerror="this.outerHTML='<span>${PLATFORM_EMOJI[k]}</span>'">`).join('') +
    `<span>${keys.map(k=>k[0].toUpperCase()+k.slice(1)).join(' · ')}</span>`;
}

async function fetchCsv(path){
  const res = await fetch(path, {cache:'no-store'});
  const text = await res.text();
  return Papa.parse(text, {header:true, skipEmptyLines:true}).data;
}

// Reparto por "método del resto mayor" (largest remainder / Hamilton apportionment):
// se calcula la proporción real Peak/Core/Chill del catálogo filtrado, se reparte
// la parte entera de esos slots, y los "sobrantes" (decimales) se ordenan de mayor
// a menor para asignar los slots que falten. Esto es matemáticamente el reparto
// más fiel posible a las proporciones reales -- pero significa que la cuota SE
// RECALCULA cada vez que el CSV cambia. Si hoy Descanso tiene más peso relativo en
// el catálogo filtrado, le tocará 3 en vez de 2, aunque antes fueran 4/4/2.
function largestRemainderQuota(counts, totalSlots){
  const total = counts.Peak + counts.Core + counts.Chill;
  if(total===0) return {Peak:0,Core:0,Chill:0};
  const raw = { Peak: counts.Peak/total*totalSlots, Core: counts.Core/total*totalSlots, Chill: counts.Chill/total*totalSlots };
  const floor = { Peak: Math.floor(raw.Peak), Core: Math.floor(raw.Core), Chill: Math.floor(raw.Chill) };
  let used = floor.Peak+floor.Core+floor.Chill;
  let remainder = totalSlots - used;
  const rema = [['Peak', raw.Peak-floor.Peak],['Core', raw.Core-floor.Core],['Chill', raw.Chill-floor.Chill]].sort((a,b)=>b[1]-a[1]);
  for(let i=0;i<remainder;i++){ floor[rema[i%3][0]] += 1; }
  return floor;
}

async function loadCatalog(){
  const [catalogo, nt] = await Promise.all([ fetchCsv('catalogo.csv'), fetchCsv('nuevas_temporadas.csv') ]);

  NUEVAS_TEMP = nt.map(r => ({
    title: r.Nombre, eps: r.Eps||'', fecha: r.FechaFinalizacion||'N/A',
    finished: !!(r.FechaFinalizacion && r.FechaFinalizacion.trim() && r.FechaFinalizacion.trim()!=='N/A')
  })).filter(r=>r.title);

  const eraMap = { 'ERA DORADA':'Dorada', 'MODERNOS':'Modernos', 'CLASICOS':'Clasicos' };
  const main = [], largas = [], rep = [], adulto = [];

  for(const r of catalogo){
    if(!r.Nombre) continue;
    const pend = (r.PendienteTemporada||'').trim();
    if(pend === 'X') continue;
    const plat = (r.Plataforma||'').trim();
    if(!isAvailable(plat)) continue;
    const cat = (r.Categoria||'').trim();
    const eps = parseInt(r.Eps) || 0;
    const emotional = (r.Emotional||'').trim()==='X';

    if(cat in eraMap){
      const rating = parseFloat(r.Calificacion) || 0;
      const band = rating>8.0 ? 'Peak' : (rating>=7.5 ? 'Core' : 'Chill');
      main.push({ title:r.Nombre, era:eraMap[cat], rating, eps, emotional, band, plataforma:plat });
    } else if(cat === 'Largas'){
      largas.push({ title:r.Nombre, eps, emotional, plataforma:plat });
    } else if(cat === 'Repetir Mejores'){
      rep.push({ title:r.Nombre, eps, emotional, plataforma:plat });
    } else if(cat === 'Adult Cartoon'){
      adulto.push({ title:r.Nombre, eps, emotional, plataforma:plat });
    }
  }

  MAIN_POOL = main; LARGA_POOL = largas; ADULTO_POOL = adulto; REP_POOL = rep;

  for(const era of ['Dorada','Modernos']){
    const counts = {Peak:0,Core:0,Chill:0};
    main.filter(m=>m.era===era).forEach(m=> counts[m.band]++);
    QUOTA[era] = largestRemainderQuota(counts, era==='Dorada'?10:6);
  }
  const cCounts = {Peak:0,Core:0,Chill:0};
  main.filter(m=>m.era==='Clasicos').forEach(m=> cCounts[m.band]++);
  const cTotal = cCounts.Peak+cCounts.Core+cCounts.Chill || 1;
  CLASICOS_W = { Peak:cCounts.Peak/cTotal, Core:cCounts.Core/cTotal, Chill:cCounts.Chill/cTotal };
}

function freshDeck(){
  const deck = [];
  for(const era of ['Dorada','Modernos']){
    for(const band of BAND_ORDER){
      const n = (QUOTA[era] && QUOTA[era][band]) || 0;
      for(let i=0;i<n;i++) deck.push({era, band, used:false});
    }
  }
  for(let i=0;i<2;i++) deck.push({era:'Clasicos', band:null, used:false});
  return deck;
}

function weightedBandPick(w){
  const r = Math.random();
  if(r < w.Peak) return 'Peak';
  if(r < w.Peak+w.Core) return 'Core';
  return 'Chill';
}

function seedInitialState(){
  const deck = freshDeck();
  function useToken(era,band){ const t = deck.find(x=>!x.used && x.era===era && x.band===band); if(t) t.used = true; }
  useToken('Dorada','Peak'); useToken('Dorada','Peak');
  useToken('Dorada','Core');
  useToken('Dorada','Chill');
  useToken('Modernos','Core'); useToken('Modernos','Core');
  return {
    usedTitles: ['Assassination Classroom','7th Time Loop','Ping Pong the Animation','Sacrificial Princess and the King of Beasts','Charlotte','Kakegurui'],
    deck: deck,
    history: [
      {title:'Kakegurui', era:'Dorada', band:'Chill', emotional:false},
      {title:'Charlotte', era:'Dorada', band:'Core', emotional:true},
      {title:'Sacrificial Princess and the King of Beasts', era:'Modernos', band:'Core', emotional:true},
      {title:'Ping Pong the Animation', era:'Dorada', band:'Peak', emotional:false},
      {title:'7th Time Loop', era:'Modernos', band:'Core', emotional:false},
      {title:'Assassination Classroom', era:'Dorada', band:'Peak', emotional:false}
    ],
    emoCount: 2, lastEra:'Dorada', lastEra2:'Dorada', lastBand:'Chill', lastEmo:false,
    cycleNum: 1,
    pendingPick: null,
    largaUsed: [], adultoUsed: [], repUsed: [],
    seenNT: [],
    owed: {adulto:false, larga:false, repeticion:false},
    blocking: false,
    extra: null,
    view: 'home'
  };
}
let state = null;

async function loadState(){
  await loadCatalog();
  try{
    const r = await window.storage.get('ruleta-anime-state-v5');
    if(r && r.value){ state = JSON.parse(r.value); if(!state.seenNT) state.seenNT=[]; }
    else { state = seedInitialState(); await saveState(); }
  }catch(e){ state = seedInitialState(); }
  document.getElementById('view-loading').classList.add('hidden');
  showView(state.view || 'home');
  render();
}
async function saveState(){
  try{ await window.storage.set('ruleta-anime-state-v5', JSON.stringify(state)); }catch(e){ console.error(e); }
}

function ntAvailableList(){ return NUEVAS_TEMP.filter(nt=>nt.finished && !state.seenNT.includes(nt.title)); }

function showView(name){
  state.view = name;
  ['home','anime','nt','ciclo'].forEach(v=>{
    document.getElementById('view-'+v).classList.toggle('hidden', v!==name);
  });
  if(name==='anime') renderAnimeLanding();
  if(name==='nt') renderNuevasTemp();
  if(name==='ciclo') render();
  saveState();
}
document.getElementById('goAnime').addEventListener('click', ()=> showView('anime'));
document.getElementById('goLive').addEventListener('click', ()=> toast('Próximamente'));
document.getElementById('goMovies').addEventListener('click', ()=> toast('Próximamente'));
document.getElementById('backHomeFromAnime').addEventListener('click', ()=> showView('home'));
document.getElementById('backAnimeFromNT').addEventListener('click', ()=> showView('anime'));
document.getElementById('backAnimeFromCiclo').addEventListener('click', ()=> showView('anime'));
document.getElementById('animeGoCicloBtn').addEventListener('click', ()=> showView('ciclo'));
document.getElementById('animeGoNTBtn').addEventListener('click', ()=> showView('nt'));
document.getElementById('ntContinueCicloBtn').addEventListener('click', ()=> showView('ciclo'));

function toast(msg){
  const t = document.createElement('div');
  t.textContent = msg;
  t.style.cssText = 'position:fixed;bottom:30px;left:50%;transform:translateX(-50%);background:var(--panel2);color:var(--text);padding:10px 18px;border-radius:100px;font-size:13px;border:1px solid var(--line);z-index:999;';
  document.body.appendChild(t);
  setTimeout(()=>t.remove(), 1500);
}

function renderAnimeLanding(){
  document.getElementById('animeStatCiclo').textContent = state.deck.filter(t=>t.used).length + '/' + state.deck.length;
  document.getElementById('animeStatN').textContent = state.cycleNum;
  const avail = ntAvailableList();
  document.getElementById('animeStatNT').textContent = avail.length;
  document.getElementById('animeGoNTRow').classList.toggle('hidden', avail.length===0);
}

function renderNuevasTemp(){
  const el = document.getElementById('ntList');
  el.innerHTML = '';
  NUEVAS_TEMP.forEach(nt => {
    const seen = state.seenNT.includes(nt.title);
    const clickable = nt.finished && !seen;
    const row = document.createElement(clickable ? 'button' : 'div');
    row.className = 'nt-row' + (nt.finished?' finished':'') + (seen?' seen':'');
    row.innerHTML = `
      <div class="nt-dot"></div>
      <div class="nt-title">${esc(nt.title)}</div>
      <div class="nt-meta">${nt.eps?esc(nt.eps)+' · ':''}${esc(nt.fecha)}</div>
      ${seen?'<span class="nt-badge seen">Vista</span>':(nt.finished?'<span class="nt-badge">Lista</span>':'')}
    `;
    if(clickable){
      row.addEventListener('click', ()=> selectNuevaTemp(nt));
    }
    el.appendChild(row);
  });
}

function selectNuevaTemp(nt){
  state.seenNT.push(nt.title);
  state.history.unshift({title: nt.title, era:'Extra', band:'Nueva Temporada', emotional:false});
  saveState();
  toast(`"${nt.title}" agregada al historial`);
  showView('ciclo');
}

// ---------------- core draw logic (ciclo normal) ----------------
function candidateTokens(){
  let avail = state.deck.filter(t=>!t.used);
  if(avail.length===0) return [];
  let pool = avail;
  let f1 = pool.filter(t=> !(state.lastEra && state.lastEra2 && state.lastEra===state.lastEra2 && t.era===state.lastEra));
  if(f1.length>0) pool = f1;
  return pool;
}
function resolveBand(token){
  if(token.band) return token.band;
  let band = weightedBandPick(CLASICOS_W);
  if(state.lastBand==='Peak' && band==='Peak'){
    const w2total = CLASICOS_W.Core+CLASICOS_W.Chill || 1;
    band = Math.random() < (CLASICOS_W.Core/w2total) ? 'Core' : 'Chill';
  }
  return band;
}
function pickTitleFor(token, band){
  const usedSet = new Set(state.usedTitles);
  let candidates = MAIN_POOL.filter(a => a.era===token.era && a.band===band && !usedSet.has(a.title));
  const emoAllowed = state.emoCount < 3 && !state.lastEmo;
  const wantEmo = emoAllowed ? (Math.random() < 0.20) : false;
  let filtered = candidates.filter(a => a.emotional === wantEmo);
  if(filtered.length>0) candidates = filtered;
  if(candidates.length===0) candidates = MAIN_POOL.filter(a => a.era===token.era && !usedSet.has(a.title));
  if(candidates.length===0) candidates = MAIN_POOL.filter(a => !usedSet.has(a.title));
  if(candidates.length===0) return null;
  return candidates[Math.floor(Math.random()*candidates.length)];
}
function finishDraw(token, band){
  const title = pickTitleFor(token, band);
  if(!title) return null;
  return {token: {era:token.era, band}, title};
}
function drawNext(excludeEraBand){
  let pool = candidateTokens();
  if(excludeEraBand){
    let f = pool.filter(t => !(t.era===excludeEraBand.era));
    if(f.length>0) pool = f;
  }
  if(pool.length===0) return null;
  const token = pool[Math.floor(Math.random()*pool.length)];
  const band = resolveBand(token);
  return finishDraw(token, band);
}
function commitPick(pick){
  const idx = state.deck.findIndex(t=>!t.used && t.era===pick.token.era && (t.band===pick.token.band || t.band===null));
  if(idx>=0) state.deck[idx].used = true;
  state.usedTitles.push(pick.title.title);
  state.history.unshift({title:pick.title.title, era:pick.token.era, band:pick.token.band, emotional:pick.title.emotional});
  if(pick.title.emotional) state.emoCount += 1;
  state.lastEra2 = state.lastEra; state.lastEra = pick.token.era;
  state.lastBand = pick.token.band; state.lastEmo = pick.title.emotional;
  state.pendingPick = null;
}
function startNewCycle(){
  state.deck = freshDeck(); state.emoCount = 0; state.cycleNum += 1;
  state.lastEra = null; state.lastEra2 = null; state.lastBand = null; state.lastEmo = false;
}

// ---------------- extra pools ----------------
function poolFor(cat){ return cat==='adulto'?ADULTO_POOL : cat==='larga'?LARGA_POOL : REP_POOL; }
function usedArrFor(cat){ return cat==='adulto'?state.adultoUsed : cat==='larga'?state.largaUsed : state.repUsed; }
function drawExtra(cat){
  const usedArr = usedArrFor(cat);
  const usedSet = new Set(usedArr);
  let avail = poolFor(cat).filter(a=>!usedSet.has(a.title));
  if(avail.length===0){ avail = poolFor(cat); usedArr.length = 0; }
  if(avail.length===0) return null;
  return avail[Math.floor(Math.random()*avail.length)];
}
function commitExtra(cat, item){
  usedArrFor(cat).push(item.title);
  const label = cat==='adulto'?'Adulto':cat==='larga'?'Larga':'Repetición';
  state.history.unshift({title:item.title, era:'Extra', band:label, emotional: !!item.emotional});
  state.owed[cat] = false;
}

// ---------------- wheel ----------------
function spinWheel(simple, duration){
  const wheel = document.getElementById('wheel');
  wheel.classList.toggle('simple', simple);
  wheel.style.transition = 'none';
  wheel.style.transform = 'rotate(0deg)';
  void wheel.offsetWidth;
  const totalDeg = 720 + Math.random()*180;
  wheel.style.transition = `transform ${duration}s cubic-bezier(0.2,0.7,0.3,1)`;
  requestAnimationFrame(()=>{ wheel.style.transform = `rotate(${totalDeg}deg)`; });
}

function setupCardSkeleton(){
  document.getElementById('cardArea').innerHTML = `
    <div class="card-tags" id="rvTags"></div>
    <div class="card-title" id="rvTitle"></div>
    <div class="card-meta" id="rvMeta"></div>
    <div class="card-plat" id="rvPlat"></div>
  `;
}
function addTag(container, text, cls){
  const span = document.createElement('span');
  span.className = 'tag ' + cls;
  span.textContent = text;
  container.appendChild(span);
  requestAnimationFrame(()=> span.classList.add('fade-in'));
}

async function revealPickNormal(pick){
  setupCardSkeleton();
  const tags = document.getElementById('rvTags');
  const titleEl = document.getElementById('rvTitle');
  const metaEl = document.getElementById('rvMeta');
  const platEl = document.getElementById('rvPlat');
  await wait(120);
  addTag(tags, pick.token.era, 'era-'+pick.token.era);
  await wait(700);
  addTag(tags, BAND_LABELS[pick.token.band], 'band-'+pick.token.band);
  await wait(700);
  if(pick.title.emotional){ addTag(tags, 'Emotional', 'emo'); }
  await wait(700);
  titleEl.textContent = pick.title.title;
  titleEl.classList.add('fade-in');
  metaEl.textContent = `★ ${pick.title.rating.toFixed(2)} · ${pick.title.eps} eps`;
  metaEl.classList.add('fade-in');
  platEl.innerHTML = platformIconsHtml(pick.title.plataforma);
  platEl.classList.add('fade-in');
}
async function revealPickExtra(item, cat){
  setupCardSkeleton();
  const tags = document.getElementById('rvTags');
  const titleEl = document.getElementById('rvTitle');
  const metaEl = document.getElementById('rvMeta');
  const platEl = document.getElementById('rvPlat');
  const label = cat==='adulto'?'Adulto':cat==='larga'?'Larga':'Repetición';
  await wait(120);
  addTag(tags, label, 'era-Extra');
  await wait(700);
  if(item.emotional){ addTag(tags, 'Emotional', 'emo'); }
  await wait(700);
  titleEl.textContent = item.title;
  titleEl.classList.add('fade-in');
  metaEl.textContent = `${item.eps} eps`;
  metaEl.classList.add('fade-in');
  platEl.innerHTML = platformIconsHtml(item.plataforma);
  platEl.classList.add('fade-in');
}

function disableAllActionButtons(disabled){
  ['nextBtn','redoBtn','confirmBtn','redoExtraBtn','confirmExtraBtn','continueExtraBtn',
   'gateAdultoBtn','gateLargaBtn','gateRepBtn','gateContinueBtn'].forEach(id=>{
    const el = document.getElementById(id);
    if(el) el.disabled = disabled;
  });
  document.querySelectorAll('.pill').forEach(p=> p.disabled = disabled);
}

async function startDrawNormal(){
  disableAllActionButtons(true);
  document.getElementById('normalRow').classList.add('hidden');
  document.getElementById('confirmRow').classList.add('hidden');
  document.getElementById('gateBox').classList.add('hidden');
  document.getElementById('cardArea').classList.add('hidden');
  const wrap = document.getElementById('wheelWrap');
  wrap.style.display = 'flex';
  document.getElementById('wheelLabel').textContent = 'Girando…';
  spinWheel(false, 0.5);
  await wait(580);
  wrap.style.display = 'none';
  document.getElementById('cardArea').classList.remove('hidden');

  let result = drawNext(null);
  if(!result){
    toast('Sin candidatos, revisa el mazo');
    document.getElementById('normalRow').classList.remove('hidden');
    disableAllActionButtons(false);
    return;
  }
  state.pendingPick = result;
  saveState();
  await revealPickNormal(result);
  document.getElementById('confirmRow').classList.remove('hidden');
  disableAllActionButtons(false);
}

document.getElementById('nextBtn').addEventListener('click', startDrawNormal);
document.getElementById('redoBtn').addEventListener('click', async ()=>{
  state.pendingPick = null;
  await startDrawNormal();
});
document.getElementById('confirmBtn').addEventListener('click', ()=>{
  commitPick(state.pendingPick);
  document.getElementById('confirmRow').classList.add('hidden');
  const remaining = state.deck.filter(t=>!t.used).length;
  if(remaining===0){
    state.owed.adulto = true;
    state.owed.larga = true;
    if(state.cycleNum % REP_EVERY === 0) state.owed.repeticion = true;
    state.blocking = true;
    saveState();
    render();
  } else {
    document.getElementById('normalRow').classList.remove('hidden');
    saveState();
    render();
  }
});

async function startDrawExtra(cat, fromGate){
  disableAllActionButtons(true);
  state.extra = {category: cat, fromGate: !!fromGate};
  document.getElementById('gateBox').classList.add('hidden');
  document.getElementById('normalRow').classList.add('hidden');
  document.getElementById('confirmRow').classList.add('hidden');
  document.getElementById('confirmExtraRow').classList.add('hidden');
  document.getElementById('continueExtraRow').classList.add('hidden');
  document.getElementById('cardArea').classList.add('hidden');
  const wrap = document.getElementById('wheelWrap');
  wrap.style.display = 'flex';
  document.getElementById('wheelLabel').textContent = 'Girando…';
  spinWheel(true, 0.5);
  await wait(580);
  wrap.style.display = 'none';
  document.getElementById('cardArea').classList.remove('hidden');

  const item = drawExtra(cat);
  if(!item){ toast('Sin títulos en esta categoría'); render(); disableAllActionButtons(false); return; }
  state.extra.item = item;
  saveState();
  await revealPickExtra(item, cat);
  document.getElementById('confirmExtraRow').classList.remove('hidden');
  document.getElementById('continueExtraRow').classList.toggle('hidden', !state.extra.fromGate);
  disableAllActionButtons(false);
}
document.getElementById('gateAdultoBtn').addEventListener('click', ()=> startDrawExtra('adulto', true));
document.getElementById('gateLargaBtn').addEventListener('click', ()=> startDrawExtra('larga', true));
document.getElementById('gateRepBtn').addEventListener('click', ()=> startDrawExtra('repeticion', true));

document.getElementById('redoExtraBtn').addEventListener('click', ()=> startDrawExtra(state.extra.category, state.extra.fromGate));
document.getElementById('confirmExtraBtn').addEventListener('click', ()=>{
  const cat = state.extra.category;
  const fromGate = state.extra.fromGate;
  commitExtra(cat, state.extra.item);
  state.extra = null;
  document.getElementById('confirmExtraRow').classList.add('hidden');
  document.getElementById('continueExtraRow').classList.add('hidden');

  if(!fromGate){
    document.getElementById('normalRow').classList.remove('hidden');
    saveState(); render();
    return;
  }
  const stillOwed = state.owed.adulto || state.owed.larga || state.owed.repeticion;
  if(state.blocking && stillOwed){ render(); }
  else {
    state.blocking = false;
    startNewCycle();
    document.getElementById('normalRow').classList.remove('hidden');
    saveState(); render();
  }
});
document.getElementById('gateContinueBtn').addEventListener('click', ()=>{
  state.blocking = false; state.extra = null;
  startNewCycle();
  document.getElementById('gateBox').classList.add('hidden');
  document.getElementById('normalRow').classList.remove('hidden');
  saveState(); render();
});
document.getElementById('continueExtraBtn').addEventListener('click', ()=>{
  state.blocking = false; state.extra = null;
  startNewCycle();
  document.getElementById('confirmExtraRow').classList.add('hidden');
  document.getElementById('continueExtraRow').classList.add('hidden');
  document.getElementById('normalRow').classList.remove('hidden');
  saveState(); render();
});

function renderPendingPills(){
  const row = document.getElementById('pendingRow');
  row.innerHTML = '';
  if(state.blocking || state.pendingPick || state.extra) return;
  if(state.owed.adulto){
    const b = document.createElement('button'); b.className='pill'; b.textContent='¿Ahora sí Adulta?';
    b.addEventListener('click', ()=> startDrawExtra('adulto', false));
    row.appendChild(b);
  }
  if(state.owed.larga){
    const b = document.createElement('button'); b.className='pill'; b.textContent='¿Ahora sí Larga?';
    b.addEventListener('click', ()=> startDrawExtra('larga', false));
    row.appendChild(b);
  }
  if(state.owed.repeticion){
    const b = document.createElement('button'); b.className='pill'; b.textContent='¿Ahora sí Repetir?';
    b.addEventListener('click', ()=> startDrawExtra('repeticion', false));
    row.appendChild(b);
  }
}

document.getElementById('resetCycleLink').addEventListener('click', ()=>{
  if(!confirm('¿Reiniciar la bolsa del ciclo actual? Lo ya visto se mantiene marcado.')) return;
  startNewCycle(); state.history = []; state.pendingPick = null;
  state.blocking=false; state.extra=null;
  render(); saveState();
});
document.getElementById('resetAllLink').addEventListener('click', ()=>{
  if(!confirm('¿Borrar TODO lo visto y reiniciar desde cero?')) return;
  state.usedTitles = []; startNewCycle(); state.history = []; state.pendingPick = null;
  state.cycleNum = 1; state.owed={adulto:false,larga:false,repeticion:false}; state.blocking=false; state.extra=null;
  render(); saveState();
});
document.getElementById('reloadCatalogLink').addEventListener('click', async ()=>{
  await loadCatalog();
  toast('Catálogo recargado');
  render();
});

function render(){
  renderDeck();
  renderStats();
  renderHistory();
  renderPendingPills();
  renderGateOrNormal();
}
function renderDeck(){
  const grid = document.getElementById('deckGrid');
  grid.innerHTML = '';
  for(const era of ERA_ORDER){
    const row = document.createElement('div'); row.className='deck-row';
    const label = document.createElement('div'); label.className='deck-era-label';
    label.style.color = era==='Dorada'?'var(--dorada)':era==='Modernos'?'var(--nuevo)':'var(--viejo)';
    label.textContent = era; row.appendChild(label);
    const chips = document.createElement('div'); chips.className='chips';
    for(const t of state.deck.filter(t=>t.era===era)){
      const c = document.createElement('div'); c.className='chip'+(t.used?' used':'');
      const col = era==='Dorada'?'#e8b854':era==='Modernos'?'#4fd0c8':'#d17b52';
      c.style.borderColor = col; if(!t.used) c.style.background = col;
      chips.appendChild(c);
    }
    row.appendChild(chips); grid.appendChild(row);
  }
}
function renderStats(){
  document.getElementById('statPos').textContent = state.deck.filter(t=>t.used).length + '/' + state.deck.length;
  document.getElementById('statEmo').textContent = state.emoCount + '/3';
  document.getElementById('statCycleN').textContent = state.cycleNum;
}
function renderHistory(){
  const el = document.getElementById('historyList');
  if(state.history.length===0){ el.innerHTML = '<div style="color:var(--dim); font-size:12.5px;">Nada elegido aún</div>'; return; }
  el.innerHTML = state.history.map((h,i)=>`
    <div class="history-item">
      <span class="history-num">${state.history.length-i}</span>
      <span class="history-dot ${h.era}"></span>
      <span class="history-era">${esc(h.era)}</span>
      <span class="history-band">${esc(BAND_LABELS[h.band]||h.band||'')}</span>
      <span class="history-title">${esc(h.title)}</span>
      ${h.emotional ? '<span style="color:var(--emo); font-size:11px;">♥</span>' : ''}
    </div>
  `).join('');
}
function renderGateOrNormal(){
  const gateBox = document.getElementById('gateBox');
  const normalRow = document.getElementById('normalRow');
  const confirmRow = document.getElementById('confirmRow');
  const confirmExtraRow = document.getElementById('confirmExtraRow');
  const continueExtraRow = document.getElementById('continueExtraRow');

  if(state.extra){ return; }
  if(state.pendingPick){
    normalRow.classList.add('hidden'); gateBox.classList.add('hidden');
    confirmRow.classList.remove('hidden');
    return;
  }
  if(state.blocking){
    normalRow.classList.add('hidden'); confirmRow.classList.add('hidden');
    confirmExtraRow.classList.add('hidden'); continueExtraRow.classList.add('hidden');
    gateBox.classList.remove('hidden');
    document.getElementById('gateAdultoBtn').classList.toggle('hidden', !state.owed.adulto);
    document.getElementById('gateLargaBtn').classList.toggle('hidden', !state.owed.larga);
    document.getElementById('gateRepBtn').classList.toggle('hidden', !state.owed.repeticion);
    document.getElementById('cardArea').innerHTML = '<div class="card-empty">Ciclo completo</div>';
    return;
  }
  gateBox.classList.add('hidden'); confirmRow.classList.add('hidden');
  confirmExtraRow.classList.add('hidden'); continueExtraRow.classList.add('hidden');
  normalRow.classList.remove('hidden');
  if(!document.getElementById('rvTitle')){
    document.getElementById('cardArea').innerHTML = '<div class="card-empty">Presiona "Elegir siguiente" para empezar</div>';
  }
}

loadState();
if('serviceWorker' in navigator){
  window.addEventListener('load', ()=>{ navigator.serviceWorker.register('sw.js').catch(()=>{}); });
}
