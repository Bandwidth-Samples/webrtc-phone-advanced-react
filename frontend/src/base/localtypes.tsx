// import { w3cwebsocket as W3CWebSocket } from "websocket";

// TODO - get rid of the ClientState
// interface ClientState {
//   connected: boolean;
//   token?: string;
//   myTn?: string;
//   tnToDial?: string;
//   callState?: ClientStates;
//   ws?: W3CWebSocket;
// }

// rename
interface ClientEvent {
  event: ClientEvents;
  body?: any;
}

// represents the entire bi-directional event space - to and from the client
// TODO - change this to use two messages - one from and on to the Client
interface AgentMessage {
  event: SystemEvents;
  // tn?: string; // ugh - derived from context
  body?: any;
}

// things that happen to the Client
const enum ClientEvents {
  ClientConnected = "Client Connected",
  ClientDisconnected = "Client Disconnected",
  BadTn = "TN Invalidated",
  GoodTn = "TN Validated",
  CallIn = "Incoming Call",
  FarAnswer = "Far end Answer",
  FarAbandon = "Abandon",
  CallButton = "Call Button Pressed",
}

// States that the front end can be in
const enum ClientStates {
  Disconnected = "Idle - Disconnected",
  IdleInvalid = "Idle - TN Invalid",
  IdleValid = "Idle - TN Valid",
  Incoming = "Receiving Call",
  Outgoing = "Placing Call",
  Talking = "Talking",
}

// things that the client can do to the backend
const enum SystemEvents {
  registration = "Agent Registering",
  // initialized = "Agent Initialized",
  // interconnected = "Connected to Voice",
  calling = "Placing a call",
  answering = "Answering a call",
  hangingUp = "Ending a call",
  // farEndCalling = "Incoming Call",
  // farEndAnswer = "Phone Answered",
  // farEndHangup = "Far End Hung Up",
}

export type {
  // ClientState,
  ClientEvent,
  AgentMessage,
};

export { ClientEvents, ClientStates, SystemEvents };
