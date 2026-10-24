# Mockups Visuales: pi-iteration-diff

Representación gráfica con caracteres de terminal (ancho estándar: 120 columnas).

> **Nota de alcance:** El panel derecho se monta como extensión de Pi preservando la conversación y el editor nativo a la izquierda. El ancho inicial objetivo del dock es el 45% del terminal. En el editor nativo se preserva íntegramente el borrador existente. La acción `a` anexa el fragmento seleccionado y devuelve automáticamente el foco al editor, sin autoenvío ni comandos FIX/DISCUSS prefijados.

---

## 1. Explorador Inicial (Archivos Contraídos, Dos Líneas por Encabezado)

Al abrir una nueva iteración mediante `/diff`, todos los archivos inician contraídos. El encabezado de cada archivo consta de dos líneas:
1. Primera línea: Indicador de expansión (`▸`), nombre del archivo en negrita, estado (`[modificado]`, `[creado]`, `[eliminado]`) y estadísticas de líneas (`+3 / -2`).
2. Segunda línea: Ruta relativa al workspace sangrada (`  src/...`).

```text
┌────────────────────────────────────────────────────────────┬─────────────────────────────────────────────────────────┐
│ > pi (v1.4.0) — /home/agus-hy/Documentos/pi-diff           │ │ DIFF · Last iteration · 3 files (+11 / -6)            │
│                                                            │ ├───────────────────────────────────────────────────────┤
│ User: Optimizá el cálculo de tasas y ajustá los tests      │ │ > ▸ calculator.ts [modificado] +3 / -2                │
│                                                            │ │     src/utils/calculator.ts                           │
│ Agent: Modifiqué `calculator.ts` para cachear resultados   │ │   ▸ rate.ts [creado] +8 / -0                          │
│ y actualicé `calculator.test.ts`.                          │ │     src/core/rate.ts                                  │
│                                                            │ │   ▸ legacy.ts [eliminado] +0 / -4                     │
│                                                            │ │     src/legacy.ts                                     │
├────────────────────────────────────────────────────────────┤ ├───────────────────────────────────────────────────────┤
│ PI EDITOR (Borrador intacto)                               │ │ a: anexa · Enter/clic: toggle · ↑↓: navegar · q: cerrar│
│ >                                                          │ │                                                       │
└────────────────────────────────────────────────────────────┴─┴───────────────────────────────────────────────────────┘
```

---

## 2. Archivos Expandidos Independientemente y Selección de Líneas (Unified Diff)

Al presionar `Enter` o hacer clic sobre un encabezado, se expande su contenido unified. Múltiples archivos pueden permanecer abiertos.
Desde M4.1 el gutter muestra un único número contextual fijo: antiguo en eliminaciones, nuevo en adiciones y contexto. Las referencias old/new completas se conservan en el modelo y al anexar. El código seleccionado tiene **prioridad visual absoluta** (`selectedBg` / resaltado):

```text
┌────────────────────────────────────────────────────────────┬─────────────────────────────────────────────────────────┐
│ > pi (v1.4.0) — /home/agus-hy/Documentos/pi-diff           │ │ DIFF · Last iteration · 3 files (+11 / -6)            │
│                                                            │ ├───────────────────────────────────────────────────────┤
│ User: Optimizá el cálculo de tasas y ajustá los tests      │ │ ▾ calculator.ts [modificado] +3 / -2                  │
│                                                            │ │   src/utils/calculator.ts                             │
│ Agent: Modifiqué `calculator.ts` para cachear resultados   │ │   @@ -12,3 +12,4 @@                                   │
│ y actualicé `calculator.test.ts`.                          │ │   11   11   function calculateTotal(items) {          │
│                                                            │ │ > 12   12 - ████ return items.reduce(sum, 0);         │
│                                                            │ │ > 12   13 + ████ const valid = items.filter(Boolean); │
│                                                            │ │ > 13   14 + ████ return valid.reduce(sum, 0);         │
│                                                            │ │   14   15   }                                         │
│                                                            │ │                                                       │
│                                                            │ │ ▸ rate.ts [creado] +8 / -0                            │
│                                                            │ │   src/core/rate.ts                                    │
├────────────────────────────────────────────────────────────┤ ├───────────────────────────────────────────────────────┤
│ PI EDITOR (Borrador intacto)                               │ │ Sel: old:12, new:12-14 (3 líneas) · a: anexa al editor │
│ >                                                          │ │                                                       │
└────────────────────────────────────────────────────────────┴─┴───────────────────────────────────────────────────────┘
```

---

## 3. Transferencia de Contexto al Editor Nativo (`a`)

Al presionar `a`, el fragmento seleccionado se formatea y se anexa al final del borrador del editor nativo, devolviendo automáticamente el foco al editor (`Pi Editor`). El dock permanece abierto:

```text
┌────────────────────────────────────────────────────────────┬─────────────────────────────────────────────────────────┐
│ > pi (v1.4.0) — /home/agus-hy/Documentos/pi-diff           │ │ DIFF · Last iteration · 3 files (+11 / -6)            │
│                                                            │ ├───────────────────────────────────────────────────────┤
│ User: Optimizá el cálculo de tasas y ajustá los tests      │ │ ▾ calculator.ts [modificado] +3 / -2                  │
│                                                            │ │   src/utils/calculator.ts                             │
│ Agent: Modifiqué `calculator.ts` para cachear resultados...│ │   @@ -12,3 +12,4 @@                                   │
│                                                            │ │   11   11   function calculateTotal(items) {          │
│                                                            │ │   12   12 - return items.reduce(sum, 0);              │
│                                                            │ │   12   13 + const valid = items.filter(Boolean);      │
│                                                            │ │   13   14 + return valid.reduce(sum, 0);              │
│                                                            │ │   14   15   }                                         │
│                                                            │ │                                                       │
│                                                            │ │ ▸ rate.ts [creado] +8 / -0                            │
│                                                            │ │   src/core/rate.ts                                    │
├────────────────────────────────────────────────────────────┤ ├───────────────────────────────────────────────────────┤
│ PI EDITOR (Foco activo; borrador preservado y enriquecido) │ │ [F6] Focus Diff · [Esc] Dismiss                       │
│ > Mi instrucción previa                                    │ │                                                       │
│                                                            │ │                                                       │
│ [src/utils/calculator.ts | diff | old:12 | new:12-14]      │ │                                                       │
│ - return items.reduce(sum, 0);                             │ │                                                       │
│ + const valid = items.filter(Boolean);                     │ │                                                       │
│ + return valid.reduce(sum, 0);                             │ │                                                       │
└────────────────────────────────────────────────────────────┴─┴───────────────────────────────────────────────────────┘
```

---

## 4. Estado de Ventana Agrupada (Batch Net contextual)

Cuando se encolaron múltiples mensajes durante la ejecución del agente:

```text
┌────────────────────────────────────────────────────────────┬─────────────────────────────────────────────────────────┐
│ > pi (v1.4.0) — /home/agus-hy/Documentos/pi-diff           │ │ DIFF · Batch Net · 2 files (+4 / -1) [lote encolado]  │
│                                                            │ ├───────────────────────────────────────────────────────┤
│ User: Arreglá el typo                                      │ │ ▾ typo.ts [modificado] +1 / -1                        │
│ User: Y agregá el test                                     │ │   src/typo.ts                                         │
│ Agent: Realicé ambas correcciones...                       │ │                                                       │
│                                                            │ │ ▸ typo.test.ts [creado] +3 / -0                       │
│                                                            │ │   tests/typo.test.ts                                  │
├────────────────────────────────────────────────────────────┤ ├───────────────────────────────────────────────────────┤
│ PI EDITOR                                                  │ │ a: anexa · Enter/clic: toggle · Esc: editor · q: cerrar│
│ >                                                          │ │                                                       │
└────────────────────────────────────────────────────────────┴─┴───────────────────────────────────────────────────────┘
```
