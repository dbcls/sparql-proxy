import uuid from 'uuid'
import { EventEmitter } from 'events'

class JobWrapper {
  constructor(resolve, reject, job, token) {
    this.resolve   = resolve;
    this.reject    = reject;
    this.job       = job;
    this.createdAt = new Date();
    this.id        = uuid.v4();
    this.state     = 'waiting';
    this.token     = token;
  }

  data() {
    return {
      id:        this.id,
      state:     this.state,
      createdAt: this.createdAt,
      startedAt: this.startedAt,
      doneAt:    this.doneAt
    };
  }

  start() {
    this.state     = 'running';
    this.startedAt = new Date();
  }

  done() {
    this.state  = 'done';
    this.doneAt = new Date();
  }
}

export default class extends EventEmitter {
  constructor(maxWaiting, maxConcurrency, durationToKeepOldJobs) {
    super();

    this.jobs = {};
    this.waiting = [];
    this.maxWaiting = maxWaiting;
    this.maxConcurrency = maxConcurrency;
    this.durationToKeepOldJobs = durationToKeepOldJobs;
    this.numRunning = 0;

    setInterval(() => {
      const now = new Date();
      this.sweepOldJobs(now - this.durationToKeepOldJobs);
    }, 5 * 1000);
  }

  state() {
    let jobList = [];
    for (let id in this.jobs) {
      jobList.push(this.jobs[id].data());
    }
    jobList.sort((a, b) => {
      return b.createdAt - a.createdAt;
    });

    return {
      numWaiting: this.waiting.length,
      numRunning: this.numRunning,
      jobs: jobList
    };
  }

  publishState() {
    this.emit('state', this.state());
  }

  enqueue(job, token) {
    return new Promise((resolve, reject) => {
      if (this.waiting.length >= this.maxWaiting) {
        const err = new Error('Too many waiting jobs');
        err.statusCode = 503;
        err.data = 'Too many waiting jobs';
        reject(err);
        return;
      }

      job.on('update', this.publishState.bind(this));

      const jw = new JobWrapper(resolve, reject, job, token);
      this.waiting.push(jw);
      this.jobs[jw.id] = jw;
      console.log(`${jw.id} queued; token=${jw.token}`);
      this.publishState();

      this._dequeue();
    });
  }

  _dequeue() {
    if (this.numRunning >= this.maxConcurrency) {
      return false;
    }

    const item = this.waiting.shift();
    if (!item) {
      return false;
    }

    try {
      this.numRunning++;

      console.log(`${item.id} start`);
      item.start();
      item.job.run()
        .then((value) => {
          this.numRunning--;
          item.done();
          this.publishState();
          item.resolve(value);
          this._dequeue();
        }, (err) => {
          this.numRunning--;
          item.done();
          this.publishState();
          item.reject(err);
          this._dequeue();
        });
    } catch (err) {
      this.numRunning--;
      item.done();
      this.publishState();
      item.reject(err);
      this._dequeue();
    }
    return true;
  }

  cancel(jobId) {
    let n = -1;

    for (let i in this.waiting) {
      if (this.waiting[i].id == jobId) {
        n = i;
        break;
      }
    }

    if (n >= 0) {
      const job = this.waiting[n].job;
      this.waiting.splice(n, 1);
      job.canceled();
      this.publishState();
      return true;
    } else {
      // job is running
      const jw = this.jobs[jobId];
      const job = jw.job;
      if (job) {
        job.canceled();
        this.publishState();
        return true;
      } else {
        return false;
      }
    }
  }

  jobStatus(token) {
    let job;
    for (let id in this.jobs) {
      const jw = this.jobs[id];
      const j = jw.job;
      if (jw.token && jw.token == token) {
        job = j;
        break;
      }
    }
    if (!job) {
      return null;
    }
    const done = ['success', 'error', 'timeout'].indexOf(job.state) >= 0;
    return {state: job.state, done: done};
  }

  sweepOldJobs(threshold) {
    let deleted = false;
    for (let id in this.jobs) {
      const jw = this.jobs[id];
      const job = jw.job;
      if ((job.doneAt && job.doneAt < threshold)
          || (job.canceledAt && job.canceledAt < threshold)) {
        delete this.jobs[id];
        deleted = true;
      }
    }
    if (deleted) {
      this.publishState();
    }
  }
}
