# OneChat

## Overview
OneChat is a WhatsApp-style messaging app built with HTML/CSS/JS on the front-end, backed by Firebase (Auth, Firestore, Storage, Cloud Messaging). The server (`server.js`) is a plain Node.js HTTP server with no npm dependencies that serves static files and provides a single POST `/api/notify` endpoint for sending FCM push notifications.

## Screens & Flow
- `index.html` → `splash.html` (auto-redirects after 1.5 s)
- `splash.html` → `welcome.html`
- `welcome.html` → `login.html` (phone OTP)
- `login.html` → `otp.html` (6-digit OTP entry)
- `otp.html`:
  - **New user** → `signup.html` (collect name/photo/email/about)
  - **Returning user** (already `onboarded: true`) → `home.html`
- `signup.html` → `permissions.html` (sets `onboarded: true`) → `home.html`
- `home.html` — chat list (search, unread filter, delivered-status management)
- `new-chat.html` — search by phone number or name
- `chat.html` — 1-to-1 conversation (messages, media, delete, typing, presence)
- `contact-info.html`, `status-view.html`, `updates.html`, `calls.html`, `communities.html`, `profile.html`, `myprofile.html`

## Running
`node server.js` on port 5000 (configured in the `Start application` workflow).

## Backend: Firebase
All Firebase config comes from environment variables injected at `/firebase-config.js` by server.js.

| Env var | Required | Purpose |
|---------|----------|---------|
| `FIREBASE_API_KEY` | ✅ | Firebase project API key |
| `FIREBASE_AUTH_DOMAIN` | ✅ | Firebase auth domain |
| `FIREBASE_PROJECT_ID` | ✅ | Firebase project ID |
| `FIREBASE_STORAGE_BUCKET` | ✅ | Firebase Storage bucket |
| `FIREBASE_MESSAGING_SENDER_ID` | ✅ | Firebase Cloud Messaging sender ID |
| `FIREBASE_APP_ID` | ✅ | Firebase app ID |
| `FIREBASE_VAPID_KEY` | ⭐ FCM | Web Push VAPID key (from Firebase Console → Cloud Messaging) |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | ⭐ FCM | Full service account JSON (for server-side FCM sending) |

### Firebase Console setup checklist
1. **Authentication** → Sign-in method → Enable **Phone**
2. **Authentication** → Settings → **Authorised domains** → add your Replit dev domain + deployed domain
3. **Firestore** → Rules → paste `firestore.rules`
4. **Storage** → Rules → paste `storage.rules`
5. **Cloud Messaging** → Web configuration → generate **VAPID key** → set `FIREBASE_VAPID_KEY`
6. **Project settings** → Service accounts → Generate new private key → set as `FIREBASE_SERVICE_ACCOUNT_JSON`

## Firestore Schema
```
users/{uid}
  - phone, displayName, email, photoURL, about, username, links
  - online (bool), lastSeen (timestamp)
  - onboarded (bool), permissions (map)
  - fcmToken (string, updated on login)
  - createdAt, updatedAt

chats/{chatId}   (chatId = sorted UIDs joined by "_")
  - participants: [uid, uid]
  - participantInfo: { uid: { displayName, photoURL, phone } }
  - unreadCount: { uid: number }
  - typing: { uid: bool }
  - lastMessage, lastMessageType, lastMessageSenderId, lastMessageStatus
  - createdAt, updatedAt

chats/{chatId}/messages/{msgId}
  - type: "text" | "image" | "video" | "file"
  - senderId, receiverId
  - message, fileURL, fileName, meta
  - status: "sent" | "delivered" | "seen"
  - deleted: bool (Delete for Everyone)
  - deletedFor: [uid, …] (Delete for Me)
  - timestamp
```

## Features implemented
- ✅ OTP Phone login (Firebase Auth)
- ✅ Sign-up page for new users (name, photo, email, about)
- ✅ Profile propagates to all chats automatically on update
- ✅ Search by phone number or name
- ✅ One-to-one chat with real-time Firestore
- ✅ Online / Offline / Last Seen presence (heartbeat-based)
- ✅ Typing indicator
- ✅ Single tick (Sent) / Double grey tick (Delivered) / Double blue tick (Read)
  - Delivered: marked when recipient's home screen loads (updates individual message docs)
  - Read: marked when recipient opens the chat
- ✅ Emoji support
- ✅ Media sharing: images, videos, documents
  - Upload progress bar
  - Full-screen media viewer with download
- ✅ Camera capture (photo + video)
- ✅ Gallery selection (image + video)
- ✅ Long-press / right-click message context menu
  - Delete for Me (hidden from your view only)
  - Delete for Everyone (shows "This message was deleted" to both)
- ✅ Push Notifications via FCM
  - Service worker (`firebase-messaging-sw.js`)
  - Token saved to Firestore on login
  - Server endpoint `POST /api/notify` calls FCM v1 API using service account JWT

## User preferences
None recorded yet.
