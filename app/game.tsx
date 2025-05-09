import { Text, TouchableOpacity, View, StyleSheet } from "react-native";
import React from "react";
import { router } from "expo-router";
import { useLanguage } from "@/hooks/useLanguage";

const Game = () => {
  const { t } = useLanguage();

  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <Text style={{ fontSize: 30, color: "#1a3ada", marginBottom: 15 }}>
        Coming Soon
      </Text>

      <View style={styles.bottomButtonContainer}>
        <TouchableOpacity
          style={styles.navigationButton}
          onPress={() => router.replace("/(tabs)")}
        >
          <Text style={styles.buttonText}>{t.back}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default Game;

const styles = StyleSheet.create({
  bottomButtonContainer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "#eee",
    backgroundColor: "#fff",
  },
  navigationButton: {
    backgroundColor: "#2196F3",
    padding: 15,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
});
