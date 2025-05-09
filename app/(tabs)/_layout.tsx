import React from "react";
import { Tabs } from "expo-router";
import { Platform } from 'react-native';
import CustomTabBar from '@/components/Navigation/CustomTabBar';

export default function TabLayout() {

  return (
    <Tabs
      screenOptions={{
        headerStyle: {
          backgroundColor: '#fff',
        },
        headerTitleStyle: {
          fontWeight: '600',
          color: '#1a1a1a',
        },
        headerShadowVisible: false,
        tabBarStyle: {
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: Platform.OS === 'ios' ? 84 : 64,
          paddingHorizontal: 8,
          borderTopWidth: 0,
          backgroundColor: 'transparent',
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarShowLabel: false,
      }}
      tabBar={props => <CustomTabBar {...props} />}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="OTC"
        options={{
          title: "OTC",
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="admin"
        options={{
          title: "Admin",
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="assets"
        options={{
          title: "Assets",
          headerShown: false,
        }}
      />
    </Tabs>
  );
}
