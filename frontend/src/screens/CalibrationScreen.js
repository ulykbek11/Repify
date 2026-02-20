import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Dimensions, StyleSheet } from 'react-native';
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { supabase, DEV_MODE } from '../lib/supabase';
import { ArrowLeft, Video, StopCircle, Check, AlertTriangle, RotateCcw, SkipForward, RefreshCw } from 'lucide-react-native';
import { CustomAlert } from '../components/CustomAlert';
import { API_URL } from '../config';
import { BioMechanicsEngine } from '../lib/BioMechanicsEngine';

const fetchWithTimeout = async (url, options = {}, timeoutMs = 30000) => {
  const controller = new AbortController();
  const timerId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    console.log(`🚀 [Calibration] Запрос: ${options.method || 'GET'} ${url}`);
    const response = await fetch(url, { ...options, signal: controller.signal });
    console.log(`✅ [Calibration] Ответ: ${response.status}`);
    return response;
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error(`Сервер не ответил за ${timeoutMs / 1000}с. Проверь IP (${url}) и что бэкенд запущен.`);
    }
    throw err;
  } finally {
    clearTimeout(timerId);
  }
};


const { width } = Dimensions.get('window');

// 5-Step Calibration Flow
const STEPS = {
    INTRO: 'intro',
    CHECK: 'check',
    RECORD: 'record',
    PROCESS: 'process',
    SUCCESS: 'success'
};

export default function CalibrationScreen() {
    const [step, setStep] = useState(STEPS.INTRO);
    const [permission, requestPermission] = useCameraPermissions();
    const [isRecording, setIsRecording] = useState(false);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);
    const [facing, setFacing] = useState('back');

    const cameraRef = useRef(null);
    const navigation = useNavigation();
    const [micPermission, requestMicPermission] = useMicrophonePermissions();

    // Alert State
    const [alertVisible, setAlertVisible] = useState(false);
    const [alertConfig, setAlertConfig] = useState({ title: '', message: '', type: 'info', onConfirm: () => { } });

    const showAlert = (title, message, type = 'info', onConfirm = null) => {
        setAlertConfig({
            title,
            message,
            type,
            onConfirm: onConfirm || (() => setAlertVisible(false))
        });
        setAlertVisible(true);
    };

    const handleSkip = async () => {
        // Mark as not calibrated, navigate to onboarding
        await supabase.auth.updateUser({
            data: {
                calibrated: false,
                calibration_reminder_count: 0
            }
        });
        navigation.replace('Onboarding');
    };

    const startRecording = async () => {
        if (isRecording) {
            return;
        }
        if (cameraRef.current) {
            if (!permission?.granted) {
                await requestPermission();
                setError('Нужно разрешение камеры');
                return;
            }
            if (!micPermission?.granted) {
                await requestMicPermission();
                setError('Нужно разрешение микрофона');
                return;
            }
            console.log('[CalibrationScreen] Starting video recording...');
            setIsRecording(true);
            setStep(STEPS.RECORD);

            try {
                const video = await cameraRef.current.recordAsync({
                    maxDuration: 60,
                });

                console.log('[CalibrationScreen] Recording complete:', {
                    uri: video?.uri,
                    duration: video?.duration,
                });

                if (video) {
                    handleCalibration(video.uri);
                }
            } catch (err) {
                console.error('[CalibrationScreen] Recording error:', err);
                setError(err?.message || 'Ошибка записи видео');
                setIsRecording(false);
            }
        }
    };

    const stopRecording = () => {
        if (cameraRef.current && isRecording) {
            console.log('[CalibrationScreen] Stopping video recording...');
            cameraRef.current.stopRecording();
            setIsRecording(false);
        }
    };

    const handleCalibration = async (videoUri) => {
        console.log('[CalibrationScreen] ========== STARTING CALIBRATION ==========');
        setStep(STEPS.PROCESS);
        setLoading(true);
        setError(null);

        try {
            // Get current user
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Пользователь не найден');

            // Use BioMechanicsEngine for "Genetic Analysis"
            console.log('[CalibrationScreen] Running BioMechanicsEngine...');
            const analysisResult = await BioMechanicsEngine.analyzeGenetics(videoUri);

            if (analysisResult.success) {
                const { poseSequence } = await BioMechanicsEngine.getPoseSequence(videoUri, DEV_MODE || __DEV__);
                if (!poseSequence || poseSequence.length === 0) {
                    throw new Error('Не удалось извлечь позу из видео');
                }

                console.log(`[CalibrationScreen] Бэкенд: ${API_URL}`);
                console.log(`[CalibrationScreen] Отправляю ${poseSequence.length} кадров на /api/calibrate`);
                const calibrationResponse = await fetchWithTimeout(
                    `${API_URL}/api/calibrate`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            user_id: user?.id || 'anonymous',
                            exercise: 'squats',
                            pose_sequence: poseSequence,
                            user_metadata: user?.user_metadata || {}
                        })
                    },
                    30000
                );

                if (!calibrationResponse.ok) {
                    const errorText = await calibrationResponse.text();
                    throw new Error(`Ошибка калибровки на сервере: ${errorText}`);
                }

                setResult(analysisResult);

                // Save results to Supabase profile
                const { error: updateError } = await supabase.auth.updateUser({
                    data: {
                        calibrated: true,
                        body_type: analysisResult.body_type,
                        biomechanics: analysisResult.biomechanics,
                        calibration_date: new Date().toISOString()
                    }
                });

                if (updateError) {
                    console.error('Error saving profile:', updateError);
                    // Continue anyway to show results
                }

                setStep(STEPS.SUCCESS);
            } else {
                throw new Error('Не удалось определить параметры тела');
            }
        } catch (err) {
            console.error('[CalibrationScreen] Error:', err);
            setError(err.message || 'Ошибка анализа');
            setStep(STEPS.CHECK); // Go back to check step
        } finally {
            setLoading(false);
        }
    };

    const handleRetry = () => {
        setError(null);
        setResult(null);
        setStep(STEPS.CHECK);
    };

    const handleComplete = () => {
        navigation.replace('Onboarding');
    };

    // Render quality stars
    const renderQualityStars = (score) => {
        const stars = [];
        for (let i = 1; i <= 5; i++) {
            stars.push(
                <Text key={i} style={{ fontSize: 24 }}>
                    {i <= score ? '⭐' : '⚫'}
                </Text>
            );
        }
        return <View style={{ flexDirection: 'row' }}>{stars}</View>;
    };

    // ===== STEP: INTRO =====
    if (step === STEPS.INTRO) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.content}>
                    <View style={styles.iconContainer}>
                        <Video color="#FF6B00" size={64} />
                    </View>

                    <Text style={styles.title}>
                        Калибровка
                    </Text>

                    <Text style={styles.description}>
                        Для персональной оценки техники нам нужно измерить ваши пропорции.{'\n\n'}
                        <Text style={styles.boldText}>Что нужно сделать:</Text>{'\n'}
                        1. Поставьте телефон сбоку{'\n'}
                        2. Отойдите на 2-3 метра{'\n'}
                        3. Сделайте несколько приседаний (3-5) без веса
                    </Text>

                    <TouchableOpacity
                        onPress={() => setStep(STEPS.CHECK)}
                        style={styles.primaryButton}
                    >
                        <Text style={styles.primaryButtonText}>Начать калибровку</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={handleSkip}
                        style={styles.skipButton}
                    >
                        <SkipForward color="#8B8E98" size={20} />
                        <Text style={styles.skipText}>Пропустить</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    // ===== STEP: CHECK (Camera View) =====
    if (step === STEPS.CHECK || step === STEPS.RECORD) {
        if (!permission) {
            // Camera permissions are still loading
            return <View style={styles.container} />;
        }

        if (!permission.granted) {
            return (
                <SafeAreaView style={[styles.container, styles.centered]}>
                    <Text style={[styles.text, { marginBottom: 16 }]}>Нет доступа к камере</Text>
                    <TouchableOpacity
                        onPress={requestPermission}
                        style={styles.primaryButton}
                    >
                        <Text style={styles.primaryButtonText}>Разрешить доступ</Text>
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
                        {/* Header */}
                        <View style={styles.header}>
                            <TouchableOpacity
                                onPress={() => navigation.goBack()}
                                style={styles.iconButton}
                            >
                                <ArrowLeft color="white" size={24} />
                            </TouchableOpacity>

                            <View style={styles.badge}>
                                <Text style={styles.badgeText}>
                                    {step === STEPS.RECORD ? 'Запись...' : 'Проверка ракурса'}
                                </Text>
                            </View>

                            <TouchableOpacity
                                onPress={() => setFacing(facing === 'back' ? 'front' : 'back')}
                                style={styles.iconButton}
                                disabled={isRecording}
                            >
                                <RefreshCw color={isRecording ? "#888" : "white"} size={20} />
                            </TouchableOpacity>
                        </View>

                        {/* Error Banner */}
                        {error && (
                            <View style={styles.errorBanner}>
                                <AlertTriangle color="white" size={24} />
                                <Text style={styles.errorText}>{error}</Text>
                            </View>
                        )}

                        {/* Instructions */}
                        <View style={styles.instructionsOverlay}>
                            <Text style={styles.instructionsTitle}>
                                {step === STEPS.CHECK
                                    ? '📱 Поставьте телефон сбоку'
                                    : '🏋️ Выполните несколько приседаний'}
                            </Text>
                            <Text style={styles.instructionsText}>
                                {step === STEPS.CHECK
                                    ? 'Камера должна видеть вас в профиль'
                                    : 'Приседайте в естественном темпе'}
                            </Text>
                        </View>

                        {/* Record Button */}
                        <View style={styles.controlsContainer}>
                            <TouchableOpacity
                                onPress={isRecording ? stopRecording : startRecording}
                                style={[
                                    styles.recordButtonRing,
                                    isRecording ? styles.recordingRing : styles.idleRing
                                ]}
                            >
                                {isRecording ? (
                                    <View style={styles.recordingDot} />
                                ) : (
                                    <View style={styles.idleDot}>
                                        <Video color="white" size={32} />
                                    </View>
                                )}
                            </TouchableOpacity>

                            <Text style={styles.controlsText}>
                                {isRecording ? 'Нажмите для остановки' : 'Начать запись'}
                            </Text>
                        </View>
                    </SafeAreaView>
                </CameraView>
            </View>
        );
    }

    // ===== STEP: PROCESS =====
    if (step === STEPS.PROCESS) {
        return (
            <SafeAreaView style={[styles.container, styles.centered]}>
                <ActivityIndicator size="large" color="#FF6B00" />
                <Text style={styles.title}>Анализируем...</Text>
                <Text style={styles.description}>
                    Определяем ваши анатомические пропорции
                </Text>
            </SafeAreaView>
        );
    }

    // ===== STEP: SUCCESS =====
    if (step === STEPS.SUCCESS && result) {
        const bodyType = result.body_type || {};
        const biomechanics = result.biomechanics || {};

        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.content}>
                    <View style={styles.successIconContainer}>
                        <Check color="#00FF87" size={64} />
                    </View>

                    <Text style={styles.title}>
                        Калибровка завершена!
                    </Text>

                    <Text style={styles.description}>
                        Качество калибровки:
                    </Text>

                    {renderQualityStars(result.quality_score || 0)}

                    {/* Body Type Summary */}
                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>
                            Ваши пропорции
                        </Text>

                        <View style={styles.row}>
                            <Text style={styles.label}>Бедро:</Text>
                            <Text style={styles.value}>
                                {bodyType.femur || 'среднее'}
                            </Text>
                        </View>

                        <View style={styles.row}>
                            <Text style={styles.label}>Корпус:</Text>
                            <Text style={styles.value}>
                                {bodyType.torso || 'средний'}
                            </Text>
                        </View>

                        <View style={styles.row}>
                            <Text style={styles.label}>Подвижность голеностопа:</Text>
                            <Text style={styles.value}>
                                {biomechanics.ankle_mobility_score?.toFixed(1) || '7.0'}/10
                            </Text>
                        </View>

                        <View style={styles.row}>
                            <Text style={styles.label}>Подвижность бедра:</Text>
                            <Text style={styles.value}>
                                {biomechanics.hip_mobility_score?.toFixed(1) || '7.0'}/10
                            </Text>
                        </View>
                    </View>

                    <Text style={styles.description}>
                        Теперь анализ техники будет учитывать ваши индивидуальные особенности
                    </Text>

                    <TouchableOpacity
                        onPress={handleComplete}
                        style={styles.primaryButton}
                    >
                        <Text style={styles.primaryButtonText}>Продолжить</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    // Fallback
    return (
        <SafeAreaView style={[styles.container, styles.centered]}>
            <Text style={styles.text}>Загрузка...</Text>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0A0E1A',
        paddingHorizontal: 24,
    },
    centered: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    iconContainer: {
        backgroundColor: 'rgba(255, 107, 0, 0.2)',
        padding: 24,
        borderRadius: 999,
        marginBottom: 24,
    },
    successIconContainer: {
        backgroundColor: 'rgba(0, 255, 135, 0.2)',
        padding: 24,
        borderRadius: 999,
        marginBottom: 24,
    },
    title: {
        color: 'white',
        fontSize: 24,
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 16,
    },
    description: {
        color: '#8B8E98',
        textAlign: 'center',
        fontSize: 16,
        marginBottom: 32,
        paddingHorizontal: 16,
    },
    boldText: {
        color: 'white',
        fontWeight: 'semibold',
    },
    primaryButton: {
        width: '100%',
        backgroundColor: '#FF6B00',
        paddingVertical: 16,
        borderRadius: 16,
        alignItems: 'center',
        marginBottom: 16,
        marginTop: 16,
    },
    primaryButtonText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 18,
    },
    skipButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
    },
    skipText: {
        color: '#8B8E98',
        marginLeft: 8,
    },
    text: {
        color: 'white',
        fontSize: 16,
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
        borderRadius: 999,
        alignItems: 'center',
        justifyContent: 'center',
    },
    badge: {
        backgroundColor: 'rgba(0,0,0,0.4)',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 999,
    },
    badgeText: {
        color: 'white',
        fontWeight: 'bold',
    },
    errorBanner: {
        backgroundColor: 'rgba(239, 68, 68, 0.8)',
        marginHorizontal: 16,
        padding: 16,
        borderRadius: 16,
        flexDirection: 'row',
        alignItems: 'center',
    },
    errorText: {
        color: 'white',
        marginLeft: 12,
        flex: 1,
    },
    instructionsOverlay: {
        backgroundColor: 'rgba(0,0,0,0.6)',
        marginHorizontal: 16,
        padding: 16,
        borderRadius: 16,
    },
    instructionsTitle: {
        color: 'white',
        textAlign: 'center',
        fontWeight: 'semibold',
        marginBottom: 8,
    },
    instructionsText: {
        color: '#8B8E98',
        textAlign: 'center',
        fontSize: 14,
    },
    controlsContainer: {
        alignItems: 'center',
        marginBottom: 32,
    },
    recordButtonRing: {
        width: 80,
        height: 80,
        borderRadius: 999,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 4,
    },
    recordingRing: {
        backgroundColor: '#EF4444',
        borderColor: '#FECACA',
    },
    idleRing: {
        backgroundColor: 'white',
        borderColor: '#E5E7EB',
    },
    recordingDot: {
        width: 32,
        height: 32,
        backgroundColor: 'white',
        borderRadius: 6,
    },
    idleDot: {
        width: 64,
        height: 64,
        backgroundColor: '#FF6B00',
        borderRadius: 999,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: 'white',
    },
    controlsText: {
        color: 'white',
        marginTop: 16,
        fontWeight: 'semibold',
    },
    card: {
        backgroundColor: '#1A1F2E',
        width: '100%',
        padding: 24,
        borderRadius: 16,
        marginTop: 24,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
    },
    cardTitle: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 18,
        marginBottom: 16,
        textAlign: 'center',
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    label: {
        color: '#8B8E98',
    },
    value: {
        color: 'white',
        fontWeight: 'semibold',
        textTransform: 'capitalize',
    },
});
