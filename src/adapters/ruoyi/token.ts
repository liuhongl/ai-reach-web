const TokenKey = 'Admin-Token';

const canUseStorage = () => typeof localStorage !== 'undefined';

export const getToken = () => {
  if (!canUseStorage()) return null;
  return localStorage.getItem(TokenKey);
};

export const setToken = (accessToken: string) => {
  if (!canUseStorage()) return;
  localStorage.setItem(TokenKey, accessToken);
};

export const removeToken = () => {
  if (!canUseStorage()) return;
  localStorage.removeItem(TokenKey);
};
