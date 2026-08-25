// ============================================================
// Mis Catalogos - Escritura de "Visto" desde la app + registro
// de ediciones manuales
// ============================================================
// doPost: recibe un POST con {malId, visto} desde la app web,
// busca la fila por MAL_ID (columna numerica, a prueba de
// acentos/typos/renombres) y pone Visto=visto (TRUE/FALSE) en
// esa fila. Sirve tanto para "confirmar" (visto=true) como para
// "deshacer" (visto=false) -- misma funcion, un solo parametro
// que cambia.
//
// onEdit: simple trigger que corre solo, sin configurar nada en
// el menu de Triggers. Google NO lo dispara cuando el cambio lo
// hace un script (ni este doPost, ni ningun otro) -- solo cuando
// un humano edita una celda desde la interfaz. Por eso sirve para
// distinguir ediciones manuales sin falsos positivos causados por
// la app. Registra, en la columna UltimaEdicionManual de la fila
// editada, que columna se toco y cuando ("Columna - yyyy-MM-dd
// HH:mm:ss"), sobreescribiendo el valor anterior -- solo importa
// la ultima edicion, no un historial completo.
// ============================================================

const SHEET_NAME = 'Anime';

// Interruptor de registro de ediciones manuales. Poner en false y
// volver a implementar (Implementar > Administrar implementaciones >
// Editar > Nueva version) para editar en bloque sin dejar rastro en
// UltimaEdicionManual. Pendiente aparte: mover esto a una celda de
// configuracion en otra pestaña si hace falta cambiarlo sin tocar
// codigo.
const REGISTRAR_EDICIONES_MANUALES = true;

// Misma logica de parseo que logic.js
function parseMalIds(raw) {
  return String(raw || '').split(', ').map(function (s) { return s.replace(/[^0-9]/g, ''); }).filter(function (s) { return s.length > 0; });
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);

    const malId = String(body.malId || '').replace(/[^0-9]/g, '');
    const visto = !!body.visto;

    if (!malId) {
      return respond({ ok: false, error: 'falta malId' });
    }

    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
    if (!sheet) {
      return respond({ ok: false, error: 'no existe la pestana "' + SHEET_NAME + '"' });
    }

    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const colMalId = headers.indexOf('MAL_ID');
    const colVisto = headers.indexOf('Visto');

    if (colMalId === -1 || colVisto === -1) {
      return respond({ ok: false, error: 'faltan columnas MAL_ID o Visto en la fila 1' });
    }

    for (let i = 1; i < data.length; i++) {
      const idsEnFila = parseMalIds(data[i][colMalId]);
      if (idsEnFila.indexOf(malId) !== -1) {
        sheet.getRange(i + 1, colVisto + 1).setValue(visto);
        return respond({ ok: true, fila: i + 1, malId: malId, visto: visto });
      }
    }

    return respond({ ok: false, error: 'no se encontro el MAL_ID: ' + malId });

  } catch (err) {
    return respond({ ok: false, error: String(err) });
  }
}

// ============================================================
// Registro de ediciones manuales (cualquier columna, pestaña Anime)
// ============================================================
function onEdit(e) {
  if (!REGISTRAR_EDICIONES_MANUALES) return;

  const range = e.range;
  const sheet = range.getSheet();
  if (sheet.getName() !== SHEET_NAME) return;

  const lastCol = sheet.getLastColumn();
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const colLog = headers.indexOf('UltimaEdicionManual');
  if (colLog === -1) return; // falta agregar la columna en el Sheet -- no rompe nada, simplemente no registra

  const startRow = range.getRow();
  const numRows = range.getNumRows();
  const startCol = range.getColumn();
  const numCols = range.getNumColumns();

  const fechaHora = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');

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
      if (!nombreCol || nombreCol === 'UltimaEdicionManual') continue; // no te registres a vos misma
      sheet.getRange(row, colLog + 1).setValue(nombreCol + ' - ' + fechaHora);
    }
  }
}

function respond(obj) {
  // text/plain y no application/json a proposito: evita que el navegador
  // dispare un "preflight" CORS que Apps Script no sabe responder. La app
  // igual puede leer el JSON del texto sin problema.
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}