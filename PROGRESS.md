# PROGRESS.md — Bitácora viva del proyecto

**Proyecto:** `pi-iteration-diff`  
**Última actualización:** 2026-10-22  
**Estado general:** `M0 CERRADO — GATE DE FACTIBILIDAD PASS`
**Milestone activo:** M1 autorizado — implementación incremental; UI congelada
**Versión del producto:** 0.0.0 privada; prototipo sintético, no producto.

## 1. Resumen del estado

- **Completado en este bloque:** investigación local de APIs; scaffold mínimo; dock sintético manual `/m0-diff`, selección teclado/mouse normalizado, append al editor y cleanup.
- **Tests ejecutados:** `npm run check` PASS (14 tests: 6 UI + 5 stream SDK + 3 HTTP SDK). Sin PTY nueva; pruebas humanas recibidas por informe del operador, no simuladas.
- **Validado por humano:** dock, mouse/rangos, foco funcional/visual y anexado sin autosend en Pi directo y Herdr; H7 sidebar/split/zoom y H8 resize/reload/new/resume confirmados PASS por el operador.
- **Corregido y revalidado:** indicador visual accent del tema, sin modificar editor; test y confirmación humana PASS.
- **Lifecycle extendido:** HTTP loopback 429→200, aborto bash real y restore persistente SDK PASS. Contrato de iteración documentado, sin confundir colas agrupadas con petición individual.
- **Decisión final aprobada:** ADR-003; usuario acepta provisionalmente indisponibilidad individual de ventanas agrupadas y diff conjunto diferenciado de Last iteration. Sin garantía de atribución. Drag literal DEFERRED a M3 sin eliminar FR-16.
- **Cierre definitivo:** matriz final y acta en `M0.md`; no más investigación M0 ni ampliación de infraestructura. M1 no autorizado.

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
| M1 Snapshots | **IN PROGRESS** | Contratos y comparación neta probados; captura y lifecycle pendientes |
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




