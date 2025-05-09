import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
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

// Add props interface at the top
interface TwoHundredRewardScreenProps {
  user: User;
}

// Update component definition to use props
export default function TwoHundredRewardScreen({
  user,
}: TwoHundredRewardScreenProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [eligible, setEligible] = useState(false);
  const [rewardAmount, setRewardAmount] = useState(0);
  const [childrenWithSameGDP, setChildrenWithSameGDP] = useState<User[]>([]);
  const [grandchildrenWithSameGDP, setGrandchildrenWithSameGDP] = useState<
    User[]
  >([]);
  const [rewardClaimed, setRewardClaimed] = useState(false);
  const [greatGrandchildrenWithSameGDP, setGreatGrandchildrenWithSameGDP] =
    useState<User[]>([]);

  const { t } = useLanguage();

  useEffect(() => {
    checkEligibility();
  }, []);

  const getUserGDPPurchase = async (
    userId: string
  ): Promise<GDPPurchase | null> => {
    const gdpPurchasesRef = collection(db, "gdpPurchases");
    const q = query(gdpPurchasesRef, where("userId", "==", userId));
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      const gdpPurchaseData = querySnapshot.docs[0].data();
      return {
        id: querySnapshot.docs[0].id,
        ...gdpPurchaseData,
      } as GDPPurchase;
    }
    return null;
  };

  const checkEligibility = async () => {
    try {
      // Get parent's GDP purchase
      const parentGDPPurchase = await getUserGDPPurchase(user.uid);

      if (!parentGDPPurchase) {
        setEligible(false);
        setLoading(false);
        return;
      }

      // Check if reward was already claimed
      if (parentGDPPurchase.rewardClaimed200) {
        setRewardClaimed(true);
        setEligible(false);
        setLoading(false);
        return;
      }

      const parentGDPPrice = parentGDPPurchase.purchasePrice;
      setRewardAmount(parentGDPPrice * 1.0);

      // Get all direct children
      const usersRef = collection(db, "users");
      const childrenQuery = query(usersRef, where("parentId", "==", user.uid));
      const childrenSnapshot = await getDocs(childrenQuery);

      const matchingChildren: User[] = [];
      const matchingGrandchildren: User[] = [];
      const matchingGreatGrandchildren: User[] = [];

      // Check each child's GDP purchase and their descendants
      for (const childDoc of childrenSnapshot.docs) {
        const childGDPPurchase = await getUserGDPPurchase(childDoc.id);
        const childData = { uid: childDoc.id, ...childDoc.data() } as User;

        if (
          childGDPPurchase &&
          childGDPPurchase.purchasePrice === parentGDPPrice
        ) {
          matchingChildren.push(childData);

          // Get grandchildren for this child
          const grandchildrenQuery = query(
            usersRef,
            where("parentId", "==", childDoc.id)
          );
          const grandchildrenSnapshot = await getDocs(grandchildrenQuery);

          // Check each grandchild and their children (great-grandchildren)
          for (const grandchildDoc of grandchildrenSnapshot.docs) {
            const grandchildGDPPurchase = await getUserGDPPurchase(
              grandchildDoc.id
            );

            if (
              grandchildGDPPurchase &&
              grandchildGDPPurchase.purchasePrice === parentGDPPrice
            ) {
              matchingGrandchildren.push({
                uid: grandchildDoc.id,
                ...grandchildDoc.data(),
              } as User);

              // Get great-grandchildren for this grandchild
              const greatGrandchildrenQuery = query(
                usersRef,
                where("parentId", "==", grandchildDoc.id)
              );
              const greatGrandchildrenSnapshot = await getDocs(
                greatGrandchildrenQuery
              );

              // Check each great-grandchild's GDP purchase
              for (const greatGrandchildDoc of greatGrandchildrenSnapshot.docs) {
                const greatGrandchildGDPPurchase = await getUserGDPPurchase(
                  greatGrandchildDoc.id
                );

                if (
                  greatGrandchildGDPPurchase &&
                  greatGrandchildGDPPurchase.purchasePrice === parentGDPPrice
                ) {
                  matchingGreatGrandchildren.push({
                    uid: greatGrandchildDoc.id,
                    ...greatGrandchildDoc.data(),
                  } as User);
                }
              }
            }
          }
        }
      }

      setChildrenWithSameGDP(matchingChildren);
      setGrandchildrenWithSameGDP(matchingGrandchildren);
      setGreatGrandchildrenWithSameGDP(matchingGreatGrandchildren);

      // Check both eligibility conditions with new requirements
      const condition1 =
        matchingChildren.length >= 4 &&
        matchingGrandchildren.length >= 4 &&
        matchingGreatGrandchildren.length >= 8;
      const condition2 = matchingChildren.length >= 6;

      // Eligible if either condition is met
      setEligible(condition1 || condition2);

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
        // Get user's current data
        const userRef = doc(db, "users", user.uid);
        const userDoc = await transaction.get(userRef);

        if (!userDoc.exists()) {
          // throw new Error("User document not found");
          showAlert(t.error, `${t.invalid} ${t.user} ${t.information}`);
          return;
        }

        const userData = userDoc.data() as User;

        // Get GDP purchase with ID
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

        // Update user's balance
        transaction.update(userRef, {
          balance: userData.balance + rewardAmount,
        });

        // Update GDP purchase to mark reward as claimed
        const gdpPurchaseRef = doc(db, "gdpPurchases", gdpPurchaseDoc.id);
        transaction.update(gdpPurchaseRef, {
          rewardClaimed200: true,
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
          rewardClaimed200: true,
        });

        // Store transaction record
        const transactionRef = collection(db, "transactions");
        await addDoc(transactionRef, {
          fromUserId: "SYSTEM",
          toUserId: user.uid,
          amount: rewardAmount,
          timestamp: new Date(),
          type: "gdp_reward",
          rewardPercentage: 1.0,
          description:
            "200% GDP Reward for having 6+ children with matching GDP",
        });
      });

      // Refresh data after successful claim
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
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
    >
      <Text style={styles.title}>200% GDP {t.reward}</Text>

      {rewardClaimed ? (
        <View>
          <Text style={styles.claimedText}>
            {t.You_have_already_claimed_your} 200% GDP {t.reward}.
          </Text>
        </View>
      ) : eligible ? (
        <View>
          <Text style={styles.eligibleText}>
            {t.Congratulations}! {t.You_are_eligible_for_the} 200% GDP {t.reward}!
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

          {childrenWithSameGDP.length < 6 && (
            <>
              <Text style={styles.childrenTitle}>
                {t.qualified} GDP {t.requirements} {t.friend} {t.ecological_relations} ({grandchildrenWithSameGDP.length}/4):
              </Text>
              {grandchildrenWithSameGDP.map((grandchild) => (
                <Text key={grandchild.uid} style={styles.childItem}>
                  • {grandchild.username}
                </Text>
              ))}

              <Text style={styles.childrenTitle}>
                {t.qualified} GDP {t.requirements} {t.friend} {t.ecological_relations} (
                {greatGrandchildrenWithSameGDP.length}/8):
              </Text>
              {greatGrandchildrenWithSameGDP.map((greatGrandchild) => (
                <Text key={greatGrandchild.uid} style={styles.childItem}>
                  • {greatGrandchild.username}
                </Text>
              ))}
            </>
          )}

          <TouchableOpacity style={styles.claimButton} onPress={claimReward}>
            <Text style={styles.claimButtonText}>{t.get} {t.reward}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View>
          <Text style={styles.ineligibleText}>
            {t.You_are_not_eligible_for_the} 200% GDP {t.reward}
          </Text>
          <Text style={styles.requirementText}>{t.requirements} ({t.either}1 || 2) : </Text>

          <Text style={styles.bulletPoint}>
            • {t.condition} 1: {t.at_least} 4 {t.friend} {t.and} 4 + 8 {t.friend} {t.ecological_relations} {t.with} {t.equal} GDP
          </Text>

          <Text style={styles.bulletPoint}>
            • {t.condition} 2: {t.at_least} 6 {t.friend} {t.with} {t.equal} GDP
          </Text>
          <Text style={styles.bulletPoint}>
            • {t.All_must_have_the_same_GDP_value_as_you}
          </Text>
          <Text style={styles.bulletPoint}>
            • {t.Reward_can_only_be_claimed_once}
          </Text>
          <Text style={styles.currentStatus}>{t.current_Status} :</Text>
          
          <Text style={styles.currentStatus}>
            {t.qualified} GDP {t.requirements} {t.friend}: {childrenWithSameGDP.length}
          </Text>
          {childrenWithSameGDP.length < 6 && (
            <>
              <Text style={styles.currentStatus}>
                {t.qualified} GDP {t.friend} {t.ecological_relations}: {grandchildrenWithSameGDP.length}
              </Text>
              <Text style={styles.currentStatus}>
                {t.qualified} GDP {t.friend} {t.ecological_relations}:{" "}
                {greatGrandchildrenWithSameGDP.length}
              </Text>
            </>
          )}
        </View>
      )}

      <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
        <Text style={styles.backButtonText}>{t.back}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    flexGrow: 1,
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
