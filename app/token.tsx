import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  TextInput,
} from "react-native";
import { router, Stack } from "expo-router";
import { useAuth } from "../context/auth";
import {
  getFirestore,
  collection,
  getDocs,
  doc,
  updateDoc,
  getDoc,
} from "firebase/firestore";
import { User } from "../types/user";
import { AntDesign } from "@expo/vector-icons";
import PinInput from "@/components/Transaction/PinInput";
import showAlert from "@/components/CustomAlert/ShowAlert";
import { useLanguage } from "@/hooks/useLanguage";

interface Token {
  id: string;
  name: string;
  // image: string | any;
  price: number;
}

export default function TokenScreen() {
  const [tokens, setTokens] = useState<Token[]>([]);
  const [userBalance, setUserBalance] = useState(0);
  const [userTokens, setUserTokens] = useState(0);
  const [selectedToken, setSelectedToken] = useState<Token | null>(null);
  const [quantity, setQuantity] = useState<Record<string, number | "">>({});
  const [showPinInput, setShowPinInput] = useState(false);
  const [pin, setPin] = useState("");
  const [isSelling, setIsSelling] = useState(false);
  const { user } = useAuth();
  const db = getFirestore();

  const { t } = useLanguage();

  useEffect(() => {
    const fetchUserData = async () => {
      if (user?.uid) {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data() as User;
          setUserBalance(userData.balance || 0);
          setUserTokens(userData.token || 0);
        }
      }
    };

    const fetchTokens = async () => {
      try {
        const tokensRef = collection(db, "tokens");
        const snapshot = await getDocs(tokensRef);

        if (snapshot.empty) {
          // Initialize with default token if collection is empty
          const defaultToken = {
            id: "1",
            name: "GDPCOIN",
            // image: require('@/assets/images/GDPCoin01.png'),
            price: 1,
          };
          setTokens([defaultToken]);
        } else {
          const fetchedTokens = snapshot.docs.map((doc) => ({
            ...doc.data(),
            id: doc.id,
          })) as Token[];
          setTokens(fetchedTokens);
        }

        const initialQuantities: Record<string, number> = {};
        tokens.forEach((token) => {
          initialQuantities[token.id] = 1;
        });
        setQuantity(initialQuantities);
      } catch (error) {
        console.error("Error fetching tokens:", error);
        showAlert(t.error, t.tryAgain);
      }
    };

    fetchUserData();
    fetchTokens();
  }, [user?.uid]);

  const handleQuantityChange = (tokenId: string, change: number) => {
    setQuantity((prev) => {
      const currentValue = prev[tokenId] || 1;
      const newValue = currentValue + change;
      // Only allow positive numbers
      return {
        ...prev,
        [tokenId]: Math.max(1, newValue),
      };
    });
  };

  const handleQuantityInput = (tokenId: string, value: string) => {
    // Remove any non-numeric characters
    const cleanValue = value.replace(/[^0-9]/g, "");

    // If the input is empty, set it to empty string
    if (!cleanValue) {
      setQuantity((prev) => ({
        ...prev,
        [tokenId]: "" as const,
      }));
      return;
    }

    // Parse as integer
    const numValue = parseInt(cleanValue);

    // Update the value, ensuring it's at least 1
    setQuantity((prev) => ({
      ...prev,
      [tokenId]: numValue || 1,
    }));
  };

  const calculateTotalPrice = (token: Token) => {
    const qty = quantity[token.id];
    return token.price * (typeof qty === "number" ? qty : 1);
  };

  const handlePurchase = async (token: Token) => {
    if (!user?.uid) {
      showAlert(t.error, t.loginError);
      return;
    }

    const totalPrice = calculateTotalPrice(token);
    if (userBalance >= totalPrice) {
      setSelectedToken(token);
      setShowPinInput(true);
    } else {
      showAlert(t.error, t.insufficientBalance);
    }
  };

  const handleSell = async (token: Token) => {
    if (!user?.uid) {
      showAlert(t.error, t.loginError);
      return;
    }

    const tokenQuantity = quantity[token.id] || 1;
    if (userTokens < tokenQuantity) {
      showAlert(t.error, `${t.insufficient} GDPCOIN`);
      return;
    }

    setSelectedToken(token);
    setIsSelling(true);
    setShowPinInput(true);
  };

  const handlePinConfirm = async () => {
    if (!selectedToken || !user?.uid) return;

    try {
      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (!userDoc.exists()) {
        showAlert(t.error, `${t.user} ${t.notFound}`);
        return;
      }

      const userData = userDoc.data() as User;
      if (pin !== userData.transactionPassword) {
        showAlert(t.error, `${t.transactionPassword} ${t.error}`);
        setPin("");
        return;
      }

      const tokenQuantity = quantity[selectedToken.id] || 1;
      const totalPrice = calculateTotalPrice(selectedToken);

      if (isSelling) {
        if (userTokens < tokenQuantity) {
          showAlert(t.error, `${t.insufficient} GDPCOIN`);
          return;
        }

        const userRef = doc(db, "users", user.uid);
        const newBalance = userBalance + totalPrice;
        const newTokens = userTokens - tokenQuantity;

        await updateDoc(userRef, {
          balance: newBalance,
          token: newTokens,
        });

        setUserBalance(newBalance);
        setUserTokens(newTokens);
        showAlert(
          t.success,
          `${t.success} ${t.sold} ${tokenQuantity} ${selectedToken.name} GDPCOIN`
        );
      } else {
        if (userBalance < totalPrice) {
          showAlert(t.error, t.insufficientBalance);
          return;
        }

        const userRef = doc(db, "users", user.uid);
        const newBalance = userBalance - totalPrice;
        const newTokens = userTokens + tokenQuantity;

        await updateDoc(userRef, {
          balance: newBalance,
          token: newTokens,
        });

        setUserBalance(newBalance);
        setUserTokens(newTokens);
        showAlert(
          t.success,
          `${t.success} ${t.purchased} ${tokenQuantity} ${selectedToken.name} GDPCOIN`
        );
      }
    } catch (error) {
      showAlert(
        t.error,
        `${t.error} ${t.to}to ${
          isSelling ? `${t.Sell}` : `${t.Purchase}`
        } GDPCOIN. ${t.tryAgain}`
      );
    } finally {
      setShowPinInput(false);
      setSelectedToken(null);
      setPin("");
      setIsSelling(false);
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: "Token Market",
          headerStyle: { backgroundColor: "#2196F3" },
          headerTintColor: "#fff",
        }}
      />

      <View style={styles.balanceContainer}>
        <View style={styles.balanceItem}>
          <Text style={styles.balanceTitle}>{t.balance}</Text>

          <View style={{ flexDirection: "row" }}>
            <Text style={styles.currencySymbol}>$</Text>
            <Text style={styles.balanceAmount}>
              {userBalance.toLocaleString()}
            </Text>
          </View>
        </View>

        <View style={styles.balanceItem}>
          <Text style={styles.balanceTitle}>GDPCOIN</Text>
          <Text style={styles.balanceAmount}>{userTokens}</Text>
        </View>
      </View>

      <ScrollView style={styles.tokenList}>
        {tokens.map((token) => (
          <View key={token.id} style={styles.tokenCard}>
            <View style={styles.tokenHeader}>
              <Image
                source={require("@/assets/images/GDPCoin01.png")}
                style={styles.tokenImage}
                resizeMode="contain"
              />
              <View style={styles.tokenHeaderInfo}>
                <Text style={styles.tokenName}>{token.name}</Text>
                <Text style={styles.tokenPrice}>
                  $ {token.price.toLocaleString()}
                </Text>
              </View>
            </View>

            <View style={styles.tokenBody}>
              <View style={styles.quantitySection}>
                <Text style={styles.sectionLabel}>{t.quantity}</Text>
                <View style={styles.quantityContainer}>
                  <TouchableOpacity
                    onPress={() => handleQuantityChange(token.id, -1)}
                    style={styles.quantityButton}
                  >
                    <AntDesign name="minus" size={20} color="#2196F3" />
                  </TouchableOpacity>
                  <TextInput
                    style={styles.quantityInput}
                    value={
                      quantity[token.id] === ""
                        ? ""
                        : String(quantity[token.id] || 1)
                    }
                    onChangeText={(value) =>
                      handleQuantityInput(token.id, value)
                    }
                    keyboardType="numeric"
                    maxLength={100}
                    placeholder="1"
                    textAlign="center"
                  />
                  <TouchableOpacity
                    onPress={() => handleQuantityChange(token.id, 1)}
                    style={styles.quantityButton}
                  >
                    <AntDesign name="plus" size={20} color="#2196F3" />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.totalSection}>
                <Text style={styles.sectionLabel}>
                  {t.total} {t.amount}
                </Text>
                <Text style={styles.totalPrice}>
                  $ {calculateTotalPrice(token).toLocaleString()}
                </Text>
              </View>

              <View style={styles.buttonContainer}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.buyButton]}
                  onPress={() => handlePurchase(token)}
                >
                  <Text style={styles.actionButtonText}>{t.Purchase}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, styles.sellButton]}
                  onPress={() => handleSell(token)}
                >
                  <Text style={styles.actionButtonText}>{t.Sell}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ))}
      </ScrollView>

      <PinInput
        value={pin}
        onChange={setPin}
        visible={showPinInput}
        onClose={() => {
          setShowPinInput(false);
          setSelectedToken(null);
          setPin("");
          setIsSelling(false);
        }}
        onConfirm={() => {
          if (pin.length === 6) {
            handlePinConfirm();
          } else {
            showAlert(t.error, t.invalidTransactionPassword);
          }
        }}
        title={`${t.please} ${t.enter} ${t.transactionPassword}`}
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
    backgroundColor: "#f5f5f5",
  },
  balanceContainer: {
    flexDirection: "row",
    backgroundColor: "#2196F3",
    padding: 20,
    justifyContent: "space-around",
    ...Platform.select({
      ios: {
        boxShadow: "0px 2px 8px rgba(0, 0, 0, 0.1)",
      },
      android: {
        elevation: 4,
      },
      default: {
        boxShadow: "0px 2px 8px rgba(0, 0, 0, 0.1)",
      },
    }),
  },
  balanceItem: {
    alignItems: "center",
  },
  balanceTitle: {
    color: "#fff",
    fontSize: 16,
    opacity: 0.8,
  },
  balanceAmount: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "bold",
    marginTop: 5,
  },
  tokenList: {
    padding: 16,
  },
  tokenCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    marginBottom: 16,
    overflow: "hidden",
    ...Platform.select({
      ios: {
        boxShadow: "0px 2px 8px rgba(0, 0, 0, 0.1)",
      },
      android: {
        elevation: 3,
      },
      default: {
        boxShadow: "0px 2px 8px rgba(0, 0, 0, 0.1)",
      },
    }),
  },
  tokenHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  tokenHeaderInfo: {
    flex: 1,
    marginLeft: 16,
  },
  tokenBody: {
    padding: 16,
  },
  tokenImage: {
    width: 48,
    height: 55,
    borderRadius: 24,
    backgroundColor: "blue",
  },
  tokenName: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1a1a1a",
  },
  tokenPrice: {
    fontSize: 16,
    color: "#666",
    marginTop: 4,
  },
  sectionLabel: {
    fontSize: 14,
    color: "#666",
    marginBottom: 8,
  },
  quantitySection: {
    marginBottom: 16,
  },
  quantityContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#f8f8f8",
    borderRadius: 8,
    padding: 8,
    maxWidth: "100%",
  },
  quantityButton: {
    padding: 8,
    borderWidth: 1,
    borderColor: "#2196F3",
    borderRadius: 8,
    backgroundColor: "#fff",
  },
  quantityInput: {
    marginHorizontal: 16,
    minWidth: 140,
    maxWidth: "60%",
    textAlign: "center",
    padding: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderRadius: 8,
    color: "black",
    fontSize: 16,
    fontWeight: "bold",
    backgroundColor: "#fff",
    flexShrink: 1,
    flexGrow: 0,
    letterSpacing: -0.5,
  },
  totalSection: {
    marginBottom: 16,
    alignItems: "center",
  },
  totalPrice: {
    fontSize: 24,
    color: "#2196F3",
    fontWeight: "bold",
  },
  buttonContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  buyButton: {
    backgroundColor: "#2196F3",
  },
  sellButton: {
    backgroundColor: "#FF5252",
  },
  actionButtonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 16,
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
  currencySymbol: {
    fontSize: 12,
    color: "#fff",
    fontWeight: "bold",
    marginLeft: 20,
    marginTop: 18,
    marginRight: 5,
  },
});
