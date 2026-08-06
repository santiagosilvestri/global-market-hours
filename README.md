# Global Market Hours

Panel estático y responsive para visualizar, en tiempo real, las sesiones
regulares de diez bolsas importantes del mundo.

## Funcionalidades

- Reloj local que avanza continuamente.
- Barra superior limpia, con marca y acceso a personalización.
- Geolocalización del navegador con alternativa segura si el permiso se rechaza.
- Resumen de mercados abiertos, próximo mercado en abrir y próximo en cerrar.
- Cuenta regresiva actualizada cada segundo.
- Línea temporal de 24 horas convertida a la zona horaria del dispositivo.
- Mapa mundial con el mismo color de cada mercado y estados abiertos/cerrados.
- Panel de calendario bursátil activo por defecto, con próximos feriados por mercado.
- Cartografía vectorial local con continentes reales y globo centrado en la
  ubicación autorizada del usuario.
- Incluye Bolsas y Mercados Argentinos (BYMA), Buenos Aires.
- Adaptación completa para escritorio, tablet y teléfono.
- Personalización con caída contextual: sobre el divisor crea una fila; al costado une tarjetas en la misma fila.
- Arrastre desde cualquier zona no interactiva de la tarjeta.
- Redistribución automática: todas las filas ocupan siempre las diez columnas disponibles.
- Previsualización estable sin reordenar el tablero continuamente durante el arrastre.
- Sin backend, claves privadas, compilación ni dependencias.

## Publicar en GitHub Pages

1. Creá un repositorio nuevo en GitHub.
2. Subí a la raíz del repositorio `index.html`, `styles.css`, `app.js`,
`favicon.svg`, `.nojekyll`, `layout.js`, la carpeta `vendor/` y este
   `README.md`.
3. Entrá en **Settings → Pages**.
4. En **Build and deployment**, elegí **Deploy from a branch**.
5. Seleccioná la rama `main`, la carpeta `/ (root)` y guardá.

GitHub publicará la dirección en pocos minutos. La geolocalización funciona allí
porque GitHub Pages utiliza HTTPS.

## Alcance de los horarios

La página calcula sesiones bursátiles regulares de lunes a viernes, respeta
automáticamente los cambios de horario de verano mediante zonas IANA, y tiene
en cuenta los feriados de cierre completo de cada bolsa para 2026 (ver
sección siguiente). No incluye cierres anticipados, suspensiones
extraordinarias, subastas ni sesiones extendidas. Antes de usarla para
operar, verificá siempre el calendario oficial de cada bolsa.

El nombre de la ubicación se consulta desde el navegador mediante el servicio de
geocodificación de OpenStreetMap. La aplicación no almacena la ubicación.

## Feriados bursátiles (2026)

Cada mercado tiene su lista de feriados de cierre completo para 2026 en
`app.js` (constante `HOLIDAYS_2026`). Cuando el día actual es feriado para una
bolsa, esa bolsa se muestra como cerrada (con la etiqueta "Feriado" en vez de
"Cerrado"), el timeline no dibuja una sesión ese día, y el cálculo de
"próximo en abrir" salta correctamente al siguiente día hábil. El panel
"Horas globales" también avisa si el feriado de una bolsa es hoy o está
dentro de los próximos 21 días. El panel opcional "Calendario bursátil"
muestra los próximos cierres y permite filtrarlos por mercado.

**Este dato no se actualiza solo.** Es una lista fija verificada en agosto de
2026 contra las fuentes oficiales de cada bolsa/regulador (calendarios
publicados con anticipación, con posibilidad de cambios menores):

- NYSE: comunicado de NYSE Group / ICE (nyse.com/markets/hours-calendars)
- LSE: calendario de feriados bursátiles del Reino Unido
- XETRA/Fráncfort: calendario oficial de Deutsche Börse (PDF de trading calendar 2026)
- TSE: Japan Exchange Group, página oficial "Market Holidays"
- HKEX: circular oficial de The Stock Exchange of Hong Kong Limited
- SSE (Shanghái): circulares de la CSRC / China Financial Futures Exchange sobre el calendario nacional 2026
- NSE (Mumbai): calendario oficial NSE/BSE 2026 (vía circular de bróker registrado)
- ASX (Sídney): feriados públicos de NSW (la ASX sigue el calendario de Nueva Gales del Sur)
- B3 (São Paulo): comunicado oficial de B3 sobre el calendario de feriados 2026
- BYMA (Buenos Aires): calendario de feriados nacionales de Argentina (Ley 27.399 y Decreto 614/2025), que es el que sigue BYMA

Para 2027 en adelante, esta lista queda vieja y hay que revisarla y
actualizarla a mano una vez al año.

## Datos geográficos y horarios

Los contornos del mapa y del globo se incluyen localmente a partir de datos de
Natural Earth, distribuidos por `world-atlas`; las licencias de los componentes
geográficos están dentro de `vendor/`. El horario regular mostrado para BYMA es
10:30–17:00 (GMT-3), según su [tabla oficial de horarios](https://www.byma.com.ar/mercado/horarios).

## Tipografía

Los números protagonistas (reloj local, contadores, mercados abiertos y
calendario) usan Space Grotesk, empaquetada localmente en
`vendor/fonts/` (licencia OFL en `vendor/LICENSE-space-grotesk.txt`). El resto
de la interfaz usa la tipografía del sistema del dispositivo. No hay ninguna
solicitud a Google Fonts ni a otro servicio externo en tiempo de ejecución.

## Personalizar el layout

El botón "Personalizar" de la topbar abre un panel para:

- Reordenar los 6 módulos con los controles de la lista o directamente sobre el dashboard.
  En modo personalización se puede iniciar el arrastre desde cualquier zona no
  interactiva de la tarjeta, incluido su centro. Los botones, enlaces y campos
  conservan su comportamiento normal.
- Unir varios módulos en una misma fila. Al soltar un panel junto a otro, la
  previsualización verde indica que se incorporará a esa fila y, si hace falta,
  reduce su ancho hasta el espacio disponible.
- Ajustar el ancho de cada módulo con los controles `− / +`. La grilla usa
  10 unidades y redistribuye el espacio restante entre los módulos vecinos,
  conservando sus proporciones siempre que sea posible. Nunca quedan huecos
  laterales en una fila.
- Redistribuir el ancho entre vecinos arrastrando los divisores verticales. El
  movimiento se realiza de a una columna y respeta el ancho mínimo legible de
  cada tipo de contenido.
- Afinar cualquier fila desde su divisor horizontal, incluida la última. La
  altura cambia en pasos de 12 px y nunca baja del mínimo real requerido para
  mostrar el contenido. Un doble clic devuelve esa fila a altura automática.
- Mantener el tablero estable mientras se arrastra: la posición de las demás
  tarjetas no cambia durante el gesto. El nuevo orden se aplica una sola vez al
  soltar y utiliza una transición breve.
- Elegir seis visualizaciones funcionalmente diferentes como punto de partida:
  - **Equilibrada:** todos los módulos y las diez plazas visibles.
  - **Compacta:** dos filas, sin mapa y con cinco relojes globales principales.
  - **Ampliada:** sesiones y horas globales en filas completas, con mayor espacio de lectura.
  - **Detallada:** todos los módulos, todas las plazas y filas amplias para mapa y calendario.
  - **Minimalista:** solo hora local, resumen y línea global de sesiones.
  - **Panorámica:** composición horizontal para monitor ancho y cinco relojes de referencia.
- Las animaciones de reordenamiento usan una transición adaptativa: más breve en móvil y táctil,
  respetan `prefers-reduced-motion` y mantienen ocultos los divisores hasta que la geometría final esté estable.
- Mostrar u ocultar módulos y seleccionar qué bolsas aparecen dentro de
  "Horas globales". Siempre queda al menos un módulo visible.
- Restablecer el orden, los anchos y las alturas originales.

La respuesta del contenido se calcula por el ancho real de cada panel, no solo
por el ancho de la ventana. Por eso el reloj local, el resumen, el calendario y
las tarjetas de horarios cambian a variantes compactas cuando comparten poco
espacio. A partir de 760 px o menos, la página se apila automáticamente en una
sola columna, ignora las alturas fijas de escritorio y conserva únicamente el
orden y la visibilidad. Así una personalización de escritorio no recorta el
contenido en tablet angosta o teléfono.

Todo se guarda en `localStorage` (clave `gmh:layout:v4`) en el propio
navegador. La configuración persiste al recargar, pero es específica de cada
dispositivo y navegador porque no existe una cuenta ni un backend que la
sincronice.

## Horas globales

El panel "Horas globales" muestra la hora en vivo de las 10 bolsas en
tarjetas compactas (grilla responsiva), cada una con:

- Hora local con segundos, en la misma tipografía que el resto de los
  números protagonistas.
- Estado (Abierto / Cerrado / Feriado) y día de la semana en esa plaza,
  con un aviso "ayer" o "mañana" cuando la plaza ya cruzó la medianoche
  respecto a tu zona horaria.
- Un acento de color por bolsa (el mismo que en el mapa y el timeline) que
  se ilumina cuando el mercado está abierto.
- Aviso de "Feriado hoy" o "Próximo feriado" cuando cae dentro de los
  próximos 21 días.
- Un sutil oscurecimiento cuando son horas nocturnas (antes de las 6 o
  después de las 20) en esa plaza.

## Calendario bursátil

El panel "Calendario bursátil" queda activo por defecto y puede ocultarse desde
"Personalizar". Muestra los próximos feriados de cierre completo para los
mercados cargados, con filtro por bolsa, fecha, mercado, motivo y una etiqueta
rápida ("Hoy", "Mañana", "Esta semana" o "Próximo"). Usa la misma lista de
feriados 2026 que el estado de mercados y el timeline.


## Visualizaciones

La personalización incluye seis visualizaciones predefinidas con nombres descriptivos:

- Equilibrada: distribución general y balanceada; es la vista recomendada.
- Compacta: concentra más información en menos filas.
- Ampliada: da mayor tamaño a los módulos con más contenido.
- Detallada: mantiene todos los módulos visibles con una lectura más extensa.
- Minimalista: reduce elementos secundarios y conserva lo esencial.
- Panorámica: aprovecha monitores anchos y una distribución horizontal.

Cada visualización guarda orden, visibilidad, anchos y alturas. En móvil los paneles se apilan automáticamente.


## Mejoras de interacción v16

- Las filas se normalizan automáticamente a 10 columnas después de ocultar,
  mover o redimensionar una tarjeta.
- El arrastre puede comenzar desde el cuerpo de la tarjeta; las zonas
  interactivas quedan excluidas para evitar acciones accidentales.
- Durante el movimiento se muestra una guía superpuesta. Las demás tarjetas no
  se reordenan hasta que se suelta el módulo.
- El procesamiento del puntero se limita a un ciclo por frame para reducir
  parpadeos y cambios de destino demasiado rápidos.
- La distribución y los tamaños continúan guardándose en `localStorage`.


## Ajustes de personalización v16

- Todas las filas visibles se recalculan para sumar siempre las 10 columnas.
- Una tarjeta soltada entre filas crea una fila nueva y ocupa el ancho completo.
- Si se mueve u oculta una tarjeta, las restantes se expanden proporcionalmente.
- Se eliminaron los botones superpuestos de seis puntos y de expansión, junto con el tirador antiguo de la lista.
- El arrastre del tablero se realiza desde cualquier zona no interactiva de la tarjeta.


## Corrección integral v16

- Se corrigió el inicio explícito de fila para que conserve el ancho configurado.
  Antes, una tarjeta nueva podía guardar `10/10` pero mostrarse visualmente en
  una sola columna por una colisión entre propiedades de CSS Grid.
- Se añadió un margen de seguridad al cálculo de altura mínima para evitar
  recortes por redondeos subpíxel, carga de fuentes y cambios responsivos.
- Se validaron las seis plantillas, ocultación y reaparición de módulos,
  inserción entre filas, inserción lateral, divisores, persistencia y móvil.


## Ajustes de visualización v17

- El selector ahora se denomina **Visualización**.
- Las opciones son Equilibrada, Compacta, Ampliada, Detallada, Minimalista y Panorámica.
- Durante el reacomodo de una tarjeta se ocultan los divisores verticales y horizontales.
- Los divisores se reconstruyen dos frames después de terminar la animación, utilizando la geometría final de CSS Grid.
- Se cancelan animaciones anteriores antes de iniciar una nueva para evitar posiciones transitorias acumuladas.
