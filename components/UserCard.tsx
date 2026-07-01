import { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useColors } from '../lib/ThemeContext';
import { AppColors } from '../constants/Colors';

type UserCardProps = {
  name: string;
  role: string;
  location?: string;
  followers?: number;
  projects?: number;
  bio?: string;
  tags?: string[];
  avatarColor?: string;
  connected?: boolean;
  onConnect?: () => void;
};

export default function UserCard({
  name,
  role,
  location,
  followers,
  projects,
  bio,
  tags = [],
  avatarColor,
  connected,
  onConnect,
}: UserCardProps) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <View style={[styles.avatar, { backgroundColor: avatarColor ?? colors.primary }]} />
        <View style={styles.info}>
          <Text style={styles.name}>{name}</Text>
          <Text style={styles.role}>{role}</Text>
        </View>
        {connected ? (
          <Text style={styles.connectedText}>接続済み</Text>
        ) : (
          <TouchableOpacity style={styles.connectBtn} onPress={onConnect}>
            <Text style={styles.connectBtnText}>＋ つながる</Text>
          </TouchableOpacity>
        )}
      </View>
      {(location || followers !== undefined || projects !== undefined) && (
        <Text style={styles.meta}>
          {location && `📍 ${location}　`}
          {followers !== undefined && `👥 ${followers}　`}
          {projects !== undefined && `${projects} projects`}
        </Text>
      )}
      {bio ? <Text style={styles.bio}>{bio}</Text> : null}
      {tags.length > 0 && (
        <View style={styles.tags}>
          {tags.map((t) => (
            <View key={t} style={styles.tag}>
              <Text style={styles.tagText}>{t}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function makeStyles(c: AppColors) {
  return StyleSheet.create({
    card: {
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.cardBorder,
      borderRadius: 12,
      padding: 12,
      marginBottom: 8,
    },
    row: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
    avatar: { width: 36, height: 36, borderRadius: 18, flexShrink: 0 },
    info: { flex: 1 },
    name: { color: c.text, fontWeight: '800', fontSize: 13 },
    role: { color: c.muted, fontSize: 11 },
    connectBtn: {
      backgroundColor: c.primary,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 8,
    },
    connectBtnText: { color: '#fff', fontSize: 11, fontWeight: '700' },
    connectedText: { color: c.overlay30, fontSize: 11 },
    meta: { fontSize: 11, color: c.overlay30, marginBottom: 4 },
    bio: { fontSize: 12, color: c.muted, lineHeight: 18, marginBottom: 6 },
    tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
    tag: { backgroundColor: c.inputBg, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
    tagText: { color: c.muted, fontSize: 11 },
  });
}
