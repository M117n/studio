#!/usr/bin/env node
import * as admin from "firebase-admin";
import * as readline from "readline";

admin.initializeApp({
  credential: admin.credential.applicationDefault(),
});

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.question("Enter UID to promote to admin: ", async (uid) => {
  try {
    await admin.auth().setCustomUserClaims(uid.trim(), { role: "admin" });
    console.log(`✅ User ${uid} is now an admin.`);
  } catch (e) {
    console.error("❌ Failed:", e);
  } finally {
    rl.close();
    process.exit(0);
  }
});