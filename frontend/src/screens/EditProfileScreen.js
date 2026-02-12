import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Image, KeyboardAvoidingView, Platform, Modal } from 'react-native';
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
    <SafeAreaView className="flex-1 bg-background">
      <CustomAlert 
        visible={alertVisible}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        onClose={alertConfig.onConfirm}
      />
      
      <View className="px-6 py-4 flex-row items-center space-x-4 border-b border-white/5">
        <TouchableOpacity onPress={() => navigation.goBack()} className="w-10 h-10 bg-surface rounded-full items-center justify-center">
          <ArrowLeft color="white" size={24} />
        </TouchableOpacity>
        <Text className="text-xl font-bold text-white">Редактировать профиль</Text>
      </View>

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView className="flex-1 px-6 pt-6">
          
          {/* Avatar Section */}
          <View className="items-center mb-8">
            <TouchableOpacity 
                onPress={pickImage}
                disabled={uploading}
                className="w-28 h-28 bg-surface rounded-full border-2 border-primary items-center justify-center overflow-hidden mb-4 relative"
            >
               {uploading ? (
                   <Loader2 size={32} color="#FF6B00" className="animate-spin" />
               ) : avatarUrl ? (
                 <Image source={{ uri: avatarUrl }} className="w-full h-full" />
               ) : (
                 <User color="#8B8E98" size={48} />
               )}
               <View className="absolute bottom-0 w-full bg-black/50 h-8 items-center justify-center">
                   <Camera color="white" size={16} />
               </View>
            </TouchableOpacity>
            <Text className="text-muted text-sm">Нажмите, чтобы изменить фото</Text>
          </View>

          {/* Name Field */}
          <View className="mb-6">
            <Text className="text-white mb-2 ml-1">Имя пользователя</Text>
            <View className="bg-surface rounded-xl flex-row items-center px-4 py-3 border border-white/5">
                <User color="#8B8E98" size={20} />
                <TextInput 
                    className="flex-1 ml-3 text-white text-base"
                    placeholder="Ваше имя"
                    placeholderTextColor="#52525B"
                    value={fullName}
                    onChangeText={setFullName}
                />
            </View>
          </View>

          {/* Password Button */}
          <View className="mb-6">
            <Text className="text-white mb-2 ml-1">Безопасность</Text>
            <TouchableOpacity 
                onPress={() => {
                    setPasswordStep(1);
                    setCurrentPassword('');
                    setNewPassword('');
                    setShowCurrentPassword(false);
                    setShowNewPassword(false);
                    setPasswordModalVisible(true);
                }}
                className="bg-surface rounded-xl flex-row items-center justify-between px-4 py-4 border border-white/5"
            >
                <View className="flex-row items-center">
                    <Lock color="#8B8E98" size={20} />
                    <Text className="ml-3 text-white text-base">Сменить пароль</Text>
                </View>
                <Text className="text-primary font-bold">Изменить</Text>
            </TouchableOpacity>
          </View>

          {/* Payment Methods (Future) */}
          <View className="mb-8 opacity-50">
            <Text className="text-white mb-2 ml-1">Способы оплаты (Скоро)</Text>
            <View className="bg-surface rounded-xl flex-row items-center px-4 py-3 border border-dashed border-white/20">
                <CreditCard color="#8B8E98" size={20} />
                <Text className="ml-3 text-muted text-base">Привязка карты недоступна</Text>
            </View>
          </View>

        </ScrollView>

        {/* Save Button */}
        <View className="p-6 border-t border-white/5 bg-background">
          <TouchableOpacity 
            onPress={handleUpdateProfile}
            disabled={loading}
            className="w-full bg-primary h-14 rounded-2xl items-center justify-center shadow-lg shadow-primary/30 flex-row space-x-2"
          >
            {loading ? (
                <Loader2 size={24} color="white" className="animate-spin" />
            ) : (
                <>
                    <Save color="white" size={20} />
                    <Text className="text-white font-bold text-lg">Сохранить</Text>
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
            className="flex-1 justify-end bg-black/50"
        >
          <View className="bg-[#1A1F2E] rounded-t-3xl p-6 border-t border-white/10">
            <View className="flex-row justify-between items-center mb-6">
                <Text className="text-xl font-bold text-white">
                    {passwordStep === 1 ? 'Подтвердите пароль' : 'Новый пароль'}
                </Text>
                <TouchableOpacity onPress={() => setPasswordModalVisible(false)} className="p-2">
                    <X color="white" size={24} />
                </TouchableOpacity>
            </View>

            {passwordStep === 1 ? (
                <View>
                    <Text className="text-muted mb-4">Для безопасности, пожалуйста, введите ваш текущий пароль.</Text>
                    <View className="bg-surface rounded-xl flex-row items-center px-4 py-3 border border-white/5 mb-6">
                        <Lock color="#8B8E98" size={20} />
                        <TextInput 
                            className="flex-1 ml-3 text-white text-base"
                            placeholder="Текущий пароль"
                            placeholderTextColor="#52525B"
                            value={currentPassword}
                            onChangeText={setCurrentPassword}
                            secureTextEntry={!showCurrentPassword}
                        />
                        <TouchableOpacity onPress={() => setShowCurrentPassword(!showCurrentPassword)} className="p-2">
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
                        className={`w-full h-14 rounded-xl items-center justify-center ${loading || !currentPassword ? 'bg-surface' : 'bg-primary'}`}
                    >
                        {loading ? (
                            <Loader2 size={24} color="white" className="animate-spin" />
                        ) : (
                            <Text className={`font-bold text-lg ${loading || !currentPassword ? 'text-muted' : 'text-white'}`}>Далее</Text>
                        )}
                    </TouchableOpacity>
                </View>
            ) : (
                <View>
                    <Text className="text-muted mb-4">Придумайте новый надежный пароль для вашего аккаунта.</Text>
                    <View className="bg-surface rounded-xl flex-row items-center px-4 py-3 border border-white/5 mb-6">
                        <Lock color="#8B8E98" size={20} />
                        <TextInput 
                            className="flex-1 ml-3 text-white text-base"
                            placeholder="Новый пароль"
                            placeholderTextColor="#52525B"
                            value={newPassword}
                            onChangeText={setNewPassword}
                            secureTextEntry={!showNewPassword}
                        />
                        <TouchableOpacity onPress={() => setShowNewPassword(!showNewPassword)} className="p-2">
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
                        className={`w-full h-14 rounded-xl items-center justify-center ${loading || !newPassword ? 'bg-surface' : 'bg-primary'}`}
                    >
                        {loading ? (
                            <Loader2 size={24} color="white" className="animate-spin" />
                        ) : (
                            <Text className={`font-bold text-lg ${loading || !newPassword ? 'text-muted' : 'text-white'}`}>Сохранить</Text>
                        )}
                    </TouchableOpacity>
                </View>
            )}
            <View className="h-6" /> 
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}