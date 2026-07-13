# OneChat

## Overview
OneChat is a static HTML/CSS/JS front-end prototype for a messaging app. There is no backend — screens use `localStorage` to fake auth/onboarding state and in-memory mock data for chat previews.

## Screens
- `index.html` — redirects to `splash.html`
- `splash.html` → `welcome.html` (auto-redirect after logo animation)
- `welcome.html` — intro screen, "Get Started" → `login.html`
- `login.html` — phone/email + password form (no real auth) → `otp.html`
- `otp.html` — 4-digit code entry (any 4 digits work) → `permissions.html`
- `permissions.html` — toggle contacts/notifications/mic/camera → `home.html`
- `home.html` — mock chat list + bottom nav (guarded: redirects to `welcome.html` if onboarding not completed)
- `profile.html` — user profile + settings list + logout (same guard)

Shared styles: `variables.css` (design tokens), `global.css` (reset), `responsive.css`, `animations.css`. Each screen also has its own `<name>.css` and `<name>.js`. `app.js` is a shared script include (currently empty, kept for consistency with the original file layout).

## Running
Static files are served by `server.js` (plain Node `http` server, no dependencies) on port 5000, bound via the `Start application` workflow (`node server.js`).

## User preferences
None recorded yet.
