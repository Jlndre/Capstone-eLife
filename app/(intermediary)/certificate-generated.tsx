import { Routes } from "@/constants/routes"; // Import routes
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Easing,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useVerificationSuccess } from "../../hooks/useVerificationSuccess";

const { width, height } = Dimensions.get("window");

const CertificateGeneratedScreen = () => {
  const router = useRouter();
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const [showButton, setShowButton] = useState(false);
  const [localProcessing, setLocalProcessing] = useState(false);
  const { handleLifeCertificateViewed, isProcessing, error } =
    useVerificationSuccess();

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
      setTimeout(() => setShowButton(true), 500);
    });
  }, []);

  const handleViewCertificate = async () => {
    try {
      setLocalProcessing(true);

      console.log("Calling handleLifeCertificateViewed");
      await handleLifeCertificateViewed();
      console.log("handleLifeCertificateViewed completed successfully");

      console.log(`Navigating to: ${Routes.PensionHistory}`);
      router.push(Routes.PensionHistory);
    } catch (err) {
      console.error("Error in handleViewCertificate:", err);
      Alert.alert(
        "Error",
        "There was a problem preparing your Life Certificate. Please try again.",
        [{ text: "OK" }]
      );
    } finally {
      setLocalProcessing(false);
    }
  };

  const isButtonDisabled = isProcessing || localProcessing;

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
      <Text style={styles.text}>
        Your Life has been verified! Certificate has been generated
        successfully.
      </Text>

      {showButton && (
        <TouchableOpacity
          style={[styles.viewButton, isButtonDisabled && styles.disabledButton]}
          onPress={handleViewCertificate}
          disabled={isButtonDisabled}
        >
          {isButtonDisabled ? (
            <View style={styles.buttonContent}>
              <ActivityIndicator size="small" color="#FFFFFF" />
              <Text style={styles.viewButtonText}>Processing...</Text>
            </View>
          ) : (
            <Text style={styles.viewButtonText}>
              Click here to view Life Certificate
            </Text>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
};

export default CertificateGeneratedScreen;

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
    marginBottom: 30,
  },
  viewButton: {
    marginTop: 20,
    backgroundColor: "#1F245E",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 25,
    elevation: 3,
  },
  disabledButton: {
    backgroundColor: "#555",
    opacity: 0.8,
  },
  viewButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 16,
    textAlign: "center",
  },
  buttonContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
});
