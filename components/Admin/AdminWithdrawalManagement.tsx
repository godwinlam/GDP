import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { MaterialCommunityIcons, MaterialIcons } from "@expo/vector-icons";
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  doc,
  runTransaction,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/firebase";
import { router } from "expo-router";
import showAlert from "../CustomAlert/ShowAlert";

interface WithdrawalRequest {
  id: string;
  userId: string;
  amount: number;
  originalAmount: number;
  blockchain: string;
  address: string;
  status: "pending" | "approved" | "rejected";
  createdAt: Timestamp;
  currency: string;
  userName?: string;
  deductionPercentage?: number;
}

export default function AdminWithdrawalManagement() {
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchWithdrawals = async () => {
    try {
      setLoading(true);
      const withdrawalsRef = collection(db, "withdrawals");
      const q = query(
        withdrawalsRef,
        where("status", "==", "pending"),
        orderBy("createdAt", "desc")
      );

      try {
        const querySnapshot = await getDocs(q);
        const withdrawalData: WithdrawalRequest[] = [];
        const userPromises: Promise<any>[] = [];

        querySnapshot.forEach((doc) => {
          const data = doc.data();
          withdrawalData.push({
            id: doc.id,
            userId: data.userId,
            userName: data.username,
            originalAmount: data.originalAmount,
            amount: data.finalAmount,
            deductionPercentage: data.deductionPercentage,
            blockchain: data.blockchain,
            address: data.address,
            status: data.status,
            createdAt: data.createdAt,
            currency: data.currency,
          });

          // Fetch user details
          userPromises.push(
            getDocs(
              query(collection(db, "users"), where("uid", "==", data.userId))
            )
          );
        });

        const userSnapshots = await Promise.all(userPromises);

        // Add user names to withdrawal data
        withdrawalData.forEach((withdrawal, index) => {
          const userDocs = userSnapshots[index].docs;
          if (userDocs.length > 0) {
            const userData = userDocs[0].data();
            withdrawal.userName =
              userData.displayName || userData.username || "Unknown User";
          }
        });

        setWithdrawals(withdrawalData);
      } catch (error: any) {
        if (error.code === "failed-precondition") {
          // This is the error code for missing index
          setError("Database index not set up. Please contact administrator.");
          console.error("Missing index error:", error.message);
          // You can also show the index creation URL from the error message
          console.log(
            "Index creation URL:",
            error.message.match(
              /https:\/\/console\.firebase\.google\.com\/.*$/
            )?.[0]
          );
        } else {
          throw error;
        }
      }
    } catch (err: any) {
      setError(err.message);
      showAlert("Error", "Failed to fetch withdrawal requests");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchWithdrawals();
  }, []);

  const handleApprove = async (withdrawal: WithdrawalRequest) => {
    try {
      await runTransaction(db, async (transaction) => {
        // First, get all the documents we'll need
        const withdrawalRef = doc(db, "withdrawals", withdrawal.id);
        const userRef = doc(db, "users", withdrawal.userId);

        // Get the documents
        const withdrawalDoc = await transaction.get(withdrawalRef);
        const userDoc = await transaction.get(userRef);

        if (!withdrawalDoc.exists()) {
          showAlert("error", "Withdrawal request not found");
          return;
        }

        if (!userDoc.exists()) {
          showAlert("error", "User not found");
          return;
        }

        // Get current data
        const withdrawalData = withdrawalDoc.data();
        const userData = userDoc.data();

        // Verify withdrawal is still pending
        if (withdrawalData.status !== "pending") {
          showAlert("error", "Withdrawal request is no longer pending");
          return;
        }

        // Prepare history record
        const historyRecord = {
          ...withdrawalData,
          status: "approved",
          processedAt: new Date().toISOString(),
        };

        // Update withdrawal status
        transaction.update(withdrawalRef, {
          status: "approved",
          processedAt: Timestamp.now(),
        });

        // Update user's withdrawal history
        const withdrawalHistory = userData.history?.withdrawals || [];
        transaction.update(userRef, {
          "history.withdrawals": [...withdrawalHistory, historyRecord],
        });
      });

      showAlert("Success", "Withdrawal request approved");
      fetchWithdrawals(); // Refresh the list
    } catch (err: any) {
      console.error("Approval error:", err);
      showAlert("Error", err.message || "Failed to approve withdrawal");
    }
  };

  const handleReject = async (withdrawal: WithdrawalRequest) => {
    try {
      await runTransaction(db, async (transaction) => {
        // First, get all the documents we'll need
        const withdrawalRef = doc(db, "withdrawals", withdrawal.id);
        const userRef = doc(db, "users", withdrawal.userId);

        // Get the documents
        const withdrawalDoc = await transaction.get(withdrawalRef);
        const userDoc = await transaction.get(userRef);

        if (!withdrawalDoc.exists()) {
          showAlert("error", "Withdrawal request not found");
          return;
        }

        if (!userDoc.exists()) {
          showAlert("error", "User not found");
          return;
        }

        // Get current data
        const withdrawalData = withdrawalDoc.data();
        const userData = userDoc.data();

        // Verify withdrawal is still pending
        if (withdrawalData.status !== "pending") {
          showAlert("error", "Withdrawal request is no longer pending");
          return;
        }

        const currentBalance = userData.balance || 0;

        // Prepare history record
        const historyRecord = {
          ...withdrawalData,
          status: "rejected",
          processedAt: new Date().toISOString(),
          refundedAmount: withdrawal.originalAmount,
        };

        // Update withdrawal status
        transaction.update(withdrawalRef, {
          status: "rejected",
          processedAt: Timestamp.now(),
        });

        // Update user's balance and history
        transaction.update(userRef, {
          balance: currentBalance + withdrawal.originalAmount,
          "history.withdrawals": [
            ...(userData.history?.withdrawals || []),
            historyRecord,
          ],
        });
      });

      showAlert("Success", "Withdrawal request rejected and amount refunded");
      fetchWithdrawals(); // Refresh the list
    } catch (err: any) {
      console.error("Rejection error:", err);
      showAlert("Error", err.message || "Failed to reject withdrawal");
    }
  };

  const renderWithdrawalItem = ({ item }: { item: WithdrawalRequest }) => (
    <View style={styles.withdrawalItem}>
      <View style={styles.withdrawalHeader}>
        <Text style={styles.userName}>{item.userName || "Unknown User"}</Text>
        <View>
          <Text style={styles.amount}>
            ${item.amount.toFixed(2)} {item.currency}
          </Text>
          <Text style={styles.amount}>
            ${item.originalAmount.toFixed(2)} - {item.deductionPercentage}
          </Text>
        </View>
      </View>

      <View style={styles.withdrawalDetails}>
        <Text style={styles.detailText}>Blockchain: {item.blockchain}</Text>
        <Text style={styles.detailText} numberOfLines={1}>
          Address: {item.address}
        </Text>
        <Text style={styles.detailText}>
          Date: {item.createdAt.toDate().toLocaleDateString()}
        </Text>
      </View>

      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={[styles.actionButton, styles.approveButton]}
          onPress={() => {
            showAlert(
              "Confirm Approval",
              "Are you sure you want to approve this withdrawal?",
              [
                { text: "Cancel" },
                { text: "Approve", onPress: () => handleApprove(item) },
              ]
            );
          }}
        >
          <MaterialCommunityIcons name="check" size={20} color="white" />
          <Text style={styles.buttonText}>Approve</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.rejectButton]}
          onPress={() => {
            showAlert(
              "Confirm Rejection",
              "Are you sure you want to reject this withdrawal? The amount will be refunded to the user.",
              [
                { text: "Cancel" },
                { text: "Reject", onPress: () => handleReject(item) },
              ]
            );
          }}
        >
          <MaterialCommunityIcons name="close" size={20} color="white" />
          <Text style={styles.buttonText}>Reject</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading && !refreshing) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#0000ff" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={fetchWithdrawals}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Withdrawal Requests</Text>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <MaterialIcons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
      </View>
      {/* <Text style={styles.title}>Withdrawal Requests</Text> */}
      <FlatList
        data={withdrawals}
        renderItem={renderWithdrawalItem}
        keyExtractor={(item) => item.id}
        refreshing={refreshing}
        onRefresh={() => {
          setRefreshing(true);
          fetchWithdrawals();
        }}
        ListEmptyComponent={() => (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No pending withdrawal requests</Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
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
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 16,
    color: "#333",
  },
  withdrawalItem: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    boxShadow: "0px 2px 4px rgba(0, 0, 0, 0.1)",
  },
  withdrawalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  userName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  amount: {
    fontSize: 16,
    fontWeight: "700",
    color: "#2196F3",
  },
  withdrawalDetails: {
    marginBottom: 12,
  },
  detailText: {
    fontSize: 14,
    color: "#666",
    marginBottom: 4,
  },
  actionButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 10,
    borderRadius: 8,
    marginHorizontal: 4,
  },
  approveButton: {
    backgroundColor: "#4CAF50",
  },
  rejectButton: {
    backgroundColor: "#F44336",
  },
  buttonText: {
    color: "white",
    marginLeft: 4,
    fontWeight: "600",
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  errorText: {
    color: "#F44336",
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: "#2196F3",
    padding: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: "white",
    fontWeight: "600",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 32,
  },
  emptyText: {
    fontSize: 16,
    color: "#666",
  },
});
