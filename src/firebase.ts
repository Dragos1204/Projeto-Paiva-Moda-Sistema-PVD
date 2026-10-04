import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Configuração fornecida do projeto Firebase 'paiva-moda'
export const firebaseConfig = {
  apiKey: "AIzaSyCoKpInECL4fI4q02BNWAURCmP0ihKVhbc",
  authDomain: "paiva-moda.firebaseapp.com",
  projectId: "paiva-moda",
  storageBucket: "paiva-moda.firebasestorage.app",
  messagingSenderId: "209253927060",
  appId: "1:209253927060:web:fdb22bde1fe39608154c81"
};

// Inicialização segura do Firebase App
export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Configuração resiliente do Cloud Firestore com Long Polling forçado para evitar travamentos em redes móveis e iframes
export const firestore = initializeFirestore(app, {
  experimentalForceLongPolling: true,
});

// Instância do Firebase Storage
export const storage = getStorage(app);

export default firestore;
