import { readFileSync } from "fs";
import admin from "firebase-admin";

// Usamos URL para importar correctamente la ruta del serviceAccount
const serviceAccount = JSON.parse(
  readFileSync(new URL("./serviceAccount.json", import.meta.url), "utf-8")
);

// Inicializa Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

export const db = admin.firestore();
