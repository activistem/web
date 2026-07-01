import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Dimensions, Image, Modal, Pressable } from 'react-native';
import { router } from 'expo-router';
import { useColors } from '../lib/ThemeContext';
import { AppColors } from '../constants/Colors';

const SCREEN_W = Dimensions.get('window').width;
const CARD_W = Math.min(SCREEN_W, 500);
const PAD = 14;
const DEFAULT_H = Math.round(CARD_W * 0.75);

type FeedPostProps = {
  authorName: string;
  authorRole: string;
  timeAgo: string;
  body: string;
  hashtags?: string[];
  avatarColor?: string;
  avatarUrl?: string | null;
  onDelete?: () => void;
  authorId?: string;
  currentUserId?: string;
  imageUrl?: string;
  imageUrls?: string[];
  visible?: boolean;
};

function toThumb(url: string, width = 800): string {
  const base = url.replace(
    '/storage/v1/object/public/',
    '/storage/v1/render/image/public/'
  );
  const sep = base.includes('?') ? '&' : '?';
  return `${base}${sep}width=${width}&resize=contain&quality=80`;
}

function ImageCarousel({ urls, visible }: { urls: string[]; visible: boolean }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [heights, setHeights] = useState<number[]>(() => urls.map(() => DEFAULT_H));
  const multi = urls.length > 1;

  useEffect(() => {
    let active = true;
    setHeights(urls.map(() => DEFAULT_H));
    urls.forEach((url, i) => {
      Image.getSize(
        url,
        (w, h) => {
          if (!active || w <= 0 || h <= 0) return;
          setHeights(prev => {
            const next = [...prev];
            next[i] = Math.round(CARD_W * h / w);
            return next;
          });
        },
        () => {},
      );
    });
    return () => { active = false; };
  }, [urls.join('|')]); // eslint-disable-line react-hooks/exhaustive-deps

  const containerH = heights[activeIndex] ?? DEFAULT_H;

  if (!visible) {
    return <View style={{ width: CARD_W, height: containerH, backgroundColor: 'rgba(0,0,0,0.15)' }} />;
  }

  return (
    <View style={{ width: CARD_W, height: containerH, backgroundColor: '#000' }}>
      <ScrollView
        horizontal
        pagingEnabled
        scrollEnabled={multi}
        showsHorizontalScrollIndicator={false}
        bounces={false}
        decelerationRate="fast"
        onMomentumScrollEnd={e => {
          const idx = Math.round(e.nativeEvent.contentOffset.x / CARD_W);
          setActiveIndex(idx);
        }}
        style={{ width: CARD_W, height: containerH }}
      >
        {urls.map((url, i) => (
          <View
            key={i}
            style={{ width: CARD_W, height: containerH, justifyContent: 'center', alignItems: 'center' }}
          >
            <Image
              source={{ uri: toThumb(url) }}
              style={{ width: CARD_W, height: containerH }}
              resizeMode="contain"
            />
          </View>
        ))}
      </ScrollView>

      {multi && (
        <View style={dotStyles.overlay}>
          <View style={dotStyles.row}>
            {urls.map((_, i) => (
              <View
                key={i}
                style={[dotStyles.dot, i === activeIndex ? dotStyles.dotActive : dotStyles.dotInactive]}
              />
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

const dotStyles = StyleSheet.create({
  overlay: { position: 'absolute', bottom: 10, left: 0, right: 0, alignItems: 'center' },
  row: { flexDirection: 'row', gap: 5, alignItems: 'center' },
  dot: { height: 6, borderRadius: 3 },
  dotActive: { width: 18, backgroundColor: '#fff' },
  dotInactive: { width: 6, backgroundColor: 'rgba(255,255,255,0.5)' },
});

const FeedPost = React.memo(function FeedPost({
  authorName,
  authorRole,
  timeAgo,
  body,
  hashtags = [],
  avatarColor,
  avatarUrl,
  onDelete,
  authorId,
  currentUserId,
  imageUrl,
  imageUrls,
  visible = true,
}: FeedPostProps) {
  const colors = useColors();
  const [menuVisible, setMenuVisible] = useState(false);
  const displayUrls = imageUrls?.length ? imageUrls : imageUrl ? [imageUrl] : [];
  const ringColor = avatarColor ?? colors.primary;

  const styles = useMemo(() => makeStyles(colors), [colors]);

  const handleAvatarPress = () => {
    if (!authorId) return;
    if (authorId === currentUserId) {
      router.navigate('/(tabs)/mydata');
    } else {
      router.push(`/profile/${authorId}`);
    }
  };

  return (
    <View style={styles.card}>
      {/* ヘッダー */}
      <View style={styles.header}>
        <TouchableOpacity
          style={[styles.avatarRing, { borderColor: ringColor }]}
          onPress={handleAvatarPress}
          activeOpacity={authorId ? 0.75 : 1}
        >
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatarImg} resizeMode="cover" />
          ) : (
            <View style={[styles.avatarFallback, { backgroundColor: ringColor }]}>
              <Text style={styles.avatarInitial}>
                {authorName[0]?.toUpperCase() ?? '?'}
              </Text>
            </View>
          )}
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.authorName} numberOfLines={1}>{authorName}</Text>
          <Text style={styles.authorSub} numberOfLines={1}>
            {[authorRole, timeAgo].filter(Boolean).join(' · ')}
          </Text>
        </View>
        {onDelete && (
          <TouchableOpacity
            style={styles.menuBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.6}
            onPress={() => setMenuVisible(true)}
          >
            <Text style={styles.menuBtnText}>⋮</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* 画像カルーセル */}
      {displayUrls.length > 0 && (
        <ImageCarousel urls={displayUrls} visible={visible} />
      )}

      {/* キャプション */}
      {(body.length > 0 || hashtags.length > 0) && (
        <View style={styles.captionArea}>
          {body.length > 0 && (
            <Text style={styles.captionText}>
              <Text style={styles.captionAuthor}>{authorName} </Text>
              {body}
            </Text>
          )}
          {hashtags.length > 0 && (
            <Text style={styles.hashtagLine}>
              {hashtags.map(t => `#${t}`).join(' ')}
            </Text>
          )}
        </View>
      )}

      {/* 削除メニュー（ボトムシート） */}
      {onDelete && (
        <Modal
          visible={menuVisible}
          transparent
          animationType="slide"
          onRequestClose={() => setMenuVisible(false)}
        >
          <View style={styles.menuOverlay}>
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={() => setMenuVisible(false)}
            />
            <Pressable style={styles.menuSheet} onPress={() => {}}>
              <View style={styles.menuHandle} />
              <TouchableOpacity
                style={styles.menuItemRow}
                activeOpacity={0.7}
                onPress={() => {
                  setMenuVisible(false);
                  onDelete();
                }}
              >
                <Text style={styles.menuItemDelete}>削除する</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.menuItemRow}
                activeOpacity={0.7}
                onPress={() => setMenuVisible(false)}
              >
                <Text style={styles.menuItemCancel}>キャンセル</Text>
              </TouchableOpacity>
            </Pressable>
          </View>
        </Modal>
      )}
    </View>
  );
});

export default FeedPost;

function makeStyles(c: AppColors) {
  return StyleSheet.create({
    card: {
      borderBottomWidth: 1,
      borderBottomColor: c.divider,
      marginBottom: 6,
      paddingBottom: 4,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: PAD,
      paddingVertical: 10,
    },
    avatarRing: {
      width: 40,
      height: 40,
      borderRadius: 20,
      borderWidth: 2,
      padding: 2,
      flexShrink: 0,
    },
    avatarImg: { width: '100%', height: '100%', borderRadius: 16 },
    avatarFallback: {
      flex: 1,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarInitial: { color: '#fff', fontWeight: '800', fontSize: 14 },
    authorName: { color: c.text, fontWeight: '700', fontSize: 13 },
    authorSub: { color: c.mutedLight, fontSize: 11, marginTop: 1 },
    menuBtn: { paddingHorizontal: 6, paddingVertical: 2, marginLeft: 4 },
    menuBtnText: { color: c.overlay45, fontSize: 22, lineHeight: 24, letterSpacing: 0 },

    menuOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.55)',
      justifyContent: 'flex-end',
    },
    menuSheet: {
      backgroundColor: c.surface,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingBottom: 40,
    },
    menuHandle: {
      width: 40,
      height: 4,
      backgroundColor: c.overlay45,
      borderRadius: 2,
      alignSelf: 'center',
      marginTop: 10,
      marginBottom: 6,
    },
    menuItemRow: {
      paddingVertical: 17,
      paddingHorizontal: 24,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.cardBorder,
      alignItems: 'center',
    },
    menuItemDelete: { color: '#FF4D6A', fontSize: 16, fontWeight: '600' },
    menuItemCancel: { color: c.overlay45, fontSize: 15 },

    captionArea: { paddingHorizontal: PAD, paddingBottom: 10, gap: 4 },
    captionText: { color: c.textBody, fontSize: 13, lineHeight: 19 },
    captionAuthor: { fontWeight: '700', color: c.text },
    hashtagLine: { color: c.primary2, fontSize: 12, lineHeight: 18 },
  });
}
