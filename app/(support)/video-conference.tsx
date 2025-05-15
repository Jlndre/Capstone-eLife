import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { WebView } from "react-native-webview";

const VideoConferenceScreen = () => {
  const router = useRouter();
  const [isWebViewLoading, setIsWebViewLoading] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);

  // Generate room name or use a fixed one
  const roomName = "elife-verification-room";

  useEffect(() => {
    const fetchDisplayName = async () => {
      try {
        const token = await SecureStore.getItemAsync("jwt");
        if (!token) throw new Error("No token found");

        const response = await fetch(
          "https://09c6-208-131-174-130.ngrok-free.app/profile",
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!response.ok) throw new Error("Failed to fetch profile");

        const data = await response.json();
        const fullName = `${data.details.firstname} ${data.details.lastname}`;
        setDisplayName(fullName);
      } catch (err) {
        console.error("Error fetching user profile:", err);
        // Set a fallback name if fetch fails
        setDisplayName("ELife User");
      } finally {
        // Give a small delay for a better UX before showing the WebView
        setTimeout(() => {
          setIsLoadingProfile(false);
        }, 1000);
      }
    };

    fetchDisplayName();
  }, []);

  // Build the Jitsi Meet URL with parameters
  const getJitsiUrl = () => {
    const baseUrl = "https://meet.jit.si/";

    // Create URL with parameters
    let url = `${baseUrl}${roomName}`;

    // Add display name if provided
    if (displayName) {
      url += `#userInfo.displayName="${encodeURIComponent(displayName)}"`;
    }

    return url;
  };

  // JavaScript to execute in WebView to control audio/video if needed in future
  const getInjectedJavaScript = () => {
    return `
      try {
        // This will run once the page loads
        document.addEventListener('apiLoaded', (e) => {
          const api = e.detail;
          
          // Tell React Native that Jitsi is ready
          window.ReactNativeWebView.postMessage(JSON.stringify({type: 'JITSI_READY'}));
        });
      } catch (err) {
        window.ReactNativeWebView.postMessage(JSON.stringify({type: 'ERROR', error: err.toString()}));
      }
      true;
    `;
  };

  // Handle WebView messages from Jitsi
  const handleWebViewMessage = (event: { nativeEvent: { data: string } }) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === "JITSI_READY") {
        console.log("Jitsi is ready");
      }
    } catch (err) {
      console.error("Error parsing WebView message:", err);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Life Certificate Verification</Text>
        <View style={styles.connectionStatus}>
          <View
            style={[styles.connectionDot, { backgroundColor: "#4CAF50" }]}
          />
          <Text style={styles.connectionText}>Connected Securely</Text>
        </View>
      </View>

      {isLoadingProfile ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator
            size="large"
            color="#1F245E"
            style={{ width: 80, height: 80 }}
          />
          <Text style={styles.loadingMessage}>
            Welcome to E-Life Verification
          </Text>
          <Text style={styles.loadingSubtext}>
            Setting up your secure connection...
          </Text>
        </View>
      ) : isWebViewLoading ? (
        <View style={styles.webViewContainer}>
          <WebView
            source={{ uri: getJitsiUrl() }}
            style={styles.webview}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            mediaPlaybackRequiresUserAction={false}
            allowsInlineMediaPlayback={true}
            injectedJavaScript={getInjectedJavaScript()}
            onMessage={handleWebViewMessage}
          />
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => setIsWebViewLoading(false)}
          >
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.contentContainer}>
          <View style={styles.welcomeContainer}>
            <Text style={styles.welcomeMessage}>Hi {displayName},</Text>
            <Text style={styles.instructionText}>
              You're about to join a video call with our verification agent.
              Please ensure your camera and microphone are ready.
            </Text>
            <Text style={styles.waitingText}>
              After joining, you may need to wait briefly for an agent to
              connect with you.
            </Text>
          </View>

          <TouchableOpacity
            style={styles.joinButton}
            onPress={() => setIsWebViewLoading(true)}
          >
            <Ionicons name="videocam" size={24} color="#fff" />
            <Text style={styles.joinButtonText}>Start Verification Call</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          This is a secure encrypted verification call
        </Text>
      </View>
    </SafeAreaView>
  );
};

export default VideoConferenceScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F0F2FF",
  },
  header: {
    padding: 16,
    backgroundColor: "#1F245E",
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
  headerTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
  },
  connectionStatus: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  connectionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#4CAF50",
    marginRight: 6,
  },
  connectionText: {
    color: "#E0E0E0",
    fontSize: 12,
  },
  contentContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  welcomeContainer: {
    width: "100%",
    marginBottom: 40,
  },
  welcomeMessage: {
    fontSize: 24,
    fontWeight: "700",
    color: "#1F245E",
    marginBottom: 16,
    textAlign: "center",
  },
  instructionText: {
    fontSize: 16,
    color: "#444",
    textAlign: "center",
    marginBottom: 12,
  },
  waitingText: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
  },
  joinButton: {
    flexDirection: "row",
    backgroundColor: "#1F245E",
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  joinButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 16,
    marginLeft: 8,
  },
  webViewContainer: {
    flex: 1,
    position: "relative",
  },
  webview: {
    flex: 1,
    backgroundColor: "#000",
  },
  backButton: {
    position: "absolute",
    top: 16,
    left: 16,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    width: 46,
    height: 46,
    borderRadius: 23,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  loadingMessage: {
    fontSize: 22,
    fontWeight: "700",
    color: "#1F245E",
    textAlign: "center",
    marginTop: 20,
    marginBottom: 10,
  },
  loadingSubtext: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
  },
  footer: {
    padding: 12,
    backgroundColor: "#1F245E",
    alignItems: "center",
    justifyContent: "center",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  footerText: {
    color: "#E0E0E0",
    fontSize: 12,
  },
});
