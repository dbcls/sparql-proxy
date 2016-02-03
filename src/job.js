import request from 'request'
import uuid from 'uuid'

export default class Job {
  constructor(backend, rawQuery, accept) {
    this.id = uuid.v4();
    this.backend = backend;
    this.rawQuery = rawQuery;
    this.accept = accept;
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
      console.log(`${this.id} start`);
      request.post(options, (error, response, body) => {
        if (error) {
          reject(error);
        } else if (response.statusCode != 200) {
          let error = new Error("unexpected response from backend");
          reject(error);
        } else {
          resolve(body);
        }
      });
    });
  }
}
