import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, RefreshControl, Switch, Modal, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Settings, LogOut, ChevronRight, Calendar, TrendingUp, BookOpen, User as UserIcon, Bell, Crown, HelpCircle, X, Check } from 'lucide-react-native';
import { supabase, DEV_MODE } from '../lib/supabase';

export default function ProfileScreen() {
  const navigation = useNavigation();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // States for features
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [proModalVisible, setProModalVisible] = useState(false);
  const [helpModalVisible, setHelpModalVisible] = useState(false);

  async function fetchUser() {
    if (DEV_MODE) {
      console.log('[ProfileScreen] DEV_MODE enabled - using mock user data');
      setUser({
        email: 'dev@repify.app',
        user_metadata: {
          full_name: 'Разработчик',
          avatar_url: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=500&q=80'
        }
      });
      setLoading(false);
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    setUser(user);
    setLoading(false);
  }

  useEffect(() => {
    fetchUser();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchUser();
    setRefreshing(false);
  };

  async function handleSignOut() {
    if (DEV_MODE) {
      console.log('[ProfileScreen] DEV_MODE enabled - skipping Supabase sign out');
      navigation.replace('Login');
      return;
    }

    await supabase.auth.signOut();
    navigation.replace('Login');
  }

  const fullName = user?.user_metadata?.full_name || 'Пользователь';
  const email = user?.email || '';
  const avatarUrl = user?.user_metadata?.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=500&q=80';

  return (
    <SafeAreaView style={styles.container}>
      {/* Pro Subscription Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={proModalVisible}
        onRequestClose={() => setProModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.proModalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Repify Pro</Text>
              <TouchableOpacity onPress={() => setProModalVisible(false)} style={styles.iconButton}>
                <X color="white" size={24} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.modalHero}>
                <View style={styles.modalHeroIcon}>
                  <Crown color="#FF6B00" size={40} />
                </View>
                <Text style={styles.modalHeroTitle}>Открой полный потенциал</Text>
                <Text style={styles.modalHeroText}>Персональные планы, детальная аналитика и отсутствие ограничений.</Text>
              </View>

              <View style={styles.modalFeatureList}>
                {['Безлимитный анализ техники', 'Генерация сложных программ', 'Статистика за все время', 'Приоритетная поддержка'].map((feature, i) => (
                  <View key={i} style={styles.modalFeatureRow}>
                    <View style={styles.modalFeatureIcon}>
                      <Check color="#22C55E" size={16} />
                    </View>
                    <Text style={styles.modalFeatureText}>{feature}</Text>
                  </View>
                ))}
              </View>

              <TouchableOpacity style={styles.primaryButton}>
                <Text style={styles.primaryButtonText}>Оформить за 299₽ / мес</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setProModalVisible(false)}>
                <Text style={styles.modalLink}>Восстановить покупки</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Help Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={helpModalVisible}
        onRequestClose={() => setHelpModalVisible(false)}
      >
        <View style={styles.helpBackdrop}>
          <View style={styles.helpModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.helpTitle}>Помощь и поддержка</Text>
              <TouchableOpacity onPress={() => setHelpModalVisible(false)} style={styles.iconButton}>
                <X color="white" size={24} />
              </TouchableOpacity>
            </View>

            <Text style={styles.helpText}>Свяжитесь с нами, если у вас возникли вопросы или предложения:</Text>

            <View style={styles.helpCard}>
              <Text style={styles.helpLabel}>Email поддержки</Text>
              <Text style={styles.helpValue}>support@repify.app</Text>
            </View>

            <View style={styles.helpCard}>
              <Text style={styles.helpLabel}>Telegram основателя</Text>
              <Text style={styles.helpTelegram}>@bekmy_dev</Text>
            </View>

            <TouchableOpacity
              onPress={() => setHelpModalVisible(false)}
              style={styles.helpCloseButton}
            >
              <Text style={styles.helpCloseText}>Закрыть</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FF6B00" />}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Профиль</Text>
          <TouchableOpacity style={styles.headerButton}>
            <Settings color="white" size={20} />
          </TouchableOpacity>
        </View>

        <View style={styles.userSection}>
          <View style={styles.avatarWrapper}>
            <Image
              source={{ uri: avatarUrl }}
              style={styles.avatar}
            />
          </View>
          <Text style={styles.userName}>{fullName}</Text>
          <Text style={styles.userEmail}>{email}</Text>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <View style={[styles.statIcon, styles.statIconPrimary]}>
              <TrendingUp color="#FF6B00" size={20} />
            </View>
            <Text style={styles.statValue}>0</Text>
            <Text style={styles.statLabel}>Тренировок</Text>
          </View>
          <View style={[styles.statCard, styles.statCardLast]}>
            <View style={[styles.statIcon, styles.statIconSecondary]}>
              <Calendar color="#00FF87" size={20} />
            </View>
            <Text style={styles.statValue}>0</Text>
            <Text style={styles.statLabel}>Часов</Text>
          </View>
        </View>

        <View style={styles.menuSection}>
          <Text style={styles.menuTitle}>Настройки</Text>

          <TouchableOpacity
            onPress={() => navigation.navigate('FullPlan')}
            style={styles.menuItem}
          >
            <View style={styles.menuItemLeft}>
              <View style={[styles.menuIcon, styles.menuIconPrimary]}>
                <BookOpen color="#FF6B00" size={20} />
              </View>
              <Text style={styles.menuItemText}>Моя Программа</Text>
            </View>
            <ChevronRight color="#8B8E98" size={20} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => navigation.navigate('EditProfile')}
            style={styles.menuItem}
          >
            <View style={styles.menuItemLeft}>
              <View style={[styles.menuIcon, styles.menuIconBlue]}>
                <UserIcon color="#3B82F6" size={20} />
              </View>
              <Text style={styles.menuItemText}>Мои данные</Text>
            </View>
            <ChevronRight color="#8B8E98" size={20} />
          </TouchableOpacity>

          <View style={styles.menuItem}>
            <View style={styles.menuItemLeft}>
              <View style={[styles.menuIcon, styles.menuIconYellow]}>
                <Bell color="#EAB308" size={20} />
              </View>
              <Text style={styles.menuItemText}>Уведомления</Text>
            </View>
            <Switch
              value={notificationsEnabled}
              onValueChange={setNotificationsEnabled}
              trackColor={{ false: '#3f3f46', true: '#FF6B00' }}
              thumbColor={notificationsEnabled ? '#fff' : '#f4f3f4'}
            />
          </View>

          <TouchableOpacity
            onPress={() => setProModalVisible(true)}
            style={styles.menuItem}
          >
            <View style={styles.menuItemLeft}>
              <View style={[styles.menuIcon, styles.menuIconPurple]}>
                <Crown color="#A855F7" size={20} />
              </View>
              <Text style={styles.menuItemText}>Подписка Pro</Text>
            </View>
            <View style={styles.menuItemRight}>
              <Text style={styles.menuUpgrade}>UPGRADE</Text>
              <ChevronRight color="#8B8E98" size={20} />
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setHelpModalVisible(true)}
            style={styles.menuItem}
          >
            <View style={styles.menuItemLeft}>
              <View style={[styles.menuIcon, styles.menuIconGreen]}>
                <HelpCircle color="#22C55E" size={20} />
              </View>
              <Text style={styles.menuItemText}>Помощь</Text>
            </View>
            <ChevronRight color="#8B8E98" size={20} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleSignOut}
            style={styles.signOutButton}
          >
            <LogOut color="#FF3B5C" size={20} />
            <Text style={styles.signOutText}>Выйти</Text>
          </TouchableOpacity>
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
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  proModalSheet: {
    backgroundColor: '#1A1F2E',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    height: '70%',
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  iconButton: {
    padding: 8,
  },
  modalHero: {
    alignItems: 'center',
    marginBottom: 32,
  },
  modalHeroIcon: {
    width: 80,
    height: 80,
    borderRadius: 999,
    backgroundColor: 'rgba(255,107,0,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  modalHeroTitle: {
    color: '#FFFFFF',
    textAlign: 'center',
    fontSize: 18,
    marginBottom: 8,
  },
  modalHeroText: {
    color: '#8B8E98',
    textAlign: 'center',
  },
  modalFeatureList: {
    marginBottom: 32,
  },
  modalFeatureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalFeatureIcon: {
    backgroundColor: 'rgba(34,197,94,0.2)',
    padding: 4,
    borderRadius: 999,
    marginRight: 12,
  },
  modalFeatureText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
  primaryButton: {
    backgroundColor: '#FF6B00',
    width: '100%',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
  },
  modalLink: {
    color: '#8B8E98',
    textAlign: 'center',
  },
  helpBackdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.8)',
    paddingHorizontal: 24,
  },
  helpModal: {
    backgroundColor: '#1A1F2E',
    width: '100%',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  helpTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  helpText: {
    color: '#FFFFFF',
    marginBottom: 16,
  },
  helpCard: {
    backgroundColor: '#252A3B',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  helpLabel: {
    color: '#8B8E98',
    fontSize: 11,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  helpValue: {
    color: '#FF6B00',
    fontSize: 18,
    fontWeight: '700',
  },
  helpTelegram: {
    color: '#60A5FA',
    fontSize: 18,
    fontWeight: '700',
  },
  helpCloseButton: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    width: '100%',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  helpCloseText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  header: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
  },
  headerButton: {
    width: 40,
    height: 40,
    backgroundColor: '#1A1F2E',
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  userSection: {
    paddingHorizontal: 24,
    alignItems: 'center',
    marginBottom: 32,
  },
  avatarWrapper: {
    width: 96,
    height: 96,
    backgroundColor: '#1A1F2E',
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FF6B00',
    marginBottom: 16,
    overflow: 'hidden',
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  userName: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  userEmail: {
    color: '#8B8E98',
  },
  statsRow: {
    paddingHorizontal: 24,
    flexDirection: 'row',
    marginBottom: 32,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#1A1F2E',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginRight: 12,
  },
  statCardLast: {
    marginRight: 0,
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  statIconPrimary: {
    backgroundColor: 'rgba(255,107,0,0.1)',
  },
  statIconSecondary: {
    backgroundColor: 'rgba(0,255,135,0.1)',
  },
  statValue: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '700',
  },
  statLabel: {
    color: '#8B8E98',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  menuSection: {
    paddingHorizontal: 24,
  },
  menuTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  menuItem: {
    backgroundColor: '#1A1F2E',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuIcon: {
    padding: 8,
    borderRadius: 999,
    marginRight: 12,
  },
  menuIconPrimary: {
    backgroundColor: 'rgba(255,107,0,0.1)',
  },
  menuIconBlue: {
    backgroundColor: 'rgba(59,130,246,0.1)',
  },
  menuIconYellow: {
    backgroundColor: 'rgba(234,179,8,0.1)',
  },
  menuIconPurple: {
    backgroundColor: 'rgba(168,85,247,0.1)',
  },
  menuIconGreen: {
    backgroundColor: 'rgba(34,197,94,0.1)',
  },
  menuItemText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  menuItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuUpgrade: {
    color: '#FF6B00',
    fontSize: 11,
    fontWeight: '700',
    marginRight: 8,
  },
  signOutButton: {
    backgroundColor: 'rgba(255,59,92,0.1)',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,59,92,0.2)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  signOutText: {
    color: '#FF3B5C',
    fontWeight: '700',
    marginLeft: 8,
  },
});
