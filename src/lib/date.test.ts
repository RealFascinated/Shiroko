import { describe, expect, test } from "bun:test";
import { ageInYears, daysUntil, isValidCalendarDate, isValidYear, monthName, todayUtc } from "./date";

describe("isValidCalendarDate", () => {
  test("accepts real dates", () => {
    expect(isValidCalendarDate(1996, 5, 14)).toBe(true);
    expect(isValidCalendarDate(2000, 1, 1)).toBe(true);
    expect(isValidCalendarDate(1990, 12, 31)).toBe(true);
  });

  test("accepts 29 February only in leap years", () => {
    expect(isValidCalendarDate(1996, 2, 29)).toBe(true);
    expect(isValidCalendarDate(2000, 2, 29)).toBe(true);
    expect(isValidCalendarDate(1998, 2, 29)).toBe(false);
    expect(isValidCalendarDate(1900, 2, 29)).toBe(false);
  });

  test("rejects month/day overflows", () => {
    expect(isValidCalendarDate(1998, 2, 30)).toBe(false);
    expect(isValidCalendarDate(2001, 4, 31)).toBe(false);
    expect(isValidCalendarDate(1994, 13, 1)).toBe(false);
    expect(isValidCalendarDate(1994, 0, 1)).toBe(false);
    expect(isValidCalendarDate(1994, 1, 0)).toBe(false);
    expect(isValidCalendarDate(1994, 1, 32)).toBe(false);
  });

  test("rejects non-integers", () => {
    expect(isValidCalendarDate(1994, 1.5, 1)).toBe(false);
    expect(isValidCalendarDate(1994, 1, 1.5)).toBe(false);
  });
});

describe("isValidYear", () => {
  const now = new Date(Date.UTC(2026, 8, 28));

  test("accepts the minimum and this year", () => {
    expect(isValidYear(1900, now)).toBe(true);
    expect(isValidYear(2026, now)).toBe(true);
  });

  test("rejects future and absurd years", () => {
    expect(isValidYear(2027, now)).toBe(false);
    expect(isValidYear(1899, now)).toBe(false);
    expect(isValidYear(0, now)).toBe(false);
    expect(isValidYear(-5, now)).toBe(false);
  });

  test("honours a custom lower bound", () => {
    expect(isValidYear(2000, now, 2001)).toBe(false);
    expect(isValidYear(2001, now, 2001)).toBe(true);
  });
});

describe("todayUtc", () => {
  test("returns 1-based month and the UTC day", () => {
    expect(todayUtc(new Date(Date.UTC(2026, 8, 28, 0, 1)))).toEqual({ month: 9, day: 28 });
    expect(todayUtc(new Date(Date.UTC(2026, 11, 31, 23, 59)))).toEqual({ month: 12, day: 31 });
  });

  test("does not shift with the time of day", () => {
    expect(todayUtc(new Date(Date.UTC(2026, 0, 1, 0, 0)))).toEqual({ month: 1, day: 1 });
    expect(todayUtc(new Date(Date.UTC(2026, 0, 1, 23, 59)))).toEqual({ month: 1, day: 1 });
  });
});

describe("daysUntil", () => {
  const from = new Date(Date.UTC(2026, 8, 28)); // 28 Sep 2026

  test("today is 0", () => {
    expect(daysUntil(9, 28, from)).toBe(0);
  });

  test("later this year", () => {
    expect(daysUntil(9, 29, from)).toBe(1);
    expect(daysUntil(10, 1, from)).toBe(3);
    expect(daysUntil(12, 25, from)).toBe(88);
  });

  test("wraps into next year", () => {
    expect(daysUntil(1, 1, from)).toBe(95);
    expect(daysUntil(9, 27, from)).toBe(364);
  });

  test("29 February skips to the next leap year", () => {
    // 2027 is a common year, so the next 29 Feb is 2028.
    expect(daysUntil(2, 29, from)).toBe(519);
  });

  test("ignores the time of day", () => {
    expect(daysUntil(9, 28, new Date(Date.UTC(2026, 8, 28, 23, 59)))).toBe(0);
    expect(daysUntil(9, 29, new Date(Date.UTC(2026, 8, 28, 23, 59)))).toBe(1);
  });
});

describe("ageInYears", () => {
  const now = new Date(Date.UTC(2026, 8, 28)); // 28 Sep 2026

  test("counts a birthday already passed this year", () => {
    expect(ageInYears(new Date(Date.UTC(1996, 4, 14)), now)).toBe(30);
    expect(ageInYears(new Date(Date.UTC(1996, 8, 28)), now)).toBe(30);
  });

  test("counts a birthday still to come as not yet gained", () => {
    expect(ageInYears(new Date(Date.UTC(1996, 8, 29)), now)).toBe(29);
    expect(ageInYears(new Date(Date.UTC(1996, 11, 25)), now)).toBe(29);
  });

  test("handles a 29 February birthday in a common year", () => {
    expect(ageInYears(new Date(Date.UTC(1996, 1, 29)), now)).toBe(30);
  });
});

describe("monthName", () => {
  test("maps 1-based months to names", () => {
    expect(monthName(1)).toBe("January");
    expect(monthName(9)).toBe("September");
    expect(monthName(12)).toBe("December");
  });
});
