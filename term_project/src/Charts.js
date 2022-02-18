import TradingViewWidget, {Themes} from "react-tradingview-widget";

function Charts(props) {

    return(
        <div className="container">
            <div className={'flex-chart-row'}>
                <div className={'chart'}>
                    <TradingViewWidget symbol={props.symbol} theme={Themes.DARK} locale="eng" autosize
                                       interval={props.firstTimeframe} timezone="America/New_York"/>
                </div>
                <div className={'chart'}>
                    <TradingViewWidget symbol={props.symbol} theme={Themes.DARK} locale="eng" autosize
                                       interval={props.secondTimeframe} timezone="America/New_York"/>
                </div>
                <div className={'chart'}>
                    <TradingViewWidget symbol={props.symbol} theme={Themes.DARK} locale="eng" autosize
                                       interval={props.thirdTimeframe} timezone="America/New_York"/>
                </div>
            </div>
            <div className={'flex-chart-row'}>
                <div className={'chart'}>
                    <TradingViewWidget symbol={props.symbol} theme={Themes.DARK} locale="eng" autosize
                                       interval={props.fourthTimeframe} timezone="America/New_York"/>
                </div>
                <div className={'chart'}>
                    <TradingViewWidget symbol={props.symbol} theme={Themes.DARK} locale="eng" autosize
                                       interval={props.fifthTimeframe} timezone="America/New_York"/>
                </div>
                <div className={'chart'}>
                    <TradingViewWidget symbol={props.symbol} theme={Themes.DARK} locale="eng" autosize
                                       interval={props.sixthTimeframe} timezone="America/New_York"/>
                </div>
            </div>
        </div>

    )
} export default Charts;