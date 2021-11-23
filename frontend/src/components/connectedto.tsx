import React, { useState, useEffect } from "react";
import TextField from "@mui/material/TextField";
import Phone from "@mui/icons-material/Phone";
import CallMade from "@mui/icons-material/CallMade";
import CallReceived from "@mui/icons-material/CallReceived";
import PhoneInTalk from "@mui/icons-material/PhoneInTalk";
import myTheme from "../base/mytheme";
import { tnValid } from "../base/utils";
import { ThemeProvider, Theme } from "@mui/material/styles";
import { makeStyles, createStyles } from "@mui/styles";
import { ClientStates } from "../base/localtypes";

const useStyles: any = makeStyles((theme: Theme) =>
  createStyles({
    wideIcon: { transform: "scale(1.5)", width: 100 },
    narrowIcon: { transform: "scale(1.5)", width: 50 },
    tnEntryField: { flexGrow: 2 },
    connectedToContainer: {
      display: "flex",
      alignItems: "center",
      justifyContent: "flex-start",
      color: "blue",
    },
  })
);

interface ConnectedToProps {
  callState: ClientStates;
  phoneNumber: string;
  updateTn(tn: string, update: boolean): void;
}

const ConnectedTo = (props: ConnectedToProps) => {
  const [tn, setTn] = useState(props.phoneNumber);
  const [looksBad, setLooksBad] = useState<boolean>(tnValid(props?.phoneNumber));

  const classes = useStyles();

  useEffect(() => {
    if (props.phoneNumber !== tn) {
      setTn(props.phoneNumber);
      setLooksBad(!tnValid(props.phoneNumber));
    }
  }, [tn, props.phoneNumber]);

  /**
   * pick the phone and arrow Icons that are displayed beside the dialed TN field
   * based on the client state.
   *
   * note - establishing a className replacement for the sx= was too hard for my limited
   * understanding of mui.  I reverted to in-line updates.
   */
  const chooseAndDisplayIcons = () => {
    if (props.callState === ClientStates.IdleValid || props.callState === ClientStates.IdleInvalid) {
      return (
        <React.Fragment>
          <Phone sx={{ transform: "scale(1.5)", width: 100 }} />
        </React.Fragment>
      );
    } else if (props.callState === ClientStates.Incoming) {
      return (
        <React.Fragment>
          <Phone sx={{ transform: "scale(1.5)", width: 50 }} />
          <CallReceived sx={{ transform: "scale(1.5)", width: 50 }} />
        </React.Fragment>
      );
    } else if (props.callState === ClientStates.Outgoing) {
      return (
        <React.Fragment>
          <Phone sx={{ transform: "scale(1.5)", width: 50 }} />
          <CallMade sx={{ transform: "scale(1.5)", width: 50 }} />
        </React.Fragment>
      );
    } else if (props.callState === ClientStates.Talking) {
      return (
        <React.Fragment>
          <PhoneInTalk sx={{ transform: "scale(1.5)", width: 100 }} />
        </React.Fragment>
      );
    }
    return null;
  };

  const updateTn = (element: React.ChangeEvent<HTMLInputElement>) => {
    const tnCandidate = element.target.value;
    setTn(tnCandidate);
    setLooksBad(!tnValid(tnCandidate));
    props.updateTn(tnCandidate, false);
  };

  // TODO remove the commented stuff below when tested.
  return (
    <ThemeProvider theme={myTheme}>
      <div>
        <div className={classes.connectedToContainer}>
          {chooseAndDisplayIcons()}
          <TextField
            className={classes.tnEntryField}
            id={`callout-number`}
            label="Number to Call"
            variant="standard"
            error={looksBad}
            focused={tn !== undefined}
            value={tn}
            onChange={updateTn}
            color={tn ? "primary" : "error"}
          />
        </div>
      </div>
    </ThemeProvider>
  );
};

export default ConnectedTo;
