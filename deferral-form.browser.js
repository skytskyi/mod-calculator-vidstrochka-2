(function () {
  const { format } = window.DateFnsLite;
  const { ContractType, ServiceStatus, CombatUnitType, MAX_SERVICE_PERIODS, RESOLUTION_768_URL, RESOLUTION_768_CITE, calculate, getCombatExplanationLabels } = window.DeferralCalculator;


const section = document.querySelector(".form-block");
const summary = document.getElementById("calc-validation");
const listEl = document.getElementById("calc-validation-list");
const formActions = document.getElementById("form-actions-anchor");

const combatDaysField = document.getElementById("field-combat-days");
const combatAssignmentField = document.getElementById("field-combat-assignment");
const combatDaysInput = document.getElementById("combat-days-input");
const servicePeriodsField = document.getElementById("field-service-periods");
const servicePeriodsList = document.getElementById("service-periods-list");
const servicePeriodAddBtn = document.getElementById("service-period-add");
const contractTermField = document.getElementById("field-contract-term");
const contractStartLabel = document.getElementById("contract-start-label");
const contractTermAssault = document.getElementById("contract-term-assault");
const contractTermCombat = document.getElementById("contract-term-combat");
const contractTermBasic = document.getElementById("contract-term-basic");

const wizardProgress = document.getElementById("wizard-progress");
const wizardQuestion = document.getElementById("wizard-question");
const wizardHelp = document.getElementById("wizard-help");
const wizardError = document.getElementById("wizard-error");
const wizardBack = document.getElementById("wizard-back");
const wizardContinue = document.getElementById("wizard-continue");
const wizardSteps = document.querySelectorAll(".wizard-step");
const wizardPanel = document.getElementById("wizard-panel");
const wizardResults = document.getElementById("wizard-results");
const wizardResultsExplanation = document.getElementById("wizard-results-explanation");
const wizardResultsInputsList = document.getElementById("wizard-results-inputs-list");
const wizardResultsTotal = document.getElementById("wizard-results-total");
const wizardRestart = document.getElementById("wizard-restart");
const wizardEdit = document.getElementById("wizard-edit");

let currentStepIndex = 0;

const WIZARD_STEP_COUNT = 3;
const WIZARD_STEPS = ["status", "contract", "combat"];

const SERVICE_STATUS_LABELS = {
  OBLIGATED: "Військовозобов'язаний",
  ACTIVE: "Військовий",
  DISCHARGED: "Звільнений зі служби",
};

const CONTRACT_TYPE_LABELS = {
  ASSAULT: "Піхотно-штурмовий контракт",
  COMBAT: "Бойовий контракт",
  BASIC: "Базовий контракт",
};

const COMBAT_UNIT_LABELS = {
  COMBAT_UNIT: "У бойових частинах",
  NON_COMBAT_UNIT: "Не у бойових частинах",
};

const STEP_META = {
  status: {
    title: "Ваш статус та дані про службу",
    help:
      "Оберіть поточний статус. Якщо ви військовий або звільнений зі служби, вкажіть один або кілька періодів служби (до 5). Вони потрібні для врахування стажу до та після 24 лютого 2022 року.",
  },
  contract: {
    title: "Дані про новий контракт",
    help: "Оберіть тип контракту та дату його підписання.",
  },
  combat: {
    title: "Участь у бойових діях під час нового контракту",
    help:
      "Оберіть кількість днів участі в бойових діях (фактичну або прогнозовану). Це впливає на розрахунок відстрочки за абз. 3 або 6 п. 22 постанови №768.",
    titleAssault: "Кількість днів участі в бойових діях",
  },
};

const CONTRACT_START_LABELS = {
  obligated: "Планова дата підписання нового контракту",
  other: "Планова або фактична дата підписання нового контракту",
};

const SERVICE_AFTER_CONTRACT_ERROR =
  "Дата початку військової служби не може бути пізнішою за планову або фактичну дату підписання нового контракту";

const PERIOD_END_BEFORE_START_ERROR =
  "Дата закінчення періоду служби має бути пізнішою за дату початку";

const PERIOD_END_AFTER_CONTRACT_ERROR =
  "Дата закінчення періоду служби має бути ранішою за планову або фактичну дату підписання нового контракту";

const PERIODS_OVERLAP_ERROR = "Періоди служби не повинні перетинатися";

const MAX_COMBAT_DAYS = 480;
const COMBAT_DAYS_MAX_ERROR =
  "Кількість днів участі в бойових діях не може перевищувати 480";

const COMBAT_EXPLANATION_LABELS = getCombatExplanationLabels();

const summaryTitle = summary
  ? summary.querySelector(".form-validation-summary__title")
  : null;

function parseDateInput(id) {
  const el = document.getElementById(id);
  return parseDateValue(el && el.value);
}

function parseDateValue(value) {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function parseIntegerInput(id) {
  const el = document.getElementById(id);
  if (!el) return 0;
  const value = el.value.trim();
  if (!value) return 0;
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? NaN : parsed;
}

function requiresServicePeriods(status) {
  return status === ServiceStatus.ACTIVE || status === ServiceStatus.DISCHARGED;
}

function getServicePeriodRows() {
  if (!servicePeriodsList) return [];
  return Array.prototype.slice.call(
    servicePeriodsList.querySelectorAll(".service-period")
  );
}

/**
 * @returns {{ startDate: Date, endDate?: Date }[]}
 */
function readServicePeriodsFromForm() {
  return getServicePeriodRows()
    .map(function (row) {
      const startInput = row.querySelector('[data-period-field="start"]');
      const endInput = row.querySelector('[data-period-field="end"]');
      const startDate = parseDateValue(startInput && startInput.value);
      const endDate = parseDateValue(endInput && endInput.value);
      if (!startDate) return null;
      /** @type {{ startDate: Date, endDate?: Date }} */
      const period = { startDate };
      if (endDate) period.endDate = endDate;
      return period;
    })
    .filter(Boolean);
}

function periodNeedsEndDate(status, index, total) {
  if (status === ServiceStatus.DISCHARGED) return true;
  if (status === ServiceStatus.ACTIVE) return index < total - 1;
  return false;
}

function createDateField(inputId, fieldName) {
  const wrap = document.createElement("div");
  wrap.className = "date-field";

  const input = document.createElement("input");
  input.id = inputId;
  input.className = "date-input is-empty";
  input.type = "date";
  input.autocomplete = "off";
  input.dataset.periodField = fieldName;
  input.name =
    fieldName === "start" ? "servicePeriodStart" : "servicePeriodEnd";

  const placeholder = document.createElement("span");
  placeholder.className = "date-field__placeholder";
  placeholder.setAttribute("aria-hidden", "true");
  placeholder.textContent = "дд.мм.рррр";

  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "date-field__trigger";
  trigger.setAttribute("aria-label", "Відкрити календар");
  trigger.innerHTML =
    '<img src="Calendar.svg" alt="" width="24" height="24" />';

  wrap.appendChild(input);
  wrap.appendChild(placeholder);
  wrap.appendChild(trigger);
  bindDateField(wrap);
  return wrap;
}

function createServicePeriodRow(index) {
  const row = document.createElement("div");
  row.className = "service-period";
  row.dataset.periodIndex = String(index);

  const head = document.createElement("div");
  head.className = "service-period__head";

  const title = document.createElement("p");
  title.className = "service-period__title";
  title.textContent = "Період служби " + (index + 1);

  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.className = "btn-text service-period__remove";
  removeBtn.textContent = "Видалити";
  removeBtn.addEventListener("click", function () {
    removeServicePeriod(row);
  });

  head.appendChild(title);
  head.appendChild(removeBtn);

  const startField = document.createElement("div");
  startField.className = "field field--date";
  const startLabel = document.createElement("label");
  startLabel.className = "field__legend";
  startLabel.htmlFor = "service-period-" + index + "-start";
  startLabel.textContent = "Дата початку";
  startField.appendChild(startLabel);
  startField.appendChild(
    createDateField("service-period-" + index + "-start", "start")
  );

  const endField = document.createElement("div");
  endField.className = "field field--date service-period__end";
  const endLabel = document.createElement("label");
  endLabel.className = "field__legend";
  endLabel.htmlFor = "service-period-" + index + "-end";
  endLabel.textContent = "Дата закінчення";
  endField.appendChild(endLabel);
  endField.appendChild(
    createDateField("service-period-" + index + "-end", "end")
  );

  const hint = document.createElement("p");
  hint.className = "field__hint service-period__hint";
  hint.hidden = true;
  hint.textContent =
    "Якщо служите зараз — залиште дату закінчення порожньою";
  endField.appendChild(hint);

  const fields = document.createElement("div");
  fields.className = "service-period__fields";
  fields.appendChild(startField);
  fields.appendChild(endField);

  row.appendChild(head);
  row.appendChild(fields);
  return row;
}

function renumberServicePeriods() {
  getServicePeriodRows().forEach(function (row, index) {
    row.dataset.periodIndex = String(index);
    const title = row.querySelector(".service-period__title");
    if (title) title.textContent = "Період служби " + (index + 1);

    const startInput = row.querySelector('[data-period-field="start"]');
    const endInput = row.querySelector('[data-period-field="end"]');
    const startLabel = row.querySelector(".field--date label");
    const endLabel = row.querySelector(".service-period__end label");

    if (startInput) {
      startInput.id = "service-period-" + index + "-start";
      if (startLabel) startLabel.htmlFor = startInput.id;
    }
    if (endInput) {
      endInput.id = "service-period-" + index + "-end";
      if (endLabel) endLabel.htmlFor = endInput.id;
    }
  });
}

function syncServicePeriodUi() {
  const status = getSelectedServiceStatus();
  const rows = getServicePeriodRows();
  const total = rows.length;

  rows.forEach(function (row, index) {
    const removeBtn = row.querySelector(".service-period__remove");
    const endField = row.querySelector(".service-period__end");
    const endLabel = endField && endField.querySelector(".field__legend");
    const hint = row.querySelector(".service-period__hint");
    const isActiveLast =
      status === ServiceStatus.ACTIVE && index === total - 1;

    if (removeBtn) {
      removeBtn.hidden = total <= 1;
    }

    if (endField) {
      endField.hidden = false;
    }

    if (endLabel) {
      if (status === ServiceStatus.DISCHARGED && index === total - 1) {
        endLabel.textContent = "Дата звільнення / закінчення";
      } else {
        endLabel.textContent = "Дата закінчення";
      }
    }

    if (hint) {
      hint.hidden = !isActiveLast;
    }
  });

  if (servicePeriodAddBtn) {
    servicePeriodAddBtn.hidden = total >= MAX_SERVICE_PERIODS;
    servicePeriodAddBtn.disabled = total >= MAX_SERVICE_PERIODS;
  }
}

function addServicePeriod(options) {
  if (!servicePeriodsList) return;
  if (getServicePeriodRows().length >= MAX_SERVICE_PERIODS) return;

  const silent = options && options.silent;
  const index = getServicePeriodRows().length;
  servicePeriodsList.appendChild(createServicePeriodRow(index));
  syncServicePeriodUi();
  if (!silent) {
    onWizardInputChange();
  }
}

function removeServicePeriod(row) {
  if (!row || getServicePeriodRows().length <= 1) return;
  row.remove();
  renumberServicePeriods();
  syncServicePeriodUi();
  onWizardInputChange();
}

function clearServicePeriods() {
  if (!servicePeriodsList) return;
  servicePeriodsList.replaceChildren();
}

function ensureServicePeriods() {
  if (!servicePeriodsList) return;
  if (getServicePeriodRows().length === 0) {
    addServicePeriod({ silent: true });
  } else {
    syncServicePeriodUi();
  }
}

/**
 * Вставляє текст і робить «постанови №768» клікабельним посиланням.
 * @param {HTMLElement} el
 * @param {string} text
 */
function setTextWithResolutionLink(el, text) {
  el.replaceChildren();
  if (!text) return;

  const marker = RESOLUTION_768_CITE;
  const idx = text.indexOf(marker);
  if (idx === -1) {
    el.textContent = text;
    return;
  }

  if (idx > 0) {
    el.appendChild(document.createTextNode(text.slice(0, idx)));
  }

  const link = document.createElement("a");
  link.href = RESOLUTION_768_URL;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = marker;
  el.appendChild(link);

  if (idx + marker.length < text.length) {
    el.appendChild(document.createTextNode(text.slice(idx + marker.length)));
  }
}

function getSelectedContractType() {
  const selected = document.querySelector('input[name="contractType"]:checked');
  return selected ? selected.value : null;
}

function getSelectedServiceStatus() {
  const selected = document.querySelector('input[name="serviceStatus"]:checked');
  return selected ? selected.value : null;
}

function getSelectedCombatUnitType() {
  const selected = document.querySelector('input[name="combatUnitType"]:checked');
  return selected ? selected.value : null;
}

function showsCombatUnitChoice(type) {
  return type === ContractType.COMBAT || type === ContractType.BASIC;
}

/** @returns {string | null} */
function getEffectiveCombatUnitType() {
  const type = getSelectedContractType();
  if (type === ContractType.ASSAULT) {
    return CombatUnitType.COMBAT_UNIT;
  }
  return getSelectedCombatUnitType();
}

function clearCombatUnitSelection() {
  document.querySelectorAll('input[name="combatUnitType"]').forEach(function (input) {
    input.checked = false;
  });
}

function getCombatStepMeta() {
  const type = getSelectedContractType();
  if (type === ContractType.ASSAULT) {
    return {
      title: STEP_META.combat.titleAssault,
      help: STEP_META.combat.help,
    };
  }
  return {
    title: STEP_META.combat.title,
    help: STEP_META.combat.help,
  };
}

function getSelectedContractTermChoice() {
  return null;
}

function requiresContractTermChoice(_status, _type) {
  return false;
}

function clearContractTermChoice() {
  document.querySelectorAll('input[name="contractTermChoice"]').forEach(function (input) {
    input.checked = false;
  });
}

function resetCombatDaysInput() {
  if (combatDaysInput) {
    combatDaysInput.value = "0";
  }
}

function requiresServiceStartDate(status) {
  return requiresServicePeriods(status);
}

function requiresServiceEndDate(status) {
  return status === ServiceStatus.DISCHARGED;
}

function syncContractTermLabels() {
  const status = getSelectedServiceStatus();

  if (contractTermAssault) {
    if (status === ServiceStatus.OBLIGATED) {
      contractTermAssault.textContent = "Термін контракту — 14 місяців";
    } else if (status === ServiceStatus.ACTIVE) {
      contractTermAssault.textContent = "Термін контракту — 10 місяців";
    } else if (status === ServiceStatus.DISCHARGED) {
      contractTermAssault.textContent = "Термін контракту — 6 місяців";
    } else {
      contractTermAssault.textContent = "Термін контракту залежить від статусу";
    }
  }

  if (contractTermCombat) {
    contractTermCombat.textContent = "Термін контракту — 24 місяці";
  }

  if (contractTermBasic) {
    contractTermBasic.textContent = "Термін контракту — 24 місяці";
  }
}

function syncStatusFields() {
  const status = getSelectedServiceStatus();
  const showPeriods = requiresServicePeriods(status);

  if (contractStartLabel) {
    contractStartLabel.textContent =
      status === ServiceStatus.OBLIGATED
        ? CONTRACT_START_LABELS.obligated
        : CONTRACT_START_LABELS.other;
  }

  if (servicePeriodsField) {
    servicePeriodsField.hidden = !showPeriods;
  }

  if (!showPeriods) {
    clearServicePeriods();
  } else {
    ensureServicePeriods();
  }

  syncContractTermLabels();
  syncContractTermField();
}

function syncContractTermField() {
  const status = getSelectedServiceStatus();
  const type = getSelectedContractType();
  const showTermChoice = requiresContractTermChoice(status, type);

  if (contractTermField) {
    contractTermField.hidden = !showTermChoice;
  }

  if (!showTermChoice) {
    clearContractTermChoice();
  }
}

function syncCombatFields() {
  const type = getSelectedContractType();
  const showUnitChoice = showsCombatUnitChoice(type);

  if (combatAssignmentField) {
    combatAssignmentField.hidden = !showUnitChoice;
  }

  if (!showUnitChoice) {
    clearCombatUnitSelection();
  }

  if (combatDaysField) {
    combatDaysField.hidden = false;
  }
}

function getCurrentStepId() {
  return WIZARD_STEPS[currentStepIndex];
}

function areServicePeriodsFilled(status) {
  const rows = getServicePeriodRows();
  if (!rows.length) return false;

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    const startInput = row.querySelector('[data-period-field="start"]');
    const endInput = row.querySelector('[data-period-field="end"]');
    const startDate = parseDateValue(startInput && startInput.value);
    const endDate = parseDateValue(endInput && endInput.value);

    if (!startDate) return false;
    if (periodNeedsEndDate(status, i, rows.length) && !endDate) return false;
  }

  return true;
}

function collectServicePeriodOrderError() {
  const status = getSelectedServiceStatus();
  if (!requiresServicePeriods(status)) return null;

  const rows = getServicePeriodRows();
  /** @type {{ startDate: Date, endDate?: Date, row: Element, index: number }[]} */
  const periods = [];

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    const startInput = row.querySelector('[data-period-field="start"]');
    const endInput = row.querySelector('[data-period-field="end"]');
    const startDate = parseDateValue(startInput && startInput.value);
    const endDate = parseDateValue(endInput && endInput.value);
    if (!startDate) continue;

    if (endDate && endDate.getTime() <= startDate.getTime()) {
      return {
        id: row.id || "field-service-periods",
        label: PERIOD_END_BEFORE_START_ERROR,
        focusSelector: "#" + (endInput && endInput.id),
        kind: "date-order",
      };
    }

    periods.push({ startDate, endDate: endDate || undefined, row, index: i });
  }

  const sorted = periods.slice().sort(function (a, b) {
    return a.startDate.getTime() - b.startDate.getTime();
  });

  for (let i = 1; i < sorted.length; i += 1) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    if (!prev.endDate || curr.startDate.getTime() < prev.endDate.getTime()) {
      const startEl = curr.row.querySelector('[data-period-field="start"]');
      return {
        id: "field-service-periods",
        label: PERIODS_OVERLAP_ERROR,
        focusSelector:
          startEl && startEl.id ? "#" + startEl.id : "#field-service-periods",
        kind: "date-order",
      };
    }
  }

  return null;
}

function isStepFilled(stepId) {
  const status = getSelectedServiceStatus();
  const type = getSelectedContractType();
  const combatUnitType = getSelectedCombatUnitType();
  const termChoice = getSelectedContractTermChoice();

  switch (stepId) {
    case "status":
      if (!status) return false;
      if (requiresServicePeriods(status)) {
        return areServicePeriodsFilled(status);
      }
      return true;
    case "contract":
      if (!type || !parseDateInput("contract-start-date")) {
        return false;
      }
      if (requiresContractTermChoice(status, type) && !termChoice) {
        return false;
      }
      return true;
    case "combat": {
      if (showsCombatUnitChoice(type) && !combatUnitType) {
        return false;
      }
      const combatDays = parseIntegerInput("combat-days-input");
      return (
        Number.isInteger(combatDays) &&
        combatDays >= 0 &&
        combatDays <= MAX_COMBAT_DAYS
      );
    }
    default:
      return false;
  }
}

function validateCurrentStep(stepId) {
  if (stepId === "combat") {
    const combatDays = parseIntegerInput("combat-days-input");
    if (Number.isInteger(combatDays) && combatDays > MAX_COMBAT_DAYS) {
      return [COMBAT_DAYS_MAX_ERROR];
    }
  }

  if (!isStepFilled(stepId)) {
    return ["Заповніть усі поля на цьому кроці, щоб продовжити."];
  }

  if (stepId === "status") {
    const periodError = collectServicePeriodOrderError();
    if (periodError) {
      return [periodError.label];
    }
  }

  if (stepId === "contract") {
    const dateOrderError = collectDateOrderError();
    if (dateOrderError.length) {
      return [dateOrderError[0].label];
    }
  }

  if (stepId === "combat") {
    const dateOrderError = collectDateOrderError();
    if (dateOrderError.length) {
      return [dateOrderError[0].label];
    }
  }

  return [];
}

function clearWizardError() {
  if (!wizardError) return;
  wizardError.hidden = true;
  wizardError.textContent = "";
}

function showWizardError(message) {
  if (!wizardError) return;
  wizardError.textContent = message;
  wizardError.hidden = false;
}

function updateContinueButton() {
  if (!wizardContinue) return;
  const stepId = getCurrentStepId();
  wizardContinue.disabled = !isStepFilled(stepId);
  wizardContinue.textContent =
    currentStepIndex === WIZARD_STEP_COUNT - 1 ? "Розрахувати" : "Продовжити";
}

function renderWizardStep() {
  const stepId = getCurrentStepId();

  wizardSteps.forEach(function (el) {
    el.hidden = el.dataset.stepId !== stepId;
  });

  syncStatusFields();
  syncCombatFields();

  if (wizardProgress) {
    wizardProgress.textContent = currentStepIndex + 1 + "/" + WIZARD_STEP_COUNT;
  }

  if (wizardQuestion) {
    wizardQuestion.textContent =
      stepId === "combat"
        ? getCombatStepMeta().title
        : STEP_META[stepId].title;
  }

  if (wizardHelp) {
    const helpText =
      stepId === "combat"
        ? getCombatStepMeta().help
        : STEP_META[stepId].help;
    setTextWithResolutionLink(wizardHelp, helpText);
  }

  if (wizardBack) {
    wizardBack.hidden = currentStepIndex === 0;
  }

  clearWizardError();
  clearStepInvalid();
  clearValidationSummary();
  updateContinueButton();
}

function goToNextStep() {
  const stepId = getCurrentStepId();
  const errors = validateCurrentStep(stepId);

  if (errors.length) {
    showWizardError(errors[0]);
    return;
  }

  clearWizardError();

  if (currentStepIndex < WIZARD_STEP_COUNT - 1) {
    currentStepIndex += 1;
    renderWizardStep();
    return;
  }

  runCalculation();
}

function goToPreviousStep() {
  if (currentStepIndex === 0) return;
  currentStepIndex -= 1;
  renderWizardStep();
}

function onWizardInputChange() {
  syncStatusFields();
  syncContractTermField();
  syncCombatFields();
  clearStepInvalid();

  if (getCurrentStepId() === "combat") {
    const combatDays = parseIntegerInput("combat-days-input");
    if (Number.isInteger(combatDays) && combatDays > MAX_COMBAT_DAYS) {
      showWizardError(COMBAT_DAYS_MAX_ERROR);
    } else {
      clearWizardError();
    }
  } else {
    clearWizardError();
  }

  updateContinueButton();
}

function collectMissing() {
  const missing = [];
  const serviceStatus = getSelectedServiceStatus();
  const contractType = getSelectedContractType();

  if (!serviceStatus) {
    missing.push({
      id: "field-service-status",
      label: "Статус",
      focusSelector: 'input[name="serviceStatus"]',
    });
  }

  if (requiresServicePeriods(serviceStatus) && !areServicePeriodsFilled(serviceStatus)) {
    missing.push({
      id: "field-service-periods",
      label: "Періоди служби",
      focusSelector: '[data-period-field="start"]',
    });
  }

  if (!contractType) {
    missing.push({
      id: "field-contract-type",
      label: "Тип контракту",
      focusSelector: 'input[name="contractType"]',
    });
  }

  if (
    requiresContractTermChoice(serviceStatus, contractType) &&
    !getSelectedContractTermChoice()
  ) {
    missing.push({
      id: "field-contract-term",
      label: "Термін контракту",
      focusSelector: 'input[name="contractTermChoice"]',
    });
  }

  if (!parseDateInput("contract-start-date")) {
    missing.push({
      id: "field-contract-start",
      label: "Дата підписання нового контракту",
      focusSelector: "#contract-start-date",
    });
  }

  if (
    showsCombatUnitChoice(contractType) &&
    !getSelectedCombatUnitType()
  ) {
    missing.push({
      id: "field-combat-assignment",
      label: "Участь у бойових діях",
      focusSelector: 'input[name="combatUnitType"]',
    });
  }

  const combatDays = parseIntegerInput("combat-days-input");
  if (
    !Number.isInteger(combatDays) ||
    combatDays < 0 ||
    combatDays > MAX_COMBAT_DAYS
  ) {
    missing.push({
      id: "field-combat-days",
      label:
        Number.isInteger(combatDays) && combatDays > MAX_COMBAT_DAYS
          ? COMBAT_DAYS_MAX_ERROR
          : "Кількість днів участі в бойових діях",
      focusSelector: "#combat-days-input",
    });
  }

  return missing;
}

function collectDateOrderError() {
  const serviceStatus = getSelectedServiceStatus();
  const contractStartDate = parseDateInput("contract-start-date");
  const periods = readServicePeriodsFromForm();

  if (!requiresServicePeriods(serviceStatus) && periods.length === 0) {
    return [];
  }

  const periodError = collectServicePeriodOrderError();
  if (periodError) {
    return [periodError];
  }

  if (!contractStartDate) {
    return [];
  }

  for (let i = 0; i < periods.length; i += 1) {
    const period = periods[i];
    const row = getServicePeriodRows()[i];
    const startInput = row && row.querySelector('[data-period-field="start"]');
    const endInput = row && row.querySelector('[data-period-field="end"]');

    if (period.startDate.getTime() > contractStartDate.getTime()) {
      return [
        {
          id: "field-service-periods",
          label: SERVICE_AFTER_CONTRACT_ERROR,
          focusSelector: startInput ? "#" + startInput.id : "#field-service-periods",
          invalidIds: ["field-service-periods", "field-contract-start"],
          kind: "date-order",
        },
      ];
    }

    if (
      period.endDate &&
      period.endDate.getTime() >= contractStartDate.getTime()
    ) {
      return [
        {
          id: "field-service-periods",
          label: PERIOD_END_AFTER_CONTRACT_ERROR,
          focusSelector: endInput ? "#" + endInput.id : "#field-service-periods",
          invalidIds: ["field-service-periods", "field-contract-start"],
          kind: "date-order",
        },
      ];
    }
  }

  return [];
}

function clearValidationSummary() {
  if (summary) summary.hidden = true;
  if (listEl) listEl.replaceChildren();
  parkSummary();
}

function syncDateFieldState(input) {
  if (!input) return;
  input.classList.toggle("is-empty", !input.value);
}

function openDatePicker(input) {
  if (!input) return;

  if (typeof input.showPicker === "function") {
    try {
      input.showPicker();
      return;
    } catch (error) {
      // Browser blocked showPicker without user gesture — fall back to focus.
    }
  }

  input.focus();
}

function bindDateField(field) {
  const input = field.querySelector(".date-input");
  const trigger = field.querySelector(".date-field__trigger");
  if (!input || input.dataset.dateBound === "1") return;

  input.dataset.dateBound = "1";
  syncDateFieldState(input);
  input.addEventListener("input", function () {
    syncDateFieldState(input);
    onWizardInputChange();
  });
  input.addEventListener("change", function () {
    syncDateFieldState(input);
    onWizardInputChange();
  });
  input.addEventListener("click", function () {
    openDatePicker(input);
  });

  if (trigger) {
    trigger.addEventListener("click", function () {
      openDatePicker(input);
    });
  }
}

function initDateFields() {
  section.querySelectorAll(".date-field").forEach(bindDateField);
}

if (!section) {
  throw new Error("Deferral calculator markup is missing");
}

function parkSummary() {
  if (formActions && summary) {
    section.insertBefore(summary, formActions);
  }
}

function mountSummaryBeforeFirst(missing) {
  if (!missing.length || !summary) return;
  const wizardNav = document.querySelector(".wizard__nav");
  if (wizardNav && wizardNav.parentNode) {
    wizardNav.parentNode.insertBefore(summary, wizardNav);
  }
}

function clearStepInvalid() {
  section.querySelectorAll(".is-step-invalid").forEach(function (el) {
    el.classList.remove("is-step-invalid");
  });
}

function applyStepInvalid(items) {
  items.forEach(function (item) {
    const ids = item.invalidIds || [item.id];
    ids.forEach(function (id) {
      const el = document.getElementById(id);
      if (el) el.classList.add("is-step-invalid");
    });
  });
}

function updateValidationSummary(items) {
  if (!summaryTitle) return;

  const hasDateOrderError = items.some(function (item) {
    return item.kind === "date-order";
  });

  summaryTitle.textContent = hasDateOrderError
    ? "Перевірте введені дані:"
    : "Щоб розрахувати відстрочку, заповніть поля:";
}

function hideResults() {
  document.body.classList.remove("wizard-results-ready");
  if (wizardPanel) wizardPanel.hidden = false;
  if (wizardResults) wizardResults.hidden = true;
}

function showWizardResultsView() {
  if (wizardPanel) wizardPanel.hidden = true;
  if (wizardResults) wizardResults.hidden = false;
  document.body.classList.add("wizard-results-ready");
}

function returnToWizard() {
  currentStepIndex = 0;
  hideResults();
  clearWizardError();
  clearValidationSummary();
  renderWizardStep();
  if (wizardPanel) {
    wizardPanel.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function clearWizardForm() {
  document.querySelectorAll('input[type="radio"]').forEach(function (input) {
    input.checked = false;
  });

  document.querySelectorAll('input[type="date"]').forEach(function (input) {
    input.value = "";
    syncDateFieldState(input);
  });

  if (combatDaysInput) {
    combatDaysInput.value = "0";
  }

  clearServicePeriods();
  syncStatusFields();
  syncCombatFields();
}

function resetWizard() {
  clearWizardForm();
  returnToWizard();
}

function showValidation(items) {
  applyStepInvalid(items);
  renderList(items);
  mountSummaryBeforeFirst(items);
  updateValidationSummary(items);
  if (summary) summary.hidden = false;
  hideResults();
}

function renderList(missing) {
  if (!listEl) return;
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

function formatDisplayDate(date) {
  return format(date, "dd.MM.yyyy");
}

/**
 * @param {ReturnType<typeof calculate> | null | undefined} [result]
 * @returns {{ label: string, value: string }[]}
 */
function collectInputSummaryRows(result) {
  const status = getSelectedServiceStatus();
  const type = getSelectedContractType();
  const combatUnitType = getEffectiveCombatUnitType();
  const servicePeriods = readServicePeriodsFromForm();
  const contractStartDate = parseDateInput("contract-start-date");
  const combatDays = parseIntegerInput("combat-days-input");

  /** @type {{ label: string, value: string }[]} */
  const rows = [];

  if (status) {
    rows.push({
      label: "Статус",
      value: SERVICE_STATUS_LABELS[status] || status,
    });
  }

  servicePeriods.forEach(function (period, index) {
    const label =
      servicePeriods.length > 1
        ? "Період служби " + (index + 1)
        : "Період служби";
    const endLabel = period.endDate
      ? formatDisplayDate(period.endDate)
      : "досі служить";
    rows.push({
      label: label,
      value: formatDisplayDate(period.startDate) + " – " + endLabel,
    });
  });

  if (type) {
    rows.push({
      label: "Тип контракту",
      value: CONTRACT_TYPE_LABELS[type] || type,
    });
  }

  if (contractStartDate) {
    rows.push({
      label: getContractStartSummaryLabel(status),
      value: formatDisplayDate(contractStartDate),
    });
  }

  if (result) {
    rows.push({
      label: "Термін контракту",
      value: result.contractTermMonths + " міс.",
    });
    rows.push({
      label: "Контракт завершується",
      value: formatDisplayDate(result.contractEndDate),
    });
  }

  if (combatUnitType) {
    rows.push({
      label: "Участь у бойових діях",
      value: COMBAT_UNIT_LABELS[combatUnitType] || combatUnitType,
    });
  }

  if (Number.isInteger(combatDays) && combatDays >= 0) {
    rows.push({
      label: "Дні участі в бойових діях",
      value: String(combatDays),
    });
  }

  return rows;
}

/**
 * @param {ReturnType<typeof calculate> | null | undefined} result
 */
function renderInputSummary(result) {
  if (!wizardResultsInputsList) return;

  wizardResultsInputsList.replaceChildren();

  collectInputSummaryRows(result).forEach(function (row) {
    const wrap = document.createElement("div");
    wrap.className = "input-summary__row";

    const dt = document.createElement("dt");
    dt.className = "input-summary__label";
    dt.textContent = row.label;

    const dd = document.createElement("dd");
    dd.className = "input-summary__value";
    dd.textContent = row.value;

    wrap.appendChild(dt);
    wrap.appendChild(dd);
    wizardResultsInputsList.appendChild(wrap);
  });
}

function renderTotalDeferral(result) {
  if (!wizardResultsTotal) return;

  wizardResultsTotal.replaceChildren();

  const totalRow = document.createElement("div");
  totalRow.className = "results-total";

  const label = document.createElement("p");
  label.className = "results-total__label";
  label.textContent = "Загалом відстрочки:";

  const value = document.createElement("p");
  value.className = "results-total__value";
  value.textContent = result.deferralDurationLabel;

  totalRow.appendChild(label);
  totalRow.appendChild(value);
  wizardResultsTotal.appendChild(totalRow);

  const periodRow = document.createElement("div");
  periodRow.className = "results-period";

  const periodLabel = document.createElement("p");
  periodLabel.className = "results-period__label";
  periodLabel.textContent = "Планований період відстрочки:";

  const periodValue = document.createElement("p");
  periodValue.className = "results-period__value";
  periodValue.textContent =
    formatDisplayDate(result.contractEndDate) +
    " – " +
    formatDisplayDate(result.deferralEndDate);

  periodRow.appendChild(periodLabel);
  periodRow.appendChild(periodValue);
  wizardResultsTotal.appendChild(periodRow);
}

function getContractStartSummaryLabel(status) {
  return status === ServiceStatus.OBLIGATED
    ? "Планова дата підписання контракту"
    : "Дата підписання контракту";
}

function renderExplanation(result, container) {
  const target = container || wizardResultsExplanation;
  if (!target) return;

  target.replaceChildren();

  result.explanation.forEach(function (line) {
    if (line.label === "Загалом відстрочки") {
      return;
    }

    const row = document.createElement("div");
    row.className = "explanation-line explanation-line--summary-row";

    if (isCombatExplanationLine(line.label)) {
      row.classList.add("explanation-line--combat");
    }
    if (line.label.indexOf("до 24.02.2022") !== -1) {
      row.classList.add("explanation-line--years-before");
    }
    if (line.label.indexOf("з 24.02.2022") !== -1) {
      row.classList.add("explanation-line--years-after");
    }

    const main = document.createElement("p");
    main.className = "explanation-line__main";
    if (line.detail) {
      main.textContent = line.label + " - " + line.detail;
    } else {
      main.textContent = line.label;
    }

    const value = document.createElement("p");
    value.className = "explanation-line__value";
    value.textContent = line.contribution;

    const head = document.createElement("div");
    head.className = "explanation-line__head";
    head.appendChild(main);
    head.appendChild(value);
    row.appendChild(head);

    if (line.cite) {
      const cite = document.createElement("p");
      cite.className = "explanation-line__cite";
      cite.textContent = "(" + line.cite + ")";
      row.appendChild(cite);
    }

    target.appendChild(row);
  });
}

function isCombatExplanationLine(label) {
  return COMBAT_EXPLANATION_LABELS.includes(label);
}

function showResults(result) {
  renderInputSummary(result);
  renderTotalDeferral(result);
  renderExplanation(result, wizardResultsExplanation);
  showWizardResultsView();

  if (wizardResults) {
    wizardResults.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function bindStepper(inputId, decId, incId, min, max) {
  const input = document.getElementById(inputId);
  const dec = document.getElementById(decId);
  const inc = document.getElementById(incId);

  if (!input || !dec || !inc) return;

  function readValue() {
    const parsed = Number.parseInt(input.value, 10);
    return Number.isNaN(parsed) ? min : parsed;
  }

  function syncStepperButtons() {
    const value = readValue();
    dec.disabled = value <= min;
    inc.disabled = value >= max;
  }

  function writeValue(value) {
    const next = Math.min(max, Math.max(min, value));
    input.value = String(next);
    syncStepperButtons();
    onWizardInputChange();
  }

  dec.addEventListener("click", function () {
    if (dec.disabled) return;
    writeValue(readValue() - 1);
  });

  inc.addEventListener("click", function () {
    if (inc.disabled) return;
    writeValue(readValue() + 1);
  });

  input.addEventListener("input", function () {
    syncStepperButtons();
    onWizardInputChange();
  });

  input.addEventListener("change", function () {
    const value = readValue();
    if (value < min) {
      input.value = String(min);
    }
    syncStepperButtons();
    onWizardInputChange();
  });

  syncStepperButtons();
}

function buildInput() {
  const serviceStatus = getSelectedServiceStatus();
  const contractType = getSelectedContractType();
  const servicePeriods = readServicePeriodsFromForm();
  const contractStartDate = parseDateInput("contract-start-date");
  const combatUnitType = getEffectiveCombatUnitType();
  const termChoice = getSelectedContractTermChoice();

  if (!serviceStatus || !contractType || !contractStartDate || !combatUnitType) {
    return null;
  }

  if (requiresServicePeriods(serviceStatus) && !areServicePeriodsFilled(serviceStatus)) {
    return null;
  }

  if (requiresContractTermChoice(serviceStatus, contractType) && !termChoice) {
    return null;
  }

  const input = {
    serviceStatus,
    contractType,
    contractStartDate,
    combatUnitType,
    combatDays: parseIntegerInput("combat-days-input"),
  };

  if (servicePeriods.length) {
    input.servicePeriods = servicePeriods;
  }

  if (requiresContractTermChoice(serviceStatus, contractType)) {
    input.contractTermChoice = termChoice;
  }

  return input;
}

function showCalculatorError(error) {
  if (!(error instanceof Error) || !error.message) {
    hideResults();
    return;
  }

  showWizardError(error.message);
}

function runCalculation() {
  const dateOrderError = collectDateOrderError();
  if (dateOrderError.length) {
    showWizardError(dateOrderError[0].label);
    return;
  }

  clearValidationSummary();
  clearWizardError();

  const missing = collectMissing();
  if (missing.length) {
    hideResults();
    return;
  }

  try {
    const result = calculate(buildInput());
    showResults(result);
  } catch (error) {
    showCalculatorError(error);
  }
}

section.addEventListener("change", function (e) {
  if (e.target && e.target.name === "serviceStatus") {
    clearContractTermChoice();
    syncStatusFields();
  }
  if (e.target && e.target.name === "contractType") {
    clearContractTermChoice();
    syncContractTermField();
    syncCombatFields();
    if (getCurrentStepId() === "combat") {
      renderWizardStep();
      return;
    }
  }
  if (e.target && e.target.name === "contractTermChoice") {
    syncContractTermField();
  }
  if (e.target && e.target.name === "combatUnitType") {
    syncCombatFields();
  }
  onWizardInputChange();
});

section.addEventListener("input", onWizardInputChange);

if (wizardContinue) {
  wizardContinue.addEventListener("click", goToNextStep);
}

if (wizardBack) {
  wizardBack.addEventListener("click", goToPreviousStep);
}

if (wizardRestart) {
  wizardRestart.addEventListener("click", resetWizard);
}

if (wizardEdit) {
  wizardEdit.addEventListener("click", returnToWizard);
}

if (servicePeriodAddBtn) {
  servicePeriodAddBtn.addEventListener("click", function () {
    addServicePeriod();
  });
}

bindStepper("combat-days-input", "combat-days-dec", "combat-days-inc", 0, MAX_COMBAT_DAYS);
syncStatusFields();
syncCombatFields();
initDateFields();
renderWizardStep();

})();
