# Global Market Hours

Panel estático y responsive para visualizar, en tiempo real, las sesiones
regulares de nueve bolsas importantes del mundo.

## Funcionalidades

- Reloj local que avanza continuamente.
- Geolocalización del navegador con alternativa segura si el permiso se rechaza.
- Mercados abiertos, próximo mercado en abrir y próximo en cerrar.
- Cuenta regresiva actualizada cada segundo.
- Línea temporal de 24 horas convertida a la zona horaria del dispositivo.
- Mapa mundial con el mismo color de cada mercado y estados abiertos/cerrados.
- Adaptación completa para escritorio, tablet y teléfono.
- Sin backend, claves privadas, compilación ni dependencias.

## Publicar en GitHub Pages

1. Creá un repositorio nuevo en GitHub.
2. Subí a la raíz del repositorio `index.html`, `styles.css`, `app.js`,
   `favicon.svg`, `.nojekyll` y este `README.md`.
3. Entrá en **Settings → Pages**.
4. En **Build and deployment**, elegí **Deploy from a branch**.
5. Seleccioná la rama `main`, la carpeta `/ (root)` y guardá.

GitHub publicará la dirección en pocos minutos. La geolocalización funciona allí
porque GitHub Pages utiliza HTTPS.

## Alcance de los horarios

La página calcula sesiones bursátiles regulares de lunes a viernes y respeta
automáticamente los cambios de horario de verano mediante zonas IANA. No incluye
feriados bursátiles, cierres anticipados, suspensiones extraordinarias, subastas
ni sesiones extendidas. Antes de usarla para operar, verificá el calendario
oficial de cada bolsa.

El nombre de la ubicación se consulta desde el navegador mediante el servicio de
geocodificación de OpenStreetMap. La aplicación no almacena la ubicación.
