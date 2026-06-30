import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link, router } from 'expo-router';
import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Colors } from '../../constants/Colors';

const AVATAR_COLORS = ['#c47070', '#7088c4', '#70c485', '#c4a870', '#a070c4', '#70b8c4'];

export default function RegisterScreen() {
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleRegister = async () => {
    setErrorMsg('');
    setSuccessMsg('');
    if (!fullName.trim() || !email.trim() || !password.trim() || !username.trim()) {
      setErrorMsg('すべての必須項目（*）を入力してください');
      return;
    }
    if (password.length < 6) {
      setErrorMsg('パスワードは6文字以上にしてください');
      return;
    }
    setLoading(true);
    try {
      const avatarColor = AVATAR_COLORS[fullName.length % AVATAR_COLORS.length];
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            username,
            role: role || 'メンバー',
            avatar_color: avatarColor,
          },
        },
      });
      console.log('signUp result:', { user: data?.user?.id, session: !!data?.session, error: error?.message });

      if (error) {
        setErrorMsg(error.message);
        return;
      }

      // メール確認不要でセッションが即時発行された場合
      if (data.session) {
        router.replace('/(tabs)');
        return;
      }

      // メール確認が必要な場合
      setSuccessMsg('確認メールを送信しました。メール内のリンクをクリックしてからログインしてください。');
    } catch (e: any) {
      console.error('register error:', e);
      setErrorMsg(e?.message ?? '登録に失敗しました。もう一度お試しください。');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.inner}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.logoWrap}>
            <View style={styles.logoIcon}>
              <Text style={styles.logoIconText}>A</Text>
            </View>
            <Text style={styles.logoText}>
              Activis<Text style={styles.logoAccent}>tem!</Text>
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>新規登録</Text>

            {errorMsg ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>⚠️ {errorMsg}</Text>
              </View>
            ) : null}

            {successMsg ? (
              <View style={styles.successBox}>
                <Text style={styles.successText}>✅ {successMsg}</Text>
                <TouchableOpacity
                  style={styles.toLoginBtn}
                  onPress={() => router.replace('/(auth)/login')}
                >
                  <Text style={styles.toLoginBtnText}>ログイン画面へ →</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <Text style={styles.label}>氏名 *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="田中 葵"
                  placeholderTextColor="rgba(255,255,255,0.25)"
                  value={fullName}
                  onChangeText={setFullName}
                />

                <Text style={styles.label}>ユーザー名 *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="tanaka_aoi"
                  placeholderTextColor="rgba(255,255,255,0.25)"
                  value={username}
                  onChangeText={setUsername}
                  autoCapitalize="none"
                />

                <Text style={styles.label}>役割・肩書き</Text>
                <TextInput
                  style={styles.input}
                  placeholder="例: 環境NPO代表、社会起業家..."
                  placeholderTextColor="rgba(255,255,255,0.25)"
                  value={role}
                  onChangeText={setRole}
                />

                <Text style={styles.label}>メールアドレス *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="your@email.com"
                  placeholderTextColor="rgba(255,255,255,0.25)"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />

                <Text style={styles.label}>パスワード * (6文字以上)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="パスワード"
                  placeholderTextColor="rgba(255,255,255,0.25)"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                />

                <TouchableOpacity
                  style={[styles.btn, loading && styles.btnDisabled]}
                  onPress={handleRegister}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.btnText}>アカウントを作成</Text>
                  )}
                </TouchableOpacity>
              </>
            )}

            <View style={styles.footer}>
              <Text style={styles.footerText}>すでにアカウントをお持ちの方は </Text>
              <Link href="/(auth)/login" asChild>
                <TouchableOpacity>
                  <Text style={styles.footerLink}>ログイン</Text>
                </TouchableOpacity>
              </Link>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  inner: { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: 24, paddingVertical: 40 },
  logoWrap: { alignItems: 'center', marginBottom: 32, gap: 10 },
  logoIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoIconText: { color: '#fff', fontWeight: '900', fontSize: 24 },
  logoText: { color: '#fff', fontWeight: '900', fontSize: 22 },
  logoAccent: { color: Colors.green2 },
  card: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    borderRadius: 20,
    padding: 24,
  },
  cardTitle: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 22,
    marginBottom: 24,
    textAlign: 'center',
  },
  errorBox: {
    backgroundColor: 'rgba(244,67,54,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(244,67,54,0.4)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  errorText: { color: '#ff6b6b', fontSize: 13, lineHeight: 18 },
  successBox: {
    backgroundColor: 'rgba(0,208,132,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(0,208,132,0.35)',
    borderRadius: 10,
    padding: 16,
    marginBottom: 16,
    gap: 12,
  },
  successText: { color: Colors.green2, fontSize: 13, lineHeight: 20 },
  toLoginBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  toLoginBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  label: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#fff',
    fontSize: 15,
    marginBottom: 14,
  },
  btn: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 20,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  footerText: { color: Colors.muted, fontSize: 13 },
  footerLink: { color: Colors.primary2, fontWeight: '700', fontSize: 13 },
});
