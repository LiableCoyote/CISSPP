import { describe, it, expect, afterEach } from "vitest";
import { shouldNudge, reminderSupport } from "./reminders";

/** Local time, since shouldNudge compares against the user's wall clock. */
const at = (h: number, m = 0) => new Date(2026, 5, 15, h, m, 0);
const TODAY = "2026-06-15";
const YESTERDAY = "2026-06-14";

describe("shouldNudge", () => {
  it("stays silent when the reminder is off", () => {
    expect(
      shouldNudge({
        enabled: false,
        lastActiveDate: null,
        preferredTime: "09:00",
        now: at(23),
      }),
    ).toBe(false);
  });

  it("stays silent once something is logged today", () => {
    expect(
      shouldNudge({
        enabled: true,
        lastActiveDate: TODAY,
        preferredTime: "09:00",
        now: at(23),
      }),
    ).toBe(false);
  });

  it("stays silent before the preferred time", () => {
    expect(
      shouldNudge({
        enabled: true,
        lastActiveDate: YESTERDAY,
        preferredTime: "18:00",
        now: at(17, 59),
      }),
    ).toBe(false);
  });

  it("fires at exactly the preferred time", () => {
    expect(
      shouldNudge({
        enabled: true,
        lastActiveDate: YESTERDAY,
        preferredTime: "18:00",
        now: at(18, 0),
      }),
    ).toBe(true);
  });

  it("fires after the preferred time", () => {
    expect(
      shouldNudge({
        enabled: true,
        lastActiveDate: YESTERDAY,
        preferredTime: "18:00",
        now: at(21, 30),
      }),
    ).toBe(true);
  });

  it("fires for a user who has never studied", () => {
    expect(
      shouldNudge({
        enabled: true,
        lastActiveDate: null,
        preferredTime: "08:00",
        now: at(9),
      }),
    ).toBe(true);
  });

  it("respects the minutes, not just the hour", () => {
    const opts = { enabled: true, lastActiveDate: YESTERDAY, preferredTime: "18:30" };
    expect(shouldNudge({ ...opts, now: at(18, 29) })).toBe(false);
    expect(shouldNudge({ ...opts, now: at(18, 31) })).toBe(true);
  });

  // A corrupt stored value must not silently disable the reminder forever —
  // failing toward a nudge is the recoverable direction.
  it("still nudges when the stored time is unparseable", () => {
    for (const preferredTime of ["", "garbage", "25:xx", ":"]) {
      expect(
        shouldNudge({ enabled: true, lastActiveDate: YESTERDAY, preferredTime, now: at(3) }),
      ).toBe(true);
    }
  });

  it("compares against local calendar days, not UTC", () => {
    // Late evening local time: the UTC date may already be tomorrow, but the
    // user's "today" is what the streak is keyed on.
    const lateLocal = new Date(2026, 5, 15, 23, 45);
    expect(
      shouldNudge({
        enabled: true,
        lastActiveDate: TODAY,
        preferredTime: "18:00",
        now: lateLocal,
      }),
    ).toBe(false);
  });

  it("treats midnight as always past", () => {
    expect(
      shouldNudge({
        enabled: true,
        lastActiveDate: YESTERDAY,
        preferredTime: "00:00",
        now: at(0, 0),
      }),
    ).toBe(true);
  });
});

describe("reminderSupport", () => {
  // `navigator` is a getter-only global in node, so it has to be redefined
  // rather than assigned.
  const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, "navigator");

  afterEach(() => {
    delete (globalThis as { window?: unknown }).window;
    if (originalNavigator) Object.defineProperty(globalThis, "navigator", originalNavigator);
    else delete (globalThis as { navigator?: unknown }).navigator;
  });

  const install = (opts: { notifications: boolean; periodicSync: boolean }) => {
    const win: Record<string, unknown> = {};
    if (opts.notifications) win.Notification = function () {};
    if (opts.periodicSync) win.PeriodicSyncManager = function () {};
    (globalThis as { window?: unknown }).window = win;
    Object.defineProperty(globalThis, "navigator", {
      value: opts.periodicSync ? { serviceWorker: {} } : {},
      configurable: true,
      writable: true,
    });
  };

  it("promises only an in-app reminder with no Notification API", () => {
    install({ notifications: false, periodicSync: false });
    const s = reminderSupport();
    expect(s.notifications).toBe(false);
    expect(s.summary).toMatch(/in the app/i);
  });

  // The iOS/Safari case, and the honest one: notifications exist but nothing
  // can wake the worker, so no background reminder is possible.
  it("says so plainly when the browser can't wake the app", () => {
    install({ notifications: true, periodicSync: false });
    const s = reminderSupport();
    expect(s.notifications).toBe(true);
    expect(s.background).toBe(false);
    expect(s.summary).toMatch(/can't wake the app in the background/i);
    expect(s.summary).toMatch(/iOS/);
  });

  // Even in the best case it must not promise a time.
  it("calls background delivery approximate and browser-decided", () => {
    install({ notifications: true, periodicSync: true });
    const s = reminderSupport();
    expect(s.background).toBe(true);
    expect(s.summary).toMatch(/approximate/i);
    expect(s.summary).toMatch(/browser decides/i);
  });

  it("never claims a reminder will arrive at a chosen time", () => {
    for (const opts of [
      { notifications: false, periodicSync: false },
      { notifications: true, periodicSync: false },
      { notifications: true, periodicSync: true },
    ]) {
      install(opts);
      expect(reminderSupport().summary).not.toMatch(/\bdaily at\b|\bevery day at\b|\bexactly\b/i);
    }
  });
});
