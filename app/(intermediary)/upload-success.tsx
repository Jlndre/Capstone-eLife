import { Routes } from "@/constants/routes";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const { width, height } = Dimensions.get("window");

const UploadSuccessScreen = () => {
  const router = useRouter();
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const [showButton, setShowButton] = useState(false);

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        friction: 5,
        tension: 80,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
        easing: Easing.out(Easing.exp),
      }),
    ]).start(() => {
      // Show button after animation completes
      setTimeout(() => setShowButton(true), 500);
    });
  }, []);

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.iconWrapper,
          { opacity: opacityAnim, transform: [{ scale: scaleAnim }] },
        ]}
      >
        <View style={styles.dashedCircle}>
          <Ionicons name="checkmark" size={64} color="#1F245E" />
        </View>
      </Animated.View>
      <Text style={styles.text}>Photo ID Uploaded Successfully!</Text>

      {showButton && (
        <TouchableOpacity
          style={styles.nextButton}
          onPress={() => router.replace(Routes.Step2Verification)}
        >
          <Text style={styles.nextButtonText}>Next</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

export default UploadSuccessScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#C1C6F7",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  iconWrapper: {
    marginBottom: 24,
  },
  dashedCircle: {
    borderWidth: 2,
    borderColor: "#1F245E",
    borderStyle: "dashed",
    borderRadius: 100,
    width: 120,
    height: 120,
    alignItems: "center",
    justifyContent: "center",
  },
  text: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1F245E",
    textAlign: "center",
  },
  nextButton: {
    position: "absolute",
    bottom: 40,
    right: 20,
    backgroundColor: "#fff",
    paddingVertical: 12,
    paddingHorizontal: 26,
    borderRadius: 10,
    elevation: 3,
  },
  nextButtonText: {
    color: "#1F245E",
    fontWeight: "600",
    fontSize: 16,
  },
});
