"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";

import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

import { auth, db } from "@/services/firebase";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [studentProfile, setStudentProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      async (firebaseUser) => {
        try {
          if (!firebaseUser) {
            setUser(null);
            setStudentProfile(null);
            setLoading(false);
            return;
          }

          setUser(firebaseUser);

          const studentReference = doc(
            db,
            "students",
            firebaseUser.uid
          );

          const studentSnapshot = await getDoc(
            studentReference
          );

          if (studentSnapshot.exists()) {
            setStudentProfile({
              id: studentSnapshot.id,
              ...studentSnapshot.data(),
            });
          } else {
            setStudentProfile(null);
          }
        } catch (error) {
          console.error(
            "Error loading student profile:",
            error
          );

          setStudentProfile(null);
        } finally {
          setLoading(false);
        }
      }
    );

    return () => unsubscribe();
  }, []);

  const value = {
    user,
    studentProfile,
    loading,
    isAuthenticated: Boolean(user),
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error(
      "useAuth must be used inside AuthProvider."
    );
  }

  return context;
}