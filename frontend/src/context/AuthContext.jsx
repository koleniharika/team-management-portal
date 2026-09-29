import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, getToken, setToken } from '../lib/api';

const AuthContext = createContext(null);
// eslint-disable-next-line react-refresh/only-export-components -- hook ships with its provider
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [employee, setEmployee] = useState(null); // profile row from /auth/me
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!getToken()) {
      setEmployee(null);
      setLoading(false);
      return;
    }
    try {
      setEmployee(await api.me());
    } catch {
      setToken(null); // expired or revoked
      setEmployee(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- load() only sets state after its awaits
  useEffect(() => { load(); }, [load]);

  const signIn = async (email, password) => {
    const { token, user } = await api.login(email, password);
    setToken(token);
    setEmployee(user);
  };

  const signOut = () => {
    setToken(null);
    setEmployee(null);
  };

  /** Swaps the password and clears the "must change" flag on the profile. */
  const changePassword = async (currentPassword, newPassword) => {
    await api.changePassword(currentPassword, newPassword);
    await load();
  };

  const isAdmin = employee?.role === 'admin';

  return (
    <AuthContext.Provider value={{ employee, isAdmin, loading, signIn, signOut, changePassword, reload: load }}>
      {children}
    </AuthContext.Provider>
  );
}
