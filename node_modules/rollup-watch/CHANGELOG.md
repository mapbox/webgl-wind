# rollup-watch changelog

## 3.2.2

* Fix missing `require-relative` ([#41](https://github.com/rollup/rollup-watch/pull/41))
* Prevent infinite build loops

## 3.2.1

* Published mistakenly

## 3.2.0

* `options.targets`, not `options.target` ([#36](https://github.com/rollup/rollup-watch/issues/36))
* Use chokidar if available ([#39](https://github.com/rollup/rollup-watch/pull/39))

## 3.1.0

* Add `watcher.close()` method
* Resolve symlinks before watching ([#32](https://github.com/rollup/rollup-watch/issues/32))

## 3.0.0

* Don't check for version updates ([#12](https://github.com/rollup/rollup-watch/issues/12), [#26](https://github.com/rollup/rollup-watch/issues/26), [#34](https://github.com/rollup/rollup-watch/issues/34))
* Fix `initial` flag ([#13](https://github.com/rollup/rollup-watch/pull/13))
* Retain options object ([#24](https://github.com/rollup/rollup-watch/issues/24))
* Don't watch generated bundle ([#15](https://github.com/rollup/rollup-watch/issues/15))

## 2.5.0

* Use `cache` ([#8](https://github.com/rollup/rollup-watch/issues/8))

## 2.4.0

* Only watch files that exist (disregard plugin helper modules) ([#3](https://github.com/rollup/rollup-watch/issues/3))

## 2.3.0

* Handle `rename` events ([#4](https://github.com/rollup/rollup-watch/issues/4))

## 2.2.0

* Emit errors and recover ([#2](https://github.com/rollup/rollup-watch/issues/2))

## 2.1.1

* Fix `pkg.files`

## 2.1.0

* Experiment with using native `fs.watch`

## 2.0.0

* CLI must pass `rollup` to `watch`
* Check version is current before starting
* Return an EventEmitter

## 1.0.0

* First experimental release
