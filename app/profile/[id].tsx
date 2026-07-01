import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { useColors } from '../../lib/ThemeContext';
import { AppColors } from '../../constants/Colors';
import { supabase } from '../../lib/supabase';

type Profile = {
  id: string;
  full_name: string;
  username: string;
  role: string;
  avatar_color: string;
  avatar_url: string | null;
  bio: string | null;
  links: string[];
  followers_count: number;
  projects_count: number;
};

export default function ProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [followingCount, setFollowingCount] = useState(0);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const [profileResult, followingResult] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', id).single(),
        supabase
          .from('connections')
          .select('*', { count: 'exact', head: true })
          .eq('follower_id', id),
      ]);
      if (profileResult.data) setProfile(profileResult.data as Profile);
      setFollowingCount(followingResult.count ?? 0);
      setLoading(false);
    })();
  }, [id]);

  const initial = (profile?.full_name ?? profile?.username ?? '?')[0]?.toUpperCase();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>
      {/* ヘッダー */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.backBtnText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>プロフィール</Text>
        <View style={styles.headerSpacer} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : !profile ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>プロフィールが見つかりませんでした。</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {/* アバター + 名前 */}
          <View style={styles.avatarSection}>
            {profile.avatar_url ? (
              <Image
                source={{ uri: profile.avatar_url }}
                style={styles.avatarImg}
                resizeMode="cover"
              />
            ) : (
              <View
                style={[
                  styles.avatarFallback,
                  { backgroundColor: profile.avatar_color ?? colors.primary },
                ]}
              >
                <Text style={styles.avatarInitial}>{initial}</Text>
              </View>
            )}
            <Text style={styles.profileName}>{profile.full_name}</Text>
            <Text style={styles.profileRole}>{profile.role}</Text>
            <Text style={styles.profileUsername}>@{profile.username}</Text>
          </View>

          {/* 統計 */}
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statVal}>{followingCount}</Text>
              <Text style={styles.statLabel}>フォロー</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statVal}>{profile.followers_count ?? 0}</Text>
              <Text style={styles.statLabel}>フォロワー</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statVal}>{profile.projects_count ?? 0}</Text>
              <Text style={styles.statLabel}>プロジェクト</Text>
            </View>
          </View>

          {/* 自己紹介 */}
          {profile.bio ? (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>自己紹介</Text>
              <Text style={styles.bioText}>{profile.bio}</Text>
            </View>
          ) : null}

          {/* リンク */}
          {profile.links?.filter(l => l.trim()).length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>リンク</Text>
              {profile.links.filter(l => l.trim()).map((link, i) => (
                <TouchableOpacity
                  key={i}
                  style={[styles.linkCard, i > 0 && { marginTop: 8 }]}
                  onPress={() => Linking.openURL(link).catch(() => {})}
                >
                  <Text style={styles.linkIcon}>🔗</Text>
                  <Text style={styles.linkText} numberOfLines={1}>{link}</Text>
                  <Text style={styles.linkArrow}>↗</Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function makeStyles(c: AppColors) {
  return StyleSheet.create({
    container: { flex: 1 },
    header: {
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: 16, paddingVertical: 12,
      borderBottomWidth: 1, borderBottomColor: c.cardBorder,
    },
    backBtn: { width: 40, justifyContent: 'center' },
    backBtnText: { color: c.primary2, fontSize: 22 },
    headerTitle: { flex: 1, color: c.text, fontWeight: '700', fontSize: 16, textAlign: 'center' },
    headerSpacer: { width: 40 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    errorText: { color: c.muted, fontSize: 14 },
    content: { paddingHorizontal: 16, paddingBottom: 48 },
    avatarSection: { alignItems: 'center', paddingTop: 28, paddingBottom: 4 },
    avatarImg: {
      width: 96, height: 96, borderRadius: 48,
      borderWidth: 3, borderColor: c.primary, marginBottom: 12,
    },
    avatarFallback: {
      width: 96, height: 96, borderRadius: 48,
      borderWidth: 3, borderColor: c.primary,
      alignItems: 'center', justifyContent: 'center', marginBottom: 12,
    },
    avatarInitial: { color: '#fff', fontWeight: '900', fontSize: 38 },
    profileName: { color: c.text, fontWeight: '900', fontSize: 20, marginBottom: 3 },
    profileRole: { color: c.muted, fontSize: 13, marginBottom: 3 },
    profileUsername: { color: c.primary2, fontSize: 12, marginBottom: 4 },
    statsRow: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: c.card, borderWidth: 1, borderColor: c.cardBorder,
      borderRadius: 16, paddingVertical: 16, marginVertical: 20,
    },
    statItem: { flex: 1, alignItems: 'center' },
    statVal: { color: c.text, fontWeight: '900', fontSize: 22, marginBottom: 2 },
    statLabel: { color: c.muted, fontSize: 11 },
    statDivider: { width: 1, height: 32, backgroundColor: c.glassBorder },
    section: { marginBottom: 20 },
    sectionLabel: {
      color: c.overlay45, fontSize: 11, fontWeight: '700',
      letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8,
    },
    bioText: { color: c.textBody, fontSize: 14, lineHeight: 22 },
    linkCard: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: c.card, borderWidth: 1, borderColor: c.cardBorder,
      borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, gap: 8,
    },
    linkIcon: { fontSize: 16 },
    linkText: { flex: 1, color: c.primary2, fontSize: 13 },
    linkArrow: { color: c.primary2, fontSize: 14 },
  });
}
