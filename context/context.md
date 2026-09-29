# Contexto del Proyecto: Gains & Goblins (Fable of Real Life)
*Documento de análisis y estado del desarrollo elaborado por un desarrollador de videojuegos y desarrollador web profesional.*

---

## 1. Perfil y Visión del Desarrollador
Como desarrollador de videojuegos y desarrollador web profesional, abordo este proyecto combinando dos mundos:
1. **Gamedev (Desarrollo de Videojuegos):** Priorizo el ciclo de juego (*gameplay loop*), la respuesta visual de los controles (*game feel*), la progresión orgánica libre de clases al estilo de *Fable*, la inteligencia artificial autoritativa, y la generación procedimental eficiente.
2. **Webdev (Desarrollo Web):** Evalúo la escalabilidad del backend, el rendimiento de red en tiempo real mediante Sockets, la seguridad de datos con encriptación y JSON Web Tokens (JWT), y la compatibilidad universal a través del navegador web utilizando APIs estándar del DOM y CSS responsivo.

---

## 2. Resumen Técnico Actual del Proyecto
El proyecto actualmente es una **aplicación web del lado del cliente** (Single Page Application - SPA) construida sobre:
* **Vite** como empaquetador y servidor de desarrollo rápido.
* **Phaser 3 (v3.87.0)** para el motor del videojuego 2D (físicas de tipo arcade, rendering de mapas, combate y lógica de movimiento).
* **HTML5 y Vanilla CSS** para el HUD fuera del canvas del juego.
* **LocalStorage** para la persistencia del personaje.
* **Generación Procedimental Gráfica:** Texturas generadas en tiempo real mediante operaciones de Canvas, evitando la carga de archivos de imagen externos.

---

## 3. Matriz de Estado: Desarrollado vs. Pendiente (Plan v2.0)

A continuación se detalla la comparativa entre lo que el documento de diseño [fable_plan_v2.docx](file:///c:/Users/PC/OneDrive/Documentos/Gains%20&%20Goblins/fable_plan_v2.docx) establece y lo que realmente está implementado en el código actual:

| Característica / Sistema | ¿Está en el Código? | Archivos Relacionados | Detalles del Estado Actual / Faltantes |
| :--- | :---: | :--- | :--- |
| **Combate Sin Clases** | **SÍ** | [Player.js](file:///c:/Users/PC/OneDrive/Documentos/Gains%20&%20Goblins/src/entities/Player.js), [constants.js](file:///c:/Users/PC/OneDrive/Documentos/Gains%20&%20Goblins/src/utils/constants.js) | El jugador puede usar Espada, Arco o Magia (teclas 1, 2, 3). No hay bloqueos. El daño escala con las estadísticas de Fuerza, Destreza e Inteligencia. |
| **Ataques Cargados** | **SÍ** | [Player.js](file:///c:/Users/PC/OneDrive/Documentos/Gains%20&%20Goblins/src/entities/Player.js), [WorldScene.js](file:///c:/Users/PC/OneDrive/Documentos/Gains%20&%20Goblins/src/scenes/WorldScene.js) | Mantener `ESPACIO` realiza ataques cargados: Tajo pesado (melee), Flecha perforante (arco), y Explosión en Área (magia). |
| **Hechizos Mágicos** | **SÍ** | [Player.js](file:///c:/Users/PC/OneDrive/Documentos/Gains%20&%20Goblins/src/entities/Player.js), [WorldScene.js](file:///c:/Users/PC/OneDrive/Documentos/Gains%20&%20Goblins/src/scenes/WorldScene.js) | Lógica funcional para dos hechizos: `shield` (Escudo Físico que absorbe daño usando maná) y `ghost_swords` (Espadas orbitales automáticas). |
| **Evolución Física de Stats** | **SÍ** | [Player.js](file:///c:/Users/PC/OneDrive/Documentos/Gains%20&%20Goblins/src/entities/Player.js), [BootScene.js](file:///c:/Users/PC/OneDrive/Documentos/Gains%20&%20Goblins/src/scenes/BootScene.js) | Cuando una estadística clave (Fuerza, Destreza, Inteligencia) llega a 10, la apariencia del personaje se regenera visualmente (robusto, ágil, ropajes arcanos, etc.). |
| **Afinidad Orgánica** | **SÍ (Local)** | [Player.js](file:///c:/Users/PC/OneDrive/Documentos/Gains%20&%20Goblins/src/entities/Player.js) | Registra actividades locales y otorga un +15% de daño si usas la rama dominante. **Diferencia:** En el código se calcula por mes calendario, mientras que el plan v2 pedía ventana deslizante de 30 días. |
| **Evadir/Esquivar** | **SÍ** | [Player.js](file:///c:/Users/PC/OneDrive/Documentos/Gains%20&%20Goblins/src/entities/Player.js) | Voltereta táctica presionando `SHIFT` con invulnerabilidad temporal y efecto visual de partículas de polvo. |
| **Esquema de Base de Datos** | **NO** | Ninguno | Falta PostgreSQL, Prisma ORM, migraciones de base de datos y alojamiento administrado (Supabase/Neon). |
| **Servidor / Backend API** | **NO** | Ninguno | Falta el servidor Node.js + Express para login, autenticación JWT, registro de estadísticas en base de datos de forma segura y lógica de servidor autoritativo. |
| **Red Multijugador (Sockets)** | **NO** | Ninguno | Falta la integración de Socket.IO en el cliente y servidor para sincronizar posiciones de jugadores, combate coordinado y chat global en tiempo real. |
| **Google Fit / Fitbit API** | **NO** | Ninguno | No hay integración OAuth 2.0 ni solicitudes REST para importar datos de salud. Todo el registro de hábitos es puramente manual por el momento. |
| **Sistema de Moral** | **NO** | Ninguno | No se han implementado mecánicas de karma de decisiones ni cambios de apariencia por consistencia diaria (brillo por racha de 7 días, sombras por abandono). |
| **Árbol de Habilidades** | **NO** | Ninguno | Las estadísticas se incrementan linealmente, pero no existen ramas de técnicas desbloqueables avanzadas para cada arma. |
| **React & Tailwind CSS** | **NO** | [index.html](file:///c:/Users/PC/OneDrive/Documentos/Gains%20&%20Goblins/index.html) | La UI del juego se construyó usando Vanilla HTML y Vanilla CSS ([game.css](file:///c:/Users/PC/OneDrive/Documentos/Gains%20&%20Goblins/styles/game.css)) en lugar del stack propuesto (React + Tailwind). |
| **Misiones e Historia** | **SÍ (Básico)** | [QuestSystem.js](file:///c:/Users/PC/OneDrive/Documentos/Gains%20&%20Goblins/src/utils/QuestSystem.js) | Existen 3 misiones estáticas de cazar monstruos en el código. El Plan v2 apunta a mínimo 10 misiones principales de historia con NPCs interactivos que no están creadas. |
| **Misiones Diarias** | **SÍ** | [DailyMissionSystem.js](file:///c:/Users/PC/OneDrive/Documentos/Gains%20&%20Goblins/src/utils/DailyMissionSystem.js) | Lógica completa local: genera 3 misiones diarias a la medianoche (caza, visita o hábitos) y permite reclamar recompensas de oro o puntos extra. |
| **Economía y Comercio** | **NO** | [ShopSystem.js](file:///c:/Users/PC/OneDrive/Documentos/Gains%20&%20Goblins/src/ui/ShopSystem.js) | Solo existe una tienda local para comprar pociones al NPC Alquimista. Faltan intercambios entre jugadores y casa de subastas. |
| **Casas y Propiedades** | **NO** | Ninguno | Pendiente para la Fase 3 del plan. |
| **Gremios** | **NO** | Ninguno | No hay lógica para clanes, chats de gremio ni retos colectivos de ejercicio físico. |

---

## 4. Análisis Detallado del Código Existente

### 4.1. El Motor de Juego (Phaser & Client-side)
* **Generación Procedimental Gráfica ([BootScene.js](file:///c:/Users/PC/OneDrive/Documentos/Gains%20&%20Goblins/src/scenes/BootScene.js)):** En lugar de cargar spritesheets pesados, el juego dibuja en lienzos HTML en tiempo real baldosas (*tiles*), enemigos (Slime, Goblin, Skeleton), NPCs, proyectiles y animaciones de movimiento del jugador. Esto permite un peso inicial insignificante y facilita evoluciones visuales dinámicas del jugador (línea 562 en `BootScene.js`).
* **Lógica del Jugador ([Player.js](file:///c:/Users/PC/OneDrive/Documentos/Gains%20&%20Goblins/src/entities/Player.js)):** Implementa mecánicas avanzadas como la regeneración inteligente de maná (acelerada por la voluntad), absorción de daño con Escudo Físico (línea 331), inmunidades por esquive, y penalizaciones de oro al revivir tras múltiples muertes seguidas.
* **Lógica de Escena ([WorldScene.js](file:///c:/Users/PC/OneDrive/Documentos/Gains%20&%20Goblins/src/scenes/WorldScene.js)):** Coordina múltiples mapas procedimentales (`guild`, `deeproot`, `dungeon`), la máscara de iluminación dinámica para la mazmorra (antorcha oscilante en línea 365), la colisión física entre proyectiles y enemigos, y los diálogos guiados con opciones de selección numérica (línea 809).
* **Mapas Procedimentales ([MapGenerator.js](file:///c:/Users/PC/OneDrive/Documentos/Gains%20&%20Goblins/src/utils/MapGenerator.js)):** Construye matrices bidimensionales con zonas diferenciadas para cada disciplina de hábito (Zona de pesas, Zona de cardio, Biblioteca, Zona de meditación y Arena de combate), así como transiciones automatizadas de entrada/salida entre mapas.

### 4.2. Registro y Gamificación de Hábitos
* **Modal de Registro ([main.js](file:///c:/Users/PC/OneDrive/Documentos/Gains%20&%20Goblins/src/main.js)):** El jugador accede mediante la tecla `L` a un menú flotante con 8 tipos de actividades de la vida real (Fuerza, HIIT, Cardio, Correr, Estudio, Lectura, Meditación y Socializar).
* **Asignación Fable-style ([WorldScene.js:L963](file:///c:/Users/PC/OneDrive/Documentos/Gains%20&%20Goblins/src/scenes/WorldScene.js#L963)):** Al registrar una actividad, el juego otorga un "Punto de Rama" en vez de subir una estadística automáticamente. Se abre un diálogo interactivo donde el jugador decide en qué estadística gastar el punto (ej: entrenar cardio otorga un punto de Destreza, y el jugador puede elegir entre subir *Destreza* para el arco o *Velocidad* para desplazarse).
* **Persistencia ([SaveSystem.js](file:///c:/Users/PC/OneDrive/Documentos/Gains%20&%20Goblins/src/utils/SaveSystem.js)):** Guarda el inventario, estadísticas del personaje, y la lista de actividades completadas hoy para bloquear múltiples registros tramposos en un mismo día.

---

## 5. Próximos Pasos Recomendados (Perspectiva Profesional)

Como desarrolladores experimentados, si queremos transformar este prototipo jugable de un solo jugador en el **MMORPG Fable of Real Life**, debemos estructurar los siguientes hitos en orden de dependencia técnica:

1. **Creación del Servidor de Backend:**
   * Configurar un servidor **Node.js + Express** en la raíz del proyecto.
   * Migrar la base de datos de LocalStorage a **PostgreSQL** mediante **Prisma ORM** para proteger los datos contra modificaciones arbitrarias del cliente.
   * Desarrollar la autenticación de usuarios (registro y login) usando **JSON Web Tokens (JWT)** y contraseñas cifradas con **Bcrypt**.
2. **Implementación de Capa de Red Multijugador (Sockets):**
   * Integrar **Socket.IO** en el backend para gestionar salones de juego e información espacial de posiciones en tiempo real.
   * Sincronizar el movimiento del jugador, ataques y efectos de hechizos en el frontend para que los héroes se visualicen y colaboren en la Arena.
3. **Automatización de Hábitos (Health APIs):**
   * Configurar un flujo de autorización **OAuth 2.0** en el servidor backend para conectar con **Google Fit** o la API web de **Fitbit**.
   * Reemplazar gradualmente el registro manual con lecturas automáticas desde la nube de datos de salud de Google.
4. **Sistema de Moralidad y Consistencia:**
   * Diseñar un histórico en base de datos para calcular rachas de hábitos.
   * Adaptar el shader o coloreado de Phaser en `BootScene.js` para aplicar el brillo celestial (rachas positivas) o el sombreado oscuro (abandono de hábitos).
