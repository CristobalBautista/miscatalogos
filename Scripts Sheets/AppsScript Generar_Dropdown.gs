// Genera un dropdown (validacion de datos) en la columna Nombre de cada
// fila, con las opciones: tu Nombre actual, MAL_NombreJap, MAL_NombreEng,
// y cada sinonimo util (ya deduplicados en MAL_Sinonimos). "Elegir" en vez
// de "escribir/buscar" -- para casos tipo Sailor Moon donde ninguna opcion
// te convence, el dropdown permite igual escribir algo distinto a mano
// (allowInvalid = true), no te encierra.

function generarDropdownsFanName() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME_ENRICH);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];

  const col = {};
  ['NombreMio', 'MAL_NombreJap', 'MAL_NombreEng', 'MAL_Sinonimos', 'Nombre'].forEach(h => col[h] = headers.indexOf(h));
  const faltantes = Object.keys(col).filter(h => col[h] === -1);
  if (faltantes.length > 0) { Logger.log('Faltan columnas: ' + faltantes.join(', ')); return; }

  let generadas = 0;
  for (let i = 1; i < data.length; i++) {
    const mio = String(data[i][col.NombreMio] || '').trim();
    const opciones = [mio]; // tu nombre actual siempre va primero -- "dejar como esta" es 1 clic tambien
    const jap = String(data[i][col.MAL_NombreJap] || '').trim();
    const eng = String(data[i][col.MAL_NombreEng] || '').trim();
    const sinonimos = String(data[i][col.MAL_Sinonimos] || '').split('\n').map(s => s.trim()).filter(Boolean);
    [jap, eng, ...sinonimos].forEach(n => { if (n && !opciones.includes(n)) opciones.push(n); });

    if (opciones.length <= 1) continue; // no hay nada de MAL todavia, no vale la pena poner dropdown

    const fila = i + 1;
    const rule = SpreadsheetApp.newDataValidation()
      .requireValueInList(opciones, true)
      .setAllowInvalid(true) // deja escribir algo distinto a mano si ninguna opcion convence (caso Sailor Moon)
      .build();
    sheet.getRange(fila, col.Nombre + 1).setDataValidation(rule);
    generadas++;
  }
  Logger.log('Dropdowns generados: ' + generadas);
}