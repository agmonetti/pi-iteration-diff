# UI Specification: pi-iteration-diff

**Versión:** 2.0 — Especificación definitiva aprobada por el usuario  
**Entorno de ejecución:** Pi Coding Agent (Terminal interactiva fullscreen y dentro de Herdr).  
**Tipo de interfaz:** Terminal User Interface (TUI) montada como extensión sobre `@earendil-works/pi-tui`.

---

## 1. Principios de diseño definitivos

1. **Extensión no intrusiva sobre Pi:** El panel derecho se monta dinámicamente preservando intactos el transcript de la conversación y el editor nativo de Pi a la izquierda. Nunca se abre automáticamente; se abre o cierra exclusivamente por acción explícita mediante `/diff` (o el fallback `/iteration-diff`).
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
│  User: Refactorizá el cálculo de tasas                     │  │ DIFF · Last iteration · 2 files (+12 / -4)           │
│  Agent: Apliqué la normalización en calculator.ts...       │  │                                                      │
│                                                            │  │ ▾ calculator.ts [modificado] +3 / -2                 │
│                                                            │  │   src/utils/calculator.ts                            │
│                                                            │  │   11   11   const offset = init();                   │
│                                                            │  │   12   12 - const max = balance;                     │
│                                                            │  │   12   12 + const max = clamp(limit);                │
│                                                            │  │                                                      │
├────────────────────────────────────────────────────────────┤  │ ▸ rate.ts [creado] +9 / -0                           │
│  PI NATIVE EDITOR                                          │  │   src/core/rate.ts                                   │
│  > Revisá también las excepciones|                         │  │                                                      │
│                                                            │  │ Enter: toggle · a: anexa al editor · Esc: editor     │
└────────────────────────────────────────────────────────────┴──┴──────────────────────────────────────────────────────┘
```

### Tabla de parámetros de layout

| Parámetro | Valor por defecto | Comportamiento |
|---|---|---|
| `MIN_COLUMNS_THRESHOLD` | `90 cols` | Si el ancho total es menor, el dock se oculta automáticamente y el foco regresa al editor nativo para salvaguardar la legibilidad del chat. |
| `DOCK_INITIAL_RATIO` | `0.45` (45%) | Proporción inicial del ancho del terminal asignada al dock. |
| `CHAT_MIN_WIDTH` | `46 cols` | Ancho mínimo garantizado para el transcript y editor de Pi. |
| `DOCK_MIN_WIDTH` | `34 cols` | Ancho mínimo del panel de diff al achicarlo. |
| `DOCK_MAX_WIDTH` | `75% terminal` | Ancho máximo permitido para el dock al agrandarlo. |

### Redimensionamiento
- **Arrastre de ratón:** Arrastrar el separador vertical `│` ajusta dinámicamente el ancho del dock.
- **Teclado:** Atajos `[` / `]` o `Ctrl+Left` / `Ctrl+Right` permiten expandir o contraer el dock en pasos de 4 columnas.
- **Persistencia de estado:** El ancho ajustado se preserva al alternar focos o al cambiar de iteración, recalculándose proporcionalmente ante redimensionamientos del terminal (`resize`).

---

## 3. Explorador de Archivos Inline (Dos Líneas por Encabezado)

- **Inline con diffs:** Cada archivo presenta su contenido unified directamente debajo de su encabezado sin un visor separado.
- **Colapso inicial:** Al recibir una nueva iteración, todos los archivos inician contraídos.
- **Expansiones independientes:** `Enter` o clic en el encabezado alternan únicamente ese archivo. Múltiples archivos pueden permanecer abiertos a la vez.
- **Encabezado de dos líneas:**
  - **Línea 1 (Principal):** Indicador de expansión (`▾`/`▸`), nombre del archivo destacado (`bold`), estado (`[creado]`, `[modificado]`, `[eliminado]`) y estadísticas de cambios (`+3 / -2`).
  - **Línea 2 (Secundaria):** Ruta relativa atenuada (`dim`/`muted`), sangrada discretamente (`  src/path/to/file.ts`).
- **Inspección de ruta completa:** La ruta nunca se pierde; ante anchos reducidos se trunca con `truncatePath` y el modo de inspección `i` o la barra inferior permiten ver la ruta completa sin cortes.
- **Diferenciación visual:** Distingue el archivo activo (cursor `>`), el archivo expandido (`▾`) y el estado de foco del panel (`accent`).

---

## 4. Hunks y Líneas de Código (Unified Diff)

- **Fila única por línea:** Un único renglón visual por línea de diff; sin envoltorio automático (no wrap).
- **Gutter compacto y adaptativo:**
  - Archivos creados: Columna única con números de línea nuevos (`newLine`), liberando 5 columnas adicionales para el código.
  - Archivos eliminados: Columna única con números de línea antiguos (`oldLine`), liberando 5 columnas adicionales.
  - Archivos modificados: Dos columnas compactas (`oldLine` y `newLine`) cuando ambas referencias son necesarias.
  - Eliminación de sangrías redundantes: El código inicia en la columna 10 en archivos creados/eliminados (en lugar de columna 15).
- **Gutter fijo ante desplazamiento horizontal:** `←`/`→` o `h`/`l` desplazan únicamente el contenido del código, manteniendo fijos el separador y el gutter. Un indicador `«` señala código oculto a la izquierda sin desplazar las columnas.
- **Colores semánticos Pi Theme:** Adiciones (`toolDiffAdded`), eliminaciones (`toolDiffRemoved`), contexto (`text`), gutter (`dim`), borde (`border`), foco (`accent`).
- **Encabezados de Hunk discretos:** Formato `@@ -12,3 +12,4 @@` en color tenue `muted`/`dim`.
- **Selección de Hunk completo:** Posicionarse sobre el encabezado del hunk permite seleccionarlo íntegro para transferir.

---

## 5. Cabecera y Footer Compactos y Responsivos

### Cabecera (1 línea)
- Formato: `│ DIFF · Last iteration · N files (+X / -Y)`
- **Supresión de avisos rutinarios truncados:** Avisos técnicos extensos sobre snapshots y límites del visor se excluyen de la vista normal para maximizar el espacio útil de archivos.
- **Detalles bajo demanda:** Conmutables mediante teclado (`d`) o clic con ratón en la cabecera (`y === 0`).
- **Estados contextuales y advertencias críticas siempre visibles:**
  - **Batch Net (Ventana agrupada):** `│ DIFF · Batch Net · N files (+X / -Y)`
  - **Omisiones:** `│ DIFF · Last iteration [omisiones] · N files (+X / -Y)`
  - **Parcial / Incompleta:** `│ DIFF · Last iteration [parcial] · N files (+X / -Y)`
  - **Interrumpida:** `│ DIFF · Last iteration (interrumpida) · N files`
  - **Fallida:** `│ DIFF · Last iteration (fallida) · N files`
  - **No disponible:** `│ DIFF · No disponible · Sin cambios netos`
  - **Sin cambios:** `│ DIFF · Last iteration · Sin cambios netos`

### Footer (1 línea)
- Adaptable al ancho del dock:
  - Sin selección (< 50 cols): `│ Enter: expandir · a: anexar · Esc: editor`
  - Sin selección (< 75 cols): `│ Enter: expandir · a: anexar · ↑↓: navegar · Esc: editor`
  - Estándar (>= 75 cols): `│ Enter: expandir · a: anexar · ↑↓: navegar · Esc: editor · d: detalles`
  - Con selección (< 55 cols): `│ N líneas seleccionadas · a: anexar`
  - Con selección (>= 55 cols): `│ Sel: old:X, new:Y (N líneas) · a: anexa al editor`
  - Modo inspección activo (`i`): `│ i: <ruta o línea completa sin truncar>`

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
