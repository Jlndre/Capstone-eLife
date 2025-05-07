// app/(tabs)/_layout.tsx
import { HapticTab } from '@/components/HapticTab';
import { IconSymbol } from '@/components/ui/IconSymbol';
import TabBarBackground from '@/components/ui/TabBarBackground';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Tabs } from 'expo-router';
import React from 'react';
import { Platform, View } from 'react-native';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        tabBarInactiveTintColor: colorScheme === 'dark' ? '#8E8E93' : '#8E8E93',
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarBackground: TabBarBackground,
        tabBarStyle: Platform.select({
          ios: {
            position: 'absolute',
            height: 85, // Taller tab bar for easier tapping
            paddingBottom: 20,
            paddingTop: 10,
            borderTopWidth: 1,
            borderTopColor: colorScheme === 'dark' ? '#333333' : '#E0E0E0',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -2 },
            shadowOpacity: 0.1,
            shadowRadius: 3,
          },
          android: {
            height: 75, // Taller tab bar for easier tapping
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
          fontSize: 14, // Larger font size
          fontWeight: '600',
          marginTop: 5,
        },
        tabBarIconStyle: {
          width: 30,
          height: 30,
        },
      }}
    >
      <Tabs.Screen
        // 1) Dashboard
        name="Dashboard"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color, focused }) => (
            <View style={{ alignItems: 'center' }}>
              <IconSymbol 
                size={28} 
                name="person.crop.square" 
                color={color} 
              />
              {focused && Platform.OS === 'ios' && (
                <View style={{ 
                  width: 5, 
                  height: 5, 
                  borderRadius: 2.5, 
                  backgroundColor: Colors[colorScheme ?? 'light'].tint,
                  marginTop: 4
                }} />
              )}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        // 2) Home
        name="Home"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <View style={{ alignItems: 'center' }}>
              <IconSymbol 
                size={28} 
                name="house.fill" 
                color={color} 
              />
              {focused && Platform.OS === 'ios' && (
                <View style={{ 
                  width: 5, 
                  height: 5, 
                  borderRadius: 2.5, 
                  backgroundColor: Colors[colorScheme ?? 'light'].tint,
                  marginTop: 4
                }} />
              )}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        // 4) Settings
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, focused }) => (
            <View style={{ alignItems: 'center' }}>
              <IconSymbol 
                size={28} 
                name="gearshape.fill" 
                color={color} 
              />
              {focused && Platform.OS === 'ios' && (
                <View style={{ 
                  width: 5, 
                  height: 5, 
                  borderRadius: 2.5, 
                  backgroundColor: Colors[colorScheme ?? 'light'].tint,
                  marginTop: 4
                }} />
              )}
            </View>
          ),
        }}
      />
    </Tabs>
  );
}