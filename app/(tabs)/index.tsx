import { auth, db } from "@/firebase";
import HomeCarousel from "@/components/Carousel/HomeCarousel";
import TopUpBalanceModal from "@/components/Modals/TopUpBalanceModal";
import TransactionModal from "@/components/Transaction/TransactionModal";
import WithdrawalModal from "@/components/Withdrawal/WithdrawalModal";
import { languages, useLanguage } from "@/hooks/useLanguage";
import { User } from "@/types/user";
import {
  AntDesign,
  MaterialCommunityIcons,
  MaterialIcons,
} from "@expo/vector-icons";
import { router } from "expo-router";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import LottieView from "lottie-react-native";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import CountryFlag from "react-native-country-flag";

interface TabOneScreenProps {}

const getAnimationSource = (animationFile: string) => {
  switch (animationFile) {
    case "star-1.json":
      return require("@/assets/animations/star-1.json");
    case "2-star.json":
      return require("@/assets/animations/2-star.json");
    case "3-star.json":
      return require("@/assets/animations/3-star.json");
    case "4-star.json":
      return require("@/assets/animations/4-star.json");
    case "5-star.json":
      return require("@/assets/animations/5-star.json");
    case "Crown.json":
      return require("@/assets/animations/Crown.json");
    default:
      return require("@/assets/animations/non-active.json");
  }
};

const TabOneScreen: React.FC<TabOneScreenProps> = () => {
  const [isTransactionModalVisible, setIsTransactionModalVisible] =
    useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [animationSource, setAnimationSource] = useState<any>(
    require("@/assets/animations/non-active.json")
  );
  const [showWithdrawalModal, setShowWithdrawalModal] = useState(false);
  const [isTopUpModalVisible, setIsTopUpModalVisible] = useState(false);
  const [userBalance, setUserBalance] = useState(0);
  const [gdpPrice, setGdpPrice] = useState(0);

  const {
    t,
    handleLanguageChange,
    showLanguageModal,
    setShowLanguageModal,
    selectedLanguage,
  } = useLanguage();

  const renderLanguageOption = (lang: (typeof languages)[0]) => (
    <TouchableOpacity
      key={lang.code}
      style={[
        styles.languageOption,
        selectedLanguage === lang.code && styles.selectedLanguage,
      ]}
      onPress={() => handleLanguageChange(lang.code)}
    >
      <CountryFlag
        isoCode={lang.isoCode}
        size={24}
        style={{ marginRight: 8 }}
      />
      <Text
        style={[
          styles.languageOptionText,
          selectedLanguage === lang.code && styles.selectedLanguageText,
        ]}
      >
        {lang.name}
      </Text>
      {selectedLanguage === lang.code && (
        <AntDesign name="check" size={20} color="#007AFF" />
      )}
    </TouchableOpacity>
  );

  const refreshUserData = async () => {
    try {
      const user = auth.currentUser;
      if (user) {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
          const userData = { uid: userDoc.id, ...userDoc.data() } as User;
          setCurrentUser(userData);
          setUserBalance(userData.balance || 0);
          if (userData.gdpAnimation) {
            setAnimationSource(getAnimationSource(userData.gdpAnimation));
          }
        }
      }
    } catch (error) {
      console.error("Error refreshing user data:", error);
    }
  };
  useEffect(() => {
    const loadUserData = async () => {
      try {
        setIsLoading(true);
        const user = auth.currentUser;
        if (!user) {
          setIsLoading(false);
          router.replace("/(auth)/login");
          return;
        }

        // Set up real-time listener for user document
        const unsubscribe = onSnapshot(
          doc(db, "users", user.uid),
          (userDoc) => {
            if (userDoc.exists()) {
              const userData = { uid: userDoc.id, ...userDoc.data() } as User;
              setCurrentUser(userData);
              setUserBalance(userData.balance || 0);
              if (userData.gdpAnimation) {
                setAnimationSource(getAnimationSource(userData.gdpAnimation));
              }
            }
            setIsLoading(false);
          },
          (error) => {
            console.error("Error in user snapshot:", error);
            setIsLoading(false);
          }
        );

        return unsubscribe;
      } catch (error) {
        console.error("Error loading user data:", error);
        setIsLoading(false);
      }
    };

    const unsubscribeAuth = auth.onAuthStateChanged((user) => {
      if (!user) {
        router.replace("/(auth)/login");
      }
    });

    const unsubscribePromise = loadUserData();
    let unsubscribe: (() => void) | undefined;

    // Handle the async unsubscribe
    if (unsubscribePromise) {
      unsubscribePromise.then((unsub) => {
        if (unsub) {
          unsubscribe = unsub;
        }
      });
    }

    // Cleanup function
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
      unsubscribeAuth();
    };
  }, []);

  useEffect(() => {
    const loadAnimation = async () => {
      if (currentUser?.uid) {
        const animation = await getGDPAnimation(currentUser.uid);
        setAnimationSource(getAnimationSource(animation || "non-active.json"));
      }
    };

    loadAnimation();
  }, [currentUser?.uid]);

  useEffect(() => {
    const fetchGDPPrice = async () => {
      try {
        const tokensRef = collection(db, "tokens");
        const snapshot = await getDocs(tokensRef);
        const gdpToken = snapshot.docs.find(
          (doc) => doc.data().name === "GDPCOIN"
        );
        if (gdpToken) {
          setGdpPrice(gdpToken.data().price);
        }
      } catch (error) {
        console.error("Error fetching GDP price:", error);
      }
    };

    fetchGDPPrice();
  }, []);

  const handleStakingPress = () => {
    if (!currentUser) {
      Alert.alert(t.error, t.PleaseLoginFirst);
      return;
    }

    router.push({
      pathname: "/investment",
      params: {
        uid: currentUser.uid,
        username: currentUser.username,
        balance: currentUser.balance,
        shares: currentUser.shares || 0,
      },
    });
  };

  const handleStakingRecordPress = () => {
    if (!currentUser) {
      Alert.alert(t.error, t.PleaseLoginFirst);
      return;
    }

    router.push({
      pathname: "/investment-profile",
      params: { user: JSON.stringify(currentUser) },
    });
  };

  const handleRelationshipPress = () => {
    if (!currentUser) {
      Alert.alert("Error", "Please login first");
      return;
    }

    router.push({
      pathname: "/relationship",
      params: { currentUser: JSON.stringify(currentUser) },
    });
  };

  const handleGameScreenPress = () => {
    if (!currentUser) {
      Alert.alert("Error", "Please login first");
      return;
    }

    router.push({
      pathname: "/game",
      params: { currentUser: JSON.stringify(currentUser) },
    });
  };

  const getGDPAnimation = async (userId: string): Promise<string | null> => {
    try {
      const gdpPurchasesRef = collection(db, "gdpPurchases");
      const q = query(gdpPurchasesRef, where("userId", "==", userId));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const gdpPurchase = querySnapshot.docs[0].data();
        return gdpPurchase.animationFile || "non-active.json";
      }
      return null;
    } catch (error) {
      console.error("Error getting GDP animation:", error);
      return null;
    }
  };

  const handleHistoryPress = () => {
    router.push("/transaction-history");
  };

  const handleGDPInvestmentPress = () => {
    router.push("/gdp");
  };

  if (isLoading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color="#4CAF50" />
      </View>
    );
  }

  if (!currentUser) {
    return null;
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <View style={styles.header}>
          <Text style={styles.welcomeText}>{t.welcomeBack}</Text>

          <TouchableOpacity
            style={styles.languageButton}
            onPress={() => setShowLanguageModal(true)}
          >
            {(() => {
              const selectedLang =
                languages.find((lang) => lang.code === selectedLanguage) ||
                languages[0];
              return (
                <>
                  <CountryFlag
                    isoCode={selectedLang.isoCode}
                    size={24}
                    style={{ marginRight: 8 }}
                  />
                  <Text style={styles.languageButtonText}>
                    {selectedLang.name}
                  </Text>
                  <AntDesign name="down" size={16} color="#666" />
                </>
              );
            })()}
          </TouchableOpacity>
        </View>

        {/* Balance and GDP Status Section */}
        <View style={styles.balanceSection}>
          <View style={styles.balanceCard}>
            {/* Country Section */}
            <View style={styles.userNameContainer}>
              <Text style={styles.userNameText}>{currentUser.username}</Text>
            </View>

            <View style={styles.balanceContainer}>
              <View style={styles.balanceTextContainer}>
                <Text style={styles.balanceLabel}>{t.balance}</Text>

               <View style={{flexDirection: "row"}}>
                <Text style={styles.currencySymbol}>$</Text>
                <Text style={styles.balanceAmount}>
                  {userBalance.toLocaleString()}
                </Text>
                </View>
              </View>

              {/* <View style={styles.gdpContainer}> */}
              <View style={styles.gdpAnimationContainer}>
                <LottieView
                  source={animationSource}
                  style={styles.gdpAnimation}
                  autoPlay
                  loop
                />
              </View>
            </View>
          </View>
        </View>

        {/* Bitcoin Detail Section */}
        <View style={styles.bitcoinSection}>
          <View style={styles.bitcoinCard}>
            <View style={styles.bitcoinImageContainer}>
              <Image
                source={require("@/assets/images/GDPCoin01.png")}
                style={styles.bitcoinImage}
                resizeMode="contain"
              />
            </View>
            <View style={styles.bitcoinInfo}>
              <Text style={styles.bitcoinTitle}>GDPCOIN</Text>
              <Text style={styles.bitcoinPrice}>${gdpPrice.toFixed(3)}</Text>
            </View>
            <View>
              <TouchableOpacity
                style={styles.buyButton}
                onPress={() => router.push("/token")}
              >
                <Text style={styles.viewButtonText}>{t.buyNow}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <HomeCarousel />

        {/* Quick Actions Section */}
        <View style={styles.actionSection}>
          <Text style={styles.sectionTitle}>{t.quickActions}</Text>
          <View style={styles.actionGrid}>
            <View style={styles.actionWrapper}>
              <TouchableOpacity
                style={[styles.actionSquare, { backgroundColor: "#4A90E2" }]}
                onPress={() => setIsTransactionModalVisible(true)}
              >
                <MaterialCommunityIcons name="send" size={24} color="white" />
              </TouchableOpacity>
              <Text style={styles.actionLabel}>{t.transfer}</Text>
            </View>

            <View style={styles.actionWrapper}>
              <TouchableOpacity
                style={[styles.actionSquare, { backgroundColor: "#27AE60" }]}
                onPress={() => setIsTopUpModalVisible(true)}
              >
                <MaterialCommunityIcons
                  name="cash-plus"
                  size={24}
                  color="white"
                />
              </TouchableOpacity>
              <Text style={styles.actionLabel}>{t.topUp}</Text>
            </View>

            <View style={styles.actionWrapper}>
              <TouchableOpacity
                style={[styles.actionSquare, { backgroundColor: "#9B51E0" }]}
                onPress={handleHistoryPress}
              >
                <MaterialCommunityIcons
                  name="clock-outline"
                  size={24}
                  color="white"
                />
              </TouchableOpacity>
              <Text style={styles.actionLabel}>{t.transactions}</Text>
            </View>

            <View style={styles.actionWrapper}>
              <TouchableOpacity
                style={[styles.actionSquare, { backgroundColor: "#FF5722" }]}
                onPress={() => setShowWithdrawalModal(true)}
              >
                <MaterialCommunityIcons
                  name="cash-minus"
                  size={24}
                  color="white"
                />
              </TouchableOpacity>
              <Text style={styles.actionLabel}>{t.Withdraw}</Text>
            </View>

            <View style={styles.actionWrapper}>
              <TouchableOpacity
                style={[styles.actionSquare, { backgroundColor: "#E91E63" }]}
                onPress={handleStakingPress}
              >
                <MaterialCommunityIcons
                  name="chart-line"
                  size={24}
                  color="white"
                />
              </TouchableOpacity>
              <Text style={styles.actionLabel}>{t.Staking}</Text>
            </View>

            <View style={styles.actionWrapper}>
              <TouchableOpacity
                style={[styles.actionSquare, { backgroundColor: "#FF9800" }]}
                onPress={handleStakingRecordPress}
              >
                <MaterialCommunityIcons
                  name="account-cash"
                  size={24}
                  color="white"
                />
              </TouchableOpacity>
              <Text style={styles.actionLabel}>
                {t.Staking} {t.Record}
              </Text>
            </View>

            <View style={styles.actionWrapper}>
              <TouchableOpacity
                style={[styles.actionSquare, { backgroundColor: "#9C27B0" }]}
                onPress={handleRelationshipPress}
              >
                <MaterialCommunityIcons
                  name="account-group"
                  size={24}
                  color="white"
                />
              </TouchableOpacity>
              <Text style={styles.actionLabel}>{t.Friends}</Text>
            </View>

            <View style={styles.actionWrapper}>
              <TouchableOpacity
                style={[styles.actionSquare, { backgroundColor: "#4CAF50" }]}
                onPress={() => router.push("/payment-confirmation")}
              >
                <MaterialIcons name="approval" size={24} color="white" />
              </TouchableOpacity>
              <Text style={styles.actionLabel}>
                {t.My}({t.deal})
              </Text>
            </View>

            <View style={styles.actionWrapper}>
              <TouchableOpacity
                style={[styles.actionSquare, { backgroundColor: "#2196F3" }]}
                onPress={handleGameScreenPress}
              >
                <MaterialCommunityIcons
                  name="nintendo-game-boy"
                  size={24}
                  color="white"
                />
              </TouchableOpacity>
              <Text style={styles.actionLabel}>{t.game}</Text>
            </View>
          </View>
        </View>

        {/* GDP Investment Section */}
        <View style={styles.gdpSection}>
          <Text style={styles.sectionTitle}>
            {t.gdp} {t.activation}
          </Text>
          <TouchableOpacity
            style={styles.gdpCard}
            onPress={handleGDPInvestmentPress}
          >
            <View style={styles.gdpCardContent}>
              <View>
                <Text style={styles.gdpCardTitle}>
                  {t.GlobalDigitalOperationalPower}
                </Text>
                <Text style={styles.gdpCardSubtitle}>
                  {t.EarnUpTo} 1000% {t.Returns}
                </Text>
              </View>
              <MaterialCommunityIcons
                name="chevron-right"
                size={24}
                color="#666"
              />
            </View>
          </TouchableOpacity>
        </View>

        {/* Modals */}
        <TransactionModal
          isVisible={isTransactionModalVisible}
          onClose={() => setIsTransactionModalVisible(false)}
        />

        <WithdrawalModal
          isVisible={showWithdrawalModal}
          onClose={() => setShowWithdrawalModal(false)}
          userBalance={currentUser?.balance || 0}
        />

        <TopUpBalanceModal
          isVisible={isTopUpModalVisible}
          onClose={() => setIsTopUpModalVisible(false)}
          userId={currentUser?.uid || ""}
          username={currentUser?.username}
          onSuccess={refreshUserData}
        />

        <Modal
          visible={showLanguageModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowLanguageModal(false)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowLanguageModal(false)}
          >
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>{t.selectLanguage}</Text>
              <ScrollView>{languages.map(renderLanguageOption)}</ScrollView>
            </View>
          </TouchableOpacity>
        </Modal>
      </ScrollView>
      </View>
    </SafeAreaView>
  );
};

export default TabOneScreen;

const { width, height } = Dimensions.get("window");

const shadowStyle = Platform.select({
  ios: {
    boxShadow: "0px 2px 8px rgba(0, 0, 0, 0.1)",
  },
  android: {
    elevation: 3,
  },
  default: {
    boxShadow: "0px 2px 8px rgba(0, 0, 0, 0.1)",
  },
});

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F5F7FA",
  },
  container: {
    flex: 1,
    backgroundColor: "#F5F7FA",
  },
  header: {
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#ddd",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: Platform.OS === 'android' ? 40 : 0,
    paddingBottom: 10,
    paddingHorizontal: 16,
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: "600",
    color: "#1E293B",
  },
  actionSection: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#1E293B",
    marginBottom: 16,
  },
  actionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    paddingHorizontal: 4,
  },
  actionWrapper: {
    width: "30%",
    alignItems: "center",
    marginBottom: 20,
  },
  actionSquare: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
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
  actionLabel: {
    fontSize: 14,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 18,
  },
  gdpSection: {
    padding: 20,
  },
  gdpCard: {
    backgroundColor: "white",
    padding: 16,
    borderRadius: 16,
    ...shadowStyle,
  },
  gdpCardContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  gdpCardTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#2D3436",
  },
  gdpCardSubtitle: {
    fontSize: 12,
    color: "#666",
    marginTop: 4,
  },
  loadingContainer: {
    justifyContent: "center",
    alignItems: "center",
  },
  balanceSection: {
    paddingLeft: 5,
    paddingRight: 5,
    paddingBottom: 1,
    paddingTop: 5,
  },
  balanceCard: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 5,
    ...shadowStyle,
  },
  balanceContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  balanceTextContainer: {
    flex: 1,
  },
  balanceLabel: {
    fontSize: 10,
    color: "green",
    marginBottom: 3,
    marginTop: 8,
    marginLeft: 20,
  },
  balanceRow: {
    flexDirection: "row",
    alignItems: "flex-end",
  },
  currencySymbol: {
    fontSize: 12,
    color: "#1E293B",
    fontWeight: "bold",
    marginLeft: 20,
    marginTop: 8,
    marginRight: 5,
  },
  balanceAmount: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#1E293B",
  },
  gdpAnimationContainer: {
    width: 150,
    height: 80,
    marginRight: 20,
    alignItems: "center",
    marginTop: -25,
  },
  gdpAnimation: {
    width: "100%",
    height: "100%",
  },
  userNameContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 20,
  },
  userNameText: {
    fontSize: 18,
    color: "blue",
    fontWeight: "600",
  },
  scrollView: {
    flex: 1,
  },
  bitcoinSection: {
    padding: 10,
    backgroundColor: "red",
  },
  bitcoinCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffff",
    borderRadius: 12,
    padding: 5,
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
  bitcoinImageContainer: {
    width: 30,
    height: 35,
    marginRight: 20,
    marginLeft: 30,
    backgroundColor: "blue",
    borderRadius: 12,
  },
  bitcoinImage: {
    width: "100%",
    height: "100%",
  },
  bitcoinInfo: {
    flex: 1,
  },
  bitcoinTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#1a1a1a",
    marginBottom: 1,
    marginTop: 10,
  },
  bitcoinPrice: {
    fontSize: 13,
    color: "#2196F3",
    fontWeight: "600",
    marginBottom: 12,
  },
  buyButton: {
    backgroundColor: "transparent",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    alignSelf: "flex-start",
    marginRight: 50,
  },
  viewButtonText: {
    color: "green",
    fontWeight: "bold",
    fontSize: 14,
  },
  languageButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderRadius: 8,
    backgroundColor: "#f5f5f5",
    alignSelf: "flex-end",
    marginRight: 10,
  },
  languageButtonText: {
    fontSize: 16,
    color: "#333",
    marginRight: 5,
  },
  languageOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: 15,
    borderRadius: 8,
  },
  languageOptionText: {
    fontSize: 16,
    color: "#333",
    flex: 1,
  },
  selectedLanguage: {
    backgroundColor: "#f0f0f0",
  },
  selectedLanguageText: {
    color: "#007AFF",
    fontWeight: "600",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: "#fff",
    width: "100%",
    maxWidth: 400,
    maxHeight: height * 0.7,
    borderRadius: 15,
    padding: 20,
    ...Platform.select({
      ios: {
        boxShadow: "0px 3px 6px rgba(0, 0, 0, 0.2)",
      },
      android: {
        elevation: 5,
      },
      default: {
        boxShadow: "0px 3px 6px rgba(0, 0, 0, 0.2)",
      },
    }),
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 15,
    textAlign: "center",
  },
});
