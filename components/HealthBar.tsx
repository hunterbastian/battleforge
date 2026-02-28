import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";
import COLORS from "@/constants/colors";

interface HealthBarProps {
  current: number;
  max: number;
  height?: number;
}

export function HealthBar({ current, max, height = 5 }: HealthBarProps) {
  const widthAnim = useRef(new Animated.Value(current / max)).current;

  useEffect(() => {
    Animated.timing(widthAnim, {
      toValue: Math.max(0, current / max),
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [current, max]);

  const color = current / max > 0.5 ? COLORS.green : current / max > 0.25 ? COLORS.gold : COLORS.red;

  return (
    <View style={[styles.track, { height }]}>
      <Animated.View
        style={[
          styles.fill,
          {
            height,
            backgroundColor: color,
            width: widthAnim.interpolate({
              inputRange: [0, 1],
              outputRange: ["0%", "100%"],
            }),
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    width: "100%",
    backgroundColor: COLORS.surfaceHigh,
    borderRadius: 4,
    overflow: "hidden",
  },
  fill: {
    borderRadius: 4,
  },
});
