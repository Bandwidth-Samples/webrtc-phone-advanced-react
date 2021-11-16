import path from "path";
import dotenv from "dotenv";
import express, { response } from "express";
import WebSocket from "ws";

import {
  Bridge,
  Pause,
  CreateCallRequest,
  Client as VoiceClient,
  ApiController as VoiceController,
  Response,
  State1Enum,
  ModifyCallRequest,
  StateEnum,
  SpeakSentence,
  Hangup,
} from "@bandwidth/voice";
import {
  Client as WebRtcClient,
  Session,
  Participant,
  PublishPermissionEnum,
  Subscriptions,
  ApiController as WebRtcController,
  DeviceApiVersionEnum,
  Environment,
} from "@bandwidth/webrtc";

import { AgentState, ClientEvent, AgentMessage, ClientEvents, SystemEvents } from "./types";

// ------------------------------ TYPES ----------------------------------

// TODO - determine why the peerconnection stuff stays around in the chrome webrtc-internals
//        cache - Am I doing something wrong ?
// TODO - documentation on all of the top level items
// TODO - clean out ugly and useless comments

interface AgentStatus {
  agentState: AgentState;
  ws?: WebSocket;
  agent?: {
    participantId: string;
    tn?: string;
    token?: string;
  };
  voiceTunnel?: {
    participantId: string;
    token?: string;
    callId?: string;
  };
  sessionId?: string;
  farEnd?: {
    callId: string;
    tn?: string;
  };
}

// ------------------------------ Initialization ----------------------------

dotenv.config();
const app = express();
app.use(express.json());

const wss = new WebSocket.Server({ port: 8001 });

const port = process.env.PORT || 5000;
const accountId = <string>process.env.BW_ACCOUNT_ID;
const username = <string>process.env.BW_USERNAME;
const password = <string>process.env.BW_PASSWORD;
const voiceApplicationPhoneNumber = <string>process.env.BW_NUMBER; // the 'from' number
const voiceApplicationId = <string>process.env.BW_VOICE_APPLICATION_ID;
const voiceCallbackUrl = <string>process.env.BASE_CALLBACK_URL;
const webrtcApiUrl = <string>process.env.BANDWIDTH_WEBRTC_CALL_CONTROL_URL || "https://api.webrtc.bandwidth.com/v1";
const sipUri = <string>process.env.SIP_URI || "sip:sipx.webrtc.bandwidth.com:5060";

const debug = false;

let theAgent: AgentStatus;

const webRTCClient = new WebRtcClient({
  basicAuthUserName: username,
  basicAuthPassword: password,
});
const webRTCController = new WebRtcController(webRTCClient);

const voiceClient = new VoiceClient({
  basicAuthUserName: username,
  basicAuthPassword: password,
});
const voiceController = new VoiceController(voiceClient);

// ---------------------------------- MIDDLEWARE ----------------------------------

app.post("/tunnelanswer", async (req, res) => {
  // Handle incoming events that impact the WebRTC Interconnection
  await handleVoiceTunnelAnswer(req, res, theAgent);
});

app.post("/bridgeTheTunnel", async (req, res) => {
  // Handle incoming redirection events that have been triggered to allow the application
  // to apply new BXML to the call leg that interconnects the WebRTC endpoint
  await handleTunnelBridgeBxmlUpdate(req, res, theAgent.farEnd?.callId);
});

app.post("/pauseTheTunnel", async (req, res) => {
  //   Handle incoming system events that require that the WebRTC interconnection call
  //  be placed in a Paused state.
  await pauseTheTunnel(req, res);
});

app.post("/callAnswer", async (req, res) => {
  // Handle the Answer event from a call placed from the web client
  await handleVoiceCallAnswer(req, res, theAgent);
});

app.post("/incomingCall", async (req, res) => {
  // Handle a new incoming call
  await handleIncomingVoiceCall(req, res, theAgent);
});

app.post("/callStatus", async (req, res) => {
  //   Handle the call events from calls that are active on the PV side.  The only
  //  anticipated event results from the end user hanging up the phone.
  if (req.body.eventType === "disconnect") {
    await handleCallDisconnect(req, res, theAgent);
  }
});

app.post("/*", async (req, res) => {
  // Handle all the other events that might be floating around out there.
  console.log("!!! unfiltered message received:");
  console.log(req.baseUrl, req.url);
  console.log(req.body);
});

// -------------------------------------- EXECUTION -----------------------------------

process.on("SIGINT", async function () {
  console.log("--- SIGINT Received - cleaning up");
  dumpAgent(theAgent, "Deleting");
  if (theAgent) {
    if (theAgent.voiceTunnel) await deleteVoiceTunnel(theAgent);
    await deleteAgent(theAgent);
    await delay(10000);
  }
  wss.close();
  process.exit();
});

app.use(express.static(path.join(__dirname, "..", "frontend", "build")));
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "frontend", "build", "index.html"));
});
app.listen(port, () =>
  console.log(`--- WebRTC Web-phone listening on port ${port}! - timestamp ${new Date().toLocaleString()}`)
);

wss.on("connection", async function connection(ws, req) {
  if (theAgent && theAgent.agentState !== AgentState.detached) {
    const message: ClientEvent = {
      event: ClientEvents.ClientDisconnected,
      body: { tn: `${voiceApplicationPhoneNumber}`, message: "Multiple Web Clients not Supported" },
    };
    ws.send(JSON.stringify(message));
    ws.close();
    console.log("!!! multiple Web clients per web-phone are not permitted");
    return;
  }

  let agent: AgentStatus = await createAgent(ws, accountId);
  if (agent.agent?.participantId) {
    theAgent = agent;
  } else throw "agent without participant id - very bad";

  // agent =
  await establishVoiceTunnel(accountId, agent, `${voiceCallbackUrl}/tunnelanswer`);

  ws.on("message", async function incoming(messageBuffer) {
    const message: AgentMessage = JSON.parse(messageBuffer.toString());
    switch (message.event) {
      case SystemEvents.calling:
        if (message.body?.tn) {
          console.log("<<< Trying to place a call to: ", message.body.tn);
          const voiceCallId = await initiateVoiceCall(agent, message.body.tn);
          agent.farEnd = { callId: voiceCallId };
          agent.agentState = AgentState.placingCall;
        }
        break;
      case SystemEvents.answering:
        console.log("<<< Answering an inbound voice call");
        await initiateTunnelRedirectForBridging(agent.voiceTunnel?.callId);
        break;
      case SystemEvents.hangingUp:
        // abandon or hanging up
        console.log(">>> The Web Client is hanging up the call");
        await deleteFarEndCall(agent);
        break;
      default:
        console.log("!!! message from client not recognized: ", message);
    }
  });
  ws.on("close", async function closing(message) {
    try {
      if (agent.voiceTunnel) await deleteVoiceTunnel(agent);
      if (agent.agent?.participantId) {
        await deleteAgent(agent);
        // agent = { state: AgentState.detached }; //clean up the agent
      }
    } catch (err: any) {
      console.log("!!! error on executing ws close...:", err);
    }
    agent.agentState = AgentState.detached;
    dumpAgent(agent, "ws.close");
  });
  ws.on("error", function closing(message) {
    console.log("!!! client websocket error");
    ws.close();
  });
});

// --------------------------------- UTILITY FUNCTIONS ----------------------------

const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

/**
 * Initialize the relationship with the web client
 * @param ws the Websocket for communicating with the web client.
 * @param accountId the IRIS account that the app runs on
 * @returns AgentStatus the created agent object
 */
const createAgent = async (ws: WebSocket, accountId: string): Promise<AgentStatus> => {
  let as: AgentStatus = { agentState: AgentState.webAttached, ws: ws };
  // create and persist the Participant
  let createParticipantResponse = await webRTCController.createParticipant(accountId, {
    tag: "web-phone-browser",
    publishPermissions: [PublishPermissionEnum.AUDIO],
    deviceApiVersion: DeviceApiVersionEnum.V3,
  });
  const agentParticipant: Participant | undefined = createParticipantResponse.result.participant;
  const agentToken = createParticipantResponse.result.token;

  if (!agentParticipant) throw "failed to create a participant";
  if (!agentParticipant.id) throw "failed to create a participant id";
  if (!agentToken) throw Error("the token was not returned");

  as.agent = { participantId: agentParticipant.id, token: agentToken };

  // create or join a session

  let se: string | undefined;
  if (theAgent?.sessionId) {
    se = theAgent.sessionId;
  } else {
    let response = await webRTCController.createSession(accountId, { tag: "web-phone-session" });
    se = response.result.id;
  }

  if (!se) {
    throw Error("No Session ID in Create Session Response");
  }
  // add the participant to the session
  as.sessionId = se;
  await webRTCController.addParticipantToSession(accountId, as.sessionId, agentParticipant.id, {
    sessionId: as.sessionId,
  });

  // tell the client about the Participant
  const message: ClientEvent = {
    event: ClientEvents.ClientConnected,
    body: { tn: `${voiceApplicationPhoneNumber}`, token: as.agent.token },
  };
  ws.send(JSON.stringify(message));
  console.log("--- Web Agent Created - Participant ", as.agent.participantId, " on Session ", as.sessionId);
  dumpAgent(as, "createAgent");
  return as;
};

/**
 * Delete the stored relationship with the web client by removing subtending items
 * like Participants and Sessions.
 * @param : agent - the agent object to be cleared out.
 */
const deleteAgent = async (agent: AgentStatus) => {
  if (!agent.agent?.participantId) {
    console.log("!!! can't find the web particpant to delete it");
  } else {
    try {
      const response = await webRTCController.deleteParticipant(accountId, agent.agent.participantId);
      console.log("--- Deleted Participant :", agent.agent?.participantId);
    } catch (err) {
      console.log("!!! can't delete participant ", err);
    }
    agent.agent = undefined;
  }

  if (!agent.voiceTunnel?.participantId) {
    console.log("--- Interconnection participant previously removed");
  } else {
    try {
      const response = await webRTCController.deleteParticipant(accountId, agent.voiceTunnel.participantId);
      console.log("--- Deleted WebRTC interconnection Participant :", agent.voiceTunnel.participantId);
    } catch (err) {
      console.log("!!! can't delete WebRTC interconnection participant ", err);
    }
    agent.voiceTunnel = undefined;
  }

  if (!agent.sessionId) {
    console.log("!!! Can't delete WebRTC session - session ID missing");
  } else {
    console.log("<<< deleting Session: ", agent.sessionId);
    await webRTCController.deleteSession(accountId, agent.sessionId);
    agent.sessionId = undefined;
  }

  dumpAgent(agent, "deleted Agent");
};

/**
 * Initiate the creation of a SIP Voice connection between WebRTC and Programmable (SIP) voice.
 * The anticipated outcome is the establishment of the Partition / Session / Subscription model
 * for interconnection between PV and WebRTC, and the initiation of the SIP Invite to create
 * the actual media path.  The specific next event is an Answer event created by WebRTC to the
 * SIP INVITE created by this function.
 * @param : accountId - the account ID that has permission to use the application
 * @param : agent - the agent object to have the tunnel attached to it.
 * @param : tunnelSuccessUrl - a URL to invoke when the tunnel succeeds
 * @param : tunnelFailureUrl - a URL to invoke on failure.  If not provided the success URL will be used.
 */
const establishVoiceTunnel = async (
  accountId: string,
  agent: AgentStatus,
  tunnelSuccessUrl: string,
  tunnelFailUrl?: string
) => {
  let createParticipantResponse = await webRTCController.createParticipant(accountId, {
    tag: "tunnel-to-voice",
    publishPermissions: [PublishPermissionEnum.AUDIO],
    deviceApiVersion: DeviceApiVersionEnum.V3,
  });

  if (debug) console.log("Create tunnel participant response", createParticipantResponse);

  const voiceTunnelParticipant: Participant | undefined = createParticipantResponse.result.participant;
  const voiceTunnelToken: string | undefined = createParticipantResponse.result.token;

  if (!voiceTunnelParticipant || !voiceTunnelParticipant.id || !voiceTunnelToken)
    throw "failure to create a voice tunnel Participant";

  if (!agent.sessionId) throw "attempting to add voice tunnel to nonexistent Session";

  const webRtcSessionId: string = agent.sessionId;

  let addToSessionResponse = await webRTCController.addParticipantToSession(
    accountId,
    webRtcSessionId,
    voiceTunnelParticipant.id,
    { sessionId: webRtcSessionId }
  );

  if (debug) console.log("add tunnel to session response", addToSessionResponse);

  if (!tunnelFailUrl) tunnelFailUrl = tunnelSuccessUrl;

  const createTunnelRequest: CreateCallRequest = {
    from: voiceApplicationPhoneNumber,
    to: sipUri,
    uui: `${voiceTunnelToken};encoding=jwt`,
    callTimeout: 60,
    callbackTimeout: 25,
    answerUrl: tunnelSuccessUrl,
    disconnectUrl: tunnelFailUrl,
    tag: voiceTunnelParticipant.id,
    applicationId: voiceApplicationId,
  };

  if (debug) console.log("create tunnel request body: ", createTunnelRequest);

  try {
    const createTunnelCallResponse = await voiceController.createCall(accountId, createTunnelRequest);
    if (debug) console.log("create tunnel call response:", createTunnelCallResponse);
    const tunnelCallCallId = createTunnelCallResponse.result.callId;
    agent.voiceTunnel = {
      participantId: voiceTunnelParticipant.id,
      token: voiceTunnelToken,
      callId: tunnelCallCallId,
    };
    console.log(
      "<<< Initiating Interconnection to Programmable Voice with Participant ",
      agent.voiceTunnel?.participantId,
      " and PV callId ",
      agent.voiceTunnel?.callId
    );
  } catch (e) {
    console.log(e);
  }
  dumpAgent(agent, "attempting the tunnel creation");
  // return agent;
};

/**
 * Delete the Voice Tunnel as part of an overall cleanup - remove subtending
 * Programmable Voice and WebRTC interconnection resources
 * @param : agent - the agent object to be cleared out.
 */
const deleteVoiceTunnel = async (agent: AgentStatus) => {
  if (agent.voiceTunnel?.callId) {
    const killCallRequestBody: ModifyCallRequest = {
      state: StateEnum.Completed,
    };
    try {
      const removedVoiceTunnelCall = await voiceController.modifyCall(
        accountId,
        agent.voiceTunnel.callId,
        killCallRequestBody
      );
      console.log("<<< deleting voice tunnel call:", agent.voiceTunnel.callId);
      agent.voiceTunnel.callId = undefined;
    } catch (err: any) {
      console.log("!!! failed in attempt to modify the Call...:", err);
    }
  }

  if (agent.voiceTunnel?.participantId) {
    try {
      await webRTCController.deleteParticipant(accountId, agent.voiceTunnel?.participantId);
    } catch (error: any) {
      if (error.statusCode !== 404) {
        console.log("!!! Failure to delete WebRTC interconnection Participant: ", agent.voiceTunnel.participantId);
      }
    }
    // assume that any voice call is going away naturally
    agent.voiceTunnel = undefined;
  }
};

/**
 * This function handles the answer event that the WebRTC interconnection SIP call
 * causes.  Answer in this context means that WebRTC has acknowledged the voice
 * connection.  A successful interconnection call will be placed in a long-duration
 * pause state awaiting other actions and events.
 * @param : agent - the agent that contains / references the interconnection
 */
const handleVoiceTunnelAnswer = async (req: any, res: any, agent: AgentStatus) => {
  if (debug) console.log("Voice WebRTC interconnection Event Details: ", req.body.eventType, req.body);

  if (!agent) {
    await res.send();
    return;
  }

  try {
    if (req.body.eventType === "answer") {
      console.log(">>> Voice Interconnection Answer Received: ");
      let response = new Response();
      // const sentenceResponse = new SpeakSentence({ sentence: "Creating a tunnel" });
      // response.add(sentenceResponse);
      const pause = new Pause({ duration: 3600 });
      response.add(pause);

      let myResp = response.toBxml();
      console.log("<<< Interconnetion event answer response:", myResp);
      await res.send(myResp);
    } else {
      // get rid of the vestigial resources
      if (agent.voiceTunnel?.participantId) {
        const part = agent.voiceTunnel?.participantId;
        console.log("<<< Deleting WebRTC interconnection participant: ", part);
        agent.voiceTunnel = undefined;
        // assume that the voice call is going away naturally (risky)
        const deleteParticipantResponse = await webRTCController.deleteParticipant(accountId, part);
      }
      await res.send();
    }
  } catch (err: any) {
    if (err.statusCode !== 404) {
      console.log("!!! error handling WebRTC interconnection event", err);
    } else {
      console.log("!!! participant ID not found for delete: ", agent.voiceTunnel?.participantId);
    }
  }
  dumpAgent(agent, "WebRTC interconnection Event Handled");
  return true;
};

/**
 * Once the application has determined that we need to bridge the WebRTC interconnection
 * call to the Voice Netowrk call, the interconnection call neets to be instructed
 * to invoke a callback to get updated BXML.   This function uses the POST /calls
 * Programmable Voice call to trigger that redirect callback to subsequently trigger
 * the application of Bridging BXML (convoulted - huh?)
 * @param : targetCallId - the callId to invoke the redirection on - in this case the
 *          interconnection call.
 */
const initiateTunnelRedirectForBridging = async (targetCallId: string | undefined) => {
  console.log("<<< Initiating a Bridge of WebRTC client to the voice call:", targetCallId);
  if (!targetCallId) throw `Bridge initiation missing callIds - ${targetCallId}`;

  const updateCallRequestBody: ModifyCallRequest = {
    state: StateEnum.Active,
    redirectUrl: `${voiceCallbackUrl}/bridgeTheTunnel`,
  };
  if (debug) console.log("Redirecting to create a bridge:", updateCallRequestBody);
  try {
    await voiceController.modifyCall(accountId, targetCallId, updateCallRequestBody);
  } catch (err: any) {
    console.log("!!! failed in call to update call for bridging...:", err);
  }
};

/**
 * Once the WebRTC SIP interconnection call has issued a redirect callback, the
 * handleTunnelBridgeBxmlUpdate function will cause the Bridge BXML to be invoked
 * on the interconnection call to cause the WebRTC interconnection call to be
 * connected with the Voice network call.
 * @param : voiceEndCallId - the callId of the Voice Call that we will Bridge to.
 */
const handleTunnelBridgeBxmlUpdate = async (req: any, res: any, voiceEndCallId: string | undefined) => {
  console.log("<<< Bridging the calls: ", req.body.callId, voiceEndCallId);
  if (!req.body.callId || !voiceEndCallId)
    throw `Bridge attempt missing callIds ${req.body.callId} - ${voiceEndCallId}`;

  let response = new Response();
  const bridgeResponse = new Bridge({
    callId: voiceEndCallId,
    bridgeCompleteUrl: `${voiceCallbackUrl}/pauseTheTunnel`,
  });
  response.add(bridgeResponse);
  let myResp = response.toBxml();
  console.log("--- Bridge XML:", myResp, " to CallId: ", req.body.callId);
  await res.send(myResp);
};

/**
 * There are a number of events where BXML to put the WebRTC interconnection call
 * needs to be placed on hold.  This function creates the required BXML response.
 */
const pauseTheTunnel = async (req: any, res: any) => {
  let response = new Response();
  const pause = new Pause({ duration: 3600 });
  response.add(pause);
  let myResp = response.toBxml();
  console.log("<<< pausing the WebRTC interconnection:", myResp);
  await res.send(myResp);
};

/**
 * this funciton simply sends a message to the webClient, containing
 * @param - agent - the data associated with the agent
 * @param - the event that the client will be notified of, and
 * @param - a message body object, often containing the associated TN
 */
const updateBrowserClient = async (agent: AgentStatus, event: ClientEvents, body?: any) => {
  const webClientMessage: ClientEvent = {
    event: event,
    body: body,
  };
  if (agent.ws) {
    agent.ws.send(JSON.stringify(webClientMessage));
  }
};

/**
 * this function initiates a Programmable Voice call to a telephone number
 * in the public telephone network.   With luck it will trigger an answer :-)
 * @param - agent - the data associated with the agent
 * @param - tn - the destination telephone number
 */
const initiateVoiceCall = async (agent?: AgentStatus, tn?: string) => {
  if (!tn || !agent) throw `initiateVoiceCall missing parameters: agent - ${agent} - ${tn}`;
  const createCallRequest: CreateCallRequest = {
    from: voiceApplicationPhoneNumber,
    to: `+1${tn}`,
    callTimeout: 90,
    answerUrl: `${voiceCallbackUrl}/callAnswer`,
    disconnectUrl: `${voiceCallbackUrl}/callStatus`,
    applicationId: voiceApplicationId,
  };
  if (debug) console.log("create Call Request:", createCallRequest);
  try {
    let response = await voiceController.createCall(accountId, createCallRequest);
    const callId = response.result.callId;
    if (debug) console.log(`Initiated call ${callId} to ${tn}...`);
    return callId;
  } catch (e) {
    console.log(`!!! error calling ${tn}: ${e}`);
    return "";
  }
};

/**
 * and if we are lucky enough to receive an answer from our attempt at a voice
 * call, this function will handle the answer message and ensure that the
 * outbound call can be connected to the WebRTC agent.
 * @param - agent - the data associated with the agent
 */
const handleVoiceCallAnswer = async (req: any, res: any, agent: AgentStatus) => {
  console.log(">>> handling the answer from the PSTN phone from CallId: ", req.body.callId);
  if (debug) console.log("handling the answer from the PSTN phone:", req.body);

  let response = new Response();
  const pause = new Pause({ duration: 3600 });
  response.add(pause);
  let myResp = response.toBxml();
  console.log("<<< Responding with outbound call BXML:", myResp);
  await res.send(myResp);

  // kick the tunnel to establish the bridge.
  await initiateTunnelRedirectForBridging(agent.voiceTunnel?.callId);
  await updateBrowserClient(agent, ClientEvents.FarAnswer, { tn: req.body.to });

  // await handleBridgeBxmlUpdate(req, res, agent);
};

/**
 * this function handles an incoming voice call from the public telephone network
 * and ensures that is is correctly prepared for interconnection with WebRTC
 * @param - agent - the data associated with the agent
 */
const handleIncomingVoiceCall = async (req: any, res: any, agent: AgentStatus) => {
  if (debug) console.log("handling the incoming call:", req.body);
  console.log(">>> Inbound call received fron CallId: ", req.body.callId);

  if (agent && agent.agent && agent.sessionId && agent.voiceTunnel) {
    agent.farEnd = { callId: req.body.callId, tn: req.body.from };
    agent.agentState = AgentState.receivingCall;
    let response = new Response();
    const pause = new Pause({ duration: 500 });
    response.add(pause);
    const myResp = response.toBxml();
    console.log("<<< Responding with BXML:", myResp);
    await res.send(myResp);
    await updateBrowserClient(agent, ClientEvents.CallIn, { tn: req.body.from });
  } else {
    // nobody here to call...
    let response = new Response();
    const pause = new Pause({ duration: 1 });
    response.add(pause);
    const speech = new SpeakSentence({ sentence: "Nobody is home" });
    response.add(speech);
    const hangup = new Hangup();
    response.add(hangup);
    const myResp = response.toBxml();
    console.log("<<< No web-client available to answer - responding with BXML:", myResp);
    await res.send(myResp);
  }
};

/**
 * all good things must come to an end.  This function will handle the hang-up event
 * from a voice call, whether it was created in an outbound or inbound direction.
 * @param - agent - the data associated with the agent
 */
const handleCallDisconnect = async (req: any, res: any, agent: AgentStatus) => {
  if (agent && agent.farEnd?.callId) {
    console.log(">>> The phone has disconnected: ", agent.farEnd.callId);
    await deleteFarEndCall(agent);
    await updateBrowserClient(agent, ClientEvents.FarAbandon);
  }
  dumpAgent(agent, "after disconnect attempt");
};

/**
 * a helper function to clean up residual resources associated with a voice
 * telephone hanging up (or other reasons for a similar cleanup)
 * @param - agent - the data associated with the agent
 */
const deleteFarEndCall = async (agent: AgentStatus) => {
  // assume that any bridge will fall apart when the callid goes away
  // there are no bridge-associated callbacks
  console.log("<<< Deleting far end call", agent.farEnd?.callId);
  if (agent.farEnd?.callId) {
    const killCallRequestBody: ModifyCallRequest = {
      state: StateEnum.Completed,
    };
    try {
      const removedFarEndCall = await voiceController.modifyCall(accountId, agent.farEnd.callId, killCallRequestBody);
      agent.farEnd = undefined;
    } catch (err: any) {
      if (err.statusCode !== 404) {
        console.log("!!! failed in call to modifyCall...:", err);
      } else {
        console.log("--- call already deleted");
      }
    }
  }
};

const dumpAgent = (toDump: AgentStatus, note?: string) => {
  if (!debug || !toDump) return;
  const { agentState, agent, voiceTunnel, sessionId, farEnd } = toDump;
  if (note) console.log(note);
  console.log({ agentState, agent, voiceTunnel, sessionId, farEnd });
};
