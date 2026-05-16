import React from "react";
import { View, StyleSheet, useWindowDimensions } from "react-native";
import Svg, { Path } from "react-native-svg";

type WaveBackgroundProps = {
  waveColor?: string;
  backgroundColor?: string;
};

/**
 * Background with a solid top color and a wavy bottom section.
 */
export const BrushBackground: React.FC<WaveBackgroundProps> = ({
  waveColor = "#FFFFFF",
  backgroundColor = "#FFC220",
}) => {
  const { width, height } = useWindowDimensions();
  const waveStartY = height * 0.55;

  return (
    <View style={StyleSheet.absoluteFill}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor }]} />
      <Svg height={height} width={width} style={StyleSheet.absoluteFill}>
        <Path
          d={`
            M0,${waveStartY + 30}
            Q${width * 0.25},${waveStartY - 20}
             ${width * 0.5},${waveStartY + 10}
            Q${width * 0.75},${waveStartY + 50}
             ${width},${waveStartY}
            L${width},${height}
            L0,${height}
            Z
          `}
          fill={waveColor}
        />
      </Svg>
    </View>
  );
};
