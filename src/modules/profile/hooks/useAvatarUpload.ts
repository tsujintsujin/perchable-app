import { useEffect, useRef, useState } from "react";
import { pickAvatarAsset, prepareAvatar } from "../pickAvatar";
import { uploadAvatar } from "../api/uploadAvatar";
import { updateProfile } from "../api/updateProfile";
import { deleteAvatarObject } from "../api/deleteAvatarObject";
import { Sentry } from "@/lib/sentry";
import { RequestTimeoutError } from "@/lib/requestTimeout";

type PhotoState = { state: "idle" } | { state: "uploading" } | { state: "error" };

/** Full pick → resize → upload → save → cleanup flow; every await checks whether this run went stale. */
export function useAvatarUpload(userId: string | undefined, initialAvatarUrl: string | null | undefined) {
  const [avatarUrlOverride, setAvatarUrlOverride] = useState<string | null | undefined>(undefined);
  const [photo, setPhoto] = useState<PhotoState>({ state: "idle" });
  // Bumped by cancel() and by each new run, so an older run can tell it was superseded.
  const runRef = useRef(0);
  // Ref, not state: read inside async code to avoid setState after unmount.
  const mountedRef = useRef(true);
  // Ref, not state: blocks a second tap before React re-renders with isUploading.
  const inFlightRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const avatarUrl = avatarUrlOverride !== undefined ? avatarUrlOverride : initialAvatarUrl;
  const isUploading = photo.state === "uploading";

  // Invalidates the in-flight run and frees the busy state if the screen is still open.
  const cancel = () => {
    runRef.current += 1;
    if (mountedRef.current) setPhoto({ state: "idle" });
  };

  const pickAndUpload = async () => {
    if (inFlightRef.current || !userId) return;
    inFlightRef.current = true;
    const run = ++runRef.current;
    const isStale = () => runRef.current !== run || !mountedRef.current;
    // What this attempt would replace, captured now.
    const previousAvatarUrl = avatarUrl;
    // Busy before the picker opens: Android closes the crop screen slightly before the promise resolves.
    setPhoto({ state: "uploading" });
    try {
      const asset = await pickAvatarAsset();
      if (isStale()) return;
      if (!asset) {
        // Picker cancelled — not an error.
        setPhoto({ state: "idle" });
        return;
      }

      const prepared = await prepareAvatar(asset.uri);
      if (isStale()) return;
      const publicUrl = await uploadAvatar(userId, prepared.uri);
      if (isStale()) {
        // Already landed in Storage under a unique path — clean it up.
        await deleteAvatarObject(userId, publicUrl);
        return;
      }

      await updateProfile(userId, { avatarUrl: publicUrl });
      if (!isStale()) {
        setAvatarUrlOverride(publicUrl);
        setPhoto({ state: "idle" });
      }
      // The DB now points at the new photo even if the screen went away, so the old one is always superseded.
      if (previousAvatarUrl) {
        await deleteAvatarObject(userId, previousAvatarUrl);
      }
    } catch (err) {
      if (isStale()) return;
      // A timeout waiting for auth is expected offline, so only other failures are reported.
      if (!(err instanceof RequestTimeoutError)) Sentry.captureException(err);
      setPhoto({ state: "error" });
    } finally {
      inFlightRef.current = false;
    }
  };

  return { avatarUrl, photo, isUploading, pickAndUpload, cancel };
}
