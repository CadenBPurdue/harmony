import dotenv from "dotenv";
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

dotenv.config({
  path: app.isPackaged
      ? path.join(process.resourcesPath, '.env')
      : path.resolve(process.cwd(), '.env'),
})

// Your Firebase config from Firebase Console
const decodeIfProduction = (value) =>
  process.env.NODE_ENV === "production"
    ? Buffer.from(value, "base64").toString("utf8")
    : value;

const firebaseConfig = {
  apiKey: decodeIfProduction(process.env.FIREBASE_API_KEY),
  authDomain: decodeIfProduction(process.env.FIREBASE_AUTH_DOMAIN),
  projectId: decodeIfProduction(process.env.FIREBASE_PROJECT_ID),
  storageBucket: decodeIfProduction(process.env.FIREBASE_STORAGE_BUCKET),
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
