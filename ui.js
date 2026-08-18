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
function platformChipsHtml(plat) {
  const keys = detectPlatformKeys(plat);
  if (keys.length === 0) return `<span class="plat-chip"><span>📺 ${esc(plat || 'Sin dato')}</span></span>`;
  return keys.map(k => `<span class="plat-chip">
      <img src="https://cdn.simpleicons.org/${PLATFORM_ICONS[k]}" alt="${k}" onerror="this.outerHTML='${PLATFORM_EMOJI[k]}'">
      <img src="https://thesvg.org/icons/${PLATFORM_ICONS[k]}/default.svg" alt="${k}" onerror="this.outerHTML='${PLATFORM_EMOJI[k]}'">
      <span>${k[0].toUpperCase() + k.slice(1)}</span>
    </span>`).join('');
}
// Igual que platformChipsHtml pero en texto plano (para modales que usan
// textContent, como el de confirmar plataforma al elegir).
function platformPlainNames(plat) {
  const keys = detectPlatformKeys(plat);
  if (keys.length === 0) return plat || 'Sin dato';
  return keys.map(k => k[0].toUpperCase() + k.slice(1)).join(', ');
}

// ============ ARRANQUE DE LA APP ============
// Esto es lo primero que corre (ver el final del archivo). Carga el
// catalogo, recupera el estado guardado (o crea uno nuevo la primera vez),
// aplica el tema y muestra la vista donde el usuario se quedo.
async function loadState() {
  await loadCatalog();
  // Arranca siempre desde el estado inicial (mazo/ciclo/tema/Modo Desarrollador
  // nuevos), y encima le restaura SOLO que series ya se vieron -- ver
  // saveState() en logic.js para el porque de este scope reducido.
  state = seedInitialState();
  try {
    const raw = localStorage.getItem('ruleta-anime-vistas-v1');
    const cache = raw ? JSON.parse(raw) : null;
    const pendingCache = (cache && Array.isArray(cache.pendingConfirms)) ? cache.pendingConfirms : [];
    const { usedTitles: reconciledUsed, pendingConfirms } = reconcilePendingConfirms(pendingCache);
    state.usedTitles = Array.from(new Set([...state.usedTitles, ...reconciledUsed]));
    state.pendingConfirms = pendingConfirms;
    if (cache) {
      if (Array.isArray(cache.largaUsed)) state.largaUsed = cache.largaUsed;
      if (Array.isArray(cache.adultoUsed)) state.adultoUsed = cache.adultoUsed;
      if (Array.isArray(cache.repUsed)) state.repUsed = cache.repUsed;
    }
    saveState(); // persiste ya podado (pendingConfirms sin las entradas vencidas)
  } catch (e) { console.error(e); }
  applyTheme(state.theme);
  document.getElementById('view-loading').classList.add('hidden');
  history.replaceState({ view: 'home' }, '', '#home');
  showView('home', false);
  render();
}

// ============ TEMA DE COLOR ============
function applyTheme(t) {
  document.documentElement.setAttribute('data-theme', t);
}

function ntAvailableList() { return NUEVAS_TEMP.filter(nt => nt.finished && !state.seenNT.includes(nt.title)); }

/* ============ MODO DESARROLLADOR: deslizadores de color -- COMENTADO ============
   Colores ya definidos (ver :root/[data-theme=light] en styles.css). Se deja
   todo este sistema comentado en vez de borrado para poder reactivarlo facil
   el dia que se quiera volver a ajustar algun color -- solo hay que
   descomentar este bloque Y el bloque correspondiente en index.html
   (buscar "DESLIZADORES DE COLOR -- COMENTADO" ahi tambien).

// ============ MODO DESARROLLADOR: deslizadores de color (solo visual, no
// persiste) ============
//
// COMO FUNCIONA (para poder editarlo a mano sin depender de mi):
// Cada color se arma en formato HSL: hsl(matiz, saturacion%, luminosidad%)
//   - Matiz (0-360): la posicion en el circulo de colores. Es LO UNICO que
//     mueve el deslizador. 0=rojo, 60=amarillo, 120=verde, 180=turquesa,
//     240=azul, 300=magenta, 360=rojo de nuevo.
//   - Saturacion (0-100%): que tan "vivo"/puro es el color. 100%=caricatura,
//     0%=gris puro sin importar el matiz. Fija en HUE_SAT abajo.
//   - Luminosidad (0-100%): que tan claro u oscuro. 50% es el color mas
//     puro de ese matiz. ACA es donde viven el cafe, el vino oscuro, el
//     verde olivo -- todos son matices normales con luminosidad BAJA
//     (~20-30%). Fija en HUE_LIGHT_DARK/HUE_LIGHT_LIGHT abajo.
// Como el deslizador solo mueve el matiz (para que sea 1 solo control, no
// 3), la luminosidad/saturacion quedan fijas -- por eso nunca aparece un
// cafe con el deslizador solo. Si queres agregar esos tonos: bajá
// HUE_LIGHT_DARK (ej. de 62 a 30) y vas a ver cafes/vinos/olivos en todo el
// circulo en vez de los tonos "vivos" actuales. Podes hacer esto por
// separado para cada color si queres variedad (cada slider ya usa su propia
// funcion "fn", basta con darle su propia luminosidad fija).
const HUE_SAT = 62;          // saturacion de todos los sliders de matiz (0-100)
const HUE_LIGHT_DARK = 62;   // luminosidad en tema oscuro -- bajar = mas oscuro/cafe/vino, subir = mas pastel
const HUE_LIGHT_LIGHT = 40;  // luminosidad en tema claro (mismo criterio)
function hueToColor(value, theme) {
  if (value < 4) return theme === 'light' ? 'hsl(0,0%,35%)' : 'hsl(0,0%,60%)';
  const hue = ((value - 4) / 96) * 360;
  const light = theme === 'light' ? HUE_LIGHT_LIGHT : HUE_LIGHT_DARK;
  return `hsl(${hue.toFixed(0)}, ${HUE_SAT}%, ${light}%)`;
}
function hueColorName(value) {
  if (value < 4) return 'Gris';
  const hue = ((value - 4) / 96) * 360;
  if (hue < 15 || hue >= 345) return 'Rojo';
  if (hue < 40) return 'Naranja';
  if (hue < 65) return 'Dorado / Amarillo';
  if (hue < 95) return 'Verde lima';
  if (hue < 155) return 'Verde';
  if (hue < 185) return 'Turquesa';
  if (hue < 220) return 'Celeste';
  if (hue < 250) return 'Azul';
  if (hue < 280) return 'Violeta';
  if (hue < 310) return 'Morado';
  if (hue < 330) return 'Magenta';
  return 'Rosa';
}
// Dorada es especial: NO recorre el circulo completo (pedido explicito), es
// un unico matiz fijo (42=dorado) donde el deslizador mueve saturacion y
// luminosidad juntas -- "muy dorado" (vivo, saturado) a "poco dorado"
// (palido, casi gris amarillento).
const DORADA_HUE = 42;
function doradaToColor(value, theme) {
  const sat = 25 + (value / 100) * 60;
  const light = theme === 'light' ? (26 + (value / 100) * 18) : (46 + (value / 100) * 22);
  return `hsl(${DORADA_HUE}, ${sat.toFixed(0)}%, ${light.toFixed(0)}%)`;
}
function doradaColorName(value) {
  if (value < 25) return 'Poco dorado';
  if (value < 55) return 'Dorado suave';
  if (value < 80) return 'Dorado';
  return 'Muy dorado';
}
// Recomendados: matices bien separados entre si para que Era y Tipo nunca
// se vean parecidos en el marco del poster (que combina ambos en gradiente).
// Dorada bien dorada, Clasica ~304 (morado-vino), Excelente ~357 (rojo),
// Buena ~214 (azul), Normal = gris, Tags ~264 (morado, igual al acento
// actual) -- Moderna se deja fija, sin deslizador.
const COLOR_SLIDERS = {
  dorada: { varName: '--dorada', fn: doradaToColor, nameFn: doradaColorName, recommended: 70, value: 70 },
  clasica: { varName: '--clasica', fn: hueToColor, nameFn: hueColorName, recommended: 84, value: 84 },
  excelente: { varName: '--band-excelente', fn: hueToColor, nameFn: hueColorName, recommended: 98, value: 98 },
  buena: { varName: '--band-buena', fn: hueToColor, nameFn: hueColorName, recommended: 60, value: 60 },
  normal: { varName: '--band-normal', fn: hueToColor, nameFn: hueColorName, recommended: 0, value: 0 },
  tags: { varName: '--tag-color', fn: hueToColor, nameFn: hueColorName, recommended: 74, value: 74 },
};
function sliderElFor(key) { return document.getElementById('slider' + key.charAt(0).toUpperCase() + key.slice(1)); }
function nameElFor(key) { return document.getElementById('name' + key.charAt(0).toUpperCase() + key.slice(1)); }
function applyColorSlider(key, value) {
  const cfg = COLOR_SLIDERS[key];
  cfg.value = value;
  const cssColor = cfg.fn(value, state.theme);
  document.documentElement.style.setProperty(cfg.varName, cssColor);
  const nameEl = nameElFor(key);
  if (nameEl) nameEl.textContent = `${cfg.nameFn(value)} — ${cssColor}`;
}
function reapplyColorSliders() {
  Object.keys(COLOR_SLIDERS).forEach(key => applyColorSlider(key, COLOR_SLIDERS[key].value));
}
Object.keys(COLOR_SLIDERS).forEach(key => {
  const el = sliderElFor(key);
  el.value = COLOR_SLIDERS[key].value;
  el.addEventListener('input', () => applyColorSlider(key, parseInt(el.value, 10)));
});
document.getElementById('recomendarColoresBtn').addEventListener('click', () => {
  Object.keys(COLOR_SLIDERS).forEach(key => {
    const rec = COLOR_SLIDERS[key].recommended;
    sliderElFor(key).value = rec;
    applyColorSlider(key, rec);
  });
  toast('Colores recomendados aplicados');
});

*/

// ============ NAVEGACION ENTRE VISTAS ============
// Solo hay 5 pantallas (home/anime/nt/ciclo/lista) y se muestran/ocultan
// con la clase .hidden -- no hay routing de verdad, es una sola pagina.
// fadeToView() hace un fundido antes de cambiar (se usa al confirmar una
// eleccion, para que se sienta como que "se guarda y vuelve").
async function fadeToView(name) {
  const wrap = document.querySelector('.wrap');
  wrap.style.transition = 'opacity .45s';
  wrap.style.opacity = '0';
  await wait(450);
  showView(name);
  await wait(60);
  wrap.style.opacity = '1';
}

function showView(name, pushHistory = true) {
  if (state.view === 'ciclo' && name !== 'ciclo') {
    drawGen++; // invalida cualquier animacion/sorteo en curso (ver playRevealAnimation)
    state.pendingPick = null; // se descarta sin commitear -- drawNext() no toca el mazo hasta Confirmar, asi que es seguro
    state.extra = null;
  }
  state.view = name;
  ['home', 'anime', 'nt', 'ciclo', 'lista'].forEach(v => {
    document.getElementById('view-' + v).classList.toggle('hidden', v !== name);
  });
  window.scrollTo(0, 0);
  if (name === 'anime') renderAnimeLanding();
  if (name === 'nt') renderNuevasTemp();
  if (name === 'lista') renderListaCompleta();
  if (name === 'ciclo') {
    render();
  }
  saveState();
  // Boton Atras de Android / navegador: cada vista nueva empuja un estado al
  // historial. Cuando el usuario usa el boton fisico Atras (o el gesto en
  // Android), el navegador dispara "popstate" con el estado anterior en vez
  // de cerrar la app -- lo escuchamos mas abajo y solo hacemos render (sin
  // volver a empujar, para no crear un loop). pushHistory=false es lo que
  // usa ese listener para evitar el loop.
  if (pushHistory && (!history.state || history.state.view !== name)) {
    history.pushState({ view: name }, '', '#' + name);
  }
}
window.addEventListener('popstate', (e) => {
  const v = (e.state && e.state.view) || 'home';
  showView(v, false);
});
document.getElementById('goAnime').addEventListener('click', () => showView('anime'));
document.getElementById('goLive').addEventListener('click', () => toast('Próximamente'));
document.getElementById('goMovies').addEventListener('click', () => toast('Próximamente'));
// CARTOON (Cartoon Mañana): boton deshabilitado por ahora -- la data va a
// venir de una tabla/CSV separada de catalogo.csv, todavia no existe.
document.getElementById('goCartoon').addEventListener('click', () => toast('Próximamente'));
document.getElementById('backHomeFromAnime').addEventListener('click', () => showView('home'));
document.getElementById('backAnimeFromNT').addEventListener('click', () => showView('anime'));
document.getElementById('backAnimeFromCiclo').addEventListener('click', () => showView('anime'));
document.getElementById('animeGoCicloBtn').addEventListener('click', () => {
  state.pendingPick = null;
  document.getElementById('cardArea').innerHTML = '<div class="card-empty">Presiona "Elegir siguiente" para empezar</div>';
  showView('ciclo');
});
document.getElementById('animeGoNTBtn').addEventListener('click', () => showView('nt'));
document.getElementById('animeGoListaBtn').addEventListener('click', () => showView('lista'));
document.getElementById('backAnimeFromLista').addEventListener('click', () => showView('anime'));
// Nota: el viejo boton "Cartoon" de ANIME (que en realidad disparaba el
// sorteo de Cartoon Adulto por error) se quito. Cartoon Adulto sigue
// accesible como siempre via el gate de fin de ciclo y el pill "¿Ahora si
// Adulta?" -- no se perdio ningun acceso, solo el atajo mal etiquetado.


// ============ CONFIGURACION (modal + Modo Desarrollador) ============
document.getElementById('openConfig').addEventListener('click', () => {
  document.getElementById('devModeToggle').checked = !!state.devMode;
  document.getElementById('themeToggle').checked = state.theme === 'dark-purple';
  document.getElementById('configModal').classList.remove('hidden');
});
document.getElementById('closeConfig').addEventListener('click', () => {
  document.getElementById('configModal').classList.add('hidden');
});
// Cerrar tambien tocando el fondo oscuro (fuera de modal-box) -- solo si el
// click fue directo sobre el overlay, no sobre algo adentro de la caja.
document.getElementById('configModal').addEventListener('click', (e) => {
  if (e.target.id === 'configModal') document.getElementById('configModal').classList.add('hidden');
});
document.getElementById('devModeToggle').addEventListener('change', (e) => {
  state.devMode = e.target.checked;
  saveState();
  renderDevPanel();
});
// Item 2: tema (oscuro/claro) ahora vive en Configuracion, no en Home. Sigue
// siendo un toggle simple porque solo hay 2 temas hoy -- "mas adelante sera
// otra cosa" si se agregan mas temas.
document.getElementById('themeToggle').addEventListener('change', (e) => {
  state.theme = e.target.checked ? 'dark-purple' : 'light';
  applyTheme(state.theme);
  saveState();
});

function toast(msg) {
  const t = document.createElement('div');
  t.textContent = msg;
  t.style.cssText = 'position:fixed;bottom:30px;left:50%;transform:translateX(-50%);background:var(--panel2);color:var(--text);padding:10px 18px;border-radius:100px;font-size:13px;border:1px solid var(--line);z-index:999;';
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 1500);
}


// ============ PANTALLA ANIME: historial + botones ============
function renderAnimeLanding() {
  const avail = ntAvailableList();
  document.getElementById('animeGoNTBtn').classList.toggle('hidden', avail.length === 0);
  renderHistoryTable();
  document.getElementById('undoLink').classList.toggle('hidden', !state.lastAction);
}
// Quita el prefijo "Era " de ERA_LABELS solo para esta tabla -- la columna
// ya se llama "Era", repetirlo en cada fila es redundante (ej. "Dorada" en
// vez de "Era Dorada"). El resto de la app (tag de revelado, panel dev)
// sigue usando ERA_LABELS completo tal cual, sin tocar.
function eraShortLabel(era) {
  return (ERA_LABELS[era] || era).replace(/^Era\s+/i, '');
}
function renderHistoryTable() {
  const body = document.getElementById('histBody');
  if (state.history.length === 0) {
    body.innerHTML = `<tr><td colspan="5" style="color:var(--dim); text-align:center; padding:18px 6px;">Nada elegido aún</td></tr>`;
    return;
  }
  body.innerHTML = state.history.map((h, i) => `
    <tr class="${i === 0 ? 'latest' : ''}">
      <td class="col-img"><div class="hist-thumb">🎬</div></td>
      <td class="name-cell">${esc(h.title)}</td>
      <td><span class="era-cell"><span class="dot ${h.era}"></span>${esc(eraShortLabel(h.era))}</span></td>
      <td>${esc(h.band || '')}</td>
      <td class="col-emo">${h.emotional ? '<span style="color:var(--emo);">♥</span>' : ''}</td>
    </tr>
  `).join('');
}
function renderMiniHist() {
  const el = document.getElementById('miniHist');
  if (!el) return;
  if (state.history.length === 0) { el.innerHTML = '<div style="color:var(--dim); font-size:12.5px;">Nada elegido aún</div>'; return; }
  el.innerHTML = state.history.slice(0, 10).map((h, i) => `
    <div class="mini-hist-item ${i === 0 ? 'latest' : ''}">
      <span class="mini-hist-dot ${h.era}"></span>
      <span class="mini-hist-title">${esc(h.title)}</span>
      ${h.emotional ? '<span class="mini-hist-heart">♥</span>' : ''}
    </div>
  `).join('');
}

// ============ VER LISTA COMPLETA ============
// Grilla de tarjetas (estilo MyAnimeList / Nuevas Temporadas) de TODO el
// catalogo valido (Era + Larga/Adulto/Repetir), incluyendo lo no disponible
// y lo pendiente de estreno -- se muestran con flags, no se esconden (salvo
// que el usuario apague "Mostrar no disponibles" desde el filtro). Tocar una
// tarjeta disponible y sin pendiente elige ese titulo directo (fuera del
// mazo del ciclo). Tocar una NO disponible abre un modal informativo sin
// accion. Tocar una pendiente-de-estreno pero disponible abre un modal de
// confirmacion ("¿arrancar igual?"). Columnas (2/3/4) y mostrar/ocultar no
// disponibles se guardan en state.listaCols / state.listaShowUnavail
// (preferencia de la sesion actual, no sobrevive a un F5 -- ver saveState).
function catKeyFor(categoria) {
  return categoria === 'Adulto' ? 'adulto' : categoria === 'Larga' ? 'larga' : 'repetir';
}
function renderListaCompleta() {
  const grid = document.getElementById('listaGrid');
  const cols = state.listaCols || 2;
  ['listaColsBtn2', 'listaColsBtn3', 'listaColsBtn4'].forEach(id => {
    document.getElementById(id).classList.toggle('active', parseInt(document.getElementById(id).dataset.cols, 10) === cols);
  });
  grid.classList.toggle('cols-3', cols === 3);
  grid.classList.toggle('cols-4', cols === 4);
  document.getElementById('listaShowUnavailToggle').checked = state.listaShowUnavail !== false;

  // union de todo lo ya elegido: titulos de Era (state.usedTitles) + los 3
  // arrays de extras (adultoUsed/largaUsed/repUsed), para que Lista Completa
  // no vuelva a ofrecer algo que ya se marco como visto/usado.
  const usedSet = new Set([
    ...state.usedTitles,
    ...(state.adultoUsed || []), ...(state.largaUsed || []), ...(state.repUsed || [])
  ]);
  let items = LISTA_COMPLETA_POOL.filter(a => !usedSet.has(a.title));
  if (state.listaShowUnavail === false) items = items.filter(a => a.available);
  items = items.slice().sort((a, b) => a.title.localeCompare(b.title));
  if (items.length === 0) {
    grid.innerHTML = '<div style="grid-column:1/-1; padding:20px; text-align:center; color:var(--dim);">Sin títulos pendientes.</div>';
    return;
  }
  grid.innerHTML = items.map((a, idx) => {
    const posterHtml = a.poster
      ? `<img src="${esc(a.poster)}" alt="" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement('span'),{textContent:'🎬'}))">`
      : '🎬';
    return `
    <button class="lista-card${a.available ? '' : ' disabled'}" data-idx="${idx}">
      <div class="lista-poster">
        ${posterHtml}
      </div>
      <div class="lista-card-body">
        <div class="lista-card-title">${esc(a.title)}</div>
      </div>
    </button>`;
  }).join('');
  grid.querySelectorAll('.lista-card').forEach(card => {
    card.addEventListener('click', () => {
      const item = items[parseInt(card.dataset.idx, 10)];
      if (item) onListaCardTap(item);
    });
  });
}
['listaColsBtn2', 'listaColsBtn3', 'listaColsBtn4'].forEach(id => {
  document.getElementById(id).addEventListener('click', (e) => {
    state.listaCols = parseInt(e.target.dataset.cols, 10);
    saveState(); renderListaCompleta();
  });
});
document.getElementById('listaShowUnavailToggle').addEventListener('change', (e) => {
  state.listaShowUnavail = e.target.checked;
  saveState(); renderListaCompleta();
});
function openListaFilterDrawer() {
  document.getElementById('listaFilterDrawer').classList.remove('hidden');
  document.getElementById('listaFilterBackdrop').classList.remove('hidden');
}
function closeListaFilterDrawer() {
  document.getElementById('listaFilterDrawer').classList.add('hidden');
  document.getElementById('listaFilterBackdrop').classList.add('hidden');
}
document.getElementById('listaFilterToggle').addEventListener('click', () => {
  const isHidden = document.getElementById('listaFilterDrawer').classList.contains('hidden');
  if (isHidden) openListaFilterDrawer(); else closeListaFilterDrawer();
});
// Backdrop real (no un truco de eventos): mientras el drawer esta abierto,
// este div cubre toda la pantalla POR ENCIMA de las tarjetas (pero debajo
// del propio drawer). El toque nunca llega a ninguna tarjeta -- ni :active,
// ni click, ni seleccion -- porque desde el navegador el toque cae sobre el
// backdrop, no sobre la tarjeta. Se cierra en pointerdown (toque inicial),
// asi que mantener presionado sin soltar tambien cierra al instante.
document.getElementById('listaFilterBackdrop').addEventListener('pointerdown', closeListaFilterDrawer);
// Boton flotante "volver arriba": solo aparece cuando hay algo de scroll
// hecho en la pestaña Lista Completa.
window.addEventListener('scroll', () => {
  if (state.view !== 'lista') return;
  const btn = document.getElementById('listaBackTopBtn');
  btn.classList.toggle('hidden', window.scrollY < 300);
});
document.getElementById('listaBackTopBtn').addEventListener('click', () => {
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

// Decide que pasa al tocar una tarjeta de Lista Completa, segun sus flags.
// Prioridad: no disponible > pendiente de estreno > seleccion normal --
// si no esta disponible no importa si tambien esta pendiente, gana el
// mensaje de no-disponible.
function onListaCardTap(item) {
  if (!item.available) {
    const note = unavailableNote(item.plataforma);
    showInfoModal({
      title: 'No disponible',
      message: 'No disponible en plataformas. Lo siento.' + (note ? ` (${note})` : ''),
      buttons: [{ label: 'Entendido' }]
    });
    return;
  }
  if (item.pending) {
    showInfoModal({
      title: 'Nueva temporada',
      message: 'Está estrenando o falta estrenar una nueva temporada. ¿Quieres arrancar aun así?',
      buttons: [
        { label: 'Sí, arrancar', action: () => confirmPlatformThen(item) },
        { label: 'Cancelar' }
      ]
    });
    return;
  }
  confirmPlatformThen(item);
}
// Antes de confirmar de verdad, muestra donde esta disponible para verla
// (plataforma) y pide un OK explicito -- "al momento de seleccionar" (item 7
// de la ultima ronda). item.plataforma puede venir vacio en Larga/Adulto/
// Repetir sin dato cargado; en ese caso el mensaje lo aclara.
function confirmPlatformThen(item) {
  showInfoModal({
    title: item.title,
    message: item.plataforma ? 'Disponible en: ' + platformPlainNames(item.plataforma) : 'Sin plataforma registrada.',
    buttons: [
      { label: 'OK, elegir esta', action: () => commitFromLista(item) },
      { label: 'Cancelar' }
    ]
  });
}

// Confirma la seleccion de un item de Lista Completa, ya sea de Era
// (selectFromLista, existente) o de Larga/Adulto/Repetir (via commitExtra
// de logic.js, para que respete sus propios arrays de usados y no
// desincronice el gate del ciclo).
async function commitFromLista(item) {
  if (item.era) {
    await selectFromLista(item);
  } else {
    const catKey = catKeyFor(item.categoria);
    state.lastAction = {
      type: 'lista-extra', malId: item.malId, snapshot: JSON.parse(JSON.stringify({
        history: state.history, adultoUsed: state.adultoUsed, largaUsed: state.largaUsed,
        repUsed: state.repUsed, owed: state.owed
      }))
    };
    commitExtra(catKey, item);
    syncVistoRemote(item.malId, true);
    saveState();
    await fadeToView('anime');
  }
}

// ============ MODAL INFORMATIVO (no disponible / pendiente de estreno) ============
function showInfoModal({ title, message, buttons }) {
  document.getElementById('infoModalTitle').textContent = title;
  document.getElementById('infoModalMsg').textContent = message;
  const btnsWrap = document.getElementById('infoModalBtns');
  btnsWrap.innerHTML = '';
  buttons.forEach((b, i) => {
    const btn = document.createElement('button');
    btn.className = i === 0 && buttons.length > 1 ? 'btn-extra' : (buttons.length === 1 ? 'btn-block' : 'btn-ghost');
    btn.textContent = b.label;
    btn.addEventListener('click', () => {
      hideInfoModal();
      if (b.action) b.action();
    });
    btnsWrap.appendChild(btn);
  });
  document.getElementById('infoModal').classList.remove('hidden');
}
function hideInfoModal() {
  document.getElementById('infoModal').classList.add('hidden');
}
// Cerrar tocando el fondo oscuro, igual que configModal -- sin accion (se
// comporta como "Cancelar").
document.getElementById('infoModal').addEventListener('click', (e) => {
  if (e.target.id === 'infoModal') hideInfoModal();
});

async function selectFromLista(item) {
  state.lastAction = {
    type: 'lista', malId: item.malId,
    snapshot: JSON.parse(JSON.stringify({ history: state.history, usedTitles: state.usedTitles, pendingConfirms: state.pendingConfirms }))
  };
  state.usedTitles.push(item.title);
  state.pendingConfirms.push({ title: item.title, malId: item.malId, ts: Date.now() });
  state.history.unshift({ title: item.title, era: item.era, band: item.band, emotional: item.emotional });
  syncVistoRemote(item.malId, true);
  saveState();
  await fadeToView('anime');
}
document.getElementById('undoLink').addEventListener('click', () => {
  if (!state.lastAction) return;
  const malId = state.lastAction.malId;
  Object.assign(state, state.lastAction.snapshot);
  state.lastAction = null;
  if (malId) syncVistoRemote(malId, false);
  saveState();
  renderAnimeLanding();
});


// ============ NUEVAS TEMPORADAS ============
// Tarjetas de las series con temporada nueva ya terminada. Igual que Lista
// Completa, elegir una no consume ficha del mazo -- es prioridad aparte.
function renderNuevasTemp() {
  const grid = document.getElementById('ntGrid');
  const avail = ntAvailableList();
  if (avail.length === 0) {
    grid.innerHTML = `<div style="grid-column:1/-1; text-align:center; color:var(--dim); padding:20px;">No hay temporadas nuevas listas por ahora.</div>`;
    return;
  }
  grid.innerHTML = avail.map(nt => {
    const posterHtml = nt.poster
      ? `<img src="${esc(nt.poster)}" alt="" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement('span'),{textContent:'🎬'}))">`
      : '🎬';
    return `
    <button class="nt-card" data-title="${esc(nt.title)}">
      <div class="nt-poster">${posterHtml}</div>
      <div class="nt-card-body">
        <div class="nt-card-title">${esc(nt.title)}</div>
        <div class="nt-card-meta">${esc(nt.eps)} eps</div>
      </div>
    </button>`;
  }).join('');
  grid.querySelectorAll('.nt-card').forEach(card => {
    card.addEventListener('click', () => {
      const nt = NUEVAS_TEMP.find(x => x.title === card.dataset.title);
      if (nt) selectNuevaTemp(nt);
    });
  });
}

async function selectNuevaTemp(nt) {
  state.lastAction = { type: 'nt', snapshot: JSON.parse(JSON.stringify({ history: state.history, seenNT: state.seenNT })) };
  state.seenNT.push(nt.title);
  state.history.unshift({ title: nt.title, era: 'Extra', band: 'Nueva Temporada', emotional: false });
  saveState();
  await fadeToView('anime');
}

// ---------------- core draw logic (ver logic.js) ----------------


// ============ ANIMACION DEL DADO ============
// Gira un dado 3D (rotaciones random en X/Y) durante ~1.9s antes de
// revelar el resultado real. Es puramente decorativo -- el resultado ya
// se calcula con drawNext()/drawExtra() de logic.js, el dado solo genera
// la pausa dramatica.
// ---------------- animacion de revelado ("tarjetas girando" con signo de
// interrogacion) ----------------
// Vive DENTRO de #cardArea (ya no en un contenedor separado tipo diceWrap)
// -- asi no hay 2 elementos distintos que se desplacen uno al otro cuando
// aparece/desaparece, es el mismo espacio todo el tiempo.
const REVEAL_MARK = '？'; // el mismo signo (el del centro de las 3 opciones) para las 3 cartas
function buildRevealHTML() {
  return `<div class="anim-cards-row" id="animCardsRow">` +
    [0, 1, 2].map(i => `<div class="anim-card-big c${i + 1}"><span class="anim-card-q">${REVEAL_MARK}</span></div>`).join('') +
    `</div>`;
}
// Item bug 1: cada sorteo (Elegir siguiente / Buscar de nuevo) tiene un
// "token" de generacion. Si el usuario navega fuera de Ciclo mientras un
// sorteo esta en curso (girando o revelando), showView() invalida el token
// -- y esta funcion, y startDrawNormal/startDrawExtra, chequean el token en
// cada punto de espera y abortan sin tocar mas la UI/estado si ya no es el
// sorteo vigente. Asi, re-entrar a Ciclo siempre muestra el estado inicial.
let drawGen = 0;
async function playRevealAnimation(myGen) {
  const cardArea = document.getElementById('cardArea');
  cardArea.innerHTML = buildRevealHTML();
  await wait(30); // que el navegador registre el estado inicial antes de animar
  if (myGen !== drawGen) return false;
  await wait(2000); // giro
  if (myGen !== drawGen) return false;
  document.getElementById('animCardsRow').classList.add('fade-out'); // 0.5s de fade-out -> 2.5s total
  await wait(500);
  if (myGen !== drawGen) return false;
  cardArea.innerHTML = ''; // limpio -- setupCardSkeleton() arma el poster despues de esto
  await wait(350); // pausa antes de que el poster empiece su propio fade-in (pedido: 0.25-0.5s)
  return myGen === drawGen;
}


// ============ REVELADO DE LA TARJETA ============
// Orden: Poster -> Era/Tipo/Emotional -> Nombre -> Generos+Temas (fusionados,
// siempre texto plano) -> Sinopsis. Fundidos escalonados (no todo de golpe),
// para que se sienta como una revelacion.
function setupCardSkeleton() {
  document.getElementById('cardArea').innerHTML = `
    <div class="card-poster-frame" id="rvPosterFrame"><div class="card-poster" id="rvPoster"></div></div>
    <div class="card-tags" id="rvTags"></div>
    <div class="card-title" id="rvTitle"></div>
    <div class="card-nota" id="rvNota"></div>
    <div class="card-genres" id="rvGenres"></div>
    <div class="card-plat" id="rvPlat"></div>
    <div class="card-sinopsis-wrap" id="rvSinopsisWrap"></div>
  `;
}
function addTag(container, text, cls) {
  const span = document.createElement('span');
  span.className = 'tag ' + cls;
  span.textContent = text;
  container.appendChild(span);
  requestAnimationFrame(() => span.classList.add('fade-in'));
}
// Colores para el marco del poster: gradiente Era (arriba-izq) -> Tipo
// (abajo-der). Clasica no tiene Tipo fijo por mazo visible aca (se resuelve
// en resolveBand antes de llegar a esta pantalla, asi que pick.token.band
// siempre viene ya resuelto -- Clasica igual tiene Tipo real en este punto).
function posterFrameGradient(era, band) {
  const eraVar = '--' + era.toLowerCase();
  const bandVar = '--band-' + (band || 'normal').toLowerCase();
  return `linear-gradient(135deg, var(${eraVar}), var(${bandVar}))`;
}
// Item 3: generos+temas fusionados, SIEMPRE texto plano (ya no hay toggle de
// pastillas). Los episodios van como texto normal pegado al inicio del mismo
// parrafo (no en un contenedor flex aparte) para que el wrap sea natural:
// "24 eps ·" nunca se mueve de la primera linea, y si hay muchos generos el
// sobrante pasa solo a la siguiente linea -- en vez de que TODO el bloque de
// generos salte de linea como pasaba con el flex+span-unico de antes.
function renderGenresThemes(container, t) {
  const all = [
    ...(t.generos ? t.generos.split(',') : []),
    ...(t.temas ? t.temas.split(',') : [])
  ].map(s => s.trim()).filter(Boolean);
  const epsHtml = `<span class="card-eps-plain">${t.eps} eps</span>`;
  const sepHtml = `<span class="card-eps-sep">·</span>`;
  container.innerHTML = all.length > 0
    ? `${epsHtml} ${sepHtml} <span class="card-genres-plain">${all.map(g => esc(g)).join(' · ')}</span>`
    : epsHtml;
  container.classList.add('fade-in');
}
async function revealPickNormal(pick) {
  setupCardSkeleton();
  const t = pick.title;
  const posterFrame = document.getElementById('rvPosterFrame');
  const posterEl = document.getElementById('rvPoster');
  const tags = document.getElementById('rvTags');
  const titleEl = document.getElementById('rvTitle');
  const genresEl = document.getElementById('rvGenres');
  const notaEl = document.getElementById('rvNota');
  const platEl = document.getElementById('rvPlat');
  const sinopsisWrap = document.getElementById('rvSinopsisWrap');

  // Se muestra la Era/Tipo REAL del titulo (t.era/t.band), no el balde
  // original pedido (pick.token.era/band) -- ver el comentario en
  // finishDraw() de logic.js: pueden no coincidir cuando el sorteo tuvo que
  // relajar Era/Banda (solo pasa sin filtro activo), y mostrar el balde
  // pedido en vez del real era justo el bug reportado ("Era Clasica -
  // Normal" en un titulo que en realidad era Moderna).
  posterFrame.style.background = posterFrameGradient(t.era, t.band);
  scrollToCicloTitle();
  posterEl.innerHTML = t.poster
    ? `<img src="${esc(t.poster)}" alt="" onerror="this.replaceWith(Object.assign(document.createElement('span'),{textContent:'🎬'}))">`
    : '🎬';
  posterFrame.classList.add('fade-in');
  await wait(150);
  addTag(tags, ERA_LABELS[t.era] || t.era, 'era-' + t.era);
  await wait(500);
  addTag(tags, t.band, 'band-' + t.band);
  await wait(500);
  if (t.emotional) { addTag(tags, 'Emotional', 'emo'); await wait(300); }
  titleEl.textContent = t.title;
  titleEl.classList.add('fade-in');
  if (t.nota) {
    notaEl.innerHTML = `⚠ ${esc(t.nota)}`;
    notaEl.classList.add('fade-in', 'has-content');
  }
  await wait(200);
  renderGenresThemes(genresEl, t);
  await wait(200);
  platEl.innerHTML = platformChipsHtml(t.plataforma);
  platEl.classList.add('fade-in');
  if (t.sinopsis) {
    sinopsisWrap.innerHTML = `<div class="card-sinopsis clamped" id="rvSinopsisText">${esc(t.sinopsis)}</div>
      <span class="card-sinopsis-toggle" id="rvSinopsisToggle" role="button" tabindex="0">Ver más</span>`;
    sinopsisWrap.classList.add('fade-in');
    document.getElementById('rvSinopsisToggle').addEventListener('click', () => {
      const el = document.getElementById('rvSinopsisText');
      const btn = document.getElementById('rvSinopsisToggle');
      const stillClamped = el.classList.toggle('clamped');
      btn.textContent = stillClamped ? 'Ver más' : 'Ver menos';
    });
  }
}

async function revealPickExtra(item, cat) {
  setupCardSkeleton();
  const posterFrame = document.getElementById('rvPosterFrame');
  const posterEl = document.getElementById('rvPoster');
  const tags = document.getElementById('rvTags');
  const titleEl = document.getElementById('rvTitle');
  const platEl = document.getElementById('rvPlat');
  const label = cat === 'adulto' ? 'Adulto' : cat === 'larga' ? 'Larga' : 'Repetición';
  posterFrame.style.background = 'linear-gradient(135deg, var(--accent), var(--accent))';
  posterEl.innerHTML = '🎬';
  posterFrame.classList.add('fade-in');
  await wait(150);
  addTag(tags, label, 'era-Extra');
  await wait(500);
  if (item.emotional) { addTag(tags, 'Emotional', 'emo'); await wait(300); }
  titleEl.textContent = item.title;
  titleEl.classList.add('fade-in');
  platEl.innerHTML = platformChipsHtml(item.plataforma) + `<span class="plat-eps">${item.eps} eps</span>`;
  platEl.classList.add('fade-in');
}

// ============ RESET DE ESTADO (solo local, no toca Sheets) ============
// Vuelve `state` al estado inicial hardcodeado en seedInitialState() de
// logic.js (historial hasta Kakegurui) -- el mismo que tendria una
// instalacion nueva de la app. No borra ni cambia nada en el Google Sheet
// (eso se edita a mano si hace falta), y no redefine el mazo -- usa el mismo
// freshDeck() de siempre, solo vuelve a marcar las mismas 6 fichas usadas
// que ya trae seedInitialState(). Preferencias de UI (Modo Desarrollador,
// tema, columnas de Lista Completa) se preservan a proposito para no
// interrumpir la sesion de pruebas que dispara el reset.
function resetStateToInitial() {
  const keepDevMode = state.devMode;
  const keepTheme = state.theme;
  const keepListaCols = state.listaCols;
  state = seedInitialState();
  state.devMode = keepDevMode;
  state.theme = keepTheme;
  state.listaCols = keepListaCols;
  saveState();
  render();
}
document.getElementById('resetStateBtn').addEventListener('click', () => {
  showInfoModal({
    title: 'Reiniciar estado',
    message: 'Vuelve el mazo, historial y contadores al estado inicial de prueba (hasta Kakegurui). No borra ni cambia nada en el Google Sheet. ¿Confirmas?',
    buttons: [
      { label: 'Sí, reiniciar', action: () => { resetStateToInitial(); toast('Estado reiniciado'); } },
      { label: 'Cancelar' }
    ]
  });
});

function disableAllActionButtons(disabled) {
  ['nextBtn', 'redoBtn', 'confirmBtn', 'continueExtraBtn',
    'gateAdultoBtn', 'gateLargaBtn', 'gateRepBtn', 'gateContinueBtn'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.disabled = disabled;
    });
  document.querySelectorAll('.pill').forEach(p => p.disabled = disabled);
}


// Item 6: al Elegir/Buscar de nuevo, el scroll apunta al titulo "Ruleta de
// Anime" (no al tope absoluto 0,0) -- asi si hay algo de header/status bar
// arriba, el titulo queda visible como referencia en vez de quedar tapado.
function scrollToCicloTitle() {
  const el = document.getElementById('cicloTitle');
  el.scrollIntoView({ behavior: "smooth" })
}

// ============ FLUJO: SORTEO NORMAL DEL CICLO ============
// Boton "Elegir siguiente": gira el dado, calcula el pick con drawNext(),
// lo muestra, y deja los botones Confirmar/Buscar de nuevo listos.
async function startDrawNormal() {
  scrollToCicloTitle();
  disableAllActionButtons(true);
  document.getElementById('normalRow').classList.add('hidden');
  document.getElementById('confirmRow').classList.add('hidden');
  document.getElementById('gateBox').classList.add('hidden');
  const myGen = ++drawGen;
  const ok = await playRevealAnimation(myGen);
  if (!ok) return; // se cancelo (se navego afuera de Ciclo mientras giraba)

  let result = drawNext();
  if (!result) {
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
  await revealPickNormal(result);
  if (myGen !== drawGen) return; // se cancelo mientras se revelaba
  state.pendingPick = result;
  saveState();
  document.getElementById('confirmRow').classList.remove('hidden');
  disableAllActionButtons(false);
}
document.getElementById('nextBtn').addEventListener('click', startDrawNormal);
document.getElementById('redoBtn').addEventListener('click', async () => {
  if (state.extra) {
    await startDrawExtra(state.extra.category, state.extra.fromGate);
  } else {
    state.pendingPick = null;
    await startDrawNormal();
  }
});
document.getElementById('confirmBtn').addEventListener('click', async () => {
  if (state.extra) {
    const cat = state.extra.category;
    const fromGate = state.extra.fromGate;
    const titleConfirmado = state.extra.item.title;
    commitExtra(cat, state.extra.item);
    syncVistoRemote(state.extra.item.malId, true);
    state.extra = null;
    document.getElementById('confirmRow').classList.add('hidden');
    document.getElementById('continueExtraRow').classList.add('hidden');
    if (!fromGate) { saveState(); await fadeToView('anime'); return; }
    const stillOwed = state.owed.adulto || state.owed.larga || state.owed.repeticion;
    if (!(state.blocking && stillOwed)) {
      state.blocking = false;
      startNewCycle();
    }
    saveState();
    await fadeToView('anime');
    return;
  }
  const titleConfirmado = state.pendingPick.title.title;
  syncVistoRemote(state.pendingPick.title.malId, true);
  commitPick(state.pendingPick);
  document.getElementById('confirmRow').classList.add('hidden');
  const remaining = state.deck.filter(t => !t.used).length;
  if (remaining === 0) {
    state.owed.adulto = true;
    state.owed.larga = true;
    if (state.cycleNum % REP_EVERY === 0) state.owed.repeticion = true;
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
async function startDrawExtra(cat, fromGate) {
  scrollToCicloTitle();
  disableAllActionButtons(true);
  state.extra = { category: cat, fromGate: !!fromGate };
  document.getElementById('gateBox').classList.add('hidden');
  document.getElementById('normalRow').classList.add('hidden');
  document.getElementById('confirmRow').classList.add('hidden');
  document.getElementById('continueExtraRow').classList.add('hidden');
  const myGen = ++drawGen;
  const ok = await playRevealAnimation(myGen);
  if (!ok) return; // se cancelo (se navego afuera de Ciclo mientras giraba)

  const item = drawExtra(cat);
  if (!item) { toast('Sin títulos en esta categoría'); state.extra = null; render(); disableAllActionButtons(false); return; }
  await revealPickExtra(item, cat);
  if (myGen !== drawGen) return; // se cancelo mientras se revelaba
  state.extra.item = item;
  saveState();
  document.getElementById('confirmRow').classList.remove('hidden');
  document.getElementById('continueExtraRow').classList.toggle('hidden', !state.extra.fromGate);
  disableAllActionButtons(false);
}
document.getElementById('gateAdultoBtn').addEventListener('click', () => startDrawExtra('adulto', true));
document.getElementById('gateLargaBtn').addEventListener('click', () => startDrawExtra('larga', true));
document.getElementById('gateRepBtn').addEventListener('click', () => startDrawExtra('repeticion', true));
document.getElementById('gateContinueBtn').addEventListener('click', () => {
  state.blocking = false; state.extra = null;
  startNewCycle();
  document.getElementById('gateBox').classList.add('hidden');
  document.getElementById('normalRow').classList.remove('hidden');
  saveState(); render();
});
document.getElementById('continueExtraBtn').addEventListener('click', () => {
  state.blocking = false; state.extra = null;
  startNewCycle();
  document.getElementById('confirmRow').classList.add('hidden');
  document.getElementById('continueExtraRow').classList.add('hidden');
  document.getElementById('normalRow').classList.remove('hidden');
  saveState(); render();
});


// ============ PILLS DE OBLIGACIONES PENDIENTES ============
// Si el usuario eligio "Mejor continuar ciclo" en vez de resolver Adulto/
// Larga/Repetir cuando tocaba, queda pendiente y aparece como boton
// flotante hasta que se resuelva.
function renderPendingPills() {
  const row = document.getElementById('pendingRow');
  row.innerHTML = '';
  if (state.blocking || state.pendingPick || state.extra) { row.classList.add('hidden'); return; }
  if (state.owed.adulto) {
    const b = document.createElement('button'); b.className = 'pill'; b.textContent = '¿Ahora sí Adulta?';
    b.addEventListener('click', () => startDrawExtra('adulto', false));
    row.appendChild(b);
  }
  if (state.owed.larga) {
    const b = document.createElement('button'); b.className = 'pill'; b.textContent = '¿Ahora sí Larga?';
    b.addEventListener('click', () => startDrawExtra('larga', false));
    row.appendChild(b);
  }
  if (state.owed.repeticion) {
    const b = document.createElement('button'); b.className = 'pill'; b.textContent = '¿Ahora sí Repetir?';
    b.addEventListener('click', () => startDrawExtra('repeticion', false));
    row.appendChild(b);
  }
  row.classList.toggle('hidden', row.children.length === 0);
}


// ============ MODO DESARROLLADOR: cuadritos de cupos del mazo ============
// Dibuja usando el mazo real (state.deck) y la bolsa caliente de Clasica
// (state.clasicaBag), asi que si cambia el catalogo esto se actualiza solo,
// sin tocar nada aca:
// 1) Cupos por Era (proporcional real sobre MAZO_SIZE=24), coloreado con el
//    color de cada era, se apaga el cuadrito cuando esa ficha ya se uso.
// 2) Cupos por Tipo (Excelente/Buena/Normal) dentro de Dorada y Moderna, tambien
//    proporcional real. Clasica no tiene tipo fijo POR MAZO (se resuelve al
//    usarse, desde su bolsa caliente aparte), por eso sus cuadritos de este
//    bloque van en un color neutro.
// 3) Bolsa caliente de Clasica: cuantos Excelente/Buena/Normal reales quedan sin
//    usar en la bolsa completa (dura muchos mazos, se ve aparte del mazo actual).
// Item 1: DEV MODE ahora es un drawer flotante (igual patron que QUIERO
// VER/Lista Completa) -- no empuja el resto de la pantalla. El boton solo
// se muestra si Modo Desarrollador esta prendido en Configuracion; tocarlo
// abre/cierra el drawer, y tocar afuera lo cierra (y cierra QUIERO VER si
// estaba abierto, para que no queden los 2 drawers superpuestos).
document.getElementById('devToggle').addEventListener('click', () => {
  const panel = document.getElementById('devPanel');
  const isHidden = panel.classList.contains('hidden');
  panel.classList.toggle('hidden');
  document.getElementById('devToggle').textContent = isHidden ? 'DEV MODE ▾' : 'DEV MODE ▸';
  document.getElementById('qvDrawer').classList.add('hidden');
  document.getElementById('qvToggle').textContent = 'QUIERO VER ▸';
});
document.addEventListener('click', (e) => {
  const panel = document.getElementById('devPanel');
  const toggleBtn = document.getElementById('devToggle');
  if (!panel.classList.contains('hidden') && !panel.contains(e.target) && e.target !== toggleBtn) {
    panel.classList.add('hidden');
    toggleBtn.textContent = 'DEV MODE ▸';
  }
});

function renderDevPanel() {
  const toggleBtn = document.getElementById('devToggle');
  toggleBtn.classList.toggle('hidden', !state.devMode);
  if (!state.devMode) { document.getElementById('devPanel').classList.add('hidden'); return; }
  const block = document.getElementById('devEraBlock');

  function tokensFor(era, band) {
    return state.deck.filter(t => t.era === era && (band === null ? t.band === null : t.band === band));
  }
  function sqHtml(tokens, colorVar) {
    return tokens.map(t => `<div class="dev-sq${t.used ? ' off' : ''}" style="background:var(${colorVar})"></div>`).join('');
  }

  let html = `<div class="dev-panel-title" style="margin-bottom:8px;">Por Era (mazo de ${state.deck.length})</div>`;
  const { eraCounts } = computeCatalogStats();
  const disponiblesPorEra = era => MAIN_POOL.filter(a => a.era === era).length;
  html += ERA_ORDER.map(era => {
    const tokens = state.deck.filter(t => t.era === era);
    return `<div class="dev-era-row"><div class="dev-era-label">${ERA_LABELS[era] || era}</div>
      <div class="dev-sq-group">${sqHtml(tokens, '--' + era.toLowerCase())}</div>
      <div class="dev-era-count">${disponiblesPorEra(era)}/${eraCounts[era] || 0} disp.</div></div>`;
  }).join('');

  html += '<div class="dev-panel-title" style="margin:16px 0 8px;">Por Tipo (Excelente / Buena / Normal)</div>';
  html += ['Dorada', 'Moderna'].map(era => {
    const groups = BAND_ORDER.map(band => {
      const colorVar = band === 'Excelente' ? '--band-excelente' : band === 'Buena' ? '--band-buena' : '--band-normal';
      return sqHtml(tokensFor(era, band), colorVar);
    }).join('<span style="width:6px;display:inline-block;"></span>');
    return `<div class="dev-era-row"><div class="dev-era-label">${ERA_LABELS[era] || era}</div>
      <div class="dev-sq-group">${groups}</div></div>`;
  }).join('');
  // Clasica dentro del mazo actual: sin sub-reparto fijo -- cuadritos neutros.
  html += `<div class="dev-era-row"><div class="dev-era-label">${ERA_LABELS['Clasica']}</div>
    <div class="dev-sq-group">${sqHtml(tokensFor('Clasica', null), '--dim')}</div></div>`;

  html += `<div class="dev-band-legend">
    <div class="dev-legend-item"><span class="dev-legend-dot" style="background:var(--band-excelente)"></span>Excelente</div>
    <div class="dev-legend-item"><span class="dev-legend-dot" style="background:var(--band-buena)"></span>Buena</div>
    <div class="dev-legend-item"><span class="dev-legend-dot" style="background:var(--band-normal)"></span>Normal</div>
  </div>`;

  // Bolsa caliente de Clasica: independiente del mazo, dura muchos mazos.
  const bag = state.clasicaBag || [];
  const bagLeft = band => bag.filter(t => t.band === band && !t.used).length;
  const bagTotal = band => bag.filter(t => t.band === band).length;
  html += `<div class="dev-panel-title" style="margin:16px 0 8px;">Bolsa caliente Clásica (independiente del mazo)</div>
    <div class="dev-era-row"><div class="dev-era-label" style="width:auto;">Excelente ${bagLeft('Excelente')}/${bagTotal('Excelente')} · Buena ${bagLeft('Buena')}/${bagTotal('Buena')} · Normal ${bagLeft('Normal')}/${bagTotal('Normal')}</div></div>`;

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
function renderFilterPanel() {
  const panel = document.getElementById('filterPanel');
  panel.classList.toggle('hidden', !state.devMode);
  const filters = state.filters || {};
  document.querySelectorAll('.fp-pill[data-group="era"]').forEach(p => {
    p.classList.toggle('active', filters.era === p.dataset.value);
  });
  document.querySelectorAll('.fp-pill[data-group="calidad"]').forEach(p => {
    p.classList.toggle('active', filters.calidad === p.dataset.value);
  });
  document.querySelectorAll('.fp-pill[data-group="genero"]').forEach(p => {
    p.classList.toggle('active', (filters.generos || []).includes(p.dataset.value));
  });
}
document.querySelectorAll('.fp-pill').forEach(pill => {
  pill.addEventListener('click', () => {
    const group = pill.dataset.group;
    const val = pill.dataset.value;
    if (!state.filters) state.filters = { era: null, calidad: null, generos: [] };
    if (group === 'genero') {
      // multi-select stub: se marca visualmente, sin efecto en el sorteo
      // todavia (no hay columna de Genero en el CSV).
      const idx = state.filters.generos.indexOf(val);
      if (idx >= 0) state.filters.generos.splice(idx, 1); else state.filters.generos.push(val);
    } else {
      // era/calidad: excluyente -- tocar la misma que ya estaba activa la apaga.
      state.filters[group] = (state.filters[group] === val) ? null : val;
    }
    saveState();
    renderFilterPanel();
  });
});
document.getElementById('qvToggle').addEventListener('click', () => {
  const drawer = document.getElementById('qvDrawer');
  const isHidden = drawer.classList.contains('hidden');
  drawer.classList.toggle('hidden');
  document.getElementById('qvToggle').textContent = isHidden ? 'QUIERO VER ▾' : 'QUIERO VER ▸';
  document.getElementById('devPanel').classList.add('hidden');
  document.getElementById('devToggle').textContent = 'DEV MODE ▸';
});
document.addEventListener('click', (e) => {
  const drawer = document.getElementById('qvDrawer');
  const toggleBtn = document.getElementById('qvToggle');
  if (!drawer.classList.contains('hidden') && !drawer.contains(e.target) && e.target !== toggleBtn) {
    drawer.classList.add('hidden');
    toggleBtn.textContent = 'QUIERO VER ▸';
  }
});

// ============ RENDER GENERAL DE LA VISTA CICLO ============
function render() {
  disableAllActionButtons(false); // siempre reactivar al (re)entrar a Ciclo -- evita que queden pegados en disabled si se navega afuera a mitad de un flujo
  renderStats();
  renderPendingPills();
  renderGateOrNormal();
  renderMiniHist();
  renderDevPanel();
  renderFilterPanel();
}
function renderStats() {
  document.getElementById('statPos').textContent = state.deck.filter(t => t.used).length + '/' + state.deck.length;
  document.getElementById('statEmo').textContent = state.emoCount + '/5';
  document.getElementById('statCycleN').textContent = state.cycleNum;
}
function renderGateOrNormal() {
  const gateBox = document.getElementById('gateBox');
  const normalRow = document.getElementById('normalRow');
  const confirmRow = document.getElementById('confirmRow');
  const continueExtraRow = document.getElementById('continueExtraRow');

  if (state.extra) { return; }
  if (state.pendingPick) {
    normalRow.classList.add('hidden'); gateBox.classList.add('hidden');
    confirmRow.classList.remove('hidden');
    return;
  }
  if (state.blocking) {
    normalRow.classList.add('hidden'); confirmRow.classList.add('hidden');
    continueExtraRow.classList.add('hidden');
    gateBox.classList.remove('hidden');
    document.getElementById('gateAdultoBtn').classList.toggle('hidden', !state.owed.adulto);
    document.getElementById('gateLargaBtn').classList.toggle('hidden', !state.owed.larga);
    document.getElementById('gateRepBtn').classList.toggle('hidden', !state.owed.repeticion);
    document.getElementById('cardArea').innerHTML = '<div class="card-empty">Ciclo completo</div>';
    return;
  }
  gateBox.classList.add('hidden'); confirmRow.classList.add('hidden');
  continueExtraRow.classList.add('hidden');
  normalRow.classList.remove('hidden');
  if (!document.getElementById('rvTitle')) {
    document.getElementById('cardArea').innerHTML = '<div class="card-empty">Presiona "Elegir siguiente" para empezar</div>';
  }
}

loadState();
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => { }); });
}
