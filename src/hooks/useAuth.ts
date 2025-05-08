import { useState, useEffect } from "react";
import { auth } from "@/lib/firebaseClient";

type Role = "user" | "admin";

interface ServerUser {
  uid: string;
  email: string;
  name?: string;
  picture?: string;
  role?: Role;
}
                                                                                                                                       
export function useAuth() {
  const [firebaseUser, setFirebaseUser] = useState(auth.currentUser);
  const [role, setRole]            = useState<Role>("user");
  const [loading, setLoading]      = useState<boolean>(true);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (fbUser) => {
      setFirebaseUser(fbUser);
      if (fbUser) {
        try {
          const res  = await fetch("/api/auth/me");
          if (res.ok) {
            const data: ServerUser = await res.json();
            if (data.role) setRole(data.role);
          }
        } catch {
        }
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  return {
    user: firebaseUser,
    role,
    isAuthenticated: !!firebaseUser,
    loading,
  };
}