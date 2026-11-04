# Contexto del Proyecto: Gains & Goblins (Fable of Real Life)
*Análisis del estado del desarrollo frente al plan de diseño v2.*

---

## 1. Resumen Técnico Actual del Proyecto
El proyecto es una aplicación web (SPA) con un servidor propio:
* **Vite** como empaquetador y servidor de desarrollo rápido.
* **Phaser 3 (v3.87.0)** para el motor del videojuego 2D (físicas de tipo arcade, rendering de mapas, combate y lógica de movimiento).
* **HTML5 y Vanilla CSS** para el HUD fuera del canvas del juego.
* **Servidor Node.js + Express** (`server/`) con **Prisma** sobre **PostgreSQL (Neon)** para guardar usuarios, personajes y actividades.
* **Socket.IO** para jugadores en línea e invitaciones a grupo, y **PeerJS** (P2P) para sincronizar partidas entre jugadores.
* **Generación Procedimental Gráfica:** Texturas generadas en tiempo real mediante operaciones de Canvas, evitando la carga de archivos de imagen externos.

---

## 2. Matriz de Estado: Desarrollado vs. Pendiente (Plan v2.0)

A continuación se detalla la comparativa entre lo que el documento de diseño [fable_plan_v2.docx](../fable_plan_v2.docx) establece y lo que realmente está implementado en el código actual:

| Característica / Sistema | ¿Está en el Código? | Archivos Relacionados | Detalles del Estado Actual / Faltantes |
| :--- | :---: | :--- | :--- |
| **Combate Sin Clases** | **SÍ** | [Player.js](../src/entities/Player.js), [constants.js](../src/utils/constants.js) | El jugador puede usar Espada, Arco o Magia (teclas 1, 2, 3). No hay bloqueos. El daño escala con las estadísticas de Fuerza, Destreza e Inteligencia. |
| **Ataques Cargados** | **SÍ** | [Player.js](../src/entities/Player.js), [WorldScene.js](../src/scenes/WorldScene.js) | Mantener `ESPACIO` realiza ataques cargados: Tajo pesado (melee), Flecha perforante (arco), y Explosión en Área (magia). |
| **Hechizos Mágicos** | **SÍ** | [Player.js](../src/entities/Player.js), [WorldScene.js](../src/scenes/WorldScene.js) | Lógica funcional para dos hechizos: `shield` (Escudo Físico que absorbe daño usando maná) y `ghost_swords` (Espadas orbitales automáticas). |
| **Evolución Física de Stats** | **SÍ** | [Player.js](../src/entities/Player.js), [BootScene.js](../src/scenes/BootScene.js) | Cuando una estadística clave (Fuerza, Destreza, Inteligencia) llega a 10, la apariencia del personaje se regenera visualmente (robusto, ágil, ropajes arcanos, etc.). |
| **Afinidad Orgánica** | **SÍ (Local)** | [Player.js](../src/entities/Player.js) | Registra actividades locales y otorga un +15% de daño si usas la rama dominante. **Diferencia:** En el código se calcula por mes calendario, mientras que el plan v2 pedía ventana deslizante de 30 días. |
| **Evadir/Esquivar** | **SÍ** | [Player.js](../src/entities/Player.js) | Voltereta táctica presionando `SHIFT` con invulnerabilidad temporal y efecto visual de partículas de polvo. |
| **Esquema de Base de Datos** | **SÍ** | [schema.prisma](../server/prisma/schema.prisma) | PostgreSQL en Neon con Prisma. Modelos `User`, `Character` y `Activity`. |
| **Servidor / Backend API** | **SÍ** | [server.js](../server/server.js) | Express con registro, login y endpoints autoritativos (sincronizar personaje, enemigos, cofres, compras). Contraseñas cifradas con bcrypt y peticiones autenticadas con JWT. |
| **Red Multijugador (Sockets)** | **SÍ (Parcial)** | [server.js](../server/server.js), [P2PManager.js](../src/utils/P2PManager.js) | Socket.IO para jugadores en línea e invitaciones a grupo; PeerJS para la partida compartida. **Falta:** chat global. |
| **Google Fit / Fitbit API** | **SÍ (Fitbit)** | [server.js](../server/server.js), [main.js](../src/main.js) | OAuth 2.0 con Fitbit (Google Health) y sincronización de ejercicios. Google Fit no está integrado. |
| **Sistema de Moral** | **Parcial** | [DialogueSystem.js](../src/ui/DialogueSystem.js), [WorldScene.js](../src/scenes/WorldScene.js) | Existe el valor `moral` y se reduce al empujar NPCs. **Falta:** cambios de apariencia por rachas (brillo a los 7 días, sombras por abandono). |
| **Árbol de Habilidades** | **NO** | Ninguno | Las estadísticas se incrementan linealmente, pero no existen ramas de técnicas desbloqueables avanzadas para cada arma. |
| **React & Tailwind CSS** | **NO** | [index.html](../index.html) | La UI del juego se construyó usando Vanilla HTML y Vanilla CSS ([game.css](../styles/game.css)) en lugar del stack propuesto (React + Tailwind). |
| **Misiones e Historia** | **SÍ (Básico)** | [QuestSystem.js](../src/utils/QuestSystem.js) | Existen 3 misiones estáticas de cazar monstruos en el código. El Plan v2 apunta a mínimo 10 misiones principales de historia con NPCs interactivos que no están creadas. |
| **Misiones Diarias** | **SÍ** | [DailyMissionSystem.js](../src/utils/DailyMissionSystem.js) | Lógica completa local: genera 3 misiones diarias a la medianoche (caza, visita o hábitos) y permite reclamar recompensas de oro o puntos extra. |
| **Economía y Comercio** | **NO** | [ShopSystem.js](../src/ui/ShopSystem.js) | Solo existe una tienda local para comprar pociones al NPC Alquimista. Faltan intercambios entre jugadores y casa de subastas. |
| **Casas y Propiedades** | **NO** | Ninguno | Pendiente para la Fase 3 del plan. |
| **Gremios** | **NO** | Ninguno | No hay lógica para clanes, chats de gremio ni retos colectivos de ejercicio físico. |

---

## 3. Análisis Detallado del Código Existente

### 3.1. El Motor de Juego (Phaser & Client-side)
* **Generación Procedimental Gráfica ([BootScene.js](../src/scenes/BootScene.js)):** En lugar de cargar spritesheets pesados, el juego dibuja en lienzos HTML en tiempo real baldosas (*tiles*), enemigos (Slime, Goblin, Skeleton), NPCs, proyectiles y animaciones de movimiento del jugador. Esto permite un peso inicial insignificante y facilita evoluciones visuales dinámicas del jugador (línea 562 en `BootScene.js`).
* **Lógica del Jugador ([Player.js](../src/entities/Player.js)):** Implementa mecánicas avanzadas como la regeneración inteligente de maná (acelerada por la voluntad), absorción de daño con Escudo Físico (línea 331), inmunidades por esquive, y penalizaciones de oro al revivir tras múltiples muertes seguidas.
* **Lógica de Escena ([WorldScene.js](../src/scenes/WorldScene.js)):** Coordina múltiples mapas procedimentales (`guild`, `deeproot`, `dungeon`), la máscara de iluminación dinámica para la mazmorra (antorcha oscilante en línea 365), la colisión física entre proyectiles y enemigos, y los diálogos guiados con opciones de selección numérica (línea 809).
* **Mapas Procedimentales ([MapGenerator.js](../src/utils/MapGenerator.js)):** Construye matrices bidimensionales con zonas diferenciadas para cada disciplina de hábito (Zona de pesas, Zona de cardio, Biblioteca, Zona de meditación y Arena de combate), así como transiciones automatizadas de entrada/salida entre mapas.

### 3.2. Registro y Gamificación de Hábitos
* **Modal de Registro ([main.js](../src/main.js)):** El jugador accede mediante la tecla `L` a un menú flotante con 8 tipos de actividades de la vida real (Fuerza, HIIT, Cardio, Correr, Estudio, Lectura, Meditación y Socializar).
* **Asignación Fable-style ([WorldScene.js:L963](../src/scenes/WorldScene.js#L963)):** Al registrar una actividad, el juego otorga un "Punto de Rama" en vez de subir una estadística automáticamente. Se abre un diálogo interactivo donde el jugador decide en qué estadística gastar el punto (ej: entrenar cardio otorga un punto de Destreza, y el jugador puede elegir entre subir *Destreza* para el arco o *Velocidad* para desplazarse).
* **Persistencia ([SaveSystem.js](../src/utils/SaveSystem.js)):** Guarda el inventario, estadísticas del personaje, y la lista de actividades completadas hoy para bloquear múltiples registros tramposos en un mismo día.

---

## 4. Próximos Pasos

El servidor, la base de datos, los Sockets y Fitbit ya existen. Lo que falta, en orden de prioridad:

1. **Multijugador:** añadir chat global y sincronizar ataques y hechizos entre jugadores en la Arena.
2. **Sistema de Moralidad y Consistencia:**
   * Calcular rachas de hábitos con el historial de `Activity`.
   * Aplicar en `BootScene.js` el brillo (rachas positivas) o el sombreado (abandono de hábitos).
