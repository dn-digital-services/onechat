window.addEventListener("load", () => {

    const continueBtn = document.getElementById("continueBtn");
    const skipLink = document.getElementById("skipLink");

    function saveAndGo(){

        const permissions = {};

        document.querySelectorAll(".permission-item").forEach((item) => {

            const key = item.getAttribute("data-permission");
            const checked = item.querySelector(".permission-toggle").checked;

            permissions[key] = checked;

        });

        localStorage.setItem("oc_permissions", JSON.stringify(permissions));
        localStorage.setItem("oc_onboarded", "true");

        window.location.href = "home.html";

    }

    continueBtn.addEventListener("click", saveAndGo);

    skipLink.addEventListener("click", (e) => {

        e.preventDefault();

        saveAndGo();

    });

});
