import React from "react";
import Button from "@mui/material/Button";
import myTheme from "../base/mytheme";
import { ThemeProvider } from "@mui/material/styles";
import { ClientStates } from "../base/localtypes";
import Alert from "@mui/material/Alert";

const CallStatus = (props: any) => {
  const { callState, remoteStream } = props;
  return (
    <ThemeProvider theme={myTheme}>
      <Button variant="outlined" fullWidth disabled>
        {callState === ClientStates.Disconnected
          ? "Disconnected"
          : callState === ClientStates.Incoming
          ? "Incoming Call"
          : callState === ClientStates.Talking
          ? "In a Call"
          : callState === ClientStates.Outgoing
          ? "Placing a Call"
          : "Idle"}
      </Button>
      {props.message ? <Alert severity="info">{props.message}</Alert> : null}
      <video
        playsInline
        autoPlay
        style={{ display: "none" }}
        ref={(videoElement) => {
          if (videoElement && remoteStream && videoElement.srcObject !== remoteStream.mediaStream) {
            // Set the video element's source object to the WebRTC MediaStream
            videoElement.srcObject = remoteStream.mediaStream;
          }
        }}
      ></video>
    </ThemeProvider>
  );
};

export default CallStatus;
