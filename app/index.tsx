import { Animations } from "@/assets/animations";
import { Images } from "@/assets/images";
import { Routes } from "@/constants/routes";
import { isTokenValid } from "@/utils/auth";
import { useNavigation, useRouter } from "expo-router";
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
      hasNavigated.current = true;

      if (valid) {
        console.log("Token valid — navigating to Home");
        router.replace(Routes.Home);
      } else {
        console.log("Token invalid — navigating to Login");
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

    // Start 3-second splash timer
    timerRef.current = setTimeout(() => {
      checkAuthAndNavigate();
    }, 3000);

    // Cleanup timer on unmount
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
