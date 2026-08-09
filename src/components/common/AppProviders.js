"use client";

import { AuthProvider } from "@/contexts/AuthContext";

export default function AppProviders({ children }) {
  return (
    <AuthProvider>
      {children}
    </AuthProvider>
  );
}