import { Button, Table, TableBody, TableRow, TableCell } from "@mui/material";
import myTheme from "../base/mytheme";
import { ThemeProvider, Theme } from "@mui/material/styles";
import { makeStyles, createStyles } from "@mui/styles";

const useStyles: any = makeStyles((theme: Theme) =>
  createStyles({
    tableRow: {
      height: 100,
      width: 300,
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

  const displayCell = (char: string) => {
    return (
      <TableCell width={100} align="center" key={`tcol${char}`}>
        <Button
          key={`butt_${char}`}
          onClick={() => {
            onClickButton(char);
          }}
        >
          {char}
        </Button>
      </TableCell>
    );
  };
  const buttons = [
    ["1", "2", "3"],
    ["4", "5", "6"],
    ["7", "8", "9"],
    ["*", "0", "#"],
  ];

  return (
    <div>
      <ThemeProvider theme={myTheme}>
        <Table>
          <TableBody>
            {buttons.map((row) => {
              return (
                <TableRow className={classes.tableRow} key={`trow${row[0]}`}>
                  {row.map((char) => {
                    return displayCell(char);
                  })}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </ThemeProvider>
    </div>
  );
};
export default Keypad;
