import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Alert, ActivityIndicator, StyleSheet } from 'react-native';
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ArrowLeft, Video, StopCircle, RefreshCw } from 'lucide-react-native';
import { API_URL } from '../config';
import { BioMechanicsEngine } from '../lib/BioMechanicsEngine';
import { supabase, DEV_MODE } from '../lib/supabase';


export default function ExerciseScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [isRecording, setIsRecording] = useState(false);
  const [loading, setLoading] = useState(false);
  const [facing, setFacing] = useState('back');
  const cameraRef = useRef(null);
  const navigation = useNavigation();
  const route = useRoute();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();
  const { exercise } = route.params;

  const startRecording = async () => {
    if (isRecording) {
      return;
    }
    if (cameraRef.current) {
      if (!permission?.granted) {
        await requestPermission();
        Alert.alert('Нет доступа', 'Нужно разрешение камеры');
        return;
      }
      if (!micPermission?.granted) {
        await requestMicPermission();
        Alert.alert('Нет доступа', 'Нужно разрешение микрофона');
        return;
      }
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
        Alert.alert('Ошибка записи', error?.message || 'Ошибка записи видео');
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
      let userProfile = {};

      if (!DEV_MODE) {
        const { data: { user } } = await supabase.auth.getUser();
        userProfile = user?.user_metadata || {};
      } else {
        console.log('[ExerciseScreen] DEV_MODE enabled - using empty user profile');
      }

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
    return <View style={styles.container} />;
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={[styles.container, styles.centerContainer]}>
        <Text style={styles.errorText}>No access to camera</Text>
        <TouchableOpacity onPress={requestPermission} style={styles.permissionButton}>
          <Text style={styles.permissionButtonText}>Разрешить доступ</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }
  if (micPermission && !micPermission.granted) {
    return (
      <SafeAreaView style={[styles.container, styles.centerContainer]}>
        <Text style={styles.errorText}>Нет доступа к микрофону</Text>
        <TouchableOpacity onPress={requestMicPermission} style={styles.permissionButton}>
          <Text style={styles.permissionButtonText}>Разрешить доступ</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={{ flex: 1 }}
        facing={facing}
        mode="video"
      >
        <SafeAreaView style={styles.cameraOverlay}>
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={styles.iconButton}
            >
              <ArrowLeft color="white" size={24} />
            </TouchableOpacity>
            <View style={styles.titleContainer}>
              <Text style={styles.titleText}>{typeof exercise === 'string' ? exercise : exercise.title}</Text>
            </View>
            <TouchableOpacity
              onPress={() => setFacing(facing === 'back' ? 'front' : 'back')}
              style={styles.iconButton}
              disabled={isRecording}
            >
              <RefreshCw color={isRecording ? "#888" : "white"} size={20} />
            </TouchableOpacity>
          </View>

          <View style={styles.controlsContainer}>
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#FF6B00" />
                <Text style={styles.loadingText}>Анализируем технику...</Text>
              </View>
            ) : (
              <TouchableOpacity
                onPress={isRecording ? stopRecording : startRecording}
                style={[
                  styles.recordButton,
                  isRecording ? styles.recordButtonActive : styles.recordButtonInactive
                ]}
              >
                {isRecording ? (
                  <View style={styles.stopIcon} />
                ) : (
                  <View style={styles.startIcon}>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0E1A',
  },
  centerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  errorText: {
    color: 'white',
    textAlign: 'center',
    fontSize: 18,
    marginBottom: 16,
  },
  permissionButton: {
    backgroundColor: '#FF6B00',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 9999,
    shadowColor: '#FF6B00',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 5,
  },
  permissionButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 18,
  },
  cameraOverlay: {
    flex: 1,
    justifyContent: 'space-between',
    padding: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconButton: {
    width: 40,
    height: 40,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleContainer: {
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  titleText: {
    color: 'white',
    fontWeight: 'bold',
    textTransform: 'capitalize',
  },
  controlsContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  loadingContainer: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
  },
  loadingText: {
    color: 'white',
    fontWeight: 'bold',
    marginTop: 16,
  },
  recordButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
  },
  recordButtonActive: {
    backgroundColor: '#EF4444',
    borderColor: '#FECACA',
  },
  recordButtonInactive: {
    backgroundColor: 'white',
    borderColor: '#E5E7EB',
  },
  stopIcon: {
    width: 32,
    height: 32,
    backgroundColor: 'white',
    borderRadius: 6,
  },
  startIcon: {
    width: 64,
    height: 64,
    backgroundColor: '#FF6B00',
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'white',
  },
});
