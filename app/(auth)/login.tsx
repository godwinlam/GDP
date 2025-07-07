import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  TextInput,
  View,
  Text,
  TouchableOpacity,
  Alert,
  Modal,
  ScrollView,
  Platform,
  SafeAreaView,
  Dimensions,
  Image,
} from "react-native";
import { AntDesign } from "@expo/vector-icons";
import { router } from "expo-router";
import { auth, db } from "@/firebase";
import {
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  signInWithCredential,
} from "firebase/auth";
import { collection, query, where, getDocs } from "firebase/firestore";
import CountryFlag from "react-native-country-flag";
import { useLanguage, languages } from "@/hooks/useLanguage";
import showAlert from "@/components/CustomAlert/ShowAlert";

interface LoginScreenProps {}

const LoginScreen: React.FC<LoginScreenProps> = () => {
  const {
    selectedLanguage,
    showLanguageModal,
    setShowLanguageModal,
    t,
    handleLanguageChange,
  } = useLanguage();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedEmailDomain, setSelectedEmailDomain] = useState("@email1.com");
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetLoading, setResetLoading] = useState(false);

  const isValidEmail = (email: string): boolean => {
    if (selectedEmailDomain === "@email1.com") {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(email);
    }
    return /^\d+@email2\.com$/.test(email);
  };

  const handleForgotPassword = async () => {
    const trimmedEmail = resetEmail.trim();
    if (!trimmedEmail) {
      showAlert(t.error, t.fillAllFields);
      return;
    }

    if (!isValidEmail(trimmedEmail)) {
      showAlert(
        t.error,
        selectedEmailDomain === "@email1.com" ? t.invalidEmail : t.invalidPhone
      );
      return;
    }

    setResetLoading(true);
    try {
      const q = query(
        collection(db, "users"),
        where("email", "==", trimmedEmail.toLowerCase())
      );
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        showAlert(
          t.error,
          selectedEmailDomain === "@email1.com"
            ? t.emailNotRegistered
            : t.phoneNotRegistered
        );
        return;
      }

      await sendPasswordResetEmail(auth, trimmedEmail.toLowerCase());
      showAlert(t.success, t.resetPasswordSuccess, [
        {
          text: t.confirm,
          onPress: () => {
            setShowForgotPassword(false);
            setResetEmail("");
          },
        },
      ]);
    } catch (error) {
      console.error("Password reset error:", error);
      showAlert(
        t.error,
        error instanceof Error ? error.message : t.resetPasswordError
      );
    } finally {
      setResetLoading(false);
    }
  };

  const handleLogin = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      showAlert(t.error, t.fillAllFields);
      return;
    }

    if (!isValidEmail(trimmedEmail)) {
      showAlert(
        t.error,
        selectedEmailDomain === "@email1.com" ? t.invalidEmail : t.invalidPhone
      );
      return;
    }

    setLoading(true);
    try {
      await signInWithEmailAndPassword(
        auth,
        trimmedEmail.toLowerCase(),
        password
      );
      router.replace("/(tabs)");
    } catch (error) {
      console.error("Login error:", error);
      showAlert(t.error, t.invalidEmail);
    } finally {
      setLoading(false);
    }
  };

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

  return (
    <SafeAreaView style={styles.container}>
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

      <Modal
        visible={showForgotPassword}
        transparent
        animationType="fade"
        onRequestClose={() => setShowForgotPassword(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t.resetPassword}</Text>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setShowForgotPassword(false)}
              >
                <AntDesign name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.input}
              placeholder={
                selectedEmailDomain === "@email1.com"
                  ? t.enterEmail
                  : t.enterPhone
              }
              value={resetEmail}
              onChangeText={setResetEmail}
              keyboardType={
                selectedEmailDomain === "@email1.com"
                  ? "email-address"
                  : "numeric"
              }
              autoCapitalize="none"
            />

            <View style={styles.modalButtonContainer}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowForgotPassword(false)}
              >
                <Text style={styles.cancelButtonText}>{t.cancel}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmButton}
                onPress={handleForgotPassword}
                disabled={resetLoading}
              >
                <Text style={styles.confirmButtonText}>
                  {resetLoading ? t.loading : t.confirm}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.content}>
          <View style={styles.formContainer}>
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

            <Image
              source={require("../../assets/images/GDP-logo-02.png")}
              style={styles.logo}
              resizeMode="contain"
            />
            <View style={styles.titleContainer}>
              <Text style={styles.title}>{t.welcomeBack}</Text>
            </View>

            <View style={styles.methodContainer}>
              <TouchableOpacity
                style={[
                  styles.methodButton,
                  selectedEmailDomain === "@email1.com" &&
                    styles.methodButtonActive,
                ]}
                onPress={() => setSelectedEmailDomain("@email1.com")}
              >
                <Text
                  style={[
                    styles.methodButtonText,
                    selectedEmailDomain === "@email1.com" &&
                      styles.methodButtonTextActive,
                  ]}
                >
                  {t.email}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.methodButton,
                  selectedEmailDomain === "@email2.com" &&
                    styles.methodButtonActive,
                ]}
                onPress={() => setSelectedEmailDomain("@email2.com")}
              >
                <Text
                  style={[
                    styles.methodButtonText,
                    selectedEmailDomain === "@email2.com" &&
                      styles.methodButtonTextActive,
                  ]}
                >
                  {t.phone}
                </Text>
              </TouchableOpacity>
            </View>

            {selectedEmailDomain === "@email1.com" ? (
              <TextInput
                style={styles.input}
                placeholder={t.enterEmail}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            ) : (
              <TextInput
                style={styles.input}
                placeholder={t.enterPhone}
                value={email.split("@")[0]}
                onChangeText={(text) => setEmail(`${text}@email2.com`)}
                keyboardType="numeric"
              />
            )}

            <View style={styles.passwordContainer}>
              <TextInput
                style={styles.passwordInput}
                placeholder={t.enterPassword}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity
                style={styles.showPasswordButton}
                onPress={() => setShowPassword(!showPassword)}
              >
                <AntDesign
                  name={showPassword ? "eye" : "eyeo"}
                  size={24}
                  color="#666"
                />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.button}
              onPress={handleLogin}
              disabled={loading}
            >
              <Text style={styles.buttonText}>
                {loading ? t.loading : t.login}
              </Text>
            </TouchableOpacity>

            <View style={styles.registerContainer}>
              <Text style={styles.registerText}>{t.dontHaveAccount}</Text>
              <TouchableOpacity onPress={() => router.push("/(auth)/register")}>
                <Text style={styles.registerLink}>{t.register}</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.forgotPasswordButton}
              onPress={() => setShowForgotPassword(true)}
            >
              <Text style={styles.forgotPasswordText}>{t.forgotPassword}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const { width, height } = Dimensions.get("window");

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffff",
  },
  scrollContent: {
    flexGrow: 1,
    minHeight: height,
    paddingVertical: 15,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 5,
    position: "relative",
  },
  formContainer: {
    width: "100%",
    maxWidth: 400,
    alignItems: "center",
    backgroundColor: "#000",
    borderRadius: 15,
    padding: 20,
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
  logo: {
    width: 180,
    height: 180,
    marginBottom: 15,
    marginTop: 20,
    alignSelf: "center",
  },
  titleContainer: {
    width: "100%",
    alignItems: "center",
    marginBottom: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#fff",
    textAlign: "center",
  },
  input: {
    backgroundColor: "#f5f5f5",
    width: "100%",
    height: 50,
    borderRadius: 10,
    paddingHorizontal: 15,
    fontSize: 16,
    color: "#333",
    marginBottom: 15,
  },
  button: {
    backgroundColor: "#007AFF",
    width: "100%",
    height: 50,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 15,
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
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  forgotPasswordButton: {
    marginTop: 15,
  },
  forgotPasswordText: {
    color: "red",
    fontSize: 16,
    textAlign: "center",
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
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 15,
    textAlign: "center",
  },
  modalCloseButton: {
    padding: 5,
  },
  modalButtonContainer: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 20,
  },
  cancelButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: "#f5f5f5",
  },
  confirmButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: "#007AFF",
  },
  cancelButtonText: {
    color: "#666",
    fontSize: 16,
    fontWeight: "600",
  },
  confirmButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  passwordContainer: {
    position: "relative",
    width: "100%",
    marginBottom: 20,
  },
  passwordInput: {
    backgroundColor: "#f5f5f5",
    width: "100%",
    height: 50,
    borderRadius: 10,
    paddingHorizontal: 15,
    paddingRight: 50,
    fontSize: 16,
    color: "#333",
  },
  showPasswordButton: {
    position: "absolute",
    right: 15,
    top: "50%",
    transform: [{ translateY: -12 }],
  },
  registerContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 5,
  },
  registerText: {
    color: "#ffff",
    fontSize: 16,
    marginRight: 5,
  },
  registerLink: {
    color: "yellow",
    fontSize: 16,
    fontWeight: "600",
  },
  languageButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderRadius: 8,
    backgroundColor: "#f5f5f5",
    alignSelf: "flex-end",
    marginTop: 10,
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
  methodContainer: {
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: 20,
    backgroundColor: "#f5f5f5",
    borderRadius: 10,
    padding: 4,
    width: "100%",
  },
  methodButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  methodButtonActive: {
    backgroundColor: "#007AFF",
    ...Platform.select({
      ios: {
        boxShadow: "0px 1px 2px rgba(0, 0, 0, 0.1)",
      },
      android: {
        elevation: 2,
      },
      default: {
        boxShadow: "0px 1px 2px rgba(0, 0, 0, 0.1)",
      },
    }),
  },
  methodButtonText: {
    fontSize: 16,
    color: "#333",
    fontWeight: "500",
  },
  methodButtonTextActive: {
    color: "#fff",
    fontWeight: "600",
  },
});

export default LoginScreen;
