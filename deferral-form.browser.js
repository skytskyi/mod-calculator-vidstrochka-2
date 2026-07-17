(function () {
  const { format } = window.DateFnsLite;
  const { ContractType, ServiceStatus, RESOLUTION_768_URL, RESOLUTION_768_CITE, calculate, getCombatExplanationLabels } = window.DeferralCalculator;


const section = document.querySelector(".form-block");
const summary = document.getElementById("calc-validation");
const listEl = document.getElementById("calc-validation-list");
const formActions = document.getElementById("form-actions-anchor");

const combatDaysField = document.getElementById("field-combat-days");
const combatAssignmentField = document.getElementById("field-combat-assignment");
const combatDaysInput = document.getElementById("combat-days-input");
const serviceStartField = document.getElementById("field-service-start");
const serviceEndField = document.getElementById("field-service-end");
const contractTermField = document.getElementById("field-contract-term");
const contractStartLabel = document.getElementById("contract-start-label");
const contractTermAssault = document.getElementById("contract-term-assault");
const contractTermCombat = document.getElementById("contract-term-combat");
const contractTermBasic = document.getElementById("contract-term-basic");
const serviceStartInput = document.getElementById("service-start-date");
const serviceEndInput = document.getElementById("service-end-date");

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
const wizardEdit = document.getElementById("wizard-edit");
const wizardRestart = document.getElementById("wizard-restart");

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
      "Оберіть поточний статус. Якщо ви військовий або звільнений зі служби, вкажіть дати служби — вони потрібні для врахування стажу до та після 24 лютого 2022 року.",
  },
  contract: {
    title: "Дані про новий контракт",
    help:
      "Оберіть тип контракту та дату його підписання. Термін контракту залежить від статусу: для звільнених зі служби на бойовому або базовому контракті додатково оберіть «від 6» або «24 місяці».",
  },
  combat: {
    title: "Участь у бойових діях під час нового контракту",
    help:
      "Оберіть, чи будете виконувати завдання у бойових частинах, та вкажіть кількість днів участі. 0 означає відсутність участі. Це впливає на розрахунок відстрочки за абз. 3 або 6 п. 22 постанови №768.",
  },
};

const CONTRACT_START_LABELS = {
  obligated: "Планова дата підписання нового контракту",
  other: "Планова або фактична дата підписання нового контракту",
};

const SERVICE_AFTER_CONTRACT_ERROR =
  "Дата початку військової служби не може бути пізнішою за планову або фактичну дату підписання нового контракту";

const DISCHARGE_BEFORE_START_ERROR =
  "Дата звільнення з військової служби має бути пізнішою за дату початку служби";

const DISCHARGE_AFTER_CONTRACT_ERROR =
  "Дата звільнення з військової служби має бути ранішою за планову або фактичну дату підписання нового контракту";

const COMBAT_EXPLANATION_LABELS = getCombatExplanationLabels();

const summaryTitle = summary
  ? summary.querySelector(".form-validation-summary__title")
  : null;

function parseDateInput(id) {
  const el = document.getElementById(id);
  if (!el || !el.value) return null;
  const [year, month, day] = el.value.split("-").map(Number);
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

function getSelectedContractTermChoice() {
  const selected = document.querySelector('input[name="contractTermChoice"]:checked');
  if (!selected) return null;
  const value = Number.parseInt(selected.value, 10);
  return value === 6 || value === 24 ? value : null;
}

function requiresContractTermChoice(status, type) {
  return (
    status === ServiceStatus.DISCHARGED &&
    (type === ContractType.COMBAT || type === ContractType.BASIC)
  );
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
  return status === ServiceStatus.ACTIVE || status === ServiceStatus.DISCHARGED;
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
    contractTermCombat.textContent =
      status === ServiceStatus.DISCHARGED
        ? "Термін контракту — від 6 або 24 місяці"
        : "Термін контракту — 24 місяці";
  }

  if (contractTermBasic) {
    contractTermBasic.textContent =
      status === ServiceStatus.DISCHARGED
        ? "Термін контракту — від 6 або 24 місяці"
        : "Термін контракту — 24 місяці";
  }
}

function syncStatusFields() {
  const status = getSelectedServiceStatus();
  const showServiceStart = requiresServiceStartDate(status);
  const showServiceEnd = requiresServiceEndDate(status);

  if (contractStartLabel) {
    contractStartLabel.textContent =
      status === ServiceStatus.OBLIGATED
        ? CONTRACT_START_LABELS.obligated
        : CONTRACT_START_LABELS.other;
  }

  if (serviceStartField) {
    serviceStartField.hidden = !showServiceStart;
  }

  if (serviceEndField) {
    serviceEndField.hidden = !showServiceEnd;
  }

  if (!showServiceStart && serviceStartInput) {
    serviceStartInput.value = "";
    syncDateFieldState(serviceStartInput);
  }

  if (!showServiceEnd && serviceEndInput) {
    serviceEndInput.value = "";
    syncDateFieldState(serviceEndInput);
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
  if (combatAssignmentField) {
    combatAssignmentField.hidden = false;
  }

  if (combatDaysField) {
    combatDaysField.hidden = false;
  }
}

function getCurrentStepId() {
  return WIZARD_STEPS[currentStepIndex];
}

function isStepFilled(stepId) {
  const status = getSelectedServiceStatus();
  const type = getSelectedContractType();
  const combatUnitType = getSelectedCombatUnitType();
  const termChoice = getSelectedContractTermChoice();

  switch (stepId) {
    case "status":
      if (!status) return false;
      if (requiresServiceStartDate(status) && !parseDateInput("service-start-date")) {
        return false;
      }
      if (requiresServiceEndDate(status) && !parseDateInput("service-end-date")) {
        return false;
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
      if (!combatUnitType) return false;
      const combatDays = parseIntegerInput("combat-days-input");
      return Number.isInteger(combatDays) && combatDays >= 0;
    }
    default:
      return false;
  }
}

function validateCurrentStep(stepId) {
  if (!isStepFilled(stepId)) {
    return ["Заповніть усі поля на цьому кроці, щоб продовжити."];
  }

  if (stepId === "status") {
    const serviceStartDate = parseDateInput("service-start-date");
    const serviceEndDate = parseDateInput("service-end-date");

    if (
      serviceStartDate &&
      serviceEndDate &&
      serviceEndDate.getTime() <= serviceStartDate.getTime()
    ) {
      return [DISCHARGE_BEFORE_START_ERROR];
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
    wizardQuestion.textContent = STEP_META[stepId].title;
  }

  if (wizardHelp) {
    setTextWithResolutionLink(wizardHelp, STEP_META[stepId].help);
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
  clearWizardError();
  clearStepInvalid();
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

  if (requiresServiceStartDate(serviceStatus) && !parseDateInput("service-start-date")) {
    missing.push({
      id: "field-service-start",
      label: "Дата початку військової служби",
      focusSelector: "#service-start-date",
    });
  }

  if (requiresServiceEndDate(serviceStatus) && !parseDateInput("service-end-date")) {
    missing.push({
      id: "field-service-end",
      label: "Дата звільнення з військової служби",
      focusSelector: "#service-end-date",
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

  if (!getSelectedCombatUnitType()) {
    missing.push({
      id: "field-combat-assignment",
      label: "Участь у бойових діях",
      focusSelector: 'input[name="combatUnitType"]',
    });
  }

  const combatDays = parseIntegerInput("combat-days-input");
  if (!Number.isInteger(combatDays) || combatDays < 0) {
    missing.push({
      id: "field-combat-days",
      label: "Кількість днів участі в бойових діях",
      focusSelector: "#combat-days-input",
    });
  }

  return missing;
}

function collectDateOrderError() {
  const serviceStatus = getSelectedServiceStatus();
  const serviceStartDate = parseDateInput("service-start-date");
  const serviceEndDate = parseDateInput("service-end-date");
  const contractStartDate = parseDateInput("contract-start-date");

  if (!requiresServiceStartDate(serviceStatus) && !serviceStartDate) {
    return [];
  }

  if (
    serviceStartDate &&
    contractStartDate &&
    serviceStartDate.getTime() > contractStartDate.getTime()
  ) {
    return [
      {
        id: "field-service-start",
        label: SERVICE_AFTER_CONTRACT_ERROR,
        focusSelector: "#service-start-date",
        invalidIds: ["field-service-start", "field-contract-start"],
        kind: "date-order",
      },
    ];
  }

  if (requiresServiceEndDate(serviceStatus)) {
    if (
      serviceStartDate &&
      serviceEndDate &&
      serviceEndDate.getTime() <= serviceStartDate.getTime()
    ) {
      return [
        {
          id: "field-service-end",
          label: DISCHARGE_BEFORE_START_ERROR,
          focusSelector: "#service-end-date",
          invalidIds: ["field-service-start", "field-service-end"],
          kind: "date-order",
        },
      ];
    }

    if (
      serviceEndDate &&
      contractStartDate &&
      serviceEndDate.getTime() >= contractStartDate.getTime()
    ) {
      return [
        {
          id: "field-service-end",
          label: DISCHARGE_AFTER_CONTRACT_ERROR,
          focusSelector: "#service-end-date",
          invalidIds: ["field-service-end", "field-contract-start"],
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

function initDateFields() {
  section.querySelectorAll(".date-field").forEach(function (field) {
    const input = field.querySelector(".date-input");
    const trigger = field.querySelector(".date-field__trigger");
    if (!input) return;

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
  });
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
 * @returns {{ label: string, value: string }[]}
 */
function collectInputSummaryRows() {
  const status = getSelectedServiceStatus();
  const type = getSelectedContractType();
  const termChoice = getSelectedContractTermChoice();
  const combatUnitType = getSelectedCombatUnitType();
  const serviceStartDate = parseDateInput("service-start-date");
  const serviceEndDate = parseDateInput("service-end-date");
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

  if (serviceStartDate) {
    rows.push({
      label: "Дата початку служби",
      value: formatDisplayDate(serviceStartDate),
    });
  }

  if (serviceEndDate) {
    rows.push({
      label: "Дата звільнення",
      value: formatDisplayDate(serviceEndDate),
    });
  }

  if (type) {
    rows.push({
      label: "Тип контракту",
      value: CONTRACT_TYPE_LABELS[type] || type,
    });
  }

  if (requiresContractTermChoice(status, type) && termChoice) {
    rows.push({
      label: "Термін контракту",
      value: termChoice === 6 ? "Від 6 місяців" : "24 місяці",
    });
  }

  if (contractStartDate) {
    const startLabel =
      status === ServiceStatus.OBLIGATED
        ? "Планова дата підписання"
        : "Дата підписання контракту";
    rows.push({
      label: startLabel,
      value: formatDisplayDate(contractStartDate),
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

function renderInputSummary() {
  if (!wizardResultsInputsList) return;

  wizardResultsInputsList.replaceChildren();

  collectInputSummaryRows().forEach(function (row) {
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

function appendExplanationSummaryRow(container, label, value) {
  const row = document.createElement("div");
  row.className = "explanation-line explanation-line--total explanation-line--summary-row";

  const head = document.createElement("div");
  head.className = "explanation-line__head";

  const labelEl = document.createElement("p");
  labelEl.className = "explanation-line__value";
  labelEl.textContent = label;

  const valueEl = document.createElement("p");
  valueEl.className = "explanation-line__value";
  valueEl.textContent = value;

  head.appendChild(labelEl);
  head.appendChild(valueEl);
  row.appendChild(head);
  container.appendChild(row);
}

function renderExplanation(result, container) {
  const target = container || wizardResultsExplanation;
  if (!target) return;

  target.replaceChildren();

  result.explanation.forEach(function (line, index) {
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

    const label = document.createElement("p");
    label.className = "explanation-line__label";
    label.textContent = line.label + ":";

    const value = document.createElement("p");
    value.className = "explanation-line__value";
    value.textContent = line.contribution;

    const head = document.createElement("div");
    head.className = "explanation-line__head";
    head.appendChild(label);
    head.appendChild(value);
    row.appendChild(head);

    if (line.detail) {
      const detail = document.createElement("p");
      detail.className = "explanation-line__detail";
      setTextWithResolutionLink(detail, line.detail);
      row.appendChild(detail);
    }

    target.appendChild(row);
  });

  const ruleBefore = document.createElement("div");
  ruleBefore.className = "explanation-line__rule";
  ruleBefore.setAttribute("role", "presentation");
  target.appendChild(ruleBefore);

  appendExplanationSummaryRow(
    target,
    "Загалом відстрочки:",
    result.deferralDurationLabel
  );
  appendExplanationSummaryRow(
    target,
    "Термін контракту:",
    result.contractTermMonths + " міс."
  );
  appendExplanationSummaryRow(
    target,
    "Контракт завершується:",
    formatDisplayDate(result.contractEndDate)
  );
  appendExplanationSummaryRow(
    target,
    "Відстрочка діє до:",
    formatDisplayDate(result.deferralEndDate)
  );
}

function isCombatExplanationLine(label) {
  return COMBAT_EXPLANATION_LABELS.includes(label);
}

function showResults(result) {
  renderInputSummary();
  renderExplanation(result, wizardResultsExplanation);
  showWizardResultsView();

  if (wizardResults) {
    wizardResults.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function bindStepper(inputId, decId, incId, min) {
  const input = document.getElementById(inputId);
  const dec = document.getElementById(decId);
  const inc = document.getElementById(incId);

  if (!input || !dec || !inc) return;

  function readValue() {
    const parsed = Number.parseInt(input.value, 10);
    return Number.isNaN(parsed) ? min : parsed;
  }

  function writeValue(value) {
    input.value = String(Math.max(min, value));
    onWizardInputChange();
  }

  dec.addEventListener("click", function () {
    writeValue(readValue() - 1);
  });

  inc.addEventListener("click", function () {
    writeValue(readValue() + 1);
  });

  input.addEventListener("input", onWizardInputChange);
}

function buildInput() {
  const serviceStatus = getSelectedServiceStatus();
  const contractType = getSelectedContractType();
  const serviceStartDate = parseDateInput("service-start-date");
  const serviceEndDate = parseDateInput("service-end-date");
  const contractStartDate = parseDateInput("contract-start-date");
  const combatUnitType = getSelectedCombatUnitType();
  const termChoice = getSelectedContractTermChoice();

  if (!serviceStatus || !contractType || !contractStartDate || !combatUnitType) {
    return null;
  }

  if (requiresServiceStartDate(serviceStatus) && !serviceStartDate) {
    return null;
  }

  if (requiresServiceEndDate(serviceStatus) && !serviceEndDate) {
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

  if (requiresServiceStartDate(serviceStatus) || serviceStartDate) {
    input.serviceStartDate = serviceStartDate;
  }

  if (requiresServiceEndDate(serviceStatus)) {
    input.serviceEndDate = serviceEndDate;
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

if (wizardEdit) {
  wizardEdit.addEventListener("click", returnToWizard);
}

if (wizardRestart) {
  wizardRestart.addEventListener("click", resetWizard);
}

bindStepper("combat-days-input", "combat-days-dec", "combat-days-inc", 0);
syncStatusFields();
syncCombatFields();
initDateFields();
renderWizardStep();

})();
