# UI Specification: pi-iteration-diff

**Versión:** 1.1  
**Entorno de ejecución:** Pi Coding Agent (Terminal interactiva fullscreen y dentro de Herdr).  
**Tipo de interfaz:** Terminal User Interface (TUI) montada como extensión sobre `@earendil-works/pi-tui`.

---

## 1. Principios de diseño

1. **Extensión no intrusiva sobre Pi:** El panel derecho se monta dinámicamente preservando intactos el transcript de la conversación y el editor nativo de Pi a la izquierda. Nunca se abre automáticamente; se abre o cierra exclusivamente por acción explícita mediante `/diff` (o el fallback `/iteration-diff`).
2. **Consumo estricto del tema activo:** No se introduce ni se exige un tema propio obligatorio. Todos los colores, estilos y contrastes se resuelven dinámicamente desde `ctx.ui.theme` según la configuración del usuario en Pi (`system`, `dark`, `light` o tema personalizado).
3. **Prioridad visual de la selección:** Cuando una línea (añadida, eliminada o de contexto) forma parte de un rango seleccionado, el estilo de selección (`selectedBg` o inversión de video) tiene **prioridad visual absoluta** sobre los fondos de adición y borrado, evitando ambigüedades en cualquier terminal o tema.
4. **Minimalismo y sobriedad en terminal:** Evitar adornos gráficos innecesarios, badges pesados o barras redundantes que resten espacio vertical u horizontal útil, especialmente en terminales estrechas o paneles divididos de Herdr.
5. **Acciones explícitas sin autoenvío:** Las acciones de anexo (`FIX` y `DISCUSS`) añaden el fragmento al borrador existente y devuelven el control al usuario; jamás disparan el envío automático del prompt.
6. **Declaración honesta de capacidades:** La preservación del editor se limita a lo técnicamente demostrado en M0: **la conservación íntegra del contenido del borrador de texto**. No se promete el posicionamiento del cursor tras anexar fragmentos, selecciones activas ni el árbol de deshacer (`undo`) del editor nativo.
7. **Diferenciación conceptual del Preview HTML:** Las maquetas HTML/CSS locales son exclusivamente herramientas documentales de apoyo para revisar paletas y proporciones en navegador; **no validan funcionalidad real del producto** ni replican el modelo de eventos, terminales o multiplexores de Pi TUI.

---

## 2. Parámetros de Layout y Umbrales Adaptativos

Los anchos y umbrales no son constantes fijas rígidas, sino **parámetros configurables y calibrables** en el adaptador de layout según la densidad del terminal y el entorno (Pi directo o panes de Herdr):

```text
┌──────────────────────────────────────────────────────────┬──────────────────────────────────────────┐
│  PI TRANSCRIPT (Chat Viewport)                           │  DIFF DOCK (Iteration Diff Viewport)     │
│                                                          │                                          │
│  User: Arreglá el cálculo de balance                     │  │ [Last*]  Current  History             │
│  Agent: Modifiqué src/balance.ts aplicando el clamp...   │  │ ▾ src/balance.ts              +3  -2   │
│                                                          │  │   11   const offset = init();         │
│                                                          │  │ > 12 - const max = balance;           │
│                                                          │  │ > 12 + const max = clamp(limit);      │
│                                                          │  │   13   return max + offset;           │
├──────────────────────────────────────────────────────────┤  │                                       │
│  PI NATIVE EDITOR                                        │  │                                       │
│  > Revisá el caso cuando limit es negativo|              │  │ L12 (3 lines) · [a] FIX  [d] DISCUSS  │
└──────────────────────────────────────────────────────────┴──┴───────────────────────────────────────┘
```

### Tabla de umbrales de referencia (calibrables)

| Parámetro | Valor por defecto | Comportamiento |
|---|---|---|
| `MIN_COLUMNS_THRESHOLD` | `90 cols` | Si el ancho total es menor, el dock se oculta automáticamente y el foco regresa al editor nativo para no romper la legibilidad del chat. |
| `DOCK_DEFAULT_BASIS` | `34 – 42 cols` | Ancho base para anchos moderados (90 a 120 columnas). |
| `DOCK_PROPORTIONAL_RATIO` | `0.35 – 0.40` | Proporción de pantalla reservada al dock en terminales anchas (> 120 columnas). |
| `SIDE_BY_SIDE_MIN_WIDTH` | `140 – 160 cols` | Umbral mínimo para permitir la vista side-by-side sin truncar código de forma excesiva. |

---

## 3. Jerarquía de Componentes TUI y Sobriedad

Para maximizar el espacio útil en pantalla:

```text
DockRoot (HStack child)
 ├── BorderSeparator (Text: línea "│" usando token `border` o `muted`)
 └── DockContainer (VStack)
      ├── HeaderLine (1 línea: título compacto + selector de scope [Last* | Current | Hist])
      ├── DiffViewport (ScrollView: hunks, números de línea, código con truncado estricto)
      └── ActionStatusLine (1 línea: rango activo + atajos esenciales [a] FIX [d] DISCUSS [Esc] Editor)
```

### Indicador de foco minimalista
- **Con foco:** El encabezado del panel se colorea con el token `accent` del tema activo. No se utilizan badges adicionales tipo `[FOCUSED]` ni bordes dobles pesados.
- **Sin foco:** El encabezado se muestra con el color `dim` o `text` por defecto.
- Al alternar el foco (vía `F6`, `Esc`, `Tab` o click de ratón), el componente solicita repintado mediante `tui.requestRender()`.

---

## 4. Prioridad Visual de Estilos y Tokens de Tema

Todos los estilos se resuelven a través de los tokens estándar de Pi:

| Rol de UI | Token de Pi Theme | Regla de precedencia visual |
|---|---|---|
| **Línea seleccionada (Rango activo)** | `selectedBg` / `searchMatchBg` | **Prioridad 1 (Máxima):** El fondo de selección cubre la línea completa. El prefijo `+` o `-` y el texto mantienen su identidad semántica, pero el fondo de adición/eliminación cede ante la selección para certificar qué líneas están marcadas. |
| **Cursor actual (`>`)** | `accent` | Marca en la columna de control la línea activa del cursor. |
| **Línea añadida (`+`)** | `toolDiffAdded` (o `success`) | Fondo tenue y/o texto coloreado (solo cuando la línea no está seleccionada). |
| **Línea eliminada (`-`)** | `toolDiffRemoved` (o `error`) | Fondo tenue y/o texto coloreado (solo cuando la línea no está seleccionada). |
| **Gutter de números de línea** | `dim` | Números de línea `old:new` atenuados para no distraer del código. |
| **Línea de contexto** | `text` | Texto ordinario del tema. |
| **Borde / Separador** | `border` o `muted` | Línea divisoria discreta entre chat y dock. |

---

## 5. Estados del Ciclo de Vida y Casos Especiales (ADR-003)

El dock debe reflejar fielmente los contratos de ciclo de vida definidos en ADR-003:

### A. Ventanas agrupadas / Peticiones encoladas (Batch Net)
Si entraron múltiples mensajes en cola durante la ejecución del agente, **no es posible garantizar causalidad ni aislar la última petición de forma individual**:
- `Batch` es un **estado contextual** de la ventana de diff, no una pestaña o tab permanente.
- El panel muestra el **diff neto propio de la ejecución acumulada de ese lote agrupado (`Batch Net`)**, diferenciado explícitamente del árbol de trabajo completo (`Current Working Tree`). Un diff de batch **nunca se etiqueta ni se confunde con Current**.
- La UI desactiva la opción `Last iteration` individual y presenta el estado contextual:  
  `│ DIFF: BATCH NET (Ventana agrupada)                                 │`  
  `│ [!] Iteración individual no aislable (múltiples mensajes en cola).  │`  
  `│ Mostrando diff neto del lote. Para ver todo el árbol: [w] Current. │`

### B. Ejecución cancelada o abortada
Si el usuario presionó `Ctrl+C` o el agente se interrumpió antes de completar la tarea (`agent_settled: aborted=true`):
- El encabezado indica el estado: `│ DIFF: LAST ITERATION (Interrumpida) │`.
- Se presenta únicamente el delta neto observado hasta el momento del aborto, sin asumir completitud ni consistencia.

### C. Captura parcial o truncamiento por límites
Si se excedieron los límites configurables de tamaño de archivo, líneas o bytes:
- La cabecera o pie de archivo incluye un aviso visible:  
  `│ [!] Diff truncado: límite de 1,000 líneas alcanzado.               │`

### D. Iteración sin cambios en el workspace
Si la petición fue una consulta pura o una respuesta explicativa sin escrituras:
- Se muestra un estado limpio y directo:  
  `│ ✓ No se observaron cambios en la última iteración.                │`  
  `│ [c] Ver cambios acumulados en Current Working Tree                │`

---

## 6. Modelo de Interacción y Acciones Explícitas

1. **Navegación:**  
   `↑` / `↓` mueven el cursor. `Shift + ↑/↓` o arrastre con botón izquierdo del mouse definen el rango.
2. **Anexado explícito (sin autoenvío ni garantía de cursor):**  
   - Al presionar `a`, se anexa el bloque con tag `[FIX]`.
   - Al presionar `d`, se anexa el bloque con tag `[DISCUSS]`.
   - El texto se incorpora al final del borrador de entrada de Pi mediante la API del editor (`setEditorText(draft + "\n\n" + excerpt)`). **No se garantiza ni se controla la posición final del cursor** en el editor nativo tras la inserción, y **jamás se envía la petición**.
   - En selecciones mixtas (que abarcan tanto líneas eliminadas como añadidas), la barra de estado y los metadatos de inserción desglosan con exactitud los rangos de ambos lados: `old:L_start-L_end, new:L_start-L_end (N filas totales: X old, Y new)`.
3. **Retorno seguro:**  
   `Esc` o `Tab` devuelven el foco al editor nativo conservando la selección en el diff. `/diff` o `q` cierran el panel y restauran el layout original.
