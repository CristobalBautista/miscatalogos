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
      if(!state.animStyle) state.animStyle='cards';
      // Migracion: el mazo paso de 18 fijo a 24 con cupos reales, y se sumo
      // la bolsa caliente de Clasica + contadores de racha (antes solo
      // existia para Elite). Si el estado guardado es de antes de esto, se
      // arma un mazo nuevo -- sin perder historial ni usedTitles, solo se
      // reinicia la "bolsa en curso", como si arrancara un mazo nuevo.
      if(!state.clasicaBag || state.lastBandStreak===undefined){
        state.deck = freshDeck();
        state.clasicaBag = freshClasicaBag();
        state.lastBandStreak = 0;
        state.lastEraStreak = 0;
        state.emoCooldown = 0;
        delete state.lastEra2;
        delete state.lastEmo;
      }
      if(!state.filters) state.filters = { era:null, calidad:null, generos:[] };
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
  if(name==='ciclo'){
    document.getElementById('animStyleSelect').value = state.animStyle || 'cards';
    render();
  }
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
// Quita el prefijo "Era " de ERA_LABELS solo para esta tabla -- la columna
// ya se llama "Era", repetirlo en cada fila es redundante (ej. "Dorada" en
// vez de "Era Dorada"). El resto de la app (tag de revelado, panel dev)
// sigue usando ERA_LABELS completo tal cual, sin tocar.
function eraShortLabel(era){
  return (ERA_LABELS[era]||era).replace(/^Era\s+/i, '');
}
function renderHistoryTable(){
  const body = document.getElementById('histBody');
  if(state.history.length===0){
    body.innerHTML = `<tr><td colspan="5" style="color:var(--dim); text-align:center; padding:18px 6px;">Nada elegido aún</td></tr>`;
    return;
  }
  body.innerHTML = state.history.map((h,i) => `
    <tr class="${i===0?'latest':''}">
      <td class="col-img"><div class="hist-thumb">🎬</div></td>
      <td class="name-cell">${esc(h.title)}</td>
      <td><span class="era-cell"><span class="dot ${h.era}"></span>${esc(eraShortLabel(h.era))}</span></td>
      <td>${esc(h.band||'')}</td>
      <td class="col-emo">${h.emotional ? '<span style="color:var(--emo);">♥</span>' : ''}</td>
    </tr>
  `).join('');
}
function renderMiniHist(){
  const el = document.getElementById('miniHist');
  if(!el) return;
  if(state.history.length===0){ el.innerHTML = '<div style="color:var(--dim); font-size:12.5px;">Nada elegido aún</div>'; return; }
  el.innerHTML = state.history.slice(0,10).map((h,i)=>`
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
// ---------------- animacion de revelado (3 estilos, elegibles por dropdown) ----------------
// Reemplaza el dado 3D viejo (no gustaba visualmente). Los 3 estilos comparten
// el mismo contrato: playRevealAnimation() muestra #diceWrap, anima, y lo
// vuelve a ocultar -- exactamente como antes hacia rollDice(), asi que los 2
// call sites (startDrawNormal / startDrawExtra) no necesitan tocarse mas que
// el nombre de la funcion.
function buildRevealHTML(style){
  if(style === 'wheel'){
    // Segmentos proporcionales a las 3 eras reales del catalogo (Dorada ~52%,
    // Moderna ~30%, Clasica ~11%) -- puramente decorativo, el resultado real
    // ya esta decidido antes de que la rueda gire.
    return `<div class="anim-wheel-wrap">
      <div class="anim-wheel-pointer"></div>
      <div class="anim-wheel" id="animWheel" style="background:conic-gradient(var(--dorada) 0% 52%, var(--moderna) 52% 82%, var(--clasica) 82% 100%); transform:rotate(0deg);"></div>
      <div class="anim-wheel-hub"></div>
    </div>`;
  }
  if(style === 'slots'){
    const icons = ['🎬','⭐','🎴','🎬','⭐','🎴','🎬','⭐'];
    return `<div class="anim-slot"><div class="anim-slot-strip" id="animSlotStrip" style="transform:translateY(0px);">
      ${icons.map(i=>`<div class="anim-slot-cell">${i}</div>`).join('')}
    </div></div>`;
  }
  // 'cards' (default)
  return `<div class="anim-cards">
    <div class="anim-card c1"></div>
    <div class="anim-card c2"></div>
    <div class="anim-card c3"></div>
  </div>`;
}
async function playRevealAnimation(){
  const wrap = document.getElementById('diceWrap');
  const style = state.animStyle || 'cards';
  wrap.innerHTML = buildRevealHTML(style) + '<div class="reveal-label">Girando…</div>';
  wrap.style.display = 'flex';
  // pequeña espera para que el navegador registre el estado inicial (0deg /
  // 0px) antes de animar -- si no, a veces la transicion no dispara.
  await wait(30);
  if(style === 'wheel'){
    const wheel = document.getElementById('animWheel');
    const spins = 4 + Math.floor(Math.random()*3); // 4 a 6 vueltas completas
    const finalDeg = spins*360 + Math.floor(Math.random()*360);
    wheel.style.transform = `rotate(${finalDeg}deg)`;
    await wait(2500); // que decelere y se note -- "que no se quite tan rapido"
  } else if(style === 'slots'){
    const strip = document.getElementById('animSlotStrip');
    strip.style.transition = 'transform 1.8s cubic-bezier(.15,.85,.32,1)';
    strip.style.transform = `translateY(-630px)`; // 7 celdas de 90px, aterriza en la 8va
    await wait(1900);
  } else {
    await wait(1900);
    document.querySelectorAll('.anim-card').forEach(c=> c.style.animation='none');
  }
  await wait(300); // pausa visible antes de desaparecer, mismo motivo que arriba
  wrap.style.display = 'none';
}
document.getElementById('animStyleSelect').addEventListener('change', (e)=>{
  state.animStyle = e.target.value;
  saveState();
});


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
  await playRevealAnimation();
  cardArea.style.opacity = '1';

  let result = drawNext();
  if(!result){
    const filtros = state.filters || {};
    const hayFiltro = filtros.era || filtros.calidad;
    // candidateTokens() ya intento el fallback fuera de mazo (busca en todo
    // el catalogo disponible, no solo en las 24 fichas del mazo actual) --
    // si igual llego vacio aca, es un "sin resultados" real, no solo que el
    // mazo puntual no tenga esa combinacion.
    toast(hayFiltro ? '😕 Sin resultados para esos filtros' : 'Sin candidatos, revisa el mazo');
    // Limpiar la tarjeta: si quedaba un pick anterior visible (ej. veniamos
    // de "Buscar de nuevo" con un filtro recien activado), no debe quedar
    // pegado en pantalla dando a entender que sigue siendo el resultado.
    document.getElementById('cardArea').innerHTML = '<div class="card-empty">Sin resultados para esos filtros</div>';
    document.getElementById('confirmRow').classList.add('hidden');
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
  await playRevealAnimation();
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


// ============ MODO DESARROLLADOR: cuadritos de cupos del mazo ============
// Dibuja usando el mazo real (state.deck) y la bolsa caliente de Clasica
// (state.clasicaBag), asi que si cambia el catalogo esto se actualiza solo,
// sin tocar nada aca:
// 1) Cupos por Era (proporcional real sobre MAZO_SIZE=24), coloreado con el
//    color de cada era, se apaga el cuadrito cuando esa ficha ya se uso.
// 2) Cupos por Tipo (Elite/Normal/Ligera) dentro de Dorada y Moderna, tambien
//    proporcional real. Clasica no tiene tipo fijo POR MAZO (se resuelve al
//    usarse, desde su bolsa caliente aparte), por eso sus cuadritos de este
//    bloque van en un color neutro.
// 3) Bolsa caliente de Clasica: cuantos Elite/Normal/Ligera reales quedan sin
//    usar en la bolsa completa (dura muchos mazos, se ve aparte del mazo actual).
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

  let html = `<div class="dev-panel-title" style="margin-bottom:8px;">Por Era (mazo de ${state.deck.length})</div>`;
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
  // Clasica dentro del mazo actual: sin sub-reparto fijo -- cuadritos neutros.
  html += `<div class="dev-era-row"><div class="dev-era-label">${ERA_LABELS['Clasica']}</div>
    <div class="dev-sq-group">${sqHtml(tokensFor('Clasica', null), '--dim')}</div></div>`;

  html += `<div class="dev-band-legend">
    <div class="dev-legend-item"><span class="dev-legend-dot" style="background:var(--band-elite)"></span>Elite</div>
    <div class="dev-legend-item"><span class="dev-legend-dot" style="background:var(--band-normal)"></span>Normal</div>
    <div class="dev-legend-item"><span class="dev-legend-dot" style="background:var(--band-ligera)"></span>Ligera</div>
  </div>`;

  // Bolsa caliente de Clasica: independiente del mazo, dura muchos mazos.
  const bag = state.clasicaBag || [];
  const bagLeft = band => bag.filter(t=>t.band===band && !t.used).length;
  const bagTotal = band => bag.filter(t=>t.band===band).length;
  html += `<div class="dev-panel-title" style="margin:16px 0 8px;">Bolsa caliente Clásica (independiente del mazo)</div>
    <div class="dev-era-row"><div class="dev-era-label" style="width:auto;">Elite ${bagLeft('Elite')}/${bagTotal('Elite')} · Normal ${bagLeft('Normal')}/${bagTotal('Normal')} · Ligera ${bagLeft('Ligera')}/${bagTotal('Ligera')}</div></div>`;

  block.innerHTML = html;
}

// ============ FILTRO "QUIERO VER" (conectado al sorteo de verdad) ============
// Forma botones (la que eligio la esposa), con Dorada ya sumada a Era. Por
// ahora el panel entero sigue detras de Modo Desarrollador -- la logica ya
// esta conectada (candidateTokens/resolveBand en logic.js leen state.filters
// de verdad), pero la exposicion a la esposa se habilita en otro paso.
// Era/Calidad son excluyentes dentro de su grupo (elegis 1 o ninguna).
// Genero queda como pills que se marcan pero no filtran nada (sin data
// todavia). Elegir Era o Calidad ignora a proposito la regla de racha para
// esa tirada puntual -- es pedir algo especifico, no el sorteo libre.
function renderFilterPanel(){
  const panel = document.getElementById('filterPanel');
  panel.classList.toggle('hidden', !state.devMode);
  const filters = state.filters || {};
  document.querySelectorAll('.fp-pill[data-group="era"]').forEach(p=>{
    p.classList.toggle('active', filters.era === p.dataset.value);
  });
  document.querySelectorAll('.fp-pill[data-group="calidad"]').forEach(p=>{
    p.classList.toggle('active', filters.calidad === p.dataset.value);
  });
  document.querySelectorAll('.fp-pill[data-group="genero"]').forEach(p=>{
    p.classList.toggle('active', (filters.generos||[]).includes(p.dataset.value));
  });
}
document.querySelectorAll('.fp-pill').forEach(pill=>{
  pill.addEventListener('click', ()=>{
    const group = pill.dataset.group;
    const val = pill.dataset.value;
    if(!state.filters) state.filters = { era:null, calidad:null, generos:[] };
    if(group === 'genero'){
      // multi-select stub: se marca visualmente, sin efecto en el sorteo
      // todavia (no hay columna de Genero en el CSV).
      const idx = state.filters.generos.indexOf(val);
      if(idx>=0) state.filters.generos.splice(idx,1); else state.filters.generos.push(val);
    } else {
      // era/calidad: excluyente -- tocar la misma que ya estaba activa la apaga.
      state.filters[group] = (state.filters[group] === val) ? null : val;
    }
    saveState();
    renderFilterPanel();
  });
});
document.getElementById('qvToggle').addEventListener('click', ()=>{
  const drawer = document.getElementById('qvDrawer');
  const isHidden = drawer.classList.contains('hidden');
  drawer.classList.toggle('hidden');
  document.getElementById('qvToggle').textContent = isHidden ? 'QUIERO VER ▾' : 'QUIERO VER ▸';
});

// ============ RENDER GENERAL DE LA VISTA CICLO ============
function render(){
  renderStats();
  renderPendingPills();
  renderGateOrNormal();
  renderMiniHist();
  renderDevPanel();
  renderFilterPanel();
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
