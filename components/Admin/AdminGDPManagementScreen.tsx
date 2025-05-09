import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  Button,
  Alert,
  TouchableOpacity,
  ScrollView,
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
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/firebase";
import { GDPOption, GDPPurchase } from "@/types/user";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import showAlert from "../CustomAlert/ShowAlert";

export default function AdminGDPManagementScreen() {
  const [gdpOptions, setGDPOptions] = useState<GDPOption[]>([]);
  const [newGDPAmount, setNewGDPAmount] = useState("");
  const [newGDPPrice, setNewGDPPrice] = useState("");
  const [editingGDPOption, setEditingGDPOption] = useState<GDPOption | null>(
    null
  );
  const [gdpPurchases, setGDPPurchases] = useState<GDPPurchase[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredGDPPurchases, setFilteredGDPPurchases] = useState<
    GDPPurchase[]
  >([]);
  const [selectedPreset, setSelectedPreset] = useState<string>("");
  const [selectedAnimation, setSelectedAnimation] =
    useState<string>("GDP-100.json");

  const predefinedGDPOptions = [
    { amount: 25, price: 25 },
    { amount: 100, price: 100 },
    { amount: 300, price: 300 },
    { amount: 1000, price: 1000 },
    { amount: 3000, price: 3000 },
    { amount: 10000, price: 10000 },
  ];

  const animationOptions = [
    { name: "GDP-25", file: "star-1.json" },
    { name: "GDP-100", file: "2-star.json" },
    { name: "GDP-300", file: "3-star.json" },
    { name: "GDP-1000", file: "4-star.json" },
    { name: "GDP-3000", file: "5-star.json" },
    { name: "GDP-10000", file: "Crown.json" },
  ];

  useEffect(() => {
    fetchGDPOptions();
    const unsubscribe = subscribeToGDPPurchases();
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const filtered = gdpPurchases.filter(
      (purchase) =>
        purchase.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
        purchase.userId.toLowerCase().includes(searchQuery.toLowerCase())
    );
    setFilteredGDPPurchases(filtered);
  }, [searchQuery, gdpPurchases]);

  const fetchGDPOptions = async () => {
    try {
      const gdpOptionsRef = collection(db, "gdpOptions");
      const q = query(gdpOptionsRef, orderBy("amount"));
      const querySnapshot = await getDocs(q);
      const fetchedOptions: GDPOption[] = [];
      querySnapshot.forEach((doc) => {
        fetchedOptions.push({ id: doc.id, ...doc.data() } as GDPOption);
      });
      setGDPOptions(fetchedOptions);
    } catch (error) {
      console.error("Error fetching GDP options:", error);
      showAlert("Error", "Failed to fetch GDP options");
    }
  };

  const subscribeToGDPPurchases = () => {
    const gdpPurchasesRef = collection(db, "gdpPurchases");
    const q = query(gdpPurchasesRef, orderBy("timestamp", "desc"));

    return onSnapshot(q, (querySnapshot) => {
      const fetchedPurchases: GDPPurchase[] = [];
      querySnapshot.forEach((doc) => {
        fetchedPurchases.push({
          id: doc.id,
          ...doc.data(),
        } as GDPPurchase);
      });
      setGDPPurchases(fetchedPurchases);
    });
  };

  const handleCreateGDPOption = async () => {
    if (!newGDPAmount || !newGDPPrice) {
      showAlert("Error", "Please fill in all GDP option fields");
      return;
    }

    try {
      const newOption = {
        amount: parseInt(newGDPAmount),
        price: parseFloat(newGDPPrice),
        animationFile: selectedAnimation,
        timestamp: serverTimestamp(),
      };

      await addDoc(collection(db, "gdpOptions"), newOption);
      showAlert("Success", "GDP option created successfully");
      fetchGDPOptions();
      setNewGDPAmount("");
      setNewGDPPrice("");
    } catch (error) {
      console.error("Error creating GDP option:", error);
      showAlert("Error", "Failed to create GDP option");
    }
  };

  const handleUpdateGDPOption = async () => {
    if (!editingGDPOption) return;

    try {
      const updatedOption = {
        amount: parseInt(newGDPAmount) || editingGDPOption.amount,
        price: parseFloat(newGDPPrice) || editingGDPOption.price,
      };

      await updateDoc(
        doc(db, "gdpOptions", editingGDPOption.id),
        updatedOption
      );
      showAlert("Success", "GDP option updated successfully");
      fetchGDPOptions();
      setEditingGDPOption(null);
      setNewGDPAmount("");
      setNewGDPPrice("");
    } catch (error) {
      console.error("Error updating GDP option:", error);
      showAlert("Error", "Failed to update GDP option");
    }
  };

  const handleDeleteGDPOption = async (optionId: string) => {
    try {
      await deleteDoc(doc(db, "gdpOptions", optionId));
      showAlert("Success", "GDP option deleted successfully");
      fetchGDPOptions();
    } catch (error) {
      console.error("Error deleting GDP option:", error);
      showAlert("Error", "Failed to delete GDP option");
    }
  };

  const handleDeleteGDPPurchase = async (purchaseId: string) => {
    try {
      await deleteDoc(doc(db, "gdpPurchases", purchaseId));
      showAlert("Success", "GDP purchase deleted successfully");
    } catch (error) {
      console.error("Error deleting GDP purchase:", error);
      showAlert("Error", "Failed to delete GDP purchase");
    }
  };

  const handlePresetSelection = (preset: string) => {
    setSelectedPreset(preset);
    const selectedOption = predefinedGDPOptions.find(
      (option) => option.amount === parseInt(preset)
    );
    if (selectedOption) {
      setNewGDPAmount(selectedOption.amount.toString());
      setNewGDPPrice(selectedOption.price.toString());
    }
  };

  const renderPresetSelection = () => (
    <View style={styles.presetContainer}>
      <Text style={styles.presetTitle}>Select Preset GDP Option:</Text>
      <View style={styles.presetButtonContainer}>
        {predefinedGDPOptions.map((option) => (
          <TouchableOpacity
            key={option.amount}
            style={[
              styles.presetButton,
              selectedPreset === option.amount.toString() &&
                styles.selectedPreset,
            ]}
            onPress={() => handlePresetSelection(option.amount.toString())}
          >
            <Text style={styles.presetButtonText}>
              {option.amount} GDP - ${option.price}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderAnimationSelection = () => (
    <View style={styles.animationContainer}>
      <Text style={styles.inputLabel}>Select Animation:</Text>
      <View style={styles.animationButtonContainer}>
        {animationOptions.map((animation) => (
          <TouchableOpacity
            key={animation.file}
            style={[
              styles.animationButton,
              selectedAnimation === animation.file && styles.selectedAnimation,
            ]}
            onPress={() => setSelectedAnimation(animation.file)}
          >
            <Ionicons
              name="play-circle-outline"
              size={24}
              color={selectedAnimation === animation.file ? "#2196F3" : "#666"}
            />
            <Text
              style={[
                styles.animationButtonText,
                selectedAnimation === animation.file &&
                  styles.selectedAnimationText,
              ]}
            >
              {animation.name}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderGDPOption = ({ item }: { item: GDPOption }) => (
    <View style={styles.gdpOptionItem}>
      <Text>Amount: {item.amount} GDP</Text>
      <Text>Price: ${item.price?.toFixed(2) ?? "N/A"}</Text>
      <View style={styles.gdpOptionActions}>
        <TouchableOpacity onPress={() => setEditingGDPOption(item)}>
          <Text style={styles.editButton}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => handleDeleteGDPOption(item.id)}>
          <Text style={styles.deleteBtn}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderGDPPurchase = ({ item }: { item: GDPPurchase }) => (
    <View style={styles.gdpPurchaseItem}>
      <Text>Username: {item.username}</Text>
      <Text>User ID: {item.userId}</Text>
      <Text>GDP: {item.gdpPurchased}</Text>
      <Text>Price: ${item.purchasePrice?.toFixed(2) ?? "N/A"}</Text>
      <Text>Date: {formatTimestamp(item.timestamp)}</Text>
      <Text>Reward Claimed: {item.rewardClaimed ? "Yes" : "No"}</Text>
      <Text>
        Total Reward Claimed: ${item.totalRewardClaimed?.toFixed(2) ?? "0.00"}
      </Text>
      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => handleDeleteGDPPurchase(item.id)}
      >
        <Text style={styles.deleteButtonText}>Delete</Text>
      </TouchableOpacity>
    </View>
  );

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
        style={styles.searchInput}
        placeholder="Search by username or user ID"
        value={searchQuery}
        onChangeText={setSearchQuery}
      />
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>GDP Management</Text>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <MaterialIcons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
      </View>
      <ScrollView style={styles.container}>
        {/* <Text style={styles.title}>GDP Management</Text> */}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>GDP Options</Text>

          {renderPresetSelection()}
          {renderAnimationSelection()}

          <Text style={styles.orText}>- OR -</Text>

          <Text style={styles.inputLabel}>Custom GDP Option:</Text>
          <TextInput
            style={styles.input}
            value={newGDPAmount}
            onChangeText={setNewGDPAmount}
            placeholder="GDP Amount"
            keyboardType="numeric"
          />
          <TextInput
            style={styles.input}
            value={newGDPPrice}
            onChangeText={setNewGDPPrice}
            placeholder="GDP Price"
            keyboardType="numeric"
          />

          {editingGDPOption ? (
            <Button title="Update GDP Option" onPress={handleUpdateGDPOption} />
          ) : (
            <Button title="Create GDP Option" onPress={handleCreateGDPOption} />
          )}
          <FlatList
            data={gdpOptions}
            renderItem={renderGDPOption}
            keyExtractor={(item) => item.id}
            nestedScrollEnabled={true}
            scrollEnabled={false}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>GDP Purchases</Text>
          {renderSearchBar()}
          <FlatList
            data={filteredGDPPurchases}
            renderItem={renderGDPPurchase}
            keyExtractor={(item) => item.id}
            nestedScrollEnabled={true}
            scrollEnabled={false}
          />
        </View>
      </ScrollView>
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
  gdpOptionItem: {
    backgroundColor: "#f0f0f0",
    padding: 10,
    marginBottom: 10,
    borderRadius: 5,
  },
  gdpOptionActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 5,
  },
  editButton: {
    color: "blue",
    marginRight: 10,
  },
  deleteBtn: {
    color: "red",
  },
  gdpPurchaseItem: {
    backgroundColor: "#f0f0f0",
    padding: 10,
    marginBottom: 10,
    borderRadius: 5,
  },
  deleteButton: {
    backgroundColor: "#f44336",
    padding: 5,
    borderRadius: 5,
    marginTop: 5,
    alignSelf: "flex-start",
  },
  deleteButtonText: {
    color: "white",
    fontWeight: "bold",
  },
  searchContainer: {
    marginBottom: 10,
  },
  searchInput: {
    height: 40,
    borderColor: "gray",
    borderWidth: 1,
    borderRadius: 5,
    paddingHorizontal: 10,
  },
  presetContainer: {
    marginBottom: 20,
  },
  presetTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 10,
  },
  presetButtonContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    justifyContent: "center",
  },
  presetButton: {
    backgroundColor: "#f0f0f0",
    padding: 10,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: "#ddd",
    minWidth: 150,
  },
  selectedPreset: {
    backgroundColor: "#e3f2fd",
    borderColor: "#2196F3",
  },
  presetButtonText: {
    textAlign: "center",
    fontSize: 14,
    color: "#333",
  },
  orText: {
    textAlign: "center",
    fontSize: 16,
    fontWeight: "bold",
    marginVertical: 15,
    color: "#666",
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 5,
  },
  animationContainer: {
    marginTop: 20,
    marginBottom: 20,
  },
  animationButtonContainer: {
    flexDirection: "column",
    gap: 10,
  },
  animationButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f0f0f0",
    padding: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  selectedAnimation: {
    backgroundColor: "#e3f2fd",
    borderColor: "#2196F3",
  },
  animationButtonText: {
    marginLeft: 10,
    fontSize: 16,
    color: "#666",
  },
  selectedAnimationText: {
    color: "#2196F3",
    fontWeight: "bold",
  },
});
