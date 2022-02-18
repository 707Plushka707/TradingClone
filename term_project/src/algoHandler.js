import {getPercentGainers} from "./apiCalls";
import {get15MinuteHighs} from "./apiCalls";

// NOTE: .then's output must always be either assigned to a new variable and returned outside the scope of the
// asynchronous function or returned inside the .then and passed directly to another .then.
export async function algoHandler(val) {
    let output
    if (val === "Daily Percent Gainers") {
        await getPercentGainers().then((result) => {
            return result.json()
        }).then((result) => {
            output = result
        }).catch((error) => {console.log(error)})
        return output
    }
    else if (val === "15 Minute Highs") {
        await get15MinuteHighs().then((result) => {
            return result.json()
        }).then((result) => {
            output = result
        }).catch((error) => {console.log(error)})
        return output
    }
    else {
        return {}
    }
}