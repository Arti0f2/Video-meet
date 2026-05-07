const express = require('express')
const http = require('http')
var cors = require('cors')
const app = express()
const bodyParser = require('body-parser')
const path = require("path")
var xss = require("xss")
const fs = require('fs') // Добавляем работу с файловой системой

var server = http.createServer(app)
// Сохраняем увеличенный лимит для передачи файлов
var io = require('socket.io')(server, { pingTimeout: 60000, maxHttpBufferSize: 5e7 })

app.use(cors())
app.use(bodyParser.json())

// --- НАЧАЛО: Логика "Базы данных" в JSON файле ---
const meetingsFilePath = path.join(__dirname, 'meetings.json')

// Создаем файл, если его еще нет
if (!fs.existsSync(meetingsFilePath)) {
    fs.writeFileSync(meetingsFilePath, JSON.stringify([]))
}

// API: Получить список всех запланированных встреч
app.get('/api/meetings', (req, res) => {
    try {
        const data = fs.readFileSync(meetingsFilePath, 'utf8')
        res.json(JSON.parse(data))
    } catch (err) {
        res.status(500).json({ error: 'Failed to read meetings file' })
    }
})

// API: Запланировать новую встречу
app.post('/api/meetings', (req, res) => {
    try {
        const { title, date, url } = req.body
        if (!title || !date || !url) return res.status(400).json({ error: 'Missing required fields' })

        const data = fs.readFileSync(meetingsFilePath, 'utf8')
        const meetings = JSON.parse(data)
        
        const newMeeting = {
            id: Date.now().toString(),
            title: xss(title), // Защита от XSS
            date: xss(date),
            url: xss(url)
        }
        
        meetings.push(newMeeting)
        // Сохраняем обновленный массив обратно в файл
        fs.writeFileSync(meetingsFilePath, JSON.stringify(meetings, null, 2))
        
        res.json(newMeeting)
    } catch (err) {
        res.status(500).json({ error: 'Failed to save meeting' })
    }
})
// --- КОНЕЦ: Логика JSON-базы ---

if(process.env.NODE_ENV==='production'){
	app.use(express.static(__dirname+"/build"))
	app.get("*", (req, res) => {
		res.sendFile(path.join(__dirname+"/build/index.html"))
	})
}
app.set('port', (process.env.PORT || 4001))

sanitizeString = (str) => {
	return xss(str)
}

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

		if(messages[path] !== undefined){
			for(let a = 0; a < messages[path].length; ++a){
                let msg = messages[path][a];
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
			if(messages[key] === undefined){
				messages[key] = []
			}
            
            let isPrivate = toSocketId && toSocketId !== 'All';
			messages[key].push({"sender": sender, "data": data, "socket-id-sender": socket.id, "to": toSocketId, "isPrivate": isPrivate, "isFile": false})
			console.log("message", key, ":", sender, data, "to:", toSocketId)

            if (isPrivate) {
                io.to(toSocketId).emit("chat-message", data, sender, socket.id, true)
                if (toSocketId !== socket.id) {
                    io.to(socket.id).emit("chat-message", data, sender, socket.id, true)
                }
            } else {
                for(let a = 0; a < connections[key].length; ++a){
                    io.to(connections[key][a]).emit("chat-message", data, sender, socket.id, false)
                }
            }
		}
	})

    socket.on('chat-file', (data, sender, toSocketId, fileName) => {
		sender = sanitizeString(sender)
		fileName = sanitizeString(fileName)

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
			if(messages[key] === undefined){
				messages[key] = []
			}
            
            let isPrivate = toSocketId && toSocketId !== 'All';
			messages[key].push({"sender": sender, "data": data, "socket-id-sender": socket.id, "to": toSocketId, "isPrivate": isPrivate, "isFile": true, "fileName": fileName})
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