import React, { useEffect } from "react";
import { StyleSheet, ImageBackground } from "react-native";
import { useRouter, useNavigation } from "expo-router";
import LottieView from "lottie-react-native";

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
      source={require("../assets/images/loading-background.png")}
      style={styles.background}
      resizeMode="cover"
    >
      <LottieView
        source={require("../assets/animations/elifelogo.json")}
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
