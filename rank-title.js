(function () {
  const RANK_TITLES = {
    r1: [
      "Рекрут",
      "Солдат / матрос",
      "Старший солдат / старший матрос",
    ],
    r2: [
      "Молодший сержант / старшина 2 ст.",
      "Старший сержант / головний старшина",
      "Штаб-сержант / штаб-старшина",
      "Старший майстер-сержант / старший майстер-старшина",
      "Сержант / старшина 1 ст.",
      "Головний сержант / головний корабельний старшина",
      "Майстер-сержант / майстер-старшина",
      "Головний майстер-сержант / головний майстер-старшина",
    ],
    r3: [
      "Молодший лейтенант",
      "Лейтенант",
      "Старший лейтенант",
      "Капітан / капітан-лейтенант",
      "Майор / капітан 3 рангу",
      "Підполковник / капітан 2 рангу",
      "Полковник / капітан 1 рангу",
    ],
    r4: [
      "Бригадний генерал / коммодор",
      "Генерал-майор / контр-адмірал",
      "Генерал-лейтенант / віце-адмірал",
      "Генерал / адмірал",
    ],
  };

  const field = document.getElementById("rank-title-field");
  const container = document.getElementById("rank-title-options");
  const rankInputs = document.querySelectorAll('input[name="rank"]');

  if (!field || !container || !rankInputs.length) return;

  function clearRankTitleOptions() {
    container.replaceChildren();
  }

  function renderOptions(tier) {
    clearRankTitleOptions();
    const titles = RANK_TITLES[tier];
    if (!titles || !titles.length) return;

    for (let i = 0; i < titles.length; i += 2) {
      const row = document.createElement("div");
      row.className = "radio-row";
      const pair = titles.slice(i, i + 2);
      if (pair.length === 1) {
        row.classList.add("radio-row--single");
      }

      pair.forEach(function (text, j) {
        const idx = i + j;
        const label = document.createElement("label");
        label.className = "radio-card";

        const input = document.createElement("input");
        input.type = "radio";
        input.name = "rankTitle";
        input.value = tier + ":" + idx;
        input.dataset.rankTitleLabel = text;

        const ui = document.createElement("span");
        ui.className = "radio-card__ui";

        const span = document.createElement("span");
        span.className = "radio-card__text";
        span.textContent = text;

        label.appendChild(input);
        label.appendChild(ui);
        label.appendChild(span);
        row.appendChild(label);
      });

      container.appendChild(row);
    }
  }

  function syncRankTitleField() {
    const selected = document.querySelector('input[name="rank"]:checked');
    if (!selected) {
      field.hidden = true;
      clearRankTitleOptions();
      return;
    }

    const tier = selected.value;
    const titles = RANK_TITLES[tier];
    if (!titles || !titles.length) {
      field.hidden = true;
      clearRankTitleOptions();
      return;
    }

    field.hidden = false;
    renderOptions(tier);
  }

  rankInputs.forEach(function (el) {
    el.addEventListener("change", syncRankTitleField);
  });

  syncRankTitleField();
})();
