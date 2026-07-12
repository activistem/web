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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

type Note = {
  id: string;
  date: string;
  content: string;
  created_at: string;
};

type ChatSession = {
  id: string;
  title: string;
  created_at: string;
};

type ChatMessage = {
  id: string;
  session_id: string;
  role: 'user' | 'model';
  content: string;
  created_at: string;
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatNoteDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-');
  return `${y}年${parseInt(m, 10)}月${parseInt(d, 10)}日`;
}

function formatSessionDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

async function callGemini(history: ChatMessage[], userText: string): Promise<string> {
  const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY ?? '';
  if (!apiKey || apiKey === 'your-gemini-api-key-here') {
    throw new Error('Gemini APIキーが未設定です。.env.local の EXPO_PUBLIC_GEMINI_API_KEY を設定してください。');
  }
  const contents = [
    ...history.map(m => ({ role: m.role, parts: [{ text: m.content }] })),
    { role: 'user', parts: [{ text: userText }] },
  ];
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents,
        systemInstruction: {
          parts: [{ text: 'あなたはActivistem!というソーシャルアクションアプリのAIアシスタントです。ユーザーの社会活動・プロジェクト・自己成長をサポートしてください。温かく、具体的に、日本語で回答してください。' }],
        },
        generationConfig: { temperature: 0.7, maxOutputTokens: 1000 },
      }),
    }
  );
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? 'エラーが発生しました。';
}

export default function MyDataScreen() {
  const [activeTab, setActiveTab] = useState<'profile' | 'activity' | 'ai' | 'record'>('profile');
  // AIチャット
  const chatScrollRef = useRef<ScrollView | null>(null);
  const [chatMode, setChatMode] = useState<'list' | 'chat'>('list');
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [currentSession, setCurrentSession] = useState<ChatSession | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [loadingChatMessages, setLoadingChatMessages] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [followingCount, setFollowingCount] = useState(0);
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  // ノート
  const [notes, setNotes] = useState<Note[]>([]);
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [noteDate, setNoteDate] = useState(todayIso);
  const [noteContent, setNoteContent] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  const fetchNotes = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setLoadingNotes(true);
    const { data, error } = await supabase
      .from('notes')
      .select('id, date, content, created_at')
      .eq('user_id', user.id)
      .order('date', { ascending: false });
    if (!error && data) setNotes(data as Note[]);
    setLoadingNotes(false);
  }, []);

  useEffect(() => {
    if (activeTab === 'record') fetchNotes();
  }, [activeTab, fetchNotes]);

  const handleSaveNote = async () => {
    if (!noteContent.trim()) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setSavingNote(true);
    const { data, error } = await supabase
      .from('notes')
      .insert({ user_id: user.id, date: noteDate || todayIso(), content: noteContent.trim() })
      .select('id, date, content, created_at')
      .single();
    setSavingNote(false);
    if (error) {
      if (error.code === '42P01') {
        Alert.alert(
          'テーブル未作成',
          'Supabase SQL Editorで supabase_schema.sql を実行してください。\n\n（notes テーブルが必要です）'
        );
      } else {
        Alert.alert('保存失敗', error.message);
      }
      return;
    }
    if (data) {
      setNotes(prev => [data as Note, ...prev]);
      setNoteContent('');
      setNoteDate(todayIso());
    }
  };

  const handleDeleteNote = (noteId: string) => {
    const doDelete = async () => {
      const { error } = await supabase.from('notes').delete().eq('id', noteId);
      if (!error) setNotes(prev => prev.filter(n => n.id !== noteId));
    };
    if (Platform.OS === 'web') {
      if (window.confirm('このノートを削除しますか？')) doDelete();
    } else {
      Alert.alert('削除', 'このノートを削除しますか？', [
        { text: 'キャンセル', style: 'cancel' },
        { text: '削除', style: 'destructive', onPress: doDelete },
      ]);
    }
  };

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
      const { data: { user }, error: authErr } = await supabase.auth.getUser();
      console.log('[fetchProfile] user:', user?.id ?? 'null', authErr?.message ?? '');
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

      console.log('[fetchProfile] data:', JSON.stringify(profileResult.data));
      console.log('[fetchProfile] error:', profileResult.error?.message ?? 'none');

      if (profileResult.data) {
        const p = profileResult.data as Profile;
        console.log('[fetchProfile] full_name:', p.full_name, '/ role:', p.role, '/ username:', p.username);
        setProfile(p);
        setEditName(p.full_name ?? '');
        setEditBio(p.bio ?? '');
        setEditLinks(p.links?.length ? p.links : ['']);
      } else {
        console.error('[fetchProfile] no data:', profileResult.error?.message);
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

  const SQL_HINT = 'Supabase SQL Editorで supabase_schema.sql を実行してください。\n（chat_sessions / chat_messages テーブルが必要です）';
  const isMissingTable = (code?: string) => code === 'PGRST200' || code === '42P01';

  // ── AI チャット ──
  const fetchSessions = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setLoadingSessions(true);
    const { data, error } = await supabase
      .from('chat_sessions')
      .select('id, title, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (error) {
      if (!isMissingTable(error.code)) Alert.alert('エラー', error.message);
    } else if (data) {
      setSessions(data as ChatSession[]);
    }
    setLoadingSessions(false);
  }, []);

  useEffect(() => {
    if (activeTab === 'ai') fetchSessions();
  }, [activeTab, fetchSessions]);

  const fetchChatMessages = useCallback(async (sessionId: string) => {
    setLoadingChatMessages(true);
    const { data } = await supabase
      .from('chat_messages')
      .select('id, session_id, role, content, created_at')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });
    if (data) setChatMessages(data as ChatMessage[]);
    setLoadingChatMessages(false);
  }, []);

  const openSession = async (session: ChatSession) => {
    setCurrentSession(session);
    setChatMessages([]);
    setChatMode('chat');
    await fetchChatMessages(session.id);
  };

  const startNewChat = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data, error } = await supabase
      .from('chat_sessions')
      .insert({ user_id: user.id, title: '新しい会話' })
      .select('id, title, created_at')
      .single();
    if (error) {
      Alert.alert(
        isMissingTable(error.code) ? 'テーブル未作成' : 'エラー',
        isMissingTable(error.code) ? SQL_HINT : error.message
      );
      return;
    }
    if (data) {
      const session = data as ChatSession;
      setSessions(prev => [session, ...prev]);
      setCurrentSession(session);
      setChatMessages([]);
      setChatMode('chat');
    }
  };

  const sendChatMessage = async () => {
    if (!chatInput.trim() || isAiThinking || !currentSession) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const text = chatInput.trim();
    setChatInput('');
    setIsAiThinking(true);

    const { data: userMsgData } = await supabase
      .from('chat_messages')
      .insert({ session_id: currentSession.id, user_id: user.id, role: 'user', content: text })
      .select('id, session_id, role, content, created_at')
      .single();

    const updatedMessages = userMsgData
      ? [...chatMessages, userMsgData as ChatMessage]
      : chatMessages;
    setChatMessages(updatedMessages);

    if (chatMessages.length === 0) {
      const newTitle = text.length > 20 ? text.slice(0, 20) + '…' : text;
      await supabase.from('chat_sessions').update({ title: newTitle }).eq('id', currentSession.id);
      setCurrentSession(prev => prev ? { ...prev, title: newTitle } : null);
      setSessions(prev => prev.map(s => s.id === currentSession.id ? { ...s, title: newTitle } : s));
    }

    try {
      const aiText = await callGemini(updatedMessages, text);
      const { data: aiMsgData } = await supabase
        .from('chat_messages')
        .insert({ session_id: currentSession.id, user_id: user.id, role: 'model', content: aiText })
        .select('id, session_id, role, content, created_at')
        .single();
      if (aiMsgData) setChatMessages(prev => [...prev, aiMsgData as ChatMessage]);
    } catch (e: any) {
      const errText = `エラー: ${e.message}`;
      const { data: errMsgData } = await supabase
        .from('chat_messages')
        .insert({ session_id: currentSession.id, user_id: user.id, role: 'model', content: errText })
        .select('id, session_id, role, content, created_at')
        .single();
      if (errMsgData) setChatMessages(prev => [...prev, errMsgData as ChatMessage]);
    } finally {
      setIsAiThinking(false);
    }
  };

  const deleteSession = (sessionId: string) => {
    const doDelete = async () => {
      await supabase.from('chat_sessions').delete().eq('id', sessionId);
      setSessions(prev => prev.filter(s => s.id !== sessionId));
    };
    if (Platform.OS === 'web') {
      if (window.confirm('この会話を削除しますか？')) doDelete();
    } else {
      Alert.alert('削除', 'この会話を削除しますか？', [
        { text: 'キャンセル', style: 'cancel' },
        { text: '削除', style: 'destructive', onPress: doDelete },
      ]);
    }
  };

  const startRenaming = (session: ChatSession) => {
    setEditingSessionId(session.id);
    setEditingTitle(session.title);
  };

  const commitRename = async () => {
    if (!editingSessionId) return;
    const newTitle = editingTitle.trim() || '新しい会話';
    setEditingSessionId(null);
    setEditingTitle('');
    await supabase.from('chat_sessions').update({ title: newTitle }).eq('id', editingSessionId);
    setSessions(prev => prev.map(s => s.id === editingSessionId ? { ...s, title: newTitle } : s));
    if (currentSession?.id === editingSessionId) {
      setCurrentSession(prev => prev ? { ...prev, title: newTitle } : null);
    }
  };

  const avatarInitial = (profile?.full_name ?? profile?.username ?? '?')[0];
  const avatarBg = profile?.avatar_color ?? colors.primary;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>
      <AppHeader
        title="Activistem!"
        right={
          <TouchableOpacity style={styles.settingsBtn} onPress={() => router.push('/settings')}>
            <Text style={styles.settingsBtnText}>⚙️</Text>
          </TouchableOpacity>
        }
      />

      <View style={styles.tabs}>
        {(['profile', 'activity', 'ai', 'record'] as const).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab === 'profile' ? 'プロフィール' : tab === 'activity' ? '活動記録' : tab === 'ai' ? 'AIチャット' : 'ノート'}
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
                <TouchableOpacity
                  style={styles.avatarWrap}
                  onPress={handleAvatarPick}
                  disabled={avatarUploading}
                  activeOpacity={0.75}
                >
                  {profile.avatar_url ? (
                    <Image source={{ uri: profile.avatar_url }} style={styles.avatarImg} />
                  ) : (
                    <View style={[styles.avatarFallback, { backgroundColor: avatarBg }]}>
                      <Text style={styles.avatarInitial}>{avatarInitial}</Text>
                    </View>
                  )}
                  <View style={styles.avatarBadge}>
                    {avatarUploading
                      ? <ActivityIndicator color="#fff" size="small" />
                      : <Text style={styles.avatarBadgeIcon}>📷</Text>}
                  </View>
                </TouchableOpacity>
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
              {/* 編集ボタン */}
              <View style={styles.editBtnRow}>
                <TouchableOpacity style={styles.editBtn} onPress={startEdit}>
                  <Text style={styles.editBtnText}>✏️ 編集</Text>
                </TouchableOpacity>
              </View>

              {/* アバター + 名前 */}
              <View style={styles.avatarSection}>
                <TouchableOpacity
                  style={styles.avatarWrap}
                  activeOpacity={1}
                  disabled
                >
                  {profile.avatar_url ? (
                    <Image source={{ uri: profile.avatar_url }} style={styles.avatarImg} />
                  ) : (
                    <View style={[styles.avatarFallback, { backgroundColor: avatarBg }]}>
                      <Text style={styles.avatarInitial}>{avatarInitial}</Text>
                    </View>
                  )}
                </TouchableOpacity>
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
      {activeTab === 'ai' && chatMode === 'list' && (
        <View style={styles.chatContainer}>
          <View style={styles.chatListHeader}>
            <Text style={styles.chatListTitle}>AIアシスタント</Text>
            <TouchableOpacity style={styles.newChatBtn} onPress={startNewChat}>
              <Text style={styles.newChatBtnText}>＋ 新規会話</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.chatListContent}>
            {loadingSessions ? (
              <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
            ) : sessions.length === 0 ? (
              <View style={styles.chatEmptyState}>
                <Text style={styles.chatEmptyEmoji}>💬</Text>
                <Text style={styles.chatEmptyText}>
                  まだ会話がありません{'\n'}「新規会話」から始めましょう
                </Text>
              </View>
            ) : (
              sessions.map(session => (
                <TouchableOpacity
                  key={session.id}
                  style={styles.sessionCard}
                  onPress={() => editingSessionId !== session.id && openSession(session)}
                  activeOpacity={editingSessionId === session.id ? 1 : 0.75}
                >
                  <View style={styles.sessionCardContent}>
                    {editingSessionId === session.id ? (
                      <TextInput
                        style={styles.sessionTitleInput}
                        value={editingTitle}
                        onChangeText={setEditingTitle}
                        onBlur={commitRename}
                        onSubmitEditing={commitRename}
                        returnKeyType="done"
                        autoFocus
                        maxLength={40}
                        selectTextOnFocus
                      />
                    ) : (
                      <Text style={styles.sessionTitle} numberOfLines={1}>{session.title}</Text>
                    )}
                    <Text style={styles.sessionDate}>{formatSessionDate(session.created_at)}</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => startRenaming(session)}
                    hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
                  >
                    <Text style={styles.sessionEditBtn}>✏️</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => deleteSession(session.id)}
                    hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
                  >
                    <Text style={styles.sessionDeleteBtn}>✕</Text>
                  </TouchableOpacity>
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        </View>
      )}

      {activeTab === 'ai' && chatMode === 'chat' && (
        <KeyboardAvoidingView
          style={styles.chatContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={120}
        >
          <View style={styles.chatHeader}>
            <TouchableOpacity
              onPress={() => { setEditingSessionId(null); setChatMode('list'); }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.chatBackBtn}>←</Text>
            </TouchableOpacity>
            {editingSessionId === currentSession?.id ? (
              <TextInput
                style={styles.chatTitleInput}
                value={editingTitle}
                onChangeText={setEditingTitle}
                onBlur={commitRename}
                onSubmitEditing={commitRename}
                returnKeyType="done"
                autoFocus
                maxLength={40}
                selectTextOnFocus
              />
            ) : (
              <TouchableOpacity
                style={{ flex: 1 }}
                onPress={() => currentSession && startRenaming(currentSession)}
                activeOpacity={0.7}
              >
                <Text style={styles.chatTitleText} numberOfLines={1}>
                  {currentSession?.title ?? '会話'}
                </Text>
              </TouchableOpacity>
            )}
            <Text style={styles.chatHeaderEditHint}>✏️</Text>
          </View>

          <ScrollView
            ref={chatScrollRef}
            style={styles.messageList}
            contentContainerStyle={styles.messageListContent}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => chatScrollRef.current?.scrollToEnd({ animated: false })}
          >
            {chatMessages.length === 0 && !loadingChatMessages && (
              <View style={styles.chatWelcome}>
                <Text style={styles.chatWelcomeEmoji}>🤖</Text>
                <Text style={styles.chatWelcomeText}>
                  こんにちは！{'\n'}社会活動・プロジェクト・自己成長について{'\n'}何でも聞いてください。
                </Text>
              </View>
            )}
            {loadingChatMessages && <ActivityIndicator color={colors.primary} style={{ marginTop: 20 }} />}
            {chatMessages.map(msg => (
              <View
                key={msg.id}
                style={[
                  styles.messageBubbleWrap,
                  msg.role === 'user' ? styles.userBubbleWrap : styles.aiBubbleWrap,
                ]}
              >
                {msg.role === 'model' && (
                  <View style={styles.aiAvatar}>
                    <Text style={styles.aiAvatarText}>🤖</Text>
                  </View>
                )}
                <View style={[styles.bubble, msg.role === 'user' ? styles.userBubble : styles.aiBubble]}>
                  <Text style={styles.bubbleText}>{msg.content}</Text>
                </View>
              </View>
            ))}
            {isAiThinking && (
              <View style={[styles.messageBubbleWrap, styles.aiBubbleWrap]}>
                <View style={styles.aiAvatar}>
                  <Text style={styles.aiAvatarText}>🤖</Text>
                </View>
                <View style={[styles.bubble, styles.aiBubble]}>
                  <ActivityIndicator size="small" color="#fff" />
                </View>
              </View>
            )}
          </ScrollView>

          <View style={styles.inputRow}>
            <TextInput
              style={styles.inputField}
              placeholder="メッセージを入力..."
              placeholderTextColor="rgba(255,255,255,0.22)"
              value={chatInput}
              onChangeText={setChatInput}
              onSubmitEditing={sendChatMessage}
              returnKeyType="send"
              editable={!isAiThinking}
              multiline
            />
            <TouchableOpacity
              style={[styles.sendBtn, (!chatInput.trim() || isAiThinking) && styles.sendBtnDisabled]}
              onPress={sendChatMessage}
              disabled={!chatInput.trim() || isAiThinking}
            >
              <Text style={styles.sendBtnText}>✈</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}

      {/* ══ 活動記録タブ ══ */}
      {activeTab === 'activity' && (
        <View style={styles.placeholder}>
          <Text style={styles.placeholderEmoji}>📊</Text>
          <Text style={styles.placeholderText}>
            活動記録は近日公開予定です。{'\n'}あなたの活動履歴をまとめて{'\n'}振り返れるようになります。
          </Text>
        </View>
      )}

      {/* ══ ノートタブ ══ */}
      {activeTab === 'record' && (
        <ScrollView
          style={styles.profileScroll}
          contentContainerStyle={styles.noteScrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* 新規入力テンプレート */}
          <View style={styles.noteTemplate}>
            <Text style={styles.noteTemplateTitle}>新しいノート</Text>
            <View style={styles.noteDateRow}>
              <Text style={styles.noteDateIcon}>📅</Text>
              <TextInput
                style={styles.noteDateInput}
                value={noteDate}
                onChangeText={setNoteDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.overlay30}
                maxLength={10}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
              />
            </View>
            <TextInput
              style={styles.noteMemoInput}
              value={noteContent}
              onChangeText={setNoteContent}
              placeholder="ふと気づいたこと、考えたことを…"
              placeholderTextColor={colors.overlay30}
              multiline
              numberOfLines={5}
              textAlignVertical="top"
              maxLength={1000}
            />
            <View style={styles.noteSaveRow}>
              <Text style={styles.noteCharCount}>{noteContent.length} / 1000</Text>
              <TouchableOpacity
                style={[styles.noteSaveBtn, (!noteContent.trim() || savingNote) && styles.noteSaveBtnDisabled]}
                onPress={handleSaveNote}
                disabled={!noteContent.trim() || savingNote}
              >
                {savingNote ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.noteSaveBtnText}>保存する</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* 過去のノート */}
          {loadingNotes ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: 16 }} />
          ) : notes.length > 0 ? (
            <>
              <Text style={styles.notePastTitle}>過去のノート</Text>
              {notes.map(note => (
                <View key={note.id} style={styles.noteCard}>
                  <View style={styles.noteCardHeader}>
                    <Text style={styles.noteCardDate}>{formatNoteDate(note.date)}</Text>
                    <TouchableOpacity
                      onPress={() => handleDeleteNote(note.id)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Text style={styles.noteCardDeleteBtn}>削除</Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.noteCardContent}>{note.content}</Text>
                </View>
              ))}
            </>
          ) : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function makeStyles(c: AppColors) {
  return StyleSheet.create({
    container: { flex: 1 },
    settingsBtn: { paddingHorizontal: 6, paddingVertical: 4 },
    settingsBtnText: { fontSize: 18 },

    tabs: {
      flexDirection: 'row',
      paddingHorizontal: 16,
      borderBottomWidth: 1,
      borderBottomColor: c.cardBorder,
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
    avatarSection: { alignItems: 'center', paddingTop: 8, paddingBottom: 4 },
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

    editBtnRow: { flexDirection: 'row', justifyContent: 'flex-end', paddingTop: 16 },
    editBtn: {
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

    // ─── AI チャット共通 ───
    chatContainer: { flex: 1 },

    // セッション一覧
    chatListHeader: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10,
      borderBottomWidth: 1, borderBottomColor: c.cardBorder,
    },
    chatListTitle: { color: c.text, fontWeight: '800', fontSize: 16 },
    newChatBtn: {
      backgroundColor: c.primary, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    },
    newChatBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
    chatListContent: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 40 },
    chatEmptyState: { alignItems: 'center', paddingTop: 60 },
    chatEmptyEmoji: { fontSize: 48, marginBottom: 16 },
    chatEmptyText: { color: c.muted, textAlign: 'center', fontSize: 14, lineHeight: 22 },
    sessionCard: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: c.card, borderWidth: 1, borderColor: c.cardBorder,
      borderRadius: 12, paddingHorizontal: 14, paddingVertical: 14, marginBottom: 8, gap: 10,
    },
    sessionCardContent: { flex: 1 },
    sessionTitle: { color: c.text, fontWeight: '600', fontSize: 14, marginBottom: 3 },
    sessionTitleInput: {
      color: c.text, fontWeight: '600', fontSize: 14,
      borderBottomWidth: 1, borderBottomColor: c.primary,
      paddingVertical: 0, marginBottom: 3,
    },
    sessionDate: { color: c.overlay30, fontSize: 11 },
    sessionEditBtn: { fontSize: 14, paddingHorizontal: 4 },
    sessionDeleteBtn: { color: c.overlay30, fontSize: 16, paddingHorizontal: 4 },

    // チャット画面
    chatHeader: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      paddingHorizontal: 16, paddingTop: 12, paddingBottom: 10,
      borderBottomWidth: 1, borderBottomColor: c.cardBorder,
    },
    chatBackBtn: { color: c.primary2, fontSize: 22, lineHeight: 26 },
    chatTitleText: { color: c.text, fontWeight: '700', fontSize: 14 },
    chatTitleInput: {
      flex: 1, color: c.text, fontWeight: '700', fontSize: 14,
      borderBottomWidth: 1, borderBottomColor: c.primary, paddingVertical: 0,
    },
    chatHeaderEditHint: { fontSize: 13, opacity: 0.4 },
    chatWelcome: { alignItems: 'center', paddingTop: 40, paddingHorizontal: 32 },
    chatWelcomeEmoji: { fontSize: 40, marginBottom: 14 },
    chatWelcomeText: { color: c.muted, textAlign: 'center', fontSize: 14, lineHeight: 22 },
    messageList: { flex: 1 },
    messageListContent: { paddingHorizontal: 16, paddingVertical: 12, gap: 10 },
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
    inputRow: {
      flexDirection: 'row', alignItems: 'flex-end',
      backgroundColor: c.inputBg, borderRadius: 14,
      paddingHorizontal: 14, paddingVertical: 10, marginHorizontal: 16, marginBottom: 12, gap: 10,
    },
    inputField: { flex: 1, color: c.text, fontSize: 13, maxHeight: 100 },
    sendBtn: {
      width: 32, height: 32, backgroundColor: c.primary,
      borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    },
    sendBtnDisabled: { opacity: 0.4 },
    sendBtnText: { color: '#fff', fontSize: 16 },

    placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
    placeholderEmoji: { fontSize: 48, marginBottom: 16 },
    placeholderText: { color: c.muted, textAlign: 'center', fontSize: 14, lineHeight: 22 },

    // ─── ノートタブ ───
    noteScrollContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 48 },
    noteTemplate: {
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.cardBorder,
      borderRadius: 16,
      padding: 16,
      marginBottom: 24,
    },
    noteTemplateTitle: {
      color: c.text,
      fontWeight: '700',
      fontSize: 14,
      marginBottom: 14,
    },
    noteDateRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.inputBg,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      marginBottom: 12,
      gap: 8,
    },
    noteDateIcon: { fontSize: 16 },
    noteDateInput: {
      flex: 1,
      color: c.text,
      fontSize: 14,
      fontWeight: '600',
    },
    noteMemoInput: {
      backgroundColor: c.inputBg,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      color: c.text,
      fontSize: 14,
      lineHeight: 22,
      minHeight: 110,
      marginBottom: 10,
    },
    noteSaveRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    noteCharCount: { color: c.faint, fontSize: 11 },
    noteSaveBtn: {
      backgroundColor: c.primary,
      paddingHorizontal: 20,
      paddingVertical: 9,
      borderRadius: 20,
      minWidth: 90,
      alignItems: 'center',
    },
    noteSaveBtnDisabled: { opacity: 0.4 },
    noteSaveBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
    notePastTitle: {
      color: c.overlay45,
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 0.8,
      textTransform: 'uppercase',
      marginBottom: 10,
    },
    noteCard: {
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.cardBorder,
      borderRadius: 12,
      padding: 14,
      marginBottom: 10,
    },
    noteCardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    noteCardDate: { color: c.text, fontWeight: '700', fontSize: 13 },
    noteCardDeleteBtn: { color: c.overlay30, fontSize: 12 },
    noteCardContent: { color: c.textBody, fontSize: 14, lineHeight: 22 },
  });
}
