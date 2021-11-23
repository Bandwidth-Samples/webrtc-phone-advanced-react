import { useState, useEffect, useRef } from "react";
import { w3cwebsocket as W3CWebSocket } from "websocket";
import BandwidthRtc, { RtcStream } from "@bandwidth/webrtc-browser";

import Box from "@mui/material/Box";
import { ThemeProvider } from "@mui/material/styles";

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

/**
 * note - it appears that some stuff you can create and apply as classes, and some that can't be
 * handled that way.  There are a few cases below where using the system props sx= is the only way
 * to achieve the result.  Somebody that is better at material UI might have better luck.
 */

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

  const runningTimer = useRef<any>(0); // for DTMF timeout.
  const ringing = useRef<any>(new Audio("ringing.mp3"));

  /**
   * Establish a media control connection to the Bandwidth WebRTC platform
   * @param token - the Participant token to be used in the connect()
   */
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

  /**
   * Establish the two listner callbacks for the appearance and
   * disappearance of media streams from the media servers
   */
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

  /**
   * a logging utility for key elements of the client state
   * @param header - informative text if needed
   * @param clientState - the formal state that the client is in
   * @param token - the security token assigned by the server
   * @param myTn - the local TN assigned by the server
   * @param tnToDial - the TN that will be dialled on placing a call
   * @param wsExists - whether there is a websocket
   */
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

  /**
   * A utility function to handle inbound server websocket messages to
   * handle events and state changes that happen in the server / network.
   * @param message - the message received by the Client from the server
   */
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
        serverEventHappened(ClientEvents.CallIn);
        setFarEndTn(parsedMessage.body.tn);
        ringing.current.play();
        break;
      }
      case ClientEvents.ClientDisconnected: {
        serverEventHappened(ClientEvents.ClientDisconnected);
        setInfoMessage(parsedMessage.body.message);
        break;
      }
      case ClientEvents.FarAnswer: {
        serverEventHappened(ClientEvents.FarAnswer);
        setTnToDial("");
        setFarEndTn(parsedMessage.body.tn);
        break;
      }
      case ClientEvents.FarAbandon: {
        serverEventHappened(ClientEvents.FarAbandon);
        setFarEndTn("");
        setTnToDial("");
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
    client.onmessage = handleServerMessage;
    client.onclose = () => {
      console.log("WebSocket Client connection closed");
      setRemoteStream(undefined);
    };
    createStreamListeners();
  });

  /**
   * handle DTMF timer expiry state changes.
   */
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

  /**
   * props function to update the register containing digits to dial or use to send DTMF
   * Invoked when the UI TN values are changed in the textbox or via the keypad.
   * @param digits - the new digits to add to the TN that we will dial
   * @param append - true if the new digits are to be appended to the current set,
   *                 otherwise the new digits replace any that are there
   */
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
        console.log("setting the TN Idle state to Valid");
        newState = updateState(clientState, ClientEvents.GoodTn);
      } else if ((!tn || !tnValid(tn)) && clientState === ClientStates.IdleValid) {
        console.log("setting the TN idle state to INVALID");
        newState = updateState(clientState, ClientEvents.BadTn);
      }
      if (newState) setClientState(newState);
    }
  };

  /**
   * props function to handle the activation of the 'call' button, which is really
   * just the button that is used for all major actions on the client - call, answer
   * and hang up.
   */
  const callButtonPress = () => {
    if (clientState !== ClientStates.Disconnected) {
      // we need tn and ws in case the state update triggers a message to the server
      const newState = updateState(clientState, ClientEvents.CallButton, tnToDial, ws);
      if (newState) setClientState(newState);
      ringing.current.pause();
    }
  };

  /**
   * This utility function is used to encapsulate the handling of events from
   * the server.
   * @param event - the outside world event that happened, and
   * @param body - the body of the message associated with that event
   */
  const serverEventHappened = (event: ClientEvents, body?: any) => {
    if (!ws) console.log("Missing Websocket");
    if (clientState && ws) {
      const cs = updateState(clientState, event, tnToDial, ws);
      if (!cs) {
        console.log("Server event invalid at this time: ", event);
      } else {
        setClientState(cs);
      }
    }
  };

  // sorry that I could not figure out how to get MUI to style the components
  // below without using sx=.  perhaps in another life.
  return (
    <ThemeProvider theme={myTheme}>
      <div>
        <Box
          sx={{
            display: "flex",
            p: 3,
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
            p: 3,
            justifyContent: "center",
          }}
        >
          <Tns myTn={myTn} otherEndTn={farEndTn} callState={clientState} />
          <CallButton callState={clientState} onClick={callButtonPress} />
          <ConnectedTo callState={clientState} phoneNumber={tnToDial} updateTn={tnUpdate} />
          <Keypad onPress={tnUpdate} />
          <CallStatus callState={clientState} remoteStream={remoteStream} message={infoMessage} />
        </Box>
      </div>
    </ThemeProvider>
  );
}

export default App;
