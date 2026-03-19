// app/utils/mockAuth.ts
export const MOCK_USER = {
  userId: 'dev_user_001',
  email: 'dev@betofit.com',
  name: 'Dev User',
};

export function getUserId() {
  return MOCK_USER.userId;
}

export function getCurrentUser() {
  return MOCK_USER;
}