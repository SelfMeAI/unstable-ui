import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  View
} from "react-native";
import type {
  RendererScreenTransitionEvent,
  RendererTransitionHooks
} from "@selfme/unstable-ui-renderer";
import type { ScreenMode } from "@selfme/unstable-ui-protocol";

type DemoTransitionPhase = "idle" | "disassembling" | "assembling";
type DemoTransitionVariant = "processing" | "finalizing" | "settling";

interface DemoTransitionState {
  phase: DemoTransitionPhase;
  variant?: DemoTransitionVariant;
  requestId?: string;
  token: number;
  title: string;
  detail: string;
}

interface DemoTransitionCopy {
  eyebrow: string;
  title: string;
  detail: string;
}

interface DemoTransitionConfig {
  content: {
    disassembleOpacityDuration: number;
    disassembleScaleDuration: number;
    disassembleTranslateDuration: number;
    revealDelay: number;
    revealOpacityDuration: number;
    revealScaleDuration: number;
    revealTranslateDuration: number;
    disassembleScaleTo: number;
    disassembleTranslateTo: number;
    revealScaleFrom: number;
    revealTranslateFrom: number;
    settleDuration: number;
  };
  overlay: {
    fadeOutDuration: number;
    panelFadeOutDuration: number;
    glitchFadeOutDuration: number;
    overlayFadeInDuration: number;
    scanDuration: number;
    pulseDuration: number;
    disassembleGlitchHigh: number;
    disassembleGlitchLow: number;
    assembleGlitchHigh: number;
    assembleGlitchLow: number;
    disassembleGlitchHighDuration: number;
    disassembleGlitchLowDuration: number;
    assembleGlitchHighDuration: number;
    assembleGlitchLowDuration: number;
    panelEnterDelay: number;
    panelFadeInDuration: number;
    panelTranslateDuration: number;
    panelSettleDelay: number;
    panelDismissDuration: number;
    overlayDismissDuration: number;
  };
}

interface TransitionShardMotion {
  x: number;
  y: number;
  rotate: number;
  duration: number;
}

interface TransitionVariantTheme {
  backdrop: string;
  backdropSettling: string;
  backdropFinalizing: string;
  pulseBorder: string;
  pulseFill: string;
  gridFill: string;
  gridTop: string;
  gridBottom: string;
  shardBorder: string;
  shardFill: string;
  panelBorder: string;
  panelBackground: string;
  panelLineTop: string;
  panelLineBottom: string;
  eyebrow: string;
  detail: string;
}

interface TransitionVariantProfile {
  theme: TransitionVariantTheme;
  panelDelay: number;
  panelEnterTension: number;
  panelEnterFriction: number;
  panelAssembleTension: number;
  panelAssembleFriction: number;
  disassemble: {
    top: TransitionShardMotion;
    middle: TransitionShardMotion;
    bottom: TransitionShardMotion;
  };
  assembleFrom: {
    top: TransitionShardMotion;
    middle: TransitionShardMotion;
    bottom: TransitionShardMotion;
  };
  assembleTo: {
    top: TransitionShardMotion;
    middle: TransitionShardMotion;
    bottom: TransitionShardMotion;
  };
}

const TRANSITION_CONFIG: DemoTransitionConfig = {
  content: {
    disassembleOpacityDuration: 150,
    disassembleScaleDuration: 180,
    disassembleTranslateDuration: 180,
    revealDelay: 260,
    revealOpacityDuration: 420,
    revealScaleDuration: 460,
    revealTranslateDuration: 460,
    disassembleScaleTo: 0.986,
    disassembleTranslateTo: 10,
    revealScaleFrom: 0.974,
    revealTranslateFrom: 18,
    settleDuration: 980
  },
  overlay: {
    fadeOutDuration: 220,
    panelFadeOutDuration: 180,
    glitchFadeOutDuration: 160,
    overlayFadeInDuration: 140,
    scanDuration: 1400,
    pulseDuration: 820,
    disassembleGlitchHigh: 0.26,
    disassembleGlitchLow: 0.08,
    assembleGlitchHigh: 0.18,
    assembleGlitchLow: 0.04,
    disassembleGlitchHighDuration: 110,
    disassembleGlitchLowDuration: 150,
    assembleGlitchHighDuration: 140,
    assembleGlitchLowDuration: 190,
    panelEnterDelay: 50,
    panelFadeInDuration: 180,
    panelTranslateDuration: 220,
    panelSettleDelay: 120,
    panelDismissDuration: 220,
    overlayDismissDuration: 260
  }
};

const VARIANT_PROFILES: Record<DemoTransitionVariant, TransitionVariantProfile> = {
  processing: {
    theme: {
      backdrop: "rgba(4, 8, 14, 0.84)",
      backdropSettling: "rgba(4, 8, 14, 0.9)",
      backdropFinalizing: "rgba(2, 6, 12, 0.94)",
      pulseBorder: "rgba(96, 165, 250, 0.22)",
      pulseFill: "rgba(59, 130, 246, 0.08)",
      gridFill: "rgba(255, 255, 255, 0.07)",
      gridTop: "rgba(255, 255, 255, 0.08)",
      gridBottom: "rgba(96, 165, 250, 0.12)",
      shardBorder: "rgba(96, 165, 250, 0.18)",
      shardFill: "rgba(12, 18, 28, 0.92)",
      panelBorder: "rgba(148, 163, 184, 0.16)",
      panelBackground: "rgba(8, 14, 24, 0.92)",
      panelLineTop: "rgba(96, 165, 250, 0.24)",
      panelLineBottom: "rgba(148, 163, 184, 0.14)",
      eyebrow: "#7DD3FC",
      detail: "#94A3B8"
    },
    panelDelay: 50,
    panelEnterTension: 120,
    panelEnterFriction: 14,
    panelAssembleTension: 130,
    panelAssembleFriction: 13,
    disassemble: {
      top: { x: -132, y: -204, rotate: -1, duration: 520 },
      middle: { x: 188, y: -24, rotate: 1, duration: 460 },
      bottom: { x: -96, y: 228, rotate: -0.7, duration: 560 }
    },
    assembleFrom: {
      top: { x: -188, y: -224, rotate: -1.2, duration: 540 },
      middle: { x: 212, y: -36, rotate: 1.1, duration: 500 },
      bottom: { x: -150, y: 252, rotate: -0.8, duration: 560 }
    },
    assembleTo: {
      top: { x: -8, y: -12, rotate: 0, duration: 540 },
      middle: { x: 0, y: 0, rotate: 0, duration: 500 },
      bottom: { x: 10, y: 14, rotate: 0, duration: 560 }
    }
  },
  finalizing: {
    theme: {
      backdrop: "rgba(3, 7, 12, 0.88)",
      backdropSettling: "rgba(3, 7, 12, 0.92)",
      backdropFinalizing: "rgba(1, 4, 9, 0.96)",
      pulseBorder: "rgba(192, 219, 255, 0.24)",
      pulseFill: "rgba(148, 163, 184, 0.1)",
      gridFill: "rgba(255, 255, 255, 0.06)",
      gridTop: "rgba(226, 232, 240, 0.12)",
      gridBottom: "rgba(148, 163, 184, 0.16)",
      shardBorder: "rgba(226, 232, 240, 0.16)",
      shardFill: "rgba(10, 15, 24, 0.94)",
      panelBorder: "rgba(226, 232, 240, 0.16)",
      panelBackground: "rgba(7, 12, 20, 0.94)",
      panelLineTop: "rgba(226, 232, 240, 0.2)",
      panelLineBottom: "rgba(148, 163, 184, 0.16)",
      eyebrow: "#E2E8F0",
      detail: "#CBD5E1"
    },
    panelDelay: 30,
    panelEnterTension: 112,
    panelEnterFriction: 16,
    panelAssembleTension: 122,
    panelAssembleFriction: 14,
    disassemble: {
      top: { x: -96, y: -188, rotate: -0.55, duration: 420 },
      middle: { x: 152, y: -8, rotate: 0.5, duration: 390 },
      bottom: { x: -72, y: 198, rotate: -0.45, duration: 450 }
    },
    assembleFrom: {
      top: { x: -132, y: -168, rotate: -0.8, duration: 430 },
      middle: { x: 146, y: -12, rotate: 0.6, duration: 410 },
      bottom: { x: -118, y: 186, rotate: -0.5, duration: 440 }
    },
    assembleTo: {
      top: { x: -4, y: -8, rotate: 0, duration: 430 },
      middle: { x: 0, y: 0, rotate: 0, duration: 410 },
      bottom: { x: 6, y: 10, rotate: 0, duration: 440 }
    }
  },
  settling: {
    theme: {
      backdrop: "rgba(5, 9, 15, 0.82)",
      backdropSettling: "rgba(5, 9, 15, 0.86)",
      backdropFinalizing: "rgba(2, 6, 12, 0.92)",
      pulseBorder: "rgba(94, 234, 212, 0.2)",
      pulseFill: "rgba(45, 212, 191, 0.08)",
      gridFill: "rgba(255, 255, 255, 0.06)",
      gridTop: "rgba(204, 251, 241, 0.08)",
      gridBottom: "rgba(94, 234, 212, 0.14)",
      shardBorder: "rgba(94, 234, 212, 0.16)",
      shardFill: "rgba(10, 18, 22, 0.92)",
      panelBorder: "rgba(110, 231, 183, 0.16)",
      panelBackground: "rgba(6, 16, 18, 0.9)",
      panelLineTop: "rgba(94, 234, 212, 0.22)",
      panelLineBottom: "rgba(110, 231, 183, 0.14)",
      eyebrow: "#99F6E4",
      detail: "#A7F3D0"
    },
    panelDelay: 20,
    panelEnterTension: 118,
    panelEnterFriction: 14,
    panelAssembleTension: 138,
    panelAssembleFriction: 12,
    disassemble: {
      top: { x: -144, y: -218, rotate: -1.12, duration: 500 },
      middle: { x: 204, y: -28, rotate: 1.06, duration: 470 },
      bottom: { x: -112, y: 236, rotate: -0.76, duration: 540 }
    },
    assembleFrom: {
      top: { x: -214, y: -238, rotate: -1.28, duration: 520 },
      middle: { x: 246, y: -42, rotate: 1.18, duration: 500 },
      bottom: { x: -168, y: 264, rotate: -0.88, duration: 550 }
    },
    assembleTo: {
      top: { x: -10, y: -14, rotate: 0, duration: 520 },
      middle: { x: 0, y: 0, rotate: 0, duration: 500 },
      bottom: { x: 12, y: 16, rotate: 0, duration: 550 }
    }
  }
};

function getVariantProfile(variant?: DemoTransitionVariant) {
  return VARIANT_PROFILES[variant ?? "processing"];
}

function isFinalizingScreenId(screenId?: string) {
  return Boolean(screenId && screenId.includes("finalizing"));
}

function shouldShowProcessingOverlay(
  event: Pick<RendererScreenTransitionEvent["current"], "mode" | "flowPhase" | "requestId">
) {
  if (!event.requestId) {
    return false;
  }

  if (event.mode === "approval" || event.mode === "error") {
    return false;
  }

  return event.flowPhase === "pending" || event.flowPhase === "active";
}

function getSettlingCopy(mode?: ScreenMode): DemoTransitionCopy {
  switch (mode) {
    case "processing":
    case "task":
    case "approval":
    case "result":
      return {
        eyebrow: "Surface assembling",
        title: "Workspace ready",
        detail: "The next result surface has been resolved and is ready for interaction."
      };
    case "error":
      return {
        eyebrow: "Recovery state",
        title: "Recovery state",
        detail: "The runtime moved into an error surface."
      };
    case "stable":
    default:
      return {
        eyebrow: "Surface assembling",
        title: "Workspace updated",
        detail: "The runtime settled on the next stable surface."
      };
  }
}

function getTransitionCopy(
  phase: DemoTransitionPhase,
  variant: DemoTransitionVariant,
  mode?: ScreenMode
): DemoTransitionCopy {
  if (variant === "settling") {
    return getSettlingCopy(mode);
  }

  if (variant === "finalizing") {
    return {
      eyebrow: phase === "disassembling" ? "Workspace sealing" : "Surface assembling",
      title: phase === "disassembling" ? "Finalizing workspace" : "Final result incoming",
      detail:
        phase === "disassembling"
          ? "The harness is locking the composed screen before releasing the final result."
          : "The finalized surface is being released back into the workspace."
    };
  }

  return {
    eyebrow: phase === "disassembling" ? "Surface disassembling" : "Surface assembling",
    title: phase === "disassembling" ? "Processing request" : "Workspace incoming",
    detail:
      phase === "disassembling"
        ? "The harness is preparing the next workspace surface."
        : "The next runtime surface is being assembled for interaction."
  };
}

function createIdleState(token = 0): DemoTransitionState {
  return {
    phase: "idle",
    token,
    title: "",
    detail: ""
  };
}

export function useDemoScreenTransition() {
  const [transitionState, setTransitionState] = useState<DemoTransitionState>(createIdleState());
  const transitionStateRef = useRef<DemoTransitionState>(transitionState);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const revealTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const transitionKeyRef = useRef<string | null>(null);
  const contentOpacity = useRef(new Animated.Value(1)).current;
  const contentScale = useRef(new Animated.Value(1)).current;
  const contentTranslateY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    transitionStateRef.current = transitionState;
  }, [transitionState]);

  useEffect(() => {
    return () => {
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
      }

      if (revealTimerRef.current) {
        clearTimeout(revealTimerRef.current);
      }
    };
  }, []);

  function resetRuntimeStageVisibility() {
    if (revealTimerRef.current) {
      clearTimeout(revealTimerRef.current);
    }

    contentOpacity.stopAnimation();
    contentScale.stopAnimation();
    contentTranslateY.stopAnimation();
    contentOpacity.setValue(1);
    contentScale.setValue(1);
    contentTranslateY.setValue(0);
  }

  function hideRuntimeStageForTransition() {
    if (revealTimerRef.current) {
      clearTimeout(revealTimerRef.current);
    }

    Animated.parallel([
      Animated.timing(contentOpacity, {
        toValue: 0,
        duration: TRANSITION_CONFIG.content.disassembleOpacityDuration,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true
      }),
      Animated.timing(contentScale, {
        toValue: TRANSITION_CONFIG.content.disassembleScaleTo,
        duration: TRANSITION_CONFIG.content.disassembleScaleDuration,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true
      }),
      Animated.timing(contentTranslateY, {
        toValue: TRANSITION_CONFIG.content.disassembleTranslateTo,
        duration: TRANSITION_CONFIG.content.disassembleTranslateDuration,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true
      })
    ]).start();
  }

  function startAssemblyReveal() {
    if (revealTimerRef.current) {
      clearTimeout(revealTimerRef.current);
    }

    contentOpacity.stopAnimation();
    contentScale.stopAnimation();
    contentTranslateY.stopAnimation();
    contentOpacity.setValue(0);
    contentScale.setValue(TRANSITION_CONFIG.content.revealScaleFrom);
    contentTranslateY.setValue(TRANSITION_CONFIG.content.revealTranslateFrom);

    revealTimerRef.current = setTimeout(() => {
      Animated.parallel([
        Animated.timing(contentOpacity, {
          toValue: 1,
          duration: TRANSITION_CONFIG.content.revealOpacityDuration,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true
        }),
        Animated.timing(contentScale, {
          toValue: 1,
          duration: TRANSITION_CONFIG.content.revealScaleDuration,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true
        }),
        Animated.timing(contentTranslateY, {
          toValue: 0,
          duration: TRANSITION_CONFIG.content.revealTranslateDuration,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true
        })
      ]).start();
    }, TRANSITION_CONFIG.content.revealDelay);
  }

  function commitTransition(next: Omit<DemoTransitionState, "token">) {
    const value: DemoTransitionState = {
      ...next,
      token: transitionStateRef.current.token + 1
    };
    transitionStateRef.current = value;
    setTransitionState(value);
  }

  function resetToIdle() {
    transitionKeyRef.current = null;
    commitTransition({
      phase: "idle",
      title: "",
      detail: ""
    });
  }

  function beginDisassembly(
    requestId: string,
    variant: DemoTransitionVariant,
    mode?: ScreenMode
  ) {
    const key = `disassembling:${variant}:${requestId}`;

    if (transitionKeyRef.current === key && transitionStateRef.current.phase === "disassembling") {
      return;
    }

    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
    }

    const copy = getTransitionCopy("disassembling", variant, mode);
    transitionKeyRef.current = key;
    hideRuntimeStageForTransition();
    commitTransition({
      phase: "disassembling",
      variant,
      requestId,
      title: copy.title,
      detail: copy.detail
    });
  }

  function beginAssembly(
    requestId: string,
    variant: DemoTransitionVariant,
    mode?: ScreenMode
  ) {
    const key = `assembling:${variant}:${requestId}`;

    if (transitionKeyRef.current === key && transitionStateRef.current.phase === "assembling") {
      return;
    }

    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
    }

    const copy = getTransitionCopy("assembling", variant, mode);
    transitionKeyRef.current = key;
    startAssemblyReveal();
    commitTransition({
      phase: "assembling",
      variant,
      requestId,
      title: copy.title,
      detail: copy.detail
    });

    idleTimerRef.current = setTimeout(() => {
      resetRuntimeStageVisibility();
      resetToIdle();
    }, TRANSITION_CONFIG.content.settleDuration);
  }

  const transitionHooks = useMemo<RendererTransitionHooks>(
    () => ({
      onFlowChange(event) {
        if (event.current.flowTransition === "root" || !event.current.requestId) {
          resetRuntimeStageVisibility();
          resetToIdle();
          return;
        }

        if (shouldShowProcessingOverlay(event.current)) {
          beginDisassembly(
            event.current.requestId,
            isFinalizingScreenId(event.current.screenId) ? "finalizing" : "processing",
            event.current.mode
          );
          return;
        }

        if (event.current.flowPhase === "complete") {
          beginAssembly(event.current.requestId, "settling", event.current.mode);
        }
      },
      onScreenTransition(event) {
        if (isFinalizingScreenId(event.current.screenId)) {
          beginDisassembly(
            event.current.requestId ?? event.previous.requestId ?? event.current.screenId ?? "finalizing",
            "finalizing",
            event.current.mode
          );
          return;
        }

        if (!shouldShowProcessingOverlay(event.current)) {
          return;
        }

        if (!event.changed.includes("screen") && !event.changed.includes("mode")) {
          return;
        }

        beginDisassembly(
          event.current.requestId ?? event.previous.requestId ?? event.current.screenId ?? "processing",
          "processing",
          event.current.mode
        );
      }
    }),
    []
  );

  const runtimeStageStyle = useMemo(
    () => ({
      opacity: contentOpacity,
      transform: [{ scale: contentScale }, { translateY: contentTranslateY }]
    }),
    []
  );

  return {
    transitionHooks,
    transitionState,
    runtimeStageStyle,
    blockRuntimePointerEvents: transitionState.phase !== "idle"
  };
}

export function DemoTransitionOverlay({ state }: { state: DemoTransitionState }) {
  const [mounted, setMounted] = useState(state.phase !== "idle");
  const activeVariantRef = useRef<DemoTransitionVariant>("processing");
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const panelOpacity = useRef(new Animated.Value(0)).current;
  const panelScale = useRef(new Animated.Value(0.94)).current;
  const panelTranslateY = useRef(new Animated.Value(18)).current;
  const glitchOpacity = useRef(new Animated.Value(0)).current;
  const haloPulse = useRef(new Animated.Value(0)).current;
  const scan = useRef(new Animated.Value(0)).current;
  const topX = useRef(new Animated.Value(0)).current;
  const topY = useRef(new Animated.Value(0)).current;
  const middleX = useRef(new Animated.Value(0)).current;
  const middleY = useRef(new Animated.Value(0)).current;
  const bottomX = useRef(new Animated.Value(0)).current;
  const bottomY = useRef(new Animated.Value(0)).current;
  const topRotate = useRef(new Animated.Value(0)).current;
  const middleRotate = useRef(new Animated.Value(0)).current;
  const bottomRotate = useRef(new Animated.Value(0)).current;
  const scanLoopRef = useRef<Animated.CompositeAnimation | null>(null);
  const pulseLoopRef = useRef<Animated.CompositeAnimation | null>(null);
  const glitchLoopRef = useRef<Animated.CompositeAnimation | null>(null);

  if (state.variant) {
    activeVariantRef.current = state.variant;
  }

  useEffect(() => {
    return () => {
      scanLoopRef.current?.stop();
      pulseLoopRef.current?.stop();
      glitchLoopRef.current?.stop();
    };
  }, []);

  useEffect(() => {
    scanLoopRef.current?.stop();
    pulseLoopRef.current?.stop();
    glitchLoopRef.current?.stop();

    if (state.phase === "idle") {
      Animated.parallel([
        Animated.timing(overlayOpacity, {
          toValue: 0,
          duration: TRANSITION_CONFIG.overlay.fadeOutDuration,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true
        }),
        Animated.timing(panelOpacity, {
          toValue: 0,
          duration: TRANSITION_CONFIG.overlay.panelFadeOutDuration,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true
        }),
        Animated.timing(glitchOpacity, {
          toValue: 0,
          duration: TRANSITION_CONFIG.overlay.glitchFadeOutDuration,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true
        })
      ]).start(({ finished }) => {
        if (finished) {
          setMounted(false);
        }
      });

      return;
    }

    setMounted(true);
    scan.setValue(0);
    haloPulse.setValue(0);

    scanLoopRef.current = Animated.loop(
      Animated.timing(scan, {
        toValue: 1,
        duration: TRANSITION_CONFIG.overlay.scanDuration,
        easing: Easing.linear,
        useNativeDriver: true
      })
    );
    scanLoopRef.current.start();

    pulseLoopRef.current = Animated.loop(
      Animated.sequence([
        Animated.timing(haloPulse, {
          toValue: 1,
          duration: TRANSITION_CONFIG.overlay.pulseDuration,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true
        }),
        Animated.timing(haloPulse, {
          toValue: 0,
          duration: TRANSITION_CONFIG.overlay.pulseDuration,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true
        })
      ])
    );
    pulseLoopRef.current.start();

    glitchLoopRef.current = Animated.loop(
      Animated.sequence([
        Animated.timing(glitchOpacity, {
          toValue:
            state.phase === "disassembling"
              ? TRANSITION_CONFIG.overlay.disassembleGlitchHigh
              : TRANSITION_CONFIG.overlay.assembleGlitchHigh,
          duration:
            state.phase === "disassembling"
              ? TRANSITION_CONFIG.overlay.disassembleGlitchHighDuration
              : TRANSITION_CONFIG.overlay.assembleGlitchHighDuration,
          easing: Easing.linear,
          useNativeDriver: true
        }),
        Animated.timing(glitchOpacity, {
          toValue:
            state.phase === "disassembling"
              ? TRANSITION_CONFIG.overlay.disassembleGlitchLow
              : TRANSITION_CONFIG.overlay.assembleGlitchLow,
          duration:
            state.phase === "disassembling"
              ? TRANSITION_CONFIG.overlay.disassembleGlitchLowDuration
              : TRANSITION_CONFIG.overlay.assembleGlitchLowDuration,
          easing: Easing.linear,
          useNativeDriver: true
        })
      ])
    );
    glitchLoopRef.current.start();

    const profile = getVariantProfile(state.variant);

    if (state.phase === "disassembling") {
      overlayOpacity.setValue(0);
      panelOpacity.setValue(0);
      panelScale.setValue(0.96);
      panelTranslateY.setValue(12);
      topX.setValue(0);
      topY.setValue(0);
      middleX.setValue(0);
      middleY.setValue(0);
      bottomX.setValue(0);
      bottomY.setValue(0);
      topRotate.setValue(0);
      middleRotate.setValue(0);
      bottomRotate.setValue(0);

      Animated.parallel([
        Animated.timing(overlayOpacity, {
          toValue: 1,
          duration: TRANSITION_CONFIG.overlay.overlayFadeInDuration,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true
        }),
        Animated.parallel([
          Animated.timing(topX, {
            toValue: profile.disassemble.top.x,
            duration: profile.disassemble.top.duration,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true
          }),
          Animated.timing(topY, {
            toValue: profile.disassemble.top.y,
            duration: profile.disassemble.top.duration,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true
          }),
          Animated.timing(topRotate, {
            toValue: profile.disassemble.top.rotate,
            duration: profile.disassemble.top.duration,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true
          })
        ]),
        Animated.parallel([
          Animated.timing(middleX, {
            toValue: profile.disassemble.middle.x,
            duration: profile.disassemble.middle.duration,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true
          }),
          Animated.timing(middleY, {
            toValue: profile.disassemble.middle.y,
            duration: profile.disassemble.middle.duration,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true
          }),
          Animated.timing(middleRotate, {
            toValue: profile.disassemble.middle.rotate,
            duration: profile.disassemble.middle.duration,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true
          })
        ]),
        Animated.parallel([
          Animated.timing(bottomX, {
            toValue: profile.disassemble.bottom.x,
            duration: profile.disassemble.bottom.duration,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true
          }),
          Animated.timing(bottomY, {
            toValue: profile.disassemble.bottom.y,
            duration: profile.disassemble.bottom.duration,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true
          }),
          Animated.timing(bottomRotate, {
            toValue: profile.disassemble.bottom.rotate,
            duration: profile.disassemble.bottom.duration,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true
          })
        ]),
        Animated.sequence([
          Animated.delay(profile.panelDelay),
          Animated.parallel([
            Animated.timing(panelOpacity, {
              toValue: 1,
              duration: TRANSITION_CONFIG.overlay.panelFadeInDuration,
              easing: Easing.out(Easing.quad),
              useNativeDriver: true
            }),
            Animated.spring(panelScale, {
              toValue: 1,
              tension: profile.panelEnterTension,
              friction: profile.panelEnterFriction,
              useNativeDriver: true
            }),
            Animated.timing(panelTranslateY, {
              toValue: 0,
              duration: TRANSITION_CONFIG.overlay.panelTranslateDuration,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: true
            })
          ])
        ])
      ]).start();

      return;
    }

    overlayOpacity.setValue(1);
    panelOpacity.setValue(0.94);
    panelScale.setValue(0.92);
    panelTranslateY.setValue(18);
    topX.setValue(profile.assembleFrom.top.x);
    topY.setValue(profile.assembleFrom.top.y);
    middleX.setValue(profile.assembleFrom.middle.x);
    middleY.setValue(profile.assembleFrom.middle.y);
    bottomX.setValue(profile.assembleFrom.bottom.x);
    bottomY.setValue(profile.assembleFrom.bottom.y);
    topRotate.setValue(profile.assembleFrom.top.rotate);
    middleRotate.setValue(profile.assembleFrom.middle.rotate);
    bottomRotate.setValue(profile.assembleFrom.bottom.rotate);

    Animated.parallel([
      Animated.parallel([
        Animated.timing(topX, {
          toValue: profile.assembleTo.top.x,
          duration: profile.assembleTo.top.duration,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true
        }),
        Animated.timing(topY, {
          toValue: profile.assembleTo.top.y,
          duration: profile.assembleTo.top.duration,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true
        }),
        Animated.timing(topRotate, {
          toValue: profile.assembleTo.top.rotate,
          duration: profile.assembleTo.top.duration,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true
        })
      ]),
      Animated.parallel([
        Animated.timing(middleX, {
          toValue: profile.assembleTo.middle.x,
          duration: profile.assembleTo.middle.duration,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true
        }),
        Animated.timing(middleY, {
          toValue: profile.assembleTo.middle.y,
          duration: profile.assembleTo.middle.duration,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true
        }),
        Animated.timing(middleRotate, {
          toValue: profile.assembleTo.middle.rotate,
          duration: profile.assembleTo.middle.duration,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true
        })
      ]),
      Animated.parallel([
        Animated.timing(bottomX, {
          toValue: profile.assembleTo.bottom.x,
          duration: profile.assembleTo.bottom.duration,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true
        }),
        Animated.timing(bottomY, {
          toValue: profile.assembleTo.bottom.y,
          duration: profile.assembleTo.bottom.duration,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true
        }),
        Animated.timing(bottomRotate, {
          toValue: profile.assembleTo.bottom.rotate,
          duration: profile.assembleTo.bottom.duration,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true
        })
      ]),
      Animated.sequence([
        Animated.parallel([
          Animated.timing(panelOpacity, {
            toValue: 1,
            duration: TRANSITION_CONFIG.overlay.panelFadeInDuration,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true
          }),
          Animated.spring(panelScale, {
            toValue: 1,
            tension: profile.panelAssembleTension,
            friction: profile.panelAssembleFriction,
            useNativeDriver: true
          }),
          Animated.timing(panelTranslateY, {
            toValue: 0,
            duration: TRANSITION_CONFIG.overlay.panelTranslateDuration,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true
          })
        ]),
        Animated.delay(TRANSITION_CONFIG.overlay.panelSettleDelay),
        Animated.parallel([
          Animated.timing(overlayOpacity, {
            toValue: 0,
            duration: TRANSITION_CONFIG.overlay.overlayDismissDuration,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true
          }),
          Animated.timing(panelOpacity, {
            toValue: 0,
            duration: TRANSITION_CONFIG.overlay.panelDismissDuration,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true
          })
        ])
      ])
    ]).start(({ finished }) => {
      if (finished) {
        setMounted(false);
      }
    });
  }, [
    bottomRotate,
    bottomX,
    bottomY,
    glitchOpacity,
    haloPulse,
    middleRotate,
    middleX,
    middleY,
    overlayOpacity,
    panelOpacity,
    panelScale,
    panelTranslateY,
    scan,
    state.phase,
    state.token,
    topRotate,
    topX,
    topY
  ]);

  if (!mounted) {
    return null;
  }

  const activeVariant = state.variant ?? activeVariantRef.current;
  const copy = state.variant ? getTransitionCopy(state.phase, state.variant) : null;
  const profile = getVariantProfile(activeVariant);
  const haloScale = haloPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.1]
  });
  const haloOpacity = haloPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.14, 0.34]
  });
  const scanTranslateY = scan.interpolate({
    inputRange: [0, 1],
    outputRange: [-620, 620]
  });
  const topRotateDeg = topRotate.interpolate({
    inputRange: [-1.5, 1.5],
    outputRange: ["-14deg", "14deg"]
  });
  const middleRotateDeg = middleRotate.interpolate({
    inputRange: [-1.5, 1.5],
    outputRange: ["-14deg", "14deg"]
  });
  const bottomRotateDeg = bottomRotate.interpolate({
    inputRange: [-1.5, 1.5],
    outputRange: ["-14deg", "14deg"]
  });

  return (
    <View pointerEvents="none" style={styles.transitionOverlayRoot}>
      <Animated.View
        style={[
          styles.transitionOverlayBackdrop,
          {
            backgroundColor:
              state.variant === "finalizing"
                ? profile.theme.backdropFinalizing
                : state.phase === "assembling"
                  ? profile.theme.backdropSettling
                  : profile.theme.backdrop
          },
          { opacity: overlayOpacity }
        ]}
      >
        <Animated.View
          style={[
            styles.transitionGridLine,
            {
              backgroundColor: profile.theme.gridFill,
              borderTopColor: profile.theme.gridTop,
              borderBottomColor: profile.theme.gridBottom,
              transform: [{ translateY: scanTranslateY }]
            }
          ]}
        />
      </Animated.View>
      <Animated.View
        style={[
          styles.transitionPulseRing,
          {
            borderColor: profile.theme.pulseBorder,
            backgroundColor: profile.theme.pulseFill,
            opacity: haloOpacity,
            transform: [{ scale: haloScale }]
          }
        ]}
      />
      <Animated.View
        style={[
          styles.transitionShard,
          styles.transitionShardTop,
          {
            borderColor: profile.theme.shardBorder,
            backgroundColor: profile.theme.shardFill,
            opacity: overlayOpacity,
            transform: [{ translateX: topX }, { translateY: topY }, { rotate: topRotateDeg }]
          }
        ]}
      />
      <Animated.View
        style={[
          styles.transitionShard,
          styles.transitionShardMiddle,
          {
            borderColor: profile.theme.shardBorder,
            backgroundColor: profile.theme.shardFill,
            opacity: overlayOpacity,
            transform: [{ translateX: middleX }, { translateY: middleY }, { rotate: middleRotateDeg }]
          }
        ]}
      />
      <Animated.View
        style={[
          styles.transitionShard,
          styles.transitionShardBottom,
          {
            borderColor: profile.theme.shardBorder,
            backgroundColor: profile.theme.shardFill,
            opacity: overlayOpacity,
            transform: [{ translateX: bottomX }, { translateY: bottomY }, { rotate: bottomRotateDeg }]
          }
        ]}
      />
      <Animated.View
        style={[
          styles.transitionPanel,
          {
            borderColor: profile.theme.panelBorder,
            backgroundColor: profile.theme.panelBackground,
            opacity: panelOpacity,
            transform: [{ scale: panelScale }, { translateY: panelTranslateY }]
          }
        ]}
      >
        <Animated.View style={[styles.transitionFlicker, { opacity: glitchOpacity }]} />
        <View style={[styles.transitionPanelLineTop, { backgroundColor: profile.theme.panelLineTop }]} />
        <View style={[styles.transitionPanelLineBottom, { backgroundColor: profile.theme.panelLineBottom }]} />
        <View style={styles.transitionPanelInner}>
          <Text style={[styles.transitionEyebrow, { color: profile.theme.eyebrow }]}>
            {copy?.eyebrow ?? "Surface transition"}
          </Text>
          <Text style={styles.transitionTitle}>{state.title}</Text>
          <Text style={[styles.transitionDetail, { color: profile.theme.detail }]}>{state.detail}</Text>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  transitionOverlayRoot: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: "center",
    justifyContent: "center"
  },
  transitionOverlayBackdrop: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0
  },
  transitionPulseRing: {
    position: "absolute",
    width: 324,
    height: 324,
    borderRadius: 999,
    borderWidth: 1
  },
  transitionPanel: {
    width: "82%",
    maxWidth: 360,
    minWidth: 272,
    overflow: "hidden",
    borderRadius: 28,
    borderWidth: 1,
    shadowColor: "#020617",
    shadowOpacity: 0.32,
    shadowRadius: 36,
    shadowOffset: {
      width: 0,
      height: 18
    },
    elevation: 18
  },
  transitionPanelLineTop: {
    position: "absolute",
    top: 16,
    left: 16,
    right: 16,
    height: 1
  },
  transitionPanelLineBottom: {
    position: "absolute",
    bottom: 16,
    left: 16,
    right: 16,
    height: 1
  },
  transitionPanelInner: {
    paddingHorizontal: 24,
    paddingVertical: 24,
    gap: 10
  },
  transitionGridLine: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 120,
    borderTopWidth: 1,
    borderBottomWidth: 1
  },
  transitionShard: {
    position: "absolute",
    width: "86%",
    maxWidth: 390,
    borderRadius: 24,
    borderWidth: 1,
    shadowColor: "#020617",
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: {
      width: 0,
      height: 10
    }
  },
  transitionShardTop: {
    top: "19%",
    height: 136
  },
  transitionShardMiddle: {
    top: "41%",
    height: 118
  },
  transitionShardBottom: {
    top: "60%",
    height: 148
  },
  transitionFlicker: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: "#020617"
  },
  transitionEyebrow: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1.3
  },
  transitionTitle: {
    color: "#F8FAFC",
    fontSize: 22,
    fontWeight: "700"
  },
  transitionDetail: {
    fontSize: 14,
    lineHeight: 20
  }
});
