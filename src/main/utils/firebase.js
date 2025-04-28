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
  getCurrentUserFromFirestore,
} from "./firebaseHelper.js";
import { getGoogleToken, clearGoogleToken } from "./safe_storage.js";

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
      const newUser = getNewUser(user);

      await writeUserToFirestore(newUser); // Pass the newUser object correctly
      console.log(`[Firebase] Created new user ${user.uid}`);
    }
  } catch (error) {
    console.error("[Firebase] Error updating user in Firestore:", error);
    throw error;
  }
}

async function updateConnectedServices(service) {
  try {
    const user = await getCurrentUserFromFirestore();
    if (!user) {
      console.error("[Firebase] User is not authenticated");
      return;
    }

    var spotifyConnected = user.connectedServices.spotify;
    var appleMusicConnected = user.connectedServices.appleMusic;
    if (service == "appleMusic") {
      appleMusicConnected = true;
    } else if (service == "spotify") {
      spotifyConnected = true;
    }

    if (user) {
      // User exists, update the last logged in timestamp
      const updatedUser = {
        ...user,
        connectedServices: {
          appleMusic: appleMusicConnected,
          spotify: spotifyConnected,
        },
      };
      await writeUserToFirestore(updatedUser);
      console.log(`[Firebase] Updated connected services for user ${user.uid}`);
    } else {
      // User does not exist, create the user
      const newUser = getNewUser(user);

      await writeUserToFirestore(newUser); // Pass the newUser object correctly
      console.log(`[Firebase] Created new user ${user.uid}`);
    }
  } catch (error) {
    console.error("[Firebase] Error updating user in Firestore:", error);
    throw error;
  }
}

async function updatePrimaryService(service) {
  try {
    const user = await getCurrentUserFromFirestore();
    if (!user) {
      console.error("[Firebase] User is not authenticated");
      return;
    }

    if (user) {
      // User exists, update the last logged in timestamp
      const updatedUser = {
        ...user,
        primaryService: service,
      };
      await writeUserToFirestore(updatedUser);
      console.log(`[Firebase] Updated primary service for user ${user.uid}`);
    } else {
      // User does not exist, create the user
      const newUser = getNewUser(user);

      await writeUserToFirestore(newUser); // Pass the newUser object correctly
      console.log(`[Firebase] Created new user ${user.uid}`);
    }
  } catch (error) {
    console.error("[Firebase] Error updating user in Firestore:", error);
    throw error;
  }
}

async function updateFriendsList(friendId, remove = false) {
  try {
    const user = getAuthInstance().currentUser;
    if (!user) {
      console.error("[Firebase] User is not authenticated");
      return;
    }

    const existingUser = await getUserFromFirestore(user.uid);
    if (!existingUser) {
      console.error("[Firebase] User does not exist in Firestore");
      return;
    }

    if (remove) {
      // Remove friendId from friends list
      var friendsList = existingUser.friends.filter(
        (friend) => friend !== friendId,
      );
    } else {
      // Add friendId to friends list
      var friendsList = existingUser.friends;
      if (!friendsList.includes(friendId)) {
        friendsList.push(friendId);
      }
    }

    const updatedUser = {
      ...existingUser,
      friends: friendsList,
    };

    await writeUserToFirestore(updatedUser);
    console.log(`[Firebase] Updated friends list for user ${user.uid}`);
  } catch (error) {
    console.error("[Firebase] Error updating friends list:", error);
    throw error;
  }
}

function getNewUser(user) {
  return {
    userId: user?.uid || "unknown",
    displayName: user?.displayName || "Unnamed User",
    email: user?.email || "no-email@example.com",
    createdAt: Timestamp.fromDate(new Date()),
    lastLoginAt: Timestamp.fromDate(new Date()),
    connectedServices: {
      appleMusic: false,
      spotify: false,
    },
    friends: [],
    incomingFriendRequests: [],
    primaryService: "",
  };
}

function getDbInstance() {
  return getFirestore();
}

function getAuthInstance() {
  return getAuth();
}

export {
  authenticateWithFirebase,
  getDbInstance,
  getAuthInstance,
  updateConnectedServices,
  updateFriendsList,
  updateUserInFirestore,
  updatePrimaryService,
};
