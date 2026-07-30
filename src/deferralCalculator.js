import {
  addMonths,
  intervalToDuration,
  isAfter,
  isBefore,
  max as maxDate,
  min as minDate,
  differenceInMonths,
} from "../vendor/dateFnsLite.esm.js";

/** @typedef {'COMBAT_UNIT' | 'NON_COMBAT_UNIT'} CombatUnitType */

/** @typedef {'ASSAULT' | 'COMBAT' | 'BASIC'} ContractType */

/** @typedef {'OBLIGATED' | 'ACTIVE' | 'DISCHARGED'} ServiceStatus */

/** @typedef {6 | 10 | 14 | 24} ContractTermMonths */

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

/** @deprecated Use CombatUnitType */
export const CombatAssignment = {
  COMBAT_UNIT: "COMBAT_UNIT",
  NON_COMBAT_UNIT: "NON_COMBAT_UNIT",
  /** @deprecated legacy aliases */
  FIRST_LINE: "COMBAT_UNIT",
  NOT_FIRST_LINE: "NON_COMBAT_UNIT",
  NONE: "NON_COMBAT_UNIT",
};

export const CombatUnitType = {
  COMBAT_UNIT: "COMBAT_UNIT",
  NON_COMBAT_UNIT: "NON_COMBAT_UNIT",
};

export const WAR_START_DATE = new Date(2022, 1, 24);

/** Посилання на постанову КМУ №768 */
export const RESOLUTION_768_URL =
  "https://zakon.rada.gov.ua/laws/show/768-2026-%D0%BF#Text";

export const RESOLUTION_768_CITE = "постанови №768";

/**
 * @param {string} paragraphRef наприклад "абз. 2 п. 22"
 * @returns {string}
 */
export function formatResolutionCite(paragraphRef) {
  return `${paragraphRef} ${RESOLUTION_768_CITE}`;
}

const BASE_DEFERRAL_MONTHS = 6;
const MAX_MONTHS_BEFORE_2022 = 480;

/** Максимальна кількість періодів служби в UI */
export const MAX_SERVICE_PERIODS = 5;

/**
 * @typedef {Object} ServicePeriod
 * @property {Date} startDate
 * @property {Date} [endDate] Absent/null = ongoing (active service)
 */

/**
 * @typedef {Object} CalculatorInput
 * @property {ContractType} contractType
 * @property {ServiceStatus} serviceStatus
 * @property {ServicePeriod[]} [servicePeriods]
 * @property {Date} [serviceStartDate] Legacy single-period start
 * @property {Date} [serviceEndDate] Legacy single-period end
 * @property {Date} contractStartDate
 * @property {6 | 24} [contractTermChoice] Required for DISCHARGED + COMBAT/BASIC
 * @property {CombatUnitType | string} [combatUnitType]
 * @property {CombatUnitType | string} [combatAssignment] Legacy alias for combatUnitType
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
 * @property {string} [cite]
 * @property {string} contribution
 */

/**
 * @typedef {Object} CalculatorResult
 * @property {Date | null} contractEndDate
 * @property {DurationParts | null} deferralDuration
 * @property {Date | null} deferralEndDate
 * @property {number} contractTermMonths
 * @property {number} monthsBefore2022
 * @property {number} monthsAfter2022
 * @property {number} yearsBefore2022
 * @property {number} yearsAfter2022
 * @property {ExplanationLine[]} explanation
 * @property {string} deferralDurationLabel
 * @property {number} totalDeferralMonths
 * @property {boolean} hasCalendarDates
 */

/**
 * @param {ServiceStatus} serviceStatus
 * @param {ContractType} contractType
 * @param {6 | 24} [termChoice]
 * @returns {ContractTermMonths}
 */
export function resolveContractTermMonths(serviceStatus, contractType, termChoice) {
  if (contractType === ContractType.ASSAULT) {
    if (serviceStatus === ServiceStatus.OBLIGATED) return 14;
    if (serviceStatus === ServiceStatus.ACTIVE) return 10;
    return 6;
  }

  if (serviceStatus === ServiceStatus.DISCHARGED) {
    if (termChoice !== 6 && termChoice !== 24) {
      throw new Error("Оберіть термін контракту: від 6 або 24 місяці");
    }
    return termChoice;
  }

  return 24;
}

/**
 * @param {ContractTermMonths} termMonths
 * @param {CombatUnitType | string} [combatUnitType]
 * @returns {10 | 30}
 */
export function resolveCombatDivisor(termMonths, combatUnitType) {
  if (termMonths === 6) {
    return combatUnitType === CombatUnitType.NON_COMBAT_UNIT ||
      combatUnitType === "NOT_FIRST_LINE"
      ? 30
      : 10;
  }

  if (termMonths === 10 || termMonths === 14) {
    return 10;
  }

  return 30;
}

/**
 * @param {ContractTermMonths} termMonths
 * @returns {{ usesAfter2022: boolean, usesBefore2022: boolean }}
 */
export function getServiceFieldFlags(termMonths) {
  return {
    usesAfter2022: termMonths === 10,
    usesBefore2022: termMonths === 10 || termMonths === 24,
  };
}

/**
 * @param {number} combatDays
 * @param {number} divisor
 * @returns {number}
 */
export function calculateCombatMonths(combatDays, divisor) {
  if (!Number.isInteger(combatDays) || combatDays <= 0) {
    return 0;
  }

  return Math.ceil(combatDays / divisor);
}

/**
 * @param {number} months
 * @returns {number}
 */
export function calculateBefore2022Contribution(months) {
  const capped = Math.min(Math.max(0, months), MAX_MONTHS_BEFORE_2022);
  return Math.floor(capped / 12) + 1;
}

/**
 * @param {number} months
 * @returns {number}
 */
export function calculateAfter2022Contribution(months) {
  const safe = Math.max(0, months);
  return (Math.floor(safe / 12) + 1) * 6;
}

/**
 * @param {Date} endDate
 * @param {Date} startDate
 * @returns {number}
 */
export function differenceInFullMonths(endDate, startDate) {
  if (isBefore(endDate, startDate)) {
    return 0;
  }

  return Math.max(0, differenceInMonths(endDate, startDate));
}

/**
 * @param {Date} serviceStartDate
 * @param {Date} [serviceEndDate]
 * @returns {number}
 */
export function calculateMonthsBefore2022(serviceStartDate, serviceEndDate) {
  if (!isBefore(serviceStartDate, WAR_START_DATE)) {
    return 0;
  }

  const periodEnd = serviceEndDate
    ? minDate([serviceEndDate, WAR_START_DATE])
    : WAR_START_DATE;

  if (!isAfter(periodEnd, serviceStartDate)) {
    return 0;
  }

  return Math.min(
    differenceInFullMonths(periodEnd, serviceStartDate),
    MAX_MONTHS_BEFORE_2022
  );
}

/**
 * @param {Date} serviceStartDate
 * @param {Date} contractStartDate
 * @param {Date} [serviceEndDate]
 * @returns {number}
 */
export function calculateMonthsAfter2022(
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

  return differenceInFullMonths(periodEnd, periodStart);
}

/**
 * @param {CalculatorInput | { servicePeriods?: ServicePeriod[], serviceStartDate?: Date, serviceEndDate?: Date }} input
 * @returns {ServicePeriod[]}
 */
export function normalizeServicePeriods(input) {
  if (Array.isArray(input.servicePeriods) && input.servicePeriods.length > 0) {
    return input.servicePeriods
      .filter(function (period) {
        return (
          period &&
          period.startDate instanceof Date &&
          !Number.isNaN(period.startDate.getTime())
        );
      })
      .map(function (period) {
        const endDate =
          period.endDate instanceof Date && !Number.isNaN(period.endDate.getTime())
            ? period.endDate
            : undefined;
        return { startDate: period.startDate, endDate };
      });
  }

  if (
    input.serviceStartDate instanceof Date &&
    !Number.isNaN(input.serviceStartDate.getTime())
  ) {
    const endDate =
      input.serviceEndDate instanceof Date &&
      !Number.isNaN(input.serviceEndDate.getTime())
        ? input.serviceEndDate
        : undefined;
    return [{ startDate: input.serviceStartDate, endDate }];
  }

  return [];
}

/**
 * @param {ServicePeriod[]} periods
 * @returns {number}
 */
export function sumMonthsBefore2022(periods) {
  let total = 0;
  periods.forEach(function (period) {
    total += calculateMonthsBefore2022(period.startDate, period.endDate);
  });
  return Math.min(total, MAX_MONTHS_BEFORE_2022);
}

/**
 * @param {ServicePeriod[]} periods
 * @param {Date} contractStartDate
 * @returns {number}
 */
export function sumMonthsAfter2022(periods, contractStartDate) {
  let total = 0;
  periods.forEach(function (period) {
    total += calculateMonthsAfter2022(
      period.startDate,
      contractStartDate,
      period.endDate
    );
  });
  return total;
}

/**
 * @param {ServicePeriod[]} periods
 * @returns {ServicePeriod[]}
 */
function sortServicePeriods(periods) {
  return periods.slice().sort(function (a, b) {
    return a.startDate.getTime() - b.startDate.getTime();
  });
}

/**
 * @param {ServicePeriod[]} periods
 * @returns {boolean}
 */
export function servicePeriodsOverlap(periods) {
  const sorted = sortServicePeriods(periods);
  for (let i = 1; i < sorted.length; i += 1) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    if (!prev.endDate) {
      return true;
    }
    if (curr.startDate.getTime() < prev.endDate.getTime()) {
      return true;
    }
  }
  return false;
}

/** @deprecated Prefer calculateMonthsBefore2022 */
export function calculateYearsBefore2022(serviceStartDate, serviceEndDate) {
  return Math.floor(calculateMonthsBefore2022(serviceStartDate, serviceEndDate) / 12);
}

/** @deprecated Prefer calculateMonthsAfter2022 */
export function calculateYearsAfter2022(
  serviceStartDate,
  contractStartDate,
  serviceEndDate
) {
  return Math.floor(
    calculateMonthsAfter2022(serviceStartDate, contractStartDate, serviceEndDate) / 12
  );
}

/**
 * @param {ServiceStatus} serviceStatus
 * @param {ContractType} contractType
 * @param {6 | 24} [termChoice]
 * @returns {number}
 */
export function calculateContractDuration(serviceStatus, contractType, termChoice) {
  return resolveContractTermMonths(serviceStatus, contractType, termChoice);
}

/**
 * @param {Date} contractStartDate
 * @param {number} termMonths
 * @returns {Date}
 */
export function calculateContractEndDate(contractStartDate, termMonths) {
  return addMonths(contractStartDate, termMonths);
}

/**
 * @param {CalculatorInput} input
 * @returns {CalculatorResult}
 */
export function calculate(input) {
  validateInput(input);

  const termMonths = resolveContractTermMonths(
    input.serviceStatus,
    input.contractType,
    input.contractTermChoice
  );
  const combatUnitType = resolveCombatUnitTypeForTerm(
    termMonths,
    input.combatUnitType ?? input.combatAssignment
  );
  const { usesAfter2022, usesBefore2022 } = getServiceFieldFlags(termMonths);
  const combatDays = input.combatDays ?? 0;
  const divisor = resolveCombatDivisor(termMonths, combatUnitType);
  const combatMonths = calculateCombatMonths(combatDays, divisor);

  const periods = normalizeServicePeriods(input);
  const hasServicePeriods = periods.length > 0;
  const hasContractStart =
    input.contractStartDate instanceof Date &&
    !Number.isNaN(input.contractStartDate.getTime());
  const serviceAnchorDate = hasContractStart
    ? input.contractStartDate
    : new Date();

  let monthsBefore2022 = 0;
  let monthsAfter2022 = 0;
  let before2022Contribution = 0;
  let after2022Contribution = 0;

  if (usesBefore2022 && hasServicePeriods) {
    monthsBefore2022 = sumMonthsBefore2022(periods);
    before2022Contribution = calculateBefore2022Contribution(monthsBefore2022);
  }

  if (usesAfter2022 && hasServicePeriods) {
    monthsAfter2022 = sumMonthsAfter2022(periods, serviceAnchorDate);
    after2022Contribution = calculateAfter2022Contribution(monthsAfter2022);
  }

  const totalDeferralMonths =
    BASE_DEFERRAL_MONTHS +
    combatMonths +
    after2022Contribution +
    before2022Contribution;

  /** @type {Date | null} */
  let contractEndDate = null;
  /** @type {Date | null} */
  let deferralEndDate = null;
  /** @type {DurationParts | null} */
  let deferralDuration = null;

  if (hasContractStart) {
    contractEndDate = calculateContractEndDate(
      input.contractStartDate,
      termMonths
    );
    deferralEndDate = addMonths(contractEndDate, totalDeferralMonths);
    deferralDuration = calculateDeferralDuration(
      contractEndDate,
      deferralEndDate
    );
  }

  const explanation = buildExplanation({
    combatDays,
    combatMonths,
    divisor,
    monthsBefore2022,
    monthsAfter2022,
    before2022Contribution,
    after2022Contribution,
    usesBefore2022: usesBefore2022 && hasServicePeriods,
    usesAfter2022: usesAfter2022 && hasServicePeriods,
    totalDeferralMonths,
  });

  return {
    contractEndDate,
    deferralDuration,
    deferralEndDate,
    contractTermMonths: termMonths,
    monthsBefore2022,
    monthsAfter2022,
    yearsBefore2022: Math.floor(monthsBefore2022 / 12),
    yearsAfter2022: Math.floor(monthsAfter2022 / 12),
    explanation,
    deferralDurationLabel: formatMonthsLabel(totalDeferralMonths),
    totalDeferralMonths,
    hasCalendarDates: hasContractStart,
  };
}

/**
 * @param {ContractTermMonths} termMonths
 * @param {CombatUnitType | string} [rawUnitType]
 * @returns {CombatUnitType}
 */
function resolveCombatUnitTypeForTerm(termMonths, rawUnitType) {
  if (termMonths === 6) {
    return normalizeCombatUnitType(rawUnitType);
  }

  if (
    rawUnitType === CombatUnitType.COMBAT_UNIT ||
    rawUnitType === CombatUnitType.NON_COMBAT_UNIT ||
    rawUnitType === "FIRST_LINE" ||
    rawUnitType === "NOT_FIRST_LINE" ||
    rawUnitType === "COMBAT_UNIT" ||
    rawUnitType === "NON_COMBAT_UNIT" ||
    rawUnitType === "NONE"
  ) {
    try {
      return normalizeCombatUnitType(rawUnitType);
    } catch (_error) {
      // Fall through to term default.
    }
  }

  // Matrix: unit type is N/A; divisor is fixed by term (10 for 10/14, 30 for 24).
  return termMonths === 24
    ? CombatUnitType.NON_COMBAT_UNIT
    : CombatUnitType.COMBAT_UNIT;
}

/**
 * @param {CalculatorInput} input
 * @param {number} _yearsBefore2022
 * @param {number} _yearsAfter2022
 * @returns {{ deferralEndDate: Date, explanation: ExplanationLine[], deferralDurationLabel: string }}
 */
export function calculateDeferral(input, _yearsBefore2022, _yearsAfter2022) {
  const result = calculate(input);
  return {
    deferralEndDate: result.deferralEndDate,
    explanation: result.explanation,
    deferralDurationLabel: result.deferralDurationLabel,
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
 */
function validateInput(input) {
  if (!input.serviceStatus || !Object.values(ServiceStatus).includes(input.serviceStatus)) {
    throw new Error("Оберіть статус");
  }

  if (
    !input.contractType ||
    !Object.values(ContractType).includes(input.contractType)
  ) {
    throw new Error("Оберіть тип контракту");
  }

  const hasContractStart =
    input.contractStartDate instanceof Date &&
    !Number.isNaN(input.contractStartDate.getTime());

  const termMonths = resolveContractTermMonths(
    input.serviceStatus,
    input.contractType,
    input.contractTermChoice
  );

  const periods = normalizeServicePeriods(input);
  const requiresService =
    input.serviceStatus === ServiceStatus.ACTIVE ||
    input.serviceStatus === ServiceStatus.DISCHARGED;

  if (requiresService) {
    if (periods.length === 0) {
      throw new Error("Вкажіть дату початку військової служби");
    }

    if (periods.length > MAX_SERVICE_PERIODS) {
      throw new Error(
        "Можна вказати не більше " + MAX_SERVICE_PERIODS + " періодів служби"
      );
    }

    periods.forEach(function (period, index) {
      const isLast = index === periods.length - 1;
      const needsEnd =
        input.serviceStatus === ServiceStatus.DISCHARGED || !isLast;

      if (needsEnd && !(period.endDate instanceof Date)) {
        throw new Error("Вкажіть дату закінчення періоду служби");
      }

      if (period.endDate && !isAfter(period.endDate, period.startDate)) {
        throw new Error(
          "Дата закінчення періоду служби має бути пізнішою за дату початку"
        );
      }

      if (hasContractStart && isAfter(period.startDate, input.contractStartDate)) {
        throw new Error(
          "Дата початку військової служби не може бути пізнішою за планову або фактичну дату підписання нового контракту"
        );
      }

      if (
        hasContractStart &&
        period.endDate &&
        !isBefore(period.endDate, input.contractStartDate)
      ) {
        throw new Error(
          "Дата закінчення періоду служби має бути ранішою за планову або фактичну дату підписання нового контракту"
        );
      }
    });

    if (input.serviceStatus === ServiceStatus.ACTIVE) {
      const openIndex = periods.findIndex(function (period) {
        return !period.endDate;
      });
      if (openIndex !== -1 && openIndex !== periods.length - 1) {
        throw new Error(
          "Період без дати закінчення має бути останнім у списку"
        );
      }
    }

    if (servicePeriodsOverlap(periods)) {
      throw new Error("Періоди служби не повинні перетинатися");
    }
  } else if (periods.length > 0 && hasContractStart) {
    periods.forEach(function (period) {
      if (isAfter(period.startDate, input.contractStartDate)) {
        throw new Error(
          "Дата початку військової служби не може бути пізнішою за планову або фактичну дату підписання нового контракту"
        );
      }
    });
  }

  const combatDays = input.combatDays ?? 0;
  if (!Number.isInteger(combatDays) || combatDays < 0) {
    throw new Error("Кількість днів бойових має бути цілим числом від 0");
  }

  if (combatDays > 480) {
    throw new Error(
      "Кількість днів участі в бойових діях не може перевищувати 480"
    );
  }

  if (termMonths === 6) {
    normalizeCombatUnitType(input.combatUnitType ?? input.combatAssignment);
  }
}

/**
 * @param {string} [value]
 * @returns {CombatUnitType}
 */
function normalizeCombatUnitType(value) {
  if (
    value === CombatUnitType.COMBAT_UNIT ||
    value === "FIRST_LINE" ||
    value === "COMBAT_UNIT"
  ) {
    return CombatUnitType.COMBAT_UNIT;
  }

  if (
    value === CombatUnitType.NON_COMBAT_UNIT ||
    value === "NOT_FIRST_LINE" ||
    value === "NON_COMBAT_UNIT" ||
    value === "NONE"
  ) {
    return CombatUnitType.NON_COMBAT_UNIT;
  }

  throw new Error("Оберіть тип участі в бойових діях");
}

function buildExplanation({
  combatDays,
  combatMonths,
  divisor,
  monthsBefore2022,
  monthsAfter2022,
  before2022Contribution,
  after2022Contribution,
  usesBefore2022,
  usesAfter2022,
  totalDeferralMonths,
}) {
  /** @type {ExplanationLine[]} */
  const explanation = [
    {
      label: "Гарантована відстрочка",
      detail: "",
      cite: "абз. 2 п. 22",
      contribution: formatSignedMonths(BASE_DEFERRAL_MONTHS),
    },
  ];

  if (combatMonths > 0) {
    explanation.push({
      label: getCombatExplanationLabel(undefined, divisor),
      detail: "",
      cite: divisor === 10 ? "абз. 3 п. 22" : "абз. 6 п. 22",
      contribution:
        formatSignedMonths(combatMonths) + " — " + formatDaysLabel(combatDays),
    });
  }

  if (usesAfter2022) {
    explanation.push({
      label: "Служба після 24.02.2022",
      detail: "",
      cite: "абз. 4 п. 22",
      contribution:
        formatSignedMonths(after2022Contribution) +
        " — " +
        formatMonthsLabel(monthsAfter2022),
    });
  }

  if (usesBefore2022) {
    explanation.push({
      label: "Служба до 24.02.2022",
      detail: "",
      cite: "абз. 5 п. 22",
      contribution:
        formatSignedMonths(before2022Contribution) +
        " — " +
        formatMonthsLabel(monthsBefore2022),
    });
  }

  explanation.push({
    label: "Загальна відстрочка",
    detail: "",
    contribution: formatMonthsLabel(totalDeferralMonths),
  });

  return explanation;
}

/**
 * @param {ContractType} [_contractType]
 * @returns {string}
 */
export function getGuaranteedDeferralLabel(_contractType) {
  return "Гарантована відстрочка";
}

/**
 * Label follows the matrix divisor rule (10 vs 30 days).
 *
 * @param {CombatUnitType | string} [_combatUnitType]
 * @param {number} [divisor]
 * @returns {string}
 */
export function getCombatExplanationLabel(_combatUnitType, divisor) {
  if (divisor === 30) {
    return "За участь у бойових діях (небойові частини)";
  }

  if (divisor === 10) {
    return "За участь у бойових діях (бойові частини)";
  }

  return "За участь у бойових діях";
}

/**
 * @param {CombatUnitType | string} [combatAssignment]
 * @returns {string}
 */
export function getCombatAssignmentExplanationLabel(combatAssignment) {
  return getCombatExplanationLabel(combatAssignment);
}

/**
 * @returns {string[]}
 */
export function getCombatExplanationLabels() {
  return [
    "За участь у бойових діях",
    "За участь у бойових діях (бойові частини)",
    "За участь у бойових діях (небойові частини)",
    "Відстрочка за участь у бойових діях",
    "Відстрочка за участь у бойових діях (у бойових частинах)",
    "Відстрочка за участь у бойових діях (не у бойових частинах)",
  ];
}

/**
 * @param {number} totalDays
 * @returns {string}
 */
export function formatThirtyDayMonthDuration(totalDays) {
  const months = Math.floor(totalDays / 30);
  const days = totalDays % 30;
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

function formatMonthsLabel(months) {
  return `${months} ${monthsWord(months)}`;
}

function formatSignedMonths(months) {
  return `+${formatMonthsLabel(months)}`;
}

function formatDaysLabel(days) {
  return `${days} ${daysWord(days)}`;
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
