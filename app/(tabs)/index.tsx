import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCallback, useEffect, useMemo, useState } from 'react';
import AppHeader from '../../components/AppHeader';
import UserCard from '../../components/UserCard';
import { useColors } from '../../lib/ThemeContext';
import { AppColors } from '../../constants/Colors';
import { supabase } from '../../lib/supabase';

const TAGS = ['すべて', '環境', '教育', '防災', '地域活性', 'テクノロジー', '子ども'];

type Profile = {
  id: string;
  full_name: string;
  username: string;
  role: string;
  location: string;
  bio: string;
  avatar_color: string;
  tags: string[];
  followers_count: number;
  projects_count: number;
};

export default function ExploreScreen() {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [selectedTag, setSelectedTag] = useState('すべて');
  const [search, setSearch] = useState('');
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [myId, setMyId] = useState<string | null>(null);
  const [connected, setConnected] = useState<Set<string>>(new Set());

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setMyId(data.user?.id ?? null));
  }, []);

  const fetchProfiles = useCallback(async () => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setProfiles(data as Profile[]);
  }, []);

  const fetchConnections = useCallback(async () => {
    if (!myId) return;
    const { data } = await supabase
      .from('connections')
      .select('following_id')
      .eq('follower_id', myId);
    if (data) setConnected(new Set(data.map((c) => c.following_id)));
  }, [myId]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await fetchProfiles();
      await fetchConnections();
      setLoading(false);
    })();
  }, [fetchProfiles, fetchConnections]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchProfiles();
    await fetchConnections();
    setRefreshing(false);
  };

  const handleConnect = async (targetId: string) => {
    if (!myId) return;
    if (connected.has(targetId)) {
      await supabase
        .from('connections')
        .delete()
        .eq('follower_id', myId)
        .eq('following_id', targetId);
      setConnected((prev) => {
        const next = new Set(prev);
        next.delete(targetId);
        return next;
      });
    } else {
      await supabase
        .from('connections')
        .insert({ follower_id: myId, following_id: targetId });
      setConnected((prev) => new Set([...prev, targetId]));
    }
  };

  const filtered = profiles
    .filter((u) => u.id !== myId)
    .filter((u) => {
      if (
        search &&
        !u.full_name?.includes(search) &&
        !u.role?.includes(search) &&
        !u.username?.includes(search)
      )
        return false;
      if (selectedTag !== 'すべて' && !u.tags?.includes(selectedTag)) return false;
      return true;
    });

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>
      <AppHeader title="Activistem!" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
      >
        <View style={styles.titleSection}>
          <Text style={styles.title}>ユーザーを探す</Text>
          <Text style={styles.subtitle}>関心や活動が近い人とつながりましょう</Text>
        </View>

        <View style={styles.searchWrap}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="名前、キーワードで検索"
            placeholderTextColor="rgba(255,255,255,0.25)"
            value={search}
            onChangeText={setSearch}
          />
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tagsScroll}
          contentContainerStyle={styles.tagsContent}
        >
          {TAGS.map((tag) => (
            <TouchableOpacity
              key={tag}
              style={[styles.tag, selectedTag === tag && styles.tagActive]}
              onPress={() => setSelectedTag(tag)}
            >
              <Text style={[styles.tagText, selectedTag === tag && styles.tagTextActive]}>
                {tag}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.list}>
          {loading ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
          ) : filtered.length === 0 ? (
            <Text style={styles.empty}>
              {profiles.length === 0
                ? 'まだユーザーがいません。友達を招待しよう！'
                : '該当するユーザーが見つかりません'}
            </Text>
          ) : (
            filtered.map((user) => (
              <UserCard
                key={user.id}
                name={user.full_name ?? user.username}
                role={user.role}
                location={user.location}
                followers={user.followers_count}
                projects={user.projects_count}
                bio={user.bio}
                tags={user.tags ?? []}
                avatarColor={user.avatar_color}
                connected={connected.has(user.id)}
                onConnect={() => handleConnect(user.id)}
              />
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(c: AppColors) {
  return StyleSheet.create({
    container: { flex: 1 },
    titleSection: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12 },
    title: { color: c.text, fontSize: 22, fontWeight: '900', marginBottom: 4 },
    subtitle: { color: c.muted, fontSize: 13 },
    searchWrap: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: c.inputBg, borderRadius: 12,
      marginHorizontal: 16, marginBottom: 12, paddingHorizontal: 12, paddingVertical: 10, gap: 8,
    },
    searchIcon: { fontSize: 16, opacity: 0.5 },
    searchInput: { flex: 1, color: c.text, fontSize: 14 },
    tagsScroll: { marginBottom: 12 },
    tagsContent: { paddingHorizontal: 16, gap: 8 },
    tag: { backgroundColor: c.inputBg, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20 },
    tagActive: { backgroundColor: c.primary },
    tagText: { color: c.muted, fontSize: 13, fontWeight: '600' },
    tagTextActive: { color: '#fff' },
    list: { paddingHorizontal: 16, paddingBottom: 20 },
    empty: { color: c.muted, textAlign: 'center', paddingVertical: 40, fontSize: 14 },
  });
}
