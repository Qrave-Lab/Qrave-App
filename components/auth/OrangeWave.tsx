// @ts-nocheck
import React from "react";
import { View, Dimensions, StyleSheet } from "react-native";
import Svg, { Path, Defs, RadialGradient, Stop } from "react-native-svg";

const { width } = Dimensions.get("window");

/**
 * OrangeWave
 * A decorative bottom wave element for auth screens.
 * Place it inside a View with flex:1 at the bottom via absolute positioning.
 */
export default function OrangeWave() {
  return (
    <View style={styles.wrapper} pointerEvents="none">
      <Svg
        width={width}
        height={120}
        viewBox={`0 0 ${width} 120`}
        style={styles.svg}
      >
        <Defs>
          <RadialGradient id="wg" cx="50%" cy="0%" rx="60%" ry="100%">
            <Stop offset="0%" stopColor="#FF8C3A" stopOpacity="1" />
            <Stop offset="100%" stopColor="#FF6300" stopOpacity="1" />
          </RadialGradient>
        </Defs>
        {/* Back wave – slightly lighter */}
        <Path
          d={`M0 60 Q${width * 0.25} 20 ${width * 0.5} 60 Q${width * 0.75} 100 ${width} 60 L${width} 120 L0 120 Z`}
          fill="#FF6300"
          fillOpacity={0.18}
        />
        {/* Front wave – solid orange */}
        <Path
          d={`M0 80 Q${width * 0.3} 30 ${width * 0.6} 75 Q${width * 0.8} 105 ${width} 70 L${width} 120 L0 120 Z`}
          fill="url(#wg)"
          fillOpacity={0.85}
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
  },
  svg: {},
});
