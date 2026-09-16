// Configuración Modular Firebase v10 con persistencia offline IndexedDB
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Pega aquí las credenciales de tu consola de Firebase
export const firebaseConfig = {
  apiKey: "TU_API_KEY_FIREBASE",
  authDomain: "asistencia-jardin.firebaseapp.com",
  projectId: "asistencia-jardin",
  storageBucket: "asistencia-jardin.appspot.com",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abcdef123456"
};

let appInstance = null;
let dbInstance = null;
let isConfigured = false;

if (firebaseConfig.apiKey && firebaseConfig.apiKey !== "TU_API_KEY_FIREBASE") {
  try {
    appInstance = initializeApp(firebaseConfig);
    dbInstance = initializeFirestore(appInstance, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager()
      })
    });
    isConfigured = true;
    console.log("Firestore conectado con soporte multi-pestaña IndexedDB.");
  } catch (err) {
    console.warn("Error inicializando Firebase. Activando modo local autónomo:", err);
  }
} else {
  console.info("Modo Offline / LocalStorage activo (configura Firebase en js/firebase-config.js).");
}

export const db = dbInstance;
export const isOnlineDB = isConfigured;
export const CONGREGATION_ID = "jardin-los-palmitos";
