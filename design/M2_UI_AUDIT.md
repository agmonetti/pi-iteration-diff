# Auditoría de Fidelidad Visual: M2 vs. Especificación de Diseño (`/design`)

**Fecha de auditoría:** 2026-10-23  
**Proyecto:** `pi-iteration-diff`  
**Milestone auditado:** M2 (Visor real de diffs con archivos colapsables)  
**Alcance:** Comparación exhaustiva entre los documentos de diseño (`design/ui-spec.md`, `design/mockups.md`, `design/theme-tokens.json`) y la implementación real (`src/ui/diff-panel.ts`, `src/ui/layout-adapter.ts`, `src/diffs/iteration-diff.ts`, `src/index.ts`).

---

## 1. Matriz de Cumplimiento (Compliance Matrix)

| Área de UI / Requisito de Diseño | Estado | Referencia de Código (`src/`) | Notas y Hallazgos de Implementación |
|---|---|---|---|
| **Apertura y Ocultamiento Exclusivo** | `IMPLEMENTED` | `src/index.ts:44-92` | Se abre/cierra por comando explícito `/diff` o `/iteration-diff`. No se autoabre. |
| **Colapso Inicial por Defecto (M2)** | `IMPLEMENTED` | `src/ui/diff-panel.ts:128` | Todos los archivos inician contraídos en cada iteración nueva. |
| **Expansiones Independientes** | `IMPLEMENTED` | `src/ui/diff-panel.ts:103,147` | El conjunto `expanded` persiste durante la sesión para la misma iteración; se limpia al cambiar de iteración. |
| **Ancho Proporcional / Adaptativo** | `IMPLEMENTED` | `src/ui/layout-adapter.ts:36-42` | Ancho responsivo real (35-40%, `basis: 36, grow: 40, minSize: 34, maxSize: 70`) preservando ancho mínimo del chat (`minSize: 52, grow: 60`). |
| **Ocultamiento Automático (< 90 cols)** | `IMPLEMENTED` | `src/ui/layout-adapter.ts:38-41` | El dock se oculta automáticamente si el ancho total es menor a 90 columnas. |
| **Separador Vertical / Borde de Dock** | `IMPLEMENTED` | `src/ui/diff-panel.ts:182` | Borde `│` estilizado con token `border` de forma uniforme e independiente del contenido de cada línea. |
| **Indicador de Foco Minimalista** | `IMPLEMENTED` | `src/ui/diff-panel.ts:168,183` | Cabecera y cursor `>` con token `accent` solo en foco; indicador atenuado `dim`/`muted` sin foco. |
| **Selector de Scope en Cabecera** | `IMPLEMENTED` | `src/ui/diff-panel.ts:166-169` | Cabecera estructurada con badge de scope contextual `[Last*]` cuando el ancho es >= 42 cols. |
| **Estilos de Tokens de Tema (`toolDiffAdded` / `toolDiffRemoved`)** | `IMPLEMENTED` | `src/index.ts:71-82`, `src/ui/diff-panel.ts:188-260` | Mapeo completo de tokens (`border`, `bold`, `dim`, `accent`, `muted`, `warning`, `toolDiffAdded`, `toolDiffRemoved`, `text`). |
| **Gutter de Números de Línea** | `IMPLEMENTED` | `src/ui/diff-panel.ts:246` | Números de línea estilizados con `dim` y signos `+`/`-` con `toolDiffAdded`/`toolDiffRemoved`. |
| **Lectura de Líneas Largas y Rutas** | `IMPLEMENTED` | `src/ui/diff-panel.ts:36-64,174,250` | Desplazamiento horizontal (`←`/`→`) con indicador `«`, truncamiento medio inteligente de rutas (`truncatePath`) e inspección bajo demanda (`i`). |
| **Truncamiento Estricto con Elipsis** | `IMPLEMENTED` | `src/ui/diff-panel.ts:30,167,222` | Truncamiento acotado con elipsis sin desbordes de celda en terminal. |
| **Atajos de Teclado y Paginación** | `IMPLEMENTED` | `src/ui/diff-panel.ts:269-286` | `↑↓`, `Enter`, `[]`, `{}`, `←→` (pan), `0` (reset), `i` (inspect), `PgUp/Down`, `Home/End`, `Esc`/`Tab` (`editor`), `q` (`close`). |
| **Scroll Independiente del Transcript** | `IMPLEMENTED` | `src/ui/diff-panel.ts:40-67` | `VirtualDiffScroll` con `ScrollView` y rueda de ratón dedicada. |
| **Gestión de Estados Especiales (ADR-003 / Batch Net / Abort)** | `IMPLEMENTED` | `src/diffs/iteration-diff.ts:206-265` | Mapeo textual fiel de ventanas agrupadas, abortos, truncamiento y estados vacíos. |

---

## 2. Desviaciones Visuales Observadas

1. **Rigidez Dimensional del Dock (34 columnas fijas):**
   - *Diseño:* Proporcional al ancho del terminal (`35% - 40%` o adaptable entre 34 y 42 columnas según el espacio disponible).
   - *Realidad:* `basis: 34` fijo en `layout-adapter.ts`. En terminales estándar de 120 columnas, el dock ocupa exactamente 34 celdas, dejando 86 celdas al chat de Pi (aproximadamente 28%, por debajo del mínimo de diseño).

2. **Pérdida de Jerarquía Tipográfica y Color en Cabeceras de Archivo:**
   - *Diseño:* El nombre del archivo en negrita (`font-weight: 600`), estadísticas `+3 / -2` con colores diferenciados de adición y eliminación.
   - *Realidad:* `src/ui/diff-panel.ts` renderiza el nombre y las estadísticas como una cadena de texto plana concatenada (`[modificado] +3/-2`) sin estilos específicos de negrita ni separación clara de colores en las estadísticas.

3. **Inconsistencia en el Indicador de Foco (`>`):**
   - *Diseño:* El cursor indicador de línea activa (`>`) y el resaltado de cabecera solo se activan cuando el panel tiene el foco de usuario.
   - *Realidad:* La columna de control siempre antepone `> ` o `  ` independientemente de si el foco está en el chat o en el dock, y el título cambia de color pero mantiene el marcador de fila activo todo el tiempo.

4. **Ausencia de Selectores de Scope y Badges Superiores:**
   - *Diseño:* Pestañas superiores `[Last*] Current History`.
   - *Realidad:* Omitidas en la implementación de M2, lo que obliga al usuario a usar únicamente el comando sin feedback visual del alcance actual.

---

## 3. Problemas de Usabilidad Detectados

1. **Truncamiento Severo de Rutas de Archivo y Código:**
   - Con un ancho fijo de 34 columnas, descontando el prefijo de expansión (`▾ ` o `▸ `) y el sufijo de estadísticas (` [modificado] +12/-3`), **quedan menos de 15 caracteres visibles para las rutas de archivo**. Rutas comunes como `src/integrations/herdr/manager.ts` se truncan irreconociblemente a `src/integrat…`.
   - Dentro de los archivos expandidos, el espacio de código útil se reduce a solo **19 caracteres** (ancho total 34 menos 15 de gutter y separadores), provocando que casi cualquier línea de código con indentación quede fuera de la vista sin scroll horizontal en el panel.

2. **Línea de Acciones / Footer Saturada e Invisible:**
   - El texto del footer (`Enter/clic abrir · ↑↓ PgUp/PgDn · [] archivo · {} hunk · Esc editor · q cerrar`) tiene 73 caracteres de longitud.
   - En el dock de 34 columnas, **el pie de página se trunca por completo**, ocultando por completo las instrucciones de uso para el usuario.

3. **Duplicación y Confusión en Números de Línea (Gutter):**
   - El formato actual muestra `old` y `new` de forma contigua en 11 caracteres (`old.padStart(4) + ' ' + next.padStart(4)`), pero en líneas de contexto o adiciones puras genera espacios vacíos excesivos o alineaciones extrañas que dificultan la lectura rápida comparativa con un diff unificado estándar.

---

## 4. Diferenciación: Limitaciones de Pi TUI vs. Decisiones de Implementación

| Aspecto | Naturaleza | Justificación / Evidencia |
|---|---|---|
| **Incapacidad de mostrar fondos de color por celda complejos** | Limitación TUI | `@earendil-works/pi-tui` opera con cadenas de texto ANSI devueltas por componentes; aplicar estilos por celda fragmentaria incrementa el riesgo de corrupción de secuencias ANSI en terminales restrictivas (como algunos multiplexores de Herdr). |
| **Ancho fijo de 34 columnas** | **Decisión de implementación** | *Evitable.* La API de `HStack` y `Component` acepta pesos (`grow`, `basis`, proporciones). La fijación a 34 columnas fue una simplificación de M2 para garantizar estabilidad, pero contradice el principio de adaptabilidad de la especificación. |
| **Ausencia de footer corto o responsivo** | **Decisión de implementación** | *Evitable.* El texto del footer no se adaptó al ancho reducido del dock, provocando su truncamiento total. |
| **Falta de pestañas de scope (`Current`/`History`)** | Decisión de alcance M2 | *Correcto.* La especificación de M2 acotó explícitamente que `Current` y `History` pertenecen a fases posteriores, por lo que su ausencia en M2 es una decisión de diseño respetada, no un defecto. |

---

## 5. Correcciones Priorizadas (Roadmap de Ajuste Visual)

1. **Prioridad Alta (Bloqueador de Usabilidad):**
   - **Footer responsivo:** Adaptar el texto del pie de página según el ancho disponible del dock (ej: si ancho < 50, mostrar únicamente `[Esc] Editor  [q] Cerrar`).
   - **Formato de estadísticas y nombres de archivo:** Permitir priorizar la ruta del archivo frente a las estadísticas cuando el ancho es reducido, truncando el nombre por la izquierda o compactando el indicador de estado (`[m]` en lugar de `[modificado]`).

2. **Prioridad Media (Fidelidad Visual):**
   - **Ancho proporcional adaptativo:** Modificar `layout-adapter.ts` para que el basis del dock escale entre 36 y 46 columnas cuando el terminal supere las 120 columnas (`DOCK_PROPORTIONAL_RATIO`), en lugar de mantener estáticas 34 columnas.
   - **Jerarquía de Foco:** Asegurar que el indicador de fila activa `>` solo aparezca cuando `this.hasFocus === true`, reduciendo el ruido visual en modo lectura.

3. **Prioridad Baja (Refinamiento Estético - No urgente para M2):**
   - Integración de colores de fondo (`addedBg`/`removedBg`) mediante pruebas de regresión de terminal ANSI.

---

## 6. Recomendaciones de Implementación Concreta para el Agente de Código

- **No reescribir M2:** Los motores de diff, la virtualización de scroll y la separación de ciclos de vida funcionan correctamente (81/81 tests pasando). Los cambios deben limitarse exclusivamente a la capa de presentación (`src/ui/diff-panel.ts` y `src/ui/layout-adapter.ts`).
- **Ajuste del Footer en `diff-panel.ts`:**
  ```ts
  private footer(width: number): string {
    const short = width < 45;
    const text = short 
      ? "Enter: abrir · Esc: editor · q: cerrar"
      : "Enter/clic: abrir · ↑↓: navegar · Esc: editor · q: cerrar";
    return this.actions.style("muted", truncateToWidth(`│ ${text}`, width, "–"));
  }
  ```
- **Optimización del Gutter y Ancho Mínimo:** Evaluar elevar `MIN_COLUMNS_THRESHOLD` de 90 a 100 columnas si el dock requiere 34+ celdas para evitar el colapso visual de rutas y código.

---

## 7. Estado de Corrección (Implementado en M2 Corrección de Fidelidad Visual)

- **Dock adaptable:** Implementado en `src/ui/layout-adapter.ts` mediante `basis: 40, minSize: 34, maxSize: 55`, permitiendo adaptación fluida en terminales anchas y medianas.
- **Footer responsivo:** Implementado en `src/ui/diff-panel.ts` con conmutación automática a modo corto (< 45 cols) para evitar truncamiento.
- **Estadísticas de archivo:** Formateadas con espacios explícitos (`+3 / -2`) según los mockups.
- **Verificación:** Suite de pruebas ampliada a 82/82 tests pasando exitosamente (`npm run check`).