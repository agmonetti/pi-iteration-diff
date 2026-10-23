# Mockups Visuales: pi-iteration-diff

Representación gráfica con caracteres de terminal (ancho estándar: 120 columnas).

> **Nota de alcance:** El panel derecho se monta como extensión de Pi preservando la conversación y el editor nativo a la izquierda. Los anchos indicados (ej. 120 cols totales, split 60/40) son parámetros configurables. En el editor nativo solo está demostrada la preservación del contenido del borrador (texto acumulado); no se garantiza el posicionamiento del cursor tras anexar, ni la retención de selecciones internas o historial de deshacer.
## M2 — Explorador inicial y expansiones independientes

Decisión aprobada: cada nueva iteración se abre con todos los archivos contraídos.
Los estados de foco y tamaño no reinician expansiones; cambiar la iteración sí.
Este esquema sustituye el estado inicialmente expandido de las maquetas futuras.

```text
│ DIFF: LAST ITERATION
│ Delta neto observado; no atribución de autoría
│ > ▸ src/balance.ts [modificado] +3 / -2
│   ▸ src/new.ts [creado] +8 / -0
│   ▸ old.ts [eliminado] +0 / -4
│ Enter/clic: expandir · ↑↓: navegar · Esc: editor
```

Tras abrir dos encabezados, ambos permanecen expandidos; el tercero sigue cerrado:

```text
│   ▾ src/balance.ts [modificado] +3 / -2
│     @@ -11,2 +11,3 @@
│     … contenido unified bajo demanda …
│ > ▾ src/new.ts [creado] +8 / -0
│     @@ -0,0 +1,8 @@
│     … contenido unified bajo demanda …
│   ▸ old.ts [eliminado] +0 / -4
```

Scroll propio del dock, límites visibles y sin acciones de feedback en M2.
Las maquetas de selección, Current/History y anexado siguientes son diseño futuro.


---

## Estado 1: Foco en Diff con Selección Mixta y Prioridad Visual (Unified Diff)

El foco se indica de forma minimalista aplicando el token `accent` exclusivamente en el título de cabecera. La selección visual (`███` / resaltado) toma **prioridad absoluta** sobre los fondos de líneas añadidas y eliminadas. En selecciones mixtas, la barra inferior desglosa con exactitud los rangos de ambos lados y la contabilidad total de filas visuales (1 old + 3 new = 4 filas):

```text
┌────────────────────────────────────────────────────────────┬─────────────────────────────────────────────────────────┐
│ > pi (v1.4.0) — /home/agus-hy/Documentos/pi-diff           │ │ DIFF: LAST ITERATION                                  │
│                                                            │ │ [Last*]  Current  History                             │
│ User: Arreglá el cálculo de balance cuando limit es 0      │ ├───────────────────────────────────────────────────────┤
│                                                            │ │ ▾ src/balance.ts (1/2)                     +3  -2     │
│ Agent: Modifiqué `src/balance.ts` para verificar si limit  │ │ @@ -11,8 +11,9 @@ export function calcBalance()      │
│ es igual a 0 antes de realizar la división.                │ │   11   const offset = config.initialOffset;           │
│                                                            │ │ > 12 - ████ const ratio = limit ? total / limit : 0;  │
│                                                            │ │ > 12 + ████ if (limit === 0) {                        │
│                                                            │ │ > 13 + ████   return offset;                          │
│                                                            │ │ > 14 + ████ }                                         │
│                                                            │ │   15   return (total / limit) + offset;               │
│                                                            │ │                                                       │
│                                                            │ │ ▸ tests/balance.test.ts (2/2)              +6  -0     │
├────────────────────────────────────────────────────────────┤ ├───────────────────────────────────────────────────────┤
│ PI EDITOR (Borrador intacto)                               │ │ old:12, new:12-14 (4 rows: 1 old, 3 new)              │
│ >                                                          │ │ [a] FIX  [d] DISCUSS  [Esc] Editor                    │
└────────────────────────────────────────────────────────────┴─┴───────────────────────────────────────────────────────┘
```

---

## Estado 2: Foco devuelto al Editor tras Anexar Fragmento Mixto (Sin autoenvío)

El encabezado del dock vuelve al color atenuado (`dim`/`text`). El fragmento se anexa al borrador existente desglosando los lados sin disparar el envío ni manipular la posición del cursor:

```text
┌────────────────────────────────────────────────────────────┬─────────────────────────────────────────────────────────┐
│ > pi (v1.4.0) — /home/agus-hy/Documentos/pi-diff           │ │ DIFF: LAST ITERATION                                  │
│                                                            │ │ [Last*]  Current  History                             │
│ User: Arreglá el cálculo de balance cuando limit es 0      │ ├───────────────────────────────────────────────────────┤
│                                                            │ │ ▾ src/balance.ts (1/2)                     +3  -2     │
│ Agent: Modifiqué `src/balance.ts` para verificar si limit  │ │ @@ -11,8 +11,9 @@ export function calcBalance()      │
│ es igual a 0 antes de realizar la división.                │ │   11   const offset = config.initialOffset;           │
│                                                            │ │   12 - const ratio = limit ? total / limit : 0;       │
│                                                            │ │   12 + if (limit === 0) {                             │
│                                                            │ │   13 +   return offset;                               │
│                                                            │ │   14 + }                                              │
│                                                            │ │   15   return (total / limit) + offset;               │
│                                                            │ │                                                       │
│                                                            │ │ ▸ tests/balance.test.ts (2/2)              +6  -0     │
├────────────────────────────────────────────────────────────┤ ├───────────────────────────────────────────────────────┤
│ PI EDITOR (Foco activo en escritura)                       │ │ [F6] Focus Diff  [Esc] Dismiss                        │
│ > Agregá también un warning si limit es menor a 0          │ │                                                       │
│                                                            │ │                                                       │
│ [src/balance.ts | mixed | old:12, new:12-14 | FIX]         │ │                                                       │
│ > - const ratio = limit ? total / limit : 0;               │ │                                                       │
│ > + if (limit === 0) {                                     │ │                                                       │
│ > +   return offset;                                       │ │                                                       │
│ > + }                                                      │ │                                                       │
└────────────────────────────────────────────────────────────┴─┴───────────────────────────────────────────────────────┘
```

---

## Estado 3: Sin cambios detectados en la última iteración

```text
┌────────────────────────────────────────────────────────────┬─────────────────────────────────────────────────────────┐
│ > pi (v1.4.0) — /home/agus-hy/Documentos/pi-diff           │ │ DIFF: LAST ITERATION                                  │
│                                                            │ │ [Last*]  Current  History                             │
│ User: Explicame cómo funciona la autenticación por JWT     │ ├───────────────────────────────────────────────────────┤
│                                                            │ │                                                       │
│ Agent: El flujo se gestiona en src/auth.ts mediante tokens │ │            ✓ No changes in last iteration             │
│ firmados con HMAC-SHA256...                                │ │                                                       │
│                                                            │ │    Esta petición solo consultó archivos o respondió   │
│                                                            │ │    sin realizar modificaciones en el workspace.       │
│                                                            │ │                                                       │
│                                                            │ │    Ver cambios sin commit: [Current] (presioná 'c')   │
│                                                            │ │                                                       │
├────────────────────────────────────────────────────────────┤ ├───────────────────────────────────────────────────────┤
│ PI EDITOR                                                  │ │ [c] View Current  [Esc] Close                         │
│ >                                                          │ │                                                       │
└────────────────────────────────────────────────────────────┴─┴───────────────────────────────────────────────────────┘
```

---

## Estado 4: Ventanas agrupadas / Peticiones encoladas (ADR-003: Batch Net contextual)

Cuando entraron múltiples mensajes en cola durante la ejecución, no se aísla una iteración individual y el diff se presenta en un estado contextual propio de **Batch Net** (nunca etiquetado como `Current Working Tree`):

```text
┌────────────────────────────────────────────────────────────┬─────────────────────────────────────────────────────────┐
│ > pi (v1.4.0) — /home/agus-hy/Documentos/pi-diff           │ │ DIFF: BATCH NET (Ventana agrupada)                    │
│                                                            │ │ ⚠ Iteración individual no aislable (mensajes en cola) │
│ User: Arreglá el typo                                      │ ├───────────────────────────────────────────────────────┤
│ User: Y también agregá el test                             │ │ Mostrando diff neto del lote acumulado de ejecuciones:│
│ Agent: Realicé ambas correcciones...                       │ │                                                       │
│                                                            │ │ ▾ src/typo.ts                              +1  -1     │
│                                                            │ │ ▾ tests/typo.test.ts                       +8  -0     │
│                                                            │ │                                                       │
│                                                            │ │ (Diferenciado de Current Working Tree)                 │
├────────────────────────────────────────────────────────────┤ ├───────────────────────────────────────────────────────┤
│ PI EDITOR                                                  │ │ [w] Ver Working Tree  [Esc] Editor                    │
│ >                                                          │ │                                                       │
└────────────────────────────────────────────────────────────┴─┴───────────────────────────────────────────────────────┘
```

---

## Estado 5: Iteración Interrumpida / Abortada (Ctrl+C / bash-abort)

Si la ejecución fue cancelada antes de que el agente finalizara normalmente:

```text
┌────────────────────────────────────────────────────────────┬─────────────────────────────────────────────────────────┐
│ > pi (v1.4.0) — /home/agus-hy/Documentos/pi-diff           │ │ DIFF: LAST ITERATION [Interrumpida]                   │
│                                                            │ │ [Last*]  Current  History                             │
│ User: Ejecutá la migración y actualizá los schemas         │ ├───────────────────────────────────────────────────────┤
│ Agent: Iniciando scripts/migrate.sh...                     │ │ ⚠ Ejecución abortada (agent_settled: aborted=true)     │
│ ^C (Cancelled by user)                                     │ │ Cambios parciales observados antes del aborto:        │
│                                                            │ │                                                       │
│                                                            │ │ ▾ migrations/003.sql                       +12 -0     │
│                                                            │ │ @@ -1,0 +1,12 @@                                      │
│                                                            │ │ + CREATE TABLE session_tokens (...);                  │
├────────────────────────────────────────────────────────────┤ ├───────────────────────────────────────────────────────┤
│ PI EDITOR                                                  │ │ [a] FIX  [d] DISCUSS  [Esc] Editor                    │
│ >                                                          │ │                                                       │
└────────────────────────────────────────────────────────────┴─┴───────────────────────────────────────────────────────┘
```

---

## Estado 6: Captura parcial por límites de tamaño (Truncamiento)

```text
┌────────────────────────────────────────────────────────────┬─────────────────────────────────────────────────────────┐
│ > pi (v1.4.0) — /home/agus-hy/Documentos/pi-diff           │ │ DIFF: LAST ITERATION                                  │
│                                                            │ │ [Last*]  Current  History                             │
│ User: Generá el bundle de assets compilados                │ ├───────────────────────────────────────────────────────┤
│ Agent: Compilación completa...                             │ │ ▾ dist/bundle.js (Truncado: excede 1,000 líneas)      │
│                                                            │ │   [!] Diff parcial. Para revisar completo usá git.    │
│                                                            │ │ @@ -1,20 +1,20 @@                                     │
│                                                            │ │   ...                                                 │
├────────────────────────────────────────────────────────────┤ ├───────────────────────────────────────────────────────┤
│ PI EDITOR                                                  │ │ [!] Truncado por límites de seguridad  [Esc] Editor   │
│ >                                                          │ │                                                       │
└────────────────────────────────────────────────────────────┴─┴───────────────────────────────────────────────────────┘
```
