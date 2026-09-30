import { useCallback, useEffect, useRef, useState } from "react";
import { useAuthSession } from "@/modules/auth";
import { errorCode, reportUnexpected, UNIQUE_VIOLATION } from "../api/errors";
import { reportContent } from "../api/reportContent";
import { REPORT_DETAILS_MAX, type ReportReason } from "../objectionableCategories";
import type { ReportTarget } from "../types";

export type ReportStatus = "idle" | "submitting" | "sent" | "error";

/** Report submission for the sheet: one request at a time. A repeat report (23505) counts as sent,
 * and a result that arrives after cancel or unmount is dropped. */
export function useReportContent(target: ReportTarget, onReported?: () => void) {
  const { session } = useAuthSession();
  const userId = session?.user.id;
  const [status, setStatus] = useState<ReportStatus>("idle");
  // Ref, not state: blocks a second tap before React re-renders with "submitting".
  const inFlightRef = useRef(false);
  // Ref, not state: read inside async code; bumped by cancel so an older request's result is ignored.
  const runRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Sends the report; "other" carries the trimmed details, every other reason sends none.
  const submit = useCallback(
    async (reason: ReportReason, details: string) => {
      if (inFlightRef.current) return;
      // Refused here as well as by the DB; nothing is sent and nothing is reported to Sentry.
      if (!userId || userId === target.ownerId) {
        setStatus("error");
        return;
      }
      inFlightRef.current = true;
      const run = ++runRef.current;
      setStatus("submitting");
      let next: ReportStatus = "sent";
      try {
        await reportContent(target, reason, reason === "other" ? details.trim().slice(0, REPORT_DETAILS_MAX) : null);
      } catch (err) {
        if (errorCode(err) !== UNIQUE_VIOLATION) {
          reportUnexpected("reportContent", err);
          next = "error";
        }
      }
      inFlightRef.current = false;
      if (!mountedRef.current || run !== runRef.current) return;
      setStatus(next);
      if (next === "sent") onReported?.();
    },
    [userId, target, onReported],
  );

  // Makes the running request's result be ignored (sheet dismissed mid-submit).
  const cancel = useCallback(() => {
    runRef.current += 1;
  }, []);

  return { status, submit, cancel };
}
