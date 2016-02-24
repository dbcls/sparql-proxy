import React from 'react'
import ReactDOM from 'react-dom'
import 'bootstrap/scss/bootstrap.scss'
import './app.scss'
import 'font-awesome/css/font-awesome.css'
import uuid from 'uuid'

class Navbar extends React.Component {
  render() {
    return <nav className="navbar navbar-fixed-top navbar-dark bg-inverse">
      <a className="navbar-brand" href="#">SPARQL Proxy</a>
    </nav>;
  }
}

class ResponseBox extends React.Component {
  render() {
    return <div className="card card-block">
      <h4 className="card-title">Response <span className="label label-default">{this.props.response.statusText}</span></h4>
      {this.error()}
      <textarea className="form-control" rows="10" value={this.props.response.data} readOnly/>
    </div>;
  }

  error() {
    if (this.props.response.error) {
      return <div className="alert alert-danger">{this.props.response.error}</div>
    }
    return "";
  }
}

class RequestBox extends React.Component {
  constructor(props) {
    super(props);
    this.state = {query: ""};
  }

  render() {
    return <div className="card card-block">
      <h4 className="card-title">Query</h4>
      <form onSubmit={this.handleSubmit.bind(this)}>
        <div className="form-group">
          <textarea className="form-control" rows="5" onChange={this.handleQueryChange.bind(this)} value={this.state.query} />
        </div>
        <button type="submit" className="btn btn-default" disabled={this.props.running}>Submit</button>
        {this.spinner()} {this.props.state}
      </form>
    </div>;
  }

  handleQueryChange(e) {
    this.setState({query: e.target.value});
  }

  handleSubmit(e) {
    e.preventDefault();
    this.props.onSubmit(this.state.query);
  }

  spinner() {
    if (this.props.running) {
      return <span className="running-icon fa fa-refresh fa-spin"></span>;
    }
    return "";
  }
}

class QueryBox extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      response: null,
      running: false,
      jobState: null,
    };
  }

  render() {
    const res = this.state.response ? <ResponseBox response={this.state.response} /> : "";
    return <div className="container-fluid">
      <RequestBox onSubmit={this.handleSubmit.bind(this)} running={this.state.running} state={this.state.jobState}/>
      {res}
    </div>;
  }

  checkStatus(response) {
    if (response.status >= 200 && response.status < 300) {
      return response;
    } else {
      var error = new Error(response.statusText);
      throw error;
    };
  }

  handleSubmit(query) {
    this.setState({response: null, running: true, jobState: null});
    const token = uuid.v4();
    const result = fetch('/sparql?token=' + token + '&query=' + encodeURIComponent(query));
    const timerId = setInterval(() => {
      const r = fetch('/jobs/' + token);
      r.then(this.checkStatus)
       .then((response) => (response.json()))
       .then((data) => {
         this.setState({jobState: data.state});
         if (data.done) {
           clearInterval(timerId);
         }
      }).catch((err) => {
        clearInterval(timerId);
      });
    }, 1000);

    result.then((response) => {
      const st = `${response.status} ${response.statusText}`;
      if (response.status >= 200 && response.status < 300) {
        response.text().then((text) => {
          this.setState({response: {statusText: st, data: text}, running: false, jobState: null});
        });
      } else {
        clearInterval(timerId);
        response.text().then((text) => {
          this.setState({response: {statusText: st, error: text}, running: false, jobState: null});
        });
      }
    }).catch((err) => {
      clearInterval(timerId);
      console.log('failed', err);
      this.setState({response: {error: 'failed'}, running: false, jobState: null});
    });
  }
}

class MainComponent extends React.Component {
  render() {
    return <div>
      <Navbar />
      <QueryBox />
    </div>;
  }
}

ReactDOM.render(
  <MainComponent />,
  document.getElementById('content')
);
