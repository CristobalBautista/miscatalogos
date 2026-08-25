// ============================================================
// Mis Catalogos - Enriquecimiento por lote via API oficial de MAL v2
// ============================================================
// Corre a mano desde el editor de Apps Script (elegis la funcion en el
// dropdown de arriba y le das Ejecutar)
//
// Que hace: por cada fila con MAL_ID, le pregunta a la API oficial de MAL
// por cada ID (separados por coma si hay varias temporadas), y llena
// columnas NUEVAS. Client ID de https://myanimelist.net/apiconfig
// (App Type: hobbyist).

const ANIME_SHEET = 'Anime';
const NEW_SEASONS_SHEET = 'Nuevas Temporadas';
const MAL_CLIENT_ID = 'de58a231f54a742f006022e46f47f274';
const MAL_BASE = 'https://api.myanimelist.net/v2/anime/';
const MAL_FIELDS = "alternative_titles,start_date,end_date,synopsis,mean,popularity,media_type,status,genres,num_episodes,pictures";

const SLEEP_MS = 100;
const TIME_BUDGET_MS = 5 * 60 * 1000; // 5 min, deja margen antes del limite de 6 de Apps Script

const APPROVED_GENRES_ID = [1, 2, 4, 7, 8, 10, 14, 22, 24, 30, 36, 37, 41];
const APPROVED_THEMES_ID = [6, 11, 13, 17, 18, 19, 20, 23, 26, 28, 29, 32, 36, 38,
  40, 47, 50, 53, 55, 57, 60, 62, 63, 64, 66, 68, 69, 70, 72, 78, 82];
const GENRES_THEMES_DICTIONARY_SPANISH = {
  1: "Accion", 2: "Aventura", 4: "Comedia", 6: "Mitologia", 7: "Misterio", 8: "Drama", 10: "Fantasia",
  11: "Estrategia", 13: "Historicos", 14: "Terror", 17: "Artes Marciales", 18: "Robots Gigantes",
  19: "Musica", 20: "Parodia", 22: "Romance", 23: "Vida Escolar", 24: "Ciencia Ficcion", 26: "Romance entre Chicas",
  28: "Romance entre Chicos", 29: "Espacial", 30: "Deportes", 32: "Vampiros", 36: "Vida Cotidiana",
  37: "Sobrenatural", 38: "Militar", 40: "Psicológico", 41: "Suspenso", 47: "Gastronomia",
  50: "Protas Adultos", 53: "Cuidado de Niños", 55: "Delincuentes", 57: "Comedia Visual", 60: "Idols",
  62: "Isekai", 63: "Sanar/Pacifico", 64: "Poligono Romantico", 66: "Chicas Mágicas",
  68: "Mafia", 69: "Cultura Otaku", 70: "Artes Escénicas", 72: "Reencarnación",
  78: "Viajes en el Tiempo", 82: "Fantasia Moderna"
}

// Columnas nuevas que este script escribe
const COLS_MAL_CATALOGO = [
  'MAL_ID', "MAL_NombreJap", "MAL_NombreEng", "MAL_Sinonimos", "Nombre_Comparado", "Nombre",
  'Popularidad', 'MAL_Puntaje', 'MAL_Eps', 'MAL_PendienteFinalizar', 'Generos', 'Temas',
  'FechaInicial', 'FechaFinal', 'Poster', 'PosterMediano', 'UltimaLectura', "Sinopsis",
];
const COLS_MAL_NEW_SEASONS = [
  'MAL_ID', "MAL_NombreJap", "MAL_NombreEng", "MAL_Sinonimos", "Nombre_Comparado", "Nombre", "MAL_Eps",
  'MAL_PendienteFinalizar', 'Generos', 'Temas', 'FechaInicial', 'FechaFinal', 'Poster', 'PosterMediano',
  'UltimaLectura', "Sinopsis",
];

// Los 2 modos, elegis cual correr:
function importarTodo() { importarCatalogo(ANIME_SHEET, COLS_MAL_CATALOGO, true); }
function importarPendientes() { importarCatalogo(ANIME_SHEET, COLS_MAL_CATALOGO, false); }
function importarNuevasTemp() { importarCatalogo(NEW_SEASONS_SHEET, COLS_MAL_NEW_SEASONS, true); }

function importarCatalogo(goalSheet, colsRequired, modoCompleto) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(goalSheet);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];

  const col = {};
  colsRequired.forEach(h => col[h] = headers.indexOf(h));
  const faltantes = colsRequired.filter(h => col[h] === -1);
  if (faltantes.length > 0) {
    Logger.log('Faltan estas columnas en el encabezado: ' + faltantes.join(', '));
    return;
  }

  const startTime = Date.now();
  const colNombre = headers.indexOf('NombreMio');
  for (let i = 1; i < data.length; i++) {
    if (Date.now() - startTime > TIME_BUDGET_MS) {
      Logger.log('Tope de tiempo alcanzado.');
      break;
    }
    const fila = i + 1;
    const malIdRaw = String(data[i][col.MAL_ID] || '').trim();
    if (!malIdRaw) continue; // sin MAL_ID, no hay nada que buscar

    const yaLeido = String(data[i][col.UltimaLectura] || '').trim();
    if (!modoCompleto && yaLeido) continue; // incremental: saltar lo ya procesado

    const ids = malIdRaw.split(', ').map(s => s.trim()).filter(Boolean);
    const entries = [];
    for (const id of ids) {
      const e = fetchMAL(id);
      if (e) entries.push(e);
      Utilities.sleep(SLEEP_MS);
    }

    if (entries.length === 0) {
      sheet.getRange(fila, col.UltimaLectura + 1).setValue(""); // UltimaLectura queda vacia. Util para Pendientes.
      continue;
    }

    const nombreMio = String(data[i][colNombre] || '');
    const actualNombreCheck = sheet.getRange(fila, col.Nombre_Comparado + 1).getValue();
    const actualNombreFinal = sheet.getRange(fila, col.Nombre + 1).getValue();
    const finalValues = calculateAndSelectFinalValues(entries, nombreMio, actualNombreCheck, actualNombreFinal);
    putValuesInSheet(sheet, fila, col, finalValues);
  }
}
