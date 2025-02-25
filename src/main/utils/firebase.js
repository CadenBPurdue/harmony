// src/main/utils/firebase.js
import path from "path";
import dotenv from "dotenv";
import { initializeApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithCredential,
} from "firebase/auth";
import { getFirestore, Timestamp } from "firebase/firestore";
import { initiateGoogleAuth } from "./auth_manager.js";
import {
  getUserFromFirestore,
  writeUserToFirestore,
} from "./firebaseHelper.js";
import { getGoogleToken, clearGoogleToken } from "./safe_storage.js";

const isDev = process.env.NODE_ENV === "development";

const envPath = isDev
  ? ".dev.env" // In development, .env is at your project root
  : path.join(process.resourcesPath, ".env"); // In production, .env is in the resources folder

dotenv.config({ path: envPath });

function base64decode(base64) {
  if (isDev) {
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
  try {
    // Get the Google token and check if it's valid
    let tokenData = getGoogleToken();

    if (!tokenData || !tokenData.idToken) {
      console.log(
        "[Firebase] No authentication token found, initiating Google auth...",
      );
      // Initiate Google authentication
      await initiateGoogleAuth();
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

      console.error("[Firebase] Failed to authenticate with token");
      throw error;
    }
  } catch (error) {
    console.error("[Firebase] Authentication failed");
    throw error;
  }
}

async function signInWithToken(idToken) {
  const credential = GoogleAuthProvider.credential(idToken);

  try {
    // Initialize Firebase
    const firebaseApp = initializeApp(firebaseConfig);
    const auth = getAuth(firebaseApp);

    const userCredential = await signInWithCredential(auth, credential);
    // console.log("[Firebase] successfully authenticated:", userCredential.user);
    console.log("[Firebase] successfully authenticated");

    // Update user data in Firestore
    await updateUserInFirestore(userCredential.user);

    return userCredential;
  } catch (error) {
    console.log("[Firebase] Sign in with token failed");
    throw error;
  }
}

async function updateUserInFirestore(user) {
  try {
    const existingUser = await getUserFromFirestore(user.uid);

    if (existingUser) {
      // User exists, update the last logged in timestamp
      const updatedUser = {
        ...existingUser,
        lastLoginAt: Timestamp.fromDate(new Date()),
      };
      await writeUserToFirestore(updatedUser);
      console.log(
        `[Firebase] Updated last login timestamp for user ${user.uid}`,
      );
    } else {
      // User does not exist, create the user
      const newUser = {
        userId: user.uid,
        displayName: user.displayName || "",
        email: user.email || "",
        profilePictureUrl: user.photoURL || "",
        createdAt: Timestamp.fromDate(new Date()),
        lastLoginAt: Timestamp.fromDate(new Date()),
        playlists: [],
        sharedPlaylists: [],
      };

      await writeUserToFirestore(newUser); // Pass the newUser object correctly
      console.log(`[Firebase] Created new user ${user.uid}`);
    }
  } catch (error) {
    console.error("[Firebase] Error updating user in Firestore:", error);
    throw error;
  }
}

function getDbInstance() {
  return getFirestore();
}

function getAuthInstance() {
  return getAuth();
}

export { authenticateWithFirebase, getDbInstance, getAuthInstance };
