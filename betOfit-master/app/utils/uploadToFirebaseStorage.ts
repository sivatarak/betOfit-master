import auth from '@react-native-firebase/auth';

const FIREBASE_STORAGE_BUCKET = process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET; // from your google-services.json

export async function uploadPhotoToFirebase(uri: string, filename: string): Promise<string> {
  const token = await auth().currentUser?.getIdToken();
  if (!token) throw new Error("Not authenticated");

  const path = `profile_photos/${filename}`;
  const uploadUrl = `https://firebasestorage.googleapis.com/v0/b/${FIREBASE_STORAGE_BUCKET}/o?uploadType=media&name=${encodeURIComponent(path)}`;

  const response = await fetch(uri);
  const blob = await response.blob();

  const uploadResponse = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "image/jpeg",
    },
    body: blob,
  });

  if (!uploadResponse.ok) throw new Error("Upload failed");

  const data = await uploadResponse.json();
  const downloadURL = `https://firebasestorage.googleapis.com/v0/b/${FIREBASE_STORAGE_BUCKET}/o/${encodeURIComponent(path)}?alt=media&token=${data.downloadTokens}`;
  return downloadURL;
}