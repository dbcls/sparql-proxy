import React from 'react'
import ReactDOM from 'react-dom';

class MainComponent extends React.Component {
  constructor(props) {
    super(props);
    this.state = {state: null};
  }

  render() {
    let st = this.state.state;
    if (st) {
      return <div>Queue length: {st.queueLength}</div>;
    } else {
      return <div />
    }
  }

  componentDidMount() {
    var socket = io();
    socket.on('state', (state) => {
      this.setState({state: state});
    });
  }
}

ReactDOM.render(
  <MainComponent />,
  document.getElementById('content')
);
