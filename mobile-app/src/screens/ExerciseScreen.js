import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ArrowLeft, Video, StopCircle, RefreshCw } from 'lucide-react-native';
import { API_URL } from '../config';
import { BioMechanicsEngine } from '../lib/BioMechanicsEngine';
import { supabase } from '../lib/supabase';


export default function ExerciseScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [isRecording, setIsRecording] = useState(false);
  const [loading, setLoading] = useState(false);
  const [facing, setFacing] = useState('back');
  const cameraRef = useRef(null);
  const navigation = useNavigation();
  const route = useRoute();
  const { exercise } = route.params;

  const startRecording = async () => {
    if (cameraRef.current) {
      setIsRecording(true);
      try {
        const video = await cameraRef.current.recordAsync({
          maxDuration: 60,
        });

        if (video) {
          handleAnalysis(video.uri);
        }
      } catch (error) {
        console.error(error);
        setIsRecording(false);
      }
    }
  };

  const stopRecording = () => {
    if (cameraRef.current && isRecording) {
      cameraRef.current.stopRecording();
      setIsRecording(false);
    }
  };

  const handleAnalysis = async (videoUri) => {
    setLoading(true);

    try {
      // Get user profile for genetic context
      const { data: { user } } = await supabase.auth.getUser();
      const userProfile = user?.user_metadata || {};

      console.log('Starting BioMechanics Analysis...');
      const result = await BioMechanicsEngine.analyzeTechnique(exercise.title || exercise, videoUri, userProfile);
      
      setLoading(false);
      navigation.navigate('AnalysisResult', { result });
    } catch (error) {
      console.error(error);
      setLoading(false);
      Alert.alert('Error', 'Failed to analyze video. Please try again.');
    }
  };

  if (!permission) {
    return <View className="flex-1 bg-background" />;
  }

  if (!permission.granted) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center px-6">
        <Text className="text-white text-center text-lg mb-4">No access to camera</Text>
        <TouchableOpacity onPress={requestPermission} className="bg-primary px-8 py-4 rounded-full shadow-glow">
          <Text className="text-white font-bold text-lg">Разрешить доступ</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <CameraView
        ref={cameraRef}
        style={{ flex: 1 }}
        facing={facing}
        mode="video"
      >
        <SafeAreaView className="flex-1 justify-between p-6">
          <View className="flex-row items-center justify-between">
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              className="w-10 h-10 bg-black/40 rounded-full items-center justify-center backdrop-blur-md"
            >
              <ArrowLeft color="white" size={24} />
            </TouchableOpacity>
            <View className="bg-black/40 px-4 py-2 rounded-full backdrop-blur-md">
              <Text className="text-white font-bold capitalize">{exercise}</Text>
            </View>
            <TouchableOpacity
              onPress={() => setFacing(facing === 'back' ? 'front' : 'back')}
              className="w-10 h-10 bg-black/40 rounded-full items-center justify-center backdrop-blur-md"
              disabled={isRecording}
            >
              <RefreshCw color={isRecording ? "#888" : "white"} size={20} />
            </TouchableOpacity>
          </View>

          <View className="items-center mb-8">
            {loading ? (
              <View className="bg-black/60 p-6 rounded-2xl items-center backdrop-blur-md">
                <ActivityIndicator size="large" color="#FF6B00" />
                <Text className="text-white font-bold mt-4">Анализируем технику...</Text>
              </View>
            ) : (
              <TouchableOpacity
                onPress={isRecording ? stopRecording : startRecording}
                className={`w-20 h-20 rounded-full items-center justify-center border-4 ${isRecording ? 'bg-red-500 border-red-200' : 'bg-white border-gray-200'}`}
              >
                {isRecording ? (
                  <View className="w-8 h-8 bg-white rounded-md" />
                ) : (
                  <View className="w-16 h-16 bg-primary rounded-full items-center justify-center border-2 border-white">
                    <Video color="white" size={32} fill="white" />
                  </View>
                )}
              </TouchableOpacity>
            )}
          </View>
        </SafeAreaView>
      </CameraView>
    </View>
  );
}
