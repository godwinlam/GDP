import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Image,
  ActivityIndicator,
} from "react-native";
import { MaterialIcons, Ionicons } from "@expo/vector-icons";
import {
  collection,
  doc,
  getDocs,
  updateDoc,
  addDoc,
  deleteDoc,
} from "firebase/firestore";

import { router } from "expo-router";
import { db } from "@/firebase";
import showAlert from "../CustomAlert/ShowAlert";

interface CryptoOption {
  id: string;
  network: string;
  address: string;
  imageName: string;
}

const availableImages: { [key: string]: any } = {
  bitcoin: require("../../assets/images/bitcoin.png"),
  eth: require("../../assets/images/ERC-20.jpg"),
  usdc: require("../../assets/images/USDC.png"),
  usdtTrc: require("../../assets/images/USDT-TRC20.png"),
};

const CryptoOptionsManagement = () => {
  const [cryptoOptions, setCryptoOptions] = useState<CryptoOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState<string | null>(null);
  const [newOption, setNewOption] = useState<Partial<CryptoOption>>({});
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string>("bitcoin");

  useEffect(() => {
    fetchCryptoOptions();
  }, []);

  const fetchCryptoOptions = async () => {
    try {
      const cryptoCollection = collection(db, "cryptoOptions");
      const cryptoSnapshot = await getDocs(cryptoCollection);
      const cryptoList = cryptoSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as CryptoOption[];
      setCryptoOptions(cryptoList);
      setLoading(false);
    } catch (error) {
      showAlert("Error", "Failed to fetch crypto options");
      setLoading(false);
    }
  };

  const handleSave = async (id: string) => {
    try {
      if (id === "new") {
        if (!newOption.network || !newOption.address) {
          showAlert("Error", "Please fill in all fields");
          return;
        }
        const newData = {
          network: newOption.network,
          address: newOption.address,
          imageName: selectedImage,
        };
        await addDoc(collection(db, "cryptoOptions"), newData);
        setIsAddingNew(false);
        setNewOption({});
      } else {
        const option = cryptoOptions.find((o) => o.id === id);
        if (!option) return;

        const docRef = doc(db, "cryptoOptions", id);
        const updateData = {
          network: option.network,
          address: option.address,
          imageName: option.imageName,
        };
        await updateDoc(docRef, updateData);
      }
      setEditMode(null);
      fetchCryptoOptions();
    } catch (error) {
      showAlert("Error", "Failed to save changes");
    }
  };

  const handleDelete = async (id: string) => {
    showAlert(
      "Confirm Delete",
      "Are you sure you want to delete this cryptocurrency option?",
      [
        { text: "Cancel" },
        {
          text: "Delete",

          onPress: async () => {
            try {
              await deleteDoc(doc(db, "cryptoOptions", id));
              fetchCryptoOptions();
            } catch (error) {
              showAlert("Error", "Failed to delete crypto option");
            }
          },
        },
      ]
    );
  };

  const renderImageSelector = (
    currentImageName: string,
    onSelect: (imageName: string) => void
  ) => (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.imageSelector}
      contentContainerStyle={styles.imageSelectorContent}
    >
      {Object.entries(availableImages).map(([key, value]) => (
        <TouchableOpacity
          key={key}
          style={[
            styles.imageSelectorItem,
            currentImageName === key && styles.selectedImage,
          ]}
          onPress={() => onSelect(key)}
        >
          <Image
            source={value}
            style={styles.selectorImage}
            resizeMode="contain"
          />
          <Text style={styles.imageSelectorLabel}>
            {key.charAt(0).toUpperCase() + key.slice(1)}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );

  const renderCryptoCard = (option: CryptoOption, isEditing: boolean) => (
    <View style={styles.cryptoCard}>
      <View style={styles.cardHeader}>
        <View style={styles.imageContainer}>
          <Image
            source={
              availableImages[option.imageName] || availableImages["bitcoin"]
            }
            style={styles.cryptoImage}
            resizeMode="contain"
          />
        </View>
        <View style={styles.headerContent}>
          {isEditing ? (
            <TextInput
              style={styles.input}
              value={option.network}
              onChangeText={(text) => {
                setCryptoOptions((prev) =>
                  prev.map((o) =>
                    o.id === option.id ? { ...o, network: text } : o
                  )
                );
              }}
              placeholder="Network Name"
              placeholderTextColor="#666"
            />
          ) : (
            <Text style={styles.networkText}>{option.network}</Text>
          )}
        </View>
      </View>

      <View style={styles.cardBody}>
        {isEditing ? (
          <>
            <TextInput
              style={[styles.input, styles.addressInput]}
              value={option.address}
              onChangeText={(text) => {
                setCryptoOptions((prev) =>
                  prev.map((o) =>
                    o.id === option.id ? { ...o, address: text } : o
                  )
                );
              }}
              placeholder="Wallet Address"
              placeholderTextColor="#666"
              multiline
            />
            {renderImageSelector(option.imageName, (imageName) => {
              setCryptoOptions((prev) =>
                prev.map((o) => (o.id === option.id ? { ...o, imageName } : o))
              );
            })}
          </>
        ) : (
          <Text style={styles.addressText}>{option.address}</Text>
        )}
      </View>

      <View style={styles.cardFooter}>
        {isEditing ? (
          <>
            <TouchableOpacity
              style={[styles.actionButton, styles.saveButton]}
              onPress={() => handleSave(option.id)}
            >
              <MaterialIcons name="check" size={20} color="#fff" />
              <Text style={styles.buttonText}>Save</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.cancelButton]}
              onPress={() => setEditMode(null)}
            >
              <MaterialIcons name="close" size={20} color="#fff" />
              <Text style={styles.buttonText}>Cancel</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TouchableOpacity
              style={[styles.actionButton, styles.editButton]}
              onPress={() => setEditMode(option.id)}
            >
              <MaterialIcons name="edit" size={20} color="#fff" />
              <Text style={styles.buttonText}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.deleteButton]}
              onPress={() => handleDelete(option.id)}
            >
              <MaterialIcons name="delete" size={20} color="#fff" />
              <Text style={styles.buttonText}>Delete</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );

  const renderAddNewForm = () => (
    <View style={styles.addNewContainer}>
      <View style={styles.formHeader}>
        <Text style={styles.formTitle}>Add New Crypto Option</Text>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={() => {
            setIsAddingNew(false);
            setNewOption({});
          }}
        >
          <MaterialIcons name="close" size={24} color="#666" />
        </TouchableOpacity>
      </View>

      <View style={styles.formContent}>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Network Name</Text>
          <TextInput
            style={styles.formInput}
            value={newOption.network}
            onChangeText={(text) =>
              setNewOption({ ...newOption, network: text })
            }
            placeholder="Enter network name"
            placeholderTextColor="#999"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Wallet Address</Text>
          <TextInput
            style={[styles.formInput, styles.addressInput]}
            value={newOption.address}
            onChangeText={(text) =>
              setNewOption({ ...newOption, address: text })
            }
            placeholder="Enter wallet address"
            placeholderTextColor="#999"
            multiline
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Select Crypto Icon</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.imageSelector}
          >
            {Object.entries(availableImages).map(([key, value]) => (
              <TouchableOpacity
                key={key}
                style={[
                  styles.imageSelectorItem,
                  selectedImage === key && styles.selectedImage,
                ]}
                onPress={() => setSelectedImage(key)}
              >
                <Image
                  source={value}
                  style={styles.selectorImage}
                  resizeMode="contain"
                />
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={styles.formActions}>
          <TouchableOpacity
            style={[styles.actionButton, styles.saveButton]}
            onPress={() => handleSave("new")}
          >
            <MaterialIcons name="check" size={20} color="#fff" />
            <Text style={styles.buttonText}>Save</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.push("/(tabs)")}
          >
            <Ionicons name="arrow-back" size={24} color="#000" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Crypto Options Management</Text>
        </View>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setIsAddingNew(true)}
        >
          <Ionicons name="add-circle-outline" size={24} color="#fff" />
          {/* <Text style={styles.addButtonText}>Add New</Text> */}
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollViewContent}
        showsVerticalScrollIndicator={false}
      >
        {isAddingNew && renderAddNewForm()}

        {cryptoOptions.map((option) => (
          <View key={option.id} style={styles.cryptoCard}>
            {renderCryptoCard(option, editMode === option.id)}
          </View>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
    paddingTop: 20,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#1a1a1a",
    marginLeft: 16,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    elevation: 2,
    boxShadow: "0px 1px 2px rgba(0, 0, 0, 0.1)",
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#2196F3",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    elevation: 2,
    boxShadow: "0px 2px 4px rgba(0, 0, 0, 0.1)",
  },
  addButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    padding: 16,
  },
  cryptoCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    boxShadow: "0px 2px 4px rgba(0, 0, 0, 0.1)",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  imageContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#f8f9fa",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  cryptoImage: {
    width: 32,
    height: 32,
  },
  headerContent: {
    flex: 1,
  },
  networkText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1a1a1a",
  },
  addressText: {
    fontSize: 14,
    color: "#666",
    marginTop: 8,
    backgroundColor: "#f8f9fa",
    padding: 12,
    borderRadius: 8,
    overflow: "hidden",
  },
  input: {
    backgroundColor: "#f8f9fa",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: "#1a1a1a",
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  addressInput: {
    marginTop: 8,
    minHeight: 80,
    textAlignVertical: "top",
  },
  cardBody: {
    marginBottom: 16,
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    elevation: 1,
    boxShadow: "0px 1px 2px rgba(0, 0, 0, 0.1)",
  },
  saveButton: {
    backgroundColor: "#4caf50",
  },
  editButton: {
    backgroundColor: "#2196F3",
  },
  deleteButton: {
    backgroundColor: "#f44336",
  },
  cancelButton: {
    backgroundColor: "#9e9e9e",
  },
  buttonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 4,
  },
  imageSelector: {
    flexDirection: "row",
    marginTop: 12,
    paddingBottom: 8,
  },
  imageSelectorContent: {
    paddingHorizontal: 4,
    alignItems: "center",
  },
  imageSelectorItem: {
    width: 70,
    height: 80,
    borderRadius: 8,
    marginRight: 12,
    padding: 8,
    backgroundColor: "#f5f5f5",
    borderWidth: 1,
    borderColor: "#e0e0e0",
    justifyContent: "center",
    alignItems: "center",
  },
  selectedImage: {
    borderColor: "#2196F3",
    borderWidth: 2,
    backgroundColor: "#e3f2fd",
  },
  selectorImage: {
    width: 40,
    height: 40,
    marginBottom: 4,
  },
  imageSelectorLabel: {
    fontSize: 12,
    color: "#666",
    textAlign: "center",
    marginTop: 4,
  },
  formActions: {
    marginTop: 24,
    alignItems: "flex-end",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  addNewContainer: {
    backgroundColor: "#fff",
    borderRadius: 12,
    margin: 16,
    elevation: 4,
    boxShadow: "0px 2px 4px rgba(0, 0, 0, 0.1)",
  },
  formHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  formTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
  },
  closeButton: {
    padding: 4,
  },
  formContent: {
    padding: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
    marginBottom: 8,
  },
  formInput: {
    backgroundColor: "#f5f5f5",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: "#333",
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
});

export default CryptoOptionsManagement;
