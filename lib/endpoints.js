var body = require('body/json')
var send = require('send-data/json')

var redis = require('./redis')

module.exports = {
  addNewTarget,
  getAllTargets,
  getTargetById,
  updateTargetById,
  getDecision
}

function addNewTarget (req, res, opts, cb) {
  body(req, res, function (err, data) {
    if (err) return cb(err)
    redis.sadd('targets', `target:${data.id}`, function (err, value) {
      if (err) return cb(err)
      if (value === 0) {
        return send(req, res, {
          statusCode: 400,
          body: {
            status: 'Target exists'
          }
        })
      }
      redis.set(`target:${data.id}`, JSON.stringify(data),
        function (err, value) {
          if (err) return cb(err)
          send(req, res, { status: value })
        })
    })
  })
}

function getAllTargets (req, res, opts, cb) {
  _getAllTargets(function (err, targets) {
    if (err) return cb(err)
    send(req, res, { status: 'OK', data: targets })
  })
}

function getTargetById (req, res, opts, cb) {
  redis.get(`target:${opts?.params?.id}`, function (err, target) {
    if (err) return cb(err)
    if (target === null) {
      return send(req, res, {
        statusCode: 404,
        body: {
          status: 'Target does not exist'
        }
      })
    }
    send(req, res, { status: 'OK', target: JSON.parse(target) })
  })
}

function updateTargetById (req, res, opts, cb) {
  body(req, res, function (err, data) {
    if (err) return cb(err)
    redis.get(`target:${opts?.params?.id}`, function (err, target) {
      if (err) return cb(err)
      if (target === null) {
        return send(req, res, {
          statusCode: 404,
          body: {
            status: 'Target does not exist'
          }
        })
      }
      // set id to the id in the params
      data.id = opts?.params?.id
      target = JSON.parse(target)
      target = Object.assign(target, data)

      redis.set(
        `target:${target.id}`,
        JSON.stringify(data),
        function (err, value) {
          if (err) return cb(err)

          send(req, res, { status: value })
        })
    })
  })
}

function getDecision (req, res, opts, cb) {
  body(req, res, function (err, data) {
    if (err) return cb(err)
    _getAllTargets(async function (err, targets) {
      if (err) return cb(err)

      var hour = new Date(data.timestamp).getUTCHours()
      var filteredTargets = _filterTargets(
        targets,
        data.geoState,
        hour.toString()
      )

      if (!filteredTargets.length) {
        return send(req, res, { decision: 'reject' })
      }

      var sortedTargets = _sortTargets(filteredTargets)
      redis.mget(
        sortedTargets.map(target => `target:${target.id}:acceptsToday`),
        function (err, acceptsTodayValues) {
          if (err) return cb(err)

          var found = false
          var millisecondsToMidnight =
          new Date().setUTCHours(24, 0, 0, 0) - new Date()

          for (var i = 0; i < acceptsTodayValues.length; i++) {
            var acceptsToday = Number(acceptsTodayValues[i] ?? 0)
            var target = sortedTargets[i]
            if (Number(target.maxAcceptsPerDay) > acceptsToday) {
              found = true
              redis.setex(
                `target:${target.id}:acceptsToday`,
                Math.round(millisecondsToMidnight / 1000),
                acceptsToday + 1)
              return send(req, res, { decision: target.url })
            }
          }
          if (!found) { return send(req, res, { decision: 'reject' }) }
        })
    })
  })
}

function _getAllTargets (cb) {
  redis.SMEMBERS('targets', function (err, targets) {
    if (err) return cb(err, null)

    redis.mget(targets, function (err, values) {
      if (err) return cb(err, null)

      var data = []
      values.map(value => {
        if (value !== null) { data.push(JSON.parse(value)) }
      })

      cb(null, data)
    })
  })
}

function _sortTargets (targets) {
  var sortedTargets = targets.sort(
    (a, b) => Number(a.value) < Number(b.value) ? 1 : -1
  )
  return sortedTargets
}

function _filterTargets (targets, geoState, hour) {
  var filteredTargets = targets.filter(
    function (target) {
      return target.accept.geoState.$in.includes(geoState) &&
      target.accept.hour.$in.includes(hour)
    }
  )
  return filteredTargets
}
