import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { User } from "@/types/user";
import { router } from "expo-router";
import { useLanguage } from "@/hooks/useLanguage";

type Props = {
  qualifyingChildren: number;
  parentGDPPrice: number | null;
  user: User;
  rewardClaimed: boolean;
  rewardClaimed130: boolean;

};

export default function OneThirtyGDPRewardProgress({
  qualifyingChildren,
  parentGDPPrice,
  user,
  rewardClaimed,
  rewardClaimed130,

}: Props) {
  const { t } = useLanguage();

  const get130ProgressPercentage = () => {
    return Math.min((qualifyingChildren / 2) * 100, 100);
  };

  return (
    <View style={styles.rewardSection}>
      <Text style={styles.rewardTitle}>130% GDP {t.reward} {t.progress}</Text>
      <View style={styles.rewardContainer}>
        <View style={styles.progressContainer}>
          <View style={styles.progressBarContainer}>
            <View
              style={[
                styles.progressBar,
                { width: `${get130ProgressPercentage()}%` },
              ]}
            />
            <Text style={styles.progressText}>
              {Math.round(get130ProgressPercentage())}%
            </Text>
          </View>
          {parentGDPPrice && qualifyingChildren < 2 && (
            <Text style={styles.infoText}>
              {t.need} {2 - qualifyingChildren} {t.more} {""}
              {2 - qualifyingChildren === 1 ? t.friend : t.friend} {t.with} {t.equal} GDP
              {parentGDPPrice.toFixed(2)}
            </Text>
          )}
        </View>
        {qualifyingChildren >= 2 && (
          <TouchableOpacity
            style={[
              styles.rewardButton,
              rewardClaimed && styles.disabledButton,
            ]}
            onPress={() =>
              router.push({
                pathname: "/(reward)/130-reward",
                params: { user: JSON.stringify(user) },
              })
            }
            disabled={rewardClaimed}
          >
            <Text
              style={[
                styles.buttonText,
                rewardClaimed && styles.disabledButtonText,
              ]}
            >
              {rewardClaimed130
                ? t.claimed
                : rewardClaimed
                  ? t.unclaim
                  : t.claim}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  rewardSection: {
    marginTop: 20,
    padding: 15,
    backgroundColor: "#f5f5f5",
    borderRadius: 8,
    elevation: 2,
    boxShadow: '0px 1px 2.22px rgba(0, 0, 0, 0.22)',
  },
  rewardContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  progressContainer: {
    flex: 1,
  },
  progressBarContainer: {
    height: 25,
    backgroundColor: "#e0e0e0",
    borderRadius: 12.5,
    overflow: "hidden",
    position: "relative",
  },
  progressBar: {
    height: "100%",
    backgroundColor: "#4CAF50",
    borderRadius: 12.5,
    position: "absolute",
    left: 0,
    top: 0,
  },
  progressText: {
    position: "absolute",
    width: "100%",
    textAlign: "center",
    lineHeight: 25,
    color: "#000",
    fontWeight: "bold",
    fontSize: 14,
  },
  rewardTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 15,
    textAlign: "center",
    color: "#333",
  },
  infoText: {
    color: "#666",
    fontSize: 12,
    marginTop: 5,
  },
  rewardButton: {
    backgroundColor: "#4CAF50",
    padding: 10,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 100,
    elevation: 3,
    boxShadow: '0px 2px 3.84px rgba(0, 0, 0, 0.25)',
  },
  buttonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
  disabledButton: {
    backgroundColor: "#cccccc",
    opacity: 0.7,
  },
  disabledButtonText: {
    color: "#666666",
  },
});
