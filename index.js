'use strict';

const redis = require('redis');

const FIVE_MINUTES = 5 * 60;

class RedisCache {
  constructor(options) {
    var redisOptions = options;

    if (options.url) {
      redisOptions = this._stripUsernameFromConfigUrl(options.url);
    } else {
      redisOptions = {
        host: options.host,
        port: options.port
      };
      if (options.password) {
        redisOptions.password = options.password;
      }
    }

    let client = this.client = redis.createClient(redisOptions);

    this.expiration = options.expiration || FIVE_MINUTES;
    this.connected = false;
    this.cacheKey = typeof options.cacheKey === 'function' ?
      options.cacheKey : (path) => path;

    client.on('error', error => {
      this.ui.writeLine(`redis error; err=${error}`);
    });

    this.client.on('connect', () => {
      this.connected = true;
      this.ui.writeLine('redis connected');
    });

    this.client.on('end', () => {
      this.connected = false;
      this.ui.writeLine('redis disconnected');
    });
  }

  fetch(path, request) {
    if (!this.connected) { return; }

    let key = this.cacheKey(path, request);

    return new Promise((res, rej) => {
      this.client.get(key, (err, reply) => {
        if (err) {
          rej(err);
        } else {
          res(reply);
        }
      });
    });
  }

  put(path, body, response) {
    if (!this.connected) { return; }

    let request = response && response.req;
    let key = this.cacheKey(path, request);

    return new Promise((res, rej) => {
      let statusCode = response && response.statusCode;
      let statusCodeStr = statusCode && (statusCode + '');

      if (statusCodeStr && statusCodeStr.length &&
         (statusCodeStr.charAt(0) === '4' || statusCodeStr.charAt(0) === '5')) {
        res();
        return;
      }

      this.client.multi()
        .set(key, body)
        .expire(path, this.expiration)
        .exec(err => {
          if (err) {
            rej(err);
          } else {
            res();
          }
        });
    });
  }

  _stripUsernameFromConfigUrl(configUrl) {
    let regex = /redis:\/\/(\w+):(\w+)(.*)/;
    let matches = configUrl.match(regex);

    if (matches) {
      configUrl = 'redis://:' + matches[2] + matches[3];
    }

    return configUrl;
  }
}

module.exports = RedisCache;
