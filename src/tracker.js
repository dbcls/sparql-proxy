import Queue from 'promise-queue'
import { EventEmitter } from 'events'

export default class Tracker extends EventEmitter {
  constructor() {
    super();

    this.jobs = {};
    this.queue = new Queue(1, Infinity); // TODO make the parameters configurable
  }

  state() {
    return {
      queueLength: this.queue.getQueueLength(),
    };
  }

  publishState(){
    this.emit('state', this.state());
  }

  enqueue(job) {
    console.log(`${job.id} queued`);
    this.publishState();

    return this.queue.add(() => {
      this.jobs[job.id] = job;
      let promise = job.run();
      this.publishState();
      return promise.then((result) => {
        delete this.jobs[job.id];
        this.publishState();
        console.log(`${job.id} done`);
        return result;
      }).catch((error) => {
        delete this.jobs[job.id];
        this.publishState();
        console.log(`${job.id} error: ${error}`);
        throw error;
      });
    });
  }
}
