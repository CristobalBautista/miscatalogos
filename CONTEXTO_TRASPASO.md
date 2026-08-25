# CONTEXTO TRASPASO 5 — Mis Catálogos / Ruleta de Anime - 5.0

Pegar como primer mensaje del chat nuevo, junto con los archivos de código actuales como adjuntos: `index.html`, `logic.js`, `ui.js`, `styles.css`, `AppsScript_Marcar_Visto.gs`. Absorber como contexto completo sin pedir que se repita nada de esto.

## Qué es esto

PWA personal (Diego + esposa Camila) para elegir qué anime ver, con una "ruleta" que sortea el siguiente título respetando proporciones de Era (Dorada/Moderna/Clásica) y Calidad (Excelente/Buena/Normal), más categorías aparte (Adulto/Larga/Repetir) ofrecidas como "extras" ocasionales. El catálogo vive en Google Sheets (pestaña `Anime` + pestaña `Nuevas Temporadas`), publicado como CSV. La escritura de vuelta al Sheet (marcar `Visto`) va por un Apps Script Web App.

## Estado: MVP cerrado, sin bloqueantes abiertos

Con esta sesión se cierra el MVP completo, incluido el scroll (último ítem pendiente). Quedan mejoras de producto identificadas pero ninguna bloquea el uso diario — ver tabla de pendientes.

# Decisiones cerradas (no reabrir sin motivo nuevo)

- MVP asume disponibilidad real siempre — sin reintento general para "este token no tiene oferta". Única excepción: Emotional forzado (caso conocido de antemano, no disponibilidad general).
- Colchón de reconciliación Sheet/local: 1 minuto.

## Preferencias de conversación
- No generar código hasta que el usuario lo pida explícitamente.
- No terminar respuestas con preguntas ni proponer pasos no solicitados
- Antes de dar por cerrado un bug, simular con las funciones REALES del código (no una reconstrucción aproximada) y mostrar los resultados numéricos.
- Verbosidad media a alta cuando el tema lo amerita (el usuario prefiere explicaciones completas y concisas, no recortadas ni extendidas).

## Esquema de columnas del Sheet

**Pestaña `Anime`**: `Nombre`, `Categoria` (Dorada/Moderna/Clasica/Adulto/Larga/Repetir), `MAL_ID` (puede traer varios separados por ", ", el primero es el canónico), `Calificacion`, `PendienteTemporada` ("X"), `Plataforma`, `Eps`, `Emotional` ("X"), `Poster`, `PosterMediano`, `Nombre_Streaming`, `Sinopsis`, `Generos`, `Temas`, `Notas`, `Visto` (checkbox TRUE/FALSE, fuente de verdad real), `UltimaEdicionManual` (columna + fecha/hora de la última edición manual).

**Pestaña `Nuevas Temporadas`** (otro `gid`): `Nombre`, `MAL_Eps`, `FechaFinalizacion`.

El orden de columnas no importa (parseo por nombre de header, no por posición).

## Pendientes (prioridad de Diego, ordenados por categoría)

**Superior**
- Actualizar íconos de plataformas
- Ordenar proyecto en carpetas/archivos
- TMDB para obtener data de series no ANIME
- Migrar historial a Sheets (Estado/fechas) + sacar hardcode de 6 series semilla
- Imagen de "Viendo ahora" en Pantalla ANIME
- Se puede soportar varias series "Viendo" en simultáneo
- Botón desplegar/colapsar historial
- MarcarVisto.gs: reintento y notificación de fallo: Podria seleccionarla y si falla el servicio reintentarlo nuevamente en otro momento. En caso de fallo recurrente enviar notificacion solo a mi (no esposa) de actualizacion manual en Sheets y revisar motivo fallo.
- TMDB para disponibilidad real: verificación doble: subtítulos ES + todas las temporadas — de esto depende también la lista completa de plataformas para el punto de config global.

**Alta**
- Filtro de Género real (hoy solo UI, no filtra)
- Recalcular `EMO_MIN` / evaluar sacar `EMO_MAX` (necesita curar Emotional primero): Filtrar Emotional sobre el total disponible, sacar el %, y que ese % determine la cadencia (reemplaza el 20% fijo, no convive con él). Ejemplo dado por el usuario: si Emotional es 33% del catálogo, cadencia ~1 cada 3 series; si es 10%, ~1 cada 10, respetando igual el cooldown de 2 tiradas entre Emotional. Falta implementar.
- Curación de la columna Emotional en el catálogo real
- Botón "No quiero Emotional" durante forzado (diseño ya acordado)
- Modal Lista Completa: agregar sinopsis/género, no solo plataforma (hoy el modal "Disponible en: X — OK/Cancelar" solo muestra plataforma).

**Media**
- Historial tabla: nombre 2 líneas / ancho columna Era (nombre a 2 líneas, decidir qué pasa si no alcanza (3ra línea / ellipsis / tooltip al toque), o ajustar ancho de columna Era sin cortar "Moder...". Abierto, sin resolver)
- Agrandar texto de sinopsis en tarjeta
- Botones toggle "¿Ahora sí Larga/Adulta?" con arrepentimiento:  con estado toggle — al presionar, si el usuario se arrepiente, un botón con cambio de estado ("Larga todavía no, mejor") que apague la búsqueda específica sin perder el "owed"; solo una puede estar activa a la vez; si se apaga, sigue buscando en el ciclo normal.
- Exportar listas MAL para auditar catálogo (Diego y Camila) para auditar qué falta agregar al catálogo — el objetivo es verificar pendientes en Plan to Watch/Watched, NO llenar un historial pasado (MAL ya lo tiene).
- Series vistas marcadas visualmente en Lista Completa - decisión confirmada: sí, quedan visibles con marca distinta (razón: posible repetir manualmente a futuro, o agregar a Repetir). Falta decidir el estilo exacto (se sugirió borde de color antes que fondo, para no competir con el póster).
- "¿Candidato a Repetir?" al terminar - agregar elemento "¿Candidato a Repetir?" con botones Sí/No — si Sí, se agrega automáticamente al pool de Repetir.
- Sinopsis: traducir antes que acortar
- Config global de plataformas activas/inactivas: Guardar SIEMPRE la plataforma real de cada título en el Sheet (ej. Naruto = Prime Video), pero tener un flag de configuración aparte que indique si esa plataforma la tienen contratada AHORA MISMO o no. Si la plataforma real está marcada como "no la tengo ahora", el título no debería contar como disponible. Preguntas abiertas del usuario, sin resolver: ¿se guarda en otra pestaña del Excel? ¿la lista de plataformas se arma con TODAS las que resulten del análisis pendiente de TMDB? — queda para diseñar en el chat nuevo.
- Mostrar estado de emisión en la tarjeta: ("No ha estrenado" / "No ha terminado") usando MAL_PendienteFinalizar, reusando el mecanismo de Nota importante ya construido.

**Baja**
- Soporte multi-usuario MAL (Camila + amigos)
- Responsive de escritorio con layout distinto al de celular (detectar PWA instalada vía window.matchMedia('(display-mode: standalone)').matches; el layout en sí son media queries CSS normales, no depende de si está instalada).
- Fuegos artificiales en Nuevas Temporadas cuando hay disponibles (constante, pocos pero suficientes, en contraste con el tema).
- Modo claro: más contraste: no blanco puro, más contraste en bordes para que todo se note más fácil.
- Sistema de "Mensajes" en pantalla principal (ícono de alerta discreto)

**Mínima**
- REP_EVERY=3 arbitrario, evaluar lógica derivada
- Modo Agregar_Relacionados / Agregar Series
- related_anime de MAL para multi-temporada
- Múltiples imágenes por serie
- Notificación de actualización de la PWA
- Pestañas Películas/Series/Cartoons (hoy deshabilitadas)
- Curador de Descargas - Notificación/cadencia de descarga de series
- Tema visual MAL / mazo semanal automático / idiomas EN-SRB / undo multinivel / historial editable
- Mínimo garantizado 1 slot por Era

**Sin prioridad asignada por Diego todavía**
- Evaluar `usedTitles`/historial: nombre → `MAL_ID` (junto con la migración de historial a Sheets)
- Mood (reviews/cringe intencional) — en pausa
- Botón Atrás Android: mejorar manejo
- Sin mensaje de error visible si falla la carga del catálogo
- Consolidar duplicación de código entre `candidateTokens`/`resolveBand`/`pickTitleFor`/`drawNext`
- Comentario desactualizado en `ui.js` (`revealPickNormal`)
- Filtros y Sorting en Lista Completa 
- Busqueda texto en Lista Completa

**Ideas aleatorias**
- Analizar si se incremento el tamaño de MAIN_POOL a 571