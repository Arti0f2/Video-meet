import React, { Component } from "react";
import { Input, Button, TextField, IconButton } from "@material-ui/core";
import { Delete, Edit, Email, Save, Cancel } from "@material-ui/icons";
import "./Home.css";

const server_url =
	process.env.NODE_ENV === "production"
		? "https://video.sebastienbiollo.com"
		: `${window.location.protocol}//${window.location.hostname}:4001`;

class Home extends Component {
	constructor(props) {
		super(props);
		this.state = {
			url: "",
			meetings: [],
			recordings: [], // Archive of recordings from the server
			newMeetingTitle: "",
			newMeetingDate: "",
			editingMeetingId: null,
			editTitle: "",
			editDate: "",
			editingRecordingName: null,
			editRecordingName: "",
		};
	}

	componentDidMount() {
		this.fetchMeetings();
		this.fetchRecordings();
	}

	// Loading scheduled meetings
	fetchMeetings = () => {
		fetch(`${server_url}/api/meetings`)
			.then((res) => res.json())
			.then((data) => {
				// Sort from nearest to farthest
				const sortedMeetings = data.sort(
					(a, b) => new Date(a.date) - new Date(b.date),
				);
				this.setState({ meetings: sortedMeetings });
			})
			.catch((err) => console.error(err));
	};

	// Loading the list of video recordings
	fetchRecordings = () => {
		fetch(`${server_url}/api/recordings`)
			.then((res) => res.json())
			.then((data) => this.setState({ recordings: data }))
			.catch((err) => console.error(err));
	};

	handleChange = (e) => this.setState({ url: e.target.value });

	// Connecting to existing or creating a quick room
	join = () => {
		if (this.state.url !== "") {
			let urlParts = this.state.url.split("/");
			window.location.href = `/${urlParts[urlParts.length - 1]}`;
		} else {
			let randomUrl = Math.random().toString(36).substring(2, 7);
			window.location.href = `/${randomUrl}`;
		}
	};

	// Creating a new scheduled meeting
	scheduleMeeting = () => {
		if (!this.state.newMeetingTitle || !this.state.newMeetingDate) {
			alert("Please enter a title and select a date/time.");
			return;
		}

		const meetingUrl = Math.random().toString(36).substring(2, 7);

		fetch(`${server_url}/api/meetings`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				title: this.state.newMeetingTitle,
				date: this.state.newMeetingDate,
				url: meetingUrl,
			}),
		})
			.then((res) => res.json())
			.then((newMeeting) => {
				// Add new meeting to state and clear form
				this.setState((prevState) => ({
					meetings: [...prevState.meetings, newMeeting].sort(
						(a, b) => new Date(a.date) - new Date(b.date),
					),
					newMeetingTitle: "",
					newMeetingDate: "",
				}));
			})
			.catch((err) => console.error(err));
	};

	deleteMeeting = (id) => {
		if (!window.confirm("Are you sure you want to delete this meeting?"))
			return;

		fetch(`${server_url}/api/meetings/${id}`, {
			method: "DELETE",
		})
			.then((res) => res.json())
			.then((data) => {
				if (data.success) {
					this.setState((prevState) => ({
						meetings: prevState.meetings.filter((m) => m.id !== id),
					}));
				}
			})
			.catch((err) => console.error(err));
	};

	// --- RECORDING ACTIONS ---
	deleteRecording = (name) => {
		if (!window.confirm("Are you sure you want to delete this recording?"))
			return;

		fetch(`${server_url}/api/recordings/${name}`, {
			method: "DELETE",
		})
			.then((res) => res.json())
			.then((data) => {
				if (data.success) {
					this.setState((prevState) => ({
						recordings: prevState.recordings.filter((r) => r.name !== name),
					}));
				}
			})
			.catch((err) => console.error(err));
	};

	startEditRecording = (recording) => {
		this.setState({
			editingRecordingName: recording.name,
			editRecordingName: recording.name.replace(".webm", ""),
		});
	};

	cancelEditRecording = () => {
		this.setState({
			editingRecordingName: null,
			editRecordingName: "",
		});
	};

	saveEditRecording = () => {
		const { editingRecordingName, editRecordingName } = this.state;
		if (!editRecordingName) {
			alert("Name cannot be empty.");
			return;
		}

		fetch(`${server_url}/api/recordings/rename`, {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				oldName: editingRecordingName,
				newName: editRecordingName,
			}),
		})
			.then((res) => res.json())
			.then((data) => {
				if (data.error) {
					alert(data.error);
				} else {
					this.setState((prevState) => ({
						recordings: prevState.recordings.map((r) =>
							r.name === editingRecordingName
								? { ...r, name: data.name, url: data.url }
								: r,
						),
						editingRecordingName: null,
						editRecordingName: "",
					}));
				}
			})
			.catch((err) => console.error(err));
	};

	startEdit = (meeting) => {
		this.setState({
			editingMeetingId: meeting.id,
			editTitle: meeting.title,
			editDate: meeting.date,
		});
	};

	cancelEdit = () => {
		this.setState({
			editingMeetingId: null,
			editTitle: "",
			editDate: "",
		});
	};

	saveEdit = () => {
		const { editingMeetingId, editTitle, editDate } = this.state;
		if (!editTitle || !editDate) {
			alert("Title and date cannot be empty.");
			return;
		}

		fetch(`${server_url}/api/meetings/${editingMeetingId}`, {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ title: editTitle, date: editDate }),
		})
			.then((res) => res.json())
			.then((updatedMeeting) => {
				this.setState((prevState) => ({
					meetings: prevState.meetings
						.map((m) => (m.id === editingMeetingId ? updatedMeeting : m))
						.sort((a, b) => new Date(a.date) - new Date(b.date)),
					editingMeetingId: null,
					editTitle: "",
					editDate: "",
				}));
			})
			.catch((err) => console.error(err));
	};

	inviteByEmail = (meeting) => {
		const subject = encodeURIComponent(
			`Invitation to meeting: ${meeting.title}`,
		);
		const meetingFullUrl = `${window.location.origin}/${meeting.url}`;
		const body = encodeURIComponent(
			`Hi!\n\nYou're invited to a video meeting.\n\nMeeting: ${
				meeting.title
			}\nWhen: ${new Date(meeting.date).toLocaleString()}\nLink: ${meetingFullUrl}\n\nSee you there!`,
		);

		window.location.href = `mailto:?subject=${subject}&body=${body}`;
	};

	render() {
		return (
			<div className="container2">
				<div>
					<h1 style={{ fontSize: "45px" }}>Video Meeting</h1>
					<p style={{ fontWeight: "200" }}>
						Video conference website that lets you stay in touch with all your
						friends.
					</p>
				</div>

				{/* --- TOP BLOCK: Entry and Scheduling --- */}
				<div
					style={{
						display: "flex",
						justifyContent: "center",
						flexWrap: "wrap",
						marginTop: "40px",
					}}
				>
					{/* Quick entry */}
					<div
						style={{
							background: "white",
							width: "30%",
							height: "auto",
							padding: "20px",
							minWidth: "350px",
							textAlign: "center",
							margin: "10px",
							borderRadius: "8px",
							boxShadow: "0px 4px 10px rgba(0,0,0,0.1)",
						}}
					>
						<p
							style={{
								margin: 0,
								fontWeight: "bold",
								fontSize: "18px",
								marginBottom: "15px",
							}}
						>
							Start or join a meeting
						</p>
						<Input
							placeholder="Enter URL or ID"
							onChange={(e) => this.handleChange(e)}
							style={{ width: "80%" }}
						/>
						<br />
						<Button
							variant="contained"
							color="primary"
							onClick={this.join}
							style={{ margin: "20px" }}
						>
							Go / Create Instant
						</Button>
					</div>

					{/* Scheduler */}
					<div
						style={{
							background: "white",
							width: "30%",
							height: "auto",
							padding: "20px",
							minWidth: "350px",
							textAlign: "center",
							margin: "10px",
							borderRadius: "8px",
							boxShadow: "0px 4px 10px rgba(0,0,0,0.1)",
						}}
					>
						<p
							style={{
								margin: 0,
								fontWeight: "bold",
								fontSize: "18px",
								marginBottom: "15px",
							}}
						>
							Schedule a Meeting
						</p>
						<Input
							placeholder="Meeting Title (e.g. Weekly Sync)"
							value={this.state.newMeetingTitle}
							onChange={(e) =>
								this.setState({ newMeetingTitle: e.target.value })
							}
							style={{ width: "80%", marginBottom: "15px" }}
						/>
						<TextField
							type="datetime-local"
							value={this.state.newMeetingDate}
							onChange={(e) =>
								this.setState({ newMeetingDate: e.target.value })
							}
							style={{ width: "80%", marginBottom: "15px" }}
						/>
						<br />
						<Button
							variant="contained"
							color="secondary"
							onClick={this.scheduleMeeting}
						>
							Schedule Event
						</Button>
					</div>
				</div>

				{/* --- MIDDLE BLOCK: List of upcoming meetings --- */}
				<div
					style={{
						background: "white",
						width: "62%",
						minWidth: "350px",
						margin: "20px auto",
						padding: "30px",
						textAlign: "left",
						borderRadius: "8px",
						boxShadow: "0px 4px 10px rgba(0,0,0,0.1)",
					}}
				>
					<p
						style={{
							fontWeight: "bold",
							fontSize: "22px",
							borderBottom: "2px solid #f0f0f0",
							paddingBottom: "10px",
						}}
					>
						Upcoming Meetings
					</p>
					{this.state.meetings.length === 0 ? (
						<p style={{ color: "gray", textAlign: "center", padding: "20px" }}>
							No meetings scheduled yet.
						</p>
					) : (
						<ul style={{ listStyle: "none", padding: 0 }}>
							{this.state.meetings.map((meeting) => (
								<li
									key={meeting.id}
									style={{
										borderBottom: "1px solid #ddd",
										padding: "15px 0",
										display: "flex",
										justifyContent: "space-between",
										alignItems: "center",
									}}
								>
									{this.state.editingMeetingId === meeting.id ? (
										/* EDIT MODE */
										<div
											style={{ flex: 1, display: "flex", alignItems: "center" }}
										>
											<Input
												value={this.state.editTitle}
												onChange={(e) =>
													this.setState({ editTitle: e.target.value })
												}
												style={{ marginRight: "10px", flex: 2 }}
											/>
											<TextField
												type="datetime-local"
												value={this.state.editDate}
												onChange={(e) =>
													this.setState({ editDate: e.target.value })
												}
												style={{ marginRight: "10px", flex: 1 }}
											/>
											<IconButton color="primary" onClick={this.saveEdit}>
												<Save />
											</IconButton>
											<IconButton color="secondary" onClick={this.cancelEdit}>
												<Cancel />
											</IconButton>
										</div>
									) : (
										/* VIEW MODE */
										<>
											<div>
												<b style={{ fontSize: "18px" }}>{meeting.title}</b>{" "}
												<br />
												<span
													style={{
														color: "#3f51b5",
														fontSize: "14px",
														fontWeight: "500",
													}}
												>
													<span role="img" aria-label="calendar">
														📅
													</span>{" "}
													{new Date(meeting.date).toLocaleString([], {
														dateStyle: "long",
														timeStyle: "short",
													})}
												</span>
											</div>
											<div>
												<IconButton
													color="primary"
													onClick={() => this.inviteByEmail(meeting)}
													title="Invite by Email"
												>
													<Email />
												</IconButton>
												<IconButton
													onClick={() => this.startEdit(meeting)}
													title="Edit Meeting"
												>
													<Edit />
												</IconButton>
												<IconButton
													color="secondary"
													onClick={() => this.deleteMeeting(meeting.id)}
													title="Delete Meeting"
												>
													<Delete />
												</IconButton>
												<Button
													variant="outlined"
													color="primary"
													onClick={() =>
														(window.location.href = `/${meeting.url}`)
													}
													style={{ marginLeft: "10px" }}
												>
													Join Room
												</Button>
											</div>
										</>
									)}
								</li>
							))}
						</ul>
					)}
				</div>

				{/* --- BOTTOM BLOCK: Recordings archive by folders --- */}
				<div
					style={{
						background: "white",
						width: "62%",
						minWidth: "350px",
						margin: "20px auto",
						padding: "30px",
						textAlign: "left",
						borderRadius: "8px",
						boxShadow: "0px 4px 10px rgba(0,0,0,0.1)",
					}}
				>
					<p
						style={{
							fontWeight: "bold",
							fontSize: "22px",
							borderBottom: "2px solid #f0f0f0",
							paddingBottom: "10px",
						}}
					>
						Recordings Archive
					</p>
					{this.state.recordings.length === 0 ? (
						<p style={{ color: "gray", textAlign: "center", padding: "20px" }}>
							No recordings yet
						</p>
					) : (
						<ul style={{ listStyle: "none", padding: 0 }}>
							{this.state.recordings.map((rec, index) => (
								<li
									key={index}
									style={{
										display: "flex",
										justifyContent: "space-between",
										alignItems: "center",
										padding: "15px 0",
										borderBottom: "1px solid #eee",
									}}
								>
									{this.state.editingRecordingName === rec.name ? (
										/* EDIT RECORDING NAME */
										<div
											style={{ flex: 1, display: "flex", alignItems: "center" }}
										>
											<Input
												value={this.state.editRecordingName}
												onChange={(e) =>
													this.setState({ editRecordingName: e.target.value })
												}
												style={{ marginRight: "10px", flex: 1 }}
											/>
											<IconButton
												color="primary"
												onClick={this.saveEditRecording}
											>
												<Save />
											</IconButton>
											<IconButton
												color="secondary"
												onClick={this.cancelEditRecording}
											>
												<Cancel />
											</IconButton>
										</div>
									) : (
										/* VIEW RECORDING */
										<>
											<div>
												<span style={{ fontSize: "16px" }}>
													<span role="img" aria-label="camera">
														🎥
													</span>{" "}
													<b>{rec.name.replace(".webm", "")}</b>
													<br />
													<small style={{ color: "gray" }}>{rec.date}</small>
												</span>
											</div>
											<div>
												<IconButton
													onClick={() => this.startEditRecording(rec)}
													title="Rename Recording"
												>
													<Edit />
												</IconButton>
												<IconButton
													color="secondary"
													onClick={() => this.deleteRecording(rec.name)}
													title="Delete Recording"
												>
													<Delete />
												</IconButton>
												<Button
													variant="contained"
													style={{
														backgroundColor: "#4caf50",
														color: "white",
														marginLeft: "10px",
													}}
													onClick={() => window.open(`${server_url}${rec.url}`)}
												>
													Watch
												</Button>
											</div>
										</>
									)}
								</li>
							))}
						</ul>
					)}
				</div>
			</div>
		);
	}
}

export default Home;
