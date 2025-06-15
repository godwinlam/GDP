import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, Platform, Image } from 'react-native';
import { collection, query, where, onSnapshot, doc, writeBatch } from 'firebase/firestore';
import { db, auth } from '@/firebase';
import { useLanguage } from '@/hooks/useLanguage';
import { GDPPurchase, User } from '@/types/user';
import LottieView from 'lottie-react-native';
import OTCListingModal from '../Investment/OTCListingModal';
import ConvertGDPModal from '../Investment/ConvertGDPModal';
import GDPActionModal from './GDPActionModal';


interface AssetCounts {
  [key: string]: number;
}

interface AssetSummary {
  totalGDP: number;
  assetCounts: AssetCounts;
  totalBalance: number;
}

export const useAssetSummary = () => {
  // const { user: authUser } = useAuth(); 
  const [assetSummary, setAssetSummary] = useState<AssetSummary>({
    totalGDP: 0,
    assetCounts: {},
    totalBalance: 0,
  });
  const [loading, setLoading] = useState(false);
  const [userData, setUserData] = useState<User | null>(null);

  useEffect(() => {
    if (!auth.currentUser) return;
    setLoading(true);

    // Subscribe to user document for balance updates
    const userRef = doc(db, "users", auth.currentUser.uid);
    const userUnsubscribe = onSnapshot(userRef, (docSnapshot) => {
      if (docSnapshot.exists()) {
        const data = { ...docSnapshot.data(), uid: docSnapshot.id } as User;
        setUserData(data);
        console.log("User data fetched:", data);
        console.log("User balance:", data.balance);

        setAssetSummary(prev => ({
          ...prev,
          totalBalance: data.balance || 0,
        }));
      }
    });

    // Subscribe to GDP purchases
    const gdpPurchasesRef = collection(db, "gdpPurchases");
    const q = query(gdpPurchasesRef,
      where("userId", "==", auth.currentUser.uid)
    );

    const gdpUnsubscribe = onSnapshot(q, async (querySnapshot) => {
      let totalGDP = 0;
      const counts: AssetCounts = {};

      // Delete empty OTC purchases
      const batch = writeBatch(db);
      let hasEmptyPurchases = false;

      querySnapshot.forEach((doc) => {
        const purchase = doc.data() as GDPPurchase;
        const amount = purchase.amount || purchase.gdpPurchased || 0;

        // Check for empty OTC purchases to delete
        if (amount === 0 && purchase.source === 'otc') {
          batch.delete(doc.ref);
          hasEmptyPurchases = true;
          return; // Skip counting this purchase
        }

        // Add to total GDP regardless of source
        if (amount > 0) {
          totalGDP += amount;

          // Only count animationFile if NOT from GDP purchase (i.e., from OTC or converted)
          if (purchase.animationFile && purchase.source !== "gdp") {
            counts[purchase.animationFile] = (counts[purchase.animationFile] || 0) + amount;
          }
        }
      });

      // Commit deletion if there were any empty purchases
      if (hasEmptyPurchases) {
        try {
          await batch.commit();
          console.log('Successfully deleted empty OTC purchases');
        } catch (error) {
          console.error('Error deleting empty OTC purchases:', error);
        }
      }

      setAssetSummary(prev => ({
        ...prev,
        totalGDP,
        assetCounts: counts,
      }));
      setLoading(false);
    });

    return () => {
      userUnsubscribe();
      gdpUnsubscribe();
    };
  }, [auth.currentUser?.uid]);

  return { ...assetSummary, loading, userData };
};

export default function Assets() {
  const { assetCounts, loading, userData } = useAssetSummary();
  const animationRefs = useRef<{ [key: string]: LottieView | null }>({});
  const [showListingModal, setShowListingModal] = useState(false);
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [showActionModal, setShowActionModal] = useState(false);
  const [selectedGDP, setSelectedGDP] = useState<string | null>(null);
  const [selectedAction, setSelectedAction] = useState<'list' | 'convert' | null>(null);
  const { t } = useLanguage();

  const getGDPPrice = (animationFile: string): number => {
    const priceMap: { [key: string]: number } = {
      'star-1.json': 25,
      '2-star.json': 100,
      '3-star.json': 300,
      '4-star.json': 1000,
      '5-star.json': 3000,
      'Crown.json': 10000,
    };
    return priceMap[animationFile] || 0;
  };

  const handleGDPPress = (animationFile: string) => {
    if ((assetCounts[animationFile] || 0) > 0) {
      setSelectedGDP(animationFile);
      setShowActionModal(true);
    }
  };

  const handleCloseActionModal = () => {
    setShowActionModal(false);
    setSelectedGDP(null);
    setSelectedAction(null);
  };

  const handleListOTC = () => {
    setSelectedAction('list');
    setShowActionModal(false);
    setShowListingModal(true);
  };

  const handleConvert = () => {
    setSelectedAction('convert');
    setShowActionModal(false);
    setShowConvertModal(true);
  };

  useEffect(() => {
    Object.values(animationRefs.current).forEach((ref) => {
      if (ref) {
        ref.play();
      }
    });
  }, []);

  useEffect(() => {
    if (!showListingModal && !showConvertModal && userData?.uid) {
      // Give Firestore a moment to update
      setTimeout(() => {
        const unsubscribe = onSnapshot(doc(db, "users", userData.uid), () => { });
        return () => unsubscribe();
      }, 500);
    }
  }, [showListingModal, showConvertModal, userData?.uid]);

  const formatAmount = (amount: number) => {
    return amount.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color="#1976D2" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>

        <View style={styles.summaryContainer}>
          <View style={styles.summaryItem}>
            <Text style={styles.label}>{t.available} {t.balance}</Text>
            <Text style={styles.value}>{formatAmount(userData?.balance || 0)}</Text>
          </View>
        </View>

        <View style={styles.balanceContainer}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={styles.bitcoinImageContainer}>
              <Image
                source={require("@/assets/images/GDPCoin01.png")}
                style={styles.bitcoinImage}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.balanceAmount}>{userData?.token?.toLocaleString() || '0'}</Text>
          </View>
        </View>
      </View>

      <View style={styles.assetsContainer}>
        <View style={styles.gdpGrid}>
          {[
            'star-1.json',
            '2-star.json',
            '3-star.json',
            '4-star.json',
            '5-star.json',
            'Crown.json',
          ].map((animationFile) => {
            const ownedCount = assetCounts[animationFile] || 0;
            return (
              <TouchableOpacity
                key={animationFile}
                style={[
                  styles.gdpOption,
                  ownedCount === 0 && styles.disabledGdp
                ]}
                onPress={() => handleGDPPress(animationFile)}
                disabled={ownedCount === 0}
              >
                <View style={styles.imageContainer}>
                  <LottieView
                    ref={(ref) => (animationRefs.current[animationFile] = ref)}
                    source={
                      animationFile === 'star-1.json'
                        ? require('@/assets/animations/star-1.json') :
                        animationFile === '2-star.json'
                          ? require('@/assets/animations/2-star.json')
                          : animationFile === '3-star.json'
                            ? require('@/assets/animations/3-star.json')
                            : animationFile === '4-star.json'
                              ? require('@/assets/animations/4-star.json')
                              : animationFile === '5-star.json'
                                ? require('@/assets/animations/5-star.json')
                                : require('@/assets/animations/Crown.json')
                    }
                    autoPlay
                    loop
                    style={[
                      styles.lottieAnimation,
                      ownedCount === 0 && styles.disabledAnimation
                    ]}
                  />
                </View>
                <View style={styles.gdpInfoContainer}>
                  <Text style={[
                    styles.gdpCount,
                    ownedCount === 0 && styles.disabledText
                  ]}>
                    {t.owned}: {ownedCount}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {selectedGDP && userData && (
        <>
          <GDPActionModal
            visible={showActionModal}
            onClose={handleCloseActionModal}
            onListOTC={handleListOTC}
            onConvert={handleConvert}
            gdpValue={getGDPPrice(selectedGDP)}
          />

          <OTCListingModal
            isVisible={showListingModal}
            onClose={() => setShowListingModal(false)}
            currentUser={userData}
            // maxGDPAmount={assetCounts[selectedGDP] || 0}
            selectedGDP={selectedGDP}
          />

          <ConvertGDPModal
            visible={showConvertModal}
            onClose={() => setShowConvertModal(false)}
            animationFile={selectedGDP}
            gdpPrice={getGDPPrice(selectedGDP)}
            quantity={assetCounts[selectedGDP] || 0}
            user={userData}
            onSuccess={() => setShowConvertModal(false)}
          />
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: Platform.OS === 'android' ? 30 : 0,
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  summaryContainer: {
    marginTop: 10,
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
      },
      android: {
        elevation: 3,
      },
      default: {
        boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
      },
    }),
  },
  summaryItem: {
    marginBottom: 12,
  },
  label: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 4,
  },
  value: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2E7D32',
  },
  assetsContainer: {
    padding: 16,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    ...Platform.select({
      ios: {
        boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
      },
      android: {
        elevation: 3,
      },
      default: {
        boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
      },
    }),
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#333333',
  },
  gdpGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
  },
  gdpOption: {
    width: '45%',
    marginBottom: 16,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    ...Platform.select({
      ios: {
        boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
      },
      android: {
        elevation: 3,
      },
      default: {
        boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
      },
    }),
  },
  imageContainer: {
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
  },
  lottieAnimation: {
    width: 80,
    height: 80,
  },
  gdpInfoContainer: {
    padding: 8,
  },
  gdpName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333333',
  },
  gdpCount: {
    fontSize: 14,
    color: '#666666',
  },
  debugInfo: {
    marginTop: 16,
    padding: 8,
    backgroundColor: '#f5f5f5',
    borderRadius: 4,
  },
  disabledGdp: {
    opacity: 0.5,
  },
  disabledAnimation: {
    opacity: 0.3,
  },
  disabledText: {
    color: '#999',
  },
  actionModalContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  actionModalContent: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 24,
    width: '90%',
    maxWidth: 400,
    ...Platform.select({
      ios: {
        boxShadow: '0px 2px 3.84px rgba(0, 0, 0, 0.25)',
      },
      android: {
        elevation: 5,
      },
      default: {
        boxShadow: '0px 2px 3.84px rgba(0, 0, 0, 0.25)',
      },
    }),
  },
  actionModalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 16,
    textAlign: 'center',
  },
  gdpValueText: {
    fontSize: 18,
    color: '#4CAF50',
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 24,
  },
  actionButtonsContainer: {
    gap: 16,
  },
  actionButton: {
    borderRadius: 12,
    padding: 16,
    ...Platform.select({
      ios: {
        boxShadow: '0px 1px 1.41px rgba(0, 0, 0, 0.2)',
      },
      android: {
        elevation: 2,
      },
      default: {
        boxShadow: '0px 1px 1.41px rgba(0, 0, 0, 0.2)',
      },
    }),
  },
  actionButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  actionButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: 'white',
    flex: 1,
  },
  actionButtonSubtext: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 4,
  },
  listButton: {
    backgroundColor: '#4CAF50',
  },
  convertButton: {
    backgroundColor: '#2196F3',
  },
  cancelButton: {
    backgroundColor: '#757575',
  },
  balanceContainer: {
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  bitcoinImageContainer: {
    width: 50,
    height: 50,
    marginRight: 20,
    marginLeft: 30,
    backgroundColor: 'blue',
    borderRadius: 12,
  },
  bitcoinImage: {
    width: "100%",
    height: "100%",
  },
  balanceAmount: {
    color: 'green',
    fontSize: 30,
    fontWeight: 'bold',
  },
});