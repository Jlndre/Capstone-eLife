import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Image,
  SafeAreaView,
} from "react-native";
import { useRouter } from "expo-router";
import Svg, { Path } from "react-native-svg";
import { Ionicons, FontAwesome5 } from "@expo/vector-icons";

const { width, height } = Dimensions.get("window");

const Step2VerificationScreen = () => {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerSection}>
        <Text style={styles.stepTitle}>Step 2: Facial Verification</Text>
        <Text style={styles.instruction}>
          We need to verify your identity to complete the process.
        </Text>
        <View style={styles.curve}>
          <Svg height="100%" width="100%" viewBox="0 0 1440 320">
            <Path
              fill="#FFFFFF"
              d="M0,160L48,170.7C96,181,192,203,288,192C384,181,480,139,576,117.3C672,96,768,96,864,112C960,128,1056,160,1152,160C1248,160,1344,128,1392,112L1440,96L1440,320L0,320Z"
            />
          </Svg>
        </View>
      </View>

      <Image
        source={require("../assets/images/verification-graphic.png")}
        style={styles.illustration}
        resizeMode="contain"
      />

      <View style={styles.card}>
        <View style={styles.guidelineContainer}>
          <Text style={styles.guidelineTitle}>Before you begin:</Text>
          <View style={styles.guidelineItem}>
            <FontAwesome5
              name="lightbulb"
              size={16}
              color="#1F245E"
              style={styles.guidelineIcon}
            />
            <Text style={styles.guidelineText}>
              Ensure you're in a well-lit environment
            </Text>
          </View>
          <View style={styles.guidelineItem}>
            <FontAwesome5
              name="mobile-alt"
              size={16}
              color="#1F245E"
              style={styles.guidelineIcon}
            />
            <Text style={styles.guidelineText}>
              Hold your phone still at eye level
            </Text>
          </View>
          <View style={styles.guidelineItem}>
            <FontAwesome5
              name="user"
              size={16}
              color="#1F245E"
              style={styles.guidelineIcon}
            />
            <Text style={styles.guidelineText}>
              Remove glasses and face coverings
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.verificationButton}
          onPress={() => router.push("/facial-record")}
        >
          <FontAwesome5
            name="user-shield"
            size={22}
            color="#fff"
            style={styles.verificationIcon}
          />
          <Text style={styles.verificationText}>START FACIAL RECOGNITION</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
        <Ionicons
          name="arrow-back"
          size={18}
          color="#1F245E"
          style={styles.backIcon}
        />
        <Text style={styles.backButtonText}>Go back</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
};

export default Step2VerificationScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    alignItems: "center",
  },
  headerSection: {
    width: "100%",
    backgroundColor: "#282C64",
    paddingTop: height * 0.06,
    paddingHorizontal: 20,
    paddingBottom: height * 0.18,
    position: "relative",
  },
  curve: {
    position: "absolute",
    bottom: -50,
    left: 0,
    right: 0,
    height: height * 0.14,
  },
  stepTitle: {
    color: "#fff",
    fontSize: 25,
    fontWeight: "bold",
    marginBottom: 10,
  },
  instruction: {
    color: "#f0f0f0",
    fontSize: 16,
    opacity: 0.9,
    lineHeight: 22,
  },
  illustration: {
    width: width * 0.4,
    height: height * 0.18,
    marginTop: -40,
    marginBottom: 15,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 24,
    width: width * 0.9,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
    marginBottom: 20,
  },
  guidelineContainer: {
    marginBottom: 24,
  },
  guidelineTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1F245E",
    marginBottom: 12,
  },
  guidelineItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },
  guidelineIcon: {
    marginRight: 12,
    padding: 5,
  },
  guidelineText: {
    fontSize: 15,
    color: "#333",
    flex: 1,
  },
  verificationButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1F245E",
    paddingVertical: 16,
    borderRadius: 12,
    elevation: 3,
    shadowColor: "#1F245E",
    shadowOpacity: 0.3,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 3 },
  },
  verificationIcon: {
    marginRight: 12,
    padding: 5,
  },
  verificationText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
    letterSpacing: 0.5,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F0F0F0",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: "auto",
    marginBottom: 30,
    alignSelf: "flex-start",
    marginLeft: 20,
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  backIcon: {
    marginRight: 8,
  },
  backButtonText: {
    color: "#1F245E",
    fontWeight: "600",
    fontSize: 15,
  },
});
