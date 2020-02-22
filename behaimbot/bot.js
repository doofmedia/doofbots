const Discord = require('discord.js');

const config = require('./config.json');
const util = require('util')

const ical = require('node-ical');
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

function AddEvent(event, events, start_time, end_time) {
	var milliseconds = event.start.getTime() - start_time;
	if (milliseconds < -1000 * 60 * now_minute_range || milliseconds > end_time) return;
	events.push({ milliseconds, summary: event.summary });
}

function AddRecurringEvent(event, events, start_time, end_time) {
	var day_buffer = 1000 * 60 * 60 * 24; // account for time zones
	var start_time_range = new Date(start_time.getTime() - day_buffer);
	var end_time_range = new Date(start_time.getTime() + end_time + day_buffer);
	var dates = event.rrule.between(
		start_time_range,
		end_time_range,
		true,
		function (date, i) { return true; }
	);

	for (var date of dates) {
		var formatted_date = date.toISOString().substr(0, 10);
		// Skip this date if it's been edited to be custom (dealt with below).
		if (typeof event.recurrences !== 'undefined' && Object.keys(event.recurrences).includes(formatted_date)) continue;
		// Skip this date if it's been deleted.
		if (typeof event.exdate !== 'undefined' && Object.keys(event.exdate).includes(formatted_date)) continue;
		var ev = {
			summary: event.summary,
			start: new Date(date)
		}
		AddEvent(ev, events, start_time, end_time)
	}

	// Get altered recurrences.
	if (event.recurrences != undefined) {
		for (var rec of Object.values(event.recurrences)) {
			AddEvent(rec, events, start_time, end_time)
		}
	}
}

function PostCalendarUpdate(message) {
	ical.fromURL(calendar_url, {}, function (err, data) {
		var start_time = new Date();
		var end_time = 1000 * 60 * 60 * 24 * day_limit;
		var events = [];
		for (let k in data) {
			if (data.hasOwnProperty(k)) {
				var ev = data[k];
				if (data[k].type != 'VEVENT') continue;
				if (typeof data[k].rrule !== 'undefined') {
					AddRecurringEvent(data[k], events, start_time, end_time);
				} else {
					AddEvent(ev, events, start_time, end_time)
				}
			}
		}
		events.sort(function (a, b) {
			return a.milliseconds - b.milliseconds;
		});
		summaries = [];
		time_strings = [];
		for (event of events) {
			summaries.push(event.summary);

			time_string = "";
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
	});
}

function DoLoop(message) {
	PostCalendarUpdate(message);
	setInterval(PostCalendarUpdate, 1000 * 60 * interval_minutes, message);
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
			.catch(console.error);;
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