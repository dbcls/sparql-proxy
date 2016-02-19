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

class QueryBox extends React.Component {
  constructor(props) {
    super(props);
    this.state = {query: "", response: "", running: false};
  }

  render() {
    let error = "";
    if (this.state.error) {
      error = <div className="alert alert-danger">{this.state.error}</div>
    }
    let running = "";
    if (this.state.running) {
      running = <span className="running-icon fa fa-refresh fa-spin"></span>
    }
    return <div className="container-fluid">
      <div className="card card-block">
        <h4 className="card-title">Query</h4>
        <form onSubmit={this.handleSubmit.bind(this)}>
          <div className="form-group">
            <textarea className="form-control" rows="5" onChange={this.handleQueryChange.bind(this)} value={this.state.query} />
          </div>
          <button type="submit" className="btn btn-default" disabled={this.state.running}>Submit</button>
          {running}
        </form>
      </div>

      <div className="card card-block">
        <h4 className="card-title">Response</h4>
        {error}
        <textarea className="form-control" rows="10" value={this.state.response} readOnly/>
      </div>
    </div>;
  }

  handleQueryChange(e) {
    this.setState({query: e.target.value});
  }

  handleSubmit(e) {
    e.preventDefault();
    this.setState({response: '', error: '', running: true});
    const result = fetch('/sparql?query=' + encodeURIComponent(this.state.query));
    result.then((response) => {
      if (response.status == 200) {
        response.text().then((text) => {
          this.setState({response: text, error: '', running: false});
        });
      } else {
        response.text().then((text) => {
          this.setState({response: '', error: text, running: false});
        });
      }
    }).catch((err) => {
      console.log('failed', err);
      this.setState({response: '', error: 'failed', running: false});
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
