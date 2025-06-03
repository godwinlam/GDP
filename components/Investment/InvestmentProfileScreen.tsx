import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  doc,
  Timestamp,
  runTransaction,
  serverTimestamp,
  getDoc,
  getDocs,
} from "firebase/firestore";
import { db } from "../../firebase";
import { User, SharePurchase, Transaction } from "../../types/user";
import { useReward } from "@/context/RewardContext";
import PinInput from "../Transaction/PinInput";
import { router } from "expo-router";
import { userService } from "@/services/userService";
import showAlert from "../CustomAlert/ShowAlert";
import { useLanguage } from "@/hooks/useLanguage";

interface InvestmentProfileScreenProps {
  user: User;
}

const CountdownTimer: React.FC<{
  endDate: Date;
  onComplete: () => void;
  selectedLanguage: string;
}> = ({ endDate, onComplete }) => {
  const [timeLeft, setTimeLeft] = useState("");
  const timerCompleted = useRef(false);
  const { t } = useLanguage();

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date().getTime();
      const end = endDate.getTime();
      const distance = end - now;

      if (distance > 0) {
        const days = Math.floor(distance / (1000 * 60 * 60 * 24));
        const hours = Math.floor(
          (distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
        );
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);

        setTimeLeft(`${days}d ${hours}h ${minutes}m ${seconds}s`);
      } else {
        setTimeLeft(t.completed || "Completed");
        clearInterval(timer);
        if (!timerCompleted.current) {
          timerCompleted.current = true;
          onComplete();
        }
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [endDate, onComplete, t]);

  return <Text style={styles.countdownText}>{timeLeft}</Text>;
};

export default function InvestmentProfileScreen({
  user,
}: InvestmentProfileScreenProps) {
  const [sharePurchases, setSharePurchases] = useState<SharePurchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<User>(user);
  const [showPinModal, setShowPinModal] = useState(false);
  const [transactionPassword, setTransactionPassword] = useState("");
  const [selectedPurchase, setSelectedPurchase] =
    useState<SharePurchase | null>(null);

  const { t, selectedLanguage } = useLanguage();

  const { rewardSettings } = useReward();
  const investmentTerm = rewardSettings.investmentTerm || 30;

  const fetchData = useCallback(() => {
    const sharePurchasesRef = collection(db, "sharePurchases");
    const q = query(
      sharePurchasesRef,
      where("userId", "==", user.uid),
      orderBy("timestamp", "desc")
    );

    const unsubscribePurchases = onSnapshot(
      q,
      (querySnapshot) => {
        const purchases: SharePurchase[] = [];
        querySnapshot.forEach((doc) => {
          purchases.push({ id: doc.id, ...doc.data() } as SharePurchase);
        });
        setSharePurchases(purchases);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error("Firestore error:", err);
        setError("An error occurred while fetching data. Please try again.");
        showAlert(t.error, t.tryAgain);
        setLoading(false);
      }
    );

    const userRef = doc(db, "users", user.uid);
    const unsubscribeUser = onSnapshot(userRef, (docSnapshot) => {
      if (docSnapshot.exists()) {
        setCurrentUser({ ...docSnapshot.data(), uid: docSnapshot.id } as User);
      }
    });

    return () => {
      unsubscribePurchases();
      unsubscribeUser();
    };
  }, [user.uid]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const calculateReward = (purchase: SharePurchase) => {
    if (!(purchase.timestamp instanceof Timestamp)) {
      return 0;
    }
    const purchaseDate = purchase.timestamp.toDate();
    const currentDate = new Date();
    const daysSincePurchase =
      (currentDate.getTime() - purchaseDate.getTime()) / (1000 * 3600 * 24);

    if (daysSincePurchase >= investmentTerm && !purchase.rewardClaimed) {
      return (
        purchase.sharesPurchased *
        ((rewardSettings.investmentPercentage || 0) / 100)
      );
    }
    return 0;
  };

  const refreshInvestments = useCallback(async () => {
    setLoading(true);
    try {
      const userRef = doc(db, "users", user.uid);
      const userDoc = await getDoc(userRef);
      if (userDoc.exists()) {
        setCurrentUser({ ...userDoc.data(), uid: userDoc.id } as User);
      }

      const sharePurchasesRef = collection(db, "sharePurchases");
      const q = query(
        sharePurchasesRef,
        where("userId", "==", user.uid),
        orderBy("timestamp", "desc")
      );
      const querySnapshot = await getDocs(q);
      const purchases: SharePurchase[] = [];
      querySnapshot.forEach((doc) => {
        purchases.push({ id: doc.id, ...doc.data() } as SharePurchase);
      });
      setSharePurchases(purchases);
    } catch (error) {
      console.error("Error refreshing data:", error);
      showAlert(t.error, t.tryAgain);
    } finally {
      setLoading(false);
    }
  }, [user.uid, t.error, t.tryAgain]);

  const claimReward = async (purchase: SharePurchase) => {
    try {
      const reward = calculateReward(purchase);
      if (reward > 0) {
        await runTransaction(db, async (transaction) => {
          const userRef = doc(db, "users", user.uid);
          const userDoc = await transaction.get(userRef);
          if (!userDoc.exists()) {
            throw "User document does not exist!";
          }
          const userData = userDoc.data() as User;
          const newBalance = userData.balance + reward;
          transaction.update(userRef, { balance: newBalance });

          const purchaseRef = doc(db, "sharePurchases", purchase.id);
          const newTotalRewardClaimed =
            (purchase.totalRewardClaimed || 0) + reward;
          transaction.update(purchaseRef, {
            rewardClaimed: false,
            totalRewardClaimed: newTotalRewardClaimed,
            timestamp: serverTimestamp(),
          });

          const rewardTransactionData: Omit<Transaction, "id"> = {
            fromUserId: "SYSTEM",
            toUserId: user.uid,
            amount: reward,
            timestamp: Timestamp.now(),
            type: "investment_reward",
            sharesPurchased: purchase.sharesPurchased,
          };
          const rewardTransactionRef = collection(db, "transactions");
          transaction.set(doc(rewardTransactionRef), rewardTransactionData);
        });

        showAlert(
          t.success,
          `${t.reward} $${reward.toFixed(2)} ${t.hasbeenaddedtoyourbalance}. ${
            t.Thestakingperiodhasrestarted
          }.`,
          [
            {
              text: t.ok,
              onPress: async () => {
                await refreshInvestments();
                router.replace("/(tabs)");
              },
            },
          ]
        );
      } else {
        showAlert(t.error, `${t.tryAgain}.`);
      }
    } catch (error) {
      console.error("Error claiming reward:", error);
      showAlert(t.error, t.tryAgain);
    }
  };

  const handleStop = (purchase: SharePurchase) => {
    setSelectedPurchase(purchase);
    setShowPinModal(true);
  };

  const resetForm = () => {
    setShowPinModal(false);
    setTransactionPassword("");
    setSelectedPurchase(null);
  };

  const confirmStop = async () => {
    if (!selectedPurchase) return;

    try {
      // Verify transaction password
      const userDoc = await userService.getUserById(user.uid);
      if (!userDoc || userDoc.transactionPassword !== transactionPassword) {
        showAlert(t.error, t.invalidTransactionPassword);
        return;
      }

      await runTransaction(db, async (transaction) => {
        const userRef = doc(db, "users", currentUser.uid);
        const userDoc = await transaction.get(userRef);

        if (!userDoc.exists()) {
          showAlert(t.error, `${t.user} ${t.notFound}`);
          return;
        }

        const userData = userDoc.data() as User;
        const newTokens = (userData.token || 0) + selectedPurchase.tokensPaid;
        const newShares =
          (userData.shares || 0) - selectedPurchase.sharesPurchased;

        transaction.update(userRef, {
          token: newTokens,
          shares: newShares,
        });

        const purchaseRef = doc(db, "sharePurchases", selectedPurchase.id);
        transaction.delete(purchaseRef);
      });

      showAlert(t.success, t.stakingstoppedsuccessfully);
      resetForm();
    } catch (error) {
      console.error("Error stopping staking:", error);
      Alert.alert("Error", "Failed to stop staking. Please try again.");
    }
  };

  const handleCountdownComplete = useCallback(() => {
    console.log("Countdown completed, refreshing data...");
    fetchData();
  }, [fetchData]);

  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshInvestments();
    setRefreshing(false);
  }, [refreshInvestments]);

  const renderPurchaseItem = (item: SharePurchase) => {
    const endDate = new Date(
      item.timestamp instanceof Timestamp
        ? item.timestamp.toDate().getTime() +
          investmentTerm * 24 * 60 * 60 * 1000
        : new Date().getTime()
    );
    const now = new Date();
    const progress = Math.min(
      (now.getTime() -
        (item.timestamp instanceof Timestamp
          ? item.timestamp.toDate().getTime()
          : now.getTime())) /
        (investmentTerm * 24 * 60 * 60 * 1000),
      1
    );

    return (
      <View style={styles.purchaseItem}>
        <Text style={styles.shareAmount}>{t.Staking}</Text>
        <Text style={styles.purchasePrice}>
          GDPCOIN: {item.tokensPaid.toFixed(2)}
        </Text>
        <Text style={styles.timestamp}>
          {`${t.start} ${t.date}: ${
            item.timestamp instanceof Timestamp
              ? item.timestamp.toDate().toLocaleString()
              : `${t.date} ${t.not} ${t.available}`
          }`}
        </Text>
        <View style={styles.progressBarContainer}>
          <View style={[styles.progressBar, { width: `${progress * 100}%` }]} />
        </View>
        <Text style={styles.progressText}>
          {progress < 1
            ? `${(progress * 100).toFixed(0)}% ${t.to} ${t.reward}`
            : `${t.reward} ${t.available}`}
        </Text>
        {/* <CountdownTimer
          endDate={endDate}
          onComplete={handleCountdownComplete}
          selectedLanguage={selectedLanguage}
        /> */}
        {calculateReward(item) > 0 && !item.rewardClaimed && (
          <TouchableOpacity
            style={styles.claimButton}
            onPress={() => claimReward(item)}
          >
            <Text style={styles.claimButtonText}>
              {t.get} {t.reward}: ${calculateReward(item).toFixed(2)}
            </Text>
          </TouchableOpacity>
        )}
        {item.rewardClaimed && (
          <Text style={styles.rewardClaimed}>
            {t.reward} {t.received}
          </Text>
        )}
        <Text style={styles.totalRewardClaimed}>
          {t.total} {t.reward} {t.received}: $
          {(item.totalRewardClaimed || 0).toFixed(2)}
        </Text>
        <TouchableOpacity
          style={styles.stopButton}
          onPress={() => handleStop(item)}
        >
          <Text style={styles.stopButtonText}>
            {t.stop} {t.Staking}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  if (loading) {
    return <ActivityIndicator size="large" style={styles.loader} />;
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={sharePurchases}
        renderItem={({ item }) => renderPurchaseItem(item)}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <Text
            style={styles.emptyText}
          >{`${t.no}${t.Staking}${t.Record}`}</Text>
        }
      />

      <PinInput
        visible={showPinModal}
        onClose={resetForm}
        value={transactionPassword}
        onChange={setTransactionPassword}
        onConfirm={() => {
          confirmStop();
          resetForm();
          setShowPinModal(false);
        }}
        title={
          <>
            {`${t.confirm} ${t.stop} ${t.Staking}\n`}
            <Text style={{ color: "red", fontSize: 12 }}>
              {"      "}
              {t.you_will_not_get_a_reward}
            </Text>
          </>
        }
      />

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
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  listContainer: {
    padding: 16,
  },
  purchaseItem: {
    backgroundColor: "#f8f9fa",
    borderRadius: 10,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#eee",
  },
  shareAmount: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
    marginBottom: 8,
  },
  purchasePrice: {
    fontSize: 16,
    color: "#004AAD",
    marginBottom: 8,
  },
  timestamp: {
    fontSize: 14,
    color: "#666",
    marginBottom: 12,
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: "#eee",
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: 8,
  },
  progressBar: {
    height: "100%",
    backgroundColor: "green",
  },
  progressText: {
    fontSize: 14,
    color: "#666",
    marginBottom: 8,
    textAlign: "center",
  },
  countdownText: {
    fontSize: 16,
    color: "#004AAD",
    fontWeight: "500",
    textAlign: "center",
    marginBottom: 12,
  },
  claimButton: {
    backgroundColor: "#004AAD",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 8,
  },
  claimButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "500",
  },
  rewardClaimed: {
    color: "#4CAF50",
    fontSize: 16,
    textAlign: "center",
    marginBottom: 8,
  },
  totalRewardClaimed: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    marginBottom: 12,
  },
  stopButton: {
    backgroundColor: "#f44336",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  stopButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "500",
  },
  emptyText: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    marginTop: 32,
  },
  loader: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
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
