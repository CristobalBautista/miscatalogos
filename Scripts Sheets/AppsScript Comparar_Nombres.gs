// Cascada de comparacion: substring completo -> empieza/termina con -> todas
// las palabras estan contenidas -> alguna palabra esta contenida -> nada.
function compararNombres(mio, ingles, japones, sinonimos, actualNombreCheck) {
  if (actualNombreCheck === "Done") return "Done";

  const norm = s => (s || '').toLowerCase().trim();
  const mioN = norm(mio);
  if (!mioN) return 'FALTA NOMBRE PROPIO';
  const oficiales = [norm(ingles), norm(japones)].filter(Boolean);
  const sinonimosN = (sinonimos || []).map(norm).filter(Boolean);
  if (oficiales.length === 0 && sinonimosN.length === 0) return 'SIN DATO MAL';

  const matchea = c => c.includes(mioN) || mioN.includes(c) || c.startsWith(mioN) || c.endsWith(mioN) || mioN.startsWith(c) || mioN.endsWith(c);

  if (oficiales.some(matchea)) return 'OK';
  if (sinonimosN.some(matchea)) return 'OK (via sinonimo)';

  const palabrasMio = mioN.split(/\s+/).filter(p => p.length > 2);
  const todos = oficiales.concat(sinonimosN);
  const coincidencias = palabrasMio.filter(p => todos.some(c => c.includes(p)));
  if (palabrasMio.length > 0 && coincidencias.length === palabrasMio.length) return 'OK';
  if (coincidencias.length > 0) return 'REVISAR';
  return 'NOMBRE NO COINCIDE, REVISAR MAL_ID';
}

function devolverNombreFinal(mio, ingles, japones, nombreCheck, actual) {
  if (nombreCheck === "Done") return actual;

  if (nombreCheck === "OK" || nombreCheck === 'FALTA NOMBRE PROPIO') {
    return ingles;
  } else {
    return (japones ? japones : mio);
  };
}