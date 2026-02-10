import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Dimensions } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { ArrowLeft, Video, StopCircle, Check, AlertTriangle, RotateCcw, SkipForward } from 'lucide-react-native';
import { CustomAlert } from '../components/CustomAlert';
import { API_URL } from '../config';

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

    const cameraRef = useRef(null);
    const navigation = useNavigation();

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
        if (cameraRef.current) {
            setIsRecording(true);
            setStep(STEPS.RECORD);

            try {
                const video = await cameraRef.current.recordAsync({
                    maxDuration: 60,
                });

                if (video) {
                    handleCalibration(video.uri);
                }
            } catch (err) {
                console.error('Recording error:', err);
                setError('Ошибка записи видео');
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

    const handleCalibration = async (videoUri) => {
        setStep(STEPS.PROCESS);
        setLoading(true);
        setError(null);

        // Get current user
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            setError('Пользователь не авторизован');
            setLoading(false);
            return;
        }

        // Create form data
        const formData = new FormData();
        formData.append('file', {
            uri: videoUri,
            type: 'video/mp4',
            name: 'calibration.mp4',
        });
        formData.append('user_id', user.id);

        try {
            const response = await fetch(`${API_URL}/calibrate_user`, {
                method: 'POST',
                body: formData,
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });

            const data = await response.json();
            setLoading(false);

            if (data.status === 'success') {
                // Save to Supabase user metadata
                await supabase.auth.updateUser({
                    data: {
                        calibrated: true,
                        calibration_date: new Date().toISOString(),
                        biomechanics: data.biomechanics,
                        thresholds: data.thresholds,
                        body_type: data.body_type,
                        calibration_quality: data.quality_score
                    }
                });

                setResult(data);
                setStep(STEPS.SUCCESS);
            } else {
                setError(data.message || 'Ошибка калибровки');
                setStep(STEPS.CHECK);
            }
        } catch (err) {
            console.error('Calibration error:', err);
            setLoading(false);
            setError('Не удалось подключиться к серверу');
            setStep(STEPS.CHECK);
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
            <SafeAreaView className="flex-1 bg-background px-6">
                <View className="flex-1 justify-center items-center">
                    <View className="bg-primary/20 p-6 rounded-full mb-6">
                        <Video color="#FF6B00" size={64} />
                    </View>

                    <Text className="text-white text-2xl font-bold text-center mb-4">
                        Калибровка
                    </Text>

                    <Text className="text-muted text-center text-base mb-8 px-4">
                        Для персональной оценки техники нам нужно измерить ваши пропорции.{'\n\n'}
                        <Text className="text-white font-semibold">Что нужно сделать:</Text>{'\n'}
                        1. Поставьте телефон сбоку{'\n'}
                        2. Отойдите на 2-3 метра{'\n'}
                        3. Сделайте 5 приседаний без веса
                    </Text>

                    <TouchableOpacity
                        onPress={() => setStep(STEPS.CHECK)}
                        className="w-full bg-primary py-4 rounded-2xl items-center mb-4"
                    >
                        <Text className="text-white font-bold text-lg">Начать калибровку</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={handleSkip}
                        className="flex-row items-center py-3"
                    >
                        <SkipForward color="#8B8E98" size={20} />
                        <Text className="text-muted ml-2">Пропустить</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    // ===== STEP: CHECK (Camera View) =====
    if (step === STEPS.CHECK || step === STEPS.RECORD) {
        if (!permission) {
            // Camera permissions are still loading
            return <View className="flex-1 bg-background" />;
        }

        if (!permission.granted) {
            return (
                <SafeAreaView className="flex-1 bg-background items-center justify-center px-6">
                    <Text className="text-white text-center text-lg mb-4">Нет доступа к камере</Text>
                    <TouchableOpacity
                        onPress={requestPermission}
                        className="bg-primary px-8 py-4 rounded-full"
                    >
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
                    facing="back"
                    mode="video"
                >
                    <SafeAreaView className="flex-1 justify-between p-6">
                        {/* Header */}
                        <View className="flex-row items-center justify-between">
                            <TouchableOpacity
                                onPress={() => navigation.goBack()}
                                className="w-10 h-10 bg-black/40 rounded-full items-center justify-center"
                            >
                                <ArrowLeft color="white" size={24} />
                            </TouchableOpacity>

                            <View className="bg-black/40 px-4 py-2 rounded-full">
                                <Text className="text-white font-bold">
                                    {step === STEPS.RECORD ? 'Запись...' : 'Проверка ракурса'}
                                </Text>
                            </View>

                            <View className="w-10" />
                        </View>

                        {/* Error Banner */}
                        {error && (
                            <View className="bg-error/80 mx-4 p-4 rounded-2xl flex-row items-center">
                                <AlertTriangle color="white" size={24} />
                                <Text className="text-white ml-3 flex-1">{error}</Text>
                            </View>
                        )}

                        {/* Instructions */}
                        <View className="bg-black/60 mx-4 p-4 rounded-2xl">
                            <Text className="text-white text-center font-semibold mb-2">
                                {step === STEPS.CHECK
                                    ? '📱 Поставьте телефон сбоку'
                                    : '🏋️ Выполните 5 приседаний'}
                            </Text>
                            <Text className="text-muted text-center text-sm">
                                {step === STEPS.CHECK
                                    ? 'Камера должна видеть вас в профиль'
                                    : 'Приседайте в естественном темпе'}
                            </Text>
                        </View>

                        {/* Record Button */}
                        <View className="items-center mb-8">
                            <TouchableOpacity
                                onPress={isRecording ? stopRecording : startRecording}
                                className={`w-20 h-20 rounded-full items-center justify-center border-4 
                  ${isRecording ? 'bg-red-500 border-red-200' : 'bg-white border-gray-200'}`}
                            >
                                {isRecording ? (
                                    <View className="w-8 h-8 bg-white rounded-md" />
                                ) : (
                                    <View className="w-16 h-16 bg-primary rounded-full items-center justify-center border-2 border-white">
                                        <Video color="white" size={32} />
                                    </View>
                                )}
                            </TouchableOpacity>

                            <Text className="text-white mt-4 font-semibold">
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
            <SafeAreaView className="flex-1 bg-background items-center justify-center px-6">
                <ActivityIndicator size="large" color="#FF6B00" />
                <Text className="text-white text-xl font-bold mt-6">Анализируем...</Text>
                <Text className="text-muted text-center mt-2">
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
            <SafeAreaView className="flex-1 bg-background px-6">
                <View className="flex-1 justify-center items-center">
                    <View className="bg-secondary/20 p-6 rounded-full mb-6">
                        <Check color="#00FF87" size={64} />
                    </View>

                    <Text className="text-white text-2xl font-bold text-center mb-2">
                        Калибровка завершена!
                    </Text>

                    <Text className="text-muted text-center mb-6">
                        Качество калибровки:
                    </Text>

                    {renderQualityStars(result.quality_score || 0)}

                    {/* Body Type Summary */}
                    <View className="bg-card w-full p-6 rounded-2xl mt-6 border border-white/5">
                        <Text className="text-white font-bold text-lg mb-4 text-center">
                            Ваши пропорции
                        </Text>

                        <View className="flex-row justify-between mb-3">
                            <Text className="text-muted">Бедро:</Text>
                            <Text className="text-white font-semibold capitalize">
                                {bodyType.femur || 'среднее'}
                            </Text>
                        </View>

                        <View className="flex-row justify-between mb-3">
                            <Text className="text-muted">Корпус:</Text>
                            <Text className="text-white font-semibold capitalize">
                                {bodyType.torso || 'средний'}
                            </Text>
                        </View>

                        <View className="flex-row justify-between mb-3">
                            <Text className="text-muted">Подвижность голеностопа:</Text>
                            <Text className="text-white font-semibold">
                                {biomechanics.ankle_mobility_score?.toFixed(1) || '7.0'}/10
                            </Text>
                        </View>

                        <View className="flex-row justify-between">
                            <Text className="text-muted">Подвижность бедра:</Text>
                            <Text className="text-white font-semibold">
                                {biomechanics.hip_mobility_score?.toFixed(1) || '7.0'}/10
                            </Text>
                        </View>
                    </View>

                    <Text className="text-muted text-center text-sm mt-4 px-4">
                        Теперь анализ техники будет учитывать ваши индивидуальные особенности
                    </Text>

                    <TouchableOpacity
                        onPress={handleComplete}
                        className="w-full bg-primary py-4 rounded-2xl items-center mt-8"
                    >
                        <Text className="text-white font-bold text-lg">Продолжить</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    // Fallback
    return (
        <SafeAreaView className="flex-1 bg-background items-center justify-center">
            <Text className="text-white">Загрузка...</Text>
        </SafeAreaView>
    );
}
