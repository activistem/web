import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../constants/Colors';

type Props = {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
};

export default function AppHeader({ title, subtitle, right }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.logo}>
        <View style={styles.logoIcon}>
          <Text style={styles.logoIconText}>A</Text>
        </View>
        <Text style={styles.logoText}>
          Activis<Text style={styles.logoAccent}>tem!</Text>
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
    borderBottomColor: 'rgba(124,91,245,0.2)',
    backgroundColor: 'rgba(8,7,20,0.9)',
  },
  logo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoIconText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 14,
  },
  logoText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 16,
  },
  logoAccent: {
    color: Colors.green2,
  },
});
