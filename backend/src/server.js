const https = require("https");
const fs = require("fs");
const path = require("path");
const app = require("./app");
const SocketHandler = require("./sockets/SocketHandler");

const PORT = process.env.PORT || 4001;

const options = {
	key: fs.readFileSync(path.join(__dirname, "../key.pem")),
	cert: fs.readFileSync(path.join(__dirname, "../cert.pem")),
};

const server = https.createServer(options, app);
const io = require("socket.io")(server, {
	pingTimeout: 60000,
	maxHttpBufferSize: 5e7,
});

new SocketHandler(io);

server.listen(PORT, () => {
	console.log(`Server listening on port ${PORT}`);
});
