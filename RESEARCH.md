# RESEARCH.md — Investigación técnica y referencias

**Proyecto provisional:** `pi-iteration-diff`  
**Fecha de investigación:** 2026-10-22  
**Estado inicial:** investigación documental. **Estado vigente:** M0 cerrado; M1 autorizado e implementado con gate automatizado PASS. ADR-003 vigente, UI congelada y M2 no iniciado. Acta M0 y decisiones M1 al final.
**Objetivo:** panel de diffs a la derecha de la conversación de Pi, invocado manualmente, con selección de líneas/rangos y envío al editor nativo de Pi; compatible con Pi ejecutado dentro de Herdr.

> Esta investigación es contexto para decisiones, **no prueba de compatibilidad** con las versiones instaladas del usuario. Contrastar APIs, versiones y código fuente antes de implementar. Separa observaciones verificadas de hipótesis.

## 1. Fuentes principales (orden de consulta)

1. **Pi — Extensiones y ciclo de vida:** https://pi.dev/docs/latest/extensions
2. **Pi — TUI, componentes y mouse:** https://pi.dev/docs/latest/tui
3. **Claude Code — `/diff` / panel:** https://code.claude.com/docs/en/interactive-mode#review-changes-with-diff
4. **pi-split-view:** https://github.com/Hugo-W/pi-split-view
   - Layout manager: https://github.com/Hugo-W/pi-split-view/blob/main/layout-manager.ts
   - Extensión: https://github.com/Hugo-W/pi-split-view/blob/main/split-view.ts
5. **pi-slopchop:** https://github.com/robzolkos/pi-slopchop
6. **Herdr — Integraciones:** https://herdr.dev/docs/integrations/
7. **Herdr — Plugins:** https://herdr.dev/docs/plugins/
8. **Herdr — Configuración:** https://herdr.dev/docs/configuration/
9. **Herdr — Agentes:** https://herdr.dev/docs/agents/

Las referencias están fechadas; las interfaces pueden cambiar. Guardar las versiones/commits consultados durante M0.

## 2. Benchmark: `/diff` de Claude Code

**Confirmado por documentación oficial (2026-10-22):**

- En fullscreen, `/diff` abre un panel junto a la conversación; en renderer clásico se usa un diálogo.
- El panel lista archivos y conteos de líneas, permite navegar y ver el diff de cada archivo.
- Hay selector `source`: `Current` (árbol de trabajo) y `T1`, `T2`, etc. (vistas de cambios por petición).
- El botón `ask` adjunta el diff de un archivo al próximo prompt.
- El panel puede mantenerse abierto y refrescar al editar o ejecutar comandos.
- `cc-plugin-diff` es la implementación integrada documentada; el panel fullscreen requiere Git, terminal suficientemente ancho y versión compatible.
- **Importante:** la documentación dice que el panel de Claude *puede abrirse automáticamente*. Nuestro proyecto NO debe copiar este comportamiento: apertura exclusivamente manual.
- **Importante:** los `T1/T2` de Claude se derivan de las herramientas de edición; cambios vía shell pueden aparecer solo en `Current`. Nuestro objetivo es capturar los cambios netos de la iteración incluso si proceden de comandos de shell.
- **No verificado:** drag-and-drop literal de un fragmento desde el diff hasta el editor. La documentación oficial describe `ask` por archivo; no atribuirle selección de rango o arrastre como hecho confirmado.

**Lo que tomamos:** conversación visible, panel persistente, fuentes seleccionables, navegación, acción para adjuntar al prompt. **Lo que mejoramos:** selección por rango, múltiples selecciones, diffs por petición independientes de Git HEAD, apertura manual.

## 3. `pi-split-view`: referencia de composición TUI

**Repositorio:** https://github.com/Hugo-W/pi-split-view

**Observaciones verificadas:**

- Expone `/files` para mostrar/ocultar un dock a la derecha en Pi fullscreen, y una alternativa overlay en modo regular.
- Su panel muestra archivos y un preview de ediciones recientes; no es un historial completo de cambios por petición.
- Usa componentes de `@earendil-works/pi-tui` y conserva la TUI original de Pi como parte de la composición.
- `layout-manager.ts` lee `tui.layoutRoot`, invoca `tui.setLayoutRoot(...)` y reconstruye capas sobre un root base. Tras `/reload` busca restaurar composiciones antiguas; usa repintado completo para evitar artefactos.
- El README advierte incompatibilidad con otras extensiones que controlan por separado el root fullscreen; **un solo propietario del root es una restricción de diseño**.
- Maneja resize de paneles y considera anchura visible real, Unicode y ciclos de vida.

**Consecuencia:** proporciona prueba documental de que un split lateral es viable, pero la composición sobre `layoutRoot` es una dependencia interna/frágil y merece un *spike* de compatibilidad. No copiar código por completo; extraer conceptos y respetar licencia MIT si se incorpora código.

**Preguntas que debe resolver M0:**

- ¿Existe una API pública de Pi actual que permita la composición lateral, sin manipular el root?
- ¿Qué pasa si `pi-split-view` y nuestra extensión se cargan juntas? ¿Hay una vía soportada de compartir el layout manager? Si no, detectar conflicto y degradar con claridad, sin pisar capas.
- ¿Se preservan editor, focus, shortcuts, temas, scroll y vista tras `/reload`, cierre de sesión y resize?

## 4. `pi-slopchop`: referencia de diff y feedback

**Repositorio:** https://github.com/robzolkos/pi-slopchop

**Confirmado por README:**

- Expone `/slopchop` y `/diff`, un flujo de revisión manual dentro de Pi.
- Tiene scopes `git diff`, `last commit` y `all files`; **no define un snapshot completo antes/después de cada petición del usuario como fuente predeterminada**.
- Navegación entre archivos/hunks, vista unificada y lado a lado.
- Anotaciones en líneas agregadas y eliminadas, rangos multilínea en un lado del diff, comentarios por archivo y globales.
- Dos intenciones de feedback: `FIX` (cambiar) y `DISCUSS` (explicar/debatir).
- Genera un prompt en el editor y **no lo envía automáticamente**.

**Cómo aprovecharlo:** estudiar su parser/modelo estructurado, identificación de lado y número de línea, selección, anotaciones y serialización de feedback. Evitar copiar su UX de pantalla de revisión sobre la conversación: el requisito es un **panel lateral**.

**Por verificar en código antes de adoptar:** dependencia exacta del motor de diff, comportamiento de mouse, manejo de borradores previos y semántica exacta de la API de editor. No asumir que conserva texto existente. No copiar implementaciones de terceros sin revisar licencia, atribución y versiones.

## 5. Pi: lifecycle e integración con el editor

**Documentación oficial:** https://pi.dev/docs/latest/extensions

- Las extensiones son módulos TypeScript cargados en el proceso de Pi y pueden registrar slash commands y eventos.
- `turn_end` corresponde a un **turno del modelo**, no necesariamente a una petición del usuario.
- `agent_end` puede anteceder recuperación, retry o trabajo encolado; **no tomarlo como final definitivo**.
- `agent_settled` ocurre cuando se agota la continuación automática; es referencia útil para fijar una captura final.
- `input`, `before_agent_start`, `session_start`, `session_shutdown`, etc. permiten modelar el ciclo de captura, pero se deben estudiar sus payloads exactos.
- Una petición del usuario puede generar varios turnos del modelo y varias ejecuciones de herramientas.

**Decisión propuesta (a validar):**

1. Capturar un baseline **antes** de cualquier herramienta o efecto colateral de la petición.
2. Mantener la unidad lógica de **iteración = petición del usuario y su trabajo asociado**; separar otra petición explícita o registrar la ambigüedad si el runtime agrupa colas/continuaciones.
3. Capturar después de `agent_settled`, con manejo de cancelaciones, crashes, llamadas concurrentes y cambios de sesión.
4. Calcular un diff neto `after - before` sobre contenido de archivos. Eventos de herramientas solo como señales auxiliares, nunca fuente única.

**Punto abierto:** determinar si `before_agent_start` asegura el baseline antes de absolutamente todos los cambios de un run en versiones recientes, cómo se resuelven mensajes encolados y cómo se preservan snapshots al recargar la extensión. Documentar evidencia en M0.

## 6. Pi TUI: eventos de mouse y modo de renderizado

**Documentación oficial:** https://pi.dev/docs/latest/tui

- `@earendil-works/pi-tui` tiene composición (`HStack`, `VStack`, `ScrollView`, etc.), manejo de focus, componentes y utilidades para anchura visible de terminal.
- En **fullscreen** se entregan eventos normalizados de mouse y puede capturarse una secuencia de arrastre.
- En **regular mode**, el mouse queda en manos del terminal y su scrollback; toda operación tiene que contar con alternativa por teclado.
- `ctx.ui.custom()` sirve para una pantalla/overlay temporal; no equivale al split persistente al costado del editor.
- No reconstruir el editor de Pi ni crear otro renderer terminal.

**Riesgo:** capturar un arrastre dentro del diff no es lo mismo que poder transportarlo al editor en otra región. Requiere prototipo con terminador de arrastre, coordenadas, focus y manejo de copia/selección por el multiplexer.

## 7. Herdr: cómo encaja realmente

**Confirmado por documentación oficial:**

- Herdr administra workspaces, tabs, panes, terminales y estado/sesión de agentes. Pi sigue siendo el proceso propietario de su conversación y editor.
- `herdr integration install pi` instala `herdr-agent-state.ts` en el directorio de extensiones de Pi (respeta `PI_CODING_AGENT_DIR`).
- Esa integración informa estado y datos para restauración de sesión; **no reemplazar, modificar ni duplicar** ese puente.
- Su API de plugins ofrece comandos, eventos y panes terminales; la documentación de plugins indica que no hay una UI nativa arbitraria de plugin v1.
- Herdr modifica el ancho efectivo de una app al reservar sidebar y al dividir panes. Al enfocar, maximizar, adjuntar clientes o reconectar pueden cambiar dimensiones.

**Decisión recomendada:** extensión instalada en Pi, funcionando igual en terminal normal y dentro de Herdr. Herdr es plataforma anfitriona y capa opcional de integración; no crear un proceso/plugin Herdr independiente como requisito para MVP.

**Validación obligatoria en Herdr:**

- Mouse down/drag/up dentro del diff vs. selección de texto de Herdr.
- Focus entre panel y editor; scroll de cada región.
- Pane resize, pane zoom, split adicional, sidebar, detach/reattach, restore.
- Convivencia con la integración oficial `herdr-agent-state.ts`.
- Si se agrega estado «review ready» al sidebar: hacerlo solo en milestone separado y sin reemplazar `idle/working/blocked`.

## 8. Snapshot vs. Git diff

Ejemplo de fallo clásico:

- Antes de la petición: `config.ts` tiene cambios no commiteados del usuario.
- Petición A: Pi modifica `auth.ts`.
- Petición B: Pi modifica `users.ts`.
- Resultado deseado para `/diff` después de B: **solo delta de B**, independientemente de los cambios previos.
- `git diff HEAD` mezcla esos cambios y **no satisface** el requerimiento.

**Modelo recomendado:** un baseline por iteración y un estado final; comparación neta de archivos elegibles. Presentar el resultado como «cambios observados en este período», **no atribución forense inequívoca a Pi**: otros procesos pueden escribir simultáneamente.

**Problemas a resolver antes de fijar backend:**

- Enumeración y exclusiones (`.gitignore`, glob configurable, archivos ocultos, untracked, archivos fuera del repo).
- Escritura atómica, archivos nuevos/borrados, renames, binarios, permisos, symlinks y archivos enormes.
- Directorios gigantes; captura incremental/observación de escritura vs. snapshot total. Evitar escanear el repo completo indiscriminadamente en cada turno.
- Filtrado de secretos y artefactos generados; límites de memoria/IO; limpieza y datos sensibles.
- Submódulos y Git worktrees; cambios de cwd/repo a mitad del proceso.
- Sesiones simultáneas en distintos worktrees y cambios concurrentes.
- Persistencia tras `/reload` y restauración: objetivo de fases posteriores, sin fuga de datos por defecto.

**No preferir `git add`, `git stash`, `git commit` ni manipulación del índice real.** Un índice temporal es una alternativa investigable, pero debe explicitar si crea objetos en `.git/objects`. Para MVP evaluar snapshots efímeros fuera del repositorio y limitar el alcance.

## 9. ADR provisionales

- **ADR-001 — Runtime:** TypeScript como extensión de Pi; sin Electron/WebView ni proceso residente nuevo. Provisional.
- **ADR-002 — UI:** side dock dentro de Pi fullscreen. Fallback sin mouse en regular mode. Condicionado a spike de layout.
- **ADR-003 — Fuente:** «last completed user iteration» por defecto; Git Current secundario y opt-in para comparaciones. Condicionado a prueba de captura.
- **ADR-004 — Editor:** staging de feedback y aplicación explícita al editor sin sobrescribir borradores; nunca autoenviar.
- **ADR-005 — Herdr:** no es dependencia dura. Compatibilidad y pruebas end-to-end prioritarias.
- **ADR-006 — Control del layout:** si hay otra extensión con ownership incompatible, no forzar el root; informar conflicto y usar fallback si existe.

## 10. Riesgos y preguntas abiertas priorizadas

| Prioridad | Pregunta | Cómo resolverla |
|---|---|---|
| P0 | ¿Se puede insertar un dock sin romper el editor ni otras extensiones? | Spike fullscreen en Pi real; `/reload`, resize y cleanup |
| P0 | ¿Arrastre de línea/rango funciona dentro de Herdr? | Matriz de prueba mouse + teclado con Pi/Herdr instalados |
| P0 | ¿Cuál es el hook correcto para baseline/final? | Test de eventos con un prompt que hace `write`, `edit`, `bash` y varias vueltas |
| P0 | ¿Cómo anexar fragmentos sin perder un borrador? | Test API editor y focus; no auto-send |
| P1 | ¿Escalar snapshots sin escanear millones de archivos? | Benchmarks con repositorio grande + estrategia incremental |
| P1 | ¿Convive con `pi-split-view`/`pi-slopchop`? | Probar colisión de `/diff` y layout en instancia aislada |
| P1 | ¿Cómo expresar diffs de binarios/renames? | Fixtures y mensajes adecuados |
| P2 | ¿Persistir estado entre `/reload` y sesiones? | Diseño de almacenamiento seguro, opt-in y limitado |

## 11. Lo que NO se ha demostrado

- No se ha probado ninguna extensión en la instalación local del usuario.
- No se han validado versiones de Pi, Herdr, su terminal ni sus extensiones instaladas.
- No está garantizado que el drag-and-drop literal desde el diff hasta el editor sea realizable bajo todos los multiplexores.
- No existe aún un algoritmo implementado de snapshots, ni benchmark de performance.

La siguiente acción original era **M0 — feasibility spikes**. Sigue el registro local; las afirmaciones históricas anteriores no sustituyen estas pruebas.

## 12. M0 local — Pi 1.4.0 / Herdr 0.9.5 (2026-10-22)

### APIs verificadas en instalación y paquete npm

- Leídos completos README, `docs/extensions.md`, `docs/tui.md` de la instalación,
  ejemplo `widget-placement.ts`, declaraciones y cuerpos relevantes de runtime.
- `ExtensionUIContext` no ofrece un método de dock. Ofrece widgets arriba/abajo del
  editor, custom temporal y factories. Un widget vacío permite obtener el TUI sin
  reemplazar editor/header/footer; su `dispose` permite cleanup.
- **Corrección de hipótesis anterior:** `isViewportTUI` y `ViewportTUI.setLayoutRoot`
  están exportados/tipados públicamente. `layoutRoot` y `getFocusedComponent` no están
  en el contrato TUI público. Sólo esos accesos internos viven en el adaptador.
- Pi ya instala un root nativo desde `createChatViewport`. No se puede asumir
  `layoutRoot === undefined`, ni reconstruir el chat con `tui.children` y conservar
  automáticamente el scroll/editor. El spike envuelve el root original intacto.
- HStack/VStack/ScrollView manejan layout y coordenadas. Captura de mouse retorna
  eventos drag/release al componente original, con coordenadas locales fuera de sus
  límites. Prueba SGR automatizada confirma release cruzado; NO demuestra mouse físico
  ni hit-testing/drop sobre el editor.
- `getEditorText`/`setEditorText` permiten read+append síncrono sin autosend. Se probó
  contenido literal y dos anexados en suite; CLI PTY confirma llegada al editor nativo.
  No se afirma preservar cursor/undo.

### Lifecycle: hallazgos y límite

`dist/core/agent-session.js:_prepareRun` ejecuta chequeo de compaction **antes** de
`emitBeforeAgentStart`. Este último precede el modelo/herramientas del run, no todos
los posibles efectos de otros handlers/extensiones. `_handlePostAgentRun` puede
continuar por colas/retry; `_runBeforeSettleBoundary` puede solicitar continuación.
`_emitAgentSettled` es el cierre automático, no `turn_end` ni `agent_end`.

El probe `/m0-events` registra sólo nombres/fuentes/tipo de mensaje/nombres de herramienta
(aborted al settled), en memoria, máximo 100. Aún no hay traza de un run real con
write/edit/bash, colas, retry y cancelación. No se confirma todavía el contrato de
iteración: especialmente steering/follow-up y handlers anteriores con efectos.

### Herdr y decisiones

`herdr --version` = 0.9.5; integración Pi oficial v9 figura `current`. Leído completo
`herdr-agent-state.ts`: observa sesiones/agent_start/agent_settled y `herdr:blocked`;
no controla layout ni mouse. Nuestro spike no publica estados Herdr ni modifica ese
archivo. Esto es revisión estática, **no** una matriz e2e aprobada.

ADR-001 confirmado para este spike (extensión TypeScript). ADR-002/006 tienen evidencia
parcial automatizada: dock manual, rechazo de root ajeno y restore condicional; falta
matriz humana. ADR-003 sigue condicionado al lifecycle. ADR-004 confirmado sólo para
anexado sintético explícito; selección real old/new pendiente M3. ADR-005 se mantiene,
pero compatibilidad Herdr sigue sin certificar. No se adopta código de terceros.

El renderer `tui-alt-screen.js` npm e instalado coincide por SHA-256
`ea5f52dc983f60c4354c674bd19f0d296fda8b5fa86185d4a4bdf0343b1ff92b`;
también coinciden `tui.js`, `h-stack.js`, `stack.js`, `interactive-mode.js` y
`chat-viewport.js`. Versiones, resultados, bloqueos y próximo gate en `PROGRESS.md`;
pasos reproducibles en `M0.md`. M0 permanece abierto y no habilita M1.

### Continuación M0 (2026-10-22): límites de evidencia y protocolo

- Reconfirmados Pi 1.4.0, Node v26.12.0, npm 12.2.1, Herdr 0.9.5 e integración Pi
  v9 current. Bash devuelve `NO_TTY`; TERM/TERM_PROGRAM no prueban interacción física.
  No se manipuló el pane activo ni se instalaron integraciones.
- `npm run check` (5/5) y `python3 tests/pty-smoke.py` vuelven a pasar. Son evidencia
  automatizada del spike, NO trazas de modelo ni validación manual Herdr.
- `M0.md` ahora separa ocho casos humanos y seis casos de lifecycle, con entradas,
  entorno, resultado esperado y límites. Todos siguen pendientes, no aprobados.
- **Drag/drop:** el spike no implementa hit-testing ni transferencia al soltar sobre
  el editor. Un release fuera del panel no demuestra imposibilidad del terminal.
  Además el drag cambia el cursor según coordenada vertical local: no asumir que
  conserva el rango original al cruzar regiones. Alternativa `a` requiere verificar
  selección efectiva. FR-16 sigue abierto, sin excepción aprobada.
- **Lifecycle:** buffer de 100 nombres no distingue consumo de steering/follow-up,
  retry de proveedor ni correlación por sesión; se borra al iniciar/cerrar sesión.
  No basta para certificar el contrato. No afirmar que `input.source` distingue el
  tipo de cola. Para retry reproducible falta un proveedor local controlado (429→éxito);
  un fallo de herramienta o retry manual no son sustitutos. Para resume se requiere
  sesión persistente aislada, no el `--no-session` usado por la prueba UI.
- **Decisión:** ADR-002/003/005/006 no se elevan a compatibilidad confirmada. Mantener
  M0 abierto; ninguna implementación de snapshots/M1. Próximo trabajo: ejecución
  humana H1–H8 y fixture/trazas L1–L6, antes de fijar fronteras de iteración.

### Evidencia SDK adicional (2026-10-22)

`tests/lifecycle.test.ts` ejecutado contra AgentSession/Agent reales de Pi 1.4.0,
con `agent.streamFunction` público sustituido por stream local, sin red. Herramientas
write/edit/bash reales en mkdtemp privado: cuatro turn_end y un agent_settled.
Steering/follow-up encolados llegan a la segunda solicitud; ambos casos terminan
con un solo settled. Por ello una frontera settled puede agrupar varias entradas
explícitas: **no equivale necesariamente a una petición individual**. ADR-003 sigue
abierto; antes de M1 resolver separación o advertencia de captura agrupada, sin
atribuir snapshots individuales donde el runtime no expone una frontera aislada.

Retry normalizado `429 rate limit exceeded` produce agent_end, auto_retry_start,
nuevo agent_start, auto_retry_end y sólo después settled false. Abort de stream
produce settled true; nueva petición posterior settled false. Son aserciones de
runtime, no una lista de eventos fabricada ni test de transporte HTTP. Falta abort
de herramienta, retry HTTP y restauración persistente. Metadatos registrados sin
prompts/código; fixture elimina archivos y dispone sesión en finally.

Drag: la implementación actual no hace hit-testing/drop al editor. No hay evidencia
para declarar imposible o no confiable el protocolo de Pi/Herdr en general. La
captura cruzada y coordenadas locales son un riesgo concreto: arrastrar fuera puede
cambiar el rango. Mantener el arrastre literal como NOT IMPLEMENTED / validación
humana NOT RUN. Alternativa propuesta y ya presente en el spike: seleccionar dentro
del panel → `a` anexa al editor explícitamente, preservando borrador, sin envío.
No equivale a FR-16 ni constituye una excepción aprobada. Comandos humanos para Pi
y sesión Herdr nombrada, con integración oficial explícita, están en M0.md.

Resultado automatizado de esta continuación: `npm run check` PASS 10/10. Sin PTY
nueva, sin pruebas humanas; compatibilidad Herdr no certificada. M0 permanece abierto.

### Evidencia humana Pi + Herdr y foco (reporte recibido 2026-10-22)

El operador informa Arch Linux, Pi 1.4.0 y Herdr 0.9.5; probó Pi directo y un pane
real Herdr con el spike y la integración oficial cargados. H1/H2/H4/H6 PASS en ambos:
dock derecho, selección mouse, alternancia de foco y anexado explícito sin autosend
son viables en ese entorno. H3 funcional PASS pero indicador visual ausente (FAIL);
H8 PASS limitado a cierre/resize/restauración reportados. No hay certificación
individual de detach/reattach, zoom, split, reload o cambios/restauración de sesión.
La captura mencionada no fue adjuntada para inspección; fuente: informe humano.
Terminal cliente, dimensiones y hora de ejecución no informados (detalle en M0.md).

Se adopta la API pública Focusable (`focused`) para el indicador H3. TUI actualiza
esa propiedad tanto por teclado como por foco solicitado con mouse. Encabezado
existente en accent del tema activo sólo al enfocar, sin editor custom ni internals
nuevos. Test automatizado de transiciones pasa; contraste físico pendiente de repetir.
ADR-002/004/005 tienen ahora evidencia humana positiva **acotada al spike y acciones
reportadas**. No convertirla en aprobación global FR-12/14 ni compatibilidad universal.

Drag literal observado sin transferencia (copia al portapapeles en Pi): puede ser
selección nativa/semántica de captura, no evidencia de imposibilidad del protocolo.
El spike sólo registra release cruzado, no hit-test del editor ni payload de drop.
Por ahora FR-16 NOT IMPLEMENTED y sin excepción aprobada. La alternativa seleccionar
→ a queda validada por humano; evaluar captura/hit-test y conservación de rango
antes de decidir implementación literal, no extrapolar desde selección terminal.

### Pendientes técnicos M0: evidencia HTTP/abort/restore (2026-10-22)

`tests/lifecycle-http.test.ts` PASS 3/3; suite global PASS 14/14. Usa adaptador
openai-completions real y servidor loopback efímero, sin stream mock ni salida a
proveedores remotos. HTTP 429→200 con retry de proveedor deshabilitado provoca
retry de AgentSession y un solo settled final; hook before_agent_start sólo una
vez. Confirma mantener la ventana a través de agent_end y retry.

Abort de bash real con sleep: termina ambos procesos (no vivos: ausentes o zombie
en Linux), no ejecuta escritura posterior ni dispara otra solicitud antes de una
petición nueva. Settled true omite agent_before_settle: cleanup no puede depender
de ese hook. Reapertura de sesión persistente sintética privada conserva ID e
historial; nueva sesión no comparte ID ni mensajes. session_start se emite en las
tres instancias al bind de extensiones. Falta UI de /resume,/new,/reload y shutdown
con layout montado; reapertura SDK no demuestra recuperación visual del terminal.

**ADR-003 / contrato semántico establecido en M0:** petición aislada idle aceptada
más continuaciones automáticas; turn_end/agent_end/retry no son fin. Settled cierra
la ventana automática, aborted=true implica cancelada/parcial. Si entran mensajes
explícitos por colas, marcar la ventana agrupada/ambigua, nunca individual ni Last
iteration de una sola petición. Se rechaza atribución falsa: si no se demuestra una
frontera individual, declarar indisponibilidad del delta individual en lugar de
mostrar un grupo o un resultado anterior como último. Esa limitación **no es una
excepción FR-03 aprobada**; aceptación de colas y gate M0 siguen abiertos. Tabla de
señales, baseline temprano y política ante sesión/worktree/reload en M0.md. No se
ha implementado captura; no se cambia alcance/requisitos ni se habilita M1.

**Drag: siguiente experimento, no conclusión de inviabilidad.** Declaraciones públicas
Pi TUI 1.4.0: TuiMouseEvent incluye screenX/Y, x/y locales y tamaño; capture retiene
release en el componente origen. No existe payload de transferencia/drop en
TuiMouseEventResult. Sería necesario conservar el rango seleccionado y reconocer
el destino editor sin reenviar eventos que activen selección nativa. El spike no
hace ninguna de esas dos cosas; el reporte de copia no permite culpar al terminal
ni a Herdr. La extensión podría interpretar release como gesto explícito, pero su
fiabilidad depende de pruebas humanas de captura/destino y resize aún pendientes.
No se agregó código de UX M3 ni accesos internos al editor. H5 NOT IMPLEMENTED y
sin excepción aprobada; seleccionar→a sigue siendo la alternativa validada.

## 13. Síntesis de cierre M0 / ADR-003 confirmado (2026-10-22)

La sección final de `M0.md` es el contrato operativo vigente y la matriz autoritativa;
las entradas anteriores son histórico de investigación, no instrucciones de ampliar M0.
No se implementaron snapshots ni nuevos experimentos de drag. Aceptación final humana
condicionada a H3 visual y H7/H8 individualizados; no declarar gate total PASS.

### Evidencia de API pública y runtime contrastada en este cierre

Releídos `docs/extensions.md` de la instalación Pi 1.4.0 y los siguientes cuerpos y
declaraciones del paquete fijado localmente (sin depender de documentación web latest):

- `dist/core/extensions/types.d.ts:910`, `InputEvent`: `source` distingue origen,
  pero **`streamingBehavior?: "steer" | "followUp"` sí distingue entrega en streaming**.
  Corrige cualquier lectura histórica de que la API no ofrece ese dato; el probe
  `/m0-events` no lo registra. No es un ID causal ni confirma aceptación/consumo.
- `dist/core/agent-session.js:1590,1636–1675`: `_runInputHandlers` puede transformar
  o consumir input; comandos de extensión se resuelven antes de input. Input ocurre
  antes de expandir templates y antes de encolar por streamingBehavior.
- `steer`, `followUp`, `_queueUserInput` (1752–1790) pasan por handlers de input;
  las colas internas no crean por sí mismas un baseline independiente. Steering
  se entrega tras herramientas del turno, follow-up cuando se agota trabajo anterior.
- `_prepareRun` (1480): compaction precede `before_agent_start`. `_handlePostAgentRun`
  y `_runBeforeSettleBoundary` (1530–1589) permiten retry/colas/continuación antes de
  settled. El grafo de `docs/extensions.md` confirma esa semántica pública y que
  handlers se ordenan por carga/registro; no existe prioridad absoluta para capturar
  antes de efectos de otras extensiones.

### Decisión

Abrir candidato/baseline asíncrono acotado en `input` idle; confirmar en
`before_agent_start` user. Sin candidato correlacionable, baseline allí marcado
**tardío/no verificable**. Input consumido o preflight fallido no publica iteración.
Mientras hay ventana activa, entradas adicionales o mensajes user no correlacionados
marcan agrupación conservadora. No inferir que source extension es persona ni que
un evento garantiza aceptación. Mantener baseline durante todos los turnos/retries;
cerrar/capturar after en `agent_settled`, no en agent_end ni agent_before_settle.
Aborto es cancelada/parcial; error definitivo tampoco equivale a completada exitosa.

ID de ventana: `(sessionId, realpath(worktreeRoot), runtimeEpoch, sequence)`, más
ordinales de entradas sin contenido en logs. Scope/epoch se verifican al publicar
trabajos async; shutdown/reload/cambio de scope invalidan capturas y selección.
Resume de conversación no recupera snapshots efímeros. Si falta correlación, marcar
ambigua/parcial; no prometer causalidad ni captura atómica frente a escritores externos.

**Varias peticiones, un settled:** sólo existe ventana agrupada observable; no
fabricar snapshots por petición ni dividir por herramientas/turnos. Declarar delta
individual indisponible y no mostrar resultado antiguo como Last iteration. Esta
política es explícita y comprobable, no una excepción FR-03 ni aceptación del producto.
La decisión arquitectónica queda resuelta; implementar/probar máquina de estados y
resolver aceptación de esa limitación corresponde a M1 sólo con autorización.

Pruebas existentes sostienen esta decisión: L2/L3 comparten settled, L4 HTTP tiene
un solo before_agent_start con retry, L5 abort omite before_settle, L6 restaura ID.
No demuestran una máquina de captura todavía inexistente. M1 deberá probar inputs
consumidos/transformados, candidatos fallidos, colas tardías, error final, invalidación
de scope y serialización de capturas; si no puede demostrar individualidad, fail closed.

### Alcance final de UX y aceptación

- Seleccionar → `a` → anexar al editor: **PASS humano** Pi y Herdr, sintético,
  borrador conservado y sin envío; mantener como alternativa validada.
- Drag literal: **DEFERRED a evaluación M3**, no imposible ni paridad/excepción
  aprobada. No continuar implementándolo/investigándolo en M0.
- H3 visual nuevo, H7 sidebar/split/zoom y H8 resize/reload/new/resume individual:
  **NOT RUN humano**; protocolo mínimo en M0.md. Detach/reattach extendido: M4.
- Cierre documental preparado; aceptación humana final pendiente. M1 no autorizado.
- Gate final ejecutado 2026-10-22 21:06 UTC−03: `npm run check` PASS, tsc y 14/14,
  Node 26.12.0/npm 12.2.1. No PTY ni pruebas humanas nuevas; sin cambios de runtime.

## 14. Acta de cierre definitivo M0 (2026-10-22)

Actualización de aceptación, **sin investigación adicional**. El operador confirma
foco visual esperado en Pi directo y Herdr y después H7/H8 completos («ambos pasaron
la prueba»), tras enumerar sidebar/split/zoom y resize/reload/new/resume. Se acepta
como informe humano PASS; el agente no ejecutó esas pruebas ni recibió capturas o
metadatos nuevos de terminal/tamaños/hora de ejecución. Entorno reportado previamente:
Arch Linux, Pi 1.4.0, Herdr 0.9.5. No extrapolar a otros entornos.

El usuario aprueba ADR-003: ventana observable sin atribución ficticia. Acepta
provisionalmente indisponibilidad individual para ventanas agrupadas en M1 y
conservación opcional del diff conjunto como entidad diferente de Last iteration.
No elimina FR-03 ni equivale a implementar/probar el motor de captura.
También acepta diferir evaluación de drag literal a M3, manteniendo FR-16 y la
alternativa seleccionar → a ya validada. Detach/reattach extendido sigue en M4.

**Gate M0 PASS, cerrado.** La matriz final de M0.md sustituye pendientes históricos.
No se amplían pruebas ni se reabre investigación. M1 no iniciado ni autorizado;
riesgos de correlación, límites/seguridad de snapshots e internals del layout se
trasladan documentados, no se consideran resueltos por el cierre de factibilidad.

## 15. M1 autorizado / backend de captura (2026-10-23)

Usuario autoriza M1, sin M2 ni cambios de UI. Backend mínimo: buffers efímeros en
RAM, Git sólo para descubrir/enumerar alcance, comparación por bytes independiente
de commits. No índice temporal ni objetos Git. Capturas secuenciales y acotadas;
omisiones por ruta/prefijo y cobertura global impiden inferir ausencia falsa.

Seguridad de lectura: Node no expone openat2 con RESOLVE_BENEATH. Se usa O_NOFOLLOW/
O_NONBLOCK, lstat de padres, rechazo de hardlinks y validación Linux de fd en procfs
antes de leer. En otras plataformas falla cerrado (contenido omitido); portabilidad
pendiente, no se introduce FFI. Esto no es una garantía frente a escritor malicioso
ni atomicidad del workspace. Defaults, filtros best-effort, cota de contenidos vs
RSS y cancelación cooperativa de metadata documentados en `M1.md`.

Ignorados tracked y untracked se registran sin contenido, incluidos prefijos de
directorios; cambios de ignore/exclude producen incertidumbre, no creación ficticia.
Fixtures pasan con linked worktree, gitlink/submódulo, dirty/staged/untracked,
Unicode/CRLF, shell, binarios, enlaces y límites. Sin cambios de instalación real.

### Integración ADR-003 y gate M1

`src/lifecycle/pi-lifecycle.ts` usa exclusivamente eventos públicos verificados en
Pi 1.4.0. Captura idle en input y espera baseline antes de seguir; confirma texto
por huella efímera en before_agent_start user. Transforms/expansiones/images/custom/
source extension se degradan conservadoramente si falta correlación. Message_start
user adicional o input durante ventana marca agrupación aun si su consumo es incierto.
Turn_end/before_settle sólo actualizan outcome; retries/agent_end no cierran. Settled
captura final (incluido aborto); error final nunca completo. Detalles y tabla M1.md.

Controlador aislado de Pi/TUI, serializa IO y verifica identidad tras awaits;
invalida síncronamente antes de resolver scope async y no reconstruye buffers al
resume/reload. Sin evento público post-input para consumo/preflight: candidato no
confirmado retiene sólo un baseline acotado hasta reemplazo/shutdown, nunca publica.
Nuevo candidato libera resultado previo: retención de una ventana, no historial.

Gate 2026-10-23: tsc + 40/40 PASS; suites dirigidas 20/20 lifecycle y 9/9 snapshots.
Incluye SDK real y transporte HTTP loopback, no sólo eventos simulados. Arquitecto
read-only aprobó tras corregir exclusión `.env*` con regresión por variantes.
Linux/procfs y metadatos FS cooperativos son límites actuales, no compatibilidad
universal. Git no enumera FIFO untracked: se prueba regular tracked → FIFO y se
excluye como desconocido. Sólo archivos elegibles/enumerables, no auditoría completa
de entradas especiales. Sin nuevas pruebas humanas ni adelanto de M2.

