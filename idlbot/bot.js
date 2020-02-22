const Discord = require('discord.js');

const config = require('./config.json');
const api = require('./api.js');
const util = require('util')

//support dev mode
if (process.env.DOOFDEVMODE) {
	config.channel = config.devchannel;
}

// Initialize Discord Bot
const client = new Discord.Client();

client.on('ready', () => {
	console.log(`Connected! Logged in as ${client.user.tag}`);
	api.sheetDoc = api.sheetLogin();
});

function bounceDM(message) {
	if (message.channel.type === 'dm') {
		message.channel.send('Command not supported in DM.');
		return true;
	}
	return false;
}

function help(message) {
	message.channel.send(`\`\`\`Use this bot to get quick info on the IDL!
The current leagues available are ${Object.keys(config.matchSheets).join(", ")}
Commands:
  ${config.prefix}HELP                 this message
  ${config.prefix}standings LEAGUE	see the current standings for a certain league.
  ${config.prefix}upcoming LEAGUE	see the upcoming matches in a league.
  ${config.prefix}results LEAGUE	see previous round's results for a specific league. 
  \`\`\``);
}

client.on('message', async (message) => {
	try {
		// TODO Restrict from even processing messages outside of this channel to cut usage.
		if ((message.channel.id !== config.channel && message.channel.type === 'dm')
			|| message.content.substring(0, config.prefix.length) !== config.prefix
			|| message.author.bot) {
			return;
		}


		const args = message.content.substring(config.prefix.length).split(' ');
		const [cmd, league] = args;

		switch (cmd.toLowerCase()) {
			case 'help':
				help(message);
				break;
			case 'upcoming':
				if (bounceDM(message)) { break; }
				if (args.length !== 2) {
					message.channel.send(`\`\`\`usage: ${config.prefix}upcoming LEAGUE\`\`\``);
					break;
				}
				api.upcoming(league, message);
				break;
			case 'results':
				if (bounceDM(message)) { break; }
				if (args.length !== 2) {
					message.channel.send(`\`\`\`usage: ${config.prefix}results LEAGUE\`\`\``);
					break;
				}
				api.results(league, message);
				break;
			case 'standings':
				if (bounceDM(message)) { break; }
				if (args.length !== 2) {
					message.channel.send(`\`\`\`usage: ${config.prefix}standings LEAGUE\`\`\``);
					break;
				}
				api.standings(league, message);
				break;
			default:
		}
	} catch (error) {
		message.channel.send(`Caught error ${error}, please ping Elliot for help.`);
	}
});

client.login(process.env.BOTPASS);