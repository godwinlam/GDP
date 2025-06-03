import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Modal,
  SafeAreaView,
} from "react-native";
import {
  collection,
  query,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  orderBy,
  Timestamp,
  FieldValue,
  getDoc,
  onSnapshot,
  runTransaction,
} from "firebase/firestore";
import { db } from "../../firebase";
import { ShareOption, SharePurchase } from "@/types/user";
import { useReward } from "@/context/RewardContext";
import { router } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import showAlert from "../CustomAlert/ShowAlert";

export default function AdminInvestmentManagement() {
  const [shareOptions, setShareOptions] = useState<ShareOption[]>([]);
  const [newShareAmount, setNewShareAmount] = useState("");
  const [newSharePrice, setNewSharePrice] = useState("");
  const [editingShareOption, setEditingShareOption] =
    useState<ShareOption | null>(null);
  const [investments, setInvestments] = useState<SharePurchase[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredInvestments, setFilteredInvestments] = useState<
    SharePurchase[]
  >([]);
  const [isInvestmentsModalVisible, setIsInvestmentsModalVisible] =
    useState(false);

  const { rewardSettings } = useReward();

  // Add this constant with a default value
  const investmentTerm = rewardSettings.investmentTerm || 0; // Default to 30 days if undefined

  useEffect(() => {
    fetchShareOptions();
    const unsubscribe = subscribeToInvestments();
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const filtered = investments.filter(
      (investment) =>
        investment.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
        investment.userId.toLowerCase().includes(searchQuery.toLowerCase())
    );
    setFilteredInvestments(filtered);
  }, [searchQuery, investments]);

  const fetchShareOptions = async () => {
    try {
      const shareOptionsRef = collection(db, "shareOptions");
      const q = query(shareOptionsRef, orderBy("amount"));
      const querySnapshot = await getDocs(q);
      const fetchedOptions: ShareOption[] = [];
      querySnapshot.forEach((doc) => {
        fetchedOptions.push({ id: doc.id, ...doc.data() } as ShareOption);
      });
      setShareOptions(fetchedOptions);
    } catch (error) {
      console.error("Error fetching share options:", error);
      showAlert("Error", "Failed to fetch share options");
    }
  };

  const subscribeToInvestments = () => {
    const investmentsRef = collection(db, "sharePurchases");
    const q = query(investmentsRef, orderBy("timestamp", "desc"));

    return onSnapshot(q, async (querySnapshot) => {
      const fetchedInvestments: SharePurchase[] = [];
      for (const docSnapshot of querySnapshot.docs) {
        const data = docSnapshot.data() as Omit<SharePurchase, "id">;
        const userDocRef = doc(db, "users", data.userId);
        const userDocSnap = await getDoc(userDocRef);
        const username = userDocSnap.exists()
          ? userDocSnap.data().username
          : "Unknown";
        fetchedInvestments.push({
          id: docSnapshot.id,
          ...data,
          username,
        });
      }
      setInvestments(fetchedInvestments);
    });
  };

  const handleCreateShareOption = async () => {
    if (!newShareAmount || !newSharePrice) {
      showAlert("Error", "Please fill in all share option fields");
      return;
    }

    try {
      const newOption = {
        amount: parseInt(newShareAmount),
        price: parseInt(newSharePrice),
      };

      await addDoc(collection(db, "shareOptions"), newOption);
      showAlert("Success", "Share option created successfully");
      fetchShareOptions();
      setNewShareAmount("");
      setNewSharePrice("");
    } catch (error) {
      console.error("Error creating share option:", error);
      showAlert("Error", "Failed to create share option");
    }
  };

  const handleUpdateShareOption = async () => {
    if (!editingShareOption) return;

    try {
      const updatedOption = {
        amount: parseInt(newShareAmount) || editingShareOption.amount,
        price: parseInt(newSharePrice) || editingShareOption.price,
      };

      await updateDoc(
        doc(db, "shareOptions", editingShareOption.id),
        updatedOption
      );
      showAlert("Success", "Share option updated successfully");
      fetchShareOptions();
      setEditingShareOption(null);
      setNewShareAmount("");
      setNewSharePrice("");
    } catch (error) {
      console.error("Error updating share option:", error);
      showAlert("Error", "Failed to update share option");
    }
  };

  const handleDeleteShareOption = async (optionId: string) => {
    try {
      await deleteDoc(doc(db, "shareOptions", optionId));
      showAlert("Success", "Share option deleted successfully");
      fetchShareOptions();
    } catch (error) {
      console.error("Error deleting share option:", error);
      showAlert("Error", "Failed to delete share option");
    }
  };

  const handleDeleteInvestment = async (investmentId: string) => {
    try {
      await runTransaction(db, async (transaction) => {
        const investmentRef = doc(db, "sharePurchases", investmentId);
        const investmentDoc = await transaction.get(investmentRef);

        if (!investmentDoc.exists()) {
          showAlert("error", "Investment document does not exist!");
          return;
        }

        const investmentData = investmentDoc.data() as SharePurchase;
        const userRef = doc(db, "users", investmentData.userId);
        const userDoc = await transaction.get(userRef);

        if (!userDoc.exists()) {
          showAlert("error", "User document does not exist!");
          return;
        }

        const userData = userDoc.data();

        // Update user's tokens and shares
        const newTokens = (userData.token || 0) + investmentData.tokensPaid;
        const newShares =
          (userData.shares || 0) - investmentData.sharesPurchased;

        transaction.update(userRef, {
          token: newTokens,
          shares: newShares,
        });

        // Delete the investment document
        transaction.delete(investmentRef);
      });

      showAlert(
        "Success",
        "Investment deleted and user data updated successfully"
      );
    } catch (error) {
      console.error("Error deleting investment:", error);
      showAlert("Error", "Failed to delete investment and update user data");
    }
  };

  const renderShareOption = ({ item }: { item: ShareOption }) => (
    <View style={styles.optionItem}>
      <View style={styles.optionInfo}>
        <Text style={styles.optionText}>
          {item.amount} Shares - {item.price} Tokens
        </Text>
      </View>
      <View style={styles.optionButtons}>
        <TouchableOpacity
          style={[styles.button, styles.editButton]}
          onPress={() => {
            setEditingShareOption(item);
            setNewShareAmount(item.amount.toString());
            setNewSharePrice(item.price.toString());
          }}
        >
          <Text style={styles.buttonText}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, styles.deleteButton]}
          onPress={() => handleDeleteShareOption(item.id)}
        >
          <Text style={styles.buttonText}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const calculateProgress = (purchase: SharePurchase) => {
    if (!(purchase.timestamp instanceof Timestamp)) {
      return 0;
    }
    const purchaseDate = purchase.timestamp.toDate();
    const currentDate = new Date();
    const daysSincePurchase =
      (currentDate.getTime() - purchaseDate.getTime()) / (1000 * 3600 * 24);
    return Math.min(daysSincePurchase / investmentTerm, 1);
  };

  const renderInvestment = ({ item }: { item: SharePurchase }) => {
    const progress = calculateProgress(item);

    return (
      <View style={styles.investmentItem}>
        <Text>Username: {item.username}</Text>
        <Text>User ID: {item.userId}</Text>
        <Text>Shares: {item.sharesPurchased}</Text>
        <Text>Tokens Paid: {item.tokensPaid}</Text>
        <Text>Date: {formatTimestamp(item.timestamp)}</Text>
        <Text>Reward Claimed: {item.rewardClaimed ? "Yes" : "No"}</Text>
        <Text style={styles.totalRewardClaimed}>
          Total Reward Claimed: {(item.totalRewardClaimed || 0).toFixed(2)}
        </Text>
        <View style={styles.progressBarContainer}>
          <View style={[styles.progressBar, { width: `${progress * 100}%` }]} />
        </View>
        <Text>Progress: {(progress * 100).toFixed(0)}%</Text>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => handleDeleteInvestment(item.id)}
        >
          <Text style={styles.deleteButtonText}>Delete</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const formatTimestamp = (timestamp: Timestamp | FieldValue): string => {
    if (timestamp instanceof Timestamp) {
      return timestamp.toDate().toLocaleString();
    } else {
      return "Date not available";
    }
  };

  const renderSearchBar = () => (
    <View style={styles.searchContainer}>
      <TextInput
        style={styles.input}
        placeholder="Search by username or user ID"
        value={searchQuery}
        onChangeText={setSearchQuery}
      />
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Staking Management</Text>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <MaterialIcons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Create Share Option</Text>
        <TextInput
          style={styles.input}
          placeholder="Share Amount"
          value={newShareAmount}
          onChangeText={setNewShareAmount}
          keyboardType="numeric"
        />
        <TextInput
          style={styles.input}
          placeholder="Token Cost"
          value={newSharePrice}
          onChangeText={setNewSharePrice}
          keyboardType="numeric"
        />
        {editingShareOption ? (
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, styles.updateButton]}
              onPress={handleUpdateShareOption}
            >
              <Text style={styles.buttonText}>Update Option</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={() => {
                setEditingShareOption(null);
                setNewShareAmount("");
                setNewSharePrice("");
              }}
            >
              <Text style={styles.buttonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.button, styles.createButton]}
            onPress={handleCreateShareOption}
          >
            <Text style={styles.buttonText}>Create Option</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Share Options</Text>
        <ScrollView style={styles.shareOptionsScroll}>
          <FlatList
            data={shareOptions}
            keyExtractor={(item) => item.id}
            renderItem={renderShareOption}
            scrollEnabled={false}
            nestedScrollEnabled={true}
          />
        </ScrollView>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Investments</Text>
        <TouchableOpacity
          style={[styles.button, styles.viewButton]}
          onPress={() => setIsInvestmentsModalVisible(true)}
        >
          <Text style={styles.buttonText}>View Investments</Text>
        </TouchableOpacity>
      </View>

      <Modal
        visible={isInvestmentsModalVisible}
        animationType="slide"
        onRequestClose={() => setIsInvestmentsModalVisible(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Investments</Text>
            <TouchableOpacity
              style={[styles.button, styles.closeButton]}
              onPress={() => setIsInvestmentsModalVisible(false)}
            >
              <Text style={styles.buttonText}>Close</Text>
            </TouchableOpacity>
          </View>

          {renderSearchBar()}

          <ScrollView style={styles.modalScrollView}>
            <FlatList
              data={filteredInvestments}
              renderItem={renderInvestment}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
              nestedScrollEnabled={true}
            />
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
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
    marginBottom: 20,
    textAlign: "center",
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 10,
  },
  input: {
    height: 40,
    borderColor: "gray",
    borderWidth: 1,
    marginBottom: 10,
    paddingHorizontal: 10,
  },
  optionItem: {
    backgroundColor: "#f0f0f0",
    padding: 10,
    marginBottom: 10,
    borderRadius: 5,
  },
  optionInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  optionText: {
    fontSize: 16,
  },
  optionButtons: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 5,
  },
  button: {
    padding: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  editButton: {
    backgroundColor: "#4CAF50",
  },
  deleteButton: {
    backgroundColor: "#f44336",
    padding: 5,
    borderRadius: 5,
    marginTop: 5,
    alignSelf: "flex-start",
  },
  buttonText: {
    color: "white",
    fontSize: 16,
  },
  investmentItem: {
    backgroundColor: "#f0f0f0",
    padding: 10,
    marginBottom: 10,
    borderRadius: 5,
  },
  progressBarContainer: {
    height: 10,
    backgroundColor: "#e0e0e0",
    borderRadius: 5,
    marginTop: 5,
    marginBottom: 5,
  },
  progressBar: {
    height: "100%",
    backgroundColor: "#4CAF50",
    borderRadius: 5,
  },
  deleteButtonText: {
    color: "white",
    fontWeight: "bold",
  },
  searchContainer: {
    marginBottom: 10,
  },
  totalRewardClaimed: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#4CAF50",
    marginTop: 5,
  },
  buttonContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  updateButton: {
    backgroundColor: "#4CAF50",
  },
  cancelButton: {
    backgroundColor: "#f44336",
  },
  createButton: {
    backgroundColor: "#4CAF50",
  },
  investmentList: {
    maxHeight: 300,
  },
  shareOptionsScroll: {
    maxHeight: 200,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: "#fff",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: "bold",
  },
  modalScrollView: {
    flex: 1,
    padding: 20,
  },
  viewButton: {
    backgroundColor: "#2196F3",
    alignSelf: "flex-start",
  },
  closeButton: {
    backgroundColor: "#757575",
    paddingHorizontal: 15,
  },
});
