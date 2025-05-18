#!/usr/bin/env node
"use strict";
var dotenv = require("dotenv");
var path = require("path");
var admin = require("firebase-admin");
var readline = require("readline");

// Cargar .env por ambiente: node setAdminRole.js dev  o  node setAdminRole.js prod
var env = process.argv[2] || "dev";
const envFilePath = path.resolve(__dirname, "../.env." + env);
console.log(`Attempting to load .env file from: ${envFilePath}`); // Debug log
dotenv.config({ path: envFilePath });

// Debug log to check if FIREBASE_PROJECT_ID is loaded
console.log(`FIREBASE_PROJECT_ID from env: ${process.env.FIREBASE_PROJECT_ID}`);

var serviceAccount = {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
};

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
});

var rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});
rl.question("Enter UID to promote to admin: ", function (uid) {
    (function () {
        return new Promise(function (resolve, reject) {
            (function step(gen) {
                try {
                    var next = gen.next();
                    if (next.done) resolve(next.value);
                    else Promise.resolve(next.value).then(function (v) { step(gen); }, function (e) { gen.throw(e); });
                } catch (e) { reject(e); }
            })(function* () {
                try {
                    yield admin.auth().setCustomUserClaims(uid.trim(), { role: "admin" });
                    console.log("\u2705 User ".concat(uid, " is now an admin."));
                } catch (e_1) {
                    console.error("❌ Failed:", e_1);
                } finally {
                    rl.close();
                    process.exit(0);
                }
            }());
        });
    })();
});
