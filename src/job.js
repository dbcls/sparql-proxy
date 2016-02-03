import request from 'request'
import uuid from 'uuid'

export default class Job {
  constructor(backend, rawQuery, accept, callback) {
    this.id = uuid.v4();
    this.backend = backend;
    this.rawQuery = rawQuery;
    this.accept = accept;
    this.callback = callback;
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
    };

    request.post(options, (error, response, body) => {
      if (error) {
        this.callback(error);
        return;
      }
      if (response.statusCode != 200) {
        var error = new Error("unexpected response from backend");
        this.callback(error);
        return;
      }
      this.callback(null, body);
    });
  }
}
