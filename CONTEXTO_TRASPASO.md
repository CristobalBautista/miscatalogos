# 📋 Contexto — Ruleta de Anime / Mis Catálogos 4.0

**Pegar este documento como primer mensaje del chat nuevo, junto con los archivos adjuntos actuales:** `index.html`, `styles.css`, `logic.js`, `ui.js`.

---

## Arquitectura actual

- PWA estática (sin backend propio), hosteada en Netlify conectado a GitHub.
- **Lectura del catálogo:** `logic.js` hace `fetch()` a `CATALOGO_URL` (Sheet publicado como CSV vía Archivo → Compartir → Publicar en la web → CSV).
- **Nuevas Temporadas:** migrado a Sheets también (`NUEVAS_TEMP_URL`, mismo patrón, pestaña distinta). Columnas esperadas ahí: `Nombre`, `Eps`, `FechaFinalizacion`.
- **Escritura de "Visto":** Web App de Apps Script (`Marcar_Visto.gs`) — la app hace POST fire-and-forget al confirmar una elección, marca `Visto=Y` en la fila. No bloquea la UI, no espera confirmación de éxito.
- **Batch de enriquecimiento:** Apps Script aparte (corrida manual), trae datos de la API oficial de MAL v2 (sinopsis, géneros, temas, poster, etc.).

## 🔴 BUG CRÍTICO ENCONTRADO — pendiente de implementar (diagnóstico y propuesta ya cerrados, código NO tocado todavía)

**El síntoma:** el Sheet nunca se lee como fuente de verdad, solo se escribe. Todo lo que decide "esto ya lo vi" vive en `state.usedTitles`, cacheado en `localStorage` en el dispositivo — sin ninguna comparación posterior contra el Sheet real. Con el tiempo esto excluyó títulos (caso confirmado: Clásica) que en el Sheet figuran como no vistos — el usuario lo confirmó imprimiendo `state` en consola.

**Propuesta cerrada (pendiente de codear):**
1. `loadCatalog()` debe leer la columna `Visto`/`Estado` del Sheet y armar `usedTitles` desde ahí — el Sheet manda, siempre.
2. `localStorage` pasa a ser un **puente optimista reconciliable**, no una memoria permanente: sigue viviendo en localStorage (para sobrevivir un F5 inmediato después de elegir, mientras el CSV publicado de Google todavía no se actualizó — ese delay no está documentado por Google, hay que medirlo a mano: marcar algo, refrescar el CSV publicado directo y ver cuánto tarda en reflejarse). Cada entrada local se poda cuando el Sheet la confirma.
3. **Corrección importante sobre el punto 2** (objeción válida del usuario): la entrada local NO puede quedarse pegada para siempre si el Sheet nunca la confirma (ej. el POST falló en silencio, o alguien edita el Sheet a mano revirtiendo la fila). Necesita un **vencimiento por tiempo**, no solo por confirmación — después de una ventana generosa sin confirmación del Sheet, se le cree al Sheet tal cual esté en ese momento, aunque diga "no visto". Falta definir el número exacto de esa ventana (depende de la medición del punto 1).
4. **Limitación de fondo aceptada, no resuelta:** el puente local resuelve el F5 inmediato de un mismo dispositivo, pero NO resuelve dos dispositivos (el celular de Diego y el de Camila) usando la app al mismo tiempo dentro de la ventana de cache de Google — ahí sí se podrían cruzar y ofrecer lo mismo a los dos. Es una limitación de fondo de usar un CSV publicado (eventualmente consistente, no tiempo real) — resolverlo del todo requeriría cambiar el mecanismo de lectura (ej. consultar un Web App de Apps Script bajo demanda en vez de CSV publicado con cache), que es un cambio de alcance mayor, no una corrección chica. Queda como riesgo aceptado por ahora, no como pendiente activo, salvo que el usuario decida lo contrario.
5. Recomendado como parche antes version final: limpiar la columna `Visto` en el Sheet a mano ahora mismo.
8. Aclaración sobre las herramientas de Modo Desarrollador ya existentes: **"Reiniciar estado" NO es equivalente a F5**. Reiniciar estado solo reemplaza el `state` en memoria por el estado semilla (historial hasta Kakegurui), preservando tema/Modo Desarrollador — no vuelve a leer el catálogo del Sheet, usa el que ya está cargado en memoria. F5 sí dispara el flujo completo real (recarga catálogo + reconstruye estado) — es el que hay que usar para probar comportamiento real, y fue el que expuso este bug.

## Pendiente relacionado — nueva idea del usuario (agregar a pendientes, no diseñado todavía)

**Config global de plataformas de streaming activas/inactivas:** guardar SIEMPRE la plataforma real de cada título en el Sheet (ej. Naruto = Prime Video), pero tener un flag de configuración aparte (personal o compartido — el usuario aclaró que su esposa también debe poder cambiarlo) que indique si esa plataforma la tienen contratada AHORA MISMO o no. Si la plataforma real está marcada como "no la tengo ahora", el título no debería contar como disponible aunque su columna Plataforma diga que sí. Preguntas abiertas del usuario, sin resolver: ¿se guarda en otra pestaña del Excel? ¿la lista de plataformas se arma con TODAS las que resulten del análisis pendiente de TMDB? — queda para diseñar en el chat nuevo.

## Cadencia de Emotional — pendiente de implementar (diseño cerrado)

Hoy `EMO_MIN=3`, `EMO_MAX=5` son constantes fijas, y la probabilidad de "querer" Emotional en una tirada no forzada es un `20%` fijo (`Math.random() < 0.20`) — ninguno de los dos números sale de datos reales del catálogo, son arbitrarios.

**Diseño acordado:** calcular en vivo — filtrar Emotional sobre el total disponible, sacar el %, y que ese % determine la cadencia (reemplaza el 20% fijo, no convive con él). Ejemplo dado por el usuario: si Emotional es 33% del catálogo, cadencia ~1 cada 3 series; si es 10%, ~1 cada 10, respetando igual el cooldown de 2 tiradas entre Emotional. Falta implementar.

**Nota de diseño ya resuelta:** Larga/Adulto/Repetir se dejan **100% aleatorios**, sin forzado de Emotional — decisión ya tomada porque esas son elecciones deliberadas (el usuario las pide a propósito tocando un botón)

**Hallazgo técnico sin corregir (bajo impacto, detectado por revisión de código + simulación):** en `pickTitleFor()`, cuando el sistema *fuerza* Emotional (`emoForced`) pero el balde exacto Era+Tipo de esa tirada no tiene ningún título Emotional disponible sin ver, el forzado se cae en silencio — no reintenta con otro balde, elige cualquier cosa de ese balde igual. En la simulación con datos sintéticos parejos (18% Emotional por casillero) esto no se disparó ni una vez en 100 ciclos, pero si el catálogo real tiene casilleros con muy pocos o cero títulos Emotional, ahí sí podría explicar reportes tipo "no me forzó Emotional en 20 tiradas". No es urgente, pero queda documentado para no repetir el análisis de cero.

## Bugs reales encontrados y no corregidos en esta sesión (código YA aplicado, confirmado con simulación del código real)

- **RELAJAR**. El usuario aun insiste que relajar no tiene sentido.
  - Si se usa filtro especifico, se debe devolver de lo disponible. Si no hay nada disponible, devuelve no hay resultados.
  - Si se esta buscando por la ruleta, hay unos cupos asignados por lo tanto no deberia RELAJAR en la ruleta.
  - El usuario entiende que deben haber 2 random. 1 para la seleccion de la era y tipo siguiente del array del mazo y dentro de esta escoger un random de la lista de disponibles. 
- Supuestos arreglos hechos que e usuario no entiende/no esta de acuerdo
  - **`pickTitleFor()` relajaba Era/Banda sin respetar los filtros manuales activos** — corregido para relajar solo la dimensión que el usuario NO fijó explícitamente (antes, filtrar solo por Era terminaba en "sin resultados" porque también bloqueaba relajar Tipo, que sí era válido relajar).
  - **`resolveBand()` para Clásica usaba una bolsa pesada por el catálogo COMPLETO** (incluye no disponibles), pudiendo "prometer" una banda sin ninguna oferta real aunque hubiera otras Clásicas disponibles en otra banda — esta era la causa de fondo de las relajaciones innecesarias. Corregido: ahora solo elige entre bandas que tienen al menos 1 título realmente disponible sin ver.
- **Scroll NO corregido:** `scrollToCicloTitle()` usa cálculo numérico explícito (`getBoundingClientRect`) en vez de `scrollIntoView()` (poco confiable en algunos WebView de Android para `behavior:smooth`), y `smooth` en vez de `instant`. Aun sigue haciendo scrollTo(0,0)

## Bugs reales encontrados y corregidos en esta sesion
- **Bug de display:** la tarjeta y el historial mostraban la Era/Tipo *pedida originalmente*, no la del título *realmente elegido* — cuando el sorteo automático (sin filtro) relajaba Era/Banda como último recurso, la pantalla podía decir "Era Clásica" en un título que en realidad era Moderna. Corregido: se muestra siempre `título.era`/`título.band` (la verdad real), nunca el balde pedido. 
- Simulado con las funciones reales (no teóricas) tras el fix: 200/200 tiradas correctas filtrando solo Era=Clásica, 200/200 correctas filtrando Era=Clásica+Tipo=Normal, 0% de relajaciones en 100 ciclos automáticos completos (2400 tiradas).
- **Sorteo cancelable:** si se navega fuera de Ruleta (botón Atrás/gesto Android) mientras un sorteo está girando o revelando, se cancela vía un token de generación (`drawGen`) — ya no queda un pick fantasma completado al reentrar. Reentrar a Ruleta siempre muestra el estado inicial.
- **Botones bloqueados para siempre — corregido:** `render()` ahora reactiva todos los botones cada vez que se (re)entra a la vista Ciclo, sin importar en qué punto se interrumpió un flujo anterior.
- **Botones duplicados unificados:** `redoBtn`/`confirmBtn` ahora sirven tanto para el ciclo normal como para Larga/Adulto/Repetir (chequean `state.extra`). Se eliminaron `redoExtraBtn`, `confirmExtraBtn`, `confirmExtraRow`.

- **Lista Completa — toque fantasma corregido de raíz:** el drawer de filtros ahora usa un backdrop real (div fullscreen invisible, z-index entre las tarjetas y el drawer) — el toque nunca llega a ninguna tarjeta de abajo porque el navegador lo recibe en el backdrop, no en la tarjeta. Se cierra en el toque inicial (`pointerdown`), así que mantener presionado sin soltar también cierra al instante.
- **Botón Atrás de Android/navegador:** implementado con History API (`pushState`/`popstate`) — cada cambio de vista queda en el historial del navegador, el botón físico/gesto de Android navega dentro de la app en vez de cerrarla. Pendiente mejorar
- **Mensaje de "ciclo completo" cambiado:** de "Completaste el ciclo. Resuelve lo pendiente o continúa." a "Ok suficiente anime, ¿ahora una larga en serio o un cartoon adulto?".
- **Modal de confirmación al elegir en Lista Completa: YA IMPLEMENTADO** (no confundir con el pendiente de abajo) — al tocar un título disponible, aparece "Disponible en: X" con OK/Cancelar antes de confirmar. Lo que falta (ver pendientes 🟡) es *enriquecerlo* con sinopsis/género, no crearlo de cero.

## Layout final de la tarjeta de revelado (Ruleta) — de arriba hacia abajo

1. Póster (225px, marco con degradé Era→Tipo, `posterFrameGradient()` usa la Era/Tipo **real** del título).
2. Tags: Era / Tipo / Emotional (si aplica).
3. Nombre.
4. Episodios (texto plano, pegado a la izquierda) + Géneros/Temas fusionados (texto plano, sin pastillas, wrap natural en la misma línea).
5. Plataforma (chips con ícono) — **se sacó y se volvió a poner** en esta misma conversación: se sacó pensando en mostrarla "en otro lado" (el widget "Viendo ahora" que todavía no existe), y se repuso porque sin ese widget construido, confirmar una serie sin saber dónde verla era un hueco real. Estado final: **sí está en la tarjeta**.
6. Nota importante (si la fila trae algo en la columna `Notas` del Sheet) — colapsa a cero espacio si no hay. (Ahora #4, pendiente mover encima de Sinopsis)
7. Sinopsis (clamp a 2 líneas + "Ver más" en bloque propio debajo, no inline — se probó inline y desaparecía si el texto ya llenaba las 2 líneas). (Pendiente de volver todo el texto expandible)

## Nomenclatura y colores — definitivo

- **Eras:** Dorada, Moderna, Clásica (ya no "Nuevas"/"Viejas").
- **Tipos (antes Elite/Normal/Ligera, renombrados por completo, cero referencias viejas en el código):** Excelente (>8.0), Buena (7.5-8.0), Normal (<7.5).
- **Colores definitivos aplicados** (mismo valor en tema oscuro y claro por ahora, ya que solo se dio un valor por color):
  - Dorada: `hsl(42, 81%, 67%)`
  - Clásica: `hsl(0, 0%, 60%)` (gris)
  - Excelente: `hsl(356, 62%, 52%)` (rojo)
  - Buena: `hsl(221, 62%, 52%)` (azul)
  - Normal: `hsl(90, 62%, 52%)` (verde lima)
  - Tags (géneros/temas): `hsl(236, 62%, 52%)` (azul, variable CSS `--tag-color` separada de `--accent`)
- **Sistema de sliders de color** (Dorada/Clásica/Excelente/Buena/Normal/Tags, con nombre de color legible + valor `hsl()` exacto mostrado en vivo) queda **comentado en el código, no borrado** — buscar "COMENTADO" en `ui.js` e `index.html` para reactivarlo si hace falta reajustar algo.

## Estado del mazo / algoritmo de sorteo — cerrado, sin pendientes activos

- Mazo de `MAZO_SIZE=24`, cuota proporcional dinámica calculada del catálogo real vía `largestRemainder`. El número 24 es empírico (probado a mano: 18 mal, 24 bien, de ahí para arriba peor)
- Reglas de racha: no más de 2 seguidas de la misma Era o Tipo, cede si no queda alternativa UNICAMENTE en el mazo.
- Clásica resuelve su Tipo aparte, en una bolsa (`clasicaBag`) que dura muchos ciclos — ya no pesada por catálogo completo sin filtrar disponibilidad (ver bugfix arriba).
- **Algoritmo de racha de bandas: CERRADO, no es un pendiente.** Confirmado con simulación desglosada por banda: Normal/Buena rachando es matemática esperada (tienen más slots), Excelente rachando ~1.1% de las veces es raro y ya tiene el filtro manual como mitigación diseñada. No se va a construir una lógica determinística para esto — la manualidad + azar + disponibilidad ya cubren el caso, según decisión explícita del usuario.
- `REP_EVERY = 3` (cada cuántos ciclos se ofrece Repetir) es arbitrario, igual que el 20% de Emotional — **pendiente de evaluar** si se le puede dar una lógica derivada del tamaño del pool de Repetir (opinión, no hay una única respuesta correcta, a diferencia del reparto de Era/Tipo que sí tiene una razón objetiva).

## Filtros "Quiero ver" en Ruleta

Funcionando (Era + Calidad; Género sigue marcado "no funcional aún" en la UI). Respetan estrictamente lo pedido — si no hay candidato exacto (ni relajando Emotional), muestran "sin resultados" en vez de sustituir cualquier cosa.

## Historial y persistencia

- `localStorage` **hoy** (antes del fix de fuente de verdad, ver arriba) solo cachea `usedTitles` + los 3 arrays de extras (`largaUsed`/`adultoUsed`/`repUsed`) — nada más. Cada apertura de la app arranca de `seedInitialState()` fresco (mazo, ciclo, tema, Modo Desarrollador, vista → siempre Home) y le restaura encima esos 4 arrays.
- Esta arquitectura queda **reemplazada** por el diseño de la sección de bug crítico arriba, una vez implementado.

## Modo Desarrollador — reestructurado

- Vive como drawer flotante junto a "QUIERO VER" (botón "DEV MODE" a la derecha) — no empuja el resto de la pantalla al abrirse.
- Contiene: cupos del ciclo (Era/Tipo con contador disponible/total), sliders de color (comentados, ver arriba), botón "Reiniciar estado".

## Nota importante en tarjeta

Conectada a la columna `Notas` **ya existente** en el Sheet (reusada, no se creó una columna nueva) — se muestra como aviso ámbar debajo del título solo si la fila trae texto ahí (ej. "Únicamente en Idioma Chino"). El contenedor colapsa a cero espacio cuando no hay nota (no reserva hueco vacío).

## Animación de "girando"

3 cartas del mismo tamaño (no el tamaño del póster final — se evaluó y no entraban 3 a ese tamaño en una pantalla de celular, se ajustó proporcionalmente manteniendo el mismo aspect-ratio 225/319), con el mismo signo de interrogación "？" en las 3 (el del centro de las 3 variantes que se probaron), animación `.5s` con direcciones alternadas (`c1` reversa, `c2` normal, `c3` reversa — ajuste manual del usuario aplicado tal cual). Vive dentro del mismo `#cardArea` (ya no en un `#diceWrap` separado, para que no se desplace nada al aparecer/desaparecer). Fade-out de las cartas, pausa, luego fade-in del resultado. Texto "BUSCANDO"/"Girando" eliminado — las cartas con "?" son suficiente según el usuario.

## Encabezado actual completo del Sheet "Anime"

```
Random	MAL_ID	Categoria	Nombre	Nombre_Streaming	NombreMio	MAL_NombreJap	MAL_NombreEng	MAL_Sinonimos	Nombre_Comparado	Calificacion	MAL_Puntaje	Has Eps	MAL_Eps	PendienteTemporada	MAL_PendienteFinalizar	Pendiente	RevisarMotivos	TMDB_Plataforma	Plataforma	Pendiente_Disponible	Popularidad	Emotional	Visto	Notas	OrdenVisualizacion	Generos	Temas	FechaInicial	FechaFinal	UltimaLectura	Sinopsis	Poster	PosterMediano	MAL_UI_URL
```

**Nota:** todavía falta trabajar sobre `OrdenVisualizacion` (para notas tipo "Free! (S1→S2→OVA→...)", NO son parte del nombre).

## Decisiones de nombres cerradas (para no repetir la discusión)

- **`NombreMio`**: entrada manual original del usuario, posiblemente descartar a futuro por uso de MAL_ID u otros (historial, filtros, categoría).
- **`Nombre`**: lo que se muestra en la UI. Fórmula de default en el Sheet: `=IF(MAL_NombreEng<>"", MAL_NombreEng, IF(MAL_NombreJap<>"", MAL_NombreJap, Nombre))`. Convive con un dropdown generado por `GenerarDropdownFanName.gs`.
- **`Nombre_Comparado`**: calculado por `compararNombres()`, cascada de coincidencia. Si matchea vía sinónimo, devuelve `"OK (via sinonimo)"`.
- **`MAL_Sinonimos`**: solo sinónimos que aportan algo nuevo (no duplicados de JAP/ENG).
- **`RevisarMotivos`**: fórmula de Sheet, `TEXTJOIN` listando qué campos no calzan (Puntaje ±0.05, Episodios exacto, Estado).
- **`Nombre_Streaming`**: solo si el nombre real de búsqueda en plataforma difiere del `Nombre` mostrado.
- **`Poster`/`PosterMediano`**: `Poster` (grande) wireado en Lista Completa y en la tarjeta de Ruleta con aspect-ratio 225/319. `PosterMediano` pensado para historial diminuto — todavía no implementado en la UI.

## Sinopsis y Mood — decisión de diseño (no implementado)

- Sinopsis: se necesita traducción antes que acortamiento — prioridad revisada explícitamente, ya que Camila no lee inglés (antes se pensaba solo en acortar, ahora la traducción es el problema real a resolver primero). Idea evaluada: batch único vía IA (Claude Haiku desde Apps Script) sobre el `Sinopsis` de MAL ya guardado.
- Mood ("ver Kakegurui sabiendo que es cringe intencional"): sin solución clara, en pausa — necesitaría texto de reviews reales sin fuente limpia vía API.

---

## 📋 Pendientes actualizados — desde Superior

### 🔴 Bugs / Críticos activos
- **Fuente de verdad Sheets vs localStorage** (ver sección completa arriba) — el más urgente, ya diagnosticado y con propuesta cerrada, falta codear.
- Scroll to Ruleta de Anime no corregido
- Completar un MVP Funcional. Analizar Claude que falta y revisar logica
- Analizar fuertemente porque despues de 20 tiradas con filtros de Clasica-Excelente (la cual tiene 4 disponibles - Slam Dunk, One Piece, Planetes y Ashina no Joe), salio 10 veces Planetes, solo 1 Joe y One Piece y 8 veces Slam. Hay algo en el codigo inclinando la balanza por alguna razon? o por que pasa esto?

### 🟠 Superior
- Ordenar proyecto con buenas practicas con folders y diferentes archivos/clases, no todo en 1 solo lado.
- Actualizar Iconos de plataformas con otros. Usuario va buscarlos
- TMDB para disponibilidad real (verificación doble: subtítulos ES + todas las temporadas) — de esto depende también la lista completa de plataformas para el punto de config global.
- Migrar historial a Google Sheets (columnas `Estado` Viendo/Terminado + `FechaInicioVer`/`FechaFinVer`) — converge con el punto de fuente de verdad de arriba, mismo trabajo.
- Widget "Viendo ahora" en Home/pantalla principal: poster mediano + plataforma + botón Terminar, debajo de los 3 botones grandes.
- Soporte para trackear varias series "Viendo" en simultáneo.
- Botón para desplegar/colapsar el historial completo (show/hide) en la pestaña ANIME.
- Analizar si el MarcarVisto.gs deberia esperar confirmacion. Podria seleccionarla y si falla el servicio reintentarlo nuevamente en otro momento. En caso de fallo recurrente enviar notificacion solo a mi (no esposa) de actualizacion manual en Sheets y revisar motivo fallo.

### 🟡 Alto
- Config global de plataformas de streaming activas/inactivas (Naruto en Prime Video, pero "no la tengo ahora") — idea nueva, sin diseñar aún: ¿pestaña aparte en el Excel? ¿lista armada con TODAS las plataformas que resulten del análisis de TMDB pendiente?
- Cadencia de Emotional calculada en vivo (reemplaza el 20% fijo) — diseño cerrado, falta implementar.
- Mostrar estado de emisión en la tarjeta ("No ha estrenado" / "No ha terminado") usando `MAL_PendienteFinalizar`, reusando el mecanismo de Nota importante ya construido.
- Filtro de Género real en Ruleta (hoy solo UI, marcado "no funcional aún").
- Nuevas Temporadas: falta que el usuario genere el Apps Script y reemplace el gid placeholder (`TU_GID_NUEVAS_TEMP`) en `logic.js`.
- Modal de confirmación en Lista Completa: agregar sinopsis/género, no solo plataforma (hoy el modal "Disponible en: X — OK/Cancelar" solo muestra plataforma).

### 🟢 Medio
- Historial principal (tabla ANIME): nombre a 2 líneas, decidir qué pasa si no alcanza (3ra línea / ellipsis / tooltip al toque), o ajustar ancho de columna Era sin cortar "Moder...". Abierto, sin resolver.
- Agrandar el texto de la sinopsis en la tarjeta de revelado (hoy 12.5px, quedó pendiente de subir — se agrandaron eps/géneros/tags en su momento pero la sinopsis en sí no).
- Botones/lógica de "¿Ahora sí Larga?" y "¿Ahora sí Adulta?" con estado toggle — al presionar, si el usuario se arrepiente, un botón con cambio de estado ("Larga todavía no, mejor") que apague la búsqueda específica sin perder el "owed"; solo una puede estar activa a la vez; si se apaga, sigue buscando en el ciclo normal.
- Exportar listas MAL (Diego y Camila) para auditar qué falta agregar al catálogo — el objetivo es verificar pendientes en Plan to Watch/Watched, NO llenar un historial pasado (MAL ya lo tiene).
- Series vistas marcadas visualmente en Lista Completa en vez de ocultarse — **decisión confirmada: sí**, quedan visibles con marca distinta (razón: posible repetir manualmente a futuro, o agregar a Repetir). Falta decidir el estilo exacto (se sugirió borde de color antes que fondo, para no competir con el póster).
- Al terminar una serie (tarjeta Viendo/Terminado, depende del widget pendiente de arriba), agregar elemento "¿Candidato a Repetir?" con botones Sí/No — si Sí, se agrega automáticamente al pool de Repetir.
- Sinopsis corta vía IA — prioridad revisada: traducir antes que acortar.

### 🔵 Baja
- Soporte multi-usuario conectado a cuentas MAL (Camila + amigos) para recomendaciones grupales.
- Responsive de escritorio con layout distinto al de celular (detectar PWA instalada vía `window.matchMedia('(display-mode: standalone)').matches`; el layout en sí son media queries CSS normales, no depende de si está instalada).
- Fuegos artificiales sutiles en el botón Nuevas Temporadas cuando hay disponibles (constante, pocos pero suficientes, en contraste con el tema).
- Modo claro: no blanco puro, más contraste en bordes para que todo se note más fácil.

### ⚫ Super Baja / Sin prioridad definida (sin cambios, arrastrados de versiones anteriores)
- `REP_EVERY = 3` arbitrario — evaluar si merece una lógica derivada del catálogo (no urgente, pero es una inconsistencia de diseño frente al resto del sistema que sí es proporcional).
- Modo Agregar_Relacionados / Modo Agregar Series.
- `related_anime` de MAL para sugerir multi-temporada.
- Múltiples imágenes por serie para elegir cuál mostrar.
- Notificación de actualización de la PWA (Service Worker). ?? usario no sabe que es esto, pide aclaracion en siguiente chat
- Pestañas Películas/Series y Cartoons.
- Curador de Descargas.
- Tema visual MAL, mazo automático semanal, idiomas EN/SRB, undo multinivel, historial editable.
- Mínimo garantizado de 1 slot por Era (probablemente innecesario, evaluar junto con la solución de fondo de racha si algún día se retoma).

---

## 🟣 Reglas de estilo para Claude en el chat nuevo
- No terminar respuestas con preguntas ni proponer pasos no solicitados, salvo que el usuario los pida explícitamente.
- No generar cambios de código, simulaciones, ni ejecutar herramientas en el proyecto a menos que el usuario lo pida explícitamente. Ante un problema o pregunta, explicar/diagnosticar primero y esperar confirmación antes de modificar o correr nada.
- Antes de dar por cerrado un bug, simular con las funciones REALES del código (no una reconstrucción aproximada) y mostrar los resultados numéricos.
- Verbosidad media a alta cuando el tema lo amerita (el usuario prefiere explicaciones completas, no recortadas).
