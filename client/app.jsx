import React from 'react'
import ReactDOM from 'react-dom'
import 'bootstrap/scss/bootstrap.scss'
import './app.scss'
import 'font-awesome/css/font-awesome.css'

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
      <h4 className="card-title">Response</h4>
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
        {this.spinner()}
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
      running: false
    };
  }

  render() {
    const res = this.state.response ? <ResponseBox response={this.state.response} /> : "";
    return <div className="container-fluid">
      <RequestBox onSubmit={this.handleSubmit.bind(this)} running={this.state.running}/>
      {res}
    </div>;
  }

  handleSubmit(query) {
    this.setState({response: null, running: true});
    const result = fetch('/sparql?query=' + encodeURIComponent(query));
    result.then((response) => {
      if (response.status >= 200 && response.status < 300) {
        response.text().then((text) => {
          this.setState({response: {data: text}, running: false});
        });
      } else {
        response.text().then((text) => {
          this.setState({response: {error: text}, running: false});
        });
      }
    }).catch((err) => {
      console.log('failed', err);
      this.setState({response: {error: 'failed'}, running: false});
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
