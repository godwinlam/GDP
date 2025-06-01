import React, { useState, useEffect } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from "react-native";
import { auth, db } from "@/firebase";
import {
  addDoc,
  collection,
  Timestamp,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import { Transaction, User } from "@/types/user";
import { userService } from "@/services/userService";
import { MaterialIcons } from "@expo/vector-icons";
import PinInput from "./PinInput";
import { router } from "expo-router";
import showAlert from "../CustomAlert/ShowAlert";
import { useLanguage } from "@/hooks/useLanguage";

interface TransactionModalProps {
  isVisible: boolean;
  onClose: () => void;
}
export default function TransactionModal({
  isVisible,
  onClose,
}: TransactionModalProps) {
  const [recipientUsername, setRecipientUsername] = useState("");
  const [amount, setAmount] = useState("");
  const [transactionPassword, setTransactionPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [recipientExists, setRecipientExists] = useState<boolean | null>(null);
  const [verifyingUsername, setVerifyingUsername] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [recipientData, setRecipientData] = useState<User | null>(null);

  const { t } = useLanguage();

  const handleCancel = () => {
    setRecipientUsername("");
    setAmount("");
    setTransactionPassword("");
    setRecipientExists(null);
    setVerifyingUsername(false);
    setShowPinModal(false);
    setRecipientData(null);
    onClose();
  };

  const handleClose = () => {
    if (showPinModal) {
      setShowPinModal(false);
      setTransactionPassword("");
    } else {
      handleCancel();
    }
  };

  const handlePinClose = () => {
    setShowPinModal(false);
    setTransactionPassword("");
  };

  const verifyRecipientUsername = async (username: string) => {
    if (!username) {
      setRecipientExists(null);
      setRecipientData(null);
      return;
    }

    setVerifyingUsername(true);
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error("Not logged in");
      }

      const currentUserDoc = await userService.getUserById(currentUser.uid);
      if (currentUserDoc?.username === username) {
        setRecipientExists(false);
        setRecipientData(null);
        showAlert(t.error, t.youCannotSendMoneyToYourself);
        return;
      }

      const usersRef = collection(db, "users");
      const q = query(usersRef, where("username", "==", username));
      const querySnapshot = await getDocs(q);

      const exists = !querySnapshot.empty;
      setRecipientExists(exists);

      if (exists) {
        const userData = querySnapshot.docs[0].data() as User;
        setRecipientData(userData);
      } else {
        setRecipientData(null);
      }
    } catch (error) {
      console.error("Error verifying username:", error);
      setRecipientExists(false);
      setRecipientData(null);
    } finally {
      setVerifyingUsername(false);
    }
  };

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (recipientUsername) {
        verifyRecipientUsername(recipientUsername);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [recipientUsername]);

  const handleProceed = () => {
    if (!recipientExists || !amount) {
      showAlert(t.error, t.fillAllFields);
      return;
    }
    setShowPinModal(true);
  };

  const handleTransaction = async () => {
    if (!recipientUsername || !amount || !transactionPassword) {
      showAlert(t.error, t.fillAllFields);
      return;
    }

    setLoading(true);
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        showAlert(t.error, t.loginError);
        return;
      }

      // Get sender's details
      const senderDoc = await userService.getUserById(currentUser.uid);
      if (!senderDoc) {
        showAlert(t.error, t.senderDetailsNotFound);
        return;
      }

      // Check if user is trying to send money to themselves
      if (senderDoc.username === recipientUsername) {
        showAlert(t.error, t.youCannotSendMoneyToYourself);
        return;
      }

      // Verify transaction password
      if (senderDoc.transactionPassword !== transactionPassword) {
        showAlert(t.error, t.invalidTransactionPassword);
        return;
      }

      const transferAmount = parseFloat(amount);
      if (isNaN(transferAmount) || transferAmount <= 0) {
        showAlert(t.error, t.invalidAmount);
        return;
      }

      if (senderDoc.balance < transferAmount) {
        showAlert(t.error, t.insufficientBalance);
        return;
      }

      // Find recipient by username
      const usersRef = collection(db, "users");
      const q = query(usersRef, where("username", "==", recipientUsername));
      const recipientSnapshot = await getDocs(q);

      if (recipientSnapshot.empty) {
        showAlert(t.error, t.recipientNotFound);
        return;
      }

      const recipientDoc = recipientSnapshot.docs[0];
      const recipientData = recipientDoc.data() as User;
      const recipientId = recipientDoc.id;

      // Double check to prevent self-transfer (using ID)
      if (currentUser.uid === recipientId) {
        showAlert(t.error, t.youCannotSendMoneyToYourself);
        return;
      }

      // Create transaction record
      const transaction: Omit<Transaction, "id"> = {
        fromUserId: currentUser.uid,
        toUserId: recipientId,
        amount: transferAmount,
        timestamp: Timestamp.now(),
        type: "transfer",
      };

      // Add transaction to database
      const transactionRef = await addDoc(
        collection(db, "transactions"),
        transaction
      );

      // Update sender's balance
      await userService.updateUser(currentUser.uid, {
        balance: senderDoc.balance - transferAmount,
      });

      // Update recipient's balance
      await userService.updateUser(recipientId, {
        balance: recipientData.balance + transferAmount,
      });

      showAlert(t.success, `${t.transactionCompletedSuccessfully}`, [
        {
          text: "OK",
          onPress: () => {
            onClose();
            setRecipientUsername("");
            setAmount("");
            setTransactionPassword("");
            router.push("/transaction-history");
          },
        },
      ]);
    } catch (error) {
      console.error("Transaction error:", error);
      showAlert(t.error, t.transactionFailed);
    } finally {
      setLoading(false);
    }
  };

  const handleAmountChange = (text: string) => {
    // Only allow digits
    const digitsOnly = text.replace(/[^0-9]/g, "");
    setAmount(digitsOnly);
  };

  return (
    <>
      <Modal
        visible={isVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={handleClose}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.header}>
              <TouchableOpacity
                onPress={handleClose}
                style={styles.closeButton}
              >
                <MaterialIcons name="arrow-back" size={24} color="#000" />
              </TouchableOpacity>
              {/* <Text style={styles.modalTitle}>Transfer Money</Text> */}
            </View>

            <Text style={styles.sectionTitle}>
              {t.transfer} {t.to}
            </Text>

            {recipientData && (
              <View style={styles.recipientCard}>
                <View style={styles.recipientAvatar}>
                  <MaterialIcons name="person" size={32} color="#666" />
                </View>
                <View style={styles.recipientInfo}>
                  <Text style={styles.recipientName}>
                    {recipientData.username.toUpperCase()}
                  </Text>
                  <Text style={styles.recipientPhone}>
                    {recipientData.phoneNumber || ""}
                  </Text>
                </View>
              </View>
            )}

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>
                {t.recipient} {t.username}
              </Text>
              <TextInput
                style={[
                  styles.input,
                  recipientExists === false && styles.invalidInput,
                  recipientExists === true && styles.validInput,
                ]}
                value={recipientUsername}
                onChangeText={(text) => {
                  setRecipientUsername(text);
                  if (!text) setRecipientExists(null);
                }}
                placeholder={`${t.enter} ${t.recipient} ${t.username}`}
              />
              {verifyingUsername && (
                <ActivityIndicator
                  size="small"
                  style={styles.verifyingIndicator}
                />
              )}
              {recipientExists === false && (
                <Text style={styles.errorText}>
                  {t.username} {t.notFound}
                </Text>
              )}
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>{t.amount}</Text>
              <TextInput
                style={styles.input}
                value={amount}
                onChangeText={handleAmountChange}
                keyboardType="numeric"
                placeholder={`${t.enter} ${t.amount}`}
              />
            </View>

            <TouchableOpacity
              style={[
                styles.proceedButton,
                (!recipientExists || !amount) && styles.disabledButton,
              ]}
              onPress={handleProceed}
              disabled={!recipientExists || !amount}
            >
              <Text style={styles.buttonText}>{t.proceed}</Text>
            </TouchableOpacity>
          </View>

          <PinInput
            value={transactionPassword}
            onChange={setTransactionPassword}
            onClose={handlePinClose}
            onConfirm={() => {
              handleTransaction();
              handlePinClose();
            }}
            visible={showPinModal}
            title={t.transactionPassword}
          />
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: "#004AAD",
  },
  modalContent: {
    flex: 1,
    backgroundColor: "white",
    padding: 20,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 30,
  },
  closeButton: {
    padding: 5,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "black",
    marginLeft: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "500",
    marginBottom: 20,
    color: "#666",
  },
  recipientCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    padding: 15,
    borderRadius: 12,
    marginBottom: 20,
    ...Platform.select({
      ios: {
        boxShadow: "0px 2px 4px rgba(0, 0, 0, 0.1)",
      },
      android: {
        elevation: 2,
      },
      default: {
        boxShadow: "0px 2px 4px rgba(0, 0, 0, 0.1)",
      },
    }),
  },
  recipientAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#f0f0f0",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 15,
  },
  recipientInfo: {
    flex: 1,
  },
  recipientName: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
  recipientPhone: {
    fontSize: 14,
    color: "#666",
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: "500",
    marginBottom: 8,
    color: "#333",
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    padding: 12,
    borderRadius: 8,
    fontSize: 16,
  },
  invalidInput: {
    borderColor: "#ff4444",
  },
  validInput: {
    borderColor: "#4CAF50",
  },
  verifyingIndicator: {
    marginTop: 8,
  },
  errorText: {
    color: "#ff4444",
    fontSize: 14,
    marginTop: 8,
  },
  proceedButton: {
    backgroundColor: "#004AAD",
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 20,
  },
  confirmButton: {
    backgroundColor: "#004AAD",
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
    marginHorizontal: 20,
    marginBottom: 20,
  },
  buttonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  disabledButton: {
    opacity: 0.5,
  },
  pinModalContainer: {
    flex: 1,
    justifyContent: "flex-end",
  },
  alertOverlay: {
    // position: "fixed",
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 9999,
  },
  alertContainer: {
    position: "relative",
    backgroundColor: "white",
    borderRadius: 12,
    padding: 20,
    width: 300,
    maxWidth: "90%",
    alignItems: "center",
  },
  alertTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 10,
    textAlign: "center",
  },
  alertMessage: {
    fontSize: 16,
    marginBottom: 20,
    textAlign: "center",
  },
  alertButton: {
    backgroundColor: "#2196F3",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 5,
    minWidth: 100,
    alignItems: "center",
  },
  alertButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
});
