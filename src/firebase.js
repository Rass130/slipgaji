import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// GANTI dengan config dari Firebase Console punya kamu sendiri:
// Firebase Console > Project Settings > General > Your apps > SDK setup and configuration
const firebaseConfig = {
  apiKey: "AIzaSyCYkes5Mo-MJkhcewZF0xGjtSZTRTfnH-I",
  authDomain: "slipgaji-f44ab.firebaseapp.com",
  projectId: "slipgaji-f44ab",
  storageBucket: "slipgaji-f44ab.firebasestorage.app",
  messagingSenderId: "222799155189",
  appId: "1:222799155189:web:2aacd240be4d867baf9abc",
  measurementId: "G-LSD7WVRCZB"
};


const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();
