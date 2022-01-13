import TextField from "@mui/material/TextField";
import myTheme from "../base/mytheme";

import { ClientStates } from "../base/localtypes";
import { ThemeProvider, Theme } from "@mui/material/styles";
import { makeStyles, createStyles } from "@mui/styles";

const useStyles: any = makeStyles((theme: Theme) =>
  createStyles({
    tnsContainer: {
      display: "flex",
      alignItems: "center",
      justifyContent: "flex-start",
      color: "blue",
    },
  })
);

const Tns = (props: any) => {
  const classes = useStyles();

  return (
    <ThemeProvider theme={myTheme}>
      <div>
        <div className={classes.tnsContainer}>
          <TextField
            id={`my-number`}
            label="My TN"
            variant="outlined"
            focused={true}
            value={props.myTn ? props.myTn.slice(-10) : ""}
            color="primary"
          />
          <TextField
            id={`far-end-number`}
            label="The other end's number"
            variant="outlined"
            focused={true}
            value={
              (props.callState === ClientStates.Talking || props.callState === ClientStates.Incoming) &&
              props.otherEndTn
                ? props.otherEndTn.slice(-10)
                : ""
            }
            color="primary"
          />
        </div>
      </div>
    </ThemeProvider>
  );
};

export default Tns;
