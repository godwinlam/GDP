import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from "react-native";
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  doc,
  runTransaction,
} from "firebase/firestore";
import { db, auth } from "@/firebase";
import { router } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import showAlert from "../CustomAlert/ShowAlert";

interface BankTransfer {
  id: string;
  fromUserId: string;
  amount: number;
  bankType: string;
  accountNumber: string;
  status: "pending" | "approved" | "rejected";
  timestamp: any;
  type: string;
  refundedBalance?: number;
}

export default function AdminTransferBankManagement() {
  const [transfers, setTransfers] = useState<BankTransfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      router.replace("/(auth)/login");
      return;
    }

    fetchPendingTransfers();
  }, []);

  const fetchPendingTransfers = async () => {
    try {
      const transfersRef = collection(db, "transactions");
      const q = query(
        transfersRef,
        where("type", "==", "bank_transfer"),
        where("status", "==", "pending"),
        orderBy("timestamp", "desc")
      );

      const querySnapshot = await getDocs(q);
      const transfersData = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as BankTransfer[];

      setTransfers(transfersData);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching transfers:", error);
      setError("Failed to fetch pending transfers");
      setLoading(false);
    }
  };

  const handleApproveTransfer = async (transfer: BankTransfer) => {
    if (processing) return;

    setProcessing(true);
    try {
      await runTransaction(db, async (transaction) => {
        const transferRef = doc(db, "transactions", transfer.id);

        // Update transfer status to approved
        transaction.update(transferRef, {
          status: "approved",
          updatedAt: new Date(),
        });
      });

      showAlert("Success", "Transfer approved successfully");
      fetchPendingTransfers(); // Refresh the list
    } catch (error: any) {
      showAlert("Error", error.message || "Failed to approve transfer");
    } finally {
      setProcessing(false);
    }
  };

  const handleRejectTransfer = async (transfer: BankTransfer) => {
    if (processing) return;

    setProcessing(true);
    try {
      await runTransaction(db, async (transaction) => {
        // Get user document
        const userRef = doc(db, "users", transfer.fromUserId);
        const userDoc = await transaction.get(userRef);

        if (!userDoc.exists()) {
          showAlert("error", "User not found");
          return;
        }

        // Refund the balance
        const userData = userDoc.data();
        const currentBalance = userData.balance || 0;
        const newBalance = currentBalance + transfer.amount;

        // Update user's balance
        transaction.update(userRef, { balance: newBalance });

        // Update transfer status
        const transferRef = doc(db, "transactions", transfer.id);
        transaction.update(transferRef, {
          status: "rejected",
          updatedAt: new Date(),
          refundedBalance: newBalance,
        });
      });

      showAlert(
        "Success",
        "Transfer rejected and balance refunded successfully"
      );
      fetchPendingTransfers(); // Refresh the list
    } catch (error: any) {
      showAlert("Error", error.message || "Failed to reject transfer");
    } finally {
      setProcessing(false);
    }
  };

  const renderTransferItem = ({ item }: { item: BankTransfer }) => (
    <View style={styles.transferItem}>
      <View style={styles.transferInfo}>
        <Text style={styles.bankInfo}>
          {item.bankType} - {item.accountNumber}
        </Text>
        <Text style={styles.amount}>Amount: ${item.amount.toFixed(2)}</Text>
        <Text style={styles.status}>Status: {item.status}</Text>
        {item.refundedBalance && (
          <Text style={styles.refundedBalance}>
            Refunded Balance: ${item.refundedBalance.toFixed(2)}
          </Text>
        )}
      </View>

      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={[styles.actionButton, styles.approveButton]}
          onPress={() => handleApproveTransfer(item)}
          disabled={processing}
        >
          <Text style={styles.buttonText}>Approve</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.rejectButton]}
          onPress={() => handleRejectTransfer(item)}
          disabled={processing}
        >
          <Text style={styles.buttonText}>Reject</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#0000ff" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Pending Bank Transfers</Text>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <MaterialIcons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
      </View>
      {/* <Text style={styles.title}>Pending Bank Transfers</Text> */}

      {transfers.length === 0 ? (
        <Text style={styles.noTransfers}>No pending transfers</Text>
      ) : (
        <FlatList
          data={transfers}
          renderItem={renderTransferItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
        />
      )}
    </View>
  );
}

const shadowStyle = Platform.select({
  ios: {
    boxShadow: "0px 2px 4px rgba(0, 0, 0, 0.1)",
  },
  android: {
    elevation: 2,
  },
  default: {
    boxShadow: "0px 2px 4px rgba(0, 0, 0, 0.1)",
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: "#f5f5f5",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
    textAlign: "center",
  },
  backButton: {
    position: "absolute",
    left: 16,
    zIndex: 1,
  },
  centered: {
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
    color: "#333",
  },
  listContainer: {
    paddingBottom: 20,
  },
  transferItem: {
    backgroundColor: "white",
    borderRadius: 10,
    padding: 15,
    marginBottom: 10,
    ...shadowStyle,
  },
  transferInfo: {
    marginBottom: 10,
  },
  bankInfo: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 5,
  },
  amount: {
    fontSize: 15,
    color: "#666",
    marginBottom: 5,
  },
  status: {
    fontSize: 14,
    color: "#888",
  },
  refundedBalance: {
    fontSize: 14,
    color: "#888",
  },
  actionButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
  },
  actionButton: {
    flex: 1,
    padding: 10,
    borderRadius: 5,
    marginHorizontal: 5,
    alignItems: "center",
    ...Platform.select({
      ios: {
        boxShadow: "0px 1px 3px rgba(0, 0, 0, 0.1)",
      },
      android: {
        elevation: 1,
      },
      default: {
        boxShadow: "0px 2px 4px rgba(0, 0, 0, 0.1)",
      },
    }),
  },
  approveButton: {
    backgroundColor: "#4CAF50",
  },
  rejectButton: {
    backgroundColor: "#f44336",
  },
  buttonText: {
    color: "white",
    fontWeight: "600",
  },
  errorText: {
    color: "#f44336",
    fontSize: 16,
    textAlign: "center",
  },
  noTransfers: {
    textAlign: "center",
    fontSize: 16,
    color: "#666",
    marginTop: 20,
  },
});
