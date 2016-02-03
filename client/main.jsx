import React from 'react'
import ReactDOM from 'react-dom';

class JobList extends React.Component {
  render() {
    let jobs = this.props.jobs.map((job) => {
      return <li key={job.id}>{job.id}: {job.state}</li>
    });
    return <div>
      <p>Jobs:</p>
      <ul>{jobs}</ul>
    </div>;
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
        <div># of jobs waiting: {st.queueLength}</div>
        <JobList jobs={st.jobs} />
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

ReactDOM.render(
  <MainComponent />,
  document.getElementById('content')
);
