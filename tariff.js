(function () {
  const field = document.getElementById("tariff-field");
  const input = document.getElementById("tariff-input");
  const errEl = document.getElementById("tariff-error");
  const btnInc = document.getElementById("tariff-inc");
  const btnDec = document.getElementById("tariff-dec");

  if (!field || !input || !errEl || !btnInc || !btnDec) return;

  const MIN = Number(field.dataset.min) || 1;
  const MAX = Number(field.dataset.max) || 60;

  function parseValue(raw) {
    const s = String(raw).trim();
    if (!s) return { ok: false };
    if (!/^\d+$/.test(s)) return { ok: false };
    const n = parseInt(s, 10);
    if (n < MIN || n > MAX) return { ok: false, n };
    return { ok: true, n };
  }

  function setValidity(valid) {
    field.classList.toggle("is-invalid", !valid);
    errEl.hidden = valid;
    input.setAttribute("aria-invalid", valid ? "false" : "true");
  }

  function validate() {
    const r = parseValue(input.value);
    setValidity(r.ok);
    return r;
  }

  function numericBaseForStep() {
    const s = input.value.trim();
    if (!s) return MIN;
    if (!/^\d+$/.test(s)) return MIN;
    const n = parseInt(s, 10);
    return Math.min(MAX, Math.max(MIN, n));
  }

  function applyDelta(delta) {
    const r = parseValue(input.value);
    let base;
    if (r.ok) {
      base = r.n;
    } else if (!input.value.trim()) {
      base = delta > 0 ? 0 : MIN;
    } else {
      base = numericBaseForStep();
    }
    let next = base + delta;
    if (next < MIN) next = MIN;
    if (next > MAX) next = MAX;
    input.value = String(next);
    validate();
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }

  btnInc.addEventListener("click", function () {
    applyDelta(1);
  });

  btnDec.addEventListener("click", function () {
    applyDelta(-1);
  });

  input.addEventListener("input", validate);
  input.addEventListener("blur", validate);

  validate();
})();
