import { Button, Table, TableBody, TableRow, TableCell } from "@mui/material";
import myTheme from "../base/mytheme";
import { ThemeProvider, Theme } from "@mui/material/styles";
import { makeStyles, createStyles } from "@mui/styles";

const useStyles: any = makeStyles((theme: Theme) =>
  createStyles({
    tableRow: {
      height: 100,
    },
  })
);

const Keypad = (props: any) => {
  const classes = useStyles();
  const audio = new Audio("dtmf.mp3");

  const onClickButton = (butt: any) => {
    if (audio) audio.play();
    props.onPress(butt, true);
  };

  const buttons = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"];

  return (
    <div>
      <ThemeProvider theme={myTheme}>
        <Table>
          <TableBody>
            {buttons.map((char, index, array) => {
              return index % 3 === 0 ? (
                <TableRow className={classes.tableRow} key={`trow${char}${index}`}>
                  <TableCell width={100} align="center">
                    <Button
                      key={`butt_${array[index]}`}
                      onClick={() => {
                        onClickButton(char);
                      }}
                    >
                      {char}
                    </Button>
                  </TableCell>
                  <TableCell width={100} align="center">
                    <Button
                      key={`butt_${array[index + 1]}`}
                      onClick={() => {
                        onClickButton(array[index + 1]);
                      }}
                    >
                      {array[index + 1]}
                    </Button>
                  </TableCell>
                  <TableCell width={100} align="center">
                    <Button
                      key={`butt_${array[index + 2]}`}
                      onClick={() => {
                        onClickButton(array[index + 2]);
                      }}
                    >
                      {array[index + 2]}
                    </Button>
                  </TableCell>
                </TableRow>
              ) : null;
            })}
          </TableBody>
        </Table>
      </ThemeProvider>
    </div>
  );
};
export default Keypad;
