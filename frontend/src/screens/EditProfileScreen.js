import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Image, KeyboardAvoidingView, Platform, Modal, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { ArrowLeft, User, Lock, Save, Camera, CreditCard, Loader2, X, Eye, EyeOff } from 'lucide-react-native';
import { CustomAlert } from '../components/CustomAlert';
import * as ImagePicker from 'expo-image-picker';

export default function EditProfileScreen() {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  
  // Password Modal State
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordStep, setPasswordStep] = useState(1);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  
  // Alert State
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState({ title: '', message: '', type: 'info', onConfirm: () => {} });

  const showAlert = (title, message, type = 'info', onConfirm = null) => {
    setAlertConfig({ 
        title, 
        message, 
        type, 
        onConfirm: onConfirm || (() => setAlertVisible(false)) 
    });
    setAlertVisible(true);
  };

  useEffect(() => {
    fetchUserData();
  }, []);

  async function fetchUserData() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setEmail(user.email || '');
        setFullName(user.user_metadata?.full_name || '');
        setAvatarUrl(user.user_metadata?.avatar_url || '');
      }
    } catch (error) {
      console.error('Error fetching user:', error);
    }
  }

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });

    if (!result.canceled) {
      uploadAvatar(result.assets[0].uri);
    }
  };

  const uploadAvatar = async (uri) => {
    setUploading(true);
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      const arrayBuffer = await new Response(blob).arrayBuffer();
      const fileExt = uri.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, arrayBuffer, {
          contentType: blob.type,
          upsert: false
        });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
      setAvatarUrl(data.publicUrl);
    } catch (error) {
      showAlert('Ошибка загрузки', 'Не удалось загрузить изображение. Проверьте настройки хранилища.', 'error');
      console.error(error);
    } finally {
      setUploading(false);
    }
  };

  const verifyPassword = async () => {
    if (!currentPassword) return;
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email,
        password: currentPassword
      });
      if (error) throw error;
      setPasswordStep(2);
    } catch (error) {
      showAlert('Ошибка', 'Неверный текущий пароль', 'error');
    } finally {
      setLoading(false);
    }
  };

  const updatePassword = async () => {
    if (!newPassword) return;
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      
      setPasswordModalVisible(false);
      showAlert('Успех', 'Пароль успешно изменен', 'success');
      
      // Reset state
      setCurrentPassword('');
      setNewPassword('');
      setPasswordStep(1);
    } catch (error) {
      showAlert('Ошибка', error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  async function handleUpdateProfile() {
    setLoading(true);
    try {
      const updates = {
        data: {
            full_name: fullName,
            avatar_url: avatarUrl,
        }
      };

      const { error } = await supabase.auth.updateUser(updates);

      if (error) throw error;

      showAlert('Успех', 'Профиль успешно обновлен', 'success', () => {
        setAlertVisible(false);
        navigation.goBack();
      });
    } catch (error) {
      showAlert('Ошибка', error.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <CustomAlert 
        visible={alertVisible}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        onClose={alertConfig.onConfirm}
      />
      
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <ArrowLeft color="white" size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Редактировать профиль</Text>
      </View>

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView style={styles.scrollContent}>
          
          {/* Avatar Section */}
          <View style={styles.avatarSection}>
            <TouchableOpacity 
                onPress={pickImage}
                disabled={uploading}
                style={styles.avatarContainer}
            >
               {uploading ? (
                   <Loader2 size={32} color="#FF6B00" />
               ) : avatarUrl ? (
                 <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
               ) : (
                 <User color="#8B8E98" size={48} />
               )}
               <View style={styles.cameraOverlay}>
                   <Camera color="white" size={16} />
               </View>
            </TouchableOpacity>
            <Text style={styles.avatarHint}>Нажмите, чтобы изменить фото</Text>
          </View>

          {/* Name Field */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Имя пользователя</Text>
            <View style={styles.inputContainer}>
                <User color="#8B8E98" size={20} />
                <TextInput 
                    style={styles.input}
                    placeholder="Ваше имя"
                    placeholderTextColor="#52525B"
                    value={fullName}
                    onChangeText={setFullName}
                />
            </View>
          </View>

          {/* Password Button */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Безопасность</Text>
            <TouchableOpacity 
                onPress={() => {
                    setPasswordStep(1);
                    setCurrentPassword('');
                    setNewPassword('');
                    setShowCurrentPassword(false);
                    setShowNewPassword(false);
                    setPasswordModalVisible(true);
                }}
                style={styles.passwordButton}
            >
                <View style={styles.passwordButtonContent}>
                    <Lock color="#8B8E98" size={20} />
                    <Text style={styles.passwordButtonText}>Сменить пароль</Text>
                </View>
                <Text style={styles.changeText}>Изменить</Text>
            </TouchableOpacity>
          </View>

          {/* Payment Methods (Future) */}
          <View style={styles.paymentSection}>
            <Text style={styles.label}>Способы оплаты (Скоро)</Text>
            <View style={styles.paymentContainer}>
                <CreditCard color="#8B8E98" size={20} />
                <Text style={styles.paymentText}>Привязка карты недоступна</Text>
            </View>
          </View>

        </ScrollView>

        {/* Save Button */}
        <View style={styles.footer}>
          <TouchableOpacity 
            onPress={handleUpdateProfile}
            disabled={loading}
            style={styles.saveButton}
          >
            {loading ? (
                <Loader2 size={24} color="white" />
            ) : (
                <>
                    <Save color="white" size={20} />
                    <Text style={styles.saveButtonText}>Сохранить</Text>
                </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
      <Modal
        animationType="slide"
        transparent={true}
        visible={passwordModalVisible}
        onRequestClose={() => setPasswordModalVisible(false)}
      >
        <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
                <Text style={styles.headerTitle}>
                    {passwordStep === 1 ? 'Подтвердите пароль' : 'Новый пароль'}
                </Text>
                <TouchableOpacity onPress={() => setPasswordModalVisible(false)} style={styles.closeButton}>
                    <X color="white" size={24} />
                </TouchableOpacity>
            </View>

            {passwordStep === 1 ? (
                <View>
                    <Text style={styles.modalDescription}>Для безопасности, пожалуйста, введите ваш текущий пароль.</Text>
                    <View style={styles.modalInputContainer}>
                        <Lock color="#8B8E98" size={20} />
                        <TextInput 
                            style={styles.input}
                            placeholder="Текущий пароль"
                            placeholderTextColor="#52525B"
                            value={currentPassword}
                            onChangeText={setCurrentPassword}
                            secureTextEntry={!showCurrentPassword}
                        />
                        <TouchableOpacity onPress={() => setShowCurrentPassword(!showCurrentPassword)} style={styles.closeButton}>
                            {showCurrentPassword ? (
                                <EyeOff color="#8B8E98" size={20} />
                            ) : (
                                <Eye color="#8B8E98" size={20} />
                            )}
                        </TouchableOpacity>
                    </View>
                    <TouchableOpacity 
                        onPress={verifyPassword}
                        disabled={loading || !currentPassword}
                        style={[
                            styles.modalButton,
                            loading || !currentPassword ? styles.buttonDisabled : styles.buttonEnabled
                        ]}
                    >
                        {loading ? (
                            <Loader2 size={24} color="white" />
                        ) : (
                            <Text style={loading || !currentPassword ? styles.buttonTextDisabled : styles.buttonTextEnabled}>Далее</Text>
                        )}
                    </TouchableOpacity>
                </View>
            ) : (
                <View>
                    <Text style={styles.modalDescription}>Придумайте новый надежный пароль для вашего аккаунта.</Text>
                    <View style={styles.modalInputContainer}>
                        <Lock color="#8B8E98" size={20} />
                        <TextInput 
                            style={styles.input}
                            placeholder="Новый пароль"
                            placeholderTextColor="#52525B"
                            value={newPassword}
                            onChangeText={setNewPassword}
                            secureTextEntry={!showNewPassword}
                        />
                        <TouchableOpacity onPress={() => setShowNewPassword(!showNewPassword)} style={styles.closeButton}>
                            {showNewPassword ? (
                                <EyeOff color="#8B8E98" size={20} />
                            ) : (
                                <Eye color="#8B8E98" size={20} />
                            )}
                        </TouchableOpacity>
                    </View>
                    <TouchableOpacity 
                        onPress={updatePassword}
                        disabled={loading || !newPassword}
                        style={[
                            styles.modalButton,
                            loading || !newPassword ? styles.buttonDisabled : styles.buttonEnabled
                        ]}
                    >
                        {loading ? (
                            <Loader2 size={24} color="white" />
                        ) : (
                            <Text style={loading || !newPassword ? styles.buttonTextDisabled : styles.buttonTextEnabled}>Сохранить</Text>
                        )}
                    </TouchableOpacity>
                </View>
            )}
            <View style={styles.bottomSpacer} /> 
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0E1A',
  },
  header: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  backButton: {
    width: 40,
    height: 40,
    backgroundColor: '#1A1F2E',
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  avatarContainer: {
    width: 112,
    height: 112,
    backgroundColor: '#1A1F2E',
    borderRadius: 999,
    borderWidth: 2,
    borderColor: '#FF6B00',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginBottom: 16,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  cameraOverlay: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    backgroundColor: 'rgba(0,0,0,0.5)',
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarHint: {
    color: '#9CA3AF',
    fontSize: 14,
  },
  inputGroup: {
    marginBottom: 24,
  },
  label: {
    color: 'white',
    marginBottom: 8,
    marginLeft: 4,
  },
  inputContainer: {
    backgroundColor: '#1A1F2E',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  input: {
    flex: 1,
    marginLeft: 12,
    color: 'white',
    fontSize: 16,
  },
  passwordButton: {
    backgroundColor: '#1A1F2E',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  passwordButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  passwordButtonText: {
    marginLeft: 12,
    color: 'white',
    fontSize: 16,
  },
  changeText: {
    color: '#FF6B00',
    fontWeight: 'bold',
  },
  paymentSection: {
    marginBottom: 32,
    opacity: 0.5,
  },
  paymentContainer: {
    backgroundColor: '#1A1F2E',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(255,255,255,0.2)',
  },
  paymentText: {
    marginLeft: 12,
    color: '#9CA3AF',
    fontSize: 16,
  },
  footer: {
    padding: 24,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
    backgroundColor: '#0A0E1A',
  },
  saveButton: {
    width: '100%',
    backgroundColor: '#FF6B00',
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    shadowColor: '#FF6B00',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  saveButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 18,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    backgroundColor: '#1A1F2E',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  closeButton: {
    padding: 8,
  },
  modalDescription: {
    color: '#9CA3AF',
    marginBottom: 16,
  },
  modalInputContainer: {
    backgroundColor: '#1A1F2E',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    marginBottom: 24,
  },
  modalButton: {
    width: '100%',
    height: 56,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#1A1F2E',
  },
  buttonEnabled: {
    backgroundColor: '#FF6B00',
  },
  buttonTextDisabled: {
    color: '#9CA3AF',
    fontWeight: 'bold',
    fontSize: 18,
  },
  buttonTextEnabled: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 18,
  },
  bottomSpacer: {
    height: 24,
  },
});