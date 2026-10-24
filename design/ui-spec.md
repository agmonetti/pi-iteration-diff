# UI Specification: pi-iteration-diff

**Versión:** 2.0 — Especificación definitiva aprobada por el usuario  
**Entorno de ejecución:** Pi Coding Agent (Terminal interactiva fullscreen y dentro de Herdr).  
**Tipo de interfaz:** Terminal User Interface (TUI) montada como extensión sobre `@earendil-works/pi-tui`.

---

## 1. Principios de diseño definitivos

1. **Extensión no intrusiva sobre Pi:** El panel derecho se monta dinámicamente preservando intactos el transcript de la conversación y el editor nativo de Pi a la izquierda. Por defecto se abre/cierra mediante `/diff`; F6 abre/enfoca. M3.5 permite auto-open sólo por opt-in explícito tras iteración individual completa, sin robar foco; elimina `/iteration-diff`.
2. **Consumo estricto del tema activo:** No se introduce ni se exige un tema propio obligatorio. Todos los colores, estilos y contrastes se resuelven dinámicamente desde `ctx.ui.theme` según la configuración del usuario en Pi (`system`, `dark`, `light` o tema personalizado).
3. **Prioridad visual de la selección:** Cuando una línea (añadida, eliminada o de contexto) forma parte de un rango seleccionado, el estilo de selección (`selectedBg` o inversión de video) tiene **prioridad visual absoluta** sobre los fondos de adición y borrado, certificando con precisión qué líneas están marcadas.
4. **Minimalismo y sobriedad en terminal:** Evitar adornos gráficos innecesarios, badges pesados o pestañas ficticias (sin `Current` ni `History` mientras esos modos no existan).
5. **Transferencia de contexto pura sin autoenvío:** La única acción principal es anexar el fragmento seleccionado (`a`) al borrador del editor nativo de Pi. No se introducen comandos `FIX`, `DISCUSS` ni prompts prefabricados. Jamás se dispara el envío automático y se preserva íntegramente el borrador existente.
6. **Retorno automático de foco:** Al presionar `a`, se anexa el contexto y el foco regresa automáticamente al editor nativo de Pi para continuar redactando la instrucción libremente. El panel permanece abierto y conserva sus expansiones.

---

## 2. Parámetros de Layout y Redimensionamiento Interactivo

El dock lateral derecho utiliza un ancho inicial objetivo del **45 %** del terminal y preserva un ancho funcional mínimo para el chat y editor nativos.

```text
┌────────────────────────────────────────────────────────────┬─────────────────────────────────────────────────────────┐
│  PI TRANSCRIPT / CONVERSATION                              │  DIFF DOCK (45% terminal width)                         │
│                                                            │                                                         │
│  User: Refactorizá el cálculo de tasas                     │  │ DIFF · Last iteration                        2 files │
│  Agent: Apliqué la normalización en calculator.ts...       │  │ +12 / -4                                             │
│                                                            │  │                                                      │
│                                                            │  │ ▾ calculator.ts M +3 / -2                   │
│                                                            │  │     src/utils/calculator.ts                          │
│                                                            │  │   11   11   const offset = init();                   │
│                                                            │  │   12   12 - const max = balance;                     │
│                                                            │  │   12   12 + const max = clamp(limit);                │
│                                                            │  │                                                      │
├────────────────────────────────────────────────────────────┤  │ ▸ rate.ts A +9 / -0                          │
│  PI NATIVE EDITOR                                          │  │     src/core/rate.ts                                 │
│  > Revisá también las excepciones|                         │  │                                                      │
│                                                            │  │ Enter: expand · a: append · ↑↓: navigate · Esc: edit │
└────────────────────────────────────────────────────────────┴──┴──────────────────────────────────────────────────────┘
```

### Tabla de parámetros de layout

| Parámetro | Valor por defecto | Comportamiento |
|---|---|---|
| `MIN_COLUMNS_THRESHOLD` | `90 cols` | Si el ancho total es menor, el dock se oculta automáticamente y el foco regresa al editor nativo para salvaguardar la legibilidad del chat. |
| `DOCK_INITIAL_RATIO` | `0.45` (45%) | Proporción inicial del ancho del terminal asignada al dock. |
| `CHAT_MIN_WIDTH` | `46 cols` | Ancho mínimo garantizado para el transcript y editor de Pi. |
| `DOCK_MIN_WIDTH` | `34 cols` | Ancho mínimo del panel de diff al achicarlo. |
| `DOCK_MAX_WIDTH` | `60% terminal` | Ratio configurable entre 30% y 60%; mínimos de conversación/dock prevalecen en terminal pequeño. |

### Redimensionamiento
- **Arrastre de ratón:** Arrastrar el separador vertical `│` ajusta dinámicamente el ancho del dock.
- **Teclado:** Atajos `[` / `]` o `Ctrl+Left` / `Ctrl+Right` permiten expandir o contraer el dock en pasos de 4 columnas.
- **Persistencia de estado:** El ancho ajustado se adapta a resize; Remember dock width On lo guarda por rama de sesión. Off mantiene el ajuste transitorio hasta cerrar. Las seis preferencias y su alcance se especifican en `../M3.5.md`.

---

## 3. Explorador de Archivos Inline (Dos Líneas por Encabezado)

- **Inline con diffs:** Cada archivo presenta su contenido unified directamente debajo de su encabezado sin un visor separado.
- **Colapso inicial:** Por defecto todos contraídos; `/diff-settings` permite expandir al cargar una nueva iteración sin resetear expansiones actuales.
- **Expansiones independientes:** `Enter` o clic en el encabezado alternan únicamente ese archivo. Múltiples archivos pueden permanecer abiertos a la vez.
- **Encabezado de dos líneas:**
  - **Línea 1 (Principal):** Indicador de expansión (`▾`/`▸`), estado compacto (`A`, `M`, `D`) antes del nombre destacado (`bold`) y estadísticas (`+3 / -2`). Los estados describen sólo el delta observado; no consultan staging ni renames de Git.
  - **Línea 2 (Secundaria):** Ruta relativa atenuada (`dim`/`muted`), sangrada discretamente (`    src/path/to/file.ts`).
- **Inspección de ruta completa:** La ruta nunca se pierde; ante anchos reducidos se trunca con `truncatePath` y el modo de inspección `i` o la barra inferior permiten ver la ruta completa sin cortes.
- **Diferenciación visual:** Distingue el archivo activo (cursor `>`), el archivo expandido (`▾`) y el estado de foco del panel (`accent`).

---

## 4. Hunks y Líneas de Código (Unified Diff)

- **Fila única por línea:** Un único renglón visual por línea de diff; sin envoltorio automático (no wrap).
- **Gutter contextual compacto (M4.1):** Una columna para todos los archivos: `oldLine` en eliminadas, `newLine` en agregadas y contexto. Ancho mínimo de cuatro dígitos, ampliable por archivo; `Line numbers: Off` la oculta. El modelo y los rangos old/new anexados permanecen completos. Overhead habitual 10 columnas frente a 15 del antiguo dual: 5 recuperadas en modificados, sin ganancia nueva en creados/eliminados. Sangría original preservada.
- **Gutter fijo ante desplazamiento horizontal:** Con foco en el explorador, `←`/`→` o `h`/`l` desplazan ocho columnas de código del archivo activo expandido, también desde su encabezado. Borde, cursor, número y signo quedan fijos. `«` indica contenido oculto a la izquierda y `»` a la derecha (reserva una celda sólo con overflow). Offset independiente por archivo, acotado al contenido mostrado; se conserva al contraer, se ajusta al ampliar viewport y se reinicia al cambiar la identidad de iteración. `0`/`Home` reinicia el offset activo y conserva el salto existente al inicio del explorador. La rueda sigue siendo vertical: Pi 1.4.0 no expone un eje horizontal fiable. Protocolo humano y experimento de sangría aislado en `../M4.1.md`.
- **Colores semánticos Pi Theme:** Adiciones (`toolDiffAdded`), eliminaciones (`toolDiffRemoved`), contexto (`text`), gutter (`dim`), borde (`border`), foco (`accent`).
- **Encabezados de Hunk discretos:** Formato `@@ -12,3 +12,4 @@` en color tenue `muted`/`dim`.
- **Selección de Hunk completo:** Posicionarse sobre el encabezado del hunk permite seleccionarlo íntegro para transferir.

---

## 5. Cabecera y Footer Compactos y Responsivos (English-only)

### Cabecera de Dos Líneas (`basis: 2`)
- El dock añade una fila superior real fuera del scroll: `🭽` + `▔` hasta el ancho visible, en accent con foco y en dim sin foco. Los laterales y prefijos usan `▏`; el área de contenido/mouse empieza debajo del borde superior. No se usa SGR overline.
- **Línea 1 (Título y alcance):** `│ DIFF · <Scope>` a la izquierda y cantidad de archivos alineada a la derecha (`N files` o `1 file`).
  - **Alcances contextuales (ADR-003):**
    - `Last iteration`: Iteración individual completa normal.
    - `Batch Net`: Ventana agrupada con múltiples entradas.
    - `Unverified`: Ventana sin atribución verificada.
    - `Partial`: Captura incompleta o parcial.
    - `Cancelled`: Ejecución interrumpida o cancelada.
    - `Failed`: Ejecución fallida con cambios netos observados.
    - `Unavailable`: Diff o captura no disponible.
    - `Capturing`: Captura en curso.
  - **Diferenciación conceptual de exclusiones y omisiones:** Las rutas excluidas por política (.git, node_modules, límites de snapshot) no añaden `[omissions]` a la cabecera; sus detalles permanecen accesibles bajo demanda en la vista compacta de información (`d`).
- **Línea 2 (Resumen de cambios):** `│ +added / -removed` utilizando los tokens semánticos de Pi (`toolDiffAdded`, `toolDiffRemoved`, `dim`).
  - Sin cambios: `│ No changes` en estilo `dim`.
  - Estadísticas no disponibles: `│ stats unavailable` en estilo `dim`.
- **Detalles bajo demanda:** Conmutables mediante teclado (`d`) o clic con ratón en la cabecera (`y === 0 || y === 1`).

### Footer (1 línea)
- Todo en inglés, adaptable al ancho del dock:
  - Sin selección (< 50 cols): `│ Enter: expand · a: append · Esc: editor`
  - Sin selección (< 75 cols): `│ Enter: expand · a: append · ↑↓: navigate · Esc: editor`
  - Estándar (>= 75 cols): `│ Enter: expand · a: append · ↑↓: navigate · Esc: editor · d: details`
  - Con selección (< 55 cols): `│ N lines selected · a: append`
  - Con selección (>= 55 cols): `│ Sel: old:X, new:Y (N lines) · a: append to editor`
  - Modo inspección activo (`i`): `│ i: <full path or raw line text>`

---

## 6. Selección y Transferencia de Contexto (Etapa B)

### Mecánica de Selección
- **Clic:** Selecciona una línea individual de diff (añadida, eliminada o contexto).
- **Arrastre de ratón (Drag):** Selecciona el rango continuo de líneas abarcado.
- **Teclado:** `Shift + ↑` y `Shift + ↓` extienden o contraen el rango de selección.
- **Encabezado de hunk:** Seleccionar un encabezado `@@` marca el hunk completo.
- **Mapeo exacto:** La selección registra fielmente el rango `old` (líneas originales) y `new` (líneas nuevas) correspondientes.
- **Prioridad visual:** El fondo `selectedBg` o inversión de video prevalece sobre `toolDiffAdded` y `toolDiffRemoved`.

### Transferencia al Editor Nativo
- **Atajo `a`:** Anexa el fragmento seleccionado al final del borrador actual del editor de Pi.
- **Sin prompts prefabricados:** No se añaden palabras clave fijas como `FIX` o `DISCUSS`. El usuario conserva total libertad para formular su petición.
- **Preservación total del borrador:** El texto previo en el editor se mantiene intacto (`previousDraft + "\n\n" + snippet`).
- **Sin autoenvío:** Nunca se llama a enviar o ejecutar el prompt; el usuario decide cuándo pulsar `Enter`.
- **Retorno automático de foco:** Tras presionar `a`, el foco vuelve inmediatamente al editor nativo de Pi.
- **Persistencia del dock:** El dock permanece montado, visible y con sus archivos expandidos.
- **Anexado sucesivo:** El usuario puede seleccionar otro fragmento de otro archivo y volver a pulsar `a`, concatenando múltiples fragmentos separados limpiamente.

### Formato de Contexto Transferido
```text
[src/utils/calculator.ts | diff | old:12-14 | new:12-15]
@@ -12,3 +12,4 @@
 function calculateTotal(items) {
-  return items.reduce(sum, 0);
+  const valid = items.filter(Boolean);
+  return valid.reduce(sum, 0);
 }
```
- Rutas relativas al workspace, nunca absolutas.
- Rangos `old` y `new` derivados de las líneas reales seleccionadas.
- Prefijos `+`, `-` y espacio de contexto rigurosamente preservados.
- Encabezado `@@` incluido cuando se selecciona un hunk completo.
- Separación discreta de fragmentos (`\n\n`).
