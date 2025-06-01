'use client';

import { auth } from '@/lib/firebaseClient';
import {
  GoogleAuthProvider,
  signInWithPopup,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from "next/navigation";

interface AuthPanelProps {
  initialMode?: 'login' | 'register';
}

export function AuthPanel({ initialMode = 'login' }: AuthPanelProps) {
  const [user, setUser] = useState(auth.currentUser);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [error, setError] = useState('');
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((firebaseUser) => {
      console.log('[AuthPanel] onAuthStateChanged triggered. Firebase user:', firebaseUser);
      setUser(firebaseUser);
    });
    return () => unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); 

  const loginWithGoogle = async () => {
    setError('');
    try {
      console.log('[AuthPanel] loginWithGoogle initiated.');
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider); // Firebase client auth
      console.log('[AuthPanel] Google sign-in successful:', result.user?.uid);
      const idToken = await result.user.getIdToken();
      console.log('[AuthPanel] ID token obtained, calling /api/auth/sessionLogin.');
      
      // Wait for session cookie to be set
      const sessionResponse = await fetch('/api/auth/sessionLogin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });
      console.log('[AuthPanel] /api/auth/sessionLogin call completed. Status:', sessionResponse.status);

      if (!sessionResponse.ok) {
        const errorData = await sessionResponse.json().catch(() => ({})); // Catch if res not json
        throw new Error(errorData.error || 'Failed to establish session with server.');
      }
      // Session is set, the useEffect listening to 'user' state will handle redirection.
    } catch (err: any) {
      console.error('[AuthPanel] Error in loginWithGoogle:', err);
      setError(err.message);
      // Optional: signOut(auth).catch(e => console.error("Firebase signout error after session fail", e));
    }
  };

  const handleAuth = async () => {
    setError('');
    try {
      console.log('[AuthPanel] handleAuth initiated. Mode:', mode);
      let userCredential;
      if (mode === 'login') {
        userCredential = await signInWithEmailAndPassword(auth, email, password);
      } else {
        userCredential = await createUserWithEmailAndPassword(auth, email, password);
      }
      console.log('[AuthPanel] Email/password auth successful:', userCredential.user?.uid);
      const idToken = await userCredential.user.getIdToken();
      console.log('[AuthPanel] ID token obtained, calling /api/auth/sessionLogin.');

      // Wait for session cookie to be set
      const sessionResponse = await fetch('/api/auth/sessionLogin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });
      console.log('[AuthPanel] /api/auth/sessionLogin call completed. Status:', sessionResponse.status);
      
      if (!sessionResponse.ok) {
        const errorData = await sessionResponse.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to establish session with server.');
      }
      // Session is set, the useEffect listening to 'user' state will handle redirection.
    } catch (err: any) {
      console.error('[AuthPanel] Error in handleAuth:', err);
      setError(err.message);
    }
  };

  useEffect(() => {
    const currentPathname = typeof window !== 'undefined' ? window.location.pathname : 'unknown';
    const currentSearchParams = typeof window !== 'undefined' ? window.location.search : 'unknown';
    console.log(`[AuthPanel at ${currentPathname}${currentSearchParams}] useEffect for user/redirect logic triggered. User state:`, user?.uid);

    if (user) { 
      const redirectQueryParam = searchParams.get('redirect');
      console.log(`[AuthPanel at ${currentPathname}${currentSearchParams}] User is authenticated. UID:`, user.uid);
      console.log(`[AuthPanel at ${currentPathname}${currentSearchParams}] Raw searchParams from useSearchParams():`, searchParams.toString());
      console.log(`[AuthPanel at ${currentPathname}${currentSearchParams}] Extracted 'redirect' query param:`, redirectQueryParam);
      
      let targetRedirectPath = "/"; // Default redirect path
      if (redirectQueryParam) {
        // Basic validation: ensure it's a relative path starting with /
        // and not an external URL or a malformed path.
        if (redirectQueryParam.startsWith("/") && !redirectQueryParam.startsWith("//") && !redirectQueryParam.includes(":")) {
          targetRedirectPath = redirectQueryParam;
          console.log(`[AuthPanel at ${currentPathname}${currentSearchParams}] Using redirectQueryParam for navigation:`, targetRedirectPath);
        } else {
          console.warn(`[AuthPanel at ${currentPathname}${currentSearchParams}] Invalid or potentially unsafe 'redirect' query param ignored:`, redirectQueryParam, "Defaulting to '/' .");
        }
      } else {
        console.log(`[AuthPanel at ${currentPathname}${currentSearchParams}] No 'redirect' query param found, will use default:`, targetRedirectPath);
      }

      console.log(`[AuthPanel at ${currentPathname}${currentSearchParams}] Calling router.replace with:`, targetRedirectPath);
      router.replace(targetRedirectPath);

    } else {
      console.log(`[AuthPanel at ${currentPathname}${currentSearchParams}] User is not authenticated (user state is falsy). No redirect action taken by this effect.`);
    }
  }, [user, router, searchParams]);

  const handleLogout = async () => {
    console.log('[AuthPanel] handleLogout initiated.');
    await signOut(auth);
    console.log('[AuthPanel] Firebase signOut completed.');
    await fetch('/api/auth/sessionLogout', { method: 'POST' });
    console.log('[AuthPanel] /api/auth/sessionLogout call completed.');
    window.location.reload();
  };

  return (
    <div className="max-w-sm mx-auto p-4 border rounded shadow space-y-4">
      {!user && (
        <>
          <h2 className="text-xl font-semibold text-center">
            {mode === 'login' ? 'Iniciar Sesión' : 'Crear Cuenta'}
          </h2>

          <input
            type="email"
            placeholder="Correo"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 py-2 border rounded"
          />
          <input
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2 border rounded"
          />
          {error && <p className="text-red-600 text-sm">{error}</p>}

          <button
            onClick={handleAuth}
            className="w-full bg-blue-600 text-white px-4 py-2 rounded"
          >
            {mode === 'login' ? 'Entrar' : 'Registrarse'}
          </button>

          <button
            onClick={loginWithGoogle}
            className="w-full bg-gray-800 text-white px-4 py-2 rounded"
          >
            Entrar con Google
          </button>

          <p className="text-sm text-center">
            {mode === 'login' ? '¿No tienes cuenta?' : '¿Ya tienes cuenta?'}{' '}
            <button
              onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
              className="underline text-blue-600"
            >
              {mode === 'login' ? 'Regístrate' : 'Inicia sesión'}
            </button>
          </p>
        </>
      )}
      {user && (
        <div className="text-center">
            <p>Welcome, {user.email}</p>
            <button 
                onClick={handleLogout} 
                className="mt-2 bg-red-500 text-white px-4 py-2 rounded"
            >
                Logout
            </button>
        </div>
      )}
    </div>
  );
}
