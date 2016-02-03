import Queue from 'promise-queue'

export default class Tracker {
  constructor() {
    this.jobs = {};
    this.queue = new Queue(1, Infinity); // TODO make the parameters configurable

    setInterval(() => {
      let len = this.queue.getQueueLength();
      if (len > 0) {
        console.log(`${len} job(s)`);
      }
    }, 1000);
  }

  enqueue(job) {
    console.log(`${job.id} queued`);

    return this.queue.add(() => {
      this.jobs[job.id] = job;
      let promise = job.run();
      return promise.then((result) => {
        delete this.jobs[job.id];
        console.log(`${job.id} done`);
        return result;
      }).catch((error) => {
        delete this.jobs[job.id];
        console.log(`${job.id} error: ${error}`);
        throw error;
      });
    });
  }
}
