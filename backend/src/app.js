const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const path = require("path");
const multer = require("multer");
const fs = require("fs");

const MeetingController = require("./controllers/MeetingController");
const RecordingController = require("./controllers/RecordingController");

const app = express();

// --- RECORDINGS STORAGE SETUP (MULTER) ---
const storage = multer.diskStorage({
	destination: (req, file, cb) => {
		const dir = path.join(__dirname, "../recordings");
		if (!fs.existsSync(dir)) {
			fs.mkdirSync(dir, { recursive: true });
		}
		cb(null, dir);
	},
	filename: (req, file, cb) => {
		cb(null, `recording-${Date.now()}.webm`);
	},
});
const upload = multer({ storage: storage });

// --- MIDDLEWARE ---
app.use(cors());
app.use(bodyParser.json());
app.use("/recordings", express.static(path.join(__dirname, "../recordings")));

// Static files for production
if (process.env.NODE_ENV === "production") {
	app.use(express.static(path.join(__dirname, "../../frontend/build")));
}

// --- API ROUTES ---
app.get("/api/meetings", MeetingController.getAllMeetings);
app.post("/api/meetings", MeetingController.createMeeting);

app.get("/api/recordings", RecordingController.getAllRecordings);
app.post(
	"/api/upload-recording",
	upload.single("video"),
	RecordingController.uploadRecording,
);

// Fallback for React Router in production
if (process.env.NODE_ENV === "production") {
	app.get("*", (req, res) => {
		res.sendFile(path.join(__dirname, "../../frontend/build/index.html"));
	});
}

module.exports = app;
