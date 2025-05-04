#!/usr/bin/env node
import { initializeApp, credential, auth } from "firebase-admin";
import * as readline from "readline";

initializeApp({
  credential: credential.applicationDefault(),
});

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.question("Enter UID to promote to admin: ", async (uid) => {
  try {
    await auth().setCustomUserClaims(uid.trim(), { role: "admin" });
    console.log(`✅ User ${uid} is now an admin.`);
  } catch (e) {
    console.error("❌ Failed:", e);
  } finally {
    rl.close();
    process.exit(0);
  }
});