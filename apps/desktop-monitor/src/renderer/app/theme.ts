import { createTheme } from "@mui/material/styles";

export const appTheme = createTheme({
  palette: {
    mode: "light",
    primary: { main: "#3a6b35" },
    secondary: { main: "#5a9a52" },
    background: { default: "#f7f5f0", paper: "#ffffff" },
    divider: "rgba(0,0,0,0.1)",
  },
  shape: { borderRadius: 12 },
  typography: {
    fontFamily: "'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    h4: { fontWeight: 600 },
    h6: { fontWeight: 600 },
  },
  components: {
    MuiPaper: {
      styleOverrides: { root: { backgroundImage: "none" } },
    },
  },
});
