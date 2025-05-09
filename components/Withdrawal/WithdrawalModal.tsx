import React, { useState, useEffect } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Image,
  ActivityIndicator,
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { auth, db } from "../../firebase";
import {
  doc,
  serverTimestamp,
  collection,
  addDoc,
  runTransaction,
} from "firebase/firestore";
import PinInput from "../Transaction/PinInput";
import { router } from "expo-router";
import { userService } from "@/services/userService";
import { useReward } from "@/context/RewardContext";
import showAlert from "../CustomAlert/ShowAlert";
import { useLanguage } from "@/hooks/useLanguage";

interface WithdrawalModalProps {
  isVisible: boolean;
  onClose: () => void;
  userBalance: number;
}

interface Blockchain {
  id: string;
  name: string;
  image: any;
  symbol: string;
}

const blockchains: Blockchain[] = [
  {
    id: "TRC-20",
    name: "Tron (TRC-20)",
    image: require("@/assets/images/TRC-20.jpg"),
    symbol: "USDT",
  },
  {
    id: "USDC",
    name: "USDC",
    image: require("@/assets/images/USDC.png"),
    symbol: "USDC",
  },
  {
    id: "ERC-20",
    name: "Ethereum (ERC-20)",
    image: require("@/assets/images/ERC-20.jpg"),
    symbol: "USDT",
  },
];

export default function WithdrawalModal({
  isVisible,
  onClose,
  userBalance,
}: WithdrawalModalProps) {
  const [selectedBlockchain, setSelectedBlockchain] =
    useState<Blockchain | null>(null);
  const [amount, setAmount] = useState("");
  const [address, setAddress] = useState("");
  const [transactionPassword, setTransactionPassword] = useState("");
  const [showBlockchainModal, setShowBlockchainModal] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { rewardSettings } = useReward();

  const { t } = useLanguage();

  const validateForm = () => {
    if (!selectedBlockchain) {
      setError(`${t.please} ${t.select} ${t.blockchainnetwork}`);
      showAlert(t.error, `${t.please} ${t.select} ${t.blockchainnetwork}`);
      return false;
    }

    if (!amount || parseFloat(amount) <= 0) {
      setError(t.invalidAmount);
      showAlert(t.error, t.invalidAmount);
      return false;
    }

    if (parseFloat(amount) > userBalance) {
      setError(t.insufficientBalance);
      showAlert(t.error, t.insufficientBalance);
      return false;
    }

    const minAmount = 50;
    if (parseFloat(amount) < minAmount) {
      setError(`${t.minimumWithdrawalAmountIs}${minAmount}`);
      showAlert(t.error, `${t.minimumWithdrawalAmountIs}${minAmount}`);
      return false;
    }

    if (!address) {
      setError(t.Pleaseselectarecipientaddress);
      showAlert(t.error, t.Pleaseselectarecipientaddress);
      return false;
    }

    // Basic address validation based on blockchain
    if (selectedBlockchain?.id === "TRC-20" && !address.startsWith("T")) {
      setError(t.invalidAddressFormat);
      showAlert(t.error, t.invalidAddressFormat);
      return false;
    }

    if (selectedBlockchain?.id === "ERC-20" && !address.startsWith("0x")) {
      setError(t.invalidAddressFormat);
      showAlert(t.error, t.invalidAddressFormat);
      return false;
    }

    return true;
  };

  const handleProceed = () => {
    setError(null);
    if (!validateForm() || !selectedBlockchain) return;
    setShowPinModal(true);
  };

  const handleWithdraw = async () => {
    try {
      if (!auth.currentUser) {
        // throw new Error(t.UserNotAuthenticated);
        showAlert(t.error, t.UserNotAuthenticated);
        return;
      }

      setIsLoading(true);
      // Verify transaction password and get user data
      const userDoc = await userService.getUserById(auth.currentUser.uid);
      if (!userDoc || userDoc.transactionPassword !== transactionPassword) {
        showAlert(t.error, t.invalidTransactionPassword);
        setIsLoading(false);
        return;
      }

      // Get username from userDoc
      const username = userDoc.username;

      setIsLoading(true);
      const userId = auth.currentUser.uid;
      const userRef = doc(db, "users", userId);

      // Calculate withdrawal amount with 10% deduction
      const withdrawalAmount = parseFloat(amount);
      const deductionRate = (rewardSettings.withdrawalFee || 0) / 100;
      const deductionAmount = withdrawalAmount * deductionRate;
      const finalWithdrawalAmount = withdrawalAmount - deductionAmount;

      // Run the transaction
      await runTransaction(db, async (transaction) => {
        const userDoc = await transaction.get(userRef);
        if (!userDoc.exists()) {
          throw new Error(t.UserNotFound);
        }

        const currentBalance = userDoc.data().balance || 0;
        if (currentBalance < withdrawalAmount) {
          throw new Error(t.insufficientBalance);
        }

        // Update user balance (deduct the original amount)
        transaction.update(userRef, {
          balance: currentBalance - withdrawalAmount,
        });

        // Create withdrawal request with both original and final amounts
        const withdrawalRef = collection(db, "withdrawals");
        const withdrawalData = {
          userId,
          username,
          originalAmount: withdrawalAmount,
          deductionAmount: deductionAmount,
          finalAmount: finalWithdrawalAmount,
          deductionRate: deductionRate,
          deductionPercentage: deductionRate * 100 + "%",
          blockchain: selectedBlockchain?.id,
          address,
          status: "pending",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          currency: selectedBlockchain?.symbol,
        };

        // Create history record
        const historyRecord = {
          userId,
          amount: withdrawalAmount,
          deductedAmount: deductionAmount,
          finalAmount: finalWithdrawalAmount,
          blockchain: selectedBlockchain?.id,
          address,
          status: "pending",
          timestamp: new Date().toISOString(),
          type: "withdrawal",
          currency: selectedBlockchain?.symbol,
        };

        // Update user balance and add to history
        transaction.update(userRef, {
          balance: currentBalance - withdrawalAmount,
          "history.withdrawals": [
            ...(userDoc.data().history?.withdrawals || []),
            historyRecord,
          ],
        });

        // Add withdrawal record
        await addDoc(withdrawalRef, withdrawalData);
      });

      showAlert(
        t.success,
        `${t.Withdrawalrequestsubmittedsuccessfully}.${t.Pleasewaitforprocessing}`,
        [
          {
            text: "OK",
            onPress: () => {
              resetForm();
              onClose();
              router.push("/transaction-history");
            },
          },
        ]
      );
    } catch (error: any) {
      console.error("Withdrawal error:", error);
      setError(error.message || "Failed to process withdrawal");
      showAlert(t.error, error.message || "Failed to process withdrawal");
    } finally {
      setIsLoading(false);
      setShowPinModal(false);
    }
  };

  const resetForm = () => {
    setSelectedBlockchain(null);
    setAmount("");
    setAddress("");
    setTransactionPassword("");
    setShowPinModal(false);
    setError(null);
  };

  useEffect(() => {
    if (!isVisible) {
      resetForm();
    }
  }, [isVisible]);

  if (!isVisible) return null;

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={isVisible}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeButtonContainer}
            >
              <MaterialCommunityIcons
                name="arrow-left"
                size={24}
                color="#000"
              />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {t.transfer} {t.to} {t.Wallet}
            </Text>
          </View>

          <ScrollView style={styles.formContainer}>
            {/* Balance Display */}
            <View style={styles.balanceContainer}>
              <Text style={styles.balanceLabel}>
                {t.available} {t.balance}
              </Text>
              <Text style={styles.balanceAmount}>
                ${userBalance.toFixed(2)}
              </Text>
            </View>

            {error && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {/* Blockchain Selection */}
            <Text style={styles.label}>
              {t.select} {t.blockchainnetwork}
            </Text>
            <TouchableOpacity
              style={styles.blockchainSelector}
              onPress={() => setShowBlockchainModal(true)}
            >
              {selectedBlockchain ? (
                <View style={styles.selectedBlockchain}>
                  <Image
                    source={selectedBlockchain.image}
                    style={styles.blockchainImage}
                  />
                  <Text style={styles.blockchainName}>
                    {selectedBlockchain.name}
                  </Text>
                </View>
              ) : (
                <Text style={styles.placeholderText}>
                  {t.select} {t.blockchainnetwork}
                </Text>
              )}
              <Ionicons name="chevron-down" size={24} color="#666" />
            </TouchableOpacity>

            {/* Amount Input */}
            <Text style={styles.label}>{t.amount}</Text>
            <View style={styles.inputContainer}>
              {/* <Text style={styles.currencySymbol}>$</Text> */}
              <TextInput
                style={styles.input}
                value={amount}
                onChangeText={(text) => {
                  setError(null);
                  setAmount(text.replace(/[^0-9.]/g, ""));
                }}
                keyboardType="decimal-pad"
                placeholder={`${t.enter} ${t.amount}`}
                placeholderTextColor="#999"
              />
            </View>

            {/* Address Input */}
            <Text style={styles.label}>
              {t.recipient} {t.address}
            </Text>
            <View style={styles.inputContainer}>
              <MaterialCommunityIcons
                name="wallet"
                size={20}
                color="#666"
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                value={address}
                onChangeText={(text) => {
                  setError(null);
                  setAddress(text.trim());
                }}
                placeholder={`${t.enter} ${t.blockchainnetwork} ${t.address}`}
                placeholderTextColor="#999"
                multiline
                numberOfLines={4}
                maxLength={100} // 25 chars * 4 lines
              />
            </View>

            {/* Proceed Button */}
            <TouchableOpacity
              style={[
                styles.withdrawButton,
                (isLoading || !selectedBlockchain || !amount || !address) &&
                  styles.disabledButton,
              ]}
              onPress={handleProceed}
              disabled={isLoading || !selectedBlockchain || !amount || !address}
            >
              {isLoading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={styles.withdrawButtonText}>{t.proceed}</Text>
              )}
            </TouchableOpacity>

            <Text style={styles.noteText}>
              {`${t.note}: ${t.minimumWithdrawalAmountIs} 25.${t.will_also_deduct} 5% ${t.for} GDP POOL ${t.and} 5% ${t.for_system_maintaining} ${t.processingTimeMayVaryDependingOnTheBlockchainNetwork}`}
            </Text>
          </ScrollView>

          {/* PIN Input Modal */}
          <PinInput
            value={transactionPassword}
            onChange={setTransactionPassword}
            onClose={() => setShowPinModal(false)}
            onConfirm={() => {
              handleWithdraw();
              setShowPinModal(false);
              setTransactionPassword("");
            }}
            visible={showPinModal}
            title={t.confirm}
          />
        </View>

        {/* Blockchain Selection Modal */}
        <Modal
          animationType="slide"
          transparent={true}
          visible={showBlockchainModal}
          onRequestClose={() => setShowBlockchainModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.blockchainModalContainer}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {t.select} {t.blockchainnetwork}
                </Text>
                <TouchableOpacity
                  onPress={() => setShowBlockchainModal(false)}
                  style={styles.closeButtonContainer}
                >
                  {/* <Text style={styles.closeButton}>×</Text> */}
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.blockchainList}>
                {blockchains.map((blockchain) => (
                  <TouchableOpacity
                    key={blockchain.id}
                    style={[
                      styles.blockchainOption,
                      selectedBlockchain?.id === blockchain.id &&
                        styles.selectedBlockchainOption,
                    ]}
                    onPress={() => {
                      setSelectedBlockchain(blockchain);
                      setShowBlockchainModal(false);
                    }}
                  >
                    <Image
                      source={blockchain.image}
                      style={styles.blockchainImage}
                    />
                    <View style={styles.blockchainInfo}>
                      <Text style={styles.blockchainName}>
                        {blockchain.name}
                      </Text>
                      <Text style={styles.blockchainSymbol}>
                        {blockchain.symbol}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        </Modal>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "#004AAD",
  },
  modalContainer: {
    flex: 1,
    backgroundColor: "white",
    padding: 20,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  closeButtonContainer: {
    padding: 5,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#333",
    marginLeft: 15,
  },
  formContainer: {
    padding: 5,
  },
  balanceContainer: {
    backgroundColor: "#f8f9fa",
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
  },
  balanceLabel: {
    fontSize: 14,
    color: "#666",
    marginBottom: 5,
  },
  balanceAmount: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#004AAD",
  },
  errorContainer: {
    backgroundColor: "#ffebee",
    padding: 10,
    borderRadius: 5,
    marginBottom: 15,
  },
  errorText: {
    color: "#c62828",
    fontSize: 14,
  },
  label: {
    fontSize: 16,
    fontWeight: "500",
    color: "#333",
    marginBottom: 8,
  },
  blockchainSelector: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    padding: 12,
    marginBottom: 20,
  },
  selectedBlockchain: {
    flexDirection: "row",
    alignItems: "center",
  },
  blockchainImage: {
    width: 24,
    height: 24,
    marginRight: 10,
    borderRadius: 12,
  },
  blockchainName: {
    fontSize: 16,
    color: "#333",
  },
  placeholderText: {
    color: "#999",
    fontSize: 16,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    marginBottom: 20,
    paddingHorizontal: 12,
  },
  currencySymbol: {
    fontSize: 18,
    color: "#666",
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: "#333",
    padding: 12,
  },
  inputIcon: {
    marginRight: 8,
  },
  withdrawButton: {
    backgroundColor: "#004AAD",
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
    marginVertical: 20,
  },
  withdrawButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  disabledButton: {
    opacity: 0.5,
  },
  noteText: {
    fontSize: 14,
    color: "#f31010",
    fontStyle: "italic",
    marginBottom: 20,
    textAlign: "center",
  },
  blockchainModalContainer: {
    backgroundColor: "white",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    minHeight: "50%",
    maxHeight: "80%",
  },
  blockchainList: {
    padding: 20,
  },
  blockchainOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    backgroundColor: "#f8f9fa",
  },
  selectedBlockchainOption: {
    backgroundColor: "#e3f2fd",
    borderColor: "#004AAD",
    borderWidth: 1,
  },
  blockchainInfo: {
    flex: 1,
    marginLeft: 10,
  },
  blockchainSymbol: {
    fontSize: 14,
    color: "#666",
    marginTop: 2,
  },
});
