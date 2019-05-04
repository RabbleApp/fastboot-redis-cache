'use strict';

const expect = require('chai').expect;
const RedisCache = require('../index');

let cache;
let mockRedis = {};

describe('caching tests', function() {

  describe('basic tests', function() {
    beforeEach(function() {
      cache = new RedisCache({
      });
      cache.client = mockRedisClient();
      cache.connected = true;
      mockRedis = {};
    });

    it('can put a response in the cache', function() {
      let body = '<body>Hola</body>';

      return cache.put('/', body).then(() => {
        expect(mockRedis['/']).to.equal(body);
      });
    });

    it('can retreive a response from the cache', function() {
      let body = '<body>Hola</body>';
      mockRedis['/yellow'] = body;

      return cache.fetch('/yellow').then(actual => {
        expect(actual).to.equal(body);
      });
    });

    it('can put a response in the cache for success responses', function() {
      let body = '<body>Hola</body>';
      let mockResponse = { statusCode: 200 };

      return cache.put('/', body, mockResponse).then(() => {
        expect(mockRedis['/']).to.equal(body);
      });
    });

    it('does not cache 5xx error responses', function() {
      let body = '<body>OMG there are so many errors</body>';
      let mockResponse = { statusCode: 500 };

      return cache.put('/', body, mockResponse).then(() => {
        expect(mockRedis['/']).to.be.undefined;
      });
    });

    it('does not cache 4xx error responses', function() {
      let body = '<body>You can`t</body>';
      let mockResponse = { statusCode: 400 };

      return cache.put('/', body, mockResponse).then(() => {
        expect(mockRedis['/']).to.be.undefined;
      });
    });
    
    it('does not cache 3xx error responses', function() {
      let body = '<body>Redirect to </body>';
      let mockResponse = { statusCode: 301 };

      return cache.put('/', body, mockResponse).then(() => {
        expect(mockRedis['/']).to.be.undefined;
      });
    });
  });

  describe('redis options tests', function() {
    it('accepts redis password', function() {
      cache = new RedisCache({
        host: "127.0.0.1",
        port: "6379",
        password: "some-password"
      });
      expect(cache.client.options.host).to.equal('127.0.0.1');
      expect(cache.client.options.port).to.equal('6379');
      expect(cache.client.options.password).to.equal('some-password');
    });

    it('uses redis url instead of host and port when url is provided', function() {
      cache = new RedisCache({
        host: "127.0.0.1",
        port: "6379",
        url: "redis://some-user:some-password@some-host.com:1234"
      });
      expect(cache.client.options.host).to.equal('some-host.com');
      expect(cache.client.options.port).to.equal('1234');
      expect(cache.client.options.password).to.equal('some-password');
    });
  });

  describe('custom keys tests', function() {
    beforeEach(function() {
      cache = new RedisCache({
        cacheKey (path, request) {
          return `${path}_${request && request.cookies && request.cookies.chocolateChip}`;
        }
      });
      cache.client = mockRedisClient();
      cache.connected = true;
      mockRedis = {};
    });

    it('can build a custom cache key from the request object', function() {
      let body = '<body>Hola</body>';
      let mockResponse = {
        req: {
          cookies: {
            chocolateChip: 'mmmmmm'
          }
        }
      };

      return cache.put('/', body, mockResponse).then(() => {
        expect(mockRedis['/_mmmmmm']).to.equal(body);
      });
    });

    it('can get a cache item based on a custom cache key', function() {
      let body = '<body>Hola</body>';
      let cookieValue = 'mmmmmm';
      mockRedis[`/_${cookieValue}`] = body;
      let mockRequest = {
        cookies: {
          chocolateChip: cookieValue
        }
      };

      return cache.fetch('/', mockRequest).then(actual => {
        expect(actual).to.equal(body);
      });
    });

  });
});

function mockRedisClient() {
  let next = () => {
    return {
      set(key, value) {
        mockRedis[key] = value;
        return next();
      },
      expire() {
        return next();
      },
      exec(callback) {
        callback();
      }
    };
  };

  return {
    on() {
    },

    get(key, callback) {
      return callback(null, mockRedis[key]);
    },

    multi() {
      return next();
    }
  };
}
