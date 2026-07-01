import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  Image,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useEffect, useMemo, useState } from 'react';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import AppHeader from '../../components/AppHeader';
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

type Message = { role: 'ai' | 'user'; text: string };

const QUICK_QUESTIONS = ['私の強みは？', '次のプロジェクトは？', '活動を振り返る'];

const AI_RESPONSES: Record<string, string> = {
  '私の強みは？':
    'あなたのプロフィールと活動記録を分析しました。\n\n✨ 強み：\n・継続的な活動発信力\n・コミュニティ構築への情熱\n・課題解決へのコミット\n\nこの調子でプロフィールを充実させると、より多くの仲間が集まります！',
  '次のプロジェクトは？':
    'あなたの活動履歴をもとにおすすめを分析しました。\n\n📁 おすすめ：\n・あなたの関心タグに近いプロジェクトを「プロジェクト」タブで探してみましょう\n・まだプロジェクトがない分野に挑戦するのもおすすめです！',
  '活動を振り返る':
    '直近30日間の活動サマリーです。\n\n📊 活動サマリー：\n・アカウントを活用するほど、より詳細な分析が可能になります\n・継続的な投稿・つながりの構築が大切です\n\nこれからの活躍を応援しています 🎉',
};

export default function MyDataScreen() {
  const [activeTab, setActiveTab] = useState<'profile' | 'ai' | 'record'>('profile');
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'ai',
      text: 'こんにちは！プロフィール・プロジェクト記録・内省メモをもとに、あなたの活動を分析・サポートします。何でも聞いてください。',
    },
  ]);
  const [input, setInput] = useState('');

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [followingCount, setFollowingCount] = useState(0);
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  // 編集モード
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editLinks, setEditLinks] = useState<string[]>(['']);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  // ── データ取得 ──
  const fetchProfile = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setLoadingProfile(false);
        return;
      }

      const [profileResult, followingResult] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase
          .from('connections')
          .select('*', { count: 'exact', head: true })
          .eq('follower_id', user.id),
      ]);

      if (profileResult.data) {
        const p = profileResult.data as Profile;
        setProfile(p);
        setEditName(p.full_name ?? '');
        setEditBio(p.bio ?? '');
        setEditLinks(p.links?.length ? p.links : ['']);
      } else {
        console.error('[fetchProfile]', profileResult.error?.message);
      }
      setFollowingCount(followingResult.count ?? 0);
    } catch (e: any) {
      console.error('[fetchProfile] exception:', e.message);
    } finally {
      setLoadingProfile(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  // ── 編集開始 / キャンセル ──
  const startEdit = () => {
    setEditName(profile?.full_name ?? '');
    setEditBio(profile?.bio ?? '');
    setEditLinks(profile?.links?.length ? [...profile.links] : ['']);
    setIsEditing(true);
  };

  const cancelEdit = () => {
    setEditName(profile?.full_name ?? '');
    setEditBio(profile?.bio ?? '');
    setEditLinks(profile?.links?.length ? [...profile.links] : ['']);
    setIsEditing(false);
  };

  // ── リンク操作 ──
  const updateLink = (index: number, value: string) => {
    setEditLinks(prev => prev.map((l, i) => i === index ? value : l));
  };

  const addLink = () => {
    setEditLinks(prev => [...prev, '']);
  };

  const removeLink = (index: number) => {
    setEditLinks(prev => {
      const next = prev.filter((_, i) => i !== index);
      return next.length === 0 ? [''] : next;
    });
  };

  // ── アバターアップロード（編集モードのみ） ──
  const handleAvatarPick = async () => {
    console.log('[avatar] ボタン押下');
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    console.log('[avatar] 権限ステータス:', status);
    if (status !== 'granted') {
      Alert.alert('権限が必要です', 'フォトライブラリへのアクセスを許可してください。');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });
    console.log('[avatar] picker結果: canceled=', result.canceled, 'assets=', result.assets?.length);

    if (result.canceled || !result.assets[0]) {
      console.log('[avatar] キャンセルまたは画像なし → 終了');
      return;
    }

    console.log('[avatar] 選択URI:', result.assets[0].uri.slice(0, 80));
    setAvatarUploading(true);
    try {
      const { data: { user }, error: authErr } = await supabase.auth.getUser();
      console.log('[avatar] getUser:', user?.id ?? 'null', authErr?.message ?? 'noErr');
      if (!user) {
        console.log('[avatar] ユーザーなし → 終了');
        return;
      }

      console.log('[avatar] 圧縮開始');
      const context = ImageManipulator.manipulate(result.assets[0].uri);
      context.resize({ width: 400 });
      const imageRef = await context.renderAsync();
      const compressed = await imageRef.saveAsync({ compress: 0.85, format: SaveFormat.JPEG });
      console.log('[avatar] 圧縮完了:', compressed.width, 'x', compressed.height, compressed.uri.slice(0, 60));

      const response = await fetch(compressed.uri);
      const arrayBuffer = await response.arrayBuffer();
      console.log('[avatar] ArrayBuffer size:', arrayBuffer.byteLength);

      const fileName = `${user.id}/avatar.jpg`;
      console.log('[avatar] Storage upload開始:', fileName);

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, arrayBuffer, { contentType: 'image/jpeg', upsert: true });

      console.log('[avatar] upload結果: data=', JSON.stringify(uploadData), 'error=', uploadError?.message ?? 'なし');

      if (uploadError) {
        if (uploadError.message.toLowerCase().includes('bucket')) {
          Alert.alert(
            'バケット未作成',
            'Supabase SQL Editorで実行してください：\n\ninsert into storage.buckets (id, name, public) values (\'avatars\', \'avatars\', true) on conflict (id) do nothing;'
          );
        } else {
          Alert.alert('アップロード失敗', uploadError.message);
        }
        return;
      }

      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(fileName);
      const avatarUrl = `${urlData.publicUrl}?t=${Date.now()}`;
      console.log('[avatar] 公開URL:', avatarUrl.slice(0, 80));

      const { error: profileUpdateError } = await supabase
        .from('profiles')
        .update({ avatar_url: avatarUrl })
        .eq('id', user.id);

      console.log('[avatar] profiles.update結果:', profileUpdateError?.message ?? '成功');

      if (profileUpdateError) {
        if (profileUpdateError.code === '42703' || profileUpdateError.message.includes('avatar_url')) {
          Alert.alert(
            'カラム未追加',
            'SQL Editorで実行：\nalter table profiles add column if not exists avatar_url text;'
          );
        } else {
          throw new Error(profileUpdateError.message);
        }
        return;
      }
      setProfile((prev) => (prev ? { ...prev, avatar_url: avatarUrl } : null));
      console.log('[avatar] プロフィール更新完了');
    } catch (e: any) {
      console.error('[avatar] 例外:', e.message);
      Alert.alert('アップロード失敗', e.message);
    } finally {
      setAvatarUploading(false);
    }
  };

  // ── 保存 ──
  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const full_name = editName.trim() || (profile?.full_name ?? '');
      const bio       = editBio.trim();
      const links     = editLinks.map(l => l.trim()).filter(l => l.length > 0);

      // links カラムも含めて保存（未追加の場合はフォールバック）
      const { error } = await supabase
        .from('profiles')
        .update({ full_name, bio, links })
        .eq('id', user.id);

      if (error && (error.code === 'PGRST204' || error.code === '42703' || error.message.includes('links'))) {
        // links カラムが未追加 → 名前・bio だけ保存してから案内
        const { error: e2 } = await supabase
          .from('profiles')
          .update({ full_name, bio })
          .eq('id', user.id);
        if (e2) throw new Error(e2.message);
        setProfile(prev => prev ? { ...prev, full_name, bio } : null);
        setIsEditing(false);
        Alert.alert(
          '名前・自己紹介を保存しました',
          'リンクを保存するには Supabase SQL Editor で次を実行してください：\n\nalter table profiles add column if not exists links text[] not null default \'{}\';'
        );
      } else if (error) {
        throw new Error(error.message);
      } else {
        setProfile(prev => prev ? { ...prev, full_name, bio, links } : null);
        setIsEditing(false);
        Alert.alert('保存しました ✓');
      }
    } catch (e: any) {
      Alert.alert('保存失敗', e.message);
    } finally {
      setSaving(false);
    }
  };

  // ── ログアウト ──
  const handleLogout = () => {
    Alert.alert('ログアウト', 'ログアウトしますか？', [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: 'ログアウト',
        style: 'destructive',
        onPress: async () => {
          await supabase.auth.signOut();
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  // ── AI チャット ──
  const sendMessage = (text: string) => {
    if (!text.trim()) return;
    const aiResponse =
      AI_RESPONSES[text] ??
      `「${text}」について分析中です...\n\nこの質問への詳細な回答機能は開発中です。お楽しみに！`;
    setMessages((prev) => [
      ...prev,
      { role: 'user', text },
      { role: 'ai', text: aiResponse },
    ]);
    setInput('');
  };

  const avatarInitial = (profile?.full_name ?? profile?.username ?? '?')[0];

  // ── アバター UI ──
  const AvatarDisplay = ({ editable }: { editable: boolean }) => (
    <TouchableOpacity
      style={styles.avatarWrap}
      onPress={editable ? handleAvatarPick : undefined}
      disabled={!editable || avatarUploading}
      activeOpacity={editable ? 0.75 : 1}
    >
      {profile?.avatar_url ? (
        <Image source={{ uri: profile.avatar_url }} style={styles.avatarImg} />
      ) : (
        <View style={[styles.avatarFallback, { backgroundColor: profile?.avatar_color ?? colors.primary }]}>
          <Text style={styles.avatarInitial}>{avatarInitial}</Text>
        </View>
      )}
      {editable && (
        <View style={styles.avatarBadge}>
          {avatarUploading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.avatarBadgeIcon}>📷</Text>
          )}
        </View>
      )}
    </TouchableOpacity>
  );

  // ── 統計行 ──
  const StatsRow = () => (
    <View style={styles.statsRow}>
      <View style={styles.statItem}>
        <Text style={styles.statVal}>{followingCount}</Text>
        <Text style={styles.statLabel}>フォロー</Text>
      </View>
      <View style={styles.statDivider} />
      <View style={styles.statItem}>
        <Text style={styles.statVal}>{profile?.followers_count ?? 0}</Text>
        <Text style={styles.statLabel}>フォロワー</Text>
      </View>
      <View style={styles.statDivider} />
      <View style={styles.statItem}>
        <Text style={styles.statVal}>{profile?.projects_count ?? 0}</Text>
        <Text style={styles.statLabel}>プロジェクト</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>
      <AppHeader
        title="Activistem!"
        right={
          <View style={styles.headerRight}>
            <TouchableOpacity style={styles.settingsBtn} onPress={() => router.push('/settings')}>
              <Text style={styles.settingsBtnText}>⚙️</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
              <Text style={styles.logoutBtnText}>ログアウト</Text>
            </TouchableOpacity>
          </View>
        }
      />

      <View style={styles.tabs}>
        {(['profile', 'ai', 'record'] as const).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab === 'profile' ? 'プロフィール' : tab === 'ai' ? 'AIチャット' : 'ノート'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ══ プロフィールタブ ══ */}
      {activeTab === 'profile' && (
        <ScrollView
          style={styles.profileScroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.profileContent}
        >
          {loadingProfile ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: 48 }} />
          ) : !profile ? (
            <View style={styles.errorState}>
              <Text style={styles.errorEmoji}>⚠️</Text>
              <Text style={styles.errorText}>
                プロフィールを読み込めませんでした。{'\n'}ネットワーク接続を確認して再起動してください。
              </Text>
            </View>
          ) : isEditing ? (
            /* ─── 編集モード ─── */
            <>
              {/* ヘッダー */}
              <View style={styles.editHeader}>
                <TouchableOpacity style={styles.cancelBtn} onPress={cancelEdit}>
                  <Text style={styles.cancelBtnText}>キャンセル</Text>
                </TouchableOpacity>
                <Text style={styles.editTitle}>プロフィールを編集</Text>
                <TouchableOpacity
                  style={[styles.saveHeaderBtn, saving && { opacity: 0.6 }]}
                  onPress={handleSave}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.saveHeaderBtnText}>保存</Text>
                  )}
                </TouchableOpacity>
              </View>

              {/* アバター（変更可） */}
              <View style={styles.avatarSection}>
                <AvatarDisplay editable />
                <Text style={styles.avatarHint}>タップして画像を変更</Text>
              </View>

              {/* 名前 */}
              <View style={styles.fieldSection}>
                <Text style={styles.fieldLabel}>名前</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={editName}
                  onChangeText={setEditName}
                  placeholder="名前を入力"
                  placeholderTextColor="rgba(255,255,255,0.2)"
                  maxLength={50}
                  returnKeyType="next"
                />
              </View>

              {/* 自己紹介 */}
              <View style={styles.fieldSection}>
                <Text style={styles.fieldLabel}>自己紹介</Text>
                <TextInput
                  style={styles.fieldTextarea}
                  value={editBio}
                  onChangeText={setEditBio}
                  placeholder="あなたの活動や想いを書きましょう"
                  placeholderTextColor="rgba(255,255,255,0.2)"
                  multiline
                  numberOfLines={5}
                  maxLength={300}
                  textAlignVertical="top"
                />
                <Text style={styles.charCount}>{editBio.length} / 300</Text>
              </View>

              {/* リンク（複数） */}
              <View style={styles.fieldSection}>
                <Text style={styles.fieldLabel}>リンク</Text>
                {editLinks.map((link, i) => (
                  <View key={i} style={[styles.linkInputRow, i > 0 && { marginTop: 8 }]}>
                    <Text style={styles.linkIcon}>🔗</Text>
                    <TextInput
                      style={styles.linkInput}
                      value={link}
                      onChangeText={(v) => updateLink(i, v)}
                      placeholder="https://..."
                      placeholderTextColor="rgba(255,255,255,0.2)"
                      keyboardType="url"
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                    {(editLinks.length > 1 || link.length > 0) && (
                      <TouchableOpacity onPress={() => removeLink(i)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Text style={styles.clearBtn}>✕</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
                {editLinks.length < 5 && (
                  <TouchableOpacity style={styles.addLinkBtn} onPress={addLink}>
                    <Text style={styles.addLinkBtnText}>＋ リンクを追加</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* 保存ボタン（大） */}
              <TouchableOpacity
                style={[styles.saveBtn, saving && { opacity: 0.6 }]}
                onPress={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.saveBtnText}>保存する</Text>
                )}
              </TouchableOpacity>
            </>
          ) : (
            /* ─── 閲覧モード ─── */
            <>
              {/* アバター + 名前 + 編集ボタン */}
              <View style={styles.viewHeader}>
                <View style={styles.avatarSection}>
                  <AvatarDisplay editable={false} />
                  <Text style={styles.profileName}>{profile.full_name}</Text>
                  <Text style={styles.profileRole}>{profile.role}</Text>
                  <Text style={styles.profileUsername}>@{profile.username}</Text>
                </View>
                <TouchableOpacity style={styles.editBtn} onPress={startEdit}>
                  <Text style={styles.editBtnText}>✏️ 編集</Text>
                </TouchableOpacity>
              </View>

              {/* 統計 */}
              <StatsRow />

              {/* 自己紹介 */}
              <View style={styles.bioSection}>
                <Text style={styles.fieldLabel}>自己紹介</Text>
                {profile.bio ? (
                  <Text style={styles.bioText}>{profile.bio}</Text>
                ) : (
                  <TouchableOpacity onPress={startEdit}>
                    <Text style={styles.bioEmpty}>タップして自己紹介を追加 →</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* リンク（複数） */}
              <View style={styles.linksViewSection}>
                <Text style={styles.fieldLabel}>リンク</Text>
                {profile.links?.filter(l => l.trim()).length > 0 ? (
                  profile.links.filter(l => l.trim()).map((link, i) => (
                    <TouchableOpacity
                      key={i}
                      style={[styles.linkCard, i > 0 && { marginTop: 8 }]}
                      onPress={() => Linking.openURL(link).catch(() => {})}
                    >
                      <Text style={styles.linkIcon}>🔗</Text>
                      <Text style={styles.linkText} numberOfLines={1}>{link}</Text>
                      <Text style={styles.linkArrow}>↗</Text>
                    </TouchableOpacity>
                  ))
                ) : (
                  <TouchableOpacity style={styles.linkCardEmpty} onPress={startEdit}>
                    <Text style={styles.linkIcon}>🔗</Text>
                    <Text style={styles.linkEmptyText}>タップしてリンクを追加 →</Text>
                  </TouchableOpacity>
                )}
              </View>
            </>
          )}
        </ScrollView>
      )}

      {/* ══ AIチャットタブ ══ */}
      {activeTab === 'ai' && (
        <KeyboardAvoidingView
          style={styles.chatContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={120}
        >
          <View style={styles.aiHeader}>
            <View style={styles.aiIconWrap}>
              <Text style={styles.aiIcon}>✨</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.aiTitle}>AIアシスタント</Text>
              <Text style={styles.aiSubtitle}>データをもとに分析・提案</Text>
            </View>
            <View style={styles.onlineIndicator}>
              <View style={styles.onlineDot} />
              <Text style={styles.onlineText}>オンライン</Text>
            </View>
          </View>

          <ScrollView
            style={styles.messageList}
            contentContainerStyle={styles.messageListContent}
            showsVerticalScrollIndicator={false}
          >
            {messages.map((msg, i) => (
              <View
                key={i}
                style={[
                  styles.messageBubbleWrap,
                  msg.role === 'user' ? styles.userBubbleWrap : styles.aiBubbleWrap,
                ]}
              >
                {msg.role === 'ai' && (
                  <View style={styles.aiAvatar}>
                    <Text style={styles.aiAvatarText}>🤖</Text>
                  </View>
                )}
                <View style={[styles.bubble, msg.role === 'user' ? styles.userBubble : styles.aiBubble]}>
                  <Text style={styles.bubbleText}>{msg.text}</Text>
                </View>
              </View>
            ))}
          </ScrollView>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.quickQScroll}
            contentContainerStyle={styles.quickQContent}
          >
            {QUICK_QUESTIONS.map((q) => (
              <TouchableOpacity key={q} style={styles.quickQ} onPress={() => sendMessage(q)}>
                <Text style={styles.quickQText}>{q}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={styles.inputRow}>
            <TextInput
              style={styles.inputField}
              placeholder="質問を入力..."
              placeholderTextColor="rgba(255,255,255,0.22)"
              value={input}
              onChangeText={setInput}
              onSubmitEditing={() => sendMessage(input)}
              returnKeyType="send"
            />
            <TouchableOpacity
              style={[styles.sendBtn, !input.trim() && styles.sendBtnDisabled]}
              onPress={() => sendMessage(input)}
              disabled={!input.trim()}
            >
              <Text style={styles.sendBtnText}>✈</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}

      {/* ══ ノートタブ ══ */}
      {activeTab === 'record' && (
        <View style={styles.placeholder}>
          <Text style={styles.placeholderEmoji}>✏️</Text>
          <Text style={styles.placeholderText}>
            ノートは近日公開予定です。{'\n'}ふと気づいたこと、考えたことを{'\n'}気軽にメモしていきましょう。
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
}

function makeStyles(c: AppColors) {
  return StyleSheet.create({
    container: { flex: 1 },
    headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    settingsBtn: { paddingHorizontal: 6, paddingVertical: 4 },
    settingsBtnText: { fontSize: 18 },
    logoutBtn: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: c.overlay45,
    },
    logoutBtnText: { color: c.muted, fontSize: 12 },

    tabs: {
      flexDirection: 'row',
      borderBottomWidth: 1,
      borderBottomColor: c.cardBorder,
      marginHorizontal: 16,
    },
    tab: { paddingHorizontal: 10, paddingBottom: 10, paddingTop: 14, marginRight: 4 },
    tabActive: { borderBottomWidth: 2, borderBottomColor: c.primary },
    tabText: { color: c.mutedLight, fontSize: 13, fontWeight: '600' },
    tabTextActive: { color: c.text },

    profileScroll: { flex: 1 },
    profileContent: { paddingHorizontal: 16, paddingBottom: 48 },

    errorState: { alignItems: 'center', paddingTop: 64, paddingHorizontal: 32 },
    errorEmoji: { fontSize: 40, marginBottom: 12 },
    errorText: { color: c.muted, textAlign: 'center', fontSize: 14, lineHeight: 22 },

    avatarWrap: { position: 'relative', marginBottom: 12 },
    avatarImg: { width: 96, height: 96, borderRadius: 48, borderWidth: 3, borderColor: c.primary },
    avatarFallback: {
      width: 96, height: 96, borderRadius: 48,
      alignItems: 'center', justifyContent: 'center',
      borderWidth: 3, borderColor: c.primary,
    },
    avatarInitial: { color: '#fff', fontWeight: '900', fontSize: 38 },
    avatarBadge: {
      position: 'absolute', bottom: 0, right: 0,
      width: 30, height: 30, borderRadius: 15,
      backgroundColor: c.primary,
      alignItems: 'center', justifyContent: 'center',
      borderWidth: 2, borderColor: c.bg,
    },
    avatarBadgeIcon: { fontSize: 14 },
    avatarSection: { alignItems: 'center', paddingTop: 24, paddingBottom: 4 },
    avatarHint: { color: c.muted, fontSize: 11, marginTop: 4 },

    statsRow: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: c.card, borderWidth: 1, borderColor: c.cardBorder,
      borderRadius: 16, paddingVertical: 16, marginBottom: 20, marginTop: 16,
    },
    statItem: { flex: 1, alignItems: 'center' },
    statVal: { color: c.text, fontWeight: '900', fontSize: 22, marginBottom: 2 },
    statLabel: { color: c.muted, fontSize: 11 },
    statDivider: { width: 1, height: 32, backgroundColor: c.glassBorder },

    fieldSection: { marginBottom: 16 },
    fieldLabel: {
      color: c.overlay45, fontSize: 11, fontWeight: '700',
      letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8,
    },
    fieldInput: {
      backgroundColor: c.card, borderWidth: 1, borderColor: c.cardBorder,
      borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
      color: c.text, fontSize: 15, fontWeight: '600',
    },
    fieldTextarea: {
      backgroundColor: c.card, borderWidth: 1, borderColor: c.cardBorder,
      borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
      color: c.text, fontSize: 14, lineHeight: 22, minHeight: 110,
    },
    charCount: { color: c.faint, fontSize: 11, textAlign: 'right', marginTop: 4 },
    linkInputRow: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: c.card, borderWidth: 1, borderColor: c.cardBorder,
      borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, gap: 8,
    },
    linkIcon: { fontSize: 16 },
    linkInput: { flex: 1, color: c.text, fontSize: 14 },
    clearBtn: { color: c.overlay30, fontSize: 14, paddingHorizontal: 4 },
    addLinkBtn: {
      marginTop: 8, paddingVertical: 10, borderRadius: 10, borderWidth: 1,
      borderColor: `${c.primary}59`, borderStyle: 'dashed', alignItems: 'center',
    },
    addLinkBtnText: { color: c.primary2, fontSize: 13, fontWeight: '600' },
    linksViewSection: { marginBottom: 16 },

    saveBtn: {
      backgroundColor: c.primary, borderRadius: 14,
      paddingVertical: 15, alignItems: 'center', marginTop: 8,
    },
    saveBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },

    editHeader: {
      flexDirection: 'row', alignItems: 'center',
      justifyContent: 'space-between', paddingTop: 16, paddingBottom: 4,
    },
    editTitle: { color: c.text, fontWeight: '700', fontSize: 15 },
    cancelBtn: { paddingVertical: 6, paddingHorizontal: 4 },
    cancelBtnText: { color: c.muted, fontSize: 14 },
    saveHeaderBtn: {
      backgroundColor: c.primary, paddingVertical: 6, paddingHorizontal: 16,
      borderRadius: 20, minWidth: 56, alignItems: 'center',
    },
    saveHeaderBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },

    viewHeader: { position: 'relative' },
    editBtn: {
      position: 'absolute', top: 24, right: 0,
      backgroundColor: c.inputBg, borderRadius: 20,
      paddingHorizontal: 14, paddingVertical: 6,
      borderWidth: 1, borderColor: c.glassBorder,
    },
    editBtnText: { color: c.muted, fontSize: 12, fontWeight: '600' },

    profileName: { color: c.text, fontWeight: '900', fontSize: 20, marginBottom: 3 },
    profileRole: { color: c.muted, fontSize: 13, marginBottom: 3 },
    profileUsername: { color: c.primary2, fontSize: 12, marginBottom: 4 },

    bioSection: { marginBottom: 16 },
    bioText: { color: c.textBody, fontSize: 14, lineHeight: 22 },
    bioEmpty: { color: c.primary2, fontSize: 13 },

    linkCard: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: c.card, borderWidth: 1, borderColor: c.cardBorder,
      borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, gap: 8,
    },
    linkText: { flex: 1, color: c.primary2, fontSize: 13 },
    linkArrow: { color: c.primary2, fontSize: 14 },
    linkCardEmpty: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: c.glass, borderWidth: 1, borderColor: c.cardBorder,
      borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, gap: 8,
      borderStyle: 'dashed',
    },
    linkEmptyText: { color: c.overlay30, fontSize: 13 },

    chatContainer: { flex: 1, paddingHorizontal: 16 },
    aiHeader: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      backgroundColor: c.card, borderWidth: 1, borderColor: c.cardBorder,
      borderRadius: 14, padding: 12, marginBottom: 12, marginTop: 12,
    },
    aiIconWrap: {
      width: 36, height: 36, backgroundColor: c.primary,
      borderRadius: 10, alignItems: 'center', justifyContent: 'center',
    },
    aiIcon: { fontSize: 16 },
    aiTitle: { color: c.text, fontWeight: '700', fontSize: 13 },
    aiSubtitle: { color: c.overlay30, fontSize: 11 },
    onlineIndicator: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    onlineDot: { width: 6, height: 6, backgroundColor: c.green2, borderRadius: 3 },
    onlineText: { color: c.green2, fontSize: 11 },
    messageList: { flex: 1 },
    messageListContent: { paddingBottom: 8, gap: 10 },
    messageBubbleWrap: { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
    aiBubbleWrap: { justifyContent: 'flex-start' },
    userBubbleWrap: { justifyContent: 'flex-end' },
    aiAvatar: {
      width: 28, height: 28, backgroundColor: c.primary,
      borderRadius: 8, alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    },
    aiAvatarText: { fontSize: 14 },
    bubble: { maxWidth: '80%', padding: 10, borderRadius: 14 },
    aiBubble: { backgroundColor: `${c.primary}33`, borderTopLeftRadius: 4 },
    userBubble: { backgroundColor: c.primary, borderTopRightRadius: 4 },
    bubbleText: { color: c.textBody, fontSize: 13, lineHeight: 20 },
    quickQScroll: { marginVertical: 10, flexGrow: 0 },
    quickQContent: { gap: 8 },
    quickQ: { backgroundColor: c.inputBg, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10 },
    quickQText: { color: c.muted, fontSize: 12 },
    inputRow: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: c.inputBg, borderRadius: 14,
      paddingHorizontal: 14, paddingVertical: 10, marginBottom: 12, gap: 10,
    },
    inputField: { flex: 1, color: c.text, fontSize: 13 },
    sendBtn: {
      width: 32, height: 32, backgroundColor: c.primary,
      borderRadius: 10, alignItems: 'center', justifyContent: 'center',
    },
    sendBtnDisabled: { opacity: 0.4 },
    sendBtnText: { color: '#fff', fontSize: 16 },

    placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
    placeholderEmoji: { fontSize: 48, marginBottom: 16 },
    placeholderText: { color: c.muted, textAlign: 'center', fontSize: 14, lineHeight: 22 },
  });
}
