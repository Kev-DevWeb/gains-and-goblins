PLAN DE DESARROLLO
MMORPG: Fable of Real Life
El RPG donde tu progreso real impulsa tu personaje

| Sin clases fijas - Sistema de progreso libre Stack: Phaser 3  \|  Node.js + Socket.IO  \|  PostgreSQL v2.0 - Junio 2026 |
| --- |


# 1. Resumen Ejecutivo

Este documento define el plan completo para desarrollar un MMORPG inspirado en Fable, con una mecanica central revolucionaria: el progreso del personaje esta ligado a actividades del mundo real. El juego no tiene clases fijas. Cada personaje puede empunar una espada, disparar un arco y lanzar hechizos al mismo tiempo, exactamente igual que en Fable, donde el jugador define su estilo de combate libremente segun lo que practica.

| La vision central: libertad total de progreso No hay clases. Todo personaje puede usar espada, arco y magia a la vez. Lo que el jugador practica en la vida real es lo que crece en el juego. Haz ejercicio y tu personaje golpea mas fuerte. Lee y aprende hechizos mas poderosos. Corre y tu arquero dispara mas rapido. Medita y resistes mas dano. Tu estilo de vida real se convierte en tu estilo de juego. |
| --- |

El proyecto esta disenado para ser desarrollado por una sola persona sin experiencia previa en videojuegos, con un enfoque incremental desde un prototipo hasta un juego completo. La recomendacion es desarrollarlo como aplicacion web para alcanzar cualquier dispositivo sin distribucion en tiendas.

# 2. Vision del Juego


## 2.1 Concepto Central: Sin Clases, Progreso Libre

Inspirado directamente en Fable, el personaje del jugador no pertenece a ninguna clase. Desde el primer dia tiene acceso a las tres ramas de combate: melee (espada/escudo), distancia (arco) y magia. Ninguna esta bloqueada. El jugador simplemente mejora lo que usa, y lo que usa esta determinado por lo que hace en la vida real.
Esto crea arquetipos organicos y unicos para cada jugador. Alguien que hace mucho ejercicio y tambien lee sera un guerrero-mago poderoso. Alguien que corre y medita sera un arquero espiritualmente sintonizado. Alguien que lo hace todo tendra un personaje verdaderamente versatil. Nadie tiene el mismo personaje porque nadie tiene los mismos habitos.

| La diferencia clave con sistemas de clases tradicionales En un RPG clasico eliges Guerrero y te cierran el acceso a la magia. En Fable of Real Life NUNCA se cierra nada. La espada, el arco y la magia siempre estan disponibles. Lo unico que cambia es cuan poderosa es cada rama segun tus habitos reales. Puedes cambiar tu estilo de vida y el personaje evolucionara contigo. |
| --- |


## 2.2 Las Tres Ramas de Combate y sus Fuentes de Progreso

Cada rama se alimenta de actividades del mundo real. No son excluyentes: el jugador puede desarrollar las tres simultaneamente.

| Rama de Combate | Estadisticas que mejora | Actividades del mundo real | Ejemplo de conversion |
| --- | --- | --- | --- |
| Espada / Melee | Fuerza, Resistencia, Vida maxima | Ejercicio de fuerza, pesas, flexiones, sentadillas, burpees | 20 flexiones = +4 Fuerza; 30 min pesas = +8 Fuerza |
| Arco / Distancia | Destreza, Precision, Velocidad de ataque | Cardio, correr, caminar, ciclismo, saltar la cuerda | 2 km corridos = +5 Destreza; 30 min bici = +6 Velocidad |
| Magia / Hechizos | Inteligencia, Mana, Poder magico | Lectura, estudio, aprender algo nuevo, cursos | 30 min leyendo = +6 Inteligencia; terminar un libro = hechizo nuevo |
| Resistencia Magica | Voluntad, Defensa magica, Regeneracion | Meditacion, respiracion consciente, yoga, journaling | 15 min meditacion = +5 Voluntad; 20 min yoga = +4 Defensa magica |


## 2.3 El Sistema de Afinidad Organica

Para reflejar que cada jugador se especializa naturalmente sin forzar una clase, existe el sistema de Afinidad Organica. El juego observa en que rama el jugador ha invertido mas tiempo en los ultimos 30 dias y otorga un bono pasivo llamado 'Afinidad del Momento'.

| Condicion de los ultimos 30 dias | Afinidad activa | Bono pasivo recibido |
| --- | --- | --- |
| Mas del 60% del tiempo en ejercicio fisico | Afinidad Guerrera | +15% dano melee, apariencia mas robusta y cicatrices visibles |
| Mas del 60% del tiempo en cardio/velocidad | Afinidad del Cazador | +15% velocidad de disparo, ojos mas agudos y postura agil |
| Mas del 60% del tiempo en lectura/estudio | Afinidad Arcana | +15% poder magico, aura de energia visible alrededor del personaje |
| Mas del 60% del tiempo en meditacion/yoga | Afinidad Espiritual | +15% regeneracion de vida y mana, apariencia serena y luminosa |
| Distribucion equilibrada entre ramas | Afinidad del Heroe | +8% a todo, apariencia de protagonista legendario al estilo Fable |

La Afinidad no bloquea nada: solo es un reflejo de los habitos recientes. Si el jugador cambia sus habitos, la Afinidad cambia con ellos en el siguiente ciclo de 30 dias.

## 2.4 Sistema de Moral (Inspirado en Fable)

- Apariencia dinamica: El personaje cambia visualmente segun la consistencia de sus habitos. Cumples tus metas 7 dias seguidos: tu personaje brilla. Abandonas tus metas por 2 semanas: tu personaje se oscurece, la armadura se ve deteriorada, aparecen sombras en los ojos.
- Moral en el juego: Las decisiones dentro del mundo de fantasia (ayudar NPCs, traicionar gremios, robar o defender) tambien afectan la apariencia y reputacion del personaje en el mundo.
- Reputacion en pueblos: Los NPCs recuerdan tus acciones. Un personaje con buenas habitos y moral positiva es recibido como heroe. Un personaje descuidado y de moral oscura genera miedo o desconfianza.

# 3. Web vs Motor de Videojuegos: Decision Tecnica


## 3.1 Comparacion de Opciones


| Criterio | Desarrollo Web | Unity | Godot | Unreal Engine |
| --- | --- | --- | --- | --- |
| Curva de aprendizaje | Baja-Media | Media-Alta | Media | Muy Alta |
| Sin experiencia previa | IDEAL | Manejable | Manejable | No recomendado |
| Tiempo al primer prototipo | 2-4 semanas | 2-3 meses | 1-2 meses | 4-6 meses |
| Distribucion | Navegador (universal) | Tienda / WebGL | Tienda / WebGL | Solo escritorio |
| MMORPG 2D | Excelente | Bueno | Bueno | Excesivo |
| Integracion APIs web (Google Fit) | Nativa (5 lineas) | Complicado | Complicado | Muy complicado |
| Multijugador en tiempo real | Socket.IO nativo | Requiere Mirror/Photon | Requiere plugin | EOS (complejo) |
| Costo | Gratis | Gratis/pago | Gratis | Gratis/royalties |


| Veredicto: Desarrollo Web sigue siendo la opcion correcta Para un MMORPG 2D sin clases con sistema de progreso por actividades reales, el stack web es superior en todos los criterios que importan: tiempo al primer prototipo, integracion con APIs de salud y multijugador. Unity y Godot son excelentes motores pero agregan complejidad innecesaria para este caso especifico. |
| --- |


# 4. Stack Tecnologico Completo


## 4.1 Frontend - Motor de Juego


| Tecnologia | Version | Uso en el proyecto | Dificultad |
| --- | --- | --- | --- |
| HTML5 / CSS3 | Standard | Interfaz de usuario, menus, HUD del juego | Basica |
| JavaScript ES2024 | Modern | Logica del juego en el cliente | Basica-Media |
| Phaser 3 | v3.70+ | Motor 2D: sprites, animaciones, mapas Tiled, fisica, combate | Media |
| Tiled Map Editor | v1.10 | Disenar los mapas del mundo de fantasia (gratuito) | Baja |
| React | v18+ | Pantallas de UI fuera del canvas: inventario, hechizos, perfil | Media |
| Tailwind CSS | v3 | Estilos de las pantallas de UI del juego | Baja |


## 4.2 Backend - Servidor del Juego


| Tecnologia | Uso en el proyecto | Dificultad |
| --- | --- | --- |
| Node.js v20+ | Servidor principal, logica de juego autoritativa, calculo de XP | Media |
| Express.js | API REST para login, perfil, datos de personaje, hechizos | Baja |
| Socket.IO v4 | Multijugador en tiempo real: posiciones, combate, chat de mundo | Media |
| JWT | Autenticacion y sesiones de usuario seguras | Media |
| Bcrypt | Encriptacion de contrasenas | Baja |


## 4.3 Base de Datos


| Tecnologia | Uso en el proyecto | Dificultad |
| --- | --- | --- |
| PostgreSQL 16 | Datos permanentes: usuarios, personajes, stats, hechizos, mundo | Media |
| Redis | Estado en tiempo real: jugadores online, sesiones, cache de hechizos activos | Media |
| Prisma ORM | Interfaz para interactuar con PostgreSQL desde Node.js sin SQL crudo | Baja-Media |


## 4.4 Sistema de Progreso Real - Integraciones


| Fuente de datos | Rama que alimenta | Tecnologia | Dificultad |
| --- | --- | --- | --- |
| Google Fit API | Espada (fuerza) + Arco (cardio) | OAuth 2.0 + REST API | Media |
| Apple HealthKit | Espada + Arco (dispositivos Apple) | Requiere wrapper iOS nativo | Alta |
| Fitbit Web API | Espada + Arco (pulseras Fitbit) | OAuth 2.0 + REST API | Media |
| Temporizador manual in-game | Magia (lectura) + Voluntad (meditacion) | JavaScript puro, sin API externa | Baja |
| Registro manual de actividad | Todas las ramas | Formulario simple en la UI del juego | Baja |
| Webhook de validacion anti-trampa | Todas las ramas | Verificacion cruzada entre fuentes | Alta |


| Estrategia de integracion recomendada para comenzar Empieza SOLO con el temporizador manual y registro manual. Eso te permite lanzar el MVP sin depender de APIs externas. Una vez el juego funciona bien, agrega Google Fit. Apple HealthKit dejalo para cuando tengas usuarios activos, ya que requiere publicar en la App Store. |
| --- |


## 4.5 Infraestructura y Despliegue


| Servicio | Proposito | Tier gratuito | Costo al crecer |
| --- | --- | --- | --- |
| Railway.app | Hosting del servidor Node.js | 500 horas/mes | $5-20/mes |
| Vercel | Hosting del frontend (React + Phaser) | Proyectos ilimitados | Gratis hasta gran escala |
| Supabase o Neon | PostgreSQL en la nube administrado | 2 proyectos, 500 MB | $25/mes |
| Upstash Redis | Redis en la nube para sesiones y cache | 10,000 req/dia | $10/mes |
| Cloudflare R2 | CDN para assets: sprites, mapas, audio | 10 GB gratis | $0.015/GB |
| GitHub | Control de versiones y CI/CD | Ilimitado en open source | Gratis |


## 4.6 Herramientas de Arte y Audio

- Aseprite ($20 pago unico): estandar de la industria para pixel art 2D. Ideal para sprites de personaje con las tres armas visibles (espada, arco, baston magico).
- LDtk (gratis): editor de niveles 2D moderno, alternativa a Tiled, compatible con Phaser 3.
- Kenney.nl (gratis): mas de 40,000 assets listos para usar, con paquetes especificos de fantasia medieval.
- Itch.io Asset Store: tienda de assets de pixel art, muchos de fantasia con personajes que usan espada, arco y magia.
- Freesound.org (gratis): efectos de sonido para espadas, flechas, hechizos y ambiente.
- LMMS (gratis): software para crear musica de fondo al estilo fantasia medieval.

# 5. Arquitectura del Sistema


## 5.1 Capas del Sistema


| Capa | Tecnologia | Responsabilidad |
| --- | --- | --- |
| Presentacion | Phaser 3 + React | Renderizar el mundo, animaciones de espada/arco/magia, menus |
| Logica cliente | JavaScript | Movimiento local, seleccion de arma, efectos visuales de hechizos |
| Tiempo real | Socket.IO | Sincronizar posiciones, combates, hechizos, chat del mundo |
| API REST | Express.js | Autenticacion, guardar progreso, cambiar equipamiento y hechizos |
| Logica de servidor | Node.js | Calcular XP por actividad, resolver combate autoritativamente |
| Persistencia | PostgreSQL | Personajes, stats de espada/arco/magia, hechizos aprendidos, mundo |
| Cache | Redis | Jugadores online, hechizos activos, sesiones de combate en curso |
| Actividades reales | Google Fit + manual | Convertir ejercicio/lectura/meditacion en XP por rama |


## 5.2 Modelo de Datos del Personaje (Sin Clases)

A diferencia de un RPG clasico donde las estadisticas dependen de la clase, aqui cada personaje tiene TODAS las estadisticas desde el inicio, solo que en valores bajos. No hay nada bloqueado.

| Estadistica | Rama | Valor inicial | Como sube | Efecto en juego |
| --- | --- | --- | --- | --- |
| Fuerza | Espada | 5 | Ejercicio de fuerza | Dano melee, capacidad de carga de armadura |
| Resistencia | Espada | 5 | Ejercicio intenso | Vida maxima, duracion en combate prolongado |
| Destreza | Arco | 5 | Cardio, correr | Velocidad de disparo, precision del arco, evasion |
| Velocidad | Arco | 5 | Cardio de alta intensidad | Movimiento en mapa, turnos de combate |
| Inteligencia | Magia | 5 | Lectura y estudio | Poder de hechizos, numero de hechizos equipables |
| Mana maximo | Magia | 20 | Lectura sostenida | Cuantos hechizos puedes lanzar antes de agotar |
| Voluntad | Meditacion | 5 | Meditacion, yoga | Resistencia magica, velocidad de regeneracion |
| Carisma | Social | 5 | Journaling, escritura | Mejores precios en tiendas, mas opciones de dialogo |


## 5.3 Flujo Completo: Actividad Real a Mejora de Personaje

- El jugador realiza una actividad en el mundo real (ej: 30 minutos de correr).
- Google Fit registra la actividad automaticamente O el jugador la registra manualmente en el juego.
- El jugador pulsa 'Sincronizar' en el menu del juego.
- El servidor consulta Google Fit con el token OAuth del jugador.
- El servidor valida la actividad (duracion, tipo, coherencia con historial).
- El servidor calcula el XP para la rama correspondiente segun la tabla de conversion.
- Las estadisticas de Destreza y Velocidad (rama Arco) aumentan en la base de datos.
- Si el umbral de nivel se supera, se desbloquea una nueva tecnica de arco o se mejora la precision.
- El cliente recibe la notificacion y muestra la animacion de progreso con el arco brillando.
- La Afinidad del Momento se recalcula en el ciclo de 30 dias segun el patron de actividades.

# 6. Plan de Desarrollo por Fases


| Filosofia del plan Cada fase produce algo JUGABLE. No avances a la siguiente hasta que la actual funcione bien. El MVP de la Fase 2 ya debe ser divertido: un personaje que se mueve, tiene espada/arco/magia basica, y cuyas estadisticas suben cuando haces ejercicio o lees. Simple, pero real. |
| --- |


## Fase 0 - Aprendizaje Fundacional (Meses 1-2)

Objetivo: Dominar las tecnologias base antes de escribir una linea del juego.

### Semanas 1-3: JavaScript Solido

- Recurso: javascript.info (mejor tutorial gratuito, disponible en espanol)
- Practica: Construir un rastreador de habitos en HTML/CSS/JS puro
- Meta: Manejar funciones, arrays, fetch a una API publica, DOM manipulation

### Semanas 4-5: Node.js y Express

- Recurso: Canal de Midudev en YouTube - serie de Node.js para principiantes
- Practica: API REST con registro/login usando JWT
- Meta: Servidor con autenticacion corriendo en localhost

### Semanas 6-7: Phaser 3

- Recurso: phaser.io/tutorials oficiales + canal Ourcade en YouTube
- Practica: Personaje que camina en un mapa de tiles con animaciones
- Meta: Personaje animado que se mueve en un pequeno dungeon

### Semana 8: PostgreSQL Basico

- Recurso: Tutorial gratuito de Prisma (prisma.io/docs)
- Practica: Crear el schema de base de datos del personaje
- Meta: Guardar y leer estadisticas de un personaje desde el juego

## Fase 1 - Prototipo Local Un Jugador (Meses 3-5)

Objetivo: Juego funcional para un jugador con el sistema de progreso por actividades, sin multijugador aun.

| Tarea | Semanas | Resultado |
| --- | --- | --- |
| Schema de base de datos: usuarios, personajes, stats unificadas (fuerza/destreza/inteligencia/voluntad), actividades | 1-2 | Base de datos lista |
| Sistema de autenticacion completo (registro, login, sesiones) | 2-3 | Login y perfil funcionando |
| Mapa inicial con Tiled: un pueblo pequeno y una zona de dungeon | 3-4 | Mundo explorable |
| Personaje con las tres opciones de combate visual: espada, arco y magia equipables | 4-5 | Cambio de arma funcional |
| Combate basico contra monstruos del dungeon (sin multijugador) | 5-6 | Puedes pelear y morir |
| HUD del juego: barras de vida/mana, estadisticas, arma equipada actualmente | 6 | Interfaz completa |
| Temporizador manual de actividades: lectura (magia) y meditacion (voluntad) | 7 | Primera actividad real funciona |
| Registro manual de ejercicio fisico (espada) y cardio (arco) | 7-8 | Las cuatro ramas registrables |
| Sistema de conversion actividad -> XP -> estadisticas -> efectos en combate | 8-9 | Ejercitar REALMENTE mejora al personaje |
| Sistema de Afinidad Organica: calcular bono del mes segun patron de actividades | 9-10 | Afinidad cambia con habitos |


## Fase 2 - MVP Multijugador Publicado (Meses 6-8)

Objetivo: Primera version en internet con multijugador basico y accesible a jugadores reales.

| Tarea | Semanas | Resultado |
| --- | --- | --- |
| Integracion Socket.IO: dos jugadores se ven en el mismo mapa en tiempo real | 1-3 | Multijugador basico |
| Chat del mundo (texto, emotes, notificaciones de logros de otros jugadores) | 3-4 | Comunicacion entre jugadores |
| Despliegue en Railway (backend) + Vercel (frontend) | 4-5 | Juego accesible desde internet |
| Sistema de gremios: crear, unirse, ver estadisticas colectivas del gremio | 5-7 | Gremios funcionando |
| Integracion con Google Fit API (ejercicio fisico y cardio automatico) | 7-9 | Actividad real automatizada |
| Sistema de moral y apariencia dinamica del personaje | 9-10 | Personaje cambia visualmente |
| Primera zona jugable completa: 10 misiones principales con combate real | 10-12 | Contenido para 3-5 horas de juego |


## Fase 3 - Expansion de Contenido (Meses 9-12)

Objetivo: Suficiente contenido para que los jugadores tengan razon de volver cada dia.
- Arbol de habilidades por rama: cada rama tiene tecnicas especiales desbloqueables. La espada puede aprender golpes especiales, el arco tecnicas de precision y la magia nuevos hechizos elementales.
- Combate en tiempo real entre jugadores (PvP): duelos en arenas donde se enfrentan estilos organicos distintos.
- Economia del mundo: tiendas, intercambio entre jugadores, subasta de equipamiento.
- Casas y propiedades: comprar y personalizar espacios en el mundo de fantasia.
- Retos de gremio colectivos: misiones donde el gremio entero debe cumplir metas de actividad real combinadas.
- Nuevas zonas: bosque encantado, costa y mar, mazmorras profundas, ciudad capital.
- Eventos del mundo: eventos temporales ligados a dias especiales (ano nuevo, etc.) con misiones especiales.
- Sistema de logros de habitos: medallas por 7, 30 y 100 dias consecutivos de actividad.
- Balance y testing: ajuste de la tabla de conversion actividad-XP basado en datos reales de jugadores.

# 7. Recursos de Aprendizaje


## 7.1 Cursos y Tutoriales


| Recurso | Tecnologia | Formato | Costo |
| --- | --- | --- | --- |
| javascript.info | JavaScript completo | Texto interactivo | Gratis |
| Midudev - YouTube | Node.js, JS, React | Videos en espanol | Gratis |
| Hola Mundo - YouTube | Programacion general | Videos en espanol | Gratis |
| FreeCodeCamp Espanol | JS, HTML, CSS, Node | Curso interactivo | Gratis |
| Phaser 3 Official Docs | Phaser 3 con ejemplos | Documentacion viva | Gratis |
| Ourcade - YouTube | Phaser 3 avanzado | Videos (ingles) | Gratis |
| The Odin Project | Full Stack Web completo | Curriculum estructurado | Gratis |
| Platzi - Node.js / PostgreSQL | Backend completo | Cursos en espanol | $30/mes |


## 7.2 Referencias de Diseno de Juego

- 'Game Programming Patterns' (gratis en gameprogrammingpatterns.com): Patrones de diseno aplicados a videojuegos. Lectura obligatoria.
- 'Designing Virtual Worlds' por Richard Bartle: El libro definitivo sobre diseno de MMORPGs, escrito por uno de sus creadores originales.
- 'The Art of Game Design' por Jesse Schell: El mejor libro sobre diseno de juego en general, explica como pensar en mecanicas.

## 7.3 Comunidades

- Discord de Midudev: comunidad hispana de desarrollo web muy activa y solidaria
- Phaser Forums (phaser.discourse.group): soporte oficial del motor, responden rapido
- r/gamedev en Reddit: comunidad internacional con devlogs, consejos y critica de diseno
- Itch.io devlogs: publica tu progreso publicamente para obtener retroalimentacion temprana
- Stack Overflow en Espanol: para resolver problemas tecnicos puntuales

# 8. Estimacion de Tiempo y Costos


## 8.1 Tiempo Segun Dedicacion


| Dedicacion semanal | Tiempo al MVP jugable | Tiempo a Version 1.0 |
| --- | --- | --- |
| 5-10 horas (tiempo parcial) | 10-14 meses | 2-3 anos |
| 15-20 horas (tiempo medio) | 6-9 meses | 12-18 meses |
| 30-40 horas (tiempo completo) | 4-6 meses | 9-12 meses |


## 8.2 Costos del Proyecto


| Concepto | Costo | Cuando |
| --- | --- | --- |
| Infraestructura (tier gratuito) | $0/mes | Durante desarrollo |
| Infraestructura (produccion activa) | $40-70/mes | Al tener usuarios activos |
| Aseprite (arte pixel) | $20 pago unico | Al empezar a crear sprites |
| Dominio propio (.com) | $10-15/ano | Al publicar publicamente |
| Assets de arte (Itch.io) | $0-50 segun necesidad | Opcional, Kenney.nl es gratis |
| TOTAL PRIMER ANO | ~$80-200 total | Muy accesible para un indie |


## 8.3 Riesgos Principales


| Riesgo | Mitigacion recomendada |
| --- | --- |
| Scope creep: querer agregar todo desde el inicio | Regla de hierro: el MVP solo tiene UNA actividad real (ejercicio) y DOS zonas del mundo |
| Abandono por lentitud del progreso | Publica devlogs cada 2 semanas, la comunidad te mantiene motivado |
| Apple HealthKit requiere app nativa iOS | Empieza solo con Google Fit y temporizador manual, iOS espera |
| Arte de baja calidad desmotiva | Usa assets de Kenney.nl desde el inicio, el arte propio llega en Fase 3 |
| Trampa en el sistema de actividades | Validacion con APIs reales primero, sistema de reporte de la comunidad despues |
| Equilibrio entre ramas (que una no domine) | La Afinidad Organica balancea esto naturalmente con sus bonos del 15% |


# 9. Hoja de Ruta


| Mes | Hito Principal | Lo que el jugador puede hacer |
| --- | --- | --- |
| 1-2 | Fase 0: Aprendizaje completado | Nada aun - es la base |
| 3-4 | Personaje con espada/arco/magia en mapa | Explorar, cambiar de arma, pelear NPCs basicos |
| 5 | Sistema de progreso real funciona (manual) | Registrar ejercicio y ver como suben las stats |
| 6 | Dos jugadores se ven en tiempo real | Explorar el mundo junto a otro jugador real |
| 7 | Juego publicado en internet | Cualquier persona puede acceder con un link |
| 8 | Google Fit integrado + gremios | El ejercicio mejora al personaje automaticamente |
| 9-10 | Zona completa con 10 misiones | 3-5 horas de contenido jugable real |
| 11-12 | Version 1.0 con economia y PvP | Juego completo listo para crecer |


| El consejo mas importante: empieza pequeno, termina algo No intentes construir un MMORPG completo desde el primer dia. Empieza con un personaje, un mapa pequeno, una sola actividad real (ejercicio fisico) y un solo tipo de combate (espada). Cuando ESO funcione y sea divertido, agrega el arco. Cuando ESO funcione, agrega la magia. Los grandes juegos se construyen una mecanica a la vez. La espada, el arco y la magia estaran en el juego final; no tienen que estar en el prototipo. |
| --- |


# 10. Primeros Pasos Concretos (Esta Semana)


## Paso 1: Instalar el entorno de desarrollo

- Instalar Visual Studio Code desde code.visualstudio.com
- Instalar Node.js LTS desde nodejs.org
- Instalar Git desde git-scm.com
- Crear cuenta en GitHub en github.com
- Instalar extensiones de VS Code: ESLint, Prettier, GitLens, Phaser 3 Snippets

## Paso 2: Primera linea de codigo

Crea una carpeta llamada 'fable-of-real-life'. Dentro crea un index.html que diga 'Hola, soy [nombre de tu personaje]' y abrir en el navegador. Ese es el dia 1.

## Paso 3: Tutorial oficial de Phaser 3

Ve a phaser.io/tutorials y completa 'Making your first Phaser 3 game'. Son 2-4 horas. Al terminar tendras un juego sencillo funcionando en tu navegador y entenderas como funciona el motor que usaras para todo el proyecto.

## Paso 4: Disena tu personaje en papel

Antes de escribir mas codigo, dibuja en papel (o en cualquier app) como quieres que se vea tu personaje con espada, con arco y con baston magico. Define sus tres 'poses' de combate. Eso te dara claridad visual de lo que vas a construir y te mantendra motivado cuando el codigo se ponga dificil.

## Paso 5: Publica un devlog

Crea una cuenta en itch.io y publica una entrada corta contando tu vision del juego. Pon capturas del tutorial de Phaser 3 que completaste. Esto no es opcional: la comunidad de desarrollo indie es enormemente solidaria y tener seguidores desde el dia 1 es el mejor antidoto contra el abandono.
Fable of Real Life - Plan de Desarrollo v2.0 (Sin Clases) - Junio 2026