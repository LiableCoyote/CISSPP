import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { reportFailure } from "./failure";
import { useToast } from "../state/toast";

beforeEach(() => {
  useToast.setState({ toasts: [] });
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

const toasts = () => useToast.getState().toasts;

describe("reportFailure", () => {
  // The whole point: a dropped write used to be invisible. Everything lives in
  // the user's own browser with no server copy, so silence means the progress
  // simply never existed.
  it("puts a warning in front of the user, not just the console", () => {
    reportFailure("record that win", new Error("QuotaExceededError"));
    expect(toasts()).toHaveLength(1);
    expect(toasts()[0].variant).toBe("warn");
  });

  it("completes the sentence 'Couldn't …' from the action", () => {
    reportFailure("save this quick test", new Error("nope"));
    expect(toasts()[0].title).toBe("Couldn't save this quick test");
  });

  it("still logs for debugging", () => {
    const err = new Error("boom");
    reportFailure("do the thing", err);
    expect(console.error).toHaveBeenCalledWith("do the thing failed:", err);
  });

  it("uses the caller's body when the specifics matter", () => {
    reportFailure("save this quick test", new Error("x"), "You scored 80%, but it wasn't recorded.");
    expect(toasts()[0].body).toBe("You scored 80%, but it wasn't recorded.");
  });

  it("falls back to a body that says nothing was saved", () => {
    reportFailure("do the thing", new Error("x"));
    expect(toasts()[0].body).toMatch(/nothing was saved/i);
  });

  // A failure the user may need to act on shouldn't vanish as fast as a
  // routine confirmation.
  it("lingers longer than the default toast", () => {
    reportFailure("do the thing", new Error("x"));
    const def = 4500;
    expect(toasts()[0].durationMs).toBeGreaterThan(def);
  });

  it("survives a non-Error being thrown", () => {
    expect(() => reportFailure("do the thing", "just a string")).not.toThrow();
    expect(toasts()).toHaveLength(1);
  });

  it("reports each failure separately rather than collapsing them", () => {
    reportFailure("first thing", new Error("a"));
    reportFailure("second thing", new Error("b"));
    expect(toasts().map((t) => t.title)).toEqual([
      "Couldn't first thing",
      "Couldn't second thing",
    ]);
  });
});
