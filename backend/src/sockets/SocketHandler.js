const xss = require("xss");

class SocketHandler {
	constructor(io) {
		this.io = io;
		this.connections = {};
		this.messages = {};
		this.timeOnline = {};
		this.setup();
	}

	setup() {
		this.io.on("connection", (socket) => {
			this.handleConnection(socket);
		});
	}

	sanitize(str) {
		return xss(str);
	}

	handleConnection(socket) {
		socket.on("join-call", (path) => this.onJoinCall(socket, path));
		socket.on("signal", (toId, message) => this.onSignal(socket, toId, message));
		socket.on("chat-message", (data, sender, toSocketId) =>
			this.onChatMessage(socket, data, sender, toSocketId),
		);
		socket.on("chat-file", (data, sender, toSocketId, fileName) =>
			this.onChatFile(socket, data, sender, toSocketId, fileName),
		);
		socket.on("disconnect", () => this.onDisconnect(socket));
	}

	onJoinCall(socket, path) {
		if (this.connections[path] === undefined) {
			this.connections[path] = [];
		}
		this.connections[path].push(socket.id);
		this.timeOnline[socket.id] = new Date();

		for (let a = 0; a < this.connections[path].length; ++a) {
			this.io
				.to(this.connections[path][a])
				.emit("user-joined", socket.id, this.connections[path]);
		}

		if (this.messages[path] !== undefined) {
			for (let a = 0; a < this.messages[path].length; ++a) {
				let msg = this.messages[path][a];
				if (
					!msg.to ||
					msg.to === "All" ||
					msg.to === socket.id ||
					msg["socket-id-sender"] === socket.id
				) {
					const event = msg.isFile ? "chat-file" : "chat-message";
					const args = msg.isFile
						? [
								msg.data,
								msg.sender,
								msg["socket-id-sender"],
								msg.isPrivate,
								msg.fileName,
						  ]
						: [msg.data, msg.sender, msg["socket-id-sender"], msg.isPrivate];

					this.io.to(socket.id).emit(event, ...args);
				}
			}
		}
		console.log(`User ${socket.id} joined room: ${path}`);
	}

	onSignal(socket, toId, message) {
		this.io.to(toId).emit("signal", socket.id, message);
	}

	onChatMessage(socket, data, sender, toSocketId) {
		data = this.sanitize(data);
		sender = this.sanitize(sender);

		let roomKey = this.findUserRoom(socket.id);
		if (roomKey) {
			if (this.messages[roomKey] === undefined) this.messages[roomKey] = [];

			let isPrivate = toSocketId && toSocketId !== "All";
			this.messages[roomKey].push({
				sender,
				data,
				"socket-id-sender": socket.id,
				to: toSocketId,
				isPrivate,
				isFile: false,
			});

			if (isPrivate) {
				this.io.to(toSocketId).emit("chat-message", data, sender, socket.id, true);
				if (toSocketId !== socket.id) {
					this.io.to(socket.id).emit("chat-message", data, sender, socket.id, true);
				}
			} else {
				for (let a = 0; a < this.connections[roomKey].length; ++a) {
					this.io
						.to(this.connections[roomKey][a])
						.emit("chat-message", data, sender, socket.id, false);
				}
			}
		}
	}

	onChatFile(socket, data, sender, toSocketId, fileName) {
		sender = this.sanitize(sender);
		fileName = this.sanitize(fileName);

		let roomKey = this.findUserRoom(socket.id);
		if (roomKey) {
			if (this.messages[roomKey] === undefined) this.messages[roomKey] = [];

			let isPrivate = toSocketId && toSocketId !== "All";
			this.messages[roomKey].push({
				sender,
				data,
				"socket-id-sender": socket.id,
				to: toSocketId,
				isPrivate,
				isFile: true,
				fileName,
			});

			if (isPrivate) {
				this.io
					.to(toSocketId)
					.emit("chat-file", data, sender, socket.id, true, fileName);
				if (toSocketId !== socket.id) {
					this.io
						.to(socket.id)
						.emit("chat-file", data, sender, socket.id, true, fileName);
				}
			} else {
				for (let a = 0; a < this.connections[roomKey].length; ++a) {
					this.io
						.to(this.connections[roomKey][a])
						.emit("chat-file", data, sender, socket.id, false, fileName);
				}
			}
		}
	}

	onDisconnect(socket) {
		let diffTime = Math.abs(this.timeOnline[socket.id] - new Date());
		let roomKey = this.findUserRoom(socket.id);

		if (roomKey) {
			for (let a = 0; a < this.connections[roomKey].length; ++a) {
				this.io.to(this.connections[roomKey][a]).emit("user-left", socket.id);
			}

			let index = this.connections[roomKey].indexOf(socket.id);
			this.connections[roomKey].splice(index, 1);

			console.log(
				`User ${socket.id} left room ${roomKey}. Online: ${Math.ceil(
					diffTime / 1000,
				)}s`,
			);

			if (this.connections[roomKey].length === 0) {
				delete this.connections[roomKey];
			}
		}
		delete this.timeOnline[socket.id];
	}

	findUserRoom(socketId) {
		for (const [key, users] of Object.entries(this.connections)) {
			if (users.includes(socketId)) return key;
		}
		return null;
	}
}

module.exports = SocketHandler;
