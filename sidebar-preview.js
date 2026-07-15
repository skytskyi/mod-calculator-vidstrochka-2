(function () {
  var form = document.querySelector(".form-block");
  var hint = document.getElementById("sidebar-hint");
  var breakdown = document.getElementById("sidebar-breakdown");
  var rankTitleField = document.getElementById("rank-title-field");
  var elRank = document.getElementById("sidebar-amt-rank");
  var elPos = document.getElementById("sidebar-amt-pos");
  var elGross = document.getElementById("sidebar-amt-gross");
  var elTax = document.getElementById("sidebar-amt-tax");
  var elNet = document.getElementById("sidebar-amt-net");
  var elNetMobile = document.getElementById("sidebar-amt-net-mobile");
  var elVisluga = document.getElementById("sidebar-amt-visluga");
  var tariffInput = document.getElementById("tariff-input");
  var tariffField = document.getElementById("tariff-field");

  if (!form || !hint || !breakdown) return;

  /**
   * Посадовий оклад за тарифним розрядом (наказ МОУ, схема з 01.03.2018), грн.
   * Індекс 0 = 1-й розряд … індекс 59 = 60-й розряд.
   */
  var TARIFF_POS_OKLAD = [
    2470, 2550, 2640, 2730, 2820, 2910, 3000, 3080, 3170, 3260, 3350, 3440, 3520,
    3660, 3810, 3950, 4090, 4230, 4370, 4510, 4650, 4790, 4930, 5070, 5220, 5360,
    5500, 5640, 5780, 5920, 6060, 6200, 6340, 6480, 6630, 6770, 6910, 7050, 7190,
    7330, 7470, 7610, 7750, 7890, 8030, 8180, 8320, 8460, 8600, 8740, 8880, 9020,
    9160, 9300, 9440, 9590, 9730, 9870, 10010, 10150,
  ];
  /** Частка для надбавки за вислугу: (посадовий оклад + оклад за звання) × частка */
  var YEARS_RATE = { y0: 0, y1: 0.25, y2: 0.3, y3: 0.35, y4: 0.4, y5: 0.45, y6: 0.5 };
  var NAD_TAEMN = 0;
  var NAD_OSOBL = 1891.5;
  var PREMIA = 15635.1;
  var MIL_TAX_RATE = 0.015;

  /**
   * Оклад за військовим званням (грн) за підписами з ТЗ + повні підписи з форми.
   * Для звань без окремої суми в ТЗ — лінійна інтерполяція між сусідніми рівнями.
   */
  var RANK_OKLAD_BY_LABEL = {
    Рекрут: 440,
    "Солдат / матрос": 530,
    "Старший солдат / старший матрос": 600,
    "Молодший сержант / старшина 2 ст.": 670,
    "Старший сержант / головний старшина": 810,
    "Штаб-сержант / штаб-старшина": 950,
    "Старший майстер-сержант / старший майстер-старшина": 1040,
    "Сержант / старшина 1 ст.": 740,
    "Головний сержант / головний корабельний старшина": 880,
    "Майстер-сержант / майстер-старшина": 1020,
    "Головний майстер-сержант / головний майстер-старшина": 1060,
    "Молодший лейтенант": 1095,
    Лейтенант: 1130,
    "Старший лейтенант": 1200,
    "Капітан / капітан-лейтенант": 1270,
    "Майор / капітан 3 рангу": 1340,
    "Підполковник / капітан 2 рангу": 1410,
    "Полковник / капітан 1 рангу": 1480,
    "Бригадний генерал / коммодор": 1550,
    "Генерал-майор / контр-адмірал": 1620,
    "Генерал-лейтенант / віце-адмірал": 1690,
    "Генерал / адмірал": 1760,
  };

  function rankTitleComplete() {
    if (!rankTitleField || rankTitleField.hidden) return true;
    return !!document.querySelector('input[name="rankTitle"]:checked');
  }

  function previewReady() {
    return (
      !!document.querySelector('input[name="service"]:checked') &&
      !!document.querySelector('input[name="rank"]:checked') &&
      rankTitleComplete()
    );
  }

  function roundMoney2(n) {
    return Math.round(Number(n) * 100) / 100;
  }

  /** Український формат: 20 130,05 */
  function formatUaMoney(n) {
    var fixed = roundMoney2(n).toFixed(2);
    var parts = fixed.split(".");
    var intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, " ");
    return intPart + "," + parts[1];
  }

  function formatDeduct(n) {
    return "−" + formatUaMoney(n);
  }

  function getRankOklad() {
    var input = document.querySelector('input[name="rankTitle"]:checked');
    if (!input || !input.dataset.rankTitleLabel) return 0;
    var label = input.dataset.rankTitleLabel;
    var v = RANK_OKLAD_BY_LABEL[label];
    return typeof v === "number" ? v : 0;
  }

  function parseTariffGrade() {
    if (!tariffInput || !tariffField) return 1;
    var MIN = Number(tariffField.dataset.min) || 1;
    var MAX = Number(tariffField.dataset.max) || 60;
    var s = tariffInput.value.trim();
    if (!s || !/^\d+$/.test(s)) return 1;
    var n = parseInt(s, 10);
    if (n < MIN || n > MAX) return 1;
    return n;
  }

  function getPosOklad() {
    var grade = parseTariffGrade();
    return TARIFF_POS_OKLAD[grade - 1] || TARIFF_POS_OKLAD[0];
  }

  function getYearsRate() {
    var y = document.querySelector('input[name="years"]:checked');
    if (!y) return 0;
    var r = YEARS_RATE[y.value];
    return typeof r === "number" ? r : 0;
  }

  function getNadVisluga(rank, pos) {
    return roundMoney2((rank + pos) * getYearsRate());
  }

  function updateAmounts() {
    if (!elRank || !elGross || !elTax || !elNet) return;

    var rank = getRankOklad();
    var pos = getPosOklad();
    var nadVisluga = getNadVisluga(rank, pos);
    var gross = roundMoney2(
      rank + pos + nadVisluga + NAD_TAEMN + NAD_OSOBL + PREMIA
    );
    var tax = roundMoney2(gross * MIL_TAX_RATE);
    var net = roundMoney2(gross - tax);

    elRank.textContent = formatUaMoney(rank);
    if (elPos) elPos.textContent = formatUaMoney(pos);
    if (elVisluga) elVisluga.textContent = formatUaMoney(nadVisluga);
    elGross.textContent = formatUaMoney(gross);
    elTax.textContent = formatDeduct(tax);
    elNet.textContent = formatUaMoney(net);
    if (elNetMobile) elNetMobile.textContent = formatUaMoney(net);
  }

  function sync() {
    var ready = previewReady();
    hint.hidden = ready;
    breakdown.hidden = !ready;
    document.body.classList.toggle("sidebar-preview-ready", ready);
    if (!ready) {
      document.body.classList.remove("sidebar-sheet-open");
      var aside = document.querySelector(".sidebar");
      if (aside) aside.classList.remove("sidebar--sheet-open");
    }
    if (ready) updateAmounts();
    window.dispatchEvent(new CustomEvent("sidebarpreviewchange"));
  }

  form.addEventListener("change", sync);
  if (tariffInput) {
    tariffInput.addEventListener("input", sync);
    tariffInput.addEventListener("change", sync);
  }
  sync();
})();
