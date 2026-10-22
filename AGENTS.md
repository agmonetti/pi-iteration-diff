# AGENTS.md — Instrucciones obligatorias para agentes

## 0. Misión y definición de alcance

Construir `pi-iteration-diff`, una **extensión ligera de Pi Coding Agent** para revisar mediante `/diff` los cambios netos de la **última petición del usuario**, al final de esa ejecución, en un **panel a la derecha de la conversación**, seleccionar líneas/rangos y agregarlos **sin envío automático** al editor nativo de Pi. Debe funcionar tanto en terminal común como con Pi dentro de **Herdr**.

Antes de escribir código, leer en orden: `AGENTS.md` → `REQUIREMENTS.md` → `RESEARCH.md` → `PROGRESS.md`. Al terminar cada bloque de trabajo, actualizar `PROGRESS.md`.

**Regla principal:** no ampliar alcance ni considerar terminado el proyecto porque «ya funciona algo parecido». El producto debe cumplir los criterios de aceptación, no solamente mostrar un `git diff` en una TUI.

## 1. Reglas de colaboración y ejecución

1. Implementar **por milestones pequeños**, con prueba y registro de evidencias. Priorizar M0 (factibilidad) antes de construir infraestructura extensa.
2. Antes de tocar un componente, buscar si Pi ofrece una API pública; usar internals solo en un adaptador aislado con prueba, versión documentada y fallback.
3. No convertirlo en un fork de Pi/Herdr ni clonar integralmente proyectos de referencia. Tomar ideas, no código sin revisar licencias.
4. No ejecutar migraciones, refactors amplios, formateos de todo el repo, actualizaciones masivas ni cambios fuera de la tarea.
5. Si un enfoque falla, escribir hipótesis, prueba mínima, resultado y próximo experimento. No acumular soluciones especulativas ni capas de fallback sin pruebas.
6. No detenerse solo después de haber generado código: verificar los cambios contra aceptación y tests. A la inversa, **no seguir iterando indefinidamente**: cerrar el milestone cuando su Definition of Done esté satisfecha.
7. Señalar claramente bloqueos de entorno (sin Pi, Herdr o terminal interactivo disponible) y no inventar pruebas.

## 2. Arquitectura objetivo

**Límites de módulos:**

```text
src/
  index.ts                  # registro de extensión, comandos, wiring
  lifecycle/                 # baseline/final, sesiones, eventos
  snapshots/                 # contenidos before/after, exclusiones, límites
  diffs/                     # parseo, hunks, líneas, lados, renames
  review/                    # selección, anotaciones, staging de feedback
  ui/                        # layout adapter, dock, navegación, mouse/focus
  integrations/herdr/        # SOLO compatibilidad y metadata opt-in futura
  core/                      # tipos, configuración, errores

tests/
  fixtures/                  # repositorios y archivos sintéticos
  ...                        # tests unit/integration y harness de TUI
```

La estructura es **propuesta**, no directorios ya existentes. Simplificar cuando el código real lo permita: módulos por responsabilidad, no una carpeta por archivo sin sentido.

**Invariantes:**

- `snapshots`, `diffs` y `review` son mayoritariamente puros/testeables; no importar Pi ni Herdr en estas capas.
- `ui` solo presenta el modelo y traduce interacciones; jamás decide qué modificó el agente a partir de colores/texto renderizado.
- `lifecycle` define una iteración lógica del usuario, nunca confundirla con un solo `turn_end` del modelo.
- La interacción con internals `tui.layoutRoot` / `setLayoutRoot` se encapsula en un único `layout-adapter.ts` con detección de capacidad, ownership y cleanup.
- Todo estado mutable se delimita por **Pi session ID + root del repositorio/worktree + iteration ID**. No mezclar panes ni proyectos.
- Nunca escribir sobre el índice real de Git; nunca crear commits/stashes para capturar diffs.
- El panel se abre **solo por acción explícita**. La captura silenciosa de snapshots no habilita popups automáticos.

## 3. Convenciones de implementación

- TypeScript con `strict: true`, tipos explícitos en API pública y sin `any` salvo frontera aislada de API no tipada documentada.
- Preferir funciones pequeñas, entrada/salida predecibles, errores tipados y dependencias mínimas; **no incorporar React, Electron ni WebView**.
- Usar herramientas de Pi TUI para medir columnas Unicode, manejar estilos, teclado, scroll y mouse; no computar ancho como `string.length`.
- IO asíncrono cancelable cuando sea posible; límites de archivos, memoria, profundidad y tiempo configurables.
- Nombres en inglés para código/comandos/API; documentación y reportes del proyecto en español.
- Seguir la convención de slash commands de Pi. Registrar `/diff` **solo si no colisiona** con otra extensión; ofrecer comando alternativo `/iteration-diff` como fallback. No silenciar o sobrescribir comandos ajenos.
- No confiar en extensión, nombre, stdout de herramientas o heurísticas como garantía de autoría del archivo.
- Render y captura deben degradarse de forma segura ante errores. Restaurar root/editor/focus y liberar recursos.
- Aplicación de feedback: construir un bloque compacto con `path`, `side`, `line range`, `excerpt`, `intent` y comentario. Preservar el texto previo y el orden del borrador; no autoenviar y no editar el código directamente.
- Tests de salida ANSI, terminal pequeño, caracteres combinados, tabs y emojis; no depender de capturas de pantalla para verificar datos del diff.

## 4. Protección de datos y de la máquina del usuario

- **Nunca**: `git reset`, `git clean`, `git stash`, `checkout --`, cambios a config global o extensiones instaladas sin consentimiento explícito. `git add` y `git commit` solo se permiten bajo la política de commits de la sección 7, limitados a archivos propios del proyecto.
- No persistir por defecto contenido completo de código, secretos ni diffs en lugares compartidos/logs. Si hacen falta snapshots temporales, almacenarlos con permisos restringidos, límites y borrado seguro a nivel de API (sin prometer borrado físico irrecuperable).
- Respetar `.gitignore` y exclusiones configuradas; especificar claramente alcance de untracked y outside-repo.
- No leer indiscriminadamente `$HOME`, directorios sensibles, `.git` interno ni archivos enormes. Sin telemetría, red ni analytics por defecto.
- No modificar la instalación real de Pi/Herdr del usuario para hacer pruebas automáticas. Usar un `PI_CODING_AGENT_DIR` temporal y un fixture repo aislado cuando sea posible.
- No interferir con `herdr-agent-state.ts` o estados `idle/working/blocked` de Herdr.

## 5. Herramientas, scripts y comandos

**Estado actual:** solo documentación. **No existe aún `package.json`, test suite ni comandos ejecutables del proyecto**. En el primer milestone que cree el scaffold, definir estos scripts en `package.json` y hacerlos funcionar (Node + TypeScript; preferencia por `node:test`, `tsx` y `tsc` antes de sumar frameworks grandes):

```bash
npm install             # una vez definido package.json
npm run typecheck       # tsc --noEmit
npm test                # suite automatizada: unit + integration automatizables
npm run check           # typecheck + test (gate para cada milestone)
```

Para probar manualmente la extensión, **una vez que `src/index.ts` exista y sea cargable**:

```bash
pi --tui-mode fullscreen -e ./src/index.ts
```

Si el CLI actual de Pi no acepta esa forma, verificar `pi --help` y ajustar la documentación. Para Herdr: comprobar `herdr --version`, `herdr integration status` y abrir Pi en un pane de una instancia de prueba; **no instalar ni sobrescribir la integración** salvo autorización.

**Requisitos de los tests que se agreguen:**

- Fixtures dentro de directorios temporales (`mkdtemp`) con cleanup en `finally`.
- Unitarios: snapshot neto, líneas añadidas/eliminadas, path normalization, filtros, selección y prompt.
- Integración: repositorio con modificaciones anteriores, dos iteraciones, escritura vía shell, index intacto, cambios de sesión.
- Manuales: Pi fullscreen, Herdr, mouse, focus, resize y `Ctrl+C`/`/reload`.
- Registrar versión real de Node, Pi, Herdr y terminal en cada prueba manual.

## 6. Protocolo para los milestones

Cada milestone debe producir:

1. **Objetivo observable**, archivos concretos y alcance pequeño.
2. Evidencia de prueba (`comando`, resultado real, ambiente, fecha). Distinguir `PASS`, `FAIL`, `BLOCKED`, `NOT RUN`.
3. Actualización de `PROGRESS.md`: qué cambió, tests, fallos, siguiente paso y riesgos.
4. Si cambia un requisito/decisión, actualizar `REQUIREMENTS.md`/`RESEARCH.md` con razón, sin borrar el histórico.
5. No anunciar «terminado» si hay pruebas obligatorias sin ejecutar o aceptación incumplida.

**Secuencia:** M0 viabilidad TUI/mouse/lifecycle → M1 snapshots → M2 diff + revisión → M3 editor y drag/feedback → M4 Herdr y robustez → M5 empaquetado/documentación.

## 7. Política de Git y Conventional Commits (obligatoria)

- **Todos los mensajes de commit deben estar en inglés** y seguir [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/): `type(scope): concise imperative description`.
- Tipos permitidos: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `build`, `ci`, `perf`, `revert`. Usar `!` o un footer `BREAKING CHANGE: ...` solo para cambios efectivamente incompatibles.
- `scope` es opcional, pero preferible cuando aporta contexto: `ui`, `diff`, `snapshots`, `review`, `lifecycle`, `herdr`, `tests`, `docs`.
- Subject en inglés, modo imperativo, minúscula inicial, sin punto final, conciso (idealmente <= 72 caracteres para toda la primera línea).
- Ejemplos correctos:
  - `feat(ui): add manually opened diff sidebar`
  - `feat(snapshots): isolate changes per user iteration`
  - `fix(review): preserve existing editor draft`
  - `test(lifecycle): cover interrupted agent runs`
  - `docs: record Herdr compatibility constraints`
- Cada commit debe representar **un cambio lógico y comprobable**. No combinar implementación, refactors independientes y cambios cosméticos sin relación. Evitar commits vacíos, de progreso artificial o por cada edición mínima.
- Antes de commitear: ejecutar `git status --short`, revisar `git diff` y `git diff --cached`, correr los checks disponibles (`npm run check` cuando exista) y registrar los resultados reales en `PROGRESS.md`. No afirmar PASS si no se ejecutaron.
- Agregar solo archivos relacionados con la tarea, **por rutas explícitas** (`git add -- path/to/file`); nunca `git add -A`, `git add .` ni `git commit -a` sin permiso. No incluir secretos, artefactos generados, logs, snapshots ni cambios previos del usuario.
- Se permite crear commits locales de cambios del propio proyecto una vez verificados, **si el repositorio ya está inicializado y el usuario no pidió evitar commits**. No hacer `git push`, crear tags, reescribir historia, amend, rebase ni modificar configuración Git sin autorización explícita.
- Si existen modificaciones ajenas, staged changes ajenos, conflictos, hooks fallidos o el repositorio no está inicializado: **no forzar ni limpiar el estado**; documentar el bloqueo y dejar los archivos propios sin commitear cuando no sea posible aislarlos de forma segura.
- No commitear hasta que el bloque de trabajo tenga un resultado coherente y verificable. En el reporte final, informar hash corto, mensaje, tests ejecutados y cualquier limitación; si no hubo commit, explicar por qué.
- El código de la extensión **nunca** debe ejecutar `git add` o `git commit` para funcionar, capturar snapshots o calcular diffs. Esta política se aplica únicamente al agente *desarrollando este repositorio*.

## 8. Definition of Done global (NO negociable)

El proyecto solo se considera completado cuando:

- `/diff` manual abre/cierra un dock lateral derecho con conversación y editor nativo operativos en Pi fullscreen; no se autoabre.
- Por defecto muestra solo el **delta neto de la última petición completada**, separándolo de cambios previos sin commit. Incluye resultados de `write`, `edit` y comandos shell.
- Se pueden seleccionar líneas y rangos con teclado y mouse en fullscreen, conservar selección al navegar y añadir **múltiples** fragmentos al prompt con `FIX`/`DISCUSS` sin borrar borrador ni enviar automáticamente.
- El flujo de **arrastrar rangos hacia el editor** se probó; si el protocolo terminal lo impide en el entorno objetivo, documentar la limitación con evidencia, ofrecer alternativa de una acción y **no declarar paridad completa** sin aprobación del usuario.
- Funciona en Pi sin Herdr y dentro de Herdr sin romper integración oficial, mouse, focus, resize y recuperación del layout.
- Test suite y typecheck pasan; pruebas manuales obligatorias registradas, sin regresiones ni cambios del índice Git.
- Documentación de instalación, uso, límites y compatibilidad actualizada; `PROGRESS.md` consigna evidencia del DoD.

Leer los criterios verificables y el roadmap completo en `REQUIREMENTS.md`.
