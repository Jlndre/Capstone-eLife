import { Animations } from "@/assets/animations";
import { Images } from "@/assets/images";
import { Routes } from "@/constants/routes";
import { isTokenValid } from "@/utils/auth";
import { useNavigation, useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import LottieView from "lottie-react-native";
import React, { useEffect, useRef } from "react";
import { ImageBackground, StyleSheet } from "react-native";

export default function LoadingScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const hasNavigated = useRef(false);
  const timerRef = useRef<number | null>(null);

  const checkAuthAndNavigate = async () => {
    if (hasNavigated.current) return;

    try {
      const valid = await isTokenValid();

      if (valid) {
        console.log("Token valid — checking terms acceptance");
        const termsAccepted = await SecureStore.getItemAsync("termsAccepted");

        hasNavigated.current = true;

        if (termsAccepted === "true") {
          console.log("Terms accepted — navigating to Home");
          router.replace(Routes.Home);
        } else {
          console.log("Terms not accepted — navigating to Terms");
          router.replace(Routes.Terms);
        }
      } else {
        console.log("Token invalid — navigating to Login");
        hasNavigated.current = true;
        router.replace(Routes.Login);
      }
    } catch (error) {
      console.error("Auth check failed:", error);
      hasNavigated.current = true;
      router.replace(Routes.Login);
    }
  };

  useEffect(() => {
    navigation.setOptions({ headerShown: false });
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
});
