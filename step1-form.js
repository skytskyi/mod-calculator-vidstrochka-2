(function () {
  const section = document.querySelector(".form-block");
  const btn = document.getElementById("step1-next");
  const summary = document.getElementById("step1-validation");
  const listEl = document.getElementById("step1-validation-list");
  const tariffField = document.getElementById("tariff-field");
  const rankTitleField = document.getElementById("rank-title-field");
  const tariffInput = document.getElementById("tariff-input");
  const formActions = section ? section.querySelector(".form-actions") : null;

  if (!section || !btn || !summary || !listEl || !tariffField || !tariffInput || !formActions) return;

  const MIN = Number(tariffField.dataset.min) || 1;
  const MAX = Number(tariffField.dataset.max) || 60;

  function parseTariffOk() {
    const s = tariffInput.value.trim();
    if (!s || !/^\d+$/.test(s)) return false;
    const n = parseInt(s, 10);
    return n >= MIN && n <= MAX;
  }

  function rankTitleNeedsAnswer() {
    if (!rankTitleField || rankTitleField.hidden) return false;
    return !!rankTitleField.querySelector('input[name="rankTitle"]');
  }

  function collectMissing() {
    const missing = [];

    if (!document.querySelector('input[name="service"]:checked')) {
      missing.push({
        id: "field-service",
        label: "Вид проходження військової служби",
        focusSelector: 'input[name="service"]',
      });
    }

    if (!document.querySelector('input[name="rank"]:checked')) {
      missing.push({
        id: "field-rank",
        label: "Рівень звання",
        focusSelector: 'input[name="rank"]',
      });
    }

    if (rankTitleNeedsAnswer() && !document.querySelector('input[name="rankTitle"]:checked')) {
      missing.push({
        id: "rank-title-field",
        label: "Звання",
        focusSelector: 'input[name="rankTitle"]',
      });
    }

    if (!parseTariffOk()) {
      missing.push({
        id: "tariff-field",
        label: "Тарифний розряд (1–60)",
        focusSelector: "#tariff-input",
      });
    }

    if (!document.querySelector('input[name="years"]:checked')) {
      missing.push({
        id: "field-years",
        label: "Вислуга років",
        focusSelector: 'input[name="years"]',
      });
    }

    return missing;
  }

  function parkSummary() {
    section.insertBefore(summary, formActions);
  }

  function mountSummaryBeforeFirst(missing) {
    if (!missing.length) return;
    const anchor = document.getElementById(missing[0].id);
    if (!anchor || anchor.parentNode !== section) return;
    section.insertBefore(summary, anchor);
  }

  function clearStepInvalid() {
    section.querySelectorAll(".is-step-invalid").forEach(function (el) {
      el.classList.remove("is-step-invalid");
    });
  }

  function applyStepInvalid(missing) {
    missing.forEach(function (item) {
      const el = document.getElementById(item.id);
      if (el) el.classList.add("is-step-invalid");
    });
  }

  function renderList(missing) {
    listEl.replaceChildren();
    missing.forEach(function (item) {
      const li = document.createElement("li");
      const a = document.createElement("a");
      a.href = "#" + item.id;
      a.textContent = item.label;
      a.addEventListener("click", function (e) {
        e.preventDefault();
        scrollAndFocusMissing([item]);
      });
      li.appendChild(a);
      listEl.appendChild(li);
    });
  }

  function resolveFocusTarget(holder, focusSelector) {
    if (!holder) return null;
    if (focusSelector.charAt(0) === "#") {
      return document.querySelector(focusSelector);
    }
    return holder.querySelector(focusSelector);
  }

  function scrollAndFocusMissing(missing) {
    if (!missing.length) return;
    const first = missing[0];
    const holder = document.getElementById(first.id);
    if (!holder) return;

    holder.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });

    let target = resolveFocusTarget(holder, first.focusSelector);
    if (!target) {
      target = holder.querySelector("input, select, textarea, button");
    }

    if (target) {
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          target.focus({ preventScroll: true });
        });
      });
    }
  }

  function syncValidationOnChange() {
    clearStepInvalid();
    if (summary.hidden) return;

    const missing = collectMissing();
    if (!missing.length) {
      summary.hidden = true;
      listEl.replaceChildren();
      parkSummary();
      return;
    }

    applyStepInvalid(missing);
    renderList(missing);
    mountSummaryBeforeFirst(missing);
  }

  section.addEventListener("change", syncValidationOnChange);

  section.addEventListener("input", function (e) {
    if (e.target && e.target.id === "tariff-input") {
      syncValidationOnChange();
    }
  });

  btn.addEventListener("click", function () {
    clearStepInvalid();
    const missing = collectMissing();

    if (!missing.length) {
      summary.hidden = true;
      listEl.replaceChildren();
      parkSummary();
      return;
    }

    applyStepInvalid(missing);
    renderList(missing);
    mountSummaryBeforeFirst(missing);
    summary.hidden = false;
    scrollAndFocusMissing(missing);
  });
})();
