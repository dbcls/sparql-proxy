import React from 'react';
import ReactDOM from 'react-dom';
import 'bootstrap/scss/bootstrap.scss';
import './app.scss';
import 'font-awesome/css/font-awesome.css';
import queryString from 'query-string';
import 'babel-regenerator-runtime';

import CodeMirror from 'codemirror';
import 'codemirror/lib/codemirror.css';
import 'sparql-support/js/sparql';
import 'sparql-support';
import 'sparql-support/css/base.css';

class Navbar extends React.Component {
  render() {
    return (
      <nav className="navbar fixed-top navbar-dark bg-dark">
        <span className="navbar-brand fg-dark">SPARQL Proxy</span>
      </nav>
    );
  }
}

class Editor extends React.Component {
  render() {
    const textareaStyle = {
      width: "100%",
      height: "400px"
    };
    return <div>
      <textarea ref={ref => this.textareaNode = ref} style={textareaStyle} />
    </div>;
  }
  componentDidMount() {
    const options = {
      mode: "application/sparql-query",
      matchBrackets: true,
      autoCloseBrackets: true,
      lineNumbers: true,
      sparqlSupportQueries: 'query', // Tabbed interface
      sparqlSupportAutoComp: 'query', // Auto completion
      sparqlSupportInnerMode: 'query', // Inner mode
      extraKeys: {
        "Tab": () => false,
        "Ctrl-Space": () => false,
      }
    };

    this.codeMirror = CodeMirror.fromTextArea(this.textareaNode, options);
  }
}

class QueryBox extends React.Component {
  constructor() {
    super(...arguments);
    this.state = { response: null, request: null };
  }

  render() {
    return (
      <div className="container-fluid">
        <form action="">
          <div className="form-group">
            <Editor />
          </div>
          <button class="btn btn-primary">
            Run Query
            <span class="ml-1 small">(Ctrl+Enter)</span>
          </button>
        </form>
      </div>
    );
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
