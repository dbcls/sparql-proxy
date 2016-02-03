import request from 'request'
import uuid from 'uuid'

export default class Job {
  constructor(backend, rawQuery, accept) {
    this.id = uuid.v4();
    this.backend = backend;
    this.rawQuery = rawQuery;
    this.accept = accept;
  }

  run(callback) {
    var options = {
      uri: this.backend,
      json: true,
      form: {query: this.rawQuery},
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': this.accept,
      },
    };

    request.post(options, function(error, response, body) {
      if (error) {
        callback(error);
        return;
      }
      if (response.statusCode != 200) {
        var error = new Error("unexpected response from backend");
        callback(error);
        return;
      }
      callback(null, body);
    });
  }
}
