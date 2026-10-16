import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  User as FirebaseUser,
} from 'firebase/auth';
import { auth } from '../config/firebase';
import { getUser, autoFillMissedTips } from '../services/firestoreService';
import { registerForPushNotifications, scheduleRemindersForUntippedRounds } from '../services/notificationService';
import { User } from '../types';

interface AuthContextType {
  user: User | null;
  firebaseUser: FirebaseUser | null;
  loading: boolean;
  isAdmin: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  firebaseUser: null,
  loading: true,
  isAdmin: false,
  signIn: async () => {},
  signOut: async () => {},
  refreshUser: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);

  const loadUserProfile = useCallback(async (fbUser: FirebaseUser) => {
    try {
      const profile = await getUser(fbUser.uid);
      if (profile) {
        setUser(profile);
      } else {
        // Bruger findes i Auth men ikke i Firestore — sæt basis-data
        setUser({
          id: fbUser.uid,
          name: fbUser.displayName ?? fbUser.email ?? 'Ukendt',
          email: fbUser.email ?? '',
          isAdmin: false,
        });
      }
    } catch (error) {
      console.error('Fejl ved indlæsning af brugerprofil:', error);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      setFirebaseUser(fbUser);
      if (fbUser) {
        await loadUserProfile(fbUser);
        // Register push token
        registerForPushNotifications(fbUser.uid).catch(console.error);
        // Schedule reminders for untipped rounds
        scheduleRemindersForUntippedRounds(fbUser.uid).catch(console.error);
        // Auto-fill missed tips for expired rounds
        autoFillMissedTips().catch(console.error);
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, [loadUserProfile]);

  const signIn = async (email: string, password: string) => {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    await loadUserProfile(cred.user);
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
    setUser(null);
    setFirebaseUser(null);
  };

  const refreshUser = async () => {
    if (firebaseUser) {
      await loadUserProfile(firebaseUser);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        firebaseUser,
        loading,
        isAdmin: user?.isAdmin ?? false,
        signIn,
        signOut,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
