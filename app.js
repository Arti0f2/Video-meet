const express = require('express')
const http = require('http')
var cors = require('cors')
const app = express()
const bodyParser = require('body-parser')
const path = require("path")
var xss = require("xss")
const fs = require('fs')
const multer = require('multer')

var server = http.createServer(app)
// Increased message size limit to ~50 MB to support file transfers in chat
var io = require('socket.io')(server, { pingTimeout: 60000, maxHttpBufferSize: 5e7 })

// --- RECORDINGS STORAGE SETUP (MULTER) ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, 'recordings');
        // Create recordings folder if it doesn't exist
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        cb(null, `recording-${Date.now()}.webm`);
    }
});
const upload = multer({ storage: storage });

app.use(cors())
app.use(bodyParser.json())
// Serve the entire recordings folder as static so videos can be viewed via link
app.use('/recordings', express.static(path.join(__dirname, 'recordings'))) 

if(process.env.NODE_ENV === 'production'){
	app.use(express.static(__dirname + "/build"))
	app.get("*", (req, res) => {
		res.sendFile(path.join(__dirname + "/build/index.html"))
	})
}
app.set('port', (process.env.PORT || 4001))

// --- MEETINGS SCHEDULING API (JSON-DB) ---
const meetingsFilePath = path.join(__dirname, 'meetings.json')
// Create meetings file if it doesn't exist yet
if (!fs.existsSync(meetingsFilePath)) {
    fs.writeFileSync(meetingsFilePath, JSON.stringify([]))
}

app.get('/api/meetings', (req, res) => {
    try {
        const data = fs.readFileSync(meetingsFilePath, 'utf8')
        res.json(JSON.parse(data))
    } catch(e) { 
        res.json([]) 
    }
})

app.post('/api/meetings', (req, res) => {
    try {
        const { title, date, url } = req.body
        const data = fs.readFileSync(meetingsFilePath, 'utf8')
        const meetings = JSON.parse(data)
        
        const newMeeting = { 
            id: Date.now().toString(), 
            title: xss(title), 
            date: xss(date), 
            url: xss(url) 
        }
        
        meetings.push(newMeeting)
        fs.writeFileSync(meetingsFilePath, JSON.stringify(meetings, null, 2))
        res.json(newMeeting)
    } catch (err) {
        res.status(500).json({ error: 'Failed to save meeting' })
    }
})

// --- RECORDINGS API ---
// Saving a new recording
app.post('/api/upload-recording', upload.single('video'), (req, res) => {
    res.json({ message: 'Recording successfully saved', file: req.file.filename });
});

// Getting the list of all recordings
app.get('/api/recordings', (req, res) => {
    const baseDir = path.join(__dirname, 'recordings');
    if (!fs.existsSync(baseDir)) return res.json([]);

    const files = fs.readdirSync(baseDir).filter(file => file.endsWith('.webm'));
    const allFiles = files.map(file => ({
        folder: 'recordings',
        name: file,
        url: `/recordings/${file}`,
        date: new Date(parseInt(file.split('-')[1])).toLocaleString()
    }));

    res.json(allFiles);
});

// --- СЕРВЕРНАЯ ЛОГИКА SOCKET.IO ---
sanitizeString = (str) => { return xss(str) }

connections = {}
messages = {}
timeOnline = {}

io.on('connection', (socket) => {

	socket.on('join-call', (path) => {
		if(connections[path] === undefined){
			connections[path] = []
		}
		connections[path].push(socket.id)
		timeOnline[socket.id] = new Date()

		for(let a = 0; a < connections[path].length; ++a){
			io.to(connections[path][a]).emit("user-joined", socket.id, connections[path])
		}

        // Отправка истории сообщений новому участнику
		if(messages[path] !== undefined){
			for(let a = 0; a < messages[path].length; ++a){
                let msg = messages[path][a];
                
                // Проверяем, имеет ли пользователь право видеть это сообщение (общие + свои приватные)
                if (!msg.to || msg.to === 'All' || msg.to === socket.id || msg['socket-id-sender'] === socket.id) {
                    if (msg.isFile) {
                        io.to(socket.id).emit("chat-file", msg.data, msg.sender, msg['socket-id-sender'], msg.isPrivate, msg.fileName)
                    } else {
                        io.to(socket.id).emit("chat-message", msg.data, msg.sender, msg['socket-id-sender'], msg.isPrivate)
                    }
                }
			}
		}

		console.log(path, connections[path])
	})

	socket.on('signal', (toId, message) => {
		io.to(toId).emit('signal', socket.id, message)
	})

    // Обработчик текстовых сообщений
	socket.on('chat-message', (data, sender, toSocketId) => {
		data = sanitizeString(data)
		sender = sanitizeString(sender)

		var key
		var ok = false
		for (const [k, v] of Object.entries(connections)) {
			for(let a = 0; a < v.length; ++a){
				if(v[a] === socket.id){
					key = k
					ok = true
				}
			}
		}

		if(ok === true){
			if(messages[key] === undefined) messages[key] = []
            
            let isPrivate = toSocketId && toSocketId !== 'All';
			messages[key].push({
                "sender": sender, 
                "data": data, 
                "socket-id-sender": socket.id, 
                "to": toSocketId, 
                "isPrivate": isPrivate, 
                "isFile": false
            })
			
            console.log("message", key, ":", sender, data, "to:", toSocketId)

            if (isPrivate) {
                // Отправляем личное сообщение получателю
                io.to(toSocketId).emit("chat-message", data, sender, socket.id, true)
                // Дублируем отправителю
                if (toSocketId !== socket.id) {
                    io.to(socket.id).emit("chat-message", data, sender, socket.id, true)
                }
            } else {
                // Публичное сообщение (всем)
                for(let a = 0; a < connections[key].length; ++a){
                    io.to(connections[key][a]).emit("chat-message", data, sender, socket.id, false)
                }
            }
		}
	})

    // Обработчик файлов в чате
    socket.on('chat-file', (data, sender, toSocketId, fileName) => {
		sender = sanitizeString(sender)
		fileName = sanitizeString(fileName)
        // Строку Base64 'data' намеренно не санируем xss(), чтобы не испортить файл

		var key
		var ok = false
		for (const [k, v] of Object.entries(connections)) {
			for(let a = 0; a < v.length; ++a){
				if(v[a] === socket.id){
					key = k
					ok = true
				}
			}
		}

		if(ok === true){
			if(messages[key] === undefined) messages[key] = []
            
            let isPrivate = toSocketId && toSocketId !== 'All';
			messages[key].push({
                "sender": sender, 
                "data": data, 
                "socket-id-sender": socket.id, 
                "to": toSocketId, 
                "isPrivate": isPrivate, 
                "isFile": true, 
                "fileName": fileName
            })
			
            console.log("file sent", key, ":", sender, fileName, "to:", toSocketId)

            if (isPrivate) {
                io.to(toSocketId).emit("chat-file", data, sender, socket.id, true, fileName)
                if (toSocketId !== socket.id) {
                    io.to(socket.id).emit("chat-file", data, sender, socket.id, true, fileName)
                }
            } else {
                for(let a = 0; a < connections[key].length; ++a){
                    io.to(connections[key][a]).emit("chat-file", data, sender, socket.id, false, fileName)
                }
            }
		}
	})

	socket.on('disconnect', () => {
		var diffTime = Math.abs(timeOnline[socket.id] - new Date())
		var key
		for (const [k, v] of JSON.parse(JSON.stringify(Object.entries(connections)))) {
			for(let a = 0; a < v.length; ++a){
				if(v[a] === socket.id){
					key = k

					for(let a = 0; a < connections[key].length; ++a){
						io.to(connections[key][a]).emit("user-left", socket.id)
					}
			
					var index = connections[key].indexOf(socket.id)
					connections[key].splice(index, 1)

					console.log(key, socket.id, Math.ceil(diffTime / 1000))

					if(connections[key].length === 0){
						delete connections[key]
					}
				}
			}
		}
	})
})

server.listen(app.get('port'), () => {
	console.log("listening on", app.get('port'))
})