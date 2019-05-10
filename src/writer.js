const fs = require('fs-extra')
const stringify = require('code-stringify')
const escape = require('js-string-escape')
const mix = require('mix2')

const {error} = require('./error')

const code = values =>
  `___ENV_BEGIN___${escape(stringify(values))}___ENV_END___`

const template = values => `// Generated by RuntimeEnvironmentPlugin
const code = '${code(values)}'
// eslint-disable-next-line
const data = Function("return (" + code.slice(15, -13) + ")")()
module.exports = () => data
`

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

  reload (key) {
    if (arguments.length === 0) {
      this._loadAll()
      return
    }

    this._loadOne(key)
  }

  _loadOne (key) {
    this._checkKey(key)

    if (!this._checkLoad(key)) {
      this._set(key, process.env[key])
    }
  }

  _checkKey (key) {
    if (!this._envs.includes(key)) {
      throw error('KEY_NOT_ALLOWED', key)
    }
  }

  // Returns `boolean` whether need to load
  _checkLoad () {
    if (!this._values) {
      this._loadAll()
      return true
    }

    return false
  }

  _set (key, value) {
    this._values[key] = value
  }

  set (key, value) {
    this._checkKey(key)
    this._checkLoad()
    this._set(key, value)
  }

  _loadAll () {
    return this._values = mix(
      Object.create(null), process.env, true, this._envs)
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
