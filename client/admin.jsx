import React from 'react'
import ReactDOM from 'react-dom'
import 'bootstrap/scss/bootstrap.scss'
import './app.scss'
import moment from 'moment'

const jobLabelMapping = {
  waiting:  'default',
  success:  'success',
  running:  'primary',
  timeout:  'danger',
  error:    'danger',
  canceled: 'warning'
};

class JobStateLabel extends React.Component {
  render() {
    const state = this.props.state;
    const reason = this.props.reason;
    const label = (state === 'done') ? reason : state;
    const c = jobLabelMapping[label] || 'default';

    return (
      <span className={"label label-" + c}>{label}</span>
    );
  }
}

class CancelButton extends React.Component {
  render() {
    return (
      <button className="btn btn-danger" onClick={this.props.onClick}>Cancel</button>
    );
  }
}

class JobList extends React.Component {
  render() {
    const jobs = this.props.jobs.map((job) => {
      let runtime;
      if (job.startedAt) {
        const end = moment(job.doneAt || this.props.now);
        if (end) {
          const elapsed = end.diff(job.startedAt);
          if (elapsed > 0) {
            runtime = elapsed + "ms";
          }
        }
      }
      const age = moment(job.createdAt).from(this.props.now);
      let cancelButtonColumn = <td></td>;
      if (job.state !== "done") {
        const cancel = this.props.onCancel.bind(null, job);
        cancelButtonColumn = <td><CancelButton onClick={cancel}/></td>;
      }
      return (
        <tr key={job.id}>
          <td><JobStateLabel state={job.state} reason={job.data.reason}/></td>
          <td>{job.data.ip}</td>
          <td>{job.id}</td>
          <td>{age}</td>
          <td>{runtime}</td>
          {cancelButtonColumn}
        </tr>
      );
    });
    return (
      <table className="table">
        <thead>
          <tr>
            <th>status</th>
            <th>requester</th>
            <th>ID</th>
            <th>created</th>
            <th>runtime</th>
            <th>control</th>
          </tr>
        </thead>
        <tbody>
        {jobs}
        </tbody>
      </table>
    );
  }
}

class MainComponent extends React.Component {
  constructor() {
    super(...arguments);
    this.state = {state: null};
  }

  render() {
    const st = this.state.state;
    if (st) {
      return (
        <div>
          <Navbar waiting={st.numWaiting} running={st.numRunning}/>
          <div className="container">
            <div className="text-xs-right m-b-1">
              <button className="btn btn-danger" onClick={this.purgeCache.bind(this)}>Purge cache</button>
            </div>
            <JobList jobs={st.jobs} now={this.state.now} onCancel={this.cancelJob.bind(this)}/>
          </div>
        </div>
      );
    } else {
      return (
        <div />
      );
    }
  }

  purgeCache() {
    this.socket.emit('purge_cache');
  }

  cancelJob(job) {
    this.socket.emit('cancel_job', {id: job.id});
  }

  componentDidMount() {
    const socket = io();
    this.socket = socket;
    socket.on('state', (state) => {
      console.log('state received', state);
      this.setState({state: state});
    });
    setInterval(() => {
      this.setState({now: moment()});
    }, 1000);
  }
}

class Navbar extends React.Component {
  render() {
    return (
      <nav className="navbar navbar-fixed-top navbar-dark bg-inverse">
        <a className="navbar-brand" href="#">SPARQL Proxy</a>
        <div className="navbar-text pull-xs-right">
          {this.props.running} running, {this.props.waiting} waiting
        </div>
      </nav>
    );
  }
}

ReactDOM.render(
  <MainComponent />,
  document.getElementById('content')
);
