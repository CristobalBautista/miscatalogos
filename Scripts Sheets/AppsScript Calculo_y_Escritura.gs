function calculateAndSelectFinalValues(entries, nombreMio, actualNombreCheck, actualNombreFinal) {
  // Suma/combina las temporadas en 1 sola fila (pelicula = 3 eps)
  const primera = entries[0];
  const ultima = entries[entries.length - 1]; // MAL_ID en orden cronologico, mas reciente al final
  const completedOnes = entries.filter(e => e.status === "finished_airing");
  const totalEps = completedOnes.length ? completedOnes.reduce((sum, e, index) => {
        return sum + (e.mediaType === "movie" ? 3 : e.episodes || "0");
      }, 0)
    : "Unknown";
  const scoresWithEps = completedOnes
    .filter((e) => e.score)
    .map((e) => ({
      score: e.score,
      episodes: e.mediaType === "movie" ? 3 : e.episodes || "0",
    }));
  const puntajeProm = completedOnes.length
    ? scoresWithEps.reduce((sum, e) => sum + e.score * e.episodes, 0) / totalEps
    : primera.score;
  const generos = [...new Set(entries.flatMap((e) => e.genres))].join(", ");
  const temas = [...new Set(entries.flatMap((e) => e.themes))].join(", ");

 const nombreCheck = compararNombres(nombreMio, primera.titleEn, primera.title, primera.sinonimos, actualNombreCheck);
 const nombreFinal = devolverNombreFinal(nombreMio, primera.titleEn, primera.title, actualNombreCheck, actualNombreFinal);

 return { nombreCheck, nombreFinal, primera, ultima, totalEps, puntajeProm, generos, temas };
}

function putValuesInSheet(sheet, fila, col, finalValues) {
  const primera = finalValues.primera;
  const ultima = finalValues.ultima;
  sheet.getRange(fila, col.MAL_NombreJap + 1).setValue(primera.title || "");
  sheet.getRange(fila, col.MAL_NombreEng + 1).setValue(primera.titleEn || "");
  sheet.getRange(fila, col.MAL_Sinonimos + 1).setValue((primera.sinonimos || []).join("\n"));
  sheet.getRange(fila, col.Nombre_Comparado + 1).setValue(finalValues.nombreCheck);
  sheet.getRange(fila, col.Nombre + 1).setValue(finalValues.nombreFinal);
  sheet.getRange(fila, col.MAL_Eps + 1).setValue(finalValues.totalEps);
  sheet.getRange(fila, col.MAL_PendienteFinalizar + 1).setValue(ultima.status || "");
  sheet.getRange(fila, col.Generos + 1).setValue(finalValues.generos);
  sheet.getRange(fila, col.Temas + 1).setValue(finalValues.temas);
  sheet.getRange(fila, col.FechaInicial + 1).setValue(primera.startDate || "");
  sheet.getRange(fila, col.FechaFinal + 1).setValue(ultima.endDate || "");
  sheet.getRange(fila, col.Poster + 1).setValue(primera.poster || "");
  sheet.getRange(fila, col.PosterMediano + 1).setValue(primera.posterMediano || "");
  sheet.getRange(fila, col.Sinopsis + 1).setValue(primera.sinopsis || "");
  sheet.getRange(fila, col.UltimaLectura + 1).setValue(new Date());
  if (sheet.getSheetName() === "Anime") {
    sheet.getRange(fila, col.Popularidad + 1).setValue(primera.popularidad);
    sheet
      .getRange(fila, col.MAL_Puntaje + 1)
      .setValue(finalValues.puntajeProm.toFixed(2));
  }
  Logger.log(`OK - ${primera.id}. ${primera.titleEn || primera.title || ""}`);
}
