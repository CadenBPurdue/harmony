import { initializeApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithCredential,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getGoogleToken } from "./safe_storage.js";

// Your Firebase config from Firebase Console
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
};

// Initialize Firebase
const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);

// Sign in using the google
async function authenticateWithFirebase() {
  const tokenData = getGoogleToken();
  if (!tokenData || !tokenData.idToken) {
    console.error("[Firebase] No authentication token found.");
    return;
  }
  const idToken = tokenData.idToken;

  const credential = GoogleAuthProvider.credential(idToken);

  try {
    const userCredential = await signInWithCredential(auth, credential);
    console.log("[Firebase] successfully authenticated:", userCredential.user);
    return userCredential;
  } catch (error) {
    console.error("[Firebase] authentication failed:", error);
    throw error;
  }
}

export { firebaseApp, authenticateWithFirebase };
