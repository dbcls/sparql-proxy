import React from 'react';
import ReactDOM from 'react-dom';
import 'bootstrap/scss/bootstrap.scss';
import './app.scss';
import 'font-awesome/css/font-awesome.css';
import uuid from 'uuid';
import queryString from 'query-string';

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
  constructor() {
    super(...arguments);
    this.state = {query: this.props.query};
  }

  render() {
    let requestStatus = "";
    if (this.props.running) {
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
        <button type="submit" className="btn btn-default" disabled={this.props.running}>Submit</button>
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
  constructor() {
    super(...arguments);
    this.state = {response: null, request: null};
  }

  render() {
    const res = this.state.response ? <ResponseBox response={this.state.response} /> : "";
    return <div className="container-fluid">
      <RequestBox query={this.props.query} onSubmit={this.handleSubmit.bind(this)} request={this.state.request} running={this.state.running} />
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
    this.setState({response: null, request: {jobState: null}, running: true});
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
      this.setState({request: null, running: false});
      if (response.status >= 200 && response.status < 300) {
        response.text().then((text) => {
          this.setState({response: {statusText: st, data: text}});
        })
      } else {
        if (/^application\/json\b/.test(response.headers.get('content-type'))) {
          response.json().then((obj) => {
            this.setState({response: {statusText: st, error: obj.message, data: obj.data}});
          });
        } else {
          response.text().then((text) => {
            this.setState({response: {statusText: st, error: text}});
          });
        }
      }
    }).catch((err) => {
      clearInterval(timerId);
      console.log('failed', err);
      this.setState({response: {error: err.message}, request: {jobState: null}, running: false});
    });
  }
}

class MainComponent extends React.Component {
  constructor() {
    super(...arguments);
    this.query = queryString.parse(window.location.search).query || '';
  }

  render() {
    return <div>
      <Navbar />
      <QueryBox query={this.query} />
    </div>;
  }
}

ReactDOM.render(
  <MainComponent />,
  document.getElementById('content')
);
