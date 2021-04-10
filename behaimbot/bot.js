const Discord = require('discord.js');

const config = require('./config.json');
const util = require('util');

const http = require('https'); // or 'https' for https:// URLs
const fs = require('fs');

const ical = require('ical-expander');
const calendar_url = "https://calendar.google.com/calendar/ical/krqt7s1caib50l44mst7ko8884%40group.calendar.google.com/public/basic.ics";
const day_limit = 7;
const now_minute_range = 120;
const interval_minutes = 10;

//support dev mode
if (process.env.DOOFDEVMODE) {
	config.channel = config.devchannel;
}

// Initialize Discord Bot
const client = new Discord.Client();

function PostCalendarUpdate(message) {
	const ics = fs.readFileSync('file.ics', 'utf-8');
	const icalExpander = new ical({ ics, maxIterations: 1000 });
	var start = new Date();
	const raw_events = icalExpander.between(start, new Date(start.getTime() + 1000 * 60 * 60 * 24 * day_limit));

	const mappedEvents = raw_events.events.map(e => ({ startDate: e.startDate, summary: e.summary }));
	const mappedOccurrences = raw_events.occurrences.map(o => ({ startDate: o.startDate, summary: o.item.summary }));
	const events = [].concat(mappedEvents, mappedOccurrences);

	events.sort(function (a, b) {
		return a.startDate.toJSDate().getTime() - b.startDate.toJSDate().getTime();
	});
	
	summaries = [];
	time_strings = [];
	for (event of events) {
		summaries.push(event.summary);

		time_string = "";
		event.milliseconds = event.startDate.toJSDate().getTime() - (new Date()).getTime();
		if (event.milliseconds < 1000 * 60 * 30) {
			time_string = "NOW!";
		}
		else
		{
			hours = event.milliseconds / 1000 / 60 / 60;
			half_hour = hours % 1 > 0.5;
			hours = Math.floor(hours);
			hours += half_hour ? 0.5 : 0;
			days = 0;
			if (hours > 24) {
				days = Math.floor(hours / 24);
				hours -= days * 24;
			}
			time_string = days > 0 ? days + "d" : "";
			time_string += (days > 0 && hours > 0) ? " " : "";
			time_string += hours > 0 ? hours + "h" : "";
		}
		time_string = pad(Array(10).join(" "), time_string, false)
		
		time_strings.push(time_string);
	}

	final_texts = [];
	for (i = 0; i < time_strings.length; i++)
	{
		final = "`" + time_strings[i] + "` " + summaries[i];
		final_texts.push(final);
	}
			
	new_embed = {
		"embed": {
			"color": 5562730,
			"timestamp": new Date(),
			"fields": [
				{
					"name": "See More",
					"value": "http://www.doofmedia.com/calendar/",
				},
				{
					"name": pad(Array(24).join(" "), "Time", false) + "Events",
					"value": final_texts.join("\n"),
					"inline": true
				},
			]
		}
	}

	message.edit(new_embed);
}

function DoLoop(message) {
	DownloadCalendarFile(calendar_url, "file.ics", message);
	setInterval(DownloadCalendarFile, 1000 * 60 * interval_minutes, calendar_url, "file.ics", message);
}

function DownloadCalendarFile(url, dest, message) {
	var file = fs.createWriteStream(dest);
	http.get(url, function (response) {
		response.pipe(file);
		file.on('finish', function () {
			file.close((callback) => { PostCalendarUpdate(message); });
		});
	});
}

client.on('ready', () => {
	console.log(`Connected! Logged in as ${client.user.tag}`);

	var channel = client.channels.get(config.channel);
	// Fetch the most recent message in the channel. If the message was mine, time to update it!
	channel.fetchMessages({ limit: 1 }).then(messages => {
		let lastMessage = messages.first();
		if (lastMessage.author.id == client.user.id) {
			DoLoop(lastMessage)
		} else {
			channel.send("Coming Soon").then((message) => {
				DoLoop(message);
			})
			.catch(console.error);
		}
	})
	.catch(console.error);
});

client.login(process.env.BOTPASS);

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