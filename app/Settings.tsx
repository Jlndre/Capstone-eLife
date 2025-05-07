import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import * as LocalAuthentication from "expo-local-authentication";
import { useRouter } from "expo-router";
import { Linking } from "react-native";

interface SettingsItemProps {
  icon: string;
  iconType: "MaterialIcons" | "Ionicons";
  label: string;
  description: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}

function SettingsItem({
  icon,
  iconType,
  label,
  description,
  value,
  onValueChange,
}: SettingsItemProps) {
  return (
    <View style={styles.settingsItem}>
      <View style={styles.settingInfo}>
        {iconType === "MaterialIcons" ? (
          <MaterialIcons name={icon as any} size={28} color="#2C3E50" />
        ) : (
          <Ionicons name={icon as any} size={28} color="#2C3E50" />
        )}
        <View style={styles.settingTextGroup}>
          <Text style={styles.settingLabel}>{label}</Text>
          <Text style={styles.settingDescription}>{description}</Text>
        </View>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: "#D8D8D8", true: "#AED6F1" }}
        thumbColor={value ? "#3498DB" : "#f4f3f4"}
        ios_backgroundColor="#D8D8D8"
      />
    </View>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const [biometricMethod, setBiometricMethod] = useState<
    "face" | "fingerprint" | null
  >(null);
  const [biometricEnabled, setBiometricEnabled] = useState(true);
  const [largeText, setLargeText] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    async function checkBiometricSupport() {
      const types =
        await LocalAuthentication.supportedAuthenticationTypesAsync();
      if (
        types.includes(
          LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION
        )
      ) {
        setBiometricMethod("face");
      } else if (
        types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)
      ) {
        setBiometricMethod("fingerprint");
      } else {
        setBiometricMethod(null);
      }
    }
    checkBiometricSupport();
  }, []);

  return (
    <>
      <StatusBar style="dark" />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.replace("/(tabs)")}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={28} color="#2C3E50" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Settings</Text>
        </View>

        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.sectionTitle}>App Settings</Text>

          <View style={styles.settingsCard}>
            <SettingsItem
              icon="text-size"
              iconType="MaterialIcons"
              label="Large Text"
              description="Increase text size for better readability"
              value={largeText}
              onValueChange={setLargeText}
            />
            <View style={styles.divider} />
            <SettingsItem
              icon="moon"
              iconType="Ionicons"
              label="Dark Mode"
              description="Use dark colors for the app interface"
              value={darkMode}
              onValueChange={setDarkMode}
            />
          </View>

          <Text style={styles.sectionTitle}>Login Verification</Text>
          <View style={styles.settingsCard}>
            {biometricMethod && (
              <SettingsItem
                icon={biometricMethod === "face" ? "face" : "finger-print"}
                iconType={
                  biometricMethod === "face" ? "MaterialIcons" : "Ionicons"
                }
                label={
                  biometricMethod === "face"
                    ? "Face ID Login"
                    : "Fingerprint Login"
                }
                description={`Use ${
                  biometricMethod === "face"
                    ? "facial recognition"
                    : "fingerprint"
                } to log in`}
                value={biometricEnabled}
                onValueChange={setBiometricEnabled}
              />
            )}
            {!biometricMethod && (
              <View style={{ padding: 16 }}>
                <Text style={{ color: "#7F8C8D", fontSize: 14 }}>
                  Biometric login is not supported on this device.
                </Text>
              </View>
            )}
          </View>

          <TouchableOpacity
            style={styles.helpButton}
            onPress={() => Linking.openURL("https://www.treasury.gov.jm/faqs/")}
            accessibilityLabel="Open help link"
          >
            <Text style={styles.helpButtonText}>Need Help?</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  // same styles as before...
  safeArea: {
    flex: 1,
    backgroundColor: "#F5F7FA",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 20,
    backgroundColor: "#FFFFFF",
    elevation: 2,
  },
  backButton: {
    padding: 8,
    borderRadius: 12,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#2C3E50",
    marginLeft: 12,
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#2C3E50",
    marginTop: 24,
    marginBottom: 12,
    paddingLeft: 4,
  },
  settingsCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    paddingVertical: 8,
    elevation: 1,
  },
  settingsItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  settingInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    paddingRight: 12,
  },
  settingTextGroup: {
    marginLeft: 16,
    flex: 1,
  },
  settingLabel: {
    fontSize: 18,
    color: "#2C3E50",
    fontWeight: "500",
  },
  settingDescription: {
    fontSize: 14,
    color: "#7F8C8D",
    marginTop: 4,
  },
  divider: {
    height: 1,
    backgroundColor: "#EEEEEE",
    marginHorizontal: 20,
  },
  helpButton: {
    backgroundColor: "#FFFFFF",
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
    marginTop: 24,
    marginBottom: 30,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  helpButtonText: {
    color: "#2C3E50",
    fontSize: 18,
    fontWeight: "500",
  },
});
