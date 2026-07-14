import { db, doc, getDoc, setDoc, updateDoc, collection, addDoc, serverTimestamp, slugify, requireAuthAndOnboarding } from "./firebase.js";

window.addEventListener("load", async () => {

    const session = await requireAuthAndOnboarding("welcome.html");

    if(!session) return;

    const { user } = session;

    const params = new URLSearchParams(window.location.search);

    const name = params.get("name") || "Unknown";
    const time = params.get("time") || "Just now";
    const from = params.get("from") || "updates.html";

    document.getElementById("svName").textContent = name;
    document.getElementById("svTime").textContent = time;

    const initials = ocGetInitials(name);
    const svAvatar = document.getElementById("svAvatar");
    svAvatar.textContent = initials;

    const QUOTES = [
        { text: "हर बार जवाब देना\nज़रूरी नहीं होता,\nकुछ लोगों को उनकी\nसोच के साथ\nछोड़ देना चाहिए..!!", credit: "@lifeink_quotes", gradient: "linear-gradient(160deg,#3B2A1A,#0F0B08)" },
        { text: "Some bonds are\nquiet, but they run\ndeeper than words\never could.", credit: "@onechat_quotes", gradient: "linear-gradient(160deg,#1F3B36,#0A1512)" },
        { text: "Chai, sukoon\naur thodi si\nkhamoshi \u2014\nbas yahi chahiye.", credit: "@onechat_quotes", gradient: "linear-gradient(160deg,#2A2140,#0C0A16)" },
        { text: "Good things take\ntime. Stay patient,\nstay kind.", credit: "@onechat_quotes", gradient: "linear-gradient(160deg,#213A4D,#0A1620)" },
        { text: "Family is not\nan important thing,\nit's everything.", credit: "@onechat_quotes", gradient: "linear-gradient(160deg,#40241F,#150B09)" },
    ];

    function hashCode(str){
        let hash = 0;
        for(let i = 0; i < str.length; i++){
            hash = (hash << 5) - hash + str.charCodeAt(i);
            hash |= 0;
        }
        return hash;
    }

    const quote = QUOTES[Math.abs(hashCode(name)) % QUOTES.length];

    document.getElementById("quoteText").textContent = quote.text;
    document.getElementById("quoteCredit").textContent = quote.credit;
    document.getElementById("quoteCard").style.background = quote.gradient;

    const progressRow = document.getElementById("progressRow");
    const segmentCount = 1;

    for(let i = 0; i < segmentCount; i++){
        const seg = document.createElement("div");
        seg.className = "segment filled";
        progressRow.appendChild(seg);
    }

    document.getElementById("svBack").addEventListener("click", () => {
        window.location.href = from;
    });

    const heartBtn = document.getElementById("heartBtn");

    heartBtn.addEventListener("click", () => {
        heartBtn.classList.toggle("liked");
    });

    const replyInput = document.getElementById("replyInput");
    const statusFooter = document.querySelector(".status-footer");
    const svSendBtn = document.getElementById("svSendBtn");

    replyInput.addEventListener("input", () => {

        if(replyInput.value.trim().length > 0){
            statusFooter.classList.add("typing");
        } else {
            statusFooter.classList.remove("typing");
        }

    });

    async function sendReply(){

        const value = replyInput.value.trim();

        if(!value) return;

        replyInput.value = "";
        statusFooter.classList.remove("typing");
        replyInput.placeholder = "Reply sent!";
        setTimeout(() => { replyInput.placeholder = "Reply"; }, 1500);

        // Drop the reply into a chat with this person, creating it if needed,
        // so it shows up instantly if the user opens that conversation.
        const chatId = slugify(name);
        const chatDocRef = doc(db, "users", user.uid, "chats", chatId);
        const chatSnap = await getDoc(chatDocRef);

        if(!chatSnap.exists()){

            await setDoc(chatDocRef, {
                id: chatId,
                name,
                subtitle: "tap for contact info",
                type: "text",
                lastMessage: value,
                lastMessageType: "text",
                unreadCount: 0,
                seeded: true,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            });

        } else {

            await updateDoc(chatDocRef, { lastMessage: value, lastMessageType: "text", updatedAt: serverTimestamp() });

        }

        await addDoc(collection(chatDocRef, "messages"), {
            type: "text",
            outgoing: true,
            senderId: user.uid,
            text: value,
            status: "sent",
            createdAt: serverTimestamp(),
        });

    }

    svSendBtn.addEventListener("click", sendReply);

    replyInput.addEventListener("keydown", (e) => {

        if(e.key === "Enter" && replyInput.value.trim()){
            e.preventDefault();
            sendReply();
        }

    });

    document.querySelectorAll(".reaction").forEach((btn) => {

        btn.addEventListener("click", () => {
            btn.style.transform = "scale(1.4)";
            setTimeout(() => { btn.style.transform = ""; }, 200);
        });

    });

});
