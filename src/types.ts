interface ClientEvent {
  event: ClientEvents;
  body?: any;
}

interface AgentMessage {
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

// things that the client can do to the backend
const enum SystemEvents {
  registration = "Agent Registering",
  calling = "Placing a call",
  answering = "Answering a call",
  hangingUp = "Ending a call",
}

const enum AgentState {
  detached = "Agent detached",
  webAttached = "Agent attached",
  voiceAttached = "Agent connected",
  placingCall = "Calling out",
  receivingCall = "Ringing",
  talking = "Talking",
}

export { AgentState, ClientEvent, AgentMessage, ClientEvents, SystemEvents };
