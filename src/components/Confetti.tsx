import React, { useEffect, useRef } from 'react';
import { Animated, Dimensions, Easing, StyleSheet, View } from 'react-native';

const { width, height } = Dimensions.get('window');

const COLORS = ['#cadd65', '#10B981', '#F59E0B', '#EF4444', '#3B82F6', '#EC4899', '#FFFFFF'];
const NUM_PIECES = 90;

type Piece = {
  startX: number;
  fromSide: 'left' | 'right' | 'top';
  size: number;
  color: string;
  delay: number;
  duration: number;
  swayAmplitude: number;
  rotateDirection: number;
  anim: Animated.Value;
};

/**
 * Lightweight, dependency-free confetti overlay.
 * Pieces fly in from the sides and rain down from the top, then loop.
 * Renders with pointerEvents="none" so it never blocks taps underneath.
 */
export default function Confetti() {
  const pieces = useRef<Piece[]>(
    Array.from({ length: NUM_PIECES }).map((_, i) => {
      const roll = i % 3; // mix: from left, from right, from top
      const fromSide = roll === 0 ? 'left' : roll === 1 ? 'right' : 'top';
      return {
        startX:
          fromSide === 'left'
            ? -20
            : fromSide === 'right'
              ? width + 20
              : Math.random() * width,
        fromSide,
        size: 7 + Math.random() * 9,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        delay: Math.random() * 2500,
        duration: 2600 + Math.random() * 2600,
        swayAmplitude: 30 + Math.random() * 80,
        rotateDirection: Math.random() > 0.5 ? 1 : -1,
        anim: new Animated.Value(0),
      };
    }),
  ).current;

  useEffect(() => {
    const animations = pieces.map((p) =>
      Animated.loop(
        Animated.timing(p.anim, {
          toValue: 1,
          duration: p.duration,
          delay: p.delay,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ),
    );
    animations.forEach((a) => a.start());
    return () => animations.forEach((a) => a.stop());
  }, [pieces]);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {pieces.map((p, i) => {
        const translateY = p.anim.interpolate({
          inputRange: [0, 1],
          outputRange: [-40, height + 40],
        });

        // Pieces from the sides arc inward before falling; top pieces just sway.
        const inward = p.fromSide === 'left' ? 1 : p.fromSide === 'right' ? -1 : 0;
        const translateX =
          p.fromSide === 'top'
            ? p.anim.interpolate({
                inputRange: [0, 0.25, 0.5, 0.75, 1],
                outputRange: [0, p.swayAmplitude, 0, -p.swayAmplitude, 0],
              })
            : p.anim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, inward * (width * 0.6 + p.swayAmplitude)],
              });

        const rotate = p.anim.interpolate({
          inputRange: [0, 1],
          outputRange: ['0deg', `${p.rotateDirection * 720}deg`],
        });

        const opacity = p.anim.interpolate({
          inputRange: [0, 0.08, 0.85, 1],
          outputRange: [0, 1, 1, 0],
        });

        return (
          <Animated.View
            key={i}
            style={{
              position: 'absolute',
              left: p.startX,
              top: 0,
              width: p.size,
              height: p.size * 0.6,
              backgroundColor: p.color,
              borderRadius: 2,
              opacity,
              transform: [{ translateY }, { translateX }, { rotate }],
            }}
          />
        );
      })}
    </View>
  );
}
