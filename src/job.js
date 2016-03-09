import request from 'request'
import uuid from 'uuid'
import { EventEmitter } from 'events'

export default class Job extends EventEmitter {
  constructor(backend, rawQuery, accept, token, timeout) {
    super();

    this.id = uuid.v4();
    this.backend = backend;
    this.rawQuery = rawQuery;
    this.accept = accept;
    this.token = token;
    this.setState('waiting');
    this.createdAt = new Date();
    this.timeout = timeout;
    this.request = null;
  }

  setState(state, emit) {
    this.state = state;
    if (emit) {
      this.emit('update');
    }
  }

  canceled() {
    this.canceledAt = new Date();
    this.setState('canceled');
    this.emit('cancel');
  }

  run() {
    const options = {
      uri: this.backend,
      form: {query: this.rawQuery},
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': this.accept,
      },
      timeout: this.timeout
    };

    return new Promise((resolve, reject) => {
      this.startedAt = new Date();
      this.setState('running', true);
      const r = request.post(options, (error, response, body) => {
        this.doneAt = new Date();
        if (error) {
          if (error.code == 'ETIMEDOUT' || error.code == 'ESOCKETTIMEDOUT') {
            this.setState('timeout');
            error.statusCode = 503;
            error.data = 'Request Timeout';
          } else {
            this.setState('error');
          }
          reject(error);
        } else if (response.statusCode != 200) {
          this.setState('error');
          const error = new Error(`unexpected response from backend: ${response.stausCode}`);
          reject(error);
        } else {
          this.setState('success');
          resolve(body);
        }
      });
      this.on('cancel', () => {
        r.abort();
        reject(new Error('aborted'));
      });
    });
  }
}
