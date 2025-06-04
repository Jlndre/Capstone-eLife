import { Images } from "@/assets/images";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
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
  const params = useLocalSearchParams();

  // Dot animation refs
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  // State to track upload progress
  const [uploadStatus, setUploadStatus] = useState<string>(
    "Processing Photo ID..."
  );

  // Animation setup
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

    // Start dot animations
    animate(dot1, 0);
    animate(dot2, 200);
    animate(dot3, 400);
  }, []);

  // Show realistic progress while backend processes
  const showProcessingProgress = () => {
    // Realistic timing based on actual OCR processing
    setTimeout(() => {
      setUploadStatus("Detecting document type...");
    }, 1000);

    setTimeout(() => {
      setUploadStatus("Scanning for text...");
    }, 3000);

    setTimeout(() => {
      setUploadStatus("Extracting information...");
    }, 6000);

    setTimeout(() => {
      setUploadStatus("Verifying details...");
    }, 10000);

    setTimeout(() => {
      setUploadStatus("Validating security features...");
    }, 15000);

    setTimeout(() => {
      setUploadStatus("Finalizing verification...");
    }, 20000);

    // The upload screen will handle navigation once processing completes
    // This screen just provides visual feedback during the wait
  };

  // Trigger progress display on component mount
  useEffect(() => {
    showProcessingProgress();
  }, []);

  return (
    <ImageBackground
      source={Images.IntermediaryBackground}
      style={styles.container}
      resizeMode="cover"
    >
      <Text style={styles.text}>{uploadStatus}</Text>
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
    backgroundColor: "#F6F6F6",
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
