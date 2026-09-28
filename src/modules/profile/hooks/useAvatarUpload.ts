import { useEffect, useRef, useState } from "react";
import { pickAvatar } from "../pickAvatar";
import { uploadAvatar } from "../api/uploadAvatar";
import { updateProfile } from "../api/updateProfile";
import { deleteAvatarObject } from "../api/deleteAvatarObject";
import { Sentry } from "@/lib/sentry";

type PhotoState = { state: "idle" } | { state: "uploading" } | { state: "error" };

/**
 * Full pick → upload → save → cleanup flow for a profile photo. Uploads and
 * saves immediately on pick (not gated behind a separate Save action) — see
 * the Edit profile screen's own doc comment for why.
 *
 * Every await below is checked against `cancelledRef`: nothing here can
 * actually abort the underlying network calls, so a cancel means "don't act
 * on the result, and don't touch state once the caller is gone" instead.
 * `cancel()` and the unmount effect both set that ref; call `cancel()` from
 * the caller's own back/cancel handlers.
 */
export function useAvatarUpload(userId: string | undefined, initialAvatarUrl: string | null | undefined) {
  const [avatarUrlOverride, setAvatarUrlOverride] = useState<string | null | undefined>(undefined);
  const [photo, setPhoto] = useState<PhotoState>({ state: "idle" });
  const cancelledRef = useRef(false);

  useEffect(() => {
    return () => {
      cancelledRef.current = true;
    };
  }, []);

  const avatarUrl = avatarUrlOverride !== undefined ? avatarUrlOverride : initialAvatarUrl;
  const isUploading = photo.state === "uploading";

  const cancel = () => {
    cancelledRef.current = true;
  };

  const pickAndUpload = async () => {
    if (isUploading || !userId) return;
    cancelledRef.current = false;
    // What this attempt would replace, captured now — stable for the rest
    // of this call regardless of what the pick/upload below does later.
    const previousAvatarUrl = avatarUrl;
    try {
      const picked = await pickAvatar();
      if (cancelledRef.current) return;
      if (!picked) return; // cancelled or permission denied — not an error
      if (cancelledRef.current) return;

      setPhoto({ state: "uploading" });
      const publicUrl = await uploadAvatar(userId, picked.uri);
      if (cancelledRef.current) {
        // Upload already landed in Storage at a unique path nothing points
        // at yet — best-effort delete it so a cancel doesn't leak an
        // orphaned object.
        await deleteAvatarObject(userId, publicUrl);
        return;
      }

      await updateProfile(userId, { avatarUrl: publicUrl });
      // Same can't-abort limitation as the upload, on a much smaller
      // request — accepted, not eliminated: nothing left to undo once a
      // save this small has actually landed.
      if (cancelledRef.current) return;
      setAvatarUrlOverride(publicUrl);
      setPhoto({ state: "idle" });
      // Clean up the photo this replace just superseded.
      if (previousAvatarUrl) {
        await deleteAvatarObject(userId, previousAvatarUrl);
      }
    } catch (err) {
      if (cancelledRef.current) return;
      Sentry.captureException(err);
      setPhoto({ state: "error" });
    }
  };

  return { avatarUrl, photo, isUploading, pickAndUpload, cancel };
}
