import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronLeft, ChevronDown, ChevronUp, Settings, PlayCircle } from 'lucide-react-native';
import { supabase, DEV_MODE } from '../lib/supabase';

export default function FullPlanScreen() {
    const navigation = useNavigation();
    const [expandedWeek, setExpandedWeek] = useState(1);
    const [plan, setPlan] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchPlan() {
            if (DEV_MODE) {
                console.log('[FullPlanScreen] DEV_MODE enabled - using mock plan');
                setPlan(null); // No plan in dev mode
                setLoading(false);
                return;
            }

            const { data: { user } } = await supabase.auth.getUser();
            if (user?.user_metadata?.workout_plan) {
                setPlan(user.user_metadata.workout_plan);
            }
            setLoading(false);
        }
        fetchPlan();
    }, []);

    const weeks = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

    if (loading) {
        return (
            <SafeAreaView style={styles.loadingContainer}>
                <ActivityIndicator color="#FF6B00" />
            </SafeAreaView>
        );
    }

    const goalLabel = {
        muscle_gain: 'Набор массы',
        weight_loss: 'Похудение',
        maintenance: 'Поддержание'
    };

    const currentGoal = plan?.goal ? goalLabel[plan.goal] : 'Общая подготовка';
    const schedule = plan?.schedule || [];

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerButtonLeft}>
                    <ChevronLeft color="white" size={24} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Программа тренировок</Text>
                <TouchableOpacity onPress={() => navigation.navigate('PlanSettings')} style={styles.headerButtonRight}>
                    <Settings color="white" size={24} />
                </TouchableOpacity>
            </View>

            <ScrollView style={styles.scrollContent}>
                {/* Summary Card */}
                <LinearGradient
                    colors={['#FF6B00', '#FF3B5C']}
                    style={styles.summaryCard}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                >
                    <Text style={styles.summaryTitle}>12-недельная программа</Text>
                    <Text style={styles.summarySubtitle}>{currentGoal}</Text>

                    <View style={styles.progressHeader}>
                        <Text style={styles.progressText}>Неделя 1 из 12</Text>
                        <Text style={styles.progressText}>0%</Text>
                    </View>
                    <View style={styles.progressBarBg}>
                        <View style={styles.progressBarFill} />
                    </View>
                </LinearGradient>

                {/* Weeks Accordion */}
                <View style={styles.weeksContainer}>
                    {weeks.map((week) => (
                        <View key={week} style={styles.weekCard}>
                            <TouchableOpacity
                                style={styles.weekHeader}
                                onPress={() => setExpandedWeek(expandedWeek === week ? null : week)}
                            >
                                <View>
                                    <Text style={styles.weekTitle}>Неделя {week}</Text>
                                    <Text style={styles.weekSubtitle}>{schedule.length} тренировки</Text>
                                </View>
                                {expandedWeek === week ? (
                                    <ChevronUp color="#8B8E98" size={20} />
                                ) : (
                                    <ChevronDown color="#8B8E98" size={20} />
                                )}
                            </TouchableOpacity>

                            {expandedWeek === week && (
                                <View style={styles.weekContent}>
                                    {schedule.length > 0 ? (
                                        schedule.map((day, index) => (
                                            <View key={index} style={styles.dayCard}>
                                                <View style={styles.dayHeader}>
                                                    <View>
                                                        <Text style={styles.dayTitle}>{day.day}</Text>
                                                        <Text style={styles.daySubtitle}>{day.exercises.length} упражнений • {day.sets} подхода • {day.reps}</Text>
                                                    </View>
                                                    <View style={styles.statusBadge}>
                                                        <Text style={styles.statusText}>
                                                            Не начато
                                                        </Text>
                                                    </View>
                                                </View>

                                                <TouchableOpacity
                                                    style={styles.startButton}
                                                    onPress={() => navigation.navigate('WorkoutDay', { day })}
                                                >
                                                    <PlayCircle color="white" size={16} fill="white" />
                                                    <Text style={styles.startButtonText}>
                                                        Начать
                                                    </Text>
                                                </TouchableOpacity>
                                            </View>
                                        ))
                                    ) : (
                                        <Text style={styles.emptyText}>План не найден. Пройдите опрос в настройках.</Text>
                                    )}
                                </View>
                            )}
                        </View>
                    ))}
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0A0E1A',
    },
    loadingContainer: {
        flex: 1,
        backgroundColor: '#0A0E1A',
        alignItems: 'center',
        justifyContent: 'center',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 24,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.05)',
        backgroundColor: '#0A0E1A',
        zIndex: 10,
    },
    headerButtonLeft: {
        padding: 8,
        marginLeft: -8,
    },
    headerTitle: {
        color: 'white',
        fontSize: 18,
        fontWeight: 'bold',
    },
    headerButtonRight: {
        padding: 8,
        marginRight: -8,
    },
    scrollContent: {
        flex: 1,
        paddingHorizontal: 16,
        paddingTop: 16,
    },
    summaryCard: {
        padding: 24,
        borderRadius: 24,
        marginBottom: 24,
    },
    summaryTitle: {
        color: 'white',
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    summarySubtitle: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: 16,
        marginBottom: 16,
    },
    progressHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    progressText: {
        color: 'white',
        fontSize: 14,
        fontWeight: '600',
    },
    progressBarBg: {
        width: '100%',
        height: 8,
        backgroundColor: 'rgba(0,0,0,0.2)',
        borderRadius: 999,
        overflow: 'hidden',
    },
    progressBarFill: {
        height: '100%',
        width: '0%',
        backgroundColor: 'white',
        borderRadius: 999,
    },
    weeksContainer: {
        paddingBottom: 40,
    },
    weekCard: {
        backgroundColor: '#1A1F2E',
        borderRadius: 16,
        marginBottom: 12,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
    },
    weekHeader: {
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    weekTitle: {
        color: 'white',
        fontSize: 18,
        fontWeight: 'bold',
    },
    weekSubtitle: {
        color: '#9CA3AF',
        fontSize: 14,
    },
    weekContent: {
        paddingHorizontal: 16,
        paddingBottom: 16,
        gap: 12,
    },
    dayCard: {
        backgroundColor: '#2A2F3E',
        borderRadius: 12,
        padding: 12,
    },
    dayHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 8,
    },
    dayTitle: {
        color: 'white',
        fontWeight: '600',
        marginBottom: 4,
    },
    daySubtitle: {
        color: '#9CA3AF',
        fontSize: 12,
    },
    statusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 999,
        backgroundColor: 'rgba(255,255,255,0.05)',
    },
    statusText: {
        fontSize: 10,
        fontWeight: 'bold',
        color: '#9CA3AF',
    },
    startButton: {
        backgroundColor: '#FF6B00',
        height: 40,
        borderRadius: 8,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 8,
        gap: 8,
    },
    startButtonText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 14,
    },
    emptyText: {
        color: '#9CA3AF',
        textAlign: 'center',
        paddingVertical: 16,
    },
});
