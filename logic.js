/* ============================================================
   logic.js -- El "motor" de la app: datos y algoritmo de sorteo.
   No toca el DOM en ningun momento (nada de document.*, nada de
   innerHTML). Todo lo que hay aca se puede probar con Node solo,
   sin navegador -- de hecho asi se valido antes de entregarlo
   (ver /docs o el README para el detalle de la simulacion).
   ============================================================ */

const BAND_ORDER = ['Elite','Normal','Ligera'];
const ERA_ORDER = ['Dorada','Moderna','Clasica'];
const ERA_LABELS = { Dorada:'Era Dorada', Moderna:'Era Moderna', Clasica:'Era Clásica' };
const REP_EVERY = 3;
const THEMES = ['dark-purple','light'];
const THEME_SWATCH = { 'dark-purple':'#b98ee8', 'light':'#5b4fd1' };

let MAIN_POOL = [], LARGA_POOL = [], ADULTO_POOL = [], REP_POOL = [], NUEVAS_TEMP = [];

// ── Reparto fijo del ciclo (NO se recalcula desde el CSV) ──────────────────
// Estos numeros vienen del analisis original del catalogo completo y quedan
// fijos a proposito: si se recalculan en vivo cada vez que el CSV cambia
// (por ejemplo al filtrar "Pendiente Nueva Temporada"), los redondeos se
// mueven y Dorada puede terminar con 3 Ligera en vez de 2 -- eso ya paso y
// fue un bug confuso. Fijar los numeros evita esa sorpresa.
const RECIPE = {
  Dorada:  { Elite:4, Normal:4, Ligera:2 },  // 10 slots
  Moderna: { Elite:2, Normal:3, Ligera:1 },  // 6 slots
};
// Clasica NO tiene sub-reparto fijo: en vez de pre-cargar 2 casillas con
// banda ya decidida, cada vez que le toca el turno a Clasica se hace un
// sorteo ponderado usando estas proporciones reales (42% Elite / 40% Normal
// / 18% Ligera). Asi nunca queda una banda estructuralmente excluida solo
// porque 2 slots no alcanzan para redondear un porcentaje chico a 1 entero.
//
// OJO -- el proposito real de toda esta rotacion (Elite/Normal/Ligera y las
// reglas de abajo) NO es que las matematicas salgan exactas al decimal. Es
// simplemente: no repetir mucho de lo mismo, y tener "Ligera" disponible
// para descansar de carga emocional o series pesadas. Por eso, aunque en la
// practica el sorteo de Clasica termine dando un poco mas de Normal/Ligera
// que el 42/40/18 exacto (por la regla de "nunca Elite tras Elite" de mas
// abajo, que le hace esquivar Elite seguido), NO hace falta perseguir el
// numero exacto -- cumple el proposito igual. Si el dia de mañana cambia la
// logica general del ciclo, este es un buen lugar para revisar primero.
const CLASICA_W = { Elite:0.4222, Normal:0.40, Ligera:0.1778 };

const PLATFORM_ICONS = { netflix:'netflix', crunchyroll:'crunchyroll', prime:'primevideo', disney:'disneyplus', max:'max' };
const PLATFORM_EMOJI = { netflix:'🔴', crunchyroll:'🟠', prime:'🔵', disney:'⭐', max:'🟣' };

// El estado completo de la app (mazo actual, historial, tema, etc). Se
// inicializa en seedInitialState() y se persiste con window.storage.
let state = null;

// Escapa texto para insertarlo seguro dentro de innerHTML (evita XSS/roturas de HTML).
function esc(s){ return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

// Promesa que se resuelve despues de `ms` milisegundos. Se usa para las animaciones
// escalonadas (revelar Era, luego Tipo, luego Nombre, etc) con async/await en vez
// de anidar setTimeout.
function wait(ms){ return new Promise(r=>setTimeout(r,ms)); }

// Una plataforma cuenta como "disponible" solo si NO tiene la palabra "X" suelta
// (significa que no esta en ningun servicio) y NO menciona "Descargar" (significa
// que falta parte del contenido en streaming). Se aplica a las 6 categorias del CSV.
function isAvailable(plat){
  if(!plat) return false;
  if(/\bX\b/.test(plat)) return false;
  if(/Descargar/i.test(plat)) return false;
  return true;
}

// Busca cuales de las plataformas conocidas (Netflix, Crunchyroll, Prime, Disney,
// Max) aparecen mencionadas en el texto de la columna Plataforma. Puede devolver
// mas de una si el titulo esta en varios servicios a la vez.
function detectPlatformKeys(plat){
  const p = (plat||'').toLowerCase();
  return Object.keys(PLATFORM_ICONS).filter(k => p.includes(k));
}

// La columna Plataforma a veces trae comentarios pegados ademas del nombre
// de la plataforma (ej. "Crunchyroll (Stay no)", "Netflix 1 2 Crunchyroll
// mas de 3"). Esta funcion quita los nombres de plataforma conocidos y
// devuelve lo que sobra (limpio de parentesis/espacios extra), para no
// perder esa aclaracion al mostrar la tarjeta.
function platformExtraNote(plat){
  if(!plat) return '';
  let txt = plat;
  Object.keys(PLATFORM_ICONS).forEach(k => { txt = txt.replace(new RegExp(k, 'gi'), ''); });
  txt = txt.replace(/[()]/g, ' ').replace(/\s+/g, ' ').trim();
  return txt;
}

// Descarga un CSV y lo convierte a un array de objetos {columna: valor} usando
// PapaParse. cache:'no-store' evita que el navegador sirva una copia vieja del
// archivo despues de que edites el CSV en Excel y lo vuelvas a subir.
async function fetchCsv(path){
  const res = await fetch(path, {cache:'no-store'});
  const text = await res.text();
  return Papa.parse(text, {header:true, skipEmptyLines:true}).data;
}

// Punto de entrada de los datos: lee catalogo.csv y nuevas_temporadas.csv, aplica
// los 2 filtros del sorteo (Pendiente Nueva Temporada = X, y disponibilidad de
// plataforma) y separa todo en los 4 pools que usa el resto de la app
// (MAIN_POOL = Dorada+Moderna+Clasica, LARGA_POOL, ADULTO_POOL, REP_POOL).
// Se llama una vez al abrir la app (ver loadState en ui.js).
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
    if(pend === 'X') continue; // temporada nueva en curso/pendiente -> prioridad aparte, no entra al sorteo
    const plat = (r.Plataforma||'').trim();
    if(!isAvailable(plat)) continue; // sin plataforma real (X o requiere Descargar) -> fuera del sorteo
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
}

// Arma la "bolsa" de 18 fichas de un ciclo nuevo: 10 Dorada + 6 Moderna con banda
// YA FIJA segun RECIPE, mas 2 Clasica con banda en null (se decide al momento de
// usarla, ver resolveBand). Se llama al arrancar la app y cada vez que se cierra
// un ciclo completo.
function freshDeck(){
  const deck = [];
  for(const era of ['Dorada','Moderna']){
    for(const band of BAND_ORDER){
      const n = RECIPE[era][band];
      for(let i=0;i<n;i++) deck.push({era, band, used:false});
    }
  }
  for(let i=0;i<2;i++) deck.push({era:'Clasica', band:null, used:false});
  return deck;
}

// Sorteo ponderado simple: recibe pesos {Elite,Normal,Ligera} que suman 1 y
// devuelve una banda al azar respetando esas proporciones. Se usa solo para
// Clasica (Dorada/Moderna ya traen banda fija de freshDeck).
function weightedBandPick(w){
  const r = Math.random();
  if(r < w.Elite) return 'Elite';
  if(r < w.Elite+w.Normal) return 'Normal';
  return 'Ligera';
}

// Estado inicial la primera vez que se abre la app en un dispositivo nuevo: ya
// viene con las primeras 6 elecciones del orden original marcadas como hechas
// (Assassination Classroom...Kakegurui), para no perder el progreso real que ya
// existia antes de que existiera esta app.
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
    view: 'home',
    devMode: false,
    listaCols: 2
  };
}

// Persiste el objeto `state` completo en window.storage (namespace personal del
// usuario, no compartido). Se llama despues de cualquier cambio de estado.
async function saveState(){
  try{ await window.storage.set('ruleta-anime-state-v6', JSON.stringify(state)); }catch(e){ console.error(e); }
}

function candidateTokens(){
  let pool = state.deck.filter(t=>!t.used);
  if(state.lastBand === 'Elite'){
    const noElite = pool.filter(t => t.band !== 'Elite'); // Clasica (band:null) sigue disponible, se resuelve evitando Elite en resolveBand()
    if(noElite.length>0) pool = noElite;
  }
  return pool;
}

// Devuelve la banda (Elite/Normal/Ligera) de una ficha. Si la ficha ya trae banda
// fija (Dorada/Moderna), la devuelve tal cual. Si es Clasica (band=null), hace el
// sorteo ponderado con CLASICA_W, y si el resultado es Elite justo despues de otro
// Elite, vuelve a tirar (solo entre Normal/Ligera) para no romper la regla.
function resolveBand(token){
  if(token.band) return token.band;
  let band = weightedBandPick(CLASICA_W);
  if(state.lastBand==='Elite' && band==='Elite'){
    const w2total = CLASICA_W.Normal+CLASICA_W.Ligera || 1;
    band = Math.random() < (CLASICA_W.Normal/w2total) ? 'Normal' : 'Ligera';
  }
  return band;
}

// Dado un token ya resuelto (era+banda), elige el titulo concreto:
// 1) intenta cumplir la decision de "emotional si/no" (ver mas abajo)
// 2) si no hay candidatos con ese filtro exacto, relaja emotional
// 3) si no hay nada en esa banda, relaja banda (cualquiera de la era)
// 4) si no hay nada en la era, relaja a cualquier titulo no visto
// El "quiero emotional" se decide aca mismo: maximo 3 por ciclo (emoCount) y
// nunca 2 seguidos (lastEmo), con ~20% de probabilidad cuando esta permitido.
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

// Empaqueta el resultado final de un sorteo: {token, title} listo para mostrar
// en pantalla y, si se confirma, para pasar a commitPick().
function finishDraw(token, band){
  const title = pickTitleFor(token, band);
  if(!title) return null;
  return {token: {era:token.era, band}, title};
}

// Sortea la proxima ficha del ciclo normal: elige un token al azar entre los
// candidatos validos, le resuelve la banda, y le busca titulo. `excludeEraBand`
// se usa solo para "Buscar de nuevo": evita repetir la misma era que se acaba
// de mostrar (para que el reroll de verdad se sienta distinto).
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

// Copia profunda de todos los campos que "Deshacer" necesita restaurar. Se toma
// justo ANTES de aplicar un cambio (commitPick), no despues.
function snapshotForUndo(){
  return JSON.parse(JSON.stringify({
    deck: state.deck, usedTitles: state.usedTitles, history: state.history,
    emoCount: state.emoCount, lastEra: state.lastEra, lastEra2: state.lastEra2,
    lastBand: state.lastBand, lastEmo: state.lastEmo, owed: state.owed,
    blocking: state.blocking, cycleNum: state.cycleNum
  }));
}

// Confirma un pick del ciclo normal: marca la ficha del mazo como usada, agrega
// el titulo a usedTitles (para que no vuelva a salir sorteado) y al historial,
// y actualiza los "ultimos" (lastEra/lastBand/lastEmo) que usan las reglas.
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

// Arranca un ciclo nuevo: mazo fresco de 18 fichas, contador de Emotional en 0,
// y limpia los "ultimos" para que las reglas no arrastren nada del ciclo anterior.
function startNewCycle(){
  state.deck = freshDeck(); state.emoCount = 0; state.cycleNum += 1;
  state.lastEra = null; state.lastEra2 = null; state.lastBand = null; state.lastEmo = false;
}

// Devuelve el pool de datos (array de titulos) segun la categoria extra pedida.
function poolFor(cat){ return cat==='adulto'?ADULTO_POOL : cat==='larga'?LARGA_POOL : REP_POOL; }

// Devuelve el array de "ya usados" correspondiente a esa categoria extra (cada
// una tiene su propio historial de repeticion, independiente del ciclo normal).
function usedArrFor(cat){ return cat==='adulto'?state.adultoUsed : cat==='larga'?state.largaUsed : state.repUsed; }

// Sortea un titulo al azar de una categoria extra (Adulto/Larga/Repetir), sin
// pesos ni reglas -- estas categorias son mucho mas chicas, no necesitan la
// misma logica de reparto. Si ya se usaron todos, la lista se reinicia sola.
function drawExtra(cat){
  const usedArr = usedArrFor(cat);
  const usedSet = new Set(usedArr);
  let avail = poolFor(cat).filter(a=>!usedSet.has(a.title));
  if(avail.length===0){ avail = poolFor(cat); usedArr.length = 0; }
  if(avail.length===0) return null;
  return avail[Math.floor(Math.random()*avail.length)];
}

// Confirma un pick de categoria extra: lo marca usado dentro de esa categoria,
// lo agrega al historial general, y limpia la obligacion pendiente (owed).
function commitExtra(cat, item){
  usedArrFor(cat).push(item.title);
  const label = cat==='adulto'?'Adulto':cat==='larga'?'Larga':'Repetición';
  state.history.unshift({title:item.title, era:'Extra', band:label, emotional: !!item.emotional});
  state.owed[cat] = false;
}
