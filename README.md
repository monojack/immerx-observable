<img src="images/immerx-observable-logo.svg" height="70px"/>

Observable based **middleware** for [ImmerX](https://github.com/monojack/immerx).

<br/>

**Table of contents**:

- [`Install`](#install)
- [`Setup`](#setup)
- [`Epics`](#epics)
  - [`read/write epic`](#readwrite-epic)
  - [`read-only epic`](#read-only-epic)
  - [`combine epics`](#combine-epics)
  - [`patchOf() operator`](#patchof-operator)
  - [`accessing the state`](#accessing-the-state)
  - [`dependency injection`](#dependency-injection)
  - [`error-handling`](#error-handling)

<br/>

### `Install`

```sh
npm install @immerx/observable
```

<br/>

### `Setup`

The middleware setup process is pretty similar to the one of [redux-observable](https://redux-observable.js.org/) - which is what inspired this library.

```js
import { createObservableMiddleware } from '@immerx/observable'

const middleware = createObservableMiddleware()
```

We use a **very** basic [Observable](https://github.com/tc39/proposal-observable) implementation under the hood and exposes a `setAdapter` function that we can use to transform it into the type required by the library we are using (`rxjs`, `xstream`, `most` etc.).

```js
import { from } from 'rxjs'
import { setAdapter } from '@immerx/observable'

setAdapter(from)
```

Provide the middleware to the `create` function from `@immerx/state`

```js
import { create } from '@immerx/state'

const initialState = {}
create(initialState, [middleware])
```

And then run it with the `rootEpic`

```js
import rootEpic from './epics'

middleware.run(rootEpic)
```

All together:

```js
import { create } from '@immerx/state'
import { createObservableMiddleware, setAdapter } from '@immerx/observable'
import { from } from 'rxjs'

import rootEpic from './epics'

const middleware = createObservableMiddleware()
const initialState = {} // or whatever initial state

create(initialState, [middleware])

setAdapter(from) // make sure we set the adapter before calling middleware.run()
middleware.run(rootEpic)
```

<br/>

### `Epics`

Immerx notifies middleware of all, non-empty, [immer patches](https://immerjs.github.io/immer/docs/patches) and the new state value after those patches have been applied. So `@immerx/observable` pipes all the patches through an observable that gets passed as the **first argument** to our epics. Epics should return an observable of [producers](https://immerjs.github.io/immer/docs/produce), unless we want a `read-only` epic that only performs some side-effects and doesn't necessarily update the state. Let's see examples of both:

#### `read/write epic`

Imagine we have an `auth` property in our state that we'll assign the result of decoding an auth token. That result may contain a user `uid` that we can use to fetch the data/profile for that user. Here's the initial state:

```js
const initialState = {
  auth: null,
  //... maybe some other stuff
}
```

Whenever we initialize/change the value of `.auth` immerx will notify all middleware with the following patch object:

```js
{
  op: 'replace', // 'add' when initialized
  path: ['auth'],
  value: {
    uid: '5eba786ea1b6f1314dac9b7b',
    // ...other stuff
  },
}
```

Here's a basic implementation of a `fetchUserDataEpic`:

**NOTE**: I will be using `rxjs` to `adapt` in the following examples, so I assume you already know how the various operators I'll be using work. If `rxjs` is not your thing, you should still have an idea about what the operators might do - they are pretty much the same across all observable/stream libraries but their names may vary. If you are completely new to observables, then maybe you should look into that first.

```js
// epics.js
import { REPLACE } from '@immerx/observable'

const fetchUserDataEpic = patch$ =>
  patch$.pipe(
    filter(patch => patch.op === REPLACE && /^auth/.test(patch.path.join('.'))),
    switchMap(patch => ajax.getJSON(`https://userservice/${patch.value.uid}`)),
    map(userData => draft => void (draft.userData = userData)),
  )
```

A patch can have one of three types: `add`, `replace` and `remove`. For convenience, `@immerx/observable` exports the `ADD`, `REPLACE` and `REMOVE` constants.

We `filter` the `patch$` observable because we want to listen for only `replace` patches that have been applied to the `auth` piece of our state. Then we fetch the user data for the user `uid` that we get from the new `.auth` value. Then we map the fetched `userData` into a [curried producer](https://immerjs.github.io/immer/docs/curried-produce) which will get passed to `@immerx/state` and be used to update the state.

#### `read-only epic`

Sometimes, we want our epic to only perform some side-effects without ultimately updating the state. There are more ways to do this. If we're using `rxjs` we can just slap an `ignoreElements()` at the end of our pipe, or just `skipUntil(NEVER)`, or `filter(() => false)`, or remember that producers are just functions and we can always send down a `noop`.

Following the above example, let's say we want to cache the user data somewhere and maybe just get it from the cache next time we have to fetch it.

```js
// epics.js
import { ADD, REPLACE } from '@immerx/observable'
import { userCache } from './caches'

function noop() {}
const cacheUserDataEpic = patch$ =>
  patch$.pipe(
    filter(
      patch =>
        [ADD, REPLACE].includes(patch.op) &&
        /^userData/.test(patch.path.join('.')),
    ),
    pluck('value'),
    tap(userData => userCache.set(userData.id, userData)),
    map(() => noop),
    // or ignoreElements()
    // or skipUntil(NEVER)
    // or filter(() => false)
  )

const fetchUserDataEpic = patch$ =>
  patch$.pipe(
    filter(patch => patch.op === REPLACE && /^auth/.test(patch.path.join('.'))),
    pluck('value', 'uid'),
    switchMap(uid =>
      userCache.has(uid)
        ? of(userCache.get(uid))
        : ajax.getJSON(`https://userservice/${uid}`),
    ),
    map(userData => draft => void (draft.userData = userData)),
  )
```

#### `combine epics`

So now we have two epics, but the `middleware.run()` method takes only one (a `rootEpic`). `@immerx/observable` exports a function which we can use to combine multiple epics into one.

```js
// epics.js
import { combineEpics } from '@immerx/observable'

// ...
export default combineEpics(fetchUserDataEpic, cacheUserDataEpic)
```

#### `patchOf() operator`

The epic filters look kinda ugly, let's replace them with the `patchOf()` operator.

```js
// epics.js
import { ADD, REPLACE } from '@immerx/observable'
import { patchOf } from '@immerx/observable/operators'
import { userCache } from './caches'

const cacheUserDataEpic = patch$ =>
  patch$.pipe(
    patchOf({ ops: [ADD, REPLACE], path: ['userData'] }),
    pluck('value'),
    tap(userData => userCache.set(userData.id, userData)),
    ignoreElements(),
  )

const fetchUserDataEpic = patch$ =>
  patch$.pipe(
    patchOf({ op: REPLACE, path: ['auth'] }),
    pluck('value', 'uid'),
    switchMap(uid =>
      userCache.has(uid)
        ? of(userCache.get(uid))
        : ajax.getJSON(`https://userservice/${uid}`),
    ),
    map(userData => draft => void (draft.userData = userData)),
  )
```

The operator takes an object with `op` or `ops` (if we want to allow more operation types) and a `path` and tries to match them against the patch properties. FWIW, we can omit either `path` or `op/ops` and it will filter accordingly, or omit everything - in which case it will pass down the `source` observable directly.

**NOTE**: The `patchOf()` operator implementation is very simple, it's basically the same filter we had before + some extra checks and handlers - you can check it out in the source code. However, it is built around our basic Observable implementation. It tries to accommodate for some cases (uses the `.filter()` method if found on the source observable), but if none apply it will create a new Observable. Whether you're ok with that or not is totally up to you, but if you're being a purist, then you might want to implement it yourself by leveraging the internal mechanisms and structures of your observable library.

Here is a similar implementation as an `rxjs` pipeable operator:

```js
import { filter } from 'rxjs/operators'

const EMPTY_OBJ = {}
function patchOf(o = EMPTY_OBJ) {
  return function patchOfOperator(source) {
    if (o === EMPTY_OBJ) {
      return source
    }

    const { op, ops = [op], path = [] } = o
    return source.pipe(
      filter(
        patch =>
          (ops.filter(Boolean).length === 0 || ops.includes(patch.op)) &&
          RegExp(`^${path.join('.')}`).test(patch.path.join('.')),
      ),
    )
  }
}
```

#### `accessing the state`

Sometimes we may need access to the current state value to use in our epic. Say we want to prevent fetching user data if we already have it in our state. The **second argument** passed to our epics is a stream of state values.

```js
const fetchUserDataEpic = (patch$, state$) =>
  patch$.pipe(
    patchOf({ op: REPLACE, path: ['auth'] }),
    pluck('value', 'uid'),
    withLatestFrom(state$),
    filter(([uid, state]) => (state.userData || {}).id !== uid),
    switchMap(([uid]) =>
      userCache.has(uid)
        ? of(userCache.get(uid))
        : ajax.getJSON(`https://userservice/${uid}`),
    ),
    map(userData => draft => void (draft.userData = userData)),
  )
```

#### `dependency injection`

You may have noticed that we are importing the `userCache` from a local `caches` module. Not a very big deal, that's how we do things, right? Right, until we have to test our epics and need to mock most of their dependencies - we don't want to depend on `userCache` to behave correctly, more so when we're using an external caching mechanism/service. Also, we might not want to hit the API and really fetch the user data in our tests, so we would need to find a way to mock `ajax.getJSON` too.

The better approach is to inject the dependencies into the epics and we can do that through `createObservableMiddleware`'s configuration object:

```js
import { userCache } from './caches'
import { ajax } from 'rxjs/ajax'

// ...
const middleware = createObservableMiddleware({
  dependencies: {
    userCache,
    ajax,
  },
})
```

The `dependencies` map gets passed in as the **third argument** to our epics.

```js
const cacheUserDataEpic = (patch$, _, { userCache }) =>
  patch$.pipe(
    // ...
    tap(userData => userCache.set(userData.id, userData)),
    // ...
  )

const fetchUserDataEpic = (patch$, state$, { ajax } = {}) =>
  patch$.pipe(
    // ...
    switchMap(([uid]) =>
      userCache.has(uid)
        ? of(userCache.get(uid))
        : ajax.getJSON(`https://userservice/${uid}`),
    ),
    // ...
  )
```

Now all of our epics are using the injected dependencies and we can write our tests without the headaches.

#### `error handling`

Always important. Especially when dealing with http requests. While there are several ways of handling errors, the most common way is to catch and handle them inside our epics:

```js
import { EMPTY } from 'rxjs'

const fetchUserDataEpic = (patch$, state$) =>
  patch$.pipe(
    patchOf({ op: REPLACE, path: ['auth'] }),
    pluck('value', 'uid'),
    switchMap(([uid]) =>
      userCache.has(uid)
        ? of(userCache.get(uid))
        : ajax.getJSON(`https://userservice/${uid}`).pipe(
            catchError(error => {
              // maybe do something with the error?
              return EMPTY
            }),
          ),
    ),
    map(userData => draft => void (draft.userData = userData)),
  )
```

We are catching the error, maybe log it to the console or send it to our logging service, whatever, but we also return an [EMPTY](https://rxjs.dev/api/index/const/EMPTY) observable, which is enough to bail out and make sure we don't reach the `map()` with our producer. In some cases we might want to `retry()`, or send down a default value, or even something that would help use branch out inside the `map()`, it's up to us to decide.

**NOTE**: It is **very** important to add the `catchError()` to the `getJSON().pipe()` inside the `switchMap()` because if we let the error reach the `patch$.pipe()` it will terminate it and will stop listening for new patches - we don't want that... or do we?
