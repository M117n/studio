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

export function AuthPanel() {
  const [user, setUser] = useState(auth.currentUser);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [error, setError] = useState('');

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(setUser);
    return () => unsubscribe();
  }, []);

  const loginWithGoogle = async () => {
    setError('');
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleAuth = async () => {
    setError('');
    try {
      if (mode === 'login') {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
  };

  return (
    <div className="max-w-sm mx-auto p-4 border rounded shadow space-y-4">
      {user ? (
        <div className="space-y-2">
          <p>Bienvenido, {user.email || user.displayName}</p>
          <button onClick={handleLogout} className="bg-red-500 text-white px-4 py-2 rounded">
            Logout
          </button>
        </div>
      ) : (
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
    </div>
  );
}
