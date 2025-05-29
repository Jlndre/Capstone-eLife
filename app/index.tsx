import { Animations } from "@/assets/animations";
import { Images } from "@/assets/images";
import { Routes } from "@/constants/routes";
import { isTokenValid } from "@/utils/auth";
import { useNavigation, useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import LottieView from "lottie-react-native";
import React, { useEffect, useRef, useState } from "react";
import { ImageBackground, StyleSheet, Text, View } from "react-native";

export default function LoadingScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const hasNavigated = useRef(false);
  const timerRef = useRef<number | null>(null);
  const [debug, setDebug] = useState("");

  const checkAuthAndNavigate = async () => {
    if (hasNavigated.current) return;

    try {
      console.log("LoadingScreen: Starting auth check...");

      // Explicitly check token first
      const token = await SecureStore.getItemAsync("jwt");
      console.log("LoadingScreen: Token exists:", !!token);

      if (!token) {
        console.log("LoadingScreen: No token - redirecting to Login");
        hasNavigated.current = true;
        router.replace(Routes.Login);
        return;
      }

      // Only validate token if it exists
      const valid = await isTokenValid();
      console.log("LoadingScreen: Token valid:", valid);

      if (valid) {
        // Check terms acceptance status
        console.log("LoadingScreen: Token valid - checking terms acceptance");
        const termsAccepted = await SecureStore.getItemAsync("termsAccepted");
        console.log("LoadingScreen: Terms acceptance status:", termsAccepted);

        hasNavigated.current = true;

        if (termsAccepted === "true") {
          console.log("LoadingScreen: Terms accepted - navigating to Home");
          router.replace(Routes.Home);
        } else {
          console.log(
            "LoadingScreen: Terms not accepted - navigating to Terms"
          );
          // Add a slight delay to ensure navigation works
          setTimeout(() => {
            router.replace(Routes.Terms);
          }, 100);
        }
      } else {
        console.log("LoadingScreen: Token invalid - navigating to Login");
        // Clear all auth data if token is invalid
        await SecureStore.deleteItemAsync("jwt");
        await SecureStore.deleteItemAsync("termsAccepted");
        await SecureStore.deleteItemAsync("currentUserId");

        hasNavigated.current = true;
        router.replace(Routes.Login);
      }
    } catch (error) {
      console.error("LoadingScreen: Auth check failed:", error);

      // Clear all tokens to be safe
      await SecureStore.deleteItemAsync("jwt");
      await SecureStore.deleteItemAsync("termsAccepted");
      await SecureStore.deleteItemAsync("currentUserId");

      hasNavigated.current = true;
      router.replace(Routes.Login);
    }
  };

  useEffect(() => {
    navigation.setOptions({ headerShown: false });

    // Start timer for animation
    timerRef.current = setTimeout(() => {
      checkAuthAndNavigate();
    }, 3000);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <ImageBackground
      source={Images.LoadingBackground}
      style={styles.background}
      resizeMode="cover"
    >
      <LottieView
        source={Animations.ElifeLogo}
        autoPlay
        loop={false}
        speed={1.0}
        style={styles.lottie}
        onAnimationFinish={() => {
          if (timerRef.current) clearTimeout(timerRef.current);
          checkAuthAndNavigate();
        }}
      />

      {/* Debug info for development only */}
      {__DEV__ && debug ? (
        <View style={styles.debugContainer}>
          <Text style={styles.debugText}>{debug}</Text>
        </View>
      ) : null}
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  lottie: {
    width: 450,
    height: 450,
  },
  debugContainer: {
    position: "absolute",
    bottom: 20,
    backgroundColor: "rgba(0,0,0,0.7)",
    padding: 10,
    borderRadius: 5,
  },
  debugText: {
    color: "white",
    fontSize: 12,
  },
});
