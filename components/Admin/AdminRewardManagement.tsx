import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Button,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableWithoutFeedback,
  Keyboard,
  TouchableOpacity,
} from "react-native";
import { doc, updateDoc, setDoc, getDoc } from "firebase/firestore";
import { db } from "@/firebase";
import { useReward } from "@/context/RewardContext";
import { router } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import showAlert from "../CustomAlert/ShowAlert";

export default function AdminRewardManagement() {
  const { rewardSettings, setRewardSettings } = useReward();
  const [investmentRewardPercentage, setInvestmentRewardPercentage] = useState(
    rewardSettings.investmentPercentage?.toString() || "0"
  );
  const [investmentTerm, setInvestmentTerm] = useState(
    rewardSettings.investmentTerm?.toString() || "0"
  );
  const [gdpRewardPercentage, setGdpRewardPercentage] = useState(
    rewardSettings.gdpRewardPercentage?.toString() || "0"
  );

  const handleUpdateRewardPercentage = async () => {
    try {
      const percentage = parseFloat(rewardSettings.percentage.toString());
      if (isNaN(percentage) || percentage < 0 || percentage > 100) {
        showAlert("Error", "Please enter a valid percentage between 0 and 100");
        return;
      }

      const settingsRef = doc(db, "settings", "rewardPercentage");

      // Check if the document exists
      const docSnap = await getDoc(settingsRef);

      if (docSnap.exists()) {
        // If the document exists, update it
        await updateDoc(settingsRef, { percentage });
      } else {
        // If the document doesn't exist, create it
        await setDoc(settingsRef, { percentage });
      }

      showAlert("Success", "Reward percentage updated successfully");
    } catch (error) {
      console.error("Error updating reward percentage:", error);
      showAlert("Error", "Failed to update reward percentage");
    }
  };

  const handleUpdateInvestmentSettings = async () => {
    try {
      const percentage = parseFloat(investmentRewardPercentage);
      const term = parseFloat(investmentTerm);

      if (isNaN(percentage) || percentage < 0 || percentage > 100) {
        showAlert("Error", "Please enter a valid percentage between 0 and 100");
        return;
      }

      if (isNaN(term) || term < 0.01) {
        showAlert("Error", "Please enter a valid term (minimum 0.01 days)");
        return;
      }

      // Update the context and Firebase
      setRewardSettings((prevSettings) => ({
        ...prevSettings,
        investmentPercentage: percentage,
        investmentTerm: term,
      }));

      const settingsRef = doc(db, "settings", "investmentSettings");
      await setDoc(settingsRef, {
        investmentPercentage: percentage,
        investmentTerm: term,
      });

      showAlert("Success", "Investment settings updated successfully");
    } catch (error) {
      console.error("Error updating investment settings:", error);
      showAlert("Error", "Failed to update investment settings");
    }
  };

  const handleUpdateGDPRewardPercentage = async () => {
    try {
      const percentage = parseFloat(gdpRewardPercentage);
      if (isNaN(percentage) || percentage < 0 || percentage > 100) {
        showAlert("Error", "Please enter a valid percentage between 0 and 100");
        return;
      }

      const settingsRef = doc(db, "settings", "gdpRewardSettings");
      await setDoc(settingsRef, { gdpRewardPercentage: percentage });

      setRewardSettings((prev) => ({
        ...prev,
        gdpRewardPercentage: percentage,
      }));

      showAlert("Success", "GDP reward percentage updated successfully");
    } catch (error) {
      console.error("Error updating GDP reward percentage:", error);
      showAlert("Error", "Failed to update GDP reward percentage");
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Reward Management</Text>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <MaterialIcons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
      </View>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.container}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <ScrollView contentContainerStyle={styles.scrollViewContent}>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Purchase Reward</Text>
              <Text style={styles.currentSettings}>
                Current Reward Percentage: {rewardSettings.percentage}%
              </Text>
              <TextInput
                style={styles.input}
                value={rewardSettings.percentage.toString()}
                onChangeText={(text) =>
                  setRewardSettings((prev) => ({
                    ...prev,
                    percentage: parseFloat(text) || 0,
                  }))
                }
                keyboardType="numeric"
                placeholder="New Reward Percentage"
              />
              <Button
                title="Update Reward Percentage"
                onPress={handleUpdateRewardPercentage}
              />
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Investment Settings</Text>
              <Text style={styles.currentSettings}>
                Current Investment Reward:{" "}
                {rewardSettings.investmentPercentage || 0}%
              </Text>
              <Text style={styles.currentSettings}>
                Current Investment Term: {rewardSettings.investmentTerm || 0}{" "}
                days
              </Text>
              <TextInput
                style={styles.input}
                value={investmentRewardPercentage}
                onChangeText={setInvestmentRewardPercentage}
                keyboardType="numeric"
                placeholder="New Investment Reward Percentage"
              />
              <TextInput
                style={styles.input}
                value={investmentTerm}
                onChangeText={setInvestmentTerm}
                keyboardType="numeric"
                placeholder="New Investment Term (days)"
              />
              <Button
                title="Update Investment Settings"
                onPress={handleUpdateInvestmentSettings}
              />
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>GDP Reward Settings</Text>
              <Text style={styles.currentSettings}>
                Current GDP Reward: {rewardSettings.gdpRewardPercentage || 0}%
              </Text>
              <TextInput
                style={styles.input}
                value={gdpRewardPercentage}
                onChangeText={setGdpRewardPercentage}
                keyboardType="numeric"
                placeholder="New GDP Reward Percentage"
              />
              <Button
                title="Update GDP Reward Percentage"
                onPress={handleUpdateGDPRewardPercentage}
              />
            </View>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
    textAlign: "center",
  },
  backButton: {
    position: "absolute",
    left: 16,
    zIndex: 1,
  },
  scrollViewContent: {
    flexGrow: 1,
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "center",
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 10,
  },
  currentSettings: {
    fontSize: 16,
    marginBottom: 10,
  },
  input: {
    height: 40,
    borderColor: "gray",
    borderWidth: 1,
    marginBottom: 10,
    paddingHorizontal: 10,
  },
});
