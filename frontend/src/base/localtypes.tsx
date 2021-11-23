// An event that can happen to the frontend client,
interface ClientEvent {
  event: ClientEvents;
  body?: any;
}

// a message from the Client to the Server
interface ClientAction {
  event: SystemEvents;
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
  Registration = "Agent Registering",
  Calling = "Placing a call",
  Answering = "Answering a call",
  HangingUp = "Ending a call",
}

export type { ClientEvent, ClientAction };

export { ClientEvents, ClientStates, SystemEvents };
