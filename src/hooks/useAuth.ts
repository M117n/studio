import { useState, useEffect } from "react";
import { auth } from "@/lib/firebaseClient"; 
import { User } from "firebase/auth"; 

export const MASTER_ADMIN_UID = process.env.NEXT_PUBLIC_MASTER_ADMIN_UID;

type Role = "user" | "admin";

interface ServerUser { 
  uid: string;
  email: string;
  name?: string;
  picture?: string;
}

export function useAuth() {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(auth.currentUser);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [isMasterAdmin, setIsMasterAdmin] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [claimsLoading, setClaimsLoading] = useState<boolean>(true); 

  useEffect(() => {
    const unsubscribe = auth.onIdTokenChanged(async (fbUser) => {
      setFirebaseUser(fbUser);
      if (fbUser) {
        setClaimsLoading(true);
        try {
          const idTokenResult = await fbUser.getIdTokenResult();
          const claims = idTokenResult.claims;
          
          // Check for admin status
          if (claims.admin === true) {
            setIsAdmin(true);
          } else {
            setIsAdmin(false);
          }

          // Check for master admin status
          if (fbUser.uid === MASTER_ADMIN_UID) {
            setIsMasterAdmin(true);
          } else {
            setIsMasterAdmin(false);
          }
        } catch (error) {
          console.error("Error fetching custom claims:", error);
          setIsAdmin(false); 
          setIsMasterAdmin(false);
        } finally {
          setClaimsLoading(false);
        }
      } else {
        setIsAdmin(false);
        setIsMasterAdmin(false);
        setClaimsLoading(false); 
      }
      setLoading(false); 
    });

    if (auth.currentUser) {
        auth.currentUser.getIdTokenResult().then(idTokenResult => {
            setIsAdmin(idTokenResult.claims.admin === true);
            setIsMasterAdmin(auth.currentUser?.uid === MASTER_ADMIN_UID);
            setClaimsLoading(false);
        }).catch(err => {
            console.error("Initial claims check error:", err);
            setIsAdmin(false);
            setIsMasterAdmin(false);
            setClaimsLoading(false);
        });
    } else {
        setClaimsLoading(false); 
    }


    return () => unsubscribe();
  }, []);

  return {
    user: firebaseUser,
    isAdmin, 
    isMasterAdmin,
    isAuthenticated: !!firebaseUser,
    loading: loading || claimsLoading, 
  };
}