import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCallback, useEffect, useMemo, useState } from 'react';
import AppHeader from '../../components/AppHeader';
import { useColors } from '../../lib/ThemeContext';
import { AppColors } from '../../constants/Colors';
import { supabase } from '../../lib/supabase';

const CATEGORIES = [
  { label: 'すべて', color: '#7C5BF5' },
  { label: '環境',       color: '#22c55e' },
  { label: '教育',       color: '#3b82f6' },
  { label: '防災',       color: '#ef4444' },
  { label: '地域活性',   color: '#f97316' },
  { label: 'テクノロジー', color: '#8b5cf6' },
  { label: '子ども',     color: '#ec4899' },
  { label: '福祉',       color: '#06b6d4' },
  { label: 'その他',     color: '#6b7280' },
];

type OwnerInfo = { full_name: string; avatar_color: string; avatar_url: string | null };

type Project = {
  id: string;
  owner_id: string;
  title: string;
  description: string | null;
  category: string | null;
  category_color: string;
  progress: number;
  deadline: string | null;
  members_count: number;
  created_at: string;
  owner: OwnerInfo | null;
};

function catColor(category: string | null): string {
  return CATEGORIES.find(c => c.label === category)?.color ?? '#7C5BF5';
}

export default function ProjectsScreen() {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [view, setView] = useState<'list' | 'create' | 'detail'>('list');
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [myId, setMyId] = useState<string | null>(null);
  const [joined, setJoined] = useState<Set<string>>(new Set());
  const [selectedCategory, setSelectedCategory] = useState('すべて');
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  // 作成フォーム
  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formCategory, setFormCategory] = useState('');
  const [formDeadline, setFormDeadline] = useState('');
  const [formProgress, setFormProgress] = useState('0');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setMyId(data.user?.id ?? null));
  }, []);

  const fetchProjects = useCallback(async () => {
    const { data } = await supabase
      .from('projects')
      .select('*, owner:profiles!owner_id(full_name, avatar_color, avatar_url)')
      .order('created_at', { ascending: false });
    if (data) setProjects(data as unknown as Project[]);
  }, []);

  const fetchJoined = useCallback(async () => {
    if (!myId) return;
    const { data } = await supabase
      .from('project_members')
      .select('project_id')
      .eq('user_id', myId);
    if (data) setJoined(new Set(data.map((r: any) => r.project_id)));
  }, [myId]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await fetchProjects();
      await fetchJoined();
      setLoading(false);
    })();
  }, [fetchProjects, fetchJoined]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchProjects();
    await fetchJoined();
    setRefreshing(false);
  };

  const handleJoin = async (project: Project) => {
    if (!myId) return;
    const wasJoined = joined.has(project.id);
    if (wasJoined) {
      await supabase.from('project_members').delete().eq('project_id', project.id).eq('user_id', myId);
      setJoined(prev => { const next = new Set(prev); next.delete(project.id); return next; });
      const delta = -1;
      setProjects(prev => prev.map(p => p.id === project.id ? { ...p, members_count: Math.max(0, p.members_count + delta) } : p));
      setSelectedProject(prev => prev?.id === project.id ? { ...prev, members_count: Math.max(0, prev.members_count + delta) } : prev);
    } else {
      await supabase.from('project_members').insert({ project_id: project.id, user_id: myId });
      setJoined(prev => new Set([...prev, project.id]));
      const delta = 1;
      setProjects(prev => prev.map(p => p.id === project.id ? { ...p, members_count: p.members_count + delta } : p));
      setSelectedProject(prev => prev?.id === project.id ? { ...prev, members_count: prev.members_count + delta } : prev);
    }
  };

  const handleDelete = (project: Project) => {
    if (project.owner_id !== myId) return;
    const doDelete = async () => {
      await supabase.from('projects').delete().eq('id', project.id);
      setProjects(prev => prev.filter(p => p.id !== project.id));
      setView('list');
    };
    if (Platform.OS === 'web') {
      if (window.confirm('このプロジェクトを削除しますか？')) doDelete();
    } else {
      Alert.alert('削除', 'このプロジェクトを削除しますか？', [
        { text: 'キャンセル', style: 'cancel' },
        { text: '削除', style: 'destructive', onPress: doDelete },
      ]);
    }
  };

  const handleCreate = async () => {
    if (!formTitle.trim() || !myId) return;
    setCreating(true);
    const color = catColor(formCategory || null);
    const { data, error } = await supabase
      .from('projects')
      .insert({
        owner_id: myId,
        title: formTitle.trim(),
        description: formDesc.trim() || null,
        category: formCategory || null,
        category_color: color,
        progress: Math.min(100, Math.max(0, parseInt(formProgress, 10) || 0)),
        deadline: formDeadline.trim() || null,
      })
      .select('*, owner:profiles!owner_id(full_name, avatar_color, avatar_url)')
      .single();
    setCreating(false);
    if (error) { Alert.alert('作成失敗', error.message); return; }
    if (data) {
      setProjects(prev => [data as unknown as Project, ...prev]);
      await supabase.from('project_members').insert({ project_id: data.id, user_id: myId });
      setJoined(prev => new Set([...prev, data.id]));
    }
    setFormTitle(''); setFormDesc(''); setFormCategory('');
    setFormDeadline(''); setFormProgress('0');
    setView('list');
  };

  const openDetail = (project: Project) => {
    setSelectedProject(project);
    setView('detail');
  };

  const filtered = selectedCategory === 'すべて'
    ? projects
    : projects.filter(p => p.category === selectedCategory);

  // ══ 作成画面 ══
  if (view === 'create') {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>
        <View style={styles.subHeader}>
          <TouchableOpacity onPress={() => setView('list')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.backBtn}>←</Text>
          </TouchableOpacity>
          <Text style={styles.subHeaderTitle}>プロジェクトを作成</Text>
          <TouchableOpacity
            style={[styles.headerActionBtn, (!formTitle.trim() || creating) && { opacity: 0.4 }]}
            onPress={handleCreate}
            disabled={!formTitle.trim() || creating}
          >
            {creating
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={styles.headerActionBtnText}>作成</Text>}
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled">
          <View style={styles.formSection}>
            <Text style={styles.formLabel}>タイトル *</Text>
            <TextInput
              style={styles.formInput}
              value={formTitle}
              onChangeText={setFormTitle}
              placeholder="プロジェクト名を入力"
              placeholderTextColor={colors.overlay30}
              maxLength={100}
            />
          </View>

          <View style={styles.formSection}>
            <Text style={styles.formLabel}>説明</Text>
            <TextInput
              style={styles.formTextarea}
              value={formDesc}
              onChangeText={setFormDesc}
              placeholder="プロジェクトの目的や内容を書きましょう"
              placeholderTextColor={colors.overlay30}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              maxLength={500}
            />
          </View>

          <View style={styles.formSection}>
            <Text style={styles.formLabel}>カテゴリ</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.catChips}>
                {CATEGORIES.slice(1).map(cat => (
                  <TouchableOpacity
                    key={cat.label}
                    style={[
                      styles.catChip,
                      formCategory === cat.label && { backgroundColor: cat.color, borderColor: cat.color },
                    ]}
                    onPress={() => setFormCategory(formCategory === cat.label ? '' : cat.label)}
                  >
                    <Text style={[styles.catChipText, formCategory === cat.label && { color: '#fff' }]}>
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>

          <View style={styles.formRow}>
            <View style={[styles.formSection, { flex: 1 }]}>
              <Text style={styles.formLabel}>期限</Text>
              <TextInput
                style={styles.formInput}
                value={formDeadline}
                onChangeText={setFormDeadline}
                placeholder="例: 2026/12/31"
                placeholderTextColor={colors.overlay30}
                maxLength={20}
              />
            </View>
            <View style={[styles.formSection, { flex: 1 }]}>
              <Text style={styles.formLabel}>初期進捗 (0〜100)</Text>
              <TextInput
                style={styles.formInput}
                value={formProgress}
                onChangeText={setFormProgress}
                placeholder="0"
                placeholderTextColor={colors.overlay30}
                keyboardType="numeric"
                maxLength={3}
              />
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ══ 詳細画面 ══
  if (view === 'detail' && selectedProject) {
    const p = selectedProject;
    const color = catColor(p.category);
    const isOwner = p.owner_id === myId;
    const isJoined = joined.has(p.id);

    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>
        <View style={styles.subHeader}>
          <TouchableOpacity onPress={() => setView('list')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.backBtn}>←</Text>
          </TouchableOpacity>
          <Text style={styles.subHeaderTitle} numberOfLines={1}>{p.title}</Text>
          {isOwner && (
            <TouchableOpacity onPress={() => handleDelete(p)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.deleteBtn}>削除</Text>
            </TouchableOpacity>
          )}
          {!isOwner && <View style={{ width: 36 }} />}
        </View>

        <ScrollView contentContainerStyle={styles.detailContent}>
          {p.category && (
            <View style={[styles.detailCatBadge, { backgroundColor: `${color}22` }]}>
              <View style={[styles.detailCatDot, { backgroundColor: color }]} />
              <Text style={[styles.detailCatText, { color }]}>{p.category}</Text>
            </View>
          )}

          <Text style={styles.detailTitle}>{p.title}</Text>

          {p.description ? (
            <Text style={styles.detailDesc}>{p.description}</Text>
          ) : null}

          <View style={styles.detailMeta}>
            {p.deadline && (
              <View style={styles.detailMetaItem}>
                <Text style={styles.detailMetaIcon}>📅</Text>
                <Text style={styles.detailMetaText}>{p.deadline}</Text>
              </View>
            )}
            <View style={styles.detailMetaItem}>
              <Text style={styles.detailMetaIcon}>👥</Text>
              <Text style={styles.detailMetaText}>{p.members_count}人参加中</Text>
            </View>
          </View>

          <View style={styles.progressSection}>
            <View style={styles.progressLabelRow}>
              <Text style={styles.progressLabel}>進捗</Text>
              <Text style={[styles.progressValue, { color }]}>{p.progress}%</Text>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${p.progress}%` as any, backgroundColor: color }]} />
            </View>
          </View>

          {p.owner && (
            <View style={styles.ownerCard}>
              <View style={[styles.ownerAvatar, { backgroundColor: p.owner.avatar_color }]}>
                <Text style={styles.ownerAvatarText}>{p.owner.full_name?.[0] ?? '?'}</Text>
              </View>
              <View>
                <Text style={styles.ownerName}>{p.owner.full_name}</Text>
                <Text style={styles.ownerRole}>オーナー</Text>
              </View>
            </View>
          )}

          {!isOwner && (
            <TouchableOpacity
              style={[styles.joinBtn, isJoined && { backgroundColor: `${colors.primary}22`, borderColor: colors.primary, borderWidth: 1 }]}
              onPress={() => handleJoin(p)}
            >
              <Text style={[styles.joinBtnText, isJoined && { color: colors.primary }]}>
                {isJoined ? '参加中 ✓' : '参加する'}
              </Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ══ 一覧画面 ══
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>
      <AppHeader
        title="Activistem!"
        right={
          <TouchableOpacity style={styles.addBtn} onPress={() => setView('create')}>
            <Text style={styles.addBtnText}>＋ 作成</Text>
          </TouchableOpacity>
        }
      />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.catScroll}
        contentContainerStyle={styles.catScrollContent}
      >
        {CATEGORIES.map(cat => (
          <TouchableOpacity
            key={cat.label}
            style={[
              styles.catTab,
              selectedCategory === cat.label && { borderBottomColor: cat.color, borderBottomWidth: 2 },
            ]}
            onPress={() => setSelectedCategory(cat.label)}
          >
            <Text style={[styles.catTabText, selectedCategory === cat.label && { color: colors.text, fontWeight: '700' }]}>
              {cat.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
      >
        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 48 }} />
        ) : filtered.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>📁</Text>
            <Text style={styles.emptyText}>
              {projects.length === 0
                ? 'まだプロジェクトがありません。\n「＋ 作成」から始めましょう！'
                : 'このカテゴリのプロジェクトはありません。'}
            </Text>
          </View>
        ) : (
          filtered.map(project => {
            const color = catColor(project.category);
            const isJoined = joined.has(project.id);
            const isOwner = project.owner_id === myId;
            return (
              <TouchableOpacity
                key={project.id}
                style={styles.card}
                onPress={() => openDetail(project)}
                activeOpacity={0.8}
              >
                <View style={styles.cardTop}>
                  {project.category ? (
                    <View style={[styles.cardCatBadge, { backgroundColor: `${color}22` }]}>
                      <View style={[styles.cardCatDot, { backgroundColor: color }]} />
                      <Text style={[styles.cardCatText, { color }]}>{project.category}</Text>
                    </View>
                  ) : <View />}
                  {isOwner ? (
                    <Text style={styles.ownerBadge}>オーナー</Text>
                  ) : (
                    <TouchableOpacity
                      style={[styles.cardJoinBtn, isJoined && { backgroundColor: `${colors.primary}22` }]}
                      onPress={() => handleJoin(project)}
                    >
                      <Text style={[styles.cardJoinText, isJoined && { color: colors.primary }]}>
                        {isJoined ? '参加中' : '参加'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>

                <Text style={styles.cardTitle}>{project.title}</Text>
                {project.description ? (
                  <Text style={styles.cardDesc} numberOfLines={2}>{project.description}</Text>
                ) : null}

                <View style={styles.cardProgressRow}>
                  <View style={styles.cardProgressTrack}>
                    <View style={[styles.cardProgressFill, { width: `${project.progress}%` as any, backgroundColor: color }]} />
                  </View>
                  <Text style={styles.cardProgressText}>{project.progress}%</Text>
                </View>

                <View style={styles.cardMeta}>
                  {project.deadline ? <Text style={styles.cardMetaText}>📅 {project.deadline}</Text> : null}
                  <Text style={styles.cardMetaText}>👥 {project.members_count}人</Text>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(c: AppColors) {
  return StyleSheet.create({
    container: { flex: 1 },

    // サブヘッダー（作成・詳細画面）
    subHeader: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 16, paddingVertical: 12,
      borderBottomWidth: 1, borderBottomColor: c.cardBorder,
    },
    backBtn: { color: c.primary2, fontSize: 22, width: 36 },
    subHeaderTitle: { flex: 1, color: c.text, fontWeight: '700', fontSize: 15, textAlign: 'center', marginHorizontal: 8 },
    headerActionBtn: {
      backgroundColor: c.primary, paddingHorizontal: 14, paddingVertical: 6,
      borderRadius: 20, minWidth: 56, alignItems: 'center',
    },
    headerActionBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
    deleteBtn: { color: '#FF4D6A', fontSize: 13, width: 36, textAlign: 'right' },

    // 作成フォーム
    formContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 48 },
    formSection: { marginBottom: 16 },
    formRow: { flexDirection: 'row', gap: 12 },
    formLabel: {
      color: c.overlay45, fontSize: 11, fontWeight: '700',
      letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8,
    },
    formInput: {
      backgroundColor: c.card, borderWidth: 1, borderColor: c.cardBorder,
      borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
      color: c.text, fontSize: 14,
    },
    formTextarea: {
      backgroundColor: c.card, borderWidth: 1, borderColor: c.cardBorder,
      borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
      color: c.text, fontSize: 14, lineHeight: 22, minHeight: 100,
    },
    catChips: { flexDirection: 'row', gap: 8, paddingVertical: 4 },
    catChip: {
      paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
      borderWidth: 1, borderColor: c.cardBorder, backgroundColor: c.inputBg,
    },
    catChipText: { color: c.muted, fontSize: 13, fontWeight: '600' },

    // 詳細画面
    detailContent: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 48 },
    detailCatBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, marginBottom: 12 },
    detailCatDot: { width: 6, height: 6, borderRadius: 3 },
    detailCatText: { fontSize: 12, fontWeight: '700' },
    detailTitle: { color: c.text, fontWeight: '900', fontSize: 22, marginBottom: 12, lineHeight: 30 },
    detailDesc: { color: c.textBody, fontSize: 14, lineHeight: 24, marginBottom: 16 },
    detailMeta: { flexDirection: 'row', gap: 16, marginBottom: 20 },
    detailMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    detailMetaIcon: { fontSize: 15 },
    detailMetaText: { color: c.muted, fontSize: 13 },
    progressSection: { marginBottom: 20 },
    progressLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
    progressLabel: { color: c.overlay45, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },
    progressValue: { fontSize: 14, fontWeight: '800' },
    progressTrack: { height: 8, backgroundColor: c.inputBg, borderRadius: 4, overflow: 'hidden' },
    progressFill: { height: '100%', borderRadius: 4 },
    ownerCard: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      backgroundColor: c.card, borderWidth: 1, borderColor: c.cardBorder,
      borderRadius: 14, padding: 14, marginBottom: 24,
    },
    ownerAvatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
    ownerAvatarText: { color: '#fff', fontWeight: '800', fontSize: 16 },
    ownerName: { color: c.text, fontWeight: '700', fontSize: 14 },
    ownerRole: { color: c.overlay30, fontSize: 11, marginTop: 2 },
    joinBtn: { backgroundColor: c.primary, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
    joinBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },

    // 一覧
    addBtn: { backgroundColor: c.primary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
    addBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
    catScroll: { borderBottomWidth: 1, borderBottomColor: c.cardBorder },
    catScrollContent: { paddingHorizontal: 12 },
    catTab: { paddingHorizontal: 10, paddingVertical: 12, marginRight: 2 },
    catTabText: { color: c.mutedLight, fontSize: 13 },
    listContent: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 48 },
    empty: { alignItems: 'center', paddingTop: 64, paddingHorizontal: 32 },
    emptyEmoji: { fontSize: 48, marginBottom: 16 },
    emptyText: { color: c.muted, textAlign: 'center', fontSize: 14, lineHeight: 22 },

    // プロジェクトカード
    card: {
      backgroundColor: c.card, borderWidth: 1, borderColor: c.cardBorder,
      borderRadius: 16, padding: 16, marginBottom: 12,
    },
    cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
    cardCatBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
    cardCatDot: { width: 5, height: 5, borderRadius: 3 },
    cardCatText: { fontSize: 11, fontWeight: '700' },
    cardJoinBtn: {
      backgroundColor: c.inputBg, paddingHorizontal: 12, paddingVertical: 5,
      borderRadius: 20,
    },
    cardJoinText: { color: c.muted, fontSize: 12, fontWeight: '700' },
    ownerBadge: { color: c.primary, fontSize: 11, fontWeight: '700' },
    cardTitle: { color: c.text, fontWeight: '800', fontSize: 15, marginBottom: 6 },
    cardDesc: { color: c.textBody, fontSize: 13, lineHeight: 20, marginBottom: 10 },
    cardProgressRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
    cardProgressTrack: { flex: 1, height: 5, backgroundColor: c.inputBg, borderRadius: 3, overflow: 'hidden' },
    cardProgressFill: { height: '100%', borderRadius: 3 },
    cardProgressText: { color: c.overlay45, fontSize: 11, fontWeight: '700', width: 32, textAlign: 'right' },
    cardMeta: { flexDirection: 'row', gap: 12 },
    cardMetaText: { color: c.overlay30, fontSize: 12 },
  });
}
