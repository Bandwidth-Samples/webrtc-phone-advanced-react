import { useState } from "react";
import Button from "@mui/material/Button";
import myTheme from "../base/mytheme";
import { ThemeProvider } from "@mui/material/styles";
import { ClientStates } from "../base/localtypes";

interface CallButtonProps {
  callState: ClientStates;
  onClick(): void;
}

const CallButton = (props: CallButtonProps) => {
  const [state, setState] = useState<ClientStates>(props.callState);

  const buttonText = (): string => {
    const btext: string =
      state === ClientStates.IdleValid
        ? "Call"
        : state === ClientStates.Incoming
        ? "Answer"
        : state === ClientStates.Talking || state === ClientStates.Outgoing
        ? "Hang Up"
        : ". . .";
    return btext;
  };

  if (state !== props.callState) setState(props.callState);
  return (
    <ThemeProvider theme={myTheme}>
      <Button variant="outlined" fullWidth onClick={props.onClick}>
        {buttonText()}
      </Button>
    </ThemeProvider>
  );
};

export default CallButton;
