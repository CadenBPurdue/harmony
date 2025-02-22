// src/renderer/ErrorBoundary.jsx
import { Box, Typography, Button, Paper } from "@mui/material";
import React from "react";
import { useRouteError } from "react-router-dom";
import { styles } from "./styles/theme";

export default function ErrorBoundary() {
  const error = useRouteError();
  console.error("[ErrorBoundary] Caught error:", error);

  return (
    <Box sx={styles.pageContainer}>
      <Box sx={styles.contentContainer}>
        <Paper elevation={3} sx={{ ...styles.paper, textAlign: "center" }}>
          <Typography variant="h4" sx={{ color: "primary.main", mb: 2 }}>
            Oops! Something went wrong
          </Typography>

          <Typography variant="body1" sx={{ mb: 3 }}>
            {error.statusText ||
              error.message ||
              "An unexpected error occurred"}
          </Typography>

          <Button
            variant="contained"
            color="primary"
            onClick={() => (window.location.href = "#/")} // Use hash routing
          >
            Return to Home
          </Button>
        </Paper>
      </Box>
    </Box>
  );
}
