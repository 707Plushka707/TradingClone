import * as React from 'react';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import UnixToDateTime from "./utils/UnixToDateTime";
import './App.css';
import {binance} from "./apiCalls";

const columns = [
    {
        id: 'symbol',
        label: 'Symbol',
        minWidth: 170,
        align: 'center',
    },
    {
        id: 'orderID',
        label: 'Order ID',
        minWidth: 100,
        align: 'center',
    },
    {
        id: 'type',
        label: 'Type',
        minWidth: 170,
        align: 'center',
    },
    {
        id: 'side',
        label: 'Side',
        minWidth: 170,
        align: 'center',
    },
    {
        id: 'time_in_force',
        label: 'Time In Force',
        minWidth: 170,
        align: 'center',
    },
    {
        id: 'quantity',
        label: 'Quantity',
        minWidth: 170,
        align: 'center',
    },
    {
        id: 'order_price',
        label: 'Order Price',
        minWidth: 170,
        align: 'center',
    },
    {
        id: 'time',
        label: 'Time',
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

function createData(symbol, orderID, type, side, time_in_force, quantity, order_price, time, button) {
    return {symbol: symbol, orderID: orderID, type: type, side: side, time_in_force: time_in_force,
        quantity: quantity, order_price: order_price, time: time, button: button};
}

function OrdersTable(props) {
    let rows = []
    for (let i = 0; i < props.orderRows.length; i++) {
        let currentRow = props.orderRows[i]
        if (currentRow["type"] === "STOP_MARKET") {
            rows.push(createData(
                currentRow["symbol"], currentRow["orderId"], currentRow["type"], currentRow["side"],
                currentRow["timeInForce"], parseFloat(currentRow["origQty"]), parseFloat(currentRow["stopPrice"]),
                UnixToDateTime(currentRow['time']), <button className={'orders-table-cancel-button'} onClick={() => {
                    binance.futuresCancel( currentRow["symbol"], {orderId: String(currentRow["orderId"])} )
                }}>X</button>)
            )
        } else if (currentRow["type"] === "LIMIT") {
            rows.push(createData(
                currentRow["symbol"], currentRow["orderId"], currentRow["type"], currentRow["side"],
                currentRow["timeInForce"], parseFloat(currentRow["origQty"]), parseFloat(currentRow["price"]),
                UnixToDateTime(currentRow['time']), <button className={'orders-table-cancel-button'} onClick={() => {
                    binance.futuresCancel( currentRow["symbol"], {orderId: String(currentRow["orderId"])} )
                }}>X</button>)
            )
        }
    }

    const [page, setPage] = React.useState(0);
    const [rowsPerPage, setRowsPerPage] = React.useState(10000);

    return (
        <Paper sx={{ width: '100%', overflow: 'hidden', color: 'rgb(203, 199, 199)', backgroundColor:
                'rgb(23, 25, 35)' }}>
            <div className={'orders-header'}>Orders</div>
            <TableContainer sx={{ maxHeight: 200, minHeight: 200, color: 'rgb(203, 199, 199)', backgroundColor:
                    'rgb(23, 25, 35)'}}>
                <Table stickyHeader aria-label="sticky table">
                    <TableHead>
                        <TableRow>
                            {columns.map((column) => (
                                <TableCell sx={{ color: 'rgb(203, 199, 199)', backgroundColor: 'rgb(23, 25, 35)' }}
                                    key={column.id}
                                    align={column.align}
                                    style={{ minWidth: 25}}>
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
                                        props.handleOrdersClick(row.symbol)}>
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
                                            else if (column.id === "side") {
                                                if (value > 0) {
                                                    currentColor = "rgb(37, 166, 154)"
                                                }
                                                else {
                                                    currentColor = "rgb(237, 83, 82)"
                                                }
                                            }
                                            else {
                                                currentColor = "rgb(203, 199, 199)"
                                            }
                                            return (
                                                <TableCell key={column.id} align={column.align} sx={{ color:
                                                       currentColor}}>
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
} export default OrdersTable;
