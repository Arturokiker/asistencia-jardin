// js/firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Tus credenciales reales vinculadas
export const firebaseConfig = {
  apiKey: "AIzaSyCFBrFwnOPVRzfJW-kSkOUfRyv55mw1LVU",
  authDomain: "asistencia-reuniones-final.firebaseapp.com",
  projectId: "asistencia-reuniones-final",
  storageBucket: "asistencia-reuniones-final.firebasestorage.app",
  messagingSenderId: "430000122597",
  appId: "1:430000122597:web:1ba68fae5124a5220a420c"
};

let appInstance = null;
let dbInstance = null;
let isConfigured = false;

try {
  appInstance = initializeApp(firebaseConfig);
  dbInstance = initializeFirestore(appInstance, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager()
    })
  });
  isConfigured = true;
  console.log("Firestore conectado con soporte multi-pestaña e IndexedDB.");
} catch (err) {
  console.warn("Error conectando a Firebase. Operando en modo local:", err);
}

export const db = dbInstance;
export const isOnlineDB = isConfigured;
export const CONGREGATION_ID = "jardin-los-palmitos";
