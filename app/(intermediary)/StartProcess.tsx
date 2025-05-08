import { Images } from "@/assets/images";
import { Routes } from "@/constants/routes";
import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React from "react";
import {
  Dimensions,
  Image,
  ImageBackground,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const screenWidth = Dimensions.get("window").width;
const screenHeight = Dimensions.get("window").height;

export default function ProofStepsScreen() {
  const router = useRouter();

  return (
    <>
      <StatusBar style="light" translucent backgroundColor="transparent" />
      <ImageBackground
        source={Images.IntermediaryBackground}
        style={styles.backgroundImage}
        resizeMode="cover"
      >
        <SafeAreaView style={styles.safeArea}>
          {/* Sleek Back Button */}
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.replace("/(tabs)/Dashboard")}
            activeOpacity={0.7}
          >
            <MaterialIcons name="arrow-back" size={28} color="#0B1741" />
          </TouchableOpacity>

          <View style={styles.contentContainer}>
            {/* Logo */}
            <Image
              source={Images.ElifeLogoTransparent}
              style={styles.logo}
              resizeMode="contain"
            />

            {/* Title */}
            <Text style={styles.header}>Start Your Proof of Life Process</Text>

            {/* Step 1 */}
            <View style={styles.stepContainer}>
              <Text style={styles.stepTitle}>Step 1: Upload a Valid ID</Text>
              <Text style={styles.stepDesc}>
                Submit a valid form of identification such as your Driver's
                License, Passport, NIDS or Electoral ID.
              </Text>
              <Text style={styles.stepSubtext}>
                Accepted file formats: PNG, JPG, JPEG.
              </Text>
            </View>

            {/* Step 2 */}
            <View style={styles.stepContainer}>
              <Text style={styles.stepTitle}>Step 2: Facial Verification</Text>
              <Text style={styles.stepDesc}>
                Ensure you're in a well-lit space, dressed appropriately, and in
                front of a plain background. This step includes a face scan
                using our secure AI system.
              </Text>
              <Text style={styles.stepDesc}>
                You'll also join a secure Zoom call with an AGD agent for final
                verification.
              </Text>
            </View>

            {/* Proceed Button */}
            <TouchableOpacity
              style={styles.proceedBtn}
              activeOpacity={0.8}
              onPress={() => router.push(Routes.Step1UploadID)}
            >
              <Text style={styles.proceedText}>I'm Ready to Begin</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </ImageBackground>
    </>
  );
}

const styles = StyleSheet.create({
  backgroundImage: {
    flex: 1,
    width: screenWidth,
    height: screenHeight,
  },
  safeArea: {
    flex: 1,
  },
  backButton: {
    position: "absolute",
    top: 16,
    left: 16,
    zIndex: 1,
    padding: 10,
    marginTop: 45,
    elevation: 4,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
  },
  contentContainer: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 24,
    justifyContent: "flex-start",
  },
  logo: {
    width: 130,
    height: 130,
    alignSelf: "center",
    marginBottom: 30,
  },
  header: {
    fontSize: 30,
    fontWeight: "bold",
    color: "#0B1741",
    marginBottom: 59,
    textAlign: "left",
  },
  stepContainer: {
    marginBottom: 18,
  },
  stepTitle: {
    fontSize: 25,
    fontWeight: "700",
    color: "#1F245E",
    marginBottom: 8,
  },
  stepDesc: {
    fontSize: 15,
    color: "#444",
    lineHeight: 22,
    marginBottom: 6,
  },
  stepSubtext: {
    fontSize: 14,
    color: "#666",
    fontStyle: "italic",
    marginTop: 4,
  },
  proceedBtn: {
    backgroundColor: "#1F245E",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 70,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  proceedText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "600",
  },
});
