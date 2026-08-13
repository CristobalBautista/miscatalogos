// ============================================================
// Mis Catalogos - Escritura de "Visto" desde la app 
// ============================================================
// doPost: recibe un POST con {malId, visto} desde la app web,
// busca la fila por MAL_ID y pone Visto=visto (TRUE/FALSE) en
// esa fila. Sirve tanto para "confirmar" (visto=true) como para
// "deshacer" (visto=false) -- misma funcion, un solo parametro
// que cambia.
// ============================================================

const SHEET_NAME = 'Anime';

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);

    const malId = String(body.malId || '').trim();
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
      if (String(data[i][colMalId]).trim() === malId) {
        sheet.getRange(i + 1, colVisto + 1).setValue(visto);
        return respond({ ok: true, fila: i + 1, malId: malId, visto: visto });
      }
    }

    return respond({ ok: false, error: 'no se encontro el MAL_ID: ' + malId });

  } catch (err) {
    return respond({ ok: false, error: String(err) });
  }
}

function respond(obj) {

  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}