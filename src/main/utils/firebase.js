import { initializeApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithCredential,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getGoogleToken, setGoogleToken, clearGoogleToken } from "./safe_storage.js";
import { initiateGoogleAuth } from "./auth_manager.js";

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

// Sign in using the Google token
async function authenticateWithFirebase() {
  let tokenData = getGoogleToken();
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
    if (error.code === "auth/invalid-credential") {
      console.log("[Firebase] Token expired or invalid, reinitiating authentication...");
      try {
        // Clear the existing Google token
        clearGoogleToken();

        // Reinitiate Google authentication
        const newTokenData = await initiateGoogleAuth();
        if (newTokenData && newTokenData.idToken) {
          // Store the new token
          await setGoogleToken(newTokenData);

          // Retry Firebase authentication with the new token
          const newCredential = GoogleAuthProvider.credential(newTokenData.idToken);
          const userCredential = await signInWithCredential(auth, newCredential);
          console.log("[Firebase] successfully authenticated after reinitiation:", userCredential.user);
          return userCredential;
        } else {
          throw new Error("Failed to obtain new Google token");
        }
      } catch (reinitiateError) {
        console.error("[Firebase] Reinitiation failed:", reinitiateError);
        throw reinitiateError;
      }
    } else {
      console.error("[Firebase] authentication failed:", error);
      throw error;
    }
  }
}

export { firebaseApp, authenticateWithFirebase };
