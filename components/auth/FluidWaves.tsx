import React from "react";
import { View, Dimensions } from "react-native";
import Svg, { Path } from "react-native-svg";

const { width } = Dimensions.get("window");

export const TopWaveArt = () => (
  <View style={{ position: "absolute", top: 0, left: 0, right: 0 }} pointerEvents="none">
    <Svg width={width} height={180} viewBox={`0 0 ${width} 180`}>
      <Path
        d={`M0 0 L${width} 0 L${width} 60 C${width * 0.75} 160, ${width * 0.25} 0, 0 100 Z`}
        fill="#FF6300"
        fillOpacity={0.12}
      />
      <Path
        d={`M0 0 L${width} 0 L${width} 40 C${width * 0.75} 130, ${width * 0.25} 10, 0 80 Z`}
        fill="#FF6300"
        fillOpacity={0.08}
      />
    </Svg>
  </View>
);

export const BottomWaveArt = () => (
  <View style={{ position: "absolute", bottom: 0, left: 0, right: 0 }} pointerEvents="none">
    <Svg width={width} height={130} viewBox={`0 0 ${width} 130`}>
      <Path
        d={`M0 130 L${width} 130 L${width} 100 C${width * 0.7} -20, ${width * 0.3} 100, 0 50 Z`}
        fill="#FF6300"
        fillOpacity={0.1}
      />
    </Svg>
  </View>
);
