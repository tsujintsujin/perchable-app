import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { supabase } from "@/lib/supabase";
import { useAuthSession } from "@/modules/auth";
import { colors, size, spacing, type } from "@/ui/tokens";
import type { ReportTargetType } from "../types";
import { BlockUserSheet } from "./BlockUserSheet";
import { ReportSheet } from "./ReportSheet";

/** Dev-only. Loaded from the debug screen behind `__DEV__`, never exported from the module index,
 * so release bundles leave it out. It is not part of the product. */

type Person = { id: string; displayName: string | null; usertag: string | null };
type Sheet = { kind: "report"; type: ReportTargetType; targetId: string } | { kind: "block" } | null;

/** How many other profiles the picker lists. */
const PICKER_LIMIT = 10;

const REPORT_BUTTONS: { type: ReportTargetType; label: string }[] = [
  { type: "profile", label: "Report profile" },
  { type: "comment", label: "Report comment (random id)" },
  { type: "dm_message", label: "Report DM message (random id)" },
  { type: "collection_item", label: "Report caption (random id)" },
];

/** A random v4 uuid, standing in for ids that have no FK (comment, message, caption) or for a user that does not exist. */
function randomUuid() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = crypto.getRandomValues(new Uint8Array(1))[0] % 16;
    return (c === "x" ? r : (r % 4) + 8).toString(16);
  });
}

/** Lets a tester pick another profile and open the report and block sheets against it. */
export function ModerationDevHarness() {
  const { session } = useAuthSession();
  const myId = session?.user.id;
  const [people, setPeople] = useState<Person[] | null>(null);
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [result, setResult] = useState("—");
  // With nobody else to pick, sheets target a made-up user id: they open, but a submit fails in the DB.
  const [stubId] = useState(randomUuid);

  // Loads up to PICKER_LIMIT other profiles once the session is known.
  useEffect(() => {
    if (!myId) return;
    let cancelled = false;
    supabase
      .from("profiles")
      .select("id, display_name, usertag")
      .neq("id", myId)
      .limit(PICKER_LIMIT)
      .then(({ data }) => {
        if (cancelled) return;
        const list = (data ?? []).map((p) => ({ id: p.id, displayName: p.display_name, usertag: p.usertag }));
        setPeople(list);
        setPickedId((current) => current ?? list[0]?.id ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [myId]);

  const picked = people?.find((p) => p.id === pickedId);
  const ownerId = picked?.id ?? stubId;
  const closeSheet = () => setSheet(null);

  return (
    <View style={styles.box}>
      <Text style={styles.heading}>Moderation dev harness</Text>
      {!myId && <Text style={styles.text}>Sign in first.</Text>}
      {myId && people === null && <Text style={styles.text}>Loading profiles…</Text>}
      {people !== null && people.length === 0 && (
        <Text style={styles.text}>
          No other profiles yet. Sheets use a made-up user id: they open, but sending fails.
        </Text>
      )}
      {people?.map((p) => (
        <Pressable
          key={p.id}
          accessibilityRole="radio"
          accessibilityLabel={`${p.displayName ?? "Perchable user"} @${p.usertag ?? ""}`}
          accessibilityState={{ selected: p.id === pickedId }}
          onPress={() => setPickedId(p.id)}
          style={styles.button}
        >
          <Text style={styles.text}>
            {p.id === pickedId ? "(•) " : "( ) "}
            {p.displayName ?? "Perchable user"} @{p.usertag ?? "—"}
          </Text>
        </Pressable>
      ))}

      {REPORT_BUTTONS.map((b) => (
        <Pressable
          key={b.type}
          accessibilityRole="button"
          accessibilityLabel={b.label}
          onPress={() => setSheet({ kind: "report", type: b.type, targetId: b.type === "profile" ? ownerId : randomUuid() })}
          style={styles.button}
        >
          <Text style={styles.text}>{b.label}</Text>
        </Pressable>
      ))}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Block user"
        onPress={() => setSheet({ kind: "block" })}
        style={styles.button}
      >
        <Text style={styles.text}>Block user</Text>
      </Pressable>
      <Text style={styles.text}>Result: {result}</Text>

      {sheet?.kind === "report" && (
        <ReportSheet
          target={{ type: sheet.type, id: sheet.targetId, ownerId }}
          onClose={closeSheet}
          onReported={() => setResult("reported")}
        />
      )}
      {sheet?.kind === "block" && (
        <BlockUserSheet
          userId={ownerId}
          displayName={picked?.displayName ?? undefined}
          onClose={closeSheet}
          onBlocked={() => setResult("blocked")}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // Plain monospace section; every control is at least the minimum touch height.
  box: { alignSelf: "stretch", gap: spacing[8], padding: spacing[12], backgroundColor: colors.bg.base },
  heading: { ...type.mono, color: colors.text.primary },
  text: { ...type.mono, color: colors.text.secondary },
  button: {
    minHeight: size.minTouch,
    justifyContent: "center",
    paddingHorizontal: spacing[12],
    backgroundColor: colors.bg.elevatedFlat,
  },
});
