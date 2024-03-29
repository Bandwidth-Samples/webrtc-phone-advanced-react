# Description of the web-phone app

## Intent

1. demonstrate what can be done
   - add capabilities that people will expect in an attempt to make it look realistic
   - make it look polished
2. easy to understand sample code
   - make it as simple and clean as possible - keep the complexity low

## Capabilities

### Calling

- indicate call state on the UI

#### making a call

- play local ringing tone ?
- indicate answer visually
- time out
- accept abandon

#### receiving a call

- ringing tone on speaker
- visual indication

### while in a call

- hang up
- send DTMF
- reject incoming call requests automatically

### (Temporary) Data

- calls made (TODO)
- calls received (TODO)
- current call state [idle, calling, receiving, in-call]

## Design Considerations

- multi-user (single user for now)
- temporary data only - only while the user is active
- one call at a time
- websockets interface to the server for real-time user/server interaction
- server-side master data...
  - received calls
  - made calls
  - phone number / participant / webSocket / callId / callState / session / interconnect leg map (when multi-party)

# React App background

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

The page will reload if you make edits.\
You will also see any lint errors in the console.

### `npm test`

Launches the test runner in the interactive watch mode.\
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

### `npm run eject`

**Note: this is a one-way operation. Once you `eject`, you can’t go back!**

If you aren’t satisfied with the build tool and configuration choices, you can `eject` at any time. This command will remove the single build dependency from your project.

Instead, it will copy all the configuration files and the transitive dependencies (webpack, Babel, ESLint, etc) right into your project so you have full control over them. All of the commands except `eject` will still work, but they will point to the copied scripts so you can tweak them. At this point you’re on your own.

You don’t have to ever use `eject`. The curated feature set is suitable for small and middle deployments, and you shouldn’t feel obligated to use this feature. However we understand that this tool wouldn’t be useful if you couldn’t customize it when you are ready for it.
