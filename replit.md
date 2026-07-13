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
- `updates.html` — dark status/updates feed (add-status row, "Recent updates" with story rings, collapsible "Viewed updates"), guarded/bottom nav
- `calls.html` — dark call log screen (Call/Schedule/Keypad/Favourites quick actions + recent calls with incoming/outgoing/missed icons), same guard/bottom nav
- `communities.html` — dark empty-state screen ("New community" CTA, illustration), same guard/bottom nav
- `home.html` — dark WhatsApp-style chat list (search, filter chips, mock conversations) + bottom nav (guarded: redirects to `welcome.html` if onboarding not completed)
- `profile.html` — dark settings screen (Account, Privacy, Chats, Appearance, Notifications, Payments, Storage and data, Help and feedback, Invite a friend, Accounts Centre) + logout, same guard/bottom nav

`updates.html`, `calls.html`, `communities.html`, `home.html`, and `profile.html` share a dark WhatsApp-inspired visual style (scoped CSS variables prefixed `--dark-*` inside each screen's root class) with hand-drawn SVG line icons instead of emoji, and an identical 5-tab bottom nav (Updates, Calls, Communities, Chats, You) linking to each other.

Shared styles: `variables.css` (design tokens), `global.css` (reset), `responsive.css`, `animations.css`. Each screen also has its own `<name>.css` and `<name>.js`. `app.js` is a shared script include (currently empty, kept for consistency with the original file layout).

## Running
Static files are served by `server.js` (plain Node `http` server, no dependencies) on port 5000, bound via the `Start application` workflow (`node server.js`).

## User preferences
None recorded yet.
