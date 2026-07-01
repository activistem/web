import { View, Text, Switch, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTheme } from '../lib/ThemeContext';
import { supabase } from '../lib/supabase';

export default function SettingsScreen() {
  const { isDark, colors, toggleTheme } = useTheme();

  const handleLogout = () => {
    Alert.alert('ログアウト', 'ログアウトしますか？', [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: 'ログアウト',
        style: 'destructive',
        onPress: async () => {
          await supabase.auth.signOut({ scope: 'local' });
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>
      {/* ヘッダー */}
      <View style={[styles.header, { borderBottomColor: colors.divider }]}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={[styles.backBtnText, { color: colors.primary2 }]}>←</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>設定</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* 外観セクション */}
      <View style={styles.content}>
        <Text style={[styles.sectionLabel, { color: colors.overlay45 }]}>外観</Text>
        <View style={[styles.row, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <View style={styles.rowLeft}>
            <Text style={styles.rowEmoji}>🌙</Text>
            <View>
              <Text style={[styles.rowTitle, { color: colors.text }]}>ダークモード</Text>
              <Text style={[styles.rowSub, { color: colors.muted }]}>
                {isDark ? 'ダーク' : 'ライト'}テーマを使用中
              </Text>
            </View>
          </View>
          <Switch
            value={isDark}
            onValueChange={toggleTheme}
            trackColor={{ false: 'rgba(13,11,26,0.15)', true: colors.primary }}
            thumbColor="#fff"
          />
        </View>
      </View>

      {/* アカウントセクション */}
      <View style={styles.content}>
        <Text style={[styles.sectionLabel, { color: colors.overlay45 }]}>アカウント</Text>
        <TouchableOpacity
          style={[styles.row, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
          onPress={handleLogout}
          activeOpacity={0.7}
        >
          <View style={styles.rowLeft}>
            <Text style={styles.rowEmoji}>🚪</Text>
            <Text style={[styles.rowTitle, { color: '#FF4D6A' }]}>ログアウト</Text>
          </View>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backBtn: { width: 40, justifyContent: 'center' },
  backBtnText: { fontSize: 22 },
  headerTitle: { flex: 1, fontWeight: '700', fontSize: 16, textAlign: 'center' },
  headerSpacer: { width: 40 },
  content: { paddingHorizontal: 16, paddingTop: 24 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowEmoji: { fontSize: 22 },
  rowTitle: { fontSize: 15, fontWeight: '600', marginBottom: 2 },
  rowSub: { fontSize: 12 },
});
