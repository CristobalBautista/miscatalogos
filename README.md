# Mis Catálogos — Ruleta de Anime

PWA personal para elegir qué anime ver, con una "ruleta" que sortea el siguiente título respetando proporciones reales de Era y Calidad del catálogo. Google Sheets es la fuente de verdad de los datos; la app es solo la capa de selección y presentación.

## Cómo abrir esto en tu computador

No hace falta instalar nada para editarlo. Dos formas de verlo funcionando:

- **Rápido (sin instalar nada):** subí todos los archivos a [Netlify Drop](https://app.netlify.com/drop) arrastrándolos, y te da una URL al toque.
- **Para editar con vista previa en vivo:** instalá [VS Code](https://code.visualstudio.com/) (gratis) + la extensión **Live Server**. Abrí la carpeta del proyecto, clic derecho en `index.html` → "Open with Live Server".

## Qué hace

- Sortea el siguiente anime a ver entre 3 Eras (Dorada, Moderna, Clásica) y 3 niveles de Calidad (Excelente, Buena, Normal), respetando las proporciones reales del catálogo disponible.
- Categorías aparte, ofrecidas como "extras" ocasionales durante el ciclo: Adulto, Larga, Repetir.
- Filtros manuales ("Quiero ver") por Era y Calidad.
- Ritmo de contenido "Emotional Damage": garantiza un piso de títulos marcados como tal por mazo, sin repetirlos muy seguido (cooldown).
- Vista de Lista Completa: todo el catálogo, con posibilidad de elegir un título puntual sin pasar por el sorteo.
- Historial de lo visto, con opción de deshacer la última elección.
- Modo Desarrollador: panel con el estado interno del mazo/bolsa para debug.
- PWA instalable, con modo oscuro.

## Arquitectura

**Google Sheets es la fuente de verdad**. Dos vías de datos:

1. **Lectura**: la app descarga el catálogo como CSV publicado (`Archivo → Compartir → Publicar en la web`), en dos pestañas separadas — `Anime` (catálogo principal) y `Nuevas Temporadas`.
2. **Escritura**: marcar/desmarcar `Visto` va por un Google Apps Script desplegado como Web App (`AppsScript_Marcar_Visto.gs`), que busca la fila por `MAL_ID` y escribe el checkbox. El mismo script registra ediciones manuales hechas directo en el Sheet (columna `UltimaEdicionManual`) — solo con ediciones humanas desde la interfaz.

El estado local (`localStorage`) es solo un colchón de ~1 minuto para confirmaciones recientes que todavía no se reflejaron en el Sheet — no es la fuente de verdad. Al abrir la app, `usedTitles` se reconstruye leyendo el Sheet.

## Estructura de archivos

| Archivo | Contenido |
|---|---|
| `index.html` | Estructura de las vistas (Home, Anime, Ciclo, Lista Completa, Nuevas Temporadas, modales). Sin lógica, solo esqueleto |
| `styles.css` | Colores, tamaños, espaciados. Los 2 temas (`dark-purple` default, `light`) viven acá como variables CSS (`--bg`, `--accent`, etc.) |
| `logic.js` | Toda la lógica de datos y sorteo — sin DOM, sin dependencias externas. Carga el catálogo, arma los pools por Era/Categoría, sortea el siguiente pick, maneja el estado (mazo, bolsa de Clásica, racha, Emotional) |
| `ui.js` | Todo lo que toca el DOM — renderizado de vistas, animaciones, manejo de eventos, persistencia en `localStorage` |
| `AppsScript_Marcar_Visto.gs` | Google Apps Script desplegado como Web App: recibe `{malId, visto}` por POST y escribe en el Sheet; también registra ediciones manuales |
| `manifest.json` | Metadata para que el celular pueda "instalar" la app (ícono, nombre, colores de la barra de estado) |
| `sw.js` | Service Worker mínimo, necesario para que el manifest funcione como PWA instalable |
| `icon-*.png` / `apple-touch-icon.png` | Íconos de la app |

**Regla simple para saber qué archivo tocar:** ¿es un color, tamaño o espaciado? → `styles.css`. ¿es texto fijo o la estructura de una pantalla? → `index.html`. ¿es cómo se calcula o se decide algo? → `logic.js`. ¿es cómo se ve o se anima algo en pantalla? → `ui.js`. ¿es un anime, su info o disponibilidad? → el Sheet, no un archivo del repo.

## Configuración del Sheet

**Pestaña `Anime`**, columnas: `Nombre`, `Categoria` (Dorada/Moderna/Clasica/Adulto/Larga/Repetir), `MAL_ID` (numérico; puede traer varios IDs relacionados separados por `", "`, el primero es el canónico), `Calificacion`, `PendienteTemporada` (`X` = fuera del sorteo por temporada nueva pendiente), `Plataforma`, `Eps`, `Emotional` (`X`), `Poster`, `PosterMediano`, `Nombre_Streaming`, `Sinopsis`, `Generos`, `Temas`, `Notas`, `Visto` (checkbox TRUE/FALSE), `UltimaEdicionManual`.

**Pestaña `Nuevas Temporadas`** (publicada aparte, otro `gid`): `Nombre`, `MAL_Eps`, `FechaFinalizacion`.

El orden de columnas no importa — el parseo es por nombre de encabezado, no por posición.

## Deploy del Apps Script

1. Desde el Sheet: `Extensiones → Apps Script`, pegar el contenido de `AppsScript_Marcar_Visto.gs`.
2. `Implementar → Nueva implementación → Aplicación web`, acceso "Cualquier usuario".
3. Copiar la URL `/exec` generada a `VISTO_WRITE_URL` en `logic.js`.
4. **Importante**: cualquier cambio posterior al `.gs` necesita `Implementar → Administrar implementaciones → Editar → Nueva versión` — guardar el archivo solo no actualiza la URL ya publicada.

## Estado actual

MVP cerrado. El detalle de cambios recientes, decisiones de diseño y pendientes vive en los documentos `CONTEXTO_TRASPASO_N.md` 
