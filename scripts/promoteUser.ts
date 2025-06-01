#!/usr/bin/env tsx
import * as admin from "firebase-admin";
import * as readline from "readline";
import * as path from "path";

// 🔧 Configura las rutas a las credenciales por entorno
const CREDENTIALS = {
  dev: "./keys/smartstock-e8146-firebase-adminsdk-fbsvc-38e06d382c.json",
  prod: "./keys/shawinv-2c99a-firebase-adminsdk-fbsvc-c3209f0f19.json",
};

// 🔍 Detecta el entorno a partir de argumentos de línea de comando
const args = process.argv.slice(2);
const envArg = args.find((arg) => arg.startsWith("--env="));
const env = envArg?.split("=")[1];

if (!env || !["dev", "prod"].includes(env)) {
  console.error("❌ Debes especificar un entorno con --env=dev o --env=prod");
  process.exit(1);
}

const credentialPath = CREDENTIALS[env as "dev" | "prod"];

let serviceAccount;
try {
  serviceAccount = require(path.resolve(credentialPath));
} catch (error) {
  console.error(`❌ No se pudo cargar el archivo de credenciales en: ${credentialPath}`);
  process.exit(1);
}

// 🚀 Inicializa Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

console.log(`🌐 Entorno seleccionado: ${env}`);
console.log(`📁 Proyecto: ${serviceAccount.project_id}`);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.question("🔑 Ingresa el UID del usuario a promover a admin: ", async (uid) => {
  try {
    await admin.auth().setCustomUserClaims(uid.trim(), { role: "admin" });
    console.log(`✅ Usuario ${uid} ahora tiene el rol de admin en '${env}'.`);
  } catch (e) {
    console.error("❌ Error al asignar el rol:", e);
  } finally {
    rl.close();
    process.exit(0);
  }
});