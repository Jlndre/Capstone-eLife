import { Ionicons } from "@expo/vector-icons";
import {
  CameraPictureOptions,
  CameraView,
  useCameraPermissions,
} from "expo-camera";
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const { width, height } = Dimensions.get("window");

// Define proper interfaces for type safety
interface VerificationStep {
  id: string;
  title: string;
  status: "pending" | "success" | "error" | "processing";
}

export default function FacialRecord() {
  const cameraRef = useRef<any>(null);
  const router = useRouter();
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Add mounted ref to track component lifecycle
  const isMountedRef = useRef(true);

  // Use the permissions hook
  const [permission, requestPermission] = useCameraPermissions();

  // State with proper typing
  const [isCameraReady, setIsCameraReady] = useState<boolean>(false);
  const [faceDetected, setFaceDetected] = useState<boolean>(false);
  const [isCapturing, setIsCapturing] = useState<boolean>(false);
  const [captureCount, setCaptureCount] = useState<number>(0);
  const [processing, setProcessing] = useState<boolean>(false);
  const [checkingFace, setCheckingFace] = useState<boolean>(false);
  const [showFaceDetection, setShowFaceDetection] = useState<boolean>(true);
  const [failedAttempts, setFailedAttempts] = useState<number>(0);

  // Verification steps tracking
  const [verificationSteps, setVerificationSteps] = useState<
    VerificationStep[]
  >([
    { id: "face-detection", title: "Face Detected", status: "pending" },
    { id: "deepfake-check", title: "Deepfake Check", status: "pending" },
    { id: "face-match", title: "Identity Match", status: "pending" },
  ]);

  // Face detection check interval
  const faceDetectionIntervalRef = useRef<number | null>(null);

  // Track timeouts to clear them on unmount
  const timeoutRefsArray = useRef<number[]>([]);

  // Safe setTimeout that we can clean up
  const safeSetTimeout = (callback: () => void, delay: number) => {
    const timeoutId = setTimeout(() => {
      if (isMountedRef.current) {
        callback();
      }
    }, delay);

    timeoutRefsArray.current.push(timeoutId);
    return timeoutId;
  };

  // Set mounted flag to false on unmount
  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;

      // Clear all timeouts on unmount
      timeoutRefsArray.current.forEach(clearTimeout);
      timeoutRefsArray.current = [];

      // Clear interval if it exists
      if (faceDetectionIntervalRef.current) {
        clearInterval(faceDetectionIntervalRef.current);
        faceDetectionIntervalRef.current = null;
      }

      // Stop camera operations if possible
      if (cameraRef.current) {
        // Some camera implementations have these methods
        if (typeof cameraRef.current.pausePreview === "function") {
          cameraRef.current.pausePreview();
        }
      }
    };
  }, []);

  // Fade in animation for UI elements
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  // Safe navigation function to properly clean up before routing
  const safeNavigate = (route: string) => {
    // Clear all timeouts and intervals
    timeoutRefsArray.current.forEach(clearTimeout);
    timeoutRefsArray.current = [];

    if (faceDetectionIntervalRef.current) {
      clearInterval(faceDetectionIntervalRef.current);
      faceDetectionIntervalRef.current = null;
    }

    // Stop any ongoing camera operations
    setIsCapturing(false);
    setProcessing(false);
    setCheckingFace(false);

    // Pause camera if possible
    if (
      cameraRef.current &&
      typeof cameraRef.current.pausePreview === "function"
    ) {
      cameraRef.current.pausePreview();
    }

    // Now safe to navigate
    router.replace(route);
  };

  // Check for face detection using API
  const checkFaceDetection = async () => {
    // Add camera ready check and mounted check
    if (
      !isMountedRef.current ||
      !cameraRef.current ||
      !isCameraReady ||
      checkingFace ||
      isCapturing ||
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

      // Check mounted state before taking picture
      if (!isMountedRef.current || !cameraRef.current) {
        setCheckingFace(false);
        return;
      }

      const photo = await cameraRef.current.takePictureAsync(pictureOptions);

      // Check mounted state after async operation
      if (!isMountedRef.current) {
        setCheckingFace(false);
        return;
      }

      console.log("Captured photo for face detection:", photo?.uri);

      // Create form data for API request
      const formData = new FormData();
      formData.append("image", {
        uri: photo.uri,
        type: "image/jpeg",
        name: "face-check.jpg",
      } as any);

      // Replace with your actual face detection API
      const token = await SecureStore.getItemAsync("jwt");

      // Check mounted state before fetch
      if (!isMountedRef.current) {
        setCheckingFace(false);
        return;
      }

      const response = await fetch(
        "https://b018-63-143-118-227.ngrok-free.app/detect-face",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        }
      );

      // Check mounted state after fetch
      if (!isMountedRef.current) {
        setCheckingFace(false);
        return;
      }

      // Add error handling for API response
      if (!response.ok) {
        const errorText = await response.text();
        console.error("API error:", response.status, errorText);
        setCheckingFace(false);
        return;
      }

      const contentType = response.headers.get("Content-Type");
      if (!contentType?.includes("application/json")) {
        const text = await response.text();
        console.error("Unexpected response type:", contentType, text);
        setCheckingFace(false);
        return;
      }

      const result = await response.json();

      // Final mounted check before updating state
      if (!isMountedRef.current) {
        return;
      }

      // Fixed: Better check for face detection result
      if (
        result.success &&
        Array.isArray(result.faces) &&
        result.faces.length > 0
      ) {
        const wasAlreadyDetected = faceDetected;
        setFaceDetected(true);

        // Update verification step status
        updateVerificationStep("face-detection", "success");

        // Only trigger automatic capture on initial detection
        if (!wasAlreadyDetected) {
          setShowFaceDetection(true);

          // Clear the face detection interval - this is the key change
          if (faceDetectionIntervalRef.current) {
            clearInterval(faceDetectionIntervalRef.current);
            faceDetectionIntervalRef.current = null;
          }

          // Show detection UI briefly, then start capturing
          safeSetTimeout(() => {
            if (!isMountedRef.current) return;
            setShowFaceDetection(false);
            captureImagesSequence(); // Automatically start capturing after face detection
          }, 1500);
        }
      } else {
        setFaceDetected(false);
        updateVerificationStep("face-detection", "pending");
      }
    } catch (error) {
      console.error("Face detection error:", error);
      if (isMountedRef.current) {
        setFaceDetected(false);
        updateVerificationStep("face-detection", "pending");
      }
    } finally {
      if (isMountedRef.current) {
        setCheckingFace(false);
      }
    }
  };

  // Update a verification step status
  const updateVerificationStep = (
    stepId: string,
    status: VerificationStep["status"]
  ) => {
    if (!isMountedRef.current) return;

    setVerificationSteps((steps) =>
      steps.map((step) => (step.id === stepId ? { ...step, status } : step))
    );
  };

  // Set up periodic face detection
  useEffect(() => {
    // Only start face detection if nothing else is happening and we don't already have a face
    if (
      permission?.granted &&
      !isCapturing &&
      !processing &&
      isCameraReady &&
      !faceDetected &&
      !faceDetectionIntervalRef.current &&
      isMountedRef.current
    ) {
      // Check face detection every 2 seconds
      faceDetectionIntervalRef.current = setInterval(() => {
        if (isMountedRef.current) {
          checkFaceDetection();
        }
      }, 2000);

      // Initial check
      safeSetTimeout(() => {
        if (isMountedRef.current) {
          checkFaceDetection();
        }
      }, 500);
    }

    return () => {
      if (faceDetectionIntervalRef.current) {
        clearInterval(faceDetectionIntervalRef.current);
        faceDetectionIntervalRef.current = null;
      }
    };
  }, [
    permission?.granted,
    isCapturing,
    processing,
    isCameraReady,
    faceDetected,
  ]);

  // Capture a sequence of images for verification
  const captureImagesSequence = async () => {
    if (!isMountedRef.current || !cameraRef.current || !isCameraReady) return;

    try {
      setIsCapturing(true);
      setCaptureCount(0);

      // Reset verification steps
      updateVerificationStep("deepfake-check", "pending");
      updateVerificationStep("face-match", "pending");

      const images = [];
      const totalImages = 5; // We'll capture 5 images

      // Capture images with delay between each
      for (let i = 0; i < totalImages; i++) {
        // Check if still mounted before each capture
        if (!isMountedRef.current || !cameraRef.current) {
          setIsCapturing(false);
          return;
        }

        const pictureOptions: CameraPictureOptions = {
          quality: 0.7,
        };

        const photo = await cameraRef.current.takePictureAsync(pictureOptions);

        // Check mounted state after async operation
        if (!isMountedRef.current) {
          setIsCapturing(false);
          return;
        }

        images.push(photo.uri);
        setCaptureCount(i + 1);

        await new Promise((resolve) => setTimeout(resolve, 300));

        // Wait 1 second between captures if not the last image
        if (i < totalImages - 1) {
          await new Promise<void>((resolve) => {
            const timeout = setTimeout(() => {
              resolve();
            }, 1000);
            timeoutRefsArray.current.push(timeout);
          });

          // Check mounted state after delay
          if (!isMountedRef.current) {
            setIsCapturing(false);
            return;
          }
        }
      }

      // Process the captured images
      await processImages(images);
    } catch (error) {
      console.error("Capture sequence error:", error);
      if (isMountedRef.current) {
        Alert.alert("Error", "Failed to capture verification images");
        setIsCapturing(false);
        resetVerificationProcess();
      }
    }
  };

  // Process the captured images
  const processImages = async (imageUris: string[]) => {
    if (!isMountedRef.current) return;

    try {
      setIsCapturing(false);
      setProcessing(true);

      // Update verification steps
      updateVerificationStep("deepfake-check", "processing");
      updateVerificationStep("face-match", "processing");

      const token = await SecureStore.getItemAsync("jwt");

      // Check mounted state after async operation
      if (!isMountedRef.current) {
        setProcessing(false);
        return;
      }

      // Create form data for API request
      const formData = new FormData();

      // Add all images to form data
      imageUris.forEach((uri, index) => {
        formData.append("images", {
          uri,
          type: "image/jpeg",
          name: `verification-${index + 1}.jpg`,
        } as any);
      });

      // Send request to backend API
      const response = await fetch(
        "https://b018-63-143-118-227.ngrok-free.app/verify-images",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        }
      );

      // Check mounted state after fetch
      if (!isMountedRef.current) {
        setProcessing(false);
        return;
      }

      // Handle API response
      if (!response.ok) {
        const errorText = await response.text();
        console.error("Verify API error:", response.status, errorText);

        if (isMountedRef.current) {
          updateVerificationStep("deepfake-check", "error");
          updateVerificationStep("face-match", "error");
          handleVerificationFailure("An error occurred during verification");
        }
        return;
      }

      const result = await response.json();

      // Final mounted check before updating state
      if (!isMountedRef.current) {
        return;
      }

      // Update verification steps based on results
      updateVerificationStep(
        "deepfake-check",
        result.deepfake_detected ? "error" : "success"
      );
      updateVerificationStep("face-match", result.match ? "success" : "error");

      if (result.success) {
        Alert.alert(
          "Verification Successful",
          "Your identity has been verified successfully. Your funds are on the way.",
          [{ text: "OK", onPress: () => safeNavigate("/(tabs)/dashboard") }]
        );
      } else {
        let failureReason = "We couldn't verify your identity.";
        if (result.deepfake_detected) {
          failureReason =
            "Our system detected potential manipulation in the captured images.";
        } else if (!result.match) {
          failureReason =
            "The face in the images doesn't match your ID document.";
        }

        handleVerificationFailure(failureReason);
      }
    } catch (error) {
      console.error("Processing error:", error);

      if (isMountedRef.current) {
        // Update verification steps
        updateVerificationStep("deepfake-check", "error");
        updateVerificationStep("face-match", "error");
        handleVerificationFailure("An error occurred during verification");
      }
    } finally {
      if (isMountedRef.current) {
        setProcessing(false);
      }
    }
  };

  // Handle verification failure
  const handleVerificationFailure = (message: string) => {
    if (!isMountedRef.current) return;

    const newFailedAttempts = failedAttempts + 1;
    setFailedAttempts(newFailedAttempts);

    if (newFailedAttempts >= 3) {
      Alert.alert(
        "Verification Failed",
        "Multiple verification attempts failed. Connecting you to a live agent.",
        [{ text: "OK", onPress: () => safeNavigate("/LiveConference") }]
      );
    } else {
      Alert.alert(
        "Verification Failed",
        `${message}. Please try again in better lighting conditions. (Attempt ${newFailedAttempts}/3)`,
        [
          {
            text: "Try Again",
            onPress: () => {
              // Navigate back to step2 screen
              safeNavigate("/step2");
            },
          },
        ]
      );
    }
  };

  // Reset verification process after failure
  const resetVerificationProcess = () => {
    if (!isMountedRef.current) return;

    // Reset states
    setFaceDetected(false);
    setIsCapturing(false);
    setProcessing(false);
    setCaptureCount(0);

    // Reset verification steps
    updateVerificationStep("face-detection", "pending");
    updateVerificationStep("deepfake-check", "pending");
    updateVerificationStep("face-match", "pending");

    // Restart face detection
    if (!faceDetectionIntervalRef.current && isMountedRef.current) {
      faceDetectionIntervalRef.current = setInterval(() => {
        if (isMountedRef.current) {
          checkFaceDetection();
        }
      }, 2000);
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
          onPress={() => safeNavigate("/")}
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
      <Animated.View style={[styles.faceOverlay, { opacity: fadeAnim }]}>
        <View
          style={[
            styles.faceFrame,
            {
              borderColor: faceDetected ? "#4CAF50" : "white",
              backgroundColor: faceDetected
                ? "rgba(76, 175, 80, 0.2)"
                : "transparent",
            },
          ]}
        />

        {faceDetected && !isCapturing && !processing && (
          <View style={styles.detectedBanner}>
            <Text style={styles.detectedText}>Face Detected</Text>
          </View>
        )}

        {!faceDetected && !isCapturing && !processing && (
          <View style={styles.instructionBanner}>
            <Text style={styles.instructionText}>
              Position your face in the frame
            </Text>
          </View>
        )}

        {checkingFace && showFaceDetection && !faceDetected && (
          <View style={styles.checkingBanner}>
            <ActivityIndicator size="small" color="white" />
            <Text style={styles.checkingText}>Detecting face...</Text>
          </View>
        )}
      </Animated.View>

      {/* Camera Not Ready Indicator */}
      {!isCameraReady && (
        <View style={styles.cameraNotReadyOverlay}>
          <ActivityIndicator size="large" color="white" />
          <Text style={styles.cameraNotReadyText}>Initializing camera...</Text>
        </View>
      )}

      {/* Capturing UI - Moved to bottom half of screen */}
      {isCapturing && (
        <View style={styles.capturingOverlay}>
          <View style={styles.capturingIndicator}>
            <ActivityIndicator size="small" color="white" />
            <Text style={styles.capturingText}>
              Capturing image {captureCount}/5
            </Text>
          </View>
        </View>
      )}

      {/* Verification Steps */}
      <Animated.View style={[styles.verificationSteps, { opacity: fadeAnim }]}>
        {verificationSteps.map(
          (step: {
            id: React.Key | null | undefined;
            status: string;
            title:
              | string
              | number
              | bigint
              | boolean
              | React.ReactElement<
                  unknown,
                  string | React.JSXElementConstructor<any>
                >
              | Iterable<React.ReactNode>
              | React.ReactPortal
              | Promise<
                  | string
                  | number
                  | bigint
                  | boolean
                  | React.ReactPortal
                  | React.ReactElement<
                      unknown,
                      string | React.JSXElementConstructor<any>
                    >
                  | Iterable<React.ReactNode>
                  | null
                  | undefined
                >
              | null
              | undefined;
          }) => (
            <View key={step.id} style={styles.verificationStep}>
              <View
                style={[
                  styles.stepIndicator,
                  step.status === "pending" && styles.stepPending,
                  step.status === "success" && styles.stepSuccess,
                  step.status === "error" && styles.stepError,
                  step.status === "processing" && styles.stepProcessing,
                ]}
              >
                {step.status === "success" && (
                  <Ionicons name="checkmark" size={16} color="white" />
                )}
                {step.status === "error" && (
                  <Ionicons name="close" size={16} color="white" />
                )}
                {step.status === "processing" && (
                  <ActivityIndicator size="small" color="white" />
                )}
              </View>
              <Text style={styles.stepText}>{step.title}</Text>
            </View>
          )
        )}
      </Animated.View>

      {/* Bottom Controls */}
      <Animated.View style={[styles.controls, { opacity: fadeAnim }]}>
        {!isCapturing && !processing && (
          <>
            {faceDetected ? (
              <TouchableOpacity
                style={[
                  styles.startButton,
                  !isCameraReady && styles.disabledButton,
                ]}
                onPress={captureImagesSequence}
                disabled={!isCameraReady}
              >
                <Text style={styles.startButtonText}>Start Verification</Text>
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
      </Animated.View>
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
    zIndex: 10,
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
    zIndex: 20,
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
    zIndex: 5,
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
  capturingOverlay: {
    position: "absolute",
    bottom: height * 0.4,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 15,
  },
  capturingIndicator: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0, 102, 204, 0.8)",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 25,
    gap: 10,
  },
  capturingText: {
    color: "white",
    fontWeight: "bold",
    fontSize: 16,
  },
  controls: {
    position: "absolute",
    bottom: 40,
    left: 20,
    right: 20,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
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
  verificationSteps: {
    position: "absolute",
    bottom: 120,
    left: 20,
    right: 20,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    borderRadius: 12,
    padding: 16,
    zIndex: 10,
  },
  verificationStep: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    gap: 12,
  },
  stepIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  stepPending: {
    backgroundColor: "#999",
  },
  stepSuccess: {
    backgroundColor: "#4CAF50",
  },
  stepError: {
    backgroundColor: "#F44336",
  },
  stepProcessing: {
    backgroundColor: "#2196F3",
  },
  stepText: {
    color: "white",
    fontSize: 14,
  },
});
