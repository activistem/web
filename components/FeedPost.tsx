import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors } from '../constants/Colors';

type FeedPostProps = {
  authorName: string;
  authorRole: string;
  timeAgo: string;
  body: string;
  hashtags?: string[];
  likes?: number;
  comments?: number;
  shares?: number;
  avatarColor?: string;
};

export default function FeedPost({
  authorName,
  authorRole,
  timeAgo,
  body,
  hashtags = [],
  likes = 0,
  comments = 0,
  shares = 0,
  avatarColor = Colors.primary,
}: FeedPostProps) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={[styles.avatar, { backgroundColor: avatarColor }]} />
        <View style={styles.authorInfo}>
          <Text style={styles.authorName}>{authorName}</Text>
          <Text style={styles.authorRole}>{authorRole}</Text>
        </View>
        <Text style={styles.time}>{timeAgo}</Text>
      </View>
      <Text style={styles.body}>{body}</Text>
      {hashtags.length > 0 && (
        <View style={styles.hashtags}>
          {hashtags.map((tag) => (
            <Text key={tag} style={styles.hashtag}>
              #{tag}
            </Text>
          ))}
        </View>
      )}
      <View style={styles.stats}>
        <TouchableOpacity style={styles.statItem}>
          <Text style={styles.statText}>♡ {likes}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.statItem}>
          <Text style={styles.statText}>💬 {comments}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.statItem}>
          <Text style={styles.statText}>🔄 {shares}</Text>
        </TouchableOpacity>
      </View>
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
    marginBottom: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    flexShrink: 0,
  },
  authorInfo: {
    flex: 1,
  },
  authorName: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  authorRole: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 11,
  },
  time: {
    color: 'rgba(255,255,255,0.25)',
    fontSize: 11,
  },
  body: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 8,
  },
  hashtags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  hashtag: {
    color: Colors.primary2,
    fontSize: 12,
  },
  stats: {
    flexDirection: 'row',
    gap: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    paddingTop: 8,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statText: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 12,
  },
});
