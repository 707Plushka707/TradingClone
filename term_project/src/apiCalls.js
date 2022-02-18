// GLOBAL ENVIRONMENT VARIABLES
//const api_key = process.env.API_KEY
//const secret_key = process.env.SECRET_KEY

//start websocket
export async function getWebsocketKlines() {
    const getWebsocketKlines = {
        method: "GET",
        // headers: {
        //     'Content-Type': 'application/json;charset=UTF-8',
        // },
        // body: JSON.stringify(""),
    };
    return await fetch('http://localhost:8000/api/getWebsocketKlines/', getWebsocketKlines)
}

export async function getHttpKlines() {
    const getHttpKlines = {
        method: "GET",
    };
    return await fetch('http://localhost:8000/api/getHttpKlines/', getHttpKlines)
}

// gets data for percent gainers scan
export async function getPercentGainers() {
    const getPercentGainers = {
        method: "GET",
    };
    return await fetch('http://localhost:8000/api/getPercentGainers/', getPercentGainers)
}

// gets data for percent gainers scan
export async function get15MinuteHighs() {
    const get15MinuteHighs = {
        method: "GET",
    };
    return await fetch('http://localhost:8000/api/get15MinuteHighs/', get15MinuteHighs)
}

// gets orders for orders table
export async function getFuturesOpenOrders() {
    const getFuturesOpenOrders = {
        method: "GET",
    };
    return await fetch('http://localhost:8000/api/getFuturesOpenOrders/', getFuturesOpenOrders)
}

// send buy order to backend
export async function sendBuyOrder(buyPost) {
    return await fetch('http://localhost:8000/api/market/', buyPost)
}

// send sell order to backend
export async function sendSellOrder(sellPost) {
    return await fetch('http://localhost:8000/api/market/', sellPost)
}

// send stop order to backend
export async function sendStopOrder(stopPost) {
    return await fetch('http://localhost:8000/api/stop/', stopPost)
}

export async function sendLimitOrder(limitPost) {
    return await fetch('http://localhost:8000/api/limit/', limitPost)
}

// Functions from Node Binance API
const Binance = require('node-binance-api');

export const binance = new Binance().options({
    APIKEY: "LxxlvPJTckWPKGTEsoIWa5eCpytCTDqAizP7JAzuzGKLKZiPhx368sWTHABV1vMN",
    APISECRET: "a30pZsNVNctmHKKuFCabCfbrLWyCVgCSWaH2UFfpatS4fSaQJF9kOXfJrWIOsoIe"
});

// result is a json object with coin keys and last market price values
export async function getFuturesPrices() {
    return await binance.futuresPrices().catch((error) => {console.log(error)})
}

// function to get account information
export async function accBalancesAndPos() {
    return await binance.futuresAccount().catch((error) => {console.log(error)})
}

// function to get order restrictions (called once at startup of application)
export async function getOrderRestrictions() {
    //console.info(await binance.futuresExchangeInfo())
    return await binance.futuresExchangeInfo().catch((error) => {console.log(error)})
}

// gets positions for position table
export async function futuresPosRisk() {
    return await binance.futuresPositionRisk().catch((error) => {console.log(error)})
}

// function to get the bid and ask for a symbol
export async function getBidAndAsk(symbol) {
    return await binance.futuresQuote(symbol)
}