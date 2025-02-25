// src/main/utils/firebase.js
import path from "path";
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

const isDev = process.env.NODE_ENV === "development";

const envPath = isDev
  ? ".dev.env" // In development, use .dev.env at your project root
  : process.env.NODE_ENV === "test_build"
    ? ".env" // In test_build, .env is at your project root
    : path.join(process.resourcesPath, ".env"); // In production, .env is in the resources folder

dotenv.config({ path: envPath });

// In base64decode function
function base64decode(base64) {
  if (!base64) {
    console.log("[base64decode] Empty or undefined input");
    return null;
  }

  console.log(`[base64decode] Decoding value with length: ${base64.length}`);

  try {
    // In development, just return the raw value
    if (isDev) {
      return base64;
    }

    // For production/test, properly decode
    let decoded;
    try {
      decoded = Buffer.from(base64, "base64").toString("utf-8");
      // Trim whitespace and newlines
      decoded = decoded.trim();
      console.log(`[base64decode] Decoded to length: ${decoded.length}`);
      return decoded;
    } catch (error) {
      console.error("[base64decode] Error decoding:", error.message);
      // Fallback: try to return the original if it's not actually base64
      return base64;
    }
  } catch (error) {
    console.error("[base64decode] Unexpected error:", error.message);
    return null;
  }
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
  try {
    // Get the Google token and check if it's valid
    let tokenData = getGoogleToken();

    if (!tokenData || !tokenData.idToken) {
      console.log(
        "[Firebase] No authentication token found, initiating Google auth...",
      );
      // Initiate Google authentication
      const authResult = await initiateGoogleAuth();
      tokenData = getGoogleToken();

      if (!tokenData || !tokenData.idToken) {
        throw new Error("Failed to obtain Google token");
      }
    }

    // Try to authenticate with the token
    try {
      return await signInWithToken(tokenData.idToken);
    } catch (error) {
      // If token is too old or invalid, reinitiate Google auth
      if (error.code === "auth/invalid-credential") {
        console.log(
          "[Firebase] Token expired or invalid, reinitiating authentication...",
        );

        // Clear the existing Google token
        clearGoogleToken();

        // Get new token
        await initiateGoogleAuth();
        const newTokenData = getGoogleToken();

        if (!newTokenData || !newTokenData.idToken) {
          throw new Error("Failed to obtain new Google token");
        }

        return await signInWithToken(newTokenData.idToken);
      }

      console.error("[Firebase] Failed to authenticate with token:", error);
      throw error;
    }
  } catch (error) {
    console.error("[Firebase] Authentication failed:", error);
    throw error;
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
    console.error("[Firebase] Sign in with token failed:", error);
    throw error;
  }
}

export { authenticateWithFirebase };
