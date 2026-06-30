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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import AppHeader from '../../components/AppHeader';
import { Colors } from '../../constants/Colors';
import { supabase } from '../../lib/supabase';

type Message = { role: 'ai' | 'user'; text: string };

type Profile = {
  full_name: string;
  username: string;
  role: string;
  avatar_color: string;
  followers_count: number;
  projects_count: number;
};

const QUICK_QUESTIONS = ['私の強みは？', '次のプロジェクトは？', '活動を振り返る'];

const AI_RESPONSES: Record<string, string> = {
  '私の強みは？': 'あなたのプロフィールと活動記録を分析しました。\n\n✨ 強み：\n・継続的な活動発信力\n・コミュニティ構築への情熱\n・課題解決へのコミット\n\nこの調子でプロフィールを充実させると、より多くの仲間が集まります！',
  '次のプロジェクトは？': 'あなたの活動履歴をもとにおすすめを分析しました。\n\n📁 おすすめ：\n・あなたの関心タグに近いプロジェクトを「プロジェクト」タブで探してみましょう\n・まだプロジェクトがない分野に挑戦するのもおすすめです！',
  '活動を振り返る': '直近30日間の活動サマリーです。\n\n📊 活動サマリー：\n・アカウントを活用するほど、より詳細な分析が可能になります\n・継続的な投稿・つながりの構築が大切です\n\nこれからの活躍を応援しています 🎉',
};

export default function MyDataScreen() {
  const [activeTab, setActiveTab] = useState<'profile' | 'ai' | 'record'>('ai');
  const [messages, setMessages] = useState<Message[]>([
    { role: 'ai', text: 'こんにちは！プロフィール・プロジェクト記録・内省メモをもとに、あなたの活動を分析・サポートします。何でも聞いてください。' },
  ]);
  const [input, setInput] = useState('');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('profiles')
        .select('full_name, username, role, avatar_color, followers_count, projects_count')
        .eq('id', user.id)
        .single();
      if (data) setProfile(data as Profile);
      setLoadingProfile(false);
    })();
  }, []);

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

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <AppHeader
        title="Activistem!"
        right={
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
            <Text style={styles.logoutBtnText}>ログアウト</Text>
          </TouchableOpacity>
        }
      />
      <View style={styles.titleRow}>
        <View>
          <Text style={styles.title}>マイデータ</Text>
          <Text style={styles.subtitle}>活動・記録・内省を一元管理</Text>
        </View>
        <TouchableOpacity style={styles.exportBtn}>
          <Text style={styles.exportBtnText}>⬇ エクスポート</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.tabs}>
        {(['profile', 'ai', 'record'] as const).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab === 'profile' ? 'プロフィール' : tab === 'ai' ? 'AIチャット' : '記録'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {activeTab === 'profile' && (
        <ScrollView style={styles.profileScroll} showsVerticalScrollIndicator={false}>
          {loadingProfile ? (
            <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} />
          ) : profile ? (
            <View style={styles.profileCard}>
              <View style={[styles.profileAvatar, { backgroundColor: profile.avatar_color ?? Colors.primary }]}>
                <Text style={styles.profileAvatarText}>
                  {(profile.full_name ?? profile.username ?? '?')[0]}
                </Text>
              </View>
              <Text style={styles.profileName}>{profile.full_name}</Text>
              <Text style={styles.profileRole}>{profile.role}</Text>
              <Text style={styles.profileUsername}>@{profile.username}</Text>
              <View style={styles.profileStats}>
                <View style={styles.profileStat}>
                  <Text style={styles.profileStatVal}>{profile.followers_count}</Text>
                  <Text style={styles.profileStatLabel}>フォロワー</Text>
                </View>
                <View style={styles.profileStat}>
                  <Text style={styles.profileStatVal}>{profile.projects_count}</Text>
                  <Text style={styles.profileStatLabel}>プロジェクト</Text>
                </View>
              </View>
            </View>
          ) : (
            <Text style={styles.empty}>プロフィールを読み込み中...</Text>
          )}
        </ScrollView>
      )}

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

          <ScrollView style={styles.messageList} contentContainerStyle={styles.messageListContent} showsVerticalScrollIndicator={false}>
            {messages.map((msg, i) => (
              <View key={i} style={[styles.messageBubbleWrap, msg.role === 'user' ? styles.userBubbleWrap : styles.aiBubbleWrap]}>
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

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.quickQScroll} contentContainerStyle={styles.quickQContent}>
            {QUICK_QUESTIONS.map((q) => (
              <TouchableOpacity key={q} style={styles.quickQ} onPress={() => sendMessage(q)}>
                <Text style={styles.quickQText}>{q}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
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

      {activeTab === 'record' && (
        <View style={styles.placeholder}>
          <Text style={styles.placeholderEmoji}>📋</Text>
          <Text style={styles.placeholderText}>
            プロジェクト記録機能は近日公開予定です。{'\n'}参加した活動の詳細な記録を残せるようになります。
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12 },
  title: { color: '#fff', fontSize: 22, fontWeight: '900', marginBottom: 4 },
  subtitle: { color: Colors.muted, fontSize: 13 },
  exportBtn: { backgroundColor: 'rgba(255,255,255,0.08)', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10 },
  exportBtnText: { color: 'rgba(255,255,255,0.5)', fontSize: 12 },
  logoutBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  logoutBtnText: { color: 'rgba(255,255,255,0.5)', fontSize: 12 },
  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)', marginHorizontal: 16, marginBottom: 16 },
  tab: { paddingHorizontal: 10, paddingBottom: 10, marginRight: 4 },
  tabActive: { borderBottomWidth: 2, borderBottomColor: Colors.primary },
  tabText: { color: 'rgba(255,255,255,0.35)', fontSize: 13, fontWeight: '600' },
  tabTextActive: { color: '#fff' },
  chatContainer: { flex: 1, paddingHorizontal: 16 },
  aiHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 14, padding: 12, marginBottom: 12 },
  aiIconWrap: { width: 36, height: 36, backgroundColor: Colors.primary, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  aiIcon: { fontSize: 16 },
  aiTitle: { color: '#fff', fontWeight: '700', fontSize: 13 },
  aiSubtitle: { color: 'rgba(255,255,255,0.32)', fontSize: 11 },
  onlineIndicator: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  onlineDot: { width: 6, height: 6, backgroundColor: Colors.green2, borderRadius: 3 },
  onlineText: { color: Colors.green2, fontSize: 11 },
  messageList: { flex: 1 },
  messageListContent: { paddingBottom: 8, gap: 10 },
  messageBubbleWrap: { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  aiBubbleWrap: { justifyContent: 'flex-start' },
  userBubbleWrap: { justifyContent: 'flex-end' },
  aiAvatar: { width: 28, height: 28, backgroundColor: Colors.primary, borderRadius: 8, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  aiAvatarText: { fontSize: 14 },
  bubble: { maxWidth: '80%', padding: 10, borderRadius: 14 },
  aiBubble: { backgroundColor: 'rgba(124,91,245,0.2)', borderTopLeftRadius: 4 },
  userBubble: { backgroundColor: Colors.primary, borderTopRightRadius: 4 },
  bubbleText: { color: 'rgba(255,255,255,0.85)', fontSize: 13, lineHeight: 20 },
  quickQScroll: { marginVertical: 10, flexGrow: 0 },
  quickQContent: { gap: 8 },
  quickQ: { backgroundColor: 'rgba(255,255,255,0.07)', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10 },
  quickQText: { color: 'rgba(255,255,255,0.5)', fontSize: 12 },
  inputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 12, gap: 10 },
  input: { flex: 1, color: '#fff', fontSize: 13 },
  sendBtn: { width: 32, height: 32, backgroundColor: Colors.primary, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled: { opacity: 0.4 },
  sendBtnText: { color: '#fff', fontSize: 16 },
  profileScroll: { flex: 1, paddingHorizontal: 16 },
  profileCard: { alignItems: 'center', paddingTop: 32, paddingBottom: 24 },
  profileAvatar: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  profileAvatarText: { color: '#fff', fontWeight: '900', fontSize: 36 },
  profileName: { color: '#fff', fontWeight: '900', fontSize: 22, marginBottom: 4 },
  profileRole: { color: Colors.muted, fontSize: 14, marginBottom: 4 },
  profileUsername: { color: Colors.primary2, fontSize: 13, marginBottom: 24 },
  profileStats: { flexDirection: 'row', gap: 40 },
  profileStat: { alignItems: 'center' },
  profileStatVal: { color: '#fff', fontWeight: '900', fontSize: 22 },
  profileStatLabel: { color: Colors.muted, fontSize: 12, marginTop: 2 },
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  placeholderEmoji: { fontSize: 48, marginBottom: 16 },
  placeholderText: { color: Colors.muted, textAlign: 'center', fontSize: 14, lineHeight: 22 },
  empty: { color: Colors.muted, textAlign: 'center', paddingVertical: 40 },
});
