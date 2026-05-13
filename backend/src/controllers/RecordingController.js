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

	renameRecording(req, res) {
		try {
			const { oldName, newName } = req.body;
			const result = RecordingService.rename(oldName, newName);
			res.json(result);
		} catch (err) {
			res.status(500).json({ error: err.message });
		}
	}

	deleteRecording(req, res) {
		try {
			const { name } = req.params;
			RecordingService.delete(name);
			res.json({ success: true });
		} catch (err) {
			res.status(500).json({ error: err.message });
		}
	}
}

module.exports = new RecordingController();
