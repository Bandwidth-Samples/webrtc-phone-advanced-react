import React from "react";
import Button from "@mui/material/Button";
import myTheme from "../base/mytheme";
import { ThemeProvider } from "@mui/material/styles";
import { ClientStates } from "../base/localtypes";
import Alert from "@mui/material/Alert";
import { RtcStream } from "@bandwidth/webrtc-browser";

interface CallStatusProps {
  callState: ClientStates;
  remoteStream: RtcStream | undefined;
  message: string | undefined;
}

const CallStatus = (props: CallStatusProps) => {
  const { callState, remoteStream, message } = props;

  const buttonText = (): string => {
    const btext: string =
      callState === ClientStates.Disconnected
        ? "Disconnected"
        : callState === ClientStates.Incoming
        ? "Incoming Call"
        : callState === ClientStates.Talking
        ? "In a Call"
        : callState === ClientStates.Outgoing
        ? "Placing a Call"
        : "Idle";
    return btext;
  };

  return (
    <ThemeProvider theme={myTheme}>
      <Button variant="outlined" fullWidth disabled>
        {buttonText()}
      </Button>
      {message ? <Alert severity="info">{message}</Alert> : null}
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
