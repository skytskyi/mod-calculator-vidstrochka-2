(function () {
  const { format } = window.DateFnsLite;
  const { ContractType, ServiceStatus, calculate, formatDurationParts, getCombatExplanationLabels } = window.DeferralCalculator;


const section = document.querySelector(".form-block");
const summary = document.getElementById("calc-validation");
const listEl = document.getElementById("calc-validation-list");
const formActions = document.getElementById("form-actions-anchor");

const combatDaysField = document.getElementById("field-combat-days");
const combatAssignmentField = document.getElementById("field-combat-assignment");
const combatAssignmentGrid = document.getElementById("combat-assignment-grid");
const combatOptionNoneLabel = document.getElementById("combat-option-none-label");
const combatOptionFirstLine = document.getElementById("combat-option-first-line");
const combatOptionNotFirstLine = document.getElementById("combat-option-not-first-line");
const combatDaysInput = document.getElementById("combat-days-input");
const serviceStartField = document.getElementById("field-service-start");
const serviceEndField = document.getElementById("field-service-end");
const contractStartLabel = document.getElementById("contract-start-label");
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
const wizardResultsDuration = document.getElementById("wizard-results-duration");
const wizardResultsExplanation = document.getElementById("wizard-results-explanation");
const wizardRestart = document.getElementById("wizard-restart");

let currentStepIndex = 0;

const WIZARD_STEP_COUNT = 3;
const WIZARD_STEPS = ["status", "contract", "combat"];

const STEP_META = {
  status: {
    title: "Ваш статус та дані про службу",
    help:
      "Оберіть поточний статус. Якщо ви проходили або проходите службу, вкажіть дати початку та, за потреби, звільнення. Вони потрібні для врахування стажу до та після 24 лютого 2022 року.",
  },
  contract: {
    title: "Дані про новий контракт",
    help:
      "Оберіть тип контракту та дату його підписання. Від цього залежить термін служби та базова гарантована відстрочка після завершення контракту.",
  },
  combat: {
    title: "Бойові завдання під час нового контракту",
    help:
      "Для бойового та базового контрактів оберіть, чи передбачені бойові завдання. Якщо потрібно, вкажіть очікувану кількість днів їх виконання — це може збільшити тривалість відстрочки.",
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

const CombatAssignment = {
  NONE: "NONE",
  FIRST_LINE: "FIRST_LINE",
  NOT_FIRST_LINE: "NOT_FIRST_LINE",
};

function getSelectedContractType() {
  const selected = document.querySelector('input[name="contractType"]:checked');
  return selected ? selected.value : null;
}

function getSelectedServiceStatus() {
  const selected = document.querySelector('input[name="serviceStatus"]:checked');
  return selected ? selected.value : null;
}

function getSelectedCombatAssignment() {
  const selected = document.querySelector('input[name="combatAssignment"]:checked');
  return selected ? selected.value : null;
}

function showsCombatAssignment(type) {
  return type === ContractType.COMBAT || type === ContractType.BASIC;
}

function requiresCombatDaysInput(assignment) {
  return (
    assignment === CombatAssignment.FIRST_LINE ||
    assignment === CombatAssignment.NOT_FIRST_LINE
  );
}

function requiresCombatDaysField(type, assignment) {
  return type === ContractType.ASSAULT || requiresCombatDaysInput(assignment);
}

function clearCombatAssignmentSelection() {
  document.querySelectorAll('input[name="combatAssignment"]').forEach(function (input) {
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
}

function syncCombatFields() {
  const type = getSelectedContractType();
  const assignment = getSelectedCombatAssignment();

  if (type === ContractType.COMBAT) {
    if (combatAssignmentGrid) {
      combatAssignmentGrid.setAttribute("data-layout", "combat");
    }
    if (combatOptionFirstLine) {
      combatOptionFirstLine.hidden = false;
    }
  } else if (type === ContractType.BASIC) {
    if (combatAssignmentGrid) {
      combatAssignmentGrid.setAttribute("data-layout", "basic");
    }
    if (combatOptionFirstLine) {
      combatOptionFirstLine.hidden = true;
    }
    if (assignment === CombatAssignment.FIRST_LINE) {
      clearCombatAssignmentSelection();
    }
  }

  if (combatOptionNoneLabel) {
    combatOptionNoneLabel.textContent =
      type === ContractType.BASIC ? "Без бойових" : "Без бойових завдань";
  }

  const showCombatDays = requiresCombatDaysField(type, assignment);

  if (combatAssignmentField) {
    combatAssignmentField.hidden = !showsCombatAssignment(type);
  }

  if (combatDaysField) {
    combatDaysField.hidden = !showCombatDays;
  }

  if (!showCombatDays) {
    resetCombatDaysInput();
  }
}

function getCurrentStepId() {
  return WIZARD_STEPS[currentStepIndex];
}

function isStepFilled(stepId) {
  const status = getSelectedServiceStatus();
  const type = getSelectedContractType();
  const assignment = getSelectedCombatAssignment();

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
      return !!type && !!parseDateInput("contract-start-date");
    case "combat":
      if (showsCombatAssignment(type) && !assignment) {
        return false;
      }
      if (requiresCombatDaysField(type, assignment)) {
        const combatDays = parseIntegerInput("combat-days-input");
        return Number.isInteger(combatDays) && combatDays >= 0;
      }
      return !!type;
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
    wizardHelp.textContent = STEP_META[stepId].help;
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

  if (!parseDateInput("contract-start-date")) {
    missing.push({
      id: "field-contract-start",
      label: "Дата підписання нового контракту",
      focusSelector: "#contract-start-date",
    });
  }

  if (contractType && showsCombatAssignment(contractType) && !getSelectedCombatAssignment()) {
    missing.push({
      id: "field-combat-assignment",
      label: "Бойові завдання",
      focusSelector: 'input[name="combatAssignment"]',
    });
  } else if (requiresCombatDaysField(contractType, getSelectedCombatAssignment())) {
    const combatDays = parseIntegerInput("combat-days-input");
    if (!Number.isInteger(combatDays) || combatDays < 0) {
      missing.push({
        id: "field-combat-days",
        label: "Кількість днів виконання бойових завдань",
        focusSelector: "#combat-days-input",
      });
    }
  }

  return missing;
}

function collectDateOrderError() {
  const serviceStatus = getSelectedServiceStatus();
  if (!requiresServiceStartDate(serviceStatus)) {
    return [];
  }

  const serviceStartDate = parseDateInput("service-start-date");
  const serviceEndDate = parseDateInput("service-end-date");
  const contractStartDate = parseDateInput("contract-start-date");

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

function resetWizard() {
  currentStepIndex = 0;
  hideResults();
  clearWizardError();
  clearValidationSummary();
  renderWizardStep();
  if (wizardPanel) {
    wizardPanel.scrollIntoView({ behavior: "smooth", block: "start" });
  }
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

function formatExplanationLabel(line) {
  const labelsWithDetailInParens = [
    ...COMBAT_EXPLANATION_LABELS,
    "Повні роки служби до 24.02.2022",
    "Повні роки служби з 24.02.2022 до підписання контракту",
    "Повні роки служби з 24.02.2022 до дати звільнення",
  ];

  if (line.detail && labelsWithDetailInParens.includes(line.label)) {
    return line.label + " (" + line.detail + "):";
  }

  return line.label + ":";
}

function isCombatExplanationLine(label) {
  return COMBAT_EXPLANATION_LABELS.includes(label);
}

function renderExplanation(result, container) {
  const target = container || wizardResultsExplanation;
  if (!target) return;

  target.replaceChildren();

  result.explanation.forEach(function (line, index) {
    const row = document.createElement("div");
    row.className = "explanation-line";
    const isYearsBeforeLine = line.label === "Повні роки служби до 24.02.2022";
    const isYearsAfterLine =
      line.label === "Повні роки служби з 24.02.2022 до підписання контракту" ||
      line.label === "Повні роки служби з 24.02.2022 до дати звільнення";
    const isCombatLine = isCombatExplanationLine(line.label);
    const isInlineHeadRow =
      index === 0 || isYearsBeforeLine || isYearsAfterLine || isCombatLine;
    const usesDetailInLabel = isYearsBeforeLine || isYearsAfterLine || isCombatLine;

    if (isYearsBeforeLine) row.classList.add("explanation-line--years-before");
    if (isYearsAfterLine) row.classList.add("explanation-line--years-after");
    if (isCombatLine) row.classList.add("explanation-line--combat");

    if (isInlineHeadRow) {
      if (index === 0) {
        row.classList.add("explanation-line--summary-row");
      }

      const label = document.createElement("p");
      label.className = "explanation-line__label";
      label.textContent = formatExplanationLabel(line);

      const value = document.createElement("p");
      value.className = "explanation-line__value";
      value.textContent = line.contribution;

      const head = document.createElement("div");
      head.className = "explanation-line__head";
      head.appendChild(label);
      head.appendChild(value);
      row.appendChild(head);

      if (line.detail && !usesDetailInLabel) {
        const detail = document.createElement("p");
        detail.className = "explanation-line__detail";
        detail.textContent = line.detail;
        row.appendChild(detail);
      }
    } else {
      const label = document.createElement("p");
      label.className = "explanation-line__label";
      label.textContent = line.label + ":";
      row.appendChild(label);

      if (line.detail) {
        const detail = document.createElement("p");
        detail.className = "explanation-line__detail";
        detail.textContent = line.detail;
        row.appendChild(detail);
      }

      const value = document.createElement("p");
      value.className = "explanation-line__value";
      value.textContent = line.contribution;
      row.appendChild(value);
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
    "Контракт завершується:",
    formatDisplayDate(result.contractEndDate)
  );
  appendExplanationSummaryRow(
    target,
    "Відстрочка діє до:",
    formatDisplayDate(result.deferralEndDate)
  );
}

function showResults(result) {
  const durationLabel = formatDurationParts(result.deferralDuration);

  if (wizardResultsDuration) {
    wizardResultsDuration.textContent = durationLabel;
  }

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

  if (!serviceStatus || !contractType || !contractStartDate) {
    return null;
  }

  if (requiresServiceStartDate(serviceStatus) && !serviceStartDate) {
    return null;
  }

  if (requiresServiceEndDate(serviceStatus) && !serviceEndDate) {
    return null;
  }

  const input = {
    serviceStatus,
    contractType,
    contractStartDate,
  };

  if (requiresServiceStartDate(serviceStatus)) {
    input.serviceStartDate = serviceStartDate;
  }

  if (requiresServiceEndDate(serviceStatus)) {
    input.serviceEndDate = serviceEndDate;
  }

  if (showsCombatAssignment(contractType)) {
    input.combatAssignment = getSelectedCombatAssignment();
  }

  if (requiresCombatDaysField(contractType, getSelectedCombatAssignment())) {
    input.combatDays = parseIntegerInput("combat-days-input");
  } else {
    input.combatDays = 0;
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
    syncStatusFields();
  }
  if (e.target && e.target.name === "contractType") {
    clearCombatAssignmentSelection();
    resetCombatDaysInput();
    syncCombatFields();
  }
  if (e.target && e.target.name === "combatAssignment") {
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

bindStepper("combat-days-input", "combat-days-dec", "combat-days-inc", 0);
syncStatusFields();
syncCombatFields();
initDateFields();
renderWizardStep();

})();
