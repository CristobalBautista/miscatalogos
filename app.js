const BAND_ORDER = ['Elite','Normal','Ligera'];
const ERA_ORDER = ['Dorada','Moderna','Clasica'];
const ERA_LABELS = { Dorada:'Era Dorada', Moderna:'Era Moderna', Clasica:'Era Clásica' };
const REP_EVERY = 3;
const THEMES = ['dark-purple','mal-blue','trakt-red','gold-black','light'];
const THEME_SWATCH = { 'dark-purple':'#b98ee8', 'mal-blue':'#3f7fe0', 'trakt-red':'#ed1c24', 'gold-black':'#f5c518', 'light':'#5b4fd1' };

let MAIN_POOL = [], LARGA_POOL = [], ADULTO_POOL = [], REP_POOL = [], NUEVAS_TEMP = [];
let QUOTA = {};
let CLASICA_W = { Elite:0.34, Normal:0.33, Ligera:0.33 };

function esc(s){ return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function wait(ms){ return new Promise(r=>setTimeout(r,ms)); }
function isAvailable(plat){
  if(!plat) return false;
  if(/\bX\b/.test(plat)) return false;
  if(/Descargar/i.test(plat)) return false;
  return true;
}
const PLATFORM_ICONS = { netflix:'netflix', crunchyroll:'crunchyroll', prime:'primevideo', disney:'disneyplus', max:'max' };
const PLATFORM_EMOJI = { netflix:'🔴', crunchyroll:'🟠', prime:'🔵', disney:'⭐', max:'🟣' };
function detectPlatformKeys(plat){
  const p = (plat||'').toLowerCase();
  return Object.keys(PLATFORM_ICONS).filter(k => p.includes(k));
}
function platformChipsHtml(plat){
  const keys = detectPlatformKeys(plat);
  if(keys.length===0) return `<span class="plat-chip"><span>📺 ${esc(plat||'Sin dato')}</span></span>`;
  return keys.map(k => `<span class="plat-chip">
      <img src="https://cdn.simpleicons.org/${PLATFORM_ICONS[k]}" alt="${k}" onerror="this.outerHTML='${PLATFORM_EMOJI[k]}'">
      <span>${k[0].toUpperCase()+k.slice(1)}</span>
    </span>`).join('');
}

async function fetchCsv(path){
  const res = await fetch(path, {cache:'no-store'});
  const text = await res.text();
  return Papa.parse(text, {header:true, skipEmptyLines:true}).data;
}

// Metodo del resto mayor (largest remainder / Hamilton): reparte los slots del
// ciclo segun la proporcion real Elite/Normal/Ligera del catalogo YA FILTRADO
// (sin Pendiente=X, sin no-disponibles). Se recalcula cada vez que cambia el CSV,
// por eso el numero exacto puede moverse si editas la data.
function largestRemainderQuota(counts, totalSlots){
  const total = counts.Elite + counts.Normal + counts.Ligera;
  if(total===0) return {Elite:0,Normal:0,Ligera:0};
  const raw = { Elite: counts.Elite/total*totalSlots, Normal: counts.Normal/total*totalSlots, Ligera: counts.Ligera/total*totalSlots };
  const floor = { Elite: Math.floor(raw.Elite), Normal: Math.floor(raw.Normal), Ligera: Math.floor(raw.Ligera) };
  let used = floor.Elite+floor.Normal+floor.Ligera;
  let remainder = totalSlots - used;
  const rema = [['Elite', raw.Elite-floor.Elite],['Normal', raw.Normal-floor.Normal],['Ligera', raw.Ligera-floor.Ligera]].sort((a,b)=>b[1]-a[1]);
  for(let i=0;i<remainder;i++){ floor[rema[i%3][0]] += 1; }
  return floor;
}

async function loadCatalog(){
  const [catalogo, nt] = await Promise.all([ fetchCsv('catalogo.csv'), fetchCsv('nuevas_temporadas.csv') ]);

  NUEVAS_TEMP = nt.map(r => ({
    title: r.Nombre, eps: r.Eps||'',
    finished: !!(r.FechaFinalizacion && r.FechaFinalizacion.trim() && r.FechaFinalizacion.trim()!=='N/A')
  })).filter(r=>r.title);

  const eraMap = { 'ERA DORADA':'Dorada', 'MODERNOS':'Moderna', 'CLASICOS':'Clasica' };
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
      const band = rating>8.0 ? 'Elite' : (rating>=7.5 ? 'Normal' : 'Ligera');
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

  for(const era of ['Dorada','Moderna']){
    const counts = {Elite:0,Normal:0,Ligera:0};
    main.filter(m=>m.era===era).forEach(m=> counts[m.band]++);
    QUOTA[era] = largestRemainderQuota(counts, era==='Dorada'?10:6);
  }
  const cCounts = {Elite:0,Normal:0,Ligera:0};
  main.filter(m=>m.era==='Clasica').forEach(m=> cCounts[m.band]++);
  const cTotal = cCounts.Elite+cCounts.Normal+cCounts.Ligera || 1;
  CLASICA_W = { Elite:cCounts.Elite/cTotal, Normal:cCounts.Normal/cTotal, Ligera:cCounts.Ligera/cTotal };
}

function freshDeck(){
  const deck = [];
  for(const era of ['Dorada','Moderna']){
    for(const band of BAND_ORDER){
      const n = (QUOTA[era] && QUOTA[era][band]) || 0;
      for(let i=0;i<n;i++) deck.push({era, band, used:false});
    }
  }
  for(let i=0;i<2;i++) deck.push({era:'Clasica', band:null, used:false});
  return deck;
}
function weightedBandPick(w){
  const r = Math.random();
  if(r < w.Elite) return 'Elite';
  if(r < w.Elite+w.Normal) return 'Normal';
  return 'Ligera';
}

function seedInitialState(){
  const deck = freshDeck();
  function useToken(era,band){ const t = deck.find(x=>!x.used && x.era===era && x.band===band); if(t) t.used = true; }
  useToken('Dorada','Elite'); useToken('Dorada','Elite');
  useToken('Dorada','Normal');
  useToken('Dorada','Ligera');
  useToken('Moderna','Normal'); useToken('Moderna','Normal');
  return {
    usedTitles: ['Assassination Classroom','7th Time Loop','Ping Pong the Animation','Sacrificial Princess and the King of Beasts','Charlotte','Kakegurui'],
    deck: deck,
    history: [
      {title:'Kakegurui', era:'Dorada', band:'Ligera', emotional:false},
      {title:'Charlotte', era:'Dorada', band:'Normal', emotional:true},
      {title:'Sacrificial Princess and the King of Beasts', era:'Moderna', band:'Normal', emotional:true},
      {title:'Ping Pong the Animation', era:'Dorada', band:'Elite', emotional:false},
      {title:'7th Time Loop', era:'Moderna', band:'Normal', emotional:false},
      {title:'Assassination Classroom', era:'Dorada', band:'Elite', emotional:false}
    ],
    emoCount: 2, lastEra:'Dorada', lastEra2:'Dorada', lastBand:'Ligera', lastEmo:false,
    cycleNum: 1,
    pendingPick: null,
    largaUsed: [], adultoUsed: [], repUsed: [],
    seenNT: [],
    owed: {adulto:false, larga:false, repeticion:false},
    blocking: false,
    extra: null,
    lastAction: null,
    theme: 'dark-purple',
    view: 'home'
  };
}
let state = null;

async function loadState(){
  await loadCatalog();
  try{
    const r = await window.storage.get('ruleta-anime-state-v6');
    if(r && r.value){ state = JSON.parse(r.value); if(!state.seenNT) state.seenNT=[]; if(!state.theme) state.theme='dark-purple'; }
    else { state = seedInitialState(); await saveState(); }
  }catch(e){ state = seedInitialState(); }
  applyTheme(state.theme);
  document.getElementById('view-loading').classList.add('hidden');
  showView(state.view || 'home');
  render();
}
async function saveState(){
  try{ await window.storage.set('ruleta-anime-state-v6', JSON.stringify(state)); }catch(e){ console.error(e); }
}

function applyTheme(t){ document.documentElement.setAttribute('data-theme', t); }
function renderThemeRow(){
  const row = document.getElementById('themeRow');
  row.innerHTML = '';
  THEMES.forEach(t=>{
    const d = document.createElement('div');
    d.className = 'theme-dot' + (state.theme===t ? ' active' : '');
    d.style.background = THEME_SWATCH[t];
    if(t==='light') d.style.border = '2px solid #ddd';
    d.addEventListener('click', ()=>{ state.theme = t; applyTheme(t); renderThemeRow(); saveState(); });
    row.appendChild(d);
  });
}

function ntAvailableList(){ return NUEVAS_TEMP.filter(nt=>nt.finished && !state.seenNT.includes(nt.title)); }

async function fadeToView(name){
  const wrap = document.querySelector('.wrap');
  wrap.style.transition = 'opacity .45s';
  wrap.style.opacity = '0';
  await wait(450);
  showView(name);
  await wait(60);
  wrap.style.opacity = '1';
}

function showView(name){
  state.view = name;
  ['home','anime','nt','ciclo','lista'].forEach(v=>{
    document.getElementById('view-'+v).classList.toggle('hidden', v!==name);
  });
  if(name==='home') renderThemeRow();
  if(name==='anime') renderAnimeLanding();
  if(name==='nt') renderNuevasTemp();
  if(name==='lista') renderListaCompleta();
  if(name==='ciclo') render();
  saveState();
}
document.getElementById('goAnime').addEventListener('click', ()=> showView('anime'));
document.getElementById('goLive').addEventListener('click', ()=> toast('Próximamente'));
document.getElementById('goMovies').addEventListener('click', ()=> toast('Próximamente'));
document.getElementById('backHomeFromAnime').addEventListener('click', ()=> showView('home'));
document.getElementById('backAnimeFromNT').addEventListener('click', ()=> showView('anime'));
document.getElementById('backAnimeFromCiclo').addEventListener('click', ()=> showView('anime'));
document.getElementById('animeGoCicloBtn').addEventListener('click', ()=>{
  state.pendingPick = null;
  document.getElementById('cardArea').innerHTML = '<div class="card-empty">Presiona "Elegir siguiente" para empezar</div>';
  showView('ciclo');
});
document.getElementById('animeGoNTBtn').addEventListener('click', ()=> showView('nt'));
document.getElementById('animeGoListaBtn').addEventListener('click', ()=> showView('lista'));
document.getElementById('backAnimeFromLista').addEventListener('click', ()=> showView('anime'));

function toast(msg){
  const t = document.createElement('div');
  t.textContent = msg;
  t.style.cssText = 'position:fixed;bottom:30px;left:50%;transform:translateX(-50%);background:var(--panel2);color:var(--text);padding:10px 18px;border-radius:100px;font-size:13px;border:1px solid var(--line);z-index:999;';
  document.body.appendChild(t);
  setTimeout(()=>t.remove(), 1500);
}

function renderAnimeLanding(){
  const avail = ntAvailableList();
  document.getElementById('animeGoNTBtn').classList.toggle('hidden', avail.length===0);
  renderHistoryTable();
  document.getElementById('undoLink').classList.toggle('hidden', !state.lastAction);
}
function renderHistoryTable(){
  const body = document.getElementById('histBody');
  if(state.history.length===0){
    body.innerHTML = `<tr><td colspan="4" style="color:var(--dim); text-align:center; padding:16px 6px;">Nada elegido aún</td></tr>`;
    return;
  }
  body.innerHTML = state.history.map((h,i) => `
    <tr class="${i===0?'latest':''}">
      <td><span class="dot ${h.era}"></span>${esc(ERA_LABELS[h.era]||h.era)}</td>
      <td>${esc(h.band||'')}</td>
      <td class="name-cell">${esc(h.title)}</td>
      <td>${h.emotional ? '<span style="color:var(--emo);">♥</span>' : ''}</td>
    </tr>
  `).join('');
}
function renderMiniHist(){
  const el = document.getElementById('miniHist');
  if(!el) return;
  if(state.history.length===0){ el.innerHTML = '<div style="color:var(--dim); font-size:12.5px;">Nada elegido aún</div>'; return; }
  el.innerHTML = state.history.map((h,i)=>`
    <div class="mini-hist-item ${i===0?'latest':''}">
      <span class="mini-hist-dot ${h.era}"></span>
      <span class="mini-hist-title">${esc(h.title)}</span>
      ${h.emotional ? '<span style="color:var(--emo); font-size:11px;">♥</span>' : ''}
    </div>
  `).join('');
}
function renderListaCompleta(){
  const el = document.getElementById('listaList');
  const usedSet = new Set(state.usedTitles);
  const items = MAIN_POOL.filter(a=>!usedSet.has(a.title)).slice().sort((a,b)=> a.title.localeCompare(b.title));
  if(items.length===0){ el.innerHTML = '<div style="padding:20px; text-align:center; color:var(--dim);">Sin títulos pendientes.</div>'; return; }
  el.innerHTML = items.map(a => `
    <button class="lista-row" data-title="${esc(a.title)}">
      <span class="lista-era-dot" style="background:var(--${a.era.toLowerCase()})"></span>
      <span class="lista-name">${esc(a.title)}</span>
      <span class="lista-meta">${esc(ERA_LABELS[a.era]||a.era)} · ${a.eps} eps</span>
      <span class="lista-plat">${platformChipsHtml(a.plataforma)}</span>
    </button>
  `).join('');
  el.querySelectorAll('.lista-row').forEach(row=>{
    row.addEventListener('click', ()=>{
      const item = MAIN_POOL.find(a=>a.title===row.dataset.title);
      if(item) selectFromLista(item);
    });
  });
}
async function selectFromLista(item){
  state.lastAction = { type:'lista', snapshot: JSON.parse(JSON.stringify({ history: state.history, usedTitles: state.usedTitles })) };
  state.usedTitles.push(item.title);
  state.history.unshift({title:item.title, era:item.era, band:item.band, emotional:item.emotional});
  saveState();
  await fadeToView('anime');
}
document.getElementById('undoLink').addEventListener('click', ()=>{
  if(!state.lastAction) return;
  Object.assign(state, state.lastAction.snapshot);
  state.lastAction = null;
  saveState();
  renderAnimeLanding();
});

function renderNuevasTemp(){
  const grid = document.getElementById('ntGrid');
  const avail = ntAvailableList();
  if(avail.length===0){
    grid.innerHTML = `<div style="grid-column:1/-1; text-align:center; color:var(--dim); padding:20px;">No hay temporadas nuevas listas por ahora.</div>`;
    return;
  }
  grid.innerHTML = avail.map(nt => `
    <button class="nt-card" data-title="${esc(nt.title)}">
      <div class="nt-poster">🎬</div>
      <div class="nt-card-body">
        <div class="nt-card-title">${esc(nt.title)}</div>
        <div class="nt-card-meta">${nt.eps?esc(nt.eps):'—'}</div>
      </div>
    </button>
  `).join('');
  grid.querySelectorAll('.nt-card').forEach(card=>{
    card.addEventListener('click', ()=>{
      const nt = NUEVAS_TEMP.find(x=>x.title===card.dataset.title);
      if(nt) selectNuevaTemp(nt);
    });
  });
}

async function selectNuevaTemp(nt){
  state.lastAction = { type:'nt', snapshot: JSON.parse(JSON.stringify({ history: state.history, seenNT: state.seenNT })) };
  state.seenNT.push(nt.title);
  state.history.unshift({title: nt.title, era:'Extra', band:'Nueva Temporada', emotional:false});
  saveState();
  await fadeToView('anime');
}

// ---------------- core draw logic ----------------
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
  let band = weightedBandPick(CLASICA_W);
  if(state.lastBand==='Elite' && band==='Elite'){
    const w2total = CLASICA_W.Normal+CLASICA_W.Ligera || 1;
    band = Math.random() < (CLASICA_W.Normal/w2total) ? 'Normal' : 'Ligera';
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
function snapshotForUndo(){
  return JSON.parse(JSON.stringify({
    deck: state.deck, usedTitles: state.usedTitles, history: state.history,
    emoCount: state.emoCount, lastEra: state.lastEra, lastEra2: state.lastEra2,
    lastBand: state.lastBand, lastEmo: state.lastEmo, owed: state.owed,
    blocking: state.blocking, cycleNum: state.cycleNum
  }));
}
function commitPick(pick){
  state.lastAction = { type:'ciclo', snapshot: snapshotForUndo() };
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

// ---------------- dice animation ----------------
const DICE_PATTERNS = {
  1:[4], 2:[0,8], 3:[0,4,8], 4:[0,2,6,8], 5:[0,2,4,6,8], 6:[0,2,3,5,6,8]
};
function buildDiceFace(){
  const face = document.getElementById('diceFace');
  face.innerHTML = '';
  for(let i=0;i<9;i++){
    const pip = document.createElement('div'); pip.className='dice-pip'; pip.dataset.i=i;
    face.appendChild(pip);
  }
}
function setDiceValue(n){
  const pips = document.querySelectorAll('.dice-pip');
  const on = new Set(DICE_PATTERNS[n]||[]);
  pips.forEach((p,i)=> p.style.opacity = on.has(i) ? '1' : '0');
}
async function rollDice(durationMs){
  buildDiceFace();
  const dice = document.getElementById('dice');
  const tickMs = 150;
  const ticks = Math.max(1, Math.floor(durationMs/tickMs));
  for(let i=0;i<ticks;i++){
    const rx = Math.floor(Math.random()*4)*90;
    const ry = Math.floor(Math.random()*4)*90;
    dice.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg)`;
    setDiceValue(1+Math.floor(Math.random()*6));
    await wait(tickMs);
  }
  dice.style.transform = 'rotateX(360deg) rotateY(360deg)';
  await wait(150);
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
  await wait(150);
  addTag(tags, ERA_LABELS[pick.token.era]||pick.token.era, 'era-'+pick.token.era);
  await wait(500);
  addTag(tags, pick.token.band, 'band-'+pick.token.band);
  await wait(500);
  if(pick.title.emotional){ addTag(tags, 'Emotional', 'emo'); await wait(300); }
  titleEl.textContent = pick.title.title;
  titleEl.classList.add('fade-in');
  metaEl.textContent = `★ ${pick.title.rating.toFixed(2)} · ${pick.title.eps} eps`;
  metaEl.classList.add('fade-in');
  platEl.innerHTML = platformChipsHtml(pick.title.plataforma);
  platEl.classList.add('fade-in');
}
async function revealPickExtra(item, cat){
  setupCardSkeleton();
  const tags = document.getElementById('rvTags');
  const titleEl = document.getElementById('rvTitle');
  const metaEl = document.getElementById('rvMeta');
  const platEl = document.getElementById('rvPlat');
  const label = cat==='adulto'?'Adulto':cat==='larga'?'Larga':'Repetición';
  await wait(150);
  addTag(tags, label, 'era-Extra');
  await wait(500);
  if(item.emotional){ addTag(tags, 'Emotional', 'emo'); await wait(300); }
  titleEl.textContent = item.title;
  titleEl.classList.add('fade-in');
  metaEl.textContent = `${item.eps} eps`;
  metaEl.classList.add('fade-in');
  platEl.innerHTML = platformChipsHtml(item.plataforma);
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
  const cardArea = document.getElementById('cardArea');
  cardArea.style.opacity = '0';
  const wrap = document.getElementById('diceWrap');
  wrap.style.display = 'flex';
  await rollDice(1900);
  wrap.style.display = 'none';
  cardArea.style.opacity = '1';

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
document.getElementById('confirmBtn').addEventListener('click', async ()=>{
  commitPick(state.pendingPick);
  document.getElementById('confirmRow').classList.add('hidden');
  const remaining = state.deck.filter(t=>!t.used).length;
  if(remaining===0){
    state.owed.adulto = true;
    state.owed.larga = true;
    if(state.cycleNum % REP_EVERY === 0) state.owed.repeticion = true;
    state.blocking = true;
    saveState();
  } else {
    saveState();
  }
  await fadeToView('anime');
});

async function startDrawExtra(cat, fromGate){
  disableAllActionButtons(true);
  state.extra = {category: cat, fromGate: !!fromGate};
  document.getElementById('gateBox').classList.add('hidden');
  document.getElementById('normalRow').classList.add('hidden');
  document.getElementById('confirmRow').classList.add('hidden');
  document.getElementById('confirmExtraRow').classList.add('hidden');
  document.getElementById('continueExtraRow').classList.add('hidden');
  const cardArea = document.getElementById('cardArea');
  cardArea.style.opacity = '0';
  const wrap = document.getElementById('diceWrap');
  wrap.style.display = 'flex';
  await rollDice(1900);
  wrap.style.display = 'none';
  cardArea.style.opacity = '1';

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
document.getElementById('confirmExtraBtn').addEventListener('click', async ()=>{
  const cat = state.extra.category;
  const fromGate = state.extra.fromGate;
  commitExtra(cat, state.extra.item);
  state.extra = null;
  document.getElementById('confirmExtraRow').classList.add('hidden');
  document.getElementById('continueExtraRow').classList.add('hidden');

  if(!fromGate){ saveState(); await fadeToView('anime'); return; }
  const stillOwed = state.owed.adulto || state.owed.larga || state.owed.repeticion;
  if(!(state.blocking && stillOwed)){
    state.blocking = false;
    startNewCycle();
  }
  saveState();
  await fadeToView('anime');
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

function render(){
  renderStats();
  renderPendingPills();
  renderGateOrNormal();
  renderMiniHist();
}
function renderStats(){
  document.getElementById('statPos').textContent = state.deck.filter(t=>t.used).length + '/' + state.deck.length;
  document.getElementById('statEmo').textContent = state.emoCount + '/3';
  document.getElementById('statCycleN').textContent = state.cycleNum;
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
