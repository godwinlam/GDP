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

interface DepositRequest {
  id: string;
  userId: string;
  amount: number;
  cryptocurrency: string;
  network: string;
  walletAddress: string;
  status: "pending" | "approved" | "rejected";
  createdAt: Timestamp;
  username?: string;
}

export default function AdminTopUpManagement() {
  const [deposits, setDeposits] = useState<DepositRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchDeposits = async () => {
    try {
      setLoading(true);
      const depositsRef = collection(db, "depositRequests");
      const q = query(
        depositsRef,
        where("status", "==", "pending"),
        orderBy("createdAt", "desc")
      );

      try {
        const querySnapshot = await getDocs(q);
        const depositData: DepositRequest[] = [];
        // const userPromises: Promise<any>[] = [];

        querySnapshot.forEach((doc) => {
          const data = doc.data();
          depositData.push({
            id: doc.id,
            userId: data.userId,
            amount: data.amount,
            cryptocurrency: data.cryptocurrency,
            network: data.network,
            walletAddress: data.walletAddress,
            status: data.status,
            createdAt: data.createdAt,
            username: data.username,
          });
        });

        setDeposits(depositData);
      } catch (error: any) {
        if (error.code === "failed-precondition") {
          setError("Database index not set up. Please contact administrator.");
          console.error("Missing index error:", error.message);
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
      showAlert("Error", "Failed to fetch deposit requests");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDeposits();
  }, []);

  const handleApprove = async (deposit: DepositRequest) => {
    try {
      await runTransaction(db, async (transaction) => {
        const depositRef = doc(db, "depositRequests", deposit.id);
        const userRef = doc(db, "users", deposit.userId);

        const depositDoc = await transaction.get(depositRef);
        const userDoc = await transaction.get(userRef);

        if (!depositDoc.exists()) {
          showAlert("error", "Deposit request not found");
          return;
        }

        if (!userDoc.exists()) {
          showAlert("error", "User not found");
          return;
        }

        const depositData = depositDoc.data();
        const userData = userDoc.data();

        if (depositData.status !== "pending") {
          showAlert("error", "Deposit request is no longer pending");
          return;
        }

        const currentBalance = userData.balance || 0;

        // Prepare history record
        const historyRecord = {
          ...depositData,
          status: "approved",
          processedAt: new Date().toISOString(),
        };

        // Update deposit status
        transaction.update(depositRef, {
          status: "approved",
          processedAt: Timestamp.now(),
        });

        // Update user's balance and history
        transaction.update(userRef, {
          balance: currentBalance + deposit.amount,
          "history.deposits": [
            ...(userData.history?.deposits || []),
            historyRecord,
          ],
        });
      });

      showAlert("Success", "Deposit request approved and balance updated");
      fetchDeposits(); // Refresh the list
    } catch (err: any) {
      console.error("Approval error:", err);
      showAlert("Error", err.message || "Failed to approve deposit");
    }
  };

  const handleReject = async (deposit: DepositRequest) => {
    try {
      await runTransaction(db, async (transaction) => {
        const depositRef = doc(db, "depositRequests", deposit.id);
        const userRef = doc(db, "users", deposit.userId);

        const depositDoc = await transaction.get(depositRef);
        const userDoc = await transaction.get(userRef);

        if (!depositDoc.exists()) {
          showAlert("error", "Deposit request not found");
          return;
        }

        if (!userDoc.exists()) {
          showAlert("error", "User not found");
          return;
        }

        const depositData = depositDoc.data();
        const userData = userDoc.data();

        if (depositData.status !== "pending") {
          showAlert("error", "Deposit request is no longer pending");
          return;
        }

        // Prepare history record
        const historyRecord = {
          ...depositData,
          status: "rejected",
          processedAt: new Date().toISOString(),
        };

        // Update deposit status
        transaction.update(depositRef, {
          status: "rejected",
          processedAt: Timestamp.now(),
        });

        // Update user's history
        transaction.update(userRef, {
          "history.deposits": [
            ...(userData.history?.deposits || []),
            historyRecord,
          ],
        });
      });

      showAlert("Success", "Deposit request rejected");
      fetchDeposits(); // Refresh the list
    } catch (err: any) {
      console.error("Rejection error:", err);
      showAlert("Error", err.message || "Failed to reject deposit");
    }
  };

  const renderDepositItem = ({ item }: { item: DepositRequest }) => (
    <View style={styles.depositItem}>
      <View style={styles.depositHeader}>
        <Text style={styles.userName}>{item.username || "Unknown User"}</Text>
        <Text style={styles.amount}>${item.amount.toFixed(2)}</Text>
      </View>

      <View style={styles.depositDetails}>
        <Text style={styles.detailText}>
          Cryptocurrency: {item.cryptocurrency.toUpperCase()}
        </Text>
        <Text style={styles.detailText}>Network: {item.network}</Text>
        <Text style={styles.detailText} selectable={true}>
          Address: {item.walletAddress || "No address provided"}
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
              "Are you sure you want to approve this deposit?",
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
              "Are you sure you want to reject this deposit?",
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
        <TouchableOpacity style={styles.retryButton} onPress={fetchDeposits}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Top-Up Management</Text>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <MaterialIcons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
      </View>
      <FlatList
        data={deposits}
        renderItem={renderDepositItem}
        keyExtractor={(item) => item.id}
        refreshing={refreshing}
        onRefresh={() => {
          setRefreshing(true);
          fetchDeposits();
        }}
        ListEmptyComponent={() => (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No pending deposit requests</Text>
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
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  depositItem: {
    backgroundColor: "white",
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    boxShadow: "0px 2px 4px rgba(0, 0, 0, 0.1)",
  },
  depositHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  userName: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
  },
  amount: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#2196F3",
  },
  depositDetails: {
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
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 8,
    borderRadius: 4,
    flex: 0.48,
  },
  approveButton: {
    backgroundColor: "#4CAF50",
  },
  rejectButton: {
    backgroundColor: "#f44336",
  },
  buttonText: {
    color: "white",
    marginLeft: 4,
    fontSize: 14,
    fontWeight: "500",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  emptyText: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
  },
  errorText: {
    fontSize: 16,
    color: "#f44336",
    textAlign: "center",
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: "#2196F3",
    padding: 12,
    borderRadius: 4,
  },
  retryButtonText: {
    color: "white",
    fontSize: 14,
    fontWeight: "500",
  },
});
