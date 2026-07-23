import {
    db,
    storage,
    auth,
    doc,
    getDoc,
    setDoc,
    updateDoc,
    deleteDoc,
    writeBatch,
    collection,
    addDoc,
    query,
    orderBy,
    onSnapshot,
    serverTimestamp,
    increment,
    arrayUnion,
    ref,
    uploadBytesResumable,
    getDownloadURL,
    requireAuthAndOnboarding,
} from "./firebase.js";

window.addEventListener("load", async () => {

    const session = await requireAuthAndOnboarding("welcome.html");

    if(!session) return;

    const { user, profile } = session;

    const params = new URLSearchParams(window.location.search);

    const otherUid = params.get("uid");
    const nameFromParams = params.get("name") || "OneChat User";

    if(!otherUid || otherUid === user.uid){
        window.location.href = "home.html";
        return;
    }

    const chatId = ocChatIdFor(user.uid, otherUid);

    const chatDocRef = doc(db, "chats", chatId);
    const messagesRef = collection(chatDocRef, "messages");
    const otherUserRef = doc(db, "users", otherUid);

    await setDoc(chatDocRef, {
        participants: [user.uid, otherUid],
        unreadCount: { [user.uid]: 0, [otherUid]: 0 },
        typing: { [user.uid]: false, [otherUid]: false },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    }, { merge: true });

    document.getElementById("chatName").textContent = nameFromParams;

    const chatSubtitle = document.getElementById("chatSubtitle");
    const presenceDot = document.getElementById("presenceDot");
    const chatAvatar = document.getElementById("chatAvatar");

    ocApplyAvatar(chatAvatar, ocGetInitials(nameFromParams), "");

    let otherProfile = {};
    let otherIsTyping = false;

    function renderSubtitle(){

        if(otherIsTyping){
            chatSubtitle.innerHTML = `<span class="typing-dots"><span></span><span></span><span></span></span> typing...`;
            return;
        }

        if(ocIsOnline(otherProfile)){
            chatSubtitle.textContent = "Online";
            presenceDot.classList.remove("hidden");
        } else {
            chatSubtitle.textContent = ocFormatLastSeen(otherProfile);
            presenceDot.classList.add("hidden");
        }

    }

    onSnapshot(otherUserRef, (snap) => {

        if(!snap.exists()) return;

        otherProfile = snap.data();

        const name = otherProfile.displayName || nameFromParams;
        document.getElementById("chatName").textContent = name;

        ocApplyAvatar(chatAvatar, ocGetInitials(name), otherProfile.photoURL);

        renderSubtitle();

    }, (err) => console.error("Failed to watch contact presence:", err));

    document.getElementById("backBtn").addEventListener("click", () => {
        setTyping(false);
        window.location.href = "home.html";
    });

    chatAvatar.parentElement.style.cursor = "pointer";

    document.getElementById("chatTitleBtn").addEventListener("click", () => {

        const p = new URLSearchParams({
            chatId,
            name: document.getElementById("chatName").textContent,
            subtitle: "tap for contact info",
            number: otherProfile.phone || "",
        });

        window.location.href = `contact-info.html?${p.toString()}`;

    });

    const messagesEl = document.getElementById("chatMessages");

    // ── Icons ──────────────────────────────────────────────────────────────────

    const ICONS = {
        share: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6"/><path d="M16 6l-4-4-4 4"/><path d="M12 2v14"/></svg>`,
        sentTick: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12l5 5L20 6"/></svg>`,
        deliveredTicks: `<svg class="tick-delivered" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12l4 4L14 8"/><path d="M9 12l4 4 9-10"/></svg>`,
        readTicks: `<svg class="tick-read" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12l4 4L14 8"/><path d="M9 12l4 4 9-10"/></svg>`,
        lock: `<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>`,
        play: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`,
    };

    function statusTicksHtml(status){
        if(status === "seen") return ICONS.readTicks;
        if(status === "delivered") return ICONS.deliveredTicks;
        return ICONS.sentTick;
    }

    function escapeHtml(str){
        const div = document.createElement("div");
        div.textContent = str || "";
        return div.innerHTML;
    }

    function addDateDivider(label){
        const el = document.createElement("div");
        el.className = "date-divider";
        el.textContent = label;
        messagesEl.appendChild(el);
    }

    function addSystemNote(icon, html){
        const el = document.createElement("div");
        el.className = "system-note";
        el.innerHTML = `${icon}<span class="system-note-text">${html}</span>`;
        messagesEl.appendChild(el);
    }

    function addDeletedMessage({ outgoing }){
        const row = document.createElement("div");
        row.className = "msg-row " + (outgoing ? "outgoing" : "incoming");
        row.innerHTML = `<div class="bubble text deleted-msg">
            <span class="msg-body"><em>🚫 This message was deleted</em></span>
        </div>`;
        messagesEl.appendChild(row);
    }

    function addFileMessage({ msgId, outgoing, fileName, meta, fileURL, time, status }){

        const row = document.createElement("div");
        row.className = "msg-row " + (outgoing ? "outgoing" : "incoming");
        row.dataset.msgId = msgId;
        row.dataset.outgoing = outgoing ? "1" : "0";

        row.innerHTML = `
            <span class="share-btn">${ICONS.share}</span>
            <div class="bubble">
                <div class="file-preview">
                    <div class="thumb"></div>
                    <div class="file-row">
                        <span class="file-icon">${(fileName || "").split(".").pop().toUpperCase().slice(0,4) || "DOC"}</span>
                        <div class="file-info">
                            <div class="file-name">${escapeHtml(fileName)}</div>
                            <div class="file-meta">${escapeHtml(meta || "")}</div>
                        </div>
                        ${fileURL ? `<a class="file-dl-btn" href="${fileURL}" download="${escapeHtml(fileName)}" target="_blank" title="Download">↓</a>` : ""}
                    </div>
                </div>
                <span class="bubble-time">${time} ${outgoing ? statusTicksHtml(status) : ""}</span>
            </div>
        `;

        bindLongPress(row);
        messagesEl.appendChild(row);

    }

    function addImageMessage({ msgId, outgoing, fileURL, time, status }){

        const row = document.createElement("div");
        row.className = "msg-row " + (outgoing ? "outgoing" : "incoming");
        row.dataset.msgId = msgId;
        row.dataset.outgoing = outgoing ? "1" : "0";

        row.innerHTML = `
            <span class="share-btn">${ICONS.share}</span>
            <div class="bubble">
                <div class="image-preview clickable-media" data-url="${fileURL || ""}">
                    ${fileURL ? `<img src="${fileURL}" alt="Photo" loading="lazy">` : "<div class='img-placeholder'>📷</div>"}
                </div>
                <span class="bubble-time">${time} ${outgoing ? statusTicksHtml(status) : ""}</span>
            </div>
        `;

        if(fileURL){
            row.querySelector(".clickable-media").addEventListener("click", () => openMediaViewer(fileURL, "image"));
        }

        bindLongPress(row);
        messagesEl.appendChild(row);

    }

    function addVideoMessage({ msgId, outgoing, fileURL, time, status }){

        const row = document.createElement("div");
        row.className = "msg-row " + (outgoing ? "outgoing" : "incoming");
        row.dataset.msgId = msgId;
        row.dataset.outgoing = outgoing ? "1" : "0";

        row.innerHTML = `
            <span class="share-btn">${ICONS.share}</span>
            <div class="bubble">
                <div class="video-preview clickable-media" data-url="${fileURL || ""}">
                    <video src="${fileURL || ""}" preload="metadata" class="video-thumb"></video>
                    <div class="video-play-overlay">${ICONS.play}</div>
                </div>
                <span class="bubble-time">${time} ${outgoing ? statusTicksHtml(status) : ""}</span>
            </div>
        `;

        if(fileURL){
            row.querySelector(".clickable-media").addEventListener("click", () => openMediaViewer(fileURL, "video"));
        }

        bindLongPress(row);
        messagesEl.appendChild(row);

    }

    function addTextMessage({ msgId, outgoing, message, time, status }){

        const row = document.createElement("div");
        row.className = "msg-row " + (outgoing ? "outgoing" : "incoming");
        row.dataset.msgId = msgId;
        row.dataset.outgoing = outgoing ? "1" : "0";

        row.innerHTML = `
            <div class="bubble text">
                <span class="msg-body">${escapeHtml(message)}<span class="time-spacer">${time}</span></span>
                <span class="bubble-time">${time} ${outgoing ? statusTicksHtml(status) : ""}</span>
            </div>
        `;

        bindLongPress(row);
        messagesEl.appendChild(row);

    }

    function scrollToBottom(){
        messagesEl.scrollTop = messagesEl.scrollHeight;
    }

    // ── Media Viewer ───────────────────────────────────────────────────────────

    const mediaViewer = document.getElementById("mediaViewer");
    const mediaViewerBody = document.getElementById("mediaViewerBody");
    const mediaViewerDownload = document.getElementById("mediaViewerDownload");
    const mediaViewerClose = document.getElementById("mediaViewerClose");

    function openMediaViewer(url, type){
        mediaViewerBody.innerHTML = "";
        mediaViewerDownload.href = url;

        if(type === "video"){
            const vid = document.createElement("video");
            vid.src = url;
            vid.controls = true;
            vid.autoplay = true;
            vid.className = "viewer-video";
            mediaViewerBody.appendChild(vid);
        } else {
            const img = document.createElement("img");
            img.src = url;
            img.className = "viewer-image";
            mediaViewerBody.appendChild(img);
        }

        mediaViewer.classList.remove("hidden");
        document.body.style.overflow = "hidden";
    }

    function closeMediaViewer(){
        mediaViewer.classList.add("hidden");
        document.body.style.overflow = "";
        // Pause any video
        const vid = mediaViewerBody.querySelector("video");
        if(vid) vid.pause();
        mediaViewerBody.innerHTML = "";
    }

    mediaViewerClose.addEventListener("click", closeMediaViewer);
    mediaViewer.addEventListener("click", (e) => {
        if(e.target === mediaViewer) closeMediaViewer();
    });

    // ── Context Menu (Long-press / Right-click) ────────────────────────────────

    const contextMenu = document.getElementById("msgContextMenu");
    const ctxDeleteForMe = document.getElementById("ctxDeleteForMe");
    const ctxDeleteForEveryone = document.getElementById("ctxDeleteForEveryone");
    const ctxCancel = document.getElementById("ctxCancel");

    let activeContextMsgId = null;
    let activeContextOutgoing = false;

    function showContextMenu(msgId, outgoing, x, y){
        activeContextMsgId = msgId;
        activeContextOutgoing = outgoing;

        ctxDeleteForEveryone.classList.toggle("hidden", !outgoing);

        contextMenu.classList.remove("hidden");

        // Position the menu, keeping it inside the viewport
        const mw = contextMenu.offsetWidth || 180;
        const mh = contextMenu.offsetHeight || 120;

        let left = Math.min(x, window.innerWidth - mw - 8);
        let top = Math.min(y, window.innerHeight - mh - 8);

        contextMenu.style.left = Math.max(8, left) + "px";
        contextMenu.style.top = Math.max(8, top) + "px";
    }

    function hideContextMenu(){
        contextMenu.classList.add("hidden");
        activeContextMsgId = null;
    }

    document.addEventListener("click", (e) => {
        if(!contextMenu.contains(e.target)) hideContextMenu();
    });

    ctxCancel.addEventListener("click", hideContextMenu);

    ctxDeleteForMe.addEventListener("click", async () => {
        // Capture msgId BEFORE hideContextMenu() clears activeContextMsgId
        const msgId = activeContextMsgId;
        if(!msgId) return;
        hideContextMenu();
        try {
            const msgRef = doc(messagesRef, msgId);
            await updateDoc(msgRef, { deletedFor: arrayUnion(user.uid) });
        } catch(err){ console.error("Delete for Me failed:", err); }
    });

    ctxDeleteForEveryone.addEventListener("click", async () => {
        // Capture msgId BEFORE hideContextMenu() clears activeContextMsgId
        const msgId = activeContextMsgId;
        if(!msgId) return;
        hideContextMenu();
        try {
            const msgRef = doc(messagesRef, msgId);
            await updateDoc(msgRef, { deleted: true, message: "This message was deleted", fileURL: null });
        } catch(err){ console.error("Delete for Everyone failed:", err); }
    });

    function bindLongPress(row){

        let timer = null;

        function start(x, y){
            timer = setTimeout(() => {
                const msgId = row.dataset.msgId;
                const outgoing = row.dataset.outgoing === "1";
                if(msgId) showContextMenu(msgId, outgoing, x, y);
            }, 500);
        }

        function cancel(){
            if(timer){ clearTimeout(timer); timer = null; }
        }

        row.addEventListener("touchstart", (e) => {
            const t = e.touches[0];
            start(t.clientX, t.clientY);
        }, { passive: true });

        row.addEventListener("touchend", cancel, { passive: true });
        row.addEventListener("touchmove", cancel, { passive: true });

        row.addEventListener("contextmenu", (e) => {
            e.preventDefault();
            const msgId = row.dataset.msgId;
            const outgoing = row.dataset.outgoing === "1";
            if(msgId) showContextMenu(msgId, outgoing, e.clientX, e.clientY);
        });

    }

    // ── Messages Snapshot ──────────────────────────────────────────────────────

    addSystemNote(ICONS.lock, "Messages are private to this conversation. Only you and the other participant can see them.");

    let firstSnapshot = true;

    onSnapshot(query(messagesRef, orderBy("timestamp")), (snap) => {

        Array.from(messagesEl.querySelectorAll(".msg-row, .date-divider")).forEach((el) => el.remove());

        addDateDivider("Today");

        const batch = writeBatch(db);
        let hasUpdates = false;
        let sawUnseenIncoming = false;

        snap.forEach((docSnap) => {

            const msgId = docSnap.id;
            const msg = docSnap.data();
            const outgoing = msg.senderId === user.uid;
            const time = ocFormatMessageTime(msg.timestamp);

            // Skip messages deleted for this user
            if(msg.deletedFor && msg.deletedFor.includes(user.uid)){
                return;
            }

            // Deleted for everyone – show placeholder
            if(msg.deleted){
                addDeletedMessage({ outgoing });
                return;
            }

            if(msg.type === "file"){
                addFileMessage({ msgId, ...msg, outgoing, time });
            } else if(msg.type === "image"){
                addImageMessage({ msgId, ...msg, outgoing, time });
            } else if(msg.type === "video"){
                addVideoMessage({ msgId, ...msg, outgoing, time });
            } else {
                addTextMessage({ msgId, ...msg, outgoing, time });
            }

            // Mark incoming messages as "seen" while the chat is open
            if(!outgoing && msg.status !== "seen"){
                batch.update(docSnap.ref, { status: "seen" });
                hasUpdates = true;
                sawUnseenIncoming = true;
            }

        });

        if(hasUpdates){

            batch.commit().catch((err) => console.error("Failed to update message status:", err));

            updateDoc(chatDocRef, {
                [`unreadCount.${user.uid}`]: 0,
                ...(sawUnseenIncoming ? { lastMessageStatus: "seen" } : {}),
            }).catch((err) => console.error("Failed to reset unread count:", err));

        } else if(firstSnapshot){

            updateDoc(chatDocRef, { [`unreadCount.${user.uid}`]: 0 }).catch(() => {});

        }

        firstSnapshot = false;

        scrollToBottom();

    }, (err) => console.error("Failed to load messages:", err));

    // ── Typing indicator ───────────────────────────────────────────────────────

    let typingState = false;
    let typingTimeout = null;

    function setTyping(state){

        if(typingState === state) return;
        typingState = state;

        updateDoc(chatDocRef, { [`typing.${user.uid}`]: state }).catch(() => {});

    }

    onSnapshot(chatDocRef, (snap) => {

        if(!snap.exists()) return;

        const data = snap.data();

        otherIsTyping = !!(data.typing && data.typing[otherUid]);

        renderSubtitle();

    }, (err) => console.error("Failed to watch typing status:", err));

    const messageInput = document.getElementById("messageInput");
    const sendBtn = document.getElementById("sendBtn");

    messageInput.addEventListener("input", () => {

        if(messageInput.value.trim().length > 0){
            setTyping(true);
            clearTimeout(typingTimeout);
            typingTimeout = setTimeout(() => setTyping(false), 2000);
        } else {
            clearTimeout(typingTimeout);
            setTyping(false);
        }

    });

    // ── Participant info denormalisation ───────────────────────────────────────

    async function refreshMyDenormalizedInfo(){

        await updateDoc(chatDocRef, {
            [`participantInfo.${user.uid}`]: {
                displayName: profile.displayName || "OneChat User",
                photoURL: profile.photoURL || "",
                phone: profile.phone || "",
            },
        }).catch(() => {});

    }

    // ── FCM notification helper ────────────────────────────────────────────────

    async function notifyOtherUser(payload){
        try {
            const snap = await getDoc(otherUserRef);
            if(!snap.exists()) return;
            const fcmToken = snap.data().fcmToken;
            if(!fcmToken) return;

            // Get a fresh Firebase ID token to authenticate the /api/notify call
            const idToken = await auth.currentUser.getIdToken();

            await fetch("/api/notify", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${idToken}`,
                },
                body: JSON.stringify({
                    token: fcmToken,
                    title: profile.displayName || "OneChat",
                    body: payload.body,
                    data: {
                        uid: user.uid,
                        name: profile.displayName || "OneChat User",
                        chatId,
                    },
                }),
            });
        } catch(err){
            // Non-critical – notifications best-effort
            console.warn("FCM notify failed:", err);
        }
    }

    // ── Send text message ──────────────────────────────────────────────────────

    async function sendTextMessage(){

        const value = messageInput.value.trim();

        if(!value) return;

        messageInput.value = "";
        clearTimeout(typingTimeout);
        setTyping(false);

        await addDoc(messagesRef, {
            type: "text",
            senderId: user.uid,
            receiverId: otherUid,
            message: value,
            status: "sent",
            timestamp: serverTimestamp(),
        });

        await updateDoc(chatDocRef, {
            lastMessage: value,
            lastMessageType: "text",
            lastMessageSenderId: user.uid,
            lastMessageStatus: "sent",
            updatedAt: serverTimestamp(),
            [`unreadCount.${otherUid}`]: increment(1),
        });

        refreshMyDenormalizedInfo();
        notifyOtherUser({ body: value });

    }

    sendBtn.addEventListener("click", sendTextMessage);

    messageInput.addEventListener("keydown", (e) => {

        if(e.key === "Enter"){
            e.preventDefault();
            sendTextMessage();
        }

    });

    // ── Upload progress ────────────────────────────────────────────────────────

    const uploadBar   = document.getElementById("uploadProgressBar");
    const uploadFill  = document.getElementById("uploadProgressFill");
    const uploadLabel = document.getElementById("uploadProgressLabel");

    function showUploadProgress(percent){
        uploadBar.classList.remove("hidden");
        const pct = Math.min(100, Math.round(percent));
        uploadFill.style.width = pct + "%";
        uploadLabel.textContent = pct >= 100 ? "Processing…" : `Uploading ${pct}%`;
    }

    function hideUploadProgress(){
        uploadBar.classList.add("hidden");
        uploadFill.style.width = "0%";
    }

    // ── Send media file (image / video / document) ─────────────────────────────
    // Uses uploadBytesResumable for real progress reporting and built-in retry.
    // Storage path: chats/{chatId}/files/… (covered by storage.rules).

    async function sendFile(file, _attempt){

        if(!file) return;

        const attempt = _attempt || 0;

        const isImage = file.type.startsWith("image/");
        const isVideo = file.type.startsWith("video/");

        // Build a safe filename; fall back to a timestamp-based name.
        const rawName = (file.name || "").replace(/[/\\]/g, "_") || (
            isImage ? `photo_${Date.now()}.jpg`
          : isVideo ? `video_${Date.now()}.mp4`
          : `file_${Date.now()}`
        );

        const storagePath = `chats/${chatId}/files/${Date.now()}_${rawName}`;
        const storageRef  = ref(storage, storagePath);

        sendBtn.disabled = true;
        showUploadProgress(0);

        let url;

        try {

            url = await new Promise((resolve, reject) => {

                const task = uploadBytesResumable(storageRef, file);

                task.on(
                    "state_changed",

                    // Progress callback — real bytes, no fake timer.
                    (snapshot) => {
                        const pct = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                        showUploadProgress(pct);
                    },

                    // Error callback.
                    (err) => reject(err),

                    // Completion callback — get download URL here so any error
                    // is caught by the same promise rejection path.
                    () => {
                        getDownloadURL(task.snapshot.ref)
                            .then(resolve)
                            .catch(reject);
                    },
                );

            });

        } catch(err){

            hideUploadProgress();
            sendBtn.disabled = false;

            // Retry once on transient network / server errors.
            const transient = [
                "storage/retry-limit-exceeded",
                "storage/canceled",
                "storage/unknown",
            ].includes(err.code) || /network|fetch|timeout/i.test(err.message || "");

            if(attempt === 0 && transient){
                console.warn("Upload failed (attempt 1), retrying…", err.code || err.message);
                return sendFile(file, 1);
            }

            // Log the exact Firebase error for debugging.
            console.error("File upload failed:", err.code || "no-code", err.message || err);

            let msg = `Upload failed.\nError: ${err.code || "unknown"}\n${err.message || ""}`.trim();
            if(err.code === "storage/unauthorized")
                msg = `Upload denied — Firebase Storage rules rejected the path.\nCode: ${err.code}\n${err.message}`;
            else if(err.code === "storage/quota-exceeded")
                msg = "Storage quota exceeded. Free up space in Firebase console.";
            else if(err.code === "storage/invalid-argument")
                msg = "Invalid file — please choose a different file.";

            alert(msg);
            return;

        }

        // ── Upload complete; url is the permanent download URL ─────────────────

        showUploadProgress(100);

        const base = {
            senderId:   user.uid,
            receiverId: otherUid,
            status:     "sent",
            timestamp:  serverTimestamp(),
            fileURL:    url,
        };

        let msgType    = "file";
        let lastMsg    = rawName;
        let notifyBody = "📎 File";

        try {

            if(isImage){
                msgType    = "image";
                lastMsg    = "Photo";
                notifyBody = "📷 Photo";
                await addDoc(messagesRef, { ...base, type: "image", message: "Photo" });

            } else if(isVideo){
                msgType    = "video";
                lastMsg    = "Video";
                notifyBody = "🎥 Video";
                await addDoc(messagesRef, { ...base, type: "video", message: "Video" });

            } else {
                const sizeKb = Math.max(1, Math.round(file.size / 1024));
                const ext    = (rawName.split(".").pop() || "file").toUpperCase().slice(0, 6);
                await addDoc(messagesRef, {
                    ...base,
                    type:     "file",
                    message:  rawName,
                    fileName: rawName,
                    meta:     `${sizeKb} KB · ${ext}`,
                });
            }

            await updateDoc(chatDocRef, {
                lastMessage:         lastMsg,
                lastMessageType:     msgType,
                lastMessageSenderId: user.uid,
                lastMessageStatus:   "sent",
                updatedAt:           serverTimestamp(),
                [`unreadCount.${otherUid}`]: increment(1),
            });

            refreshMyDenormalizedInfo();
            notifyOtherUser({ body: notifyBody });

        } catch(err){

            console.error("Failed to save message after upload:", err.code || "", err.message || err);
            alert(`Media uploaded but message save failed.\nError: ${err.code || err.message}`);

        } finally {

            hideUploadProgress();
            sendBtn.disabled = false;

        }

    }

    // ── Attachment options menu ────────────────────────────────────────────────

    const attachMenu = document.getElementById("attachMenu");
    const attachInput = document.getElementById("attachInput");
    const cameraInput = document.getElementById("cameraInput");
    const docInput    = document.getElementById("docInput");

    function toggleAttachMenu(e){
        e.stopPropagation();
        attachMenu.classList.toggle("hidden");
    }

    function closeAttachMenu(){
        attachMenu.classList.add("hidden");
    }

    document.getElementById("attachBtn").addEventListener("click", toggleAttachMenu);

    // Dismiss the menu when clicking anywhere else
    document.addEventListener("click", (e) => {
        if(!attachMenu.contains(e.target) && e.target !== document.getElementById("attachBtn")){
            closeAttachMenu();
        }
    });

    document.getElementById("menuOptCamera").addEventListener("click", () => {
        closeAttachMenu();
        cameraInput.click();
    });

    document.getElementById("menuOptGallery").addEventListener("click", () => {
        closeAttachMenu();
        attachInput.click();
    });

    document.getElementById("menuOptDocument").addEventListener("click", () => {
        closeAttachMenu();
        docInput.click();
    });

    document.getElementById("cameraBtn").addEventListener("click", () => {
        cameraInput.click();
    });

    attachInput.addEventListener("change", (e) => {
        const file = e.target.files && e.target.files[0];
        if(file) sendFile(file);
        attachInput.value = "";
    });

    cameraInput.addEventListener("change", (e) => {
        const file = e.target.files && e.target.files[0];
        if(file) sendFile(file);
        cameraInput.value = "";
    });

    docInput.addEventListener("change", (e) => {
        const file = e.target.files && e.target.files[0];
        if(file) sendFile(file);
        docInput.value = "";
    });

    window.addEventListener("beforeunload", () => setTyping(false));
    window.addEventListener("pagehide", () => setTyping(false));

});
