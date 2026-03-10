import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { io } from "socket.io-client";
import moment from "moment";
import queryString from "query-string";

import "bootstrap/scss/bootstrap.scss";
import "./app.scss";

const jobLabelMapping = {
  waiting: "default",
  success: "success",
  running: "primary",
  timeout: "danger",
  error: "danger",
  canceled: "warning",
};

const JobStateLabel = ({ state, reason }) => {
  const label = state === "done" && reason ? reason : state;
  const color = jobLabelMapping[label] || "default";

  return <span className={"label label-" + color}>{label}</span>;
};

const CancelButton = ({ onClick }) => (
  <button className="btn btn-danger" onClick={onClick}>
    Cancel
  </button>
);

const JobList = ({ jobs, now, onCancel }) => {
  const rows = jobs.map((job) => {
    let runtime;
    if (job.startedAt) {
      const end = moment(job.doneAt || now);
      const elapsed = end.diff(job.startedAt);
      if (elapsed > 0) {
        runtime = elapsed + "ms";
      }
    }

    const age = moment(job.createdAt).from(now);
    const redoLink =
      "../sparql?" + queryString.stringify({ query: job.data.rawQuery });

    return (
      <tr key={job.id}>
        <td>
          <JobStateLabel state={job.state} reason={job.data.reason} />
        </td>
        <td>{job.data.ip}</td>
        <td>
          <pre>{job.data.rawQuery}</pre>
          <a href={redoLink} target="_blank" rel="noopener noreferrer">
            try this query
          </a>
        </td>
        <td>{age}</td>
        <td>{runtime}</td>
        <td>
          {job.state !== "done" ? (
            <CancelButton onClick={() => onCancel(job)} />
          ) : null}
        </td>
      </tr>
    );
  });

  return (
    <table className="table my-3">
      <thead>
        <tr>
          <th>status</th>
          <th>requester</th>
          <th>query</th>
          <th>created</th>
          <th>runtime</th>
          <th>control</th>
        </tr>
      </thead>
      <tbody>{rows}</tbody>
    </table>
  );
};

const Navbar = ({ waiting, running }) => (
  <nav className="navbar navbar-expand-lg fixed-top navbar-dark bg-dark">
    <div className="container-fluid">
      <a className="navbar-brand" href="#">
        SPARQL Proxy
      </a>
      <div className="me-auto"></div>
      <div className="navbar-text">
        {running} running, {waiting} waiting
      </div>
    </div>
  </nav>
);

const MainComponent = () => {
  const [state, setState] = useState(null);
  const [now, setNow] = useState(() => moment());
  const socketRef = useRef(null);

  useEffect(() => {
    const socket = io(location.origin, {
      path: location.pathname + "../socket.io",
    });
    socketRef.current = socket;

    socket.on("state", (nextState) => {
      console.log("state received", nextState);
      setState(nextState);
    });

    const timerId = window.setInterval(() => {
      setNow(moment());
    }, 1000);

    return () => {
      window.clearInterval(timerId);
      socketRef.current = null;
      socket.disconnect();
    };
  }, []);

  if (!state) {
    return <div />;
  }

  const handlePurgeCache = () => {
    socketRef.current?.emit("purge_cache");
  };

  const handleCancelJob = (job) => {
    socketRef.current?.emit("cancel_job", { id: job.id });
  };

  return (
    <div>
      <Navbar waiting={state.numWaiting} running={state.numRunning} />
      <div className="container">
        <div className="text-xl-right m-b-1 my-3">
          <button className="btn btn-danger" onClick={handlePurgeCache}>
            Purge cache
          </button>
        </div>
        <JobList jobs={state.jobs} now={now} onCancel={handleCancelJob} />
      </div>
    </div>
  );
};

const root = createRoot(document.getElementById("content"));
root.render(<MainComponent />);
