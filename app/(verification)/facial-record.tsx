import { Ionicons } from "@expo/vector-icons";
import {
  CameraPictureOptions,
  CameraRecordingOptions,
  CameraView,
  useCameraPermissions,
} from "expo-camera";
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const { width, height } = Dimensions.get("window");

// Define proper interfaces for type safety
interface VideoResult {
  uri: string;
}

export default function FacialRecord() {
  const cameraRef = useRef<any>(null);
  const router = useRouter();

  // Use the permissions hook
  const [permission, requestPermission] = useCameraPermissions();

  // State with proper typing
  const [isCameraReady, setIsCameraReady] = useState<boolean>(false); // Added camera ready state
  const [faceDetected, setFaceDetected] = useState<boolean>(false);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [countdown, setCountdown] = useState<number>(5);
  const [recordingTime, setRecordingTime] = useState<number>(5);
  const [processing, setProcessing] = useState<boolean>(false);
  const [checkingFace, setCheckingFace] = useState<boolean>(false);

  // Face detection check interval
  const faceDetectionIntervalRef = useRef<number | null>(null);

  // Check for face detection using API
  const checkFaceDetection = async () => {
    // Add camera ready check
    if (
      !cameraRef.current ||
      !isCameraReady ||
      checkingFace ||
      isRecording ||
      processing
    )
      return;

    try {
      setCheckingFace(true);

      // Take a photo to analyze
      const pictureOptions: CameraPictureOptions = {
        quality: 0.5, // Lower quality for faster upload
        skipProcessing: true, // Skip post-processing for speed
      };

      const photo = await cameraRef.current.takePictureAsync(pictureOptions);
      console.log("Captured photo:", photo?.uri);

      // Create form data for API request
      const formData = new FormData();
      formData.append("image", {
        uri: photo.uri,
        type: "image/jpeg",
        name: "face-check.jpg",
      } as any);

      // Replace with your actual face detection API
      const token = await SecureStore.getItemAsync("jwt");
      const response = await fetch(
        "https://b018-63-143-118-227.ngrok-free.app/detect-face",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            //"Content-Type": "multipart/form-data",
          },
          body: formData,
        }
      );

      // Add error handling for API response
      if (!response.ok) {
        const errorText = await response.text();
        console.error("API error:", response.status, errorText);
        return;
      }

      const contentType = response.headers.get("Content-Type");
      if (!contentType?.includes("application/json")) {
        const text = await response.text();
        console.error("Unexpected response type:", contentType, text);
        return;
      }

      const result = await response.json();

      // Update face detection state based on API response
      setFaceDetected(result.faces && result.faces.length > 0);
    } catch (error) {
      console.error("Face detection error:", error);
      setFaceDetected(false);
    } finally {
      setCheckingFace(false);
    }
  };

  // Set up periodic face detection
  useEffect(() => {
    if (permission?.granted && !isRecording && !processing && isCameraReady) {
      // Added isCameraReady check
      // Check face detection every 2 seconds
      faceDetectionIntervalRef.current = setInterval(checkFaceDetection, 2000);

      // Initial face check
      checkFaceDetection();
    }

    return () => {
      if (faceDetectionIntervalRef.current) {
        clearInterval(faceDetectionIntervalRef.current);
      }
    };
  }, [permission?.granted, isRecording, processing, isCameraReady]); // Added isCameraReady dependency

  // Start countdown before recording
  const startCountdown = () => {
    // Stop face detection checks during countdown
    if (faceDetectionIntervalRef.current) {
      clearInterval(faceDetectionIntervalRef.current);
    }

    let timeLeft = 5;
    setCountdown(timeLeft);

    const countdownInterval = setInterval(() => {
      timeLeft -= 1;
      setCountdown(timeLeft);

      if (timeLeft <= 0) {
        clearInterval(countdownInterval);
        startRecording();
      }
    }, 1000);
  };

  // Start recording video
  const startRecording = async () => {
    if (!cameraRef.current || !isCameraReady) return; // Added camera ready check

    try {
      setIsRecording(true);
      let timeLeft = 5;
      setRecordingTime(timeLeft);

      // Define recording options
      const options: CameraRecordingOptions = {
        maxDuration: 5,
      };

      // Start the actual recording
      const recordingPromise = cameraRef.current.recordAsync(options);

      // Countdown timer for recording duration
      const recordingInterval = setInterval(() => {
        timeLeft -= 1;
        setRecordingTime(timeLeft);

        if (timeLeft <= 0) {
          clearInterval(recordingInterval);
        }
      }, 1000);

      // Wait for recording to complete
      const videoResult = await recordingPromise;
      clearInterval(recordingInterval);

      // Process the recorded video
      processVideo(videoResult.uri);
    } catch (error) {
      console.error("Recording error:", error);
      Alert.alert("Recording Error", "Failed to record verification video");
      setIsRecording(false);
    }
  };

  // Stop recording if needed
  const stopRecording = async () => {
    if (cameraRef.current && isRecording) {
      cameraRef.current.stopRecording();
      setIsRecording(false);
    }
  };

  // Process the recorded video
  const processVideo = async (videoUri: string) => {
    try {
      setIsRecording(false);
      setProcessing(true);

      const token = await SecureStore.getItemAsync("jwt");

      // Create form data for API request
      const formData = new FormData();
      // Add video file to form data
      formData.append("video", {
        uri: videoUri,
        type: "video/mp4",
        name: "verification.mp4",
      } as any); // Using 'as any' to avoid TypeScript errors with FormData

      // Send request to backend API
      // NOTE: Replace with your actual API endpoint
      const response = await fetch("https://your-api-endpoint.com/verify", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data",
        },
        body: formData,
      });

      // Add error handling for verify API response
      if (!response.ok) {
        const errorText = await response.text();
        console.error("Verify API error:", response.status, errorText);
        Alert.alert(
          "Verification Error",
          "An error occurred during verification. Please try again."
        );
        return;
      }

      const contentType = response.headers.get("Content-Type");
      if (!contentType?.includes("application/json")) {
        const text = await response.text();
        console.error("Unexpected verify response type:", contentType, text);
        Alert.alert(
          "Verification Error",
          "An error occurred during verification. Please try again."
        );
        return;
      }

      const result = await response.json();

      if (result.success) {
        Alert.alert(
          "Verification Successful",
          "Your identity has been verified successfully. Your funds are on the way.",
          [{ text: "OK", onPress: () => router.replace("/(tabs)/dashboard") }]
        );
      } else {
        Alert.alert(
          "Verification Failed",
          result.message ||
            "We couldn't verify your identity. Please try again."
        );
      }
    } catch (error) {
      console.error("Processing error:", error);
      Alert.alert(
        "Verification Error",
        "An error occurred during verification. Please try again."
      );
    } finally {
      setProcessing(false);
      // Resume face detection after processing is complete
      faceDetectionIntervalRef.current = setInterval(checkFaceDetection, 2000);
    }
  };

  // Loading state while permissions are being checked
  if (!permission) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0000ff" />
        <Text>Requesting camera permission...</Text>
      </View>
    );
  }

  // Handle permission denied
  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.permissionContainer}>
          <Ionicons name="camera" size={64} color="#FF3B30" />
          <Text style={styles.permissionText}>Camera access is required</Text>
          <TouchableOpacity
            style={styles.permissionButton}
            onPress={requestPermission}
          >
            <Text style={styles.permissionButtonText}>Grant Permission</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Identity Verification</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Camera View */}
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing="front"
        onCameraReady={() => setIsCameraReady(true)}
      />

      {/* Face Overlay */}
      <View style={styles.faceOverlay}>
        <View
          style={[
            styles.faceFrame,
            { borderColor: faceDetected ? "#4CAF50" : "white" },
          ]}
        />

        {faceDetected && !isRecording && !processing && (
          <View style={styles.detectedBanner}>
            <Text style={styles.detectedText}>Face Detected</Text>
          </View>
        )}

        {!faceDetected && !isRecording && !processing && (
          <View style={styles.instructionBanner}>
            <Text style={styles.instructionText}>
              Position your face in the frame
            </Text>
          </View>
        )}

        {checkingFace && (
          <View style={styles.checkingBanner}>
            <ActivityIndicator size="small" color="white" />
            <Text style={styles.checkingText}>Detecting face...</Text>
          </View>
        )}
      </View>

      {/* Camera Not Ready Indicator */}
      {!isCameraReady && (
        <View style={styles.cameraNotReadyOverlay}>
          <ActivityIndicator size="large" color="white" />
          <Text style={styles.cameraNotReadyText}>Initializing camera...</Text>
        </View>
      )}

      {/* Recording UI */}
      {isRecording && (
        <View style={styles.recordingOverlay}>
          <View style={styles.recordingIndicator}>
            <View style={styles.recordingDot} />
            <Text style={styles.recordingText}>
              Recording: {recordingTime}s
            </Text>
          </View>
        </View>
      )}

      {/* Bottom Controls */}
      <View style={styles.controls}>
        {!isRecording && !processing && (
          <>
            {faceDetected ? (
              <TouchableOpacity
                style={[
                  styles.startButton,
                  !isCameraReady && styles.disabledButton,
                ]}
                onPress={startCountdown}
                disabled={!isCameraReady}
              >
                <Text style={styles.startButtonText}>
                  {countdown === 5
                    ? "Start Verification"
                    : `Starting in ${countdown}...`}
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.startButton, styles.disabledButton]}
                disabled={true}
              >
                <Text style={styles.startButtonText}>
                  {isCameraReady
                    ? "Face Detection Required"
                    : "Camera Initializing..."}
                </Text>
              </TouchableOpacity>
            )}
          </>
        )}

        {processing && (
          <View style={styles.processingContainer}>
            <ActivityIndicator size="large" color="white" />
            <Text style={styles.processingText}>
              Processing verification...
            </Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  permissionContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 20,
  },
  permissionText: {
    fontSize: 18,
    fontWeight: "bold",
    textAlign: "center",
    marginVertical: 16,
  },
  permissionButton: {
    backgroundColor: "#4285F4",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  permissionButtonText: {
    color: "white",
    fontWeight: "bold",
    fontSize: 16,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "rgba(0,0,0,0.7)",
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
  },
  placeholder: {
    width: 40,
  },
  camera: {
    flex: 1,
  },
  cameraNotReadyOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.7)",
  },
  cameraNotReadyText: {
    color: "white",
    fontSize: 16,
    marginTop: 16,
  },
  faceOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
  },
  faceFrame: {
    width: width * 0.7,
    height: width * 0.9,
    borderWidth: 2,
    borderRadius: 20,
    borderColor: "white",
  },
  detectedBanner: {
    position: "absolute",
    top: height * 0.2,
    backgroundColor: "rgba(76, 175, 80, 0.8)",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  detectedText: {
    color: "white",
    fontWeight: "bold",
  },
  instructionBanner: {
    position: "absolute",
    top: height * 0.2,
    backgroundColor: "rgba(255, 255, 255, 0.8)",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  instructionText: {
    color: "black",
    fontWeight: "bold",
  },
  checkingBanner: {
    position: "absolute",
    bottom: height * 0.3,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    gap: 8,
  },
  checkingText: {
    color: "white",
    fontWeight: "500",
  },
  recordingOverlay: {
    position: "absolute",
    top: 16,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  recordingIndicator: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 59, 48, 0.8)",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  recordingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "red",
    marginRight: 8,
  },
  recordingText: {
    color: "white",
    fontWeight: "bold",
  },
  controls: {
    position: "absolute",
    bottom: 40,
    left: 20,
    right: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  startButton: {
    backgroundColor: "#4285F4",
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    width: "100%",
    alignItems: "center",
  },
  disabledButton: {
    backgroundColor: "#666",
  },
  startButtonText: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
  },
  processingContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  processingText: {
    color: "white",
    fontSize: 16,
    marginTop: 16,
  },
});
