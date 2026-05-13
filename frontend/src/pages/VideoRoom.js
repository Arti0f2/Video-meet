import React, { Component } from "react";
import io from "socket.io-client";
import faker from "faker";

import { IconButton, Badge, Input, Button } from "@material-ui/core";
import VideocamIcon from "@material-ui/icons/Videocam";
import VideocamOffIcon from "@material-ui/icons/VideocamOff";
import MicIcon from "@material-ui/icons/Mic";
import MicOffIcon from "@material-ui/icons/MicOff";
import ScreenShareIcon from "@material-ui/icons/ScreenShare";
import StopScreenShareIcon from "@material-ui/icons/StopScreenShare";
import CallEndIcon from "@material-ui/icons/CallEnd";
import ChatIcon from "@material-ui/icons/Chat";
import AttachFileIcon from "@material-ui/icons/AttachFile";
import FiberManualRecordIcon from "@material-ui/icons/FiberManualRecord";
import StopIcon from "@material-ui/icons/Stop";
import ShareIcon from "@material-ui/icons/Share";

import { message } from "antd";
import "antd/dist/antd.css";
import Modal from "react-bootstrap/Modal";
import "bootstrap/dist/css/bootstrap.css";
import "./Video.css";

const server_url =
	process.env.NODE_ENV === "production"
		? "https://video.sebastienbiollo.com"
		: `${window.location.protocol}//${window.location.hostname}:4001`;

var connections = {};
const peerConnectionConfig = {
	iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};
var socket = null;
var socketId = null;
var elms = 0;

class VideoRoom extends Component {
	constructor(props) {
		super(props);

		this.localVideoref = React.createRef();

		this.videoAvailable = false;
		this.audioAvailable = false;

		this.state = {
			video: true,
			audio: true,
			screen: false,
			showModal: false,
			showShareModal: false,
			screenAvailable: false,
			messages: [],
			message: "",
			newmessages: 0,
			askForUsername: true,
			username: faker.internet.userName(),
			recipient: "All",
			file: null,
			recording: false,
			inviteEmail: "",
			usernames: {},
		};
		connections = {};
		this.mediaRecorder = null;
		this.recordedChunks = [];

		this.getPermissions();
	}

	getPermissions = async () => {
		try {
			await navigator.mediaDevices
				.getUserMedia({ video: true })
				.then(() => (this.videoAvailable = true))
				.catch(() => (this.videoAvailable = false));

			await navigator.mediaDevices
				.getUserMedia({ audio: true })
				.then(() => (this.audioAvailable = true))
				.catch(() => (this.audioAvailable = false));

			if (navigator.mediaDevices.getDisplayMedia) {
				this.setState({ screenAvailable: true });
			} else {
				this.setState({ screenAvailable: false });
			}

			if (this.videoAvailable || this.audioAvailable) {
				navigator.mediaDevices
					.getUserMedia({
						video: this.videoAvailable,
						audio: this.audioAvailable,
					})
					.then((stream) => {
						window.localStream = stream;
						if (this.localVideoref.current) {
							this.localVideoref.current.srcObject = stream;
						}
					})
					.catch((e) => console.log(e));
			}
		} catch (e) {
			console.log(e);
		}
	};

	getMedia = () => {
		this.setState(
			{
				video: this.videoAvailable && this.state.video,
				audio: this.audioAvailable && this.state.audio,
			},
			() => {
				this.getUserMedia();
				this.connectToSocketServer();
			},
		);
	};

	getUserMedia = () => {
		if (this.videoAvailable || this.audioAvailable) {
			navigator.mediaDevices
				.getUserMedia({
					video: this.videoAvailable,
					audio: this.audioAvailable,
				})
				.then(this.getUserMediaSuccess)
				.catch((e) => console.log(e));
		} else {
			try {
				let tracks = window.localStream.getTracks();
				tracks.forEach((track) => track.stop());
			} catch (e) {}
		}
	};

	getUserMediaSuccess = (stream) => {
		try {
			if (window.localStream) {
				window.localStream.getTracks().forEach((track) => track.stop());
			}
		} catch (e) {}

		window.localStream = stream;

		if (window.localStream.getVideoTracks().length > 0) {
			window.localStream.getVideoTracks()[0].enabled = this.state.video;
		}
		if (window.localStream.getAudioTracks().length > 0) {
			window.localStream.getAudioTracks()[0].enabled = this.state.audio;
		}

		if (this.localVideoref.current) {
			this.localVideoref.current.srcObject = stream;
		}

		if (socketId) {
			const container = document.querySelector(
				`[data-container="${socketId}"]`,
			);
			if (container) {
				const video = container.querySelector("video");
				if (video) video.srcObject = stream;
			}
		}

		for (let id in connections) {
			if (id === socketId) continue;
			connections[id].addStream(window.localStream);
			connections[id].createOffer().then((description) => {
				connections[id].setLocalDescription(description).then(() => {
					socket.emit(
						"signal",
						id,
						JSON.stringify({ sdp: connections[id].localDescription }),
					);
				});
			});
		}
	};

	gotMessageFromServer = (fromId, message) => {
		var signal = JSON.parse(message);
		if (fromId !== socketId) {
			if (signal.sdp) {
				connections[fromId]
					.setRemoteDescription(new RTCSessionDescription(signal.sdp))
					.then(() => {
						if (signal.sdp.type === "offer") {
							connections[fromId].createAnswer().then((description) => {
								connections[fromId]
									.setLocalDescription(description)
									.then(() => {
										socket.emit(
											"signal",
											fromId,
											JSON.stringify({
												sdp: connections[fromId].localDescription,
											}),
										);
									});
							});
						}
					});
			}
			if (signal.ice) {
				connections[fromId]
					.addIceCandidate(new RTCIceCandidate(signal.ice))
					.catch((e) => console.log(e));
			}
		}
	};

	changeCssVideos = () => {
		let main = document.getElementById("main");
		if (!main) return;

		let elmsCount = elms;
		if (elmsCount === 0) return;

		let cols, rows;
		if (elmsCount === 1) {
			cols = 1;
			rows = 1;
		} else if (elmsCount === 2) {
			cols = 2;
			rows = 1;
		} else if (elmsCount <= 4) {
			cols = 2;
			rows = 2;
		} else if (elmsCount <= 6) {
			cols = 3;
			rows = 2;
		} else if (elmsCount <= 9) {
			cols = 3;
			rows = 3;
		} else {
			cols = 4;
			rows = Math.ceil(elmsCount / 4);
		}

		main.className = "video-grid";
		main.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
		main.style.gridTemplateRows = `repeat(${rows}, 1fr)`;
	};

	addVideoContainer = (
		socketListId,
		username,
		stream,
		isVideoEnabled,
		isAudioEnabled,
	) => {
		let main = document.getElementById("main");
		if (!main) return;

		let searchContainer = document.querySelector(
			`[data-container="${socketListId}"]`,
		);
		if (searchContainer) {
			const video = searchContainer.querySelector("video");
			if (video && stream) video.srcObject = stream;
			return;
		}

		elms++;
		this.changeCssVideos();

		let container = document.createElement("div");
		container.setAttribute("data-container", socketListId);
		container.className = "video-container";

		let placeholder = document.createElement("div");
		placeholder.className = "video-placeholder";
		placeholder.style.backgroundColor = this.getRandomColor(username);
		placeholder.style.display = isVideoEnabled ? "none" : "flex";

		let initialsDiv = document.createElement("div");
		initialsDiv.className = "initials";
		initialsDiv.innerText = username.charAt(0).toUpperCase();
		placeholder.appendChild(initialsDiv);

		let centerNameDiv = document.createElement("div");
		centerNameDiv.className = "full-name";
		centerNameDiv.innerHTML = `<span>${socketListId === socketId ? "You" : username}</span><span class="mic-icon" style="margin-left: 8px; color: red; display: ${isAudioEnabled ? "none" : "inline"};">🔇</span>`;
		placeholder.appendChild(centerNameDiv);

		container.appendChild(placeholder);

		let nameLabel = document.createElement("div");
		nameLabel.className = "name-label";
		nameLabel.innerHTML = `<span>${socketListId === socketId ? "You" : username}</span><span class="mic-icon" style="margin-left: 5px; color: red; display: ${isAudioEnabled ? "none" : "inline"};">🔇</span>`;
		nameLabel.style.display = isVideoEnabled ? "block" : "none";
		container.appendChild(nameLabel);

		let video = document.createElement("video");
		if (socketListId === socketId) video.style.transform = "scaleX(-1)";
		video.setAttribute("data-socket", socketListId);
		if (stream) video.srcObject = stream;
		video.autoplay = true;
		video.playsinline = true;
		if (socketListId === socketId) video.muted = true;

		container.appendChild(video);
		main.appendChild(container);
	};

	connectToSocketServer = () => {
		socket = io.connect(server_url, { secure: true });
		socket.on("signal", this.gotMessageFromServer);
		socket.on("connect", () => {
			socket.emit(
				"join-call",
				window.location.href,
				this.state.username,
				this.state.video,
				this.state.audio,
			);
			socketId = socket.id;

			this.addVideoContainer(
				socketId,
				this.state.username,
				window.localStream,
				this.state.video,
				this.state.audio,
			);

			socket.on("chat-message", this.addMessage);
			socket.on("chat-file", this.addFileMessage);
			socket.on("user-toggle-media", (id, type, value) => {
				const container = document.querySelector(`[data-container="${id}"]`);
				if (container) {
					if (type === "video") {
						const placeholder = container.querySelector(".video-placeholder");
						const nameLabel = container.querySelector(".name-label");
						if (placeholder)
							placeholder.style.display = value ? "none" : "flex";
						if (nameLabel) nameLabel.style.display = value ? "block" : "none";
					} else if (type === "audio") {
						const micIcons = container.querySelectorAll(".mic-icon");
						micIcons.forEach((icon) => {
							icon.style.display = value ? "none" : "inline";
						});
					}
				}
			});

			socket.on("user-left", (id) => {
				let container = document.querySelector(`[data-container="${id}"]`);
				if (container) {
					elms--;
					container.remove();
					this.changeCssVideos();
				}
				this.setState((prevState) => {
					const newUsernames = { ...prevState.usernames };
					delete newUsernames[id];
					return { usernames: newUsernames };
				});
			});

			socket.on("user-joined", (id, clients) => {
				let newDict = {};
				clients.forEach((client) => {
					newDict[client.id] = client.username;
				});
				this.setState((prevState) => ({
					usernames: { ...prevState.usernames, ...newDict },
				}));

				clients.forEach((client) => {
					const socketListId = client.id;
					if (socketListId === socketId) return;

					if (connections[socketListId] === undefined) {
						connections[socketListId] = new RTCPeerConnection(
							peerConnectionConfig,
						);
						connections[socketListId].onicecandidate = (event) => {
							if (event.candidate != null) {
								socket.emit(
									"signal",
									socketListId,
									JSON.stringify({ ice: event.candidate }),
								);
							}
						};
						connections[socketListId].onaddstream = (event) => {
							this.addVideoContainer(
								socketListId,
								client.username,
								event.stream,
								client.video,
								client.audio,
							);
						};
						if (window.localStream) {
							connections[socketListId].addStream(window.localStream);
						} else {
							let blackSilence = (...args) =>
								new MediaStream([this.black(...args), this.silence()]);
							window.localStream = blackSilence();
							connections[socketListId].addStream(window.localStream);
						}
					}
				});
				if (id === socketId) {
					for (let id2 in connections) {
						if (id2 === socketId) continue;
						try {
							connections[id2].addStream(window.localStream);
						} catch (e) {}
						connections[id2].createOffer().then((description) => {
							connections[id2].setLocalDescription(description).then(() => {
								socket.emit(
									"signal",
									id2,
									JSON.stringify({ sdp: connections[id2].localDescription }),
								);
							});
						});
					}
				}
			});
		});
	};

	getRandomColor = (str) => {
		let hash = 0;
		for (let i = 0; i < str.length; i++) {
			hash = str.charCodeAt(i) + ((hash << 5) - hash);
		}
		const colors = [
			"#2ecc71",
			"#3498db",
			"#9b59b6",
			"#e67e22",
			"#e74c3c",
			"#1abc9c",
			"#f1c40f",
		];
		return colors[Math.abs(hash) % colors.length];
	};

	startRecording = () => {
		this.recordedChunks = [];
		const stream = window.localStream;
		if (!stream) {
			message.error("No stream available to record.");
			return;
		}
		let options = { mimeType: "video/webm;codecs=vp9" };
		if (!MediaRecorder.isTypeSupported(options.mimeType)) {
			options = { mimeType: "video/webm;codecs=vp8" };
			if (!MediaRecorder.isTypeSupported(options.mimeType)) {
				options = { mimeType: "video/webm" };
				if (!MediaRecorder.isTypeSupported(options.mimeType))
					options = { mimeType: "" };
			}
		}
		try {
			this.mediaRecorder = new MediaRecorder(stream, options);
			this.mediaRecorder.ondataavailable = (e) => {
				if (e.data.size > 0) this.recordedChunks.push(e.data);
			};
			this.mediaRecorder.onstop = () => this.saveRecordingToServer();
			this.mediaRecorder.start(1000);
			this.setState({ recording: true });
			message.success("Recording started!");
		} catch (e) {
			message.error("Error starting recording.");
		}
	};

	stopRecording = () => {
		if (this.mediaRecorder && this.state.recording) {
			this.mediaRecorder.stop();
			this.setState({ recording: false });
			message.loading("Saving recording to server...");
		}
	};

	saveRecordingToServer = async () => {
		if (this.recordedChunks.length === 0) {
			message.error("No recording data captured.");
			return;
		}
		const blob = new Blob(this.recordedChunks, { type: "video/webm" });
		const formData = new FormData();
		formData.append("video", blob);
		try {
			const response = await fetch(`${server_url}/api/upload-recording`, {
				method: "POST",
				body: formData,
			});
			if (response.ok) message.success("Recording successfully saved!");
			else throw new Error("Upload failed");
		} catch (err) {
			message.error("Error sending recording to server");
		}
	};

	silence = () => {
		let ctx = new AudioContext();
		let oscillator = ctx.createOscillator();
		let dst = oscillator.connect(ctx.createMediaStreamDestination());
		oscillator.start();
		ctx.resume();
		return Object.assign(dst.stream.getAudioTracks()[0], { enabled: false });
	};

	black = ({ width = 640, height = 480 } = {}) => {
		let canvas = Object.assign(document.createElement("canvas"), {
			width,
			height,
		});
		canvas.getContext("2d").fillRect(0, 0, width, height);
		let stream = canvas.captureStream();
		return Object.assign(stream.getVideoTracks()[0], { enabled: false });
	};

	handleVideo = () =>
		this.setState({ video: !this.state.video }, () => {
			if (window.localStream) {
				const videoTracks = window.localStream.getVideoTracks();
				if (videoTracks.length > 0) {
					videoTracks[0].enabled = this.state.video;
				}
			}
			if (socket) socket.emit("toggle-media", "video", this.state.video);
			const container = document.querySelector(
				`[data-container="${socketId}"]`,
			);
			if (container) {
				const placeholder = container.querySelector(".video-placeholder");
				const nameLabel = container.querySelector(".name-label");
				if (placeholder)
					placeholder.style.display = this.state.video ? "none" : "flex";
				if (nameLabel)
					nameLabel.style.display = this.state.video ? "block" : "none";
			}
		});

	handleAudio = () =>
		this.setState({ audio: !this.state.audio }, () => {
			if (window.localStream) {
				const audioTracks = window.localStream.getAudioTracks();
				if (audioTracks.length > 0) {
					audioTracks[0].enabled = this.state.audio;
				}
			}
			if (socket) socket.emit("toggle-media", "audio", this.state.audio);
			const container = document.querySelector(
				`[data-container="${socketId}"]`,
			);
			if (container) {
				const micIcons = container.querySelectorAll(".mic-icon");
				micIcons.forEach((icon) => {
					icon.style.display = this.state.audio ? "none" : "inline";
				});
			}
		});

	handleScreen = () =>
		this.setState({ screen: !this.state.screen }, () => this.getDislayMedia());

	handleEndCall = () => {
		try {
			window.localStream.getTracks().forEach((track) => track.stop());
		} catch (e) {}
		window.location.href = "/";
	};

	openChat = () => this.setState({ showModal: true, newmessages: 0 });
	closeChat = () => this.setState({ showModal: false });
	openShare = () => this.setState({ showShareModal: true });
	closeShare = () => this.setState({ showShareModal: false });
	handleMessage = (e) => this.setState({ message: e.target.value });
	handleFile = (e) => {
		if (e.target.files.length > 0) this.setState({ file: e.target.files[0] });
	};

	addMessage = (data, sender, socketIdSender, isPrivate = false) => {
		this.setState((prevState) => ({
			messages: [
				...prevState.messages,
				{ sender, data, isPrivate, isFile: false },
			],
		}));
		if (socketIdSender !== socketId)
			this.setState({ newmessages: this.state.newmessages + 1 });
	};

	addFileMessage = (
		data,
		sender,
		socketIdSender,
		isPrivate = false,
		fileName = "",
	) => {
		this.setState((prevState) => ({
			messages: [
				...prevState.messages,
				{ sender, data, isPrivate, isFile: true, fileName },
			],
		}));
		if (socketIdSender !== socketId)
			this.setState({ newmessages: this.state.newmessages + 1 });
	};

	handleUsername = (e) => this.setState({ username: e.target.value });
	handleInviteEmail = (e) => this.setState({ inviteEmail: e.target.value });

	inviteByEmail = () => {
		const rawEmails = this.state.inviteEmail.trim();
		if (!rawEmails) {
			message.info("Enter at least one email address to invite.");
			return;
		}
		const recipients = rawEmails
			.split(/[,;\s]+/)
			.filter(Boolean)
			.join(",");
		const subject = encodeURIComponent("Join my Video Meeting");
		const body = encodeURIComponent(
			`Please join the meeting: ${window.location.href}\n\nClick the link to join.`,
		);
		window.location.href = `mailto:${recipients}?subject=${subject}&body=${body}`;
	};

	sendMessage = () => {
		if (this.state.file) {
			const reader = new FileReader();
			reader.readAsDataURL(this.state.file);
			reader.onload = () => {
				socket.emit(
					"chat-file",
					reader.result,
					this.state.username,
					this.state.recipient,
					this.state.file.name,
				);
				this.setState({ file: null });
			};
		}
		if (this.state.message !== "") {
			socket.emit(
				"chat-message",
				this.state.message,
				this.state.username,
				this.state.recipient,
			);
			this.setState({ message: "" });
		}
	};

	copyUrl = () => {
		let text = window.location.href;
		if (!navigator.clipboard) {
			let textArea = document.createElement("textarea");
			textArea.value = text;
			document.body.appendChild(textArea);
			textArea.focus();
			textArea.select();
			try {
				document.execCommand("copy");
				message.success("Link copied to clipboard!");
			} catch (err) {
				message.error("Failed to copy");
			}
			document.body.removeChild(textArea);
			return;
		}
		navigator.clipboard.writeText(text).then(
			() => message.success("Link copied to clipboard!"),
			() => message.error("Failed to copy"),
		);
	};

	connect = () =>
		this.setState({ askForUsername: false }, () => this.getMedia());

	handleWaitingRoomVideo = () => {
		this.setState({ video: !this.state.video }, () => {
			if (window.localStream) {
				const videoTrack = window.localStream.getVideoTracks()[0];
				if (videoTrack) videoTrack.enabled = this.state.video;
			}
		});
	};

	handleWaitingRoomAudio = () => {
		this.setState({ audio: !this.state.audio }, () => {
			if (window.localStream) {
				const audioTrack = window.localStream.getAudioTracks()[0];
				if (audioTrack) audioTrack.enabled = this.state.audio;
			}
		});
	};

	isChrome = function () {
		let userAgent = (navigator && (navigator.userAgent || "")).toLowerCase();
		let vendor = (navigator && (navigator.vendor || "")).toLowerCase();
		let matchChrome = /google inc/.test(vendor)
			? userAgent.match(/(?:chrome|crios)\/(\d+)/)
			: null;
		return matchChrome !== null;
	};

	render() {
		if (this.isChrome() === false) {
			return (
				<div
					style={{
						background: "white",
						width: "30%",
						height: "auto",
						padding: "20px",
						minWidth: "400px",
						textAlign: "center",
						margin: "auto",
						marginTop: "50px",
						justifyContent: "center",
					}}
				>
					<h1>Sorry, this works only with Google Chrome</h1>
				</div>
			);
		}
		return (
			<div className="container-fluid">
				{this.state.askForUsername === true ? (
					<div
						style={{
							height: "100vh",
							display: "flex",
							flexDirection: "column",
							alignItems: "center",
							justifyContent: "center",
						}}
					>
						<div
							style={{
								background: "white",
								width: "30%",
								height: "auto",
								padding: "20px",
								minWidth: "400px",
								textAlign: "center",
								borderRadius: "8px",
								boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
							}}
						>
							<p style={{ margin: 0, fontWeight: "bold" }}>Set your username</p>
							<Input
								placeholder="Username"
								value={this.state.username}
								onChange={(e) => this.handleUsername(e)}
								style={{ width: "100%", marginTop: "10px" }}
							/>
							<div style={{ marginTop: "20px" }}>
								<IconButton
									onClick={this.handleWaitingRoomVideo}
									color={this.state.video ? "primary" : "default"}
								>
									{this.state.video ? <VideocamIcon /> : <VideocamOffIcon />}
								</IconButton>
								<IconButton
									onClick={this.handleWaitingRoomAudio}
									color={this.state.audio ? "primary" : "default"}
								>
									{this.state.audio ? <MicIcon /> : <MicOffIcon />}
								</IconButton>
							</div>
							<Button
								variant="contained"
								color="primary"
								onClick={this.connect}
								style={{ marginTop: "20px", width: "100%" }}
							>
								Connect
							</Button>
						</div>
						<div style={{ marginTop: "40px", width: "60%", height: "30vh" }}>
							<video
								id="my-video"
								ref={(ref) => {
									this.localVideoref.current = ref;
									if (
										ref &&
										window.localStream &&
										ref.srcObject !== window.localStream
									) {
										ref.srcObject = window.localStream;
									}
								}}
								autoPlay
								muted
								style={{
									borderStyle: "solid",
									borderColor: "#bdbdbd",
									borderRadius: "12px",
									objectFit: "cover",
									width: "100%",
									height: "100%",
								}}
							></video>
						</div>
					</div>
				) : (
					<div
						style={{
							display: "flex",
							flexDirection: "column",
							height: "100vh",
						}}
					>
						<div className="btn-down">
							<IconButton
								style={{ color: "#ffffff" }}
								onClick={this.handleVideo}
							>
								{this.state.video ? <VideocamIcon /> : <VideocamOffIcon />}
							</IconButton>
							<IconButton
								style={{ color: "#f44336" }}
								onClick={this.handleEndCall}
							>
								<CallEndIcon />
							</IconButton>
							<IconButton
								style={{ color: "#ffffff" }}
								onClick={this.handleAudio}
							>
								{this.state.audio ? <MicIcon /> : <MicOffIcon />}
							</IconButton>
							{this.state.screenAvailable === true ? (
								<IconButton
									style={{ color: "#ffffff" }}
									onClick={this.handleScreen}
								>
									{this.state.screen ? (
										<ScreenShareIcon />
									) : (
										<StopScreenShareIcon />
									)}
								</IconButton>
							) : null}
							<IconButton
								style={{ color: this.state.recording ? "red" : "#ffffff" }}
								onClick={
									this.state.recording
										? this.stopRecording
										: this.startRecording
								}
							>
								{this.state.recording ? (
									<StopIcon />
								) : (
									<FiberManualRecordIcon />
								)}
							</IconButton>
							<IconButton
								style={{ color: "#ffffff" }}
								onClick={this.openShare}
								title="Share meeting details"
							>
								<ShareIcon />
							</IconButton>
							<Badge
								badgeContent={this.state.newmessages}
								max={999}
								color="secondary"
								onClick={this.openChat}
							>
								<IconButton
									style={{ color: "#ffffff" }}
									onClick={this.openChat}
								>
									<ChatIcon />
								</IconButton>
							</Badge>
						</div>
						<Modal
							show={this.state.showModal}
							onHide={this.closeChat}
							style={{ zIndex: "999999" }}
						>
							<Modal.Header closeButton>
								<Modal.Title>Chat Room</Modal.Title>
							</Modal.Header>
							<Modal.Body style={{ overflow: "auto", height: "400px" }}>
								{this.state.messages.length > 0 ? (
									this.state.messages.map((item, index) => (
										<div key={index} style={{ marginBottom: "10px" }}>
											{item.isFile ? (
												<p style={{ wordBreak: "break-all", margin: 0 }}>
													<b>
														{item.sender}{" "}
														{item.isPrivate ? (
															<span style={{ color: "red" }}>(Private)</span>
														) : (
															""
														)}
													</b>
													:<br />
													<a
														href={item.data}
														download={item.fileName}
														style={{
															color: "#3f51b5",
															textDecoration: "underline",
														}}
													>
														Download {item.fileName}
													</a>
												</p>
											) : (
												<p style={{ wordBreak: "break-all", margin: 0 }}>
													<b>
														{item.sender}{" "}
														{item.isPrivate ? (
															<span style={{ color: "red" }}>(Private)</span>
														) : (
															""
														)}
													</b>
													: {item.data}
												</p>
											)}
										</div>
									))
								) : (
									<p>No message yet</p>
								)}
							</Modal.Body>
							<Modal.Footer
								style={{
									flexWrap: "nowrap",
									display: "flex",
									alignItems: "center",
								}}
							>
								<select
									style={{
										padding: "6px",
										borderRadius: "4px",
										border: "1px solid #ced4da",
									}}
									value={this.state.recipient}
									onChange={(e) => this.setState({ recipient: e.target.value })}
								>
									<option value="All">All</option>
									{Object.keys(connections).map((id) =>
										id !== socketId ? (
											<option key={id} value={id}>
												{this.state.usernames[id] ||
													`User ${id.substring(0, 5)}`}
											</option>
										) : null,
									)}
								</select>
								<input
									type="file"
									id="file-upload"
									style={{ display: "none" }}
									onChange={this.handleFile}
								/>
								<label htmlFor="file-upload" style={{ margin: 0 }}>
									<IconButton color="primary" component="span">
										<AttachFileIcon />
									</IconButton>
								</label>
								<Input
									placeholder="Message"
									value={this.state.message}
									onChange={(e) => this.handleMessage(e)}
									style={{ flexGrow: 1, marginLeft: "10px" }}
								/>
								<Button
									variant="contained"
									color="primary"
									onClick={this.sendMessage}
									style={{ marginLeft: "10px" }}
								>
									Send
								</Button>
							</Modal.Footer>
						</Modal>

						{/* Share Modal */}
						<Modal
							show={this.state.showShareModal}
							onHide={this.closeShare}
							style={{ zIndex: "999999" }}
							centered
						>
							<Modal.Header closeButton>
								<Modal.Title>Share Meeting</Modal.Title>
							</Modal.Header>
							<Modal.Body style={{ padding: "20px" }}>
								<div style={{ marginBottom: "20px" }}>
									<p style={{ fontWeight: "bold", margin: 0 }}>Meeting Code:</p>
									<div
										style={{
											padding: "10px",
											backgroundColor: "#f1f3f4",
											borderRadius: "4px",
											fontSize: "16px",
											marginTop: "5px",
											fontFamily: "monospace",
										}}
									>
										{window.location.pathname.replace("/", "")}
									</div>
								</div>

								<div style={{ marginBottom: "20px" }}>
									<p style={{ fontWeight: "bold", margin: 0 }}>Meeting Link:</p>
									<div style={{ display: "flex", marginTop: "5px" }}>
										<Input
											value={window.location.href}
											disabled
											style={{ flexGrow: 1 }}
										/>
										<Button
											variant="contained"
											color="primary"
											style={{ marginLeft: "10px", textTransform: "none" }}
											onClick={this.copyUrl}
										>
											Copy Link
										</Button>
									</div>
								</div>

								<div>
									<p style={{ fontWeight: "bold", margin: 0 }}>
										Invite by Email:
									</p>
									<div style={{ display: "flex", marginTop: "5px" }}>
										<Input
											placeholder="Enter email(s), comma separated"
											value={this.state.inviteEmail}
											onChange={this.handleInviteEmail}
											style={{ flexGrow: 1 }}
										/>
										<Button
											variant="contained"
											color="secondary"
											onClick={this.inviteByEmail}
											style={{ marginLeft: "10px", textTransform: "none" }}
										>
											Send Email
										</Button>
									</div>
								</div>
							</Modal.Body>
						</Modal>

						<div
							style={{ flexGrow: 1, overflow: "hidden", position: "relative" }}
						>
							<div id="main" className="video-grid"></div>
						</div>
					</div>
				)}
			</div>
		);
	}
}

export default VideoRoom;
