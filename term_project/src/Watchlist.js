import * as React from 'react';
import { DataGrid } from '@mui/x-data-grid';
import ReactSelect from "react-select";
import {useEffect, useState} from "react";
import './App.css';
import clsx from 'clsx';
import {accBalancesAndPos, futuresPosRisk, getFuturesOpenOrders, getPercentGainers} from "./apiCalls";
import {algoHandler} from "./algoHandler";

const columns = [
    {
    field: "id",
    headerName: 'Symbol',
    headerClassName: "watchlist-symbol",
    cellClassName: 'super-app-neutral',
    headerAlign: 'center',
    type: 'string',
    flex: 2.0,
    width: 10,
    align: 'center'
    },
    {
    field: '1m%',
    headerName: '1m%',
    headerClassName: 'watchlist-1m',
    headerAlign: 'center',
    cellClassName: (params) =>
        clsx('super-app', {
          positive: params.value > 0,
          negative: params.value < 0,
          neutral: params.value == 0,
        }),
    type: 'number',
    flex: 2.0,
    width: 50,
    align: 'center'
    },
    {
    field: '5m%',
    headerName: '5m%',
    headerClassName: 'watchlist-5m',
    headerAlign: 'center',
    cellClassName: (params) =>
        clsx('super-app', {
          positive: params.value > 0,
          negative: params.value < 0,
          neutral: params.value == 0,
        }),
    type: 'number',
    flex: 2.0,
    width: 50,
    align: 'center'
    },
    {
    field: '15m%',
    headerName: '15m%',
    headerClassName: 'watchlist-15m',
    headerAlign: 'center',
    cellClassName: (params) =>
        clsx('super-app', {
          positive: params.value > 0,
          negative: params.value < 0,
          neutral: params.value == 0,
        }),
    type: 'number',
    flex: 2.0,
    width: 50,
    align: 'center'
    },
    {
    field: '1h%',
    headerName: '1h%',
    headerClassName: 'watchlist-1h',
    headerAlign: 'center',
    cellClassName: (params) =>
        clsx('super-app', {
          positive: params.value > 0,
          negative: params.value < 0,
          neutral: params.value == 0,
        }),
    type: 'number',
    flex: 2.0,
    width: 50,
    align: 'center'
    },
    {
    field: '4h%',
    headerName: '4h%',
    headerClassName: 'watchlist-4h',
    headerAlign: 'center',
    cellClassName: (params) =>
        clsx('super-app', {
          positive: params.value > 0,
          negative: params.value < 0,
          neutral: params.value == 0,
        }),
    type: 'number',
    flex: 2.0,
    width: 50,
    align: 'center'
    },
    {
    field: '1d%',
    headerName: '1d%',
    headerClassName: 'watchlist-1d',
    headerAlign: 'center',
    cellClassName: (params) =>
        clsx('super-app', {
          positive: params.value > 0,
          negative: params.value < 0,
          neutral: params.value == 0,
        }),
    type: 'number',
    flex: 2.0,
    width: 50,
    align: 'center'
    },
    {
        field: '1w%',
        headerName: '1w%',
        headerClassName: 'watchlist-1w',
        headerAlign: 'center',
        cellClassName: (params) =>
            clsx('super-app', {
                positive: params.value > 0,
                negative: params.value < 0,
                neutral: params.value == 0,
            }),
        type: 'number',
        flex: 2.0,
        width: 50,
        align: 'center'
    },
    {
        field: '1M%',
        headerName: '1M%',
        headerClassName: 'watchlist-1M',
        headerAlign: 'center',
        cellClassName: (params) =>
            clsx('super-app', {
                positive: params.value > 0,
                negative: params.value < 0,
                neutral: params.value == 0,
            }),
        type: 'number',
        flex: 2.0,
        width: 50,
        align: 'center'
    }
];


function createData(symbol, oneMin, fiveMin, fifteenMin, oneHour, fourHour, oneDay, oneWeek, oneMonth) {
    return {id: symbol, "1m%": oneMin, "5m%": fiveMin,
        "15m%": fifteenMin, "1h%": oneHour, "4h%": fourHour, "1d%": oneDay, "1w%": oneWeek, "1M%": oneMonth};
}

export default function Watchlist(props) {
    const [val, setVal] = useState(props.defaultVal)
  // TODO:
  // depending on which algo is selected, val will update from handleSearch
  // use val to determine which api to make to populate the rows
    const [rows, setRows] = useState([])

    const colourStyles = {
        control: styles => ({
            ...styles,
            background: 'rgb(23, 25, 35)',
            textAlign: 'left'
        }),
        option: (styles, {isFocused, isSelected}) => ({
            ...styles,
            background: isFocused
                ? 'rgb(0, 0, 0)'
                : isSelected
                    ? 'rgb(0, 0, 0)'
                    : undefined,
            zIndex: 1
        }),
        menu: base => ({
            ...base,
            color: 'rgb(203, 199, 199)',
            background: 'rgb(23, 25, 35)',
            zIndex: 100
        })
    }

    function handleSearch(val) {
        setVal(val['value'])
    }

    useEffect(async () => {
        const interval = setInterval(async () => {
            let result = await algoHandler(val)
            let tempRows = []
            for (let symbol in result) {
                if (Object.keys(result[symbol]).length === 8) {
                    tempRows.push(createData(
                        symbol,
                        result[symbol][symbol.toLowerCase() + "@kline_1m"].toFixed(2),
                        result[symbol][symbol.toLowerCase() + "@kline_5m"].toFixed(2),
                        result[symbol][symbol.toLowerCase() + "@kline_15m"].toFixed(2),
                        result[symbol][symbol.toLowerCase() + "@kline_1h"].toFixed(2),
                        result[symbol][symbol.toLowerCase() + "@kline_4h"].toFixed(2),
                        result[symbol][symbol.toLowerCase() + "@kline_1d"].toFixed(2),
                        result[symbol][symbol.toLowerCase() + "@kline_1w"].toFixed(2),
                        result[symbol][symbol.toLowerCase() + "@kline_1M"].toFixed(2)
                        )
                    )
                }
            }
            setRows(tempRows)
            }, 500)
    return () => clearInterval(interval);
    }, []);

  return (
    <div style={{ height: '16.6666666%'}} className={"watchlist"}>
      <ReactSelect
          placeholder={val}
          value={val}
          onChange={handleSearch}
          styles={colourStyles}
          options={props.watchlistOptions}
      />
      <DataGrid
        rows={rows}
        pageSize={100} // used to control the maximum number of results displayed in a scan. 100 max unless you pay
        //showCellRightBorder={true}
        columns={columns}
        disableSelectionOnClick
        onRowClick={(params, event,
                     details) => {props.handleWatchlistClick(params.id)}}
        rowHeight={'19.1'}
        disableColumnMenu={true}
        hideFooter={true}
        sortingOrder={['desc', 'asc']}
        GridLinesVisibility={"None"}
        onCellClick={() => {}}
        showColumnRightBorder={false}
        GridNoRowsOverlay={false}
      />
    </div>
  );
}