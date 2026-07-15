/**
 * ESM date helpers used by src/deferralCalculator.js and unit tests.
 */

export function addMonths(date, amount) {
  const result = new Date(date.getTime());
  const day = result.getDate();
  result.setMonth(result.getMonth() + amount);

  if (result.getDate() !== day) {
    result.setDate(0);
  }

  return result;
}

export function addDays(date, amount) {
  const result = new Date(date.getTime());
  result.setDate(result.getDate() + amount);
  return result;
}

export function addYears(date, amount) {
  return addMonths(date, amount * 12);
}

export function isAfter(dateLeft, dateRight) {
  return dateLeft.getTime() > dateRight.getTime();
}

export function isBefore(dateLeft, dateRight) {
  return dateLeft.getTime() < dateRight.getTime();
}

export function max(dates) {
  return new Date(Math.max(...dates.map((date) => date.getTime())));
}

export function min(dates) {
  return new Date(Math.min(...dates.map((date) => date.getTime())));
}

export function differenceInYears(dateLeft, dateRight) {
  const sign = isBefore(dateLeft, dateRight) ? -1 : 1;
  const earlier = sign < 0 ? dateLeft : dateRight;
  const later = sign < 0 ? dateRight : dateLeft;
  let years = later.getFullYear() - earlier.getFullYear();

  const anniversary = addYears(earlier, years);
  if (isAfter(anniversary, later)) {
    years -= 1;
  }

  return years * sign;
}

export function intervalToDuration(interval) {
  let remainingStart = new Date(interval.start.getTime());
  const end = interval.end;

  if (!isBefore(remainingStart, end)) {
    return { years: 0, months: 0, days: 0 };
  }

  let years = 0;
  while (true) {
    const next = addYears(remainingStart, 1);
    if (isAfter(next, end)) break;
    years += 1;
    remainingStart = next;
  }

  let months = 0;
  while (true) {
    const next = addMonths(remainingStart, 1);
    if (isAfter(next, end)) break;
    months += 1;
    remainingStart = next;
  }

  const days = Math.round((end.getTime() - remainingStart.getTime()) / 86400000);

  return { years, months, days };
}

export function format(date, token) {
  if (token !== "dd.MM.yyyy") {
    throw new Error(`Unsupported format token: ${token}`);
  }

  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = String(date.getFullYear());
  return `${day}.${month}.${year}`;
}
