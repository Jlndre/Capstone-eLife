import React, { useState } from "react";
import {
  View,
  Text,
  Switch,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

export default function NotificationPreferences() {
  const router = useRouter();
  const [emailNotif, setEmailNotif] = useState(true);
  const [smsNotif, setSmsNotif] = useState(false);
  const [appNotif, setAppNotif] = useState(true);
  const [quarterlyReminders, setQuarterlyReminders] = useState(true);

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
          <Text style={styles.headerTitle}>Notification Preferences</Text>
        </View>

        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollViewContent}
        >
          <View style={styles.preferenceItem}>
            <Text style={styles.label}>Email Notifications</Text>
            <Switch
              value={emailNotif}
              onValueChange={setEmailNotif}
              trackColor={{ false: "#d1d5db", true: "#8C9EFF" }}
              thumbColor={emailNotif ? "#1F245E" : "#f4f3f4"}
              ios_backgroundColor="#d1d5db"
            />
          </View>

          <View style={styles.preferenceItem}>
            <Text style={styles.label}>SMS Notifications</Text>
            <Switch
              value={smsNotif}
              onValueChange={setSmsNotif}
              trackColor={{ false: "#d1d5db", true: "#8C9EFF" }}
              thumbColor={smsNotif ? "#1F245E" : "#f4f3f4"}
              ios_backgroundColor="#d1d5db"
            />
          </View>

          <View style={styles.preferenceItem}>
            <Text style={styles.label}>In-App Notifications</Text>
            <Switch
              value={appNotif}
              onValueChange={setAppNotif}
              trackColor={{ false: "#d1d5db", true: "#8C9EFF" }}
              thumbColor={appNotif ? "#1F245E" : "#f4f3f4"}
              ios_backgroundColor="#d1d5db"
            />
          </View>

          <View style={styles.preferenceItem}>
            <Text style={styles.label}>Quarterly Proof of Life Reminders</Text>
            <Switch
              value={quarterlyReminders}
              onValueChange={setQuarterlyReminders}
              trackColor={{ false: "#d1d5db", true: "#8C9EFF" }}
              thumbColor={quarterlyReminders ? "#1F245E" : "#f4f3f4"}
              ios_backgroundColor="#d1d5db"
            />
          </View>
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
    marginTop: 20,
    marginBottom: 20,
  },
  backButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: "#F0F4FF",
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#0B1741",
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    paddingBottom: 20,
  },
  preferenceItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
    backgroundColor: "#F5F7FA",
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  label: {
    fontSize: 16,
    color: "#1F245E",
    fontWeight: "500",
  },
});
