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
    const isRunning = !!this.props.request;
    let requestStatus = "";
    if (isRunning) {
      requestStatus = <span>
        <span className="running-icon fa fa-refresh fa-spin"></span>
        <span>{this.props.request.jobState}</span>
      </span>;
    }
    return <div className="card card-block">
      <h4 className="card-title">Query</h4>
      <form onSubmit={this.handleSubmit.bind(this)}>
        <div className="form-group">
          <textarea className="form-control" rows="5" onChange={this.handleQueryChange.bind(this)} value={this.state.query} />
        </div>
        <button type="submit" className="btn btn-default" disabled={isRunning}>Submit</button>
        {requestStatus}
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
}

class QueryBox extends React.Component {
  constructor(props) {
    super(props);
    this.state = {response: null, request: null};
  }

  render() {
    const res = this.state.response ? <ResponseBox response={this.state.response} /> : "";
    return <div className="container-fluid">
      <RequestBox onSubmit={this.handleSubmit.bind(this)} request={this.state.request}/>
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
    this.setState({response: null, request: {jobState: null}});
    const token = uuid.v4();
    const result = fetch('/sparql?token=' + token + '&query=' + encodeURIComponent(query));
    const timerId = setInterval(() => {
      const r = fetch('/jobs/' + token);
      r.then(this.checkStatus)
       .then((response) => (response.json()))
       .then((data) => {
         this.setState({request: {jobState: data.state}});
         if (data.done) {
           clearInterval(timerId);
         }
      }).catch((err) => {
        clearInterval(timerId);
      });
    }, 1000);

    result.then((response) => {
      clearInterval(timerId);
      const st = `${response.status} ${response.statusText}`;
      this.setState({request: null});
      if (response.status >= 200 && response.status < 300) {
        response.text().then((text) => {
          this.setState({response: {statusText: st, data: text}});
        })
      } else {
        response.text().then((text) => {
          this.setState({response: {statusText: st, error: text}});
        });
      }
    }).catch((err) => {
      clearInterval(timerId);
      console.log('failed', err);
      this.setState({response: {error: err}, request: null});
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
