import auth from '@react-native-firebase/auth';

export const getUserStorageKey = (userId: string, key: string): string =>
  `USER_DATA_${encodeURIComponent(userId)}_${key}`;

export const getCurrentUserStorageKey = (key: string): string | null => {
  const userId = auth().currentUser?.uid;
  return userId ? getUserStorageKey(userId, key) : null;
};
