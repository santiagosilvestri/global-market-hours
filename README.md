# Global Market Hours

A responsive static dashboard that shows the current local time, standard trading sessions for major world stock exchanges, and countdowns until their next opening or closing.

## Features

- Detects the visitor's IANA timezone automatically.
- Displays the current local time for every exchange and updates it every second.
- Calculates `Open`, `Closed`, and intraday `Break` states.
- Shows live countdowns until the next session transition.
- Includes a responsive local 24-hour market-session timeline with a moving current-time marker.
- Responsive desktop and mobile layouts.
- Runs entirely in the browser with no backend.

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

This prototype uses standard Monday-to-Friday exchange hours. It does not yet include exchange holidays, early closes, emergency suspensions, or live price data. For a production trading tool, schedules should be sourced from an authoritative calendar API.
