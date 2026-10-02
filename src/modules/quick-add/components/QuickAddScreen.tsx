import { useCallback, useEffect, useRef, useState } from "react";
import { AccessibilityInfo, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { goBackOrHome } from "@/lib/navigation";
import { BackChip } from "@/ui/BackChip";
import { EmptyState } from "@/ui/EmptyState";
import { GlassBackdrop } from "@/ui/GlassBackdrop";
import { Toast, useToast } from "@/ui/Toast";
import { colors, lineHeight, size, spacing, type } from "@/ui/tokens";
import { displayTitle, useOpenMovie, type Movie } from "@/modules/movies";
import type { SwipeDirection } from "../decideSwipe";
import { deckCardSize } from "../deckLayout";
import { useQuickAddDeck } from "../hooks/useQuickAddDeck";
import { useReduceMotion } from "../hooks/useReduceMotion";
import { toastTitle } from "../toastTitle";
import { DeckControls } from "./DeckControls";
import { DeckSkeleton } from "./DeckSkeleton";
import { SwipeDeck, type SwipeDeckHandle } from "./SwipeDeck";

// Shown on a right swipe or Add until the collection exists.
const COMING_SOON_MESSAGE = "Adding to your collection is coming soon.";

// Gap between the Toast's bottom edge and the top of the controls.
const TOAST_CLEARANCE = spacing[8];

type Props = { userId: string };

/** The Quick Add screen: header, the swipe deck or its state, the toast lane and the Skip / Undo / Add controls. Mount it keyed by user id. */
export function QuickAddScreen({ userId }: Props) {
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const { state, cards, finding, canUndo, returned, swipe, undo, setDragging, retry, keepLooking, startOver } = useQuickAddDeck(userId);
  const reduceMotion = useReduceMotion();
  const toast = useToast();
  const { show } = toast;
  const openMovie = useOpenMovie();
  const deckRef = useRef<SwipeDeckHandle>(null);
  const [busy, setBusy] = useState(false);
  const [areaHeight, setAreaHeight] = useState(0);
  const [controlsHeight, setControlsHeight] = useState<number>(size.deckControlsHeight);
  const top = cards[0];
  const cardSize = deckCardSize(screenWidth, areaHeight);

  // A live region present at first render is not announced on Android, so speak "Loading movies" when loading starts.
  useEffect(() => {
    if (state === "loading") AccessibilityInfo.announceForAccessibility("Loading movies");
  }, [state]);

  // After Undo: a card held during a drag says it is back (with a Toast); otherwise the undo is announced.
  const returnedSeq = returned?.seq;
  useEffect(() => {
    if (!returned) return;
    const title = displayTitle(returned.movie.title);
    if (returned.held) {
      show(`${toastTitle(title)} is back`, "info");
      AccessibilityInfo.announceForAccessibility(`${title} is back`);
    } else {
      AccessibilityInfo.announceForAccessibility(`Undid ${returned.action} for ${title}`);
    }
    // Only a new return counts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [returnedSeq]);

  // A swipe or button press committed: record it, then tell the user (a spoken line for Skip, the coming-soon Toast for Add).
  const handleSwipe = useCallback(
    (movie: Movie, direction: SwipeDirection) => {
      swipe(movie, direction);
      if (direction === "left") AccessibilityInfo.announceForAccessibility(`Skipped ${displayTitle(movie.title)}`);
      else show(COMING_SOON_MESSAGE, "coming-soon");
    },
    [swipe, show],
  );

  // The stack stays up while a card is still flying off, even if it was the last one.
  const showDeck = state === "filled" || busy;
  const title = top ? displayTitle(top.title) : undefined;

  return (
    <View style={styles.root}>
      <GlassBackdrop blobs={["purple", "gold"]} />
      <View style={{ height: insets.top + size.minTouch }}>
        <Text accessibilityRole="header" numberOfLines={1} style={[styles.title, { top: insets.top + spacing[14] }]}>
          Quick Add
        </Text>
      </View>

      <View testID="deck-area" style={styles.area} onLayout={(event) => setAreaHeight(event.nativeEvent.layout.height)}>
        {areaHeight > 0 && (
          <View style={styles.group}>
            {showDeck ? (
              <SwipeDeck
                ref={deckRef}
                cards={cards}
                returned={returned}
                cardSize={cardSize}
                reduceMotion={reduceMotion}
                onSwipe={handleSwipe}
                onOpen={(movie) => openMovie(movie.id)}
                onDragChange={setDragging}
                onBusyChange={setBusy}
              />
            ) : (
              <>
                {state === "loading" && <DeckSkeleton width={cardSize.width} height={cardSize.height} finding={finding} />}
                {state === "error" && (
                  <EmptyState icon="🦉" title="Couldn't load movies" body="Check your connection and try again." action={{ label: "Retry", onPress: retry }} />
                )}
                {state === "nextFailed" && (
                  <EmptyState icon="🦉" title="Couldn't load more movies" body="Check your connection and try again." action={{ label: "Retry", onPress: retry }} />
                )}
                {state === "keepGoing" && (
                  <EmptyState
                    icon="🔎"
                    title="Still looking"
                    body="We skipped past a lot of movies you've already seen. There may be more."
                    action={{ label: "Keep looking", onPress: keepLooking, accessibilityLabel: "Keep looking for more movies" }}
                  />
                )}
                {state === "caughtUp" && (
                  <EmptyState
                    icon="🎉"
                    title="You're all caught up"
                    body="You've been through this whole list. Start over to see the movies you skipped again."
                    action={{ label: "Start over", onPress: startOver, accessibilityLabel: "Start over and show skipped movies again" }}
                  />
                )}
              </>
            )}
          </View>
        )}
      </View>

      <View style={styles.toastLane} />
      <View style={[styles.controls, { paddingBottom: insets.bottom + size.deckControlsPad }]}>
        <DeckControls
          title={title}
          canSwipe={state === "filled" && !busy}
          canUndo={canUndo && state !== "loading" && state !== "error"}
          onSkip={() => deckRef.current?.commit("left")}
          onAdd={() => deckRef.current?.commit("right")}
          onUndo={undo}
          onHeight={setControlsHeight}
        />
      </View>

      <BackChip onPress={goBackOrHome} />
      <Toast message={toast.message} variant={toast.variant} offset={size.deckControlsPad + controlsHeight + TOAST_CLEARANCE} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg.base },
  // Title beside the back chip; the right inset keeps the top-right corner empty for the dev-client gear.
  title: {
    ...type.subhead,
    lineHeight: lineHeight.subhead,
    color: colors.brand.lavender200,
    position: "absolute",
    left: size.detailsBarTitleLeft,
    right: size.homeHeaderInset,
  },
  // The area between the header and the toast lane; the card group sits in the middle of it.
  area: { flex: 1, marginTop: spacing[8], justifyContent: "center" },
  // Card plus the room under it for the cards peeking behind.
  group: { paddingBottom: size.deckStackReserve },
  // Empty space kept for a Toast so it never covers the card or a button.
  toastLane: { height: size.deckToastLane },
  controls: { alignItems: "center" },
});
