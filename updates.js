window.addEventListener("load", () => {

    if(localStorage.getItem("oc_onboarded") !== "true"){
        window.location.href = "welcome.html";
        return;
    }

    const identifier = localStorage.getItem("oc_identifier");
    const navAvatar = document.getElementById("navAvatar");
    const myAvatar = document.getElementById("myAvatar");

    if(identifier){
        const initials = identifier.replace(/[^a-zA-Z]/g, "").slice(0, 2).toUpperCase() || "OC";
        navAvatar.textContent = initials;
        myAvatar.textContent = initials;
    }

    const recentUpdates = [
        { name: "Rahul Bro", time: "1h ago" },
        { name: "Prema Massi", time: "2h ago" },
        { name: "Dinanshu", time: "4h ago" },
        { name: "Saniya Bhabhi", time: "2h ago" },
        { name: "Mata Chintpurni", time: "4h ago" },
    ];

    const viewedUpdates = [
        { name: "Aashu", time: "17h ago" },
    ];

    function renderUpdates(container, items, viewed){

        container.innerHTML = "";

        items.forEach((u) => {

            const initials = u.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();

            const item = document.createElement("div");
            item.className = "update-item";

            item.innerHTML = `
                <div class="ring ${viewed ? "viewed" : ""}">
                    <div class="avatar">${initials}</div>
                </div>
                <div class="update-info">
                    <h3>${u.name}</h3>
                    <p>${u.time}</p>
                </div>
            `;

            item.addEventListener("click", () => {

                const query = new URLSearchParams({ name: u.name, time: u.time, from: "updates.html" });

                window.location.href = `status-view.html?${query.toString()}`;

            });

            container.appendChild(item);

        });

    }

    const recentContainer = document.getElementById("recentUpdates");
    const viewedContainer = document.getElementById("viewedUpdates");
    const viewedToggle = document.getElementById("viewedToggle");

    renderUpdates(recentContainer, recentUpdates, false);
    renderUpdates(viewedContainer, viewedUpdates, true);

    viewedToggle.addEventListener("click", () => {

        viewedContainer.classList.toggle("collapsed");
        viewedToggle.classList.toggle("collapsed");

    });

});
