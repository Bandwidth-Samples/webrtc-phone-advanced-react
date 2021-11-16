import React, { useState } from "react";
import Button from "@mui/material/Button";
import myTheme from "../base/mytheme";
import { ThemeProvider } from "@mui/material/styles";
import { ClientStates } from "../base/localtypes";

// const enum ClientStates {
//   IdleInvalid = "Idle - TN Invalid",
//   IdleValid = "Idle - TN Valid",
//   Incoming = "Receiving Call",
//   Outgoing = "Placing Call",
//   Talking = "Talking",
// }

const CallButton = (props: any) => {
  const [state, setState] = useState<ClientStates>(props.callState);
  if (state !== props.callState) setState(props.callState);
  return (
    <ThemeProvider theme={myTheme}>
      <Button variant="outlined" fullWidth onClick={props.onClick}>
        {state === ClientStates.IdleValid
          ? "Call"
          : state === ClientStates.Incoming
          ? "Answer"
          : state === ClientStates.Talking || state === ClientStates.Outgoing
          ? "Hang Up"
          : ". . ."}
      </Button>
    </ThemeProvider>
  );
};

export default CallButton;
