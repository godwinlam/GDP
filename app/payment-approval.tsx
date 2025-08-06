import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView, TouchableOpacity, Image, Alert, TextInput, Modal, Button } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { collection, doc, getDoc, updateDoc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db } from '@/firebase';
import { useAuth } from '@/context/auth';
import { MaterialIcons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import showAlert from '@/components/CustomAlert/ShowAlert';
import { useLanguage } from '@/hooks/useLanguage';

interface PaymentDetails {
  id: string;
  listingId: string;
  sellerId: string;
  buyerId: string;
  sellerUsername: string;
  buyerUsername: string;
  gdpAmount: number;
  sellingPrice: number;
  transactionType: string;
  status: string;
  paymentMethod: {
    type: 'bank' | 'ewallet';
    bankName?: string;
    provider?: string;
    accountNumber: string;
    accountName: string;
  };
  createdAt: any;
  proofOfPayment?: string;
  lastUpdated?: any;
  rejectionReason?: string;
}

export default function PaymentApprovalScreen() {
  const params = useLocalSearchParams<{ paymentDetailsId: string }>();
  const paymentDetailsId = params.paymentDetailsId;
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paymentDetails, setPaymentDetails] = useState<PaymentDetails | null>(null);
  const [processing, setProcessing] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const { user: currentUser } = useAuth();

  const { t } = useLanguage();

  // Check if user is the seller
  const isSeller = currentUser?.uid === paymentDetails?.sellerId;

  useEffect(() => {
    const fetchPaymentDetails = async () => {
      try {
        setLoading(true);
        if (!paymentDetailsId) {
          showAlert(t.error, `${t.no}${t.payment} ${t.record}`);
          return;
        }

        const paymentRef = doc(db, 'paymentDetails', paymentDetailsId);
        const paymentDoc = await getDoc(paymentRef);

        if (!paymentDoc.exists()) {
          showAlert(t.error, `${t.payment} ${t.notFound}`);
          return;
        }

        const data = paymentDoc.data() as PaymentDetails;
        setPaymentDetails({ ...data, id: paymentDetailsId });
      } catch (err: any) {
        console.error('Error fetching payment details:', err);
        setError(err.message || 'Failed to load payment details');
      } finally {
        setLoading(false);
      }
    };

    fetchPaymentDetails();
  }, [paymentDetailsId]);

  const handleApprove = async () => {
    if (!paymentDetails || !currentUser || !paymentDetailsId) {
      showAlert(t.error, t.fillAllFields);
      return;
    }

    try {
      setProcessing(true);

      // Get the OTC listing to get the price
      const listingRef = doc(db, 'otcListings', paymentDetails.listingId);
      const listingDoc = await getDoc(listingRef);

      if (!listingDoc.exists()) {
        showAlert(t.error, `${t.listing} ${t.notFound}`);
        return;
      }

      const listingData = listingDoc.data();
      if (!listingData || typeof listingData.sellingPrice === 'undefined') {
        showAlert(t.error, `${t.listing} ${t.price} ${t.invalid}`);
        return;
      }

      const price = listingData.sellingPrice;
      console.log('OTC Listing data:', listingData);
      console.log('OTC Listing price:', price);

      await runTransaction(db, async (transaction) => {
        // Get buyer document
        const buyerRef = doc(db, 'users', paymentDetails.buyerId);
        const buyerDoc = await transaction.get(buyerRef);
        if (!buyerDoc.exists()) {
          showAlert(t.error, `${t.buyer} ${t.notFound}`);
          return;
        }

        // Get seller document
        const sellerRef = doc(db, 'users', paymentDetails.sellerId);
        const sellerDoc = await transaction.get(sellerRef);
        if (!sellerDoc.exists()) {
          showAlert(t.error, `${t.seller} ${t.notFound}`);
          return;
        }

        const buyerData = buyerDoc.data();
        const sellerData = sellerDoc.data();

        // Calculate new balances
        const currentBuyerGdpBalance = buyerData.gdpBalance || 0;
        const currentSellerGdpBalance = sellerData.gdpBalance || 0;
        const currentBuyerBalance = buyerData.balance || 0;

        const newBuyerGdpBalance = currentBuyerGdpBalance + paymentDetails.gdpAmount;
        const newSellerGdpBalance = currentSellerGdpBalance - paymentDetails.gdpAmount;
        const newBuyerBalance = currentBuyerBalance + paymentDetails.gdpAmount;

        // Update buyer's balances
        transaction.update(buyerRef, {
          gdpBalance: newBuyerGdpBalance,
          balance: newBuyerBalance,
          updatedAt: serverTimestamp()
        });

        // Update seller's GDP balance
        transaction.update(sellerRef, {
          gdpBalance: newSellerGdpBalance,
          updatedAt: serverTimestamp()
        });

        // Update payment status
        const paymentRef = doc(db, 'paymentDetails', paymentDetailsId);
        transaction.update(paymentRef, {
          status: 'completed',
          lastUpdated: serverTimestamp()
        });

        // Update listing status
        transaction.update(listingRef, {
          status: 'completed',
          updatedAt: serverTimestamp()
        });

        // Add transaction record
        const transactionsRef = collection(db, 'transactions');
        const newTransactionRef = doc(transactionsRef);
        transaction.set(newTransactionRef, {
          type: 'otc_purchase',
          gdpAmount: paymentDetails.gdpAmount,
          price: price,
          buyerId: paymentDetails.buyerId,
          sellerId: paymentDetails.sellerId,
          listingId: paymentDetails.listingId,
          paymentId: paymentDetailsId,
          status: 'completed',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      });

      // Update local state
      setPaymentDetails({
        ...paymentDetails,
        status: 'completed',
        lastUpdated: new Date()
      });

      showAlert(t.success, t.Payment_approved_and_transferred_successfully);
      router.replace('/(tabs)');
    } catch (err: any) {
      console.error('Error approving payment:', err);
      showAlert(t.error, err.message || 'Failed to approve payment');
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!paymentDetailsId || !currentUser) {
      showAlert(t.error, `${t.invalid} ${t.payment} ${t.record}`);
      return;
    }

    if (!rejectionReason.trim()) {
      showAlert(t.error, t.Please_provide_a_reason_for_rejection);
      return;
    }

    try {
      setProcessing(true);

      const paymentRef = doc(db, 'paymentDetails', paymentDetailsId);
      await updateDoc(paymentRef, {
        status: 'rejected',
        rejectionReason: rejectionReason.trim(),
        rejectedAt: serverTimestamp(),
        rejectedBy: currentUser.uid,
        lastUpdated: serverTimestamp()
      });

      // Update local state
      if (paymentDetails) {
        setPaymentDetails({
          ...paymentDetails,
          status: 'rejected',
          rejectionReason: rejectionReason.trim(),
          lastUpdated: new Date()
        });
      }

      setShowRejectModal(false);
      showAlert(t.success, `${t.payment} ${t.rejected}`);
      router.replace('/(tabs)');
    } catch (err: any) {
      console.error('Error rejecting payment:', err);
      showAlert(t.error, err.message || 'Failed to reject payment');
    } finally {
      setProcessing(false);
    }
  };

  const handleDownloadImage = async () => {
    if (!paymentDetails?.proofOfPayment) {
      showAlert(t.error, t.No_proof_of_payment_image_available);
      return;
    }

    if (paymentDetails.status !== 'pending_confirmation') {
      showAlert(t.error, t.Image_download_is_only_available_for_pending_confirmation_payments);
      return;
    }

    try {
      // Request permission to save to photo gallery
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        showAlert(t.Permissionneeded, t.Please_grant_permission_to_save_photos);
        return;
      }

      // Show loading state
      setProcessing(true);

      // Download the image
      const filename = `payment_proof_${paymentDetails.id}_${Date.now()}.jpg`;
      const fileUri = `${FileSystem.documentDirectory}${filename}`;

      const downloadResumable = FileSystem.createDownloadResumable(
        paymentDetails.proofOfPayment,
        fileUri,
        {}
      );

      const downloadResult = await downloadResumable.downloadAsync();
      if (!downloadResult) {
        showAlert(t.error, t.tryAgain);
        return;
      }

      // Save to photo gallery
      const asset = await MediaLibrary.createAssetAsync(downloadResult.uri);
      await MediaLibrary.createAlbumAsync('Payment Proofs', asset, false);

      // Clean up the temporary file
      await FileSystem.deleteAsync(downloadResult.uri);

      showAlert(t.success, t.Image_saved_to_photo_gallery);
    } catch (error) {
      console.error('Error saving image:', error);
      showAlert(t.error, t.Failed_to_save_image_to_gallery);
    } finally {
      setProcessing(false);
    }
  };

  // Helper function to get translated status
  const getTranslatedStatus = (status: string) => {
    const statusMap: { [key: string]: string } = {
      pending: t.pending,
      completed: t.completed,
      rejected: t.rejected,
      pending_confirmation: t.pendingConfirmation
    };
    return statusMap[status] || status;
  };

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
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (!paymentDetails) {
    return (
      <View style={styles.centerContainer}>
        <Text>{t.no} {t.payment} {t.record}</Text>
      </View>
    );
  }

  return (
    <View style={styles.mainContainer}>
      <ScrollView style={styles.container}>
        <View style={styles.card}>
          <View style={styles.header}>
            <MaterialIcons
              name={
                paymentDetails.status === 'pending' ? 'pending' :
                  paymentDetails.status === 'pending_confirmation' ? 'hourglass-empty' :
                    paymentDetails.status === 'completed' ? 'check-circle' :
                      'cancel'
              }
              size={48}
              color={
                paymentDetails.status === 'pending' ? '#FFA000' :
                  paymentDetails.status === 'pending_confirmation' ? '#2196F3' :
                    paymentDetails.status === 'completed' ? '#4CAF50' :
                      '#f44336'
              }
            />
            <Text style={styles.headerText}>
              {t.payment} - {getTranslatedStatus(paymentDetails.status)}
            </Text>
          </View>

          <View style={styles.detailsContainer}>
            <DetailRow label={t.price} value={`${paymentDetails.gdpAmount} USDT`} />
            <DetailRow label={`${t.selling} ${t.price}`} value={`${paymentDetails.sellingPrice} ${t.local_currency}`} />
            <DetailRow label={t.buyer} value={paymentDetails.buyerUsername} />
            <DetailRow
              label={t.paymentMethod}
              value={paymentDetails.paymentMethod.type === 'bank'
                ? paymentDetails.paymentMethod.bankName || 'Bank Transfer'
                : paymentDetails.paymentMethod.provider || 'E-Wallet'}
            />
            <DetailRow
              label={`${t.account} ${t.number}`}
              value={paymentDetails.paymentMethod.accountNumber}
            />
            <DetailRow
              label={`${t.account} ${t.name}`}
              value={paymentDetails.paymentMethod.accountName}
            />
            <DetailRow
              label={t.date}
              value={new Date(paymentDetails.createdAt.seconds * 1000).toLocaleString()}
            />
            {paymentDetails.lastUpdated && (
              <DetailRow
                label={t.lastUpdated}
                value={new Date(paymentDetails.lastUpdated.seconds * 1000).toLocaleString()}
              />
            )}
          </View>

          {paymentDetails.proofOfPayment && (
            <View style={styles.proofContainer}>
              <Text style={styles.proofTitle}>{t.ProofOfPayment}</Text>
              <Image
                source={{ uri: paymentDetails.proofOfPayment }}
                style={styles.proofImage}
                resizeMode="contain"
              />
              {isSeller && (
                <TouchableOpacity
                  style={[
                    styles.downloadButton,
                    processing && styles.uploadingButton
                  ]}
                  onPress={handleDownloadImage}
                  disabled={processing || paymentDetails.status !== 'pending_confirmation'}
                >
                  {processing ? (
                    <ActivityIndicator size="small" color="#2196F3" />
                  ) : (
                    <>
                      <MaterialIcons
                        name="file-download"
                        size={24}
                        color={paymentDetails.status === 'pending_confirmation' ? '#2196F3' : '#999'}
                      />
                      <Text style={[
                        styles.downloadButtonText,
                        paymentDetails.status !== 'pending_confirmation' && styles.disabledText
                      ]}>
                        {t.Save_to_Gallery}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </View>
          )}

          {paymentDetails.status === 'rejected' && paymentDetails.rejectionReason && (
            <View style={styles.rejectionContainer}>
              <Text style={styles.rejectionAdminText}>{t.Adminwilltakenotedandinvesticationyourcase}</Text>
              <Text style={styles.rejectionTitle}>{t.rejectionReason}</Text>
              <Text style={styles.rejectionText}>{paymentDetails.rejectionReason}</Text>
            </View>
          )}

          {paymentDetails.status === 'pending_confirmation' && isSeller && (
            <View style={styles.buttonContainer}>
              <TouchableOpacity
                onPress={handleApprove}
                disabled={processing}
                style={[styles.button, styles.approveButton, processing && styles.disabledButton]}
              >
                {processing ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text style={styles.buttonText}>{t.Approve}</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setShowRejectModal(true)}
                disabled={processing}
                style={[styles.button, styles.rejectButton, processing && styles.disabledButton]}
              >
                {processing ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text style={styles.buttonText}>{t.Reject}</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>

      <View style={styles.bottomButtonContainer}>
        <TouchableOpacity
          onPress={() => router.replace('/(tabs)')}
          style={[styles.navigationButton, styles.button]}
        >
          <Text style={styles.buttonText}>{t.back}</Text>
        </TouchableOpacity>
      </View>

      <Modal
        visible={showRejectModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowRejectModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <MaterialIcons name="warning" size={32} color="#f44336" />
              <Text style={styles.modalTitle}>{t.Reject}</Text>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.modalLabel}>{t.rejectionReason}</Text>
              <TextInput
                style={styles.rejectionInput}
                placeholder={t.Please_provide_a_reason_for_rejection}
                value={rejectionReason}
                onChangeText={setRejectionReason}
                multiline
                numberOfLines={4}
                maxLength={200}
                textAlignVertical="top"
                placeholderTextColor="#9e9e9e"
              />
              <Text style={styles.characterCount}>
                {rejectionReason.length}/300 characters
              </Text>
            </View>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                onPress={() => {
                  setShowRejectModal(false);
                  setRejectionReason('');
                }}
                style={[styles.modalButton, styles.cancelButton]}
              >
                <Text style={styles.modalButtonText}>{t.cancel}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleReject}
                disabled={processing || !rejectionReason.trim()}
                style={[
                  styles.modalButton,
                  styles.confirmRejectButton,
                  (!rejectionReason.trim() || processing) && styles.disabledButton
                ]}
              >
                <Text style={styles.modalButtonText}>
                  {processing ? 'Processing...' : 'Confirm'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  container: {
    flex: 1,
  },
  bottomButtonContainer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    backgroundColor: '#fff',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    margin: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    boxShadow: '0px 2px 3.84px rgba(0, 0, 0, 0.25)',
    elevation: 5,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  headerText: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 8,
    color: '#333',
    textTransform: 'capitalize',
  },
  detailsContainer: {
    marginBottom: 24,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  label: {
    fontSize: 16,
    color: '#666',
  },
  value: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  proofContainer: {
    marginBottom: 24,
  },
  proofTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333',
  },
  proofImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
  },
  actionContainer: {
    marginTop: 20,
    gap: 10,
  },
  actionButton: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  approveButton: {
    backgroundColor: '#4CAF50',
  },
  rejectButton: {
    backgroundColor: '#f44336',
  },
  actionButtonText: {
    color: 'white',
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '500',
  },
  errorText: {
    marginTop: 10,
    color: '#f44336',
    textAlign: 'center',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    padding: 20,
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 15,
    width: '100%',
    maxWidth: 400,
    elevation: 5,
    boxShadow: '0px 2px 3.84px rgba(0, 0, 0, 0.25)',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    gap: 10,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  modalBody: {
    padding: 20,
  },
  modalLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  rejectionInput: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#f5f5f5',
    minHeight: 100,
    color: '#333',
  },
  characterCount: {
    fontSize: 12,
    color: '#757575',
    textAlign: 'right',
    marginTop: 4,
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    gap: 12,
  },
  modalButtonContainer: {
    flex: 1,
    borderRadius: 8,
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  cancelButton: {
    backgroundColor: '#757575',
  },
  confirmRejectButton: {
    backgroundColor: '#f44336',
  },
  disabledButton: {
    opacity: 0.6,
  },
  buttonContainer: {
    marginTop: 20,
    gap: 10,
  },
  button: {
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 8,
  },
  navigationButton: {
    backgroundColor: '#2196F3',
  },
  modalButton: {
    flex: 1,
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 8,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  rejectionContainer: {
    marginTop: 15,
    padding: 10,
    backgroundColor: '#ffebee',
    borderRadius: 5,
  },
  rejectionAdminText: {
    fontSize: 14,
    color: 'blue'
  },
  rejectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#d32f2f',
    marginBottom: 5,
  },
  rejectionText: {
    color: '#424242',
    fontSize: 14,
  },
  downloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    marginTop: 10,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
  },
  downloadButtonText: {
    marginLeft: 8,
    fontSize: 16,
    color: '#2196F3',
    fontWeight: '500',
  },
  uploadingButton: {
    backgroundColor: '#e0e0e0',
  },
  disabledText: {
    color: '#999',
  },
});
