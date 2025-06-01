import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  Image,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import {
  getFirestore,
  doc,
  getDoc,
  runTransaction,
  collection,
  serverTimestamp,
  query,
  onSnapshot,
  orderBy,
} from 'firebase/firestore';
import { User } from '../../types/user';
import PinInput from '../Transaction/PinInput';
import { userService } from '@/services/userService';
import showAlert from '../CustomAlert/ShowAlert';
import { useLanguage } from '@/hooks/useLanguage';

interface InvestmentScreenProps {
  user: User;
}

interface ShareOption {
  id: string;
  amount: number;
  price: number;
}

export default function InvestmentScreen({ user }: InvestmentScreenProps) {
  const [userTokens, setUserTokens] = useState(0);
  const [selectedOption, setSelectedOption] = useState<ShareOption | null>(null);
  const [showPinInput, setShowPinInput] = useState(false);
  const [transactionPassword, setTransactionPassword] = useState('');
  const [shareOptions, setShareOptions] = useState<ShareOption[]>([]);
  const [loading, setLoading] = useState(true);
  const db = getFirestore();

   const { t } = useLanguage();

  useEffect(() => {
    const fetchUserData = async () => {
      if (user?.uid) {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data() as User;
          setUserTokens(userData.token || 0);
        }
      }
    };

    fetchUserData();
  }, [user?.uid]);

  useEffect(() => {
    const shareOptionsRef = collection(db, "shareOptions");
    const q = query(shareOptionsRef, orderBy("amount"));

    const unsubscribeShareOptions = onSnapshot(q, (querySnapshot) => {
      const options: ShareOption[] = [];
      querySnapshot.forEach((doc) => {
        options.push({ id: doc.id, ...doc.data() } as ShareOption);
      });
      setShareOptions(options);
      setLoading(false);
    });

    return () => {
      unsubscribeShareOptions();
    };
  }, []);

  const handleShareSelection = (option: ShareOption) => {
    setSelectedOption(option);
    setShowPinInput(true);
  };

  const handlePurchase = async () => {
    if (!selectedOption || !user?.uid) {
      showAlert(t.error, `${t.please} ${t.select} ${t.Staking} ${t.option}`);
      return;
    }

    try {

      // Verify transaction password
      const userDoc = await userService.getUserById(user.uid);
      if (!userDoc || userDoc.transactionPassword !== transactionPassword) {
        showAlert(t.error, t.invalidTransactionPassword);
        return;
      }

      const userRef = doc(db, "users", user.uid);

      await runTransaction(db, async (transaction) => {
        const userDoc = await transaction.get(userRef);
        if (!userDoc.exists()) {
          throw `${t.error}, ${t.invalid} ${t.user}`;
        }

        const userData = userDoc.data() as User;
        const currentTokens = userData.token || 0;
        const purchaseCost = selectedOption.price; // Using price as token cost

        if (currentTokens < purchaseCost) {
          throw `${t.error}, ${t.insufficient} ${t.gdp}`;
        }

        const newTokenBalance = currentTokens - purchaseCost;
        const newShares = (userData.shares || 0) + selectedOption.amount;

        transaction.update(userRef, {
          token: newTokenBalance,
          shares: newShares,
        });

        const sharePurchaseRef = collection(db, "sharePurchases");
        transaction.set(doc(sharePurchaseRef), {
          userId: user.uid,
          username: user.username,
          sharesPurchased: selectedOption.amount,
          tokensPaid: selectedOption.price,
          timestamp: serverTimestamp(),
          rewardClaimed: false,
        });
      });

      showAlert(
        t.success,
        `${t.success} ${t.Staking} ${selectedOption.amount} GDPCOIN !`,
        [
          {
            text: t.ok,
            onPress: () => {
              resetForm();
            },
          },
        ]
      );
    } catch (error) {
      console.error("Error purchasing shares:", error);
      showAlert(
        t.error,
        typeof error === "string"
          ? error
          : `${t.error} ${t.Staking}, ${t.tryAgain}`
      );
      resetForm();
    }
  };

  const resetForm = () => {
    setShowPinInput(false);
    setTransactionPassword("");
    setSelectedOption(null);
  };

  if (loading) {
    return <ActivityIndicator size="large" style={styles.loader} />;
  }

  return (
    <View style={styles.container}>
      <View style={styles.balanceContainer}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={styles.bitcoinImageContainer}>
            <Image
              source={require("@/assets/images/GDPCoin01.png")}
              style={styles.bitcoinImage}
              resizeMode="contain"
            />
          </View>
          <Text style={styles.balanceAmount}>{userTokens.toLocaleString()}</Text>
        </View>
      </View>

      <ScrollView style={styles.stakingList}>
        {shareOptions.map((option) => (
          <TouchableOpacity
            key={option.id}
            style={[
              styles.shareOption,
              selectedOption?.id === option.id && styles.selectedOption,
            ]}
            onPress={() => handleShareSelection(option)}
          >
            <Text style={[
              styles.shareOptionText,
              selectedOption?.id === option.id && styles.selectedOptionText,
            ]}>
              {t.Staking}
            </Text>
            <Text style={[
              styles.shareOptionPrice,
              selectedOption?.id === option.id && styles.selectedOptionText,
            ]}>
              {option.price} GDPCOIN
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <PinInput
        onClose={() => {
          resetForm();
        }}
        visible={showPinInput}
        value={transactionPassword}
        onChange={setTransactionPassword}
        onConfirm={() => { handlePurchase(); resetForm(); setShowPinInput(false); }}
        title={`${t.confirm} ${t.Staking} ${selectedOption?.amount} GDPCOIN`}
      />

      <View style={styles.bottomButtonContainer}>
        <TouchableOpacity
          style={styles.navigationButton}
          onPress={() => router.replace('/(tabs)')}
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
    backgroundColor: '#f5f5f5',
  },
  balanceContainer: {
    backgroundColor: '#2196F3',
    padding: 20,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  balanceTitle: {
    color: '#fff',
    fontSize: 16,
    opacity: 0.8,
  },
  balanceAmount: {
    color: '#fff',
    fontSize: 30,
    fontWeight: 'bold',
  },
  stakingList: {
    padding: 16,
  },
  shareOption: {
    backgroundColor: "#f8f9fa",
    padding: 20,
    borderRadius: 10,
    marginBottom: 12,
    width: "100%",
    alignItems: "center",
    borderWidth: 1,
    borderColor: '#eee',
  },
  selectedOption: {
    backgroundColor: "#004AAD",
    borderColor: "#004AAD",
  },
  shareOptionText: {
    fontSize: 18,
    fontWeight: "600",
    color: '#333',
    marginBottom: 5,
  },
  selectedOptionText: {
    color: '#fff',
  },
  shareOptionPrice: {
    fontSize: 16,
    color: "#666",
  },
  loader: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  bottomButtonContainer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    backgroundColor: '#fff',
  },
  navigationButton: {
    backgroundColor: '#2196F3',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  bitcoinImageContainer: {
    width: 50,
    height: 50,
    marginRight: 20,
    marginLeft: 30,
    backgroundColor: 'blue',
    borderRadius: 12,
  },
  bitcoinImage: {
    width: "100%",
    height: "100%",
  },
});
