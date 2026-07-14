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
- `home.html` — dark WhatsApp-style chat list (search, filter chips, mock conversations) + bottom nav (guarded: redirects to `welcome.html` if onboarding not completed); clicking a conversation opens `chat.html`
- `chat.html` — individual chat conversation screen (header with back+unread badge, avatar, encryption/disappearing-message notices, text/file/image message bubbles, working message input that sends new outgoing text bubbles and toggles mic→send icon while typing); tapping the header name/avatar opens `contact-info.html`
- `contact-info.html` — "Contact info" screen (avatar, name, number/status, Audio + Video quick actions only, Media/links/docs, Manage storage, Notifications, Chat theme, Disappearing messages, and a working Lock chat toggle); tapping the avatar opens a full-screen photo viewer
- `status-view.html` — full-screen status/story viewer opened from `updates.html`; shows progress bar, header (back, avatar, name, time, more menu), a quote-card status body (deterministic per contact), and a reply bar with quick emoji reactions + like button
- `myprofile.html` — editable "Profile" screen reached by tapping the profile card on `profile.html`; lets the user change their photo (via device file/camera picker, stored as a data URL in `localStorage`), display name, username, and links
- `profile.html` — dark settings screen (Account, Privacy, Chats, Appearance, Notifications, Payments, Storage and data, Help and feedback, Invite a friend, Accounts Centre) + logout, same guard/bottom nav

`updates.html`, `calls.html`, `communities.html`, `home.html`, and `profile.html` share a dark WhatsApp-inspired visual style (scoped CSS variables prefixed `--dark-*` inside each screen's root class) with hand-drawn SVG line icons instead of emoji, and an identical 5-tab bottom nav (Updates, Calls, Communities, Chats, You) linking to each other.

Shared styles: `variables.css` (design tokens), `global.css` (reset), `responsive.css`, `animations.css`. Each screen also has its own `<name>.css` and `<name>.js`. `app.js` is a shared script include (currently empty, kept for consistency with the original file layout).

## Running
Static files are served by `server.js` (plain Node `http` server, no dependencies) on port 5000, bound via the `Start application` workflow (`node server.js`). `server.js` also has one dynamic route, `/firebase-config.js`, which reads the `FIREBASE_*` env vars at request time and emits them as an ES module.

## Backend: Firebase
The app now uses a real Firebase project (client SDK only, no server-side Admin SDK) for auth, data and file storage. Firebase is loaded via CDN ES modules (`https://www.gstatic.com/firebasejs/10.13.0/...`), initialized once in `firebase.js`, and imported by every page script (each page's `<script>` tag is now `type="module"`).

- **Auth**: Phone number + SMS OTP via Firebase Authentication (`signInWithPhoneNumber` + invisible reCAPTCHA in `login.js`, `PhoneAuthProvider.credential` + `signInWithCredential` in `otp.js`). The `verificationId` is handed off between `login.html` and `otp.html` via `sessionStorage` (the confirmation object itself can't survive a full page navigation). The password field on `login.html` is kept for UI parity but isn't sent to Firebase — phone auth doesn't use passwords.
  - **UI exception**: the OTP screen was changed from 4 boxes to 6, because Firebase's SMS codes are always 6 digits — 4 boxes made verification impossible. This is the one visual deviation from the original design.
  - Google's reCAPTCHA badge will appear on the login screen; this is required by Firebase phone auth and can't be removed while using it.
- **Firestore**: all data lives under `users/{uid}/...` so per-user Firestore rules stay simple (see `firestore.rules`). `users/{uid}` holds profile fields (`displayName`, `username`, `phone`, `about`, `links`, `photoURL`, `onboarded`, `permissions`). `users/{uid}/chats/{chatId}` holds each conversation's summary (`lastMessage`, `updatedAt`, `unreadCount`, etc.) and `users/{uid}/chats/{chatId}/messages/{msgId}` holds the message log. `home.js` and `chat.js` render live via `onSnapshot` — no polling, no manual refresh, matches the "instant update" requirement.
- **Storage**: profile photos (`myprofile.js`) and chat attachments (`chat.js`) upload to Firebase Storage under `users/{uid}/...` and store the resulting download URL in Firestore.
- **Contacts caveat**: this prototype never had a real contacts/friends system — the conversation list (Ava Thompson, Liam Chen, etc.) and the Updates list (Rahul Bro, etc.) are still fixed demo names, not real second Firebase accounts. They're seeded into each signed-in user's own `users/{uid}/chats` on first login so persistence/realtime is genuinely backed by Firestore (e.g. multi-tab/multi-device sync of your own message history), but you're always messaging into your own data, not a second real person. Adding real multi-user contacts would be a separate feature.
- **Security rules**: `firestore.rules` and `storage.rules` are included in the repo but were not deployed (no Firebase CLI credentials in this environment). Paste them into the Firebase console — Firestore Database → Rules, and Storage → Rules — to enforce the per-user access model.
- **Firebase console setup required**: enable "Phone" as a sign-in provider under Authentication → Sign-in method, and add this Repl's domain (and your published domain once deployed) under Authentication → Settings → Authorized domains, or phone sign-in will fail.

## User preferences
None recorded yet.
