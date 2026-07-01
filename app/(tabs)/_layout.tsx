import { Tabs } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';
import { useColors } from '../../lib/ThemeContext';

function TabIcon({ label, emoji, focused }: { label: string; emoji: string; focused: boolean }) {
  const colors = useColors();
  return (
    <View style={styles.tabItem}>
      <Text style={styles.tabEmoji}>{emoji}</Text>
      <Text style={[styles.tabLabel, { color: focused ? colors.primary2 : colors.overlay30 }]} numberOfLines={1}>
        {label}
      </Text>
      {focused && <View style={[styles.tabBarIndicator, { backgroundColor: colors.primary }]} />}
    </View>
  );
}

export default function TabLayout() {
  const colors = useColors();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.tabBarBg,
          borderTopColor: colors.divider,
          borderTopWidth: 1,
          height: 72,
          paddingBottom: 8,
        },
        tabBarShowLabel: false,
        tabBarActiveTintColor: colors.primary2,
        tabBarInactiveTintColor: colors.overlay30,
      }}
    >
      <Tabs.Screen
        name="broadcast"
        options={{
          title: '発信',
          tabBarIcon: ({ focused }) => <TabIcon label="発信" emoji="📡" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="index"
        options={{
          title: '探す',
          tabBarIcon: ({ focused }) => <TabIcon label="探す" emoji="🔍" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="dm"
        options={{
          title: 'DM',
          tabBarIcon: ({ focused }) => <TabIcon label="DM" emoji="💬" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="projects"
        options={{
          title: 'プロジェクト',
          tabBarIcon: ({ focused }) => <TabIcon label="プロジェクト" emoji="📁" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="mydata"
        options={{
          title: 'マイデータ',
          tabBarIcon: ({ focused }) => <TabIcon label="マイデータ" emoji="📊" focused={focused} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabItem: { alignItems: 'center', justifyContent: 'center', gap: 2, paddingTop: 4 },
  tabEmoji: { fontSize: 20, marginBottom: 2 },
  tabLabel: { fontSize: 9, fontWeight: '500' },
  tabBarIndicator: { width: 24, height: 2, borderRadius: 2, marginTop: 2 },
});
