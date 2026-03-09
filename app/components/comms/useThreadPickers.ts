/**
 * useThreadPickers — Native image, document, and camera picker logic for thread composer.
 *
 * Wraps expo-image-picker and expo-document-picker with permission handling
 * and a unified PickedFile result shape that feeds into the upload pipeline.
 *
 * expo-document-picker is imported lazily so the app doesn't crash on
 * platforms/clients where the native module isn't linked (e.g. Expo Go).
 */
import { useCallback } from 'react';
import { Alert, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

export interface PickedFile {
  name: string;
  type: string;
  size: number;
  uri: string;
}

export interface ThreadPickerActions {
  /** Launch the photo/video library picker (native) */
  pickPhotoVideo: () => Promise<PickedFile | null>;
  /** Launch the document picker (native) */
  pickDocument: () => Promise<PickedFile | null>;
  /** Launch the camera to take a photo or video (native) */
  launchCamera: () => Promise<PickedFile | null>;
}

export function useThreadPickers(): ThreadPickerActions {
  const pickPhotoVideo = useCallback(async (): Promise<PickedFile | null> => {
    if (Platform.OS === 'ios') {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission required', 'Allow photo library access to attach photos and videos.');
        return null;
      }
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      allowsEditing: false,
      quality: 0.85,
    });
    if (result.canceled || !result.assets?.[0]) return null;
    const asset = result.assets[0];
    return {
      name: asset.fileName || `media-${Date.now()}.${asset.type === 'video' ? 'mp4' : 'jpg'}`,
      type: asset.mimeType || (asset.type === 'video' ? 'video/mp4' : 'image/jpeg'),
      size: typeof asset.fileSize === 'number' ? asset.fileSize : 0,
      uri: asset.uri,
    };
  }, []);

  const pickDocument = useCallback(async (): Promise<PickedFile | null> => {
    try {
      const DocPicker = await import('expo-document-picker');
      const result = await DocPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.[0]) return null;
      const asset = result.assets[0];
      return {
        name: asset.name,
        type: asset.mimeType || 'application/octet-stream',
        size: asset.size ?? 0,
        uri: asset.uri,
      };
    } catch {
      Alert.alert('Not available', 'File picker is not available on this device. Try Photo / Video instead.');
      return null;
    }
  }, []);

  const launchCamera = useCallback(async (): Promise<PickedFile | null> => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission required', 'Allow camera access to take photos and videos.');
      return null;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images', 'videos'],
      allowsEditing: false,
      quality: 0.85,
      videoMaxDuration: 120,
    });
    if (result.canceled || !result.assets?.[0]) return null;
    const asset = result.assets[0];
    return {
      name: asset.fileName || `capture-${Date.now()}.${asset.type === 'video' ? 'mp4' : 'jpg'}`,
      type: asset.mimeType || (asset.type === 'video' ? 'video/mp4' : 'image/jpeg'),
      size: typeof asset.fileSize === 'number' ? asset.fileSize : 0,
      uri: asset.uri,
    };
  }, []);

  return { pickPhotoVideo, pickDocument, launchCamera };
}
