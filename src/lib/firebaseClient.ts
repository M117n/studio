import { initializeApp, getApps, deleteApp } from "firebase/app";
import { getAuth } from "firebase/auth";

// Detectar el entorno usando NODE_ENV (método estándar de Next.js)
const isProd = process.env.NODE_ENV === "production";
console.log(`Firebase environment: ${isProd ? "PRODUCTION" : "DEVELOPMENT"}`);

// Configuración específica para producción para asegurar el uso del proyecto correcto
export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Log para depuración
console.log(`Using Firebase project: ${firebaseConfig.projectId}`);

// Cerrar cualquier instancia previa
if (getApps().length > 0) {
  console.log("Cerrando instancias previas de Firebase");
  getApps().forEach(app => deleteApp(app));
}

// Inicializar con la nueva configuración
const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);