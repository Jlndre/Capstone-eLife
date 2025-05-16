import { Images, ProfileInitials } from "@/assets/images";
import { Routes } from "@/constants/routes";
import { API_BASE_URL } from "@/utils/config";
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

/**
 * User profile data structure
 */
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

/**
 * Quarter verification status data structure
 */
type QuarterStatus = {
  isCompleted: boolean;
  quarter: string;
  dueDate: string;
};

export default function HomeScreen() {
  // Hooks and state
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const router = useRouter();
  
  // UI state
  const [isDrawerVisible, setDrawerVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
  // User data state
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [currentQuarterStatus, setCurrentQuarterStatus] = useState<QuarterStatus>({
    isCompleted: false,
    quarter: "",
    dueDate: "",
  });

  /**
   * Fetch dashboard summary to check quarter verification status
   */
  useEffect(() => {
    const fetchDashboardSummary = async () => {
      try {
        const token = await SecureStore.getItemAsync("jwt");
        if (!token) return;

        const response = await fetch(`${API_BASE_URL}/api/dashboard-summary`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          console.error("Failed to fetch dashboard summary");
          return;
        }

        const data = await response.json();

        // Check if current quarter is completed
        if (data.current) {
          setCurrentQuarterStatus({
            isCompleted: data.current.status === "completed",
            quarter: data.current.quarter,
            dueDate: data.current.due_date,
          });
        }
      } catch (err) {
        console.error("Error fetching dashboard summary:", err);
      }
    };

    fetchDashboardSummary();
  }, []);

  /**
   * Clear cached profile data when component mounts
   */
  useEffect(() => {
    const clearCachedData = async () => {
      try {
        await SecureStore.deleteItemAsync("cachedProfile");
      } catch (err) {
        console.error("Failed to clear cached data:", err);
      }
    };
    clearCachedData();
  }, []);

  /**
   * Fetch user profile data
   */
  useEffect(() => {
    const fetchProfile = async () => {
      setLoading(true);
      setError("");

      try {
        // Get the token
        const token = await SecureStore.getItemAsync("jwt");
        if (!token) {
          router.replace(Routes.Login);
          return;
        }

        // Get the current user ID for verification
        const currentUserId = await SecureStore.getItemAsync("currentUserId");

        // Add cache buster to prevent caching
        const cacheBuster = new Date().getTime();

        // Fetch with cache control headers
        const response = await fetch(
          `${API_BASE_URL}/profile?t=${cacheBuster}`,
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
            await SecureStore.deleteItemAsync("jwt");
            router.replace(Routes.Login);
            return;
          }
          throw new Error(`Server responded with ${response.status}`);
        }

        const data = await response.json();

        // Verify user ID if we have a stored ID
        if (currentUserId && String(data.id) !== String(currentUserId)) {
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
        }

        // Set the profile data
        setProfile(data);
      } catch (err) {
        console.error("Failed to load profile", err);
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
  }, [router]);

  /**
   * Handle user logout
   * Clears all stored data and navigates to login screen
   */
  const handleLogout = async () => {
    try {
      // Try to call logout API if available
      const token = await SecureStore.getItemAsync("jwt");
      if (token) {
        try {
          await fetch(
            `${API_BASE_URL}/auth/logout`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
              },
            }
          );
        } catch (apiError) {
          // Continue with local logout even if API call fails
        }
      }

      // Clear all stored data
      await SecureStore.deleteItemAsync("jwt");
      await SecureStore.deleteItemAsync("currentUserId");
      await SecureStore.deleteItemAsync("cachedProfile");
      await SecureStore.deleteItemAsync("termsAccepted");
      await SecureStore.deleteItemAsync("latest_certificate_id");

      // Navigate to login
      router.replace(Routes.Login);
    } catch (error) {
      console.error("Logout error:", error);
      // Force navigate to login even if errors occur
      router.replace(Routes.Login);
    }
  };

  /**
   * Handle the Proof of Life button press
   * Navigates to verification process or shows alert if already completed
   */
  const handleProofOfLifePress = () => {
    if (!currentQuarterStatus.isCompleted) {
      router.push(Routes.StartProcess);
    } else {
      Alert.alert(
        "Quarter Already Verified",
        `You've already completed verification for ${currentQuarterStatus.quarter}. Your next verification will be due after ${new Date(currentQuarterStatus.dueDate).toLocaleDateString()}.`,
        [{ text: "OK", style: "cancel" }]
      );
    }
  };

  /**
   * Get profile image based on first name initial
   * @returns Image source for the profile picture
   */
  const getProfileImage = () => {
    if (loading || !profile || !profile.details || !profile.details.firstname) {
      return Images.ProfilePicAlt;
    }

    const letter = profile.details.firstname.charAt(0).toUpperCase();
    return ProfileInitials[letter] || Images.ProfilePicAlt;
  };

  /**
   * Force clear all data (for development/debugging only)
   */
  const forceCleanStorage = async () => {
    if (__DEV__) {
      await SecureStore.deleteItemAsync("jwt");
      await SecureStore.deleteItemAsync("currentUserId");
      await SecureStore.deleteItemAsync("cachedProfile");
      await SecureStore.deleteItemAsync("termsAccepted");
      await SecureStore.deleteItemAsync("latest_certificate_id");
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
          {/* Header with menu and profile pic */}
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

          {/* Welcome header */}
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
            {/* Quick access cards */}
            <View style={styles.cardRow}>
              <TouchableOpacity
                style={[styles.dashboardCard, styles.card1]}
                onPress={() => router.push(Routes.PensionHistory)}
              >
                <MaterialIcons name="history" size={32} color="#1F245E" />
                <Text style={styles.cardTitle}>Pension History</Text>
                <Text style={styles.cardSubtitle}>
                  View your verification history
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

            {/* Quick actions section */}
            <View style={styles.quickActionsContainer}>
              <Text style={styles.sectionTitle}>Quick Actions</Text>

              {/* Current quarter status card */}
              {currentQuarterStatus.quarter && (
                <View style={styles.currentStatusCard}>
                  <View style={styles.statusBadgeContainer}>
                    <View style={[
                      styles.statusBadge, 
                      currentQuarterStatus.isCompleted 
                        ? styles.statusCompleted 
                        : styles.statusPending
                    ]}>
                      <Text style={styles.statusBadgeText}>
                        {currentQuarterStatus.isCompleted ? "VERIFIED" : "PENDING"}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.currentQuarterTitle}>
                    Current Quarter: {currentQuarterStatus.quarter}
                  </Text>
                  <Text style={styles.currentQuarterSubtitle}>
                    {currentQuarterStatus.isCompleted 
                      ? "Your verification for this quarter is complete." 
                      : `Due by: ${new Date(currentQuarterStatus.dueDate).toLocaleDateString()}`
                    }
                  </Text>
                </View>
              )}

              <View style={styles.quickActionsRow}>
                <TouchableOpacity 
                    style={styles.quickActionButton}
                    onPress={() => {
                      Alert.alert(
                        "Coming Soon",
                        "The Account feature is not implemented yet and will be available in a future update.",
                        [{ text: "OK", style: "default" }]
                      );
                    }}
                  >
                  <MaterialIcons
                    name="account-balance"
                    size={24}
                    color="#1F245E"
                  />
                  <Text style={styles.quickActionText}>My Account</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.quickActionButton}
                  onPress={() =>
                    Linking.openURL("https://aabishuaa.github.io/eLife-Website/contact.html")
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

            {/* Main action buttons */}
            <View style={styles.actionsContainer}>
              <Text style={styles.sectionTitle}>Important Links</Text>

              <TouchableOpacity
                style={[
                  styles.navButton,
                  currentQuarterStatus.isCompleted && styles.disabledButton,
                ]}
                onPress={handleProofOfLifePress}
              >
                <View style={styles.buttonContent}>
                  <Ionicons
                    name="finger-print-outline"
                    size={24}
                    color="white"
                  />
                  <Text style={styles.navButtonText}>
                    Proof of Life Verification
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#8C9EFF" />
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.navButton}
                onPress={() => router.push(Routes.PensionHistory)}
              >
                <View style={styles.buttonContent}>
                  <MaterialIcons name="event" size={24} color="white" />
                  <Text style={styles.navButtonText}>Life Certificates</Text>
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

            {/* Footer decoration */}
            <View style={styles.decorativeElement}>
              <View style={styles.decorativeLine} />
              <Text style={styles.decorativeText}>Pension Portal</Text>
              <View style={styles.decorativeLine} />
            </View>

            {/* Bottom spacing for tab bar */}
            <View style={{ paddingBottom: tabBarHeight + 20 }} />
          </ScrollView>

          {/* Side menu */}
          <SideMenuDrawer
            visible={isDrawerVisible}
            onClose={() => setDrawerVisible(false)}
          />
        </SafeAreaView>
      </ImageBackground>
    </>
  );
}

/**
 * Component styles
 */
const styles = StyleSheet.create({
  // Layout
  backgroundImage: {
    flex: 1,
    width: screenWidth,
    backgroundColor: "#F6F6F6",
  },
  safeArea: {
    paddingHorizontal: 16,
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    paddingBottom: 20,
  },

  // Header styling
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

  // Developer mode button (debug only)
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

  // Dashboard cards
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

  // Quick actions section
  quickActionsContainer: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0B1741",
    marginBottom: 16,
  },
  
  // Current quarter status card
  currentStatusCard: {
    backgroundColor: "#F0F4FF",
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: "#1F245E",
  },
  statusBadgeContainer: {
    position: "absolute",
    top: 12,
    right: 12,
  },
  statusBadge: {
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  statusCompleted: {
    backgroundColor: "#4CAF50",
  },
  statusPending: {
    backgroundColor: "#FFA000",
  },
  statusBadgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "bold",
  },
  currentQuarterTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1F245E",
    marginBottom: 5,
  },
  currentQuarterSubtitle: {
    fontSize: 14,
    color: "#666",
  },

  // Quick action buttons
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

  // Main action buttons
  actionsContainer: {
    marginBottom: 20,
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
  disabledButton: {
    backgroundColor: "#455A90",
    opacity: 0.7,
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

  // Footer decoration
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