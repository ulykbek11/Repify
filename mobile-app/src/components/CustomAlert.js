import React from 'react';
import { Modal, View, Text, TouchableOpacity } from 'react-native';
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
      case 'success': return 'bg-green-500/10';
      case 'error': return 'bg-red-500/10';
      case 'warning': return 'bg-yellow-500/10';
      default: return 'bg-blue-500/10';
    }
  };

  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-black/60 items-center justify-center px-6">
        <View className="bg-[#1A1F2E] w-full rounded-3xl p-6 border border-white/10 items-center shadow-2xl">
          <View className={`w-16 h-16 rounded-full items-center justify-center mb-4 ${getBgColor()}`}>
            {getIcon()}
          </View>
          
          <Text className="text-white text-xl font-bold text-center mb-2">
            {title}
          </Text>
          
          <Text className="text-white/60 text-center text-base mb-6 leading-6">
            {message}
          </Text>

          <TouchableOpacity 
            onPress={onClose}
            className="w-full bg-primary h-12 rounded-xl items-center justify-center"
          >
            <Text className="text-white font-bold text-base">{buttonText}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};
