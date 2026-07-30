import { describe, expect, it } from "vitest";
import {
  ContractType,
  ServiceStatus,
  CombatUnitType,
  calculate,
  calculateMonthsAfter2022,
  calculateMonthsBefore2022,
  calculateCombatMonths,
  calculateBefore2022Contribution,
  calculateAfter2022Contribution,
  resolveContractTermMonths,
  resolveCombatDivisor,
  calculateContractEndDate,
} from "../src/deferralCalculator.js";

describe("resolveContractTermMonths", () => {
  it("maps assault terms by status", () => {
    expect(
      resolveContractTermMonths(ServiceStatus.OBLIGATED, ContractType.ASSAULT)
    ).toBe(14);
    expect(
      resolveContractTermMonths(ServiceStatus.ACTIVE, ContractType.ASSAULT)
    ).toBe(10);
    expect(
      resolveContractTermMonths(ServiceStatus.DISCHARGED, ContractType.ASSAULT)
    ).toBe(6);
  });

  it("requires term choice for discharged combat/basic", () => {
    expect(
      resolveContractTermMonths(ServiceStatus.DISCHARGED, ContractType.COMBAT, 6)
    ).toBe(6);
    expect(
      resolveContractTermMonths(ServiceStatus.DISCHARGED, ContractType.BASIC, 24)
    ).toBe(24);
    expect(() =>
      resolveContractTermMonths(ServiceStatus.DISCHARGED, ContractType.COMBAT)
    ).toThrow("Оберіть термін контракту");
  });

  it("uses fixed 24 months for obligated/active combat/basic", () => {
    expect(
      resolveContractTermMonths(ServiceStatus.ACTIVE, ContractType.COMBAT)
    ).toBe(24);
    expect(
      resolveContractTermMonths(ServiceStatus.OBLIGATED, ContractType.BASIC)
    ).toBe(24);
  });
});

describe("combat months and divisors", () => {
  it("uses ceiling for combat days", () => {
    expect(calculateCombatMonths(1, 30)).toBe(1);
    expect(calculateCombatMonths(31, 30)).toBe(2);
    expect(calculateCombatMonths(7, 10)).toBe(1);
    expect(calculateCombatMonths(15, 10)).toBe(2);
    expect(calculateCombatMonths(15, 30)).toBe(1);
    expect(calculateCombatMonths(0, 10)).toBe(0);
  });

  it("resolves divisors by term and unit type", () => {
    expect(resolveCombatDivisor(6, CombatUnitType.COMBAT_UNIT)).toBe(10);
    expect(resolveCombatDivisor(6, CombatUnitType.NON_COMBAT_UNIT)).toBe(30);
    expect(resolveCombatDivisor(10, CombatUnitType.NON_COMBAT_UNIT)).toBe(10);
    expect(resolveCombatDivisor(14, CombatUnitType.COMBAT_UNIT)).toBe(10);
    expect(resolveCombatDivisor(24, CombatUnitType.COMBAT_UNIT)).toBe(30);
  });
});

describe("service month contributions", () => {
  it("adds +1 year bucket even for zero months", () => {
    expect(calculateBefore2022Contribution(0)).toBe(1);
    expect(calculateAfter2022Contribution(0)).toBe(6);
  });

  it("caps months before 2022 at 480", () => {
    expect(calculateBefore2022Contribution(480)).toBe(41);
    expect(calculateBefore2022Contribution(600)).toBe(41);
  });

  it("counts full months before and after war date", () => {
    expect(
      calculateMonthsBefore2022(new Date(2017, 8, 1), undefined)
    ).toBe(53);
    expect(
      calculateMonthsAfter2022(
        new Date(2017, 8, 1),
        new Date(2024, 2, 1),
        undefined
      )
    ).toBe(24);
  });
});

describe("calculateContractEndDate", () => {
  it("adds resolved term months", () => {
    const start = new Date(2026, 0, 1);
    expect(calculateContractEndDate(start, 14)).toEqual(new Date(2027, 2, 1));
    expect(calculateContractEndDate(start, 10)).toEqual(new Date(2026, 10, 1));
    expect(calculateContractEndDate(start, 6)).toEqual(new Date(2026, 6, 1));
  });
});

describe("test vectors V1–V7", () => {
  it("V1: military + assault, full components → 2 years 8 months", () => {
    const result = calculate({
      serviceStatus: ServiceStatus.ACTIVE,
      contractType: ContractType.ASSAULT,
      serviceStartDate: new Date(2017, 8, 1),
      contractStartDate: new Date(2024, 2, 1),
      combatDays: 30,
    });

    expect(result.contractTermMonths).toBe(10);
    expect(result.totalDeferralMonths).toBe(32);
    expect(result.deferralDurationLabel).toBe("32 місяці");
    expect(result.hasCalendarDates).toBe(true);
  });

  it("V2: obligated + assault, 7 combat days → 7 months", () => {
    const result = calculate({
      serviceStatus: ServiceStatus.OBLIGATED,
      contractType: ContractType.ASSAULT,
      contractStartDate: new Date(2026, 8, 1),
      combatDays: 7,
    });

    expect(result.contractTermMonths).toBe(14);
    expect(result.totalDeferralMonths).toBe(7);
    expect(result.deferralDurationLabel).toBe("7 місяців");
  });

  it("V3: discharged + assault in combat units → 8 months", () => {
    const result = calculate({
      serviceStatus: ServiceStatus.DISCHARGED,
      contractType: ContractType.ASSAULT,
      serviceStartDate: new Date(2020, 0, 1),
      serviceEndDate: new Date(2025, 0, 1),
      contractStartDate: new Date(2026, 8, 1),
      combatUnitType: CombatUnitType.COMBAT_UNIT,
      combatDays: 15,
    });

    expect(result.contractTermMonths).toBe(6);
    expect(result.totalDeferralMonths).toBe(8);
    expect(result.deferralDurationLabel).toBe("8 місяців");
  });

  it("V4: discharged + combat from 6 months not in combat units → 7 months", () => {
    const result = calculate({
      serviceStatus: ServiceStatus.DISCHARGED,
      contractType: ContractType.COMBAT,
      contractTermChoice: 6,
      serviceStartDate: new Date(2020, 0, 1),
      serviceEndDate: new Date(2025, 0, 1),
      contractStartDate: new Date(2026, 8, 1),
      combatUnitType: CombatUnitType.NON_COMBAT_UNIT,
      combatDays: 15,
    });

    expect(result.contractTermMonths).toBe(6);
    expect(result.totalDeferralMonths).toBe(7);
    expect(result.deferralDurationLabel).toBe("7 місяців");
  });

  it("V5: military + combat with service before 2022 → 1 year 9 months", () => {
    const result = calculate({
      serviceStatus: ServiceStatus.ACTIVE,
      contractType: ContractType.COMBAT,
      serviceStartDate: new Date(2010, 7, 1),
      contractStartDate: new Date(2026, 8, 1),
      combatDays: 61,
    });

    expect(result.contractTermMonths).toBe(24);
    expect(result.totalDeferralMonths).toBe(21);
    expect(result.deferralDurationLabel).toBe("21 місяць");
  });

  it("V6: discharged + assault ignores service before 2022", () => {
    const result = calculate({
      serviceStatus: ServiceStatus.DISCHARGED,
      contractType: ContractType.ASSAULT,
      serviceStartDate: new Date(2010, 7, 1),
      serviceEndDate: new Date(2025, 0, 1),
      contractStartDate: new Date(2026, 8, 1),
      combatUnitType: CombatUnitType.COMBAT_UNIT,
      combatDays: 5,
    });

    expect(result.contractTermMonths).toBe(6);
    expect(result.monthsBefore2022).toBe(0);
    expect(result.totalDeferralMonths).toBe(7);
    expect(result.deferralDurationLabel).toBe("7 місяців");
  });

  it("V7: obligated + basic with zero combat → 6 months", () => {
    const result = calculate({
      serviceStatus: ServiceStatus.OBLIGATED,
      contractType: ContractType.BASIC,
      contractStartDate: new Date(2026, 8, 1),
      combatDays: 0,
    });

    expect(result.contractTermMonths).toBe(24);
    expect(result.totalDeferralMonths).toBe(6);
    expect(result.deferralDurationLabel).toBe("6 місяців");
  });
});

describe("validation and optional contract date", () => {
  it("rejects missing period end for discharged status", () => {
    expect(() =>
      calculate({
        serviceStatus: ServiceStatus.DISCHARGED,
        contractType: ContractType.ASSAULT,
        serviceStartDate: new Date(2020, 3, 15),
        contractStartDate: new Date(2026, 8, 1),
        combatUnitType: CombatUnitType.COMBAT_UNIT,
        combatDays: 0,
      })
    ).toThrow("Вкажіть дату закінчення періоду служби");
  });

  it("allows calculation without contract start date", () => {
    const result = calculate({
      serviceStatus: ServiceStatus.OBLIGATED,
      contractType: ContractType.ASSAULT,
      combatDays: 0,
    });

    expect(result.totalDeferralMonths).toBe(6);
    expect(result.hasCalendarDates).toBe(false);
    expect(result.contractEndDate).toBeNull();
    expect(result.deferralEndDate).toBeNull();
  });

  it("requires unit type for 6-month term", () => {
    expect(() =>
      calculate({
        serviceStatus: ServiceStatus.DISCHARGED,
        contractType: ContractType.ASSAULT,
        serviceStartDate: new Date(2020, 3, 15),
        serviceEndDate: new Date(2025, 0, 1),
        contractStartDate: new Date(2026, 8, 1),
        combatDays: 10,
      })
    ).toThrow("Оберіть тип участі в бойових діях");
  });
});

describe("multiple service periods", () => {
  it("sums months across separate periods", () => {
    const result = calculate({
      serviceStatus: ServiceStatus.ACTIVE,
      contractType: ContractType.COMBAT,
      servicePeriods: [
        {
          startDate: new Date(2014, 0, 1),
          endDate: new Date(2019, 11, 31),
        },
        {
          startDate: new Date(2022, 2, 1),
        },
      ],
      contractStartDate: new Date(2024, 5, 1),
      combatDays: 0,
    });

    expect(result.contractTermMonths).toBe(24);
    expect(result.monthsBefore2022).toBe(71);
    expect(result.totalDeferralMonths).toBe(6 + Math.floor(71 / 12) + 1);
  });

  it("rejects overlapping periods", () => {
    expect(() =>
      calculate({
        serviceStatus: ServiceStatus.DISCHARGED,
        contractType: ContractType.BASIC,
        contractTermChoice: 24,
        servicePeriods: [
          {
            startDate: new Date(2018, 0, 1),
            endDate: new Date(2021, 0, 1),
          },
          {
            startDate: new Date(2020, 5, 1),
            endDate: new Date(2023, 0, 1),
          },
        ],
        contractStartDate: new Date(2026, 8, 1),
        combatDays: 0,
      })
    ).toThrow("Періоди служби не повинні перетинатися");
  });
});

describe("TO-BE explanation format", () => {
  it("formats combat contribution as signed months and days", () => {
    const result = calculate({
      serviceStatus: ServiceStatus.OBLIGATED,
      contractType: ContractType.ASSAULT,
      contractStartDate: new Date(2026, 8, 1),
      combatDays: 7,
    });

    const combatLine = result.explanation.find(function (line) {
      return line.label.indexOf("бойові частини") !== -1;
    });

    expect(combatLine).toBeTruthy();
    expect(combatLine.contribution).toBe("+1 місяць — 7 днів");
  });
});
