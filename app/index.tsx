import { Animations } from "@/assets/animations";
import { Images } from "@/assets/images";
import { useNavigation, useRouter } from "expo-router";
import LottieView from "lottie-react-native";
import React, { useEffect } from "react";
import { ImageBackground, StyleSheet } from "react-native";

export default function LoadingScreen() {
  const router = useRouter();
  const navigation = useNavigation();

  useEffect(() => {
    navigation.setOptions({ headerShown: false });

    const timer = setTimeout(() => {
      router.replace("/login");
    }, 3000);

    return () => clearTimeout(timer);
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
        loop
        style={styles.lottie}
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
