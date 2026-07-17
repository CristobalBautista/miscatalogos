/* ============================================================
   ui.js -- Todo lo que toca pantalla: navegacion entre vistas,
   renderizado de listas/tablas, animaciones (dado, fundidos),
   manejo de eventos de botones, y el arranque de la app.
   Depende de logic.js (debe cargarse despues en index.html) --
   usa sus funciones (drawNext, commitPick, loadCatalog, etc) y
   sus variables (state, MAIN_POOL, etc).
   ============================================================ */

// ============ FORMATO DE DATOS PARA MOSTRAR ============
// Convierte el texto crudo de la columna Plataforma en chips visuales
// con icono (usa detectPlatformKeys de logic.js).
function platformChipsHtml(plat){
  const keys = detectPlatformKeys(plat);
  if(keys.length===0) return `<span class="plat-chip"><span>📺 ${esc(plat||'Sin dato')}</span></span>`;
  return keys.map(k => `<span class="plat-chip">
      <img src="https://cdn.simpleicons.org/${PLATFORM_ICONS[k]}" alt="${k}" onerror="this.outerHTML='${PLATFORM_EMOJI[k]}'">
      <span>${k[0].toUpperCase()+k.slice(1)}</span>
    </span>`).join('');
}



// ============ ARRANQUE DE LA APP ============
// Esto es lo primero que corre (ver el final del archivo). Carga el
// catalogo, recupera el estado guardado (o crea uno nuevo la primera vez),
// aplica el tema y muestra la vista donde el usuario se quedo.
async function loadState(){
  await loadCatalog();
  try{
    const r = await window.storage.get('ruleta-anime-state-v6');
    if(r && r.value){
      state = JSON.parse(r.value);
      if(!state.seenNT) state.seenNT=[];
      if(!state.theme || !THEMES.includes(state.theme)) state.theme='dark-purple';
      if(state.devMode===undefined) state.devMode=false;
      if(!state.listaCols) state.listaCols=2;
    }
    else { state = seedInitialState(); await saveState(); }
  }catch(e){ state = seedInitialState(); }
  applyTheme(state.theme);
  document.getElementById('view-loading').classList.add('hidden');
  showView(state.view || 'home');
  render();
}



// ============ TEMA DE COLOR ============
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


// ============ NAVEGACION ENTRE VISTAS ============
// Solo hay 5 pantallas (home/anime/nt/ciclo/lista) y se muestran/ocultan
// con la clase .hidden -- no hay routing de verdad, es una sola pagina.
// fadeToView() hace un fundido antes de cambiar (se usa al confirmar una
// eleccion, para que se sienta como que "se guarda y vuelve").
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
// CARTOON (Cartoon Mañana): boton deshabilitado por ahora -- la data va a
// venir de una tabla/CSV separada de catalogo.csv, todavia no existe.
document.getElementById('goCartoon').addEventListener('click', ()=> toast('Próximamente'));
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
// Nota: el viejo boton "Cartoon" de ANIME (que en realidad disparaba el
// sorteo de Cartoon Adulto por error) se quito. Cartoon Adulto sigue
// accesible como siempre via el gate de fin de ciclo y el pill "¿Ahora si
// Adulta?" -- no se perdio ningun acceso, solo el atajo mal etiquetado.


// ============ CONFIGURACION (modal + Modo Desarrollador) ============
document.getElementById('openConfig').addEventListener('click', ()=>{
  document.getElementById('devModeToggle').checked = !!state.devMode;
  document.getElementById('configModal').classList.remove('hidden');
});
document.getElementById('closeConfig').addEventListener('click', ()=>{
  document.getElementById('configModal').classList.add('hidden');
});
// Cerrar tambien tocando el fondo oscuro (fuera de modal-box) -- solo si el
// click fue directo sobre el overlay, no sobre algo adentro de la caja.
document.getElementById('configModal').addEventListener('click', (e)=>{
  if(e.target.id === 'configModal') document.getElementById('configModal').classList.add('hidden');
});
document.getElementById('devModeToggle').addEventListener('change', (e)=>{
  state.devMode = e.target.checked;
  saveState();
  renderDevPanel();
});

function toast(msg){
  const t = document.createElement('div');
  t.textContent = msg;
  t.style.cssText = 'position:fixed;bottom:30px;left:50%;transform:translateX(-50%);background:var(--panel2);color:var(--text);padding:10px 18px;border-radius:100px;font-size:13px;border:1px solid var(--line);z-index:999;';
  document.body.appendChild(t);
  setTimeout(()=>t.remove(), 1500);
}


// ============ PANTALLA ANIME: historial + botones ============
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

// ============ VER LISTA COMPLETA ============
// Grilla de tarjetas (estilo MyAnimeList / Nuevas Temporadas) de todo
// MAIN_POOL no visto todavia. Tocar una tarjeta elige ese titulo directo
// (sin pasar por el mazo del ciclo -- por eso no consume una ficha, solo se
// marca como usado y se agrega al historial). El numero de columnas (2 o 3)
// se guarda en state.listaCols para que quede la preferencia.
function renderListaCompleta(){
  const grid = document.getElementById('listaGrid');
  document.getElementById('listaCols2Btn').classList.toggle('active', state.listaCols !== 3);
  document.getElementById('listaCols3Btn').classList.toggle('active', state.listaCols === 3);
  grid.classList.toggle('cols-3', state.listaCols === 3);

  const usedSet = new Set(state.usedTitles);
  const items = MAIN_POOL.filter(a=>!usedSet.has(a.title)).slice().sort((a,b)=> a.title.localeCompare(b.title));
  if(items.length===0){
    grid.innerHTML = '<div style="grid-column:1/-1; padding:20px; text-align:center; color:var(--dim);">Sin títulos pendientes.</div>';
    return;
  }
  grid.innerHTML = items.map(a => {
    // La columna Plataforma a veces trae comentarios pegados (ej. "(Stay
    // no)", "1 2 mas de 3") ademas del nombre de la plataforma -- no se
    // omiten, se muestran como nota chica debajo de los chips.
    const note = platformExtraNote(a.plataforma);
    return `
    <button class="lista-card" data-title="${esc(a.title)}">
      <div class="lista-poster">
        <span class="lista-era-badge" style="background:var(--${a.era.toLowerCase()})"></span>
        🎬
      </div>
      <div class="lista-card-body">
        <div class="lista-card-title">${esc(a.title)}</div>
        <div class="lista-card-meta">${a.eps} eps</div>
        <div class="lista-card-plat">${platformChipsHtml(a.plataforma)}</div>
        ${note ? `<span class="lista-card-note">${esc(note)}</span>` : ''}
      </div>
    </button>`;
  }).join('');
  grid.querySelectorAll('.lista-card').forEach(card=>{
    card.addEventListener('click', ()=>{
      const item = MAIN_POOL.find(a=>a.title===card.dataset.title);
      if(item) selectFromLista(item);
    });
  });
}
document.getElementById('listaCols2Btn').addEventListener('click', ()=>{
  state.listaCols = 2; saveState(); renderListaCompleta();
});
document.getElementById('listaCols3Btn').addEventListener('click', ()=>{
  state.listaCols = 3; saveState(); renderListaCompleta();
});
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


// ============ NUEVAS TEMPORADAS ============
// Tarjetas de las series con temporada nueva ya terminada. Igual que Lista
// Completa, elegir una no consume ficha del mazo -- es prioridad aparte.
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

// ---------------- core draw logic (ver logic.js) ----------------


// ============ ANIMACION DEL DADO ============
// Gira un dado 3D (rotaciones random en X/Y) durante ~1.9s antes de
// revelar el resultado real. Es puramente decorativo -- el resultado ya
// se calcula con drawNext()/drawExtra() de logic.js, el dado solo genera
// la pausa dramatica.
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


// ============ REVELADO DE LA TARJETA ============
// Muestra Era -> Tipo -> Nombre -> Plataforma en fundidos escalonados
// (no todo de golpe), para que se sienta como una revelacion.
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


// ============ FLUJO: SORTEO NORMAL DEL CICLO ============
// Boton "Elegir siguiente": gira el dado, calcula el pick con drawNext(),
// lo muestra, y deja los botones Confirmar/Buscar de nuevo listos.
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


// ============ FLUJO: SORTEO EXTRA (Adulto/Larga/Repetir) ============
// Mismo patron que el sorteo normal pero usando drawExtra() de logic.js.
// `fromGate` distingue si esto se disparo porque el ciclo se completo
// (ahi si puede reiniciar el ciclo al confirmar) o porque el usuario lo
// pidio voluntariamente via boton Cartoon o un pill pendiente (ahi NO
// toca el ciclo para nada).
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


// ============ PILLS DE OBLIGACIONES PENDIENTES ============
// Si el usuario eligio "Mejor continuar ciclo" en vez de resolver Adulto/
// Larga/Repetir cuando tocaba, queda pendiente y aparece como boton
// flotante hasta que se resuelva.
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


// ============ MODO DESARROLLADOR: cuadritos de cupos del ciclo ============
// Dibuja 2 bloques usando el mazo real (state.deck), asi que si algun dia
// cambia RECIPE en logic.js esto se actualiza solo, sin tocar nada aca:
// 1) Cupos por Era (10 Dorada / 6 Moderna / 2 Clasica), coloreado con el
//    color de cada era, se apaga el cuadrito cuando esa ficha ya se uso.
// 2) Cupos por Tipo (Elite/Normal/Ligera) dentro de Dorada y Moderna segun
//    RECIPE (4-4-2 y 2-3-1). Clasica no tiene tipo fijo (se sortea al usarse),
//    por eso sus 2 cuadritos van en un color neutro, sin sesgar a ningun tipo.
function renderDevPanel(){
  const panel = document.getElementById('devPanel');
  if(!state.devMode){ panel.classList.add('hidden'); return; }
  panel.classList.remove('hidden');
  const block = document.getElementById('devEraBlock');

  function tokensFor(era, band){
    return state.deck.filter(t => t.era===era && (band===null ? t.band===null : t.band===band));
  }
  function sqHtml(tokens, colorVar){
    return tokens.map(t => `<div class="dev-sq${t.used?' off':''}" style="background:var(${colorVar})"></div>`).join('');
  }

  let html = '<div class="dev-panel-title" style="margin-bottom:8px;">Por Era</div>';
  html += ERA_ORDER.map(era => {
    const tokens = state.deck.filter(t => t.era===era);
    return `<div class="dev-era-row"><div class="dev-era-label">${ERA_LABELS[era]||era}</div>
      <div class="dev-sq-group">${sqHtml(tokens, '--'+era.toLowerCase())}</div></div>`;
  }).join('');

  html += '<div class="dev-panel-title" style="margin:16px 0 8px;">Por Tipo (Elite / Normal / Ligera)</div>';
  html += ['Dorada','Moderna'].map(era => {
    const groups = BAND_ORDER.map(band => {
      const colorVar = band==='Elite' ? '--band-elite' : band==='Normal' ? '--band-normal' : '--band-ligera';
      return sqHtml(tokensFor(era, band), colorVar);
    }).join('<span style="width:6px;display:inline-block;"></span>');
    return `<div class="dev-era-row"><div class="dev-era-label">${ERA_LABELS[era]||era}</div>
      <div class="dev-sq-group">${groups}</div></div>`;
  }).join('');
  // Clasica: sin sub-reparto fijo -- 2 cuadritos neutros, sin sesgo de tipo.
  html += `<div class="dev-era-row"><div class="dev-era-label">${ERA_LABELS['Clasica']}</div>
    <div class="dev-sq-group">${sqHtml(tokensFor('Clasica', null), '--dim')}</div></div>`;

  html += `<div class="dev-band-legend">
    <div class="dev-legend-item"><span class="dev-legend-dot" style="background:var(--band-elite)"></span>Elite</div>
    <div class="dev-legend-item"><span class="dev-legend-dot" style="background:var(--band-normal)"></span>Normal</div>
    <div class="dev-legend-item"><span class="dev-legend-dot" style="background:var(--band-ligera)"></span>Ligera</div>
  </div>`;

  block.innerHTML = html;
}

// ============ RENDER GENERAL DE LA VISTA CICLO ============
function render(){
  renderStats();
  renderPendingPills();
  renderGateOrNormal();
  renderMiniHist();
  renderDevPanel();
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
