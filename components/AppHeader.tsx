import { View, Text, StyleSheet } from 'react-native';
import { useColors } from '../lib/ThemeContext';

type Props = {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
};

export default function AppHeader({ title, subtitle, right }: Props) {
  const colors = useColors();
  return (
    <View style={[styles.container, { backgroundColor: colors.headerBg, borderBottomColor: `${colors.primary}33` }]}>
      <View style={styles.logo}>
        <View style={[styles.logoIcon, { backgroundColor: colors.primary }]}>
          <Text style={styles.logoIconText}>A</Text>
        </View>
        <Text style={[styles.logoText, { color: colors.text }]}>
          Activis<Text style={{ color: colors.green2 }}>tem!</Text>
        </Text>
      </View>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  logo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logoIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoIconText: { color: '#fff', fontWeight: '900', fontSize: 14 },
  logoText: { fontWeight: '900', fontSize: 16 },
});
