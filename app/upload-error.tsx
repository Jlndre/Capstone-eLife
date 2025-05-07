import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Animated,
  TouchableOpacity,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

const { width, height } = Dimensions.get("window");

const UploadErrorScreen = () => {
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const router = useRouter();

  useEffect(() => {
    Animated.sequence([
      Animated.timing(shakeAnim, {
        toValue: 10,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: -10,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: 6,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: -6,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: 0,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.iconWrapper}>
        <Animated.View style={{ transform: [{ translateX: shakeAnim }] }}>
          <Ionicons name="close" size={60} color="#D63B3B" />
        </Animated.View>
      </View>
      <Text style={styles.text}>I'm sorry but this Upload Failed.</Text>

      <TouchableOpacity
        style={styles.tryAgainButton}
        onPress={() => router.replace("/step1-upload-id")}
      >
        <Text style={styles.tryAgainText}>Please Try Again</Text>
      </TouchableOpacity>
    </View>
  );
};

export default UploadErrorScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#D63B3B",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  iconWrapper: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
    borderColor: "#fff",
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  text: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 20,
  },
  tryAgainButton: {
    backgroundColor: "#fff",
    paddingVertical: 12,
    paddingHorizontal: 40,
    borderRadius: 30,
  },
  tryAgainText: {
    color: "#D63B3B",
    fontWeight: "bold",
    fontSize: 16,
  },
});
