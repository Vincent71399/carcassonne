import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getDatabase } from 'firebase/database';
import { getFirestore } from 'firebase/firestore';

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
