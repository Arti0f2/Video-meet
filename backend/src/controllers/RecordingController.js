const RecordingService = require("../services/RecordingService");

class RecordingController {
	getAllRecordings(req, res) {
		const recordings = RecordingService.getAll();
		res.json(recordings);
	}

	uploadRecording(req, res) {
		res.json({
			message: "Recording successfully saved",
			file: req.file.filename,
		});
	}
}

module.exports = new RecordingController();
