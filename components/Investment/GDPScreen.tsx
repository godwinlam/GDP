import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import LottieView from "lottie-react-native";
import { router } from "expo-router";
import {
  doc,
  runTransaction,
  addDoc,
  collection,
  query,
  orderBy,
  onSnapshot,
  where,
  getDocs,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/firebase";
import { User, GDPOption } from "@/types/user";
import { useReward } from "@/context/RewardContext";
import PinInput from "../Transaction/PinInput";
import translations from "@/translations";
import AsyncStorage from "@react-native-async-storage/async-storage";
import showAlert from "../CustomAlert/ShowAlert";
import { useLanguage } from "@/hooks/useLanguage";

// Add this function to store GDP reward transaction
const storeGDPRewardTransaction = async (
  fromUserId: string,
  toUserId: string,
  amount: number,
  rewardPercentage: number
) => {
  try {
    const transactionData = {
      fromUserId,
      toUserId,
      amount,
      timestamp: new Date(),
      type: "reward",
      rewardPercentage,
    };
    await addDoc(collection(db, "transactions"), transactionData);
    console.log("GDP Reward transaction stored successfully");
  } catch (error) {
    console.error("Error storing GDP reward transaction:", error);
  }
};

// Add this helper function to get user's GDP purchase price
const getUserGDPPurchasePrice = async (
  userId: string
): Promise<number | null> => {
  try {
    const gdpPurchasesRef = collection(db, "gdpPurchases");
    const q = query(gdpPurchasesRef, where("userId", "==", userId));
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      const gdpPurchase = querySnapshot.docs[0].data();
      return gdpPurchase.purchasePrice;
    }
    return null;
  } catch (error) {
    console.error("Error getting user GDP purchase price:", error);
    return null;
  }
};

// Add this function to process GDP rewards
const processGDPReward = async (
  transaction: any,
  childUserId: string,
  parentId: string,
  purchaseAmount: number,
  rewardPercentage: number
) => {
  try {
    // Get parent's GDP purchase price
    const parentGDPPrice = await getUserGDPPurchasePrice(parentId);
    // Get child's GDP purchase price (current purchase)
    const childGDPPrice = purchaseAmount;

    if (!parentGDPPrice) {
      console.log("Parent has no GDP purchase");
      return;
    }

    // Calculate reward based on the lower of parent and child GDP prices
    const baseAmount = Math.min(parentGDPPrice, childGDPPrice);
    const rewardAmount = baseAmount * rewardPercentage;

    const parentRef = doc(db, "users", parentId);
    const parentDoc = await transaction.get(parentRef);

    if (parentDoc.exists()) {
      const parentData = parentDoc.data() as User;

      // Check parent's GDP status before giving reward
      if (parentData.gdpStatus === "active") {
        // Update parent's balance with reward
        transaction.update(parentRef, {
          balance: parentData.balance + rewardAmount,
        });

        // Store reward transaction
        await storeGDPRewardTransaction(
          childUserId,
          parentId,
          rewardAmount,
          rewardPercentage
        );

        console.log(
          `GDP Reward processed: $${rewardAmount} based on ${baseAmount}`
        );
      } else {
        console.log("Parent's GDP is not active, skipping reward");
      }
    }
  } catch (error) {
    console.error("Error processing GDP reward:", error);
  }
};

// Add new function to get highest child GDP price
const getHighestChildGDPPrice = async (userId: string): Promise<number> => {
  try {
    // Get all direct children
    const usersRef = collection(db, "users");
    const childrenQuery = query(usersRef, where("parentId", "==", userId));
    const childrenSnapshot = await getDocs(childrenQuery);

    let highestPrice = 0;

    // Check each child's GDP purchase
    for (const childDoc of childrenSnapshot.docs) {
      const gdpPurchasesRef = collection(db, "gdpPurchases");
      const gdpQuery = query(
        gdpPurchasesRef,
        where("userId", "==", childDoc.id)
      );
      const gdpSnapshot = await getDocs(gdpQuery);

      if (!gdpSnapshot.empty) {
        const childGDPPrice = gdpSnapshot.docs[0].data().purchasePrice;
        highestPrice = Math.max(highestPrice, childGDPPrice);
      }
    }

    return highestPrice;
  } catch (error) {
    console.error("Error getting highest child GDP price:", error);
    return 0;
  }
};

// Update the component definition to accept props
interface GDPScreenProps {
  user: User;
}

export default function GDPScreen({ user }: GDPScreenProps) {
  // 1. All useState hooks
  const [selectedOption, setSelectedOption] = useState<GDPOption | null>(null);
  const [showPinModal, setShowPinModal] = useState(false);
  const [transactionPassword, setTransactionPassword] = useState("");
  const [gdpOptions, setGDPOptions] = useState<GDPOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<User>(user);
  const [hasAnyGDPPurchase, setHasAnyGDPPurchase] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const { t } = useLanguage();

  // 2. Get context hooks
  const { rewardSettings } = useReward();

  // 3. Animation refs - Create a map of refs for each option
  const animationRefs = useRef<{ [key: string]: LottieView | null }>({});

  // 4. useEffect hooks
  useEffect(() => {
    // Play all animations
    Object.values(animationRefs.current).forEach((ref) => {
      if (ref) {
        ref.play();
      }
    });
  }, [gdpOptions]); // Re-run when options change

  useEffect(() => {
    const gdpOptionsRef = collection(db, "gdpOptions");
    const q = query(gdpOptionsRef, orderBy("amount"));

    const unsubscribeGDPOptions = onSnapshot(q, (querySnapshot) => {
      const options: GDPOption[] = [];
      querySnapshot.forEach((doc) => {
        options.push({ id: doc.id, ...doc.data() } as GDPOption);
      });
      setGDPOptions(options);
      setLoading(false);
    });

    // Check if user has any GDP purchase
    const gdpPurchasesRef = collection(db, "gdpPurchases");
    const purchasesQuery = query(
      gdpPurchasesRef,
      where("userId", "==", user.uid)
    );

    const unsubscribePurchases = onSnapshot(purchasesQuery, (snapshot) => {
      setHasAnyGDPPurchase(!snapshot.empty);
    });

    const userRef = doc(db, "users", user.uid);
    const unsubscribeUser = onSnapshot(userRef, (docSnapshot) => {
      if (docSnapshot.exists()) {
        setCurrentUser({ ...docSnapshot.data(), uid: docSnapshot.id } as User);
      }
    });

    return () => {
      unsubscribeGDPOptions();
      unsubscribeUser();
      unsubscribePurchases();
    };
  }, [user.uid]);

  // 5. Handler functions
  const handleGDPSelection = async (option: GDPOption) => {
    if (hasAnyGDPPurchase) {
      showAlert(
        `${t.Purchase} ${t.not} ${t.allowed}`,
        `${t.You_have_already_purchased_a} GDP ${t.Only_one_purchase_is_allowed_per_user}`
      );
      return;
    }

    const usersRef = collection(db, "users");
    const childrenQuery = query(
      usersRef,
      where("parentId", "==", currentUser.uid)
    );
    const childrenSnapshot = await getDocs(childrenQuery);

    if (!childrenSnapshot.empty) {
      const highestChildPrice = await getHighestChildGDPPrice(currentUser.uid);

      if (highestChildPrice > 0 && option.price <= highestChildPrice) {
        showAlert(
          `${t.Purchase} ${t.not} ${t.allowed}`,
          `${t.Your_friends_already_purchased_earlier_than_you},${t.you_must_purchase_another_which_is_price_higher_than_your_friends} ($${highestChildPrice}).`
        );
        return;
      }
    }

    if (!validateGDPPurchase(option)) {
      return;
    }

    setSelectedOption(option);
    setShowPinModal(true);
  };

  const validateGDPPurchase = (option: GDPOption) => {
    if (!currentUser?.balance || currentUser.balance < option.price) {
      showAlert(t.insufficientBalance, `${t.balance} ${t.insufficient}`);
      return false;
    }
    return true;
  };

  const handlePurchase = async () => {
    if (!selectedOption) {
      showAlert(
        t.error,
        `${t.please} ${t.select} ${t.option} ${t.to} ${t.Purchase}`
      );
      return;
    }

    if (transactionPassword !== currentUser.transactionPassword) {
      showAlert(t.error, t.invalidTransactionPassword);
      setTransactionPassword("");
      return;
    }

    try {
      const userRef = doc(db, "users", currentUser.uid);

      await runTransaction(db, async (transaction) => {
        const userDoc = await transaction.get(userRef);
        if (!userDoc.exists()) {
          // throw "User document does not exist!";
          showAlert(t.error, `${t.user} ${t.notFound}`);
          return;
        }

        const userData = userDoc.data() as User;
        const currentBalance = userData.balance;
        const purchaseCost = selectedOption.price;

        if (currentBalance < purchaseCost) {
          showAlert(t.error, t.insufficientBalance);
          return;
        }

        // Calculate reward using admin-controlled percentage
        const rewardPercentage =
          (rewardSettings.gdpRewardPercentage || 0) / 100;

        // Check if user has a parent
        if (userData.parentId) {
          // Process GDP reward with price comparison
          await processGDPReward(
            transaction,
            currentUser.uid,
            userData.parentId,
            purchaseCost,
            rewardPercentage
          );
        }

        const newBalance = currentBalance - purchaseCost;
        const newGDP = (userData.gdp || 0) + selectedOption.amount;

        // Create the gdpPurchases document reference first
        const gdpPurchaseRef = doc(collection(db, "gdpPurchases"));

        // Add GDP purchase record with animationFile
        transaction.set(gdpPurchaseRef, {
          userId: currentUser.uid,
          username: currentUser.username,
          gdpPurchased: selectedOption.amount,
          purchasePrice: selectedOption.price,
          gdpOptionId: selectedOption.id,
          timestamp: serverTimestamp(),
          animationFile: selectedOption.animationFile || "non-active.json",
          source: "gdp", // Add source field to indicate this is from GDPScreen
        });

        // Update user's GDP status with gdpPurchases document ID
        transaction.update(userRef, {
          balance: newBalance,
          gdp: newGDP,
          gdpStatus: "active",
          gdpPurchaseId: gdpPurchaseRef.id, // Add the gdpPurchases document ID
        });
      });

      showAlert(
        t.success,
        `${t.success} ${t.purchased} ${selectedOption.amount} GDP!`,
        [
          {
            text: "OK",
            onPress: () => {
              router.replace("/(tabs)");
            },
          },
        ]
      );
    } catch (error) {
      console.error("Error purchasing GDP:", error);
      showAlert(
        t.error,
        typeof error === "string"
          ? error
          : "Failed to purchase GDP. Please try again."
      );
    } finally {
      setShowPinModal(false);
      setTransactionPassword("");
      setSelectedOption(null);
    }
  };

  const resetForm = () => {
    setShowPinModal(false);
    setTransactionPassword("");
    setSelectedOption(null);
  };

  // Function to get animation source based on animationFile
  const getAnimationSource = (animationFile: string) => {
    switch (animationFile) {
      case "star-1.json":
        return require("@/assets/animations/star-1.json");
      case "2-star.json":
        return require("@/assets/animations/2-star.json");
      case "3-star.json":
        return require("@/assets/animations/3-star.json");
      case "4-star.json":
        return require("@/assets/animations/4-star.json");
      case "5-star.json":
        return require("@/assets/animations/5-star.json");
      case "Crown.json":
        return require("@/assets/animations/Crown.json");
      default:
        return require("@/assets/animations/non-active.json");
    }
  };

  const renderGDPOptions = () => {
    // Sort GDP options from oldest to latest based on timestamp
    const sortedGDPOptions = [...gdpOptions].sort((a, b) => {
      const timestampA =
        a.timestamp instanceof Timestamp ? a.timestamp.toDate() : new Date(0);
      const timestampB =
        b.timestamp instanceof Timestamp ? b.timestamp.toDate() : new Date(0);
      return timestampA.getTime() - timestampB.getTime();
    });

    return sortedGDPOptions.map((option) => (
      <TouchableOpacity
        key={option.id}
        style={[
          styles.gdpOption,
          selectedOption?.id === option.id && styles.selectedOption,
          hasAnyGDPPurchase && styles.disabledOption,
        ]}
        onPress={() => handleGDPSelection(option)}
        disabled={hasAnyGDPPurchase}
      >
        <View style={styles.imageContainer}>
          <LottieView
            ref={(ref) => {
              animationRefs.current[option.id] = ref;
            }}
            source={getAnimationSource(
              option.animationFile || "non-active.json"
            )}
            autoPlay
            loop
            style={styles.lottieAnimation}
          />
          {/* <Text style={styles.gdpAmount}>{option.amount}%</Text> */}
        </View>
        <View style={styles.priceContainer}>
          <Text style={styles.gdpOptionPrice}>${option.price.toFixed(2)}</Text>
        </View>
      </TouchableOpacity>
    ));
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      // Re-fetch GDP options by re-running the useEffect cleanup and setup
      const gdpOptionsRef = collection(db, "gdpOptions");
      const q = query(gdpOptionsRef, orderBy("amount"));
      const querySnapshot = await getDocs(q);

      const options: GDPOption[] = [];
      querySnapshot.forEach((doc) => {
        options.push({ id: doc.id, ...doc.data() } as GDPOption);
      });
      setGDPOptions(options);
    } catch (error) {
      console.error("Refresh error:", error);
    } finally {
      setRefreshing(false);
    }
  }, []);

  // 6. Render logic
  if (loading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <Text style={styles.title}>GDP {t.activation}</Text>
      <Text style={styles.balance}>
        {`${t.available} ${t.balance}: ${currentUser.balance.toFixed(2)}`}
      </Text>
      {hasAnyGDPPurchase ? (
        <Text style={styles.warningText}>
          {`${t.You_have_already_purchased_a} GDP ${t.option}. ${t.no_additional_purchases} ${t.allowed}.`}
        </Text>
      ) : (
        <Text
          style={styles.instruction}
        >{`${t.please} ${t.select} GDP ${t.option}`}</Text>
      )}

      {renderGDPOptions()}

      <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
        <Text style={styles.backButtonText}>{t.back}</Text>
      </TouchableOpacity>

      <PinInput
        visible={showPinModal}
        onClose={resetForm}
        value={transactionPassword}
        onChange={setTransactionPassword}
        onConfirm={() => {
          handlePurchase();
          setShowPinModal(false);
        }}
        title={`${t.confirm} ${t.Purchase}`}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 20,
    alignItems: "center",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
  },
  balance: {
    fontSize: 18,
    marginBottom: 10,
  },
  instruction: {
    fontSize: 16,
    marginBottom: 15,
  },
  gdpOption: {
    flexDirection: "row",
    backgroundColor: "#f0f0f0",
    borderRadius: 10,
    marginBottom: 15,
    width: "90%",
    alignItems: "center",
    justifyContent: "space-between",
    elevation: 3,
    boxShadow: "0px 2px 3.84px rgba(0, 0, 0, 0.25)",
  },
  selectedOption: {
    backgroundColor: "#e3f2fd",
    borderColor: "#1a237e",
    borderWidth: 2,
  },
  gdpOptionText: {
    fontSize: 18,
    fontWeight: "bold",
    marginVertical: 5,
  },
  gdpOptionPrice: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#1a237e",
  },
  backButton: {
    marginTop: 20,
  },
  backButtonText: {
    color: "#2196F3",
    fontSize: 16,
  },
  modalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modalContent: {
    backgroundColor: "white",
    padding: 20,
    borderRadius: 10,
    width: "80%",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 5,
    padding: 10,
    marginVertical: 10,
  },
  modalButtonContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 20,
  },
  modalButton: {
    backgroundColor: "#2196F3",
    padding: 10,
    borderRadius: 5,
    width: "45%",
    alignItems: "center",
  },
  cancelButton: {
    backgroundColor: "#f44336",
  },
  modalButtonText: {
    color: "white",
    fontSize: 16,
  },
  loader: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  warningText: {
    color: "#ff6b6b",
    fontSize: 16,
    marginBottom: 15,
    textAlign: "center",
    fontWeight: "bold",
  },
  disabledOption: {
    backgroundColor: "#e0e0e0",
    opacity: 0.7,
  },
  imageContainer: {
    width: 120,
    height: 120,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  lottieAnimation: {
    width: "100%",
    height: "100%",
  },
  gdpAmount: {
    position: "absolute",
    fontSize: 24,
    fontWeight: "bold",
    color: "#1a237e",
    textAlign: "center",
    backgroundColor: "rgba(255,255,255,0.8)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 15,
  },
  priceContainer: {
    backgroundColor: "rgba(255,255,255,0.9)",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 25,
    marginTop: 10,
    marginRight: 10,
  },
  loadingContainer: {
    justifyContent: "center",
    alignItems: "center",
  },
  statusIndicator: {
    padding: 5,
    borderRadius: 5,
    marginTop: 5,
  },
  statusText: {
    color: "white",
    fontWeight: "bold",
    fontSize: 12,
  },
});
