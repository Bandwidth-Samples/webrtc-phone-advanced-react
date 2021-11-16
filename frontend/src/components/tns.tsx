import TextField from "@mui/material/TextField";
import myTheme from "../base/mytheme";

import { ClientStates } from "../base/localtypes";
import { ThemeProvider } from "@mui/material/styles";

const Tns = (props: any) => {
  return (
    <ThemeProvider theme={myTheme}>
      <div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "left",
            color: "blue",
          }}
        >
          <TextField
            id={`my-number`}
            label="My TN"
            variant="outlined"
            focused={true}
            value={props.myTn ? props.myTn.slice(-10) : ""}
            color="primary"
          />
          <TextField
            id={`far-end-number`}
            label="The other end's number"
            variant="outlined"
            focused={true}
            value={
              (props.callState === ClientStates.Talking || props.callState === ClientStates.Incoming) &&
              props.otherEndTn
                ? props.otherEndTn.slice(-10)
                : ""
            }
            color="primary"
          />
        </div>
      </div>
    </ThemeProvider>
  );
};

export default Tns;
