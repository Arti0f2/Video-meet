const fs = require("fs");
const path = require("path");
const xss = require("xss");

class MeetingService {
	constructor() {
		this.filePath = path.join(__dirname, "../../meetings.json");
		this.ensureFileExists();
	}

	ensureFileExists() {
		if (!fs.existsSync(this.filePath)) {
			fs.writeFileSync(this.filePath, JSON.stringify([]));
		}
	}

	getAll() {
		try {
			const data = fs.readFileSync(this.filePath, "utf8");
			if (!data.trim()) return [];
			return JSON.parse(data);
		} catch (e) {
			console.error("Error reading meetings:", e);
			// If file is corrupted, reset it
			fs.writeFileSync(this.filePath, JSON.stringify([]));
			return [];
		}
	}

	add(meetingData) {
		const { title, date, url } = meetingData;
		const meetings = this.getAll();

		const newMeeting = {
			id: Date.now().toString(),
			title: xss(title),
			date: xss(date),
			url: xss(url),
		};

		meetings.push(newMeeting);
		fs.writeFileSync(this.filePath, JSON.stringify(meetings, null, 2));
		return newMeeting;
	}

	update(id, meetingData) {
		const meetings = this.getAll();
		const index = meetings.findIndex((m) => m.id === id);
		if (index === -1) throw new Error("Meeting not found");

		meetings[index] = {
			...meetings[index],
			title: xss(meetingData.title) || meetings[index].title,
			date: xss(meetingData.date) || meetings[index].date,
		};

		fs.writeFileSync(this.filePath, JSON.stringify(meetings, null, 2));
		return meetings[index];
	}

	delete(id) {
		const meetings = this.getAll();
		const filtered = meetings.filter((m) => m.id !== id);
		if (meetings.length === filtered.length)
			throw new Error("Meeting not found");

		fs.writeFileSync(this.filePath, JSON.stringify(filtered, null, 2));
		return true;
	}
}

module.exports = new MeetingService();
