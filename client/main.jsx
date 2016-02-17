import React from 'react'
import ReactDOM from 'react-dom'
import 'bootstrap/scss/bootstrap.scss'
import './app.scss'
import moment from 'moment'

class JobStateLabel extends React.Component {
  render() {
    let state = this.props.state;
    let c = "default";
    switch (state) {
      case "queued":
        c = "default"; break;
      case "success":
        c = "success"; break;
      case "running":
        c = "primary"; break;
      case "timeout":
        c = "warning"; break;
      case "error":
        c = "danger"; break;
    }
    return <span className={"label label-" + c}>{this.props.state}</span>;
  }
}

class JobList extends React.Component {
  render() {
    let jobs = this.props.jobs.map((job) => {
      let runtime;
      if (job.doneAt) {
        runtime = moment(job.doneAt).diff(job.startedAt) + "ms";
      }
      let age = moment(job.createdAt).from(this.props.now);
      return <tr key={job.id}>
      <td><JobStateLabel state={job.state} /></td>
      <td>{job.id}</td>
      <td>{age}</td>
      <td>{runtime}</td>
      </tr>
    });
    return <table className="table">
      <thead>
        <tr>
          <th>status</th>
          <th>ID</th>
          <th>created</th>
          <th>runtime</th>
        </tr>
      </thead>
      <tbody>
      {jobs}
      </tbody>
    </table>;
  }
}

class MainComponent extends React.Component {
  constructor(props) {
    super(props);
    this.state = {state: null};
  }

  render() {
    let st = this.state.state;
    if (st) {
      return <div>
        <Navbar waiting={st.numWaiting} running={st.numRunning}/>
        <div className="container">
          <JobList jobs={st.jobs} now={st.now}/>
        </div>
      </div>;
    } else {
      return <div />
    }
  }

  componentDidMount() {
    var socket = io();
    socket.on('state', (state) => {
      console.log('state received', state);
      this.setState({state: state});
    });
    setInterval(() => {
      this.setState({now: moment()});
    }, 5000);
  }
}

class Navbar extends React.Component {
  render() {
    return <nav className="navbar navbar-fixed-top navbar-dark bg-inverse">
      <a className="navbar-brand" href="#">SPARQL Proxy</a>
      <div className="navbar-text pull-xs-right">
        {this.props.running} running, {this.props.waiting} waiting
      </div>
    </nav>;
  }
}

ReactDOM.render(
  <MainComponent />,
  document.getElementById('content')
);
