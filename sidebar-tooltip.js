(function () {
  var wrap = document.querySelector(".sidebar__tooltip-wrap");
  var btn = document.querySelector(".sidebar__tooltip-wrap .sidebar__info");
  var tip = document.getElementById("sidebar-tooltip");
  if (!wrap || !btn || !tip) return;

  function setOpen(open) {
    wrap.classList.toggle("sidebar__tooltip-wrap--open", open);
    btn.setAttribute("aria-expanded", open ? "true" : "false");
    tip.setAttribute("aria-hidden", open ? "false" : "true");
  }

  function isOpen() {
    return wrap.classList.contains("sidebar__tooltip-wrap--open");
  }

  btn.addEventListener("click", function (e) {
    e.stopPropagation();
    setOpen(!isOpen());
  });

  document.addEventListener("click", function (e) {
    if (!isOpen()) return;
    if (wrap.contains(e.target)) return;
    setOpen(false);
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && isOpen()) {
      setOpen(false);
      btn.focus();
    }
  });
})();
