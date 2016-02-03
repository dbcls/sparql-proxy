import request from 'request'
import uuid from 'uuid'

export default class Job {
  constructor(backend, rawQuery, accept) {
    this.id = uuid.v4();
    this.backend = backend;
    this.rawQuery = rawQuery;
    this.accept = accept;
    this.state = 'queued';
    this.createdAt = new Date();
  }

  run() {
    var options = {
      uri: this.backend,
      json: true,
      form: {query: this.rawQuery},
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': this.accept,
      },
      timeout: 5000 // FIXME
    };

    return new Promise((resolve, reject) => {
      this.state = 'running';
      this.startedAt = new Date();
      console.log(`${this.id} start`);
      request.post(options, (error, response, body) => {
        this.doneAt = new Date();
        if (error) {
          this.state = 'error';
          reject(error);
        } else if (response.statusCode != 200) {
          this.state = 'error';
          let error = new Error("unexpected response from backend");
          reject(error);
        } else {
          this.state = 'success';
          resolve(body);
        }
      });
    });
  }
}
