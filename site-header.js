(function () {
  var toggle = document.getElementById("mod-nav-toggle");
  var drawer = document.getElementById("mod-nav-drawer");
  var backdrop = document.getElementById("mod-nav-backdrop");
  var closeBtn = document.getElementById("mod-nav-close");
  if (!toggle || !drawer) return;

  var mqDesktop = window.matchMedia("(min-width: 1024px)");

  function setOpen(open) {
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
    drawer.classList.toggle("mod-nav-drawer--open", open);
    drawer.setAttribute("aria-hidden", open ? "false" : "true");
    if (backdrop) {
      backdrop.classList.toggle("mod-nav-backdrop--visible", open);
      backdrop.setAttribute("aria-hidden", open ? "false" : "true");
    }
    document.body.classList.toggle("mod-nav-open", open);
  }

  function isDesktop() {
    return mqDesktop.matches;
  }

  toggle.addEventListener("click", function () {
    if (isDesktop()) return;
    var open = toggle.getAttribute("aria-expanded") !== "true";
    setOpen(open);
    if (open) closeBtn && closeBtn.focus();
  });

  closeBtn &&
    closeBtn.addEventListener("click", function () {
      setOpen(false);
      toggle.focus();
    });

  backdrop &&
    backdrop.addEventListener("click", function () {
      setOpen(false);
      toggle.focus();
    });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && document.body.classList.contains("mod-nav-open")) {
      setOpen(false);
      toggle.focus();
    }
  });

  mqDesktop.addEventListener("change", function () {
    if (isDesktop()) setOpen(false);
  });
})();
