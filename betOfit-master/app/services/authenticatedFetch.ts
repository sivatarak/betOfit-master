import auth from '@react-native-firebase/auth';

export async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
  const currentUser = auth().currentUser;
  if (!currentUser) {
    throw new Error('You must be signed in to access this resource.');
  }

  const token = await currentUser.getIdToken();
  const headers = new Headers(options.headers);
  headers.set('Authorization', `Bearer ${token}`);

  return fetch(url, { ...options, headers });
}
