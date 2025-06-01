import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  ScrollView,
} from "react-native";
import { router } from "expo-router";
import { auth } from "@/firebase";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import AntDesign from "@expo/vector-icons/AntDesign";
import { userService } from "@/services/userService";
import FontAwesome5 from "@expo/vector-icons/FontAwesome5";
import showAlert from "../CustomAlert/ShowAlert";

export default function AdminPanelScreen() {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    checkAdminStatus();
  }, []);

  const checkAdminStatus = async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      router.replace("/login");
      return;
    }
    try {
      const userDetails = await userService.getUserById(currentUser.uid);
      if (userDetails?.role !== "admin") {
        showAlert("Access Denied", "Only administrators can access this page");
        router.back();
        return;
      }
      setIsAdmin(true);
    } catch (error) {
      console.error("Error checking admin status:", error);
      showAlert("Error", "Failed to verify admin status");
      router.back();
    }
  };

  if (!isAdmin) {
    return <ActivityIndicator />;
  }

  return (
    <ScrollView>
      <View style={styles.container}>
        <Text style={styles.title}>Admin Panel</Text>

        <TouchableOpacity
          style={styles.menuButton}
          onPress={() => router.push("/(admin)/user-management")}
        >
          <Ionicons name="people" size={24} color="white" />
          <Text style={styles.buttonText}>User Management</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuButton}
          onPress={() => router.push("/(admin)/investment-management")}
        >
          <Ionicons name="trending-up" size={24} color="white" />
          <Text style={styles.buttonText}>Investment Management</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuButton}
          onPress={() => router.push("/(admin)/gdp-management")}
        >
          <Ionicons name="cash" size={24} color="white" />
          <Text style={styles.buttonText}>GDP Management</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuButton}
          onPress={() => router.push("/(admin)/reward-management")}
        >
          <Ionicons name="gift" size={24} color="white" />
          <Text style={styles.buttonText}>Reward Management</Text>
        </TouchableOpacity>

        {/* <TouchableOpacity
          style={styles.menuButton}
          onPress={() => router.push("/(admin)/bankTransfer-management")}
        >
          <AntDesign name="bank" size={24} color="white" />
          <Text style={styles.buttonText}>Bank Transfer Management</Text>
        </TouchableOpacity> */}

        <TouchableOpacity
          style={styles.menuButton}
          onPress={() => router.push("/(admin)/withdrawal-management")}
        >
          <Ionicons name="logo-bitcoin" size={24} color="white" />
          <Text style={styles.buttonText}>Withdrawal Management</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuButton}
          onPress={() => router.push("/(admin)/topup-management")}
        >
          <FontAwesome5 name="piggy-bank" size={24} color="black" />
          <Text style={styles.buttonText}>Top Up Management</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuButton}
          onPress={() => router.push("/(admin)/crypto-management")}
        >
          <Ionicons name="logo-bitcoin" size={24} color="black" />
          <Text style={styles.buttonText}>Crypto Management</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuButton}
          onPress={() => router.push("/(admin)/payment-reject-control")}
        >
          <MaterialIcons name="cancel-presentation" size={24} color="black" />
          <Text style={styles.buttonText}>Payment Reject Management</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuButton}
          onPress={() => router.push("/(admin)/carousel-management")}
        >
          <MaterialIcons
            name="production-quantity-limits"
            size={24}
            color="black"
          />
          <Text style={styles.buttonText}>Carousel Management</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuButton}
          onPress={() => router.push("/(admin)/token-management")}
        >
          <FontAwesome5 name="coins" size={24} color="white" />
          <Text style={styles.buttonText}>Token Management</Text>
        </TouchableOpacity>

        {/* <TouchableOpacity
          style={[styles.menuButton, { backgroundColor: '#FF5722' }]}
          onPress={() => router.push("/(admin)/master-access")}
        >
          <MaterialIcons name="admin-panel-settings" size={24} color="white" />
          <Text style={styles.buttonText}>Master Access</Text>
        </TouchableOpacity> */}
      </View>
    </ScrollView>
  );
}

const shadowStyle = Platform.select({
  ios: {
    boxShadow: "0px 2px 4px rgba(0, 0, 0, 0.15)",
  },
  android: {
    elevation: 2,
  },
  default: {
    boxShadow: "0px 2px 4px rgba(0, 0, 0, 0.15)",
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "center",
  },
  menuButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#2196F3",
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
    gap: 10,
    ...shadowStyle,
  },
  buttonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
});
