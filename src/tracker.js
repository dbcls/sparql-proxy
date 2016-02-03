export default class Tracker {
  constructor() {
  }

  enqueue(job) {
    console.log(`${job.id} queued`);
    job.run();
  }
}
