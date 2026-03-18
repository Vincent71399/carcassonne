import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getDatabase } from 'firebase/database';
import { getFirestore } from 'firebase/firestore';

// const firebaseConfig = {
//     apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
//     authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
//     projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
//     storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
//     messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
//     appId: import.meta.env.VITE_FIREBASE_APP_ID,
//     measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
//     databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
// };

const firebaseConfig = {
    apiKey: "AIzaSyAfKlXr7JSh-Cm4LclFqj8fM5W4jav10eA",
    authDomain: "carcassonne-3-tiles-hand.firebaseapp.com",
    projectId: "carcassonne-3-tiles-hand",
    storageBucket: "carcassonne-3-tiles-hand.firebasestorage.app",
    messagingSenderId: "905779615317",
    appId: "1:905779615317:web:cae333012c3d6da66726dc",
    measurementId: "G-C7NNEMV1ES",
    databaseURL: "https://carcassonne-3-tiles-hand-default-rtdb.firebaseio.com" // Constructing default RTDB URL based on projectId
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);
export const rtdb = getDatabase(app);
