import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { decode } from 'base64-arraybuffer';
import { useQuery } from '@tanstack/react-query';
import { supabase } from './supabase';

const BUCKET = 'task-photos';
const EMPTY = [];
const urlCache = new Map(); // path -> { url, expires }

export async function pickPhoto(source) {
  const isCamera = source === 'camera';
  const perm = isCamera
    ? await ImagePicker.requestCameraPermissionsAsync()
    : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    throw new Error(
      isCamera
        ? 'Camera permission is needed. You can enable it in Settings.'
        : 'Gallery permission is needed. You can enable it in Settings.'
    );
  }
  const options = { mediaTypes: ['images'], quality: 0.7, allowsEditing: false };
  const result = isCamera
    ? await ImagePicker.launchCameraAsync(options)
    : await ImagePicker.launchImageLibraryAsync(options);
  if (result.canceled || !result.assets || result.assets.length === 0) return null;
  return result.assets[0];
}

export async function compressPhoto(uri) {
  return ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 1280 } }],
    { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true }
  );
}

function mapError(err) {
  const msg = String(err?.message || err || '').toLowerCase();
  const status = err?.statusCode || err?.status;
  if (status === 403 || status === '403' || msg.includes('row-level security') || msg.includes('unauthorized')) {
    return new Error('You cannot add photos to this task.');
  }
  if (status === 413 || status === '413' || msg.includes('too large') || msg.includes('exceeded')) {
    return new Error('Photo is too large (max 5 MB).');
  }
  if (msg.includes('network') || msg.includes('failed to fetch') || msg.includes('offline')) {
    return new Error('No connection. Try again.');
  }
  return new Error(err?.message || 'Photo upload failed.');
}

export async function uploadTaskPhoto({ ruleId, dueDate, asset }) {
  try {
    const compressed = await compressPhoto(asset.uri);
    const random = Math.random().toString(36).slice(2, 8);
    const path = `${ruleId}/${dueDate}/${Date.now()}-${random}.jpg`;
    let body;
    if (Platform.OS === 'web') {
      body = await fetch(compressed.uri).then((r) => r.blob());
    } else {
      body = decode(compressed.base64);
    }
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, body, { contentType: 'image/jpeg' });
    if (error) throw error;
    return path;
  } catch (err) {
    throw mapError(err);
  }
}

export async function removeTaskPhoto(path) {
  try {
    await supabase.storage.from(BUCKET).remove([path]);
    urlCache.delete(path);
  } catch (_err) {
    // best effort: never block the user
  }
}

export async function getPhotoUrls(paths) {
  const list = Array.isArray(paths) ? paths.filter(Boolean) : [];
  if (list.length === 0) return [];
  const now = Date.now();
  const missing = list.filter((p) => !urlCache.get(p) || urlCache.get(p).expires < now);
  if (missing.length > 0) {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(missing, 3600);
    if (error) throw error;
    (data || []).forEach((row) => {
      if (row?.signedUrl && row.path) {
        urlCache.set(row.path, { url: row.signedUrl, expires: now + 3300 * 1000 });
      }
    });
  }
  return list.map((p) => urlCache.get(p)?.url).filter(Boolean);
}

// Always returns an array (never undefined) with a stable reference.
export function useTaskPhotoUrls(paths) {
  const list = Array.isArray(paths) ? paths.filter(Boolean) : EMPTY;
  const key = list.join('|');
  const { data } = useQuery({
    queryKey: ['task-photo-urls', key],
    queryFn: () => getPhotoUrls(list),
    enabled: list.length > 0,
    staleTime: 50 * 60 * 1000,
  });
  return list.length > 0 && Array.isArray(data) ? data : EMPTY;
}
