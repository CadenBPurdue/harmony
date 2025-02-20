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
    try {
      const status = await window.electronAPI.getAuthStatus();
      setIsAuthenticated(status.isGoogleAuthenticated);
      setIsLoading(false);

      // Set window mode based on authentication
      if (window.electronAPI.setWindowMode) {
        window.electronAPI.setWindowMode(!status.isGoogleAuthenticated);
      }
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

  return <RouterProvider router={createBrowserRouter(routes)} />;
};

// Create root and render
const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <Router />
  </React.StrictMode>,
);
