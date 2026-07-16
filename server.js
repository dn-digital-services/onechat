/*
=========================================
OneChat
Static File Server + FCM Notification API
=========================================
*/

const http = require("http");
const fs = require("fs");
const path = require("path");
const https = require("https");
const crypto = require("crypto");

const PORT = process.env.PORT || 5000;
const ROOT = __dirname;

const MIME_TYPES = {
    ".html": "text/html",
    ".css": "text/css",
    ".js": "text/javascript",
    ".json": "application/json",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
};

// ==========================================================================
// Firebase ID Token Verification
// Verifies a Firebase ID token (JWT) by fetching Google's public certificates
// and checking the RS256 signature, issuer, audience, and expiry.
// Returns the caller's UID on success, throws on failure.
// ==========================================================================

let _googlePublicKeys = null;
let _googleKeysExpiry = 0;

function fetchGooglePublicKeys(){
    return new Promise((resolve, reject) => {
        const req = https.request({
            hostname: "www.googleapis.com",
            path: "/robot/v1/metadata/x509/securetoken%40system.gserviceaccount.com",
            method: "GET",
        }, (res) => {
            let data = "";
            res.on("data", (c) => data += c);
            res.on("end", () => {
                try {
                    // Parse max-age from Cache-Control to know when to refetch
                    const cc = res.headers["cache-control"] || "";
                    const ma = (cc.match(/max-age=(\d+)/) || [])[1];
                    const ttl = ma ? Number(ma) * 1000 : 3600000;
                    _googlePublicKeys = JSON.parse(data);
                    _googleKeysExpiry = Date.now() + ttl;
                    resolve(_googlePublicKeys);
                } catch(e){ reject(e); }
            });
        });
        req.on("error", reject);
        req.end();
    });
}

async function getGooglePublicKeys(){
    if(_googlePublicKeys && Date.now() < _googleKeysExpiry) return _googlePublicKeys;
    return fetchGooglePublicKeys();
}

// Minimal JWT decode (no library) – does NOT verify signature, used only
// to extract the kid/alg header and the payload before we verify below.
function decodeJWTParts(token){
    const parts = token.split(".");
    if(parts.length !== 3) throw new Error("Invalid JWT format");
    const header = JSON.parse(Buffer.from(parts[0], "base64").toString("utf8"));
    const payload = JSON.parse(Buffer.from(parts[1], "base64").toString("utf8"));
    return { header, payload, sigInput: parts[0] + "." + parts[1], signature: parts[2] };
}

async function verifyFirebaseIdToken(idToken, projectId){
    const keys = await getGooglePublicKeys();
    const { header, payload, sigInput, signature } = decodeJWTParts(idToken);

    // Basic claim checks (fast path before expensive crypto)
    const now = Math.floor(Date.now() / 1000);
    if(payload.exp <= now) throw new Error("Token expired");
    if(payload.iat > now + 300) throw new Error("Token issued in the future");
    const expectedIss = `https://securetoken.google.com/${projectId}`;
    if(payload.iss !== expectedIss) throw new Error("Invalid issuer");
    if(payload.aud !== projectId) throw new Error("Invalid audience");
    if(!payload.sub) throw new Error("Missing subject");

    // Signature verification using the matching public key
    const cert = keys[header.kid];
    if(!cert) throw new Error("Unknown key id");

    const verify = crypto.createVerify("RSA-SHA256");
    verify.update(sigInput);
    const sigBuf = Buffer.from(signature, "base64");
    const valid = verify.verify(cert, sigBuf);
    if(!valid) throw new Error("Signature verification failed");

    return payload.sub; // uid
}

// ==========================================================================
// FCM v1 – send a push notification using a service account JWT
// ==========================================================================

let _cachedAccessToken = null;
let _tokenExpiry = 0;

function base64url(buf){
    return buf.toString("base64")
        .replace(/=/g, "")
        .replace(/\+/g, "-")
        .replace(/\//g, "_");
}

function makeJWT(serviceAccountEmail, privateKey){
    const now = Math.floor(Date.now() / 1000);
    const header = base64url(Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })));
    const payload = base64url(Buffer.from(JSON.stringify({
        iss: serviceAccountEmail,
        scope: "https://www.googleapis.com/auth/firebase.messaging",
        aud: "https://oauth2.googleapis.com/token",
        iat: now,
        exp: now + 3600,
    })));
    const sigInput = `${header}.${payload}`;
    const sign = crypto.createSign("RSA-SHA256");
    sign.update(sigInput);
    const signature = base64url(Buffer.from(sign.sign(privateKey)));
    return `${sigInput}.${signature}`;
}

function fetchAccessToken(serviceAccountEmail, privateKey){
    return new Promise((resolve, reject) => {
        const jwt = makeJWT(serviceAccountEmail, privateKey);
        const body = new URLSearchParams({
            grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
            assertion: jwt,
        }).toString();

        const req = https.request({
            hostname: "oauth2.googleapis.com",
            path: "/token",
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "Content-Length": Buffer.byteLength(body),
            },
        }, (res) => {
            let data = "";
            res.on("data", (chunk) => data += chunk);
            res.on("end", () => {
                try {
                    const parsed = JSON.parse(data);
                    if(parsed.access_token){
                        resolve(parsed.access_token);
                    } else {
                        reject(new Error("No access_token in response: " + data));
                    }
                } catch(e){ reject(e); }
            });
        });

        req.on("error", reject);
        req.write(body);
        req.end();
    });
}

async function getAccessToken(serviceAccount){
    const now = Date.now();
    if(_cachedAccessToken && now < _tokenExpiry - 60000){
        return _cachedAccessToken;
    }
    const token = await fetchAccessToken(serviceAccount.client_email, serviceAccount.private_key);
    _cachedAccessToken = token;
    _tokenExpiry = now + 3600 * 1000;
    return token;
}

function sendFCMNotification(projectId, accessToken, { token, title, body, data }){
    return new Promise((resolve, reject) => {
        const message = {
            message: {
                token,
                notification: { title, body },
                data: Object.fromEntries(
                    Object.entries(data || {}).map(([k, v]) => [k, String(v)])
                ),
                android: { priority: "high" },
                apns: { payload: { aps: { sound: "default", badge: 1 } } },
                webpush: {
                    headers: { Urgency: "high" },
                    notification: { icon: "/logo.PNG", badge: "/logo.PNG" },
                },
            },
        };

        const payload = JSON.stringify(message);
        const req = https.request({
            hostname: "fcm.googleapis.com",
            path: `/v1/projects/${projectId}/messages:send`,
            method: "POST",
            headers: {
                "Authorization": `Bearer ${accessToken}`,
                "Content-Type": "application/json",
                "Content-Length": Buffer.byteLength(payload),
            },
        }, (res) => {
            let data = "";
            res.on("data", (chunk) => data += chunk);
            res.on("end", () => {
                if(res.statusCode >= 200 && res.statusCode < 300){
                    resolve(data);
                } else {
                    reject(new Error(`FCM HTTP ${res.statusCode}: ${data}`));
                }
            });
        });

        req.on("error", reject);
        req.write(payload);
        req.end();
    });
}

// ==========================================================================
// HTTP Server
// ==========================================================================

const server = http.createServer((req, res) => {

    // ── POST /api/notify – send FCM push notification ──────────────────────────
    if(req.method === "POST" && req.url === "/api/notify"){

        let body = "";
        req.on("data", (chunk) => body += chunk);
        req.on("end", async () => {

            res.setHeader("Content-Type", "application/json");

            // ── 1. Verify caller presents a valid Firebase ID token ────────────
            const authHeader = req.headers["authorization"] || "";
            const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";

            if(!idToken){
                res.writeHead(401);
                res.end(JSON.stringify({ ok: false, error: "Missing Authorization header" }));
                return;
            }

            const projectId = process.env.FIREBASE_PROJECT_ID || "";
            const apiKey = process.env.FIREBASE_API_KEY || "";

            if(!projectId || !apiKey){
                res.writeHead(503);
                res.end(JSON.stringify({ ok: false, error: "Server not configured" }));
                return;
            }

            let callerUid;
            try {
                callerUid = await verifyFirebaseIdToken(idToken, projectId);
            } catch(err){
                res.writeHead(403);
                res.end(JSON.stringify({ ok: false, error: "Invalid or expired ID token" }));
                return;
            }

            // ── 2. Parse and strictly validate the payload ─────────────────────
            let payload;
            try {
                payload = JSON.parse(body);
            } catch(e){
                res.writeHead(400);
                res.end(JSON.stringify({ ok: false, error: "Invalid JSON body" }));
                return;
            }

            const { token, title, body: msgBody, data } = payload;

            if(!token || typeof token !== "string" || token.length > 4096){
                res.writeHead(400);
                res.end(JSON.stringify({ ok: false, error: "Missing or invalid token field" }));
                return;
            }
            if(!msgBody || typeof msgBody !== "string"){
                res.writeHead(400);
                res.end(JSON.stringify({ ok: false, error: "Missing body field" }));
                return;
            }

            // ── 3. Verify caller is one of the chat participants ───────────────
            // The data.chatId field carries the chatId; a chatId is always two
            // UIDs sorted lexicographically joined by "_", so we can derive it
            // from callerUid + receiverUid and confirm the caller belongs there.
            const chatId = (data && data.chatId) ? String(data.chatId) : "";
            if(!chatId || !chatId.includes("_")){
                res.writeHead(400);
                res.end(JSON.stringify({ ok: false, error: "Missing or invalid chatId" }));
                return;
            }
            const parts = chatId.split("_");
            if(!parts.includes(callerUid)){
                res.writeHead(403);
                res.end(JSON.stringify({ ok: false, error: "Caller is not a chat participant" }));
                return;
            }

            // ── 4. Send the notification ───────────────────────────────────────
            const saJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
            if(!saJson){
                // FCM env not configured — silently succeed so the app still
                // works without push notifications set up.
                res.writeHead(200);
                res.end(JSON.stringify({ ok: true, skipped: true, reason: "FCM not configured" }));
                return;
            }

            try {
                const serviceAccount = JSON.parse(saJson);
                const accessToken = await getAccessToken(serviceAccount);
                await sendFCMNotification(projectId, accessToken, {
                    token,
                    title: String(title || "OneChat").slice(0, 100),
                    body: String(msgBody).slice(0, 200),
                    data: {
                        uid: String((data && data.uid) || ""),
                        name: String((data && data.name) || "").slice(0, 60),
                        chatId,
                    },
                });
                res.writeHead(200);
                res.end(JSON.stringify({ ok: true }));
            } catch(err){
                console.error("FCM send failed:", err.message);
                res.writeHead(500);
                res.end(JSON.stringify({ ok: false, error: err.message }));
            }

        });

        return;
    }

    // ── GET /firebase-config.js – inject Firebase env vars ────────────────────
    if(req.url.split("?")[0] === "/firebase-config.js"){

        const config = {
            apiKey: process.env.FIREBASE_API_KEY || "",
            authDomain: process.env.FIREBASE_AUTH_DOMAIN || "",
            projectId: process.env.FIREBASE_PROJECT_ID || "",
            storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "",
            messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "",
            appId: process.env.FIREBASE_APP_ID || "",
            vapidKey: process.env.FIREBASE_VAPID_KEY || "",
        };

        res.writeHead(200, {
            "Content-Type": "text/javascript",
            "Cache-Control": "no-cache",
        });

        res.end(`export const firebaseConfig = ${JSON.stringify(config)};\n`);
        return;

    }

    // ── Static file serving ────────────────────────────────────────────────────
    let urlPath = decodeURIComponent(req.url.split("?")[0]);

    if(urlPath === "/"){
        urlPath = "/index.html";
    }

    const filePath = path.join(ROOT, urlPath);

    if(!filePath.startsWith(ROOT)){
        res.writeHead(403);
        res.end("Forbidden");
        return;
    }

    fs.readFile(filePath, (err, data) => {

        if(err){
            res.writeHead(404, { "Content-Type": "text/html" });
            res.end("<h1>404 Not Found</h1>");
            return;
        }

        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || "application/octet-stream";

        res.writeHead(200, {
            "Content-Type": contentType,
            "Cache-Control": "no-cache",
        });

        res.end(data);

    });

});

server.listen(PORT, "0.0.0.0", () => {
    console.log(`OneChat static server running on port ${PORT}`);
});
