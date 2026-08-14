import { format } from "../vendor/dateFnsLite.esm.js";
import {
  CombatUnitType,
  ContractType,
  ServiceStatus,
  RESOLUTION_768_URL,
  RESOLUTION_768_CITE,
  WAR_START_DATE,
  calculate,
  resolveContractTermMonths,
  getCombatExplanationLabels,
} from "./deferralCalculator.js";

const section = document.querySelector(".form-block");
const summary = document.getElementById("calc-validation");
const listEl = document.getElementById("calc-validation-list");
const formActions = document.getElementById("form-actions-anchor");

const combatDaysField = document.getElementById("field-combat-days");
const combatAssignmentField = document.getElementById("field-combat-assignment");
const combatDaysInput = document.getElementById("combat-days-input");
const servicePeriodsField = document.getElementById("field-service-periods");
const servicePeriodsAfterList = document.getElementById(
  "service-periods-after-list"
);
const servicePeriodsBeforeList = document.getElementById(
  "service-periods-before-list"
);
const serviceBeforeToggle = document.getElementById("service-before-toggle");
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
  DISCHARGED: "Військовозобов'язаний з досвідом бойових дій",
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
      "Оберіть свій статус на момент укладення мотиваційного контракту.",
  },
  contract: {
    title: "Дані про новий контракт",
    help:
      "Оберіть тип контракту. Дату підписання можна не вказувати — тоді система порахує лише строк відстрочки.",
  },
  combat: {
    title: "Кількість днів участі в бойових діях",
    help:
      "Вкажіть загальну кількість днів безпосередньої участі у бойових діях лише за останній безперервний період проходження військової служби.",
  },
};

const EARLIEST_SERVICE_DATE_VALUE = "1950-01-01";

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

const PERIOD_KIND_BEFORE = "before";
const PERIOD_KIND_AFTER = "after";
const TITLE_BEFORE =
  "Останній безперервний період служби до 24.02.2022";
const TITLE_AFTER =
  "Останній безперервний період служби після 24.02.2022";
const WAR_START_ISO = "2022-02-24";
const DAY_BEFORE_WAR_ISO = "2022-02-23";

function getPeriodListForKind(kind) {
  return kind === PERIOD_KIND_BEFORE
    ? servicePeriodsBeforeList
    : servicePeriodsAfterList;
}

function getServicePeriodRows() {
  const rows = [];
  if (servicePeriodsAfterList) {
    rows.push.apply(
      rows,
      servicePeriodsAfterList.querySelectorAll(".service-period")
    );
  }
  if (servicePeriodsBeforeList) {
    rows.push.apply(
      rows,
      servicePeriodsBeforeList.querySelectorAll(".service-period")
    );
  }
  return rows;
}

function getServicePeriodRowByKind(kind) {
  const list = getPeriodListForKind(kind);
  if (!list) return null;
  return list.querySelector('.service-period[data-period-kind="' + kind + '"]');
}

/**
 * @param {string} kind
 * @returns {{ startDate: Date, endDate?: Date } | null}
 */
function readPeriodByKind(kind) {
  const row = getServicePeriodRowByKind(kind);
  if (!row) return null;
  const startInput = row.querySelector('[data-period-field="start"]');
  const endInput = row.querySelector('[data-period-field="end"]');
  const startDate = parseDateValue(startInput && startInput.value);
  if (!startDate) return null;
  /** @type {{ startDate: Date, endDate?: Date }} */
  const period = { startDate };
  // After-2022 period never has an end date in the UI.
  if (kind === PERIOD_KIND_BEFORE) {
    const endDate = parseDateValue(endInput && endInput.value);
    if (endDate) period.endDate = endDate;
  }
  return period;
}

function createDateField(inputId, fieldName, options) {
  const wrap = document.createElement("div");
  wrap.className = "date-field";

  const input = document.createElement("input");
  input.id = inputId;
  input.className = "date-input is-empty";
  input.type = "date";
  input.min = (options && options.min) || EARLIEST_SERVICE_DATE_VALUE;
  if (options && options.max) input.max = options.max;
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

/**
 * @param {'before' | 'after'} kind
 */
function createServicePeriodRow(kind) {
  const row = document.createElement("div");
  row.className = "service-period";
  row.dataset.periodKind = kind;
  row.id = "service-period-" + kind;

  const head = document.createElement("div");
  head.className = "service-period__head";

  const title = document.createElement("p");
  title.className = "service-period__title";
  title.textContent =
    kind === PERIOD_KIND_BEFORE ? TITLE_BEFORE : TITLE_AFTER;
  head.appendChild(title);

  const startId = "service-period-" + kind + "-start";
  const dateOpts =
    kind === PERIOD_KIND_BEFORE
      ? { min: EARLIEST_SERVICE_DATE_VALUE, max: DAY_BEFORE_WAR_ISO }
      : { min: WAR_START_ISO };

  const startField = document.createElement("div");
  startField.className = "field field--date";
  const startLabel = document.createElement("label");
  startLabel.className = "field__legend";
  startLabel.htmlFor = startId;
  startLabel.textContent = "Дата початку військової служби";
  startField.appendChild(startLabel);
  startField.appendChild(createDateField(startId, "start", dateOpts));

  const fields = document.createElement("div");
  fields.className =
    kind === PERIOD_KIND_AFTER
      ? "service-period__fields service-period__fields--single"
      : "service-period__fields";
  fields.appendChild(startField);

  // After-2022 period for active service has no discharge date:
  // end is always the new contract date (or today) in the formula.
  if (kind === PERIOD_KIND_BEFORE) {
    const endId = "service-period-" + kind + "-end";
    const endField = document.createElement("div");
    endField.className = "field field--date service-period__end";
    const endLabel = document.createElement("label");
    endLabel.className = "field__legend";
    endLabel.htmlFor = endId;
    endLabel.textContent = "Дата звільнення з військової служби";
    endField.appendChild(endLabel);
    endField.appendChild(createDateField(endId, "end", dateOpts));
    fields.appendChild(endField);
  }

  row.appendChild(head);
  row.appendChild(fields);
  return row;
}

function isBeforePeriodEnabled() {
  return !!(serviceBeforeToggle && serviceBeforeToggle.checked);
}

function setBeforePeriodEnabled(enabled) {
  if (!serviceBeforeToggle) return;
  serviceBeforeToggle.checked = !!enabled;
}

function readPeriodRowValues(row) {
  if (!row) return null;
  const startInput = row.querySelector('[data-period-field="start"]');
  const endInput = row.querySelector('[data-period-field="end"]');
  return {
    start: (startInput && startInput.value) || "",
    end: (endInput && endInput.value) || "",
  };
}

/** @type {{ start: string, end: string } | null} */
let preservedBeforePeriodValues = null;

function captureBeforePeriodValues() {
  const values = readPeriodRowValues(getServicePeriodRowByKind(PERIOD_KIND_BEFORE));
  if (values && (values.start || values.end)) {
    preservedBeforePeriodValues = values;
  }
}

function ensureBeforePeriodRow() {
  if (!servicePeriodsBeforeList) return;
  let beforeRow = getServicePeriodRowByKind(PERIOD_KIND_BEFORE);
  if (!beforeRow) {
    beforeRow = createServicePeriodRow(PERIOD_KIND_BEFORE);
    servicePeriodsBeforeList.appendChild(beforeRow);
    fillPeriodInputs(beforeRow, preservedBeforePeriodValues);
  }
}

function removeBeforePeriodRow() {
  const row = getServicePeriodRowByKind(PERIOD_KIND_BEFORE);
  if (!row) return;
  captureBeforePeriodValues();
  row.remove();
}

function ensureAfterPeriodRow() {
  if (!servicePeriodsAfterList) return;
  if (getServicePeriodRowByKind(PERIOD_KIND_AFTER)) return;
  servicePeriodsAfterList.appendChild(createServicePeriodRow(PERIOD_KIND_AFTER));
}

function removeAfterPeriodRow() {
  const row = getServicePeriodRowByKind(PERIOD_KIND_AFTER);
  if (row) row.remove();
}

function clearServicePeriods() {
  captureBeforePeriodValues();
  if (servicePeriodsAfterList) servicePeriodsAfterList.replaceChildren();
  if (servicePeriodsBeforeList) servicePeriodsBeforeList.replaceChildren();
}

function fillPeriodInputs(row, values) {
  if (!row || !values) return;
  const startInput = row.querySelector('[data-period-field="start"]');
  const endInput = row.querySelector('[data-period-field="end"]');
  if (startInput && values.start) {
    startInput.value = values.start;
    syncDateFieldState(startInput);
  }
  if (endInput && values.end) {
    endInput.value = values.end;
    syncDateFieldState(endInput);
  }
}

function syncBeforePeriodFromToggle() {
  if (isBeforePeriodEnabled()) {
    ensureBeforePeriodRow();
  } else {
    removeBeforePeriodRow();
  }
}

function ensureServicePeriods() {
  const status = getSelectedServiceStatus();

  if (status !== ServiceStatus.ACTIVE && status !== ServiceStatus.DISCHARGED) {
    setBeforePeriodEnabled(false);
    clearServicePeriods();
    return;
  }

  if (status === ServiceStatus.DISCHARGED) {
    removeAfterPeriodRow();
    syncBeforePeriodFromToggle();
    return;
  }

  // ACTIVE: after first, then toggle-controlled before.
  ensureAfterPeriodRow();
  syncBeforePeriodFromToggle();
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

/** @returns {number | null} */
function getResolvedTermMonths() {
  const status = getSelectedServiceStatus();
  const type = getSelectedContractType();
  if (!status || !type) return null;
  try {
    return resolveContractTermMonths(
      status,
      type,
      getSelectedContractTermChoice()
    );
  } catch (_error) {
    return null;
  }
}

function showsCombatUnitChoice() {
  return false;
}

/** @returns {string | null} */
function getEffectiveCombatUnitType() {
  return null;
}

function clearCombatUnitSelection() {
  document.querySelectorAll('input[name="combatUnitType"]').forEach(function (input) {
    input.checked = false;
  });
}

function getCombatStepMeta() {
  return {
    title: STEP_META.combat.title,
    help: STEP_META.combat.help,
  };
}

function getSelectedContractTermChoice() {
  const selected = document.querySelector('input[name="contractTermChoice"]:checked');
  if (!selected) return null;
  const value = Number.parseInt(selected.value, 10);
  return value === 6 || value === 24 ? value : null;
}

function requiresContractTermChoice(_status, _type) {
  // 6 months is only available for ASSAULT + DISCHARGED (fixed, no choice).
  // COMBAT/BASIC are always 24 months for all statuses.
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
  if (combatAssignmentField) {
    combatAssignmentField.hidden = true;
  }
  clearCombatUnitSelection();

  if (combatDaysField) {
    combatDaysField.hidden = false;
  }
}

function getCurrentStepId() {
  return WIZARD_STEPS[currentStepIndex];
}

function areServicePeriodsFilled(status) {
  if (status === ServiceStatus.ACTIVE) {
    const after = readPeriodByKind(PERIOD_KIND_AFTER);
    if (!after || !after.startDate) return false;

    if (isBeforePeriodEnabled()) {
      const before = readPeriodByKind(PERIOD_KIND_BEFORE);
      if (!before || !before.startDate || !before.endDate) return false;
    }
    return true;
  }

  if (status === ServiceStatus.DISCHARGED) {
    if (!isBeforePeriodEnabled()) return true;
    const before = readPeriodByKind(PERIOD_KIND_BEFORE);
    return !!(before && before.startDate && before.endDate);
  }

  return true;
}

function collectServicePeriodOrderError() {
  const status = getSelectedServiceStatus();
  if (!requiresServicePeriods(status)) return null;

  const rows = getServicePeriodRows();
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    const kind = row.dataset.periodKind;
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

    if (kind === PERIOD_KIND_BEFORE && endDate) {
      if (endDate.getTime() >= WAR_START_DATE.getTime()) {
        return {
          id: row.id || "field-service-periods",
          label:
            "Період служби до 24.02.2022 має завершитися до 24.02.2022",
          focusSelector: "#" + (endInput && endInput.id),
          kind: "date-order",
        };
      }
    }

    if (kind === PERIOD_KIND_AFTER) {
      if (startDate.getTime() < WAR_START_DATE.getTime()) {
        return {
          id: row.id || "field-service-periods",
          label:
            "Дата початку служби після 24.02.2022 не може бути раніше 24.02.2022",
          focusSelector: "#" + (startInput && startInput.id),
          kind: "date-order",
        };
      }
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
      if (!type) return false;
      if (requiresContractTermChoice(status, type) && !termChoice) {
        return false;
      }
      return true;
    case "combat": {
      if (showsCombatUnitChoice() && !combatUnitType) {
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

  if (
    showsCombatUnitChoice() &&
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

  if (!requiresServicePeriods(serviceStatus)) {
    return [];
  }

  const periodError = collectServicePeriodOrderError();
  if (periodError) {
    return [periodError];
  }

  if (!contractStartDate) {
    return [];
  }

  const periodsToCheck = [];
  const before = readPeriodByKind(PERIOD_KIND_BEFORE);
  const after = readPeriodByKind(PERIOD_KIND_AFTER);
  if (before) {
    periodsToCheck.push({
      period: before,
      row: getServicePeriodRowByKind(PERIOD_KIND_BEFORE),
    });
  }
  if (after) {
    periodsToCheck.push({
      period: after,
      row: getServicePeriodRowByKind(PERIOD_KIND_AFTER),
    });
  }

  for (let i = 0; i < periodsToCheck.length; i += 1) {
    const item = periodsToCheck[i];
    const period = item.period;
    const row = item.row;
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

  setBeforePeriodEnabled(false);
  if (servicePeriodsAfterList) servicePeriodsAfterList.replaceChildren();
  if (servicePeriodsBeforeList) servicePeriodsBeforeList.replaceChildren();
  preservedBeforePeriodValues = null;
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
  const beforePeriod = readPeriodByKind(PERIOD_KIND_BEFORE);
  const afterPeriod = readPeriodByKind(PERIOD_KIND_AFTER);
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

  if (beforePeriod) {
    rows.push({
      label: TITLE_BEFORE,
      value:
        formatDisplayDate(beforePeriod.startDate) +
        " – " +
        formatDisplayDate(beforePeriod.endDate),
    });
  }

  if (afterPeriod) {
    rows.push({
      label: TITLE_AFTER,
      value: "з " + formatDisplayDate(afterPeriod.startDate),
    });
  }

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
    if (result.hasCalendarDates && result.contractEndDate) {
      rows.push({
        label: "Контракт завершується",
        value: formatDisplayDate(result.contractEndDate),
      });
    }
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
  label.textContent = "Загальна відстрочка:";

  const value = document.createElement("p");
  value.className = "results-total__value";
  value.textContent = result.deferralDurationLabel;

  totalRow.appendChild(label);
  totalRow.appendChild(value);
  wizardResultsTotal.appendChild(totalRow);

  if (
    !(
      result.hasCalendarDates &&
      result.contractEndDate &&
      result.deferralEndDate
    )
  ) {
    return;
  }

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
    if (line.label === "Загальна відстрочка" || line.label === "Загалом відстрочки") {
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
      main.textContent = line.label + " — " + line.detail;
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
  const beforePeriod = readPeriodByKind(PERIOD_KIND_BEFORE);
  const afterPeriod = readPeriodByKind(PERIOD_KIND_AFTER);
  const contractStartDate = parseDateInput("contract-start-date");
  const combatUnitType = getEffectiveCombatUnitType();
  const termChoice = getSelectedContractTermChoice();

  if (!serviceStatus || !contractType) {
    return null;
  }

  if (requiresServicePeriods(serviceStatus) && !areServicePeriodsFilled(serviceStatus)) {
    return null;
  }

  if (requiresContractTermChoice(serviceStatus, contractType) && !termChoice) {
    return null;
  }

  if (showsCombatUnitChoice() && !combatUnitType) {
    return null;
  }

  const input = {
    serviceStatus,
    contractType,
    combatDays: parseIntegerInput("combat-days-input"),
  };

  if (contractStartDate) {
    input.contractStartDate = contractStartDate;
  }

  if (combatUnitType) {
    input.combatUnitType = combatUnitType;
  }

  if (beforePeriod && beforePeriod.endDate) {
    input.servicePeriodBefore2022 = beforePeriod;
  }

  if (afterPeriod) {
    input.servicePeriodAfter2022 = afterPeriod;
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
    syncCombatFields();
    if (getCurrentStepId() === "combat") {
      renderWizardStep();
      return;
    }
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

if (serviceBeforeToggle) {
  serviceBeforeToggle.addEventListener("change", function () {
    syncBeforePeriodFromToggle();
    onWizardInputChange();
  });
}

bindStepper("combat-days-input", "combat-days-dec", "combat-days-inc", 0, MAX_COMBAT_DAYS);
syncStatusFields();
syncCombatFields();
initDateFields();
renderWizardStep();
