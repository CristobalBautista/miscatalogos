/* ============================================================
   logic.js -- El "motor" de la app: datos y algoritmo de sorteo.
   No toca el DOM en ningun momento (nada de document.*, nada de
   innerHTML). Todo lo que hay aca se puede probar con Node solo,
   sin navegador -- de hecho asi se valido antes de entregarlo
   (ver /docs o el README para el detalle de la simulacion).
   ============================================================ */

const BAND_ORDER = ['Excelente', 'Buena', 'Normal'];
const ERA_ORDER = ['Dorada', 'Moderna', 'Clasica'];
const ERA_LABELS = { Dorada: 'Era Dorada', Moderna: 'Era Moderna', Clasica: 'Era Clásica' };
const REP_EVERY = 3;
const THEMES = ['dark-purple', 'light'];
const THEME_SWATCH = { 'dark-purple': '#b98ee8', 'light': '#5b4fd1' };

let MAIN_POOL = [], LARGA_POOL = [], ADULTO_POOL = [], REP_POOL = [], NUEVAS_TEMP = [];
// Pool para Lista Completa: TODOS los titulos validos (Era + Larga/Adulto/
// Repetir), sin filtrar por disponibilidad ni PendienteTemporada --
let LISTA_COMPLETA_POOL = [];
// TODOS los titulos de Dorada/Moderna/Clasica del CSV, SIN filtrar por
// disponibilidad ni PendienteTemporada -- se usa solo para calcular las
// proporciones del mazo
let FULL_ERA_POOL = [];
// Titulos marcados Visto=TRUE en el Sheet, armado en cada loadCatalog().
// Fuente de verdad real de "ya visto" -- ver reconcilePendingConfirms().
let SEEN_IN_SHEET = [];

// ── Tamaño del mazo: FIJO en 24, desacoplado de Largas ─────────────────────
const MAZO_SIZE = 24;

// ── Reparto por resto mayor: proporcional a los datos REALES del CSV.
// Ejemplo: si hay que repartir 24 slots entre Dorada/Moderna/Clasica segun
// sus proporciones reales, esto reparte los enteros de piso y le da los
// "sobrantes" (el resto) a quien tenga la fraccion mas alta -- asi ningun
// slot se pierde por redondeo y nadie queda sesgado.
function largestRemainder(counts, totalSlots) {
  const grand = Object.values(counts).reduce((a, b) => a + b, 0);
  const floors = {}; Object.keys(counts).forEach(k => floors[k] = 0);
  if (grand === 0 || totalSlots === 0) return floors;
  const raw = {}; Object.keys(counts).forEach(k => raw[k] = (counts[k] / grand) * totalSlots);
  Object.keys(raw).forEach(k => floors[k] = Math.floor(raw[k]));
  let rem = totalSlots - Object.values(floors).reduce((a, b) => a + b, 0);
  const order = Object.keys(raw).sort((a, b) => (raw[b] - floors[b]) - (raw[a] - floors[a]));
  for (let i = 0; i < rem; i++) { floors[order[i % order.length]]++; }
  return floors;
}

// Cuenta cuantos titulos disponibles hay por Era, y por Banda dentro de cada Era
function computeCatalogStats() {
  const eraCounts = { Dorada: 0, Moderna: 0, Clasica: 0 };
  const bandCountsByEra = {
    Dorada: { Excelente: 0, Buena: 0, Normal: 0 },
    Moderna: { Excelente: 0, Buena: 0, Normal: 0 },
    Clasica: { Excelente: 0, Buena: 0, Normal: 0 },
  };
  FULL_ERA_POOL.forEach(a => {
    if (eraCounts[a.era] === undefined) return;
    eraCounts[a.era]++;
    bandCountsByEra[a.era][a.band]++;
  });
  return { eraCounts, bandCountsByEra };
}

// Arma la cuota de un mazo: primero reparte los slots totales
// entre las 3 Eras (proporcional real), y dentro de Dorada/Moderna reparte
// esos slots entre Excelente/Buena/Normal.
// Clasica NO se subdivide aca -- tiene tan pocos slots por mazo que un cupo fijo por
// podria tocarle 0 a alguna banda. Su tipo real se decide en freshClasicaBag.
function buildMazoQuota() {
  const { eraCounts, bandCountsByEra } = computeCatalogStats();
  const eraQuota = largestRemainder(eraCounts, MAZO_SIZE);
  const quota = { Clasica: eraQuota.Clasica || 0 };
  for (const era of ['Dorada', 'Moderna']) {
    quota[era] = largestRemainder(bandCountsByEra[era], eraQuota[era] || 0);
  }
  return quota;
}

const PLATFORM_ICONS = { netflix: 'netflix', crunchyroll: 'crunchyroll', prime: 'prime', disney: 'disney-plus', max: 'hbo-max' };
const PLATFORM_EMOJI = { netflix: '🔴', crunchyroll: '🟠', prime: '🔵', disney: '⭐', max: '🟣' };

// El estado completo de la app (mazo actual, historial, tema, etc). Se
// inicializa en seedInitialState() y se persiste con localStorage.
let state = null;

// Escapa texto para insertarlo seguro dentro de innerHTML (evita XSS/roturas de HTML).
function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

// Promesa que se resuelve despues de `ms` milisegundos. Se usa para las animaciones
// escalonadas (revelar Era, luego Tipo, luego Nombre, etc) con async/await en vez
// de anidar setTimeout.
function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

// Una plataforma cuenta como "disponible" solo si NO tiene la palabra "X" suelta
// (significa que no esta en ningun servicio) y NO menciona "Descargar" (significa
// que falta parte del contenido en streaming). Se aplica a las 6 categorias del CSV.
function isAvailable(plat) {
  if (!plat) return false;
  if (/\bX\b/.test(plat)) return false;
  if (/Descargar/i.test(plat)) return false;
  return true;
}

// Busca cuales de las plataformas conocidas (Netflix, Crunchyroll, Prime, Disney,
// Max) aparecen mencionadas en el texto de la columna Plataforma. Puede devolver
// mas de una si el titulo esta en varios servicios a la vez.
function detectPlatformKeys(plat) {
  const p = (plat || '').toLowerCase();
  return Object.keys(PLATFORM_ICONS).filter(k => p.includes(k));
}

// La columna Plataforma a veces trae comentarios pegados ademas del nombre
// de la plataforma (ej. "Crunchyroll (Stay no)", "Netflix 1 2 Crunchyroll
// mas de 3"). Esta funcion quita los nombres de plataforma conocidos y
// devuelve lo que sobra (limpio de parentesis/espacios extra), para no
// perder esa aclaracion al mostrar la tarjeta.
function platformExtraNote(plat) {
  if (!plat) return '';
  let txt = plat;
  Object.keys(PLATFORM_ICONS).forEach(k => { txt = txt.replace(new RegExp(k, 'gi'), ''); });
  txt = txt.replace(/[()]/g, ' ').replace(/\s+/g, ' ').trim();
  return txt;
}

// Igual que platformExtraNote, pero pensada para el modal de "no disponible":
// ademas de los nombres de plataforma, quita la "X" suelta y "Descargar" (que
// son las 2 razones de no-disponibilidad), asi si queda algo mas es un
// comentario real (ej. "X - vuelve en Enero") y no ruido.
function unavailableNote(plat) {
  if (!plat) return '';
  let txt = plat;
  txt = txt.replace(/\bX\b/g, ' ');
  txt = txt.replace(/Descargar/gi, ' ');
  Object.keys(PLATFORM_ICONS).forEach(k => { txt = txt.replace(new RegExp(k, 'gi'), ''); });
  txt = txt.replace(/[()-]/g, ' ').replace(/\s+/g, ' ').trim();
  return txt;
}

// Descarga un CSV y lo convierte a un array de objetos {columna: valor} usando
// PapaParse. cache:'no-store' evita que el navegador sirva una copia vieja del
// archivo despues de que edites el CSV en Excel y lo vuelvas a subir.
async function fetchCsv(path) {
  const res = await fetch(path, { cache: 'no-store' });
  const text = await res.text();
  return Papa.parse(text, { header: true, skipEmptyLines: true }).data;
}

// Punto de entrada de los datos: lee catalogo.csv y nuevas_temporadas.csv, aplica
// los 2 filtros del sorteo (Pendiente Nueva Temporada = X, y disponibilidad de
// plataforma) y separa todo en los 4 pools que usa el resto de la app
// (MAIN_POOL = Dorada+Moderna+Clasica, LARGA_POOL, ADULTO_POOL, REP_POOL).
// Se llama una vez al abrir la app (ver loadState en ui.js).
// URL del catalogo publicado desde Google Sheets (Archivo > Compartir >
// Publicar en la web > CSV).
// Nuevas Temporadas vive en OTRA pestaña del mismo Sheet, publicada aparte
const CATALOGO_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQMKcfeHBpai6WyQKvI33TLIt5bU9dgVpAh0l-H6P8ZBdpXdlCfRnP--dxkpLbpA5mLwX8MHfjNrSoT/pub?gid=353737606&single=true&output=csv';
const NUEVAS_TEMP_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQMKcfeHBpai6WyQKvI33TLIt5bU9dgVpAh0l-H6P8ZBdpXdlCfRnP--dxkpLbpA5mLwX8MHfjNrSoT/pub?gid=1202889877&single=true&output=csv';

async function loadCatalog() {
  const [catalogo, nt] = await Promise.all([fetchCsv(CATALOGO_URL), fetchCsv(NUEVAS_TEMP_URL)]);

  NUEVAS_TEMP = nt.map(r => ({
    title: r.Nombre, eps: parseInt(r.MAL_Eps) || 'Unknown',
    finished: !!(r.FechaFinalizacion && r.FechaFinalizacion.trim() && r.FechaFinalizacion.trim() !== 'N/A'),
    generos: (r.Generos || '').trim(),
    temas: (r.Temas || '').trim(),
    poster: (r.Poster || '').trim()
  })).filter(r => r.title);

  const ERA_SET = new Set(['Dorada', 'Moderna', 'Clasica']);
  const OTHER_CATS = new Set(['Adulto', 'Larga', 'Repetir']);
  const main = [], largas = [], rep = [], adulto = [], fullEra = [], listaCompleta = [];
  const catsDesconocidas = new Set();
  // Titulos de Era que el Sheet YA marca como vistos (columna Visto,
  // checkbox TRUE/FALSE). Ver reconcilePendingConfirms()
  const seenInSheet = [];

  for (const r of catalogo) {
    if (!r.Nombre) continue;
    const cat = (r.Categoria || '').trim();
    // Puede traer un solo ID o varios relacionados al mismo titulo, separados por ", "
    const malIds = String(r.MAL_ID || '').split(', ').map(s => s.replace(/[^0-9]/g, '')).filter(Boolean);
    const malId = malIds[0] || '';

    if (!ERA_SET.has(cat) && !OTHER_CATS.has(cat)) {
      catsDesconocidas.add(cat);
      continue;
    }

    // FULL_ERA_POOL: cuenta SIEMPRE, sin importar disponibilidad ni
    // temporada pendiente -- es el universo real para calcular proporciones.
    const rating = parseFloat(r.Calificacion) || 0;
    const band = ERA_SET.has(cat) ? (rating > 8.0 ? 'Excelente' : (rating >= 7.5 ? 'Buena' : 'Normal')) : null;
    if (ERA_SET.has(cat)) {
      fullEra.push({ era: cat, band });
      const vistoRaw = String(r.Visto || '').trim().toUpperCase();
      if (vistoRaw === 'TRUE') seenInSheet.push(r.Nombre);
    }

    const pend = (r.PendienteTemporada || '').trim() === 'X';
    const plat = (r.Plataforma || '').trim();
    const available = isAvailable(plat);
    const eps = parseInt(r.Eps) || 0;
    const emotional = (r.Emotional || '').trim() === 'X';
    const poster = (r.Poster || '').trim();
    const smallPoster = (r.PosterMediano || '').trim();

    // LISTA_COMPLETA_POOL: guarda TODO (disponible, pendiente, o sin
    // plataforma), con los flags puestos, para que la UI de Lista Completa
    // decida como pintar cada fila en vez de que quede escondida.
    listaCompleta.push({
      title: r.Nombre, categoria: cat, era: ERA_SET.has(cat) ? cat : null, band, eps, emotional,
      plataforma: plat, available, pending: pend, poster, smallPoster, malId, malIds
    });

    if (pend) continue; // temporada nueva en curso/pendiente -> prioridad aparte, no entra al sorteo
    if (!available) continue; // sin plataforma real (X o requiere Descargar) -> fuera del sorteo

    if (ERA_SET.has(cat)) {
      main.push({
        title: r.Nombre, era: cat, rating, eps, emotional, band, plataforma: plat, poster, smallPoster,
        nombreStreaming: (r.Nombre_Streaming || '').trim(),
        sinopsis: (r.Sinopsis || '').trim(),
        generos: (r.Generos || '').trim(),
        temas: (r.Temas || '').trim(),
        nota: (r.Notas || '').trim(),
        malId, malIds
      });
    } else if (cat === 'Larga') {
      largas.push({ title: r.Nombre, eps, emotional, plataforma: plat, malId, malIds });
    } else if (cat === 'Repetir') {
      rep.push({ title: r.Nombre, eps, emotional, plataforma: plat, malId, malIds });
    } else if (cat === 'Adulto') {
      adulto.push({ title: r.Nombre, eps, emotional, plataforma: plat, malId, malIds });
    }
  }

  if (catsDesconocidas.size > 0) {
    console.warn('Categoria(s) desconocida(s) en el catalogo, filas ignoradas:', [...catsDesconocidas]);
  }

  MAIN_POOL = main; LARGA_POOL = largas; ADULTO_POOL = adulto; REP_POOL = rep; FULL_ERA_POOL = fullEra;
  LISTA_COMPLETA_POOL = listaCompleta;
  SEEN_IN_SHEET = seenInSheet;
  console.info('MAIN_POOL', [...main]);
}

// Arma la "bolsa" de un mazo nuevo (MAZO_SIZE fichas): Dorada y Moderna con
// banda YA FIJA segun la cuota real del momento (buildMazoQuota), mas las
// fichas de Clasica que le toquen a este mazo, con banda en null -- su tipo
// real se decide en resolveBand(), tirando de la bolsa caliente aparte.
function freshDeck() {
  const quota = buildMazoQuota();
  const deck = [];
  for (const era of ['Dorada', 'Moderna']) {
    for (const band of BAND_ORDER) {
      const n = quota[era][band] || 0;
      for (let i = 0; i < n; i++) deck.push({ era, band, used: false });
    }
  }
  for (let i = 0; i < (quota.Clasica || 0); i++) deck.push({ era: 'Clasica', band: null, used: false });
  return deck;
}

// ── Bolsa caliente de Clasica ───────────────────────────────────────────
// Es una bolsa aparte con TODOS los titulos Clasica reales, que se va vaciando de a una
// cada vez que sale una Clasica -- igual que el mazo principal, pero a la
// escala del catalogo Clasica completo (dura muchos mazos principales antes
// de agotarse y rearmarse sola, porque Clasica es solo 2-3 fichas por mazo).
function freshClasicaBag() {
  const { bandCountsByEra } = computeCatalogStats();
  const bag = [];
  BAND_ORDER.forEach(band => {
    const n = bandCountsByEra.Clasica[band] || 0;
    for (let i = 0; i < n; i++) bag.push({ band, used: false });
  });
  return bag;
}
function ensureClasicaBag() {
  if (!state.clasicaBag || state.clasicaBag.length === 0 || state.clasicaBag.every(t => t.used)) {
    state.clasicaBag = freshClasicaBag();
  }
}

// Estado inicial la primera vez que se abre la app en un dispositivo nuevo: ya
// viene con las primeras 6 elecciones del orden original marcadas como hechas
// (Assassination Classroom...Kakegurui), para no perder el progreso real que ya
// existia antes de que existiera esta app.
function seedInitialState() {
  const deck = freshDeck();
  function useToken(era, band) { const t = deck.find(x => !x.used && x.era === era && x.band === band); if (t) t.used = true; }
  useToken('Dorada', 'Excelente'); useToken('Dorada', 'Excelente');
  useToken('Dorada', 'Buena');
  useToken('Dorada', 'Normal');
  useToken('Moderna', 'Buena'); useToken('Moderna', 'Buena');

  return {
    usedTitles: ['Assassination Classroom', '7th Time Loop', 'Ping Pong the Animation', 'Sacrificial Princess and the King of Beasts', 'Charlotte', 'Kakegurui'],
    deck: deck,
    history: [
      { title: 'Kakegurui', era: 'Dorada', band: 'Normal', emotional: false },
      { title: 'Charlotte', era: 'Dorada', band: 'Buena', emotional: true },
      { title: 'Sacrificial Princess and the King of Beasts', era: 'Moderna', band: 'Buena', emotional: true },
      { title: 'Ping Pong the Animation', era: 'Dorada', band: 'Excelente', emotional: false },
      { title: '7th Time Loop', era: 'Moderna', band: 'Buena', emotional: false },
      { title: 'Assassination Classroom', era: 'Dorada', band: 'Excelente', emotional: false }
    ],
    emoCount: 2, lastEra: 'Dorada', lastEraStreak: 1, lastBand: 'Normal', lastBandStreak: 1, emoCooldown: 0,
    clasicaBag: freshClasicaBag(),
    filters: { era: null, calidad: null, generos: [] },
    cycleNum: 1,
    pendingPick: null,
    // Confirmaciones recientes (ultimos ~60s) todavia no verificadas contra el Sheet
    //  -- ver RECONCILE_WINDOW_MS y reconcilePendingConfirms().
    pendingConfirms: [],
    largaUsed: [], adultoUsed: [], repUsed: [],
    seenNT: [],
    owed: { adulto: false, larga: false, repeticion: false },
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

// Persiste EN CACHE, solo lo minimo indispensable para no repetir series ya
// vistas entre sesiones: usedTitles + los 3 arrays de extras (Larga/Adulto/
// Repetir). A proposito NO se guarda el resto del estado (mazo en curso,
// historial detallado, ciclo, tema, Modo Desarrollador, pestaña actual) --
// cada apertura de la app arranca fresca desde seedInitialState() (ver
// loadState() en ui.js), solo con las series ya vistas restauradas.
async function saveState() {
  try {
    const cache = {
      usedTitles: state.usedTitles,
      pendingConfirms: state.pendingConfirms,
      largaUsed: state.largaUsed,
      adultoUsed: state.adultoUsed,
      repUsed: state.repUsed
    };
    localStorage.setItem('ruleta-anime-vistas-v1', JSON.stringify(cache));
  } catch (e) { console.error(e); }
}

// Candidatas validas para la proxima tirada del mazo principal. 2 capas:
// 1) Filtros "Quiero ver" (Era/Calidad) si estan activos -- estos SON una
//    eleccion explicita, asi que tienen prioridad y de paso saltan la regla
//    de racha para ese eje 
// 2) Si no hay filtro en ese eje, aplica la regla de racha: permite 2 veces
//    seguidas de la misma Era o el mismo Tipo, pero bloquea la 3ra -- salvo
//    que ya no quede ninguna alternativa (la bolsa se queda sin opcion), en
//    cuyo caso se cede y se permite igual, para que el mazo nunca se trabe.
// Los tokens de Clasica (band:null) siempre pasan el filtro de Tipo aca --
// su banda real todavia no se sabe, se resuelve despues en resolveBand().
function candidateTokens() {
  let pool = state.deck.filter(t => !t.used);
  const filters = state.filters || {};

  if (filters.era) {
    pool = pool.filter(t => t.era === filters.era);
  } else if (state.lastEra && state.lastEraStreak >= 2) {
    const alt = pool.filter(t => t.era !== state.lastEra);
    if (alt.length > 0) pool = alt;
  }

  if (filters.calidad) {
    pool = pool.filter(t => t.band === filters.calidad || t.band === null);
  } else if (state.lastBand && state.lastBandStreak >= 2) {
    const alt = pool.filter(t => t.band !== state.lastBand || t.band === null);
    if (alt.length > 0) pool = alt;
  }

  // Fallback fuera de mazo: un filtro "Quiero ver" activo se arma un pool "suelto"
  // directo desde MAIN_POOL (catalogo disponible real) respetando los mismos filtros. 
  // Estas fichas se marcan outOfDeck:true: al confirmarse NO gastan cupo del mazo ni de la bolsa
  // caliente de Clasica, porque no vinieron de ahi
  // Solo si esto TAMBIEN sale vacio es un "sin resultados" de verdad.
  if (pool.length === 0 && (filters.era || filters.calidad)) {
    const usedSet = new Set(state.usedTitles);
    let extra = MAIN_POOL.filter(a => !usedSet.has(a.title));
    if (filters.era) extra = extra.filter(a => a.era === filters.era);
    if (filters.calidad) extra = extra.filter(a => a.band === filters.calidad);
    pool = extra.map(a => ({ era: a.era, band: a.band, used: false, outOfDeck: true }));
  }

  return pool;
}

// Devuelve la banda (Excelente/Buena/Normal) de una ficha. Si ya trae banda fija
// (Dorada/Moderna) la devuelve tal cual. Si es Clasica (band=null):
// - Con filtro de Calidad activo: la banda ya la elegiste vos, la bolsa no
//   participa. Se chequea directo el catalogo real; si no hay oferta, null
//   -- drawNext() descarta este token y prueba otro, sin sustituir nada.
// - Sin filtro: la bolsa decide al azar (pesada por el catalogo real de
//   Clasica) para mantener las proporciones reales en el largo plazo. Si
//   la banda que toca no tiene oferta real ahora mismo, tambien null --
//   misma regla, sin excepciones.
// Es solo LECTURA: no marca nada usado todavia, eso pasa en commitPick()
// (asi "buscar de nuevo" no gasta fichas de la bolsa por picks descartados).
function resolveBand(token) {
  if (token.band) return token.band;
  const filters = state.filters || {};
  const usedSet = new Set(state.usedTitles);

  if (filters.calidad) {
    const hayOferta = MAIN_POOL.some(a => a.era === 'Clasica' && a.band === filters.calidad && !usedSet.has(a.title));
    return hayOferta ? filters.calidad : null;
  }

  ensureClasicaBag();
  let pool = state.clasicaBag.filter(t => !t.used);
  if (state.lastBand && state.lastBandStreak >= 2) {
    const alt = pool.filter(t => t.band !== state.lastBand);
    if (alt.length > 0) pool = alt; // evitar racha es preferencia de ritmo, no filtro tuyo -- si no hay alternativa, cede
  }
  return pool[Math.floor(Math.random() * pool.length)].band;
}

// "Emotional" se decide en 3 casos, sin zona intermedia:
// - Forzado de piso: si faltan N Emotional para llegar a EMO_MIN, hace
//   falta arrancar a tiempo, no en la ultima ficha posible -- cada
//   Emotional forzado (salvo el ultimo) necesita 2 fichas de cooldown
//   despues antes del proximo forzado. Umbral: quedan <= 3*N-2 fichas
//   (1 forzada + 2 de cooldown + 1 forzada... para N=2 eso es 4).
// - Cooldown/tope: justo salio un Emotional (cooldown de 2 tiradas) o ya
//   se llego a EMO_MAX -- excluye Emotional.
// - Caso normal (ni una cosa ni la otra): NO filtra por Emotional en
//   absoluto -- todos los candidatos compiten parejo, sea cual sea su
//   Emotional. Antes este caso tiraba una moneda de ~20% por tirada, lo
//   que con pools chicos (ej. Clasica-Excelente con 2 Emotional y 2 que no)
//   partia el pool en dos grupos desparejos (80%/20%) en vez de dejarlos
//   competir parejo -- eso ya no pasa.
// En cualquier caso, si el filtro resultante da 0 candidatos, cede sobre
// el mismo Era+Banda (Emotional es ritmo interno, no un filtro tuyo).
const EMO_MIN = 3, EMO_MAX = 5;
function pickTitleFor(token, band) {
  const usedSet = new Set(state.usedTitles);
  let candidates = MAIN_POOL.filter(a => a.era === token.era && a.band === band && !usedSet.has(a.title));
  if (candidates.length === 0) return null;

  const remaining = state.deck.filter(t => !t.used).length; // fichas que quedan en el mazo, incluyendo esta
  const faltanParaMinimo = EMO_MIN - state.emoCount;
  const emoForced = faltanParaMinimo > 0 && remaining <= (3 * faltanParaMinimo - 2);
  const emoBloqueado = !emoForced && (state.emoCooldown > 0 || state.emoCount >= EMO_MAX);

  let filtered = candidates;
  if (emoForced) filtered = candidates.filter(a => a.emotional === true);
  else if (emoBloqueado) filtered = candidates.filter(a => a.emotional === false);
  if (filtered.length > 0) candidates = filtered;

  return candidates[Math.floor(Math.random() * candidates.length)];
}

// Empaqueta el resultado final de un sorteo: {token, title} listo para
// mostrar en pantalla y, si se confirma, para pasar a commitPick(). 
function finishDraw(token, band) {
  const title = pickTitleFor(token, band);
  if (!title) return null;
  return { token: { era: token.era, band, outOfDeck: !!token.outOfDeck }, title };
}

// Sortea la proxima ficha: candidateTokens() ya aplica filtros "Quiero ver"
// y las reglas de racha. Elige UN token al azar del pool y lo resuelve --
// una sola pasada, sin reintentar con otro token si este falla. Para MVP se
// asume disponibilidad real en todos los tokens (ver pendiente de
// notificacion/cadencia de descarga de series para cuando eso deje de ser
// cierto) -- construir logica de descarte para un caso que hoy
// practicamente no ocurre es resolver algo que todavia no es un problema.
// Si band o titulo salen null, drawNext() devuelve null tal cual, sin
// insistir con otro token del pool.
// "Buscar de nuevo" llama a esto tal cual, sin bypass de reglas.
function drawNext() {
  const pool = candidateTokens();
  if (pool.length === 0) return null;
  const token = pool[Math.floor(Math.random() * pool.length)];
  const band = resolveBand(token);
  if (band === null) return null;
  return finishDraw(token, band);
}

// Copia profunda de todos los campos que "Deshacer" necesita restaurar. Se toma
// justo ANTES de aplicar un cambio (commitPick), no despues.
function snapshotForUndo() {
  return JSON.parse(JSON.stringify({
    deck: state.deck, usedTitles: state.usedTitles, history: state.history,
    emoCount: state.emoCount, emoCooldown: state.emoCooldown,
    lastEra: state.lastEra, lastEraStreak: state.lastEraStreak,
    lastBand: state.lastBand, lastBandStreak: state.lastBandStreak,
    clasicaBag: state.clasicaBag, owed: state.owed,
    blocking: state.blocking, cycleNum: state.cycleNum,
    pendingConfirms: state.pendingConfirms
  }));
}

// Ventana de gracia: si el Sheet todavia no refleja una confirmacion
// reciente despues de este tiempo, se deja de confiar en la copia local y
// se confia en el Sheet (ver reconcilePendingConfirms).
const RECONCILE_WINDOW_MS = 60 * 1000;

// Decide el usedTitles real al arrancar la app: parte de lo que dice el
// Sheet (SEEN_IN_SHEET, armado en loadCatalog) y le suma, SOLO
// temporalmente, las confirmaciones locales que el Sheet todavia no
// alcanzo a reflejar. Las confirmaciones locales mas viejas que
// RECONCILE_WINDOW_MS que el Sheet sigue sin mostrar como vistas se
// descartan.
// Importante: esto SOLO se llama al cargar la app (loadState en ui.js),
// nunca hay un timer corriendo en segundo plano durante una sesion
// abierta -- state.usedTitles en memoria no pierde nada por el paso del
// tiempo mientras la app sigue abierta.
function reconcilePendingConfirms(pendingConfirms) {
  const sheetSet = new Set(SEEN_IN_SHEET);
  const now = Date.now();
  const survivors = [];
  const extraTitles = [];
  (pendingConfirms || []).forEach(entry => {
    if (sheetSet.has(entry.title)) return;
    if (now - entry.ts < RECONCILE_WINDOW_MS) {
      survivors.push(entry);
      extraTitles.push(entry.title);
    }
  });
  return { usedTitles: [...SEEN_IN_SHEET, ...extraTitles], pendingConfirms: survivors };
}

// Confirma un pick del ciclo normal: marca la ficha del mazo como usada (si
// vino del mazo -- ver mas abajo), descuenta la banda real de la bolsa
// caliente si era Clasica, agrega el titulo a usedTitles y al historial, y
// actualiza los contadores de racha (lastEra/lastEraStreak,
// lastBand/lastBandStreak) y el cooldown de Emotional que usan las reglas
// en la proxima tirada.
function commitPick(pick) {
  state.lastAction = { type: 'ciclo', malId: pick.title.malId, snapshot: snapshotForUndo() };
  // Los picks outOfDeck (fallback fuera de mazo, ver candidateTokens) no
  // vinieron de una ficha real del mazo -- no hay ficha que marcar, se
  // salta a proposito.
  if (!pick.token.outOfDeck) {
    const idx = state.deck.findIndex(t => !t.used && t.era === pick.token.era && (t.band === pick.token.band || t.band === null));
    if (idx >= 0) state.deck[idx].used = true;
  }
  // La bolsa caliente es un recurso aparte del mazo: acumula de por vida
  // para mantener las proporciones reales de Clasica en el largo plazo. Un
  // pick outOfDeck sigue siendo un titulo real confirmado -- si no se
  // descuenta igual, la bolsa cree que queda mas oferta de la que en
  // realidad queda. Por eso esto NO depende de outOfDeck, solo de que sea
  // Clasica.
  if (pick.token.era === 'Clasica') {
    ensureClasicaBag();
    const bagIdx = state.clasicaBag.findIndex(t => !t.used && t.band === pick.token.band);
    if (bagIdx >= 0) state.clasicaBag[bagIdx].used = true;
  }
  state.usedTitles.push(pick.title.title);
  state.pendingConfirms.push({ title: pick.title.title, malId: pick.title.malId, ts: Date.now() });
  state.history.unshift({ title: pick.title.title, era: pick.title.era, band: pick.title.band, emotional: pick.title.emotional });
  if (pick.title.emotional) state.emoCount += 1;
  state.lastEraStreak = (pick.token.era === state.lastEra) ? state.lastEraStreak + 1 : 1;
  state.lastBandStreak = (pick.token.band === state.lastBand) ? state.lastBandStreak + 1 : 1;
  state.lastEra = pick.token.era;
  state.lastBand = pick.token.band;
  state.emoCooldown = pick.title.emotional ? 2 : Math.max(0, state.emoCooldown - 1);
  state.pendingPick = null;
}

// Arranca un mazo nuevo (MAZO_SIZE fichas con cupos reales recalculados),
// contador de Emotional en 0, y limpia los "ultimos" para que las reglas de
// racha no arrastren nada del mazo anterior. La bolsa caliente de Clasica NO
// se toca aca -- vive aparte, dura muchos mazos principales.
function startNewCycle() {
  state.deck = freshDeck(); state.emoCount = 0; state.cycleNum += 1;
  state.lastEra = null; state.lastEraStreak = 0;
  state.lastBand = null; state.lastBandStreak = 0;
  state.emoCooldown = 0;
}

// Devuelve el pool de datos (array de titulos) segun la categoria extra pedida.
function poolFor(cat) { return cat === 'adulto' ? ADULTO_POOL : cat === 'larga' ? LARGA_POOL : REP_POOL; }

// Devuelve el array de "ya usados" correspondiente a esa categoria extra (cada
// una tiene su propio historial de repeticion, independiente del ciclo normal).
function usedArrFor(cat) { return cat === 'adulto' ? state.adultoUsed : cat === 'larga' ? state.largaUsed : state.repUsed; }

// Sortea un titulo al azar de una categoria extra (Adulto/Larga/Repetir), sin
// pesos ni reglas -- estas categorias son mucho mas chicas, no necesitan la
// misma logica de reparto. Si ya se usaron todos, la lista se reinicia sola.
function drawExtra(cat) {
  const usedArr = usedArrFor(cat);
  const usedSet = new Set(usedArr);
  let avail = poolFor(cat).filter(a => !usedSet.has(a.title));
  if (avail.length === 0) { avail = poolFor(cat); usedArr.length = 0; }
  if (avail.length === 0) return null;
  return avail[Math.floor(Math.random() * avail.length)];
}

// Confirma un pick de categoria extra: lo marca usado dentro de esa categoria,
// lo agrega al historial general, y limpia la obligacion pendiente (owed).
function commitExtra(cat, item) {
  usedArrFor(cat).push(item.title);
  const label = cat === 'adulto' ? 'Adulto' : cat === 'larga' ? 'Larga' : 'Repetición';
  state.history.unshift({ title: item.title, era: 'Extra', band: label, emotional: !!item.emotional });
  state.owed[cat] = false;
}

// ============ ESCRITURA REMOTA: sincronizar "Visto" en el Sheet ============
// Le avisa al Apps Script (Web App) que un titulo se confirmo (visto=true)
// o que se deshizo una confirmacion (visto=false), para que el checkbox
const VISTO_WRITE_URL = 'https://script.google.com/macros/s/AKfycbwwztyAfrc-7BtjP4Q4GaSEBD3KdW2nQjChk9zP7eiqjNZlCksceI7BAtSIcaCEnOT_/exec';

async function syncVistoRemote(malId, visto) {
  if (!malId) {
    console.warn('syncVistoRemote: Sin malId, no se pudo sincronizar con el Sheet (visto=' + visto + ')');
    return;
  }
  try {
    await fetch(VISTO_WRITE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ malId: String(malId), visto: !!visto })
    });
  } catch (err) {
    console.warn('No se pudo sincronizar Visto=' + visto + ' en el Sheet para malId', malId, err);
  }
}
