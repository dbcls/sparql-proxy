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

    return {
      queueLength: this.queue.getQueueLength(),
      jobs: jobList
    };
  }

  publishState(){
    this.emit('state', this.state());
  }

  enqueue(job) {
    console.log(`${job.id} queued`);
    this.jobs[job.id] = {id: job.id, state: "queued"};
    this.publishState();

    return this.queue.add(() => {
      this.jobs[job.id].state = "running";
      let promise = job.run();
      this.publishState();
      return promise.then((result) => {
        this.jobs[job.id].state = "done";
        this.publishState();
        console.log(`${job.id} done`);
        return result;
      }).catch((error) => {
        this.jobs[job.id].state = "error";
        this.publishState();
        console.log(`${job.id} error: ${error}`);
        throw error;
      });
    });
  }
}
