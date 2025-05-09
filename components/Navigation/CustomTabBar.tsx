import React, { useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  DeviceEventEmitter,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { usePathname, useRouter } from "expo-router";
import { useUser } from "@/context/UserContext";
import translations from "@/translations";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLanguage, isValidLanguage } from "@/hooks/useLanguage";

// Event name constant to ensure consistency
const LANGUAGE_CHANGE_EVENT = "LANGUAGE_CHANGE";

// Valid tab routes for type safety
const TAB_ROUTES = {
  index: "/(tabs)",
  profile: "/(tabs)/profile",
  OTC: "/(tabs)/OTC",
  admin: "/(tabs)/admin",
  assets: "/(tabs)/assets",
} as const;

type TabRoutePath = (typeof TAB_ROUTES)[keyof typeof TAB_ROUTES];
type TabRouteName = keyof typeof TAB_ROUTES;

interface TabBarProps {
  state: any;
  descriptors: any;
  navigation: any;
}

export default function CustomTabBar({
  state,
  descriptors,
  navigation,
}: TabBarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { userRole } = useUser();
  const isAdmin = userRole === "admin";

  const { t, selectedLanguage, setSelectedLanguage } = useLanguage();

  // Memoized navigation handler
  const handleNavigation = useCallback(
    async (routeName: TabRouteName) => {
      try {
        const path = TAB_ROUTES[routeName];
        await router.replace(path as TabRoutePath);
      } catch (error) {
        console.error("Navigation error:", error);
      }
    },
    [router]
  );

  // Listen for language changes
  useEffect(() => {
    const checkLanguage = async () => {
      try {
        const storedLanguage = await AsyncStorage.getItem("selectedLanguage");
        if (
          storedLanguage &&
          storedLanguage !== selectedLanguage &&
          translations[storedLanguage] &&
          isValidLanguage(storedLanguage)
        ) {
          // Update language state
          setSelectedLanguage(storedLanguage);

          // Emit a language change event that other components can listen to
          DeviceEventEmitter.emit(LANGUAGE_CHANGE_EVENT, {
            language: storedLanguage,
          });

          // Force a re-render of the tab bar with updated translations
          if (pathname.startsWith("/(tabs)")) {
            const currentRoute = state.routes[state.index];
            if (currentRoute?.name) {
              await handleNavigation(currentRoute.name as TabRouteName);
            }
          }
        }
      } catch (error) {
        console.error("Error checking language:", error);
      }
    };

    // Initial language check
    checkLanguage();

    // Set up an interval to check periodically
    const intervalId = setInterval(checkLanguage, 2000);

    // Cleanup interval on unmount
    return () => {
      clearInterval(intervalId);
    };
  }, [pathname, handleNavigation, selectedLanguage, state.index, state.routes]);

  // Load initial language
  useEffect(() => {
    const loadLanguage = async () => {
      try {
        const storedLanguage = await AsyncStorage.getItem("selectedLanguage");
        if (storedLanguage && translations[storedLanguage] && isValidLanguage(storedLanguage)) {
          setSelectedLanguage(storedLanguage);
        }
      } catch (error) {
        console.error("Error loading language:", error);
      }
    };

    loadLanguage();
  }, []);
  const getTabIcon = (routeName: TabRouteName) => {
    switch (routeName) {
      case "index":
        return "home";
      case "profile":
        return "person";
      case "OTC":
        return "currency-exchange";
      case "admin":
        return "admin-panel-settings";
      case "assets":
        return "account-balance";
      default:
        return "home";
    }
  };

  const getTabLabel = (routeName: TabRouteName) => {
    switch (routeName) {
      case "index":
        return t.home;
      case "profile":
        return t.profile;
      case "OTC":
        return t.OTC;
      case "admin":
        return t.admin;
      case "assets":
        return t.assets;
      default:
        return t.home;
    }
  };

  const shouldShowTab = (routeName: TabRouteName) => {
    if (routeName === "admin") {
      return isAdmin;
    }
    return true;
  };

  return (
    <View style={styles.container}>
      {state.routes.map((route: any, index: number) => {
        const routeName = route.name as TabRouteName;
        if (!shouldShowTab(routeName)) {
          return null;
        }

        const { options } = descriptors[route.key];
        const isFocused = state.index === index;

        const onPress = () => {
          const event = navigation.emit({
            type: "tabPress",
            target: route.key,
            canPreventDefault: true,
          });

          if (!isFocused && !event.defaultPrevented) {
            handleNavigation(routeName);
          }
        };

        return (
          <TouchableOpacity
            key={route.key}
            accessibilityRole="button"
            accessibilityState={isFocused ? { selected: true } : {}}
            accessibilityLabel={options.tabBarAccessibilityLabel}
            testID={options.tabBarTestID}
            onPress={onPress}
            style={styles.tab}
          >
            <View style={[styles.tabContent, isFocused && styles.activeTab]}>
              <MaterialIcons
                name={getTabIcon(routeName)}
                size={24}
                color={isFocused ? "#2196F3" : "#666"}
              />
              <Text style={[styles.label, isFocused && styles.activeLabel]}>
                {getTabLabel(routeName)}
              </Text>
              {isFocused && <View style={styles.activeDot} />}
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
    paddingBottom: Platform.OS === "ios" ? 24 : 8,
    paddingTop: 12,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
      web: {
        boxShadow: "0 -4px 12px rgba(0,0,0,0.1)",
      } as any,
    }),
  },
  tab: {
    flex: 1,
    alignItems: "center",
  },
  tabContent: {
    alignItems: "center",
    padding: 4,
    borderRadius: 16,
    position: "relative",
  },
  activeTab: {
    backgroundColor: "#E3F2FD",
  },
  label: {
    fontSize: 12,
    marginTop: 4,
    color: "#666",
    fontWeight: "500",
  },
  activeLabel: {
    color: "#2196F3",
    fontWeight: "600",
  },
  activeDot: {
    position: "absolute",
    bottom: -8,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#2196F3",
  },
});
