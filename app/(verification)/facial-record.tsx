import { Routes } from "@/constants/routes";
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

interface VerificationStep {
  id: string;
  title: string;
  status: "pending" | "success" | "error" | "processing";
}

export default function FacialRecord() {
  const cameraRef = useRef<any>(null);
  const router = useRouter();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [permission, requestPermission] = useCameraPermissions();

  const [isCameraReady, setIsCameraReady] = useState(false);
  const [faceDetected, setFaceDetected] = useState(false);
  const [captureInProgress, setCaptureInProgress] = useState(false);
  const [captureCount, setCaptureCount] = useState(0);
  const [verificationInProgress, setVerificationInProgress] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [isMounted, setIsMounted] = useState(true);

  const [verificationSteps, setVerificationSteps] = useState<
    VerificationStep[]
  >([
    { id: "face-detection", title: "Face Detected", status: "pending" },
    { id: "deepfake-check", title: "Deepfake Check", status: "pending" },
    { id: "face-match", title: "Identity Match", status: "pending" },
  ]);

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  useEffect(() => {
    setIsMounted(true);
    return () => {
      setIsMounted(false);
    };
  }, []);

  useEffect(() => {
    let faceDetectionInterval: ReturnType<typeof setInterval> | null = null;
    let initialCheckTimeout: ReturnType<typeof setTimeout> | null = null;

    if (
      permission?.granted &&
      isCameraReady &&
      !faceDetected &&
      !captureInProgress &&
      !verificationInProgress
    ) {
      faceDetectionInterval = setInterval(() => {
        if (!faceDetected && !captureInProgress && !verificationInProgress) {
          checkFaceDetection();
        }
      }, 2000);

      initialCheckTimeout = setTimeout(() => {
        if (!faceDetected && !captureInProgress && !verificationInProgress) {
          checkFaceDetection();
        }
      }, 500);
    }

    return () => {
      if (faceDetectionInterval !== null) {
        clearInterval(faceDetectionInterval);
      }
      if (initialCheckTimeout !== null) {
        clearTimeout(initialCheckTimeout);
      }
    };
  }, [
    permission?.granted,
    isCameraReady,
    faceDetected,
    captureInProgress,
    verificationInProgress,
  ]);

  const updateVerificationStep = (
    stepId: string,
    status: VerificationStep["status"]
  ) => {
    if (!isMounted) return;

    setVerificationSteps((steps) =>
      steps.map((step) => (step.id === stepId ? { ...step, status } : step))
    );
  };

  const checkFaceDetection = async () => {
    if (
      !isMounted ||
      !cameraRef.current ||
      !isCameraReady ||
      captureInProgress ||
      verificationInProgress
    ) {
      return;
    }

    try {
      const pictureOptions: CameraPictureOptions = {
        quality: 0.5,
        skipProcessing: true,
        base64: false,
        exif: false,
      };

      let photo;
      try {
        photo = await cameraRef.current.takePictureAsync(pictureOptions);
      } catch (err) {
        console.error("Error taking picture for face detection:", err);
        return;
      }
      const formData = new FormData();
      formData.append("image", {
        uri: photo.uri,
        type: "image/jpeg",
        name: "face-check.jpg",
      } as any);

      const token = await SecureStore.getItemAsync("jwt");

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      try {
        const response = await fetch(
          "https://09c6-208-131-174-130.ngrok-free.app/detect-face",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
            },
            body: formData,
            signal: controller.signal,
          }
        );

        clearTimeout(timeoutId);

        // Check if component is still mounted
        if (!isMounted) return;

        // Handle non-OK response
        if (!response.ok) {
          console.error("API error:", response.status);
          return;
        }

        const result = await response.json();

        // Check if faces were detected
        if (
          result.success &&
          Array.isArray(result.faces) &&
          result.faces.length > 0
        ) {
          setFaceDetected(true);
          updateVerificationStep("face-detection", "success");
        } else {
          setFaceDetected(false);
          updateVerificationStep("face-detection", "pending");
        }
      } catch (error) {
        console.error("Face detection network error:", error);

        if (isMounted) {
          setFaceDetected(false);
          updateVerificationStep("face-detection", "pending");
        }
      }
    } catch (error) {
      console.error("Face detection error:", error);

      if (isMounted) {
        setFaceDetected(false);
        updateVerificationStep("face-detection", "pending");
      }
    }
  };

  // Capture a sequence of images for verification
  const captureImagesSequence = async () => {
    if (!isMounted || !cameraRef.current || !isCameraReady) return;

    try {
      setCaptureInProgress(true);
      setCaptureCount(0);

      // Reset verification steps
      updateVerificationStep("deepfake-check", "pending");
      updateVerificationStep("face-match", "pending");

      const images: string[] = [];
      const totalImages = 5;

      // Capture loop
      for (let i = 0; i < totalImages; i++) {
        if (!isMounted || !cameraRef.current) {
          setCaptureInProgress(false);
          return;
        }

        const pictureOptions: CameraPictureOptions = {
          quality: 0.7,
          skipProcessing: false,
          base64: false,
          exif: false,
        };

        try {
          // Set a 3-second timeout for capture
          const capturePromise =
            cameraRef.current.takePictureAsync(pictureOptions);
          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error("Camera capture timeout")), 3000);
          });

          // Race the capture against the timeout
          const photo = await Promise.race([capturePromise, timeoutPromise]);

          if (!isMounted) {
            setCaptureInProgress(false);
            return;
          }

          images.push(photo.uri);
          setCaptureCount(i + 1);

          // Wait between captures
          if (i < totalImages - 1) {
            await new Promise((resolve) => setTimeout(resolve, 1000));
          }

          if (!isMounted) {
            setCaptureInProgress(false);
            return;
          }
        } catch (err) {
          console.error("Error taking picture for verification:", err);

          // If we have at least one image, try to proceed, otherwise fail
          if (images.length > 0) {
            console.log(
              `Proceeding with ${images.length} images instead of ${totalImages}`
            );
            break;
          } else {
            if (isMounted) {
              setCaptureInProgress(false);
              Alert.alert(
                "Camera Error",
                "Unable to capture verification images. Please try again."
              );
            }
            return;
          }
        }
      }

      // Process the captured images if we have any
      if (images.length > 0) {
        await verifyImages(images);
      } else {
        throw new Error("No images were captured");
      }
    } catch (error) {
      console.error("Capture sequence error:", error);

      if (isMounted) {
        Alert.alert(
          "Verification Error",
          "Failed to capture verification images. Please ensure good lighting and that your face is clearly visible."
        );
        setCaptureInProgress(false);
        resetVerificationProcess();
      }
    } finally {
      if (isMounted) {
        setCaptureInProgress(false);
      }
    }
  };

  // Process the captured images and verify identity
  const verifyImages = async (imageUris: string[]) => {
    if (!isMounted) return;

    try {
      setCaptureInProgress(false);
      setVerificationInProgress(true);

      // Update verification steps to processing
      updateVerificationStep("deepfake-check", "processing");
      updateVerificationStep("face-match", "processing");

      const token = await SecureStore.getItemAsync("jwt");

      if (!isMounted) {
        setVerificationInProgress(false);
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

      // Add timeout handling for API request
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);

      try {
        // Send request to backend API
        const response = await fetch(
          "https://09c6-208-131-174-130.ngrok-free.app/verify-images",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
            },
            body: formData,
            signal: controller.signal,
          }
        );

        clearTimeout(timeoutId);

        if (!isMounted) {
          setVerificationInProgress(false);
          return;
        }

        // Handle API response
        if (!response.ok) {
          console.error("Verify API error:", response.status);

          if (isMounted) {
            updateVerificationStep("deepfake-check", "error");
            updateVerificationStep("face-match", "error");
            handleVerificationFailure();
          }
          return;
        }

        const result = await response.json();

        if (!isMounted) return;

        // Update verification steps based on results
        updateVerificationStep(
          "deepfake-check",
          result.deepfake_detected ? "error" : "success"
        );
        updateVerificationStep(
          "face-match",
          result.match ? "success" : "error"
        );

        if (result.success) {
          // Navigate to the VerificationSuccess screen instead of showing an alert
          navigateTo(Routes.CertificateGenerated);
        } else {
          handleVerificationFailure();
        }
      } catch (error) {
        console.error("Verification network error:", error);

        if (isMounted) {
          updateVerificationStep("deepfake-check", "error");
          updateVerificationStep("face-match", "error");
          handleVerificationFailure();
        }
      }
    } catch (error) {
      console.error("Verification processing error:", error);

      if (isMounted) {
        updateVerificationStep("deepfake-check", "error");
        updateVerificationStep("face-match", "error");
        handleVerificationFailure();
      }
    } finally {
      if (isMounted) {
        setVerificationInProgress(false);
      }
    }
  };

  // Handle verification failure
  const handleVerificationFailure = () => {
    if (!isMounted) return;

    const newFailedAttempts = failedAttempts + 1;
    setFailedAttempts(newFailedAttempts);

    if (newFailedAttempts >= 3) {
      Alert.alert(
        "Verification Assistance",
        "We'll connect you with a live agent to help complete your verification.",
        [
          {
            text: "Continue",
            onPress: () => navigateTo(Routes.VideoConference),
          },
        ]
      );
    } else {
      Alert.alert(
        "Verification",
        "Please try again, teher was a face mismatch.",
        [
          {
            text: "Try Again",
            onPress: () => navigateTo(Routes.Step2Verification),
          },
        ]
      );
    }
  };

  // Reset verification process
  const resetVerificationProcess = () => {
    if (!isMounted) return;

    setFaceDetected(false);
    setCaptureInProgress(false);
    setVerificationInProgress(false);
    setCaptureCount(0);

    // Reset verification steps
    updateVerificationStep("face-detection", "pending");
    updateVerificationStep("deepfake-check", "pending");
    updateVerificationStep("face-match", "pending");
  };

  const navigateTo = (route: string) => {
    if (isMounted) {
      router.replace("/");
    }
  };

  if (!permission) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0000ff" />
        <Text>Requesting camera permission...</Text>
      </View>
    );
  }

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
          onPress={() => navigateTo(Routes.Home)}
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
        onMountError={(error) => {
          console.error("Camera mount error:", error);
          Alert.alert(
            "Camera Error",
            "Unable to initialize camera. Please check your device permissions and try again."
          );
        }}
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

        {faceDetected && !captureInProgress && !verificationInProgress && (
          <View style={styles.detectedBanner}>
            <Text style={styles.detectedText}>Face Detected</Text>
          </View>
        )}

        {!faceDetected && !captureInProgress && !verificationInProgress && (
          <View style={styles.instructionBanner}>
            <Text style={styles.instructionText}>
              Position your face in the frame
            </Text>
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

      {/* Capturing UI */}
      {captureInProgress && (
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
        {verificationSteps.map((step) => (
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
        ))}
      </Animated.View>

      {/* Bottom Controls */}
      <Animated.View style={[styles.controls, { opacity: fadeAnim }]}>
        {!captureInProgress && !verificationInProgress && (
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

        {verificationInProgress && (
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
