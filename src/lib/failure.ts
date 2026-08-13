import { pushToast } from "../state/toast";

/**
 * Tells the user when a write didn't land.
 *
 * Several paths used to catch an error, log it, and carry on as though nothing
 * had happened — in one case pushing a celebration toast for a session whose
 * XP, streak and study-log writes had all failed. Everything in this app lives
 * in the user's own browser with no server copy, so a silently dropped write is
 * progress that simply never existed.
 *
 * `action` completes the sentence "Couldn't …", so pass a verb phrase:
 * `reportFailure("record that win", err)`.
 */
export function reportFailure(action: string, err: unknown, body?: string): void {
  console.error(`${action} failed:`, err);
  pushToast({
    variant: "warn",
    icon: "⚠️",
    title: `Couldn't ${action}`,
    body: body ?? "Nothing was saved for this one. It's worth trying again.",
    // Longer than the default: a failure the user needs to act on shouldn't
    // disappear at the same speed as a routine confirmation.
    durationMs: 7000,
  });
}
