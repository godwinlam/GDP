import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { User } from "@/types/user";
import { router } from "expo-router";
import { useLanguage } from "@/hooks/useLanguage";

type Props = {
  qualifyingChildren: number;
  qualifyingGrandchildren: number;
  qualifyingGreatGrandchildren: number;
  qualifyingGreatGreatGrandchildren: number;
  qualifyingGreatGreatGreatGrandchildren: number;
  qualifyingGreatGreatGreatGreatGrandchildren: number;
  parentGDPPrice: number | null;
  user: User;
  rewardClaimed: boolean;
  rewardClaimed1000: boolean;
};

export default function OneThousandGDPRewardProgress({
  qualifyingChildren,
  qualifyingGrandchildren,
  qualifyingGreatGrandchildren,
  qualifyingGreatGreatGrandchildren,
  qualifyingGreatGreatGreatGrandchildren,
  qualifyingGreatGreatGreatGreatGrandchildren,
  parentGDPPrice,
  user,
  rewardClaimed,
  rewardClaimed1000,
}: Props) {
  const { t } = useLanguage();

  const get1000ProgressPercentage = () => {
    // Check both conditions
    const condition1Progress = Math.min(
      (qualifyingChildren / 16) * 16.67 + // Each generation contributes ~16.67% to progress
      (qualifyingGrandchildren / 4) * 16.67 +
      (qualifyingGreatGrandchildren / 8) * 16.67 +
      (qualifyingGreatGreatGrandchildren / 16) * 16.67 +
      (qualifyingGreatGreatGreatGrandchildren / 32) * 16.67 +
      (qualifyingGreatGreatGreatGreatGrandchildren / 64) * 16.65,
      100
    );
    const condition2Progress = Math.min((qualifyingChildren / 20) * 100, 100);

    // Return the higher progress percentage
    return Math.max(condition1Progress, condition2Progress);
  };

  const progressPercentage = get1000ProgressPercentage();
  const isCondition1Met =
    qualifyingChildren >= 16 &&
    qualifyingGrandchildren >= 4 &&
    qualifyingGreatGrandchildren >= 8 &&
    qualifyingGreatGreatGrandchildren >= 16 &&
    qualifyingGreatGreatGreatGrandchildren >= 32 &&
    qualifyingGreatGreatGreatGreatGrandchildren >= 64;
  const isCondition2Met = qualifyingChildren >= 20;
  const isEligible = isCondition1Met || isCondition2Met;

  const getInfoText = () => {
    if (isCondition2Met) {
      return null; // Don't show any info text if condition 2 is met
    }

    if (qualifyingChildren < 16) {
      return (
        <Text>
          {t.need} {16 - qualifyingChildren} {t.more} {""}
          {16 - qualifyingChildren === 1 ? t.friend : t.friend} {t.with} {t.equal} GDP
          {parentGDPPrice?.toFixed(2)}
        </Text>
      );
    }

    if (qualifyingGrandchildren < 4) {
      return (
        <Text>
          {t.need} {4 - qualifyingGrandchildren} {t.more} {""}
          {4 - qualifyingGrandchildren === 1 ? t.Friends : t.Friends} {t.ecological_relations} {""}
          {t.with} {t.equal} GDP{parentGDPPrice?.toFixed(2)}
        </Text>
      );
    }

    if (qualifyingGreatGrandchildren < 8) {
      return (
        <Text>
          {t.need} {8 - qualifyingGreatGrandchildren} {t.more} {""}
          {8 - qualifyingGreatGrandchildren === 1
            ? t.Friends
            : t.Friends} {t.ecological_relations}{" "}
          {t.with} {t.equal} GDP{parentGDPPrice?.toFixed(2)}
        </Text>
      );
    }

    if (qualifyingGreatGreatGrandchildren < 16) {
      return (
        <Text>
          {t.need} {16 - qualifyingGreatGreatGrandchildren} {t.more} {""}
          {16 - qualifyingGreatGreatGrandchildren === 1
            ? t.Friends
            : t.Friends} {t.ecological_relations}{" "}
          {t.with} {t.equal} GDP{parentGDPPrice?.toFixed(2)}
        </Text>
      );
    }

    if (qualifyingGreatGreatGreatGrandchildren < 32) {
      return (
        <Text>
          {t.need} {32 - qualifyingGreatGreatGreatGrandchildren} {t.more} {""}
          {32 - qualifyingGreatGreatGreatGrandchildren === 1
            ? t.Friends
            : t.Friends} {t.ecological_relations}{" "}
          {t.with} {t.equal} GDP{parentGDPPrice?.toFixed(2)}
        </Text>
      );
    }

    if (qualifyingGreatGreatGreatGreatGrandchildren < 64) {
      return (
        <Text>
          {t.need} {64 - qualifyingGreatGreatGreatGreatGrandchildren} {t.more} {""}
          {64 - qualifyingGreatGreatGreatGreatGrandchildren === 1
            ? t.Friends
            : t.Friends} {t.ecological_relations}{" "}
          {t.with} {t.equal} GDP{parentGDPPrice?.toFixed(2)}
        </Text>
      );
    }

    return null;
  };

  return (
    <View style={styles.rewardSection}>
      <Text style={styles.rewardTitle}>1000% GDP {t.reward} {t.progress}</Text>
      <View style={styles.rewardContainer}>
        <View style={styles.progressContainer}>
          <View style={styles.progressBarContainer}>
            <View
              style={[styles.progressBar, { width: `${progressPercentage}%` }]}
            />
            <Text style={styles.progressText}>
              {Math.round(progressPercentage)}%
            </Text>
          </View>
          {parentGDPPrice && !isEligible && getInfoText() && (
            <Text style={styles.infoText}>{getInfoText()}</Text>
          )}
        </View>
        {progressPercentage === 100 && (
          <TouchableOpacity
            style={[
              styles.rewardButton,
              rewardClaimed && styles.disabledButton,
            ]}
            onPress={() =>
              router.push({
                pathname: "/(reward)/1000-reward",
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
              {rewardClaimed1000
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
