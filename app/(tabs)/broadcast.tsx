import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  RefreshControl,
  ViewToken,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import AppHeader from '../../components/AppHeader';
import FeedPost from '../../components/FeedPost';
import { useColors } from '../../lib/ThemeContext';
import { AppColors } from '../../constants/Colors';
import { supabase } from '../../lib/supabase';

const MAX_IMAGES = 4;

type Post = {
  id: string;
  user_id: string;
  content: string;
  hashtags: string[];
  likes_count: number;
  comments_count: number;
  shares_count: number;
  created_at: string;
  image_url: string | null;
  image_urls: string[];
  profiles: {
    full_name: string;
    username: string;
    role: string;
    avatar_color: string;
    avatar_url: string | null;
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

// 1枚分を圧縮して Storage へアップロード
async function uploadOne(localUri: string, userId: string, index: number): Promise<string> {
  const context = ImageManipulator.manipulate(localUri);
  context.resize({ width: 1200 });
  const imageRef = await context.renderAsync();
  const compressed = await imageRef.saveAsync({ compress: 0.75, format: SaveFormat.JPEG });

  const response = await fetch(compressed.uri);
  const arrayBuffer = await response.arrayBuffer();
  const fileName = `${userId}/${Date.now()}_${index}.jpg`;

  const { error } = await supabase.storage
    .from('post-images')
    .upload(fileName, arrayBuffer, { contentType: 'image/jpeg', upsert: false });

  if (error) throw new Error(`画像${index + 1}: ${error.message}`);

  const { data: urlData } = supabase.storage.from('post-images').getPublicUrl(fileName);
  return urlData.publicUrl;
}

// 複数枚を順番にアップロード（メモリ負荷を避けるため直列）
async function uploadImages(
  localUris: string[],
  userId: string,
  onProgress: (done: number, total: number) => void,
): Promise<string[]> {
  const urls: string[] = [];
  for (let i = 0; i < localUris.length; i++) {
    urls.push(await uploadOne(localUris[i], userId, i));
    onProgress(i + 1, localUris.length);
  }
  return urls;
}

export default function BroadcastScreen() {
  const [postText, setPostText] = useState('');
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [posting, setPosting] = useState(false);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [uploadProgress, setUploadProgress] = useState('');
  const [visibleIds, setVisibleIds] = useState<Set<string>>(new Set());
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    setVisibleIds(new Set(viewableItems.map((v: any) => v.key)));
  }).current;

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 10, minimumViewTime: 0 }).current;

  const fetchPosts = useCallback(async () => {
    // image_urls を明示的に含めることで、カラムが存在しない場合は error になりフォールバックへ進む
    // （SELECT * はカラム不存在でもエラーにならず黙って省略するため、明示列挙が必要）
    let { data, error } = await supabase
      .from('posts')
      .select('id, user_id, content, hashtags, likes_count, comments_count, shares_count, created_at, image_url, image_urls, profiles(full_name, username, role, avatar_color, avatar_url)')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      // image_urls カラムが未追加の環境向けフォールバック
      console.warn('[fetchPosts] 失敗、フォールバック:', error.message, error.code);
      const fallback = await supabase
        .from('posts')
        .select('id, user_id, content, hashtags, likes_count, comments_count, shares_count, created_at, image_url, profiles(full_name, username, role, avatar_color, avatar_url)')
        .order('created_at', { ascending: false })
        .limit(50);
      if (fallback.error) {
        console.error('[fetchPosts] fallback エラー:', fallback.error.message);
        return;
      }
      data = fallback.data as any;
    }

    if (data) setPosts(data.map((p: any) => ({ ...p, image_urls: p.image_urls ?? [] })) as Post[]);
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [, { data: { user } }] = await Promise.all([
        fetchPosts(),
        supabase.auth.getUser(),
      ]);
      setCurrentUserId(user?.id ?? null);
      setLoading(false);
    })();
  }, [fetchPosts]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchPosts();
    setRefreshing(false);
  };

  const handleDelete = useCallback(async (post: Post) => {
    // Storage の画像を削除（ベストエフォート）
    const allUrls = post.image_urls?.length
      ? post.image_urls
      : post.image_url ? [post.image_url] : [];
    for (const url of allUrls) {
      const match = url.match(/\/storage\/v1\/object\/public\/post-images\/(.+)/);
      if (match?.[1]) {
        await supabase.storage.from('post-images').remove([match[1]]);
      }
    }

    // DB から投稿を削除（RLS により本人の投稿のみ許可）
    const { error } = await supabase.from('posts').delete().eq('id', post.id);
    if (error) {
      Alert.alert('削除エラー', error.message);
      return;
    }

    setPosts(prev => prev.filter(p => p.id !== post.id));
    setVisibleIds(prev => {
      const next = new Set(prev);
      next.delete(post.id);
      return next;
    });
  }, []);

  const handlePickImage = async () => {
    if (selectedImages.length >= MAX_IMAGES) {
      Alert.alert('上限', `画像は最大${MAX_IMAGES}枚まで追加できます。`);
      return;
    }

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('権限が必要です', 'フォトライブラリへのアクセスを許可してください。');
      return;
    }

    const remaining = MAX_IMAGES - selectedImages.length;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      allowsMultipleSelection: true,
      selectionLimit: remaining,
      quality: 1,
    });

    if (!result.canceled && result.assets.length > 0) {
      const newUris = result.assets.map(a => a.uri);
      setSelectedImages(prev => [...prev, ...newUris].slice(0, MAX_IMAGES));
    }
  };

  const removeImage = (index: number) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
  };

  const handlePost = async () => {
    if (!postText.trim()) return;
    setPosting(true);
    setUploadProgress('');

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      setPosting(false);
      Alert.alert('エラー', 'ログインが必要です。');
      return;
    }

    let imageUrls: string[] = [];

    if (selectedImages.length > 0) {
      setUploadProgress(`画像をアップロード中... (0/${selectedImages.length})`);
      try {
        imageUrls = await uploadImages(
          selectedImages,
          user.id,
          (done, total) => setUploadProgress(`画像をアップロード中... (${done}/${total})`),
        );
        setUploadProgress('');
      } catch (e: any) {
        setPosting(false);
        setUploadProgress('');
        Alert.alert('画像アップロードエラー', e.message);
        return;
      }
    }

    const hashtags = (postText.match(/#[\w぀-鿿]+/g) ?? []).map((t) => t.slice(1));

    let insertError = (await supabase.from('posts').insert({
      user_id: user.id,
      content: postText,
      hashtags,
      image_url: imageUrls[0] ?? null,
      image_urls: imageUrls,
    })).error;

    // image_urls カラム未追加なら除いて再投稿
    if (insertError && (insertError.code === 'PGRST204' || insertError.message.includes('image_urls'))) {
      console.warn('[post] image_urls カラム未追加、フォールバック投稿');
      insertError = (await supabase.from('posts').insert({
        user_id: user.id,
        content: postText,
        hashtags,
        image_url: imageUrls[0] ?? null,
      })).error;
    }

    setPosting(false);
    if (insertError) {
      console.error('[post] insert エラー:', insertError.message, insertError.code);
      Alert.alert('投稿エラー', insertError.message);
    } else {
      setPostText('');
      setSelectedImages([]);
      await fetchPosts();
    }
  };

  const handleLike = async (postId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from('post_likes').insert({ post_id: postId, user_id: user.id });
    if (!error) {
      setPosts((prev) =>
        prev.map((p) => p.id === postId ? { ...p, likes_count: p.likes_count + 1 } : p)
      );
    }
  };

  const canPost = postText.trim().length > 0 && !posting;

  const postCreationBox = (
    <View>
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
          maxLength={500}
        />

        {/* 選択済み画像プレビュー */}
        {selectedImages.length > 0 && (
          <View style={styles.imageStrip}>
            {selectedImages.map((uri, i) => (
              <View key={i} style={styles.thumbWrap}>
                <Image source={{ uri }} style={styles.thumb} resizeMode="cover" />
                <TouchableOpacity style={styles.thumbRemove} onPress={() => removeImage(i)}>
                  <Text style={styles.thumbRemoveText}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}
            {selectedImages.length < MAX_IMAGES && (
              <TouchableOpacity style={styles.thumbAdd} onPress={handlePickImage}>
                <Text style={styles.thumbAddIcon}>＋</Text>
                <Text style={styles.thumbAddLabel}>{MAX_IMAGES - selectedImages.length}枚追加可</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {uploadProgress !== '' && (
          <View style={styles.progressRow}>
            <ActivityIndicator color={colors.primary} size="small" />
            <Text style={styles.progressText}>{uploadProgress}</Text>
          </View>
        )}

        <View style={styles.postActions}>
          {selectedImages.length === 0 && (
            <TouchableOpacity style={styles.imagePickerBtn} onPress={handlePickImage} disabled={posting}>
              <Text style={styles.imagePickerBtnText}>📷 画像を追加</Text>
            </TouchableOpacity>
          )}
          <View style={styles.postRight}>
            <Text style={styles.charCountText}>{postText.length} / 500</Text>
            <TouchableOpacity
              style={[styles.postBtn, !canPost && styles.postBtnDisabled]}
              onPress={handlePost}
              disabled={!canPost}
            >
              {posting ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.postBtnText}>✈️ 投稿する</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <View style={styles.feedHeader}>
        <Text style={styles.feedTitle}>タイムライン</Text>
        {loading && <ActivityIndicator color={colors.primary} size="small" />}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>
      <AppHeader title="Activistem!" />
      <View style={styles.centerWrap}>
      <FlatList
        data={posts}
        keyExtractor={post => post.id}
        renderItem={({ item: post }) => (
          <FeedPost
            authorName={post.profiles?.full_name ?? '匿名'}
            authorRole={post.profiles?.role ?? ''}
            timeAgo={timeAgo(post.created_at)}
            body={post.content}
            hashtags={post.hashtags}
            likes={post.likes_count}
            comments={post.comments_count}
            shares={post.shares_count}
            avatarColor={post.profiles?.avatar_color ?? colors.primary}
            avatarUrl={post.profiles?.avatar_url ?? null}
            authorId={post.user_id}
            currentUserId={currentUserId ?? undefined}
            imageUrls={post.image_urls?.length ? post.image_urls : post.image_url ? [post.image_url] : []}
            onLike={() => handleLike(post.id)}
            onDelete={currentUserId && post.user_id === currentUserId
              ? () => handleDelete(post)
              : undefined}
            visible={visibleIds.has(post.id)}
          />
        )}
        ListHeaderComponent={postCreationBox}
        ListEmptyComponent={
          loading ? null : (
            <Text style={styles.empty}>まだ投稿がありません。最初の投稿をしてみましょう！</Text>
          )
        }
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        windowSize={5}
        initialNumToRender={4}
        maxToRenderPerBatch={4}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
        }
        contentContainerStyle={{ paddingBottom: 24 }}
      />
      </View>
    </SafeAreaView>
  );
}

function makeStyles(c: AppColors) {
  return StyleSheet.create({
    container: { flex: 1 },
    centerWrap: { flex: 1, width: '100%', maxWidth: 500, alignSelf: 'center' },
    titleSection: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12 },
    title: { color: c.text, fontSize: 22, fontWeight: '900', marginBottom: 4 },
    subtitle: { color: c.muted, fontSize: 13 },
    postBox: {
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.cardBorder,
      borderRadius: 16,
      padding: 14,
      marginHorizontal: 16,
      marginBottom: 20,
    },
    postInput: { color: c.text, fontSize: 14, lineHeight: 22, minHeight: 72, marginBottom: 10 },
    imageStrip: { flexDirection: 'row', gap: 8, marginBottom: 10, flexWrap: 'wrap' },
    thumbWrap: { position: 'relative', width: 80, height: 80, borderRadius: 8, overflow: 'hidden' },
    thumb: { width: 80, height: 80 },
    thumbRemove: {
      position: 'absolute',
      top: 4,
      right: 4,
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: 'rgba(0,0,0,0.65)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    thumbRemoveText: { color: '#fff', fontSize: 10, fontWeight: '700' },
    thumbAdd: {
      width: 80,
      height: 80,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: `${c.primary}66`,
      borderStyle: 'dashed',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
    },
    thumbAddIcon: { color: c.primary2, fontSize: 22, fontWeight: '300' },
    thumbAddLabel: { color: c.muted, fontSize: 10 },
    progressRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
    progressText: { color: c.muted, fontSize: 12 },
    postActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
    imagePickerBtn: { backgroundColor: c.inputBg, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10 },
    imagePickerBtnText: { color: c.muted, fontSize: 12, fontWeight: '600' },
    postRight: { flexDirection: 'row', alignItems: 'center', gap: 10, marginLeft: 'auto' },
    charCountText: { color: c.faint, fontSize: 11 },
    postBtn: {
      backgroundColor: c.primary,
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
      minWidth: 80,
      alignItems: 'center',
    },
    postBtnDisabled: { opacity: 0.4 },
    postBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
    feedHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingBottom: 10 },
    feedTitle: { color: c.text, fontWeight: '800', fontSize: 16 },
    empty: { color: c.muted, textAlign: 'center', paddingVertical: 40, fontSize: 14 },
  });
}
