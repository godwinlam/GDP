import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ScrollView,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { collection, serverTimestamp, query, where, getDocs, doc, runTransaction, DocumentData } from 'firebase/firestore';
import { db } from '@/firebase';
import { User } from '@/types/user';
import CountryFlag from 'react-native-country-flag';
import { countriesList, Country } from "@/utils/countries";
import LottieView from 'lottie-react-native';
import PinInput from "../Transaction/PinInput";
import { useLanguage } from '@/hooks/useLanguage';
import showAlert from '../CustomAlert/ShowAlert';

interface GDPPurchase extends DocumentData {
  id: string;
  userId: string;
  animationFile: string;
  gdpPurchased: number;
  purchasePrice: number;
  timestamp: Date;
  username: string;
  source: string;
}

const { width } = Dimensions.get('window');
const GRID_COLUMNS = 3;
const ITEM_MARGIN = 8;
const ITEM_WIDTH = (width - 80 - (GRID_COLUMNS - 1) * ITEM_MARGIN) / GRID_COLUMNS;

interface OTCListingModalProps {
  isVisible: boolean;
  onClose: (success?: boolean) => void;
  currentUser: User;
  selectedGDP: string;
}

export default function OTCListingModal({
  isVisible,
  onClose,
  currentUser,
  selectedGDP,
}: OTCListingModalProps) {
  const { t } = useLanguage();
  const [sellingPrice, setSellingPrice] = useState('');
  const [transactionPassword, setTransactionPassword] = useState('');
  const [selectedCountry, setSelectedCountry] = useState<Country | null>(null);
  const [step, setStep] = useState(1);
  const [showPinModal, setShowPinModal] = useState(false);
  const animationRef = useRef<LottieView | null>(null);

  useEffect(() => {
    if (animationRef.current) {
      animationRef.current.play();
    }
  }, []);

  const resetForm = () => {
    setShowPinModal(false);
    setTransactionPassword('');
  };

  const handleCreateListing = async () => {
    if (!selectedCountry) {
      showAlert(t.error, `${t.please} ${t.select} ${t.country}`);
      return;
    }

    const gdpAmountNum = selectedGDP === 'star-1.json' ? 25 :
      selectedGDP === '2-star.json' ? 100 :
        selectedGDP === '3-star.json' ? 300 :
          selectedGDP === '4-star.json' ? 1000 :
            selectedGDP === '5-star.json' ? 3000 : 10000;
    const sellingPriceNum = parseFloat(sellingPrice);

    if (isNaN(sellingPriceNum) || sellingPriceNum <= 0) {
      showAlert(t.error, `${t.invalid} ${t.selling} ${t.price}`);
      return;
    }

    try {
      
      // Verify transaction password
      if (currentUser.transactionPassword !== transactionPassword) {
        showAlert(t.error, t.invalidTransactionPassword);
        return;
      }
      
      // First check if user has any active listings for this GDP amount
      const activeListingsQuery = query(
        collection(db, 'otcListings'),
        where('sellerId', '==', currentUser.uid),
        where('gdpAmount', '==', gdpAmountNum),
        where('status', '==', 'active')
      );

      const activeListingsSnapshot = await getDocs(activeListingsQuery);
      if (!activeListingsSnapshot.empty) {
        showAlert(t.error, t.youAlreadyHaveAnActiveListingForThisGdpAmount);
        return;
      }

      // Get the GDP purchase document
      const gdpPurchasesRef = collection(db, 'gdpPurchases');
      const gdpQuery = query(
        gdpPurchasesRef,
        where('userId', '==', currentUser.uid),
        where('animationFile', '==', selectedGDP),
        where('source', '==', 'otc')
      );
      const gdpSnapshot = await getDocs(gdpQuery);

      if (gdpSnapshot.empty) {
        showAlert(t.error, `${t.You_do_not_own_any} ${selectedGDP} GDP`);
        return;
      }

      let gdpPurchaseDoc: GDPPurchase | null = null;
      gdpSnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.gdpPurchased && data.gdpPurchased > 0) {
          gdpPurchaseDoc = {
            id: doc.id,
            userId: data.userId,
            animationFile: data.animationFile,
            gdpPurchased: data.gdpPurchased,
            purchasePrice: data.purchasePrice,
            timestamp: data.timestamp,
            username: data.username,
            source: data.source,
            ...data
          };
        }
      });

      if (!gdpPurchaseDoc) {
        showAlert(t.error, `${t.no} ${t.available} ${selectedGDP} GDP`);
        return;
      }

      await runTransaction(db, async (transaction) => {
        if (!gdpPurchaseDoc) {
          showAlert(t.error, `${t.no} ${t.available} GDP ${t.information}`);
          return;
        }

        // Get fresh GDP purchase document
        const gdpPurchaseRef = doc(db, 'gdpPurchases', gdpPurchaseDoc.id);
        const freshGdpDoc = await transaction.get(gdpPurchaseRef);

        if (!freshGdpDoc.exists()) {
          showAlert(t.error, `${t.no} ${t.available} GDP ${t.information}`);
          return;
        }

        const freshData = freshGdpDoc.data();
        const currentGdpPurchased = freshData.gdpPurchased || 0;

        if (currentGdpPurchased < 1) {
          showAlert(t.error, `${t.insufficient} GDP`);
          return;
        }

        // Update GDP purchase document
        transaction.update(gdpPurchaseRef, {
          gdpPurchased: currentGdpPurchased - 1
        });

        // Create the new listing
        const listingRef = doc(collection(db, 'otcListings'));
        const now = serverTimestamp();
        transaction.set(listingRef, {
          sellerId: currentUser.uid,
          sellerUsername: currentUser.username,
          gdpAmount: gdpAmountNum,
          sellingPrice: sellingPriceNum,
          status: 'active',
          createdAt: now,
          updatedAt: now,
          countryCode: selectedCountry.code,
          animationFile: selectedGDP,
          gdpPurchaseId: gdpPurchaseDoc.id,
          source: 'otc'
        });
      });

      showAlert(
        t.success,
        t.Your_GDP_has_been_listed_for_sale,
        [
          {
            text: 'OK',
            onPress: () => {
              setSellingPrice('');
              setTransactionPassword('');
              setSelectedCountry(null);
              setStep(1);
              onClose(true);
            },
          },
        ]
      );
    } catch (error) {
      console.error('Error creating listing:', error);
      showAlert(t.error, error instanceof Error ? error.message : 'Failed to create listing');
      onClose(false);
    }
  };

  const isFormValid = () => {
    return sellingPrice !== '';
  };

  const handleListGDP = () => {
    if (isFormValid()) {
      setShowPinModal(true);
    } else {
      showAlert(t.error, t.fillAllFields);
    }
  };

  const renderCountrySelection = () => {
    return (
      <View style={styles.stepContainer}>
        <Text style={styles.stepTitle}>{t.select} {t.country}</Text>
        <ScrollView style={styles.scrollView}>
          <View style={styles.countryGrid}>
            {countriesList.map((country) => (
              <TouchableOpacity
                key={country.code}
                style={[
                  styles.countryItem,
                  selectedCountry?.code === country.code && styles.selectedCountry,
                ]}
                onPress={() => setSelectedCountry(country)}
              >
                <CountryFlag isoCode={country.code} size={25} />
                <Text style={styles.countryName}>{country.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        <TouchableOpacity
          style={[styles.nextButton, !selectedCountry && styles.disabledButton]}
          onPress={() => selectedCountry && setStep(2)}
          disabled={!selectedCountry}
        >
          <Text style={styles.buttonText}>{t.next}</Text>
        </TouchableOpacity>
      </View>
    );
  };
  
  const handleAmountChange = (text: string) => {
    // Only allow digits
    const digitsOnly = text.replace(/[^0-9]/g, "");
    setSellingPrice(digitsOnly);
  };

  const renderListingDetails = () => {
    return (
      <View style={styles.stepContainer}>
        <Text style={styles.stepTitle}>{t.OTC} {t.listing}</Text>
        <View style={styles.formContainer}>
          <View style={styles.selectedCountryDisplay}>
            <CountryFlag isoCode={selectedCountry?.code || ''} size={25} />
            <Text style={styles.selectedCountryName}>{selectedCountry?.name}</Text>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>{t.selling} {t.price} ({t.local_currency})</Text>
            <TextInput
              style={styles.input}
              value={sellingPrice}
              onChangeText={handleAmountChange}
              keyboardType="numeric"
              placeholder={`${t.enter} ${t.selling} ${t.price}`}
            />
          </View>

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => setStep(1)}
            >
              <Text style={styles.buttonText}>{t.back}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.listButton, !isFormValid() && styles.disabledButton]}
              onPress={handleListGDP}
              disabled={!isFormValid()}
            >
              <Text style={styles.buttonText}>{t.confirm}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={isVisible}
      onRequestClose={() => onClose()}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalContainer}
      >
        <View style={styles.modalContent}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>{t.OTC} {t.listing}</Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => { onClose(); setSellingPrice(''); }}
            >
              <Text style={styles.closeButtonText}>×</Text>
            </TouchableOpacity>
          </View>

          {step === 1 ? renderCountrySelection() : renderListingDetails()}

          <PinInput
            visible={showPinModal}
            onClose={resetForm}
            value={transactionPassword}
            onChange={setTransactionPassword}
            onConfirm={() => { handleCreateListing(); onClose(); resetForm(); setSellingPrice(''); }}
            title={t.confirm}
          />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    flex: 1,
    backgroundColor: 'white',
    marginTop: 50,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 8,
  },
  closeButtonText: {
    fontSize: 24,
    color: '#666',
  },
  stepContainer: {
    flex: 1,
    padding: 16,
  },
  stepTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  countryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  countryItem: {
    width: ITEM_WIDTH,
    aspectRatio: 1,
    marginBottom: ITEM_MARGIN,
    padding: 8,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedCountry: {
    backgroundColor: '#e3f2fd',
    borderWidth: 2,
    borderColor: '#2196f3',
  },
  countryName: {
    marginTop: 8,
    fontSize: 12,
    textAlign: 'center',
  },
  nextButton: {
    backgroundColor: '#2196f3',
    padding: 16,
    borderRadius: 8,
    marginTop: 16,
  },
  formContainer: {
    flex: 1,
  },
  selectedCountryDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e3f2fd',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  selectedCountryName: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: 'bold',
  },
  inputContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    marginBottom: 8,
    color: '#666',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 24,
  },
  backButton: {
    flex: 1,
    backgroundColor: '#666',
    padding: 16,
    borderRadius: 8,
    marginRight: 8,
  },
  listButton: {
    flex: 1,
    backgroundColor: '#4caf50',
    padding: 16,
    borderRadius: 8,
    marginLeft: 8,
  },
  disabledButton: {
    opacity: 0.5,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});
