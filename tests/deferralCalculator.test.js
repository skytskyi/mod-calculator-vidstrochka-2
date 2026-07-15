import { describe, expect, it } from "vitest";
import {
  ContractType,
  ServiceStatus,
  calculate,
  calculateYearsAfter2022,
  calculateYearsBefore2022,
  calculateContractEndDate,
  formatThirtyDayMonthDuration,
} from "../src/deferralCalculator.js";

describe("calculateYearsBefore2022", () => {
  it("counts full years before 24.02.2022", () => {
    expect(calculateYearsBefore2022(new Date(2020, 3, 15))).toBe(1);
  });

  it("returns 0 when service starts after war date", () => {
    expect(calculateYearsBefore2022(new Date(2022, 5, 1))).toBe(0);
  });

  it("caps counting at discharge date when service ended before war", () => {
    expect(
      calculateYearsBefore2022(new Date(2018, 0, 1), new Date(2019, 5, 1))
    ).toBe(1);
  });

  it("returns 0 when discharge is on or before service start", () => {
    expect(
      calculateYearsBefore2022(new Date(2020, 3, 15), new Date(2020, 3, 15))
    ).toBe(0);
  });
});

describe("calculateYearsAfter2022", () => {
  it("counts full years from war date to contract signing", () => {
    expect(
      calculateYearsAfter2022(new Date(2022, 1, 24), new Date(2026, 8, 1))
    ).toBe(4);
  });

  it("uses service start when it is after war date", () => {
    expect(
      calculateYearsAfter2022(new Date(2023, 0, 1), new Date(2026, 8, 1))
    ).toBe(3);
  });

  it("caps counting at discharge date for discharged service members", () => {
    expect(
      calculateYearsAfter2022(
        new Date(2022, 1, 24),
        new Date(2026, 8, 1),
        new Date(2024, 5, 1)
      )
    ).toBe(2);
  });
});

describe("calculateContractEndDate", () => {
  it("adds 14 months for assault contract", () => {
    const start = new Date(2026, 0, 1);
    expect(calculateContractEndDate(start, ContractType.ASSAULT)).toEqual(
      new Date(2027, 2, 1)
    );
  });

  it("adds 24 months for combat contract", () => {
    const start = new Date(2026, 0, 1);
    expect(calculateContractEndDate(start, ContractType.COMBAT)).toEqual(
      new Date(2028, 0, 1)
    );
  });
});

describe("formatThirtyDayMonthDuration", () => {
  it("converts combat days using 30-day months", () => {
    expect(formatThirtyDayMonthDuration(45)).toBe("1 місяць 15 днів");
    expect(formatThirtyDayMonthDuration(30)).toBe("1 місяць");
    expect(formatThirtyDayMonthDuration(15)).toBe("15 днів");
  });
});

describe("calculate", () => {
  it("calculates assault deferral with combat days", () => {
    const result = calculate({
      serviceStatus: ServiceStatus.ACTIVE,
      contractType: ContractType.ASSAULT,
      serviceStartDate: new Date(2020, 3, 15),
      contractStartDate: new Date(2026, 8, 1),
      combatDays: 45,
    });

    expect(result.yearsBefore2022).toBe(1);
    expect(result.yearsAfter2022).toBe(4);
    expect(result.contractEndDate).toEqual(new Date(2027, 10, 1));
    expect(result.deferralEndDate).toEqual(new Date(2030, 6, 16));
    expect(result.deferralDurationLabel).toBe("2 роки 8 місяців 17 днів");

    const combatLine = result.explanation.find(function (line) {
      return line.label === "Відстрочка за бойові завдання";
    });
    expect(combatLine?.detail).toBe("45 днів");
    expect(combatLine?.contribution).toBe("1 місяць 15 днів");
  });

  it("calculates combat deferral with combat days as calendar days", () => {
    const result = calculate({
      serviceStatus: ServiceStatus.DISCHARGED,
      contractType: ContractType.COMBAT,
      serviceStartDate: new Date(2020, 3, 15),
      serviceEndDate: new Date(2026, 7, 1),
      contractStartDate: new Date(2026, 8, 1),
      combatAssignment: "FIRST_LINE",
      combatDays: 15,
    });

    expect(result.yearsBefore2022).toBe(1);
    expect(result.yearsAfter2022).toBe(4);
    expect(result.contractEndDate).toEqual(new Date(2028, 8, 1));
    expect(result.deferralEndDate).toEqual(new Date(2029, 3, 16));
    expect(result.deferralDuration).toEqual({ years: 0, months: 7, days: 15 });

    const combatLine = result.explanation.find(function (line) {
      return line.label === "Відстрочка за бойові завдання на першій лінії";
    });
    expect(combatLine?.detail).toBe("15 днів");
  });

  it("limits discharged service years to the service period", () => {
    const result = calculate({
      serviceStatus: ServiceStatus.DISCHARGED,
      contractType: ContractType.ASSAULT,
      serviceStartDate: new Date(2020, 3, 15),
      serviceEndDate: new Date(2024, 5, 1),
      contractStartDate: new Date(2026, 8, 1),
      combatDays: 0,
    });

    expect(result.yearsBefore2022).toBe(1);
    expect(result.yearsAfter2022).toBe(2);
    expect(result.deferralDurationLabel).toBe("2 роки 1 місяць");
  });

  it("rejects missing discharge date for discharged status", () => {
    expect(() =>
      calculate({
        serviceStatus: ServiceStatus.DISCHARGED,
        contractType: ContractType.BASIC,
        serviceStartDate: new Date(2020, 3, 15),
        contractStartDate: new Date(2026, 8, 1),
        combatDays: 0,
      })
    ).toThrow("Вкажіть дату звільнення з військової служби");
  });

  it("rejects discharge before service start", () => {
    expect(() =>
      calculate({
        serviceStatus: ServiceStatus.DISCHARGED,
        contractType: ContractType.BASIC,
        serviceStartDate: new Date(2024, 0, 1),
        serviceEndDate: new Date(2023, 0, 1),
        contractStartDate: new Date(2026, 8, 1),
        combatDays: 0,
      })
    ).toThrow(
      "Дата звільнення з військової служби має бути пізнішою за дату початку служби"
    );
  });

  it("rejects discharge on the same day as service start", () => {
    expect(() =>
      calculate({
        serviceStatus: ServiceStatus.DISCHARGED,
        contractType: ContractType.BASIC,
        serviceStartDate: new Date(2024, 0, 1),
        serviceEndDate: new Date(2024, 0, 1),
        contractStartDate: new Date(2026, 8, 1),
        combatDays: 0,
      })
    ).toThrow(
      "Дата звільнення з військової служби має бути пізнішою за дату початку служби"
    );
  });

  it("rejects discharge on or after contract start", () => {
    expect(() =>
      calculate({
        serviceStatus: ServiceStatus.DISCHARGED,
        contractType: ContractType.BASIC,
        serviceStartDate: new Date(2020, 3, 15),
        serviceEndDate: new Date(2026, 8, 1),
        contractStartDate: new Date(2026, 8, 1),
        combatDays: 0,
      })
    ).toThrow(
      "Дата звільнення з військової служби має бути ранішою за планову або фактичну дату підписання нового контракту"
    );
  });

  it("rejects service start after contract start", () => {
    expect(() =>
      calculate({
        serviceStatus: ServiceStatus.ACTIVE,
        contractType: ContractType.BASIC,
        serviceStartDate: new Date(2027, 0, 1),
        contractStartDate: new Date(2026, 0, 1),
        combatDays: 0,
      })
    ).toThrow(
      "Дата початку військової служби не може бути пізнішою за планову або фактичну дату підписання нового контракту"
    );
  });

  it("calculates obligated deferral without prior service years", () => {
    const result = calculate({
      serviceStatus: ServiceStatus.OBLIGATED,
      contractType: ContractType.BASIC,
      contractStartDate: new Date(2026, 8, 1),
      combatDays: 0,
    });

    expect(result.yearsBefore2022).toBe(0);
    expect(result.yearsAfter2022).toBe(0);
    expect(result.deferralDurationLabel).toBe("6 місяців");
  });
});
