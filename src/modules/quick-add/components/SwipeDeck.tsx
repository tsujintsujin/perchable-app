import { useCallback, useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import { AccessibilityInfo, Pressable, StyleSheet, useWindowDimensions, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { Image } from "expo-image";
import Animated, {
  Easing,
  Extrapolation,
  ReduceMotion,
  interpolate,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { SwipeDeckCard } from "@/ui/SwipeDeckCard";
import { deck, motion } from "@/ui/tokens";
import { displayTitle, IMAGE_SIZE, releaseYear, tmdbImage, type Movie } from "@/modules/movies";
import { COMMIT_FRACTION, PAN_FAIL_Y, PAN_SLOP, decideSwipe, type SwipeDirection } from "../decideSwipe";
import type { ReturnedCard } from "../hooks/useQuickAddDeck";

/** Cards in the stack: the top and the next poster behind it. A card that is flying off is mounted on top of these, so three at most. */
const MOUNTED_CARDS = 2;
// How many cards past the mounted ones get their poster fetched ahead of time.
const PREFETCH_FROM = MOUNTED_CARDS;
const PREFETCH_COUNT = 2;
// Cards on top of the stack draw above the ones behind; a leaving card draws above all.
const LEAVING_Z = MOUNTED_CARDS + 1;

type CardRole = "top" | "behind" | "leaving";
type Entering = "none" | "return";

type DeckCardHandle = { commit: (direction: SwipeDirection) => void };

type DeckCardProps = {
  ref?: Ref<DeckCardHandle>;
  movie: Movie;
  role: CardRole;
  /** Position in the stack's running sequence: the stack coordinate `settle + dragP` equals the top card's rank at rest. */
  rank: number;
  /** Height of the controls dock the card's title band sits above. */
  bottomInset: number;
  /** Draw order: higher sits on top. */
  layer: number;
  width: number;
  height: number;
  screenWidth: number;
  settle: SharedValue<number>;
  dragP: SharedValue<number>;
  reduceMotion: SharedValue<boolean>;
  entering: Entering;
  focusSignal: number;
  onCommit: (direction: SwipeDirection) => void;
  /** True once the deck has recorded this card's commit. */
  isCommitted: () => boolean;
  onExitDone: () => void;
  onDragChange: (active: boolean) => void;
  onOpen: (movie: Movie) => void;
};

// One card of the stack: owns its drag values, runs its own exit and, when it is the top card, owns the pan.
function DeckCard({
  ref,
  movie,
  role,
  rank,
  bottomInset,
  layer,
  width,
  height,
  screenWidth,
  settle,
  dragP,
  reduceMotion,
  entering,
  focusSignal,
  onCommit,
  isCommitted,
  onExitDone,
  onDragChange,
  onOpen,
}: DeckCardProps) {
  const dx = useSharedValue(0);
  const dy = useSharedValue(0);
  const exiting = useSharedValue(false);
  const exitStamp = useSharedValue(0);
  const fade = useSharedValue(entering === "none" ? 1 : 0);
  const enterScale = useSharedValue(entering === "return" ? deck.returnScale : 1);
  const pressRef = useRef<View>(null);
  const exitX = width + deck.exitMargin;
  const title = displayTitle(movie.title);
  const year = releaseYear(movie.release_date);

  // A returning card fades and scales in; instantly with reduce motion.
  useEffect(() => {
    if (entering === "none") return;
    if (reduceMotion.get()) {
      fade.set(1);
      enterScale.set(1);
      return;
    }
    const duration = motion.deckExit;
    fade.set(withTiming(1, { duration, easing: Easing.out(Easing.quad), reduceMotion: ReduceMotion.Never }));
    enterScale.set(withTiming(1, { duration, easing: Easing.out(Easing.quad), reduceMotion: ReduceMotion.Never }));
  }, [entering, reduceMotion, fade, enterScale]);

  // Moves screen-reader focus to this card when it becomes the top card after a swipe or a return.
  useEffect(() => {
    if (role === "top" && focusSignal > 0 && pressRef.current) AccessibilityInfo.sendAccessibilityEvent(pressRef.current, "focus");
  }, [role, focusSignal]);

  const startedRef = useRef(false);

  // Sends the card off (a swipe or a button): flies out in 200 ms, or fades in place with reduce motion; the stack moves up meanwhile.
  const runExit = (direction: SwipeDirection) => {
    "worklet";
    exiting.set(true);
    const sign = direction === "right" ? 1 : -1;
    const stack = settle.get() + dragP.get();
    dragP.set(0);
    if (reduceMotion.get()) {
      exitStamp.set(sign);
      settle.set(rank + 1);
      fade.set(
        withTiming(0, { duration: motion.deckFade, easing: Easing.out(Easing.quad), reduceMotion: ReduceMotion.Never }, (finished) => {
          if (finished) scheduleOnRN(onExitDone);
        }),
      );
    } else {
      const timing = { duration: motion.deckExit, easing: Easing.out(Easing.quad), reduceMotion: ReduceMotion.Never };
      exitStamp.set(withTiming(sign, { duration: motion.deckExit, easing: Easing.linear, reduceMotion: ReduceMotion.Never }));
      // Re-seat the stack at the dragged position, then carry it to the next card's slot in step with the exit.
      settle.set(stack);
      settle.set(withTiming(rank + 1, timing));
      dx.set(
        withTiming(sign * exitX, timing, (finished) => {
          if (finished) scheduleOnRN(onExitDone);
        }),
      );
    }
    scheduleOnRN(onCommit, direction);
  };

  // Returns an unfinished drag to the centre: a spring, or a short ease with reduce motion.
  const springBack = () => {
    "worklet";
    if (reduceMotion.get()) {
      const ease = { duration: motion.deckFade, easing: Easing.out(Easing.quad), reduceMotion: ReduceMotion.Never };
      dx.set(withTiming(0, ease));
      dy.set(withTiming(0, ease));
      dragP.set(withTiming(0, ease));
      return;
    }
    const spring = { ...motion.deckSpring, reduceMotion: ReduceMotion.Never };
    dx.set(withSpring(0, spring));
    dy.set(withSpring(0, spring));
    dragP.set(withSpring(0, spring));
  };

  // Buttons and screen-reader actions: one exit per card, however fast they arrive. A ref, not only the shared value: the JS
  // thread can read the shared value stale for a frame, and a second exit would advance the stack twice.
  const commitFromJs = (direction: SwipeDirection) => {
    // A pan release that already started this card's exit counts too: its shared value covers the frame before the pan's own
    // message reaches the deck (`isCommitted`).
    if (startedRef.current || exiting.get() || isCommitted()) return;
    startedRef.current = true;
    runExit(direction);
  };
  useImperativeHandle(ref, () => ({ commit: commitFromJs }));

  // Where the finger came down, to tell a tap from a drag the pan did not claim.
  const pressStartRef = useRef<{ x: number; y: number } | null>(null);

  // The drag: the card follows the finger; a release commits by distance or flick, anything else (or a cancel) springs back.
  const pan = Gesture.Pan()
    .withTestId(`deck-pan-${movie.id}`)
    .enabled(role === "top")
    .maxPointers(1)
    .activeOffsetX([-PAN_SLOP, PAN_SLOP])
    .failOffsetY([-PAN_FAIL_Y, PAN_FAIL_Y])
    .onStart(() => {
      scheduleOnRN(onDragChange, true);
    })
    .onUpdate((event) => {
      if (exiting.get()) return;
      dx.set(event.translationX);
      dy.set(Math.min(Math.max(event.translationY * deck.followY, -deck.followYMax), deck.followYMax));
      dragP.set(reduceMotion.get() ? 0 : Math.min(Math.abs(event.translationX) / (COMMIT_FRACTION * screenWidth), 1));
    })
    .onEnd((event, success) => {
      if (exiting.get()) return;
      const direction = success ? decideSwipe(event.translationX, event.velocityX, screenWidth) : null;
      if (direction) runExit(direction);
      else springBack();
    })
    .onFinalize(() => {
      scheduleOnRN(onDragChange, false);
    });

  const dim = useDerivedValue(() => Math.min(Math.max(rank - (settle.get() + dragP.get()), 0), 1));

  // Stack position, drag and tilt: the stack coordinate puts the card between its slot and the one in front of it.
  const animatedStyle = useAnimatedStyle(() => {
    const position = Math.max(rank - (settle.get() + dragP.get()), 0);
    const stackScale = interpolate(position, [0, 1], deck.stackScale, Extrapolation.CLAMP);
    const x = dx.get();
    const tilt = reduceMotion.get() ? 0 : Math.min(Math.max(x / (deck.tiltFullFraction * screenWidth), -1), 1) * deck.tiltMaxDeg;
    return {
      opacity: fade.get(),
      transform: [{ translateX: x }, { translateY: dy.get() }, { rotate: `${tilt}deg` }, { scale: stackScale * enterScale.get() }],
    };
  });

  const hidden = role !== "top";
  return (
    <Animated.View
      testID={`deck-card-${movie.id}`}
      pointerEvents={hidden ? "none" : "auto"}
      importantForAccessibility={hidden ? "no-hide-descendants" : "auto"}
      accessibilityElementsHidden={hidden}
      style={[styles.card, { width, height, zIndex: layer }, animatedStyle]}
    >
      <GestureDetector gesture={pan}>
        <Animated.View collapsable={false} style={styles.fill}>
          <Pressable
            ref={pressRef}
            onPressIn={(event) => {
              pressStartRef.current = { x: event.nativeEvent.pageX, y: event.nativeEvent.pageY };
            }}
            onPressOut={() => {
              // A press the pan claimed ends here with no onPress; clear its start once onPress (which follows at once) has read it.
              queueMicrotask(() => {
                pressStartRef.current = null;
              });
            }}
            onPress={(event) => {
              // A touch that travelled past the pan slop is a drag, never a tap (a screen reader's click carries no position).
              const start = pressStartRef.current;
              pressStartRef.current = null;
              const { pageX, pageY } = event.nativeEvent;
              if (start && typeof pageX === "number" && Math.hypot(pageX - start.x, pageY - start.y) > PAN_SLOP) return;
              onOpen(movie);
            }}
            accessibilityRole="button"
            accessibilityLabel={year ? `${title}, ${year}` : title}
            accessibilityHint="Opens details"
            accessibilityActions={[
              { name: "openDetails", label: "Open details" },
              { name: "skip", label: "Skip" },
              { name: "add", label: "Add" },
            ]}
            onAccessibilityAction={(event) => {
              const action = event.nativeEvent.actionName;
              if (action === "openDetails") onOpen(movie);
              else if (action === "skip") commitFromJs("left");
              else if (action === "add") commitFromJs("right");
            }}
            style={({ pressed }) => [styles.fill, pressed && styles.pressed]}
          >
            <SwipeDeckCard
              posterUrl={tmdbImage(movie.poster_path, IMAGE_SIZE.deck)}
              title={title}
              year={year}
              rating={movie.vote_average}
              bottomInset={bottomInset}
              dragX={dx}
              dim={dim}
              exitStamp={exitStamp}
            />
          </Pressable>
        </Animated.View>
      </GestureDetector>
    </Animated.View>
  );
}

export type SwipeDeckHandle = { commit: (direction: SwipeDirection) => void };

type Props = {
  ref?: Ref<SwipeDeckHandle>;
  /** The usable cards, top first. */
  cards: Movie[];
  /** The newest card that came back after Undo. */
  returned: ReturnedCard | null;
  cardSize: { width: number; height: number };
  /** Height of the controls dock the title band sits above. */
  bottomInset: number;
  reduceMotion: SharedValue<boolean>;
  onSwipe: (movie: Movie, direction: SwipeDirection) => void;
  onOpen: (movie: Movie) => void;
  /** True while a finger is dragging the top card. */
  onDragChange: (active: boolean) => void;
  /** True while a card is flying off, so the buttons stay disabled. */
  onBusyChange: (busy: boolean) => void;
};

type Leaving = { movie: Movie; rank: number; key: string };

/** The stack of swipe cards: the top (draggable) and the next mounted, plus a leaving card animating in its own layer. */
export function SwipeDeck({ ref, cards, returned, cardSize, bottomInset, reduceMotion, onSwipe, onOpen, onDragChange, onBusyChange }: Props) {
  const { width: screenWidth } = useWindowDimensions();
  // Stack coordinate at rest (`settle`) and the extra a drag adds (`dragP`); a card shows at slot `rank - (settle + dragP)`.
  const settle = useSharedValue(0);
  const dragP = useSharedValue(0);
  // Counts committed swipes so a card keeps its rank when the list shifts under it.
  const [base, setBase] = useState(0);
  const [leaving, setLeaving] = useState<Leaving[]>([]);
  const [focusSignal, setFocusSignal] = useState(0);
  // Returned cards get a new key so a card still flying off under its old key is never reused.
  const [epochs, setEpochs] = useState<Record<number, number>>({});
  const [seenReturn, setSeenReturn] = useState(returned?.seq ?? 0);
  const topRef = useRef<DeckCardHandle>(null);
  // Keys of the cards already committed.
  const committedRef = useRef(new Set<string>());

  // A returned card takes the top slot: the rest of the stack steps back one place and screen-reader focus moves to it.
  if (returned && returned.seq !== seenReturn) {
    setSeenReturn(returned.seq);
    setBase((current) => current - 1);
    setFocusSignal((current) => current + 1);
    setEpochs((current) => ({ ...current, [returned.movie.id]: returned.seq }));
    setLeaving((current) => current.filter((card) => card.movie.id !== returned.movie.id));
  }

  // Moves the stack coordinate back with the rank base when a card returns.
  useEffect(() => {
    if (returned) settle.set(settle.get() - 1);
    // Only a new return counts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [returned?.seq]);

  // Tells the screen whether a card is still flying off.
  const busy = leaving.length > 0;
  useEffect(() => {
    onBusyChange(busy);
  }, [busy, onBusyChange]);

  // Fetches the posters just past the mounted cards so a fast run of swipes never meets a blank card.
  const prefetchKey = cards
    .slice(PREFETCH_FROM, PREFETCH_FROM + PREFETCH_COUNT)
    .map((movie) => tmdbImage(movie.poster_path, IMAGE_SIZE.deck))
    .filter((url): url is string => url !== null)
    .join("|");
  useEffect(() => {
    if (prefetchKey) void Image.prefetch(prefetchKey.split("|"), "memory-disk").catch(() => {});
  }, [prefetchKey]);

  const keyOf = (movie: Movie) => `${movie.id}:${epochs[movie.id] ?? 0}`;

  // A card was committed: it becomes the one leaving card (any earlier one is gone), the rank base advances and the swipe is recorded.
  const handleCommit = useCallback(
    (movie: Movie, rank: number, key: string, direction: SwipeDirection) => {
      // A card commits once: a repeat for the same card must not advance the rank base or record the swipe again.
      if (committedRef.current.has(key)) return;
      committedRef.current.add(key);
      setLeaving([{ movie, rank, key }]);
      setBase((current) => current + 1);
      setFocusSignal((current) => current + 1);
      onSwipe(movie, direction);
    },
    [onSwipe],
  );

  // Buttons and screen-reader actions send the top card off the same way a swipe does.
  useImperativeHandle(ref, () => ({ commit: (direction) => topRef.current?.commit(direction) }));

  // One list for the stack and the leaving card: a card keeps its key (and its running animation) when it changes role.
  const items = [
    ...cards.slice(0, MOUNTED_CARDS).map((movie, index) => ({
      key: keyOf(movie),
      movie,
      role: (index === 0 ? "top" : "behind") as CardRole,
      rank: base + index,
      layer: MOUNTED_CARDS - index,
      entering: (index === 0 && returned?.movie.id === movie.id ? "return" : "none") as Entering,
    })),
    ...leaving.map((card) => ({ key: card.key, movie: card.movie, role: "leaving" as CardRole, rank: card.rank, layer: LEAVING_Z, entering: "none" as Entering })),
  ];

  return (
    // collapsable off: a flattened box would hand the cards' zIndex to the screen and draw them over the dock and header.
    <View collapsable={false} style={[styles.stack, { width: cardSize.width, height: cardSize.height }]}>
      {items.map((item) => (
        <DeckCard
          key={item.key}
          ref={item.role === "top" ? topRef : undefined}
          movie={item.movie}
          role={item.role}
          rank={item.rank}
          bottomInset={bottomInset}
          layer={item.layer}
          entering={item.entering}
          width={cardSize.width}
          height={cardSize.height}
          screenWidth={screenWidth}
          settle={settle}
          dragP={dragP}
          reduceMotion={reduceMotion}
          focusSignal={focusSignal}
          onCommit={(direction) => handleCommit(item.movie, item.rank, item.key, direction)}
          isCommitted={() => committedRef.current.has(item.key)}
          onExitDone={() => setLeaving((current) => current.filter((card) => card.key !== item.key))}
          onDragChange={onDragChange}
          onOpen={onOpen}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  // The card stack's own box (the whole content area): cards are absolutely placed inside it.
  stack: {},
  // Tilts about the bottom centre, so the top of a full-height card swings instead of its middle.
  card: { position: "absolute", top: 0, left: 0, transformOrigin: "50% 100%" },
  fill: { flex: 1 },
  pressed: { transform: [{ scale: motion.pressScale }] },
});
