import * as React from "react";
import Select from "@mui/material/Select";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/Button";
import Box from "@mui/material/Box";
import { ClientEvents } from "../base/localtypes";
import myTheme from "../base/mytheme";
import { ThemeProvider } from "@mui/material/styles";

const OutsideWorldEvent = (props: any) => {
  const handleChange = (event: any) => {
    props.registerEvent(event.target.value);
  };

  return (
    <ThemeProvider theme={myTheme}>
      <Box sx={{ minWidth: 120 }}>
        <FormControl fullWidth>
          <InputLabel id="demo-simple-select-label">External Telecom Event</InputLabel>
          <Select labelId="event-select" id="event-select" value="" label="Telecom Event" onChange={handleChange}>
            <MenuItem value={ClientEvents.FarAbandon}>{ClientEvents.FarAbandon}</MenuItem>
            <MenuItem value={ClientEvents.FarAnswer}>{ClientEvents.FarAnswer}</MenuItem>
            <MenuItem value={ClientEvents.CallIn}>{ClientEvents.CallIn}</MenuItem>
          </Select>
        </FormControl>
      </Box>
    </ThemeProvider>
  );
};

export default OutsideWorldEvent;
