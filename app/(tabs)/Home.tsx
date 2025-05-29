import { Images, ProfileInitials } from "@/assets/images";
import { Routes } from "@/constants/routes";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useState } from "react";
import {
  Alert,
  Dimensions,
  Image,
  ImageBackground,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import SideMenuDrawer from "../../components/SideMenu";

const screenWidth = Dimensions.get("window").width;

type ProfileData = {
  id: string | number;
  username: string;
  email: string;
  pensioner_number: string;
  details: {
    firstname: string;
    lastname: string;
    dob: string | null;
    trn: string | null;
    nids_num: string | null;
    passport_num: string | null;
    contact_num: string | null;
    address: string | null;
  };
};

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const [isDrawerVisible, setDrawerVisible] = useState(false);
  const [isCurrentQuarterCompleted, setIsCurrentQuarterCompleted] =
    useState(false);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const router = useRouter();

  // Clear cached profile data when component mounts
  useEffect(() => {
    const clearCachedData = async () => {
      try {
        await SecureStore.deleteItemAsync("cachedProfile");
        console.log("HomeScreen: Cleared cached profile data");
      } catch (err) {
        console.error("Failed to clear cached data:", err);
      }
    };
    clearCachedData();
  }, []);

  useEffect(() => {
    const fetchProfile = async () => {
      setLoading(true);
      setError("");

      try {
        // Get the token
        const token = await SecureStore.getItemAsync("jwt");
        if (!token) {
          console.error("HomeScreen: No token found, redirecting to login");
          router.replace(Routes.Login);
          return;
        }

        // Get the current user ID for verification
        const currentUserId = await SecureStore.getItemAsync("currentUserId");
        console.log("HomeScreen: Current user ID from storage:", currentUserId);

        // Add cache buster to prevent caching
        const cacheBuster = new Date().getTime();

        // Fetch with cache control headers
        const response = await fetch(
          `https://879c-63-143-118-227.ngrok-free.app/profile?t=${cacheBuster}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Cache-Control": "no-cache, no-store, must-revalidate",
              Pragma: "no-cache",
              Expires: "0",
            },
          }
        );

        if (!response.ok) {
          if (response.status === 401) {
            console.error("HomeScreen: Token invalid, redirecting to login");
            await SecureStore.deleteItemAsync("jwt");
            router.replace(Routes.Login);
            return;
          }
          throw new Error(`Server responded with ${response.status}`);
        }

        const data = await response.json();
        console.log("HomeScreen: Profile data loaded:", JSON.stringify(data));
        console.log("HomeScreen: Profile ID type:", typeof data.id);

        // Verify user ID if we have a stored ID
        if (currentUserId && String(data.id) !== String(currentUserId)) {
          console.error(
            `HomeScreen: User ID mismatch! Stored ID: ${currentUserId}, Profile ID: ${
              data.id
            }, Types: ${typeof currentUserId}, ${typeof data.id}`
          );
          setError(
            "Account mismatch detected. Please log out and log in again."
          );

          // Force logout if IDs don't match
          Alert.alert(
            "Authentication Error",
            "There was a problem with your account. Please log in again.",
            [
              {
                text: "Log Out",
                onPress: async () => {
                  await handleLogout();
                },
              },
            ],
            { cancelable: false }
          );
          return;
        }

        // Store user ID if not already stored
        if (!currentUserId) {
          await SecureStore.setItemAsync("currentUserId", String(data.id));
          console.log("HomeScreen: Stored new user ID:", String(data.id));
        }

        // Set the profile data
        setProfile(data);
      } catch (err) {
        console.error("HomeScreen: Failed to load profile", err);
        setError("Failed to load profile data");

        Alert.alert(
          "Error",
          "Failed to load your profile information. Please try again.",
          [
            { text: "Try Again", onPress: () => fetchProfile() },
            {
              text: "Log Out",
              onPress: async () => {
                await handleLogout();
              },
            },
          ]
        );
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, []);

  const handleLogout = async () => {
    try {
      console.log("HomeScreen: Logging out...");

      // Try to call logout API if available
      const token = await SecureStore.getItemAsync("jwt");
      if (token) {
        try {
          console.log("HomeScreen: Calling logout API");
          await fetch(
            "https://879c-63-143-118-227.ngrok-free.app/auth/logout",
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
              },
            }
          );
        } catch (apiError) {
          console.error("HomeScreen: Logout API call failed:", apiError);
          // Continue with local logout even if API call fails
        }
      }

      // Clear all stored data
      console.log("HomeScreen: Clearing local storage");
      await SecureStore.deleteItemAsync("jwt");
      await SecureStore.deleteItemAsync("currentUserId");
      await SecureStore.deleteItemAsync("cachedProfile");
      await SecureStore.deleteItemAsync("termsAccepted");

      // Navigate to login
      console.log("HomeScreen: Navigating to login");
      router.replace(Routes.Login);
    } catch (error) {
      console.error("HomeScreen: Logout error:", error);
      // Force navigate to login even if errors occur
      router.replace(Routes.Login);
    }
  };

  const handleProofOfLifePress = () => {
    if (!isCurrentQuarterCompleted) {
      router.push(Routes.StartProcess);
    } else {
      Alert.alert(
        "No Verification Needed",
        "You don't have any current certificates to verify.",
        [{ text: "OK", style: "cancel" }]
      );
    }
  };

  // Get profile image based on first name initial
  const getProfileImage = () => {
    if (loading || !profile || !profile.details || !profile.details.firstname) {
      return Images.ProfilePicAlt;
    }

    const letter = profile.details.firstname.charAt(0).toUpperCase();
    console.log("HomeScreen: Using profile image for letter:", letter);
    return ProfileInitials[letter] || Images.ProfilePicAlt;
  };

  // Force clear all data (for development/debugging)
  const forceCleanStorage = async () => {
    if (__DEV__) {
      await SecureStore.deleteItemAsync("jwt");
      await SecureStore.deleteItemAsync("currentUserId");
      await SecureStore.deleteItemAsync("cachedProfile");
      await SecureStore.deleteItemAsync("termsAccepted");
      console.log("HomeScreen: All storage cleared");
      Alert.alert("Dev Mode", "All storage cleared", [
        { text: "OK", onPress: () => router.replace(Routes.Login) },
      ]);
    }
  };

  return (
    <>
      <StatusBar style="light" translucent backgroundColor="transparent" />
      <ImageBackground
        source={Images.DashboardBackground}
        style={styles.backgroundImage}
        resizeMode="cover"
      >
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.headerIcons}>
            <Pressable onPress={() => setDrawerVisible(true)}>
              <Text style={styles.hamburger}>☰</Text>
            </Pressable>

            {loading ? (
              <View style={styles.profilePic} />
            ) : (
              <Image source={getProfileImage()} style={styles.profilePic} />
            )}

            {__DEV__ && (
              <TouchableOpacity
                style={styles.devButton}
                onPress={forceCleanStorage}
              >
                <Text style={styles.devButtonText}>Reset</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.headerTextContainer}>
            <Text style={styles.headerTitle}>Home</Text>
            {loading ? (
              <Text style={styles.welcomeText}>Loading...</Text>
            ) : error ? (
              <Text style={styles.errorText}>{error}</Text>
            ) : profile && profile.details ? (
              <Text style={styles.welcomeText}>
                Welcome back, {profile.details.firstname}!
              </Text>
            ) : (
              <Text style={styles.welcomeText}>Welcome!</Text>
            )}
          </View>

          <ScrollView
            style={styles.scrollView}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollViewContent}
          >
            <View style={styles.cardRow}>
              <TouchableOpacity
                style={[styles.dashboardCard, styles.card1]}
                onPress={() => router.push(Routes.PensionHistory)}
              >
                <MaterialIcons name="history" size={32} color="#1F245E" />
                <Text style={styles.cardTitle}>Pension History</Text>
                <Text style={styles.cardSubtitle}>
                  View your old certificates
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.dashboardCard, styles.card2]}
                onPress={() =>
                  Linking.openURL(
                    "https://aabishuaa.github.io/eLife-Website/how-it-works.html"
                  )
                }
              >
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
              </View>
            </View>

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
                  <MaterialIcons name="event" size={24} color="white" />
                  <Text style={styles.navButtonText}>Payments</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#8C9EFF" />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.navButton, styles.logoutButton]}
                onPress={handleLogout}
              >
                <View style={styles.buttonContent}>
                  <Ionicons name="log-out-outline" size={24} color="white" />
                  <Text style={styles.navButtonText}>Log Out</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#8C9EFF" />
              </TouchableOpacity>
            </View>

            <View style={styles.decorativeElement}>
              <View style={styles.decorativeLine} />
              <Text style={styles.decorativeText}>Pension Portal</Text>
              <View style={styles.decorativeLine} />
            </View>

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
    backgroundColor: "#CCCCCC", // Placeholder color during loading
  },
  devButton: {
    position: "absolute",
    top: -8,
    right: -8,
    backgroundColor: "#ffcc00",
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 8,
    display: __DEV__ ? "flex" : "none",
  },
  devButtonText: {
    fontSize: 10,
    color: "#000",
    fontWeight: "bold",
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
  errorText: {
    color: "#D32F2F",
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
    flex: 1,
    borderRadius: 16,
    padding: 20,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
    marginHorizontal: 5,
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
    flex: 1,
    marginHorizontal: 5,
    alignItems: "center",
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
  logoutButton: {
    backgroundColor: "#D32F2F", // Red color for logout
    borderLeftColor: "#FF6B6B",
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
