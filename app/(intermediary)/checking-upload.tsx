import { Images } from "@/assets/images";
import { Routes } from "@/constants/routes";
import { API_BASE_URL } from "@/utils/config";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import React, { useEffect, useRef } from "react";
import {
  Animated,
  Dimensions,
  ImageBackground,
  StyleSheet,
  Text,
  View,
} from "react-native";

const { width, height } = Dimensions.get("window");

const ApprovalPendingScreen = () => {
  const router = useRouter();
  const params = useLocalSearchParams();

  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animate = (dot: Animated.Value, delay: number) => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(dot, {
            toValue: -8,
            duration: 400,
            delay,
            useNativeDriver: true,
          }),
          Animated.timing(dot, {
            toValue: 0,
            duration: 400,
            useNativeDriver: true,
          }),
        ])
      ).start();
    };

    animate(dot1, 0);
    animate(dot2, 200);
    animate(dot3, 400);

    // Process the actual upload
    processUpload();
  }, []);

  const processUpload = async () => {
    try {
      // Get upload data from params
      const imageUri = params.imageUri as string;
      const idType = params.idType as string;

      if (!imageUri) {
        console.error("No image URI provided");
        router.replace(Routes.UploadError);
        return;
      }

      console.log("Processing ID upload...");

      // Get JWT token
      const token = await SecureStore.getItemAsync("jwt");
      if (!token) {
        console.error("No authentication token found");
        router.replace(Routes.UploadError);
        return;
      }

      // Create form data
      const formData = new FormData();
      formData.append("id_image", {
        uri: imageUri,
        type: "image/jpeg",
        name: "id_document.jpg",
      } as any);

      if (idType) {
        formData.append("id_type", idType);
      }

      // Add timeout for the upload
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

      try {
        // Make the API call
        const response = await fetch(`${API_BASE_URL}/verify-id-upload`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        const result = await response.json();

        if (response.ok) {
          console.log("ID upload successful:", result);
          
          // Store submission ID if provided
          if (result.submission_id) {
            await SecureStore.setItemAsync("latest_submission_id", result.submission_id.toString());
          }

          // Navigate to success screen
          router.replace(Routes.UploadSuccess);
        } else {
          console.error("ID upload failed:", result);
          
          // Store error details for the error screen
          await SecureStore.setItemAsync("upload_error", JSON.stringify({
            message: result.message || "Upload failed",
            details: result
          }));

          router.replace(Routes.UploadError);
        }
      } catch (networkError) {
        clearTimeout(timeoutId);
        console.error("Network error during upload:", networkError);
        
        // Handle different types of network errors
        let errorMessage = "Network error occurred";
        if (networkError instanceof Error) {
          if (networkError.name === 'AbortError') {
            errorMessage = "Upload timed out. Please check your connection and try again.";
          } else {
            errorMessage = networkError.message || "Failed to connect to server";
          }
        }

        await SecureStore.setItemAsync("upload_error", JSON.stringify({
          message: errorMessage,
          details: { error: networkError instanceof Error ? networkError.message : String(networkError) }
        }));

        router.replace(Routes.UploadError);
      }
    } catch (error) {
      console.error("Error processing upload:", error);
      
      await SecureStore.setItemAsync("upload_error", JSON.stringify({
        message: "An unexpected error occurred",
        details: { error: error instanceof Error ? error.message : String(error) }
      }));

      router.replace(Routes.UploadError);
    }
  };

  return (
    <ImageBackground
      source={Images.IntermediaryBackground}
      style={styles.container}
      resizeMode="cover"
    >
      <Text style={styles.text}>
        Please wait while we verify your ID document...
      </Text>
      <View style={styles.dotsContainer}>
        <Animated.View
          style={[styles.dot, { transform: [{ translateY: dot1 }] }]}
        />
        <Animated.View
          style={[styles.dot, { transform: [{ translateY: dot2 }] }]}
        />
        <Animated.View
          style={[styles.dot, { transform: [{ translateY: dot3 }] }]}
        />
      </View>
    </ImageBackground>
  );
};

export default ApprovalPendingScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  text: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1F245E",
    textAlign: "center",
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  dotsContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    backgroundColor: "#1F245E",
    borderRadius: 4,
    marginHorizontal: 4,
  },
});