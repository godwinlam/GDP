import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  addDoc,
  runTransaction,
} from "firebase/firestore";
import { db } from "@/firebase";
import { User, GDPPurchase } from "@/types/user";
import { useLanguage } from "@/hooks/useLanguage";
import showAlert from "../CustomAlert/ShowAlert";

interface OneThirtyRewardScreenProps {
  user: User;
}

export default function OneThirtyRewardScreen({
  user,
}: OneThirtyRewardScreenProps) {
  const [loading, setLoading] = useState(true);
  const [eligible, setEligible] = useState(false);
  const [rewardAmount, setRewardAmount] = useState(0);
  const [childrenWithSameGDP, setChildrenWithSameGDP] = useState<User[]>([]);
  const [rewardClaimed, setRewardClaimed] = useState(false);
  const { t } = useLanguage();

  useEffect(() => {
    checkEligibility();
  }, []);

  const getUserGDPPurchase = async (
    userId: string
  ): Promise<GDPPurchase | null> => {
    const gdpPurchasesRef = collection(db, "gdpPurchases");
    const q = query(
      gdpPurchasesRef,
      where("userId", "==", userId),
      where("source", "in", ["gdp", "otc", null])
    );
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      const sortedDocs = querySnapshot.docs.sort((a, b) => {
        const timestampA = a.data().timestamp?.toDate?.() || 0;
        const timestampB = b.data().timestamp?.toDate?.() || 0;
        return timestampB - timestampA;
      });

      const gdpPurchaseData = sortedDocs[0].data();
      return {
        id: sortedDocs[0].id,
        ...gdpPurchaseData,
      } as GDPPurchase;
    }
    return null;
  };

  const checkEligibility = async () => {
    try {
      const parentGDPPurchase = await getUserGDPPurchase(user.uid);

      if (!parentGDPPurchase) {
        setEligible(false);
        setLoading(false);
        return;
      }

      if (parentGDPPurchase.rewardClaimed130) {
        setRewardClaimed(true);
        setEligible(false);
        setLoading(false);
        return;
      }

      const parentGDPPrice = parentGDPPurchase.purchasePrice;
      setRewardAmount(parentGDPPrice * 0.3);

      const usersRef = collection(db, "users");
      const childrenQuery = query(usersRef, where("parentId", "==", user.uid));
      const childrenSnapshot = await getDocs(childrenQuery);

      const matchingChildren: User[] = [];

      for (const childDoc of childrenSnapshot.docs) {
        const childGDPPurchase = await getUserGDPPurchase(childDoc.id);

        if (
          childGDPPurchase &&
          childGDPPurchase.purchasePrice === parentGDPPrice
        ) {
          matchingChildren.push({
            uid: childDoc.id,
            ...childDoc.data(),
          } as User);
        }
      }

      setChildrenWithSameGDP(matchingChildren);

      setEligible(matchingChildren.length >= 2);

      setLoading(false);
    } catch (error) {
      console.error("Error checking eligibility:", error);
      setLoading(false);
      showAlert(t.error, "Failed to check reward eligibility");
    }
  };

  const refreshData = async () => {
    setLoading(true);
    try {
      await checkEligibility();
    } catch (error) {
      console.error("Error refreshing data:", error);
    } finally {
      setLoading(false);
    }
  };

  const claimReward = async () => {
    try {
      await runTransaction(db, async (transaction) => {
        const userRef = doc(db, "users", user.uid);
        const userDoc = await transaction.get(userRef);

        if (!userDoc.exists()) {
          // throw new Error("User document not found");
          showAlert(t.error, `${t.invalid} ${t.user} ${t.information}`);
          return;
        }

        const userData = userDoc.data() as User;

        const gdpPurchasesRef = collection(db, "gdpPurchases");
        const gdpQuery = query(
          gdpPurchasesRef,
          where("userId", "==", user.uid),
          where("source", "in", ["gdp", "otc", null]),
        );
        const gdpSnapshot = await getDocs(gdpQuery);

        if (gdpSnapshot.empty) {
          // throw new Error("GDP purchase not found");
          showAlert(t.error, `${t.invalid} ${t.Purchase} GDP ${t.information}`);
          return;
        }

        const sortedDocs = gdpSnapshot.docs.sort((a, b) => {
          const timestampA = a.data().timestamp?.toDate?.() || 0;
          const timestampB = b.data().timestamp?.toDate?.() || 0;
          return timestampB - timestampA;
        });

        const gdpPurchaseDoc = sortedDocs[0];
        const gdpPurchase = gdpPurchaseDoc.data() as GDPPurchase;

        transaction.update(userRef, {
          balance: userData.balance + rewardAmount,
        });

        const gdpPurchaseRef = doc(db, "gdpPurchases", gdpPurchaseDoc.id);
        transaction.update(gdpPurchaseRef, {
          rewardClaimed130: true,
        });

        const newGdpPurchaseRef = doc(collection(db, "gdpPurchases"));
        transaction.set(newGdpPurchaseRef, {
          userId: user.uid,
          username: userData.username,
          gdpPurchased: gdpPurchase.gdpPurchased,
          purchasePrice: gdpPurchase.purchasePrice,
          timestamp: new Date(),
          animationFile: gdpPurchase.animationFile,
          source: "otc",
          rewardClaimed130: true,
        });

        const transactionRef = collection(db, "transactions");
        await addDoc(transactionRef, {
          fromUserId: "SYSTEM",
          toUserId: user.uid,
          amount: rewardAmount,
          timestamp: new Date(),
          type: "gdp_reward",
          rewardPercentage: 0.3,
          description:
            // "130% GDP Reward for having 2+ friends with matching GDP",
            t.GDP_130_Reward,
        });
      });

      await refreshData();

      showAlert(
        t.success,
        `${t.reward} $${rewardAmount.toFixed(2)} ${t.has_been_added_to_your_balance}!`,
        [
          {
            text: "OK",
            onPress: () => {
              router.push({
                pathname: "/transaction-history",
                params: { user: JSON.stringify(user) },
              });
            },
          },
        ]
      );
    } catch (error) {
      console.error("Error claiming reward:", error);
      showAlert(t.error, t.tryAgain);
    }
  };

  if (loading) {
    return <ActivityIndicator size="large" style={styles.loader} />;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>130% GDP {t.reward}</Text>

      {rewardClaimed ? (
        <View>
          <Text style={styles.claimedText}>
            {t.You_have_already_claimed_your} 130% GDP {t.reward}.
          </Text>
        </View>
      ) : eligible ? (
        <View>
          <Text style={styles.eligibleText}>
            {t.Congratulations}! {t.You_are_eligible_for_the} 130% GDP {t.reward}!
          </Text>
          <Text style={styles.rewardAmount}>
            {t.reward} {t.amount}: ${rewardAmount.toFixed(2)}
          </Text>
          <Text style={styles.childrenTitle}>
            {t.qualified} GDP {t.requirements} {t.friend} ({childrenWithSameGDP.length}):
          </Text>
          {childrenWithSameGDP.map((child) => (
            <Text key={child.uid} style={styles.childItem}>
              • {child.username}
            </Text>
          ))}
          <TouchableOpacity style={styles.claimButton} onPress={claimReward}>
            <Text style={styles.claimButtonText}>{t.get} {t.reward}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View>
          <Text style={styles.ineligibleText}>
            {t.You_are_not_eligible_for_the} 130% GDP {t.reward}
          </Text>
          <Text style={styles.requirementText}>{t.requirements}</Text>
          <Text style={styles.bulletPoint}>
            • {t.at_least} 2 {t.friend} {t.with} {t.equal} GDP
          </Text>
          <Text style={styles.bulletPoint}>
            • {t.All_must_have_the_same_GDP_value_as_you}
          </Text>
          <Text style={styles.bulletPoint}>
            • {t.Reward_can_only_be_claimed_once}
          </Text>
          <Text style={styles.currentStatus}>
            {t.qualified} GDP {t.requirements} {t.friend}: {childrenWithSameGDP.length} ({t.minimum} 2
            {t.required})
          </Text>
        </View>
      )}

      <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
        <Text style={styles.backButtonText}>{t.back}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  loader: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "center",
  },
  eligibleText: {
    fontSize: 18,
    color: "green",
    marginBottom: 15,
    textAlign: "center",
  },
  ineligibleText: {
    fontSize: 18,
    color: "red",
    marginBottom: 15,
    textAlign: "center",
  },
  rewardAmount: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "center",
  },
  childrenTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 10,
  },
  childItem: {
    fontSize: 16,
    marginLeft: 10,
    marginBottom: 5,
  },
  requirementText: {
    fontSize: 16,
    fontWeight: "bold",
    marginTop: 20,
    marginBottom: 10,
  },
  bulletPoint: {
    fontSize: 16,
    marginLeft: 10,
    marginBottom: 5,
  },
  currentStatus: {
    fontSize: 16,
    marginTop: 15,
    color: "#666",
  },
  claimButton: {
    backgroundColor: "#4CAF50",
    padding: 15,
    borderRadius: 5,
    marginTop: 20,
    alignItems: "center",
  },
  claimButtonText: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
  },
  backButton: {
    marginTop: 20,
    padding: 15,
    alignItems: "center",
  },
  backButtonText: {
    color: "#2196F3",
    fontSize: 16,
  },
  claimedText: {
    fontSize: 18,
    color: "#666",
    textAlign: "center",
    marginBottom: 15,
  },
});
