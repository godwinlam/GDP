import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Image,
  TouchableOpacity,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { collection, query, where, getDocs, orderBy } from "firebase/firestore";
import { db } from "@/firebase";
import { useAuth } from "@/context/auth";
import { MaterialIcons } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system";
import * as MediaLibrary from "expo-media-library";
import showAlert from "../CustomAlert/ShowAlert";

interface PaymentDetails {
  id: string;
  listingId: string;
  sellerId: string;
  buyerId: string;
  sellerUsername: string;
  buyerUsername: string;
  gdpAmount: number;
  transactionType: string;
  status: string;
  paymentMethod: {
    type: "bank" | "ewallet";
    bankName?: string;
    provider?: string;
    accountNumber: string;
    accountName: string;
  };
  createdAt: any;
  proofOfPayment?: string;
  lastUpdated?: any;
  rejectionReason?: string;
  rejectedAt?: any;
  rejectedBy?: string;
}

export default function PaymentRejectControlScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rejectedPayments, setRejectedPayments] = useState<PaymentDetails[]>(
    []
  );
  const [downloading, setDownloading] = useState(false);
  const { user: currentUser } = useAuth();

  // Check admin role
  useEffect(() => {
    if (!currentUser?.role || currentUser.role !== "admin") {
      showAlert(
        "Unauthorized",
        "You do not have permission to access this page"
      );
      router.replace("/(tabs)");
    }
  }, [currentUser, router]);

  useEffect(() => {
    const fetchRejectedPayments = async () => {
      try {
        setLoading(true);
        if (!currentUser?.role || currentUser.role !== "admin") {
          showAlert("error", "Unauthorized access");
          return;
        }

        // Query for rejected payments
        const paymentsRef = collection(db, "paymentDetails");
        const q = query(
          paymentsRef,
          where("status", "==", "rejected"),
          orderBy("rejectedAt", "desc")
        );

        const querySnapshot = await getDocs(q);
        const payments = querySnapshot.docs.map((doc) => ({
          ...doc.data(),
          id: doc.id,
        })) as PaymentDetails[];

        setRejectedPayments(payments);
      } catch (err: any) {
        console.error("Error fetching rejected payments:", err);
        setError(err.message || "Failed to load rejected payments");
      } finally {
        setLoading(false);
      }
    };

    if (currentUser?.role === "admin") {
      fetchRejectedPayments();
    }
  }, [currentUser]);

  const handleDownloadImage = async (payment: PaymentDetails) => {
    if (!currentUser?.role || currentUser.role !== "admin") {
      showAlert(
        "Unauthorized",
        "You do not have permission to download images"
      );
      return;
    }

    if (!payment.proofOfPayment) {
      showAlert("Error", "No proof of payment image available");
      return;
    }

    try {
      // Request permission to save to photo gallery
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== "granted") {
        showAlert(
          "Permission needed",
          "Please grant permission to save photos"
        );
        return;
      }

      setDownloading(true);

      // Download the image
      const filename = `rejected_payment_${payment.id}_${Date.now()}.jpg`;
      const fileUri = `${FileSystem.documentDirectory}${filename}`;

      const downloadResumable = FileSystem.createDownloadResumable(
        payment.proofOfPayment,
        fileUri,
        {}
      );

      const downloadResult = await downloadResumable.downloadAsync();
      if (!downloadResult) {
        showAlert("error", "Failed to download image");
        return;
      }

      // Save to photo gallery
      const asset = await MediaLibrary.createAssetAsync(downloadResult.uri);
      await MediaLibrary.createAlbumAsync("Rejected Payments", asset, false);

      // Clean up the temporary file
      await FileSystem.deleteAsync(downloadResult.uri);

      showAlert("Success", "Image saved to photo gallery");
    } catch (error) {
      console.error("Error saving image:", error);
      showAlert("Error", "Failed to save image to gallery");
    } finally {
      setDownloading(false);
    }
  };

  // If not admin, don't render anything
  if (!currentUser?.role || currentUser.role !== "admin") {
    return null;
  }

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#4CAF50" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <MaterialIcons name="error" size={48} color="#f44336" />
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Rejected Payments</Text>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <MaterialIcons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView}>
        {rejectedPayments.length === 0 ? (
          <View style={styles.emptyContainer}>
            <MaterialIcons name="inbox" size={48} color="#9e9e9e" />
            <Text style={styles.emptyText}>No rejected payments found</Text>
          </View>
        ) : (
          rejectedPayments.map((payment) => (
            <View key={payment.id} style={styles.paymentCard}>
              <View style={styles.paymentHeader}>
                <MaterialIcons name="cancel" size={24} color="#f44336" />
                <Text style={styles.paymentId}>Payment ID: {payment.id}</Text>
              </View>

              <View style={styles.detailRow}>
                <Text style={styles.label}>Amount:</Text>
                <Text style={styles.value}>{payment.gdpAmount} GDP</Text>
              </View>

              <View style={styles.detailRow}>
                <Text style={styles.label}>Buyer:</Text>
                <Text style={styles.value}>{payment.buyerUsername}</Text>
              </View>

              <View style={styles.detailRow}>
                <Text style={styles.label}>Seller:</Text>
                <Text style={styles.value}>{payment.sellerUsername}</Text>
              </View>

              <View style={styles.detailRow}>
                <Text style={styles.label}>Rejected At:</Text>
                <Text style={styles.value}>
                  {payment.rejectedAt
                    ? new Date(
                        payment.rejectedAt.seconds * 1000
                      ).toLocaleString()
                    : "N/A"}
                </Text>
              </View>

              <View style={styles.detailRow}>
                <Text style={styles.label}>Rejected By:</Text>
                <Text style={styles.value}>
                  {payment.rejectedBy || "Unknown"}
                </Text>
              </View>

              <View style={styles.rejectionContainer}>
                <Text style={styles.rejectionLabel}>Rejection Reason:</Text>
                <Text style={styles.rejectionText}>
                  {payment.rejectionReason || "No reason provided"}
                </Text>
              </View>

              {payment.proofOfPayment && (
                <View style={styles.imageContainer}>
                  <Image
                    source={{ uri: payment.proofOfPayment }}
                    style={styles.proofImage}
                    resizeMode="contain"
                  />
                  <TouchableOpacity
                    style={[
                      styles.downloadButton,
                      downloading && styles.downloadingButton,
                    ]}
                    onPress={() => handleDownloadImage(payment)}
                    disabled={downloading}
                  >
                    {downloading ? (
                      <ActivityIndicator size="small" color="#2196F3" />
                    ) : (
                      <>
                        <MaterialIcons
                          name="file-download"
                          size={24}
                          color="#2196F3"
                        />
                        <Text style={styles.downloadButtonText}>
                          Save to Gallery
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ))
        )}
      </ScrollView>
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
  scrollView: {
    flex: 1,
    padding: 16,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  errorText: {
    marginTop: 8,
    color: "#f44336",
    textAlign: "center",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: "#9e9e9e",
    textAlign: "center",
  },
  paymentCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    ...Platform.select({
      ios: {
        boxShadow: "0px 2px 4px rgba(0, 0, 0, 0.1)",
      },
      android: {
        elevation: 3,
      },
      default: {
        boxShadow: "0px 2px 4px rgba(0, 0, 0, 0.1)",
      },
    }),
  },
  paymentHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  paymentId: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: "500",
    color: "#333",
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  label: {
    fontSize: 14,
    color: "#666",
  },
  value: {
    fontSize: 14,
    color: "#333",
    fontWeight: "500",
  },
  rejectionContainer: {
    marginTop: 16,
    padding: 12,
    backgroundColor: "#fff3f3",
    borderRadius: 8,
  },
  rejectionLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: "#f44336",
    marginBottom: 4,
  },
  rejectionText: {
    fontSize: 14,
    color: "#333",
  },
  imageContainer: {
    marginTop: 16,
    alignItems: "center",
  },
  proofImage: {
    width: "100%",
    height: 200,
    borderRadius: 8,
  },
  downloadButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 10,
    marginTop: 10,
    borderRadius: 8,
    backgroundColor: "#f5f5f5",
    ...Platform.select({
      ios: {
        boxShadow: "0px 1px 3px rgba(0, 0, 0, 0.1)",
      },
      android: {
        elevation: 1,
      },
      default: {
        boxShadow: "0px 1px 3px rgba(0, 0, 0, 0.1)",
      },
    }),
  },
  downloadingButton: {
    backgroundColor: "#e0e0e0",
  },
  downloadButtonText: {
    marginLeft: 8,
    fontSize: 16,
    color: "#2196F3",
    fontWeight: "500",
  },
});
