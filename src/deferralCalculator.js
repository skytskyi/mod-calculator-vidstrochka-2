import {
  addDays,
  addMonths,
  addYears,
  intervalToDuration,
  isAfter,
  isBefore,
  max as maxDate,
  min as minDate,
  differenceInYears,
} from "../vendor/dateFnsLite.esm.js";

/** @typedef {'NONE' | 'FIRST_LINE' | 'NOT_FIRST_LINE'} CombatAssignment */

/** @typedef {'ASSAULT' | 'COMBAT' | 'BASIC'} ContractType */

/** @typedef {'OBLIGATED' | 'ACTIVE' | 'DISCHARGED'} ServiceStatus */

export const ContractType = {
  ASSAULT: "ASSAULT",
  COMBAT: "COMBAT",
  BASIC: "BASIC",
};

export const ServiceStatus = {
  OBLIGATED: "OBLIGATED",
  ACTIVE: "ACTIVE",
  DISCHARGED: "DISCHARGED",
};

export const CombatAssignment = {
  NONE: "NONE",
  FIRST_LINE: "FIRST_LINE",
  NOT_FIRST_LINE: "NOT_FIRST_LINE",
};

export const WAR_START_DATE = new Date(2022, 1, 24);

const BASE_DEFERRAL_MONTHS = 6;
const DAYS_PER_THIRTY_DAY_MONTH = 30;

const CONTRACT_DURATION_MONTHS = {
  [ContractType.ASSAULT]: 14,
  [ContractType.COMBAT]: 24,
  [ContractType.BASIC]: 24,
};

const CONTRACT_TYPE_LABELS = {
  [ContractType.ASSAULT]: "піхотно-штурмового контракту",
  [ContractType.COMBAT]: "бойового контракту",
  [ContractType.BASIC]: "базового контракту",
};

/**
 * @param {ContractType} contractType
 * @returns {string}
 */
export function getGuaranteedDeferralLabel(contractType) {
  const typeName = CONTRACT_TYPE_LABELS[contractType] ?? contractType;
  return `Гарантована відстрочка за підписання ${typeName}`;
}

/**
 * @typedef {Object} CalculatorInput
 * @property {ContractType} contractType
 * @property {ServiceStatus} serviceStatus
 * @property {Date} [serviceStartDate]
 * @property {Date} [serviceEndDate]
 * @property {Date} contractStartDate
 * @property {CombatAssignment} [combatAssignment]
 * @property {number} [combatDays]
 */

/**
 * @typedef {Object} DurationParts
 * @property {number} years
 * @property {number} months
 * @property {number} days
 */

/**
 * @typedef {Object} ExplanationLine
 * @property {string} label
 * @property {string} detail
 * @property {string} contribution
 */

/**
 * @typedef {Object} CalculatorResult
 * @property {Date} contractEndDate
 * @property {DurationParts} deferralDuration
 * @property {Date} deferralEndDate
 * @property {number} yearsBefore2022
 * @property {number} yearsAfter2022
 * @property {ExplanationLine[]} explanation
 * @property {string} deferralDurationLabel
 */

/**
 * @param {Date} endDate
 * @param {Date} startDate
 * @returns {number}
 */
export function differenceInFullYears(endDate, startDate) {
  if (isBefore(endDate, startDate)) {
    return 0;
  }

  let years = differenceInYears(endDate, startDate);
  const anniversary = addYears(startDate, years);

  if (isAfter(anniversary, endDate)) {
    years -= 1;
  }

  return Math.max(0, years);
}

/**
 * @param {Date} serviceStartDate
 * @param {Date} [serviceEndDate]
 * @returns {number}
 */
export function calculateYearsBefore2022(serviceStartDate, serviceEndDate) {
  if (!isBefore(serviceStartDate, WAR_START_DATE)) {
    return 0;
  }

  const periodEnd = serviceEndDate
    ? minDate([serviceEndDate, WAR_START_DATE])
    : WAR_START_DATE;

  if (!isAfter(periodEnd, serviceStartDate)) {
    return 0;
  }

  return differenceInFullYears(periodEnd, serviceStartDate);
}

/**
 * @param {Date} serviceStartDate
 * @param {Date} contractStartDate
 * @param {Date} [serviceEndDate]
 * @returns {number}
 */
export function calculateYearsAfter2022(
  serviceStartDate,
  contractStartDate,
  serviceEndDate
) {
  const periodStart = maxDate([serviceStartDate, WAR_START_DATE]);
  const periodEnd = serviceEndDate
    ? minDate([serviceEndDate, contractStartDate])
    : contractStartDate;

  if (!isAfter(periodEnd, periodStart)) {
    return 0;
  }

  return differenceInFullYears(periodEnd, periodStart);
}

/**
 * @param {ContractType} contractType
 * @returns {number}
 */
export function calculateContractDuration(contractType) {
  return CONTRACT_DURATION_MONTHS[contractType];
}

/**
 * @param {Date} contractStartDate
 * @param {ContractType} contractType
 * @returns {Date}
 */
export function calculateContractEndDate(contractStartDate, contractType) {
  return addMonths(contractStartDate, calculateContractDuration(contractType));
}

/**
 * @param {CalculatorInput} input
 * @param {number} yearsBefore2022
 * @param {number} yearsAfter2022
 * @returns {{ deferralEndDate: Date, explanation: ExplanationLine[], deferralDurationLabel: string }}
 */
export function calculateDeferral(input, yearsBefore2022, yearsAfter2022) {
  const contractEndDate = calculateContractEndDate(
    input.contractStartDate,
    input.contractType
  );

  const explanation = [
    {
      label: getGuaranteedDeferralLabel(input.contractType),
      detail: "",
      contribution: "6 місяців",
    },
  ];

  let deferralEndDate;

  if (input.contractType === ContractType.ASSAULT) {
    const combatDays = input.combatDays ?? 0;
    const after2022Contribution = yearsAfter2022 * 6;
    const monthsPart =
      BASE_DEFERRAL_MONTHS + after2022Contribution + yearsBefore2022;

    if (yearsBefore2022 > 0) {
      explanation.push({
        label: "Повні роки служби до 24.02.2022",
        detail: formatYearsLabel(yearsBefore2022),
        contribution: `${yearsBefore2022} ${monthsWord(yearsBefore2022)}`,
      });
    }

    if (yearsAfter2022 > 0) {
      explanation.push({
        label: getYearsAfter2022Label(input.serviceStatus, input.serviceEndDate, input.contractStartDate),
        detail: formatYearsLabel(yearsAfter2022),
        contribution: `${after2022Contribution} ${monthsWord(after2022Contribution)}`,
      });
    }

  if (combatDays > 0) {
    explanation.push({
      label: getCombatExplanationLabel(input.contractType, input.combatAssignment),
      detail: formatDaysLabel(combatDays),
      contribution: formatThirtyDayMonthDuration(combatDays),
    });
  }

    deferralEndDate = addDays(addMonths(contractEndDate, monthsPart), combatDays);

    const duration = intervalToDuration({
      start: contractEndDate,
      end: deferralEndDate,
    });

    return {
      deferralEndDate,
      explanation,
      deferralDurationLabel: formatDurationParts({
        years: duration.years ?? 0,
        months: duration.months ?? 0,
        days: duration.days ?? 0,
      }),
    };
  }

  const combatDays = input.combatDays ?? 0;
  const monthsPart = BASE_DEFERRAL_MONTHS + yearsBefore2022;

  if (yearsBefore2022 > 0) {
    explanation.push({
      label: "Повні роки служби до 24.02.2022",
      detail: formatYearsLabel(yearsBefore2022),
      contribution: `${yearsBefore2022} ${monthsWord(yearsBefore2022)}`,
    });
  }

  if (combatDays > 0) {
    explanation.push({
      label: getCombatExplanationLabel(input.contractType, input.combatAssignment),
      detail: formatDaysLabel(combatDays),
      contribution: `${combatDays} ${daysWord(combatDays)}`,
    });
  }

  deferralEndDate = addDays(addMonths(contractEndDate, monthsPart), combatDays);

  const duration = intervalToDuration({
    start: contractEndDate,
    end: deferralEndDate,
  });

  return {
    deferralEndDate,
    explanation,
    deferralDurationLabel: formatDurationParts({
      years: duration.years ?? 0,
      months: duration.months ?? 0,
      days: duration.days ?? 0,
    }),
  };
}

/**
 * @param {Date} contractEndDate
 * @param {Date} deferralEndDate
 * @returns {DurationParts}
 */
export function calculateDeferralDuration(contractEndDate, deferralEndDate) {
  const duration = intervalToDuration({
    start: contractEndDate,
    end: deferralEndDate,
  });

  return {
    years: duration.years ?? 0,
    months: duration.months ?? 0,
    days: duration.days ?? 0,
  };
}

/**
 * @param {CalculatorInput} input
 * @returns {CalculatorResult}
 */
export function calculate(input) {
  validateInput(input);

  const serviceEndDate =
    input.serviceStatus === ServiceStatus.DISCHARGED
      ? input.serviceEndDate
      : undefined;

  const yearsBefore2022 =
    input.serviceStatus === ServiceStatus.OBLIGATED
      ? 0
      : calculateYearsBefore2022(input.serviceStartDate, serviceEndDate);
  const yearsAfter2022 =
    input.serviceStatus === ServiceStatus.OBLIGATED
      ? 0
      : calculateYearsAfter2022(
          input.serviceStartDate,
          input.contractStartDate,
          serviceEndDate
        );

  const contractEndDate = calculateContractEndDate(
    input.contractStartDate,
    input.contractType
  );

  const deferral = calculateDeferral(input, yearsBefore2022, yearsAfter2022);
  const deferralDuration = calculateDeferralDuration(
    contractEndDate,
    deferral.deferralEndDate
  );

  return {
    contractEndDate,
    deferralDuration,
    deferralEndDate: deferral.deferralEndDate,
    yearsBefore2022,
    yearsAfter2022,
    explanation: deferral.explanation,
    deferralDurationLabel: deferral.deferralDurationLabel,
  };
}

/**
 * @param {CalculatorInput} input
 */
function validateInput(input) {
  if (!input.serviceStatus || !Object.values(ServiceStatus).includes(input.serviceStatus)) {
    throw new Error("Оберіть статус");
  }

  if (!input.contractType || !CONTRACT_DURATION_MONTHS[input.contractType]) {
    throw new Error("Оберіть тип контракту");
  }

  if (input.serviceStatus !== ServiceStatus.OBLIGATED) {
    if (!(input.serviceStartDate instanceof Date) || Number.isNaN(input.serviceStartDate.getTime())) {
      throw new Error("Вкажіть дату початку військової служби");
    }
  }

  if (input.serviceStatus === ServiceStatus.DISCHARGED) {
    if (!(input.serviceEndDate instanceof Date) || Number.isNaN(input.serviceEndDate.getTime())) {
      throw new Error("Вкажіть дату звільнення з військової служби");
    }

    if (!isAfter(input.serviceEndDate, input.serviceStartDate)) {
      throw new Error(
        "Дата звільнення з військової служби має бути пізнішою за дату початку служби"
      );
    }

    if (!isBefore(input.serviceEndDate, input.contractStartDate)) {
      throw new Error(
        "Дата звільнення з військової служби має бути ранішою за планову або фактичну дату підписання нового контракту"
      );
    }
  }

  if (!(input.contractStartDate instanceof Date) || Number.isNaN(input.contractStartDate.getTime())) {
    throw new Error("Вкажіть дату підписання контракту");
  }

  if (
    input.serviceStatus !== ServiceStatus.OBLIGATED &&
    isAfter(input.serviceStartDate, input.contractStartDate)
  ) {
    throw new Error(
      "Дата початку військової служби не може бути пізнішою за планову або фактичну дату підписання нового контракту"
    );
  }

  const combatDays = input.combatDays ?? 0;
  if (!Number.isInteger(combatDays) || combatDays < 0) {
    throw new Error("Кількість днів бойових має бути цілим числом від 0");
  }
}

function formatYearsLabel(years) {
  return `${years} ${yearsWord(years)}`;
}

/**
 * @param {ServiceStatus} serviceStatus
 * @param {Date} [serviceEndDate]
 * @param {Date} contractStartDate
 * @returns {string}
 */
function getYearsAfter2022Label(serviceStatus, serviceEndDate, contractStartDate) {
  if (
    serviceStatus === ServiceStatus.DISCHARGED &&
    serviceEndDate &&
    isBefore(serviceEndDate, contractStartDate)
  ) {
    return "Повні роки служби з 24.02.2022 до дати звільнення";
  }

  return "Повні роки служби з 24.02.2022 до підписання контракту";
}

/**
 * @param {CombatAssignment} [combatAssignment]
 * @returns {string}
 */
export function getCombatAssignmentExplanationLabel(combatAssignment) {
  switch (combatAssignment) {
    case CombatAssignment.FIRST_LINE:
      return "Відстрочка за бойові завдання на першій лінії";
    case CombatAssignment.NOT_FIRST_LINE:
      return "Відстрочка за бойові завдання не на першій лінії";
    default:
      return "Бойові завдання";
  }
}

/**
 * @param {ContractType} contractType
 * @param {CombatAssignment} [combatAssignment]
 * @returns {string}
 */
export function getCombatExplanationLabel(contractType, combatAssignment) {
  if (contractType === ContractType.ASSAULT) {
    return "Відстрочка за бойові завдання";
  }

  if (contractType === ContractType.COMBAT || contractType === ContractType.BASIC) {
    return getCombatAssignmentExplanationLabel(combatAssignment);
  }

  return "Бойові завдання";
}

/**
 * @returns {string[]}
 */
export function getCombatExplanationLabels() {
  return [
    "Відстрочка за бойові завдання",
    getCombatAssignmentExplanationLabel(CombatAssignment.FIRST_LINE),
    getCombatAssignmentExplanationLabel(CombatAssignment.NOT_FIRST_LINE),
  ];
}

function formatDaysLabel(days) {
  return `${days} ${daysWord(days)}`;
}

/**
 * @param {number} totalDays
 * @returns {string}
 */
export function formatThirtyDayMonthDuration(totalDays) {
  const months = Math.floor(totalDays / DAYS_PER_THIRTY_DAY_MONTH);
  const days = totalDays % DAYS_PER_THIRTY_DAY_MONTH;
  return formatDurationParts({ years: 0, months, days });
}

/**
 * @param {DurationParts} parts
 * @returns {string}
 */
export function formatDurationParts(parts) {
  const chunks = [];

  if (parts.years > 0) {
    chunks.push(`${parts.years} ${yearsWord(parts.years)}`);
  }

  if (parts.months > 0) {
    chunks.push(`${parts.months} ${monthsWord(parts.months)}`);
  }

  if (parts.days > 0) {
    chunks.push(`${parts.days} ${daysWord(parts.days)}`);
  }

  return chunks.length ? chunks.join(" ") : "0 днів";
}

function yearsWord(value) {
  return pluralUk(value, "рік", "роки", "років");
}

function monthsWord(value) {
  return pluralUk(value, "місяць", "місяці", "місяців");
}

function daysWord(value) {
  return pluralUk(value, "день", "дні", "днів");
}

function pluralUk(value, one, few, many) {
  const mod10 = value % 10;
  const mod100 = value % 100;

  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}
