import React from 'react'
import ReactDOM from 'react-dom'
import 'bootstrap/scss/bootstrap.scss'
import './app.scss'

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
      case "error":
        c = "danger"; break;
    }
    return <span className={"label label-" + c}>{this.props.state}</span>;
  }
}

class JobList extends React.Component {
  render() {
    let jobs = this.props.jobs.map((job) => {
      return <tr key={job.id}>
      <td>{job.createdAt}</td>
      <td>{job.id}</td>
      <td><JobStateLabel state={job.state} /></td>
      </tr>
    });
    return <table className="table">
      <thead>
        <tr>
          <th>created</th>
          <th>ID</th>
          <th>status</th>
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
        <Navbar waiting={st.queueLength}/>
        <div className="container">
          <JobList jobs={st.jobs} />
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
  }
}

class Navbar extends React.Component {
  render() {
    return <nav className="navbar navbar-fixed-top navbar-dark bg-inverse">
      <a className="navbar-brand" href="#">SPARQL Proxy</a>
      <div className="navbar-text pull-xs-right">
        {this.props.waiting} job(s) waiting
      </div>
    </nav>;
  }
}

ReactDOM.render(
  <MainComponent />,
  document.getElementById('content')
);
