import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Check, X, Info, AlertTriangle } from 'lucide-react-native';

/**
 * Custom Alert Component
 * @param {boolean} visible - Visibility state
 * @param {string} title - Alert title
 * @param {string} message - Alert message
 * @param {string} type - 'success', 'error', 'info', 'warning'
 * @param {Function} onClose - Function to call on close/confirm
 * @param {string} buttonText - Text for the primary button
 */
export const CustomAlert = ({ 
  visible, 
  title, 
  message, 
  type = 'info', 
  onClose,
  buttonText = 'OK'
}) => {
  if (!visible) return null;

  const getIcon = () => {
    switch(type) {
      case 'success': return <Check color="#22C55E" size={32} />;
      case 'error': return <X color="#EF4444" size={32} />;
      case 'warning': return <AlertTriangle color="#F59E0B" size={32} />;
      default: return <Info color="#3B82F6" size={32} />;
    }
  };

  const getBgColor = () => {
     switch(type) {
      case 'success': return 'rgba(34, 197, 94, 0.1)';
      case 'error': return 'rgba(239, 68, 68, 0.1)';
      case 'warning': return 'rgba(245, 158, 11, 0.1)';
      default: return 'rgba(59, 130, 246, 0.1)';
    }
  };

  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.alertBox}>
          <View style={[styles.iconContainer, { backgroundColor: getBgColor() }]}>
            {getIcon()}
          </View>
          
          <Text style={styles.title}>
            {title}
          </Text>
          
          <Text style={styles.message}>
            {message}
          </Text>

          <TouchableOpacity 
            onPress={onClose}
            style={styles.button}
          >
            <Text style={styles.buttonText}>{buttonText}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  alertBox: {
    backgroundColor: '#1A1F2E',
    width: '100%',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    color: 'rgba(255, 255, 255, 0.6)',
    textAlign: 'center',
    fontSize: 16,
    marginBottom: 24,
    lineHeight: 24,
  },
  button: {
    width: '100%',
    backgroundColor: '#FF6B00',
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
});
