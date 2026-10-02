import { useCallback, useEffect, useRef, useState } from "react";
import { AccessibilityInfo, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { EmptyState } from "@/ui/EmptyState";
import { GlassBackdrop } from "@/ui/GlassBackdrop";
import { Toast, useToast } from "@/ui/Toast";
import { colors, lineHeight, size, spacing, type } from "@/ui/tokens";
import { displayTitle, useOpenMovie, type Movie } from "@/modules/movies";
import type { SwipeDirection } from "../decideSwipe";
import { useQuickAddDeck } from "../hooks/useQuickAddDeck";
import { useReduceMotion } from "../hooks/useReduceMotion";
import { toastTitle } from "../toastTitle";
import { DeckControls } from "./DeckControls";
import { DeckSkeleton } from "./DeckSkeleton";
import { SwipeDeck, type SwipeDeckHandle } from "./SwipeDeck";

// Shown on a right swipe or Add until the collection exists.
const COMING_SOON_MESSAGE = "Adding to your collection is coming soon.";

// Gap between the header's bottom edge and the top Toast.
const TOAST_GAP = spacing[12];

type Props = { userId: string };

/** The Quick Add tab: a full-bleed swipe deck with the header, controls dock and Toast floating over it. Mount it keyed by user id. */
export function QuickAddScreen({ userId }: Props) {
  const insets = useSafeAreaInsets();
  const { state, cards, finding, canUndo, returned, swipe, undo, setDragging, retry, keepLooking, startOver } = useQuickAddDeck(userId);
  const reduceMotion = useReduceMotion();
  const toast = useToast();
  const { show } = toast;
  const openMovie = useOpenMovie();
  const deckRef = useRef<SwipeDeckHandle>(null);
  const [busy, setBusy] = useState(false);
  // The content area (everything above the tab bar): the card fills it.
  const [area, setArea] = useState({ width: 0, height: 0 });
  const [controlsHeight, setControlsHeight] = useState<number>(size.deckControlsHeight);
  const top = cards[0];
  // The header's bottom edge, and the dock that holds the controls (16 under them, 8 over).
  const headerBottom = insets.top + size.minTouch;
  const dockHeight = controlsHeight + size.deckControlsPad + spacing[8];

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
    <View
      testID="deck-area"
      style={styles.root}
      onLayout={(event) => setArea({ width: event.nativeEvent.layout.width, height: event.nativeEvent.layout.height })}
    >
      <GlassBackdrop blobs={["purple", "gold"]} />

      {area.height > 0 && showDeck && (
        <SwipeDeck
          ref={deckRef}
          cards={cards}
          returned={returned}
          cardSize={area}
          bottomInset={dockHeight}
          reduceMotion={reduceMotion}
          onSwipe={handleSwipe}
          onOpen={(movie) => openMovie(movie.id)}
          onDragChange={setDragging}
          onBusyChange={setBusy}
        />
      )}

      {!showDeck && state === "loading" && <DeckSkeleton bottomInset={dockHeight} finding={finding} />}
      {!showDeck && state !== "loading" && (
        <View style={[styles.stateArea, { top: headerBottom + spacing[8], bottom: dockHeight }]}>
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
        </View>
      )}

      <LinearGradient
        pointerEvents="none"
        importantForAccessibility="no"
        colors={[colors.overlay.topScrimStart, colors.overlay.topScrimStart, colors.overlay.fadeStart]}
        locations={[0, headerBottom / (headerBottom + size.deckTopScrimFade), 1]}
        style={[styles.topScrim, { height: headerBottom + size.deckTopScrimFade }]}
      />
      <Text accessibilityRole="header" numberOfLines={1} style={[styles.title, { top: insets.top + spacing[12] }]}>
        Quick Add
      </Text>

      <View style={styles.dock}>
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

      <Toast message={toast.message} variant={toast.variant} position="top" offset={headerBottom + TOAST_GAP} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg.base },
  // Fixed scrim under the header so its text reads over any poster; it does not move with the card.
  topScrim: { position: "absolute", top: 0, left: 0, right: 0 },
  // Title over the poster; the right inset keeps the top-right corner empty for the dev-client gear.
  title: {
    ...type.subhead,
    lineHeight: lineHeight.subhead,
    color: colors.text.primary,
    position: "absolute",
    left: spacing[20],
    right: size.homeHeaderInset,
  },
  // The error and empty states, centred between the header and the dock.
  stateArea: { position: "absolute", left: 0, right: 0, justifyContent: "center" },
  // Fixed bottom dock holding the controls: solid like the title band above it, so the bottom of the screen looks whole.
  dock: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    paddingTop: spacing[8],
    paddingBottom: size.deckControlsPad,
    backgroundColor: colors.overlay.cardInfo,
  },
});
