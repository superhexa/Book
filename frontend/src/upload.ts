import * as ImagePicker from "expo-image-picker";
import { Platform } from "react-native";

import { API_BASE, getAccess } from "@/src/api";

export async function pickImage(): Promise<ImagePicker.ImagePickerAsset | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return null;
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    quality: 0.7,
    allowsEditing: true,
  });
  if (res.canceled || !res.assets?.length) return null;
  return res.assets[0];
}

export async function uploadAsset(asset: ImagePicker.ImagePickerAsset): Promise<{ path: string; url: string }> {
  const token = await getAccess();
  const name = asset.fileName || `photo_${Date.now()}.jpg`;
  const type = asset.mimeType || "image/jpeg";
  const form = new FormData();
  if (Platform.OS === "web") {
    const blob = await (await fetch(asset.uri)).blob();
    form.append("file", blob, name);
  } else {
    form.append("file", { uri: asset.uri, name, type } as any);
  }
  const res = await fetch(`${API_BASE}/uploads`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(t || "Upload failed");
  }
  return res.json();
}

export { ImagePicker };
