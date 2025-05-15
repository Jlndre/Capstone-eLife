import { Images } from "@/assets/images";
import { Routes } from "@/constants/routes";
import { useRouter } from "expo-router";
import React, { useEffect, useRef } from "react";
import {
  Animated,
  Dimensions,
  ImageBackground,
  StyleSheet,
  Text,
  View,
} from "react-native";

const { width, height } = Dimensions.get("window");

const ApprovalPendingScreen = () => {
  const router = useRouter();

  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animate = (dot: Animated.Value, delay: number) => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(dot, {
            toValue: -8,
            duration: 400,
            delay,
            useNativeDriver: true,
          }),
          Animated.timing(dot, {
            toValue: 0,
            duration: 400,
            useNativeDriver: true,
          }),
        ])
      ).start();
    };

    animate(dot1, 0);
    animate(dot2, 200);
    animate(dot3, 400);

    const timer = setTimeout(() => {
      const uploadSuccess = Math.random() < 0.85;

      if (uploadSuccess) {
        router.replace(Routes.UploadSuccess);
      } else {
        router.replace(Routes.UploadError);
      }
    }, 3500);

    return () => clearTimeout(timer);
  }, []);

  return (
    <ImageBackground
      source={Images.IntermediaryBackground}
      style={styles.container}
      resizeMode="cover"
    >
      <Text style={styles.text}>
        Please wait while we approve your submission.
      </Text>
      <View style={styles.dotsContainer}>
        <Animated.View
          style={[styles.dot, { transform: [{ translateY: dot1 }] }]}
        />
        <Animated.View
          style={[styles.dot, { transform: [{ translateY: dot2 }] }]}
        />
        <Animated.View
          style={[styles.dot, { transform: [{ translateY: dot3 }] }]}
        />
      </View>
    </ImageBackground>
  );
};

export default ApprovalPendingScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  text: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1F245E",
    textAlign: "center",
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  dotsContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    backgroundColor: "#1F245E",
    borderRadius: 4,
    marginHorizontal: 4,
  },
});
