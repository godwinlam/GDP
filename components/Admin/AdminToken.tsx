import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Image,
  Platform,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  setDoc,
} from "firebase/firestore";
import { db } from "@/firebase";
import showAlert from "../CustomAlert/ShowAlert";

interface Token {
  id: string;
  name: string;
  // image: string | any;
  price: number;
}

export default function AdminToken() {
  const [tokens, setTokens] = useState<Token[]>([]);
  const [isEditing, setIsEditing] = useState<Record<string, boolean>>({});
  const [editedPrices, setEditedPrices] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchTokens();
  }, []);

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

        await setDoc(doc(db, "tokens", defaultToken.id), defaultToken);
        setTokens([defaultToken]);
      } else {
        const fetchedTokens = snapshot.docs.map((doc) => ({
          ...doc.data(),
          id: doc.id,
        })) as Token[];
        setTokens(fetchedTokens);
      }
    } catch (error) {
      console.error("Error fetching tokens:", error);
      showAlert("Error", "Failed to fetch tokens");
    }
  };

  const handleEditPrice = (token: Token) => {
    setIsEditing((prev) => ({ ...prev, [token.id]: true }));
    setEditedPrices((prev) => ({
      ...prev,
      [token.id]: token.price.toFixed(3),
    }));
  };

  const handleSavePrice = async (token: Token) => {
    try {
      const newPrice = parseFloat(editedPrices[token.id]);
      if (isNaN(newPrice) || newPrice <= 0) {
        showAlert("Error", "Please enter a valid price");
        return;
      }

      const tokenRef = doc(db, "tokens", token.id);
      await updateDoc(tokenRef, { price: newPrice });

      setTokens((prev) =>
        prev.map((t) => (t.id === token.id ? { ...t, price: newPrice } : t))
      );
      setIsEditing((prev) => ({ ...prev, [token.id]: false }));
      showAlert("Success", "Token price updated successfully");
    } catch (error) {
      console.error("Error updating token price:", error);
      showAlert("Error", "Failed to update token price");
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Token Management</Text>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <MaterialIcons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
      </View>

      {tokens.map((token) => (
        <View key={token.id} style={styles.tokenCard}>
          <View style={styles.tokenInfo}>
            <Image
              source={require("@/assets/images/GDPCoin01.png")}
              style={styles.tokenImage}
              resizeMode="contain"
            />
            <Text style={styles.tokenName}>{token.name}</Text>
          </View>

          <View style={styles.priceContainer}>
            {isEditing[token.id] ? (
              <>
                <TextInput
                  style={styles.priceInput}
                  value={editedPrices[token.id]}
                  onChangeText={(text) =>
                    setEditedPrices((prev) => ({ ...prev, [token.id]: text }))
                  }
                  keyboardType="decimal-pad"
                  placeholder="Enter price"
                />
                <TouchableOpacity
                  style={[styles.button, styles.saveButton]}
                  onPress={() => handleSavePrice(token)}
                >
                  <Text style={styles.buttonText}>Save</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.priceText}>${token.price}</Text>
                <TouchableOpacity
                  style={[styles.button, styles.editButton]}
                  onPress={() => handleEditPrice(token)}
                >
                  <Text style={styles.buttonText}>Edit</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  tokenCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 16,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 8,
    ...Platform.select({
      ios: {
        boxShadow: "0px 2px 8px rgba(0, 0, 0, 0.1)",
      },
      android: {
        elevation: 2,
      },
      default: {
        boxShadow: "0px 2px 8px rgba(0, 0, 0, 0.1)",
      },
    }),
  },
  tokenInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  tokenImage: {
    width: 40,
    height: 45,
    marginRight: 12,
    borderRadius: 18,
    backgroundColor: "blue",
  },
  tokenName: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
  },
  priceContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  priceText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
    marginRight: 12,
  },
  priceInput: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 4,
    padding: 8,
    width: 100,
    marginRight: 8,
  },
  button: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 4,
  },
  editButton: {
    backgroundColor: "#2196F3",
  },
  saveButton: {
    backgroundColor: "#4CAF50",
  },
  buttonText: {
    color: "#fff",
    fontWeight: "600",
  },
});
