import React from 'react'
import ReactDOM from 'react-dom'
import 'bootstrap/scss/bootstrap.scss'
import './app.scss'

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
    this.state = {query: "", response: ""};
  }

  render() {
    return <div className="container-fluid">
      <div className="card card-block">
        <h4 className="card-title">Query</h4>
        <form onSubmit={this.handleSubmit.bind(this)}>
          <div className="form-group">
            <textarea className="form-control" rows="5" onChange={this.handleQueryChange.bind(this)} value={this.state.query} />
          </div>
          <button type="submit" className="btn btn-default">Submit</button>
        </form>
      </div>

      <div className="card card-block">
        <h4 className="card-title">Response</h4>
        <textarea className="form-control" rows="10" value={this.state.response} readonly/>
      </div>
    </div>;
  }

  handleQueryChange(e) {
    this.setState({query: e.target.value});
  }

  handleSubmit(e) {
    e.preventDefault();
    console.log(this.state.query);
    const result = fetch('/sparql?query=' + encodeURIComponent(this.state.query));
    console.log(result);
    result.then((response) => {
      response.text().then((text) => {
        this.setState({response: text});
      });
    }).catch((err) => {
      console.log('failed', err);
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
