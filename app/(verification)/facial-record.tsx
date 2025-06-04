import { Routes } from "@/constants/routes";
import { API_BASE_URL } from "@/utils/config";
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
  Modal,
  SafeAreaView,
  ScrollView,
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

interface LivenessDetails {
  blinks_detected: number;
  movements_detected: number;
  confidence: number;
  frames_analyzed: number;
  reason: string;
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
  const [showLivenessInstructions, setShowLivenessInstructions] =
    useState(false);

  // Updated verification steps with liveness detection
  const [verificationSteps, setVerificationSteps] = useState<
    VerificationStep[]
  >([
    { id: "face-detection", title: "Face Detected", status: "pending" },
    { id: "liveness-check", title: "Liveness Detection", status: "pending" },
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

  const showLivenessGuide = () => {
    setShowLivenessInstructions(true);
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
        const response = await fetch(`${API_BASE_URL}/detect-face`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        // Check if component is still mounted
        if (!isMounted) return;

        // Handle non-OK response

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
        if (isMounted) {
          setFaceDetected(false);
          updateVerificationStep("face-detection", "pending");
        }
      }
    } catch (error) {
      if (isMounted) {
        setFaceDetected(false);
        updateVerificationStep("face-detection", "pending");
      }
    }
  };

  // Capture a sequence of images for liveness verification
  const captureImagesSequence = async () => {
    if (!isMounted || !cameraRef.current || !isCameraReady) return;

    try {
      setCaptureInProgress(true);
      setCaptureCount(0);

      // Reset verification steps
      updateVerificationStep("liveness-check", "pending");
      updateVerificationStep("deepfake-check", "pending");
      updateVerificationStep("face-match", "pending");

      const images: string[] = [];
      const totalImages = 10; // Required for liveness detection

      // Capture loop with liveness-specific timing
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

          // Slightly longer wait between captures for liveness detection
          if (i < totalImages - 1) {
            await new Promise((resolve) => setTimeout(resolve, 1200));
          }

          if (!isMounted) {
            setCaptureInProgress(false);
            return;
          }
        } catch (err) {
          // For liveness detection, we need all 5 images minimum
          if (images.length < 3) {
            if (isMounted) {
              setCaptureInProgress(false);
              Alert.alert(
                "Capture Error",
                "Unable to capture enough images for liveness detection. Please ensure good lighting and try again."
              );
            }
            return;
          } else {
            console.log(
              `Proceeding with ${images.length} images instead of ${totalImages}`
            );
            break;
          }
        }
      }

      // Process the captured images if we have enough
      if (images.length >= 3) {
        await verifyImages(images);
      } else {
        throw new Error("Insufficient images for liveness detection");
      }
    } catch (error) {
      if (isMounted) {
        Alert.alert(
          "Liveness Capture Error",
          "Failed to capture images for liveness verification. Please ensure you blink naturally and make slight head movements during capture."
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

  // Process the captured images and verify identity with liveness
  const verifyImages = async (imageUris: string[]) => {
    if (!isMounted) return;

    try {
      setCaptureInProgress(false);
      setVerificationInProgress(true);

      // Update verification steps to processing
      updateVerificationStep("liveness-check", "processing");
      updateVerificationStep("deepfake-check", "processing");
      updateVerificationStep("face-match", "processing");

      const token = await SecureStore.getItemAsync("jwt");

      if (!isMounted) {
        setVerificationInProgress(false);
        return;
      }

      // Create form data for API request
      const formData = new FormData();

      // Add all images to form data for liveness detection
      imageUris.forEach((uri, index) => {
        formData.append("images", {
          uri,
          type: "image/jpeg",
          name: `verification-${index + 1}.jpg`,
        } as any);
      });

      // Add timeout handling for API request (longer for liveness processing)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 90000); // 90 seconds for liveness processing

      try {
        // Send request to backend API with liveness detection
        const response = await fetch(`${API_BASE_URL}/verify-images`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!isMounted) {
          setVerificationInProgress(false);
          return;
        }

        // Handle API response with liveness data
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));

          if (isMounted) {
            updateVerificationStep("liveness-check", "error");
            updateVerificationStep("deepfake-check", "error");
            updateVerificationStep("face-match", "error");

            // Handle specific liveness failures
            if (errorData.liveness_failed) {
              handleLivenessFailure(errorData.liveness_details);
            } else if (errorData.can_retry !== false) {
              handleVerificationFailure();
            } else {
              Alert.alert(
                "Verification Error",
                errorData.message ||
                  "Verification failed. Please contact support.",
                [{ text: "OK", onPress: () => navigateTo(Routes.Home) }]
              );
            }
          }
          return;
        }

        const result = await response.json();

        if (!isMounted) return;

        // Update verification steps based on liveness results
        updateVerificationStep(
          "liveness-check",
          result.liveness_passed ? "success" : "error"
        );
        updateVerificationStep(
          "deepfake-check",
          result.deepfake_detected ? "error" : "success"
        );
        updateVerificationStep(
          "face-match",
          result.match ? "success" : "error"
        );

        if (result.success) {
          // All verifications passed including liveness
          navigateTo(Routes.CertificateGenerated);
        } else {
          // Handle specific failure types
          if (!result.liveness_passed) {
            handleLivenessFailure(result.liveness_details);
          } else if (result.can_retry !== false) {
            handleVerificationFailure();
          } else {
            Alert.alert(
              "Verification Failed",
              result.message || "Verification failed permanently.",
              [{ text: "OK", onPress: () => navigateTo(Routes.Home) }]
            );
          }
        }
      } catch (error) {
        if (isMounted) {
          updateVerificationStep("liveness-check", "error");
          updateVerificationStep("deepfake-check", "error");
          updateVerificationStep("face-match", "error");
          handleVerificationFailure();
        }
      }
    } catch (error) {
      if (isMounted) {
        updateVerificationStep("liveness-check", "error");
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

  // Handle liveness detection failure specifically
  const handleLivenessFailure = (livenessDetails?: LivenessDetails) => {
    if (!isMounted) return;

    let failureMessage = "Liveness detection failed. Please ensure you:\n\n";

    if (livenessDetails) {
      failureMessage += `• Detected blinks: ${livenessDetails.blinks_detected} (need 2+)\n`;
      failureMessage += `• Detected movements: ${livenessDetails.movements_detected} (need 1+)\n`;
      failureMessage += `• Confidence: ${(
        livenessDetails.confidence * 100
      ).toFixed(1)}% (need 70%+)\n\n`;

      if (livenessDetails.blinks_detected < 2) {
        failureMessage += "• Blink naturally 2-3 times during capture\n";
      }
      if (livenessDetails.movements_detected < 1) {
        failureMessage +=
          "• Make slight head movements (turn left/right, up/down)\n";
      }
      failureMessage += "• Ensure good lighting on your face\n";
      failureMessage += "• Look directly at the camera";
    } else {
      failureMessage += "• Blink naturally 2-3 times\n";
      failureMessage += "• Make slight head movements\n";
      failureMessage += "• Ensure good lighting\n";
      failureMessage += "• Look directly at the camera";
    }

    Alert.alert("Liveness Check Failed", failureMessage, [
      {
        text: "View Guide",
        onPress: () => showLivenessGuide(),
      },
      {
        text: "Try Again",
        onPress: () => resetVerificationProcess(),
      },
      {
        text: "Cancel",
        onPress: () => navigateTo(Routes.Home),
        style: "cancel",
      },
    ]);
  };

  // Handle general verification failure
  const handleVerificationFailure = () => {
    if (!isMounted) return;

    const newFailedAttempts = failedAttempts + 1;
    setFailedAttempts(newFailedAttempts);

    if (newFailedAttempts >= 3) {
      Alert.alert(
        "Verification Assistance",
        "Multiple verification attempts failed. We'll connect you with a live agent for assistance.",
        [
          {
            text: "Continue",
            onPress: () => navigateTo(Routes.VideoConference),
          },
        ]
      );
    } else {
      Alert.alert(
        "Verification Failed",
        "Verification unsuccessful. Please ensure good lighting, face the camera directly, and follow the liveness requirements.",
        [
          {
            text: "View Guide",
            onPress: () => showLivenessGuide(),
          },
          {
            text: "Try Again",
            onPress: () => resetVerificationProcess(),
          },
          {
            text: "Cancel",
            onPress: () => navigateTo(Routes.Home),
            style: "cancel",
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
    updateVerificationStep("liveness-check", "pending");
    updateVerificationStep("deepfake-check", "pending");
    updateVerificationStep("face-match", "pending");
  };

  const navigateTo = (route: any) => {
    if (isMounted) {
      router.replace(route);
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
        <TouchableOpacity style={styles.helpButton} onPress={showLivenessGuide}>
          <Ionicons name="help-circle" size={24} color="white" />
        </TouchableOpacity>
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
            <Text style={styles.detectedText}>✓ Face Detected</Text>
            <Text style={styles.livenessHint}>
              Ready for liveness verification
            </Text>
          </View>
        )}

        {!faceDetected && !captureInProgress && !verificationInProgress && (
          <View style={styles.instructionBanner}>
            <Text style={styles.instructionText}>
              Position your face in the frame
            </Text>
            <Text style={styles.livenessSubtext}>
              Prepare to blink naturally & move head slightly
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

      {/* Capturing UI with Liveness Instructions */}
      {captureInProgress && (
        <View style={styles.capturingOverlay}>
          <View style={styles.capturingIndicator}>
            <ActivityIndicator size="small" color="white" />
            <Text style={styles.capturingText}>
              Capturing image {captureCount}/10
            </Text>
          </View>
          <View style={styles.livenessInstructions}>
            <Text style={styles.livenessInstructionText}>
              {captureCount <= 5 ? "Blink naturally" : "Move head slightly"}
            </Text>
          </View>
        </View>
      )}

      {/* Enhanced Verification Steps */}
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
                <Text style={styles.startButtonText}>
                  Start Liveness Verification
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

        {verificationInProgress && (
          <View style={styles.processingContainer}>
            <ActivityIndicator size="large" color="white" />
            <Text style={styles.processingText}>
              Processing verification with liveness detection...
            </Text>
          </View>
        )}
      </Animated.View>

      {/* Liveness Instructions Modal */}
      <Modal
        visible={showLivenessInstructions}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowLivenessInstructions(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Liveness Verification Guide</Text>

            <ScrollView style={styles.modalScrollView}>
              <View style={styles.instructionSection}>
                <Ionicons name="eye" size={24} color="#4285F4" />
                <View style={styles.instructionTextContainer}>
                  <Text style={styles.instructionItemTitle}>
                    Natural Blinking
                  </Text>
                  <Text style={styles.instructionItemText}>
                    Blink naturally 2-3 times during the 10-image capture
                    sequence
                  </Text>
                </View>
              </View>

              <View style={styles.instructionSection}>
                <Ionicons name="swap-horizontal" size={24} color="#4285F4" />
                <View style={styles.instructionTextContainer}>
                  <Text style={styles.instructionItemTitle}>Head Movement</Text>
                  <Text style={styles.instructionItemText}>
                    Make slight head movements - turn left/right or up/down
                    slightly
                  </Text>
                </View>
              </View>

              <View style={styles.instructionSection}>
                <Ionicons name="sunny" size={24} color="#4285F4" />
                <View style={styles.instructionTextContainer}>
                  <Text style={styles.instructionItemTitle}>Good Lighting</Text>
                  <Text style={styles.instructionItemText}>
                    Ensure your face is well-lit and clearly visible
                  </Text>
                </View>
              </View>

              <View style={styles.instructionSection}>
                <Ionicons name="camera" size={24} color="#4285F4" />
                <View style={styles.instructionTextContainer}>
                  <Text style={styles.instructionItemTitle}>Face Position</Text>
                  <Text style={styles.instructionItemText}>
                    Keep your face centered in the frame and look directly at
                    the camera
                  </Text>
                </View>
              </View>

              <View style={styles.warningSection}>
                <Ionicons name="warning" size={20} color="#FF9500" />
                <Text style={styles.warningText}>
                  Liveness detection prevents fake photos or videos from being
                  used for verification
                </Text>
              </View>
            </ScrollView>

            <TouchableOpacity
              style={styles.modalButton}
              onPress={() => setShowLivenessInstructions(false)}
            >
              <Text style={styles.modalButtonText}>Got It</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  helpButton: {
    padding: 8,
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
    alignItems: "center",
  },
  detectedText: {
    color: "white",
    fontWeight: "bold",
    fontSize: 16,
  },
  livenessHint: {
    color: "white",
    fontSize: 12,
    marginTop: 2,
  },
  instructionBanner: {
    position: "absolute",
    top: height * 0.2,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    alignItems: "center",
  },
  instructionText: {
    color: "black",
    fontWeight: "bold",
    fontSize: 16,
  },
  livenessSubtext: {
    color: "black",
    fontSize: 12,
    marginTop: 2,
    textAlign: "center",
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
  livenessInstructions: {
    marginTop: 10,
    backgroundColor: "rgba(76, 175, 80, 0.8)",
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 15,
  },
  livenessInstructionText: {
    color: "white",
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
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
    textAlign: "center",
  },
  verificationSteps: {
    position: "absolute",
    bottom: 120,
    left: 20,
    right: 20,
    backgroundColor: "rgba(0, 0, 0, 0.8)",
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
    fontWeight: "500",
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: "white",
    borderRadius: 20,
    padding: 20,
    margin: 20,
    maxHeight: height * 0.8,
    width: width * 0.9,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#333",
    textAlign: "center",
    marginBottom: 20,
  },
  modalScrollView: {
    maxHeight: height * 0.6,
  },
  instructionSection: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 20,
    paddingHorizontal: 10,
  },
  instructionTextContainer: {
    flex: 1,
    marginLeft: 16,
  },
  instructionItemTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 4,
  },
  instructionItemText: {
    fontSize: 14,
    color: "#666",
    lineHeight: 20,
  },
  warningSection: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF3CD",
    padding: 12,
    borderRadius: 8,
    marginTop: 10,
  },
  warningText: {
    fontSize: 14,
    color: "#856404",
    marginLeft: 8,
    flex: 1,
    lineHeight: 18,
  },
  modalButton: {
    backgroundColor: "#4285F4",
    borderRadius: 10,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 20,
  },
  modalButtonText: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
  },
});
