import { useEffect, useRef, useState } from "react";
import { pickAvatar } from "../pickAvatar";
import { uploadAvatar } from "../api/uploadAvatar";
import { updateProfile } from "../api/updateProfile";
import { deleteAvatarObject } from "../api/deleteAvatarObject";
import { Sentry } from "@/lib/sentry";

type PhotoState = { state: "idle" } | { state: "uploading" } | { state: "error" };

/** Full pick → upload → save → cleanup flow; every await checks `cancelledRef`. */
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

      setPhoto({ state: "uploading" });
      const publicUrl = await uploadAvatar(userId, picked.uri);
      if (cancelledRef.current) {
        // Already landed in Storage under a unique path — clean it up.
        await deleteAvatarObject(userId, publicUrl);
        return;
      }

      await updateProfile(userId, { avatarUrl: publicUrl });
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
