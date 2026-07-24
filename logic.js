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
// TODOS los titulos de Dorada/Moderna/Clasica del CSV, SIN filtrar por
// disponibilidad ni PendienteTemporada -- se usa solo para calcular las
// proporciones del mazo (que tan grande es cada Era/Tipo en el catalogo real
// completo). MAIN_POOL sigue siendo el pool disponible AHORA, para elegir un
// titulo concreto -- son 2 cosas distintas a proposito: la composicion del
// mazo no debe moverse solo porque bajaste o viste algo (eso cambia
// disponibilidad, no el catalogo real).
let FULL_ERA_POOL = [];

// ── Tamaño del mazo: FIJO en 24, desacoplado de Largas ─────────────────────
// Antes se penso en derivarlo de total/Largas, pero eso hacia que el tamaño
// saltara de 19 a 31 solo con agregar o ver algunas Largas -- y ya probamos
// (simulacion) que el tamaño le importa mucho al comportamiento (18 mal, 24
// bien, de ahi para arriba empeora otra vez). Por eso queda fijo, se cambia
// a mano si algun dia se decide explicitamente.
const MAZO_SIZE = 24;

// ── Reparto por resto mayor: proporcional a los datos REALES del CSV, no a
// numeros fijos a mano. Reemplaza al viejo RECIPE hardcodeado. ─────────────
// Ejemplo: si hay que repartir 24 slots entre Dorada/Moderna/Clasica segun
// sus proporciones reales, esto reparte los enteros de piso y le da los
// "sobrantes" (el resto) a quien tenga la fraccion mas alta -- asi ningun
// slot se pierde por redondeo y nadie queda sesgado.
function largestRemainder(counts, totalSlots){
  const grand = Object.values(counts).reduce((a,b)=>a+b, 0);
  const floors = {}; Object.keys(counts).forEach(k=> floors[k]=0);
  if(grand===0 || totalSlots===0) return floors;
  const raw = {}; Object.keys(counts).forEach(k=> raw[k] = (counts[k]/grand)*totalSlots);
  Object.keys(raw).forEach(k=> floors[k]=Math.floor(raw[k]));
  let rem = totalSlots - Object.values(floors).reduce((a,b)=>a+b, 0);
  const order = Object.keys(raw).sort((a,b)=> (raw[b]-floors[b]) - (raw[a]-floors[a]));
  for(let i=0;i<rem;i++){ floors[order[i%order.length]]++; }
  return floors;
}

// Cuenta cuantos titulos disponibles hay por Era, y por Banda dentro de cada
// Era -- leido en vivo de MAIN_POOL (ya cargado del CSV). Esto reemplaza los
// porcentajes fijos de antes: si agregas o quitas series del catalogo, la
// proxima vez que se arme un mazo esto ya refleja el cambio solo.
function computeCatalogStats(){
  const eraCounts = {Dorada:0, Moderna:0, Clasica:0};
  const bandCountsByEra = {
    Dorada:{Elite:0,Normal:0,Ligera:0},
    Moderna:{Elite:0,Normal:0,Ligera:0},
    Clasica:{Elite:0,Normal:0,Ligera:0},
  };
  FULL_ERA_POOL.forEach(a=>{
    if(eraCounts[a.era]===undefined) return;
    eraCounts[a.era]++;
    bandCountsByEra[a.era][a.band]++;
  });
  return {eraCounts, bandCountsByEra};
}

// Arma la cuota de UN mazo de MAZO_SIZE: primero reparte los slots totales
// entre las 3 Eras (proporcional real), y dentro de Dorada/Moderna reparte
// esos slots entre Elite/Normal/Ligera (tambien proporcional real, mismo
// metodo que ya usaba el RECIPE original pero con numeros vivos). Clasica
// NO se subdivide aca -- tiene tan pocos slots por mazo que un cupo fijo por
// tipo la sesgaria (podria tocarle 0 a alguna banda). Su tipo real se decide
// aparte, en la bolsa caliente (ver freshClasicaBag).
function buildMazoQuota(){
  const {eraCounts, bandCountsByEra} = computeCatalogStats();
  const eraQuota = largestRemainder(eraCounts, MAZO_SIZE);
  const quota = { Clasica: eraQuota.Clasica || 0 };
  for(const era of ['Dorada','Moderna']){
    quota[era] = largestRemainder(bandCountsByEra[era], eraQuota[era] || 0);
  }
  return quota;
}

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
// URL del catalogo publicado desde Google Sheets (Archivo > Compartir >
// Publicar en la web > CSV). nuevas_temporadas.csv sigue local por ahora,
// todavia no migro a Sheets -- se hace aparte cuando toque.
const CATALOGO_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQMKcfeHBpai6WyQKvI33TLIt5bU9dgVpAh0l-H6P8ZBdpXdlCfRnP--dxkpLbpA5mLwX8MHfjNrSoT/pub?gid=353737606&single=true&output=csv';

async function loadCatalog(){
  const [catalogo, nt] = await Promise.all([ fetchCsv(CATALOGO_URL), fetchCsv('nuevas_temporadas.csv') ]);

  NUEVAS_TEMP = nt.map(r => ({
    title: r.Nombre, eps: r.Eps||'',
    finished: !!(r.FechaFinalizacion && r.FechaFinalizacion.trim() && r.FechaFinalizacion.trim()!=='N/A')
  })).filter(r=>r.title);

  // Categorias validas: el CSV/Sheet ya trae el valor final directo, no hay
  // traduccion -- si "Categoria" dice "Moderna", la era ES "Moderna". Este
  // set solo sirve para VALIDAR y avisar si aparece algo inesperado (ej. un
  // typo nuevo en el Sheet), en vez de descartar la fila en silencio como
  // pasaba antes con el diccionario viejo.
  const ERA_SET = new Set(['Dorada','Moderna','Clasica']);
  const OTHER_CATS = new Set(['Adulto','Larga','Repetir']);
  const main = [], largas = [], rep = [], adulto = [], fullEra = [];
  const catsDesconocidas = new Set();

  for(const r of catalogo){
    if(!r.Nombre) continue;
    const cat = (r.Categoria||'').trim();

    if(!ERA_SET.has(cat) && !OTHER_CATS.has(cat)){
      catsDesconocidas.add(cat);
      continue;
    }

    // FULL_ERA_POOL: cuenta SIEMPRE, sin importar disponibilidad ni
    // temporada pendiente -- es el universo real para calcular proporciones.
    if(ERA_SET.has(cat)){
      const ratingFull = parseFloat(r.Calificacion) || 0;
      const bandFull = ratingFull>8.0 ? 'Elite' : (ratingFull>=7.5 ? 'Normal' : 'Ligera');
      fullEra.push({ era:cat, band:bandFull });
    }

    const pend = (r.PendienteTemporada||'').trim();
    if(pend === 'X') continue; // temporada nueva en curso/pendiente -> prioridad aparte, no entra al sorteo
    const plat = (r.Plataforma||'').trim();
    if(!isAvailable(plat)) continue; // sin plataforma real (X o requiere Descargar) -> fuera del sorteo
    const eps = parseInt(r.Eps) || 0;
    const emotional = (r.Emotional||'').trim()==='X';

    if(ERA_SET.has(cat)){
      const rating = parseFloat(r.Calificacion) || 0;
      const band = rating>8.0 ? 'Elite' : (rating>=7.5 ? 'Normal' : 'Ligera');
      main.push({ title:r.Nombre, era:cat, rating, eps, emotional, band, plataforma:plat });
    } else if(cat === 'Larga'){
      largas.push({ title:r.Nombre, eps, emotional, plataforma:plat });
    } else if(cat === 'Repetir'){
      rep.push({ title:r.Nombre, eps, emotional, plataforma:plat });
    } else if(cat === 'Adulto'){
      adulto.push({ title:r.Nombre, eps, emotional, plataforma:plat });
    }
  }

  if(catsDesconocidas.size>0){
    console.warn('Categoria(s) desconocida(s) en el catalogo, filas ignoradas:', [...catsDesconocidas]);
  }

  MAIN_POOL = main; LARGA_POOL = largas; ADULTO_POOL = adulto; REP_POOL = rep; FULL_ERA_POOL = fullEra;
}

// Arma la "bolsa" de un mazo nuevo (MAZO_SIZE fichas): Dorada y Moderna con
// banda YA FIJA segun la cuota real del momento (buildMazoQuota), mas las
// fichas de Clasica que le toquen a este mazo, con banda en null -- su tipo
// real se decide en resolveBand(), tirando de la bolsa caliente aparte.
function freshDeck(){
  const quota = buildMazoQuota();
  const deck = [];
  for(const era of ['Dorada','Moderna']){
    for(const band of BAND_ORDER){
      const n = quota[era][band] || 0;
      for(let i=0;i<n;i++) deck.push({era, band, used:false});
    }
  }
  for(let i=0;i<(quota.Clasica||0);i++) deck.push({era:'Clasica', band:null, used:false});
  return deck;
}

// ── Bolsa caliente de Clasica ───────────────────────────────────────────
// Antes, cada vez que tocaba una ficha Clasica se tiraba un dado sin memoria
// (42/40/18% siempre igual, sin importar que salio antes) -- eso significa
// que Clasica, a diferencia de Dorada/Moderna, NO tenia garantia de terminar
// en las proporciones reales, solo se acercaba en promedio. La bolsa
// caliente arregla esto: es una bolsa aparte con TODOS los titulos Clasica
// reales (ej. 19 Elite / 18 Normal / 8 Ligera), que se va vaciando de a una
// cada vez que sale una Clasica -- igual que el mazo principal, pero a la
// escala del catalogo Clasica completo (dura muchos mazos principales antes
// de agotarse y rearmarse sola, porque Clasica es solo 2-3 fichas por mazo).
function freshClasicaBag(){
  const {bandCountsByEra} = computeCatalogStats();
  const bag = [];
  BAND_ORDER.forEach(band=>{
    const n = bandCountsByEra.Clasica[band] || 0;
    for(let i=0;i<n;i++) bag.push({band, used:false});
  });
  return bag;
}
function ensureClasicaBag(){
  if(!state.clasicaBag || state.clasicaBag.length===0 || state.clasicaBag.every(t=>t.used)){
    state.clasicaBag = freshClasicaBag();
  }
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
    emoCount: 2, lastEra:'Dorada', lastEraStreak:1, lastBand:'Ligera', lastBandStreak:1, emoCooldown:0,
    clasicaBag: freshClasicaBag(),
    filters: { era:null, calidad:null, generos:[] },
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
    listaCols: 2,
    animStyle: 'cards'
  };
}

// Persiste el objeto `state` completo en window.storage (namespace personal del
// usuario, no compartido). Se llama despues de cualquier cambio de estado.
async function saveState(){
  try{ await window.storage.set('ruleta-anime-state-v6', JSON.stringify(state)); }catch(e){ console.error(e); }
}

// Candidatas validas para la proxima tirada del mazo principal. 2 capas:
// 1) Filtros "Quiero ver" (Era/Calidad) si estan activos -- estos SON una
//    eleccion explicita, asi que tienen prioridad y de paso saltan la regla
//    de racha para ese eje (pedir "Dorada" a proposito cuando ya salio 2
//    veces seguida es justamente para eso).
// 2) Si no hay filtro en ese eje, aplica la regla de racha: permite 2 veces
//    seguidas de la misma Era o el mismo Tipo, pero bloquea la 3ra -- salvo
//    que ya no quede ninguna alternativa (la bolsa se queda sin opcion), en
//    cuyo caso se cede y se permite igual, para que el mazo nunca se trabe.
// Los tokens de Clasica (band:null) siempre pasan el filtro de Tipo aca --
// su banda real todavia no se sabe, se resuelve despues en resolveBand().
function candidateTokens(){
  let pool = state.deck.filter(t=>!t.used);
  const filters = state.filters || {};

  if(filters.era){
    pool = pool.filter(t => t.era===filters.era);
  } else if(state.lastEra && state.lastEraStreak>=2){
    const alt = pool.filter(t => t.era!==state.lastEra);
    if(alt.length>0) pool = alt;
  }

  if(filters.calidad){
    pool = pool.filter(t => t.band===filters.calidad || t.band===null);
  } else if(state.lastBand && state.lastBandStreak>=2){
    const alt = pool.filter(t => t.band!==state.lastBand || t.band===null);
    if(alt.length>0) pool = alt;
  }

  // Fallback fuera de mazo (bug 0/11): un filtro "Quiero ver" activo puede no
  // tener NINGUNA ficha en el mazo actual de 24 aunque el catalogo si tenga
  // titulos disponibles que cumplan -- el mazo es solo una muestra chica, no
  // el universo completo. Antes esto devolvia vacio y la UI se quedaba
  // mostrando el pick anterior sin avisar nada. Ahora, si el mazo no tiene
  // nada, se arma un pool "suelto" directo desde MAIN_POOL (catalogo
  // disponible real) respetando los mismos filtros. Estas fichas se marcan
  // outOfDeck:true: al confirmarse NO gastan cupo del mazo ni de la bolsa
  // caliente de Clasica (ver commitPick), porque no vinieron de ahi -- es
  // una excepcion puntual pedida a proposito, no parte del reparto normal.
  // Solo si esto TAMBIEN sale vacio es un "sin resultados" de verdad.
  if(pool.length===0 && (filters.era || filters.calidad)){
    const usedSet = new Set(state.usedTitles);
    let extra = MAIN_POOL.filter(a => !usedSet.has(a.title));
    if(filters.era) extra = extra.filter(a => a.era===filters.era);
    if(filters.calidad) extra = extra.filter(a => a.band===filters.calidad);
    pool = extra.map(a => ({era:a.era, band:a.band, used:false, outOfDeck:true}));
  }

  return pool;
}

// Devuelve la banda (Elite/Normal/Ligera) de una ficha. Si ya trae banda fija
// (Dorada/Moderna) la devuelve tal cual. Si es Clasica (band=null), la saca
// de la bolsa caliente (ver freshClasicaBag) -- respetando el filtro de
// Calidad si esta activo, o si no la regla de racha (permite 2, bloquea 3ra),
// igual que candidateTokens(). Es solo LECTURA: no marca nada usado todavia,
// eso pasa recien en commitPick() cuando se confirma de verdad (asi "buscar
// de nuevo" no gasta fichas de la bolsa por picks que se terminan descartando).
function resolveBand(token){
  if(token.band) return token.band;
  ensureClasicaBag();
  let pool = state.clasicaBag.filter(t=>!t.used);
  const filters = state.filters || {};
  if(filters.calidad){
    const forced = pool.filter(t => t.band===filters.calidad);
    if(forced.length>0) pool = forced;
  } else if(state.lastBand && state.lastBandStreak>=2){
    const alt = pool.filter(t => t.band!==state.lastBand);
    if(alt.length>0) pool = alt;
  }
  return pool[Math.floor(Math.random()*pool.length)].band;
}

// Dado un token ya resuelto (era+banda), elige el titulo concreto:
// 1) intenta cumplir la decision de "emotional si/no" (ver mas abajo)
// 2) si no hay candidatos con ese filtro exacto, relaja emotional
// 3) si no hay nada en esa banda, relaja banda (cualquiera de la era)
// 4) si no hay nada en la era, relaja a cualquier titulo no visto
// El "quiero emotional" se decide aca mismo: entre EMO_MIN y EMO_MAX por
// mazo (antes era un tope fijo de 3 con ~20% de probabilidad por tirada, lo
// que en la practica daba mas cerca de 12.5% real porque el contador topaba
// antes de que el 20% tuviera chance de expresarse en las 24 fichas del
// mazo). Cooldown DURO de 2 tiradas despues de cada Emotional (no solo
// evitar la inmediata siguiente). Si al mazo le quedan justo las fichas
// necesarias para todavia llegar al minimo, se fuerza Emotional aunque el
// cooldown normal lo bloquearia -- garantizar el piso de 3 pesa mas que la
// regla de "no muy seguido".
const EMO_MIN = 3, EMO_MAX = 5;
function pickTitleFor(token, band){
  const usedSet = new Set(state.usedTitles);
  let candidates = MAIN_POOL.filter(a => a.era===token.era && a.band===band && !usedSet.has(a.title));
  const remaining = state.deck.filter(t=>!t.used).length; // fichas que quedan en el mazo, incluyendo esta
  const faltanParaMinimo = EMO_MIN - state.emoCount;
  const emoForced = faltanParaMinimo > 0 && remaining <= faltanParaMinimo;
  const emoAllowed = state.emoCount < EMO_MAX && (state.emoCooldown <= 0 || emoForced);
  const wantEmo = emoAllowed ? (emoForced ? true : Math.random() < 0.20) : false;
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
  return {token: {era:token.era, band, outOfDeck: !!token.outOfDeck}, title};
}

// Sortea la proxima ficha del ciclo normal: elige un token al azar entre los
// candidatos validos (candidateTokens ya aplica filtros "Quiero ver" y las
// reglas de racha), le resuelve la banda, y le busca titulo. "Buscar de
// nuevo" llama a esto de nuevo tal cual -- ya NO tiene un bypass especial de
// reglas; si se quiere forzar Era/Tipo a proposito, es via los filtros, no
// tocando 2 veces el boton.
function drawNext(){
  let pool = candidateTokens();
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
    emoCount: state.emoCount, emoCooldown: state.emoCooldown,
    lastEra: state.lastEra, lastEraStreak: state.lastEraStreak,
    lastBand: state.lastBand, lastBandStreak: state.lastBandStreak,
    clasicaBag: state.clasicaBag, owed: state.owed,
    blocking: state.blocking, cycleNum: state.cycleNum
  }));
}

// Confirma un pick del ciclo normal: marca la ficha del mazo como usada (y si
// era Clasica, tambien descuenta la banda real de la bolsa caliente), agrega
// el titulo a usedTitles y al historial, y actualiza los contadores de racha
// (lastEra/lastEraStreak, lastBand/lastBandStreak) y el cooldown de Emotional
// que usan las reglas en la proxima tirada.
function commitPick(pick){
  state.lastAction = { type:'ciclo', snapshot: snapshotForUndo() };
  // Los picks outOfDeck (fallback fuera de mazo, ver candidateTokens) no
  // vinieron de una ficha real del mazo ni de la bolsa caliente -- fueron
  // una excepcion puntual armada directo desde el catalogo. No hay ficha ni
  // cupo que gastar, asi que se saltan ambos pasos a proposito.
  if(!pick.token.outOfDeck){
    const idx = state.deck.findIndex(t=>!t.used && t.era===pick.token.era && (t.band===pick.token.band || t.band===null));
    if(idx>=0) state.deck[idx].used = true;
    if(pick.token.era === 'Clasica'){
      ensureClasicaBag();
      const bagIdx = state.clasicaBag.findIndex(t=>!t.used && t.band===pick.token.band);
      if(bagIdx>=0) state.clasicaBag[bagIdx].used = true;
    }
  }
  state.usedTitles.push(pick.title.title);
  state.history.unshift({title:pick.title.title, era:pick.token.era, band:pick.token.band, emotional:pick.title.emotional});
  if(pick.title.emotional) state.emoCount += 1;
  state.lastEraStreak = (pick.token.era===state.lastEra) ? state.lastEraStreak+1 : 1;
  state.lastBandStreak = (pick.token.band===state.lastBand) ? state.lastBandStreak+1 : 1;
  state.lastEra = pick.token.era;
  state.lastBand = pick.token.band;
  state.emoCooldown = pick.title.emotional ? 2 : Math.max(0, state.emoCooldown-1);
  state.pendingPick = null;
}

// Arranca un mazo nuevo (MAZO_SIZE fichas con cupos reales recalculados),
// contador de Emotional en 0, y limpia los "ultimos" para que las reglas de
// racha no arrastren nada del mazo anterior. La bolsa caliente de Clasica NO
// se toca aca -- vive aparte, dura muchos mazos principales.
function startNewCycle(){
  state.deck = freshDeck(); state.emoCount = 0; state.cycleNum += 1;
  state.lastEra = null; state.lastEraStreak = 0;
  state.lastBand = null; state.lastBandStreak = 0;
  state.emoCooldown = 0;
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

// ============ ESCRITURA REMOTA: marcar "Visto" en el Sheet ============
// Le avisa al Apps Script (Web App) que un titulo se confirmo, para que
// marque Visto=Y en la fila correspondiente. Fire-and-forget a proposito:
// si falla (sin internet, URL vieja, etc) NO debe trabar la app ni el
// flujo normal -- el estado local (state.usedTitles / window.storage) ya
// es la fuente de verdad para que el sorteo no repita, esto es solo para
// que el Sheet quede reflejado. Reintentar o avisar visualmente si falla
// es un pendiente aparte, no bloquea el uso hoy.

const VISTO_WRITE_URL = 'https://script.google.com/macros/s/AKfycbw_JGiDEns52YWhIo5_whitg4sXEA3p2JyBvC8sDvJ9mXSaUWZ72tbTD3C1m1PaY0JnkA/exec';

async function markVistoRemote(title){
  try{
    await fetch(VISTO_WRITE_URL, {
      method: 'POST',
      headers: {'Content-Type': 'text/plain;charset=utf-8'},
      body: JSON.stringify({ nombre: title })
    });
  }catch(err){
    console.warn('No se pudo marcar Visto en el Sheet para', title, err);
  }
}
