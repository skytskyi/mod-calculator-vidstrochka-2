/**
 * Minimal date helpers with date-fns-compatible signatures for browser use.
 * When npm is available, tests run against the real date-fns package.
 */

(function (global) {
  function addMonths(date, amount) {
    const result = new Date(date.getTime());
    const day = result.getDate();
    result.setMonth(result.getMonth() + amount);

    if (result.getDate() !== day) {
      result.setDate(0);
    }

    return result;
  }

  function addDays(date, amount) {
    const result = new Date(date.getTime());
    result.setDate(result.getDate() + amount);
    return result;
  }

  function addYears(date, amount) {
    return addMonths(date, amount * 12);
  }

  function isAfter(dateLeft, dateRight) {
    return dateLeft.getTime() > dateRight.getTime();
  }

  function isBefore(dateLeft, dateRight) {
    return dateLeft.getTime() < dateRight.getTime();
  }

  function max(dates) {
    return new Date(Math.max(...dates.map((date) => date.getTime())));
  }

  function min(dates) {
    return new Date(Math.min(...dates.map((date) => date.getTime())));
  }

  function differenceInYears(dateLeft, dateRight) {
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

  function intervalToDuration(interval) {
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

  function format(date, token) {
    if (token !== "dd.MM.yyyy") {
      throw new Error(`Unsupported format token: ${token}`);
    }

    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = String(date.getFullYear());
    return `${day}.${month}.${year}`;
  }

  global.DateFnsLite = {
    addMonths,
    addDays,
    addYears,
    isAfter,
    isBefore,
    max,
    min,
    differenceInYears,
    intervalToDuration,
    format,
  };
})(window);
