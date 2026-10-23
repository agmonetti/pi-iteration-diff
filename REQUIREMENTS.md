# REQUIREMENTS.md — Especificación de producto y plan de implementación

**Nombre provisional:** `pi-iteration-diff`  
**Tipo:** extensión TypeScript para Pi Coding Agent (Herdr-compatible)  
**Estado:** especificación v0.1 — pendiente de spikes de viabilidad  
**Prioridad de producto:** revisar el diff de la *última iteración del usuario* sin romper el flujo conversacional.

## 1. Problema y usuario

La persona usa Pi frecuentemente dentro de Herdr y quiere la experiencia visual de diff review de Claude Code: conversación a la izquierda, diff a la derecha, seleccionar porciones de código y devolverlas al prompt. Herramientas que muestran diffs **durante** la ejecución o que abren un modal a pantalla completa no solucionan el problema. `git diff HEAD` tampoco: mezcla cambios previos ajenos a la última petición.

### Principio de interacción

> «Termina la ejecución de Pi → escribo `/diff` cuando quiero → veo exactamente lo cambiado por esa iteración (neto observado) → selecciono líneas → las llevo al prompt para pedir correcciones o discutirlas».

El sistema no debe interrumpir al agente para enseñar un diff ni disparar mensajes automáticamente.

## 2. Terminología y contrato semántico

- **User iteration:** petición explícita del usuario y secuencia de trabajo automático asociada. No equivale a un modelo `turn_end`.
- **Before snapshot / after snapshot:** representación de contenido del workspace al comienzo y al cierre de una user iteration.
- **Iteration diff:** diferencia neta observada `after - before`, independiente de `HEAD`.
- **Current diff:** diferencias actuales del árbol de trabajo frente a Git base, con alcance anunciado en UI.
- **Review item:** fragmento/rango y comentario tipado `FIX` o `DISCUSS`, situado en lado `old` o `new`.
- **Staged feedback:** representación de review items preparada pero **aún no enviada**.

Si otro proceso modifica archivos entre snapshots, pueden aparecer cambios de terceros. No afirmar causalidad perfecta.

## 3. Functional requirements (P0 = MVP imprescindible)

| ID | Prioridad | Requisito | Aceptación observable |
|---|---|---|---|
| FR-01 | P0 | Registrar `/diff` manual. | Ejecutarlo abre/cierra el panel; sin aperturas automáticas en toda la sesión. |
| FR-02 | P0 | Dock a la derecha de la conversación en Pi fullscreen. | Chat y editor original permanecen visibles, focus y entrada normales. |
| FR-03 | P0 | Diff de la última petición completada como opción por defecto. | Cambios anteriores sin commit no aparecen al revisar la última iteración. |
| FR-04 | P0 | Capturar el cambio neto por contenido, no solo `edit`. | Cambios de `write`, `edit`, `bash` y scripts externos observados durante la petición aparecen. |
| FR-05 | P0 | Navegación entre archivos, hunks y líneas. | Indicadores +/−, rutas, navegación por teclado, scroll, vista unified. |
| FR-06 | P0 | Selección de líneas/rangos. | En fullscreen: selección por teclado y mouse, incluyendo líneas añadidas y borradas. |
| FR-07 | P0 | Adjuntar fragmentos al prompt. | Acción explícita agrega múltiples fragmentos con contexto de archivo/líneas; preserva texto existente y no autoenvía. |
| FR-08 | P0 | Instrucciones `FIX` y `DISCUSS`. | El prompt distingue modificación solicitada de pregunta/discusión. |
| FR-09 | P0 | Integridad del repo. | Índice, commits, ramas, staging y archivos del proyecto no se alteran por inspeccionar diff. |
| FR-10 | P0 | Sin cambios. | `/diff` informa «No hay cambios en la última iteración» sin inventar diff. |
| FR-11 | P0 | Altura/anchura variables y fallback. | Redimensionar conserva conversación/editor; ancho insuficiente activa vista accesible, sin crash. |
| FR-12 | P0 | Compatible con Pi solo y Pi en Herdr. | Matrix manual aprobada, especialmente mouse/focus/scroll. |
| FR-13 | P0 | Manejar conflictos de comandos/layout. | No pisa `/diff` ni `layoutRoot` propiedad de otra extensión; ofrece `/iteration-diff` y/o fallback con mensaje. |
| FR-14 | P0 | Cancelación/cierre seguro. | `/reload`, `Ctrl+C`, cambio de sesión o cierre no dejan un root o mouse capturado. |
| FR-15 | P0 | Mantener alcance por sesión/worktree. | No mezcla snapshots de dos repos, worktrees o sesiones distintas. |
| FR-16 | P1 (paridad UX) | Arrastrar fragmento desde diff hacia editor. | Drag → drop en editor adjunta rango correcto y deja intacto el borrador; si el terminal bloquea esta interacción, guardar evidencia y ofrecer fallback de una acción, sin llamar a esa UX «completa». |
| FR-17 | P1 | Selector `Last iteration` / `Current` / `History`. | Labels muestran fuente y base con precisión; navegación entre iteraciones no mezcla scopes. |
| FR-18 | P1 | Vistas unified y side-by-side. | Identidad `old/new` y números de línea preservados en ambas. |
| FR-19 | P1 | Manejar untracked, renames, borrados, binarios y archivos grandes. | Fallback explícito; no consumir memoria ilimitada. |
| FR-20 | P1 | Config de exclusiones, tamaño y retención. | Defaults seguros documentados, sin secrets/logs por defecto. |
| FR-21 | P1 | Persistencia o recuperación controlada. | Política definida para `/reload`, crash/resume y sin exposición no autorizada de código. |
| FR-22 | P2 | Metadatos opcionales para Herdr. | «Review ready» sin sobreescribir estados oficiales; deshabilitado por defecto. |
| FR-23 | P2 | Comentarios por archivo/diff global y templates. | Feedback sigue siendo compacto, editable, no automático. |

**Criterio de éxito del MVP:** FR-01 a FR-15. **Éxito del producto completo:** MVP + FR-16 a FR-21, o una excepción documentada y aprobada por el usuario para un bloqueo real de drag-and-drop. FR-22/23 son nice-to-have.

## 4. Requisitos no funcionales

- **NFR-01 — Peso:** sin Electron, navegador embebido, servicio residente ni modificación de Pi/Herdr.
- **NFR-02 — Rendimiento:** al terminar un run no bloquear perceptiblemente el editor; operaciones costosas asíncronas y cancelables. Establecer umbrales con mediciones reales en M1, no prometer cifras arbitrarias.
- **NFR-03 — Contención:** límites para snapshots, diffs, número de archivos, líneas y retención. Avisar si el diff está incompleto; nunca ocultar truncación.
- **NFR-04 — Seguridad:** no telemetría ni red, secretos fuera de logs, persistencia de contenido desactivada por defecto, permisos restrictivos en temporales.
- **NFR-05 — Robustez:** runtime sin crash ante resize, terminal desconectado, cambios de cwd/branch, archivos borrados o codecs inválidos.
- **NFR-06 — Accesibilidad terminal:** todas las interacciones esenciales por teclado, selección visual clara, ANSI/Unicode/emoji/tab correcto.
- **NFR-07 — Compatibilidad:** versionar adaptador interno de Pi y probar en versiones reales soportadas; Herdr opcional.
- **NFR-08 — Transparencia:** diferenciar «delta neto observado» de «cambios inequívocamente causados por Pi».
- **NFR-09 — Finalización:** un milestone se cierra cuando cumple sus checks. No expandir alcance para optimizaciones cosméticas no solicitadas.
- **NFR-10 — Portabilidad P0:** el producto debe capturar/comparar archivos ordinarios en Linux, macOS y Windows nativo dentro de entornos soportados por Pi. Arch Linux sólo es el entorno de desarrollo; WSL no certifica Windows. Un motor compartido, con adaptaciones mínimas demostradas y garantías de seguridad particulares documentadas. Mantener límites, exclusiones, identidad verificada y resultados parciales ante incertidumbre; no afirmar equivalencia de mecanismos contra carreras. Gate obligatorio: integración real en `ubuntu-latest`, `macos-latest` y `windows-latest`, con creación/modificación/borrado, preexistentes, rutas/Unicode/case/separadores, symlinks/junctions cuando aplique, worktrees, límites, cancelación y Git intacto. Sin ejecución real: NOT RUN, no certificación.

## 5. User stories / escenarios BDD

### US-01 — Última iteración aislada

**Dado** un repo donde `config.ts` ya estaba modificado,  
**y** la iteración A modifica `auth.ts`,  
**y** la iteración B modifica `users.ts`,  
**cuando** termino B y ejecuto `/diff`,  
**entonces** se muestran solo los cambios netos de B en `users.ts`; `config.ts` y `auth.ts` quedan fuera de `Last iteration`.

### US-02 — Escrituras por shell

**Dado** un baseline de `schema.json`,  
**cuando** Pi usa `bash` para generar o editar ese archivo durante la petición,  
**entonces** `/diff` lo detecta aunque no haya pasado por la herramienta `edit`.

### US-03 — Feedback sin perder texto

**Dado** el borrador `Agregá tests al módulo`,  
**cuando** selecciono rangos en dos archivos y marco uno `FIX` y otro `DISCUSS`,  
**entonces** la inserción mantiene el borrador, agrega ambas referencias exactas y no envía el mensaje hasta que yo lo haga.

### US-04 — Mouse y teclado

**Dado** Pi fullscreen dentro de Herdr,  
**cuando** hago drag sobre tres líneas del diff,  
**entonces** el modelo almacena solo ese rango, no redimensiona Herdr ni copia accidentalmente texto externo. La misma selección es posible sin mouse.

### US-05 — Drop en editor

**Dado** un rango seleccionado en el panel,  
**cuando** lo arrastro sobre el editor de Pi,  
**entonces** el rango se incorpora al borrador sin borrar texto ni enviarlo. Si esta ruta no existe en algún terminal, el agente debe documentar la prueba negativa y ofrecer `Select → Add to prompt` como ruta alternativa, sin declarar que el requisito literal se cumplió.

### US-06 — Estado y cleanup

**Dado** el panel abierto y con selección,  
**cuando** ejecuto `/reload`, cierro la sesión o reduzco el tamaño de Herdr,  
**entonces** Pi preserva funcionamiento del editor; el layout se restaura o degrada limpiamente, sin inputs perdidos.

### US-07 — Usuario sin cambios

**Dado** un prompt solo de explicación, sin cambios de archivos,  
**cuando** ejecuto `/diff`,  
**entonces** aparece un estado vacío claro y ningún archivo previo figura como propio de la petición.

### US-08 — Cambios concurrentes

**Dado** que una herramienta externa cambia un archivo durante el run,  
**cuando** se obtiene el diff de la iteración,  
**entonces** el sistema informa que son cambios observados en la ventana, no certeza de autoría. Si el baseline fue incompleto, no oculta la limitación.

## 6. Contrato de UI (propuesta, validar visualmente)

```text
┌────────────── Pi conversation + native editor ──────────────┬──────── Diff review ────────┐
│ user: refactor auth                                        │ Last iteration ▾            │
│ assistant: ...                                             │ src/auth.ts     +12 / -4   │
│ tool output: ...                                           │ src/api.ts      +3 / -1    │
│                                                            ├────────────────────────────┤
│                                                            │ @@ ...                     │
│                                                            │ + 42 ...                   │
│                                                            │ + 43 ...  ← drag/select    │
│                                                            │ - 44 ...                   │
├────────────────────────────────────────────────────────────┴────────────────────────────┤
│ > draft preserved + [selected excerpts]                                                │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

- **Default:** panel oculto; `/diff` lo alterna.
- **Default source:** `Last iteration` (última *completada*). Si el agente está ocupado, indicar último resultado completado y estado actual, sin mezclar estados.
- **Input:** teclado siempre disponible; mouse dentro de fullscreen; click o atajo `Add to prompt`; cross-pane drag-to-editor cuando pase el spike.
- **Fallback:** si no existe capacidad estable para split, usar vista de revisión explícita temporal y avisar que no hay paridad de panel, no simular que está cumplida.
- **Width:** diseñar thresholds adaptativos basados en medidas de viewport real, no ancho de la ventana externa cuando Herdr reserva sidebar.
- **Accessibility:** barra de ayuda con teclas, foco visible, cursores correctos.

## 7. Modelo de datos tentativo (propuesta, no API estable)

```ts
interface IterationId {
  sessionId: string;
  workspaceRoot: string; // resolved/normalized
  sequence: number;
}

interface IterationCapture {
  id: IterationId;
  startedAt: string;
  finishedAt?: string;
  status: 'capturing' | 'complete' | 'partial' | 'cancelled';
  beforeRef: string;  // opaque snapshot reference, no code embedded in session log
  afterRef?: string;
  warnings: string[];
}

interface DiffRangeSelection {
  filePath: string;
  side: 'old' | 'new';
  startLine: number;
  endLine: number; // inclusive
  text: string;
  intent: 'fix' | 'discuss';
  comment?: string;
}
```

Pueden revisarse tras el spike. Incluir identificador de snapshot/diff en una selección para detectar comentarios obsoletos cuando una iteración posterior cambie el archivo.

## 8. Roadmap y gates

| Milestone | Entregable | Gate de salida |
|---|---|---|
| **M0 — Factibilidad** | Prototipos mínimos: split TUI, mouse dentro/fuera de Herdr, editor intacto, identificación correcta de eventos; matriz de compatibilidad. | Evidencia reproducible PASS/FAIL; ADR confirmado y riesgos abiertos explícitos. |
| **M1 — Captura** | Motor before/after compartido Linux/macOS/Windows, fixtures, seguridad/exclusiones, separación por sesión/worktree. | US-01, 02, 07, 08 automatizadas; sin mutación de Git; NFR-10 con CI nativa real en los tres SO. |
| **M2 — Visor** | Diff estructurado, dock, navegación, empty/error states, fallback estrecho. | FR-01–05, 10, 11, 13 pasan. |
| **M3 — Selección/feedback** | Rango de mouse/teclado, FIX/DISCUSS, anexado al prompt, drag-to-editor investigado e implementado donde viable. | US-03, 04, 05; sin sobreescritura ni envío automático. |
| **M4 — Herdr/robustez** | Test matrix real, resize, pane zoom, session switch/reload, conflictos, límites/benchmark. | US-06, FR-12–15, NFR relevantes. |
| **M5 — Distribución** | Paquete Pi instalable, README, setup, troubleshooting, compatibilidad y release checklist. | `npm run check` PASS; evidencia de todos los escenarios, instrucciones de instalación reproducibles. |

**Orden no negociable:** no saltar M0 e implementar un motor masivo sin demostrar que la TUI y el editor admiten la interacción objetivo.

## 9. Test plan mínimo

### Unitarios/automatizados

- Baseline con dirty files y untracked anteriores al inicio.
- A → B con diferencias correctas, empty iteration y revert de cambio dentro de un mismo run (delta neto = cero).
- `bash`/script modifica archivos; concurrencia con archivos ajenos; manejo de captura parcial.
- Files new/deleted/renamed, whitespace, CRLF, Unicode, binarios, symlink, submodule/worktree.
- Parseo de líneas old/new, selección invertida, rangos multilinea, múltiples anotaciones.
- Prompt compuesto con texto existente, sin reemplazos, sin envío automático.
- Filtros ignore, tamaño límite, error de permisos, cleanup, caps de memoria.
- Layout adapter: ownership y restore contra mock cuando sea factible.

### Manuales obligatorios

- Pi fullscreen en terminal local sin Herdr.
- Pi fullscreen en Herdr con sidebar visible, un pane y panes divididos.
- Drag mouse/teclado, selección de código, add-to-prompt, drop al editor.
- Scroll, cambio de foco, max/min width, `/reload`, `/new`, `/resume`, `Ctrl+C`.
- Extensiones coexistentes incluyendo integración `herdr-agent-state.ts`; colisión de `/diff`.
- Estado Git antes/después de tests (HEAD/index/working tree del fixture).

### Registro de resultados

Toda prueba real debe tener fecha, versión, comando/pasos, resultado (PASS/FAIL/BLOCKED/NOT RUN), evidencia y cualquier limitación en `PROGRESS.md`. `NOT RUN` no equivale a PASS.

## 10. Riesgos con mitigación

| Riesgo | Mitigación |
|---|---|
| API interna `layoutRoot` cambia | Encapsular, versionar, probar, fallback explícito |
| Dos extensiones controlan el root | Ownership/negociación o incompatibilidad declarada, nunca sobrescritura silenciosa |
| Scope incorrecto por `turn_end` | Agrupar la petición, baseline temprano, cierre cuando agente settled |
| Cambios ajenos atribuidos al agente | Etiquetar como delta observado, no autoría certificada |
| Escaneo de repositorio enorme | Límites, captura incremental segura y warning de incompletitud |
| Mouse de Herdr consume arrastre | Test real, teclado equivalente, ruta de una acción, issue detallado |
| Reemplazo del prompt existente | No llamar APIs destructivas sin read/merge/restore probado |
| Snapshot accidentalmente guarda secretos | Default efímero, exclusiones, permisos, sin logs del contenido |
| Bloat de features | Milestones cerrados por DoD; P2 no bloquea M5 |

## 11. Definition of Done y criterio de release

- [ ] Todos los requisitos P0 implementados y probados.
- [ ] Drag-to-editor FR-16 probado con evidencia y estado final transparente; paridad completa solo si funciona, o excepción aprobada por el usuario.
- [ ] Typecheck y todos los tests automatizados PASS con comandos reproducibles.
- [ ] NFR-10: integración del motor PASS real en Linux, macOS y Windows nativo; WSL separado; matriz y garantías particulares registradas (workflow no ejecutado = NOT RUN).
- [ ] Pruebas manuales en Pi y Herdr PASS (o bloqueos explícitos que impiden declarar release listo).
- [ ] No escritura no autorizada en staging/config global/sesiones ajenas.
- [ ] Sin autoapertura, sin autosend, sin pérdida de borradores.
- [ ] Documentación y `PROGRESS.md` actualizados con versiones reales y limitaciones.
- [ ] Sin procesos residentes, telemetría ni dependencias gráficas pesadas.

## 12. Fuentes e hipótesis

La justificación de arquitectura y enlaces están en `RESEARCH.md`. Las proposiciones marcadas «propuesta» requieren validación; ningún API interno debe tratarse como contrato estable sin pruebas en la versión real de Pi.
