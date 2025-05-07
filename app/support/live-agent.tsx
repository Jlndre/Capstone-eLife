import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  Dimensions,
} from "react-native";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

const { width, height } = Dimensions.get("window");

const VideoCallWaitingScreen = () => {
  const router = useRouter();
  const [waitTime, setWaitTime] = useState(0);

  useEffect(() => {
    // Simulate wait time counter
    const interval = setInterval(() => {
      setWaitTime((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Format wait time to mm:ss
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Life Certificate Verification</Text>
        <View style={styles.connectionStatus}>
          <View style={styles.connectionDot} />
          <Text style={styles.connectionText}>Connecting Securely</Text>
        </View>
      </View>

      {/* Main Content */}
      <View style={styles.content}>
        <View style={styles.waitingCard}>
          <ActivityIndicator
            size="large"
            color="#1F245E"
            style={styles.spinner}
          />
          <Text style={styles.waitingText}>
            Waiting for the agent to admit you...
          </Text>
          <Text style={styles.timeText}>Wait time: {formatTime(waitTime)}</Text>
        </View>

        {/* Agent Info */}
        <View style={styles.agentInfoContainer}>
          <View style={styles.agentInfo}>
            <Image
              source={{ uri: "https://via.placeholder.com/60" }}
              style={styles.agentImage}
            />
            <View style={styles.agentDetails}>
              <Text style={styles.agentName}>Mrs. Dionne Johnson</Text>
              <Text style={styles.agentRole}>
                Account General's Department Agent
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Camera Preview */}
      <View style={styles.previewContainer}>
        <View style={styles.selfPreview}>
          <View style={styles.previewPlaceholder}>
            <Text style={styles.previewText}>Your camera</Text>
          </View>
          <TouchableOpacity style={styles.micButton}>
            <Ionicons name="mic" size={22} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Bottom Controls */}
      <View style={styles.controls}>
        <TouchableOpacity style={styles.controlButton}>
          <Ionicons name="mic" size={24} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.controlButton}>
          <Ionicons name="videocam" size={24} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.controlButton, styles.endCallButton]}>
          <MaterialIcons name="call-end" size={24} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.controlButton}>
          <Ionicons name="chatbubble-ellipses" size={24} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.controlButton}>
          <Ionicons name="ellipsis-horizontal" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Connection Info */}
      <View style={styles.connectionInfo}>
        <Text style={styles.connectionInfoText}>
          This is a secure encrypted call
        </Text>
      </View>
    </SafeAreaView>
  );
};

export default VideoCallWaitingScreen;

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
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  waitingCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    width: "90%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  spinner: {
    marginBottom: 16,
  },
  waitingText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1F245E",
    textAlign: "center",
    marginBottom: 8,
  },
  timeText: {
    fontSize: 14,
    color: "#666",
    marginTop: 8,
  },
  agentInfoContainer: {
    position: "absolute",
    top: 20,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  agentInfo: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    width: "90%",
  },
  agentImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  agentDetails: {
    flex: 1,
  },
  agentName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1F245E",
  },
  agentRole: {
    fontSize: 12,
    color: "#666",
    marginTop: 2,
  },
  previewContainer: {
    position: "absolute",
    bottom: 100,
    right: 16,
  },
  selfPreview: {
    position: "relative",
  },
  previewPlaceholder: {
    width: 120,
    height: 160,
    backgroundColor: "#C1C6F7",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  previewText: {
    color: "#1F245E",
    fontSize: 12,
    fontWeight: "500",
  },
  micButton: {
    position: "absolute",
    bottom: 8,
    right: 8,
    backgroundColor: "#1F245E",
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  controls: {
    flexDirection: "row",
    justifyContent: "space-evenly",
    padding: 16,
    backgroundColor: "#1F245E",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  controlButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  endCallButton: {
    backgroundColor: "#FF3B30",
  },
  connectionInfo: {
    alignItems: "center",
    paddingBottom: 8,
    backgroundColor: "#1F245E",
  },
  connectionInfoText: {
    color: "#E0E0E0",
    fontSize: 12,
  },
});
