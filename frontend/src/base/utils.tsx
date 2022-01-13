import { w3cwebsocket as W3CWebSocket } from "websocket";
import { ClientStates, ClientEvents, SystemEvents, ClientAction } from "./localtypes";

interface Transition {
  currentState: ClientStates;
  nextState: ClientStates;
  triggerEvent: ClientEvents;
  systemEvent?: SystemEvents; // System events that are triggered by a state change
}

// the collection of all valid transitions from one client state to another
let transitions: Array<Transition> = [];

/**
 * initTransitions populates the collection of state transitions
 * with all of the known valid transitions
 */
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
    systemEvent: SystemEvents.Calling,
  });
  transitions.push({
    currentState: ClientStates.Incoming,
    nextState: ClientStates.Talking,
    triggerEvent: ClientEvents.CallButton,
    systemEvent: SystemEvents.Answering,
  });
  transitions.push({
    currentState: ClientStates.Outgoing,
    nextState: ClientStates.IdleValid,
    triggerEvent: ClientEvents.CallButton,
    systemEvent: SystemEvents.HangingUp,
  });
  transitions.push({
    currentState: ClientStates.Talking,
    nextState: ClientStates.IdleValid,
    triggerEvent: ClientEvents.CallButton,
    systemEvent: SystemEvents.HangingUp,
  });
};

/**
 * Execute a client state transition, and if appropriate, send a message to the server
 * to indicate that transition.
 * @param currentClientState - the state that the client is currently in
 * @param theEvent - an event that will cause a state transition
 * @param tnToDial - a TN that might be needed in server-side messaging for some
 * state transitions
 * @param ws - the ws to use to message the server for some state transitions
 * @returns - a new current state value, or undefined if the  event and
 * currentClientState value pair indicate an invalid transition
 */
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
    // ugh - special case for the state where the tnToDial impacts the state,
    // done to avoid state transitions from all states to valid TN and invalid TN
    nextState =
      trans.nextState === ClientStates.IdleValid && tnToDial && !tnValid(tnToDial)
        ? ClientStates.IdleInvalid
        : trans.nextState === ClientStates.IdleInvalid && tnToDial && tnValid(tnToDial)
        ? ClientStates.IdleValid
        : trans.nextState;
    if (trans.systemEvent && ws) {
      sendSystemEvent(trans.systemEvent, ws, { tn: tnToDial });
    }
  } else {
    console.log("state transition invalid: ", currentClientState, theEvent);
  }
  return nextState;
};

/**
 * check a TN for 10D syntactic validity
 * @param tn - the tn to check for syntactic validity
 * @returns - yup or nope :-)
 */
const tnValid = (tn?: string): boolean => {
  return tn !== undefined && tn.match(/^[2-9][0-9]{9}$/) !== null;
};

/**
 * A helper to send messages over the webSocket to the Server
 * @param systemEvent - the event to send to the Server
 * @param ws - the websocket to use when sending the event
 * @param body - the message body
 */
const sendSystemEvent = (systemEvent: SystemEvents, ws?: W3CWebSocket, body?: any) => {
  if (!ws) throw new Error("missing websocket");
  const data: ClientAction = {
    event: systemEvent,
    body: body,
  };
  ws.send(JSON.stringify(data));
};

initTransitions();

export { updateState, tnValid };
