import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Modal,
  FlatList,
  Dimensions,
} from "react-native";
import { Text } from "@/components/Themed";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { db, auth } from "@/firebase";
import {
  collection,
  doc,
  setDoc,
  getDocs,
  query,
  where,
  arrayUnion,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { generate } from "referral-codes";
import { useRouter, useLocalSearchParams } from "expo-router";
import { CreateUserData } from "@/types/user";
import { Ionicons } from "@expo/vector-icons";
import CountryFlag from "react-native-country-flag";
import AntDesign from '@expo/vector-icons/AntDesign';

// Import country data and the Country interface
import { countriesList, Country } from "@/utils/countries";
import { userService } from "@/services/userService";
import showAlert from "@/components/CustomAlert/ShowAlert";
import { useLanguage } from "@/hooks/useLanguage";

const { width, height } = Dimensions.get('window');

type RegisterScreenParams = {
  group?: string;
  referralCode?: string;
  parentId?: string;
};

type GroupType = "A" | "B";

// const bankList = [
//   { code: "bank1", name: "Bank 1" },
//   { code: "bank2", name: "Bank 2" },
//   { code: "bank3", name: "Bank 3" },
// ];

export default function RegisterScreen() {
  const { t } = useLanguage();
  const router = useRouter();
  const params = useLocalSearchParams<RegisterScreenParams>();

  // Add parentId state
  const [parentId, setParentId] = useState<string | undefined>(params.parentId);
  const [parentReferralCode, setParentReferralCode] = useState<string | undefined>(params.referralCode);

  useEffect(() => {
    if (params.parentId) {
      setParentId(params.parentId);
    }
    if (params.referralCode) {
      setParentReferralCode(params.referralCode);
    }
  }, [params.parentId, params.referralCode]);

  // Form state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [isUsernameAvailable, setIsUsernameAvailable] = useState(true);
  // const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const [selectedEmailDomain, setSelectedEmailDomain] = useState('@email1.com');

  // Country selection state
  const [country, setCountry] = useState("");
  const [state, setState] = useState("");
  const [town, setTown] = useState("");
  const [livingAddress, setLivingAddress] = useState("");
  const [showCountryModal, setShowCountryModal] = useState(false);
  const [countrySearch, setCountrySearch] = useState("");
  const [filteredCountries, setFilteredCountries] = useState<Country[]>(countriesList);

  // Bank information state
  const [bankName, setBankName] = useState("");
  const [bankAccount, setBankAccount] = useState("");
  const [digitalBank, setDigitalBank] = useState("");
  const [digitalBankName, setDigitalBankName] = useState("");
  const [bankNumber, setBankNumber] = useState("");
  const [selectedBank, setSelectedBank] = useState("");
  const [showBankModal, setShowBankModal] = useState(false);

  // Parent and group state
  const [parentUsername, setParentUsername] = useState<string>("");
  // const [parentGroup, setParentGroup] = useState<GroupType>(params.group as GroupType || "A");
  const [group, setGroup] = useState<GroupType>(params.group as GroupType || "A");

  // Other state
  const [errorMessage, setErrorMessage] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  // const [loginMethod, setLoginMethod] = useState('email');
  const [transactionPassword, setTransactionPassword] = useState("");
  const [showTransactionPassword, setShowTransactionPassword] = useState(false);

  // // Language state
  // const [selectedLanguage, setSelectedLanguage] = useState<string>('en');
  // const [t, setT] = useState(translations[selectedLanguage].translations);

  // // Load saved language preference and listen for changes
  // useEffect(() => {
  //   const loadLanguage = async () => {
  //     try {
  //       const savedLanguage = await AsyncStorage.getItem('selectedLanguage');
  //       if (savedLanguage && translations[savedLanguage]) {
  //         setSelectedLanguage(savedLanguage);
  //         setT(translations[savedLanguage].translations);
  //       }
  //     } catch (error) {
  //       console.error('Error loading language:', error);
  //     }
  //   };

  //   loadLanguage();
  // }, []);

  // Save language preference when changed
  // const handleLanguageChange = async (code: string) => {
  //   if (code && translations[code]) {
  //     setSelectedLanguage(code);
  //     setT(translations[code].translations);
  //     await AsyncStorage.setItem("selectedLanguage", code);
  //     setShowLanguageModal(false);
  //   }
  // };

  // Function to generate a unique referral code
  const generateUniqueReferralCode = async (): Promise<string> => {
    let isUnique = false;
    let referralCode = "";

    while (!isUnique) {
      referralCode = generate({
        length: 4,
        count: 1,
        charset: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
      })[0];

      // Check if the referral code already exists
      const usersRef = collection(db, "users");
      const q = query(usersRef, where("referralCode", "==", referralCode));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        isUnique = true;
      }
    }

    return referralCode;
  };

  const verifyParentReferralCode = async () => {
    if (!parentReferralCode) return;

    try {
      const usersRef = collection(db, "users");
      const q = query(usersRef, where("referralCode", "==", parentReferralCode));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const parentDoc = querySnapshot.docs[0];
        const parentData = parentDoc.data();
        setParentUsername(parentData.username || "");
        setParentId(parentDoc.id);
      } else {
        setParentUsername("");
        setParentId("");
      }
    } catch (error) {
      console.error("Error verifying referral code:", error);
      setParentUsername("");
      setParentId("");
    }
  };

  useEffect(() => {
    if (parentReferralCode) {
      verifyParentReferralCode();
    } else {
      setParentUsername("");
      setParentId("");
    }
  }, [parentReferralCode]);

  useEffect(() => {
    if (username) {
      checkUsernameAvailability(username);
    }
  }, [username]);

  const checkUsernameAvailability = async (
    username: string
  ): Promise<boolean> => {
    if (username.length < 3) {
      setIsUsernameAvailable(false);
      return false;
    }

    try {
      const usersRef = collection(db, "users");
      const q = query(usersRef, where("username", "==", username));
      const querySnapshot = await getDocs(q);

      const isAvailable = querySnapshot.empty;
      setIsUsernameAvailable(isAvailable);
      return isAvailable;
    } catch (error) {
      console.error("Error checking username availability:", error);
      setIsUsernameAvailable(false);
      return false;
    }
  };

  const handleRegister = async () => {
    // Trim whitespace from email
    const trimmedEmail = email.trim();

    if (!trimmedEmail || !password || !username || !fullName || !transactionPassword) {
      showAlert(t.error, t.fillAllFields);
      return;
    }

    // Validate email format
    if (selectedEmailDomain === '@email1.com') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(trimmedEmail)) {
        showAlert(t.error, t.invalidEmail);
        return;
      }
    } else if (!trimmedEmail.endsWith('@email2.com')) {
      showAlert(t.error, t.invalidEmail);
      return;
    }

    // Check password length
    if (password.length < 6) {
      showAlert(t.error, t.invalidPassword);
      return;
    }

    // Check transaction password length
    if (transactionPassword.length !== 6) {
      showAlert(t.error, t.invalidTransactionPassword);
      return;
    }

    // Check username availability
    if (!isUsernameAvailable) {
      showAlert(t.error, t.usernameTaken);
      return;
    }

    try {

      // Create user account
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        trimmedEmail,
        password
      );

      // Generate unique referral code
      const referralCode = await generateUniqueReferralCode();

      // Create base user data object
      const baseUserData: Omit<CreateUserData, 'parentId'> = {
        email: trimmedEmail,
        username,
        fullName,
        country,
        state,
        town,
        phoneNumber,
        livingAddress,
        bankName,
        bankAccount,
        digitalBank,
        digitalBankName,
        bankNumber,
        selectedBank,
        transactionPassword,
        balance: 0,
        token: 0,
        role: "user" as const,
        referralCode,
        children: [],
        group: params.group as GroupType || group || "A",
        password,
        gdpStatus: "inactive" as const,
        gdp: 0,
        shares: 0,
        photoURL: null,
        timestamp: serverTimestamp() as any,
      };

      // Add parentId only if it exists
      const userData = parentId
        ? { ...baseUserData, parentId }
        : baseUserData;

      // Save user data to Firestore
      await setDoc(doc(db, "users", userCredential.user.uid), userData);

      // Update parent's children array if parent exists and has referral code
      if (parentId && parentReferralCode) {
        const usersRef = collection(db, "users");
        const q = query(usersRef, where("referralCode", "==", parentReferralCode));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty && userCredential.user?.uid) {
          const parentDoc = querySnapshot.docs[0];
          await updateDoc(doc(db, "users", parentDoc.id), {
            children: arrayUnion(userCredential.user.uid),
          });
        }
      }

      // Handle navigation based on registration context
      if (parentId) {
        try {
          // If registering from group screens, go back to parent's tabs
          const parentData = await userService.getUserById(parentId);
          if (parentData?.email && parentData?.password) {
            // Sign out the new user
            await signOut(auth);
            // Sign back in as parent
            await signInWithEmailAndPassword(auth, parentData.email, parentData.password);
            showAlert(
              t.success,
              t.registerSuccess,
              [
                {
                  text: 'OK',
                  onPress: () => {
                    router.replace("/(tabs)");
                  }
                }
              ]
            );
          }
        } catch (error) {
          console.error("Error handling parent session:", error);
          showAlert(t.error, t.registerFailed);
        }
      } else {
        // Normal registration flow
        showAlert(t.success, t.registerSuccess);
        await signOut(auth);
        router.replace("/(auth)/login");
      }
    } catch (error) {
      console.error("Registration error:", error);
      showAlert(t.error, t.registerFailed);
    }
  };

  const handleGroupChange = (newGroup: GroupType) => {
    if (!params.group) {
      setGroup(newGroup);
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const toggleTransactionPasswordVisibility = () => {
    setShowTransactionPassword(!showTransactionPassword);
  };

  const handleCountrySearch = (text: string) => {
    setCountrySearch(text);
    const filtered = countriesList.filter((country: Country) =>
      country.name.toLowerCase().includes(text.toLowerCase())
    );
    setFilteredCountries(filtered);
  };

  const renderGroupSelection = () => {
    return (
      <View style={styles.groupSelectionContainer}>
        <Text style={styles.groupLabel}>{t.select} {t.group}</Text>
        <View style={styles.groupButtonsContainer}>
          <TouchableOpacity
            style={[
              styles.groupButton,
              group === "A" && styles.groupButtonSelected,
            ]}
            onPress={() => handleGroupChange("A")}
            disabled={!!params.group}
          >
            <Text
              style={[
                styles.groupButtonText,
                group === "A" && styles.groupButtonTextSelected,
              ]}
            >
              {t.group} {group === "A" ? `(${t.Selected})` : ""}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.groupButton,
              group === "B" && styles.groupButtonSelected,
            ]}
            onPress={() => handleGroupChange("B")}
            disabled={!!params.group}
          >
            <Text
              style={[
                styles.groupButtonText,
                group === "B" && styles.groupButtonTextSelected,
              ]}
            >
              {t.group} {group === "B" ? `(${t.Selected})` : ""}
            </Text>
          </TouchableOpacity>
        </View>
        {params.group && (
          <Text style={styles.groupNote}>
            {t.GroupIsPreSelectedBasedOnParentChoice}
          </Text>
        )}
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1 }}
    >
      <ScrollView
        contentContainerStyle={styles.scrollViewContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.container}>

          <Text style={styles.headerText}>{t.createAccount}</Text>

          {/* Essential Information Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t.essentialInformation}</Text>

            <View style={styles.loginMethodContainer}>
              <TouchableOpacity
                style={[
                  styles.methodButton,
                  selectedEmailDomain === '@email1.com' && styles.methodButtonActive,
                ]}
                onPress={() => {
                  setSelectedEmailDomain('@email1.com');
                  // Keep username if switching from Email 2
                  if (email.endsWith('@email2.com')) {
                    setEmail(email.split('@')[0]);
                  }
                }}
              >
                <AntDesign name="mail" size={20} color={selectedEmailDomain === '@email1.com' ? "#fff" : "#666"} />
                <Text style={[styles.methodButtonText, selectedEmailDomain === '@email1.com' && styles.methodButtonTextActive]}>{t.email}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.methodButton,
                  selectedEmailDomain === '@email2.com' && styles.methodButtonActive,
                ]}
                onPress={() => {
                  setSelectedEmailDomain('@email2.com');
                  // Only append @email2.com if it's not already there
                  if (!email.endsWith('@email2.com')) {
                    setEmail(email ? email.split('@')[0] + '@email2.com' : '@email2.com');
                  }
                }}
              >
                <AntDesign name="phone" size={20} color={selectedEmailDomain === '@email2.com' ? "#fff" : "#666"} />
                <Text style={[styles.methodButtonText, selectedEmailDomain === '@email2.com' && styles.methodButtonTextActive]}>{t.phone}</Text>
              </TouchableOpacity>
            </View>

            {selectedEmailDomain === '@email1.com' ? (
              <View style={styles.emailInputContainer}>
                <TextInput
                  style={[styles.input, styles.emailInput, { flex: 1 }]}
                  placeholder={t.emailAddress}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  placeholderTextColor="#666"
                />
              </View>
            ) : (
              <View style={styles.emailInputContainer}>
                <TextInput
                  style={[styles.input, styles.emailInput, { flex: 1 }]}
                  placeholder={t.phoneNumber}
                  value={email.split('@')[0]}
                  onChangeText={(text) => setEmail(text + '@email2.com')}
                  keyboardType="phone-pad"
                  autoCapitalize="none"
                  autoComplete="tel"
                  placeholderTextColor="#666"
                />
              </View>
            )}

            <TextInput
              style={[
                styles.input,
                !isUsernameAvailable && styles.invalidInput,
              ]}
              placeholder={t.username}
              value={username}
              onChangeText={(text) => {
                setUsername(text);
                checkUsernameAvailability(text);
              }}
              placeholderTextColor="#666"
            />
            {!isUsernameAvailable && (
              <Text style={styles.errorText}>
                {t.usernameTaken}
              </Text>
            )}

            <TextInput
              style={styles.input}
              placeholder={t.fullName}
              value={fullName}
              onChangeText={setFullName}
              placeholderTextColor="#666"
            />

            <View style={styles.passwordContainer}>
              <TextInput
                style={styles.passwordInput}
                placeholder={t.login_password}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                placeholderTextColor="#666"
              />
              <TouchableOpacity
                onPress={togglePasswordVisibility}
                style={styles.eyeIcon}
              >
                <Ionicons
                  name={showPassword ? "eye-off" : "eye"}
                  size={24}
                  color="#666"
                />
              </TouchableOpacity>
            </View>
            
            <View style={styles.passwordContainer}>
              <TextInput
                style={styles.passwordInput}
                placeholder={t.transactionPassword}
                value={transactionPassword}
                keyboardType="numeric"
                onChangeText={setTransactionPassword}
                secureTextEntry={!showTransactionPassword}
                placeholderTextColor="#666"
              />
              <TouchableOpacity
                onPress={toggleTransactionPasswordVisibility}
                style={styles.eyeIcon}
              >
                <Ionicons
                  name={showTransactionPassword ? "eye-off" : "eye"}
                  size={24}
                  color="#666"
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Location Information Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t.locationInformation}</Text>
            <TouchableOpacity
              style={styles.countryPickerButton}
              onPress={() => setShowCountryModal(true)}
            >
              {country ? (
                <View style={styles.selectedCountry}>
                  <CountryFlag isoCode={country} size={24} />
                  <Text style={styles.selectedCountryText}>
                    {countriesList.find((c) => c.code === country)?.name}
                  </Text>
                </View>
              ) : (
                <Text style={styles.placeholderText}>{t.selectCountry}</Text>
              )}
            </TouchableOpacity>

          </View>

          {/* Contact Information Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t.contactInformation}</Text>
            <TextInput
              style={styles.input}
              placeholder={t.phoneNumber}
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              keyboardType="phone-pad"
              placeholderTextColor="#666"
            />

          </View>

          {/* Referral Information Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t.your_friend_account_code}</Text>
            <TextInput
              style={styles.input}
              placeholder={t.parentReferralCode}
              value={parentReferralCode}
              onChangeText={setParentReferralCode}
              autoCapitalize="characters"
              maxLength={4}
              editable={!params.referralCode}
              placeholderTextColor="#666"
            />
            {parentUsername && (
              <Text style={styles.successText}>{t.friend} {parentUsername}</Text>
            )}
            {errorMessage && (
              <Text style={styles.errorText}>{errorMessage}</Text>
            )}
          </View>

          {/* Group Selection */}
          {renderGroupSelection()}

          {/* Buttons */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, styles.registerButton]}
              onPress={handleRegister}
            >
              <Text style={styles.buttonText}>{t.signUp}</Text>
            </TouchableOpacity>

            <View style={styles.loginContainer}>
              <Text style={styles.loginText}>{t.alreadyHaveAccount}</Text>
              <TouchableOpacity
                onPress={() => router.push("/(auth)/login")}
              >
                <Text style={styles.loginLink}>{t.login}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Country Picker Modal */}
      <Modal
        visible={showCountryModal}
        animationType="slide"
        transparent={true}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalHeaderTitle}>{t.selectCountry}</Text>
              <TouchableOpacity
                onPress={() => {
                  setShowCountryModal(false);
                  setCountrySearch("");
                }}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.searchInput}
              placeholder={t.searchCountries}
              value={countrySearch}
              onChangeText={handleCountrySearch}
              placeholderTextColor="#666"
            />
            <FlatList
              data={filteredCountries}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.countryItem}
                  onPress={() => {
                    setCountry(item.code);
                    setShowCountryModal(false);
                    setCountrySearch("");
                  }}
                >
                  <CountryFlag isoCode={item.code} size={24} />
                  <Text style={styles.countryName}>{item.name}</Text>
                </TouchableOpacity>
              )}
              keyExtractor={(item) => item.code}
              style={styles.countryList}
            />
          </View>
        </View>
      </Modal>

      <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
        <Text style={styles.backButtonText}>{t.back}</Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scrollViewContent: {
    flexGrow: 1,
    minHeight: height,
    paddingVertical: 40,
  },
  container: {
    flex: 1,
    padding: 20,
    position: 'relative',
    backgroundColor: "#fff",
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
        boxShadow: '0px 3px 6px rgba(0, 0, 0, 0.2)',
      },
      android: {
        elevation: 5,
      },
      default: {
        boxShadow: '0px 3px 6px rgba(0, 0, 0, 0.2)',
      },
    }),
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  modalCloseButton: {
    padding: 5,
  },
  languageList: {
    flex: 1,
  },
  languageOption: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 15,
    borderRadius: 10,
    marginBottom: 2,
  },
  selectedLanguage: {
    backgroundColor: "#f5f5f5",
  },
  languageOptionText: {
    fontSize: 16,
    color: "#333",
  },
  selectedLanguageText: {
    color: "#007AFF",
    fontWeight: "600",
  },
  headerText: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "center",
    color: "#333",
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 12,
    color: "#333",
  },
  input: {
    height: 50,
    backgroundColor: "#f5f5f5",
    borderRadius: 8,
    paddingHorizontal: 16,
    marginBottom: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  multilineInput: {
    height: 100,
    paddingTop: 12,
    paddingBottom: 12,
    textAlignVertical: "top",
  },
  passwordContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  passwordInput: {
    flex: 1,
    height: 50,
    paddingHorizontal: 16,
    fontSize: 16,
  },
  eyeIcon: {
    padding: 12,
  },
  buttonContainer: {
    marginTop: 24,
    gap: 12,
  },
  button: {
    height: 50,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  registerButton: {
    backgroundColor: "#2f95dc",
  },
  closeButton: {
    padding: 8,
  },
  closeButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '500',
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  errorText: {
    color: "#ff3b30",
    fontSize: 14,
    marginTop: 4,
  },
  successText: {
    color: "#34c759",
    fontSize: 14,
    marginTop: 4,
  },
  modalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    padding: 20,
  },
  bankModalContent: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 20,
    width: "100%",
    maxHeight: "80%",
  },
  bankModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  bankModalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
  },
  searchInput: {
    height: 40,
    backgroundColor: "#f5f5f5",
    borderRadius: 8,
    paddingHorizontal: 16,
    marginBottom: 12,
    fontSize: 16,
  },
  countryList: {
    maxHeight: 300,
  },
  countryItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  countryName: {
    marginLeft: 12,
    fontSize: 16,
    color: "#333",
  },
  invalidInput: {
    borderColor: "#ff3b30",
  },
  groupSelectionContainer: {
    marginBottom: 24,
  },
  groupButtonsContainer: {
    flexDirection: "row",
    gap: 12,
  },
  groupButton: {
    flex: 1,
    height: 50,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
    borderWidth: 1,
    borderColor: "#ddd",
  },
  groupButtonSelected: {
    backgroundColor: "#2f95dc",
    borderColor: "#2f95dc",
  },
  groupButtonText: {
    fontSize: 16,
    color: "#666",
  },
  groupButtonTextSelected: {
    color: "#fff",
  },
  pickerLabel: {
    fontSize: 16,
    fontWeight: "500",
    marginBottom: 8,
    color: "#333",
  },
  groupNote: {
    fontSize: 12,
    color: "#666",
    marginTop: 8,
    textAlign: "center",
    fontStyle: "italic",
  },
  countryPickerButton: {
    height: 50,
    backgroundColor: "#f5f5f5",
    borderRadius: 8,
    paddingHorizontal: 16,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  selectedCountry: {
    flexDirection: "row",
    alignItems: "center",
  },
  selectedCountryText: {
    marginLeft: 12,
    fontSize: 16,
    color: "#333",
  },
  placeholderText: {
    fontSize: 16,
    color: "#666",
  },
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
    gap: 8,
  },
  loginText: {
    color: '#666',
    fontSize: 16,
  },
  loginLink: {
    color: '#2196F3',
    fontSize: 16,
    fontWeight: '600',
  },
  emailContainer: {
    marginBottom: 15,
  },
  emailInput: {
    marginBottom: 0,
  },
  loginMethodContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 20,
    gap: 10,
  },
  methodButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    gap: 8,
  },
  methodButtonActive: {
    backgroundColor: '#2196F3',
  },
  methodButtonText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '600',
  },
  methodButtonTextActive: {
    color: '#fff',
  },
  emailInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
    width: '100%',
  },
  languageSelectorContainer: {
    marginBottom: 24,
  },
  modalHeaderTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
  },
  groupLabel: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 12,
    color: "#333",
  },
  languageItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 15,
    borderRadius: 10,
    marginBottom: 2,
  },
  selectedLanguageItem: {
    backgroundColor: "#f5f5f5",
  },
  languageText: {
    fontSize: 16,
    color: "#333",
  },
  bankItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  selectedBank: {
    color: '#007AFF',
    fontSize: 18,
    fontWeight: '600',
  },
  bankText: {
    fontSize: 16,
    color: "#333",
  },
  selectedBankText: {
    color: "#007AFF",
    fontWeight: "600",
  },
  bankPickerButton: {
    height: 50,
    backgroundColor: "#f5f5f5",
    borderRadius: 8,
    paddingHorizontal: 16,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
  },
  backButton: {
    marginTop: 20,
    backgroundColor: "#757575",
    padding: 15,
    borderRadius: 8,
    alignItems: "center",
    ...Platform.select({
      ios: {
        boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.25)',
      },
      android: {
        elevation: 3,
      },
      default: {
        boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.25)',
      },
    }),
  },
  backButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
});
