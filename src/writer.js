const fs = require('fs-extra')
const stringify = require('code-stringify')
const escape = require('js-string-escape')
const mix = require('mix2')

const {error} = require('./error')

const code = values => escape(stringify(values))

const template = values => `let envs
const data = '___ENV_BEGIN___${code(values)}___ENV_END___'
module.exports = () => {
  if (envs) {
    return envs
  }

  // eslint-disable-next-line
  return envs = eval(data.slice(15, -13))
}`

const REGEX_REPLACE_VALUES = /___ENV_BEGIN___[\s\S]+?___ENV_END___/g

module.exports = class Writer {
  constructor ({
    envs,
    envFilepath
  }) {
    this._envs = envs
    this._envFilepath = envFilepath

    this._values = null
  }

  load (key) {
    if (arguments.length === 0) {
      this._loadAll()
      return
    }

    this._loadOne(key)
  }

  _loadOne (key) {
    if (this._needSet(key)) {
      this._set(key, process.env[key])
    }
  }

  _needSet (key) {
    if (!this._values) {
      this._loadAll()
      return false
    }

    if (!this._envs.includes(key)) {
      throw error('KEY_NOT_ALLOWED', key)
    }

    return true
  }

  _set (key, value) {
    this._values[key] = value
  }

  set (key, value) {
    this._needSet(key)
    this._set(key, value)
  }

  _loadAll () {
    return this._values = mix(Object.create(null), process.env, this._envs)
  }

  get values () {
    return this._values || this._loadAll()
  }

  save () {
    return fs.outputFile(this._envFilepath, template(this.values))
  }

  async updateFiles (files) {
    const tasks = []

    for (const file of files) {
      tasks.push(
        fs.readFile(file).then(
          content => fs.outputFile(
            file,
            content.toString().replace(REGEX_REPLACE_VALUES, code(this._values))
          )
        )
      )
    }

    await Promise.all(tasks)
  }
}
