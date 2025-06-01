import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ScrollView,
  Image,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import {
  addDoc, collection, serverTimestamp, getDocs
} from 'firebase/firestore';
import * as Clipboard from 'expo-clipboard';
import PinInput from '../Transaction/PinInput';
import { userService } from '@/services/userService';
import { db } from '@/firebase';
import { useLanguage } from '@/hooks/useLanguage';
import showAlert from '@/components/CustomAlert/ShowAlert';


interface TopUpBalanceModalProps {
  isVisible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  userId: string;
  username?: string;
}

interface CryptoOption {
  id: string;
  network: string;
  address: string;
  imageName: string;
}

interface CopyableTextProps {
  text: string;
  style?: any;
}

const CopyableText: React.FC<CopyableTextProps> = ({ text, style }) => {
  return (
    <Text selectable style={style}>
      {text}
    </Text>
  );
};

const availableImages: { [key: string]: any } = {
  'bitcoin': require('../../assets/images/bitcoin.png'),
  'eth': require('../../assets/images/ERC-20.jpg'),
  'usdc': require('../../assets/images/USDC.png'),
  'usdtTrc': require('../../assets/images/USDT-TRC20.png'),
};

const TopUpBalanceModal: React.FC<TopUpBalanceModalProps> = ({
  isVisible,
  onClose,
  onSuccess,
  userId,
  username,
}) => {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [selectedCrypto, setSelectedCrypto] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [transactionPassword, setTransactionPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [showPinInput, setShowPinInput] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  const { t } = useLanguage();

  useEffect(() => {
    if (isVisible) {
      fetchCryptoOptions();
    }
  }, [isVisible]);

  const fetchCryptoOptions = async () => {
    try {
      const cryptoCollection = collection(db, 'cryptoOptions');
      const cryptoSnapshot = await getDocs(cryptoCollection);
      const cryptoList = cryptoSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as CryptoOption[];
      setCryptoOptions(cryptoList);
      setLoading(false);
    } catch (error) {
      showAlert(t.error, t.tryAgain);
      setLoading(false);
    }
  };

  const handleCryptoSelect = (cryptoId: string) => {
    setSelectedCrypto(cryptoId);
    setStep(2);
  };

  const getCryptocurrencyName = (imageName: string): string => {
    switch (imageName) {
      case 'bitcoin':
        return 'bitcoin';
      case 'eth':
        return 'ethereum';
      case 'usdc':
        return 'usdc';
      case 'usdtTrc':
        return 'tether';
      default:
        return imageName;
    }
  };

  const handleConfirm = async () => {
    if (!transactionPassword || !amount) {
      showAlert(t.error, t.invalidTransactionPassword);
      return;
    }

    try {
      setLoading(true);

      // Verify transaction password
      const userDoc = await userService.getUserById(userId);
      if (!userDoc || userDoc.transactionPassword !== transactionPassword) {
        showAlert(t.error, t.invalidTransactionPassword);
        setLoading(false);
        return;
      }

      const selectedOption = cryptoOptions.find(c => c.id === selectedCrypto);
      if (!selectedOption) {
        throw new Error('Selected cryptocurrency option not found');
      }

      // Create deposit request
      await addDoc(collection(db, 'depositRequests'), {
        userId,
        username: username || 'Anonymous',
        amount: parseFloat(amount),
        cryptocurrency: getCryptocurrencyName(selectedOption.imageName), // Use imageName to determine cryptocurrency
        network: selectedOption.network,
        walletAddress: selectedOption.address,
        status: 'pending',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        processedAt: null
      });

      showAlert(
        t.success,
        t.YourdepositrequesthasbeensubmittedPleasewaitforconfirmation,
        [
          {
            text: t.ok,
            onPress: () => {
              setStep(1);
              setSelectedCrypto(null);
              setAmount('');
              setTransactionPassword('');
              setShowPinInput(false);
              onSuccess?.();
              onClose();
              router.push("/transaction-history");
            },
          }
        ]
      );

    } catch (error) {
      console.error('Error submitting deposit request:', error);
      showAlert(t.error, t.tryAgain);
    } finally {
      setLoading(false);
      setShowPinInput(false);
    }
  };

  const handleClose = () => {
    if (step > 1) {
      setStep(step - 1);
    } else {
      // Reset all states
      setStep(1);
      setSelectedCrypto(null);
      setAmount('');
      setTransactionPassword('');
      setShowPinInput(false);
      setCopySuccess(false);

      // Close modal
      onClose();

      // Navigate after a short delay to ensure modal is closed
      if (Platform.OS === 'web') {
        setTimeout(() => {
          router.replace('/(tabs)');
        }, 100);
      }
    }
  };

  const handleQuickCopy = async (text: string | undefined) => {
    if (!text) return;

    try {
      if (Platform.OS === 'web') {
        await navigator.clipboard.writeText(text);
      } else {
        await Clipboard.setStringAsync(text);
      }

      setCopySuccess(true);
      showAlert(t.success, t.addressCopied);

      // Reset copy success state after 2 seconds
      setTimeout(() => {
        setCopySuccess(false);
      }, 2000);
    } catch (error) {
      console.error('Copy failed:', error);
      showAlert(t.error, t.tryAgain);
    }
  };

  const [cryptoOptions, setCryptoOptions] = useState<CryptoOption[]>([]);

  const handleAmountChange = (text: string) => {
    // Only allow digits
    const digitsOnly = text.replace(/[^0-9]/g, '');
    setAmount(digitsOnly);
  };

  return (
    <>
      <Modal
        visible={isVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={handleClose}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.header}>
              <View style={styles.placeholder} />
              <Text style={styles.title}>{t.topUp} {t.balance}</Text>
              <TouchableOpacity onPress={() => { handleClose(); setAmount('') }} style={styles.closeButton}>
                <MaterialIcons
                  name={step > 1 ? "arrow-back" : "close"}
                  size={24}
                  color="#666"
                />
              </TouchableOpacity>
            </View>

            {step === 1 && (
              <View style={styles.step1Container}>
                <Text style={styles.stepTitle}>{t.choose} {t.network}</Text>
                <Text style={styles.stepDescription}>{`${t.please} ${t.select} ${t.blockchainnetwork}`}</Text>
                <ScrollView
                  style={styles.cryptoScrollView}
                  contentContainerStyle={styles.cryptoGridContainer}
                  showsVerticalScrollIndicator={false}
                >
                  <View style={styles.cryptoGrid}>
                    {cryptoOptions.map((crypto) => (
                      <TouchableOpacity
                        key={crypto.id}
                        style={[
                          styles.cryptoOption,
                          selectedCrypto === crypto.id && styles.selectedCryptoOption,
                          Platform.OS === 'web' && styles.cryptoOptionWeb
                        ]}
                        onPress={() => handleCryptoSelect(crypto.id)}
                      >
                        <View style={[
                          styles.cryptoImageContainer,
                          Platform.OS === 'web' && styles.cryptoImageContainerWeb
                        ]}>
                          <Image
                            source={availableImages[crypto.imageName] || availableImages['bitcoin']}
                            style={[
                              styles.cryptoImage,
                              Platform.OS === 'web' && styles.cryptoImageWeb
                            ]}
                            resizeMode="contain"
                          />
                        </View>
                        <Text style={[
                          styles.cryptoNetwork,
                          Platform.OS === 'web' && styles.cryptoNetworkWeb
                        ]}>{crypto.network}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </View>
            )}
            {step === 2 && (
              <ScrollView style={styles.formContainer}>
                {selectedCrypto && (
                  <View style={styles.selectedCryptoDetails}>
                    <Text style={styles.detailsLabel}>
                      {t.sendOnly} {cryptoOptions.find(c => c.id === selectedCrypto)?.network} {t.toThisAddress}
                    </Text>
                    <View style={styles.addressContainer}>
                      {(() => {
                        const address = cryptoOptions.find(c => c.id === selectedCrypto)?.address;
                        return address ? (
                          <>
                            <CopyableText
                              text={address}
                              style={styles.addressText}
                            />
                            <TouchableOpacity
                              style={[
                                styles.copyButton,
                                copySuccess && styles.copyButtonSuccess
                              ]}
                              onPress={() => handleQuickCopy(address)}
                            >
                              <MaterialIcons
                                name={copySuccess ? "check" : "content-copy"}
                                size={20}
                                color="#fff"
                              />
                            </TouchableOpacity>
                          </>
                        ) : null;
                      })()}
                    </View>
                    <Text style={styles.warningText}>
                      {t.Pleasemakesureyouaresendingfromthecorrectnetworktoavoidlossoffunds}
                    </Text>
                  </View>
                )}
                <View style={styles.inputContainer}>
                  <Text style={styles.label}>{t.amount}</Text>
                  <TextInput
                    style={styles.input}
                    value={amount}
                    onChangeText={handleAmountChange}
                    keyboardType="numeric"
                    placeholder={`${t.enter} ${t.amount}`}
                    placeholderTextColor="#666"
                  />
                </View>

                <TouchableOpacity
                  style={[styles.submitButton, (!amount || loading) && styles.disabledButton]}
                  onPress={() => setShowPinInput(true)}
                  disabled={!amount || loading}
                >
                  <Text style={styles.submitButtonText}>
                    {loading ? `${t.processing}...` : `${t.confirm} ${t.deposit}`}
                  </Text>
                </TouchableOpacity>

                <PinInput
                  value={transactionPassword}
                  onChange={setTransactionPassword}
                  visible={showPinInput}
                  title={`${t.enter} ${t.transactionPassword}`}
                  onClose={() => {
                    setShowPinInput(false);
                    setTransactionPassword('');
                  }}
                  onConfirm={() => { handleConfirm(); setShowPinInput(false); setTransactionPassword(''); }}
                />
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    flex: 1,
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: Platform.OS === 'web' ? '90vh' : '90%',
    width: '100%',
    maxWidth: Platform.OS === 'web' ? 480 : '100%',
    alignSelf: 'center',
    ...(Platform.OS === 'web' ? {
      marginTop: 'auto',
      marginBottom: 'auto',
      position: 'relative',
      borderRadius: 20,
    } : {})
  } as ViewStyle,
  header: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    position: 'relative',
  } as ViewStyle,
  placeholder: {
    width: 40,
    height: 40,
    opacity: 0,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
    flex: 1,
    textAlign: 'center',
  },
  closeButton: {
    position: 'absolute',
    right: 16,
    top: 16,
    padding: 8,
    zIndex: 1,
  } as ViewStyle,
  step1Container: {
    flex: 1,
    width: '100%',
    paddingHorizontal: 20,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  stepDescription: {
    fontSize: 16,
    color: '#666',
    marginBottom: 24,
  },
  cryptoScrollView: {
    flex: 1,
    width: '100%',
  } as ViewStyle,

  cryptoGridContainer: {
    flexGrow: 1,
    paddingVertical: 10,
  } as ViewStyle,

  cryptoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    width: '100%',
  } as ViewStyle,

  cryptoOptionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    width: '100%',
    padding: 16,
    paddingTop: 8,
  } as ViewStyle,
  cryptoOption: {
    width: '47%',
    aspectRatio: 1,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#f0f0f0',
    ...(Platform.OS === 'web' ? {
      cursor: 'pointer',
      transition: 'all 0.2s ease',
      ':hover': {
        backgroundColor: '#f8f9fa',
        borderColor: '#e0e0e0',
      }
    } : {}),
  } as ViewStyle,
  cryptoOptionWeb: {
    width: 160,
    minWidth: 160,
    maxWidth: 160,
    margin: 0,
  },
  selectedCryptoOption: {
    borderColor: '#2196F3',
    backgroundColor: '#e3f2fd',
  } as ViewStyle,
  cryptoImageContainer: {
    width: 64,
    height: 64,
    marginBottom: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cryptoImageContainerWeb: {
    width: '70%',
  },
  cryptoImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  cryptoImageWeb: {
    objectFit: 'contain',
  },
  cryptoNetwork: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
    marginTop: 4,
  } as TextStyle,
  cryptoNetworkWeb: {
    fontSize: 14,
    marginTop: 8,
  },
  selectedCryptoDetails: {
    margin: 20,
    padding: 24,
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#f0f0f0',
    width: Platform.OS === 'web' ? '90%' : 'auto',
    maxWidth: Platform.OS === 'web' ? 480 : 'auto',
    alignSelf: 'center',
  } as ViewStyle,
  detailsLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  addressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'red',
    borderRadius: 12,
    padding: 16,
    marginTop: 12,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  } as ViewStyle,
  addressText: {

    width: Platform.OS === 'web' ? '90%' : 'auto',
    maxWidth: Platform.OS === 'web' ? 480 : 'auto',
    fontSize: 15,
    color: '#1a1a1a',
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 8,
    marginBottom: 8,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    textAlign: 'center',
  } as TextStyle,
  copyButton: {
    backgroundColor: '#2196F3',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },
  copyButtonSuccess: {
    backgroundColor: '#4CAF50',
  },
  warningText: {
    fontSize: 14,
    color: '#ff6b6b',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 16,
  } as TextStyle,
  formContainer: {
    paddingHorizontal: 20,
    width: '100%',
    maxWidth: Platform.OS === 'web' ? 480 : '100%',
    alignSelf: 'center',
  } as ViewStyle,
  inputContainer: {
    marginBottom: 20,
  },
  subtitle: {
    fontSize: 15,
    color: '#666',
    marginTop: 4,
    textAlign: 'center',
  } as TextStyle,

  label: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  } as TextStyle,
  input: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#333',
    backgroundColor: '#fff',
    marginTop: 8,
  } as TextStyle,
  submitButton: {
    backgroundColor: '#2196F3',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 16,
    width: '100%',
    maxWidth: Platform.OS === 'web' ? 480 : '100%',
    alignSelf: 'center',
    ...(Platform.OS === 'web' ? {
      cursor: 'pointer',
      transition: 'background-color 0.2s ease',
      ':hover': {
        backgroundColor: '#1976D2',
      }
    } : {}),
  } as ViewStyle,
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  } as TextStyle,
  alertOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  alertContainer: {
    position: 'relative',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    width: 300,
    maxWidth: '90%',
    alignItems: 'center',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
  },
  alertTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  alertMessage: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  alertButton: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 6,
    minWidth: 100,
    alignItems: 'center',
  },
  alertButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.5,
  },
});

export default TopUpBalanceModal;
