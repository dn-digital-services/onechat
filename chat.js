import {
    db,
    storage,
    doc,
    getDoc,
    updateDoc,
    collection,
    addDoc,
    query,
    orderBy,
    onSnapshot,
    serverTimestamp,
    ref,
    uploadBytes,
    getDownloadURL,
    requireAuthAndOnboarding,
} from "./firebase.js";

window.addEventListener("load", async () => {

    const session = await requireAuthAndOnboarding("welcome.html");

    if(!session) return;

    const { user } = session;

    const params = new URLSearchParams(window.location.search);

    const chatId = params.get("chatId") || "self";
    const name = params.get("name") || "OneChat User";
    const subtitle = params.get("subtitle") || "tap for contact info";
    const isSelf = params.get("self") === "1";
    const unread = parseInt(params.get("unread") || "0", 10);

    document.getElementById("chatName").textContent = name;
    document.getElementById("chatSubtitle").textContent = subtitle;

    const backBadge = document.getElementById("backBadge");

    if(unread > 0){
        backBadge.textContent = unread;
    } else {
        backBadge.classList.add("hidden");
    }

    const chatAvatar = document.getElementById("chatAvatar");
    const initials = ocGetInitials(name);

    if(isSelf){
        ocApplyAvatar(chatAvatar, initials, session.profile.photoURL);
    } else {
        chatAvatar.textContent = initials;
    }

    document.getElementById("backBtn").addEventListener("click", () => {
        window.location.href = "home.html";
    });

    document.getElementById("chatAvatar").parentElement.style.cursor = "pointer";

    document.getElementById("chatTitleBtn").addEventListener("click", () => {

        const query = new URLSearchParams({ chatId, name, subtitle });

        if(isSelf) query.set("self", "1");

        window.location.href = `contact-info.html?${query.toString()}`;

    });

    const messagesEl = document.getElementById("chatMessages");

    const ICONS = {

        lock: `<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>`,

        clock: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>`,

        share: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6"/><path d="M16 6l-4-4-4 4"/><path d="M12 2v14"/></svg>`,

        sentTick: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12l5 5L20 6"/></svg>`,

        readTicks: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12l4 4L14 8"/><path d="M9 12l4 4 9-10"/></svg>`,

    };

    function addDateDivider(label){
        const el = document.createElement("div");
        el.className = "date-divider";
        el.textContent = label;
        messagesEl.appendChild(el);
    }

    function addSystemNote(icon, html, muted){
        const el = document.createElement("div");
        el.className = "system-note" + (muted ? " muted" : "");
        el.innerHTML = `${icon}<span class="system-note-text">${html}</span>`;
        messagesEl.appendChild(el);
    }

    function addFileMessage({ outgoing, fileName, meta, time, status }){

        const row = document.createElement("div");
        row.className = "msg-row " + (outgoing ? "outgoing" : "incoming");

        row.innerHTML = `
            <span class="share-btn">${ICONS.share}</span>
            <div class="bubble">
                <div class="file-preview">
                    <div class="thumb"></div>
                    <div class="file-row">
                        <span class="file-icon">PDF</span>
                        <div class="file-info">
                            <div class="file-name">${fileName}</div>
                            <div class="file-meta">${meta || ""}</div>
                        </div>
                    </div>
                </div>
                <span class="bubble-time">${time} ${status === "read" ? `<span class="tick-read">${ICONS.readTicks}</span>` : status === "sent" ? ICONS.sentTick : ""}</span>
            </div>
        `;

        messagesEl.appendChild(row);

    }

    function addImageMessage({ outgoing, imageHtml, fileURL, time, status }){

        const row = document.createElement("div");
        row.className = "msg-row " + (outgoing ? "outgoing" : "incoming");

        const preview = fileURL ? `<img src="${fileURL}" alt="Photo" style="max-width:100%;border-radius:8px;display:block;">` : (imageHtml || "");

        row.innerHTML = `
            <span class="share-btn">${ICONS.share}</span>
            <div class="bubble">
                <div class="image-preview">${preview}</div>
                <span class="bubble-time">${time} ${status === "read" ? `<span class="tick-read">${ICONS.readTicks}</span>` : status === "sent" ? ICONS.sentTick : ""}</span>
            </div>
        `;

        messagesEl.appendChild(row);

    }

    function addTextMessage({ outgoing, text, time, status }){

        const row = document.createElement("div");
        row.className = "msg-row " + (outgoing ? "outgoing" : "incoming");

        const timeLabel = `${time}${outgoing ? " \u2713\u2713" : ""}`;

        row.innerHTML = `
            <div class="bubble text">
                <span class="msg-body">${escapeHtml(text)}<span class="time-spacer">${timeLabel}</span></span>
                <span class="bubble-time">${time} ${outgoing ? (status === "read" ? `<span class="tick-read">${ICONS.readTicks}</span>` : ICONS.sentTick) : ""}</span>
            </div>
        `;

        messagesEl.appendChild(row);

    }

    function escapeHtml(str){
        const div = document.createElement("div");
        div.textContent = str || "";
        return div.innerHTML;
    }

    function scrollToBottom(){
        messagesEl.scrollTop = messagesEl.scrollHeight;
    }

    function formatTime(ts){
        if(!ts) return "";
        const date = ts.toDate ? ts.toDate() : new Date(ts);
        return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    }

    const chatDocRef = doc(db, "users", user.uid, "chats", chatId);
    const messagesRef = collection(chatDocRef, "messages");

    // Seed the initial conversation history once per chat, mirroring the app's demo script.
    const chatSnap = await getDoc(chatDocRef);

    if(chatSnap.exists() && !chatSnap.data().seeded){

        const seedMsgs = isSelf ? [
            { type: "file", outgoing: true, fileName: "8B0D5E5B-8D90-4916-A16F-1F39985A6543.pdf", meta: "2 pages \u00b7 101 KB \u00b7 pdf", status: "sent" },
            {
                type: "image",
                outgoing: true,
                imageHtml: `<div style="background:#fff;padding:14px;font-family:Arial,sans-serif;"><div style="font-weight:800;font-size:22px;color:#0B2E6B;">DN <span style="color:#0B2E6B;">DIGITAL SERVICES</span></div><div style="font-size:10px;color:#0B2E6B;margin-top:2px;">SOLUTIONS \u00b7 GROWTH \u00b7 SUCCESS</div><div style="margin-top:10px;background:#0B2E6B;color:#fff;text-align:center;padding:6px 0;font-weight:700;font-size:12px;">OUR SERVICES</div></div>`,
                status: "read",
            },
        ] : [
            { type: "text", outgoing: false, text: `Hey! This is the start of your conversation with ${name}.` },
            { type: "text", outgoing: true, text: "Hey, how's it going?", status: "read" },
        ];

        for(const m of seedMsgs){
            await addDoc(messagesRef, { ...m, senderId: m.outgoing ? user.uid : "seed", createdAt: serverTimestamp() });
        }

        const last = seedMsgs[seedMsgs.length - 1];

        await updateDoc(chatDocRef, {
            seeded: true,
            lastMessage: last.type === "file" ? last.fileName : (last.type === "image" ? "Photo" : last.text),
            lastMessageType: last.type,
            updatedAt: serverTimestamp(),
        });

    }

    addSystemNote(ICONS.lock, "Messages and calls are end-to-end encrypted. Only people in this chat can read, listen to, or share them. <b>Learn more</b>");
    addSystemNote(ICONS.clock, "You use a default timer for disappearing messages in new chats. New messages will disappear from this chat 90 days after they're sent, except when kept. <b>Change timer</b>", true);

    onSnapshot(query(messagesRef, orderBy("createdAt")), (snap) => {

        Array.from(messagesEl.querySelectorAll(".msg-row, .date-divider")).forEach((el) => el.remove());

        addDateDivider("Today");

        snap.forEach((docSnap) => {

            const msg = docSnap.data();
            const time = formatTime(msg.createdAt);

            if(msg.type === "file"){
                addFileMessage({ ...msg, time });
            } else if(msg.type === "image"){
                addImageMessage({ ...msg, time });
            } else {
                addTextMessage({ ...msg, time });
            }

        });

        scrollToBottom();

    });

    const messageInput = document.getElementById("messageInput");
    const sendBtn = document.getElementById("sendBtn");

    function updateSendState(){
        if(messageInput.value.trim().length > 0){
            sendBtn.classList.add("has-text");
        } else {
            sendBtn.classList.remove("has-text");
        }
    }

    messageInput.addEventListener("input", updateSendState);

    async function sendTextMessage(){

        const value = messageInput.value.trim();

        if(!value) return;

        messageInput.value = "";
        updateSendState();

        await addDoc(messagesRef, { type: "text", outgoing: true, senderId: user.uid, text: value, status: "sent", createdAt: serverTimestamp() });

        await updateDoc(chatDocRef, { lastMessage: value, lastMessageType: "text", updatedAt: serverTimestamp() });

    }

    sendBtn.addEventListener("click", () => {

        if(sendBtn.classList.contains("has-text")){
            sendTextMessage();
        }

    });

    messageInput.addEventListener("keydown", (e) => {

        if(e.key === "Enter"){
            e.preventDefault();
            sendTextMessage();
        }

    });

    async function sendFile(file, asImage){

        if(!file) return;

        const path = `users/${user.uid}/chats/${chatId}/files/${Date.now()}_${file.name}`;
        const storageRef = ref(storage, path);

        await uploadBytes(storageRef, file);
        const url = await getDownloadURL(storageRef);

        if(asImage){

            await addDoc(messagesRef, { type: "image", outgoing: true, senderId: user.uid, fileURL: url, status: "sent", createdAt: serverTimestamp() });
            await updateDoc(chatDocRef, { lastMessage: "Photo", lastMessageType: "image", updatedAt: serverTimestamp() });

        } else {

            const sizeKb = Math.max(1, Math.round(file.size / 1024));

            await addDoc(messagesRef, { type: "file", outgoing: true, senderId: user.uid, fileName: file.name, fileURL: url, meta: `${sizeKb} KB \u00b7 ${(file.name.split(".").pop() || "file")}`, status: "sent", createdAt: serverTimestamp() });
            await updateDoc(chatDocRef, { lastMessage: file.name, lastMessageType: "file", updatedAt: serverTimestamp() });

        }

    }

    const attachInput = document.getElementById("attachInput");
    const cameraInput = document.getElementById("cameraInput");

    document.getElementById("attachBtn").addEventListener("click", () => {
        attachInput.click();
    });

    document.getElementById("cameraBtn").addEventListener("click", () => {
        cameraInput.click();
    });

    attachInput.addEventListener("change", (e) => {

        const file = e.target.files && e.target.files[0];

        if(file){
            sendFile(file, file.type.startsWith("image/"));
        }

        attachInput.value = "";

    });

    cameraInput.addEventListener("change", (e) => {

        const file = e.target.files && e.target.files[0];

        if(file){
            sendFile(file, true);
        }

        cameraInput.value = "";

    });

    document.getElementById("stickerBtn").addEventListener("click", () => {
        messageInput.focus();
    });

});
