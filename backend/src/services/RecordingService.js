const fs = require("fs");
const path = require("path");

class RecordingService {
	constructor() {
		this.baseDir = path.join(__dirname, "../../recordings");
		this.ensureDirExists();
	}

	ensureDirExists() {
		if (!fs.existsSync(this.baseDir)) {
			fs.mkdirSync(this.baseDir, { recursive: true });
		}
	}

	getAll() {
		if (!fs.existsSync(this.baseDir)) return [];

		const files = fs
			.readdirSync(this.baseDir)
			.filter((file) => file.endsWith(".webm"));

		return files.map((file) => ({
			folder: "recordings",
			name: file,
			url: `/recordings/${file}`,
			date: new Date(parseInt(file.split("-")[1])).toLocaleString(),
		}));
	}
}

module.exports = new RecordingService();
