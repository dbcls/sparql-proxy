import React from 'react';
import ReactDOM from 'react-dom';
import 'bootstrap/scss/bootstrap.scss';
import './app.scss';
import 'font-awesome/css/font-awesome.css';
import 'babel-regenerator-runtime';

import CodeMirror from 'codemirror';
import 'codemirror/lib/codemirror.css';
import 'sparql-support/src/sparql';
import 'sparql-support/src/sparql-support';
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

    return (
      <div>
        <textarea ref={ref => this.textareaNode = ref} style={textareaStyle}></textarea>
      </div>
    );
  }

  componentDidMount() {
    const codeMirror = CodeMirror.fromTextArea(this.textareaNode, {
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
    });

    const query = this.props.query;

    if (query !== null) {
      codeMirror.setValue(query);
    }

    // force sparql-support to synchronize query buffers
    codeMirror.getWrapperElement().dispatchEvent(new KeyboardEvent('keydown'));
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
        <form action="./sparql">
          <div className="form-group">
            <Editor query={this.props.query} />
          </div>

          <button className="btn btn-primary mt-0 mb-3">
            Run Query
            <span className="ml-1 small" style={{pointerEvents: 'none'}}>(Ctrl+Enter)</span>
          </button>
        </form>
      </div>
    );
  }
}

class MainComponent extends React.Component {
  constructor() {
    super(...arguments);
    this.query = new URLSearchParams(window.location.search).get('query');
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
