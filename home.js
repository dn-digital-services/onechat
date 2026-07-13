window.addEventListener("load", () => {

    if(localStorage.getItem("oc_onboarded") !== "true"){
        window.location.href = "welcome.html";
        return;
    }

    const identifier = localStorage.getItem("oc_identifier");
    const navAvatar = document.getElementById("navAvatar");

    if(identifier){
        const initials = identifier.replace(/[^a-zA-Z]/g, "").slice(0, 2).toUpperCase() || "OC";
        navAvatar.textContent = initials;
    }

    const chatList = document.getElementById("chatList");

    const ICONS = {

        videoCall: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 10l5-3v10l-5-3"/><rect x="2" y="6" width="13" height="12" rx="2"/></svg>`,

        photo: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="10" r="1.5"/><path d="M21 16l-5-5-4 4-3-3-4 4"/></svg>`,

        checkRead: `<svg class="check-read" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12l4 4L14 8"/><path d="M9 12l4 4 9-10"/></svg>`,

    };

    const conversations = [
        { name: "Ava Thompson", type: "call", message: "Video call", time: "Yesterday", unread: 2, favourite: true },
        { name: "Liam Chen", type: "text", message: "Sent the files, check your inbox", time: "Yesterday", unread: 0, read: true },
        { name: "OneChat Team", type: "text", message: "Welcome to OneChat! 🎉", time: "Yesterday", unread: 1, group: true },
        { name: "Design Squad", type: "photo", message: "Photo", time: "Yesterday", unread: 0, read: true, group: true },
        { name: "Maya Patel", type: "text", message: "Sounds good, talk soon!", time: "Sunday", unread: 0, read: true, favourite: true },
        { name: "Noah Rivera", type: "text", message: "Can you call me later?", time: "Sunday", unread: 0 },
    ];

    function renderList(filter){

        chatList.innerHTML = "";

        const filtered = conversations.filter((c) => {

            if(filter === "unread") return c.unread > 0;
            if(filter === "favourites") return !!c.favourite;
            if(filter === "groups") return !!c.group;
            return true;

        });

        if(filtered.length === 0){
            chatList.innerHTML = '<p class="empty-state">No conversations here yet.</p>';
            return;
        }

        filtered.forEach((c) => {

            const initials = c.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();

            let previewIcon = "";
            let msgClass = c.unread > 0 ? "bold" : "";

            if(c.type === "call") previewIcon = ICONS.videoCall;
            else if(c.type === "photo") previewIcon = ICONS.photo;
            else if(c.read) previewIcon = ICONS.checkRead;

            const item = document.createElement("div");
            item.className = "chat-item";

            item.innerHTML = `
                <div class="avatar">${initials}</div>
                <div class="chat-info">
                    <div class="chat-top">
                        <h3>${c.name}</h3>
                        <span class="chat-time ${c.unread > 0 ? "unread-time" : ""}">${c.time}</span>
                    </div>
                    <div class="chat-preview">
                        <span class="chat-preview-text">
                            ${previewIcon}
                            <span class="msg-text ${msgClass}">${c.message}</span>
                        </span>
                        ${c.unread > 0 ? `<span class="unread-badge">${c.unread}</span>` : ""}
                    </div>
                </div>
            `;

            chatList.appendChild(item);

        });

    }

    renderList("all");

    document.querySelectorAll(".chip[data-filter]").forEach((chip) => {

        chip.addEventListener("click", () => {

            document.querySelectorAll(".chip[data-filter]").forEach((c) => c.classList.remove("active"));
            chip.classList.add("active");

            renderList(chip.getAttribute("data-filter"));

        });

    });

});
