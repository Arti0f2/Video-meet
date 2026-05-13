import React, { Component } from "react";
import VideoRoom from "./pages/VideoRoom";
import Home from "./pages/Home";
import { BrowserRouter as Router, Switch, Route } from "react-router-dom";

class App extends Component {
	render() {
		return (
			<div>
				<Router>
					<Switch>
						<Route path="/" exact component={Home} />
						<Route path="/:url" component={VideoRoom} />
					</Switch>
				</Router>
			</div>
		);
	}
}

export default App;
