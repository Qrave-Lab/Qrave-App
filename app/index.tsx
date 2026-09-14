import React, { useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Dimensions,
  FlatList,
  ImageBackground,
  Image,
  type ViewToken,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

const Colors = {
  primary: "#FF6300",
  white: "#FFFFFF",
  black: "#000000",
  textPrimary: "#FFFFFF",
  textSecondary: "#E5E7EB",
};

interface Slide {
  id: string;
  title: string;
  description: string;
  image: any;
}

const slides: Slide[] = [
  {
    id: "1",
    title: "Get inspired",
    description: "Discover delicious recipes and stunning food stories.",
    image: require("../assets/images/board1.jpg"),
  },
  {
    id: "2",
    title: "Scan & Explore",
    description: "Instantly access the complete menu on your device.",
    image: require("../assets/images/board2.jpg"),
  },
  {
    id: "3",
    title: "Order easily",
    description: "Make the perfect choice and order directly from your phone.",
    image: require("../assets/images/board3.jpg"),
  },
];

export default function SplashScreen() {
  const router = useRouter();
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList<Slide>>(null);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index !== null) {
        setCurrentIndex(viewableItems[0].index!);
      }
    }
  ).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
  }).current;

  const handleSkip = () => {
    router.replace("/login");
  };

  const handleNext = () => {
    if (currentIndex < slides.length - 1) {
      flatListRef.current?.scrollToIndex({
        index: currentIndex + 1,
        animated: true,
      });
    } else {
      router.replace("/login");
    }
  };

  const renderSlide = ({ item }: { item: Slide }) => {
    return (
      <ImageBackground
        source={item.image}
        style={styles.slide}
        resizeMode="cover"
      >
        <LinearGradient
          colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.6)", "rgba(0,0,0,0.92)"]}
          style={StyleSheet.absoluteFillObject}
          pointerEvents="none"
        />
      </ImageBackground>
    );
  };

  return (
    <View style={styles.container}>
      {/* ── SWIPEABLE BACKGROUND SLIDES ── */}
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
        bounces={false}
        initialNumToRender={3}
        getItemLayout={(_, index) => ({
          length: SCREEN_WIDTH,
          offset: SCREEN_WIDTH * index,
          index,
        })}
        style={StyleSheet.absoluteFillObject}
      />

      {/* ── OVERLAY UI (Logo, Skip, Text, Dots, Button) ── */}
      <SafeAreaView style={styles.safeArea} pointerEvents="box-none">
        {/* Top Header */}
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <Image
              source={require("../assets/images/logo.png")}
              style={styles.logoImage}
              resizeMode="contain"
              accessibilityLabel="QRAVE Logo"
            />
          </View>
          <View style={styles.skipContainer}>
            <Pressable onPress={handleSkip} hitSlop={15}>
              <Text style={styles.skipText}>Skip</Text>
            </Pressable>
          </View>
        </View>

        {/* Spacer pushes footer to bottom */}
        <View style={{ flex: 1 }} pointerEvents="none" />

        {/* Slide text */}
        <View style={styles.textContainer} pointerEvents="none">
          <Text style={styles.title}>{slides[currentIndex].title}</Text>
          <Text style={styles.description}>{slides[currentIndex].description}</Text>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
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
            onPress={handleNext}
            accessibilityRole="button"
            accessibilityLabel={
              currentIndex === slides.length - 1 ? "Get Started" : "Next"
            }
          >
            <Text style={styles.primaryButtonText}>
              {currentIndex === slides.length - 1 ? "Get started" : "Next"}
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.black,
  },
  slide: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  safeArea: {
    flex: 1,
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  header: {
    width: "100%",
    height: 80,
    position: "relative",
  },
  logoContainer: {
    position: "absolute",
    left: -70,
    top: 1,
  },
  logoImage: {
    width: 250,
    height: 90,
  },
  skipContainer: {
    position: "absolute",
    right: 24,
    top: 35,
  },
  skipText: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.white,
  },
  textContainer: {
    paddingHorizontal: 30,
    paddingBottom: 12,
    alignItems: "center",
  },
  title: {
    fontSize: 32,
    fontWeight: "800",
    color: Colors.textPrimary,
    textAlign: "center",
    marginBottom: 12,
    letterSpacing: -0.5,
  },
  description: {
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 24,
  },
  footer: {
    paddingHorizontal: 30,
    paddingBottom: 20,
    gap: 20,
  },
  indicatorContainer: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  indicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.4)",
  },
  indicatorActive: {
    width: 24,
    backgroundColor: Colors.white,
  },
  primaryButton: {
    backgroundColor: Colors.primary,
    borderRadius: 30,
    paddingVertical: 16,
    alignItems: "center",
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.white,
  },
});
