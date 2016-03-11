import request from 'request'
import uuid from 'uuid'
import { EventEmitter } from 'events'

export default class extends EventEmitter {
  constructor(backend, rawQuery, accept, timeout, ip) {
    super();

    this.backend = backend;
    this.rawQuery = rawQuery;
    this.accept = accept;
    this.timeout = timeout;
    this.ip = ip;
  }

  canceled() {
    // STATE: canceled
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
      const r = request.post(options, (error, response, body) => {
        if (error) {
          if (error.code == 'ETIMEDOUT' || error.code == 'ESOCKETTIMEDOUT') {
            this.emit('update', {reason: 'timeout'});
            error.statusCode = 503;
            error.data = 'Request Timeout';
          } else {
            this.emit('update', {reason: 'error'});
          }
          reject(error);
        } else if (response.statusCode != 200) {
          this.emit('update', {reason: 'error'});
          const error = new Error(`unexpected response from backend: ${response.stausCode}`);
          reject(error);
        } else {
          this.emit('update', {reason: 'success'});
          resolve({contentType: response.headers['content-type'], body});
        }
      });
      this.on('cancel', () => {
        r.abort();
        const error = new Error('aborted');
        error.StatusCode = 503;
        error.data = 'Job Canceled (running)';
        this.emit('update', {reason: 'canceled'});
        reject(error);
      });
    });
  }
}
