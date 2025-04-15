// src/renderer/main.jsx
import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom/client";
import { createHashRouter, RouterProvider, Navigate } from "react-router-dom";
import CreateAccount from "./CreateAccount";
import ErrorBoundary from "./ErrorBoundary";
import Homepage from "./Homepage";
import { NotificationProvider } from "./NotificationContext";

const Router = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [authStatus, setAuthStatus] = useState({
    isGoogleAuthenticated: false,
  });

  useEffect(() => {
    console.log("[Router] Initializing...");
    const checkAuthStatus = async () => {
      try {
        // Authenticate with Firebase, re-authenticating if necessary
        await window.electronAPI.connectFirebase();

        // Check authentication status
        const status = await window.electronAPI.getAuthStatus();
        console.log("[Router] Auth status received:", status);

        setAuthStatus(status);
        setIsLoading(false);

        // Set window size based on authentication
        if (window.electronAPI.setWindowMode) {
          await window.electronAPI.setWindowMode(!status.isGoogleAuthenticated);
          console.log(
            "[Router] Window mode set:",
            !status.isGoogleAuthenticated ? "login" : "app",
          );
        }
      } catch (err) {
        console.error("[Router] Failed to check auth status:", err);
        setIsLoading(false);
      }
    };

    checkAuthStatus();
  }, []);

  if (isLoading) {
    console.log("[Router] Rendering loading screen");
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900" />
      </div>
    );
  }

  console.log(
    "[Router] Creating routes with auth status:",
    authStatus.isGoogleAuthenticated &&
      (authStatus.isSpotifyAuthenticated || authStatus.isAppleAuthenticated),
  );
  const router = createHashRouter([
    {
      path: "/",
      element:
        authStatus.isGoogleAuthenticated &&
        (authStatus.isSpotifyAuthenticated ||
          authStatus.isAppleAuthenticated ||
          authStatus.isGoogleAuthenticated) ? (
          <Homepage />
        ) : (
          <Navigate to="/create-account" />
        ),
      errorElement: <ErrorBoundary />,
    },
    {
      path: "/create-account",
      element: <CreateAccount />,
      errorElement: <ErrorBoundary />,
    },
    {
      path: "/homepage",
      element: authStatus.isGoogleAuthenticated ? (
        <Homepage />
      ) : (
        <Navigate to="/create-account" />
      ),
      errorElement: <ErrorBoundary />,
    },
    {
      path: "*",
      element: <Navigate to="/" />,
    },
  ]);

  return (
    <NotificationProvider>
      <RouterProvider router={router} />
    </NotificationProvider>
  );
};

// Create root and render
const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<Router />);
