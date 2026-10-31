/* ============================================================
   logic.js -- El "motor" de la app: datos y algoritmo de sorteo.
   No toca el DOM en ningun momento (nada de document.*, nada de
   innerHTML). Todo lo que hay aca se puede probar con Node solo,
   sin navegador -- de hecho asi se valido antes de entregarlo
   (ver /docs o el README para el detalle de la simulacion).
   ============================================================ */

const BAND_ORDER = ['Excelente', 'Buena', 'Normal'];
const ERA_ORDER = ['Dorada', 'Moderna', 'Clasica'];
// ERA_LABELS queda como estaba (no se borra, podria estar referenciado desde
// otro lado que no vimos) pero ya NO es la fuente de texto mostrado -- eso
// ahora es I18N ('era.<Era>.full'/'era.<Era>.short', via trEraFull/trEraShort
// mas abajo). Se deja sin tocar a proposito.
const ERA_LABELS = { Dorada: 'Era Dorada', Moderna: 'Era Moderna', Clasica: 'Era Clásica' };
const REP_EVERY = 3;
const THEMES = ['dark-purple', 'light'];
const THEME_SWATCH = { 'dark-purple': '#b98ee8', 'light': '#5b4fd1' };

// ============ IDIOMAS (ES/EN/SR) ============
// Diccionario plano, una entrada por string visible de la UI (chrome de la
// app: botones, titulos, modales, toasts). NO traduce contenido del propio
// catalogo (nombres de anime, sinopsis, generos del Sheet, notas) -- eso
// sigue viniendo tal cual del CSV, en el idioma en que Diego lo cargo.
// Tampoco traduce nombres de plataforma (Netflix/Crunchyroll/Prime/Disney/
// Max) -- son nombres propios de marca.
// state.lang NO se persiste entre recargas (misma logica que state.theme y
// state.devMode hoy: saveState() solo cachea usedTitles/pendingConfirms/
// largaUsed/adultoUsed/repUsed -- ver comentario en saveState()). Volver a
// abrir la app vuelve siempre a 'es'. No se agrego persistencia porque no
// se pidio y hubiera sido una desviacion del patron ya establecido.
const LANGS = ['es', 'en', 'sr'];
const LANG_NAMES = { es: 'Español', en: 'English', sr: 'Srpski' };
const I18N = {
  es: {
    'home.subtitle': 'Elige qué quieres ver hoy',
    'home.anime': 'ANIME',
    'home.live': 'LIVE ACTION',
    'home.movies': 'PELÍCULAS',
    'home.cartoon': 'CARTOON',
    'toast.proximamente': 'Próximamente',

    'config.title': 'Configuración',
    'config.ariaLabel': 'Configuración',
    'config.darkMode': 'Modo Oscuro',
    'config.devMode': 'Modo Desarrollador',
    'config.language': 'Idioma',
    'config.close': 'Cerrar',

    'nav.backHome': '‹ INICIO',
    'nav.backAnime': '‹ ANIME',
    'header.anime': 'ANIME',
    'tri.ruleta': 'Ruleta<br>de Anime',
    'tri.nuevasTemp': 'Nuevas<br>Temporadas',
    'tri.lista': 'Ver Lista<br>Completa',
    'section.historial': 'Historial',
    'undo.deshacer': '↩ Deshacer',
    'hist.nombre': 'Nombre',
    'hist.era': 'Era',
    'hist.tipo': 'Tipo',
    'hist.vacio': 'Nada elegido aún',

    'lista.title': 'Lista Completa',
    'lista.hint': 'Toca cualquier título para elegirlo como siguiente ahora mismo.',
    'lista.ariaFiltros': 'Filtros',
    'lista.columnas': 'Columnas',
    'lista.mostrarNoDisp': 'Mostrar no disponibles',
    'lista.sinTitulos': 'Sin títulos pendientes.',
    'lista.volverArriba': 'Volver arriba',

    'nt.title': 'Nuevas Temporadas',
    'nt.hint': 'Ya Disponibles',
    'nt.sinNuevas': 'No hay temporadas nuevas listas por ahora.',

    'ciclo.title': 'Ruleta de Anime',
    'qv.toggle': 'QUIERO VER',
    'dev.toggle': 'DEV MODE',
    'filter.eraLabel': 'Era',
    'filter.era.Dorada': 'Dorada',
    'filter.era.Moderna': 'Nuevo',
    'filter.era.Clasica': 'Clásico',
    'filter.calidadLabel': 'Calidad',
    'filter.generoLabel': 'Género',
    'filter.generoStub': '(no funcional aún)',
    'band.Excelente': 'Excelente',
    'band.Buena': 'Buena',
    'band.Normal': 'Normal',
    'genero.Accion': 'Acción',
    'genero.Comedia': 'Comedia',
    'genero.Drama': 'Drama',
    'genero.Romance': 'Romance',
    'genero.Suspenso': 'Suspenso',

    'dev.cupos': 'Cupos del ciclo',
    'dev.statCiclo': 'Ciclo',
    'dev.statEmo': 'Emotional',
    'dev.statNCiclo': 'N° ciclo',
    'dev.porEra': 'Por Era (mazo de {n})',
    'dev.disp': 'disp.',
    'dev.porTipo': 'Por Tipo (Excelente / Buena / Normal)',
    'dev.bolsaClasica': 'Bolsa caliente Clásica (independiente del mazo)',
    'dev.reiniciar': '↺ Reiniciar estado (prueba)',

    'card.empiezaBtn': 'Presiona "Elegir siguiente" para empezar',
    'card.cicloCompleto': 'Ciclo completo',
    'gate.msg': '✅ Ok suficiente anime, ¿ahora una larga en serio o un cartoon adulto?',
    'gate.adulto': '🎬 Siguiente Adulta',
    'gate.larga': '📽️ Siguiente Larga',
    'gate.repetir': '🔁 Repetir Grande',
    'gate.continuar': '➡️ Mejor continuar ciclo',
    'btn.elegir': '🎲 Elegir siguiente',
    'btn.buscarDeNuevo': '🔄 Buscar de nuevo',
    'btn.confirmar': '✅ Confirmar serie',
    'deck.historial10': 'Historial, últimos 10',

    'pill.adulto': '¿Ahora sí Adulta?',
    'pill.larga': '¿Ahora sí Larga?',
    'pill.repetir': '¿Ahora sí Repetir?',

    'toast.sinResultadosFiltro': '😕 Sin resultados para esos filtros',
    'card.sinResultadosFiltroPlano': 'Sin resultados para esos filtros',
    'toast.sinCandidatos': 'Sin candidatos, revisa el mazo',
    'toast.sinTitulosCategoria': 'Sin títulos en esta categoría',
    'toast.estadoReiniciado': 'Estado reiniciado',

    'modal.noDisponible.title': 'No disponible',
    'modal.noDisponible.msg': 'No disponible en plataformas. Lo siento.',
    'btn.entendido': 'Entendido',

    'modal.nuevaTemp.title': 'Nueva temporada',
    'modal.nuevaTemp.msg': 'Está estrenando o falta estrenar una nueva temporada. ¿Quieres arrancar aun así?',
    'btn.siArrancar': 'Sí, arrancar',
    'btn.cancelar': 'Cancelar',

    'modal.disponibleEn': 'Disponible en: ',
    'modal.sinPlataforma': 'Sin plataforma registrada.',
    'btn.okElegirEsta': 'OK, elegir esta',

    'modal.reiniciar.title': 'Reiniciar estado',
    'modal.reiniciar.msg': 'Vuelve el mazo, historial y contadores al estado inicial de prueba (hasta Kakegurui). No borra ni cambia nada en el Google Sheet. ¿Confirmas?',
    'btn.siReiniciar': 'Sí, reiniciar',

    'platform.sinDato': 'Sin dato',
    'unidad.eps': 'eps',
    'sinopsis.verMas': 'Ver más',
    'sinopsis.verMenos': 'Ver menos',

    'cat.adulto': 'Adulto',
    'cat.larga': 'Larga',
    'cat.repeticion': 'Repetición',
    'cat.nuevaTemporada': 'Nueva Temporada',
    'tag.emotional': 'Emotional',

    'era.Dorada.full': 'Era Dorada', 'era.Dorada.short': 'Dorada',
    'era.Moderna.full': 'Era Moderna', 'era.Moderna.short': 'Moderna',
    'era.Clasica.full': 'Era Clásica', 'era.Clasica.short': 'Clásica',
    'era.Extra.short': 'Extra'
  },
  en: {
    'home.subtitle': 'Choose what to watch today',
    'home.anime': 'ANIME',
    'home.live': 'LIVE ACTION',
    'home.movies': 'MOVIES',
    'home.cartoon': 'CARTOON',
    'toast.proximamente': 'Coming soon',

    'config.title': 'Settings',
    'config.ariaLabel': 'Settings',
    'config.darkMode': 'Dark Mode',
    'config.devMode': 'Developer Mode',
    'config.language': 'Language',
    'config.close': 'Close',

    'nav.backHome': '‹ HOME',
    'nav.backAnime': '‹ ANIME',
    'header.anime': 'ANIME',
    'tri.ruleta': 'Anime<br>Roulette',
    'tri.nuevasTemp': 'New<br>Seasons',
    'tri.lista': 'View Full<br>List',
    'section.historial': 'History',
    'undo.deshacer': '↩ Undo',
    'hist.nombre': 'Name',
    'hist.era': 'Era',
    'hist.tipo': 'Type',
    'hist.vacio': 'Nothing chosen yet',

    'lista.title': 'Full List',
    'lista.hint': 'Tap any title to pick it as next, right now.',
    'lista.ariaFiltros': 'Filters',
    'lista.columnas': 'Columns',
    'lista.mostrarNoDisp': 'Show unavailable',
    'lista.sinTitulos': 'No titles pending.',
    'lista.volverArriba': 'Back to top',

    'nt.title': 'New Seasons',
    'nt.hint': 'Already Available',
    'nt.sinNuevas': 'No new seasons ready yet.',

    'ciclo.title': 'Anime Roulette',
    'qv.toggle': 'I WANT TO WATCH',
    'dev.toggle': 'DEV MODE',
    'filter.eraLabel': 'Era',
    'filter.era.Dorada': 'Golden',
    'filter.era.Moderna': 'New',
    'filter.era.Clasica': 'Classic',
    'filter.calidadLabel': 'Quality',
    'filter.generoLabel': 'Genre',
    'filter.generoStub': '(not functional yet)',
    'band.Excelente': 'Excellent',
    'band.Buena': 'Good',
    'band.Normal': 'Normal',
    'genero.Accion': 'Action',
    'genero.Comedia': 'Comedy',
    'genero.Drama': 'Drama',
    'genero.Romance': 'Romance',
    'genero.Suspenso': 'Suspense',

    'dev.cupos': 'Cycle slots',
    'dev.statCiclo': 'Cycle',
    'dev.statEmo': 'Emotional',
    'dev.statNCiclo': 'Cycle #',
    'dev.porEra': 'By Era (deck of {n})',
    'dev.disp': 'avail.',
    'dev.porTipo': 'By Type (Excellent / Good / Normal)',
    'dev.bolsaClasica': 'Classic hot bag (independent from the deck)',
    'dev.reiniciar': '↺ Reset state (test)',

    'card.empiezaBtn': 'Press "Pick next" to start',
    'card.cicloCompleto': 'Cycle complete',
    'gate.msg': "✅ Ok that's enough anime, now a real Long one or an Adult cartoon?",
    'gate.adulto': '🎬 Next Adult',
    'gate.larga': '📽️ Next Long',
    'gate.repetir': '🔁 Big Rewatch',
    'gate.continuar': '➡️ Better continue cycle',
    'btn.elegir': '🎲 Pick next',
    'btn.buscarDeNuevo': '🔄 Search again',
    'btn.confirmar': '✅ Confirm series',
    'deck.historial10': 'History, last 10',

    'pill.adulto': 'Ready for Adult now?',
    'pill.larga': 'Ready for Long now?',
    'pill.repetir': 'Ready to Rewatch now?',

    'toast.sinResultadosFiltro': '😕 No results for those filters',
    'card.sinResultadosFiltroPlano': 'No results for those filters',
    'toast.sinCandidatos': 'No candidates, check the deck',
    'toast.sinTitulosCategoria': 'No titles in this category',
    'toast.estadoReiniciado': 'State reset',

    'modal.noDisponible.title': 'Not available',
    'modal.noDisponible.msg': 'Not available on any platform. Sorry.',
    'btn.entendido': 'Got it',

    'modal.nuevaTemp.title': 'New season',
    'modal.nuevaTemp.msg': 'A new season is airing or about to air. Do you want to start it anyway?',
    'btn.siArrancar': 'Yes, start',
    'btn.cancelar': 'Cancel',

    'modal.disponibleEn': 'Available on: ',
    'modal.sinPlataforma': 'No platform on record.',
    'btn.okElegirEsta': 'OK, pick this one',

    'modal.reiniciar.title': 'Reset state',
    'modal.reiniciar.msg': "Resets the deck, history and counters to the initial test state (up to Kakegurui). Doesn't delete or change anything in the Google Sheet. Confirm?",
    'btn.siReiniciar': 'Yes, reset',

    'platform.sinDato': 'No data',
    'unidad.eps': 'eps',
    'sinopsis.verMas': 'Show more',
    'sinopsis.verMenos': 'Show less',

    'cat.adulto': 'Adult',
    'cat.larga': 'Long',
    'cat.repeticion': 'Rewatch',
    'cat.nuevaTemporada': 'New Season',
    'tag.emotional': 'Emotional',

    'era.Dorada.full': 'Golden Era', 'era.Dorada.short': 'Golden',
    'era.Moderna.full': 'Modern Era', 'era.Moderna.short': 'Modern',
    'era.Clasica.full': 'Classic Era', 'era.Clasica.short': 'Classic',
    'era.Extra.short': 'Extra'
  },
  sr: {
    'home.subtitle': 'Izaberi šta želiš da gledaš danas',
    'home.anime': 'ANIME',
    'home.live': 'LIVE ACTION',
    'home.movies': 'FILMOVI',
    'home.cartoon': 'CARTOON',
    'toast.proximamente': 'Uskoro',

    'config.title': 'Podešavanja',
    'config.ariaLabel': 'Podešavanja',
    'config.darkMode': 'Tamni režim',
    'config.devMode': 'Režim za programere',
    'config.language': 'Jezik',
    'config.close': 'Zatvori',

    'nav.backHome': '‹ POČETNA',
    'nav.backAnime': '‹ ANIME',
    'header.anime': 'ANIME',
    'tri.ruleta': 'Anime<br>rulet',
    'tri.nuevasTemp': 'Nove<br>sezone',
    'tri.lista': 'Pogledaj<br>celu listu',
    'section.historial': 'Istorija',
    'undo.deshacer': '↩ Poništi',
    'hist.nombre': 'Ime',
    'hist.era': 'Era',
    'hist.tipo': 'Tip',
    'hist.vacio': 'Još ništa nije izabrano',

    'lista.title': 'Cela lista',
    'lista.hint': 'Dodirni bilo koji naslov da ga odmah izabereš kao sledeći.',
    'lista.ariaFiltros': 'Filteri',
    'lista.columnas': 'Kolone',
    'lista.mostrarNoDisp': 'Prikaži nedostupne',
    'lista.sinTitulos': 'Nema naslova na čekanju.',
    'lista.volverArriba': 'Nazad na vrh',

    'nt.title': 'Nove sezone',
    'nt.hint': 'Već dostupno',
    'nt.sinNuevas': 'Trenutno nema novih spremnih sezona.',

    'ciclo.title': 'Anime rulet',
    'qv.toggle': 'ŽELIM DA GLEDAM',
    'dev.toggle': 'DEV MODE',
    'filter.eraLabel': 'Era',
    'filter.era.Dorada': 'Zlatno',
    'filter.era.Moderna': 'Novo',
    'filter.era.Clasica': 'Klasično',
    'filter.calidadLabel': 'Kvalitet',
    'filter.generoLabel': 'Žanr',
    'filter.generoStub': '(još ne funkcioniše)',
    'band.Excelente': 'Odlično',
    'band.Buena': 'Dobro',
    'band.Normal': 'Normalno',
    'genero.Accion': 'Akcija',
    'genero.Comedia': 'Komedija',
    'genero.Drama': 'Drama',
    'genero.Romance': 'Romansa',
    'genero.Suspenso': 'Napetost',

    'dev.cupos': 'Mesta u ciklusu',
    'dev.statCiclo': 'Ciklus',
    'dev.statEmo': 'Emotivno',
    'dev.statNCiclo': 'Broj ciklusa',
    'dev.porEra': 'Po eri (špil od {n})',
    'dev.disp': 'dost.',
    'dev.porTipo': 'Po tipu (Odlično / Dobro / Normalno)',
    'dev.bolsaClasica': 'Klasična vruća kesa (nezavisno od špila)',
    'dev.reiniciar': '↺ Resetuj stanje (test)',

    'card.empiezaBtn': 'Pritisni "Izaberi sledeće" da počneš',
    'card.cicloCompleto': 'Ciklus završen',
    'gate.msg': '✅ Ok, dosta animea, sad ozbiljno Duga serija ili crtać za odrasle?',
    'gate.adulto': '🎬 Sledeća za odrasle',
    'gate.larga': '📽️ Sledeća duga',
    'gate.repetir': '🔁 Veliko ponavljanje',
    'gate.continuar': '➡️ Bolje nastavi ciklus',
    'btn.elegir': '🎲 Izaberi sledeće',
    'btn.buscarDeNuevo': '🔄 Traži ponovo',
    'btn.confirmar': '✅ Potvrdi seriju',
    'deck.historial10': 'Istorija, poslednjih 10',

    'pill.adulto': 'Sad ozbiljno za odrasle?',
    'pill.larga': 'Sad ozbiljno duga?',
    'pill.repetir': 'Sad ozbiljno ponavljanje?',

    'toast.sinResultadosFiltro': '😕 Nema rezultata za te filtere',
    'card.sinResultadosFiltroPlano': 'Nema rezultata za te filtere',
    'toast.sinCandidatos': 'Nema kandidata, proveri špil',
    'toast.sinTitulosCategoria': 'Nema naslova u ovoj kategoriji',
    'toast.estadoReiniciado': 'Stanje resetovano',

    'modal.noDisponible.title': 'Nije dostupno',
    'modal.noDisponible.msg': 'Nije dostupno ni na jednoj platformi. Žao mi je.',
    'btn.entendido': 'Razumem',

    'modal.nuevaTemp.title': 'Nova sezona',
    'modal.nuevaTemp.msg': 'Nova sezona se emituje ili tek treba da počne. Želiš li ipak da počneš?',
    'btn.siArrancar': 'Da, počni',
    'btn.cancelar': 'Otkaži',

    'modal.disponibleEn': 'Dostupno na: ',
    'modal.sinPlataforma': 'Nema evidentirane platforme.',
    'btn.okElegirEsta': 'OK, izaberi ovo',

    'modal.reiniciar.title': 'Resetuj stanje',
    'modal.reiniciar.msg': 'Vraća špil, istoriju i brojače na početno probno stanje (do Kakegurui). Ne briše niti menja ništa u Google Sheet-u. Potvrđuješ?',
    'btn.siReiniciar': 'Da, resetuj',

    'platform.sinDato': 'Nema podataka',
    'unidad.eps': 'ep.',
    'sinopsis.verMas': 'Prikaži više',
    'sinopsis.verMenos': 'Prikaži manje',

    'cat.adulto': 'Za odrasle',
    'cat.larga': 'Duga',
    'cat.repeticion': 'Ponavljanje',
    'cat.nuevaTemporada': 'Nova sezona',
    'tag.emotional': 'Emotivno',

    'era.Dorada.full': 'Zlatna era', 'era.Dorada.short': 'Zlatna',
    'era.Moderna.full': 'Moderna era', 'era.Moderna.short': 'Moderna',
    'era.Clasica.full': 'Klasična era', 'era.Clasica.short': 'Klasična',
    'era.Extra.short': 'Extra'
  }
};
// Nombre deliberadamente "tr" (no "t"): "t" ya se usa en todo ui.js como
// variable local para "el titulo actual" (const t = pick.title, etc.) --
// usar ese nombre para la funcion de traduccion hubiera quedado tapado
// (shadowed) por esas variables locales y roto silenciosamente.
function tr(key, vars) {
  const dict = (typeof state !== 'undefined' && state && I18N[state.lang]) || I18N.es;
  let str = (key in dict) ? dict[key] : (key in I18N.es ? I18N.es[key] : key);
  if (vars) Object.keys(vars).forEach(k => { str = str.split('{' + k + '}').join(vars[k]); });
  return str;
}
// band/era vienen de datos internos (claves en español: 'Excelente',
// 'Dorada', etc. -- son tambien los valores reales de Categoria/banda en el
// Sheet, no se tocan). Si no hay traduccion para esa clave especifica (ej.
// las etiquetas de Adulto/Larga/Repeticion/Nueva Temporada que logic.js ya
// graba tal cual -- texto en español -- directo en state.history, ver
// comentario en commitExtra), se devuelve el valor original sin tocar en vez
// del nombre de la clave de busqueda.
function trBand(band) { const v = tr('band.' + band); return v === ('band.' + band) ? band : v; }
function trEraFull(era) { const v = tr('era.' + era + '.full'); return v === ('era.' + era + '.full') ? era : v; }
function trEraShort(era) { const v = tr('era.' + era + '.short'); return v === ('era.' + era + '.short') ? era : v; }

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

// Punto de entrada de los datos: lee catalogo.csv y nuevas_temporadas.csv.
// Del catalogo arma: MAIN_POOL/LARGA_POOL/ADULTO_POOL/REP_POOL (filtrados
// por disponibilidad y PendienteTemporada, lo que entra al sorteo),
// LISTA_COMPLETA_POOL (todo, sin filtrar, para la pantalla Lista Completa),
// FULL_ERA_POOL (todo Dorada/Moderna/Clasica sin filtrar, para calcular
// proporciones del mazo) y SEEN_IN_SHEET (que Era ya esta Visto=TRUE en el
// Sheet, fuente de verdad real -- ver reconcilePendingConfirms). De paso
// parsea MAL_ID de cada fila (puede traer varios IDs relacionados
// separados por ", ", el primero es el canonico).
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
    } else {
      const vistoRaw = String(r.Visto || '').trim().toUpperCase();
      if (vistoRaw === 'TRUE') seenInSheet.push(r.Nombre);
    }

    // FULL_ERA_POOL: cuenta SIEMPRE, sin importar disponibilidad ni
    // temporada pendiente -- es el universo real para calcular proporciones.
    const rating = parseFloat(r.Calificacion) || 0;
    const band = ERA_SET.has(cat) ? (rating > 8.0 ? 'Excelente' : (rating >= 7.5 ? 'Buena' : 'Normal')) : null;
    if (ERA_SET.has(cat))
      fullEra.push({ era: cat, band });

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
// PENDIENTE (prioridad Alta): migrar estas 6 al Sheet con fecha real, y que
// el Historial cargue desde ahi ordenado por fecha -- este hardcode
// desaparece cuando eso pase (ver CONTEXTO_TRASPASO).
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
    animStyle: 'cards',
    // No persiste entre recargas -- mismo criterio que theme/devMode (ver
    // comentario junto a I18N mas arriba).
    lang: 'es'
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
  if (pool.length === 0 && (filters.era || filters.calidad)) {
    const usedSet = new Set(state.usedTitles);
    let extra = MAIN_POOL.filter(a => !usedSet.has(a.title));
    if (filters.era) extra = extra.filter(a => a.era === filters.era);
    if (filters.calidad) extra = extra.filter(a => a.band === filters.calidad);
    pool = extra.map(a => ({ era: a.era, band: a.band, used: false }));
  }

  return pool;
}

// Devuelve la banda (Excelente/Buena/Normal) de una ficha. Si ya trae banda fija
// (Dorada/Moderna) la devuelve tal cual. Si es Clasica (band=null):
// - Con filtro de Calidad activo: la banda ya la elegiste vos, la bolsa no
//   participa. Se chequea directo el catalogo real; si no hay oferta, null
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

// EMO_MIN/EMO_MAX: piso y techo de titulos Emotional por mazo de 24. Quien
// decide CUANDO forzar o bloquear es drawNext() (ver mas abajo, necesita
// saberlo ANTES de elegir el token); esta funcion solo aplica el filtro ya
// decidido sobre los candidatos de un token+banda ya resueltos. Si el
// filtro resultante da 0, cede sobre el mismo Era+Banda (Emotional es
// ritmo interno, no un filtro tuyo).
const EMO_MIN = 3, EMO_MAX = 5;
function pickTitleFor(token, band, emoForced, emoBloqueado) {
  const usedSet = new Set(state.usedTitles);
  let candidates = MAIN_POOL.filter(a => a.era === token.era && a.band === band && !usedSet.has(a.title));
  if (candidates.length === 0) return null;

  let filtered = candidates;
  if (emoForced) filtered = candidates.filter(a => a.emotional === true);
  if (emoBloqueado) filtered = candidates.filter(a => a.emotional === false);
  if (filtered.length > 0) candidates = filtered;

  return candidates[Math.floor(Math.random() * candidates.length)];
}

// Empaqueta el resultado final de un sorteo: {token, title} listo para
// mostrar en pantalla y, si se confirma, para pasar a commitPick().
function finishDraw(token, band, emoForced, emoBloqueado) {
  const title = pickTitleFor(token, band, emoForced, emoBloqueado);
  if (!title) return null;
  return { token: { era: token.era, band }, title };
}

// Inicas bandas que tienen titulos Emotional son Excelente y Buena (en cualquier Era) 
const EMO_BANDS = ['Excelente', 'Buena'];

// Sortea la proxima ficha: candidateTokens() ya aplica filtros "Quiero ver"
// y las reglas de racha.
// Excepcion: cuando toca forzar Emotional, se restringe la eleccion a 
// los tokens con banda Excelente/Buena (o Clasica, que puede resolver a esa banda via la bolsa).
// "Buscar de nuevo" llama a esto tal cual, sin bypass de reglas.
function drawNext() {
  const pool = candidateTokens();
  if (pool.length === 0) return null;

  const remaining = state.deck.filter(t => !t.used).length;
  const faltanParaMinimo = EMO_MIN - state.emoCount;
  const emoForced = faltanParaMinimo > 0 && remaining <= (3 * faltanParaMinimo - 2);
  const emoBloqueado = !emoForced && (state.emoCooldown > 0 || state.emoCount >= EMO_MAX);

  let elegibles = pool;
  if (emoForced) {
    const conOferta = pool.filter(t => EMO_BANDS.includes(t.band) || (t.era === 'Clasica' && t.band === null));
    if (conOferta.length > 0) elegibles = conOferta;
  }

  const token = elegibles[Math.floor(Math.random() * elegibles.length)];
  const band = resolveBand(token);
  if (band !== null) {
    const result = finishDraw(token, band, emoForced, emoBloqueado);
    if (result) return result;
  }

  if (emoForced) {
    const usedSet = new Set(state.usedTitles);
    const candidatos = MAIN_POOL.filter(a => EMO_BANDS.includes(a.band) && a.emotional && !usedSet.has(a.title));
    if (candidatos.length > 0) {
      const title = candidatos[Math.floor(Math.random() * candidatos.length)];
      return { token: { era: title.era, band: title.band }, title };
    }
  }
  return null;
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
// existe una real que matchee -- ver mas abajo), descuenta la banda real de
// la bolsa caliente si era Clasica, agrega el titulo a usedTitles y al
// historial, y actualiza los contadores de racha (lastEra/lastEraStreak,
// lastBand/lastBandStreak) y el cooldown de Emotional que usan las reglas
// en la proxima tirada.
function commitPick(pick) {
  state.lastAction = { type: 'ciclo', malId: pick.title.malId, snapshot: snapshotForUndo() };
  const idx = state.deck.findIndex(t => !t.used && t.era === pick.token.era && (t.band === pick.token.band || t.band === null));
  if (idx >= 0) state.deck[idx].used = true;
  // La bolsa caliente es un recurso aparte del mazo: acumula de por vida
  // para mantener las proporciones reales de Clasica en el largo plazo.
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
