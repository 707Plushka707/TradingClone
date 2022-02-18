import React from 'react';
import {useState} from "react";
import './App.css';
import {
    accBalancesAndPos,
    binance,
    getBidAndAsk, limitBuy, limitSell,
    sendBuyOrder, sendLimitOrder,
    sendSellOrder,
    sendStopOrder
} from "./apiCalls";

function TradingButtons(props) {

    // Function to Buy Market with a x% stop loss determined by the inputted stop field
    async function buySafe() {
        let maxLeverage // adjust leverage to maximum for the given symbol
        await binance.futuresLeverageBracket(props.symbol).then((result) => { // gets the leverage brackets
            const obj = result[0]
            const brackets = obj["brackets"]
            const topBracket = brackets[0]
            maxLeverage = topBracket["initialLeverage"]
        })

        await binance.futuresLeverage(props.symbol, maxLeverage) // sets the leverage to max for the current symbol

        let currentPrice  // get the current price for position sizing
        await binance.futuresPrices().then((result) => { // gets the current price of the symbol
            currentPrice = result[props.symbol]
            console.log(currentPrice)
        })

        // redefine stop for the purposes of rounding (parse as float bc it is string in text box):
        let tradeStop = parseFloat(stop)

        if (tradeStop < currentPrice) { // only execute if curr stop is less than price (otherwise error)
            const stopDistance = currentPrice - tradeStop // calc the distance to the stop.
            const loss = props.availableBalance * props.percentLoss / 100 // get the loss in terms of the avail bal

            let quantity = loss / stopDistance // quantity to trade

            const securityRestrictionsDict = props.orderRestrictions[props.symbol] // get security dict
            const minNotional = securityRestrictionsDict["minNotional"] // min amt to trade for symbol
            const quantityPrecision = securityRestrictionsDict["quantityPrecision"] // quant precision for symbol
            const pricePrecision = securityRestrictionsDict["pricePrecision"] //  price precision for symbol

            quantity = Math.floor(quantity * Math.pow(10, quantityPrecision)) / Math.pow(10, quantityPrecision)

            // check if quantity is above minQuantity = minNotional / currentPrice
            const minQuantity = minNotional / currentPrice

            if (quantity < minQuantity) { // if the quantity calculated is less to trade, then error
                throw "Quantity is less than minimum required to trade."
            }

            tradeStop = tradeStop.toFixed(pricePrecision) // round off stop price to pricePrecision for symbol

            const buyOrder = { // sets up market buy
                "symbol": props.symbol,
                "type": "MARKET",
                "side": "BUY",
                "quantity": quantity
            };

            const stopOrder = { // sets up stop order with stop price and quantity
                "symbol": props.symbol,
                "type": "STOP_MARKET",
                "side": "SELL",
                "quantity": quantity,
                "stopPrice": tradeStop
            };

            const buyPost = { // buy post to python backend
                method: "POST",
                headers: {
                    'Content-Type': 'application/json;charset=UTF-8',
                },
                body: JSON.stringify(buyOrder),
            };

            const stopPost = { // stop post to python backend
                method: "POST",
                headers: {
                    'Content-Type': 'application/json;charset=UTF-8',
                },
                body: JSON.stringify(stopOrder),
            };

            await sendBuyOrder(buyPost).then((result) => { // send buy post to backend (includes buy order)
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

            await sendStopOrder(stopPost).then((result) => { // send stop post to backend (includes stop order)
                return result.json()
            }).then((result) => {
                if ("error" in result) { // we send a dict back with key 'error' if binance returns error
                    failureMessage(result.toString()) // add to notification manager
                } else { // message from binance upon success
                    let message = result["origType"] + " " + result["side"] + " for " + result["origQty"] + " "
                        + result["symbol"] + " at " + result["stopPrice"] + " filled."
                    successMessage(message) // add to notification manager
                }
            })
        }
        else {
            if (stop) { // return error if stop is > curr price or there is no stop set
                throw "Stop is greater than current price."
            } else {
                throw "Stop is not set."
            }
        }
    }

    // Function to Sell the Market with a x% stop loss determined by the inputted stop field
    async function sellSafe() {
        let maxLeverage // get the max leverage for the symbol and set it for symbol
        await binance.futuresLeverageBracket(props.symbol).then((result) => {
            const obj = result[0]
            const brackets = obj["brackets"]
            const topBracket = brackets[0]
            maxLeverage = topBracket["initialLeverage"]
        })

        await binance.futuresLeverage(props.symbol, maxLeverage) // set leverage for symbol

        let currentPrice
        await binance.futuresPrices().then((result) => { // get current price
            currentPrice = result[props.symbol]
        })

        let tradeStop = parseFloat(stop) // redefine stop for the purposes of rounding

        if (tradeStop > currentPrice) { // if stop is greater than current price (selling short) do not execute
            const stopDistance = tradeStop - currentPrice // cacle stop distance from price to stop
            const loss = props.availableBalance * props.percentLoss / 100 // calc loss from percent change

            let quantity = loss / stopDistance // derive quantity from this value

            // get min notional, quantity and price precision for the security
            const securityRestrictionsDict = props.orderRestrictions[props.symbol]
            const minNotional = securityRestrictionsDict["minNotional"]
            const quantityPrecision = securityRestrictionsDict["quantityPrecision"]
            const pricePrecision = securityRestrictionsDict["pricePrecision"]

            quantity = Math.floor(quantity * Math.pow(10, quantityPrecision)) / Math.pow(10, quantityPrecision)

            // check if quantity is above minQuantity = minNotional / currentPrice
            const minQuantity = minNotional / currentPrice

            if (quantity < minQuantity) { // throw error if min is less than req to trde
                throw "Quantity is less than minimum required to trade."
            }

            tradeStop = tradeStop.toFixed(pricePrecision)  // round off stop price to pricePrecision

            const sellOrder = { // sell order to send
                "symbol": props.symbol,
                "type": "MARKET",
                "side": "SELL",
                "quantity": quantity
            };

            const stopOrder = { // buy stop order to send
                "symbol": props.symbol,
                "type": "STOP_MARKET",
                "side": "BUY",
                "quantity": quantity,
                "stopPrice": tradeStop
            };

            const sellPost = { // sell post to send to backend
                method: "POST",
                headers: {
                    'Content-Type': 'application/json;charset=UTF-8',
                },
                body: JSON.stringify(sellOrder),
            };

            const stopPost = { // stop post to send to backend
                method: "POST",
                headers: {
                    'Content-Type': 'application/json;charset=UTF-8',
                },
                body: JSON.stringify(stopOrder),
            };

            await sendSellOrder(sellPost).then((result) => { // sends order to backend
                return result.json()
            }).then((result) => {
                console.log(result)
                if ("error" in result) { // error handling
                    failureMessage(result["error"])
                    throw("Sell did not fill, so stop was canceled.")
                } else {
                    let message = result["origType"] + " " + result["side"] + " for " + result["origQty"] +
                        " " + result["symbol"] + " filled."
                    successMessage(message)
                }
            })

            await sendStopOrder(stopPost).then((result) => { // sends stop order to backend
                return result.json()
            }).then((result) => {
                console.log(result)
                if ("error" in result) { // error handling
                    failureMessage(result["error"])
                } else {
                    let message = result["origType"] + " " + result["side"] + " for " + result["origQty"] + " "
                        + result["symbol"] + " at " + result["stopPrice"] + " filled."
                    successMessage(message)
                }
            })
        }
        else { // throw errors if stop is less than current price or stop isn't set
            if (stop) {
                throw "Stop is less than current price."
            } else {
                throw "Stop is not set."
            }
        }
    }

    // Function to Buy the current Market Price (need quantity to be populated)
    async function buyMarket() {
        if (!quantity) { // need quantity for market order
            throw "Quantity to buy not set."
        }
        let currentPrice // get current price
        await binance.futuresPrices().then((result) => {
            currentPrice = result[props.symbol]
        })

        const securityRestrictionsDict = props.orderRestrictions[props.symbol] // gets restrictions
        const minNotional = securityRestrictionsDict["minNotional"]
        const quantityPrecision = securityRestrictionsDict["quantityPrecision"]

        // multiply by 10^quantityprecision, floor, divide by 10^quantityprecision in order to keep appropriate # digits
        const roundedQuantity = Math.floor(parseFloat(quantity) * Math.pow(10, quantityPrecision)) / Math.pow(10, quantityPrecision)

        // check if quantity is above minQuantity = minNotional / currentPrice
        const minQuantity = minNotional / currentPrice
        console.log(minQuantity)

        if (roundedQuantity < minQuantity) { // throw error if quantity is less than req. to trade
            throw "Quantity is less than minimum required to trade."
        }

        const buyOrder = { // buy order
            "symbol": props.symbol,
            "type": "MARKET",
            "side": "BUY",
            "quantity": roundedQuantity
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

    // Function to Sell the current Market Price (need quantity to be populated)
    async function sellMarket() {
        if (!quantity) { // throw error is stop not set
            throw "Quantity to sell not set."
        }
        let currentPrice // get current price
        await binance.futuresPrices().then((result) => {
            currentPrice = result[props.symbol]
        })

        const securityRestrictionsDict = props.orderRestrictions[props.symbol] // get symbol restrictions
        const minNotional = securityRestrictionsDict["minNotional"]
        const quantityPrecision = securityRestrictionsDict["quantityPrecision"]

        // multiply by 10^quantityprecision, floor, divide by 10^quantityprecision in order to keep appropriate # digits
        const roundedQuantity = Math.floor(parseFloat(quantity) * Math.pow(10, quantityPrecision)) / Math.pow(10, quantityPrecision)
        // check if quantity is above minQuantity = minNotional / currentPrice
        const minQuantity = minNotional / currentPrice

        if (roundedQuantity < minQuantity) { // throw error if rounded quantity is less than req. to trade
            throw "Quantity is less than minimum required to trade."
        }
        const sellOrder = { // sell order
            "symbol": props.symbol,
            "type": "MARKET",
            "side": "SELL",
            "quantity": roundedQuantity
        };

        const sellPost = { // post to backend
            method: "POST",
            headers: {
                'Content-Type': 'application/json;charset=UTF-8',
            },
            body: JSON.stringify(sellOrder),
        };

        await sendSellOrder(sellPost).then((result) => { // sends market sell order to backend
            return result.json()
        }).then((result) => {
            if ("error" in result) { // error handling
                failureMessage(result["error"])
            } else {
                let message = result["origType"] + " " + result["side"] + " for " + result["origQty"] +
                    " " + result["symbol"] + " filled."
                successMessage(message)
            }
        })
    }

    // function to join the bid (place buy order at the bid)
    async function joinTheBid() {
        if (!quantity) {
            throw "Quantity not set."
        }
        let bid
        await getBidAndAsk(props.symbol).then((result) => {
            bid = result['bidPrice']
        })
        if (bid !== undefined) {
            const limitOrder = { // sell order
                "symbol": props.symbol,
                "type": "LIMIT",
                "side": "BUY",
                "price": bid,
                "quantity": quantity
            };

            const limitPost = { // post to backend
                method: "POST",
                headers: {
                    'Content-Type': 'application/json;charset=UTF-8',
                },
                body: JSON.stringify(limitOrder),
            };

            await sendLimitOrder(limitPost).then((result) => { // sends market sell order to backend
                return result.json()
            }).then((result) => {
                if ("error" in result) { // error handling
                    failureMessage(result["error"])
                } else {
                    console.log(result)
                    let message = result["origType"] + " " + result["side"] + " for " + result["origQty"] +
                        " " + result["symbol"] + " placed."
                    successMessage(message)
                }
            })
        }
    }

    // function to buy the current ask price
    async function buyTheAsk() {
        if (!quantity) {
            throw "Quantity not set."
        }
        let ask
        await getBidAndAsk(props.symbol).then((result) => {
            console.log(result)
            ask = result['askPrice']
        })
        if (ask !== undefined) {
            const limitOrder = { // sell order
                "symbol": props.symbol,
                "type": "LIMIT",
                "side": "BUY",
                "price": ask,
                "quantity": quantity
            };

            const limitPost = { // post to backend
                method: "POST",
                headers: {
                    'Content-Type': 'application/json;charset=UTF-8',
                },
                body: JSON.stringify(limitOrder),
            };

            await sendLimitOrder(limitPost).then((result) => { // sends market sell order to backend
                return result.json()
            }).then((result) => {
                if ("error" in result) { // error handling
                    failureMessage(result["error"])
                } else {
                    let message = result["origType"] + " " + result["side"] + " for " + result["origQty"] +
                        " " + result["symbol"] + " Placed."
                    successMessage(message)
                }
            })
        }
    }

    // function to sell the current ask price
    async function joinTheAsk() {
        if (!quantity) {
            throw "Quantity not set."
        }
        let ask
        await getBidAndAsk(props.symbol).then((result) => {
            ask = result['askPrice']
        })
        if (ask !== undefined) {
            const limitOrder = { // sell order
                "symbol": props.symbol,
                "type": "LIMIT",
                "side": "SELL",
                "price": ask,
                "quantity": quantity
            };

            const limitPost = { // post to backend
                method: "POST",
                headers: {
                    'Content-Type': 'application/json;charset=UTF-8',
                },
                body: JSON.stringify(limitOrder),
            };

            await sendLimitOrder(limitPost).then((result) => { // sends market sell order to backend
                return result.json()
            }).then((result) => {
                if ("error" in result) { // error handling
                    failureMessage(result["error"])
                } else {
                    let message = result["origType"] + " " + result["side"] + " for " + result["origQty"] +
                        " " + result["symbol"] + " Placed."
                    successMessage(message)
                }
            })
        }
    }

    // function to sell the current bid price
    async function sellTheBid() {
        if (!quantity) {
            throw "Quantity not set."
        }
        let bid
        await getBidAndAsk(props.symbol).then((result) => {
            bid = result['bidPrice']
        })
        if (bid !== undefined) {
            const limitOrder = { // sell order
                "symbol": props.symbol,
                "type": "LIMIT",
                "side": "SELL",
                "price": bid,
                "quantity": quantity
            };

            const limitPost = { // post to backend
                method: "POST",
                headers: {
                    'Content-Type': 'application/json;charset=UTF-8',
                },
                body: JSON.stringify(limitOrder),
            };

            await sendLimitOrder(limitPost).then((result) => { // sends market sell order to backend
                return result.json()
            }).then((result) => {
                if ("error" in result) { // error handling
                    failureMessage(result["error"])
                } else {
                    let message = result["origType"] + " " + result["side"] + " for " + result["origQty"] +
                        " " + result["symbol"] + " placed."
                    successMessage(message)
                }
            })
        }
    }

    // function to flatten the current trade
    async function flatten() {
        let response = await accBalancesAndPos() // get current positions for given symbol
        let positions = response.positions
        for (let index in positions) {
            const currentPosition = positions[index]
            if (currentPosition["symbol"] === props.symbol) {
                if (parseFloat(currentPosition["positionAmt"]) > 0) { // if we have a position, sell
                    const sellOrder = {
                        "symbol": props.symbol,
                        "type": "MARKET",
                        "side": "SELL",
                        "quantity": currentPosition["positionAmt"]
                    };

                    const sellPost = {
                        method: "POST",
                        headers: {
                            'Content-Type': 'application/json;charset=UTF-8',
                        },
                        body: JSON.stringify(sellOrder),
                    };

                    await sendSellOrder(sellPost).then((result) => {
                        return result.json()
                    }).then((result) => {
                        if ("error" in result) {
                            failureMessage(result["error"])
                        } else {
                            let message = result["origType"] + " " + result["side"] + " for " + result["origQty"] +
                                " " + result["symbol"] + " filled."
                            successMessage(message)
                        }
                    })
                }
                else if (parseFloat(currentPosition["positionAmt"]) < 0) { // if we have a short, buy
                    const buyOrder = {
                        "symbol": props.symbol,
                        "type": "MARKET",
                        "side": "BUY",
                        "quantity": -parseFloat(currentPosition["positionAmt"])
                    };
                    const buyPost = {
                        method: "POST",
                        headers: {
                            'Content-Type': 'application/json;charset=UTF-8',
                        },
                        body: JSON.stringify(buyOrder),
                    };

                    await sendBuyOrder(buyPost).then((result) => {
                        return result.json()
                    }).then((result) => {
                        if ("error" in result) {
                            failureMessage(result["error"])
                        } else {
                            let message = result["origType"] + " " + result["side"] + " for " + result["origQty"] +
                                " " + result["symbol"] + " filled."
                            successMessage(message)
                        }
                    })
                }
                else { // otherwise, we don't have a position
                    throw "No position to flatten for given symbol."
                }
                await binance.futuresCancelAll(props.symbol) // cancel all orders associated
            }
        }
    }

    // state variables for Quantity, Price, and Stop buttons
    const [quantity, setQuantity] = useState(null)
    const [price, setPrice] = useState(null)
    const [stop, setStop] = useState(null)

    // handles text changes for quantity
    function handleQuantity(event) {
        setQuantity(event.target.value)
    }

    // handles text changes for price
    function handlePrice(event) {
        setPrice(event.target.value)
    }

    // handles text changes for stop
    function handleStop(event) {
        setStop(event.target.value)
    }

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

    return (
            <div className={'trading-buttons'}>
                <div className={"trading-flex-row"}>
                    <div className={'symbol-and-flatten'}>
                        <div className={"symbol-input-div"}>
                            <input className={'symbol-text'} type="text" value={props.symbol} contentEditable={false}
                                   readOnly={true}/>
                        </div>
                        <div className={"flatten-button-div"}>
                            <button className={'flatten-button'} onClick={() => {flatten()}}>
                                Flatten </button>
                        </div>
                    </div>
                </div>

                <div className={"trading-flex-row"}>
                    <div className={'qty-price-stop-inputs'}>
                        <input className={"input-style"} type="text" value={quantity} onChange={handleQuantity}
                               placeholder="QTY"/>
                        <input className={"input-style"} type="text" value={price} onChange={handlePrice}
                               placeholder="PRICE"/>
                        <input className={"input-style"} type="text" value={stop} onChange={handleStop}
                               placeholder="STOP"/>
                    </div>
                </div>

                <div className={"trading-flex-row"}>
                    {props.trading &&
                    <div className={'buy-buttons'}>
                        <button className={"buy-button-style"} onClick={() => {buySafe().catch((error) =>
                        {failureMessage(error)})}}>
                            Buy Safe
                        </button>
                        <button className={"buy-button-style"} onClick={() => {buyMarket().catch((error) =>
                            {
                                failureMessage(error)
                            })}}>
                            Buy Market
                        </button>
                        <button className={"buy-button-style"} onClick={() => {joinTheBid().catch((error) => {
                            failureMessage(error)
                        })}}>
                            Join the Bid
                        </button>
                        <button className={"buy-button-style"} onClick={() => {buyTheAsk().catch((error) => {
                            failureMessage(error)
                        })}}>
                            Buy the Ask
                        </button>
                    </div>}
                </div>

                <div className={"trading-flex-row"}>
                    {props.trading &&
                    <div className={'sell-buttons'}>
                        <button className={"sell-button-style"} onClick={() => {sellSafe().catch((error) =>
                        {failureMessage(error)})}}>
                            Sell Safe
                        </button>
                        <button className={"sell-button-style"} onClick={() => {sellMarket().catch((error) =>
                        {failureMessage(error)})}}>
                            Sell Market
                        </button>
                        <button className={"sell-button-style"} onClick={() => {joinTheAsk().catch((error) => {
                            failureMessage(error)
                        })}}>
                            Join the Ask
                        </button>
                        <button className={"sell-button-style"} onClick={() => {sellTheBid().catch((error) => {
                            failureMessage(error)
                        })}}>
                            Sell the Bid
                        </button>
                    </div>}
                </div>

            </div>)
}

export default TradingButtons;