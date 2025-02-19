// src/renderer/main.jsx
import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom/client";
import {
  createBrowserRouter,
  RouterProvider,
  Navigate,
} from "react-router-dom";
import App from "./App";
import CreateAccount from "./CreateAccount";

const Router = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    console.log("[Router] Checking auth status...");
    try {
      const status = await window.electronAPI.getAuthStatus();
      console.log(
        "[Router] Auth status details:",
        JSON.stringify(status, null, 2),
      );

      setIsAuthenticated(status.isGoogleAuthenticated);
      setIsLoading(false);

      console.log(
        "[Router] Updated authentication state to:",
        status.isGoogleAuthenticated,
      );
    } catch (err) {
      console.error("[Router] Failed to check auth status:", err);
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900" />
      </div>
    );
  }

  const routes = [
    {
      path: "/",
      element: isAuthenticated ? <App /> : <Navigate to="/create-account" />,
    },
    {
      path: "/create-account",
      element: <CreateAccount />,
    },
  ];

  console.log("[Router] Creating routes with auth state:", isAuthenticated);
  return <RouterProvider router={createBrowserRouter(routes)} />;
};

// Create root and render
const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <Router />
);
