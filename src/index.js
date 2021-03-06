
const {resolve, join} = require('path')
const {inspect, debuglog} = require('util')
const {isString, isArray} = require('core-util-is')

const {error} = require('./error')
const Chunk = require('./chunk')
const Writer = require('./writer')

const log = debuglog('runtime-environment-webpack-plugin')

const NAME = 'RuntimeEnvironmentPlugin'

module.exports = class RuntimeEnvironmentPlugin {
  constructor ({
    envs,
    envFilepath
  } = {}) {
    if (!isArray(envs) || !envs.every(isString)) {
      throw error('INVALID_ENVS', envs)
    }

    if (!isString(envFilepath)) {
      throw error('INVALID_ENV_FILE_PATH', envFilepath)
    }

    this._envs = envs
    this._envFilepath = resolve(envFilepath)

    this._chunks = Object.create(null)
    this._dests = new Set()

    this._writer = new Writer({
      envs,
      envFilepath
    })
  }

  _addChunk (rawChunk) {
    const chunk = new Chunk(rawChunk)
    this._chunks[chunk.request] = chunk
  }

  _getChunk (rawChunk) {
    return this._chunks[rawChunk.entryModule.userRequest]
  }

  _generateDests (outputPath) {
    for (const chunk of Object.values(this._chunks)) {
      for (const dep of chunk.dependencies) {
        if (dep === this._envFilepath) {
          this._dests.add(join(outputPath, chunk.name))
          break
        }
      }
    }

    log('dependents: %s', inspect(this._dests))
  }

  apply (compiler) {
    compiler.hooks.beforeRun.tapPromise(NAME, async () => {
      await this._writer.save()
    })

    compiler.hooks.compilation.tap(NAME, compilation => {
      compilation.hooks.afterOptimizeChunkModules.tap(NAME, chunks => {
        chunks.forEach(chunk => {
          this._addChunk(chunk.entryModule)
        })
      })

      compilation.hooks.chunkAsset.tap(NAME, (chunk, file) => {
        this._getChunk(chunk).name = file
      })
    })

    compiler.hooks.afterEmit.tap(NAME, compilation => {
      const {outputPath} = compilation.compiler
      this._generateDests(outputPath)
    })
  }

  get outputs () {
    return this._dests
  }

  reload (...args) {
    this._writer.reload(...args)
    return this
  }

  set (key, value) {
    this._writer.set(key, value)
    return this
  }

  async save () {
    return this._writer.updateFiles(this._dests)
  }
}
