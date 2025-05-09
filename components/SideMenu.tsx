import { Routes } from "@/constants/routes";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import React, { useEffect, useRef } from "react";
import {
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

export default function SideMenuDrawer({ visible, onClose }: Props) {
  const router = useRouter();
  const slideAnim = useRef(new Animated.Value(-screenWidth)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;

  const handleLogout = async () => {
    await SecureStore.deleteItemAsync("jwt"); // Clear the token
    onClose(); // Close the drawer
    router.replace(Routes.Login); // Navigate to Login
  };

  useEffect(() => {
    if (visible) {
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
    } else {
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

  const menuItems = [
    {
      icon: "home-outline",
      text: "Home",
      path: "/(tabs)" as const,
      component: Ionicons,
    },
    {
      icon: "check-circle-outline",
      text: "My Profile",
      path: "/Profile" as const,
      component: MaterialIcons,
    },
    {
      icon: "document-text-outline",
      text: "View Recent Life Certificates",
      path: "/PensionHistory" as const,
      component: Ionicons,
    },
    {
      icon: "notifications-outline",
      text: "Notifications",
      path: "/Notification" as const,
      component: Ionicons,
    },
    {
      icon: "settings-outline",
      text: "Settings",
      path: "/Settings" as const,
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
        {/* Dismiss drawer on backdrop press */}
        <Pressable style={styles.backdrop} onPress={onClose} />

        {/* Animated drawer */}
        <Animated.View
          style={[styles.drawer, { transform: [{ translateX: slideAnim }] }]}
        >
          {/* X Close Button */}
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Ionicons name="close" size={28} color="#1F245E" />
          </TouchableOpacity>

          {/* Header Profile Section */}
          <View style={styles.header}>
            <View style={styles.profileImageContainer}>
              <Image
                source={require("../assets/images/profilepic.png")}
                style={styles.profilePic}
              />
            </View>
            <Text style={styles.name}>John Brown</Text>
            <Text style={styles.subtitle}>Pensioner</Text>
          </View>

          <View style={styles.divider} />

          {/* Menu Links */}
          <View style={styles.menuContainer}>
            {menuItems.map((item, index) => (
              <TouchableOpacity
                key={index}
                onPress={() => {
                  onClose();
                  router.replace(
                    item.path as (typeof Routes)[keyof typeof Routes]
                  );
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

          {/* Bottom Section with Logout */}
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
