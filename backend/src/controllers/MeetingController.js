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

	updateMeeting(req, res) {
		try {
			const updated = MeetingService.update(req.params.id, req.body);
			res.json(updated);
		} catch (err) {
			res.status(500).json({ error: err.message });
		}
	}

	deleteMeeting(req, res) {
		try {
			MeetingService.delete(req.params.id);
			res.json({ success: true });
		} catch (err) {
			res.status(500).json({ error: err.message });
		}
	}
}

module.exports = new MeetingController();
