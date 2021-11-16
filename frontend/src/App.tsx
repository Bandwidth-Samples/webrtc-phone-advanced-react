import React, { useState, useEffect, useRef } from "react";
import { w3cwebsocket as W3CWebSocket } from "websocket";
import BandwidthRtc, { RtcStream } from "@bandwidth/webrtc-browser";

import Box from "@mui/material/Box";
import { ThemeProvider } from "@mui/styles";

import Keypad from "./components/keypad";
import ConnectedTo from "./components/connectedto";
import CallButton from "./components/callbutton";
import CallStatus from "./components/callstatus";
import Tns from "./components/tns";

import { ClientStates, ClientEvents, ClientEvent } from "./base/localtypes";
import { tnValid, updateState } from "./base/utils";

import "./App.css";
import myTheme from "./base/mytheme";

const client = new W3CWebSocket(`ws://${window.location.hostname.toString()}:8001`);
const bandwidthRtc = new BandwidthRtc();

function App() {
  const [clientState, setClientState] = useState<ClientStates>(ClientStates.Disconnected);
  const [myTn, setMyTn] = useState<string>();
  const [tnToDial, setTnToDial] = useState<string>("");
  const [farEndTn, setFarEndTn] = useState<string>("");
  const [dtmfIt, setDtmfIt] = useState<boolean>(false);
  const [token, setToken] = useState<string>();
  const [ws, setWs] = useState<W3CWebSocket>();
  const [infoMessage, setInfoMessage] = useState<string>();

  // This state variable holds the remote stream object - the audio from the far end
  const [remoteStream, setRemoteStream] = useState<RtcStream>();

  const runningTimer = useRef<any>(0);
  const ringing = useRef<any>(new Audio("ringing.mp3"));

  const connectToSession = (token: string | undefined) => {
    if (token) {
      // Connect to Bandwidth WebRTC
      bandwidthRtc.connect({ deviceToken: token }).then(async () => {
        console.log("connected to bandwidth webrtc!");
        // Publish the browser's microphone
        await bandwidthRtc.publish(
          {
            audio: true,
            video: false,
          },
          undefined,
          "usermedia"
        );
        console.log("browser mic is streaming");
      });
    }
  };

  const createStreamListeners = () => {
    // This event will fire any time a new stream is sent to us
    bandwidthRtc.onStreamAvailable((rtcStream: RtcStream) => {
      console.log("receiving audio!");
      setRemoteStream(rtcStream);
    });

    // This event will fire any time a stream is no longer being sent to us
    bandwidthRtc.onStreamUnavailable((endpointId: string) => {
      console.log("no longer receiving audio");
      setRemoteStream(undefined);
    });
  };

  const dumpClientStateValues = (
    header: string,
    clientState: ClientStates,
    token?: string,
    myTn?: string,
    tnToDial?: string,
    wsExists?: boolean
  ) => {
    if (false) {
      console.log(header);
      console.log(" Client State: ", clientState);
      console.log("My TN: ", myTn, " Other TN: ", tnToDial);
      console.log("WS:", wsExists, " token: ", token);
    }
  };

  const handleServerMessage = (message: any) => {
    const parsedMessage: ClientEvent = JSON.parse(message.data.toString());
    console.log(`${parsedMessage.event} message received`);
    switch (parsedMessage.event) {
      case ClientEvents.ClientConnected: {
        setToken(parsedMessage.body.token);
        setMyTn(parsedMessage.body.tn);
        setClientState(ClientStates.IdleInvalid);
        setWs(client);
        connectToSession(parsedMessage.body.token);
        createStreamListeners();
        dumpClientStateValues("after initialization", clientState, token, myTn, tnToDial, ws !== undefined);

        break;
      }
      case ClientEvents.CallIn: {
        outsideWorldHappened(ClientEvents.CallIn);
        setFarEndTn(parsedMessage.body.tn);
        ringing.current.play();
        break;
      }
      case ClientEvents.ClientDisconnected: {
        outsideWorldHappened(ClientEvents.ClientDisconnected);
        setInfoMessage(parsedMessage.body.message);
        break;
      }
      case ClientEvents.FarAnswer: {
        outsideWorldHappened(ClientEvents.FarAnswer);
        setTnToDial("");
        setFarEndTn(parsedMessage.body.tn);
        break;
      }
      case ClientEvents.FarAbandon: {
        outsideWorldHappened(ClientEvents.FarAbandon);
        setFarEndTn("");
        ringing.current.pause();
        break;
      }
      default:
        console.log("error - server message not understood: ", parsedMessage);
    }
  };

  useEffect(() => {
    client.onopen = () => {
      console.log("WebSocket Client Connected");
    };
    // TODO - what about onclose ???
    client.onmessage = handleServerMessage;
    client.onclose = () => {
      console.log("WebSocket Client connection closed");
      setRemoteStream(undefined);
    };
    createStreamListeners();
  });

  useEffect(() => {
    if (clientState === ClientStates.Talking && dtmfIt) {
      bandwidthRtc.sendDtmf(tnToDial);
      setTnToDial("");
      setDtmfIt(false);
      if (runningTimer) {
        clearTimeout(runningTimer.current);
        runningTimer.current = undefined;
      }
    }
  }, [dtmfIt, clientState, tnToDial]);

  const tnUpdate = (digits: string, append: boolean) => {
    const tn = append ? tnToDial + digits : digits;
    if (clientState === ClientStates.Talking) {
      setTnToDial(tn);
      if (runningTimer.current) {
        clearTimeout(runningTimer.current);
        runningTimer.current = undefined;
      }
      runningTimer.current = setTimeout(() => {
        setDtmfIt(true);
      }, 800);
    } else {
      setTnToDial(tn);
      let newState;
      if (tn && tnValid(tn) && clientState === ClientStates.IdleInvalid) {
        // assume valid for now - should likely doublecheck
        console.log("setting the state to Valid (in theory");
        newState = updateState(clientState, ClientEvents.GoodTn);
      } else if ((!tn || !tnValid(tn)) && clientState === ClientStates.IdleValid) {
        console.log("setting the state to INVALID (in theory");
        newState = updateState(clientState, ClientEvents.BadTn);
      }
      if (newState) setClientState(newState);
    }
  };

  const callButtonPress = () => {
    if (clientState !== ClientStates.Disconnected) {
      // we need tn and ws in case the state update triggers a message to the server
      const newState = updateState(clientState, ClientEvents.CallButton, tnToDial, ws);
      if (newState) setClientState(newState);
      ringing.current.pause();
    }
  };

  const outsideWorldHappened = (event: ClientEvents, body?: any) => {
    if (!ws) console.log("Missing Websocket");
    if (clientState && ws) {
      const cs = updateState(clientState, event, tnToDial, ws);
      if (!cs) {
        // button pressed in a state where it has no meaning (the no digits state)
        console.log("Server event invalid at this time: ", event);
      } else {
        setClientState(cs);
      }
    }
  };

  return (
    <ThemeProvider theme={myTheme}>
      <div>
        <Box
          sx={{
            display: "flex",
            p: 5,
            justifyContent: "center",
            bgcolor: "#9090D0",
            fontSize: 28,
          }}
        >
          WEBPHONE
        </Box>
        <Box
          sx={{
            display: "grid",
            p: 1,
            justifyContent: "center",
            //   bgcolor: "#707070",
          }}
        >
          <Tns myTn={myTn} otherEndTn={farEndTn} callState={clientState} />
          <CallButton callState={clientState} onClick={callButtonPress} />
          <ConnectedTo callState={clientState} phoneNumber={tnToDial} updateTn={tnUpdate} />
          <Keypad onPress={tnUpdate} />
          <CallStatus callState={clientState} remoteStream={remoteStream} message={infoMessage} />
          {/* <OutsideWorldEvent registerEvent={outsideWorldHappened} /> */}
        </Box>
      </div>
    </ThemeProvider>
  );
}

export default App;
