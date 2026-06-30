import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors } from '../constants/Colors';

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
  avatarColor = Colors.primary,
  connected,
  onConnect,
}: UserCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <View style={[styles.avatar, { backgroundColor: avatarColor }]} />
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

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 6,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    flexShrink: 0,
  },
  info: {
    flex: 1,
  },
  name: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 13,
  },
  role: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 11,
  },
  connectBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  connectBtnText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  connectedText: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 11,
  },
  meta: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.3)',
    marginBottom: 4,
  },
  bio: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    lineHeight: 18,
    marginBottom: 6,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  tag: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  tagText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11,
  },
});
