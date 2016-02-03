export default class Tracker {
  constructor() {
  }

  enqueue(job) {
    console.log(`${job.id} queued`);

    let promise = job.run();
    promise.catch((error) => {
      console.log(`${job.id} error: ${error}`);
    });

    return promise;
  }
}
