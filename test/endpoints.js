process.env.NODE_ENV = 'test'

var test = require('ava')
var servertest = require('servertest')

var server = require('../lib/server')
var redis = require('../lib/redis')

test.serial.cb('healthcheck', function (t) {
  var url = '/health'
  servertest(server(), url, { encoding: 'json' }, function (err, res) {
    t.falsy(err, 'no error')

    t.is(res.statusCode, 200, 'correct statusCode')
    t.is(res.body.status, 'OK', 'status is ok')
    t.end()
  })
})

test.serial.cb('Adding New Target', function (t) {
  redis.FLUSHDB()
  var url = '/api/targets'
  var opts = { method: 'POST', encoding: 'json' }
  var newTarget = {
    id: '1',
    url: 'http://example.com',
    value: '0.50',
    maxAcceptsPerDay: '10',
    accept: {
      geoState: {
        $in: ['ca', 'ny']
      },
      hour: {
        $in: ['13', '14', '15']
      }
    }
  }
  servertest(server(), url, opts, onResponse).end(JSON.stringify(newTarget))

  function onResponse (err, res) {
    t.falsy(err, 'no error')

    t.is(res.statusCode, 200, 'correct statusCode')
    t.is(res.body.status, 'OK', 'status is ok')

    redis.get(`target:${newTarget.id}`, function (err, value) {
      t.falsy(err, 'no error')
      t.deepEqual(JSON.parse(value), newTarget, 'values should match')
      t.end()
    })
  }
})

test.serial.cb('Get All Target', function (t) {
  redis.FLUSHDB()
  var url = '/api/targets'
  var opts = { method: 'GET', encoding: 'json' }
  var dummyTarget = {
    id: '1',
    url: 'http://example.com',
    value: '0.50',
    maxAcceptsPerDay: '10',
    accept: {
      geoState: {
        $in: ['ca', 'ny']
      },
      hour: {
        $in: ['13', '14', '15']
      }
    }
  }
  // Seed redis with data
  redis.set(`target:${dummyTarget.id}`, JSON.stringify(dummyTarget))
  redis.set('target:2', JSON.stringify(dummyTarget))
  redis.sadd('targets', ['target:1', 'target:2'])

  servertest(server(), url, opts, onResponse)

  function onResponse (err, res) {
    t.falsy(err, 'no error')

    t.is(res.statusCode, 200, 'correct statusCode')
    t.is(res.body.status, 'OK', 'status is ok')
    t.truthy(res.body.data)
    t.truthy(res.body.data.length === 2)
    t.deepEqual(res.body.data[0], dummyTarget)
    t.deepEqual(res.body.data[1], dummyTarget)

    t.end()
  }
})

test.serial.cb('Get Target By Id', function (t) {
  redis.FLUSHDB()
  var url = '/api/target/1'
  var opts = { method: 'GET', encoding: 'json' }
  var dummyTarget = {
    id: '1',
    url: 'http://example.com',
    value: '0.50',
    maxAcceptsPerDay: '10',
    accept: {
      geoState: {
        $in: ['ca', 'ny']
      },
      hour: {
        $in: ['13', '14', '15']
      }
    }
  }
  // Seed redis with data
  redis.set(`target:${dummyTarget.id}`, JSON.stringify(dummyTarget))

  servertest(server(), url, opts, onResponse)

  function onResponse (err, res) {
    t.falsy(err, 'no error')

    t.is(res.statusCode, 200, 'correct statusCode')
    t.is(res.body.status, 'OK', 'status is ok')
    t.deepEqual(res.body.target, dummyTarget)

    t.end()
  }
})

test.serial.cb('Update Target By Id', function (t) {
  redis.FLUSHDB()
  var url = '/api/target/1'
  var opts = { method: 'POST', encoding: 'json' }
  var dummyTarget = {
    id: '1',
    url: 'http://example.com',
    value: '0.50',
    maxAcceptsPerDay: '10',
    accept: {
      geoState: {
        $in: ['ca', 'ny']
      },
      hour: {
        $in: ['13', '14', '15']
      }
    }
  }
  // Seed redis with data
  redis.set(`target:${dummyTarget.id}`, JSON.stringify(dummyTarget))

  // Update target properties
  dummyTarget.value = '1'
  dummyTarget.maxAcceptsPerDay = '50'

  servertest(server(), url, opts, onResponse).end(JSON.stringify(dummyTarget))

  function onResponse (err, res) {
    t.falsy(err, 'no error')

    t.is(res.statusCode, 200, 'correct statusCode')
    t.is(res.body.status, 'OK', 'status is ok')

    redis.get(`target:${dummyTarget.id}`, function (err, value) {
      t.falsy(err, 'no error')
      t.deepEqual(JSON.parse(value), dummyTarget, 'values should match')
      t.end()
    })
  }
})

test.serial.cb('Target Decision', function (t) {
  redis.FLUSHDB()
  var url = '/route'
  var opts = { method: 'POST', encoding: 'json' }
  var visitor = {
    geoState: 'ca',
    publisher: 'abc',
    timestamp: '2018-07-19T13:28:59.513Z'
  }
  var dummyTarget = {
    id: '1',
    url: 'http://example.com',
    value: '0.50',
    maxAcceptsPerDay: '10',
    accept: {
      geoState: {
        $in: ['ca', 'ny']
      },
      hour: {
        $in: ['13', '14', '15']
      }
    }
  }
  // Seed redis with data
  redis.set(`target:${dummyTarget.id}`, JSON.stringify(dummyTarget))
  redis.sadd('targets', ['target:1'])

  servertest(server(), url, opts, onResponse).end(JSON.stringify(visitor))

  function onResponse (err, res) {
    t.falsy(err, 'no error')

    t.is(res.statusCode, 200, 'correct statusCode')
    t.is(res.body.decision, dummyTarget.url, 'found target')
    t.end()
  }
})
