import Queue from 'promise-queue'
import { EventEmitter } from 'events'

export default class Tracker extends EventEmitter {
  constructor() {
    super();

    this.jobs = {}; // TODO cleanup old jobs
    this.queue = new Queue(1, Infinity); // TODO make the parameters configurable
  }

  state() {
    let jobList = [];
    for (let id in this.jobs) {
      jobList.push(this.jobs[id]);
    }
    jobList.sort((a, b) => {
      return b.createdAt - a.createdAt;
    });

    return {
      queueLength: this.queue.getQueueLength(),
      jobs: jobList
    };
  }

  publishState(){
    this.emit('state', this.state());
  }

  enqueue(job) {
    job.on('update', this.publishState.bind(this));
    console.log(`${job.id} queued`);
    this.jobs[job.id] = job;

    return this.queue.add(() => {
      let promise = job.run();
      return promise.then((result) => {
        console.log(`${job.id} done`);
        return result;
      }).catch((error) => {
        console.log(`${job.id} error: ${error}`);
        throw error;
      });
    });
  }
}
