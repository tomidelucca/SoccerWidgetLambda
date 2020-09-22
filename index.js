const https = require('https');
const fetch = require('node-fetch');
const msgpack = require("msgpack-lite");
const { match } = require('assert');

const RECENT_BASE = "https://api.forzafootball.net/v1/teams/%{id}/recent_matches"
const IMAGE_BASE = "https://images.footballaddicts.se/multiball"
const TEAM_LOGO = "/badges/team/thumbnail/%{id}.png"

async function main(event) {
    const teamId = event.queryStringParameters.team_id
    const url = RECENT_BASE.replace("%{id}", teamId)
    const response = await fetch(url)
    const data = await response.buffer()
    const matches = msgpack.decode(data).matches
    const last = matches.pop()
    const utcOffset = event.queryStringParameters.utc_offset == null ? 0.0 : parseFloat(event.queryStringParameters.utc_offset)

    const match = {
        my_logo: IMAGE_BASE + TEAM_LOGO.replace("%{id}", teamId),
        home_team: {
            title: calculateTitle(last.home_team, last.score, 0),
            logo: IMAGE_BASE + TEAM_LOGO.replace("%{id}", last.home_team.id)
        },
        away_team: {
            title: calculateTitle(last.away_team, last.score, 1),
            logo: IMAGE_BASE + TEAM_LOGO.replace("%{id}", last.away_team.id)
        },
        time: calculateMatchTime(last, utcOffset),
        tournament: last.tournament.name
    }

    clean(match)
    clean(match.home_team)
    clean(match.away_team)

    return match
}

function calculateTitle(team, score, index) {
    if (score == null) {
        return team.name
    }

    return mapToEmojiNumber(score.current[index]) + " " + team.name
}


const numbers = ['0️⃣', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣'];

function mapToEmojiNumber(number) {
    if (number < 0 && number > 10) {
        return number
    }

    return numbers[number]
}

function calculateMatchTime(match, utcOffset) {
    if (match.status_detail == "halftime_pause") {
        return "HT"
    }
    
    if (match.match_time.current != null) {
        var time = match.match_time.current
        if (match.match_time.added > 0) {
            time += " +" + match.match_time.added
        }
        return time + " min"
    }

    if (match.kickoff_at.buffer != null) {
        const epoch = parseInt(toHexString(match.kickoff_at.buffer), 16)
        const date = new Date((epoch + (3600 * utcOffset)) * 1000)
        const month = date.getUTCMonth() + 1;
        const day = date.getUTCDate();
        const hours = date.getUTCHours();
        const minutes = date.getUTCMinutes();
        return  day + "/" + month + " - " + hours + ":" + (minutes == 0 ? "00" : minutes)
    }

    return null
}

function toHexString(byteArray) {
    return Array.from(byteArray, function(byte) {
      return ('0' + (byte & 0xFF).toString(16)).slice(-2);
    }).join('')
  }

function clean(obj) {
    for (var propName in obj) { 
      if (obj[propName] === null || obj[propName] === undefined) {
        delete obj[propName];
      }
    }
}

exports.handler = async (event) => {
    return {
        statusCode: 200,
        body: JSON.stringify(await main(event))
    }
};