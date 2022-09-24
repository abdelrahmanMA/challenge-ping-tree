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

test.serial.cb('adding new target', function (t) {
  redis.FLUSHDB()
  var url = '/api/targets'
  var opts = { method: 'POST', encoding: 'json' }
  var newTarget = _getDummyTarget()

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

test.serial.cb('should fail adding new target when duplicate',
  function (t) {
    redis.FLUSHDB()
    var url = '/api/targets'
    var opts = { method: 'POST', encoding: 'json' }
    var newTarget = _getDummyTarget()

    _seedRedis([newTarget])

    servertest(server(), url, opts, onResponse).end(JSON.stringify(newTarget))

    function onResponse (err, res) {
      t.falsy(err, 'no error')

      t.is(res.statusCode, 400, 'correct statusCode')
      t.is(res.body.status, 'Target exists', 'status is ok')
      t.end()
    }
  })

test.serial.cb('should fail adding new target when missing fields',
  function (t) {
    redis.FLUSHDB()
    var url = '/api/targets'
    var opts = { method: 'POST', encoding: 'json' }
    var newTarget = _getDummyTarget()

    delete newTarget.value

    servertest(server(), url, opts, onResponse).end(JSON.stringify(newTarget))

    function onResponse (err, res) {
      t.falsy(err, 'no error')

      t.is(res.statusCode, 400, 'correct statusCode')
      t.is(res.body.status, 'Required fields are missing', 'status is ok')
      t.end()
    }
  })

test.serial.cb('should fail adding new target when field is of the wrong type',
  function (t) {
    redis.FLUSHDB()
    var url = '/api/targets'
    var opts = { method: 'POST', encoding: 'json' }
    var newTarget = _getDummyTarget()

    newTarget.accept.geoState = 'ca'

    servertest(server(), url, opts, onResponse).end(JSON.stringify(newTarget))

    function onResponse (err, res) {
      t.falsy(err, 'no error')

      t.is(res.statusCode, 400, 'correct statusCode')
      t.is(res.body.status, 'hour and geoState must be array', 'status is ok')
      t.end()
    }
  })

test.serial.cb('should fail adding new target when sending empty data',
  function (t) {
    redis.FLUSHDB()
    var url = '/api/targets'
    var opts = { method: 'POST', encoding: 'json' }

    servertest(server(), url, opts, onResponse).end('{}')

    function onResponse (err, res) {
      t.falsy(err, 'no error')

      t.is(res.statusCode, 400, 'correct statusCode')
      t.is(res.body.status, 'Required fields are missing', 'status is ok')
      t.end()
    }
  })

test.serial.cb('get all target', function (t) {
  redis.FLUSHDB()
  var url = '/api/targets'
  var opts = { method: 'GET', encoding: 'json' }
  var dummyTargets = [_getDummyTarget(), _getDummyTarget({ id: 2 })]

  _seedRedis(dummyTargets)

  servertest(server(), url, opts, onResponse)

  function onResponse (err, res) {
    t.falsy(err, 'no error')

    t.is(res.statusCode, 200, 'correct statusCode')
    t.is(res.body.status, 'OK', 'status is ok')
    t.truthy(res.body.data)
    t.truthy(res.body.data.length === 2)
    t.deepEqual(res.body.data, dummyTargets)

    t.end()
  }
})

test.serial.cb('get target by id', function (t) {
  redis.FLUSHDB()
  var url = '/api/target/1'
  var opts = { method: 'GET', encoding: 'json' }
  var dummyTarget = _getDummyTarget()

  _seedRedis([dummyTarget])

  servertest(server(), url, opts, onResponse)

  function onResponse (err, res) {
    t.falsy(err, 'no error')

    t.is(res.statusCode, 200, 'correct statusCode')
    t.is(res.body.status, 'OK', 'status is ok')
    t.deepEqual(res.body.target, dummyTarget)

    t.end()
  }
})

test.serial.cb('should fail getting target by id when id is not a number',
  function (t) {
    redis.FLUSHDB()
    var url = '/api/target/id'
    var opts = { method: 'GET', encoding: 'json' }
    var dummyTarget = _getDummyTarget()

    _seedRedis([dummyTarget])

    servertest(server(), url, opts, onResponse)

    function onResponse (err, res) {
      t.falsy(err, 'no error')

      t.is(res.statusCode, 400, 'correct statusCode')
      t.is(res.body.status, 'Id param is required', 'status is ok')

      t.end()
    }
  })

test.serial.cb('should fail getting target by id when target does not exist',
  function (t) {
    redis.FLUSHDB()
    var url = '/api/target/1'
    var opts = { method: 'GET', encoding: 'json' }

    servertest(server(), url, opts, onResponse)

    function onResponse (err, res) {
      t.falsy(err, 'no error')

      t.is(res.statusCode, 404, 'correct statusCode')
      t.is(res.body.status, 'Target does not exist', 'status is ok')

      t.end()
    }
  })

test.serial.cb('update target by id', function (t) {
  redis.FLUSHDB()
  var url = '/api/target/1'
  var opts = { method: 'POST', encoding: 'json' }
  var dummyTarget = _getDummyTarget()

  _seedRedis([dummyTarget])

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

test.serial.cb('should fail updating target by id when sending empty data',
  function (t) {
    redis.FLUSHDB()
    var url = '/api/target/1'
    var opts = { method: 'POST', encoding: 'json' }
    var dummyTarget = _getDummyTarget()

    _seedRedis([dummyTarget])

    // Update target properties
    dummyTarget.value = '1'
    dummyTarget.maxAcceptsPerDay = '50'

    servertest(server(), url, opts, onResponse).end('{}')

    function onResponse (err, res) {
      t.falsy(err, 'no error')

      t.is(res.statusCode, 400, 'correct statusCode')
      t.is(res.body.status, 'At least one field is required', 'status is ok')

      t.end()
    }
  })

test.serial.cb('should fail updating target by id when target does not exist',
  function (t) {
    redis.FLUSHDB()
    var url = '/api/target/1232'
    var opts = { method: 'POST', encoding: 'json' }
    var dummyTarget = _getDummyTarget()

    _seedRedis([dummyTarget])

    // Update target properties
    dummyTarget.value = '1'
    dummyTarget.maxAcceptsPerDay = '50'

    servertest(server(), url, opts, onResponse).end(JSON.stringify(dummyTarget))

    function onResponse (err, res) {
      t.falsy(err, 'no error')

      t.is(res.statusCode, 404, 'correct statusCode')
      t.is(res.body.status, 'Target does not exist', 'status is ok')

      t.end()
    }
  })

test.serial.cb('should fail updating target by id when id is not a number',
  function (t) {
    redis.FLUSHDB()
    var url = '/api/target/id'
    var opts = { method: 'POST', encoding: 'json' }
    var dummyTarget = _getDummyTarget()

    _seedRedis([dummyTarget])

    servertest(server(), url, opts, onResponse).end(JSON.stringify(dummyTarget))

    function onResponse (err, res) {
      t.falsy(err, 'no error')

      t.is(res.statusCode, 400, 'correct statusCode')
      t.is(res.body.status, 'Id param is required', 'status is ok')

      t.end()
    }
  })

test.serial.cb('target decision', function (t) {
  redis.FLUSHDB()
  var url = '/route'
  var opts = { method: 'POST', encoding: 'json' }
  var visitor = _getDummyVisitor()
  var dummyTarget = _getDummyTarget()

  _seedRedis([dummyTarget])

  servertest(server(), url, opts, onResponse).end(JSON.stringify(visitor))

  function onResponse (err, res) {
    t.falsy(err, 'no error')

    t.is(res.statusCode, 200, 'correct statusCode')
    t.is(res.body.decision, dummyTarget.url, 'found target')
    t.end()
  }
})

test.serial.cb('should reject target when different state', function (t) {
  redis.FLUSHDB()
  var url = '/route'
  var opts = { method: 'POST', encoding: 'json' }
  var visitor = _getDummyVisitor({ geoState: 'kk' })
  var dummyTarget = _getDummyTarget()

  _seedRedis([dummyTarget])

  servertest(server(), url, opts, onResponse).end(JSON.stringify(visitor))

  function onResponse (err, res) {
    t.falsy(err, 'no error')

    t.is(res.statusCode, 200, 'correct statusCode')
    t.is(res.body.decision, 'reject', 'found target')
    t.end()
  }
})

test.serial.cb('should reject target when different timestamp', function (t) {
  redis.FLUSHDB()
  var url = '/route'
  var opts = { method: 'POST', encoding: 'json' }
  var visitor = _getDummyVisitor({ timestamp: '2018-07-19T23:28:59.513Z' })
  var dummyTarget = _getDummyTarget()

  _seedRedis([dummyTarget])

  servertest(server(), url, opts, onResponse).end(JSON.stringify(visitor))

  function onResponse (err, res) {
    t.falsy(err, 'no error')

    t.is(res.statusCode, 200, 'correct statusCode')
    t.is(res.body.decision, 'reject', 'found target')
    t.end()
  }
})

test.serial.cb('should find highest target', function (t) {
  redis.FLUSHDB()
  var url = '/route'
  var opts = { method: 'POST', encoding: 'json' }
  var visitor = _getDummyVisitor()
  var dummyTargets = [
    _getDummyTarget(),
    _getDummyTarget({ id: 2, value: '60', url: 'example2.com' })
  ]

  _seedRedis(dummyTargets)

  servertest(server(), url, opts, onResponse).end(JSON.stringify(visitor))

  function onResponse (err, res) {
    t.falsy(err, 'no error')

    t.is(res.statusCode, 200, 'correct statusCode')
    t.is(res.body.decision, dummyTargets[1].url, 'found target')
    t.end()
  }
})

test.serial.cb('should find lower target when the highest has reached accepts',
  function (t) {
    redis.FLUSHDB()
    var url = '/route'
    var opts = { method: 'POST', encoding: 'json' }
    var visitor = _getDummyVisitor()
    var dummyTargets = [
      _getDummyTarget(),
      _getDummyTarget({ id: 2, value: '60', url: 'example2.com' })
    ]

    _seedRedis(dummyTargets)
    redis.set('target:2:acceptsToday', 10)

    servertest(server(), url, opts, onResponse).end(JSON.stringify(visitor))

    function onResponse (err, res) {
      t.falsy(err, 'no error')

      t.is(res.statusCode, 200, 'correct statusCode')
      t.is(res.body.decision, dummyTargets[0].url, 'found target')
      t.end()
    }
  })

test.serial.cb('should fail target decision when missing visitor fields',
  function (t) {
    redis.FLUSHDB()
    var url = '/route'
    var opts = { method: 'POST', encoding: 'json' }
    var visitor = _getDummyVisitor()
    var dummyTarget = _getDummyTarget()

    _seedRedis([dummyTarget])

    delete visitor.timestamp

    servertest(server(), url, opts, onResponse).end(JSON.stringify(visitor))

    function onResponse (err, res) {
      t.falsy(err, 'no error')

      t.is(res.statusCode, 400, 'correct statusCode')
      t.is(res.body.status, 'Required field are missing', 'status is ok')
      t.end()
    }
  })

test.serial.cb('should fail target decision when sending empty visitor',
  function (t) {
    redis.FLUSHDB()
    var url = '/route'
    var opts = { method: 'POST', encoding: 'json' }
    var dummyTarget = _getDummyTarget()

    _seedRedis([dummyTarget])

    servertest(server(), url, opts, onResponse).end('{}')

    function onResponse (err, res) {
      t.falsy(err, 'no error')

      t.is(res.statusCode, 400, 'correct statusCode')
      t.is(res.body.status, 'Required field are missing', 'status is ok')
      t.end()
    }
  })

function _getDummyTarget (overrides) {
  return {
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
    },
    ...overrides
  }
}

function _getDummyVisitor (overrides) {
  return {
    geoState: 'ca',
    publisher: 'abc',
    timestamp: '2018-07-19T13:28:59.513Z',
    ...overrides
  }
}

function _seedRedis (targets) {
  for (var i = 0; i < targets.length; i++) {
    redis.set(`target:${targets[i].id}`, JSON.stringify(targets[i]))
    redis.sadd('targets', `target:${targets[i].id}`)
  }
}
