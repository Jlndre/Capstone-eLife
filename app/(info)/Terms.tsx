import { Routes } from "@/constants/routes";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function TermsAndConditionsScreen() {
  const [isLoading, setIsLoading] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [apiError, setApiError] = useState("");
  const router = useRouter();

  // Check if we were properly navigated to this screen
  useEffect(() => {
    const checkNavigation = async () => {
      try {
        // Check if the token is valid
        const token = await SecureStore.getItemAsync("jwt");
        if (!token) {
          console.error(
            "No token found in Terms screen - redirecting to Login"
          );
          router.replace(Routes.Login);
          return;
        }

        // Check if terms have already been accepted (shouldn't get here if they were)
        const termsAccepted = await SecureStore.getItemAsync("termsAccepted");
        console.log(
          "Terms screen loaded, current acceptance status:",
          termsAccepted
        );

        if (termsAccepted === "true") {
          console.log("Terms already accepted - redirecting to Home");
          router.replace(Routes.Home);
        }
      } catch (error) {
        console.error("Error in Terms screen initialization:", error);
      }
    };

    checkNavigation();
  }, []);

  const handleAcceptTerms = () => {
    setAccepted(!accepted);
    if (apiError) setApiError("");
  };

  const handleSubmit = async () => {
    if (!accepted) {
      Alert.alert(
        "Terms Not Accepted",
        "You must accept the terms and conditions to continue."
      );
      return;
    }

    setIsLoading(true);
    setApiError("");

    try {
      console.log("Saving terms acceptance to SecureStore");
      await SecureStore.setItemAsync("termsAccepted", "true");

      const token = await SecureStore.getItemAsync("jwt");
      if (!token) {
        throw new Error("No authentication token found");
      }

      console.log("Calling accept-terms API");
      const response = await fetch(
        "https://879c-63-143-118-227.ngrok-free.app/profile/accept-terms",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error(
          `API error (${response.status}):`,
          errorData.message || "Unknown error"
        );

        setApiError(
          `API error (${response.status}): ${
            errorData.message || "Unknown error"
          }`
        );
      } else {
        console.log("Terms accepted successfully on API");
      }

      setTimeout(() => {
        setIsLoading(false);
        console.log("Navigating to Home after terms acceptance");
        router.replace(Routes.Home);
      }, 1000);
    } catch (error) {
      console.error("Terms acceptance error:", error);
      setIsLoading(false);

      // Store the acceptance locally even if the API failed
      if (!(await SecureStore.getItemAsync("termsAccepted"))) {
        await SecureStore.setItemAsync("termsAccepted", "true");
      }

      Alert.alert(
        "Warning",
        "Terms were accepted locally, but we couldn't save to the server. You can continue using the app, but you may need to accept terms again later.",
        [
          {
            text: "Continue Anyway",
            onPress: () => router.replace(Routes.Home),
          },
        ]
      );
    }
  };

  const resetTerms = async () => {
    if (__DEV__) {
      await SecureStore.deleteItemAsync("termsAccepted");
      Alert.alert("Dev Mode", "Terms acceptance reset for testing.");
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Terms and Conditions</Text>
          {__DEV__ && (
            <TouchableOpacity onPress={resetTerms} style={styles.devButton}>
              <Text style={styles.devButtonText}>Reset Terms (DEV)</Text>
            </TouchableOpacity>
          )}
        </View>

        <ScrollView
          style={styles.termsContainer}
          showsVerticalScrollIndicator={true}
        >
          <Text style={styles.termsTitle}>
            Pension Management Application Terms
          </Text>

          <Text style={styles.termsText}>Last Updated: May 12, 2025</Text>

          <Text style={styles.sectionTitle}>1. Acceptance of Terms</Text>
          <Text style={styles.termsText}>
            By accessing or using this pension management application, you agree
            to be bound by these Terms and Conditions. If you do not agree to
            all the terms and conditions, you may not access or use the
            application.
          </Text>

          <Text style={styles.sectionTitle}>2. Account Registration</Text>
          <Text style={styles.termsText}>
            To use certain features of the application, you must register for an
            account. You agree to provide accurate, current, and complete
            information during the registration process and to update such
            information to keep it accurate, current, and complete.
          </Text>

          <Text style={styles.sectionTitle}>3. Privacy Policy</Text>
          <Text style={styles.termsText}>
            Your use of the application is also governed by our Privacy Policy,
            which is incorporated by reference into these Terms and Conditions.
            Please review our Privacy Policy to understand our practices
            regarding your personal information.
          </Text>

          <Text style={styles.sectionTitle}>4. Security</Text>
          <Text style={styles.termsText}>
            You are responsible for maintaining the confidentiality of your
            account credentials and for all activities that occur under your
            account. You agree to notify us immediately of any unauthorized use
            of your account.
          </Text>

          <Text style={styles.sectionTitle}>5. Pension Information</Text>
          <Text style={styles.termsText}>
            The application provides access to your pension account information.
            While we strive to ensure the accuracy of this information, we make
            no guarantees regarding its completeness or accuracy. Important
            financial decisions should not be made solely based on information
            provided through this application.
          </Text>

          <Text style={styles.sectionTitle}>6. Limitations of Liability</Text>
          <Text style={styles.termsText}>
            The application is provided "as is" and "as available" without any
            warranties of any kind. We shall not be liable for any indirect,
            incidental, special, consequential, or punitive damages, including
            without limitation, loss of profits, data, use, goodwill, or other
            intangible losses.
          </Text>

          <Text style={styles.sectionTitle}>7. Modifications</Text>
          <Text style={styles.termsText}>
            We reserve the right, at our sole discretion, to modify or replace
            these Terms at any time. It is your responsibility to check the
            Terms periodically for changes. Your continued use of the
            application following the posting of any changes constitutes
            acceptance of those changes.
          </Text>

          <Text style={styles.sectionTitle}>8. Termination</Text>
          <Text style={styles.termsText}>
            We may terminate or suspend your account and access to the
            application immediately, without prior notice or liability, for any
            reason whatsoever, including without limitation if you breach the
            Terms.
          </Text>

          <Text style={styles.sectionTitle}>9. Governing Law</Text>
          <Text style={styles.termsText}>
            These Terms shall be governed and construed in accordance with the
            laws, without regard to its conflict of law provisions.
          </Text>

          <Text style={styles.sectionTitle}>10. Contact Information</Text>
          <Text style={styles.termsText}>
            If you have any questions about these Terms, please contact us at
            support@pensionapp.com.
          </Text>
        </ScrollView>

        <View style={styles.acceptanceSection}>
          {apiError ? <Text style={styles.errorText}>{apiError}</Text> : null}

          <TouchableOpacity
            style={styles.checkboxContainer}
            onPress={handleAcceptTerms}
          >
            <View style={[styles.checkbox, accepted && styles.checkboxChecked]}>
              {accepted && (
                <Ionicons name="checkmark" size={16} color="white" />
              )}
            </View>
            <Text style={styles.checkboxLabel}>
              I have read and accept the Terms and Conditions
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.submitButton,
              !accepted && styles.submitButtonDisabled,
            ]}
            onPress={handleSubmit}
            disabled={isLoading || !accepted}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.submitButtonText}>Continue</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  header: {
    paddingVertical: 20,
    paddingHorizontal: 20,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#1F245E",
  },
  devButton: {
    backgroundColor: "#ffcc00",
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 4,
  },
  devButtonText: {
    fontSize: 12,
    color: "#333",
  },
  termsContainer: {
    flex: 1,
    backgroundColor: "#fff",
    marginTop: 15,
    marginHorizontal: 15,
    marginBottom: 15,
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 15,
    elevation: 3,
  },
  termsTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1F245E",
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#1F245E",
    marginTop: 20,
    marginBottom: 10,
  },
  termsText: {
    fontSize: 14,
    lineHeight: 22,
    color: "#333",
    marginBottom: 10,
  },
  acceptanceSection: {
    backgroundColor: "#fff",
    paddingVertical: 20,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
  },
  checkboxContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: "#1F245E",
    marginRight: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  checkboxChecked: {
    backgroundColor: "#1F245E",
  },
  checkboxLabel: {
    fontSize: 14,
    color: "#333",
    flex: 1,
  },
  submitButton: {
    backgroundColor: "#1F245E",
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  submitButtonDisabled: {
    backgroundColor: "#9aa0c7",
  },
  submitButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  errorText: {
    color: "#D32F2F",
    fontSize: 14,
    marginBottom: 10,
  },
});
