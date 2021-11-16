import { createTheme } from "@mui/material/styles";

const myTheme = createTheme({
  palette: {
    // type: "dark",
    // mode: "light",
    background: {
      default: "#303031",
      paper: "#424242",
    },
  },
  typography: {
    fontFamily: "Overpass",
    button: {
      fontSize: "18pt",
    },
    fontSize: 18,
  },
  // components: {
  //   MuiButton: {
  //     styleOverrides: {
  //       root: {
  //         // fontSize: "2rem",
  //         color: "yellow",
  //       },
  //     },
  //   },
  // },
});

export default myTheme;
