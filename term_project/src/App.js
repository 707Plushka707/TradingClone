import './App.css';
import {useEffect, useState} from 'react';
import { loadGoogleScript } from './GoogleLogin';
import Charts from "./Charts";
import Clock from 'react-live-clock';
import React from "react";
import ReactSelect from 'react-select';
import {TextField} from '@mui/material';
import {
    accBalancesAndPos,
    getFuturesOpenOrders,
    futuresPosRisk,
    getOrderRestrictions,
    getFuturesPrices,
    getWebsocketKlines, getHttpKlines
} from "./apiCalls";
import PositionTable from "./PositionTable";
import TradingButtons from "./TradingButtons";
import OrdersTable from "./OrdersTable";
import ReactNotification from 'react-notifications-component'
import {store} from 'react-notifications-component';
import 'react-notifications-component/dist/theme.css'
import Watchlist from "./Watchlist";
const googleClientId = process.env.REACT_APP_GOOGLE_CLIENT_ID;

function App() {

    // Google Authentication States //
    const [gapi, setGapi] = useState();
    const [googleAuth, setGoogleAuth] = useState();
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [imageUrl, setImageUrl] = useState();

    // Google Authentication Functions: //
    const onSuccess = (googleUser) => {
        setIsLoggedIn(true);
        const profile = googleUser.getBasicProfile();
        setName(profile.getName());
        setEmail(profile.getEmail());
        setImageUrl(profile.getImageUrl());
    };

    const onFailure = () => {
        setIsLoggedIn(false);
    }

    const logOut = () => {
        (async() => {
            await googleAuth.signOut();
            setIsLoggedIn(false);
            renderSigninButton(gapi);
        })();
    };

    const renderSigninButton = (_gapi) => {
        _gapi.signin2.render('google-signin', {
            'scope': 'profile email',
            'width': 240,
            'height': 50,
            'longtitle': true,
            'theme': 'dark',
            'onsuccess': onSuccess,
            'onfailure': onFailure
        });
    }

    // Chart States //
    const [firstTimeframe, setFirstTimeframe] = useState('D');
    const [secondTimeframe, setSecondTimeframe] = useState('240');
    const [thirdTimeframe, setThirdTimeframe] = useState('60');
    const [fourthTimeframe, setFourthTimeframe] = useState('15');
    const [fifthTimeframe, setFifthTimeframe] = useState('5');
    const [sixthTimeframe, setSixthTimeframe] = useState('1');
    const [symbol, setSymbol] = useState('BTCUSDT')

    const [options, setOptions] = useState({})

    // SearchBar States //
    const initialResults = [];
    const [queryResults, updateQueryResults] = useState(initialResults);

    useEffect(async () => {
        getWebsocketKlines() // called once (set boolean in backend that ensures it does not get called again)
    }, []);

    useEffect(async () => {
        await getFuturesPrices().then((result) => {
            let tempOptions = []
            for (let obj in result) { //each obj is a key of the json object, aka the name of a coin pair
                tempOptions.push({value: obj, label: obj})
            }
            setOptions(tempOptions)
        })
        getHttpKlines()
    }, []);

    // useEffect for Google Authentication
    useEffect(() => {
        //window.gapi is available at this point
        window.onGoogleScriptLoad = () => {

            const _gapi = window.gapi;
            setGapi(_gapi);

            _gapi.load('auth2', () => {
                (async () => {
                    const _googleAuth = await _gapi.auth2.init({
                        client_id: googleClientId
                    });
                    setGoogleAuth(_googleAuth);
                    renderSigninButton(_gapi);
                })();
            });
        }
        //ensure everything is set before loading the script
        loadGoogleScript();
    }, []);

    // val for search bar
    const [val, setVal] = useState("BTCUSDT")

    // handleSearch of search bar
    function handleSearch(val) {
        setVal(val['value'])
        setSymbol(val['value'])
    }

    // state of total account value
    const [totalMarginBalance, setTotalMarginBalance] = useState(0.0)
    // state of available balance to trade
    const [availableBalance, setAvailableBalance] = useState(0.0)

    // state of position and order tables' rows
    const [positionRows, setPositionRows] = useState([])
    const [orderRows, setOrderRows] = useState([])

    // This useEffect is called every second. It updates the account balances, positions table, and orders table
    useEffect(() => {
        const interval = setInterval(() => {
            accBalancesAndPos().then((result) =>
            {
                setTotalMarginBalance(result.totalMarginBalance)
                setAvailableBalance(result.availableBalance)

            })
            futuresPosRisk().then((result) =>
            {
                setPositionRows(result)
            })
            getFuturesOpenOrders().then((result) => {
                return result.json()
            }).then((result) => {
                setOrderRows(result)
            }).catch((error) => {
                console.log(error)
            })
        }, 2000);
        return () => clearInterval(interval);
    }, []);

    // state of trading. If false, trading buttons disappear
    const [trading, setTrading] = useState(true)

    // called when timeout button is pressed
    async function promptUser() {
        const selection = window.prompt('How many hours would you like to lock the platform for?')
        if (isNaN(selection)) {
            await promptUser()
        }
        if (selection) {
            setTrading(false)
            setTimeout(() => {setTrading(true)}, selection*3600000);
        }
    }

    // state of inputted percent change value
    const [percentLoss, setPercentLoss] = useState(5)

    // handle input changes to percent change value
    function handlePercentLoss(event) {
        if (event.target.value < 0 || event.target.value > 100) {
            console.log("percent loss must be between 0 and 100")
            setPercentLoss(5)
        } else {
            setPercentLoss(event.target.value)
        }
    }

    // state of order restrictions dictionary
    const [orderRestrictions, setOrderRestrictions] = useState({})

    // This useEffect is called only once upon load, it fills the orderRestriction dictionary
    useEffect( async () => {

        let orderRestrictionsDict = {}
        await getOrderRestrictions().then((result) => {
            let listOfSymbols = result.symbols
            for (let num in listOfSymbols) {
                let elt = listOfSymbols[num]
                const symbol = elt["symbol"]
                const filters = elt["filters"] // array of dictionaries
                const notionals = filters[5] // array of notional, filterType
                const minNotional = notionals["notional"] // minimum order amount in dollars
                const quantityPrecision = elt["quantityPrecision"]
                const pricePrecision = elt["pricePrecision"]
                orderRestrictionsDict[symbol] = {
                    "minNotional": minNotional,
                    "quantityPrecision": quantityPrecision,
                    "pricePrecision": pricePrecision
                }
            }
            setOrderRestrictions(orderRestrictionsDict)
        })
    }, [])

    // sets the symbol to the clicked position's symbol in the positions table (callback function)
    function handlePositionsClick(positionSymbol) {
        setSymbol(positionSymbol)
    }

    // set the symbol to the clicked order's symbol in the orders table (callback function)
    function handleOrdersClick(positionSymbol) {
        setSymbol(positionSymbol)
    }

    function handleWatchlistClick(positionSymbol) {
        setSymbol(positionSymbol)
        setVal(positionSymbol)
    }

    // state of crypto watchlist options
    const cryptoWatchlistOptions = [
    {value: "Daily Percent Gainers", label: "Daily Percent Gainers"},
    {value: "15 Minute Highs", label: "15 Minute Highs"},
    ]

    // constant for search bar colors
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

    return (
            <div className={'app'}>
                {!isLoggedIn &&
                <div id="google-signin"></div>}
                {isLoggedIn &&
                <div className={'signed-in-app'}>
                    <ReactNotification />
                    <div className={'bar-row'}>
                        <div className={'logout-and-text-div'}>
                            <div className={'logout-text'}>
                                Logged in as: {name} ({email})
                            </div>
                            <div className={'logout-button-div'}>
                                <button className={'logout-button'} onClick={logOut}>Log Out</button>
                            </div>
                        </div>

                        <div className={'search-box-div'}>
                            <ReactSelect
                                className={'search-box'}
                                placeholder={val}
                                value={val}
                                onChange={handleSearch}
                                styles={colourStyles}
                                options={options}/>
                        </div>

                        <div className={'timeout-div'}>
                            <button className={"timeout-button"} onClick={promptUser}> Set Timeout </button>
                        </div>

                        <div className={'percent-loss-div'}>
                            <input className={"percent-loss-text-box"} type="text" value={percentLoss}
                                   onChange={handlePercentLoss}/>
                            <div className={"percent-symbol"}>
                                %
                            </div>
                        </div>

                        <div className={'clocks'}>
                            <div className={'date-clock'}>
                                <Clock
                                    format={'dddd, MMMM Do, YYYY'}
                                    style={{fontSize: 'small'}}
                                    ticking={true}/>
                            </div>
                            <div className={'time-clock'}>
                                <Clock
                                    format={'h:mm:ss A'}
                                    style={{fontSize: 'large'}}
                                    ticking={true} />
                            </div>
                        </div>
                    </div>
                    <div className={'screener-and-charts-buttons'}>
                        <div className={"screener"}>
                            <Watchlist defaultVal={"15 Minute Highs"} watchlistOptions={cryptoWatchlistOptions}
                                       handleWatchlistClick={handleWatchlistClick}/>
                            <Watchlist defaultVal={"Daily Percent Gainers"} watchlistOptions={cryptoWatchlistOptions}
                                       handleWatchlistClick={handleWatchlistClick}/>
                            {/*<Watchlist defaultVal={"Daily Percent Gainers"} watchlistOptions={cryptoWatchlistOptions}*/}
                            {/*           handleWatchlistClick={handleWatchlistClick}/>*/}
                            {/*<Watchlist defaultVal={"Daily Percent Gainers"} watchlistOptions={cryptoWatchlistOptions}*/}
                            {/*           handleWatchlistClick={handleWatchlistClick}/>*/}
                            {/*<Watchlist defaultVal={"Daily Percent Gainers"} watchlistOptions={cryptoWatchlistOptions}*/}
                            {/*           handleWatchlistClick={handleWatchlistClick}/>*/}
                            {/*<Watchlist defaultVal={"Daily Percent Gainers"} watchlistOptions={cryptoWatchlistOptions}*/}
                            {/*           handleWatchlistClick={handleWatchlistClick}/>*/}
                            {/*<Watchlist defaultVal={"Daily Percent Gainers"} watchlistOptions={cryptoWatchlistOptions}*/}
                            {/*           handleWatchlistClick={handleWatchlistClick}/>*/}
                            {/*<Watchlist defaultVal={"Daily Percent Gainers"} watchlistOptions={cryptoWatchlistOptions}*/}
                            {/*           handleWatchlistClick={handleWatchlistClick}/>*/}
                            {/*<Watchlist defaultVal={"Daily Percent Gainers"} watchlistOptions={cryptoWatchlistOptions}*/}
                            {/*           handleWatchlistClick={handleWatchlistClick}/>*/}
                            {/*<Watchlist defaultVal={"Daily Percent Gainers"} watchlistOptions={cryptoWatchlistOptions}*/}
                            {/*           handleWatchlistClick={handleWatchlistClick}/>*/}
                            {/*<Watchlist defaultVal={"Daily Percent Gainers"} watchlistOptions={cryptoWatchlistOptions}*/}
                            {/*           handleWatchlistClick={handleWatchlistClick}/>*/}
                            {/*<Watchlist defaultVal={"Daily Percent Gainers"} watchlistOptions={cryptoWatchlistOptions}*/}
                            {/*           handleWatchlistClick={handleWatchlistClick}/>*/}
                            {/*<Watchlist defaultVal={"Daily Percent Gainers"} watchlistOptions={cryptoWatchlistOptions}*/}
                            {/*           handleWatchlistClick={handleWatchlistClick}/>*/}
                            {/*<Watchlist defaultVal={"Daily Percent Gainers"} watchlistOptions={cryptoWatchlistOptions}*/}
                            {/*handleWatchlistClick={handleWatchlistClick}/>*/}
                        </div>

                        <div className={'charts-and-buttons'}>
                            <Charts
                            firstTimeframe={firstTimeframe}
                            secondTimeframe={secondTimeframe}
                            thirdTimeframe={thirdTimeframe}
                            fourthTimeframe={fourthTimeframe}
                            fifthTimeframe={fifthTimeframe}
                            sixthTimeframe={sixthTimeframe}
                            symbol={symbol}/>
                            <div className={'pos-equity-div'}>
                                <PositionTable className={'position-table'} positionRows={positionRows} handlePositionsClick={
                                    handlePositionsClick} store={store}/>
                                <TextField className={'equity'}
                                           sx={{input: {color: 'rgb(203, 199, 199)'}, label: {color: 'rgb(203, 199, 199)'}}}
                                           label={"Total Margin Balance"}
                                           value={parseFloat(totalMarginBalance).toFixed(3)}
                                           margin={"normal"}
                                           size={'medium'}
                                           type={'number'}/>
                                <TextField className={'equity'}
                                           sx={{input: {color: 'rgb(203, 199, 199)'}, label: {color: 'rgb(203, 199, 199)'}}}
                                           label={"Available Balance"}
                                           value={parseFloat(availableBalance).toFixed(3)}
                                           margin={"normal"}
                                           size={'medium'}
                                           type={'number'}/>
                            </div>
                            <div className={'orders-trading-buttons-div'}>
                                <div className={'orders-table-div'}>
                                    <OrdersTable orderRows={orderRows} handleOrdersClick={handleOrdersClick}/>
                                </div>
                                <div className={'trading-buttons-div'}>
                                    <TradingButtons availableBalance={availableBalance} symbol={symbol} isLoggedIn={isLoggedIn}
                                                    trading={trading} orderRows={orderRows} percentLoss={percentLoss}
                                                    orderRestrictions={orderRestrictions} store={store}/>
                                </div>
                            </div>
                        </div>
                    </div>
                </div> }
            </div>)} export default App;
//