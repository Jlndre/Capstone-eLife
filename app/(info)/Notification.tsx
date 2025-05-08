import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function Notifications() {
  const router = useRouter();

  // Static sample notifications data
  const notifications = [
    {
      id: 1,
      type: "reminder",
      title: "Quarterly Proof of Life",
      message: "Time to submit your quarterly proof of life verification.",
      date: "May 3, 2025",
      read: false,
    },
    {
      id: 2,
      type: "update",
      title: "Document Updated",
      message: "Your will document has been successfully updated.",
      date: "April 28, 2025",
      read: true,
    },
    {
      id: 3,
      type: "alert",
      title: "Beneficiary Change",
      message:
        "Your beneficiary settings were changed for your investment account.",
      date: "April 15, 2025",
      read: true,
    },
    {
      id: 4,
      type: "reminder",
      title: "Password Update Recommended",
      message: "It's been 90 days since your last password update.",
      date: "April 10, 2025",
      read: false,
    },
    {
      id: 5,
      type: "update",
      title: "New Feature Available",
      message: "Check out our new digital asset protection feature.",
      date: "March 22, 2025",
      read: true,
    },
  ];

  // Function to render the appropriate icon based on notification type
  const renderIcon = (type: string) => {
    switch (type) {
      case "reminder":
        return <Ionicons name="calendar" size={24} color="#1F245E" />;
      case "update":
        return <Ionicons name="document-text" size={24} color="#1F245E" />;
      case "alert":
        return <Ionicons name="alert-circle" size={24} color="#1F245E" />;
      default:
        return <Ionicons name="notifications" size={24} color="#1F245E" />;
    }
  };

  return (
    <>
      <StatusBar style="light" translucent backgroundColor="transparent" />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.replace("/(tabs)")}
          >
            <Ionicons name="arrow-back" size={24} color="#1F245E" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Notifications</Text>
          <TouchableOpacity
            style={styles.settingsButton}
            onPress={() => router.push("/")}
          >
            <Ionicons name="settings-outline" size={24} color="#1F245E" />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollViewContent}
        >
          {notifications.length > 0 ? (
            notifications.map((notification) => (
              <TouchableOpacity
                key={notification.id}
                style={[
                  styles.notificationItem,
                  !notification.read && styles.unreadNotification,
                ]}
              >
                <View style={styles.iconContainer}>
                  {renderIcon(notification.type)}
                </View>
                <View style={styles.notificationContent}>
                  <Text style={styles.notificationTitle}>
                    {notification.title}
                  </Text>
                  <Text style={styles.notificationMessage}>
                    {notification.message}
                  </Text>
                  <Text style={styles.notificationDate}>
                    {notification.date}
                  </Text>
                </View>
                {!notification.read && <View style={styles.unreadDot} />}
              </TouchableOpacity>
            ))
          ) : (
            <View style={styles.emptyContainer}>
              <Ionicons name="notifications-off" size={60} color="#8C9EFF" />
              <Text style={styles.emptyText}>No notifications yet</Text>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    paddingHorizontal: 16,
    backgroundColor: "#F6F6F6",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 20,
    marginBottom: 20,
  },
  backButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: "#F0F4FF",
  },
  settingsButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: "#F0F4FF",
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#0B1741",
    flex: 1,
    marginLeft: 12,
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    paddingBottom: 20,
  },
  notificationItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    position: "relative",
  },
  unreadNotification: {
    backgroundColor: "#F0F4FF",
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#E6EAFF",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  notificationContent: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1F245E",
    marginBottom: 4,
  },
  notificationMessage: {
    fontSize: 14,
    color: "#4F5573",
    marginBottom: 8,
  },
  notificationDate: {
    fontSize: 12,
    color: "#9EA3B8",
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#8C9EFF",
    position: "absolute",
    top: 16,
    right: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    color: "#9EA3B8",
    marginTop: 16,
    fontWeight: "500",
  },
});
