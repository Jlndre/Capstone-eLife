import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import "react-native-reanimated";
import { Drawer } from "expo-router/drawer";

import { useColorScheme } from "@/hooks/useColorScheme";

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
  });

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return (
    <Drawer
      screenOptions={{
        headerShown: false,
        // You can style the drawer here. E.g.:
        drawerType: "front", // or 'slide', 'back', etc.
        drawerStyle: { width: 250 },
      }}
    >
      {/* Inside the Drawer, we place our (drawer) layout */}
      <Drawer.Screen
        name="(drawer)"
        options={{
          drawerLabel: "Main Menu", // or hide if you want custom
        }}
      />
    </Drawer>
  );
}
