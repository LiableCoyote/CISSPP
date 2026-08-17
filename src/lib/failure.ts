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
/**
 * What deliberately stays console-only, so this does not get re-audited.
 *
 * Every remaining `console.error` in src/ was checked. None of them is silent
 * to the user; each already renders the failure where it happens:
 *
 *   ErrorBoundary / RouteErrorBoundary  the crash screen *is* the report, and
 *                                       the failed crash-backup path uses
 *                                       role="alert" beside the button
 *   UpdatePrompt                        onRegisterError sets swFailed, which
 *                                       renders a dismissible notice
 *   ShareCard                           already pushes its own warn toast
 *   App startup catch                   renders StartupError instead of the app
 *   Search                              renders an inline notice in the dialog
 *   achievements/engine                 queued and retried; only a permanent
 *                                       give-up reaches the user
 *
 * A console line next to a rendered failure is for debugging and is fine. A
 * console line *instead of* one is the thing to fix.
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
