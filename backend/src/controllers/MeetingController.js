const MeetingService = require("../services/MeetingService");

class MeetingController {
	getAllMeetings(req, res) {
		const meetings = MeetingService.getAll();
		res.json(meetings);
	}

	createMeeting(req, res) {
		try {
			const newMeeting = MeetingService.add(req.body);
			res.json(newMeeting);
		} catch (err) {
			res.status(500).json({ error: "Failed to save meeting" });
		}
	}
}

module.exports = new MeetingController();
