import { w3cwebsocket as W3CWebSocket } from "websocket";
import {
  ClientStates,
  ClientEvents,
  // ClientState,
  SystemEvents,
  AgentMessage,
} from "./localtypes";

interface Transition {
  currentState: ClientStates;
  nextState: ClientStates;
  triggerEvent: ClientEvents;
  systemEvent?: SystemEvents;
}

let transitions: Array<Transition> = [];

// const enum ClientEvents {
//   ClientConnected = "Client Connected",
//   BadTn = "TN Invalidated",
//   GoodTn = "TN Validated",
//   CallIn = "Incoming Call",
//   FarAnswer = "Far end Answer",
//   FarAbandon = "Abandon",
//   CallButton = "Call Button Pressed",
// }

// // States that the front end can be in
// const enum ClientStates {
//   Disconnected = "Idle - Disconnected",
//   IdleInvalid = "Idle - TN Invalid",
//   IdleValid = "Idle - TN Valid",
//   Incoming = "Receiving Call",
//   Outgoing = "Placing Call",
//   Talking = "Talking",
// }

// // things that the client can do to the backend
// const enum SystemEvents {
//   registration = "Agent Registering",
//   calling = "Placing a call",
//   answering = "Answering a call",
//   hangingUp = "Ending a call",
// }

const initTransitions = () => {
  // initializing
  transitions.push({
    currentState: ClientStates.Disconnected,
    nextState: ClientStates.IdleInvalid,
    triggerEvent: ClientEvents.ClientConnected,
  });
  // entering TN values
  transitions.push({
    currentState: ClientStates.IdleInvalid,
    nextState: ClientStates.IdleValid,
    triggerEvent: ClientEvents.GoodTn,
  });
  transitions.push({
    currentState: ClientStates.IdleValid,
    nextState: ClientStates.IdleInvalid,
    triggerEvent: ClientEvents.BadTn,
  });
  transitions.push({
    currentState: ClientStates.IdleInvalid,
    nextState: ClientStates.IdleInvalid,
    triggerEvent: ClientEvents.BadTn,
  });
  // network events
  transitions.push({
    currentState: ClientStates.IdleValid,
    nextState: ClientStates.Incoming,
    triggerEvent: ClientEvents.CallIn,
  });
  transitions.push({
    currentState: ClientStates.IdleInvalid,
    nextState: ClientStates.Incoming,
    triggerEvent: ClientEvents.CallIn,
  });
  transitions.push({
    currentState: ClientStates.Outgoing,
    nextState: ClientStates.Talking,
    triggerEvent: ClientEvents.FarAnswer,
  });
  transitions.push({
    currentState: ClientStates.Incoming,
    nextState: ClientStates.IdleValid,
    triggerEvent: ClientEvents.FarAbandon,
  });
  transitions.push({
    currentState: ClientStates.Talking,
    nextState: ClientStates.IdleValid,
    triggerEvent: ClientEvents.FarAbandon,
  });

  // callbutton - out
  transitions.push({
    currentState: ClientStates.IdleValid,
    nextState: ClientStates.Outgoing,
    triggerEvent: ClientEvents.CallButton,
    systemEvent: SystemEvents.calling,
  });
  transitions.push({
    currentState: ClientStates.Incoming,
    nextState: ClientStates.Talking,
    triggerEvent: ClientEvents.CallButton,
    systemEvent: SystemEvents.answering,
  });
  transitions.push({
    currentState: ClientStates.Outgoing,
    nextState: ClientStates.IdleValid,
    triggerEvent: ClientEvents.CallButton,
    systemEvent: SystemEvents.hangingUp,
  });
  transitions.push({
    currentState: ClientStates.Talking,
    nextState: ClientStates.IdleValid,
    triggerEvent: ClientEvents.CallButton,
    systemEvent: SystemEvents.hangingUp,
  });
};

const updateState = (
  currentClientState: ClientStates,
  theEvent: ClientEvents,
  tnToDial?: string,
  ws?: W3CWebSocket
): ClientStates | undefined => {
  let nextState: ClientStates | undefined = undefined;
  const trans: Transition | undefined = transitions.find((item: Transition) => {
    return item.currentState === currentClientState && item.triggerEvent === theEvent;
  });
  if (trans) {
    nextState = trans?.nextState;
    // TODO - factor this out - it is ugly here.
    if (trans.systemEvent && ws) {
      // just always send the TN even if it is not needed
      sendSystemEvent(trans.systemEvent, ws, { tn: tnToDial });
    }
    // if we are transitioning states we sometimes need to tell the Server
    // this is typically when we have hit the main button, which has a context-dependent
    // meaning
  } else {
    console.log("state transition invalid: ", currentClientState, theEvent);
  }
  return nextState;
};

const tnValid = (tn?: string): boolean => {
  return tn !== undefined && tn.match(/^[2-9][0-9]{9}$/) !== null;
};

const sendSystemEvent = (systemEvent: SystemEvents, ws?: W3CWebSocket, body?: any) => {
  if (!ws) throw new Error("missing websocket");
  const data: AgentMessage = {
    event: systemEvent,
    body: body,
  };
  ws.send(JSON.stringify(data));
};

initTransitions();

export { updateState, tnValid };
