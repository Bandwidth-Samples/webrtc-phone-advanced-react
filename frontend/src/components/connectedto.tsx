import React, { useState, useEffect } from "react";
import TextField from "@mui/material/TextField";
import Phone from "@mui/icons-material/Phone";
import CallMade from "@mui/icons-material/CallMade";
import CallReceived from "@mui/icons-material/CallReceived";
import PhoneInTalk from "@mui/icons-material/PhoneInTalk";
import myTheme from "../base/mytheme";
import { tnValid } from "../base/utils";
import { ThemeProvider } from "@mui/material/styles";
import { ClientStates } from "../base/localtypes";

const ConnectedTo = (props: any) => {
  const [tn, setTn] = useState(props.phoneNumber);
  const [looksBad, setLooksBad] = useState<boolean>(tnValid(props?.phoneNumber));

  useEffect(() => {
    if (props.phoneNumber !== tn) {
      setTn(props.phoneNumber);
      setLooksBad(!tnValid(props.phoneNumber));
    }
  }, [tn, props.phoneNumber]);

  const updateTn = (element: React.ChangeEvent<HTMLInputElement>) => {
    const tnCandidate = element.target.value;
    setTn(tnCandidate);
    setLooksBad(!tnValid(tnCandidate));
    props.updateTn(tnCandidate, false);
  };

  return (
    <ThemeProvider theme={myTheme}>
      <div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-start",
            color: "blue",
          }}
        >
          {(props.callState === ClientStates.IdleValid || props.callState === ClientStates.IdleInvalid) && (
            <React.Fragment>
              <Phone sx={{ transform: "scale(1.5)", width: 100 }} />
            </React.Fragment>
          )}
          {props.callState === ClientStates.Incoming && (
            <React.Fragment>
              <Phone sx={{ transform: "scale(1.5)", width: 50 }} />
              <CallReceived sx={{ transform: "scale(1.5)", width: 50 }} />
            </React.Fragment>
          )}
          {props.callState === ClientStates.Outgoing && (
            <React.Fragment>
              <Phone sx={{ transform: "scale(1.5)", width: 50 }} />
              <CallMade sx={{ transform: "scale(1.5)", width: 50 }} />
            </React.Fragment>
          )}
          {props.callState === ClientStates.Talking && (
            <React.Fragment>
              <PhoneInTalk sx={{ transform: "scale(1.5)", width: 100 }} />
            </React.Fragment>
          )}
          <TextField
            sx={{ flexGrow: 2 }}
            id={`callout-number`}
            label="Number to Call"
            variant="standard"
            error={looksBad}
            focused={tn !== undefined}
            value={tn}
            onChange={updateTn}
            color={tn ? "primary" : "error"}
            //   InputLabelProps={{
            //     shrink: false,
            //   }}
          />
        </div>
      </div>
    </ThemeProvider>
  );
};

export default ConnectedTo;
