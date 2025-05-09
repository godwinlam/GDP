import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useLanguage } from '@/hooks/useLanguage';

interface GDPActionModalProps {
  visible: boolean;
  onClose: () => void;
  onListOTC: () => void;
  onConvert: () => void;
  gdpValue: number;
}

export default function GDPActionModal({
  visible,
  onClose,
  onListOTC,
  onConvert,
  gdpValue,
}: GDPActionModalProps) {  
  const { t } = useLanguage();
  
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <View style={styles.header}>
            <Text style={styles.title}>{t.chooseAction}</Text>
            <Text style={styles.gdpValue}>GDP {t.value}: ${gdpValue}</Text>
          </View>

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, styles.listButton]}
              onPress={onListOTC}
            >
              <View style={styles.buttonContent}>
                <MaterialIcons name="store" size={24} color="white" />
                <View style={styles.buttonTextContainer}>
                  <Text style={styles.buttonText}>{t.list} {t.on} {t.OTC}</Text>
                  <Text style={styles.buttonSubtext}>{t.sell_On_The_Market}</Text>
                </View>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.convertButton]}
              onPress={onConvert}
            >
              <View style={styles.buttonContent}>
                <MaterialIcons name="swap-horiz" size={24} color="white" />
                <View style={styles.buttonTextContainer}>
                  <Text style={styles.buttonText}>{t.convert_to} USD</Text>
                  <Text style={styles.buttonSubtext}>{t.get_instant} USD {t.value}</Text>
                </View>
              </View>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.button, styles.cancelButton]}
            onPress={onClose}
          >
            <View style={styles.buttonContent}>
              <MaterialIcons name="close" size={24} color="#666" />
              <Text style={[styles.buttonText, styles.cancelText]}>{t.cancel}</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 24,
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
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  gdpValue: {
    fontSize: 20,
    color: '#4CAF50',
    fontWeight: '600',
  },
  buttonContainer: {
    gap: 16,
    marginBottom: 16,
  },
  button: {
    borderRadius: 16,
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
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  buttonTextContainer: {
    flex: 1,
  },
  buttonText: {
    fontSize: 18,
    fontWeight: '600',
    color: 'white',
  },
  buttonSubtext: {
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
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  cancelText: {
    color: '#666',
  },
});
