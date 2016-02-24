import request from 'request'
import uuid from 'uuid'
import { EventEmitter } from 'events'

export default class Job extends EventEmitter {
  constructor(backend, rawQuery, accept, token) {
    super();

    this.id = uuid.v4();
    this.backend = backend;
    this.rawQuery = rawQuery;
    this.accept = accept;
    this.token = token;
    this.setState('waiting');
    this.createdAt = new Date();
  }

  setState(state, emit) {
    this.state = state;
    if (emit) {
      this.emit('update');
    }
  }

  canceled() {
    this.setState('canceled');
  }

  run() {
    const options = {
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
      this.setState('running', true);
      this.startedAt = new Date();
      console.log(`${this.id} start`);
      request.post(options, (error, response, body) => {
        this.doneAt = new Date();
        if (error) {
          if (error.code == 'ETIMEDOUT' || error.code == 'ESOCKETTIMEDOUT') {
            this.setState('timeout');
          } else {
            this.setState('error');
          }
          reject(error);
        } else if (response.statusCode != 200) {
          this.setState('error');
          const error = new Error("unexpected response from backend");
          reject(error);
        } else {
          this.setState('success');
          resolve(body);
        }
      });
    });
  }
}
