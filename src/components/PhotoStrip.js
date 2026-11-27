import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTaskPhotoUrls } from '../lib/taskPhotos';
import { a11yRole } from '../utils/a11y';

// Read-only thumbnails with a full-screen viewer (previous / next).
export default function PhotoStrip({ paths, title, subtitle, size = 56 }) {
  const urls = useTaskPhotoUrls(paths);
  const [openIndex, setOpenIndex] = useState(null);

  if (!Array.isArray(paths) || paths.length === 0) return null;

  const count = urls.length;
  const current = openIndex !== null ? urls[openIndex] : null;

  return (
    <View style={styles.row}>
      {paths.map((p, i) => {
        const uri = urls[i];
        return (
          <TouchableOpacity
            key={p}
            style={[styles.thumb, { width: size, height: size }]}
            onPress={() => uri && setOpenIndex(i)}
            disabled={!uri}
            {...a11yRole('button')}
            accessibilityLabel={`Open photo ${i + 1} of ${paths.length}`}
          >
            {uri ? (
              <Image source={{ uri }} style={styles.thumbImg} />
            ) : (
              <Ionicons name="image-outline" size={20} color="#9CA3AF" />
            )}
          </TouchableOpacity>
        );
      })}

      <Modal
        visible={openIndex !== null && !!current}
        transparent
        animationType="fade"
        onRequestClose={() => setOpenIndex(null)}
      >
        <View style={styles.backdrop}>
          <View style={styles.topBar}>
            <View style={styles.topText}>
              {title ? <Text style={styles.title} numberOfLines={1}>{title}</Text> : null}
              {subtitle ? <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text> : null}
            </View>
            <TouchableOpacity
              onPress={() => setOpenIndex(null)}
              style={styles.iconBtn}
              {...a11yRole('button')}
              accessibilityLabel="Close photo"
            >
              <Ionicons name="close" size={26} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <View style={styles.stage}>
            <TouchableOpacity
              style={[styles.arrow, openIndex === 0 && styles.arrowOff]}
              onPress={() => setOpenIndex((i) => Math.max(0, (i ?? 0) - 1))}
              disabled={openIndex === 0}
              {...a11yRole('button')}
              accessibilityLabel="Previous photo"
            >
              <Ionicons name="chevron-back" size={28} color="#FFFFFF" />
            </TouchableOpacity>
            {current ? (
              <Image source={{ uri: current }} style={styles.full} resizeMode="contain" />
            ) : null}
            <TouchableOpacity
              style={[styles.arrow, openIndex === count - 1 && styles.arrowOff]}
              onPress={() => setOpenIndex((i) => Math.min(count - 1, (i ?? 0) + 1))}
              disabled={openIndex === count - 1}
              {...a11yRole('button')}
              accessibilityLabel="Next photo"
            >
              <Ionicons name="chevron-forward" size={28} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
          <Text style={styles.counter}>
            {(openIndex ?? 0) + 1} / {count}
          </Text>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 },
  thumb: {
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginRight: 8,
    marginBottom: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbImg: { width: '100%', height: '100%' },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(10,10,10,0.94)',
    paddingTop: Platform.OS === 'web' ? 16 : 48,
    paddingBottom: 24,
  },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 },
  topText: { flex: 1 },
  title: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  subtitle: { color: '#D1D5DB', fontSize: 14, marginTop: 2 },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  stage: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  arrow: { width: 44, height: 64, alignItems: 'center', justifyContent: 'center' },
  arrowOff: { opacity: 0.25 },
  full: { flex: 1, height: '100%' },
  counter: { color: '#FFFFFF', fontSize: 14, textAlign: 'center' },
});
