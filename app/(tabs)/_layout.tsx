import { HapticTab } from "@/components/HapticTab";
import { IconSymbol } from "@/components/ui/IconSymbol";
import TabBarBackground from "@/components/ui/TabBarBackground";
import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/useColorScheme";
import { Tabs } from "expo-router";
import React from "react";
import { Platform, View } from "react-native";

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors[colorScheme ?? "light"].tint,
        tabBarInactiveTintColor: "#8E8E93",
        tabBarButton: HapticTab,
        tabBarBackground: TabBarBackground,
        tabBarStyle: Platform.select({
          ios: {
            position: "absolute",
            height: 85,
            paddingBottom: 20,
            paddingTop: 10,
            borderTopWidth: 1,
            borderTopColor: colorScheme === "dark" ? "#333333" : "#E0E0E0",
            shadowColor: "#000",
            shadowOffset: { width: 0, height: -2 },
            shadowOpacity: 0.1,
            shadowRadius: 3,
          },
          android: {
            height: 75,
            paddingBottom: 15,
            paddingTop: 10,
            elevation: 8,
          },
          default: {
            height: 75,
            paddingBottom: 15,
            paddingTop: 10,
          },
        }),
        tabBarLabelStyle: {
          fontSize: 14,
          fontWeight: "600",
          marginTop: 5,
        },
        tabBarIconStyle: {
          width: 30,
          height: 30,
        },
      }}
    >
      {/* Home tab (index.tsx) */}
      <Tabs.Screen
        name="Home"
        options={{
          title: "Home",
          tabBarIcon: ({ color, focused }) => (
            <View style={{ alignItems: "center" }}>
              <IconSymbol size={28} name="house.fill" color={color} />
              {focused && Platform.OS === "ios" && (
                <View
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: 2.5,
                    backgroundColor: Colors[colorScheme ?? "light"].tint,
                    marginTop: 4,
                  }}
                />
              )}
            </View>
          ),
        }}
      />

      {/* Dashboard tab */}
      <Tabs.Screen
        name="Dashboard"
        options={{
          title: "Dashboard",
          tabBarIcon: ({ color, focused }) => (
            <View style={{ alignItems: "center" }}>
              <IconSymbol size={28} name="person.crop.square" color={color} />
              {focused && Platform.OS === "ios" && (
                <View
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: 2.5,
                    backgroundColor: Colors[colorScheme ?? "light"].tint,
                    marginTop: 4,
                  }}
                />
              )}
            </View>
          ),
        }}
      />

      {/* Settings tab */}
      <Tabs.Screen
        name="Settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color, focused }) => (
            <View style={{ alignItems: "center" }}>
              <IconSymbol size={28} name="gearshape.fill" color={color} />
              {focused && Platform.OS === "ios" && (
                <View
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: 2.5,
                    backgroundColor: Colors[colorScheme ?? "light"].tint,
                    marginTop: 4,
                  }}
                />
              )}
            </View>
          ),
        }}
      />
    </Tabs>
  );
}
