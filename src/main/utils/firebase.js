import path from "path";
import dotenv from "dotenv";
import { app } from "electron";
import { initializeApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithCredential,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { initiateGoogleAuth } from "./auth_manager.js";
import {
  getGoogleToken,
  setGoogleToken,
  clearGoogleToken,
} from "./safe_storage.js";

const isDev = process.env.NODE_ENV === 'development';

const envPath = isDev
  ? path.join(__dirname, '.env')                // In development, .env is at your project root
  : path.join(process.resourcesPath, '.env');     // In production, .env is in the resources folder

dotenv.config({ path: envPath });

function base64decode(base64) {
  if (process.env.NODE_ENV === "development") {
    return base64;
  }
  return Buffer.from(base64, "base64").toString("utf-8");
}

// Your Firebase config from Firebase Console
const firebaseConfig = {
  apiKey: base64decode(process.env.FIREBASE_API_KEY),
  authDomain: base64decode(process.env.FIREBASE_AUTH_DOMAIN),
  projectId: base64decode(process.env.FIREBASE_PROJECT_ID),
  storageBucket: base64decode(process.env.FIREBASE_STORAGE_BUCKET),
};

// Function to sign in to firebase using the Google token
async function authenticateWithFirebase() {
  const tokenData = getGoogleToken();
  if (!tokenData || !tokenData.idToken) {
    console.error("[Firebase] No authentication token found.");
    // Initiate Google authentication
    return await initiateGoogleAuth();
  }

  return await signInWithToken(tokenData.idToken);
}

async function reauthenticateWithFirebase() {
  try {
    // Clear the existing Google token
    clearGoogleToken();

    // Reinitiate Google authentication
    const newTokenData = await initiateGoogleAuth();
    if (newTokenData && newTokenData.idToken) {
      // Store the new token
      await setGoogleToken(newTokenData);

      // Retry Firebase authentication with the new token
      return await signInWithToken(newTokenData.idToken);
    } else {
      throw new Error("Failed to obtain new Google token");
    }
  } catch (reinitiateError) {
    console.error("[Firebase] Reinitiation failed:", reinitiateError);
    throw reinitiateError;
  }
}

async function signInWithToken(idToken) {
  const credential = GoogleAuthProvider.credential(idToken);

  try {
    // Initialize Firebase
    const firebaseApp = initializeApp(firebaseConfig);
    const auth = getAuth(firebaseApp);
    const db = getFirestore(firebaseApp);

    const userCredential = await signInWithCredential(auth, credential);
    console.log("[Firebase] successfully authenticated:", userCredential.user);
    return userCredential;
  } catch (error) {
    if (error.code === "auth/invalid-credential") {
      console.log(
        "[Firebase] Token expired or invalid, reinitiating authentication...",
      );
      return reauthenticateWithFirebase();
    } else {
      console.error("[Firebase] authentication failed:", error);
      throw error;
    }
  }
}

export { authenticateWithFirebase };
