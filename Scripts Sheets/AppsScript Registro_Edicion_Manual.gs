// ============================================================
// Mis Catalogos - Registro de ediciones manuales
// ============================================================
// onEdit: simple trigger que corre solo. Google NO lo dispara cuando el cambio lo
// hace un script (ni este doPost, ni ningun otro) -- solo cuando
// un humano edita una celda desde la interfaz. Por eso sirve para
// distinguir ediciones manuales sin falsos positivos causados por
// la app. Registra, en la columna UltimaEdicionManual de la fila
// editada, que columna se toco y cuando ("Columna - yyyy-MM-dd
// HH:mm:ss"), sobreescribiendo el valor anterior -- solo importa
// la ultima edicion, no un historial completo.
// ============================================================

// Interruptor de registro de ediciones manuales. Poner en false y
// volver a implementar (Implementar > Administrar implementaciones >
// Editar > Nueva version) para editar en bloque sin dejar rastro en
// UltimaEdicionManual. 
const REGISTRAR_EDICIONES_MANUALES = true;
function onEdit(e) {
  if (!REGISTRAR_EDICIONES_MANUALES) return;

  const range = e.range;
  const sheet = range.getSheet();
  if (sheet.getName() !== SHEET_NAME) return;

  const lastCol = sheet.getLastColumn();
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const colLog = headers.indexOf('UltimaEdicionManual');
  if (colLog === -1) return;

  const startRow = range.getRow();
  const numRows = range.getNumRows();
  const startCol = range.getColumn();
  const numCols = range.getNumColumns();

  const fechaHora = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm');

  // Cubre tanto una celda sola como un pegado/arrastre sobre varias filas o
  // columnas a la vez. Si en la MISMA fila se editó más de una columna en
  // el mismo gesto, la celda de log se queda con la última que se procese
  // (a proposito -- solo importa la ultima edicion, no un historial).
  for (let r = 0; r < numRows; r++) {
    const row = startRow + r;
    if (row === 1) continue; // fila de encabezados, no es una fila de datos
    for (let c = 0; c < numCols; c++) {
      const col = startCol + c;
      const nombreCol = headers[col - 1];
      if (!nombreCol || nombreCol === 'UltimaEdicionManual') continue; 
      sheet.getRange(row, colLog + 1).setValue(nombreCol + ' - ' + fechaHora);
    }
  }
}
