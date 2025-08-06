import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Image,
} from 'react-native';
import { doc, getDoc, addDoc, collection, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/firebase';
import { useAuth } from '@/context/auth';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import CountryFlag from "react-native-country-flag";
import PinInput from '@/components/Transaction/PinInput';
import { useLanguage } from '@/hooks/useLanguage';
import showAlert from '@/components/CustomAlert/ShowAlert';

interface BankAccount {
  type: 'bank';
  accountNumber: string;
  accountName: string;
  bankName: string;
}

interface EWallet {
  type: 'ewallet';
  accountNumber: string;
  accountName: string;
  provider?: string;
}

type PaymentMethod = BankAccount | EWallet;

interface OTCListing {
  id: string;
  sellerId: string;
  gdpAmount: number;
  sellingPrice: number;
  status: string;
  createdAt: any;
  animationFile: string;
  countryCode?: string;
  sellerUsername?: string;
}

interface ListingDetailProps {
  listingId: string;
  onClose: () => void;
}

const paymentImages: { [key: string]: any } = {
  'Alipay': require('@/assets/images/Alipay.png'),
  'Wechat': require('@/assets/images/WeChat_Pay.png'),
  'TNG': require('@/assets/images/TNG.png'),
};

export default function OTCListingDetail({ listingId, onClose }: ListingDetailProps) {
  const { user: currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [listing, setListing] = useState<OTCListing | null>(null);
  const [sellerPaymentMethods, setSellerPaymentMethods] = useState<PaymentMethod[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [sellerCountry, setSellerCountry] = useState<string>('');
  const [sellerName, setSellerName] = useState<string>('');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod | null>(null);
  const [pin, setPin] = useState('');
  const [showPinInput, setShowPinInput] = useState(false);

  const { t } = useLanguage();

  useEffect(() => {
    const fetchListingDetails = async () => {
      try {
        setLoading(true);
        console.log('Fetching listing with ID:', listingId);

        const listingRef = doc(db, 'otcListings', listingId);
        const listingDoc = await getDoc(listingRef);

        if (!listingDoc.exists()) {
          console.log('Listing not found in otcListings');
          showAlert(t.error, `${t.listing} ${t.notFound}`);
          return;
        }

        const listingData = {
          ...listingDoc.data(),
          id: listingDoc.id
        } as OTCListing;

        console.log('Listing data:', listingData);
        setListing(listingData);

        if (listingData.sellerId) {
          console.log('Fetching seller data for ID:', listingData.sellerId);
          const sellerRef = doc(db, 'users', listingData.sellerId);
          const sellerDoc = await getDoc(sellerRef);

          if (sellerDoc.exists()) {
            const sellerData = sellerDoc.data();
            console.log('Seller data:', sellerData);
            console.log('Bank fields:', {
              bankName: sellerData.bankName,
              bankAccount: sellerData.bankAccount,
              bankAccountNumber: sellerData.bankAccountNumber,
            });
            console.log('Digital bank fields:', {
              digitalBankName: sellerData.digitalBankName,
              digitalBankAccount: sellerData.digitalBankAccount,
            });

            // Set seller country and name
            setSellerCountry(sellerData.country || '');
            setSellerName(sellerData.fullName || sellerData.username || '');

            const paymentMethods: PaymentMethod[] = [];

            // Add bank account if exists
            if (sellerData.bankName && sellerData.bankAccount) {
              paymentMethods.push({
                type: 'bank',
                accountNumber: sellerData.bankAccount,
                accountName: sellerData.fullName || '',
                bankName: sellerData.bankName
              });
            }

            // Add digital bank if exists
            if (sellerData.digitalBank) {
              paymentMethods.push({
                type: 'ewallet',
                accountNumber: sellerData.bankNumber || '',
                accountName: sellerData.fullName || '',
                provider: sellerData.digitalBankName || sellerData.digitalBank
              });
            }

            console.log('Processed payment methods:', paymentMethods);
            setSellerPaymentMethods(paymentMethods);

            if (paymentMethods.length === 0) {
              console.log('No payment methods found for seller');
            }
          } else {
            console.log('Seller document not found');
            showAlert(t.error, `${t.seller} ${t.notFound}`);
          }
        }
      } catch (err: any) {
        console.error('Error in fetchListingDetails:', err);
        setError(err.message);
        showAlert(t.error, err.message);
      } finally {
        setLoading(false);
      }
    };

    if (listingId) {
      fetchListingDetails();
    }
  }, [listingId]);

  const handleConfirmPurchase = (paymentMethod: PaymentMethod) => {
    setSelectedPaymentMethod(paymentMethod);
    setShowPinInput(true);
  };

  const handlePinClose = () => {
    setShowPinInput(false);
    setPin('');
  };

  const handlePinChange = async () => {
    if (pin.length === 6) {
      setShowPinInput(false);
      try {
        console.log('Starting payment process...');

        if (!selectedPaymentMethod || !currentUser || !listing) {
          showAlert(t.error, `${t.invalid} ${t.required}${t.information}`);
          return;
        }

        if (listing.sellerId === currentUser.uid) {
          showAlert(t.error, `${t.you_cannot_purchase_your_owned_GDP}`);
          return;
        }
        
        // Verify transaction password
      if (currentUser.transactionPassword !== pin) {
        showAlert(t.error, t.invalidTransactionPassword);
        return;
      }

        // Store payment details in Firebase
        const paymentDetailsRef = await addDoc(collection(db, 'paymentDetails'), {
          listingId: listing.id,
          sellerId: listing.sellerId,
          sellerUsername: listing.sellerUsername,
          sellingPrice: listing.sellingPrice,
          buyerId: currentUser.uid,
          buyerUsername: currentUser.username || currentUser.email,
          gdpAmount: listing.gdpAmount,
          transactionType: 'otc_purchase',
          status: 'pending',
          paymentMethod: selectedPaymentMethod.type === 'bank'
            ? {
              type: 'bank',
              bankName: (selectedPaymentMethod as BankAccount).bankName,
              accountNumber: selectedPaymentMethod.accountNumber,
              accountName: selectedPaymentMethod.accountName,
            }
            : {
              type: 'ewallet',
              provider: (selectedPaymentMethod as EWallet).provider,
              accountNumber: selectedPaymentMethod.accountNumber,
              accountName: selectedPaymentMethod.accountName,
            },
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        });

        console.log('Payment details stored with ID:', paymentDetailsRef.id);

        // Update the listing status
        const listingRef = doc(db, 'otcListings', listing.id);
        await updateDoc(listingRef, {
          status: 'processing',
          buyerId: currentUser.uid,
          buyerUsername: currentUser.username || currentUser.email,
          updatedAt: Timestamp.now()
        });

        console.log('Listing status updated');

        // Navigate to payment confirmation
        const paymentId = paymentDetailsRef.id;
        console.log('Navigating to payment confirmation with ID:', paymentId);

        router.replace({
          pathname: '/payment-confirmation',
          params: { paymentDetailsId: paymentId }
        } as never);

      } catch (error) {
        console.error('Error storing payment details:', error);
        showAlert(t.error, 'Failed to process payment. Please try again.');
      }
      setPin('');
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4CAF50" />
      </View>
    );
  }

  if (error || !listing) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{t.error || `${t.error} ${t.listing}`}</Text>
        <TouchableOpacity style={styles.button} onPress={onClose}>
          <Text style={styles.buttonText}>{t.close}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <LinearGradient
          colors={['#4CAF50', '#45a049']}
          style={styles.header}
        >
          <Text style={styles.title}>{t.purchase} GDP</Text>
          <Text style={styles.subtitle}>{listing?.gdpAmount} GDP {t.for} ${listing?.sellingPrice}</Text>
          <View style={styles.sellerInfo}>
            {sellerCountry && (
              <CountryFlag
                isoCode={sellerCountry}
                size={30}
              />
            )}
          </View>
        </LinearGradient>

        <View style={styles.content}>
          <Text style={styles.sectionTitle}>{t.seller} {t.payment_Methods}</Text>
          {sellerPaymentMethods.map((method, index) => (
            <TouchableOpacity
              key={index}
              style={styles.paymentMethod}
              onPress={() => handleConfirmPurchase(method)}
            >
              {method.type === 'bank' ? (
                <>
                  <View style={styles.paymentMethodHeader}>
                    <MaterialIcons
                      name="account-balance"
                      size={24}
                      color="#4CAF50"
                    />
                    <Text style={styles.paymentMethodTitle}>{t.bank} {t.details}</Text>
                  </View>
                  <View style={styles.detailsContainer}>
                    <Text style={styles.detailLabel}>{t.bankName}:</Text>
                    <Text style={styles.detailValue}>{method.bankName}</Text>

                    <Text style={styles.detailLabel}>{t.bankNumber}:</Text>
                    <Text style={styles.detailValue}>{method.accountNumber}</Text>

                    <Text style={styles.detailLabel}>{t.account} {t.name}:</Text>
                    <Text style={styles.detailValue}>{method.accountName}</Text>
                  </View>
                </>
              ) : (
                <>
                  <View style={styles.paymentMethodHeader}>
                    {paymentImages[method.provider || ''] ? (
                      <Image
                        source={paymentImages[method.provider || '']}
                        style={styles.paymentImage}
                        resizeMode="contain"
                      />
                    ) : (
                      <MaterialIcons
                        name="payment"
                        size={24}
                        color="#4CAF50"
                      />
                    )}
                    <Text style={styles.paymentMethodTitle}>{t.digitalBank} {t.details}</Text>
                  </View>
                  <View style={styles.detailsContainer}>
                    <Text style={styles.detailLabel}>{t.provider}:</Text>
                    <Text style={styles.detailValue}>{method.provider}</Text>

                    <Text style={styles.detailLabel}>{t.account} {t.number}:</Text>
                    <Text style={styles.detailValue}>{method.accountNumber}</Text>

                    <Text style={styles.detailLabel}>{t.account} {t.name}:</Text>
                    <Text style={styles.detailValue}>{method.accountName}</Text>
                  </View>
                </>
              )}
              <Text style={styles.buyNowText}>{t.proceed}</Text>
            </TouchableOpacity>
          ))}

          {sellerPaymentMethods.length === 0 && (
            <Text style={styles.noPaymentText}>
              {t.seller} {t.no}{t.payment_Methods} {t.information}
            </Text>
          )}

          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>{t.back}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <PinInput
        value={pin}
        onChange={setPin}
        visible={showPinInput}
        onClose={handlePinClose}
        onConfirm={() => { handlePinChange(); onClose(); }}
        title={`${t.please}${t.enter} ${t.transactionPassword}`}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollView: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    color: '#f44336',
    marginBottom: 20,
    textAlign: 'center',
  },
  header: {
    padding: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    color: '#ffffff',
    opacity: 0.9,
  },
  content: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#333',
  },
  paymentMethod: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    boxShadow: '0px 1px 2px rgba(0, 0, 0, 0.1)',
  },
  paymentMethodHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  paymentMethodTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginLeft: 12,
  },
  detailsContainer: {
    marginLeft: 36,
  },
  detailLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
    marginBottom: 12,
  },
  paymentImage: {
    width: 100,
    height: 100,
  },
  buyNowText: {
    color: '#2196F3',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 12,
  },
  noPaymentText: {
    textAlign: 'center',
    color: '#666',
    fontStyle: 'italic',
  },
  button: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  buttonText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  closeButton: {
    backgroundColor: '#757575',
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  closeButtonText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 16,
    textAlign: 'center',
  },
  sellerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
  },
});
