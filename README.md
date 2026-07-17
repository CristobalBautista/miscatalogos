# Ruleta de Anime — Mis Catálogos

App web (PWA) que elige aleatoriamente qué anime ver a continuación, respetando proporciones reales de tu catálogo en vez de un random puro. Corre 100% en el navegador — sin servidor, sin base de datos, sin build ni `npm install`.

## 1. Cómo abrir esto en tu computador

No hace falta instalar nada para editarlo. Dos formas de verlo funcionando:

- **Rápido (sin instalar nada):** sube todos los archivos a [Netlify Drop](https://app.netlify.com/drop) arrastrándolos, y te da una URL al toque.
- **Para editar con vista previa en vivo:** instala [VS Code](https://code.visualstudio.com/) (gratis) + la extensión **Live Server**. Abre la carpeta del proyecto, clic derecho en `index.html` → "Open with Live Server". Cada vez que guardes un archivo, el navegador se refresca solo.

No necesitas un servidor "de verdad" ni Node.js corriendo — todo el código es HTML/CSS/JS plano que el navegador entiende directo.

## 2. Qué archivo hace qué

```
index.html          La pagina en si: estructura de las 5 pantallas (Inicio, Anime,
                     Nuevas Temporadas, Ciclo, Lista Completa). Sin logica, solo esqueleto.

styles.css           Todos los colores, tamaños, espaciados. Los 5 temas de color viven
                     aca arriba de todo, como variables (--bg, --accent, etc).

logic.js              El "motor": el algoritmo de sorteo y la carga de datos.
                       NO toca el DOM (nada de document.*). Se puede probar con Node
                       solo, sin abrir un navegador (ver seccion 5).

ui.js                  Todo lo que SI toca pantalla: mostrar/ocultar vistas, dibujar
                       listas y tablas, animaciones (dado, fundidos), botones.
                       Usa las funciones y variables de logic.js.

catalogo.csv           Tu base de datos completa: nombre, categoria, calificacion,
                        episodios, si tiene temporada pendiente, si es emotional,
                        plataforma. Editable en Excel.

nuevas_temporadas.csv  Lista corta de series con temporada nueva, y si ya termino.

manifest.json           Metadata para que el celular pueda "instalar" la app
                         (icono, nombre, colores de la barra de estado).

sw.js                   Service Worker minimo, necesario para que el manifest
                         funcione como PWA instalable.

icon-*.png              Iconos de la app (la ruleta de 3 colores).
```

**Regla simple para saber que archivo tocar:** ¿es un color, tamaño o espaciado? → `styles.css`. ¿es un texto fijo o la estructura de una pantalla? → `index.html`. ¿es cómo se calcula o se guarda algo? → `logic.js`. ¿es cómo se ve o se anima algo en pantalla? → `ui.js`. ¿es un anime, su info o disponibilidad? → `catalogo.csv`.

## 3. Cómo funciona el sorteo (el corazón del proyecto)

### 3.1 El catálogo se filtra antes de sortear

Al cargar, `loadCatalog()` (en `logic.js`) lee `catalogo.csv` y descarta:
- Cualquier fila con `PendienteTemporada = X` (tiene temporada nueva en curso o por estrenar — eso no es "opcional", va aparte con prioridad).
- Cualquier fila cuya `Plataforma` diga `X` (no está en ningún servicio) o mencione `Descargar` (falta parte en streaming).

Lo que sobrevive se reparte en 4 grupos: el pool principal (`MAIN_POOL`, para el ciclo) y 3 categorías paralelas (`LARGA_POOL`, `ADULTO_POOL`, `REP_POOL`).

### 3.2 El "ciclo" de 18

Cada ciclo es una bolsa de 18 fichas que se va vaciando a medida que eliges (nunca se repite una ficha hasta que la bolsa entera se agota y arranca un ciclo nuevo):

| Época | Fichas | Elite | Normal | Ligera |
|---|---|---|---|---|
| Dorada | 10 | 4 | 4 | 2 |
| Moderna | 6 | 2 | 3 | 1 |
| Clásica | 2 | *(sorteo ponderado, no fijo)* | | |

Dorada y Moderna traen su "banda" (Elite/Normal/Ligera — antes Peak/Core/Chill) ya decidida de fábrica. Clásica es distinta a propósito: en vez de fichas con banda fija, cada vez que le toca el turno se hace un sorteo con las proporciones reales del catálogo (42% Elite / 40% Normal / 18% Ligera) — así ninguna banda queda excluida solo porque 2 fichas no alcanzan para redondear un porcentaje chico.

Estos números (`RECIPE` y `CLASICA_W` en `logic.js`) están **fijos a propósito**, no se recalculan solos desde el CSV. Ya probamos la versión que sí se recalculaba y el resultado se sentía impredecible (ej. Dorada terminó dando 3 Ligera en vez de 2 solo porque el catálogo filtrado cambió un poco). Si algún día quieres que sí se recalculen, es cuestión de tocar esas dos constantes.

### 3.3 Las reglas del sorteo

1. **Nunca Elite dos veces seguidas** — si la última elección fue Elite, la próxima ficha no puede serlo (con una única excepción: si literalmente no queda nada más que Elite en la bolsa, ahí sí se permite, para no trabar el ciclo).
2. **Máximo 3 "Emotional" por ciclo, nunca 2 seguidas** — se decide con ~20% de probabilidad en cada pick, mientras no se haya llegado al tope ni la anterior haya sido Emotional.
3. **No hay regla de "no repetir época 3 veces seguidas"** — se quitó a propósito. El propósito de todo este sistema no es que las matemáticas cierren exactas, es simplemente variar y tener "Ligera" disponible para descansar de series pesadas. Ese propósito ya se cumple con la bolsa vaciándose sola.

### 3.4 Las 3 categorías paralelas

Fuera del ciclo de 18, en paralelo:
- **Adulto** (Adult Cartoon) — 1 por cada ciclo completado.
- **Larga** — 1 por cada ciclo completado (franquicias de 150+ episodios, viven aparte porque un solo título ahí equivale a ~10 títulos normales).
- **Repetir Grande** — 1 cada 3 ciclos completados.

Al completar las 18 fichas del ciclo, la app "bloquea" el sorteo normal y pide resolver estas 3 obligaciones (o diferirlas con "Mejor continuar ciclo" — quedan como recordatorio pendiente arriba a la derecha hasta que las resuelvas). También puedes disparar un sorteo de Adulto en cualquier momento con el botón **Cartoon**, sin que eso afecte el ciclo para nada.

## 4. El sistema de temas

5 paletas de color en `styles.css`, todas usando las mismas variables CSS (`--bg`, `--panel`, `--accent`, etc), así que ninguna otra parte del código sabe ni le importa qué tema está activo:

- `dark-purple` (original)
- `mal-blue` (inspirado en MyAnimeList)
- `trakt-red` (inspirado en Trakt)
- `gold-black`
- `light`

Cambiar de tema solo cambia el atributo `data-theme` en `<html>` — cero JavaScript de lógica involucrado, es puro CSS.

## 5. Cómo se probó la lógica del sorteo (sin abrir el navegador)

Como `logic.js` no toca el DOM, se puede copiar sus funciones a un script de Node y correr una simulación de miles de ciclos para verificar que las proporciones y reglas se cumplen de verdad, no solo "a ojo". Así se encontraron y confirmaron 2 bugs reales antes de esta versión (uno de redondeo en Dorada, otro donde "nunca Elite tras Elite" no se aplicaba bien a las fichas de Dorada/Moderna). Si quieres repetir esa verificación en el futuro, dime y te armo el script de nuevo.

## 6. Flujo de trabajo con GitHub + Netlify

Con Netlify conectado a tu repo de GitHub: cada Pull Request genera un **deploy preview** (una URL de prueba, separada de la real) antes de que lo mergees a tu rama principal. Flujo recomendado:

1. Editas `catalogo.csv` en Excel (o cualquier archivo) en una rama nueva.
2. Subes esa rama y abres un Pull Request.
3. Netlify te comenta en el PR con el link de preview — revisas ahí que todo cargue bien.
4. Si está bien, mergeas a `main` → Netlify publica esa versión como la real.

Esto te da una forma de probar cambios de datos o de código sin arriesgar que tu esposa vea algo roto a mitad de una edición.

## 7. Sobre los posters/géneros (Jikan / MyAnimeList API) — pendiente

Todavía no está implementado. La idea acordada: guardar el ID de MyAnimeList por título en el CSV, y traer poster/popularidad/puntaje/estado con **una pasada por lote** (no en vivo desde el navegador, por restricciones de CORS de la API de MAL — ver la conversación donde se explica el porqué). Cuando se implemente, esos datos se guardan como columnas nuevas del CSV, igual que todo lo demás.
