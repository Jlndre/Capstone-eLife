import { Routes } from "@/constants/routes";
import { API_BASE_URL } from "@/utils/config";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { StatusBar } from "expo-status-bar";

import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

interface Notification {
  id: number;
  type: string;
  message: string;
  sent_at: string;
  is_read: boolean;
}

export default function Notifications() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const token = await SecureStore.getItemAsync("jwt");
        const response = await fetch(`${API_BASE_URL}/notifications`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!response.ok) {
          throw new Error(`Server responded with status: ${response.status}`);
        }

        const data = await response.json();
        setNotifications(data);
      } catch (err) {
        console.error("Failed to load notifications", err);
      } finally {
        setLoading(false);
      }
    };

    fetchNotifications();
  }, []);

  /**
   * Maps a notification type to an icon.
   */
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

  /**
   * Capitalizes the first letter of the notification type for display.
   */
  const formatTitle = (type: string) =>
    type.charAt(0).toUpperCase() + type.slice(1);

  return (
    <>
      <StatusBar style="light" translucent backgroundColor="transparent" />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.replace(Routes.Home)}
          >
            <Ionicons name="arrow-back" size={24} color="#1F245E" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Notifications</Text>
          <TouchableOpacity
            style={styles.settingsButton}
            onPress={() => router.push(Routes.Settings)}
          >
            <Ionicons name="settings-outline" size={24} color="#1F245E" />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollViewContent}
        >
          {loading ? (
            <View style={styles.emptyContainer}>
              <ActivityIndicator size="large" color="#8C9EFF" />
              <Text style={styles.emptyText}>Loading notifications...</Text>
            </View>
          ) : notifications.length > 0 ? (
            notifications.map((notification) => (
              <TouchableOpacity
                key={notification.id}
                style={[
                  styles.notificationItem,
                  !notification.is_read && styles.unreadNotification,
                ]}
              >
                <View style={styles.iconContainer}>
                  {renderIcon(notification.type)}
                </View>
                <View style={styles.notificationContent}>
                  <Text style={styles.notificationTitle}>
                    {formatTitle(notification.type)}
                  </Text>
                  <Text style={styles.notificationMessage}>
                    {notification.message}
                  </Text>
                  <Text style={styles.notificationDate}>
                    {notification.sent_at}
                  </Text>
                </View>
                {!notification.is_read && <View style={styles.unreadDot} />}
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
    backgroundColor: "#fff",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1F245E",
  },
  settingsButton: {
    padding: 4,
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  notificationItem: {
    flexDirection: "row",
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    alignItems: "center",
  },
  unreadNotification: {
    backgroundColor: "#F1F4FF",
    borderRadius: 8,
  },
  iconContainer: {
    marginRight: 16,
  },
  notificationContent: {
    flex: 1,
  },
  notificationTitle: {
    fontWeight: "600",
    fontSize: 15,
    color: "#1F245E",
    marginBottom: 4,
  },
  notificationMessage: {
    fontSize: 14,
    color: "#444",
    marginBottom: 4,
  },
  notificationDate: {
    fontSize: 12,
    color: "#999",
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#8C9EFF",
    marginLeft: 8,
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    marginTop: 80,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 14,
    color: "#777",
    textAlign: "center",
  },
});
