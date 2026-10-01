import { useCallback, useEffect, useRef, useState } from "react";
import { useAuthSession } from "@/modules/auth";
import { blockUser } from "../api/blockUser";
import { errorCode, reportUnexpected, UNIQUE_VIOLATION } from "../api/errors";

export type BlockStatus = "idle" | "blocking" | "blocked" | "error";

/** Block action for one user: one request at a time. Already blocked (23505) counts as blocked;
 * blocking yourself is refused before any request. */
export function useBlockUser(userId: string, onBlocked?: () => void) {
  const { session } = useAuthSession();
  const myId = session?.user.id;
  const [status, setStatus] = useState<BlockStatus>("idle");
  // Ref, not state: blocks a second tap before React re-renders with "blocking".
  const inFlightRef = useRef(false);
  // Ref, not state: read inside async code, the sheet can unmount mid-request.
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Writes the block, then shows blocked or the error state.
  const block = useCallback(async () => {
    if (inFlightRef.current) return;
    if (!myId || myId === userId) {
      setStatus("error");
      return;
    }
    inFlightRef.current = true;
    setStatus("blocking");
    let next: BlockStatus = "blocked";
    try {
      await blockUser(myId, userId);
    } catch (err) {
      if (errorCode(err) !== UNIQUE_VIOLATION) {
        reportUnexpected("blockUser", err);
        next = "error";
      }
    }
    inFlightRef.current = false;
    if (!mountedRef.current) return;
    setStatus(next);
    if (next === "blocked") onBlocked?.();
  }, [myId, userId, onBlocked]);

  // True from the tap itself, before "blocking" re-renders; the sheet uses it to refuse dismissal.
  const isInFlight = () => inFlightRef.current;

  return { status, block, isInFlight };
}
