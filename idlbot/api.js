const config = require('./config.json');

// Where the doc is stored.
var sheetDoc = null;

function filterByID(message, pid) {
  const user = message.guild.members.get(pid);
  if (!user) {
    console.log(`Unable to find user ${pid}, they may have left the server. Consider cleaning up?`);
  }
  return user;
}

function getUserFromMention(message, mention) {
  const matches = mention.match(/^<@!?(\d+)>$/);
  if (matches) {
    const id = matches[1];
    return message.client.users.get(id);
  }
  return null;
}

function filterByName(message, pName) {
  const user = getUserFromMention(message, pName);
  if (!user) {
    return message.guild.members.find(m => m.displayName === pName);
  }
  return message.guild.members.find(m => m.id === user.id);
}

function forceDM(message, response, title) {
  if (message.channel.type !== 'dm') {
    message.channel.send('Sending via DM to avoid channel spam.');
    message.author.send(`\`\`\`${title}\n${response}\`\`\``);
    return;
  }
  message.channel.send(`\`\`\`${response}\`\`\``);
}

function capitalizeFirstLetter(string) {
	return string.charAt(0).toUpperCase() + string.slice(1);
}

// Login to google sheets
const { GoogleSpreadsheet } = require('google-spreadsheet');
async function sheetLogin() {
	const creds = require('./auth/sheets-auth.json'); // the file saved above
	let doc = new GoogleSpreadsheet('18Phu8ihjPvdGg5j4AIPSko5QuK01ahVd1UNDHJrEvtM');
	await doc.useServiceAccountAuth(creds);

	await doc.loadInfo(); // loads document properties and worksheets
	sheetDoc = doc;
	return doc;
}

// Pad function taken from:
// https://stackoverflow.com/questions/2686855/is-there-a-javascript-function-that-can-pad-a-string-to-get-to-a-determined-leng
function pad(pad, str, padLeft) {
	if (typeof str === 'undefined')
		return pad;
	if (padLeft) {
		return (pad + str).slice(-pad.length);
	} else {
		return (str + pad).substring(0, pad.length);
	}
}

async function getSheet(sheetID) {
	try {
		let sheet = sheetDoc.sheetsById[sheetID];
		await sheet.resetLocalCache();
		await sheetDoc.loadInfo();
		await sheet.loadCells();
		return sheet;
	} catch (error) {
		console.log(error);
	}
}

async function getMatchSheet(league) {
	return await getSheet(config.matchSheets[league]);
}

async function getStandingsSheet() {
	return await getSheet(config.standingsSheet.sheetID);
}

async function getRowForDate(sheet, date) {
	try {
		let startCell = config.matchSheetStructures.weekColumn + config.matchSheetStructures.startRow;
		let endCell = config.matchSheetStructures.weekColumn + sheet.rowCount;
		for (let i = config.matchSheetStructures.startRow - 1; i < sheet.rowCount; i++) {
			// Convert google sheet date format to JS date format.
			let rowDate = new Date("1899-12-30");
			rowDate.setDate(rowDate.getDate() + sheet.getCell(i, 0).value);
			let dayDiff = (rowDate.getTime() - date.getTime()) / (1000 * 60 * 60 * 24);
			if (dayDiff > -7 && dayDiff <= 0) {
				return i+1;
			}
		}
		return null;
	} catch (error) {
		console.log(error);
	}
}

async function getMatchesForDate(league, date) {
	let sheet = await getMatchSheet(league);
	try {
		let row = await getRowForDate(sheet, date);
		if (row == null) {
			return { error: "The season isn't running this week." };
		}
		let matches = {};
		for (const matchConfig of config.matchSheetStructures.matches) {
			let label = sheet.getCellByA1(matchConfig.labelCell).value;
			matches[label] = []
			for (const matchColumn of matchConfig.usernameColumns) {
				let username = sheet.getCellByA1(matchColumn + row).value;
				matches[label].push(username);
			}
		}
		return matches;
	} catch (error) {
		console.log(error);
	}
}

async function getOutcomesFromDate(league, date) {
	let sheet = await getMatchSheet(league);
	try {
		let row = await getRowForDate(sheet, date);
		if (row == null) {
			return { error: "The season isn't running this week." };
		}
		let matches = {};
		for (const matchConfig of config.matchSheetStructures.matches) {
			if (matchConfig.outcomeColumn == "") continue;
			let label = sheet.getCellByA1(matchConfig.labelCell).value;
			let outcome = sheet.getCellByA1(matchConfig.outcomeColumn + row).value;
			matches[label] = outcome;
		}
		return matches;
	} catch (error) {
		console.log(error);
	}
}

function formatMatchesMessage(title, matches) {
	let fields = [];
	for (const week of Object.keys(matches)) {
		fields.push({
			"name": "__**" + week + "**__",
			"value": '\u200b',
		});
		for (const match of Object.keys(matches[week])) {
			let players = matches[week][match];
			if (Array.isArray(players)) {
				players = players.join(" vs ");
			}
			fields.push({
				"name": match,
				"value": players,
				"inline": true
			});
		}
		fields.push({
			"name": '\u200b',
			"value": '\u200b',
		});
	}
	fields.pop();

	new_embed = {
		"embed": {
			"title": title,
			"color": 5562730,
			"timestamp": new Date(),
			"fields": fields
		}
	}
	return new_embed;
}

async function upcoming(league, message) {
	let upcomingMatches = {};
	let curDate = new Date("2019-11-19"); //new Date();
	upcomingMatches["This Week"] = await getMatchesForDate(league, curDate);
	let nextWeekDate = new Date(curDate.getTime() + 1000*60*60*24*7)
	upcomingMatches["Next Week"] = await getMatchesForDate(league, nextWeekDate);
	let embed = formatMatchesMessage("Current and Upcoming Matches in " + capitalizeFirstLetter(league), upcomingMatches);
	message.channel.send(embed);
}

async function results(league, message) {
	let upcomingMatches = {};
	let curDate = new Date("2019-11-19"); //new Date();
	upcomingMatches["This Week"] = await getOutcomesFromDate(league, curDate);
	let nextWeekDate = new Date(curDate.getTime() - 1000 * 60 * 60 * 24 * 7)
	upcomingMatches["Last Week"] = await getOutcomesFromDate(league, nextWeekDate);
	let embed = formatMatchesMessage("Recent Results in " + capitalizeFirstLetter(league), upcomingMatches);
	message.channel.send(embed);
}

function getStandingsRowForLeague(sheet, league) {
	for (let i = 1; i < sheet.rowCount; i++) {
		let cellValue = sheet.getCellByA1(config.standingsSheet.standingsRow + i).value;
		if (typeof cellValue !== "string") continue;
		cellValue = cellValue.replace(/\s+/g, '').toLowerCase()
		if (cellValue == league) return i;
	}
	return { error: "League not found." };
}

function getStandingsForLeague(sheet, startRow) {
	let standings = {};
	for (let i = startRow; i < sheet.rowCount + 1; i++) {
		let cellValue = sheet.getCellByA1(config.standingsSheet.standingsRow + i).value;
		if ((cellValue == null || typeof cellValue === "string") && Object.keys(standings).length > 1) return standings;
		if (typeof cellValue !== "number") continue;
		standings[cellValue] = sheet.getCellByA1(config.standingsSheet.usernamesRow + i).value;
	}
	if (Object.keys(standings).length > 1) return standings;
	return { error: "Error pulling rankings for league." };
}

function formatStandingsMessage(league, standings) {
	new_embed = {
		"embed": {
			"title": "Current " + capitalizeFirstLetter(league) + " Standings",
			"color": 5562730,
			"timestamp": new Date(),
			"fields": [
				{
					"name": "Rank",
					"value": Object.keys(standings).join("\n"),
					"inline": true
				},
				{
					"name": "Player",
					"value": Object.values(standings).join("\n"),
					"inline": true
				},
			]
		}
	}
	return new_embed;
}

async function standings(league, message) {
	let sheet = await getStandingsSheet(league);
	let row = getStandingsRowForLeague(sheet, league);
	let standings = getStandingsForLeague(sheet, row);
	let embed = formatStandingsMessage(league, standings);
	message.channel.send(embed);
}

module.exports = {
	sheetDoc,
	sheetLogin,
	upcoming,
	results,
	standings,
};
