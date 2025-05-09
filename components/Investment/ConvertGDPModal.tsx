import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { doc, runTransaction, addDoc, collection, Timestamp, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/firebase';
import { User, GDPPurchase } from '@/types/user';
import { useLanguage } from '@/hooks/useLanguage';
import showAlert from '../CustomAlert/ShowAlert';


interface ConvertGDPModalProps {
  visible: boolean;
  onClose: () => void;
  animationFile: string;
  gdpPrice: number;
  quantity: number;
  user: User;
  onSuccess: () => void;
}

export default function ConvertGDPModal({
  visible,
  onClose,
  animationFile,
  gdpPrice,
  quantity,
  user,
  onSuccess,
}: ConvertGDPModalProps) {
  const { t } = useLanguage();

  const [loading, setLoading] = useState(false);

  const handleConvert = async () => {
    if (loading) return;
    setLoading(true);
    console.log('Starting conversion for:', animationFile);
    console.log('Current quantity:', quantity);

    try {
      await runTransaction(db, async (transaction) => {
        // Get user document
        const userRef = doc(db, "users", user.uid);
        const userDoc = await transaction.get(userRef);

        if (!userDoc.exists()) {
          throw new Error("User document not found");
        }

        const userData = userDoc.data() as User;
        const conversionAmount = gdpPrice;
        console.log('User data:', userData);
        console.log('Conversion amount:', conversionAmount);

        // Get all GDP purchases for this animation
        const gdpPurchasesRef = collection(db, "gdpPurchases");
        const gdpQuery = query(
          gdpPurchasesRef,
          where("userId", "==", user.uid),
          where("animationFile", "==", animationFile)
        );

        const gdpSnapshot = await getDocs(gdpQuery);
        console.log('Found GDP purchases:', gdpSnapshot.size);

        if (gdpSnapshot.empty) {
          // throw new Error("No GDP purchases found");
          showAlert(t.error, `${t.no} GDP ${t.purchased} ${t.information}`);
          return;
        }

        // Find the first purchase that has quantity > 0
        let gdpPurchaseToUpdate: GDPPurchase | null = null;
        for (const doc of gdpSnapshot.docs) {
          const data = doc.data();
          const currentAmount = data.amount || data.gdpPurchased || 0;
          console.log('Checking purchase:', data, 'Current amount:', currentAmount);
          if (currentAmount > 0) {
            gdpPurchaseToUpdate = {
              ...data,
              id: doc.id
            } as GDPPurchase;
            break;
          }
        }

        if (!gdpPurchaseToUpdate) {
          // throw new Error("No available GDP to convert");
          showAlert(t.error, `${t.no} ${t.available} GDP ${t.information}`);
          return;
        }

        console.log('Updating GDP purchase:', gdpPurchaseToUpdate);

        // Update user balance
        transaction.update(userRef, {
          balance: (userData.balance || 0) + conversionAmount,
        });

        // Update GDP purchase
        const gdpPurchaseRef = doc(db, "gdpPurchases", gdpPurchaseToUpdate.id);
        const currentAmount = gdpPurchaseToUpdate.amount || gdpPurchaseToUpdate.gdpPurchased || 0;
        const newAmount = currentAmount - 1;

        // Update both fields to ensure consistency
        const updateData: Partial<GDPPurchase> = {};
        if (typeof gdpPurchaseToUpdate.amount !== 'undefined') {
          updateData.amount = newAmount;
        }
        if (typeof gdpPurchaseToUpdate.gdpPurchased !== 'undefined') {
          updateData.gdpPurchased = newAmount;
        }

        transaction.update(gdpPurchaseRef, updateData);

        // Add transaction record
        const transactionRef = collection(db, "transactions");
        await addDoc(transactionRef, {
          fromUserId: user.uid,
          toUserId: "SYSTEM",
          amount: conversionAmount,
          timestamp: Timestamp.now(),
          type: "gdp_conversion",
          description: `Converted ${animationFile} to ${conversionAmount.toFixed(2)} USD`,
        });
      });

      console.log('Conversion successful');
      showAlert(
        t.success,
        `${t.success} ${t.convert_to} ${gdpPrice.toFixed(2)} USD`,
        [{
          text: "OK", onPress: () => {
            onSuccess();
            onClose();
          }
        }]
      );
    } catch (error) {
      console.error("Error converting GDP:", error);
      showAlert(t.error, `${t.error} ${t.convert_to} USD`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <Text style={styles.title}>GDP {t.convert_to} USD</Text>
          <Text style={styles.description}>
            {/* {t.convert_to} {animationFile.replace('.json', '')} to {gdpPrice.toFixed(2)} USD? */}
            {t.convert_to} {gdpPrice.toFixed(2)} USD

          </Text>
          <Text style={styles.quantity}>
            {t.quantity} {t.available}: {quantity}
          </Text>

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={onClose}
              disabled={loading}
            >
              <Text style={styles.buttonText}>{t.cancel}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.convertButton]}
              onPress={() => { handleConvert(); onClose(); }}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>{t.confirm}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const shadowStyle = Platform.select({
  ios: {
    boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.15)',
  },
  android: {
    elevation: 5,
  },
  default: {
    boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.15)',
  },
});

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 20,
    width: '80%',
    alignItems: 'center',
    ...shadowStyle,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  description: {
    fontSize: 16,
    marginBottom: 10,
    textAlign: 'center',
  },
  quantity: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
  },
  button: {
    padding: 10,
    borderRadius: 5,
    minWidth: 100,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        boxShadow: '0px 1px 3px rgba(0, 0, 0, 0.1)',
      },
      android: {
        elevation: 2,
      },
      default: {
        boxShadow: '0px 1px 3px rgba(0, 0, 0, 0.1)',
      },
    }),
  },
  cancelButton: {
    backgroundColor: '#ccc',
    marginRight: 10,
  },
  convertButton: {
    backgroundColor: '#1976D2',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
  },
});