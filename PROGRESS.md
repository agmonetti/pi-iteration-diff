# PROGRESS.md — Bitácora viva del proyecto

**Proyecto:** `pi-iteration-diff`  
**Última actualización:** 2026-10-22  
**Estado general:** `M0 / SPIKE PARCIAL — GATE ABIERTO`  
**Milestone activo:** M0 — Factibilidad (iniciado; no habilita M1)  
**Versión del producto:** 0.0.0 privada; prototipo sintético, no producto.

## 1. Resumen del estado

- **Completado en este bloque:** investigación local de APIs; scaffold mínimo; dock sintético manual `/m0-diff`, selección teclado/mouse normalizado, append al editor y cleanup.
- **Tests ejecutados:** `npm run check` PASS (5 tests); smoke PTY del CLI instalado PASS, repetidos al cierre. Revisión del arquitecto previa y final sin bloqueantes en el spike parcial.
- **No comprobado:** mouse físico y matriz humana Pi/Herdr; drag/drop al editor; lifecycle con herramientas, colas/retry/aborto; snapshots (no implementados).
- **Siguiente acción:** completar matriz humana H1–H8 de `M0.md` y trazas lifecycle L1–L6 en fixture autorizado. M0 no está cerrado.
- **Continuación:** protocolos precisados; checks repetidos PASS. Mouse físico y lifecycle real siguen pendientes; preparación de commit inicial por rutas explícitas documentada al final.

## 2. Entregables documentales (2026-10-22)

| Archivo | Resultado | Validación |
|---|---|---|
| `RESEARCH.md` | Referencias verificadas, hipótesis, riesgos y decisiones provisionales | Redacción completada; pruebas locales NO ejecutadas |
| `AGENTS.md` | Instrucciones, arquitectura, límites, comandos futuros, DoD | Redacción completada; comandos de proyecto AÚN no existen |
| `REQUIREMENTS.md` | FR/NFR, casos BDD, roadmap y gates | Redacción completada; aceptación pendiente |
| `PROGRESS.md` | Bitácora y plantilla para próximos agentes | Archivo inicial creado |

## 3. Roadmap — estado real

| Milestone | Estado | Evidencia/criterio pendiente |
|---|---|---|
| M0 Factibilidad | **IN PROGRESS / PARTIAL** | Suite + PTY PASS; matriz humana Herdr/Pi y trazas lifecycle pendientes |
| M1 Snapshots | **NOT STARTED** | Delta neto por petición y separación de cambios antiguos |
| M2 Visor | **NOT STARTED** | Dock manual, navegación y fallbacks |
| M3 Feedback | **NOT STARTED** | Rango, FIX/DISCUSS, editor, drag/drop |
| M4 Herdr/robustez | **NOT STARTED** | Matriz e2e + cleanup + performance |
| M5 Distribución | **NOT STARTED** | Paquete instalable, README, CI, release |

## 4. Evidencia de tests y verificaciones

### Comandos previstos — registro inicial anterior al spike

Estado histórico; resultados actuales en la entrada M0 al final.

| Comando previsto | Estado | Motivo |
|---|---|---|
| `npm run typecheck` | NOT RUN | Falta scaffold y `package.json` |
| `npm test` | NOT RUN | Falta suite de pruebas |
| `npm run check` | NOT RUN | Falta script combinado |
| `pi --tui-mode fullscreen -e ./src/index.ts` | NOT RUN | Falta implementación y entorno local Pi |

### Pruebas manuales pendientes

- [ ] Pi fullscreen, sin Herdr: panel derecho, editor, focus y resize.
- [ ] Pi dentro de Herdr: mouse drag/select, scroll independiente, editor y pane resize.
- [ ] Pi dentro de Herdr: zoom, detach/reattach y restore de sesión.
- [ ] `/reload`, `/new`, `/resume`, `Ctrl+C`, cierre del panel.
- [ ] Compatibilidad/collision con `/diff` de otras extensiones y `layoutRoot`.
- [ ] Baseline dirty, dos peticiones, cambios por `bash` y staging intacto.
- [ ] Seleccionar varias líneas de distintos archivos, preservar borrador, sin autosend.
- [ ] Drag-and-drop literal al editor; registrar evidencia si terminal/multiplexer lo impide.

## 5. Riesgos abiertos actuales

| ID | Severidad | Riesgo | Acción siguiente |
|---|---|---|---|
| R-01 | Alta | APIs internas de Pi para split pueden cambiar | Spike y aislamiento del adaptador |
| R-02 | Alta | Herdr intercepta mouse/drag | Matriz de pruebas real |
| R-03 | Alta | Delimitación de una petición vs. múltiples turnos | Instrumentar lifecycle antes del motor |
| R-04 | Alta | Capturas de filesystem incompletas/costosas | Diseñar alcance seguro y medir |
| R-05 | Media | Editor API puede sobrescribir borrador | Spike editor + tests |
| R-06 | Media | Conflictos con extensiones `/diff`/layout | Probar carga conjunta y fallback |

## 6. Plan concreto del próximo agente (M0)

1. Leer `AGENTS.md`, `REQUIREMENTS.md` y `RESEARCH.md` completos; no comenzar por UI cosmética.
2. Inspeccionar entorno y registrar versiones: `node --version`, `npm --version`, `pi --version`, `herdr --version` (si instalados); anotar terminal, sistema operativo, TUI mode y extensiones relevantes.
3. Confirmar en Pi real disponibilidad/tipado de eventos (`input`, `before_agent_start`, `agent_settled`, sesión) y método seguro de escribir en el editor.
4. Implementar spike mínimo de layout con **un solo dueño**, cierre limpio y resize. Medir behavior con y sin otra extensión que use el root.
5. Implementar spike de selección con mouse + teclado y acción de adjuntar un fragmento al editor **preservando** borrador; repetir dentro de Herdr.
6. Probar drag-and-drop desde el panel al editor; documentar resultado real y si requiere nueva API o fallback UX.
7. Solo después, decidir ADR finales y crear el scaffold `package.json`, scripts y primer test unitario; actualizar el estado de M0.

**No crear una arquitectura compleja de snapshots antes de demostrar las capacidades fundamentales de TUI.**

## 7. Formato obligatorio de futuras entradas

Al terminar cada iteración de desarrollo, agregar al final:

```markdown
### YYYY-MM-DD — Mx / descripción breve

**Cambió**
- `path/to/file.ts`: descripción concreta

**Pruebas ejecutadas**
| Comando / caso | Entorno | Resultado | Evidencia |
|---|---|---|---|
| `npm run check` | Node vX, OS Y | PASS/FAIL/BLOCKED/NOT RUN | stdout relevante/archivo de log |

**Fallos / límites / decisiones**
- Riesgo o problema exacto; no ocultar regresiones.

**Falta probar**
- Caso manual o automatizado pendiente.

**Próximo paso**
- Única acción priorizada del milestone siguiente o de la corrección del actual.
```

No reemplazar la evidencia histórica con frases generales del tipo «tests OK». No afirmar PASS sin ejecución real. Cerrar cada milestone cuando cumple su gate; no seguir refinando sin necesidad.

### 2026-10-22 — M0 / primera iteración: APIs locales y dock sintético

**Cambió**
- `package.json`, lockfile, `tsconfig.json`, `.gitignore`: scaffold privado, TS strict,
  scripts typecheck/test/check, Pi/TUI 1.4.0 fijados; sólo dependencias de desarrollo.
- `src/index.ts`: comandos experimentales `/m0-diff`, `/m0-events`; no registra `/diff`
  ni `/iteration-diff` del producto aún. Dock sólo explícito; eventos acotados en memoria
  sin prompts/código. Acceso al TUI mediante factory pública de widget vacío y dispose.
- `src/ui/layout-adapter.ts`: única frontera interna para root/focus, composición con
  root nativo intacto, rechazo de ownership desconocido, cleanup idempotente y condicional.
- `src/ui/feasibility-panel.ts`: tres líneas sintéticas, rango por teclado/mouse,
  append explícito al borrador, sin envío. Release cruzado sólo diagnóstico, no drop.
- `tests/feasibility.test.ts`: renderer TUI real con terminal simulado; cinco casos.
- `tests/pty-smoke.py`: CLI instalado en PTY/directorio de agente/workspace temporales;
  sin extensiones descubiertas, sin credenciales ni modelo. No guarda transcript real.
- `M0.md`: comandos, pasos humanos pendientes y límites. `RESEARCH.md`: corrección
  pública/interna de APIs, hallazgos de lifecycle y ADR todavía condicionados.

**Entorno**
- Fecha local 2026-10-22 (UTC-03); Linux 7.2.11-arch1-1; Node v26.12.0; npm 12.2.1.
- Pi instalado 1.4.0; Herdr 0.9.5; integración oficial Pi v9 `current`.
- Harness: `TERM=xterm-256color`, `TERM_PROGRAM=herdr`, stdin bash sin TTY.
- Smoke: PTY sintética 120×30, TERM xterm-256color, HERDR_* eliminadas; NO es prueba
  humana de terminal ni tránsito de mouse por Herdr. Suite usa viewport 120×24 y 45×24.

**Pruebas efectivamente ejecutadas**

| Comando / caso | Resultado | Evidencia / alcance |
|---|---|---|
| `node --version`, `npm --version`, `pi --version`, `herdr --version` | PASS | Versiones anteriores |
| `herdr integration status` | PASS | Pi v9 current; ninguna integración modificada |
| `pi --help` | PASS | Admite `--tui-mode fullscreen -e` y aislamiento de discovery |
| `npm install --offline --ignore-scripts --no-audit --no-fund` | FAIL | ENOTCACHED: tarball tsx 4.23.15 ausente |
| `npm install --ignore-scripts --no-audit --no-fund` | PASS | 123 paquetes; sin lifecycle scripts; acceso npm sólo de desarrollo |
| Primer `npm run typecheck` | FAIL | Overload `pi.on` con unión y narrowing de callback; corregidos con registros explícitos y cleanup compartido |
| Diagnóstico inicial del terminal fake | FAIL | `drainInput` requerido por tipos npm; implementado no-op asíncrono |
| `npm run check` (tres ejecuciones completas) | PASS | tsc sin errores; 5/5 tests, 0 fallos; última duración suite ≈382 ms |
| `python3 tests/pty-smoke.py` (tres ejecuciones) | PASS | CLI inicia sin autoapertura, dock visible explícito, append llega a editor y renderiza draft, comandos reload/cierre, salida 0 y reset mouse |
| SGR press/drag/release mediante TUI real | PASS | Rango [0,2], release con x negativa llega al panel; siguiente press reinicia selección; draft intacto |
| Resize 120→45→120, keyboard/focus y columnas Unicode | PASS | Panel oculto/restaurado, foco vuelve al editor; tabs expandidos sólo visualmente, emoji/combinado y truncación por columnas |
| Root ajeno, doble montaje y restore condicional | PASS | Rechaza root incompatible, no pisa dueño posterior; regular rechazado con error explícito |
| SHA-256 npm vs instalación real | PASS | Coinciden tui-alt-screen/tui/h-stack/stack y interactive-mode/chat-viewport; hash del renderer en RESEARCH |
| `lens_diagnostics source=lsp scope=paths` (5 archivos) | PARCIAL | 0 diagnósticos; 2 clean confirmados, 3 inconclusos por servidor silencioso. tsc es evidencia de tipos, no el cache LSP |
| Arquitecto antes del plan y revisión final de 6 archivos | PASS (revisión) | Exigió lifecycle, ownership condicional y no equiparar selección/drop; revisión final sin bloqueantes nuevos. No reejecutó tests |
| `git status --short`, `git diff`, `git diff --cached`, `git log -1` | PASS / límite | Repo sin commits; documentos originales ya untracked; índice vacío antes/después; no staging/commits |

**Matriz obligatoria aún pendiente**

| Caso | Estado | Motivo / próximo experimento |
|---|---|---|
| Pi terminal común, interacción humana | BLOCKED en este harness | Bash sin TTY humano; PTY automatizada no sustituye validación visual/física |
| Mouse físico dentro de Herdr, sidebar/split/zoom/detach | BLOCKED en este harness | No se ejercitó cliente humano ni instancia de prueba Herdr; binario instalado no prueba compatibilidad |
| Convivencia runtime con integración oficial | NOT RUN | Lectura estática completa: no toca layout; no se cargó en el smoke aislado |
| Scroll/rueda y selección física; altura extrema | NOT RUN | Suite cubre ancho, no toda la matriz manual |
| `/new`, `/resume` y coexistencia de extensiones de layout | NOT RUN | Suite prueba root ajeno, no carga conjunta ni cambio real de sesión |
| Lifecycle real write/edit/bash + colas/retry/aborto | NOT RUN | Probe implementado y source inspeccionado; faltan trazas controladas con modelo autorizado |
| Drag/drop literal hacia editor | NOT RUN | Release cruzado probado sólo con SGR sintético; sin hit-test/editor ni evidencia física |
| Colisión `/diff` del producto | NOT RUN | Spike registra sólo `/m0-diff`; implementación final del comando queda en M2 |

**Fallos / límites / decisiones**
- M0 sigue **parcial**; no se cumplen todavía todos sus criterios y no se avanza a M1.
- `before_agent_start` ocurre después de compaction y otros handlers pueden tener efectos;
  no se garantiza baseline previo a todos ellos. Steering/follow-up requieren contrato explícito.
- No se reimplementó editor ni se tocó instalación/config global, archivos de integración,
  estados Herdr o Git index. Dependencias usan red sólo para la instalación de desarrollo.
- PTY verifica presencia de marcadores ANSI y envío de comandos; no interpreta una pantalla
  completa, no certifica ausencia de artefactos ni semántica total de reload.
- Reconocimiento de root es específico de la estructura verificada de Pi 1.4.0, no una API
  estable de ownership. Fallback seguro actual: aviso y no montar. Cursor/undo no certificados.
- Sin commit: repositorio sin historia con los cuatro documentos originales ya untracked;
  no se incluyeron archivos previos del usuario ni se creó un commit inicial mezclado.

**Próximo paso**
- Ejecutar la matriz humana de `M0.md` en terminal común y Herdr de prueba, y registrar
  `/m0-events` para un run controlado con herramientas/colas/retry/aborto. Resolver el
  contrato de iteración y confirmar ADR antes de cerrar M0. Ningún snapshot/M1 por ahora.

### 2026-10-22 — M0 / protocolos pendientes y commit inicial

**Cambió**
- `M0.md`: matriz H1–H8 para mouse/foco/append/drop y protocolo L1–L6 con prompts,
  colas, retry, aborto y sesiones persistentes aisladas. Estados pendientes explícitos.
- `RESEARCH.md`: límites del probe y del release cruzado; decisiones aún condicionadas.
- `.gitignore`: excluir cachés Python/pytest/ruff sin borrar archivos existentes.
- No cambió código del spike, no se implementó M1 ni se tocó instalación Pi/Herdr.

**Pruebas ejecutadas por esta sesión**
| Comando / caso | Entorno | Resultado | Evidencia |
|---|---|---|---|
| Versiones e `herdr integration status` | Linux; Node 26.12.0, npm 12.2.1, Pi 1.4.0, Herdr 0.9.5 | PASS | Pi integration v9 current; no instalación |
| `test -t 0` | TERM=xterm-256color, TERM_PROGRAM=herdr | BLOCKED para interacción humana | `NO_TTY`; no input físico ni manipulación del pane activo |
| `npm run check` | Node 26.12.0 | PASS | tsc; 5/5 tests, 0 fallos, 311 ms |
| `python3 tests/pty-smoke.py` | CLI instalado, PTY aislada 120×30 | PASS | dock explícito, append/editor, comandos reload, salida y reset mouse |
| H1–H8 / Pi y Herdr físicos | Requiere operador humano | NOT RUN | Pasos exactos y criterios en M0.md; compatibilidad no certificada |
| L1–L6 / modelo, colas, retry, aborto, resume | Fixture autorizado pendiente | NOT RUN | Sin nuevas trazas reales; falta proveedor retry controlado |
| Validación estructurada lockfile | Node, JSON local | PASS tras corregir chequeo | 150 entradas, URLs npm sin userinfo/query; primer chequeo textual dio falso positivo por nombre con token |
| `git status --short`, `git diff`, `git diff --cached` | Rama main sin historia, índice vacío | PASS | Todos los archivos propios untracked; diff vacío no revisa contenido untracked |

**Git / alcance del commit inicial**
- La petición actual autoriza incluir documentos iniciales propios. Se inspeccionaron
  AGENTS/REQUIREMENTS/RESEARCH/PROGRESS/M0 y todos los fuentes/tests/config; lockfile
  validado como JSON del paquete y orígenes npm. Corresponden inequívocamente al proyecto.
- Preparar sólo `.gitignore`, los cinco Markdown, package.json/package-lock.json,
  tsconfig.json, tres fuentes TS y dos tests por rutas de archivo explícitas.
- Excluir node_modules, caches, bytecode, logs, sesiones y credenciales. No se descarta
  ni sobrescribe contenido previo; no push ni cambios de configuración Git.
- `git diff --cached --check` señala hard breaks Markdown preexistentes y líneas
  vacías finales; no son fallos de tests. Se conservan sin reformatear documentos
  ajenos al cambio; revisión con flags efímeros que permiten ese whitespace Markdown.
- Mensaje previsto: `chore: initialize M0 feasibility spike and validation protocols`.
  El commit constituye una base parcial verificable, NO aceptación de M0.

**Límites / decisión**
- El spike sólo observa release cruzado; no transfiere por drop ni demuestra que el
  terminal lo impida. El buffer lifecycle pierde historial al cerrar/iniciar sesión
  y no distingue consumo de cola/retry. No se fabricaron trazas ni resultados manuales.
- Revisión del arquitecto por sesión local delegada: plan aprobado con gate abierto;
  exigió excluir caches y no equiparar PTY a mouse Herdr. Revisión final aprobada
  sin bloqueantes; no ejecutó interacción humana ni confirmó compatibilidad.
- M0 sigue abierto. Próximo paso exclusivo: operador ejecuta H1–H8; luego completar
  fixture retry e instrumentación/trazas L1–L6 antes de confirmar ADR-003. M1 bloqueado.

