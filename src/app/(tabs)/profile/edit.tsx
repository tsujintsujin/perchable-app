import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { GlassBackdrop } from "@/ui/GlassBackdrop";
import { Avatar } from "@/ui/Avatar";
import { Button } from "@/ui/Button";
import { ErrorCard } from "@/ui/ErrorCard";
import { Spinner } from "@/ui/Spinner";
import { colors, iconSize, radius, size, spacing, type } from "@/ui/tokens";
import { updateProfile, useAvatarUpload, useOwnProfile, useUsertagAvailability } from "@/modules/profile";
import { Sentry } from "@/lib/sentry";

/** Edit profile screen — a picked photo saves on pick, independent of Save. */
export default function EditProfile() {
  const profile = useOwnProfile();
  const loaded = profile.state === "loaded" ? profile.profile : undefined;
  const insets = useSafeAreaInsets();
  // `focus=usertag` (sent by the profile chip) raises the keyboard on the usertag field.
  const { focus } = useLocalSearchParams<{ focus?: string }>();
  const avatarUpload = useAvatarUpload(loaded?.id, loaded?.avatarUrl);

  // `undefined` means "not yet touched" — the TextInput below falls back to
  // the loaded profile's own value instead, so no copy-into-state effect.
  const [usertagOverride, setUsertagOverride] = useState<string | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const usertagInput = usertagOverride !== undefined ? usertagOverride : (loaded?.usertag ?? "");
  const availability = useUsertagAvailability(usertagInput, loaded?.usertag ?? null, loaded?.id);

  if (profile.state !== "loaded" || !loaded) {
    // Reached only from the already-loaded Profile screen in practice —
    // minimal defensive fallback, not a designed state.
    return <View style={styles.root} />;
  }

  const isUploading = avatarUpload.isUploading;

  // Also the header back arrow's handler — both leave the screen the same
  // way, and both must stop an in-flight upload's result from applying.
  const handleCancel = () => {
    avatarUpload.cancel();
    router.back();
  };

  const handleUsertagChange = (text: string) => {
    // DESIGN.md: stored/compared lowercase, never a leading "@" (that's
    // display-only formatting the "@" prefix glyph below already provides).
    setUsertagOverride(text.toLowerCase().replace(/^@+/, ""));
    setSaveError(null);
  };

  // Disabled while uploading so a usertag save can't race an in-flight
  // photo upload. Cancel stays tappable during upload but not during save.
  const canSave = availability.status === "available" && !saving && !isUploading;

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

  const isTaken = availability.status === "taken" || saveError !== null;

  return (
    <View style={styles.root}>
      <GlassBackdrop blobs={["purple"]} opacity={0.2} />
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <Pressable onPress={handleCancel} accessibilityRole="button" accessibilityLabel="Back">
          <Text style={styles.backArrow}>←</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Edit profile</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.body}>
        <Pressable
          onPress={avatarUpload.pickAndUpload}
          accessibilityRole="button"
          accessibilityLabel="Change photo"
          style={[styles.avatarWrap, isUploading && styles.dimmed]}
        >
          <Avatar uri={avatarUpload.avatarUrl} name={loaded.displayName} size="lg" />
          {isUploading ? (
            <View style={styles.spinnerOverlay}>
              <Spinner diameter={size.spinnerLg} stroke={size.spinnerStrokeLg} trackColor={colors.border.hairline} />
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

        {avatarUpload.photo.state === "error" && (
          <ErrorCard
            message="⚠ Photo upload failed. Your old photo is unchanged — tap the photo to try again."
            style={styles.errorCard}
            textStyle={styles.errorText}
          />
        )}

        <Text style={[styles.usertagLabel, (saving || isUploading) && styles.dimmedText]}>USERTAG</Text>
        <View
          style={[
            styles.usertagRow,
            isTaken && styles.usertagRowError,
            (saving || isUploading) && styles.dimmed,
          ]}
        >
          <Text style={styles.usertagPrefix}>@</Text>
          <TextInput
            value={usertagInput}
            onChangeText={handleUsertagChange}
            editable={!saving && !isUploading}
            autoFocus={focus === "usertag"}
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
            onPress={handleCancel}
            disabled={saving}
            style={styles.buttonHalf}
          />
          <Button
            label="Save"
            loadingLabel="Saving"
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

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg.base },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing[20],
  },
  backArrow: { fontSize: iconSize.lg, color: colors.text.primary },
  headerTitle: { ...type.subhead, color: colors.text.primary },
  headerSpacer: { width: iconSize.lg },
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
  cameraIcon: { fontSize: iconSize.sm },
  spinnerOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  photoCaption: {
    marginTop: spacing[12],
    ...type.small,
    color: colors.text.secondary,
  },
  errorCard: {
    marginTop: spacing[16],
    width: "100%",
  },
  errorText: {
    ...type.label,
    lineHeight: 20,
  },
  usertagLabel: {
    alignSelf: "flex-start",
    marginTop: spacing[32],
    ...type.caption,
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
    backgroundColor: colors.surface.input,
    borderWidth: 1,
    borderColor: colors.border.hairline,
    paddingHorizontal: spacing[16],
    height: 48,
  },
  usertagRowError: { borderColor: colors.border.dangerStrong },
  usertagPrefix: {
    ...type.bodyStrong,
    color: colors.accent.gold,
    marginRight: spacing[4],
  },
  usertagInput: {
    flex: 1,
    ...type.body,
    color: colors.text.primary,
    height: 48,
  },
  helper: {
    alignSelf: "flex-start",
    marginTop: spacing[8],
    ...type.small,
    color: colors.text.disabled,
  },
  errorHelper: {
    alignSelf: "flex-start",
    marginTop: spacing[8],
    ...type.small,
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
