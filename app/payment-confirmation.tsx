import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView, Image, Alert, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  collection,
  doc,
  getDoc,
  query,
  where,
  getDocs,
  orderBy,
  updateDoc,
  serverTimestamp,
  deleteField,
  deleteDoc,
  Timestamp,
  or
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage } from '@/firebase';
import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '@/context/auth';
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

export default function PaymentConfirmationScreen() {
  const { paymentDetailsId } = useLocalSearchParams();
  const router = useRouter();
  const [paymentDetails, setPaymentDetails] = useState<PaymentDetails | null>(null);
  const [paymentsList, setPaymentsList] = useState<PaymentDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user: currentUser } = useAuth();
  const [uploading, setUploading] = useState(false);

  const { t } = useLanguage();

  // Function to delete old completed payments
  const deleteOldCompletedPayments = async (payments: PaymentDetails[]) => {
    const tenMinutesAgo = new Date();
    tenMinutesAgo.setMinutes(tenMinutesAgo.getMinutes() - 129600);

    for (const payment of payments) {
      if (payment.status === 'completed') {
        const paymentTime = payment.createdAt instanceof Timestamp
          ? payment.createdAt.toDate()
          : new Timestamp(payment.createdAt.seconds, payment.createdAt.nanoseconds).toDate();

        if (paymentTime < tenMinutesAgo) {
          try {
            // Delete proof of payment image from storage if it exists
            if (payment.proofOfPayment) {
              try {
                const storageUrl = new URL(payment.proofOfPayment);
                const storagePath = decodeURIComponent(storageUrl.pathname.split('/o/')[1].split('?')[0]);
                const imageRef = ref(storage, storagePath);
                await deleteObject(imageRef);
              } catch (error) {
                console.error('Error deleting payment image:', error);
              }
            }

            // Delete payment document from Firestore
            await deleteDoc(doc(db, 'paymentDetails', payment.id));
            console.log(`Deleted old completed payment: ${payment.id}`);
          } catch (error) {
            console.error('Error deleting old payment:', error);
          }
        }
      }
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        if (!currentUser) return;

        if (paymentDetailsId) {
          // Fetch single payment details
          const paymentRef = doc(db, 'paymentDetails', paymentDetailsId.toString());
          const paymentDoc = await getDoc(paymentRef);

          if (paymentDoc.exists()) {
            const data = paymentDoc.data();
            const payment = {
              ...data,
              id: paymentDoc.id
            } as PaymentDetails;

            setPaymentDetails(payment);

            // Check if this single payment should be deleted
            await deleteOldCompletedPayments([payment]);
          }
        } else {
          // Then fetch all relevant payments
          const paymentsRef = collection(db, 'paymentDetails');
          const q = query(
            paymentsRef,
            or(
              where('sellerId', '==', currentUser.uid),
              where('buyerId', '==', currentUser.uid)
            ),
            orderBy('createdAt', 'desc')
          );

          const querySnapshot = await getDocs(q);
          const payments = querySnapshot.docs.map(doc => ({
            ...doc.data(),
            id: doc.id
          })) as PaymentDetails[];

          // Delete old completed payments
          await deleteOldCompletedPayments(payments);

          // Filter out deleted payments from the list
          const tenMinutesAgo = new Date();
          tenMinutesAgo.setMinutes(tenMinutesAgo.getMinutes() - 129600);

          const filteredPayments = payments.filter(payment => {
            if (payment.status === 'completed') {
              const paymentTime = payment.createdAt instanceof Timestamp
                ? payment.createdAt.toDate()
                : new Timestamp(payment.createdAt.seconds, payment.createdAt.nanoseconds).toDate();
              return paymentTime >= tenMinutesAgo;
            }
            return true;
          });

          setPaymentsList(filteredPayments);
        }
      } catch (err) {
        console.error('Error fetching data:', err);
        setError('Failed to load payment details');
        showAlert(t.error, t.failedToLoadPaymentDetails);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [paymentDetailsId, currentUser]);

  // Check if user is a seller by checking if they own this payment
  const isSeller = paymentDetails ? currentUser?.uid === paymentDetails.sellerId : false;

  // Handle seller navigation
  useEffect(() => {
    if (paymentDetailsId && paymentDetails && isSeller) {
      router.push(`/payment-approval?paymentDetailsId=${paymentDetailsId}`);
    }
  }, [paymentDetailsId, paymentDetails, isSeller]);

  const handleImageUpload = async () => {
    if (!paymentDetails || !currentUser) {
      showAlert(t.error, t.missingPaymentDetailsOrUserInformation);
      return;
    }

    // Check if payment is completed or rejected
    if (paymentDetails.status === 'completed' || paymentDetails.status === 'rejected') {
      showAlert(t.error, t.cannotUploadImageForCompletedOrRejectedPayments);
      return;
    }

    try {
      setUploading(true);

      // Request permission
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        showAlert(t.Permissionneeded, t.Pleasegrantpermissiontoaccessyourmedialibrary);
        return;
      }

      // First pick the new image to ensure user has selected one before deleting old image
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images', 'videos'],
        allowsEditing: true,
        quality: 1,
      });

      if (!result.canceled && result.assets[0]) {
        // If there's an existing image, delete it first
        if (paymentDetails.proofOfPayment) {
          try {
            // Extract the storage path from the download URL
            const storageUrl = new URL(paymentDetails.proofOfPayment);
            const storagePath = decodeURIComponent(storageUrl.pathname.split('/o/')[1].split('?')[0]);
            const oldImageRef = ref(storage, storagePath);

            await deleteObject(oldImageRef);
            console.log('Successfully deleted old image');

            // Update payment details to remove old image reference
            const paymentRef = doc(db, 'paymentDetails', paymentDetails.id);
            await updateDoc(paymentRef, {
              proofOfPayment: deleteField(),
              lastUpdated: serverTimestamp()
            });

            // Update local state to remove old image
            setPaymentDetails(prev => prev ? {
              ...prev,
              proofOfPayment: undefined,
              lastUpdated: new Date()
            } : null);
          } catch (error) {
            console.error('Error deleting old image:', error);
            // If the error is because the image doesn't exist, we can proceed
            if ((error as any)?.code === 'storage/object-not-found') {
              console.log('Image already deleted or not found, proceeding with upload');
            } else {
              showAlert(t.error, t.tryAgain);
              return;
            }
          }
        }

        // Now proceed with uploading the new image
        const uri = result.assets[0].uri;
        const response = await fetch(uri);
        const blob = await response.blob();

        // Generate unique filename
        const filename = `proof_of_payment/${paymentDetails.id}_${Date.now()}`;
        const imageRef = ref(storage, filename);

        // Upload new image
        await uploadBytes(imageRef, blob);
        const downloadURL = await getDownloadURL(imageRef);

        // Update payment details with new image URL
        const paymentRef = doc(db, 'paymentDetails', paymentDetails.id);
        await updateDoc(paymentRef, {
          proofOfPayment: downloadURL,
          status: 'pending_confirmation',
          lastUpdated: serverTimestamp()
        });

        // Update local state
        setPaymentDetails(prev => prev ? {
          ...prev,
          proofOfPayment: downloadURL,
          status: 'pending_confirmation',
          lastUpdated: new Date()
        } : null);

        showAlert(t.success, t.proofOfPaymentUploadedSuccessfully);
      }
    } catch (error: any) {
      console.error('Error handling image:', error);
      showAlert(t.error, error.message || 'Failed to handle proof of payment');
    } finally {
      setUploading(false);
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
        <MaterialIcons name="error" size={48} color="#f44336" />
        <Text style={styles.errorText}>{t.error}</Text>
      </View>
    );
  }

  if (!paymentDetailsId) {
    return (
      <>
        <ScrollView style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.headerText}>{t.payment} {t.history}</Text>
          </View>
          {paymentsList.length === 0 ? (
            <View style={styles.centerContainer}>
              <Text style={styles.noPaymentsText}>{t.payment} {t.notFound}</Text>
            </View>
          ) : (
            paymentsList.map((payment) => (
              <TouchableOpacity
                key={payment.id}
                style={styles.paymentCard}
                onPress={() => {
                  const path = isSeller ? 'payment-approval' : 'payment-confirmation';
                  router.push(`/${path}?paymentDetailsId=${payment.id}`);
                }}
              >
                <View style={styles.paymentCardHeader}>
                  <MaterialIcons
                    name={
                      payment.status === 'pending' ? 'pending' :
                        payment.status === 'completed' ? 'check-circle' :
                          payment.status === 'pending_confirmation' ? 'hourglass-empty' :
                            'cancel'
                    }
                    size={24}
                    color={
                      payment.status === 'pending' ? '#FFA000' :
                        payment.status === 'completed' ? '#4CAF50' :
                          payment.status === 'pending_confirmation' ? '#2196F3' :
                            '#f44336'
                    }
                  />
                  <Text style={[styles.statusText, {
                    color: payment.status === 'pending' ? '#FFA000' :
                      payment.status === 'completed' ? '#4CAF50' :
                        payment.status === 'pending_confirmation' ? 'green' :
                          '#f44336'
                  }]}>
                    {getTranslatedStatus(payment.status)}
                  </Text>
                </View>
                <View style={styles.paymentCardContent}>
                  <Text style={styles.amountText}>{payment.sellingPrice} {t.local_currency}</Text>
                  <Text style={styles.dateText}>
                    {new Date(payment.createdAt.seconds * 1000).toLocaleDateString()}
                  </Text>
                </View>
                <View style={styles.paymentCardFooter}>
                  <Text style={styles.sellerText}>
                    {isSeller ? `${t.buyer}: ${payment.buyerUsername}` : `${t.seller}: ${payment.sellerUsername}`}
                  </Text>
                  <MaterialIcons name="chevron-right" size={24} color="#64748B" />
                </View>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>

        <View style={styles.bottomButtonContainer}>
          <TouchableOpacity
            style={styles.navigationButton}
            onPress={() => router.replace('/(tabs)')}
          >
            <Text style={styles.buttonText}>{t.back}</Text>
          </TouchableOpacity>
        </View>
      </>
    );
  }

  if (!paymentDetails) {
    return (
      <View style={styles.centerContainer}>
        <Text>{t.payment} {t.notFound}</Text>
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
            <Text style={styles.headerText}>{t.payment} - {getTranslatedStatus(paymentDetails.status)}</Text>
          </View>

          <View style={styles.detailsContainer}>
            <DetailRow label={t.price} value={`${paymentDetails.gdpAmount} USDT`} />
            <DetailRow label={t.seller} value={paymentDetails.sellerUsername} />
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

          {paymentDetails.status === 'rejected' && paymentDetails.rejectionReason && (
            <View style={styles.rejectionContainer}>
              <Text style={styles.rejectionAdminText}>{t.Adminwilltakenotedandinvesticationyourcase}</Text>
              <Text style={styles.rejectionTitle}>{t.rejectionReason} :</Text>
              <Text style={styles.rejectionText}>{paymentDetails.rejectionReason}</Text>
            </View>
          )}

          <View style={styles.proofContainer}>
            <Text style={styles.proofTitle}>{t.ProofOfPayment}</Text>
            {paymentDetails.proofOfPayment ? (
              <View style={styles.imageContainer}>
                <Image
                  source={{ uri: paymentDetails.proofOfPayment }}
                  style={styles.proofImage}
                  resizeMode="contain"
                />
                <TouchableOpacity
                  style={[
                    styles.uploadButton,
                    (uploading || paymentDetails.status === 'completed' || paymentDetails.status === 'rejected') && styles.disabledButton
                  ]}
                  onPress={handleImageUpload}
                  disabled={uploading || paymentDetails.status === 'completed' || paymentDetails.status === 'rejected'}
                >
                  <MaterialIcons name="refresh" size={24} color="white" />
                  <Text style={styles.uploadButtonText}>{t.replaceImage}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={[
                  styles.uploadButton,
                  uploading && styles.uploadingButton,
                  (paymentDetails.status === 'completed' || paymentDetails.status === 'rejected') && styles.disabledButton
                ]}
                onPress={handleImageUpload}
                disabled={uploading || paymentDetails.status === 'completed' || paymentDetails.status === 'rejected'}
              >
                <MaterialIcons name="file-upload" size={24} color="white" />
                <Text style={styles.uploadButtonText}>{t.uploadProofofPayment}</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.instructionContainer}>
            <Text style={styles.instructionTitle}>{t.paymentInstructions}</Text>
            <Text style={styles.instructionText}>
              1. {t.Transfertheexactamounttotheaccountdetailsabove}{'\n'}
              2. {t.Keepyourtransferreceiptforreference}{'\n'}
              3. {t.Waitforthesellertoconfirmyourpayment}{'\n'}
              4. GDP {t.willbetransferredtoyourwalletonceconfirmed}
            </Text>
          </View>
        </View>
      </ScrollView>

      <View style={styles.bottomButtonContainer}>
        <TouchableOpacity
          style={styles.navigationButton}
          onPress={() => router.replace('/(tabs)')}
        >
          <Text style={styles.buttonText}>{t.back}</Text>
        </TouchableOpacity>
      </View>
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
  bottomButtonContainer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    backgroundColor: '#fff',
  },
  navigationButton: {
    backgroundColor: '#2196F3',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  header: {
    padding: 20,
    alignItems: 'center',
  },
  headerText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 8,
  },
  errorText: {
    marginTop: 10,
    color: '#f44336',
    textAlign: 'center',
  },
  noPaymentsText: {
    fontSize: 16,
    color: '#666',
  },
  card: {
    margin: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    boxShadow: '0px 2px 3.84px rgba(0, 0, 0, 0.25)',
    elevation: 5,
  },
  paymentCard: {
    backgroundColor: '#fff',
    margin: 8,
    marginHorizontal: 16,
    padding: 16,
    borderRadius: 12,
    boxShadow: '0px 2px 3.84px rgba(0, 0, 0, 0.1)',
    elevation: 2,
  },
  paymentCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  paymentCardContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  paymentCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusText: {
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 8,
    textTransform: 'capitalize',
  },
  amountText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  dateText: {
    fontSize: 14,
    color: '#666',
  },
  sellerText: {
    fontSize: 14,
    color: '#64748B',
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
  instructionContainer: {
    backgroundColor: '#f8f8f8',
    padding: 16,
    borderRadius: 8,
  },
  instructionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#333',
  },
  instructionText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#666',
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
  imageContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  proofImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginBottom: 12,
  },
  uploadButton: {
    flexDirection: 'row',
    backgroundColor: '#4CAF50',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  uploadingButton: {
    backgroundColor: '#45a049', // slightly darker shade when uploading
    opacity: 0.8,
  },
  disabledButton: {
    backgroundColor: '#cccccc',
    opacity: 0.7,
  },
  uploadButtonText: {
    color: 'white',
    fontSize: 16,
    marginLeft: 8,
    fontWeight: '500',
  },
  rejectionContainer: {
    marginTop: 15,
    padding: 15,
    backgroundColor: '#ffebee',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ffcdd2',
  },
  rejectionAdminText: {
    fontSize: 14,
    color: 'blue'
  },
  rejectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#d32f2f',
    marginBottom: 8,
  },
  rejectionText: {
    color: '#424242',
    fontSize: 14,
    lineHeight: 20,
  },
});
