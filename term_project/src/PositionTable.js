import * as React from 'react';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import { makeStyles } from "@material-ui/core/styles";
import {binance, sendBuyOrder, sendSellOrder} from "./apiCalls";

const columns = [
    {
        id: 'symbol',
        label: 'Symbol',
        minWidth: 170,
        align: 'center',
    },
    {
        id: 'quantity',
        label: 'Quantity',
        minWidth: 100,
        align: 'center',
    },
    {
        id: 'average_entry',
        label: 'Average Entry',
        minWidth: 170,
        align: 'center',
    },
    {
        id: 'market_price',
        label: 'Market Price',
        minWidth: 170,
        align: 'center',
    },
    {
        id: 'liquidation_price',
        label: 'Liquidation Price',
        minWidth: 170,
        align: 'center',
    },
    {
        id: 'pnl_open',
        label: 'PNL Open',
        minWidth: 170,
        align: 'center',
    },
    {
        id: 'pnl_day',
        label: 'PNL Day',
        minWidth: 170,
        align: 'center',
    },
    {
        id: 'button',
        label: '',
        minWidth: 170,
        align: 'center',
    },
];

function createData(symbol, quantity, average_entry, market_price, liquidation_price, pnl_open, pnl_day, button) {
    return {symbol: symbol, quantity: quantity, average_entry: average_entry, market_price: market_price,
        liquidation_price: liquidation_price, pnl_open: pnl_open, pnl_day: pnl_day, button: button};
}

function PositionTable(props) {
    function successMessage(message) { // notification for success message
        props.store.addNotification({
            message: message,
            type: "success",
            insert: "top",
            container: "top-right",
            animationIn: ["animate__animated", "animate__fadeIn"],
            animationOut: ["animate__animated", "animate__fadeOut"],
            dismiss: {
                duration: 5000,
                onScreen: true
            }
        })
    }

    function failureMessage(message) { // notification for failure message
        props.store.addNotification({
            message: message,
            type: "danger",
            insert: "top",
            container: "top-right",
            animationIn: ["animate__animated", "animate__fadeIn"],
            animationOut: ["animate__animated", "animate__fadeOut"],
            dismiss: {
                duration: 5000,
                onScreen: true
            }
        })
    }

    let rows = []
    for (let i = 0; i < props.positionRows.length; i++) {
        let currentRow = props.positionRows[i]
        let posAmt =  parseFloat(currentRow["positionAmt"])
        if (posAmt !== 0) {
            rows.push(createData(currentRow["symbol"], parseFloat(currentRow["positionAmt"]),
                parseFloat(currentRow["entryPrice"]), parseFloat(currentRow['markPrice']),
                parseFloat(currentRow["liquidationPrice"]), parseFloat(currentRow["unRealizedProfit"]), 0,
                <button className={'orders-table-cancel-button'} onClick={async (event) => {
                    event.stopPropagation()
                    if (posAmt > 0) {
                        const sellOrder = { // sets up market buy
                            "symbol": currentRow["symbol"],
                            "type": "MARKET",
                            "side": "SELL",
                            "quantity": posAmt
                        };
                        const sellPost = { // buy post to python backend
                            method: "POST",
                            headers: {
                                'Content-Type': 'application/json;charset=UTF-8',
                            },
                            body: JSON.stringify(sellOrder),
                        };
                        await sendSellOrder(sellPost).then((result) => { // send buy post to backend (includes buy order)
                            return result.json()
                        }).then((result) => {
                            if ("error" in result) { // we send a dict back with key 'error' if binance returns an error
                                failureMessage(result["error"]) // add to notification manager
                                throw("Buy did not fill, so stop was canceled.")
                            } else { // message from binance upon success
                                let message = result["origType"] + " " + result["side"] + " for " + result["origQty"] +
                                    " " + result["symbol"] + " filled."
                                successMessage(message) // add to notification manager
                            }
                        })
                    } else if (posAmt < 0) {
                        const buyOrder = { // buy order
                            "symbol": currentRow["symbol"],
                            "type": "MARKET",
                            "side": "BUY",
                            "quantity": -posAmt
                        };
                        const buyPost = { // our buy post to backend
                            method: "POST",
                            headers: {
                                'Content-Type': 'application/json;charset=UTF-8',
                            },
                            body: JSON.stringify(buyOrder),
                        };

                        await sendBuyOrder(buyPost).then((result) => { // send order to backend
                            return result.json()
                        }).then((result) => {
                            console.log(result)
                            if ("error" in result) { // error handling
                                failureMessage(result["error"])
                            } else {
                                let message = result["origType"] + " " + result["side"] + " for " + result["origQty"] +
                                    " " + result["symbol"] + " filled."
                                successMessage(message)
                            }
                        })
                    }
            }}>X</button>))
        }
    }

    const [page, setPage] = React.useState(0);
    const [rowsPerPage, setRowsPerPage] = React.useState(10000);

    return (
        <Paper sx={{ width: '100%', overflow: 'hidden', color: 'rgb(203, 199, 199)', backgroundColor:
                'rgb(23, 25, 35)' }}>
            <div className={'positions-header'}>Positions</div>
            <TableContainer sx={{ maxHeight: 175, minHeight: 175, color: 'rgb(203, 199, 199)', backgroundColor:
                    'rgb(23, 25, 35)' }}>
                <Table stickyHeader aria-label="sticky table" >
                    <TableHead>
                        <TableRow>
                            {columns.map((column) => (
                                <TableCell sx={{ color: 'rgb(203, 199, 199)', backgroundColor: 'rgb(23, 25, 35)' }}
                                    key={column.id}
                                    align={column.align}
                                    style={{ minWidth: 50}}>
                                    {column.label}
                                </TableCell>
                            ))}
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {rows
                            .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                            .map((row) => {
                                return (
                                    <TableRow hover role="checkbox" tabIndex={-1} key={row.code} onClick = {() =>
                                        props.handlePositionsClick(row.symbol)}>
                                        {columns.map((column) => {
                                            const value = row[column.id];
                                            let currentColor
                                            if (column.id === "quantity") {
                                                if (value > 0) {
                                                    currentColor = "rgb(37, 166, 154)"
                                                }
                                                else if (value < 0) {
                                                    currentColor = "rgb(237, 83, 82)"
                                                }
                                                else {
                                                    currentColor = "rgb(203, 199, 199)"
                                                }
                                            }
                                            else if (column.id === "pnl_open") {
                                                if (value > 0) {
                                                    currentColor = "rgb(37, 166, 154)"
                                                }
                                                else if (value < 0) {
                                                    currentColor = "rgb(237, 83, 82)"
                                                }
                                                else {
                                                    currentColor = "rgb(203, 199, 199)"
                                                }
                                            }
                                            else if (column.id === "pnl_day") {
                                                if (value > 0) {
                                                    currentColor = "rgb(37, 166, 154)"
                                                }
                                                else if (value < 0) {
                                                    currentColor = "rgb(237, 83, 82)"
                                                }
                                                else {
                                                    currentColor = "rgb(203, 199, 199)"
                                                }
                                            }
                                            else {
                                                currentColor = "rgb(203, 199, 199)"
                                            }
                                            return (
                                                <TableCell
                                                    sx={
                                                        {color: currentColor}
                                                    }
                                                    key={column.id}
                                                    align={column.align}>
                                                    {column.format && typeof value === 'number'
                                                        ? column.format(value)
                                                        : value}
                                                </TableCell>
                                            );
                                        })}
                                    </TableRow>
                                );
                            })}
                    </TableBody>
                </Table>
            </TableContainer>
        </Paper>
    );
}

export default PositionTable;

