# Global Market Hours

A responsive static dashboard that shows the current local time, standard trading sessions for major world stock exchanges, and live countdowns until their next opening, break, resumption, or closing.

## Features

- Detects the visitor's IANA timezone automatically.
- Optional browser location permission from the local-time card.
- Compact top-bar clock that can switch between the user's time and each market's local time.
- Displays every open exchange in a complete list without truncation.
- Updates the main clock, market clocks, countdowns, and timeline marker every second.
- Calculates `Open`, `Closed`, and intraday `Break` states.
- Includes an hourly 24-hour timeline with responsive desktop and mobile layouts.
- Runs entirely in the browser with no backend or API key.

The location button uses the browser's Geolocation API only after the user clicks it. The displayed timezone is still read from the device because the project does not send coordinates to an external reverse-geocoding service.

## Run locally

You can open `index.html` directly, but using a small local server is recommended:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

## Publish on GitHub Pages

1. Create a new GitHub repository.
2. Upload `index.html`, `styles.css`, `app.js`, `favicon.svg`, and this README to the repository root.
3. Open **Settings → Pages**.
4. Under **Build and deployment**, select **Deploy from a branch**.
5. Choose the `main` branch and `/ (root)` folder.
6. Save. GitHub will display the public URL after deployment.

## Important limitation

This prototype uses standard Monday-to-Friday exchange hours. It does not yet include exchange holidays, early closes, emergency suspensions, or live price data. For a production trading tool, schedules should be sourced from an authoritative market-calendar service.
