import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { account, db, Query } from '../lib/appwrite';

const AuthContext = createContext(null);
// eslint-disable-next-line react-refresh/only-export-components -- hook ships with its provider
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);       // Appwrite account
  const [employee, setEmployee] = useState(null); // employees row (holds the role)
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const me = await account.get();
      const rows = await db.list('employees', [Query.equal('userId', me.$id), Query.limit(1)]);
      setUser(me);
      setEmployee(rows[0] || null);
    } catch {
      setUser(null);
      setEmployee(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- load() only sets state after its awaits
  useEffect(() => { load(); }, [load]);

  const signIn = async (email, password) => {
    await account.createEmailPasswordSession({ email, password });
    await load();
  };

  const signOut = async () => {
    try { await account.deleteSession({ sessionId: 'current' }); } catch { /* already gone */ }
    setUser(null);
    setEmployee(null);
  };

  const isAdmin = employee?.role === 'admin';

  return (
    <AuthContext.Provider value={{ user, employee, isAdmin, loading, signIn, signOut, reload: load }}>
      {children}
    </AuthContext.Provider>
  );
}
