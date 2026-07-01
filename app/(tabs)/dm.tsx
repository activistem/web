import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AppHeader from '../../components/AppHeader';
import { useColors } from '../../lib/ThemeContext';

export default function DMScreen() {
  const colors = useColors();
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>
      <AppHeader title="Activistem!" />
      <View style={styles.body}>
        <Text style={styles.emoji}>💬</Text>
        <Text style={[styles.title, { color: colors.text }]}>近日公開</Text>
        <Text style={[styles.description, { color: colors.muted }]}>
          ダイレクトメッセージ機能は現在開発中です。{'\n'}
          仲間とプライベートにやり取りできる{'\n'}DMスペースをお楽しみに。
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 14 },
  emoji: { fontSize: 52 },
  title: { fontSize: 22, fontWeight: '900', letterSpacing: 0.5 },
  description: { fontSize: 14, lineHeight: 24, textAlign: 'center' },
});
