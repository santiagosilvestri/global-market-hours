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

- Reordenar los 6 bloques (Tu hora local, Resumen, Línea global de sesiones,
  Mapa de mercados, Horas globales y Calendario bursátil) arrastrando el ícono de agarre — tanto en
  la lista del panel como directamente sobre las tarjetas del dashboard — o
  con las flechas subir/bajar.
- Previsualizar el destino mientras se arrastra una tarjeta: el tablero hace
  lugar antes de soltar, aparece una sombra de colocación y la lista indica si
  el panel irá antes o después.
- Expandir automáticamente una tarjeta movida cuando cae en una fila con
  espacio sobrante, para que pueda ocupar el ancho disponible sin otro control.
- Elegir una plantilla de distribución completa: Compacto, Balanceado o Amplio.
  Son puntos de partida limpios para toda la grilla, no controles de tamaño por
  tarjeta.
- Ajustar el ancho sobre una grilla de 10 unidades arrastrando los divisores
  verticales entre paneles vecinos. Cada movimiento cambia de a una columna:
  un panel gana espacio y el panel de al lado lo cede. La barra activa acompaña
  el movimiento mientras se arrastra.
- Afinar la altura de una fila arrastrando los divisores horizontales entre
  filas. La fila superior cambia de a pasos de 12 px y la siguiente conserva
  su propia altura.
- Mostrar u ocultar cualquiera de los 6 bloques (el ícono del ojo). Siempre
  queda al menos uno visible. El Calendario bursátil se muestra por defecto.
- Elegir qué bolsas mostrar dentro de "Horas globales" — el listado con las
  10 bolsas aparece siempre debajo de esa fila, sin pasos adicionales.
- El globo 3D del panel "Tu hora local" queda siempre activo.
- "Restablecer diseño" vuelve todo al orden y tamaño original.

Todo se guarda en `localStorage` (clave `gmh:layout:v4`) en el propio
navegador — no hay backend ni cuenta de usuario, así que la configuración es
por dispositivo/navegador, no se sincroniza entre ellos. Tanto el arrastre
para reordenar como el arrastre para cambiar ancho/alto usan Pointer Events
(no el HTML5 Drag and Drop API). En pantallas chicas los divisores de resize se
ocultan para conservar una experiencia de una columna más simple.

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
