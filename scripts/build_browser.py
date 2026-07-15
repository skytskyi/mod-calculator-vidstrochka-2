#!/usr/bin/env python3
"""Regenerate browser bundles from src/ ES modules."""

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def build_calculator_browser() -> None:
    calc_src = strip_esm_imports((ROOT / "src/deferralCalculator.js").read_text())
    calc_src = calc_src.replace("export const ContractType", "const ContractType")
    calc_src = calc_src.replace("export const ServiceStatus", "const ServiceStatus")
    calc_src = calc_src.replace("export const CombatAssignment", "const CombatAssignment")
    calc_src = calc_src.replace("export const WAR_START_DATE", "const WAR_START_DATE")
    calc_src = calc_src.replace("export function ", "function ")

    browser_calc = f"""(function (global) {{
  const {{
    addDays,
    addMonths,
    addYears,
    intervalToDuration,
    isAfter,
    isBefore,
    max: maxDate,
    min: minDate,
    differenceInYears,
  }} = global.DateFnsLite;

{calc_src}
  global.DeferralCalculator = {{
    ContractType,
    ServiceStatus,
    CombatAssignment,
    WAR_START_DATE,
    differenceInFullYears,
    calculateYearsBefore2022,
    calculateYearsAfter2022,
    calculateContractDuration,
    calculateContractEndDate,
    calculateDeferral,
    calculateDeferralDuration,
    calculate,
    formatDurationParts,
    formatThirtyDayMonthDuration,
    getCombatAssignmentExplanationLabel,
    getCombatExplanationLabel,
    getCombatExplanationLabels,
  }};
}})(window);
"""
    (ROOT / "deferralCalculator.browser.js").write_text(browser_calc)


def strip_esm_imports(source: str) -> str:
    """Remove all top-level ESM import blocks from source text."""
    return re.sub(
        r"^import\s+(?:\{[\s\S]*?\}|[^\n]+)\s+from\s+[\"'][^\"']+[\"'];\n?",
        "",
        source,
        flags=re.MULTILINE,
    )


def build_form_browser() -> None:
    form_src = strip_esm_imports((ROOT / "src/deferral-form.js").read_text())

    browser_form = f"""(function () {{
  const {{ format }} = window.DateFnsLite;
  const {{ ContractType, ServiceStatus, calculate, formatDurationParts, getCombatExplanationLabels }} = window.DeferralCalculator;

{form_src}
}})();
"""
    (ROOT / "deferral-form.browser.js").write_text(browser_form)


if __name__ == "__main__":
    build_calculator_browser()
    build_form_browser()
    print("Browser bundles updated.")
