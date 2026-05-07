import React, { Component } from 'react';
import { Input, Button, IconButton, TextField } from '@material-ui/core'; 
import GitHubIcon from '@material-ui/icons/GitHub';
import "./Home.css"

const server_url = process.env.NODE_ENV === 'production' ? 'https://video.sebastienbiollo.com' : "http://localhost:4001"

class Home extends Component {
  	constructor (props) {
		super(props)
		this.state = {
			url: '',
            meetings: [], 
            recordings: [], // Архив записей с сервера
            newMeetingTitle: '', 
            newMeetingDate: '' 
		}
	}

    componentDidMount() {
        this.fetchMeetings()
        this.fetchRecordings()
    }

    // Загрузка запланированных встреч
    fetchMeetings = () => {
        fetch(`${server_url}/api/meetings`)
            .then(res => res.json())
            .then(data => {
                // Сортируем от ближайших к самым дальним
                const sortedMeetings = data.sort((a, b) => new Date(a.date) - new Date(b.date));
                this.setState({ meetings: sortedMeetings });
            }).catch(err => console.error(err))
    }

    // Загрузка списка видеозаписей
    fetchRecordings = () => {
        fetch(`${server_url}/api/recordings`)
            .then(res => res.json())
            .then(data => this.setState({ recordings: data }))
            .catch(err => console.error(err));
    }

	handleChange = (e) => this.setState({ url: e.target.value })

    // Подключение к существующей или создание быстрой комнаты
	join = () => {
		if (this.state.url !== "") {
			var url = this.state.url.split("/")
			window.location.href = `/${url[url.length-1]}`
		} else {
			var url = Math.random().toString(36).substring(2, 7)
			window.location.href = `/${url}`
		}
	}

    // Создание новой запланированной встречи
    scheduleMeeting = () => {
        if (!this.state.newMeetingTitle || !this.state.newMeetingDate) {
            alert("Please enter a title and select a date/time."); 
            return;
        }

        const meetingUrl = Math.random().toString(36).substring(2, 7);

        fetch(`${server_url}/api/meetings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                title: this.state.newMeetingTitle, 
                date: this.state.newMeetingDate, 
                url: meetingUrl 
            })
        })
        .then(res => res.json())
        .then(newMeeting => {
            // Добавляем новую встречу в стейт и очищаем форму
            this.setState(prevState => ({
                meetings: [...prevState.meetings, newMeeting].sort((a, b) => new Date(a.date) - new Date(b.date)),
                newMeetingTitle: '', 
                newMeetingDate: ''
            }));
        }).catch(err => console.error(err));
    }

	render() {
		return (
			<div className="container2">
				<div style={{fontSize: "14px", background: "white", width: "10%", minWidth: "150px", textAlign: "center", margin: "auto", marginBottom: "10px"}}>
					Source code: 
					<IconButton style={{color: "black"}} onClick={() => window.location.href="https://github.com/0x5eba/Video-Meeting"}>
						<GitHubIcon />
					</IconButton>
				</div>
				
				<div>
					<h1 style={{ fontSize: "45px" }}>Video Meeting</h1>
					<p style={{ fontWeight: "200" }}>Video conference website that lets you stay in touch with all your friends.</p>
				</div>

                {/* --- ВЕРХНИЙ БЛОК: Вход и Планирование --- */}
                <div style={{ display: "flex", justifyContent: "center", flexWrap: "wrap", marginTop: "40px" }}>
                    
                    {/* Быстрый вход */}
                    <div style={{ background: "white", width: "30%", height: "auto", padding: "20px", minWidth: "350px", textAlign: "center", margin: "10px", borderRadius: "8px", boxShadow: "0px 4px 10px rgba(0,0,0,0.1)" }}>
                        <p style={{ margin: 0, fontWeight: "bold", fontSize: "18px", marginBottom: "15px" }}>Start or join a meeting</p>
                        <Input placeholder="Enter URL or ID" onChange={e => this.handleChange(e)} style={{width: "80%"}} />
                        <br/>
                        <Button variant="contained" color="primary" onClick={this.join} style={{ margin: "20px" }}>Go / Create Instant</Button>
                    </div>

                    {/* Планировщик */}
                    <div style={{ background: "white", width: "30%", height: "auto", padding: "20px", minWidth: "350px", textAlign: "center", margin: "10px", borderRadius: "8px", boxShadow: "0px 4px 10px rgba(0,0,0,0.1)" }}>
                        <p style={{ margin: 0, fontWeight: "bold", fontSize: "18px", marginBottom: "15px" }}>Schedule a Meeting</p>
                        <Input 
                            placeholder="Meeting Title (e.g. Weekly Sync)" 
                            value={this.state.newMeetingTitle} 
                            onChange={e => this.setState({newMeetingTitle: e.target.value})} 
                            style={{width: "80%", marginBottom: "15px"}} 
                        />
                        <TextField 
                            type="datetime-local" 
                            value={this.state.newMeetingDate} 
                            onChange={e => this.setState({newMeetingDate: e.target.value})} 
                            style={{width: "80%", marginBottom: "15px"}} 
                        />
                        <br/>
                        <Button variant="contained" color="secondary" onClick={this.scheduleMeeting}>Schedule Event</Button>
                    </div>
                </div>

                {/* --- СРЕДНИЙ БЛОК: Список предстоящих встреч --- */}
                <div style={{ background: "white", width: "62%", minWidth: "350px", margin: "20px auto", padding: "30px", textAlign: "left", borderRadius: "8px", boxShadow: "0px 4px 10px rgba(0,0,0,0.1)" }}>
                    <p style={{ fontWeight: "bold", fontSize: "22px", borderBottom: "2px solid #f0f0f0", paddingBottom: "10px" }}>Upcoming Meetings</p>
                    {this.state.meetings.length === 0 ? <p style={{ color: "gray", textAlign: "center", padding: "20px" }}>No meetings scheduled yet.</p> : (
                        <ul style={{ listStyle: "none", padding: 0 }}>
                            {this.state.meetings.map(meeting => (
                                <li key={meeting.id} style={{ borderBottom: "1px solid #ddd", padding: "15px 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <div>
                                        <b style={{fontSize: "18px"}}>{meeting.title}</b> <br/>
                                        <span style={{color: "#3f51b5", fontSize: "14px", fontWeight: "500"}}>📅 {new Date(meeting.date).toLocaleString([], { dateStyle: 'long', timeStyle: 'short' })}</span>
                                    </div>
                                    <Button variant="outlined" color="primary" onClick={() => window.location.href = `/${meeting.url}`}>Join Room</Button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                {/* --- НИЖНИЙ БЛОК: Архив записей по папкам --- */}
                <div style={{ background: "white", width: "62%", minWidth: "350px", margin: "20px auto", padding: "30px", textAlign: "left", borderRadius: "8px", boxShadow: "0px 4px 10px rgba(0,0,0,0.1)" }}>
                    <p style={{ fontWeight: "bold", fontSize: "22px", borderBottom: "2px solid #f0f0f0", paddingBottom: "10px" }}>Архив записей (на сервере)</p>
                    {this.state.recordings.length === 0 ? <p style={{ color: "gray", textAlign: "center", padding: "20px" }}>Записей пока нет</p> : (
                        <ul style={{ listStyle: "none", padding: 0 }}>
                            {this.state.recordings.map((rec, index) => (
                                <li key={index} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "15px 0", borderBottom: "1px solid #eee" }}>
                                    <div>
                                        {/* Бейджик с названием папки */}
                                        <span style={{ backgroundColor: "#e0f7fa", color: "#006064", padding: "4px 8px", borderRadius: "4px", fontSize: "12px", marginRight: "10px", fontWeight: "bold" }}>
                                            📁 {rec.folder}
                                        </span>
                                        <span style={{fontSize: "16px"}}>🎥 Запись от {rec.date}</span>
                                    </div>
                                    {/* Кнопка для просмотра видео */}
                                    <Button variant="contained" style={{backgroundColor: "#4caf50", color: "white"}} onClick={() => window.open(`${server_url}${rec.url}`)}>
                                        Смотреть
                                    </Button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

			</div>
		)
	}
}

export default Home;