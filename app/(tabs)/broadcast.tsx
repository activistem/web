import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCallback, useEffect, useState } from 'react';
import AppHeader from '../../components/AppHeader';
import FeedPost from '../../components/FeedPost';
import { Colors } from '../../constants/Colors';
import { supabase } from '../../lib/supabase';

type Post = {
  id: string;
  content: string;
  hashtags: string[];
  likes_count: number;
  comments_count: number;
  shares_count: number;
  created_at: string;
  profiles: {
    full_name: string;
    username: string;
    role: string;
    avatar_color: string;
  } | null;
};

function timeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'たった今';
  if (m < 60) return `${m}分前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}時間前`;
  return `${Math.floor(h / 24)}日前`;
}

export default function BroadcastScreen() {
  const [postText, setPostText] = useState('');
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [posting, setPosting] = useState(false);
  const [myProfile, setMyProfile] = useState<{ avatar_color: string; full_name: string; role: string } | null>(null);

  const fetchPosts = useCallback(async () => {
    const { data } = await supabase
      .from('posts')
      .select('*, profiles(full_name, username, role, avatar_color)')
      .order('created_at', { ascending: false })
      .limit(50);
    if (data) setPosts(data as Post[]);
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from('profiles')
          .select('full_name, role, avatar_color')
          .eq('id', user.id)
          .single();
        if (data) setMyProfile(data);
      }
      await fetchPosts();
      setLoading(false);
    })();
  }, [fetchPosts]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchPosts();
    setRefreshing(false);
  };

  const handlePost = async () => {
    if (!postText.trim()) return;
    setPosting(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setPosting(false);
      return;
    }
    const hashtags = (postText.match(/#[\w぀-鿿]+/g) ?? []).map((t) => t.slice(1));
    const { error } = await supabase.from('posts').insert({
      user_id: user.id,
      content: postText,
      hashtags,
    });
    setPosting(false);
    if (error) {
      Alert.alert('エラー', error.message);
    } else {
      setPostText('');
      await fetchPosts();
    }
  };

  const handleLike = async (postId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from('post_likes').insert({ post_id: postId, user_id: user.id });
    if (!error) {
      await supabase.from('posts').update({ likes_count: supabase.rpc as any }).eq('id', postId);
      setPosts((prev) =>
        prev.map((p) => p.id === postId ? { ...p, likes_count: p.likes_count + 1 } : p)
      );
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <AppHeader title="Activistem!" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={Colors.primary} />}
      >
        <View style={styles.titleSection}>
          <Text style={styles.title}>活動を発信する</Text>
          <Text style={styles.subtitle}>取り組みをコミュニティに伝えよう</Text>
        </View>

        <View style={styles.postBox}>
          <TextInput
            style={styles.postInput}
            placeholder="今日の活動や気づきをシェアしましょう... (#タグ も使えます)"
            placeholderTextColor="rgba(255,255,255,0.2)"
            value={postText}
            onChangeText={setPostText}
            multiline
            numberOfLines={3}
          />
          <View style={styles.postActions}>
            <View style={styles.charCount}>
              <Text style={styles.charCountText}>{postText.length} / 500</Text>
            </View>
            <TouchableOpacity
              style={[styles.postBtn, (!postText.trim() || posting) && styles.postBtnDisabled]}
              onPress={handlePost}
              disabled={!postText.trim() || posting}
            >
              {posting ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.postBtnText}>✈️ 投稿する</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.feedSection}>
          <Text style={styles.feedTitle}>タイムライン</Text>
          {loading ? (
            <ActivityIndicator color={Colors.primary} style={{ marginTop: 20 }} />
          ) : posts.length === 0 ? (
            <Text style={styles.empty}>まだ投稿がありません。最初の投稿をしてみましょう！</Text>
          ) : (
            posts.map((post) => (
              <FeedPost
                key={post.id}
                authorName={post.profiles?.full_name ?? '匿名'}
                authorRole={post.profiles?.role ?? ''}
                timeAgo={timeAgo(post.created_at)}
                body={post.content}
                hashtags={post.hashtags}
                likes={post.likes_count}
                comments={post.comments_count}
                shares={post.shares_count}
                avatarColor={post.profiles?.avatar_color ?? Colors.primary}
              />
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  titleSection: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12 },
  title: { color: '#fff', fontSize: 22, fontWeight: '900', marginBottom: 4 },
  subtitle: { color: Colors.muted, fontSize: 13 },
  postBox: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 16,
    padding: 14,
    marginHorizontal: 16,
    marginBottom: 20,
  },
  postInput: { color: '#fff', fontSize: 14, lineHeight: 22, minHeight: 72, marginBottom: 10 },
  postActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  charCount: {},
  charCountText: { color: 'rgba(255,255,255,0.25)', fontSize: 11 },
  postBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 80,
    alignItems: 'center',
  },
  postBtnDisabled: { opacity: 0.4 },
  postBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  feedSection: { paddingHorizontal: 16, paddingBottom: 20 },
  feedTitle: { color: '#fff', fontWeight: '800', fontSize: 16, marginBottom: 12 },
  empty: { color: Colors.muted, textAlign: 'center', paddingVertical: 40, fontSize: 14 },
});
