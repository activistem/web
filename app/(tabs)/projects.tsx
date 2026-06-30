import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCallback, useEffect, useState } from 'react';
import AppHeader from '../../components/AppHeader';
import { Colors } from '../../constants/Colors';
import { supabase } from '../../lib/supabase';

const CATEGORY_FILTERS = ['すべて', '環境', '教育', '防災', '地域活性'];
const CATEGORY_COLORS: Record<string, string> = {
  環境: Colors.green,
  教育: '#FFB74D',
  防災: '#F44336',
  地域活性: '#9C27B0',
  テクノロジー: Colors.primary,
};

type Project = {
  id: string;
  owner_id: string;
  title: string;
  description: string;
  category: string;
  category_color: string;
  progress: number;
  deadline: string;
  members_count: number;
};

export default function ProjectsScreen() {
  const [filter, setFilter] = useState('すべて');
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'projects' | 'dm' | 'community'>('projects');
  const [myId, setMyId] = useState<string | null>(null);
  const [joined, setJoined] = useState<Set<string>>(new Set());

  // 作成フォームの表示状態
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newCategory, setNewCategory] = useState('環境');
  const [newDeadline, setNewDeadline] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  const fetchProjects = useCallback(async () => {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) console.error('fetchProjects:', error.message);
    if (data) setProjects(data as Project[]);
  }, []);

  const fetchJoined = useCallback(async (uid: string) => {
    const { data } = await supabase
      .from('project_members')
      .select('project_id')
      .eq('user_id', uid);
    if (data) setJoined(new Set(data.map((m) => m.project_id)));
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setMyId(user.id);
        await fetchJoined(user.id);
      }
      await fetchProjects();
      setLoading(false);
    })();
  }, [fetchProjects, fetchJoined]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchProjects();
    if (myId) await fetchJoined(myId);
    setRefreshing(false);
  };

  const handleJoin = async (projectId: string) => {
    if (!myId || joined.has(projectId)) return;
    try {
      const { error } = await supabase
        .from('project_members')
        .insert({ project_id: projectId, user_id: myId });
      if (!error) {
        setJoined((prev) => new Set([...prev, projectId]));
        setProjects((prev) =>
          prev.map((p) =>
            p.id === projectId ? { ...p, members_count: p.members_count + 1 } : p
          )
        );
      } else {
        console.error('handleJoin:', error.message);
      }
    } catch (e: any) {
      console.error('handleJoin exception:', e);
    }
  };

  const handleCreate = async () => {
    setCreateError('');
    if (!newTitle.trim()) {
      setCreateError('タイトルを入力してください');
      return;
    }
    if (!myId) {
      setCreateError('ログインが必要です');
      return;
    }
    setCreating(true);
    try {
      const { data: proj, error } = await supabase
        .from('projects')
        .insert({
          owner_id: myId,
          title: newTitle.trim(),
          description: newDesc.trim(),
          category: newCategory,
          category_color: CATEGORY_COLORS[newCategory] ?? Colors.primary,
          progress: 0,
          deadline: newDeadline.trim() || '未定',
          members_count: 1,
        })
        .select()
        .single();

      if (error) {
        console.error('handleCreate:', error.message);
        setCreateError(error.message);
        return;
      }

      // 作成者をメンバーとして登録
      await supabase
        .from('project_members')
        .insert({ project_id: proj.id, user_id: myId });

      // フォームをリセットして閉じる
      setShowCreate(false);
      setNewTitle('');
      setNewDesc('');
      setNewDeadline('');
      setNewCategory('環境');
      setCreateError('');
      await fetchProjects();
    } catch (e: any) {
      console.error('handleCreate exception:', e);
      setCreateError(e?.message ?? '作成に失敗しました');
    } finally {
      setCreating(false);
    }
  };

  const filtered = projects.filter(
    (p) => filter === 'すべて' || p.category === filter
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <AppHeader title="Activistem!" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={Colors.primary}
          />
        }
      >
        <View style={styles.titleRow}>
          <View>
            <Text style={styles.title}>プロジェクト</Text>
            <Text style={styles.subtitle}>社会課題に取り組むプロジェクトに参加・作成しよう</Text>
          </View>
          <TouchableOpacity
            style={[styles.createBtn, showCreate && styles.createBtnActive]}
            onPress={() => {
              setShowCreate((v) => !v);
              setCreateError('');
            }}
          >
            <Text style={styles.createBtnText}>{showCreate ? '✕ 閉じる' : '＋ 作成'}</Text>
          </TouchableOpacity>
        </View>

        {/* ── 作成フォーム（インライン） ── */}
        {showCreate && (
          <View style={styles.createForm}>
            <Text style={styles.createFormTitle}>新しいプロジェクト</Text>

            {createError ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>⚠️ {createError}</Text>
              </View>
            ) : null}

            <Text style={styles.label}>タイトル *</Text>
            <TextInput
              style={styles.input}
              placeholder="プロジェクト名"
              placeholderTextColor="rgba(255,255,255,0.25)"
              value={newTitle}
              onChangeText={setNewTitle}
            />

            <Text style={styles.label}>説明</Text>
            <TextInput
              style={[styles.input, styles.inputMulti]}
              placeholder="活動内容を説明してください"
              placeholderTextColor="rgba(255,255,255,0.25)"
              value={newDesc}
              onChangeText={setNewDesc}
              multiline
              numberOfLines={3}
            />

            <Text style={styles.label}>カテゴリ</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.catScroll}
              contentContainerStyle={styles.catContent}
            >
              {Object.keys(CATEGORY_COLORS).map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[
                    styles.catChip,
                    newCategory === cat && {
                      backgroundColor: CATEGORY_COLORS[cat] + '33',
                      borderColor: CATEGORY_COLORS[cat],
                    },
                  ]}
                  onPress={() => setNewCategory(cat)}
                >
                  <Text
                    style={[
                      styles.catChipText,
                      newCategory === cat && { color: CATEGORY_COLORS[cat] },
                    ]}
                  >
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.label}>期限</Text>
            <TextInput
              style={styles.input}
              placeholder="例: 2025年3月"
              placeholderTextColor="rgba(255,255,255,0.25)"
              value={newDeadline}
              onChangeText={setNewDeadline}
            />

            <View style={styles.formBtns}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => {
                  setShowCreate(false);
                  setCreateError('');
                }}
              >
                <Text style={styles.cancelBtnText}>キャンセル</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmBtn, creating && { opacity: 0.6 }]}
                onPress={handleCreate}
                disabled={creating}
              >
                {creating ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.confirmBtnText}>作成する</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ── タブ ── */}
        <View style={styles.tabs}>
          {(['projects', 'dm', 'community'] as const).map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, activeTab === tab && styles.tabActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                {tab === 'projects' ? 'プロジェクト' : tab === 'dm' ? 'DM' : 'コミュニティ'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {activeTab === 'projects' && (
          <>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.filtersScroll}
              contentContainerStyle={styles.filtersContent}
            >
              {CATEGORY_FILTERS.map((f) => (
                <TouchableOpacity
                  key={f}
                  style={[styles.filter, filter === f && styles.filterActive]}
                  onPress={() => setFilter(f)}
                >
                  <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
                    {f}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.list}>
              {loading ? (
                <ActivityIndicator color={Colors.primary} style={{ marginTop: 20 }} />
              ) : filtered.length === 0 ? (
                <Text style={styles.empty}>
                  {projects.length === 0
                    ? '最初のプロジェクトを作成しましょう！'
                    : 'このカテゴリのプロジェクトはまだありません'}
                </Text>
              ) : (
                filtered.map((project) => {
                  const color =
                    project.category_color ??
                    CATEGORY_COLORS[project.category] ??
                    Colors.primary;
                  return (
                    <View key={project.id} style={styles.projectCard}>
                      <View style={styles.projectTop}>
                        <View style={[styles.categoryBadge, { backgroundColor: color + '33' }]}>
                          <Text style={[styles.categoryText, { color }]}>
                            {project.category}
                          </Text>
                        </View>
                        {joined.has(project.id) ? (
                          <Text style={styles.joinedText}>参加中</Text>
                        ) : (
                          <TouchableOpacity
                            style={styles.joinBtn}
                            onPress={() => handleJoin(project.id)}
                          >
                            <Text style={styles.joinBtnText}>参加する</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                      <Text style={styles.projectTitle}>{project.title}</Text>
                      {project.description ? (
                        <Text style={styles.projectDesc}>{project.description}</Text>
                      ) : null}
                      <View style={styles.progressRow}>
                        <Text style={styles.progressLabel}>progress</Text>
                        <Text style={styles.progressValue}>{project.progress}%</Text>
                      </View>
                      <View style={styles.progressBar}>
                        <View
                          style={[
                            styles.progressFill,
                            { width: `${project.progress}%`, backgroundColor: color },
                          ]}
                        />
                      </View>
                      <Text style={styles.projectMeta}>
                        👥 {project.members_count}　📅 {project.deadline}
                      </Text>
                    </View>
                  );
                })
              )}
            </View>
          </>
        )}

        {activeTab !== 'projects' && (
          <View style={styles.placeholder}>
            <Text style={styles.placeholderEmoji}>{activeTab === 'dm' ? '💬' : '🌐'}</Text>
            <Text style={styles.placeholderText}>
              {activeTab === 'dm' ? 'ダイレクトメッセージ' : 'コミュニティ'}機能は近日公開予定です
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  title: { color: '#fff', fontSize: 22, fontWeight: '900', marginBottom: 4 },
  subtitle: { color: Colors.muted, fontSize: 12, maxWidth: 220 },
  createBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  createBtnActive: { backgroundColor: 'rgba(255,255,255,0.15)' },
  createBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },

  // 作成フォーム
  createForm: {
    backgroundColor: 'rgba(124,91,245,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(124,91,245,0.3)',
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 16,
    marginBottom: 16,
  },
  createFormTitle: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 16,
    marginBottom: 16,
  },
  errorBox: {
    backgroundColor: 'rgba(244,67,54,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(244,67,54,0.4)',
    borderRadius: 10,
    padding: 10,
    marginBottom: 14,
  },
  errorText: { color: '#ff6b6b', fontSize: 13 },
  label: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#fff',
    fontSize: 14,
    marginBottom: 12,
  },
  inputMulti: { minHeight: 72, textAlignVertical: 'top' },
  catScroll: { marginBottom: 12 },
  catContent: { gap: 8 },
  catChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  catChipText: { color: 'rgba(255,255,255,0.5)', fontSize: 13 },
  formBtns: { flexDirection: 'row', gap: 10, marginTop: 4 },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
  },
  cancelBtnText: { color: 'rgba(255,255,255,0.6)', fontWeight: '700' },
  confirmBtn: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    alignItems: 'center',
  },
  confirmBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },

  // タブ
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
    marginHorizontal: 16,
    marginBottom: 12,
  },
  tab: { paddingHorizontal: 12, paddingBottom: 10, marginRight: 4 },
  tabActive: { borderBottomWidth: 2, borderBottomColor: Colors.primary },
  tabText: { color: 'rgba(255,255,255,0.35)', fontSize: 13, fontWeight: '600' },
  tabTextActive: { color: '#fff' },
  filtersScroll: { marginBottom: 12 },
  filtersContent: { paddingHorizontal: 16, gap: 8 },
  filter: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  filterActive: { backgroundColor: Colors.primary },
  filterText: { color: 'rgba(255,255,255,0.45)', fontSize: 12, fontWeight: '600' },
  filterTextActive: { color: '#fff' },
  list: { paddingHorizontal: 16, paddingBottom: 20 },
  projectCard: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  projectTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  categoryBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  categoryText: { fontSize: 12, fontWeight: '700' },
  joinBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
  },
  joinBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  joinedText: { color: 'rgba(255,255,255,0.35)', fontSize: 12 },
  projectTitle: { color: '#fff', fontWeight: '900', fontSize: 15, marginBottom: 6 },
  projectDesc: {
    color: 'rgba(255,255,255,0.42)',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 10,
  },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  progressLabel: { color: 'rgba(255,255,255,0.32)', fontSize: 11 },
  progressValue: { color: '#fff', fontWeight: '700', fontSize: 11 },
  progressBar: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 4,
    marginBottom: 8,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 4 },
  projectMeta: { color: 'rgba(255,255,255,0.28)', fontSize: 11 },
  placeholder: { alignItems: 'center', paddingVertical: 80, paddingHorizontal: 32 },
  placeholderEmoji: { fontSize: 48, marginBottom: 16 },
  placeholderText: {
    color: Colors.muted,
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 22,
  },
  empty: {
    color: Colors.muted,
    textAlign: 'center',
    paddingVertical: 40,
    fontSize: 14,
  },
});
