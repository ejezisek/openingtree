import request from 'request'
import { parse }  from './PGNParser'
import {getTimeControlsArray, getTimeframeSteps, getSelectedTimeFrameData} from './util'
import * as Constants from './Constants'

export default class LichessIterator {

    constructor(playerName, playerColor, advancedFilters, ready, showError, stopDownloading) {
        let remainingBody = ''
        let lichessBaseURL = `https://lichess.org/api/games/user/`
        let playerNameFilter = encodeURIComponent(playerName)
        let colorFilter = `?color=${playerColor}`
        let ratedFilter = `${advancedFilters[Constants.FILTER_NAME_RATED]==="all"?"":`&rated=${advancedFilters[Constants.FILTER_NAME_RATED]==="rated"?"true":"false"}`}`
        let selectedTimeFrameData = getSelectedTimeFrameData(advancedFilters[Constants.FILTER_NAME_SELECTED_TIMEFRAME], getTimeframeSteps())
        let timeSinceFilter = `${selectedTimeFrameData.fromTimeStamp?`&since=${selectedTimeFrameData.fromTimeStamp}`:""}`
        let timeUntilFilter = `${selectedTimeFrameData.toTimeStamp?`&until=${selectedTimeFrameData.toTimeStamp}`:""}`
        let selectedTimeControls = getTimeControlsArray(Constants.SITE_LICHESS, advancedFilters, true)
        let perfFilter = selectedTimeControls.length === 0 || selectedTimeControls.length === 6?
                "" : `&perfType=${selectedTimeControls.join(",")}`
        let requestObject = request.get(
            lichessBaseURL+playerNameFilter+colorFilter+ratedFilter+perfFilter+timeSinceFilter+timeUntilFilter, 
            { json: false }).on('error', (error)=> {
                showError('failed to connect to lichess.org')
        }).on('response',(response)=>{
            if(response.statusCode === 404) {
                showError('could not find lichess user ' + playerName)
            } else if (response.statusCode !== 200) {
                showError('could not load games of lichess user ' + playerName)
            }
        }).on('data', (data) => {
            let newBody = remainingBody + data.toString();
            let lastValidPGN = newBody.lastIndexOf("\n\n\n")
            let body = newBody.slice(0, lastValidPGN).trim()

            remainingBody = newBody.slice(lastValidPGN).trim()
            let pgnsArray = body.split("\n\n\n")

            let parsedPGNs = pgnsArray.map((pgnString)=> {
                try {
                    return parse(pgnString)[0]
                } catch (e) {
                    console.log("failed to parse pgn", pgnString)
                    console.log(e)
                    return null
                }
            })

            let continueProcessing = ready(parsedPGNs.filter((pgn)=>{
                if(!pgn) {
                    return false
                }
                return pgn.headers.Variant === "Standard" &&
                    (pgn.headers.Black.toLowerCase() === playerName.toLowerCase() || pgn.headers.White.toLowerCase() === playerName.toLowerCase())
            }))

            if(!continueProcessing) {
                requestObject.abort()
            }
        }).on('end', () => {
            stopDownloading()
        })
    }
}
