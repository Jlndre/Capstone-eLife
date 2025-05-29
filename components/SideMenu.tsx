import { Images, ProfileInitials } from "@/assets/images";
import { Routes } from "@/constants/routes";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Dimensions,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const screenWidth = Dimensions.get("window").width;

type Props = {
  visible: boolean;
  onClose: () => void;
};

type ProfileData = {
  id: string | number;
  username: string;
  email: string;
  details: {
    firstname: string;
    lastname: string;
    dob: string | null;
  };
};

export default function SideMenuDrawer({ visible, onClose }: Props) {
  const router = useRouter();
  const slideAnim = useRef(new Animated.Value(-screenWidth)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogout = async () => {
    try {
      console.log("SideMenu: Logging out...");

      // Get the token to send to logout API
      const token = await SecureStore.getItemAsync("jwt");

      if (token) {
        // Call the logout API endpoint (if available)
        try {
          console.log("SideMenu: Calling logout API");
          const response = await fetch(
            "https://879c-63-143-118-227.ngrok-free.app/auth/logout",
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
              },
            }
          );

          console.log("SideMenu: Logout API response:", response.status);
        } catch (apiError) {
          console.error("SideMenu: Logout API call failed:", apiError);
          // Continue with local logout even if API call fails
        }
      }

      // Clear all local storage/secure store items
      console.log("SideMenu: Clearing local storage");
      await SecureStore.deleteItemAsync("jwt");
      await SecureStore.deleteItemAsync("currentUserId");
      await SecureStore.deleteItemAsync("cachedProfile");
      await SecureStore.deleteItemAsync("termsAccepted");

      // Close drawer and navigate to login
      console.log("SideMenu: Navigating to login");
      onClose();
      router.replace(Routes.Login);
    } catch (error) {
      console.error("SideMenu: Error during logout:", error);
      Alert.alert(
        "Logout Error",
        "Failed to log out completely. Please try again.",
        [{ text: "OK" }]
      );
    }
  };

  // Debug function to log IDs and types
  const debugIDs = async () => {
    if (__DEV__) {
      const currentUserId = await SecureStore.getItemAsync("currentUserId");
      console.log(
        "SideMenu: Current user ID from storage:",
        currentUserId,
        "type:",
        typeof currentUserId
      );

      if (profile && profile.id) {
        console.log(
          "SideMenu: Profile ID from API:",
          profile.id,
          "type:",
          typeof profile.id
        );
      }
    }
  };

  useEffect(() => {
    if (visible) {
      // Animation for opening the drawer
      slideAnim.setValue(-screenWidth);
      overlayAnim.setValue(0);

      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(overlayAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();

      // Fetch profile data when drawer opens
      const fetchProfile = async () => {
        setLoading(true);
        setError("");
        try {
          const token = await SecureStore.getItemAsync("jwt");
          const currentUserId = await SecureStore.getItemAsync("currentUserId");

          if (!token) {
            setError("No auth token found");
            router.replace(Routes.Login);
            return;
          }

          // Add cache busting to prevent stale data
          const cacheBuster = new Date().getTime();
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
              // Token invalid, redirect to login
              await SecureStore.deleteItemAsync("jwt");
              onClose();
              router.replace(Routes.Login);
              return;
            }
            throw new Error(`Server responded with ${response.status}`);
          }

          const data = await response.json();
          console.log(
            "SideMenu: Profile data loaded:",
            JSON.stringify(data, null, 2)
          );
          console.log("SideMenu: Profile ID type:", typeof data.id);

          // Verify that the profile data is for the correct user
          if (currentUserId && String(data.id) !== String(currentUserId)) {
            console.error(
              `SideMenu: User ID mismatch! Token user ID: ${currentUserId}, Profile user ID: ${
                data.id
              }, Types: ${typeof currentUserId}, ${typeof data.id}`
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
            throw new Error("User ID mismatch");
          }

          // Store the profile data
          setProfile(data);

          // Debug IDs
          if (__DEV__) {
            debugIDs();
          }
        } catch (err) {
          console.error("Failed to load profile in SideMenu", err);
          setError("Failed to load profile");
        } finally {
          setLoading(false);
        }
      };

      fetchProfile();
    } else {
      // Animation for closing the drawer
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: -screenWidth,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(overlayAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  // Get the profile image based on first name initial
  const getProfileImage = () => {
    if (loading || !profile || !profile.details || !profile.details.firstname) {
      return Images.ProfilePicAlt;
    }

    const letter = profile.details.firstname.charAt(0).toUpperCase();
    console.log("SideMenu: Using profile image for letter:", letter);
    return ProfileInitials[letter] || Images.ProfilePicAlt;
  };

  // Menu items configuration
  const menuItems = [
    {
      icon: "home-outline",
      text: "Home",
      path: Routes.Home,
      component: Ionicons,
    },
    {
      icon: "check-circle-outline",
      text: "My Profile",
      path: Routes.Profile,
      component: MaterialIcons,
    },
    {
      icon: "document-text-outline",
      text: "View Recent Life Certificates",
      path: Routes.PensionHistory,
      component: Ionicons,
    },
    {
      icon: "notifications-outline",
      text: "Notifications",
      path: Routes.Notifications,
      component: Ionicons,
    },
    {
      icon: "settings-outline",
      text: "Settings",
      path: Routes.Settings,
      component: Ionicons,
    },
  ];

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      onRequestClose={onClose}
    >
      <Animated.View style={[styles.overlay, { opacity: overlayAnim }]}>
        <Pressable style={styles.backdrop} onPress={onClose} />

        <Animated.View
          style={[styles.drawer, { transform: [{ translateX: slideAnim }] }]}
        >
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Ionicons name="close" size={28} color="#1F245E" />
          </TouchableOpacity>

          <View style={styles.header}>
            <View style={styles.profileImageContainer}>
              <Image source={getProfileImage()} style={styles.profilePic} />
            </View>

            {loading ? (
              <Text style={styles.subtitle}>Loading...</Text>
            ) : error ? (
              <Text style={styles.errorText}>{error}</Text>
            ) : profile ? (
              <>
                <Text style={styles.name}>
                  {profile.details.firstname} {profile.details.lastname}
                </Text>
                <Text style={styles.subtitle}>Pensioner</Text>
              </>
            ) : (
              <Text style={styles.subtitle}>Welcome</Text>
            )}

            {__DEV__ && (
              <TouchableOpacity style={styles.devButton} onPress={debugIDs}>
                <Text style={styles.devButtonText}>Debug IDs</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.divider} />

          <View style={styles.menuContainer}>
            {menuItems.map((item, index) => (
              <TouchableOpacity
                key={index}
                onPress={() => {
                  onClose();
                  router.replace(item.path);
                }}
                style={styles.menuItem}
                activeOpacity={0.7}
              >
                <View style={styles.iconContainer}>
                  {item.component === Ionicons ? (
                    <Ionicons
                      name={item.icon as keyof typeof Ionicons.glyphMap}
                      size={22}
                      color="#1F245E"
                    />
                  ) : (
                    <MaterialIcons
                      name={item.icon as keyof typeof MaterialIcons.glyphMap}
                      size={22}
                      color="#1F245E"
                    />
                  )}
                </View>
                <Text style={styles.menuText}>{item.text}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.bottomSection}>
            <View style={styles.divider} />
            <TouchableOpacity
              onPress={handleLogout}
              style={styles.logoutButton}
              activeOpacity={0.7}
            >
              <Ionicons name="log-out-outline" size={22} color="#ff3b30" />
              <Text style={styles.logoutText}>Logout</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  backdrop: {
    flex: 1,
  },
  drawer: {
    width: "80%",
    height: "100%",
    backgroundColor: "#fff",
    position: "absolute",
    left: 0,
    top: 0,
    borderTopRightRadius: 20,
    borderBottomRightRadius: 20,
    paddingTop: 60,
    paddingHorizontal: 0,
    elevation: 10,
  },
  closeButton: {
    position: "absolute",
    top: 55,
    left: 20,
    zIndex: 100,
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 8,
    elevation: 5,
  },
  header: {
    alignItems: "center",
    marginTop: 20,
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  profileImageContainer: {
    padding: 3,
    borderRadius: 45,
    backgroundColor: "#fff",
    elevation: 5,
  },
  profilePic: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderColor: "#1F245E",
    borderWidth: 2,
  },
  name: {
    fontSize: 22,
    marginTop: 15,
    fontWeight: "bold",
    color: "#1F245E",
  },
  subtitle: {
    fontSize: 14,
    color: "#666",
    marginTop: 3,
  },
  errorText: {
    fontSize: 14,
    color: "#ff3b30",
    marginTop: 15,
  },
  devButton: {
    marginTop: 10,
    backgroundColor: "#ffcc00",
    borderRadius: 8,
    paddingVertical: 5,
    paddingHorizontal: 10,
    display: __DEV__ ? "flex" : "none",
  },
  devButtonText: {
    fontSize: 12,
    color: "#000",
    fontWeight: "bold",
  },
  divider: {
    height: 1,
    backgroundColor: "#e0e0e0",
    marginHorizontal: 20,
  },
  menuContainer: {
    marginTop: 30,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 30,
    marginVertical: 4,
  },
  iconContainer: {
    width: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  menuText: {
    fontSize: 16,
    marginLeft: 12,
    color: "#1F245E",
    fontWeight: "500",
  },
  bottomSection: {
    position: "absolute",
    bottom: 50,
    width: "100%",
  },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 20,
    paddingVertical: 12,
    paddingHorizontal: 30,
  },
  logoutText: {
    fontSize: 16,
    marginLeft: 12,
    color: "#ff3b30",
    fontWeight: "500",
  },
});
