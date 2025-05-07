import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
  ImageBackground,
  Pressable,
  Platform,
  ScrollView,
  Alert,
  Linking,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Ionicons, MaterialIcons, FontAwesome5 } from "@expo/vector-icons";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import SideMenuDrawer from "../../components/SideMenu";
import { useRouter } from "expo-router";

const screenWidth = Dimensions.get("window").width;

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const [isDrawerVisible, setDrawerVisible] = useState(false);
  const [isCurrentQuarterCompleted, setIsCurrentQuarterCompleted] =
    useState(false); // 🆕 simulate state from dashboard
  const router = useRouter();

  const handleProofOfLifePress = () => {
    if (!isCurrentQuarterCompleted) {
      router.push("/StartProcess");
    } else {
      Alert.alert(
        "No Verification Needed",
        "You don’t have any current certificates to verify.",
        [{ text: "OK", style: "cancel" }]
      );
    }
  };

  return (
    <>
      <StatusBar style="light" translucent backgroundColor="transparent" />
      <ImageBackground
        source={require("../../assets/images/Dashboard.png")}
        style={styles.backgroundImage}
        resizeMode="cover"
      >
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.headerIcons}>
            <Pressable onPress={() => setDrawerVisible(true)}>
              <Text style={styles.hamburger}>☰</Text>
            </Pressable>
            <Image
              source={require("../../assets/images/profilepic.png")}
              style={styles.profilePic}
            />
          </View>

          <View style={styles.headerTextContainer}>
            <Text style={styles.headerTitle}>Home</Text>
            <Text style={styles.welcomeText}>Welcome back, John Brown!</Text>
          </View>

          <ScrollView
            style={styles.scrollView}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollViewContent}
          >
            <View style={styles.cardRow}>
              <TouchableOpacity
                style={[styles.dashboardCard, styles.card1]}
                onPress={() => router.push("/PensionHistory")}
              >
                <MaterialIcons name="history" size={32} color="#1F245E" />
                <Text style={styles.cardTitle}>Pension History</Text>
                <Text style={styles.cardSubtitle}>
                  View your payment records
                </Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.dashboardCard, styles.card2]}>
                <MaterialIcons
                  name="play-circle-outline"
                  size={32}
                  color="#1F245E"
                />
                <Text style={styles.cardTitle}>Tutorial</Text>
                <Text style={styles.cardSubtitle}>
                  Learn how to use the app
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.quickActionsContainer}>
              <Text style={styles.sectionTitle}>Quick Actions</Text>

              <View style={styles.quickActionsRow}>
                <TouchableOpacity style={styles.quickActionButton}>
                  <MaterialIcons
                    name="account-balance"
                    size={24}
                    color="#1F245E"
                  />
                  <Text style={styles.quickActionText}>Bank Details</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.quickActionButton}
                  onPress={() =>
                    Linking.openURL("https://www.treasury.gov.jm/faqs/")
                  }
                >
                  <MaterialIcons
                    name="contact-support"
                    size={24}
                    color="#1F245E"
                  />
                  <Text style={styles.quickActionText}>Support</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.quickActionButton}
                  onPress={() => router.push("/Settings")}
                >
                  <MaterialIcons name="settings" size={24} color="#1F245E" />
                  <Text style={styles.quickActionText}>Settings</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Important Links */}
            <View style={styles.actionsContainer}>
              <Text style={styles.sectionTitle}>Important Links</Text>

              <TouchableOpacity
                style={[
                  styles.navButton,
                  isCurrentQuarterCompleted && { backgroundColor: "#ccc" },
                ]}
                onPress={handleProofOfLifePress}
                disabled={isCurrentQuarterCompleted}
              >
                <View style={styles.buttonContent}>
                  <Ionicons
                    name="finger-print-outline"
                    size={24}
                    color="white"
                  />
                  <Text style={styles.navButtonText}>
                    Proof of Life Process
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#8C9EFF" />
              </TouchableOpacity>

              <TouchableOpacity style={styles.navButton}>
                <View style={styles.buttonContent}>
                  <MaterialIcons name="calculate" size={24} color="white" />
                  <Text style={styles.navButtonText}>Benefit Calculator</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#8C9EFF" />
              </TouchableOpacity>

              <TouchableOpacity style={styles.navButton}>
                <View style={styles.buttonContent}>
                  <MaterialIcons name="event" size={24} color="white" />
                  <Text style={styles.navButtonText}>Payment Schedule</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#8C9EFF" />
              </TouchableOpacity>
            </View>

            {/* Decorative Element */}
            <View style={styles.decorativeElement}>
              <View style={styles.decorativeLine} />
              <Text style={styles.decorativeText}>Pension Portal</Text>
              <View style={styles.decorativeLine} />
            </View>

            {/* Add extra padding at the bottom to ensure all content is visible above tab bar */}
            <View style={{ paddingBottom: tabBarHeight + 20 }} />
          </ScrollView>
          <SideMenuDrawer
            visible={isDrawerVisible}
            onClose={() => setDrawerVisible(false)}
          />
        </SafeAreaView>
      </ImageBackground>
    </>
  );
}

const styles = StyleSheet.create({
  backgroundImage: {
    flex: 1,
    width: screenWidth,
    backgroundColor: "#F6F6F6",
  },
  safeArea: {
    paddingHorizontal: 16,
    flex: 1,
  },
  headerIcons: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10,
  },
  hamburger: {
    fontSize: 30,
    color: "#fff",
  },
  profilePic: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: "#fff",
  },
  headerTextContainer: {
    marginTop: 20,
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#0B1741",
  },
  welcomeText: {
    color: "#808080",
    fontSize: 16,
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    paddingBottom: 20,
  },
  cardRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  dashboardCard: {
    width: "48%",
    borderRadius: 16,
    padding: 20,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  card1: {
    backgroundColor: "#F0F4FF",
  },
  card2: {
    backgroundColor: "#F5F7FA",
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1F245E",
    marginTop: 15,
    textAlign: "center",
  },
  cardSubtitle: {
    fontSize: 14,
    color: "#666",
    marginTop: 5,
    textAlign: "center",
  },
  quickActionsContainer: {
    marginBottom: 20,
  },
  quickActionsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  quickActionButton: {
    alignItems: "center",
    width: "30%",
    padding: 15,
    borderRadius: 12,
    backgroundColor: "#F5F7FA",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  quickActionText: {
    fontSize: 14,
    color: "#1F245E",
    marginTop: 8,
    fontWeight: "500",
    textAlign: "center",
  },
  actionsContainer: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0B1741",
    marginBottom: 16,
  },
  navButton: {
    backgroundColor: "#1F245E",
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
    elevation: 3,
    shadowColor: "#1F245E",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    borderLeftWidth: 4,
    borderLeftColor: "#8C9EFF",
  },
  buttonContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  navButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 12,
  },
  decorativeElement: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 15,
    marginBottom: 10,
  },
  decorativeLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#E0E0E0",
  },
  decorativeText: {
    color: "#888",
    paddingHorizontal: 10,
    fontSize: 14,
    fontWeight: "500",
  },
});
