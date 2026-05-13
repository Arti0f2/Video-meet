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
			date: this.getDateFromFilename(file),
		}));
	}

	getDateFromFilename(filename) {
		const parts = filename.split("-");
		if (parts.length < 2) return "Unknown date";
		const timestamp = parseInt(parts[1]);
		return isNaN(timestamp)
			? "Unknown date"
			: new Date(timestamp).toLocaleString();
	}

	rename(oldName, newName) {
		const oldPath = path.join(this.baseDir, oldName);
		// Ensure new name ends with .webm
		if (!newName.endsWith(".webm")) newName += ".webm";
		const newPath = path.join(this.baseDir, newName);

		if (!fs.existsSync(oldPath)) throw new Error("File not found");
		if (fs.existsSync(newPath))
			throw new Error("File with this name already exists");

		fs.renameSync(oldPath, newPath);
		return { name: newName, url: `/recordings/${newName}` };
	}

	delete(name) {
		const filePath = path.join(this.baseDir, name);
		if (!fs.existsSync(filePath)) throw new Error("File not found");

		fs.unlinkSync(filePath);
		return true;
	}
}

module.exports = new RecordingService();
