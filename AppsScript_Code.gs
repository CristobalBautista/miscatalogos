// ============================================================
// Mis Catalogos - Escritura de "Visto" desde la app
// ============================================================
// Que hace: recibe un POST con {secret, nombre} desde la app web,
// busca esa fila por el valor de la columna "Nombre" y le pone "Y"
// en la columna "Visto". No borra nada, no toca ninguna otra
// columna.
//
// AJUSTA ESTAS 2 LINEAS ANTES DE IMPLEMENTAR:
const SHEET_NAME = 'Anime';       // nombre exacto de la pestana/hoja donde esta tu catalogo
const SECRET = 'CAMBIAME-A-ALGO-TUYO'; // clave simple para que no cualquiera con la URL pueda escribir

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);

    if (body.secret !== SECRET) {
      return respond({ ok: false, error: 'secret invalido' });
    }

    const nombre = (body.nombre || '').trim();
    if (!nombre) {
      return respond({ ok: false, error: 'falta nombre' });
    }

    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
    if (!sheet) {
      return respond({ ok: false, error: 'no existe la pestana "' + SHEET_NAME + '"' });
    }

    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const colNombre = headers.indexOf('Nombre');
    const colVisto = headers.indexOf('Visto');

    if (colNombre === -1 || colVisto === -1) {
      return respond({ ok: false, error: 'faltan columnas Nombre o Visto en la fila 1' });
    }

    for (let i = 1; i < data.length; i++) {
      if (String(data[i][colNombre]).trim() === nombre) {
        sheet.getRange(i + 1, colVisto + 1).setValue('Y');
        return respond({ ok: true, fila: i + 1, nombre: nombre });
      }
    }

    return respond({ ok: false, error: 'no se encontro el titulo: ' + nombre });

  } catch (err) {
    return respond({ ok: false, error: String(err) });
  }
}

function respond(obj) {
  // text/plain y no application/json a proposito: evita que el navegador
  // dispare un "preflight" CORS que Apps Script no sabe responder. La app
  // igual puede leer el JSON del texto sin problema.
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// Funcion de prueba: correla manualmente desde el editor de Apps Script
// (boton Ejecutar, elegis "test") para probar sin tocar la app todavia.
function test() {
  const fakeEvent = {
    postData: {
      contents: JSON.stringify({ secret: SECRET, nombre: 'PONE_AQUI_UN_NOMBRE_REAL_DE_TU_CATALOGO' })
    }
  };
  const result = doPost(fakeEvent);
  Logger.log(result.getContent());
}
