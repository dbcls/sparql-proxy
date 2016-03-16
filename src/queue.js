import uuid from 'uuid';
import { EventEmitter } from 'events';
import { aborted } from './job';

class Item extends EventEmitter {
  constructor(job, token) {
    super();

    this.job       = job;
    this.token     = token;
    this.createdAt = new Date();
    this.id        = uuid.v4();
    this.state     = 'waiting';
    this.userData  = {};

    this.updateUserData();

    job.on('update', () => {
      this.updateUserData();
      this.emit('update');
    });
  }

  updateUserData() {
    Object.assign(this.userData, this.job.data || {});
  }

  data() {
    return {
      id:        this.id,
      state:     this.state,
      createdAt: this.createdAt,
      startedAt: this.startedAt,
      doneAt:    this.doneAt,
      data:      this.userData
    };
  }

  async run() {
    this.running();

    try {
      const data = await this.job.run();

      this.emit('success', data);
    } catch (e) {
      if (e === aborted) {
        this.emit('cancel');
      } else {
        this.emit('error', e);
      }
    } finally {
      this.done();
    }
  }

  cancel() {
    const originalState = this.state;

    if (originalState === 'done') { return; }

    this.job.cancel();
    this.done();

    if (originalState === 'waiting') {
      this.emit('cancel');
    }
  }

  running() {
    this.state     = 'running';
    this.startedAt = new Date();

    this.emit('update');
  }

  done() {
    this.state  = 'done';
    this.doneAt = new Date();

    this.emit('update');
  }
}

export default class extends EventEmitter {
  constructor(maxWaiting, maxConcurrency, durationToKeepOldJobs) {
    super();

    this.maxWaiting            = maxWaiting;
    this.maxConcurrency        = maxConcurrency;
    this.durationToKeepOldJobs = durationToKeepOldJobs;

    this.items = {
      waiting: [],
      running: [],
      done:    []
    };

    setInterval(() => {
      const now = new Date();
      this.sweepOldItems(now - this.durationToKeepOldItems);
    }, 5 * 1000);
  }

  state() {
    const items = this.allItems().map(item => item.data()).sort((a, b) => b.createdAt - a.createdAt);

    const {waiting, running} = this.items;

    return {
      jobs:       items,
      numWaiting: waiting.length,
      numRunning: running.length,
    }
  }

  allItems() {
    const {waiting, running, done} = this.items;

    return [...waiting, ...running, ...done];
  }

  publishState() {
    this.emit('state', this.state());
  }

  enqueue(job, token) {
    return new Promise((resolve, reject) => {
      if (this.items.waiting.length >= this.maxWaiting) {
        const err      = new Error('Too many waiting jobs');
        err.statusCode = 503;
        err.data       = 'Too many waiting jobs';

        reject(err);
        return;
      }

      const item = new Item(job, token);

      item.on('success', resolve);
      item.on('error',   reject);
      item.on('update',  this.publishState.bind(this));

      item.on('cancel', () => {
        const err      = new Error('Job Canceled');
        err.statusCode = 503;
        err.data       = 'Job Canceled';

        reject(err);
      });

      this.add(item);
    });
  }

  async tryDequeue() {
    if (this.items.running.length >= this.maxConcurrency) { return; }

    const item = this.items.waiting.shift();

    if (!item) { return; }

    this.items.running.push(item);
    this.publishState();

    try {
      await item.run();
    } finally {
      this.move(item, 'done');
    }
  }

  cancel(id) {
    const item = this.allItems().find(item => item.id === id);

    if (!item) { return false };

    item.cancel();
    this.move(item, 'done');

    return true;
  }

  jobStatus(token) {
    const item = this.allItems().find(item => item.token === token);

    return item ? item.data() : null;
  }

  sweepOldItems(threshold) {
    let deleted = false;

    this.items.done.forEach((item, i) => {
      if (item.doneAt < threshold) {
        this.items.done.splice(i, 1);
        deleted = true;
      }
    });

    if (deleted) {
      this.publishState();
    }
  }

  add(...items) {
    this.items.waiting.push(...items);

    this.publishState();
    this.tryDequeue();
  }

  move(item, to) {
    const from = this.items[item.state];
    const i    = from.indexOf(item);

    from.splice(i, 1);
    this.items[to].push(item);

    this.publishState();
    this.tryDequeue();
  }
}
