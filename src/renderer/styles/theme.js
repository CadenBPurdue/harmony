// src/renderer/styles/theme.js
import { createTheme } from "@mui/material";

// Color palette
const colors = {
  jet: "#3e3847ff",
  amethyst: "#8661c1ff",
  lavenderFloral: "#c391f5ff",
  periwinkle: "#e2cdffff",
  magnolia: "#f3eefcff",
};

// Create the theme with your color palette
const theme = createTheme({
  palette: {
    primary: {
      main: colors.amethyst,
      dark: "#7252b2",
      light: "#9a7acd",
    },
    secondary: {
      main: colors.lavenderFloral,
      dark: "#b682e6",
      light: "#d0a5f7",
    },
    background: {
      default: colors.magnolia,
      paper: "#ffffff",
    },
    text: {
      primary: colors.jet,
      secondary: "#574f63",
    },
    success: {
      main: "#60a361",
      dark: "#4e8c4f",
    },
    error: {
      main: "#d32f2f",
    },
    // Export the raw colors as well for custom usage
    custom: colors,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          textTransform: "none",
          fontWeight: 600,
          maxWidth: "100%",
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 12,
        },
      },
    },
    MuiDivider: {
      styleOverrides: {
        root: {
          "&::before, &::after": {
            borderColor: "rgba(134, 97, 193, 0.2)",
          },
        },
      },
    },
  },
  typography: {
    h3: {
      fontWeight: 700,
    },
    h6: {
      fontWeight: 400,
    },
  },
});

// Custom styles for specific components
const styles = {
  pageContainer: {
    width: "100%",
    minHeight: "100vh",
    backgroundColor: colors.magnolia,
    display: "flex",
    flexDirection: "column",
    padding: { xs: 2, sm: 4 },
  },
  contentContainer: {
    maxWidth: "1200px",
    width: "100%",
    marginLeft: "auto",
    marginRight: "auto",
  },
  headerContainer: {
    marginBottom: 4,
  },
  paper: {
    padding: { xs: 3, sm: 4 },
    backgroundColor: "white",
    width: "100%",
    boxShadow: "0 8px 24px rgba(134, 97, 193, 0.12)",
  },
  alert: {
    borderRadius: 2,
  },
  googleButton: (isConnected) => ({
    py: 1.5,
    width: "100%",
    maxWidth: "100%",
    backgroundColor: isConnected ? colors.periwinkle : "primary.main",
    "&:hover": {
      backgroundColor: isConnected ? "#d4b9f7" : "primary.dark",
    },
    "&:disabled": {
      backgroundColor: "rgba(134, 97, 193, 0.5)",
    },
  }),
  musicServiceButton: (isConnected, darkColor, service) => ({
    flex: 1,
    py: 1.5,
    maxWidth: "100%",
    backgroundColor: isConnected
      ? service === "spotify"
        ? "#1db954"
        : "#fc3c44"
      : darkColor,
    "&:hover": {
      backgroundColor: isConnected
        ? service === "spotify"
          ? "#1aa34a"
          : "#e0363e"
        : "#333333",
    },
    "&:disabled": {
      backgroundColor: `rgba(${darkColor === "#000000" ? "0, 0, 0" : "25, 20, 20"}, 0.5)`,
    },
  }),
  continueButton: {
    marginTop: 3,
    py: 1.5,
    backgroundColor: "secondary.main",
    "&:hover": {
      backgroundColor: "secondary.dark",
    },
    maxWidth: "100%",
  },
  loadingContainer: {
    display: "flex",
    justifyContent: "center",
    marginTop: 3,
  },
  divider: {
    my: 3,
  },
  dividerText: {
    color: "text.secondary",
    px: 2,
  },
  serviceButtonsContainer: {
    width: "100%",
    flexDirection: { xs: "column", sm: "row" },
    gap: { xs: 3, sm: 4 },
  },
};

export { theme, styles, colors };
