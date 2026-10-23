# UI Specification: pi-iteration-diff

**Versión:** 1.0  
**Entorno de ejecución:** Pi Coding Agent (Terminal interactiva fullscreen y dentro de Herdr).  
**Tipo de interfaz:** Terminal User Interface (TUI) montada sobre `@earendil-works/pi-tui`.

---

## 1. Principios de diseño

1. **No intrusión:** El panel lateral nunca se abre automáticamente; se invoca o cierra exclusivamente mediante `/diff` (o `/iteration-diff`).
2. **Coexistencia transparente:** La conversación de Pi y el editor de entrada inferior se mantienen plenamente operativos y visibles a la izquierda.
3. **Fidelidad al tema nativo:** Cero paletas hardcodeadas. Toda la UI consume los tokens semánticos del tema activo de Pi (`ctx.ui.theme`).
4. **Accesibilidad de terminal:** Operación 100% posible sin mouse (vía teclado con combinaciones estándar y atajos de una sola tecla al tener foco) y compatible con ratón cuando la terminal y el multiplexor lo soporten.
5. **Degradación controlada:** Si el ancho del terminal es inferior a 90 columnas, el dock se oculta automáticamente y el foco regresa al editor sin pérdidas de estado.

---

## 2. Anatomía del Layout y Grilla de Caracteres

El layout se compone sustituyendo temporalmente el `layoutRoot` de Pi mediante un contenedor horizontal `HStack` compuesto por dos columnas:

```text
┌──────────────────────────────────────────────────────────┬──────────────────────────────────────────┐
│  PI TRANSCRIPT (Chat Viewport)                           │  DIFF DOCK (Iteration Diff Viewport)     │
│                                                          │                                          │
│  User: Arreglá el cálculo de balance                     │  │ [Last*]  Current  T-1                 │
│  Agent: Modifiqué src/balance.ts aplicando el clamp...   │  │ 2 files (+14 -3)                      │
│                                                          │  │ ▾ src/balance.ts                      │
│                                                          │  │ 12   const min = 0;                   │
│                                                          │  │ 13 - const max = balance;             │
│                                                          │  │ 13 + const max = Math.max(0, limit);  │
│                                                          │  │ 14   return clamp(val, min, max);     │
├──────────────────────────────────────────────────────────┤  │                                       │
│  PI NATIVE EDITOR                                        │  │                                       │
│  > Revisá el caso cuando limit es negativo|              │  │ [L13] [a] FIX  [d] DISCUSS  [Esc] Back │
└──────────────────────────────────────────────────────────┴──┴───────────────────────────────────────┘
```

### Proporciones y umbrales

| Ancho terminal (`cols`) | Comportamiento del Dock | Ancho Dock | Vista Diff |
|---|---|---|---|
| `< 90 cols` | **Oculto**. Devuelve el foco al editor nativo. Notificación o badge de advertencia si se invoca `/diff`. | 0 cols | Ninguna |
| `90 – 120 cols` | **Visible compacto**. Split fijo o proporcional. | 34 – 38 cols | Unified diff |
| `121 – 160 cols` | **Visible estándar**. Split 60% chat / 40% dock. | 44 – 56 cols | Unified diff |
| `> 160 cols` | **Visible extendido**. Permite alternar a modo Side-by-Side (`sbs`). | 60 – 72 cols | Unified o Side-by-Side |

---

## 3. Jerarquía de Componentes TUI

La estructura modular interna del dock se organiza en componentes de `@earendil-works/pi-tui`:

```text
DockRoot (HStack child)
 ├── BorderSeparator (Text: línea vertical "│" o doble línea con borde)
 └── DockContainer (VStack)
      ├── HeaderBar (Component: título, indicador de foco, selector de scope)
      ├── FileSummaryBar (Component: selector de archivo actual, contadores +N -M)
      ├── DiffViewport (ScrollView: navegación de hunks y líneas de código)
      │    └── DiffContent (Component: líneas renderizadas, gutter, indicadores +/-, cursor)
      └── ActionBar (Component: ayuda de atajos, rango seleccionado, estado de anexo)
```

### Contrato de componentes
- **`DockContainer`** implementa `Focusable`. Cuando tiene foco, el encabezado o borde se renderiza usando el token `accent` del tema.
- **`DiffViewport`** encapsula el scroll vertical. Si el usuario usa la rueda del ratón sobre esta zona, `ScrollView` maneja el evento de forma independiente al transcript del chat.
- **`DiffContent`** renderiza exactamente las líneas que caben en el ancho asignado, truncando con `truncateToWidth` o midiendo con `visibleWidth` de `@earendil-works/pi-tui`.

---

## 4. Mapeo de Tokens de Color y Estilos

| Elemento de UI | Token de Pi Theme | Rol semántico | Fallback ANSI (16 colores) |
|---|---|---|---|
| **Encabezado con foco** | `accent` | Indica que el panel tiene el control del teclado | Cyan / Azul brillante |
| **Encabezado sin foco** | `dim` / `text` | Estado inactivo mientras el usuario escribe en el editor | Blanco apagado / Gris |
| **Separador vertical (`│`)** | `border` o `muted` | Delimitador entre la conversación y el dock | Gris oscuro |
| **Línea añadida (`+`)** | `toolDiffAdded` (o `success`) | Fondo tenue o texto esmeralda | Verde |
| **Línea eliminada (`-`)** | `toolDiffRemoved` (o `error`) | Fondo tenue o texto carmín | Rojo |
| **Gutter de números** | `dim` | Números de línea `old` y `new` | Gris |
| **Selección activa (rango)** | `selectedBg` / `searchMatchBg` | Resalta el bloque de líneas seleccionado | Azul inverso / Magenta |
| **Marcador de cursor (`>`)** | `accent` | Indica la línea actual del cursor | Amarillo / Cyan |
| **Badges de estado (`FIX`/`DISCUSS`)** | `warning` / `accent` | Etiquetas de las acciones de retroalimentación | Amarillo / Magenta |

---

## 5. Modelo de Interacción y Atajos de Teclado

### Estados de foco

1. **Foco en Editor Nativo (Modo Escritura):**
   - El editor de Pi recibe todas las teclas de texto ordinarias.
   - Presionar `F6` transfiere el foco al panel de diff.
   - Hacer click dentro del dock de diff enfoca automáticamente el dock y posiciona el cursor en la línea clickeada.

2. **Foco en Diff Dock (Modo Inspección):**
   - El encabezado se resalta con el color `accent`.
   - **Navegación:**
     - `↑` / `↓`: Mover cursor línea por línea (ajusta el punto de anclaje si no hay selección).
     - `Shift + ↑` / `Shift + ↓`: Expandir o contraer la selección de rango.
     - `n` / `p`: Saltar al siguiente (`next`) o previo (`prev`) hunk o archivo modificado.
     - `PageUp` / `PageDown` o `Home` / `End`: Desplazamiento rápido.
   - **Acciones sobre el código:**
     - `a` (Append FIX): Anexa el fragmento seleccionado al editor con la etiqueta `[FIX]`.
     - `d` (Append DISCUSS): Anexa el fragmento seleccionado con la etiqueta `[DISCUSS]`.
     - `c` (Copy): Copia las líneas seleccionadas al portapapeles del sistema (si el entorno lo soporta).
     - `Tab` / `Esc`: Regresa inmediatamente el foco al editor nativo de Pi sin cerrar el dock.
     - `q` o `/diff`: Cierra el dock lateral y devuelve el layout a pantalla completa normal.

### Comportamiento del ratón
- **Click izquierdo:** Posiciona el cursor en la línea.
- **Click y arrastre (Drag):** Selecciona el rango continuo de líneas desde el punto de inicio hasta donde se suelta.
- **Scroll (Wheel):** Desplaza verticalmente el diff sin mover la conversación de la izquierda.
