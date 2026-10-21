---
name: anti-slop
description: >-
  Reglas para evitar "slop" (código y texto genérico, de relleno o de baja
  calidad) en Gains & Goblins. Úsala al escribir o revisar código JavaScript
  (Phaser en src/, Express/Prisma en server/), textos del juego (diálogos,
  misiones, notificaciones) o documentación (README, context/, DEPLOYMENT.md).
  También cuando el usuario pida "revisar slop", "limpiar el código" o
  "/anti-slop".
---

# Anti-slop para Gains & Goblins

"Slop" es contenido que parece trabajo pero no aporta: comentarios que repiten
el código, duplicación, abstracciones sin uso, frases de relleno, emojis de
adorno. Esta skill tiene dos modos:

- **Al escribir**: sigue las reglas de abajo mientras generas código o texto.
- **Al revisar** (`/anti-slop` o "revisa el slop"): recorre los archivos
  pedidos (o todo `src/`, `server/` y los `.md` si no se especifica) y entrega
  una lista de hallazgos. **No cambies nada hasta que el usuario lo apruebe.**

## Reglas de código

1. **Comentarios**: solo explican el *porqué* o algo no evidente. Elimina los
   que narran el *qué* (`// Define all quests` encima de `_defineQuests()`,
   `// Re-open shop` encima de `openShop()`).
2. **Duplicación**: si dos funciones difieren solo en datos (precio, nombre,
   icono, stat), únelas en una función con parámetros o una tabla de datos.
   Ejemplo típico: `_buyHealthPotion` / `_buyManaPotion`.
3. **Números mágicos**: precios, daños, tiempos y colores repetidos van en
   `src/utils/constants.js`, no copiados en varios archivos.
4. **Código muerto**: borra funciones, variables, imports y bloques
   comentados que nadie usa. Git guarda el historial.
5. **Sin abstracción especulativa**: nada de clases, opciones o capas "por si
   acaso". Escribe lo que el juego necesita hoy.
6. **Errores reales, no silenciados**: no uses `catch {}` vacíos ni
   `console.log` como único manejo. El jugador debe ver un aviso
   (`show-notification`) o el error debe propagarse.
7. **Seguir el estilo existente**: clases ES, `this.game.events.emit(...)` para
   comunicar escenas, métodos privados con `_prefijo`, textos del jugador en
   español. No introduzcas otro patrón sin motivo.
8. **Logs de depuración**: elimina `console.log` temporales antes de
   terminar; deja solo los que sirven en producción (servidor).
9. **Funciones gigantes**: si un método supera ~80 líneas o mezcla varias
   responsabilidades (input, física, UI), sepáralo en métodos con nombre claro.
   Aplica sobre todo a `WorldScene.js`, `BootScene.js` y `server/server.js`.

## Reglas de texto (juego y documentación)

1. **Directo**: cada frase dice algo concreto. Elimina relleno como "cabe
   destacar", "en resumen", "robusto", "de manera eficiente", "potenciar",
   "una experiencia única/inmersiva".
2. **Sin autopresentación**: no escribas "como desarrollador profesional..."
   ni frases sobre quién redactó el documento.
3. **Emojis con moderación**: como mucho uno por título y solo si ayuda a
   ubicarse. Nunca uno por viñeta. En el juego, los emojis de ítems
   (🥤, ☕) sí están bien porque funcionan como iconos.
4. **Sin marcadores vacíos**: no dejes `<!-- ej. React -->` ni secciones
   "Contacto" vacías. Rellénalas con datos reales o bórralas.
5. **Datos verificables**: las tablas de estado deben coincidir con el código.
   Si algo dice "NO implementado" y ya existe, corrígelo.
6. **Rutas relativas**: enlaza archivos con rutas del repo (`src/entities/Player.js`),
   nunca rutas locales como `file:///c:/Users/...`.
7. **Textos del juego**: diálogos cortos, con la voz del personaje, sin
   repetir lo que ya muestra la interfaz.

## Formato del reporte de revisión

Agrupa por archivo y ordena de mayor a menor impacto:

```
### src/ui/ShopSystem.js
- [Duplicación] L30-75: _buyHealthPotion y _buyManaPotion son idénticas salvo datos.
  Propuesta: un método _buyItem(item) con una tabla ITEMS en constants.js.
```

Termina con un resumen corto (cuántos hallazgos por categoría) y pregunta qué
arreglar primero. Explica cada propuesta en lenguaje sencillo: el usuario está
aprendiendo a programar.
