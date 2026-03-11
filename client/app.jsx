import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "bootstrap/dist/css/bootstrap.css";
import "./app.scss";
import "font-awesome/css/font-awesome.css";
import "babel-regenerator-runtime";

import CodeMirror from "codemirror";
import "codemirror/lib/codemirror.css";
import "codemirror/addon/fold/foldgutter.css";
import "codemirror/addon/fold/foldcode";
import "codemirror/addon/fold/foldgutter";
import "codemirror/addon/search/match-highlighter.js";
import "sparql-support/src/sparql";
import "sparql-support/src/sparql-support";
import "sparql-support/src/sparql-fold";
import "sparql-support/css/base.css";

const Navbar = () => (
  <nav className="navbar fixed-top navbar-dark bg-dark">
    <div className="container-fluid">
      <span className="navbar-brand fg-dark">SPARQL Proxy</span>
    </div>
  </nav>
);

const Editor = ({ query }) => {
  const textareaRef = useRef(null);

  useEffect(() => {
    if (!textareaRef.current) {
      return undefined;
    }

    const codeMirror = CodeMirror.fromTextArea(textareaRef.current, {
      mode: "application/sparql-query",
      matchBrackets: true,
      autoCloseBrackets: true,
      lineNumbers: true,
      sparqlSupportQueries: "query", // Tabbed interface
      sparqlSupportAutoComp: "query", // Auto completion
      sparqlSupportInnerMode: "query", // Inner mode
      extraKeys: {
        Tab: () => false,
        "Ctrl-Space": () => false,
        "Ctrl-Q": (cm) => {
          cm.foldCode(cm.getCursor());
        },
      },
      foldGutter: true,
      gutters: ["CodeMirror-linenumbers", "CodeMirror-foldgutter"],
      highlightSelectionMatches: { showToken: /[\w:]/ },
    });

    if (query !== null) {
      codeMirror.setValue(query);
    }

    // force sparql-support to synchronize query buffers
    codeMirror.getWrapperElement().dispatchEvent(new KeyboardEvent("keydown"));
    return () => {
      codeMirror.toTextArea();
    };
  }, [query]);

  return (
    <div>
      <textarea
        ref={textareaRef}
        style={{ width: "100%", height: "400px" }}
      ></textarea>
    </div>
  );
};

const QueryBox = ({ query }) => (
  <div className="container-fluid">
    <form action="./sparql">
      <Editor query={query} />

      <button className="btn btn-primary my-2">
        Run Query
        <span className="ms-1 small" style={{ pointerEvents: "none" }}>
          (Ctrl+Enter)
        </span>
      </button>
    </form>
  </div>
);

const App = () => {
  const [query, setQuery] = useState(null);
  useEffect(() => {
    setQuery(new URLSearchParams(window.location.search).get("query"));
  }, []);

  return (
    <>
      <Navbar />
      <QueryBox query={query} />
    </>
  );
};

const root = createRoot(document.getElementById("content"));
root.render(<App />);
