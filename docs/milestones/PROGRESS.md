# PROGRESS.md — Bitácora viva del proyecto

**Proyecto:** `pi-iteration-diff`  
**Última actualización:** 2026-10-23
**Estado general:** `M1 ACCEPTED — CROSS-PLATFORM CI PASS`
**Milestone activo:** M1 cerrado; detenido antes de M2; UI congelada
**Versión del producto:** 0.0.0 privada; prototipo sintético, no producto.

## 1. Resumen del estado

- **Completado en este bloque:** investigación local de APIs; scaffold mínimo; dock sintético manual `/m0-diff`, selección teclado/mouse normalizado, append al editor y cleanup.
- **Tests ejecutados:** `npm run check` PASS (14 tests: 6 UI + 5 stream SDK + 3 HTTP SDK). Sin PTY nueva; pruebas humanas recibidas por informe del operador, no simuladas.
- **Validado por humano:** dock, mouse/rangos, foco funcional/visual y anexado sin autosend en Pi directo y Herdr; H7 sidebar/split/zoom y H8 resize/reload/new/resume confirmados PASS por el operador.
- **Corregido y revalidado:** indicador visual accent del tema, sin modificar editor; test y confirmación humana PASS.
- **Lifecycle extendido:** HTTP loopback 429→200, aborto bash real y restore persistente SDK PASS. Contrato de iteración documentado, sin confundir colas agrupadas con petición individual.
- **Decisión final aprobada:** ADR-003; usuario acepta provisionalmente indisponibilidad individual de ventanas agrupadas y diff conjunto diferenciado de Last iteration. Sin garantía de atribución. Drag literal DEFERRED a M3 sin eliminar FR-16.
- **M0 cerrado:** matriz final y acta en `M0.md`; no se reabrió factibilidad ni diseño.
- **Auditoría funcional M1 aceptada:** 42/42 PASS históricos. Corrección obligatoria posterior: motor compartido Linux/macOS/Windows implementado; certificación multiplataforma pendiente de CI real. Gate local y garantías particulares al final y en `M1.md`; ningún PASS local equivale a macOS/Windows/ubuntu-latest.
- **Parada:** sin M2, visor definitivo, hunks, historial ni drag/drop. Sin nuevas pruebas humanas de Pi/Herdr.

## 2. Entregables documentales (2026-10-22)

| Archivo | Resultado | Validación |
|---|---|---|
| `RESEARCH.md` | Referencias verificadas, hipótesis, riesgos y decisiones provisionales | Redacción completada; pruebas locales NO ejecutadas |
| `research/CLAUDE_CODE_DIFF.md` | Investigación documental sobre el sistema `/diff` de Claude Code (`mods/diff`) | Redacción completada; fuentes verificables y recomendaciones M1+ |
| `AGENTS.md` | Instrucciones, arquitectura, límites, comandos futuros, DoD | Redacción completada; comandos de proyecto AÚN no existen |
| `REQUIREMENTS.md` | FR/NFR, casos BDD, roadmap y gates | Redacción completada; aceptación pendiente |
| `PROGRESS.md` | Bitácora y plantilla para próximos agentes | Archivo inicial creado |

## 3. Roadmap — estado real

| Milestone | Estado | Evidencia/criterio pendiente |
|---|---|---|
| M0 Factibilidad | **CLOSED / PASS** | 14/14 PASS; H3/H7/H8 confirmados por operador; ADR-003 aprobado; pendientes de producto diferidos explícitamente |
| M1 Snapshots | **CLOSED / PASS (CROSS-PLATFORM CI PASS)** | Run 40018853023 (commit 116b6a8): ubuntu 56/56, macos 55/56 (1 skip procfs), windows 54/56 (2 skips procfs + bash-abort); tsc + checkout limpio. Motor y ADR-003 certificados |
| M2 Visor | **CLOSED / PASS** | Dock 45%, redimensionamiento interactivo, explorador inline de dos líneas, hunks unified, header/footer compactos (97/97 tests pass) |
| M3 Selección y Contexto | **CLOSED / PASS** | Selección por teclado/mouse, selección de hunk, formato [path \| diff \| old:X \| new:Y], anexado con 'a' al editor nativo sin autoenvío (97/97 tests pass) |
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

### 2026-10-22 — M0 / lifecycle SDK y preparación humana

**Cambió**
- `tests/lifecycle.test.ts`: cinco casos contra AgentSession real, stream de modelo
  local controlado; herramientas write/edit/bash reales en temporal privado.
- `M0.md`: comandos exactos para terminal común y sesión Herdr de prueba, integración
  oficial explícita y secuencia corta de mouse/foco/append/drop/cierre/restore.
- `RESEARCH.md`: evidencia y límites; settled puede agrupar peticiones encoladas.
  No se escribió código de M1 ni se cambió el spike UI o la instalación del usuario.

**Pruebas ejecutadas**
| Comando / caso | Entorno | Resultado | Evidencia |
|---|---|---|---|
| Versiones; integration status; test -t 0 | Linux, Node 26.12.0, Pi 1.4.0, Herdr 0.9.5 | PASS / NO_TTY | Pi v9 current; sin interacción humana |
| Primer npm run check | Node 26.12.0 | FAIL | 5 UI PASS; 5 SDK fallan por validación de API key antes del stream local |
| npm run check (tres ejecuciones tras corrección) | Pi/TUI npm 1.4.0 | PASS | tsc; 10/10, 0 fallos; última suite 1462 ms |
| L1-SDK | Workspace mkdtemp 0700 | PASS | 4 turn_end, un settled false; write/edit/bash, contenido final three |
| L2/L3-SDK | Stream local detenido por gate | PASS | steer/followUp queued, requests ven 1→2 usuarios, un settled |
| L4-SDK | Error normalizado 429→éxito | PASS | 2 agent_end, retry_start/end, un settled false |
| L5-SDK | Abort durante stream y petición posterior | PASS | settled true y recuperación settled false |
| lens_diagnostics source=lsp scope=paths | tests/lifecycle.test.ts | PASS con hints | Sin errores; 2 hints getModel deprecated (compat API del ejemplo SDK) |
| H1–H8 Pi/Herdr físicos | Operador humano requerido | NOT RUN | Comandos preparados; NO_TTY no permite validación física |
| PTY | No ejecutada en esta continuación | NOT RUN | No se usa para sustituir pruebas humanas |
| L6, HTTP 429, abort bash | Fuera de cobertura de la nueva suite | NOT RUN | Sesión en memoria, error normalizado, abort stream solamente |

**Fallos / límites / decisiones**
- Hipótesis tras fallo inicial: prompt valida API key antes de llamar streamFunction.
  Prueba mínima: clave ficticia en ModelRuntime en memoria; los cinco SDK pasan.
  No se usaron credenciales reales ni HTTP; no persistencia de sesiones/prompts.
- Errores transitorios de tipado (streamFn vs streamFunction y unión de argumentos)
  corregidos consultando declaraciones; errores de reemplazo textual parcial no
  afectaron archivos ajenos. Gate final tsc PASS.
- Instrumentación SDK imprime sólo nombres de eventos/herramientas y aborted;
  conteos de usuarios verifican consumo de cola sin imprimir contenido. Cleanup
  session.dispose y borrado temporal en finally. No se escribe en Git para operar.
- Arquitecto revisó plan y diff final: aprobado condicionado a esta entrada de
  bitácora, ahora agregada. No verificó mouse ni aprobó compatibilidad Herdr.
- Drag literal no implementado; no se demostró imposibilidad técnica del terminal.
  Alternativa: seleccionar dentro del panel y pulsar a para anexar explícitamente.
  No equivale a paridad FR-16 ni excepción aprobada. Cursor/undo no certificados.
- M0 abierto: settled no basta para separar cada entrada encolada. ADR-003 pendiente.

**Falta probar**
- H1–H8 humanos en ambos entornos, convivencia runtime con integración oficial,
  sesiones persistentes/reload/resume, HTTP retry y aborto de herramienta.

**Próximo paso**
- Operador ejecuta A/B de M0.md y devuelve tabla observada. No avanzar a M1.

**Git**
- Estado inicial limpio, base 0e19b47. Revisados status, diff y cached (vacío);
  sólo cuatro rutas propias previstas. Commit lógico único para suite M0 y su
  protocolo/evidencia: `test(lifecycle): verify turns queues retry and abort`.
  Sin push, tags ni cambios de configuración.

### 2026-10-22 — M0 / evidencia humana e indicador de foco

**Cambió**
- `src/ui/feasibility-panel.ts`: Focusable público; encabezado resaltado sólo con
  foco, solicita render en cada cambio real. `src/index.ts`: inyecta accent del tema
  actual, sin editor custom ni estado duplicado en el adaptador.
- `tests/feasibility.test.ts`: transición de foco por F6/Esc, mouse al panel/editor,
  resize y cierre; borrador/selección intactos. Sin nuevos elementos decorativos.
- `M0.md`, `RESEARCH.md`: registro humano como reporte del operador y límites de H8;
  no se inventa captura inspeccionada, fecha de ejecución ni terminal cliente.

**Pruebas ejecutadas**
| Comando / caso | Entorno | Resultado | Evidencia |
|---|---|---|---|
| H1/H2/H4/H6 | Humano, Arch Linux, Pi 1.4.0 y Herdr 0.9.5 | PASS reportado | Dock, mouse/rangos, anexado sin reemplazo/envío en ambos |
| H3 | Mismo entorno humano, versión previa | PASS funcional / FAIL visual | F6/Esc/click funcionan, falta indicador |
| H8 | Mismo entorno humano | PASS parcial reportado | Cierre/resize/restauración realizados; no inferir otros subcasos |
| H5 | Pi/Herdr humano | NOT IMPLEMENTED | Drop no transfiere; copia observada no demuestra imposibilidad |
| npm run check | Node 26.12.0, Pi/TUI 1.4.0 | PASS | tsc; 11/11, 0 fallos, suite 1406 ms |

**Fallos / límites / decisiones**
- Resaltar sólo encabezado con token accent cumple el alcance solicitado; normal
  cuando editor tiene foco. El tema se consulta en render, no se cachean colores.
- Informe humano recibido hoy, sin hora/terminal/dimensiones ni captura adjunta.
  No certificar Herdr universalmente. Sin cambios a integración/estados oficiales.
- Arquitecto aprobó plan y revisión final de este bloque sin bloqueantes.
- LSP activo en tres rutas: 0 errores, 1 clean confirmado y 2 inconclusos por
  servidor silencioso; tsc PASS es el gate de tipos. Revisión status/diff/cached
  antes de commit por seis rutas explícitas; sin push.

**Falta probar**
- Nuevo indicador con el tema/terminal humano, subcasos H7/H8 específicos.
- Retry HTTP local real, abort bash, persistencia/restauración y contrato de colas.

**Próximo paso**
- Completar fixtures técnicos M0 aislados, sin avanzar a M1.

### 2026-10-22 — M0 / HTTP real, aborto bash y restore persistente SDK

**Cambió**
- `tests/lifecycle-http.test.ts`: servidor HTTP loopback efímero y adaptador real
  openai-completions, sin reemplazar stream. Tres casos con workspace privado 0700,
  sin credenciales reales, discovery/red de catálogo desactivados, cleanup finally.
- `M0.md`: trazas, matriz de aceptación actual, contrato de iteración y evaluación
  técnica del drag literal. `RESEARCH.md`: evidencia y decisión semántica ADR-003.

**Pruebas ejecutadas**
| Comando / caso | Entorno | Resultado | Evidencia |
|---|---|---|---|
| npx --no-install tsx --test tests/lifecycle-http.test.ts (dos ejecuciones) | Linux 7.2.11-arch1-1, Node 26.12.0, Pi npm 1.4.0 | PASS 3/3 | HTTP 429→200, abort bash y restore SDK |
| L4-HTTP | Servidor 127.0.0.1 puerto efímero | PASS | 2 solicitudes, 2 agent_end, retry_start/end, un settled false; un before_agent_start |
| L5-bash + recuperación | Procesos bash/sleep reales | PASS | Ambos no vivos, sin after.txt ni request posterior al abort hasta petición nueva; settled true→false |
| L6-SDK persistente + nueva sesión | Sesiones sintéticas en temporal privado | PASS | Mismo ID y mensajes al reabrir; otra sesión tiene ID nuevo y cero usuarios previos; 3 session_start |
| npm run check | Node 26.12.0, npm 12.2.1, Pi/TUI 1.4.0 | PASS | tsc; 14/14, 0 fallos, suite 1769 ms |
| lens_diagnostics source=lsp scope=paths | tests/lifecycle-http.test.ts | PASS | Clean confirmado; 0 diagnósticos |
| /resume,/new,/reload TUI, detach/reattach | Interacción humana no ejecutada por agente | NOT RUN individualmente | SDK restore no sustituye matriz UI |

**Fallos / límites / decisiones**
- Tipos iniciales: provider retry pertenece a retry.provider, modo de bind debe
  ser print (no sdk), sessionFile requiere narrowing explícito; corregidos antes
  de pruebas, tsc final PASS. No fallos de ejecución en los fixtures HTTP.
- Hooks registrados sólo por nombre; no cuerpos HTTP/headers/prompts en logs.
  El error 429 es HTTP real local, no certifica proveedor externo/OAuth/TLS.
- Abort puede omitir agent_before_settle: usar settled/shutdown para cleanup.
  Se comprueba proceso ausente o zombie Linux (ha salido, puede esperar reaping);
  no prometer que no existe entrada de proceso en sistemas contenedorizados.
- Decisión ADR-003: no inferir petición individual si entran colas durante el run;
  declarar ambigüedad/indisponibilidad antes que atribuir falsamente cambios. No hay
  excepción aprobada para FR-03; sigue siendo bloqueo de aceptación, no cambio de DoD.
- Drag: API pública tiene screenX/Y y capture, pero no payload de drop. El spike
  sólo registra release y cambia cursor: falta preservar rango y reconocer editor.
  Próximo experimento documentado; ninguna conclusión de imposibilidad ni paridad.
- Arquitecto revisó plan y diff final del bloque HTTP/abort/restore sin bloqueantes.
  Revisados status/diff/cached; staging previsto sólo de test HTTP y tres documentos.
- M0 continúa abierto. No código de snapshots, parser ni UX M3. Sin push.

**Falta probar**
- H3 visual humano nuevo, H7/H8 individualizados (incluye restauración TUI),
  gesto literal hacia editor y separación de peticiones encoladas/excepción aprobada.

**Próximo paso**
- Operador revalida H3 y precisa subcasos H8; luego experimento acotado de destino
  drag y frontera de colas. No avanzar a M1.

### 2026-10-22 — M0 / síntesis de cierre y contrato confirmado

**Cambió**
- `M0.md`: síntesis autoritativa sin borrar histórico; matriz PASS/FAIL/NOT RUN/
  DEFERRED; instrucciones humanas finales mínimas H3/H7/H8 en Pi y Herdr; distingue
  restaurar layout de autoabrir/persistir panel, y exige sesión guardada para resume.
- `RESEARCH.md`: ADR-003 concreto y referencias locales de API/runtime. Corrección:
  `input.streamingBehavior` existe y distingue steer/followUp; source no lo hace.
- Sólo documentación. No snapshots, nuevos tests, refactors ni drag literal.

**Pruebas ejecutadas**
| Comando / caso | Entorno | Resultado | Evidencia |
|---|---|---|---|
| `npm run check` | 2026-10-22 21:06 UTC−03; Linux, Node 26.12.0, npm 12.2.1, Pi/TUI fijado 1.4.0 | PASS | tsc; 14/14, 0 fallos; 1711 ms |
| H1/H2/H4/H6 | Informe humano previo Pi 1.4.0 / Herdr 0.9.5 | PASS conservado | No repetidos; no nuevo informe/captura |
| H3 visual nuevo, H7 y H8 individualizados | Operador requerido | NOT RUN | Protocolo mínimo final en M0.md; no ejecutados por agente |
| PTY / integración Herdr interactiva nueva | No necesaria para cambio documental | NOT RUN | Evidencia anterior conservada, no simular interacción |

**Decisiones / limitaciones**
- Cierre documental de factibilidad preparado; **no aceptación plena de M0** mientras
  H3/H7/H8 no tengan resultado humano. No presentar tests verdes como gate total.
- Candidato/baseline en input idle, confirmación before_agent_start user; fallback
  tardío explícito; mantener ventana por retry/turnos y cerrar en settled. Colas
  agrupadas → delta individual indisponible, nunca atribución ficticia ni resultado
  viejo como Last iteration. ID session/worktree/epoch/sequence y invalidación de scope.
- ADR-003 queda decidido, no implementado. FR-03 para colas no tiene excepción;
  M1 deberá probar candidatos consumidos, fallos preflight, errores finales,
  mensajes no correlacionados y serialización/cancelación de capturas. Aprobación
  de esa limitación de producto sigue pendiente, no se modificó REQUIREMENTS.md.
- Seleccionar → a → anexar es alternativa humana validada; drag literal DEFERRED
  a evaluación M3, no técnicamente imposible. No continuar experimento en M0.
- Detach/reattach extendido DEFERRED a M4. No se aprueba compatibilidad universal,
  persistencia de snapshots ni cursor/undo. No cambios a Pi/Herdr/config/índice runtime.
- Arquitecto local revisó plan: aprobado sin bloqueantes; exigió no confundir
  agrupación con petición individual ni alternativa con FR-16, y mantener M1 bloqueado.
  Revisión final del diff documental aprobada sin bloqueantes; no ejecutó pruebas
  humanas ni agregó evidencia de compatibilidad.

**Próximo paso y límite de parada**
- Recibir únicamente filas humanas H3/H7/H8 del protocolo final y registrar sus
  resultados; si fallan, corregir sólo regresión M0 correspondiente. Desarrollo detenido.
- **No iniciar M1 sin autorización explícita del usuario**, incluso tras esos PASS.

**Git**
- Estado inicial limpio. Cambio lógico único sobre M0.md, RESEARCH.md y PROGRESS.md;
  un commit documental atómico, no commits artificiales por archivo. Revisión de
  status/diff/cached antes de staging por rutas explícitas; sin push ni amend.
  `git diff --check` inicial señaló hard breaks Markdown y blanco final nuevos;
  corregidos sólo en las líneas modificadas, sin formateo global.

### 2026-10-22 — M0 / cierre definitivo tras confirmación humana

**Cambió**
- `M0.md`: matriz final H3 visual/H7/H8 PASS por reporte del operador y gate M0
  PASS; acta con límites de evidencia y autorización de alcance.
- `RESEARCH.md`, `PROGRESS.md`: estado vigente cerrado y aceptación provisional
  del usuario de la política de ventanas agrupadas. Histórico conservado.
- No cambios de código, infraestructura, dependencias ni instalación Pi/Herdr.

**Pruebas / evidencia**
| Caso | Resultado | Evidencia / alcance |
|---|---|---|
| H3 visual Pi y Herdr | PASS humano reportado | «focos funcionan segun lo esperado» y «asi es» al confirmar ambos entornos |
| H7 sidebar/split/zoom y H8 resize/reload/new/resume | PASS humano reportado | «ambos pasaron la prueba» en respuesta a enumeración de H7/H8; no ejecución del agente |
| `npm run check` | PASS | Gate precommit 2026-10-22, Node 26.12.0/npm 12.2.1; tsc + 14/14, 0 fallos, 1768 ms |

**Decisiones y límites**
- M0 cerrado: factibilidad, no producto completo. No pruebas humanas repetidas ni
  investigación adicional; sólo check existente obligatorio antes del commit.
- Reporte humano sin capturas, hora de ejecución, tema/tamaños ni terminal cliente
  nuevos. Entorno previamente declarado Arch/Pi 1.4.0/Herdr 0.9.5, no otro inferido.
- ADR-003 aprobado por usuario; indisponibilidad individual en ventanas agrupadas
  aceptada provisionalmente para M1. Diff conjunto puede existir separado, nunca
  Last iteration. No elimina FR-03 ni certifica causalidad o captura ya implementada.
- Evaluación drag literal diferida a M3 con aceptación del usuario, FR-16 intacto;
  alternativa seleccionar → a sigue validada. Detach/reattach extendido sigue M4.
- Riesgos siguientes: correlación y serialización de capturas, límites/exclusiones,
  cambios concurrentes e internals de layout. No resueltos por aprobar el spike.

**Parada**
- M1 NOT STARTED y no autorizado. Esperar autorización explícita, sin más tareas M0.
- Revisión final del arquitecto: aprobada sin bloqueantes; no ejecutó pruebas humanas.

**Git**
- Estado inicial limpio, base 967a9ca; sólo tres documentos propios. Commit atómico
  previsto: `docs: close M0 after human acceptance`. Revisar status/diff/cached y
  whitespace antes del commit. Sin push ni cambios de configuración.

### 2026-10-23 — UI / especificación de diseño, tokens y prototipo visual

**Cambió**
- `design/ui-spec.md`: especificación técnica formal de la interfaz TUI (layout adaptativo,
  umbrales de columnas <90/90-120/>120, jerarquía de componentes, mapeo de tokens del tema Pi,
  estados de foco con `accent`, navegación por teclado y mouse, y modelo de feedback sin autoenvío).
- `design/mockups.md`: wireframes exactos en caracteres Unicode a escala terminal (120 cols)
  mostrando estados con foco, unfocused con anexo a editor, y estado vacío sin modificaciones.
- `design/theme-tokens.json`: definición estricta de tokens conforme al schema oficial de Pi Themes
  (`accent`, `toolDiffAdded`, `toolDiffRemoved`, `selectedBg`, `border`, `dim`).
- `design/preview.html` y `design/preview.css`: prototipo visual local interactivo con soporte de
  tema Dark/Light, alternancia de foco (F6/Esc) y simulación de anexo de rangos FIX/DISCUSS al editor.

**Pruebas ejecutadas**
| Comando / caso | Entorno | Resultado | Evidencia |
|---|---|---|---|
| `npm run check` | Linux 7.2.11-arch1-1, Node 26.12.0, Pi/TUI 1.4.0 | PASS | tsc + 14/14 tests PASS, 0 fallos |
| `htmlhint` / `ast-grep` | Entorno local | PASS | HTML y CSS 100% limpios, sin XSS (evitado innerHTML) |

**Fallos / límites / decisiones**
- Sesión acotada a UI/diseño sin pruebas manuales de terminal; no se tocó la lógica de runtime ni M1.
- El prototipo web (`preview.html`) es exclusivamente para previsualización y referencia documental de proporciones y colores; el producto final se mantiene 100% TUI sobre `@earendil-works/pi-tui`.

**Próximo paso**
- Cuando el usuario lo disponga, autorizar e iniciar M1 (motor de snapshots y captura del filesystem).

### 2026-10-23 — UI / ajustes de especificación, precedencia visual y contratos ADR-003

**Cambió**
- `design/ui-spec.md`:
  - Proporciones y umbrales de ancho formalizados como parámetros ajustables y calibrables.
  - Prioridad visual explícita: la selección sobrescribe fondos de adición/eliminación.
  - Indicadores de foco minimalistas en `accent`, eliminando badges superfluos.
  - Declaración precisa de preservación del editor (solo demostrado el contenido del borrador).
  - Integración documental de estados ADR-003: ventanas agrupadas/encoladas, interrupción/aborto y truncamiento.
  - Consumo dinámico de tokens del tema activo sin imponer temas obligatorios.
- `design/mockups.md`:
  - Wireframes actualizados con prioridad de selección visual limpia.
  - Mockups añadidos para estados de cola/agrupación, interrupción y truncamiento por límites.
- `design/preview.html` y `design/preview.css`:
  - Banner de advertencia explícito aclarando que el preview web no valida la TUI real.
  - Eliminado badge redundante de foco.
  - Reglas de especificidad CSS para dar prioridad al fondo de selección sobre `added`/`removed`.

**Pruebas ejecutadas**
| Comando / caso | Entorno | Resultado | Evidencia |
|---|---|---|---|
| `npm run check` | Linux 7.2.11-arch1-1, Node 26.12.0, Pi/TUI 1.4.0 | PASS | tsc + 14/14 tests PASS, 0 fallos |
| linters (htmlhint, ast-grep, stylelint) | Entorno local | PASS | Sin `!important`, sin XSS, HTML/CSS limpios |

**Decisiones y límites**
- Alcance estrictamente limitado a la especificación documental y maquetas; M1 se mantiene NO INICIADO y bloqueado a la espera de autorización.

### 2026-10-23 — UI / congelación de especificación visual y distinciones ADR-003

**Cambió**
- `design/ui-spec.md`:
  - `Batch Net` diferenciado conceptual y explícitamente de `Current Working Tree`: las ventanas agrupadas muestran el diff neto propio del lote y operan como un estado contextual sin pestañas permanentes ficticias.
  - Eliminada toda garantía sobre el posicionamiento del cursor tras anexar: la API solo certifica la preservación íntegra del contenido del borrador de texto.
  - Reglas de selección mixta detalladas para desglosar con precisión las filas `old` y `new` tanto en barra de estado como en metadatos de inserción.
- `design/mockups.md`:
  - Wireframe de selección mixta corregido con contabilidad exacta de filas (1 old + 3 new = 4 filas visuales seleccionadas).
  - Estado 4 corregido para mostrar el diff neto contextual de `Batch Net` sin pestañas permanentes ni confusión con `Current`.
  - Nota de alcance y mockup de anexo al editor actualizados sin asumir cursor interno.

**Pruebas ejecutadas**
| Comando / caso | Entorno | Resultado | Evidencia |
|---|---|---|---|
| `npm run check` | Linux 7.2.11-arch1-1, Node 26.12.0, Pi/TUI 1.4.0 | PASS | tsc + 14/14 tests PASS, 0 fallos |

**Estado y congelación de UI**
- **Especificación visual congelada para M1:** La dirección visual, anatomía, tokens y comportamiento de UI quedan fijados. Solo se admitirán modificaciones ante evidencia técnica nueva surgida en los milestones de desarrollo.
- **M0 cerrado y validado:** Gate de factibilidad en estado PASS (14/14 tests automatizados + validaciones humanas de dock, mouse, foco y resize/reload en Pi y Herdr).
- **M1 no iniciado:** A la espera de autorización formal antes de codificar la captura de snapshots y cálculo de deltas netos.

### 2026-10-23 — M1.1 / contratos y fixtures (autorización recibida)

**Cambió**
- `src/snapshots/model.ts`: contratos efímeros por bytes y comparación pura; cobertura de enumeración y omisiones por ruta. Ausencia desconocida nunca se convierte en creación/borrado.
- `tests/fixtures/workspace.ts`: repositorio mkdtemp con cleanup; `tests/snapshot-model.test.ts`: delta, cambios anteriores, vacío y cobertura parcial.
- Plan revisado por arquitecto CLI delegado (sólo asesoría, sin herramientas): exige baseline completado antes del modelo, cobertura por ruta, límites de pico e invalidación síncrona. Incorporado; no aprobó evidencia runtime por sí mismo.

**Pruebas ejecutadas**
- `npm run check` PASS: tsc + 16/16; Linux, Node 26.12.0, Pi npm 1.4.0; suite 2848 ms. No pruebas manuales nuevas.
- Revisión status/diff/cached: cambio previo ajeno en `AGENTS.md` preservado/excluido, cached vacío. Archivos nuevos leídos íntegros al crearlos.

**Límites / próximo paso**
- Sólo contratos: captura/lifecycle aún pendientes. Bytes netos, sin modos, detección de renames ni hunks. UI y editor intactos.
- Commit atómico de las cuatro rutas de este incremento; sin push. Siguiente: captura acotada y política de exclusiones.

### 2026-10-23 — M1.2 / captura acotada y comparación integrada

**Cambió**
- `src/snapshots/capture.ts`: buffers en RAM, enumeración Git read-only, límites configurables, cancelación, exclusiones de ignorados/secretos/binarios/enlaces, detección de carreras y validación Linux de descriptor antes de lectura.
- `src/snapshots/model.ts`: omisiones por prefijo impiden falsos cambios al modificar políticas ignore/exclude.
- `tests/snapshot-capture.test.ts`: cinco integraciones reproducibles con cambios previos staged/unstaged/untracked, dos iteraciones, shell, creación/borrado, neto vacío, filtros, límites/timeout/cancelación, linked worktree y submódulo. Índice por bytes y HEAD intactos.
- `M1.md`, `RESEARCH.md`: política de datos, defaults y limitaciones reales, sin dependencias nuevas ni cambios visuales.

**Pruebas ejecutadas**
- `npm run check` PASS, tsc + 21/21, 0 fallos, 2970 ms; Linux/Node 26.12.0/Pi 1.4.0. Captura+comparación: 5 integraciones PASS.
- Status/diff/cached revisados: `AGENTS.md` ajeno excluido; cached vacío antes del staging propio.

**Límites / próximo paso**
- Sólo Linux/procfs para lectura segura, no snapshot atómico ni detector universal de secretos. Límite de contenido no equivale a RSS; metadata FS cancelable sólo cooperativamente. Detalles en M1.md.
- Sin fallos de suite en este incremento. Lifecycle aún pendiente: no declarar M1 completo. Próximo: controlador y hooks reales de Pi.

### 2026-10-23 — M1.3 / lifecycle real y cierre del motor

**Cambió**
- `src/lifecycle/iteration-capture.ts`: controlador sin Pi/UI, identidad session/root/epoch/sequence, baseline confirmado, buffers efímeros, estado individual sólo si completo/exitoso, Batch Net separado, aborto/error/parcial/no verificable explícitos. Capturas serializadas, cancelación síncrona y guardas contra publicaciones obsoletas.
- `src/lifecycle/pi-lifecycle.ts`, `src/index.ts`: wiring público Pi 1.4.0 en input/before_agent_start/message_start/turn_end/before_settle/settled/sesión. Captura silenciosa; spike UI intacto y sintético. No escritura en editor, sesiones, índice, objetos ni historia para operar.
- `tests/iteration-capture.test.ts` (8): candidatos, transformaciones/custom/images, colas, errores, parciales, invalidación baseline/final, cambio root/session/runtime, serialización y doble settled.
- `tests/lifecycle-capture.test.ts` (9): AgentSession real + stream local, herramientas write/edit/bash/custom, dos iteraciones/vacío, steering/followUp, retry/aborto/error, inputs consumidos/transformados, preflight y reload. No red remota.
- `tests/lifecycle-http.test.ts` (3 existentes ampliados): mismo HTTP loopback real, ahora también motor M1; retry 429→200, cancelación bash y recuperación, reapertura sin recuperar buffers y sesión nueva sin mezcla de identidades.
- Captura: regresión `.env*` y tests adicionales para permisos, FIFO tracked, límites y medición reproducible de 512 archivos/2 MiB. `M1.md` y `RESEARCH.md`: contratos/límites vigentes.

**Pruebas reales — 2026-10-23 16:36 UTC−03**
| Comando / caso | Entorno | Resultado | Evidencia |
|---|---|---|---|
| `npm run check` | Linux, UID 1000, Node 26.12.0/npm 12.2.1, Pi npm 1.4.0 | PASS | tsc + 40/40, 0 fallos, 4799 ms |
| `npx --no-install tsx --test tests/iteration-capture.test.ts tests/lifecycle-capture.test.ts tests/lifecycle-http.test.ts` | Mismo, SDK real + HTTP local | PASS | 20/20, 4341 ms |
| `npx --no-install tsx --test tests/snapshot-model.test.ts tests/snapshot-capture.test.ts` | Repos privados mkdtemp, cleanup finally | PASS | 9/9, 893 ms; índice por bytes y HEAD intactos |
| Medición en suite completa anterior | 512 × 4 KiB, captura secuencial | PASS | 2 097 152 bytes, 373.6 ms; RSS total proceso 100 929 536 bytes, no cota incremental ni SLA |
| LSP activo en 11 rutas TS | source=lsp, paths explícitos | PASS tipos con hints/warnings | 0 errores, 5 clean + 6 findings; 2 hints getModel deprecado y advertencias auxiliares de estilo, no se maquillan como cero diagnósticos |
| LSP recheck 4 rutas finales | source=lsp, severity=error | PARCIAL | 0 errores recibidos; 2 clean confirmados, 2 inconclusos por servidor silencioso; tsc final PASS es el gate de tipos |
| Revisión arquitecto CLI delegado | Lectura de fuentes/tests y check independiente | PASS tras corrección | 39/39 en su revisión; detectó discrepancia `.env*`, corregida con regresión; follow-up read-only aprueba sin bloqueantes |
| Pi/Herdr manual / PTY nuevo | No cambia UI | NOT RUN | No inferir validación humana nueva a partir de SDK |

**Fallos y correcciones documentados**
- Primer test FIFO untracked falló: Git no enumera ese tipo como untracked. Hipótesis/prueba: crear archivo regular tracked y reemplazarlo por FIFO; Git sí lista la ruta y el motor la omite explícitamente sin bloquearse ni inventar borrado. Prueba corregida PASS. Alcance: archivos enumerables por Git, no inventario de especiales untracked.
- Arquitecto encontró filtro `.env`/`.env.*` más estrecho que política `.env*`; se amplió por segmento antes de lectura y se probaron `.envrc`, `.environment`, `.env-local`. Follow-up aprobado.
- Diagnósticos de desarrollo corrigieron imports (Pi usa `typebox` ya instalado), APIs SDK setModel/newSession inexistentes para ese uso y narrowing TypeScript en asserts. Sin dependencias nuevas; gate final limpio de errores.

**DoD M1 / límites / parada**
- PASS: delta neto aislado con preexistentes preservados; escrituras de cualquier herramienta observadas por contenido; creación/borrado/vacío; colas sin atribución individual falsa; retries conservan baseline; aborto/error no completados; scope y trabajos async no se mezclan; límites/exclusiones y Git intacto probados.
- Linux/procfs para lectura segura; fuera de repo/otros SO fail closed. Secretos best-effort, no detector universal; no atomicidad ni causalidad forense frente a escritores externos. Metadata FS sólo cancelable cooperativamente; contenido acotado no equivale a RSS total. Ignorados/especiales no elegibles fuera de alcance anunciado.
- Candidato consumido/preflight fallido no publica; su buffer acotado puede vivir hasta siguiente input/shutdown. Nuevo candidato libera resultado anterior para no acumular historial. Resume/reload no restaura snapshots.
- M1 cerrado; no declarar producto completo ni paridad FR-03 para colas. UI congelada sin cambios; M2/M3 no implementados ni autorizados. Detenerse y esperar autorización M2.

**Git**
- Commits previos de este bloque: `dffe660 feat(snapshots): define net delta and coverage contracts`; `e3b0bae feat(snapshots): capture bounded workspace content without mutating Git`.
- Commit final lógico: `feat(lifecycle): capture observed iteration windows with safe attribution`. Status/diff/cached revisados, sólo rutas propias explícitas; `AGENTS.md` previo ajeno preservado y excluido. Sin push, amend ni configuración global.

### 2026-10-23 — M1 / auditoría final de aceptación

**Dictamen: M1 ACCEPTED** para el alcance del motor/ADR-003, tras corregir dos
carreras demostrables. No autoriza M2 ni cambia requisitos/UI/dependencias.

**Hallazgos y correcciones (red → green)**
- `src/snapshots/capture.ts`, `tests/snapshot-capture.test.ts`: archivo tracked
  observado por lstat y eliminado antes del open real. Antes: ENOENT sin omisión,
  falso borrado completo. Regresión dirigida FAIL; ahora registra omisión y delta
  parcial, sin inventar borrado. Ausencia desde primera comprobación sigue válida.
- `src/lifecycle/pi-lifecycle.ts`, `tests/pi-lifecycle-races.test.ts`: shutdown en
  microtask tras resolver scope, antes de continuar input. Antes: el true obsoleto
  permitía sobrescribir motivo session-shutdown con input-not-confirmed. Regresión
  dirigida FAIL; ahora los tres consumidores async comprueban la generación devuelta.
  Dispatch controlado, no evidencia de fuga de archivos entre sesiones en Pi real.
- `M1.md`: matriz de los cinco criterios, comandos, alcance real y límites.
  Controlador y UI sintética no cambian; no se añade infraestructura ni optimización.

**Pruebas ejecutadas — Linux, Node 26.12.0/npm 12.2.1, Pi instalado/npm 1.4.0**
| Comando / caso | Resultado | Evidencia |
|---|---|---|
| `npm run check`, antes de correcciones | PASS | tsc + 40/40, 0 fallos, 5256 ms |
| Regresión ENOENT dirigida, antes de corregir | FAIL esperado | Archivo ya observado no figuraba como omitido |
| `npx --no-install tsx --test tests/pi-lifecycle-races.test.ts`, antes de corregir | FAIL esperado | Motivo input-not-confirmed en vez de session-shutdown |
| `npm run check`, después de correcciones | PASS | tsc + 42/42, 0 fallos, 4557 ms |
| `python3 tests/pty-smoke.py`, antes y después | PASS ambas | CLI instalado carga src/index.ts, dock manual, append/editor, comandos reload, salida 0 y reset mouse |
| Medición existente en suite | PASS | 512 × 4 KiB / 2 MiB; 330,5 ms inicial, 443,5 ms final; RSS total 100 155 392 / 101 629 952 bytes, no memoria incremental |
| LSP activo inicial / recheck | PARCIAL | Inicial 5 inconclusos; cuatro archivos cambiados: 2 clean y 2 inconclusos, sin errores recibidos; tsc PASS |

**Revisión y límites**
- Arquitecto independiente read-only señaló las dos carreras; sus reproducciones
  eran hipótesis estáticas. Esta sesión ejecutó ambos FAIL y el gate PASS posterior.
  Follow-up del arquitecto aprobó los fixes/regresiones sin bloqueantes en las
  cuatro rutas cambiadas; no reejecutó tests. Cierre: 16:55 UTC−03.
- La revisión temporal confirma baseline awaited antes de modelo/herramientas,
  settled como único cierre, retry sin rebaselinar y colas conservadoras. Pi 1.4.0
  difiere prompt durante emisión de settled hasta completar handlers; no se supone
  que un turn_end/agent_end sea frontera. Identidad/abort protegen publicación final.
- Exclusiones .env*, ignores, enlaces/especiales, permisos y límites mantienen sus
  pruebas; índices por bytes y HEAD de fixtures intactos. Sin persistencia/logs de
  contenidos. No se cambia Git/config/instalación real para ejecutar la extensión.
- Deep dive Claude usado sólo para contrastar riesgos; no se copia su arquitectura
  ni añade otro semáforo/backend: ya hay cola de IO, raíz explícita y guardas.
- PTY sintética 120×30, TERM=xterm-256color, HERDR_* eliminadas; directorio de agente
  temporal, sin modelo y fuera de Git. Prueba carga/fallback, no captura e2e completa;
  SDK/HTTP prueban captura Git por separado. Herdr 0.9.5 instalado, no ejecutado de
  forma interactiva en esta auditoría. Sin pruebas humanas nuevas.
- Persisten Linux/procfs, secretos best-effort, metadata sólo cooperativa, no
  atomicidad/autoría forense y delta individual indisponible para ventanas agrupadas.
  Sin benchmark de repos masivos ni SLA; no hay evidencia para cambiar los defaults.

**Git / parada**
- Inicio limpio, base e8edd35. Commit `595ab57`:
  `fix(snapshots): mark post-stat disappearance as partial` (motor + regresión).
  Segundo commit lógico: `fix(lifecycle): reject stale synchronized event handlers`,
  con regresión y evidencia documental de cierre. Rutas explícitas, status/diff/cached
  revisados antes de cada commit; sin push ni M2.
- Siguiente paso: esperar autorización explícita del usuario, no comenzar el visor.

### 2026-10-23 — M1 / corrección obligatoria de portabilidad

**Estado:** implementación compartida revisada; **CI MULTIPLATAFORMA PENDIENTE**.
La auditoría funcional previa sigue aceptada. No se declara DoD de portabilidad
satisfecho ni macOS/Windows certificados. M2 no iniciado, UI congelada.

**Cambió**
- `src/snapshots/capture.ts`: se elimina el rechazo global no-Linux. Protocolo
  compartido con lstat/fstat bigint, identidad no nula, nlink=1, tipo/tamaño/timestamps
  ns, revalidación de root/padres/destino canónico antes/después de leer. Carreras
  detectadas/identidad no verificable producen omisiones parciales. Root de volumen
  y HOME rechazados; rutas Git POSIX y aliases peligrosos Windows tratados sin
  lowercasing global; terminador de Git retirado sin truncar espacios del root.
- Adaptaciones mínimas comprobables: flags POSIX frente a O_RDONLY Windows;
  comprobación fd/procfs **adicional obligatoria sólo en Linux**, no exigida a otros
  SO ni eliminada para conseguir portabilidad. Sin tres motores ni dependencias.
- Git directo, sin shell/pager/fsmonitor; overrides GIT_* heredados eliminados,
  configuración/ignores normales preservados. Aborto/cap mata y espera close.
  Se presupone Git confiable en PATH; no supervisor de descendientes maliciosos.
- `tests/fixtures/workspace.ts`: root canónico, espacios/Unicode, config sólo del
  fixture (autocrlf=false, symlinks=true), cleanup finally.
- `tests/snapshot-capture.test.ts`: conserva ocho casos, escrituras externas mediante
  proceso Node nativo, junction Windows y directorio especial donde no existe FIFO.
  chmod/permisos POSIX sólo se afirman en POSIX. Shell bash sigue cubierto por SDK.
- `tests/snapshot-portability.test.ts`, `tests/snapshot-identity.test.ts`: 14 casos
  nuevos sobre rutas/case/Unicode/CRLF, Git overrides/ignores, carreras controladas
  en apertura/lectura, crecimiento/hardlink, identidad cero, cancelación metadata/
  lectura/proceso, integridad Git y preservación de garantía Linux antes de leer.
  No se usan sleeps para provocar carreras FS; mocks envuelven IO real.
- `tests/lifecycle-http.test.ts`: root real y detección POSIX de procesos terminados
  con kill(0)/ps en lugar de procfs. Caso HTTP bash-abort con PIDs POSIX SKIP explícito
  en Windows; no se falsifica correspondencia con PIDs Win32. Cancelación nativa del
  motor tiene tests obligatorios propios. Ningún caso previo se elimina.
- `.github/workflows/portability.yml`: ubuntu-latest/macos-latest/windows-latest,
  Node 26, npm ci, check completo y checkout intacto. Windows exige win32 sin WSL.
- `AGENTS.md`, `REQUIREMENTS.md`, `M1.md`, `RESEARCH.md`, `PROGRESS.md`: NFR-10/P0,
  gate real de tres SO, garantías/limitaciones particulares y NOT RUN transparentes.
  Snapshot/NetDelta/CaptureState/ADR-003, lifecycle y UI de producto intactos.

**Pruebas ejecutadas — Linux 7.2.11-arch1-1 (no WSL), Node 26.12.0, npm 12.2.1,
Git 2.56.0, Pi/TUI npm fijados 1.4.0**

| Comando / caso | Resultado | Evidencia |
|---|---|---|
| `npm run check`, tras protocolo compartido y antes de tests nuevos | PASS | tsc + los 42/42 anteriores, sin skips; 7204 ms. |
| `npm run check`, con primeras regresiones | PASS | tsc + 52/52; 4952 ms. |
| `npm run check`, con identidad/metadata/integridad | PASS | tsc + 55/55; 4225 ms. |
| `npm run check`, gate final incluyendo garantía procfs | PASS | tsc + 56/56, cero fallos/skips/cancelados; 5902 ms. |
| Integridad Git de fixtures | PASS | Índice/config por bytes, staging/diff/status e historial por comandos antes/después; captura no los modifica. |
| Cancelación subprocess nativo | PASS | Aborto, timeout y exceso stdout; retorno tras close, PID ya no vivo. Mocks sustituyen sólo ejecutable de regresión; integración restante usa Git real. |
| Medición existente 512 × 4 KiB | PASS | Gate final: 2 097 152 bytes, 857,8 ms; RSS total 102 502 400 bytes, no incremental/SLA. Primera ejecución concurrente dio 2358 ms con maxMs=10000 explícito del benchmark; no se aumentan defaults. |
| LSP activo 6 rutas TS, severity=error | PARCIAL | 0 errores recibidos; 5 clean confirmados, 1 inconcluso. tsc PASS es gate completo de tipos. |
| Revisión arquitecto del plan | CONDICIONAL | Exigió no rebajar Linux, reglas Windows, límites ABA explícitos y CI no inventado; incorporado. |
| Revisión arquitecto del código/tests/workflow | APROBADO a nivel código | Sin bloqueantes concretos; no reejecutó tests. Recomendó regresión procfs fallido/mismatch; agregada y gate 56/56 PASS. |
| `git diff --check`, status/diff/cached | PASS | Inicio limpio; cached vacío, sólo cambios propios de esta corrección. |
| CI ubuntu-latest | NOT RUN | Sin remote configurado; no push autorizado. Workflow no equivale a ejecución. |
| CI macos-latest | NOT RUN | Falta runner real, URL/run ID y logs; no certificación. |
| CI windows-latest (nativo) | NOT RUN | Falta runner real, URL/run ID y logs; WSL no es sustituto. |
| WSL / Pi/Herdr manual / PTY nuevo | NOT RUN | No se modificó UI ni instalación real; no reutilizar PASS previo como evidencia nueva. |

**Fallos / garantías / limitaciones**
- Sin fallos de ejecución de tests en este bloque. Lint YAML inicial señaló dos
  líneas largas del workflow; se dividieron con folding YAML y quedó clean.
- Node no expone anclaje atómico de ancestros ni control completo de reparse tags.
  En macOS/Windows el protocolo no prueba atómicamente ubicación actual del fd;
  un escritor malicioso puede mover/restaurar directorios (ABA) y evadir checks.
  No se garantiza que nunca se hayan leído bytes externos bajo ese ataque, ni se
  dice que una carrera no observada automáticamente quede parcial. Linux conserva
  su check prelectura pero tampoco es snapshot atómico frente a movimientos futuros.
  Alcance: workspace cooperativo, no sandbox hostil. Rechazo de symlinks/junctions
  reconocidos por Node, hardlinks/especiales e identidades no verificables probado.
- Windows sin privilegios de symlink debe fallar el test de archivo enlazado, no
  saltarlo. FIFO/chmod no equivalen a ACL/objetos especiales Windows; junctions sí
  se prueban allí. FS remotos, otros reparse tags, UNC y directorios Windows
  case-sensitive no certificados. Secretos best-effort y metadata IO cooperativo
  conservan sus límites anteriores.
- Decisión sin ampliar alcance: un motor compartido y dos diferencias de capacidad
  pequeñas; no FFI, runtime nuevo ni reescritura. Sin cambios al diseño UI congelado.

**Git / próximo paso / parada**
- Un commit lógico de motor + regresiones + matriz + garantías documentadas, mensaje
  `fix(snapshots): add shared cross-platform identity checks`, por rutas explícitas.
  Sin push ni cambios de configuración global/instalación Pi/Herdr.
- Próximo paso exclusivo: ejecutar externamente CI en los tres runners nativos y
  registrar run ID/logs/resultados reales; corregir sólo fallos reproducidos. La
  certificación y DoD de portabilidad siguen pendientes. **Detenerse antes de M2.**

### 2026-10-23 — M1 / preparación de certificación GitHub Actions

**Cambió**
- Revisado `.github/workflows/portability.yml` existente: sin duplicaciones,
  conserva ubuntu/macos/windows-latest, Node 26, npm ci y check completo.
  Push/PR limitados a main, dispatch manual conservado; checkout sin credenciales
  persistentes y versión npm en logs. Permisos mínimos contents: read.
- `M1.md`: evidencia nueva, separación PTY/condiciones por SO y bloqueo de publicación.
- Sin cambios de motor, UI, ADR-003, contratos ni dependencias. M2 no iniciado.

**Pruebas ejecutadas**
| Comando / caso | Entorno | Resultado | Evidencia |
|---|---|---|---|
| `git status --short`, `git remote -v`, `git log -1` iniciales | main, base 9272ec9 | PASS inspección | Checkout limpio; no hay remotos configurados. |
| `npm ci --ignore-scripts --no-audit --no-fund` | Linux 7.2.11-arch1-1, Node 26.12.0/npm 12.2.1 | PASS | 123 paquetes; aviso node-domexception obsoleto, sin fallo. |
| `npm run check` | Mismo entorno, no WSL | PASS | tsc + 56/56, 0 fallos/skips/cancelados, 4239 ms; snapshots/identidad/rutas/Git/cancelación ejecutados. |
| Validación YAML del editor | workflow existente modificado | PASS | YAML clean. |
| ubuntu-latest / macos-latest / windows-latest | GitHub Actions | NOT RUN los tres | Sin origin, URL exacta no suministrada; push no autorizado. Sin run ID/logs ni fallos reproducidos de matriz. |
| PTY Unix / pruebas humanas | No requeridas por cambio CI | NOT RUN | Python PTY separado de npm check; no sustituye matriz nativa. |

**Límites / siguiente paso**
- Windows conserva skip explícito del aborto HTTP con PIDs POSIX; no Linux conserva
  skip procfs. Cancelación nativa y snapshots no se omiten. SDK bash requiere Git
  Bash en Windows; ninguna omisión se certifica como prueba aprobada.
- No se modifican remotos ni se adivina propietario. Comando necesario:
  `git remote add origin <URL_REAL_DEL_REPOSITORIO>` con la URL exacta de GitHub.
  Se requiere además autorización explícita antes de publicar commits por push.
- Luego ejecutar matriz y registrar URL/run ID, OS/Node y resultados por runner;
  sólo corregir fallos reproducidos en commits separados. Portabilidad no certificada.
- Arquitecto CLI delegado sin herramientas revisó plan y resumen final: sin
  bloqueantes; no inspeccionó el diff ni ejecutó pruebas ni aportó evidencia hospedada.
  Status/diff/cached y `git diff --check` revisados, sin problemas. Commit local de infraestructura
  previsto: `ci: scope native portability checks to main` con tres rutas explícitas.
  Sin push, releases, paquetes ni avance a M2.

### 2026-10-23 — M1 / verificación final de evidencia CI y cierre de milestone

**Cambió**
- `M1.md`, `PROGRESS.md`: evidencia CI auditada directamente sobre GitHub Actions Run 40018853023.
  Cierre formal de M1 como `ACCEPTED — CROSS-PLATFORM CI PASS`. Sin modificar código ni workflows.
  M2 no iniciado, UI congelada.

**Pruebas ejecutadas / evidencia auditada**
| Caso / Runner | Entorno y versión | Resultado | Evidencia / desglose |
|---|---|---|---|
| Run 40018853023 | Commit `116b6a8dc292d8eaa5fcb9477ca2b66c07c6ea00` (`116b6a8`) | SUCCESS | Disparado por push a main, contiene la corrección multiplataforma `9272ec9` y scoping `116b6a8`. |
| `native (ubuntu-latest)` | Ubuntu 24.04.5 LTS, Node v26.12.1, git 2.55.0, wsl: false | PASS | `npm run check` (tsc + tsx): 56/56 pass, 0 fail, 0 skipped, 0 cancelled (11778 ms); checkout limpio. |
| `native (macos-latest)` | macOS 26.6.2 arm64, Node v26.12.1, git 2.56.0, wsl: false | PASS | `npm run check` (tsc + tsx): 55/56 pass, 0 fail, 1 skipped (procfs Linux-only), 0 cancelled (3896 ms); checkout limpio. |
| `native (windows-latest)` | Windows Server 2025 win32 x64, Node v26.12.1, git 2.56.0.windows.2, wsl: false | PASS | `npm run check` (tsc + tsx): 54/56 pass, 0 fail, 2 skipped (procfs Linux-only, bash-abort POSIX PIDs), 0 cancelled (40212 ms); checkout limpio. |
| `npm run check` local | Linux 7.2.11-arch1-1, Node v26.12.0, npm 12.2.1 | PASS | tsc + 56/56 pass, 0 fail, 0 skipped, 0 cancelled (gate local previo). |

**Dictamen y cierre de M1**
- **M1 ACCEPTED — CROSS-PLATFORM CI PASS**.
- Se auditó que `npm run check` ejecuta de forma efectiva `npm run typecheck && npm test` en los tres runners.
- No hay `continue-on-error`, pasos ocultos ni fallos ignorados; el paso final de verificación de checkout limpio pasó en los tres entornos.
- Las dos omisiones en Windows y una en macOS corresponden a capacidades del sistema operativo explícitamente declaradas (garantía procfs Linux-only y PIDs POSIX del fixture bash-abort de M0); la cancelación nativa del motor y toda la suite de snapshots se ejecutan y pasan al 100%.
- UI permanece congelada. M2 no iniciado. No se realiza push.


### 2026-10-23 — M2 / Visor real de diffs con archivos colapsables

**Estado:** Completado y verificado.

**Cambió**
- `src/diffs/iteration-diff.ts`: implementación del modelo de diff real unificado, cálculo exacto de estadísticas y lazy evaluation de hunks y filas.
- `src/ui/diff-panel.ts`: explorador con archivos colapsables por defecto, expansiones independientes por iteración, renderizado virtualizado por viewport y límites visibles.
- `src/index.ts`: registro de `/diff` (y fallback `/iteration-diff`), conexión con los ciclos de vida de captura y actualización automática.
- `tests/iteration-diff.test.ts`, `tests/diff-panel.test.ts`, `tests/diff-command.test.ts`, `tests/feasibility.test.ts`: cobertura robusta para 0, 1, 10 y múltiples archivos, expansión independiente, navegación, resize y comandos.
- `design/ui-spec.md`, `design/mockups.md`, `M2.md`: actualización de especificación visual y documentación del milestone.

**Pruebas ejecutadas**

`npm run check` completado con éxito: **81/81 test suites pass**, 0 fallos, 0 errores de TypeScript.

**Siguiente paso:** Detenerse antes de M3 (selección de rangos, FIX/DISCUSS y transferencia al editor). No push.

### 2026-10-23 — Auditoría de fidelidad visual M2 vs. /design

**Cambió**
- `design/M2_UI_AUDIT.md`: matriz de cumplimiento completa (IMPLEMENTED, PARTIAL, MISSING, CONFLICT) con referencias de código, desviaciones visuales observadas (rigidez dimensional de 34 columnas, jerarquía tipográfica, foco), problemas de usabilidad (truncamiento de rutas y footers), diferenciación estricta entre limitaciones de Pi TUI y decisiones de implementación, y correcciones priorizadas.
- Sin cambios de runtime ni código fuente de M2; congelación de UI respetada.

**Pruebas ejecutadas**
| Comando / caso | Entorno | Resultado | Evidencia |
|---|---|---|---|
| `npm run check` | Linux, Node 26.12.0 | PASS | 81/81 test suites pass, 0 fallos |
| `git status --short` | Entorno de desarrollo | PASS | Solo `design/M2_UI_AUDIT.md` y `PROGRESS.md` modificados/añadidos |

**Siguiente paso**
- Mantener congelada la UI hasta M3 y utilizar las recomendaciones de `M2_UI_AUDIT.md` al planificar el siguiente milestone.

### 2026-10-23 — M2 / Corrección de fidelidad visual según auditoría

**Cambió**
- `src/ui/layout-adapter.ts`: dock adaptable con ancho base de 40 columnas y acotación responsiva (`minSize: 34`, `maxSize: 55`).
- `src/ui/diff-panel.ts`: footer responsivo que conmuta a modo corto (< 45 cols) para evitar truncamientos y estadísticas formateadas con espacios explícitos (`+3 / -2`).
- `tests/diff-panel.test.ts`: pruebas de regresión añadidas para footer responsivo, formateo de estadísticas y estado del dock.
- `M2.md`, `design/M2_UI_AUDIT.md`: documentación actualizada con la resolución de las desviaciones visuales.

**Pruebas ejecutadas**
| Comando / caso | Entorno | Resultado | Evidencia |
|---|---|---|---|
| `npm run check` | Linux 7.2.11-arch1-1, Node 26.12.0 | PASS | 82/82 test suites pass, 0 fallos, tsc limpio |
| `git status --short` | Entorno de desarrollo | PASS | Archivos modificados y nuevos correctos |

**Siguiente paso**
- Implementar la fidelidad visual completa de M2 según `/design`.

### 2026-10-23 — M2 / Implementación visual completa según `/design`

**Cambió**
- `src/ui/layout-adapter.ts`: proporción del dock adaptativa real (35-40%, `basis: 36, grow: 40, minSize: 34, maxSize: 70`) preservando el ancho mínimo útil de conversación/editor (`minSize: 52, grow: 60`).
- `src/ui/diff-panel.ts`:
  - Separador vertical `│` estilizado uniformemente con token `border` sin teñirse del rol de la línea.
  - Granularidad de estilos de tema Pi: cabecera con badge `[Last*]`, números de línea con `dim`, signos `+`/`-` y código en `toolDiffAdded` y `toolDiffRemoved`, nombres de archivo en `bold` y estadísticas `+X / -Y` con colores diferenciados.
  - Indicador de foco minimalista: cabecera y cursor `>` con `accent` únicamente bajo foco activo; cursor atenuado `dim` sin foco.
  - Mecanismos de lectura para líneas largas y rutas: desplazamiento horizontal (`←`/`→`, `h`/`l`) con indicador `«` y reset con `0`/`Home`; truncamiento medio inteligente de rutas (`truncatePath`: `dir/…/file.ts`); modo de inspección bajo demanda (`i`) en pie de página.
  - Footer responsivo con estado dinámico de pan e inspección.
- `src/index.ts`: mapeo completo de roles de estilo (`border`, `bold`, `dim`, `accent`, `muted`, `warning`, `text`, `toolDiffAdded`, `toolDiffRemoved`) contra `ctx.ui.theme`.
- `tests/diff-panel.test.ts`: test añadido para desplazamiento horizontal (pan), indicador `«`, modo de inspección `i` y reseteo.
- `design/M2_UI_AUDIT.md`, `M2.md`: matriz de cumplimiento actualizada con todos los requisitos en estado `IMPLEMENTED`.

**Pruebas ejecutadas**
| Comando / caso | Entorno | Resultado | Evidencia |
|---|---|---|---|
| `npm run check` | Linux 7.2.11-arch1-1, Node 26.12.0 | PASS | 83/83 test suites pass, 0 fallos, tsc limpio |
| Render ANSI real vs mockups | Terminal Linux, Node 26.12.0 | PASS | Estructura de cabecera, gutter, hunks, stats y pan verificados visualmente con tokens de tema |
| `git status --short` | Entorno de desarrollo | PASS | Solo archivos de UI, tests y documentación modificados |

**Siguiente paso**
- Implementación integral de UI y selección de contexto (Etapa A y B).

### 2026-10-23 — M2 / M3: Implementación integral de UI definitiva y selección de contexto

**Estado:** Completado y verificado.

**Cambió**
- `design/ui-spec.md` y `design/mockups.md`: especificación visual actualizada con las decisiones aprobadas (dock al 45%, redimensionamiento interactivo, encabezado de archivo de dos líneas, eliminación de pestañas ficticias Current/History, acción única `a` de anexado al editor, formato de contexto en texto plano).
- `src/ui/layout-adapter.ts`:
  - `ResizableDockRoot` con ancho objetivo del 45% del terminal (`Math.round(W * 0.45)`).
  - Garantía de ancho mínimo para conversación y editor (46 columnas) y dock (34 columnas).
  - Métodos `resizeBy`, `setDockWidth` y `getDockWidth` con persistencia de ratio en la sesión y adaptación a resize.
- `src/ui/diff-panel.ts`:
  - Explorador de archivos inline con encabezado de dos líneas: Línea 1 (nombre destacado en negrita, indicador `▾`/`▸`, estado y estadísticas) y Línea 2 (ruta relativa sangrada 4 espacios en color tenue `dim`).
  - Expansión independiente con `Enter` o clic en cualquiera de las dos líneas del encabezado.
  - Hunks discretos (`@@ ... @@`) y gutter fijo con referencias `old` y `new` en `dim`.
  - Mecánica de selección completa: teclado (`Shift+↑/↓`), clic para línea individual, arrastre para rangos, selección de hunk completo desde su encabezado `@@`.
  - Prioridad visual absoluta de selección (`selectedBg` o vídeo inverso) sobre colores de adición y eliminación.
  - Transferencia de contexto con `a`: formatea bloque en texto plano `[path | diff | old:X-Y | new:A-B]`, anexa al borrador nativo sin reemplazar ni enviar automáticamente, y devuelve automáticamente el foco al editor nativo.
  - Cabecera compacta con estados concisos (`DIFF · Last iteration · N files (+X / -Y)`, Batch Net, interrumpida, parcial, vacía) sin tabs ficticios.
  - Footer adaptable con resumen de selección y atajos concisos.
- `src/index.ts`: cableado de `appendContext` (usando `owner.ui.getEditorText()` y `setEditorText()`), `resize`, `setDockWidth` y estilos de selección.
- `M2.md`, `M3.md`: documentación de cierre de Etapa A y creación de M3 con protocolo de validación humana.
- `tests/diff-panel.test.ts`: 8 nuevos tests cubriendo layout a 90, 120, 160 y 200 columnas, redimensionamiento interactivo por teclado y ratón, encabezados de dos líneas, expansiones independientes, selección de rangos y hunks, transferencia con `a`, preservación de borrador, y formateo de estados en cabecera/footer.

**Pruebas ejecutadas**
| Comando / caso | Entorno | Resultado | Evidencia |
|---|---|---|---|
| `npm run check` | Linux 7.2.11-arch1-1, Node 26.12.0 | PASS | 91/91 test suites pass, 0 fallos, tsc limpio |
| `tests/diff-panel.test.ts` | Linux 7.2.11-arch1-1, Node 26.12.0 | PASS | Cobertura para layout 90/120/160/200, resize, 2-line headers, selection, multi-append, states |
| `git status --short` | Entorno de desarrollo | PASS | Solo archivos modificados del proyecto; sin archivos extraños |

### 2026-10-23 — M2 / M3: Pulido visual y optimización de espacio en dock

**Estado:** Completado y verificado.

**Cambió**
- `src/ui/diff-panel.ts`:
  - **Gutter compacto y adaptativo:**
    - Archivos creados (`new_only`): Muestra únicamente números de línea nuevos (`newLine`) en 4 columnas, liberando 5 columnas adicionales para el código.
    - Archivos eliminados (`old_only`): Muestra únicamente números de línea antiguos (`oldLine`) en 4 columnas, liberando 5 columnas.
    - Archivos modificados (`dual`): Preserva ambas referencias `old` y `new` cuando ambas existen, manteniendo correspondencia exacta y alineación de hunks.
  - **Reducción de sangría y cercanía al borde:**
    - Código acercado al borde interior del dock: el código inicia en la columna 10 en archivos creados/eliminados (en lugar de columna 15, un 33% menos de columnas no útiles).
    - Separador `pan` o espacio de 1 carácter (`sep = panX > 0 ? '«' : ' '`) garantizando un ancho de gutter 100% fijo durante desplazamiento horizontal.
  - **Cabecera simplificada y avisos técnicos bajo demanda:**
    - Eliminación de la vista normal de los textos técnicos extensos y truncados (`Diff neto entre snapshots...`, `Límites del visor...`, `Rutas omitidas...`).
    - Vista de detalles bajo demanda: accesible mediante teclado con tecla `d` o haciendo clic con ratón en la cabecera (`y === 0`).
    - Conservación visible y permanente de advertencias críticas en el alcance de la cabecera: `[omisiones]`, `[parcial]`, `Batch Net`, `(interrumpida)`, `(fallida)` y `No disponible`.
  - **Refinamiento de selección visual:**
    - El separador vertical `│` preserva su color y continuidad nativa de borde (`border`) sin verse roto por la selección.
    - El contenido de la fila seleccionada aplica prioritariamente `selectedBg` preservando alto contraste en temas oscuros y claros.
  - **Footer adaptable de 1 sola línea:**
    - Sin selección estrecho (< 50 cols): `Enter: expandir · a: anexar · Esc: editor`
    - Sin selección estándar (>= 50 cols): `Enter: expandir · a: anexar · ↑↓: navegar · Esc: editor · d: detalles`
    - Con selección estrecho (< 55 cols): `N líneas seleccionadas · a: anexar`
    - Con selección estándar (>= 55 cols): `Sel: old:X, new:Y (N líneas) · a: anexa al editor`
- `tests/diff-panel.test.ts`:
  - Actualización del footer test a `Enter: expandir`.
  - 5 nuevos tests automatizados (total 96 tests):
    1. Gutter compacto para creados, eliminados y modificados.
    2. Comparativa de ancho útil de código a 90, 120, 160 y 200 columnas.
    3. Omisión de avisos rutinarios en vista normal y conmutación bajo demanda con `d` y clic de cabecera.
    4. Permanencia inmutable de advertencias críticas en cabecera.
    5. Preservación del borde del dock y aplicación de `selectedBg` en selecciones.
- `M2.md`, `M3.md`, `design/ui-spec.md`: documentación sincronizada con los cambios visuales y espaciales.

**Pruebas ejecutadas**
| Comando / caso | Entorno | Resultado | Evidencia |
|---|---|---|---|
| `npm run check` | Linux 7.2.11-arch1-1, Node 26.12.0 | PASS | 96/96 test suites pass (0 fallos, 0 errores tsc) |
| Render ANSI real con `tsx` | Linux 7.2.11-arch1-1, Node 26.12.0 | PASS | Código inicia en col 10 (creados/eliminados); header y footer en 1 línea; sin avisos técnicos en vista normal |
| `git status --short` | Entorno de desarrollo | PASS | Solo archivos de código, tests y documentación modificados |

**Siguiente paso**
- Detenido según DoD. No avanzar a M4 ni M5. No push.

---

## 2026-10-23 — UI: English-only labels y cabecera de dos líneas

**Objetivo:** Separar la cabecera del dock en dos líneas (Línea 1: título/alcance + cantidad de archivos alineada a la derecha; Línea 2: estadísticas de cambios netos con tokens semánticos), estandarizar todas las etiquetas y mensajes visibles propios de la extensión a inglés, y diferenciar conceptualmente exclusiones intencionales por política de capturas parciales/fallidas según ADR-003.

**Cambió**
- `src/ui/diff-panel.ts`:
  - **Cabecera de dos líneas (`basis: 2`, `minSize: 2`):**
    - Línea 1: `│ DIFF · <Scope>` a la izquierda y cantidad de archivos alineada a la derecha (`N files` o `1 file`).
    - Línea 2: Resumen de cambios `│ +added / -removed` usando los tokens semánticos de Pi (`toolDiffAdded`, `toolDiffRemoved`, `dim`) o `│ No changes` en dim cuando está vacío.
    - Ancho mínimo de 34 columnas: ambas líneas caben holgadamente sin truncamiento ni elisión de estadísticas.
  - **Diferenciación conceptual de exclusiones vs capturas parciales:**
    - Rutas excluidas por política (ej. `.git`, `node_modules`, límites de snapshot) no generan advertencias engañosas como `[omissions]`.
    - Indicadores breves y precisos de alcance según contrato ADR-003: `Last iteration`, `Batch Net`, `Unverified`, `Partial`, `Cancelled`, `Failed`, `Unavailable`, `Capturing`.
    - Detalles técnicos y motivos permanecen accesibles bajo demanda en la vista compacta (`d` o clic en cabecera).
  - **Localización estricta en inglés:**
    - Badges de archivo: `[created]`, `[modified]`, `[deleted]`, `[stats unavailable]`.
    - Footer interactivo: `Enter: expand`, `a: append`, `↑↓: navigate`, `Esc: editor`, `d: details`, `Sel: <ranges> (N lines) · a: append to editor`, `N lines selected · a: append`.
    - Mensajes vacíos y avisos: `No changes observed in this iteration.`, `Content omitted: ...`, `Diff truncated: ...`, `List truncated: ...`, `Net diff between ...`, `Omitted paths in snapshots: ...`, `Viewer limits: ...`.
  - **Interacción y mouse:**
    - Clic en cabecera ampliado a `y === 0 || y === 1` para alternar la vista de detalles.
    - Clic y arrastre de filas de código adaptados al nuevo offset (`y >= 2`, target `body.scrollTop + event.y - 2`), preservando intacta la selección por arrastre y la transferencia de contexto (`a`).
- `src/index.ts`:
  - Mensajes de notificación en inglés (`Diff requires Pi TUI fullscreen...`, `Failed to open diff`, `/diff is occupied; use /iteration-diff`).
- `tests/diff-panel.test.ts` y `tests/feasibility.test.ts`:
  - Ajuste de índices de línea y coordenadas de fila SGR para dar cabida a la cabecera de dos líneas.
  - Actualización de aserciones de badges, footer y cabecera a inglés.
  - Test comprehensivo añadido para anchos de 34, 45, 60 y 100 columnas, temas oscuro y claro, todos los estados ADR-003 y ausencia total de textos residuales en español.
- `design/ui-spec.md`, `M2.md`, `M3.md`: especificación y documentación de arquitectura actualizadas.

**Pruebas ejecutadas**
| Comando / caso | Entorno | Resultado | Evidencia |
|---|---|---|---|
| `npm run typecheck` | Linux 7.2.11-arch1-1, Node 26.12.0 | PASS | 0 errores tsc |
| `npm test` | Linux 7.2.11-arch1-1, Node 26.12.0 | PASS | 97/97 tests pass (0 fallos, 0 errores) |
| `npm run check` | Linux 7.2.11-arch1-1, Node 26.12.0 | PASS | typecheck + 97 tests pass |
| Matriz de anchos 34, 45, 60, 100 cols | Linux 7.2.11-arch1-1, Node 26.12.0 | PASS | Cabecera y estadísticas visibles sin truncar a 34 columnas |
| Matriz de temas dark/light | Linux 7.2.11-arch1-1, Node 26.12.0 | PASS | Roles semánticos `added`, `removed`, `dim`, `border`, `accent` |
| Matriz de estados ADR-003 | Linux 7.2.11-arch1-1, Node 26.12.0 | PASS | Complete, Partial, Batch Net, Cancelled, Failed, Unavailable, Empty |

**Siguiente paso**
- Commit atómico en inglés según política de Conventional Commits. Sin push. Detenido según DoD.




### 2026-10-23 — UI / retorno al editor desde el panel nativo

**Cambió**
- `src/ui/layout-adapter.ts`: observer local al root del dock para press izquierdo
  no consumido en el lado Pi; restaura foco guardado sin retornar resultado de mouse.
  No modifica componentes nativos ni captura/reenvía eventos. Ownership y cierre
  existentes delimitan el callback; no monkey-patching global.
- `tests/native-pane-focus.test.ts`: cuatro regresiones con TUI real y SGR sintético:
  transcript/mensaje/vacío/editor/Diff, selección del diff conservada, selección/copia
  nativa y enlace OSC 8, rueda/motion/drag huérfano/release/botones secundarios,
  resize y selección capturados cruzando al lado izquierdo. Borrador intacto y cero envíos.
- `M3.md`: mecanismo, limitaciones y protocolo físico Pi/Herdr pendiente.

**Pruebas ejecutadas**
| Comando / caso | Entorno | Resultado | Evidencia |
|---|---|---|---|
| `npx --no-install tsx --test tests/native-pane-focus.test.ts` | Linux, Node v26.12.0, Pi/TUI 1.4.0 | PASS | 4/4, 0 fallos |
| `npm run check` | Mismo entorno | PASS | tsc + 103/103, 0 fallos/skips; 5119 ms |
| LSP activo en adaptador/test nuevo | source=lsp, scope=paths | PARCIAL | 0 errores recibidos; 1 clean, 1 inconcluso; tsc PASS |
| Arquitecto delegado read-only, sin herramientas | Fuentes y contrato de dispatch suministrados | PASS revisión | Sin bloqueantes; distingue SGR sintético de evidencia física |
| Mouse físico Pi directo / Herdr | Pi 1.4.0, Herdr 0.9.5 instalados; NO_TTY | NOT RUN | No se manipuló el pane activo ni instalación/configuración |

**Fallos / límites / decisiones**
- Sin fallos runtime de regresiones; durante escritura del test se corrigieron firmas
  consultando declaraciones (opciones del constructor, copySelection y selección pública).
- Pi 1.4.0 recorre hit-path de hijos a root; un resultado de mouse consumiría el press
  y limpiaría selección. Retornar undefined conserva el fallback. Los listeners de
  input públicos llegan después del listener viewport que consume mouse.
- Controles que consumen eventos, scrollbars, buscador y overlays no llegan al observer;
  se prioriza su interacción nativa. Alternativa menos invasiva: Esc desde Diff o clic
  en editor. No se declara cobertura literal de cualquier control ni DoD físico PASS.
- Sin APIs de Herdr, IO de editor ni envío de prompts añadidos. Sin nuevas dependencias.

**Git / próximo paso**
- Cambios previos en `src/ui/diff-panel.ts`, sus tests, `tests/feasibility.test.ts` y
  otras entradas de PROGRESS preservados y excluidos del commit. Staging explícito
  de adaptador, test nuevo, M3 y sólo esta entrada de bitácora, aislable por hunk.
- Commit atómico previsto: `fix(ui): restore editor focus on native pane clicks`.
  Sin push. Próximo paso: operador ejecuta el protocolo físico de M3 en Pi y Herdr.




### 2026-10-24 — UI / integración de foco, navegación e indicadores del dock

**Recuperación documental**
- `PROGRESS.md` había sido truncado accidentalmente: `HEAD` conserva 1.049 líneas y la versión de trabajo tenía 23. Ambas versiones y el diff quedaron preservados fuera del repositorio en `/tmp/pi-diff-recovery-5df2db5/` antes de restaurar el historial.
- Se recuperó íntegramente el historial de `HEAD` y se conserva esta entrada nueva de la versión truncada, ampliada con los cambios integrados y la evidencia actual. No se reconstruyeron entradas históricas ausentes.

**Cambió**
- `src/ui/diff-panel.ts`: navegación vertical omite las filas de ruta secundaria; saltos entre archivos usan encabezados; colapsar un archivo vuelve su cursor al encabezado. Borde del dock `🭽▔`/`▏` con color de foco; estados compactos `A/M/D`.
- Tests de panel, foco/layout y PTY actualizados para esos comportamientos. `design/ui-spec.md`, `M2.md` y `M3.md` sincronizan el contrato visible y la navegación.

**Pruebas / evidencia**
| Comando / caso | Entorno | Resultado | Evidencia |
|---|---|---|---|
| `npm run check` | Linux, Node v26.12.0 | PASS | Typecheck y 105/105 tests, 0 fallos, 0 skips; ejecutado en esta sesión antes del commit. |
| Validación visual en Kitty | Reporte del usuario | PASS reportado | El usuario indica que `🭽▔▏` fue validado visualmente; no se repitió la prueba física en esta sesión. |

**Límites / estado Git**
- No incluye fixtures/experimentos `focus-border*` ni archivos `fake*`.
- Las pruebas automatizadas verifican render, geometría, navegación, foco, resize y remount; no sustituyen la validación manual en otros terminales.

### 2026-10-24 — Limpieza del experimento visual `focus-border`

**Decisión**
- Se eliminaron `tests/fixtures/focus-border.md` (protocolo manual obsoleto), `tests/fixtures/focus-border.ts` (overlay comparativo ajeno al dock de producto) y `tests/focus-border-experiment.test.ts` (sólo verificaba la geometría de esas muestras sintéticas).
- El test sí entraba en `npm run check` por el glob `tests/*.test.ts`, pero no aportaba cobertura del borde final. `tests/diff-panel.test.ts` y `tests/native-pane-focus.test.ts` ya verifican `🭽▔▏`, su geometría, foco, resize y remount. No había consumidores externos de esos fixtures.
- Copias exactas archivadas fuera del repositorio en `/tmp/pi-diff-focus-border-archive/`; no se cambió la UI.

**Validación**
| Comando | Resultado | Evidencia |
|---|---|---|
| `npm run check` | PASS | Typecheck y 104/104 tests, 0 fallos/skips/cancelados. |
| Búsqueda de referencias | PASS | Sin consumidores del experimento fuera de sus tres archivos eliminados. |

### 2026-10-24 — Pre-M3.5 / política de comandos y apertura

**Cambió**
- `AGENTS.md`: `/diff` como único comando principal, `F6` conservado y eliminación de `/iteration-diff` autorizada para M3.5, sin aliases nuevos ni sobrescritura de comandos ajenos.
- Apertura automática permitida exclusivamente por opt-in en `/diff-settings`, default Off, tras resultado final válido; sin captura intermedia, robo de foco, envío ni modificación del borrador y respetando cierres manuales. DoD alineado con esta excepción.
- Ediciones puntuales; seguridad, snapshots, compatibilidad, Git e histórico documental conservados. No cambia runtime.

**Validación**
- Working tree inicialmente limpio. `npm run check`: PASS, typecheck + 104/104 tests, 0 fallos/skips/cancelados (Linux).
- Revisión del diff y búsqueda de reglas de comandos/autoapertura en `AGENTS.md`: las tres reglas relacionadas quedan alineadas.
- Pruebas físicas: NOT RUN; cambio exclusivamente documental.

**Límite / próximo paso**
- M3.5 pendiente de implementación. Esta sesión recibió además una copia de las instrucciones anteriores en su contexto de mayor prioridad; editar el archivo no reemplaza esa copia. Recargar las instrucciones del proyecto en una nueva sesión antes de implementar la eliminación del alias y el opt-in.
- Commit documental separado, sólo `AGENTS.md` y esta entrada; sin push. REQUIREMENTS/RESEARCH conservan el histórico anterior; su actualización de decisiones corresponde al bloque M3.5.

### 2026-10-24 — M3.5 / Diff Settings & Command Cleanup

**Estado vigente:** implementación M3.5 y gate automatizado PASS. Validación física
nueva/CI nativa nueva NOT RUN; no declaración de DoD global ni avance a M4.

**Cambió**
- `src/ui/diff-settings.ts`: seis preferencias mediante SettingsList público en
  overlay custom de Pi; defaults 45% (30–60), numbers On, paths Smart, collapse On,
  remember width On, auto-open Off. Payload v1 estrictamente validado; datos
  inválidos restablecen defaults sin consentimiento automático.
- `src/index.ts`: `/diff-settings`, `/diff` sin colisión y F6 abre/enfoca; eliminado
  `/iteration-diff`. Persistencia pública appendEntry/getBranch por rama, restore
  en start/tree, sin código/diffs/rutas persistidos ni config global. Error de
  almacenamiento avisa y no impide cleanup. Nueva sesión conserva defaults.
- Auto-open sólo después de captura settled individual completa; sin foco ni
  escritura/envío al editor. Guardas de generación, identidad/scope y preferencia
  después de await; cierre manual de ventana activa y settled duplicado no reabren.
- `src/ui/layout-adapter.ts`: ratio por instancia, sin global compartida; límites
  30–60% y mínimos del editor/dock conservados. Remember guarda al concluir gesto,
  teclado o cierre; Off deja resize transitorio hasta reapertura.
- `src/ui/diff-panel.ts`: números opcionales y Smart/Full/Filename sin cambiar
  identidad ni anexado; truncado Smart por columnas Unicode. Cambios de presentación
  preservan selección/cursor/expansiones; collapse default sólo en vista nueva.
- Tests settings, auto-open/eventos/ramas/errores, panel, comandos SDK y PTY;
  `M3.5.md`, REQUIREMENTS/RESEARCH y especificación visual alineados con autorización
  posterior a e923e7e. Historial de esta bitácora preservado íntegro por anexado.

**Pruebas ejecutadas — Linux, Node v26.12.0, Pi/TUI 1.4.0**
| Comando / caso | Resultado | Evidencia |
|---|---|---|
| Primer `npm run check` durante integración worker | FAIL | Firmas constructor/setPreferences aún no escritas; tsc pasó al integrar panel. |
| Check con tests nuevos iniciales | FAIL 120/121 | Assertion Full esperaba ellipsis al final de salida ANSI; se normalizó con stripTerminalSequences antes de comprobar sufijo, conservando verificación de ruta/elisión. |
| `npx --no-install tsx --test tests/diff-auto-open.test.ts tests/diff-settings.test.ts` | PASS 10/10 | Consentimiento SettingsList real, Off durante await, cierre manual, settled duplicado, shutdown/tree, ventanas agrupadas/aborto/error, defaults y límites. |
| `npm run check` final | PASS | tsc + 124/124, cero fallos/skips/cancelados; 6205 ms. Incluye Remember On/Off/reopen/branch y fallo de persistencia sin bloquear cierre, snapshots/Git/SDK/HTTP. |
| `python3 tests/pty-smoke.py` | PASS | CLI instalado, agente temporal sin credenciales/modelo; seis opciones visibles, /diff, F6 apertura/foco, borrador, reload, salida 0/reset mouse. PTY sintética 120×30, no mouse físico. |
| LSP activo en ocho TS cambiados | PARCIAL | 6 clean confirmados, 2 inconclusos, cero errores recibidos; tsc es gate completo. |
| Arquitecto read-only plan y revisión final | APROBADO | Corrigió validación enum por coerción y exigió tests async Off/cierre; regresión ['Full'] rechazada. Cierre sin bloqueantes, no ejecutó suite ni interacción física. |
| Pi/Herdr físico nuevo; CI ubuntu/macOS/Windows nativo nueva | NOT RUN | No se ejecutaron runners remotos ni interacción humana. Evidencia M1 histórica no certifica este cambio. |

**Límites / decisiones / parada**
- API pública de Pi persiste datos por rama de sesión, no preferencias globales.
  Se informó antes de implementar: reload/resume/fork/tree siguen la rama; nueva
  sesión usa defaults; --no-session no persiste entre procesos. No solución propia
  de filesystem, nuevas dependencias ni cambios al motor snapshots/Herdr.
- Se mantiene geometría de dos líneas incluso Filename (basename en segunda);
  rango/archivo real siempre intacto en contexto anexado. Full sigue acotado por
  viewport, no promete mostrar ruta arbitrariamente larga sin truncamiento.
- Ancho efectivo prioriza mínimos de 34/46 columnas en terminal pequeño. No se
  certifican cursor/undo, drag físico ni compatibilidad multiplataforma nueva.
- Próximo paso: validación humana del protocolo M3.5 y CI externa cuando se autorice.
  **Detenido antes de M4. Sin push.**

**Git**
- Base e923e7e con working tree inicialmente limpio. Revisión status/diff/cached;
  staged inicialmente vacío. Sólo rutas explícitas de M3.5, sin dependencias,
  instalación/config global ni artefactos. Whitespace nuevo al final de test
  corregido sin reformateo general.
- Commit lógico previsto: `feat(ui): add diff settings and remove legacy command alias`.

### 2026-10-24 — UI: Ajustes de interfaz en /diff-settings y actualización en caliente

**Estado vigente:** correcciones de interfaz M3.5 aplicadas. 131/131 tests PASS y `tests/pty-smoke.py` PASS. Sin funcionalidades nuevas, sin dependencias, sin push ni avance a M4.

**Cambió**
- `src/ui/diff-settings.ts`:
  - Se eliminó la opción `{ overlay: true }`, adoptando el patrón inline nativo de Pi en `ctx.ui.custom` (`pushExtensionDialog`).
  - Se implementó `DiffSettingsComponent`: renderizado directo en el slot del editor, integrado con el scroll y layout nativo de Pi, respetando el tema activo y sin cajas flotantes ni superposición sobre mensajes anteriores.
  - Navegación con flechas `↑`/`↓` entre las seis preferencias.
  - `Enter` sobre "Dock width" entra al modo edición; `←`/`→` disminuye/aumenta en pasos de 1%, restringido entre 30% y 60%.
  - Indicador discreto `◀ 45% ▶` durante la edición con línea de ayuda contextual.
  - `Enter` confirma el valor y sale del modo edición; `Esc` cancela y restaura el valor previo.
  - `Esc` fuera de edición cierra los ajustes restaurando el borrador del editor nativo.
  - Controles On/Off y selector `Smart`/`Full`/`Filename` conservados y operativos con `Enter` y flechas.
- `src/ui/layout-adapter.ts`:
  - `ResizableDockRoot`: soporte de `updateDockBasis(totalWidth)` para sincronizar `entries[1].basis` con el ancho de terminal antes de la resolución del layout en Pi.
  - `setDockRatio`, `resizeBy` y `setDockWidth` actualizan la base, invalidan el root y solicitan re-render inmediato en caliente.
- `src/ui/diff-panel.ts`:
  - `setPreferences`: aplica cambios visuales en caliente invocando `this.rebuild()`, `this.invalidate()` y `this.actions.render()`.
  - `VirtualDiffScroll.invalidate()` y `DiffPanel.invalidate()` limpian el buffer virtual para re-renderizar líneas de código sin números de línea o con formato de ruta actualizado (`Smart`/`Full`/`Filename`).
  - Se preservan intactos: selección de rango, cursor, foco, expansiones de archivos (`this.expanded`) y posición de scroll.
- `src/index.ts`:
  - Secuenciación de registro: `/diff` se registra antes de `/diff-settings` en `session_start`. Al tener idéntico score fuzzy para el prefijo `/dif` (-24.7), el orden de registro garantiza que `/diff` aparezca primero en el autocompletado sin hacks ni APIs privadas.
  - Se eliminó el incremento `generation++` dentro del callback de cambio de settings, evitando invalidaciones o marcados de staleness innecesarios en la iteración abierta.
- Pruebas agregadas (131 tests totales):
  - `tests/diff-settings.test.ts`: navegación con flechas, edición y límites de Dock width (30%–60%), confirmación con Enter, cancelación con Esc en ambos modos, toggles booleanos, selector de rutas, clics de mouse y presentación inline.
  - `tests/diff-panel.test.ts`: ajustes visuales en caliente con el dock ya abierto (lineNumbers ocultando gutter, filePaths alternando Smart/Full/Filename, collapseFiles conservando expansiones actuales).
  - `tests/diff-auto-open.test.ts`: actualización de layout con el dock abierto sin alterar el borrador del editor, y persistencia de branch.
  - `tests/diff-command.test.ts`: orden de registro de `/diff` antes de `/diff-settings` y verificación con `fuzzyFilter` para coincidencia parcial `/dif`.

**Validación ejecutada**
| Comando / caso | Resultado | Evidencia |
|---|---|---|
| `npm run check` (`tsc --noEmit` + `tsx --test`) | PASS | 131/131 tests unitarios e integrados aprobados en Linux x64 (4184 ms). Cero fallos, cancelados ni skips. |
| `python3 tests/pty-smoke.py` | PASS | Validación PTY con Pi 1.4.0 real: arranque, `/diff`, F6, `/diff-settings` inline con 6 opciones, cierre con Esc, persistencia de borrador `DRAFT-M2`, reload y salida limpia. |
| Autocompletado `/dif` | PASS | Verificado en test de integración con el motor `fuzzyFilter` de Pi TUI: `['diff', 'diff-settings']`. |
| Validación física en Herdr / macOS / Windows nativo | NOT RUN | Entorno local es Arch Linux headless. Validación física en Herdr y runners nativos en macOS/Windows no ejecutados en este paso. |

**Límites / próximo paso**
- No se crearon dependencias nuevas ni se modificó el motor de snapshots.
- Listo para validación física final por el usuario en terminal interactivo / Herdr.
- No avanzar a M4 hasta conformidad explícita.

### 2026-10-24 — M4.1 / fase 1: gutter contextual compacto

**Cambió**
- `src/ui/diff-panel.ts`: un número contextual (old al eliminar, new en adición/contexto), sin modos de gutter; `DiffRow` y formato de contexto intactos. On/Off conservado.
- `tests/diff-horizontal.test.ts`, `tests/diff-panel.test.ts`: números divergentes/multidígito, Unicode/ANSI, tabs, anchos 1–34, selección mouse/teclado y anexado exacto con borrador preservado.
- `design/mockups.md`: contrato vigente contextual; esquemas históricos no son renderer literal.
- Recuperación medida: overhead de fila modificada 15→10 columnas con números de hasta cuatro dígitos: **5 columnas**. Creados/eliminados ya tenían overhead 10, no se atribuye ganancia nueva allí. Sangría original intacta.

**Pruebas ejecutadas**
- `npm run check`: PASS, tsc + 133/133, cero fallos/skips (6648 ms), Linux, Node v26.12.0, Pi/TUI 1.4.0.
- Primera ejecución: FAIL en expectativa de espacios del test nuevo (se contaron tres espacios extra); renderer verificado y expectativa corregida. No se alteró código para acomodar el test.
- Arquitecto CLI delegado revisó plan completo sin herramientas: aprobado con recomendaciones de clamp/Unicode/layout real incorporadas para fase 2. No pruebas físicas nuevas.

**Git / límites / siguiente paso**
- Inicio sin modificaciones tracked; `scripts/lab-horizontal-diff.ts` preexistente untracked leído y excluido. No existe documentación M4 específica en checkout: roadmap REQUIREMENTS/PROGRESS y laboratorio son las referencias disponibles; se creará protocolo M4.1.
- Status/diff/cached revisados; commit separado `refactor(ui): compact diff line gutter`. Sin push. Continúa sólo fase 2 de M4.1; M4.2 fuera de alcance.

### 2026-10-24 — M4.1 / fase 2 y preparación experimental de fase 3

**Cambió**
- `src/ui/diff-panel.ts`: offsets por path, reset por identidad de iteración, gutter fijo con ancho numérico por archivo, `«`/`»`, clamp según máximo mostrado y viewport real del hijo virtualizado. `h/l` y flechas funcionan desde encabezado/hunk/código del archivo expandido. Colapso conserva posición; resize la acota; métricas lazy invalidadas en rebuild. No cambios a snapshots/diffs/selección/formato/foco nativo.
- `tests/diff-horizontal.test.ts`: ocho tests totales (seis nuevos desde fase 1), con independencia/colapso/iteración, límites y resize, Off, Unicode/tabs/cortas/vacías, selección y anexado con pan, recorte de glifos y fixture A/B. Test TUI real existente en `tests/diff-panel.test.ts` ampliado para pan desde header/layout hijo, resize y transcript intacto.
- `tests/fixtures/indentation-lab.ts`: extensión experimental `/lab-diff a|b|close`, usa renderer actualizado; B reduce sólo visualmente espacios comunes por hunk y serializa el original al anexar. Datos sintéticos TS/Python/YAML con vacíos y hunks de distinta profundidad. No cargada por producto ni registrada en su runtime.
- `M4.1.md`, `design/ui-spec.md`: contrato vigente, medidas de columnas, límites, instrucciones reproducibles Kitty/Herdr y comparación humana A/B. Laboratorio previo `scripts/` preservado sin modificaciones ni staging.

**Pruebas ejecutadas — Linux, Node v26.12.0, Pi/TUI 1.4.0**
| Comando / caso | Resultado | Evidencia |
|---|---|---|
| `npm run check` tras pan inicial | PASS | tsc + 133/133, 0 fallos/skips, 7130 ms. |
| `npx --no-install tsx --test tests/diff-horizontal.test.ts` intermedio | PASS | 6/6; pruebas dirigidas pan/gutter/Unicode/contexto. |
| `npm run check` final código/fixture | PASS | tsc + 139/139, 0 fallos/skips/cancelados, 6051 ms. |
| `python3 tests/pty-smoke.py` | PASS | CLI instalado, /diff/F6, settings, borrador, reload, salida/reset mouse; PTY sintética, no prueba física Herdr. |
| LSP activo cuatro TS cambiados | PARCIAL | 3 clean confirmados, 1 inconcluso, cero errores recibidos; tsc es gate completo. |
| Arquitecto CLI delegado: plan y delta final | APROBADO sin regresiones nuevas | Sólo revisión estática suministrada, no ejecutó suite. Señaló tres riesgos preexistentes; follow-up contrastado contra padre excluye bloqueantes nuevos. |
| Kitty / Herdr físico / decisión A vs B / CI nativa nueva | NOT RUN | Requieren operador/runners; protocolos en M4.1.md, no se inventa aceptación. |

**Límites y decisiones**
- Pi 1.4.0 `TuiMouseEvent` sólo expone wheelDelta escalar; parseWheelEvent acepta direcciones SGR 0/1, no 2/3. Sin eje horizontal fiable: no soporte de touchpad horizontal, hacks Shift+wheel ni interceptación global/Kitty. Rueda vertical y captura/resize conservan routing anterior.
- Cinco columnas recuperadas con números hasta cuatro dígitos en modificados; `»` reserva una celda sólo con overflow derecho. Sin recorte de sangría en producto; B permanece experimental hasta validación visual humana. DoD físico de M4.1/global no certificado.
- Riesgos previos encontrados por revisión: selección numérica puede retargetear tras rebuild estructural, selección multi-hunk conserva último header, Shift+Down desde header puede estancarse en path. Cuerpos correspondientes sin cambios frente a padre; no se introducen ni se refactorizan aquí. Comparar hunks individualmente y seleccionar después de expandir; pendientes documentados en M4.1.md.
- Estado Git revisado antes del segundo commit; fase 1 en `a2bcc02 refactor(ui): compact diff line gutter`. Segundo commit por rutas explícitas `feat(ui): add per-file horizontal diff navigation`; no push, dependencias ni instalación/configuración modificadas.

**Próximo paso / parada**
- Operador valida producto y experimento A/B en Kitty/Herdr con M4.1.md; no decidir superioridad de B sin evidencia humana. No avanzar a M4.2.

### 2026-10-24 — M4.1c: compactación visual de sangría e integración A/B

**Cambió**
- `src/ui/diff-panel.ts`:
  - `computeHunkIndent`: calcula la sangría común mínima entre líneas no vacías de cada hunk (`spaces` o `tabs`). Ante ambigüedad (mezcla de tabs y espacios en prefijos o líneas dispares), retorna `undefined` conservando el formato original.
  - `compactLineText`: reduce la sangría común exclusivamente durante el renderizado visual (`safeText`). No altera `DiffRow`, ni snapshots, ni rangos old/new ni estadísticas. Preserva líneas vacías y no afecta diferencias relativas entre líneas.
  - Protección ante truncamiento (`isLastHunkCut`): si un hunk es cortado por el límite de filas (`MAX_FILE_ROWS`), no se compacta con datos parciales para evitar falsas asunciones de sangría común.
  - Modos A (original, default de producción) y B (sangría común compactada).
  - Tecla `c` en `DiffPanel`: alterna A/B en caliente, recalculando métricas de ancho y acotando el pan horizontal de inmediato.
  - `maxOffset` y `entryLine`: el desplazamiento horizontal (`h/l` o flechas) opera directamente sobre el texto ya compactado visualmente; `«`/`»` respetan los límites reales compactados.
  - `formatSelectedContext` y tecla `a`: el texto anexado al editor nativo utiliza intacto el contenido original de `DiffRow.text`, sin pérdida de sangría ni tabs originales.
- `src/index.ts`:
  - Slash command `/diff`: soporte de argumentos `/diff a` y `/diff b` para abrir directamente en el modo deseado o alternar en caliente si el dock ya está abierto.
  - Soporte de entorno `PI_DIFF_COMPACT=1` o `PI_DIFF_MODE=b` para arrancar en Modo B en entornos de prueba si se desea.
  - Sin nuevas preferencias permanentes en `/diff-settings` (producción permanece en Modo A por defecto).
- `tests/fixtures/compaction-fixtures.ts`:
  - Fixtures aislados con modificaciones reales (`M`), no sólo archivos agregados (`A`):
    - TypeScript con método anidado (12 espacios comunes) y función top-level (0 espacios).
    - Python con generador anidado (8 espacios comunes) y función módulo (0 espacios).
    - YAML con especificación de pods anidada (6 espacios comunes) y metadatos top-level (0 espacios).
    - Go con sangría por tabs (2 tabs comunes).
    - Casos de ambigüedad mixta tab/espacio.
    - Generador `createModifiedWorkspace()` para pruebas Git reales con commits base y modificaciones dirty.
- `tests/diff-compaction.test.ts`:
  - Suite de 11 tests automatizados que cubren: cálculo de sangría común, jerarquía relativa, espacios/tabs/líneas vacías, ambigüedades, renderizado A vs B, toggle en caliente con `c`, pan horizontal sobre texto compactado, selección por teclado/mouse, anexado intacto con sangría original, resize de 34 a 100 cols, corte por límite de filas, y comando `/diff a|b`.

**Pruebas ejecutadas — Linux, Node v26.12.0, Pi/TUI 1.4.0**
| Comando / caso | Resultado | Evidencia |
|---|---|---|
| `npm run check` | PASS | tsc sin errores + 150/150 tests pasan, 0 fallos/skips, 6.7s. |
| `python3 tests/pty-smoke.py` | PASS | PTY aislada: arranque Pi, apertura manual /diff y F6, borrador nativo, Esc/F6, reload, salida limpia y reset mouse. |
| Arquitecto CLI delegado (intercom) | REVISADO Y APROBADO | Identificó riesgo de truncamiento de hunk y sincronización de apertura del comando; ambos resueltos con regresiones dedicadas en suite. |
| Validación visual humana en Kitty/Herdr | PENDING / NOT RUN | Requiere operador humano para inspección visual de legibilidad A vs B. |

**Instrucciones para alternar A/B en Pi y Herdr**
1. En Pi normal o dentro de un pane de Herdr, abrir el diff: `/diff` (inicia en Modo A original) o `/diff b` (inicia directamente en Modo B compactado).
2. Con el foco en el panel de diff, presionar la tecla `c` para alternar instantáneamente entre Modo A y Modo B.
   - En Modo B, el footer indica `[B: compact]` y la ayuda `c: A/B`.
   - El scroll horizontal (`h`/`l`) se ajusta al texto compactado.
   - Al pulsar `a`, el texto copiado al editor contiene la sangría original intacta.
3. Para volver al Modo A en cualquier momento, presionar `c` nuevamente o ejecutar `/diff a`.

**Git / límites / siguiente paso**
- Archivos del commit delimitados por rutas explícitas: `src/index.ts`, `src/ui/diff-panel.ts`, `tests/diff-compaction.test.ts`, `tests/fixtures/compaction-fixtures.ts`, `PROGRESS.md`.
- No push, no dependencias agregadas, no modificación de `/diff-settings`.
- M4.2 permanece fuera de alcance hasta validación humana.

### 2026-10-24 — M4.1 / cierre tras validación visual en Herdr

**Decisión y cambio**
- El usuario informó que el dock al 60% mejora considerablemente la legibilidad
  en Herdr sin compactar la sangría: conservar A (original), retirar B.
  Es evidencia humana reportada, no prueba física repetida por este agente;
  sin captura, hora, dimensiones exactas ni terminal cliente aportados.
- `src/ui/diff-panel.ts` y `src/index.ts`: eliminados el cálculo de sangría por
  hunk, compactación visual, atajo `c`, `/diff a|b`, flags de entorno
  `PI_DIFF_COMPACT`/`PI_DIFF_MODE` e indicador B del footer. `/diff` alterna
  apertura/cierre sin modos experimentales; F6 y settings permanecen.
- Eliminados tests/fixtures exclusivos A/B (`tests/diff-compaction.test.ts`,
  `tests/fixtures/compaction-fixtures.ts`, `tests/fixtures/indentation-lab.ts`).
  `tests/diff-horizontal.test.ts` conserva y prueba gutter contextual, números
  On/Off, sangría original, pan por archivo, `«/»`, resize, mouse/teclado,
  anexado íntegro y footer definitivo; sólo se retiró el caso lab A/B.
- `M4.1.md`: decisión final y límites de la evidencia, sin borrar el protocolo
  y los resultados históricos del experimento.
- `scripts/lab-horizontal-diff.ts` fue inspeccionado: simulación A/B antigua
  independiente del producto y candidata a eliminar, pero **untracked y de
  procedencia desconocida**; preservada sin modificaciones ni staging.
  `m4-test/` untracked también intacto. Ningún archivo ajeno eliminado.

**Pruebas ejecutadas — 2026-10-24, Linux Arch, Node v26.12.0, Pi 1.4.0,
Herdr 0.9.5 instalado**
| Comando / caso | Resultado | Evidencia / límite |
|---|---|---|
| `npm run check` | PASS | tsc sin errores; 139/139 tests, 0 fallos/skips/cancelados, 6604 ms (gate final). Settings 30–60%, pan, selección, editor, CLI SDK y snapshots incluidos. |
| `python3 tests/pty-smoke.py` | PASS | Pi real en PTY sintética aislada, `/diff`, F6, settings, borrador, reload, salida y reset mouse. No equivale a Herdr físico. |
| `git diff --check`, status y cached | PASS inspección | Índice vacío inicialmente; sólo rutas tracked propias editadas/borradas; `scripts/` y `m4-test/` preservados sin seguimiento. |
| Revisión arquitecto read-only | APROBADO condicionado a bitácora, satisfecha | Sin bloqueantes técnicos; solicitó registrar cierre en esta entrada y excluir untracked del commit. No ejecutó pruebas físicas. |
| Nueva prueba física Kitty/Herdr por agente; CI macOS/Windows | NOT RUN | Evidencia visual limitada al informe humano Herdr de esta petición; CI anterior M1 no certifica UI nueva. |

**Estado y parada**
- **M4.1 cerrado** para la decisión y controles de este bloque, sin afirmar
  completado M4 global ni DoD total del producto. M4.2 NOT STARTED.
- Riesgos vigentes: matriz física completa y CI de UI nativa no repetidas;
  límites de protocolo touchpad y casos pendientes ya documentados en M4.1.md.
- Commit local Conventional Commits sólo de rutas tracked propias tras revisión
  final de diff/staging y gate; no push.

### 2026-10-24 — M4.2 / auditoría local y selección tras rebuild

**Estado: PARCIAL.** Matriz, defectos, límites y protocolo humano en `M4.2.md`.
No se declara compatibilidad física Herdr ni M4.2 certificado.

**Cambió**
- `src/ui/diff-panel.ts`: reubica selección por identidad de fila tras rebuild;
  descarta selecciones cuyo extremo desapareció o cuyo contenido cambió con la
  misma key. Sin rediseño ni modificaciones al motor de captura/editor.
- `tests/diff-horizontal.test.ts`: dos regresiones de selección/contexto.
- `M4.2.md`: matriz PASS/NOT RUN, escenario físico reproducible y riesgos.

**Evidencia — Arch Linux, Node v26.12.0, Pi 1.4.0, Herdr 0.9.5 instalado,
2026-10-24; bash NO_TTY**
| Comando / caso | Resultado | Evidencia / límite |
|---|---|---|
| Test dirigido antes del fix | FAIL esperado | Colapsar a.ts tras seleccionar b.ts devolvía undefined en lugar de fragmento b.ts; fixture corregido para colapsar mediante mouse sin limpiar selección por navegación. |
| Test dirigido después | PASS | `npx --no-install tsx --test --test-name-pattern='collapsing a preceding' tests/diff-horizontal.test.ts`: 1/1. |
| `npm run check` | PASS | tsc + 141/141 tests, 0 fail/skip/cancel, 6869 ms. |
| `python3 tests/pty-smoke.py` | PASS PTY | Pi CLI aislado, `/diff`, F6, settings, borrador, reload y reset mouse; no modelo ni mouse Herdr físico. |
| `git diff --check`, status/diff/cached | PASS inspección | Índice inicialmente vacío; sólo fuentes/test propios y documentación nueva; `scripts/`, `m4-test/` untracked excluidos. |
| Revisión de arquitectura read-only (peer intercom) | APROBADO a nivel código | Sin bloqueantes en selección; no ejecutó validación física. |
| Pi/Herdr físicos y CI sobre SHA actual (3 SO) | NOT RUN | Sin TTY humano ni ejecución del workflow para este diff. Run 40018853023 M1 y 40109386562 (`3c268e4`) son anteriores. |

**Fallos, límites y siguiente paso**
- Primera versión del test limpiaba selección con `[` antes de colapsar: FAIL
  140/141 no atribuible al producto. Se reprodujo de nuevo con click de mouse
  y código de producción anterior: FAIL dirigido; fix mínimo PASS.
- Sin garantías nuevas de autoría, atomicidad, cursor/undo, drag literal,
  multi-hunk o compatibilidad física. No incluir ni borrar laboratorios untracked.
- Próximo paso dentro de M4.2: operador ejecuta protocolo físico de `M4.2.md`
  en Pi standalone/Herdr y registra casos; CI nativa de este commit requiere
  ejecución externa autorizada. No iniciar M4.3/M5.

### 2026-10-24 — M4.2 / corrección del foco al abrir `/diff`

**Cambió**
- `src/index.ts`: `/diff` cerrado monta y enfoca mediante el mismo `focusPanel()`
  de F6, después de completar el montaje; `/diff` abierto sigue cerrando. La
  apertura automática conserva el editor enfocado. Adaptador y layout intactos.
- `tests/diff-auto-open.test.ts`: apertura manual y navegación inmediata con Enter,
  F6 abrir/reenfocar, cierre, Esc, auto-open sin foco y borrador sin escrituras.
  `tests/pty-smoke.py`: Esc explícito tras `/diff` para volver al editor antes de
  enviar otro comando y antes del cierre nativo.

**Pruebas — 2026-10-24, Arch Linux, Node v26.12.0, Pi 1.4.0, Herdr 0.9.5 instalado; NO_TTY**
| Comando / caso | Resultado | Evidencia / límite |
|---|---|---|
| `npx --no-install tsx --test tests/diff-auto-open.test.ts` | PASS | 10/10; foco manual/F6, navegación por Enter y auto-open distinguidos. |
| `npm run check` | PASS | tsc + 141/141, 0 fallos/skips/cancelados. |
| Primer `python3 tests/pty-smoke.py` | FAIL esperado tras cambio de foco | `/diff-settings` se escribió mientras el panel retenía foco; smoke actualizado para Esc. |
| Segundo `python3 tests/pty-smoke.py` | FAIL | Tras `/reload`, `/diff` enfocado interceptaba Ctrl+C/D; se añadió Esc antes de salida. |
| `python3 tests/pty-smoke.py` final | PASS | Pi CLI real en PTY aislada, /diff, F6, settings, borrador, reload, salida 0 y reset mouse. Sin mouse Herdr físico. |
| LSP activo en dos TS | PARCIAL | 1 clean, 2 warnings auxiliares preexistentes no-flag-argument en index; tsc PASS. |
| Foco/navegación físicos Pi y Herdr | NOT RUN | Sin TTY humano; reporte previo detectó fallo antes del fix, no confirma este cambio. |

**Límites / próximo paso**
- No se tocaron snapshots, navegación/selección, settings, layout ni instalación.
  Tests existentes cubren `a` y clic al pane nativo, pero no se repitió interacción
  física. PTY sintética y test TUI no sustituyen aprobación física en Herdr.
- Untracked preexistentes `fake-*`, `m4-test/`, `scripts/` excluidos del commit.
  Próximo paso: operador verifica `/diff` y foco en Herdr/Pi reales siguiendo
  M4.2; M4.3 no iniciado. Sin push.

### 2026-10-24 — M4.2 / cierre documental y gate CI del SHA vigente

**Cambió**
- `M4.2.md` y esta bitácora: se registra el informe físico del operador en Herdr (selección, anexado entre archivos/hunks, resize, settings, foco y cambios de sesión: **PASS reportado**). Sin metadatos de terminal/dimensiones/hora/capturas ni desglose para afirmar pruebas adicionales; no se repitió físicamente aquí el foco manual *tras* la corrección.
- Corrección ya presente en `1c1fc67` confirmada por lectura de `src/index.ts` y `tests/diff-auto-open.test.ts`: `/diff` manual enfoca el panel al montar, F6 abre o reenfoca, auto-open sólo tras settled individual válido conserva foco en editor. PTY comprueba apertura/cierre y Esc, no auto-open físico. Sin cambios de código ni workflow en este cierre.

**Pruebas ejecutadas — 2026-10-24, Arch Linux, Node v26.12.0, Pi 1.4.0, Herdr 0.9.5 instalado**
| Comando / caso | Resultado | Evidencia / límite |
|---|---|---|
| `npm run check` | PASS | tsc y 141/141 tests, 0 fail/skip/cancel; primera suite 6182.81234 ms, gate tras documentación 6669.221508 ms; incluye regresión foco manual/F6/auto-open y motor de snapshots. |
| `python3 tests/pty-smoke.py` | PASS | Pi real en PTY aislada, `/diff`, F6, Esc, settings, draft, reload, salida y reset mouse; sin Herdr/mouse físico. |
| Informe del usuario: selección, anexado entre archivos/hunks, resize, settings, foco y cambios de sesión en Herdr | PASS reportado | Operador humano; no ejecución de este agente. No se informa repetición específica del gesto `/diff` enfocado tras el commit del fix. |
| `/diff` manual tras fix y auto-open sin robo de foco en Herdr físico; Pi standalone físico nuevo | NOT RUN verificable | Requiere confirmación del operador con versión de terminal/acciones y fecha. |
| `.github/workflows/portability.yml` | PASS inspección | Matriz ubuntu/macos/windows-latest, Node 26, `npm ci`, `npm run check` (typecheck + suite completa) y checkout intacto. |
| `gh run list --commit 1c1fc67d08371df7e820005fb539e74aca46d373` | PASS consulta / CI NOT RUN | `[]`; remoto main = `3c268e4ce093fec6322f67661d08390be61e732b`. Run 40109386562 SUCCESS en tres SO, pero SHA **anterior** 3c268e4; run 40018853023 es 116b6a8. |
| CI del SHA 1c1fc67: ubuntu-latest / macos-latest / windows-latest | NOT RUN / BLOCKED para certificación | Seis commits locales sin publicar; push no autorizado. Un commit documental posterior también necesitará CI en su SHA final. |
| `git status`, `git diff`, `git diff --cached` iniciales | PASS inspección | Sin cambios tracked/staged; untracked `fake-*`, `m4-test/`, `scripts/` ajenos preservados y excluidos. |

**Riesgos / siguiente paso**
- No equivaler PASS humano reportado al ensayo del fix posterior, ni runners de M1/`3c268e4` a CI actual. Drag literal FR-16, multi-hunk/Shift+Down, cambios concurrentes ABA y dependencia de layout Pi 1.4.0 pendientes. Revisión read-only por peer: aconseja conservar esa distinción; no aporta test independiente.
- Para **comenzar M4.3**: confirmar manualmente en Herdr (y registrar Pi standalone si se busca su matriz) `/diff` enfocando tras fix, Esc y auto-open sin robo de foco; obtener autorización explícita para publicar y ejecutar CI sobre SHA final, registrar URL/run ID y resultados de cada SO. Para **cerrar M4.3** además se requieren sus casos de robustez pendientes y evidencia de sus propios cambios; no se infiere cierre por M4.2. No push ni M5.

### 2026-10-24 — M4.3 / certificación CI del SHA publicado

**Cambió**
- Rama `test/m4-certification` creada desde HEAD `ec0f71ff4f4008231044e47e16c2590742ad3c1b` (`docs: record M4.2 verification and CI blocker`) y publicada con un solo `git push -u origin test/m4-certification`. El workflow existente sólo dispara automáticamente al publicar en main; se lanzó por `workflow_dispatch --ref test/m4-certification`. Sin push a main, PR, releases, tags, cambios de código/workflow/dependencias ni configuración remota.
- `M4.2.md`, `M4.3.md`, `PROGRESS.md`: evidencia CI y reporte físico posterior al fix. Actualizaciones **locales posteriores al run**, no incluidas en el SHA certificado; sin commit nuevo ni push adicional. `scripts/`, `m4-test/` y otros untracked preservados.

**Pruebas verificadas — GitHub Actions [run 40148421103](https://github.com/agmonetti/pi-iteration-diff/actions/runs/40148421103), 2026-10-25 00:52:59 UTC**

| Job | SO/Node observado | Resultado | Skips / evidencia |
|---|---|---|---|
| `native (ubuntu-latest)` | linux x64, Node v26.12.1, WSL=false | PASS | 141/141, 0 fail/cancel/skip; checkout limpio; [job](https://github.com/agmonetti/pi-iteration-diff/actions/runs/40148421103/job/121034647921) |
| `native (macos-latest)` | darwin arm64, Node v26.12.1, WSL=false | PASS | 140/141, 0 fail/cancel, 1 skip procfs Linux-only; checkout limpio; [job](https://github.com/agmonetti/pi-iteration-diff/actions/runs/40148421103/job/121034647870) |
| `native (windows-latest)` | win32 x64, Node v26.12.1, WSL=false | PASS | 139/141, 0 fail/cancel, 2 skips procfs + M0 bash-abort PIDs POSIX; cancelación nativa PASS; checkout limpio; [job](https://github.com/agmonetti/pi-iteration-diff/actions/runs/40148421103/job/121034647642) |

- Run `completed/success`, `headSha` y checkout de cada job: `ec0f71ff4f4008231044e47e16c2590742ad3c1b`. `npm ci --ignore-scripts --no-audit --no-fund`, `npm run check` (tsc + suite completa) y verificación de árbol intacto PASS en cada SO. Skips idénticos a los históricos M1, sin nuevas omisiones injustificadas. Avisos de deprecación de acciones Node 20/Node APIs y futura migración de ubuntu-latest no causaron FAIL; detalle en `M4.3.md`.
- **Herdr físico, PASS reportado por el usuario tras el fix** (NO ejecutado por el agente): `/diff` manual enfoca explorador; `Esc` devuelve foco al editor; auto-open no roba foco. Sin captura, hora, terminal cliente ni dimensiones. No extender este PASS a Pi standalone ni a otros SO.
- Gate local tras documentos (2026-10-24 21:56 UTC−03, Arch Linux, Node v26.12.0): `npm run check` PASS (tsc + 141/141, 0 fail/cancel/skip, 6274 ms), `git diff --check` PASS. `git ls-remote --heads origin refs/heads/test/m4-certification` coincide con HEAD certificado; índice vacío. Estos documentos no forman parte del checkout remoto probado.
- Arquitecto peer read-only: aprueba el gate **CI CERTIFIED** para este SHA y exige separar ese dictamen del DoD global/manual; no ejecutó pruebas.

**Estado / riesgos / próximo paso**
- **M4.3 CI CERTIFIED para el SHA publicado (gate de tres runners cumplido); M4 global PARCIAL**, sin DoD global ni M5. Pi standalone físico nuevo, drag literal FR-16, detach/reattach, coexistencia de extensiones, selección multi-hunk/Shift+Down y riesgos de ABA/layout siguen abiertos. El workflow no ejecuta PTY humana.
- Documentos quedan locales sin commit/push adicional para no cambiar el SHA certificado ni violar el límite de publicación. Esperar autorización antes de cualquier nueva publicación; continuar la matriz manual pendiente dentro de M4.

### 2026-10-24 — M4.4 / ancho global de Diff

**Cambió**
- `src/ui/dock-width-store.ts`: archivo propio `<agent-dir>/iteration-diff.json` (Pi `getAgentDir()`), payload v1 de ancho y Remember, lectura estricta acotada y escritura atómica 0600 sólo tras cambio; otros settings siguen por rama.
- `src/index.ts`: restaura global en nueva sesión/rama/proceso, migra ancho válido de rama M3.5 sólo si falta archivo; On persiste teclado, fin de drag y ajustes; Off conserva último ancho almacenado y vuelve a 45% en nuevas aperturas. Errores muestran aviso y no bloquean el dock.
- `src/ui/diff-settings.ts`, `tests/diff-auto-open.test.ts`, `M3.5.md`, `RESEARCH.md`: ayuda, regresiones y ubicación/límites documentados. Documentos locales M4.3 preservados.

**Pruebas ejecutadas — Arch Linux, Node v26.12.0, Pi 1.4.0, Herdr 0.9.5 instalado**
| Comando / caso | Resultado | Evidencia / límite |
|---|---|---|
| `npm run check` final | PASS | tsc + 144/144, 0 fallos/skips/cancelados (6938 ms), incluye subproceso Node nuevo para recarga global. |
| Test dirigido intermedio tras precisar semántica Off | FAIL 1 caso | Expectativa histórica de rama requería ancho anterior; Off ahora vuelve a default según M4.4; aserción actualizada. |
| `npx --no-install tsx --test tests/diff-auto-open.test.ts` | PASS | 13/13; sesiones/proyectos simulados, migration, config inválida, drag sin escrituras intermedias. |
| `python3 tests/pty-smoke.py` final | PASS | Pi real en PTY aislada; comandos, reload, salida/reset mouse. Sin mouse Herdr físico. |
| Pi/Herdr físico y CI nativa del nuevo SHA | NOT RUN | Nueva certificación pendiente; test/m4-certification sigue en SHA M4.3. |

**Fallos / riesgos / siguiente paso**
- Pi 1.4.0 no expone configuración global arbitraria para extensiones; almacenamiento propio bajo directorio de agente, no `settings.json`. Sin watchers; procesos concurrentes: gana el último escritor. Layout terminal estrecho puede limitar ancho efectivo. Linux/Windows ACL y archivos protegidos/inaccesibles pueden impedir persistencia; el usuario recibe advertencia. Validación humana Herdr y runners nativos de este SHA pendientes.
- Revisión arquitecto read-only detectó escritura sincrónica por drag y falta de mkdir; corregidas antes del gate final. No prueba física.
- `M4.2.md`, `M4.3.md` y entradas previas de este archivo ya eran locales antes de M4.4: no se incluyen en el commit M4.4. No push, no M5. Próximo paso: certificar el nuevo SHA de manera independiente con autorización de publicación.

### 2026-10-24 — M4.4 / preparación de rama para certificación

**Cambió**
- El usuario confirmó físicamente la persistencia global del ancho en Herdr (reporte humano; no repetido por este agente). Se creó sólo la rama local `test/m4.4-certification-882ca81` desde `882ca81c1e4e1e03b3edd3bb009535583bd9544a`; `test/m4-certification` conserva `ec0f71ff4f4008231044e47e16c2590742ad3c1b`, también en `origin`. Ningún commit, push, código, dependencia ni workflow modificado. Esta entrada permanece como cambio local y NO integra el SHA a certificar.
- Cambios previos en `M4.2.md`, `PROGRESS.md`, `M4.3.md` y los untracked `fake-*`, `m4-test/`, `scripts/` preservados. Índice vacío antes y después del cambio de rama.

**Pruebas — Arch Linux, Node v26.12.0, npm 12.2.1, Git 2.56.0; 2026-10-24 22:17 UTC−03**
| Comando / caso | Resultado | Evidencia / límite |
|---|---|---|
| `npm run check` | PASS | tsc sin errores; 144/144 tests, 0 fail/skip/cancel (7197 ms), en checkout local del SHA con documentación y archivos untracked preexistentes. |
| `git status --short --branch`, `git diff`, `git diff --cached`, `git rev-parse` y `git ls-remote --heads origin` | PASS inspección | Nueva rama apunta a 882ca81; rama histórica local/remota en ec0f71f; no staging; dirty previo no incluido en SHA. |
| `.github/workflows/portability.yml` | PASS inspección | Matriz ubuntu/macos/windows-latest, `npm ci` y `npm run check`; sólo push a main, PR a main o `workflow_dispatch`. Publicar esta rama por sí solo no dispara la matriz. |
| GitHub Actions ubuntu-latest / macos-latest / windows-latest sobre `882ca81` | NOT RUN | Rama aún local, sin push ni URL/run ID/logs. No certificar hasta ejecución y auditoría de los tres jobs sobre este SHA. |
| PTY/Pi físico nuevo; Herdr físico por agente | NOT RUN | Informe humano de persistencia global en Herdr recibido, sin metadatos adicionales; no es evidencia CI. |

**Estado / siguiente paso**
- Rama lista localmente para solicitar autorización de publicación. Tras autorizar: publicar sólo esta rama, lanzar manualmente `portability.yml` con `workflow_dispatch` sobre ella y verificar `headSha`, plataforma nativa, suite y checkout limpio en cada job antes de declarar CI CERTIFIED. No publicar, commitear notas locales ni iniciar M5 por adelantado.
- Arquitecto peer read-only aprobó el cierre preparatorio; su respuesta mencionó erróneamente `ci.yml` y PTY PASS en este bloque: se contrastó con el workflow real `portability.yml` y no se atribuye ejecución PTY nueva.

### 2026-10-25 — M5 / empaquetado autónomo y distribución (v0.1.0 RC)

**Cambió**
- Rama `feat/m5-packaging-distribution` creada desde `882ca81`.
- `package.json`: versión `0.1.0`, keywords `["pi-package"]`, manifiesto oficial `"pi": { "extensions": ["./src/index.ts"] }`, `main: "src/index.ts"`, `peerDependencies` para `@earendil-works/pi-coding-agent` y `@earendil-works/pi-tui` con `*`, lista de empaquetado `files: ["src", "README.md", "LICENSE", "package.json"]`, `private: true` removido. Cero dependencias externas en runtime.
- `LICENSE`: licencia MIT creada.
- `README.md`: guía completa de instalación nativa (`pi install git:...`), local y por proyecto, tabla de comandos (`/diff`, `/diff-settings`, `F6`), atajos de navegación y staging (`a`), persistencia global, actualización/desinstalación, compatibilidad y limitaciones conocidas.
- `CHANGELOG.md`: registro bajo Keep a Changelog cubriendo M0 a M5 para la release candidate `v0.1.0`.
- `M5.md`: reporte técnico completo de empaquetado, instalación nativa, validación y release candidate.
- `tests/package-install.test.ts`: suite automatizada con 7 pruebas cubriendo manifiesto, `npm pack --dry-run`, instalación limpia aislada (`pi install`), preservación de `<agent-dir>/iteration-diff.json` en reinstalación/actualización, desinstalación segura (`pi remove`), tolerancia a fallos de configuración y soporte multi-proyecto.
- `tests/pty-smoke.py`: actualizado para instalar el paquete de forma nativa en un `PI_CODING_AGENT_DIR` aislado y validar arranque, `/diff`, `/diff-settings`, `F6`, borrador nativo y `/reload` en TUI fullscreen real **sin flag `-e` ni `--no-extensions`**.

**Pruebas ejecutadas — Arch Linux, Node v26.12.0, npm 12.2.1, Git 2.56.0; 2026-10-25**
| Comando / caso | Resultado | Evidencia / límite |
|---|---|---|
| `npm run check` | PASS | tsc sin errores; 151/151 tests, 0 fail/skip/cancel (~7.1s), incluye los 7 tests nuevos de packaging. |
| `python3 tests/pty-smoke.py` | PASS | Pi real en PTY fullscreen con instalación nativa previa; comandos `/diff` y `/diff-settings` descubiertos y funcionales sin `-e`. |
| `npm pack --dry-run` | PASS | Tarball verificado: 14 archivos esenciales (src + package.json + LICENSE + README.md); excluye tests, scripts y docs de progreso. |
| Persistencia y desinstalación | PASS | `<agent-dir>/iteration-diff.json` se preserva intacto tras updates y tras `pi remove`. Fallback seguro ante archivo corrupto o ausente. |
| CI GitHub Actions sobre SHA `a970227` | AUDITADO / PARCIAL | [Run 40154161932](https://github.com/agmonetti/pi-iteration-diff/actions/runs/40154161932): suite de producto (144 tests) PASS en los 3 SO; fallos aislados en aserciones de `tests/package-install.test.ts` (regex de nombre de directorio y spawn de npm en Windows). |
| Prueba física en Herdr | REPORTADA HISTÓRICA | Validada físicamente por usuario en M4.2/M4.4; M5 no altera la lógica interna de UI ni del dock adapter. |

**Estado / siguiente paso**
- **Rama publicada**: `feat/m5-packaging-distribution` con único push autorizado. SHA `a970227518053c5258f9afc4ab95812f8fc3018f`.
- **Causa raíz diagnosticada**: 100% de la lógica de negocio y del visor es portable y pasó en Linux, macOS y Windows; los fallos en CI corresponden a aserciones del nuevo archivo de test asumiendo nombre de directorio local (`/pi-diff/` vs `pi-iteration-diff`) y `npm` sin `.cmd` en Windows.
- Sin segundo push por restricción estricta de la consigna. Corrección delimitada y lista para solicitar autorización de segundo push para alcanzar CI CERTIFIED final.

### 2026-10-25 — M5 / regresiones de portabilidad del test de packaging

- `tests/package-install.test.ts`: `pi list` y settings comprueban la ruta fuente local derivada de `ROOT` (Pi no lista el nombre npm en instalaciones locales); `npm pack` usa `process.execPath` y `npm_execpath`, sin shell ni dependencia de `npm.cmd`. Ningún archivo de producción cambió. Commit único `39e9a73 test(packaging): use portable package source and npm CLI`; segundo push autorizado sólo a `feat/m5-packaging-distribution`.
- Arch Linux, Node v26.12.0: `npm run check` PASS 151/151 (tras una primera prueba FAIL 2/151 por asumir erróneamente que `pi list` presenta el nombre npm); `python3 tests/pty-smoke.py` PASS; `npm pack --dry-run --json` PASS, 14 archivos, sin tests/scripts; `git diff --cached --check` PASS. `git diff --check` global detecta líneas en blanco al final de M5.md y PROGRESS.md previas, no incluidas en el commit.
- [Run 40154609190](https://github.com/agmonetti/pi-iteration-diff/actions/runs/40154609190) `workflow_dispatch` sobre SHA completo `39e9a733cd47409de490ac3a547a2d4a8d110c64`: SUCCESS, checkout intacto en los tres jobs. Ubuntu linux Node v26.12.1: 151/151, 0 skips; macOS darwin arm64 Node v26.12.1: 150/151, 1 skip procfs; Windows win32 Node v26.12.1, WSL=false: 149/151, 2 skips procfs/PIDs POSIX. Cero fallos en los tres.
- Esta anotación y cambios locales previos en M4.2.md, M5.md, PROGRESS.md y archivos untracked permanecen **fuera del SHA certificado**; no hacer otro commit/push por esta documentación. Sin pruebas físicas nuevas ni release/tag. Gate CI de M5 PASS, DoD global/manual sin declarar completo.
