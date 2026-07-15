(function () {
  var mq = window.matchMedia("(max-width: 1199px)");
  var aside = document.querySelector(".sidebar");
  var btn = document.getElementById("sidebar-mobile-toggle");
  var scrim = document.getElementById("sidebar-mobile-scrim");
  var scrollEl = document.getElementById("sidebar-mobile-sheet-content");

  if (!aside || !btn) return;

  function isMobileLayout() {
    return mq.matches;
  }

  function syncScrollInert() {
    if (!scrollEl || !("inert" in scrollEl)) return;
    var mobile =
      isMobileLayout() && document.body.classList.contains("sidebar-preview-ready");
    scrollEl.inert = !!(mobile && !aside.classList.contains("sidebar--sheet-open"));
  }

  function closeSheet() {
    aside.classList.remove("sidebar--sheet-open");
    document.body.classList.remove("sidebar-sheet-open");
    btn.setAttribute("aria-expanded", "false");
    syncScrollInert();
  }

  function openSheet() {
    aside.classList.add("sidebar--sheet-open");
    document.body.classList.add("sidebar-sheet-open");
    btn.setAttribute("aria-expanded", "true");
    syncScrollInert();
  }

  function toggleSheet() {
    if (!isMobileLayout() || !document.body.classList.contains("sidebar-preview-ready")) {
      return;
    }
    if (aside.classList.contains("sidebar--sheet-open")) closeSheet();
    else openSheet();
  }

  btn.addEventListener("click", function (e) {
    e.preventDefault();
    toggleSheet();
  });

  if (scrim) {
    scrim.addEventListener("click", function () {
      if (isMobileLayout()) closeSheet();
    });
  }

  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    if (!aside.classList.contains("sidebar--sheet-open")) return;
    closeSheet();
    btn.focus();
  });

  function onMqChange() {
    if (!isMobileLayout()) closeSheet();
    syncScrollInert();
  }

  if (typeof mq.addEventListener === "function") {
    mq.addEventListener("change", onMqChange);
  } else if (typeof mq.addListener === "function") {
    mq.addListener(onMqChange);
  }

  window.addEventListener("sidebarpreviewchange", function () {
    if (!document.body.classList.contains("sidebar-preview-ready")) closeSheet();
    syncScrollInert();
  });

  syncScrollInert();

  var stickyNav = document.querySelector('nav[aria-label="Міністерство оборони України"]');

  function syncStickyHeaderOffset() {
    if (!stickyNav) return;
    document.documentElement.style.setProperty(
      "--site-header-height",
      stickyNav.getBoundingClientRect().height + "px"
    );
  }

  syncStickyHeaderOffset();
  window.addEventListener("resize", syncStickyHeaderOffset);
  window.addEventListener("load", syncStickyHeaderOffset);

  if (stickyNav && typeof ResizeObserver !== "undefined") {
    new ResizeObserver(syncStickyHeaderOffset).observe(stickyNav);
  }
})();
