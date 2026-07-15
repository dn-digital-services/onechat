/*
=========================================
OneChat
Shared helpers (avatar + display name)
=========================================
*/

function ocGetInitials(text){

    if(!text) return "OC";

    const cleaned = text.replace(/[^a-zA-Z]/g, "");

    return (cleaned.slice(0, 2) || "OC").toUpperCase();

}

function ocApplyAvatar(el, initials, photoURL){

    if(!el) return;

    if(photoURL){

        el.style.backgroundImage = `url(${photoURL})`;
        el.style.backgroundSize = "cover";
        el.style.backgroundPosition = "center";

        el.textContent = "";

    } else {

        el.style.backgroundImage = "";

        el.textContent = initials;

    }

}

// ==========================================================================
// Shared chat helpers (real 1-to-1 messaging)
// ==========================================================================

// Deterministic chat id for a pair of Firebase UIDs -- always the two uids
// sorted lexicographically and joined with "_" (Firebase UIDs never contain
// underscores), so either participant can derive the same id independently.
function ocChatIdFor(uidA, uidB){
    return [uidA, uidB].sort().join("_");
}

function ocNormalizePhone(digits){
    return `+91${(digits || "").replace(/[\s()-]/g, "")}`;
}

// A user only counts as "online" if their profile says so AND their last
// heartbeat is recent -- protects against a tab that crashed/closed without
// firing beforeunload and being stuck showing "online" forever.
function ocIsOnline(profile){

    if(!profile || !profile.online || !profile.lastSeen) return false;

    const lastSeenDate = profile.lastSeen.toDate ? profile.lastSeen.toDate() : new Date(profile.lastSeen);

    return (Date.now() - lastSeenDate.getTime()) < 60000;

}

function ocFormatMessageTime(ts){

    if(!ts) return "";

    const date = ts.toDate ? ts.toDate() : new Date(ts);

    return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

}

function ocFormatListTime(ts){

    if(!ts) return "";

    const date = ts.toDate ? ts.toDate() : new Date(ts);
    const now = new Date();

    if(date.toDateString() === now.toDateString()){
        return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    }

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);

    if(date.toDateString() === yesterday.toDateString()){
        return "Yesterday";
    }

    return date.toLocaleDateString([], { weekday: "short" });

}

function ocFormatLastSeen(profile){

    if(!profile || !profile.lastSeen) return "offline";

    const date = profile.lastSeen.toDate ? profile.lastSeen.toDate() : new Date(profile.lastSeen);
    const now = new Date();
    const time = date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

    if(date.toDateString() === now.toDateString()){
        return `last seen today at ${time}`;
    }

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);

    if(date.toDateString() === yesterday.toDateString()){
        return `last seen yesterday at ${time}`;
    }

    return `last seen ${date.toLocaleDateString([], { day: "numeric", month: "short" })} at ${time}`;

}
