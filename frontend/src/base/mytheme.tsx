import { createTheme } from "@mui/material/styles";

const myTheme = createTheme({
  palette: {
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
});

export default myTheme;
