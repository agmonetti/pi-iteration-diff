# Investigación técnica — Sistema `/diff` de Claude Code (`mods/diff`)

**Fecha de investigación:** 2026-10-23  
**Repositorio de referencia:** `anthropics/claude-code`, directorio `mods/diff`  
**Estado:** Investigación documental estricta (sin modificaciones de código runtime, sin alterar M1).

---

## 1. Introducción y alcance

Esta investigación analiza la arquitectura y el funcionamiento interno del sistema `/diff` de Claude Code, implementado como el mod integrado `mods/diff` (`cc-plugin-diff`). El propósito es contrastar sus decisiones de diseño con nuestra arquitectura (`RESEARCH.md`, ADR-003) y los requisitos del proyecto `pi-iteration-diff`.

---

## 2. Análisis detallado por área de investigación

### 2.1. Captura y reconstrucción de cambios por turno (`T1`, `T2`...)
- **Hechos verificados:** Claude Code organiza los cambios por turnos de agente (`T1`, `T2`, etc.) utilizando grabadores de motor (`Record.recorderOf(engine)`) y hooks de registro centralizados en `mods/diff/hooks/register.ts` e `mods/diff/hooks/index.ts`.
- **Mecanismo:** Cada vez que el agente ejecuta herramientas de edición o comandos que modifican el entorno, el sistema registra el estado incremental asociado al turno del agente, además de la vista unificada `Current`.

### 2.2. Diferencias entre Git working tree y turn history
- **Hechos verificados:** 
  - `Current` refleja el estado acumulado y no commiteado del working tree de Git (`git diff HEAD`).
  - Las vistas por turno (`T1`, `T2`, ...) aíslan los cambios ocurridos en turnos específicos de la ejecución de Claude.
- **Comparación con ADR-003:** ADR-003 define por defecto la "última iteración completada del usuario" como unidad lógica, reconociendo que en Pi la atribución estricta por turno interno del modelo puede ser ambigua debido a reintentos y continuaciones automáticas.

### 2.3. Arquitectura del backend, estado del panel y renderizado TUI
- **Hechos verificados:** 
  - El mod está estructurado como un plugin funcional de TypeScript con submódulos de hooks y tests dedicados (`mods/diff/tests/`).
  - El backend se apoya en abstracciones de Git (`gitBackendOf`, `GitDeps`) para calcular diffs, manejar configuraciones de baseline y realizar probing de rutas modificadas.
  - El estado del panel (`PaneModel`) gestiona la apertura del dock, la navegación entre archivos y hunks, y el mapeo de teclas a acciones.
  - El renderizado ocurre en un panel lateral derecho en modo fullscreen, gestionando de forma autónoma su propio scroll y eventos.

### 2.4. Actualización de diffs durante y después de la ejecución
- **Hechos verificados:** Cuenta con un pipeline de actualización y sondeo en segundo plano (`isRefreshing`, `pinned.fetchDiff(model.requestedMode)`) que se dispara de forma reactiva o por eventos conforme Claude edita archivos (`write`, `edit`) y ejecuta comandos de consola (`bash`).

### 2.5. Manejo de archivos creados, modificados, eliminados y cambios mediante Bash
- **Hechos verificados:** 
  - El backend de Git gestiona nativamente archivos no rastreados (*untracked* / creados), modificados y eliminados.
  - Los cambios producidos por comandos de Bash (p. ej., `npm install`, scripts de compilación, redirecciones o herramientas externas) modifican el working tree y se reflejan en la vista `Current` (y se asocian al turno correspondiente si el comando formaba parte de la ejecución del agente).
  - **Manejo de ruido (*Noise handling*):** Los archivos generados automáticamente y los lockfiles pesados se filtran, se listan por separado y se contraen por defecto para no saturar la interfaz.

### 2.6. Rendimiento, estrategias de caché y límites de recursos
- **Hechos verificados:** 
  - Los diffs excesivamente grandes no se renderizan por defecto ("*Load diff / Large diffs are not rendered by default*"), previniendo bloqueos del bucle principal de la TUI o consumo desmedido de memoria.
  - Se implementa almacenamiento en caché de los resultados de `fetchDiff` en función del modo solicitado (`requestedMode`).

### 2.7. Selección de cambios y transferencia de contexto al prompt
- **Hechos verificados:** El panel incluye botones y atajos de teclado ligados a la acción `ask`, la cual inyecta el diff del archivo o fragmento seleccionado directamente en el siguiente prompt del usuario como contexto armado (*armed-ask*).

---

## 3. Clasificación de hallazgos

### 3.1. Reutilizable (aplicable directamente)
- **Filtrado de ruido y lockfiles:** Agrupar y contraer archivos generados o binarios/lockfiles pesados para mejorar la legibilidad del panel.
- **Límites de renderizado para diffs masivos:** Adoptar la regla de no renderizar diffs gigantes automáticamente para proteger la estabilidad de la TUI de Pi.
- **Estructura modular de plugins:** Separar la lógica de diffs, hooks y renderizado en módulos limpios y testeables.

### 3.2. Adaptable (requiere modificaciones por diferencias Pi / Claude Code)
- **Modelo de iteraciones (ADR-003):** Adaptar el concepto de turnos (`T1`, `T2`) al modelo de "última iteración completada del usuario" de Pi, debido a diferencias en el ciclo de vida del agente (`agent_settled` vs. turnos individuales del LLM).
- **Integración TUI y layout:** Adaptar la gestión del panel lateral derecho utilizando nuestro adaptador de layout (`layout-adapter.ts`) sobre las APIs de Pi TUI, respetando el root nativo sin reemplazar el chat principal.

### 3.3. No aplicable (depende de infraestructura propietaria de Claude Code)
- **Grabadores de motor internos:** `Record.recorderOf(engine)` depende de la arquitectura interna de eventos y motores de Claude Code.
- **Plugin runner de Claude:** El uso de `claude plugin test mods/diff` y sus ganchos de motor asociados.

---

## 4. Separación de hechos verificados e hipótesis

- **Hechos verificados:**
  - Existencia y estructura de `mods/diff` en el repositorio público de Claude Code.
  - Uso de `gitBackendOf`, `fetchDiff`, `PaneModel` y registro de hooks en `mods/diff/hooks/register.ts`.
  - Separación conceptual entre `Current` (working tree) y turnos (`T1`, `T2`).
  - Restricción de renderizado para diffs grandes y mecanismo `ask` para inyectar contexto al prompt.
- **Hipótesis:**
  - Los detalles exactos de cómo el backend persiste los merge-bases relativos a la rama por defecto por repositorio en entornos complejos de monorepo.

---

## 5. Recomendaciones concretas para evaluar después de M1

1. **Evaluación de ruido en M2/M3:** Considerar un mecanismo liviano para contraer archivos de dependencias o lockfiles (`package-lock.json`, `pnpm-lock.yaml`) en la vista del panel lateral.
2. **Protección de rendimiento TUI:** Implementar un límite de líneas o bytes por archivo en el visor de diffs para evitar ralentizaciones con archivos generados o minificados.
3. **Validación de la experiencia de transferencia al prompt:** Contrastar la inyección de contexto tipo `ask` con los requisitos de selección por rango multilínea de nuestro M3.
