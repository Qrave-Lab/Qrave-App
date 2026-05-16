// app/index.js
import React, { useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Dimensions,
  FlatList,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { BrushBackground } from "../components/ui/BrushBackground";

const { width, height } = Dimensions.get("window");

const Colors = {
  primary: "#FFC220",
  black: "#000000",
  white: "#FFFFFF",
  backgroundSplash: "#FFC220",
  textPrimary: "#000000",
  textMuted: "#BDBDBD",
  buttonPrimary: "#000000",
};

const Spacing = {
  sm: 8,
  md: 12,
  lg: 20,
  xl: 32,
};

const Typography = {
  xs: 12,
  sm: 13,
  base: 15,
  lg: 17,
  xl: 20,
  "2xl": 24,
  "3xl": 28,
  "4xl": 34,
};

const BorderRadius = {
  sm: 8,
};

const slides = [
  {
    id: "1",
    lines: ["Bringing", "Happiness with", "delicious food is", "our goal."],
    description: "",
  },
  {
    id: "2",
    lines: ["Scan &", "Explore"],
    description:
      "Simply scan the QR code at your table to instantly access the complete menu on your device",
  },
  {
    id: "3",
    lines: ["Browse", "Menus"],
    description:
      "Discover detailed dish descriptions, prices, and beautiful photos to make the perfect choice",
  },
];

const WAVE_START_PERCENT = 0.55;
const PLATE_SIZE = width * 0.65;

export default function SplashScreen() {
  const router = useRouter();
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef(null);

  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    if (viewableItems.length > 0 && viewableItems[0].index !== null) {
      setCurrentIndex(viewableItems[0].index);
    }
  }).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
  }).current;

  const handleNext = () => {
    if (currentIndex < slides.length - 1) {
      flatListRef.current?.scrollToIndex({
        index: currentIndex + 1,
        animated: true,
      });
    } else {
      router.push("/login");
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      flatListRef.current?.scrollToIndex({
        index: currentIndex - 1,
        animated: true,
      });
    }
  };

  const renderSlide = ({ item }) => (
    <View style={styles.slide}>
      <SafeAreaView style={styles.topSection}>
        <View style={styles.topBar}>
          <Text style={styles.brandName}>QRAVE</Text>
        </View>

        <View style={styles.textContainer}>
          {item.lines.map((line, lineIndex) => (
            <Text key={lineIndex} style={styles.title}>
              {line}
            </Text>
          ))}

          {item.description ? (
            <Text style={styles.description}>{item.description}</Text>
          ) : null}
        </View>
      </SafeAreaView>
    </View>
  );

  return (
    <View style={styles.container}>
      <BrushBackground />

      <FlatList
        ref={flatListRef}
        data={slides}
        renderItem={renderSlide}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        style={styles.flatList}
        getItemLayout={(_, index) => ({
          length: width,
          offset: width * index,
          index,
        })}
        bounces={false}
        scrollEventThrottle={16}
        decelerationRate="fast"
      />

      <View pointerEvents="box-none" style={styles.overlayContainer}>
        <View pointerEvents="none" style={styles.heroImageWrapper}>
          <Image
            source={require("../assets/images/splash-hero.png")}
            style={styles.heroImage}
            contentFit="contain"
          />
        </View>

        <SafeAreaView edges={["bottom"]} style={styles.bottomSection} pointerEvents="box-none">
          <View style={styles.indicatorContainer}>
            {slides.map((_, index) => (
              <View
                key={index}
                style={[
                  styles.indicator,
                  currentIndex === index && styles.indicatorActive,
                ]}
              />
            ))}
          </View>

          <Pressable
            style={styles.primaryButton}
            onPress={() => router.push("/login")}
          >
            <Text style={styles.primaryButtonText}>Phone number or email</Text>
          </Pressable>

          <View style={styles.navRow}>
            {currentIndex > 0 ? (
              <Pressable style={styles.navButton} onPress={handlePrevious}>
                <Text style={styles.prevText}>{"<- Previous"}</Text>
              </Pressable>
            ) : (
              <View style={styles.navButton} />
            )}

            <Pressable style={styles.navButton} onPress={handleNext}>
              <Text style={styles.nextText}>
                {currentIndex === slides.length - 1
                  ? "Get Started ->"
                  : "Next ->"}
              </Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.backgroundSplash,
  },
  flatList: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 2,
  },
  slide: {
    width: width,
    height: height,
  },
  topSection: {
    flex: 1,
  },
  topBar: {
    paddingTop: Spacing.md,
    paddingHorizontal: Spacing.lg,
    alignItems: "center",
  },
  brandName: {
    fontSize: Typography["4xl"],
    fontWeight: "800",
    color: Colors.textPrimary,
    letterSpacing: 2,
  },
  textContainer: {
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.md,
  },
  title: {
    fontSize: Typography["3xl"],
    fontWeight: "800",
    color: Colors.textPrimary,
    lineHeight: Typography["3xl"] * 1.3,
  },
  description: {
    fontSize: Typography.xl,
    fontWeight: "700",
    color: Colors.textPrimary,
    lineHeight: Typography.xl * 1.4,
    marginTop: Spacing.md,
  },
  overlayContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 5,
  },
  heroImageWrapper: {
    position: "absolute",
    top: height * WAVE_START_PERCENT - PLATE_SIZE / 2,
    left: (width - PLATE_SIZE) / 2,
    width: PLATE_SIZE,
    height: PLATE_SIZE,
    zIndex: 5,
  },
  heroImage: {
    width: "100%",
    height: "100%",
  },
  bottomSection: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
    alignItems: "center",
    zIndex: 10,
  },
  indicatorContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  indicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.textMuted,
  },
  indicatorActive: {
    width: 24,
    backgroundColor: Colors.primary,
  },
  primaryButton: {
    backgroundColor: Colors.buttonPrimary,
    paddingVertical: Spacing.md + 4,
    paddingHorizontal: Spacing.xl * 1.5,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    width: "100%",
    maxWidth: 300,
  },
  primaryButtonText: {
    color: Colors.white,
    fontWeight: "600",
    fontSize: Typography.base,
  },
  navRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.md,
  },
  navButton: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    minWidth: 80,
  },
  prevText: {
    color: Colors.textPrimary,
    fontWeight: "500",
    fontSize: Typography.base,
  },
  nextText: {
    color: Colors.textPrimary,
    fontWeight: "600",
    fontSize: Typography.base,
    textAlign: "right",
  },
});
