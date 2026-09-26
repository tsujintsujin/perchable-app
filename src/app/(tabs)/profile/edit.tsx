import { useEffect, useState } from "react";
import { Animated, Easing, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { GlassBackdrop } from "@/ui/GlassBackdrop";
import { Avatar } from "@/ui/Avatar";
import { Button } from "@/ui/Button";
import { colors, radius, spacing } from "@/ui/tokens";
import {
  pickAvatar,
  updateProfile,
  uploadAvatar,
  useOwnProfile,
  useUsertagAvailability,
} from "@/modules/profile";
import { Sentry } from "@/lib/sentry";

type PhotoState = { state: "idle" } | { state: "uploading" } | { state: "error" };

/**
 * (tabs)/profile/edit — DESIGN.md "Build 7 — Edit profile screen".
 *
 * ⚠️ Big decision (deviation from a literal reading of the spec): a picked
 * photo uploads and saves to `profiles.avatar_url` immediately on pick, not
 * gated behind the Save button. DESIGN.md's states already describe the
 * photo and usertag as "independent fields with independent save
 * outcomes" and the uploading state as its own thing driven purely by the
 * pick — Save/Cancel below govern the usertag field only. This avoids a
 * confusing dual-purpose Save button (what would "Save" even mean once a
 * photo already finished uploading?) and matches how every other screen in
 * this app treats a Supabase write as soon as its own action completes.
 */
export default function EditProfile() {
  const profile = useOwnProfile();
  const loaded = profile.state === "loaded" ? profile.profile : undefined;

  // `undefined` means "not yet touched by the user" — the TextInput/Avatar
  // below fall back to the loaded profile's own value for that case, so
  // there's no need for an effect to copy the loaded value into state once
  // it arrives (which would just be a same-render echo — React 19's
  // compiler flags synchronous setState-in-effect for exactly this
  // anti-pattern).
  const [avatarUrlOverride, setAvatarUrlOverride] = useState<string | null | undefined>(undefined);
  const [photo, setPhoto] = useState<PhotoState>({ state: "idle" });
  const [usertagOverride, setUsertagOverride] = useState<string | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const avatarUrl = avatarUrlOverride !== undefined ? avatarUrlOverride : loaded?.avatarUrl;
  const usertagInput = usertagOverride !== undefined ? usertagOverride : (loaded?.usertag ?? "");

  const availability = useUsertagAvailability(usertagInput, loaded?.usertag ?? null, loaded?.id);

  if (profile.state !== "loaded" || !loaded) {
    // Reached only from the already-loaded Profile screen in practice — no
    // separate loading/error shimmer spec exists for this screen in
    // DESIGN.md's Build 7 section, so this is a minimal defensive fallback,
    // not a designed state.
    return <View style={styles.root} />;
  }

  const handlePickPhoto = async () => {
    if (photo.state === "uploading") return;
    try {
      const picked = await pickAvatar();
      if (!picked) return; // cancelled or permission denied — not an error
      setPhoto({ state: "uploading" });
      const publicUrl = await uploadAvatar(loaded.id, picked.uri);
      await updateProfile(loaded.id, { avatarUrl: publicUrl });
      setAvatarUrlOverride(publicUrl);
      setPhoto({ state: "idle" });
    } catch (err) {
      Sentry.captureException(err);
      setPhoto({ state: "error" });
    }
  };

  const handleUsertagChange = (text: string) => {
    // DESIGN.md: stored/compared lowercase, never a leading "@" (that's
    // display-only formatting the "@" prefix glyph below already provides).
    setUsertagOverride(text.toLowerCase().replace(/^@+/, ""));
    setSaveError(null);
  };

  const canSave = availability.status === "available" && !saving;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    setSaveError(null);
    try {
      await updateProfile(loaded.id, { usertag: usertagInput });
      router.back();
    } catch (err) {
      const pgError = err as { code?: string };
      if (pgError.code === "23505") {
        // The live check missed a race — DB is the source of truth.
        setSaveError("That usertag is already taken.");
      } else {
        Sentry.captureException(err);
        setSaveError("Couldn't save. Check your connection and try again.");
      }
      setSaving(false);
    }
  };

  const isUploading = photo.state === "uploading";
  const isTaken = availability.status === "taken" || saveError !== null;

  return (
    <View style={styles.root}>
      <GlassBackdrop blobs={["purple"]} opacity={0.2} />
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Back">
          <Text style={styles.backArrow}>←</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Edit profile</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.body}>
        <Pressable
          onPress={handlePickPhoto}
          accessibilityRole="button"
          accessibilityLabel="Change photo"
          style={[styles.avatarWrap, isUploading && styles.dimmed]}
        >
          <Avatar uri={avatarUrl} name={loaded.displayName} size="lg" />
          {isUploading ? (
            <View style={styles.spinnerOverlay}>
              <Spinner />
            </View>
          ) : (
            <View style={styles.cameraBadge}>
              <Text style={styles.cameraIcon}>📷</Text>
            </View>
          )}
        </Pressable>
        <Text style={styles.photoCaption}>
          {isUploading ? "Uploading photo…" : "Tap to change photo"}
        </Text>

        {photo.state === "error" && (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>
              ⚠ Photo upload failed. Your old photo is unchanged — tap the photo to try again.
            </Text>
          </View>
        )}

        <Text style={[styles.usertagLabel, saving && styles.dimmedText]}>USERTAG</Text>
        <View style={[styles.usertagRow, isTaken && styles.usertagRowError, saving && styles.dimmed]}>
          <Text style={styles.usertagPrefix}>@</Text>
          <TextInput
            value={usertagInput}
            onChangeText={handleUsertagChange}
            editable={!saving}
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.usertagInput}
            placeholder="usertag"
            placeholderTextColor={colors.text.disabled}
          />
        </View>
        {isTaken ? (
          <Text style={styles.errorHelper}>
            {saveError ?? "That usertag is already taken."}
          </Text>
        ) : (
          <Text style={styles.helper}>
            3–20 characters · lowercase letters, numbers, underscore · must start with a letter
          </Text>
        )}

        <View style={styles.buttonRow}>
          <Button
            label="Cancel"
            variant="secondary-glass"
            onPress={() => router.back()}
            disabled={saving}
            style={styles.buttonHalf}
          />
          <Button
            label="Save"
            variant="primary-gold"
            onPress={handleSave}
            disabled={!canSave}
            loading={saving}
            style={styles.buttonHalf}
          />
        </View>
      </View>
    </View>
  );
}

/** Indeterminate spinner in the progress ring's slot — Manager's decision:
 * no XHR bypass of supabase-js just to get a real determinate percentage
 * for a ≤512px JPEG that finishes in about a second. Deviates from
 * DESIGN.md's "determinate progress ring" spec; see the build log. */
function Spinner() {
  const [spin] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const animation = Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 800, easing: Easing.linear, useNativeDriver: true }),
    );
    animation.start();
    return () => animation.stop();
  }, [spin]);
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  return <Animated.View style={[styles.progressRing, { transform: [{ rotate }] }]} />;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg.base },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 56,
    paddingHorizontal: spacing[20],
  },
  backArrow: { fontSize: 22, color: colors.text.primary },
  headerTitle: { fontFamily: "Poppins_700Bold", fontSize: 19, color: colors.text.primary },
  headerSpacer: { width: 22 },
  body: { flex: 1, alignItems: "center", paddingTop: spacing[32], paddingHorizontal: spacing[20] },
  avatarWrap: { position: "relative" },
  dimmed: { opacity: 0.5 },
  dimmedText: { opacity: 0.5 },
  cameraBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.accent.gold,
    borderWidth: 2,
    borderColor: colors.bg.base,
    alignItems: "center",
    justifyContent: "center",
  },
  cameraIcon: { fontSize: 13 },
  spinnerOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  progressRing: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 3,
    borderColor: colors.border.hairline,
    borderTopColor: colors.accent.gold,
  },
  photoCaption: {
    marginTop: spacing[12],
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: colors.text.secondary,
  },
  errorCard: {
    marginTop: spacing[16],
    padding: spacing[16],
    borderRadius: radius.md,
    backgroundColor: "rgba(76,29,149,0.28)",
    borderWidth: 1,
    borderColor: "rgba(255,138,138,0.35)",
    width: "100%",
  },
  errorText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    lineHeight: 20,
    color: colors.danger,
  },
  usertagLabel: {
    alignSelf: "flex-start",
    marginTop: spacing[32],
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    letterSpacing: 1,
    color: colors.text.secondary,
    textTransform: "uppercase",
  },
  usertagRow: {
    marginTop: spacing[8],
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    borderRadius: radius.md,
    backgroundColor: "rgba(76,29,149,0.28)",
    borderWidth: 1,
    borderColor: colors.border.hairline,
    paddingHorizontal: spacing[16],
    height: 48,
  },
  usertagRowError: { borderColor: "rgba(255,138,138,0.5)" },
  usertagPrefix: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: colors.accent.gold,
    marginRight: 4,
  },
  usertagInput: {
    flex: 1,
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    color: colors.text.primary,
    height: 48,
  },
  helper: {
    alignSelf: "flex-start",
    marginTop: spacing[8],
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: colors.text.disabled,
  },
  errorHelper: {
    alignSelf: "flex-start",
    marginTop: spacing[8],
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: colors.danger,
  },
  buttonRow: {
    flexDirection: "row",
    gap: spacing[12],
    marginTop: spacing[32],
    width: "100%",
  },
  buttonHalf: { flex: 1 },
});
