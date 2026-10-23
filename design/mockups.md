# Mockups Visuales: pi-iteration-diff

Representación gráfica con caracteres de terminal (ancho estándar: 120 columnas).

---

## Estado 1: Panel con foco activo y selección de rango (Unified Diff)

```text
┌────────────────────────────────────────────────────────────┬─────────────────────────────────────────────────────────┐
│ > pi (v1.4.0) — /home/agus-hy/Documentos/pi-diff           │ │ DIFF: LAST ITERATION (Focused)                        │
│                                                            │ │ [Last*]  Current  History                             │
│ User: Arreglá el cálculo de balance cuando limit es 0      │ ├───────────────────────────────────────────────────────┤
│                                                            │ │ ▾ src/balance.ts (1/2)                     +3  -2     │
│ Agent: Modifiqué `src/balance.ts` para verificar si limit  │ │ @@ -11,8 +11,9 @@ export function calcBalance()      │
│ es igual a 0 antes de realizar la división.                │ │   11   const offset = config.initialOffset;           │
│                                                            │ │ > 12 - const ratio = limit ? total / limit : 0;       │
│                                                            │ │ > 12 + if (limit === 0) {                             │
│                                                            │ │ > 13 +   return offset;                               │
│                                                            │ │ > 14 + }                                              │
│                                                            │ │   15   return (total / limit) + offset;               │
│                                                            │ │                                                       │
│                                                            │ │ ▸ tests/balance.test.ts (2/2)              +6  -0     │
│                                                            │ │                                                       │
│                                                            │ │                                                       │
├────────────────────────────────────────────────────────────┤ ├───────────────────────────────────────────────────────┤
│ PI EDITOR (Inactive)                                       │ │ Sel: L12-14 (3 lines)                                 │
│ >                                                          │ │ [a] FIX  [d] DISCUSS  [↑↓] Move  [Esc/Tab] Editor      │
└────────────────────────────────────────────────────────────┴─┴───────────────────────────────────────────────────────┘
```

---

## Estado 2: Fragmentos anexados al editor nativo (Foco en Editor)

Al presionar `a` (FIX) o `d` (DISCUSS), el fragmento se añade al final del borrador del usuario con formato markdown y tags claros sin auto-enviar:

```text
┌────────────────────────────────────────────────────────────┬─────────────────────────────────────────────────────────┐
│ > pi (v1.4.0) — /home/agus-hy/Documentos/pi-diff           │ │ DIFF: LAST ITERATION (Unfocused)                      │
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
│ PI EDITOR (Active)                                         │ │ Last attached: L12-14 (FIX)                           │
│ > Agregá también un warning si limit es menor a 0          │ │ [F6] Focus Diff  [Esc] Dismiss                        │
│                                                            │ │                                                       │
│ [src/balance.ts | new | 12-14 | FIX]                       │ │                                                       │
│ > if (limit === 0) {                                       │ │                                                       │
│ >   return offset;                                         │ │                                                       │
│ > }|                                                       │ │                                                       │
└────────────────────────────────────────────────────────────┴─┴───────────────────────────────────────────────────────┘
```

---

## Estado 3: Sin cambios detectados en la iteración

```text
┌────────────────────────────────────────────────────────────┬─────────────────────────────────────────────────────────┐
│ > pi (v1.4.0) — /home/agus-hy/Documentos/pi-diff           │ │ DIFF: LAST ITERATION (Focused)                        │
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
│ PI EDITOR                                                  │ │                                                       │
│ >                                                          │ │ [c] View Current  [q/Esc] Close                       │
└────────────────────────────────────────────────────────────┴─┴───────────────────────────────────────────────────────┘
```
