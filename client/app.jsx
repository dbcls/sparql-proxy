import React from 'react';
import ReactDOM from 'react-dom';
import 'bootstrap/scss/bootstrap.scss';
import './app.scss';
import 'font-awesome/css/font-awesome.css';
import uuid from 'uuid';
import queryString from 'query-string';
import '@babel/polyfill';

class Navbar extends React.Component {
  render() {
    return (
      <nav className="navbar fixed-top navbar-dark bg-dark">
        <a className="navbar-brand" href="#">SPARQL Proxy</a>
      </nav>
    );
  }
}

class StatusLabel extends React.Component {
  render() {
    const n = Math.floor(this.props.response.statusCode / 100);
    const c = { 2: 'success', 3: 'info', 4: 'danger', 5: 'danger' }[n] || 'default';

    return (
      <span className={"label label-" + c}>{this.props.response.statusText}</span>
    );
  }
}

class ResponseBox extends React.Component {
  render() {
    let table = "";
    if (!this.props.response.error) {
      const json = JSON.parse(this.props.response.data);
      if (this.props.response.ok && json.results && json.results.bindings) {
        table = <SparqlResultTable json={json} />;
      }
    }
    return (
      <div className="card card-body my-3">
        <h4 className="card-title">Response <StatusLabel response={this.props.response} /></h4>
        {this.error()}
        {table}
        <textarea className="form-control" rows="10" value={this.props.response.data} readOnly />
      </div>
    );
  }

  error() {
    if (this.props.response.error) {
      return (
        <div className="alert alert-danger">{this.props.response.error}</div>
      );
    } else {
      return '';
    }
  }
}

class SparqlResultTable extends React.Component {
  render() {
    const head = this.props.json.head.vars;
    const data = this.props.json.results.bindings;

    const ths = head.map((col) => {
      return (
        <th>{col}</th>
      );
    });

    const trs = data.map((row) => {
      const tds = head.map((c) => {
        const value = row[c] ? row[c].value : "";
        return (
          <td>{value}</td>
        );
      });
      return (
        <tr>{tds}</tr>
      );
    });

    return (
      <table className="table sparql-results">
        <thead><tr>{ths}</tr></thead>
        <tbody>
          {trs}
        </tbody>
      </table>
    );
  }
}

class RequestBox extends React.Component {
  constructor() {
    super(...arguments);
    this.state = { query: this.props.query };
  }

  render() {
    let requestStatus = "";
    if (this.props.running) {
      requestStatus = (
        <span>
          <span className="running-icon fa fa-refresh fa-spin"></span>
          <span>{this.props.request.jobState}</span>
        </span>
      );
    }
    return (
      <div className="card card-body my-3">
        <h4 className="card-title">Query</h4>
        <form onSubmit={this.handleSubmit.bind(this)}>
          <div className="form-group">
            <textarea className="form-control" rows="5" onChange={this.handleQueryChange.bind(this)} value={this.state.query} />
          </div>
          <button type="submit" className="btn btn-default" disabled={this.props.running}>Submit</button>
          {requestStatus}
        </form>
      </div>
    );
  }

  handleQueryChange(e) {
    this.setState({ query: e.target.value });
  }

  handleSubmit(e) {
    e.preventDefault();
    this.props.onSubmit(this.state.query);
  }
}

class QueryBox extends React.Component {
  constructor() {
    super(...arguments);
    this.state = { response: null, request: null };
  }

  render() {
    const res = this.state.response ? <ResponseBox response={this.state.response} /> : "";
    return (
      <div className="container-fluid">
        <RequestBox query={this.props.query} onSubmit={this.handleSubmit.bind(this)} request={this.state.request} running={this.state.running} />
        {res}
      </div>
    );
  }

  async handleSubmit(query) {
    this.setState({ response: null, request: { jobState: null }, running: true });
    const token = uuid.v4();

    const timerId = setInterval(async () => {
      const job = await fetch(`./jobs/${token}`);
      const { state } = await job.json();
      this.setState({ request: { jobState: state } });
    }, 1000);

    try {
      const params = queryString.stringify({ query, token });
      const response = await fetch(`./sparql?${params}`, {
        headers: {
          'accept': 'application/sparql-results+json'
        }
      });
      const statusText = `${response.status} ${response.statusText}`;
      const statusCode = response.status;
      this.setState({ request: null, running: false });

      if (response.ok) {
        const data = await response.text();
        this.setState({ response: { statusText, statusCode, data, ok: true } });
      } else {
        if (response.headers.get('content-type').indexOf('application/json') !== -1) {
          const { message, data } = await response.json();
          this.setState({ response: { statusText, statusCode, error: message, data } });
        } else {
          const error = await response.text();
          this.setState({ response: { statusText, statusCode, error } });
        }
      }
    } catch (err) {
      console.log('failed', err);
      this.setState({ response: { error: err.message }, request: { jobState: null }, running: false });
    } finally {
      clearInterval(timerId);
    }
  }
}

class MainComponent extends React.Component {
  constructor() {
    super(...arguments);
    this.query = queryString.parse(window.location.search).query || '';
  }

  render() {
    return (
      <div>
        <Navbar />
        <QueryBox query={this.query} />
      </div>
    );
  }
}

ReactDOM.render(
  <MainComponent />,
  document.getElementById('content')
);
