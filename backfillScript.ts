// backfillScript.ts
// Este es un script para ejecutar con ts-node en un entorno de servidor
// que tenga acceso de administrador a Firebase.

// Cargamos las variables de entorno según el entorno especificado
const env = process.argv[2] || 'development';
const dotenvPath = `./.env.${env}`;

console.log(`Cargando configuración para entorno: ${env} desde ${dotenvPath}`);
require('dotenv').config({ path: dotenvPath });

// Importamos la instancia 'db' desde tu archivo de configuración de Firebase Admin.
import { db } from './src/lib/firebaseAdmin';

async function backfillNormalizedNames() {
  console.log("Starting backfill process for normalized names...");

  const inventoryRef = db.collection('inventory');
  const snapshot = await inventoryRef.get();

  if (snapshot.empty) {
    console.log("No items found in inventory.");
    return;
  }

  const batch = db.batch();
  let count = 0;

  snapshot.forEach(doc => {
    const data = doc.data();
    // Verificamos si el campo 'normalizedName' no existe y si 'name' sí existe.
    if (data.name && typeof data.name === 'string' && !data.normalizedName) {
      const normalizedName = data.name.trim().toLowerCase();
      batch.update(doc.ref, { normalizedName: normalizedName });
      count++;
      console.log(`Scheduling update for doc ${doc.id}: '${data.name}' -> '${normalizedName}'`);
    }
  });

  if (count > 0) {
    await batch.commit();
    console.log(`Successfully updated ${count} items.`);
  } else {
    console.log("No items needed updating. All items seem to have a 'normalizedName'.");
  }
}

backfillNormalizedNames()
  .then(() => {
    console.log("Script finished successfully.");
    // En algunos entornos, el script puede quedarse colgado. Si eso pasa,
    // puedes forzar la salida descomentando la siguiente línea:
    // process.exit(0);
  })
  .catch(error => {
    console.error("An error occurred during the backfill process:", error);
    // process.exit(1);
  });