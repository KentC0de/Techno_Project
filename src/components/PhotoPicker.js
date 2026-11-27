import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme';
import { a11yRole } from '../utils/a11y';
import {
  pickPhoto,
  uploadTaskPhoto,
  removeTaskPhoto,
  useTaskPhotoUrls,
} from '../lib/taskPhotos';

function PhotoSlot({ uri, onRemove, disabled }) {
  return (
    <View style={styles.slot}>
      <Image source={{ uri }} style={styles.slotImg} />
      {!disabled && (
        <TouchableOpacity
          style={styles.removeBtn}
          onPress={onRemove}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          {...a11yRole('button')}
          accessibilityLabel="Remove photo"
        >
          <Ionicons name="close" size={14} color="#FFFFFF" />
        </TouchableOpacity>
      )}
    </View>
  );
}

export default function PhotoPicker({
  paths = [],
  onChange,
  ruleId,
  dueDate,
  max = 3,
  disabled = false,
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const urls = useTaskPhotoUrls(paths);

  const handleAdd = async (source) => {
    if (disabled || uploading || paths.length >= max) return;
    setError('');
    try {
      const asset = await pickPhoto(source);
      if (!asset) return;
      setUploading(true);
      const path = await uploadTaskPhoto({ ruleId, dueDate, asset });
      onChange([...paths, path]);
    } catch (err) {
      setError(err?.message || 'Photo failed. You can still save.');
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = async (index) => {
    const path = paths[index];
    onChange(paths.filter((_, i) => i !== index));
    if (path) await removeTaskPhoto(path);
  };

  const canAdd = !disabled && !uploading && paths.length < max;

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Photos (optional)</Text>
      <View style={styles.slotsRow}>
        {Array.from({ length: max }).map((_, i) => {
          const uri = urls[i];
          if (paths[i] && uri) {
            return (
              <PhotoSlot key={paths[i]} uri={uri} disabled={disabled} onRemove={() => handleRemove(i)} />
            );
          }
          const isUploadingSlot = uploading && i === paths.length;
          return (
            <View key={`empty-${i}`} style={[styles.slot, styles.emptySlot]}>
              {isUploadingSlot || (paths[i] && !uri) ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Ionicons name="image-outline" size={22} color="#A1A1AA" />
              )}
            </View>
          );
        })}
      </View>
      {!disabled && (
        <View style={styles.buttonsRow}>
          <TouchableOpacity
            style={[styles.btn, !canAdd && styles.btnDisabled]}
            onPress={() => handleAdd('camera')}
            disabled={!canAdd}
            {...a11yRole('button')}
            accessibilityLabel="Take photo"
          >
            <Ionicons name="camera-outline" size={18} color={colors.primary} />
            <Text style={styles.btnText}>Take photo</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.btn, !canAdd && styles.btnDisabled]}
            onPress={() => handleAdd('gallery')}
            disabled={!canAdd}
            {...a11yRole('button')}
            accessibilityLabel="Choose from gallery"
          >
            <Ionicons name="images-outline" size={18} color={colors.primary} />
            <Text style={styles.btnText}>Gallery</Text>
          </TouchableOpacity>
        </View>
      )}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 12 },
  label: { fontSize: 14, fontWeight: '600', color: '#0A0A0A', marginBottom: 8 },
  slotsRow: { flexDirection: 'row', gap: 8 },
  slot: {
    width: 72,
    height: 72,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#F4F4F5',
  },
  emptySlot: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E4E4E7',
    borderStyle: 'dashed',
  },
  slotImg: { width: '100%', height: '100%' },
  removeBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(10,10,10,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonsRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  btn: {
    flex: 1,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#0EA5E9',
    backgroundColor: '#FFFFFF',
  },
  btnDisabled: { opacity: 0.4 },
  btnText: { fontSize: 14, fontWeight: '600', color: '#0284C7' },
  errorText: { marginTop: 6, fontSize: 13, color: '#DC2626' },
});
