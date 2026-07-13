window.addEventListener("load", () => {

    if(localStorage.getItem("oc_onboarded") !== "true"){
        window.location.href = "welcome.html";
        return;
    }

    const chatList = document.getElementById("chatList");

    const conversations = [
        { name: "Ava Thompson", message: "See you at 6pm then 🙌", time: "09:41", unread: 2 },
        { name: "Liam Chen", message: "Sent the files, check your inbox", time: "08:15", unread: 0 },
        { name: "OneChat Team", message: "Welcome to OneChat! 🎉", time: "Yesterday", unread: 1 },
        { name: "Maya Patel", message: "Sounds good, talk soon!", time: "Yesterday", unread: 0 },
        { name: "Noah Rivera", message: "Can you call me later?", time: "Mon", unread: 0 },
    ];

    if(conversations.length === 0){

        chatList.innerHTML = '<p class="empty-state">No conversations yet. Start one!</p>';
        return;

    }

    conversations.forEach((c) => {

        const initials = c.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();

        const item = document.createElement("div");
        item.className = "chat-item";

        item.innerHTML = `
            <div class="avatar">${initials}</div>
            <div class="chat-info">
                <div class="chat-top">
                    <h3>${c.name}</h3>
                    <span class="chat-time">${c.time}</span>
                </div>
                <div class="chat-preview">
                    <p>${c.message}</p>
                    ${c.unread > 0 ? `<span class="unread-badge">${c.unread}</span>` : ""}
                </div>
            </div>
        `;

        chatList.appendChild(item);

    });

});
