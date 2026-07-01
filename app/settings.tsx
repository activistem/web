import { View, Text, Switch, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTheme } from '../lib/ThemeContext';

export default function SettingsScreen() {
  const { isDark, colors, toggleTheme } = useTheme();

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
