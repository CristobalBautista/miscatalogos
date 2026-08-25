function limpiarSinNombres() {
  const colsALimpiar = [
    'Popularidad', 'MAL_Puntaje', 'MAL_Eps', 'MAL_PendienteFinalizar',
    'Generos', 'Temas', 'FechaInicial', 'FechaFinal', 'Poster', 'PosterMediano', 'UltimaLectura', 'Sinopsis',
  ];
  limpiarColumnasMAL(colsALimpiar)
}

function limpiarColumnasMAL(colsALimpiar) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ANIME_SHEET);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const lastRow = sheet.getLastRow();
  colsALimpiar.forEach(h => {
    const idx = headers.indexOf(h);
    if (idx === -1) { Logger.log('No encontre columna: ' + h); return; }
    sheet.getRange(2, idx + 1, lastRow - 1, 1).clearContent();
  });
  Logger.log('Limpiado: ' + colsALimpiar.join(', '));
}
