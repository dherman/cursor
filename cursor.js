(function(global) {

// FIXME: should `move` eagerly deref down to the last index, or be fully lazy?
// FIXME: should we use hasOwn or `in` for reading from Cursor.prototype?

// For fun/hypercorrectness/paranoia we save all libraries as lexical functions.

var apply = Function.call.bind(Function.apply);
var bind = Function.call.bind(Function.bind);
var applyBind = Function.apply.bind(Function.bind);
var hasOwn = Function.call.bind({}.hasOwnProperty);
var protoOf = Object.getPrototypeOf;
var ownDesc = Object.getOwnPropertyDescriptor;
var defProp = Object.defineProperty;
var ownNames = Object.getOwnPropertyNames;
var keysOf = Object.keys;
var create = Object.create;
var toObj = global.Object;
var push = Function.call.bind([].push);
var slice = Function.call.bind([].slice);
var concat = Function.call.bind([].concat);

function construct(ctor, args) {
  var bound = applyBind(ctor, concat([null], args));
  return new bound();
}

var Np = Number.prototype;
var Sp = String.prototype;
var Bp = Boolean.prototype;

// Cursor -> CursorState
var cursorState = new WeakMap();

var getState = cursorState.get.bind(cursorState);
var setState = cursorState.set.bind(cursorState);

function CursorState(path) {
  this.path = path;
}

var CSp = CursorState.prototype;

CSp.isEmpty = function() {
  return !this.path.length;
};

CSp.read = function(suffix) {
  var path = concat(this.path, suffix);

  if (!path.length)
    return;

  var result = path[0];
  for (var i = 1, n = path.length; i < n; i++) {
    result = result[path[i]];
  }

  return result;
};

CSp.write = function(suffix, val) {
  var path = concat(this.path, suffix);

  if (!path.length)
    throw new ReferenceError("cursor is not pointing to anything");

  var result = path[0];
  for (var i = 1, n = path.length - 1; i < n; i++) {
    result = result[path[i]];
  }

  result[path[i]] = val;
};

CSp.update = function(path) {
  this.path = path;
};



function Cursor() {
  var state = new CursorState(slice(arguments));

  var cursor = new Proxy(state, {
    getOwnPropertyDescriptor: function(state, name) {
      return ownDesc(state.read([]), name);
    },

    getOwnPropertyNames: function(state) {
      return ownNames(state.read([]));
    },

    getPrototypeOf: function() {
      return Cp;
    },

    defineProperty: function(state, name, desc) {
      return defProp(state.read([]), name, desc);
    },

    deleteProperty: function(state, name) {
      // FIXME: what boolean to return
      return delete (state.read([]))[name];
    },

    freeze: function(state) {
      return freeze(state.read([]));
    },

    seal: function(state) {
      return seal(state.read([]));
    },

    preventExtensions: function(state) {
      return preventExtensions(state.read([]));
    },

    isFrozen: function(state) {
      return isFrozen(state.read([]));
    },

    isSealed: function(state) {
      return isSealed(state.read([]));
    },

    isExtensible: function(state) {
      return isExtensible(state.read([]));
    },

    has: function(state, name) {
      if (state.isEmpty())
        return hasOwn(Cp, name);

      var current = state.read([]);
      return hasOwn(current, name)
          || hasOwn(Cp, name)
          || hasOwn(protoOf(current), name);
    },

    hasOwn: function(state, name) {
      return !state.isEmpty() && hasOwn(state.read([]), name);
    },

    get: function(state, name) {
      // if currently empty can still extract properties from Cursor.prototype
      if (state.isEmpty())
        return Cp[name];

      var current = state.read([]);
      if (current == null)
        throw new TypeError(current + " has no properties");

      switch (typeof current) {
        case 'object':
        case 'function':
          return hasOwn(current, name)
               ? current[name]
               : hasOwn(Cp, name)
               ? Cp[name]
               : protoOf(current)[name];

        case 'number':
          return hasOwn(Cp, name) ? Cp[name] : Np[name];

        case 'string':
          return hasOwn(Cp, name) ? Cp[name] : Sp[name];

        case 'boolean':
          return hasOwn(Cp, name) ? Cp[name] : Bp[name];
      }
    },

    // FIXME: what boolean result to return
    set: function(state, name, val) {
      // if currently empty can't add own props but can call inherited setters
      if (state.isEmpty()) {
        var desc = descOf(Cp, name);
        if (typeof desc.set === 'function') {
          Cp[name] = val;
          return true;
        }
        return false;
      }

      var current = state.read([]);
      current[name] = val;
      return true;
    },

    // FIXME: produce an iterator once JS engines update their proxy API's
    // see also: https://bugzilla.mozilla.org/show_bug.cgi?id=783826
    enumerate: function(state) {
      var current = state.read([]);

      if (current == null)
        return [];

      if (typeof current !== 'object')
        current = toObj(current);

      var result = keysOf(current);
      var dict = create(null);
      for (var i = 0, n = result.length; i < n; i++) {
        dict[result[i]] = true;
      }

      for (var key in Cp) {
        if (!(key in dict)) {
          dict[key] = true;
          push(result, key);
        }
      }

      for (var key in protoOf(current)) {
        if (!(key in dict)) {
          dict[key] = true;
          push(result, key);
        }
      }

      return result;
    },

    keys: function(state) {
      return keysOf(state.read([]));
    },

    apply: function(state, thisArg, args) {
      return apply(state.read([]), thisArg, args);
    },

    construct: function(state, args) {
      return construct(state.read([]), args);
    }
  });

  setState(cursor, state);

  return cursor;
}

var Cp = create(null);

// Cursor.prototype is immutable
defProp(Cursor, "prototype", {
  configurable: false,
  enumerable: false,
  writable: false,
  value: Cp
});

function defMethod(obj, key, val) {
  defProp(obj, key, {
    configurable: true,
    enumerable: false,
    writable: true,
    value: val
  });
}

function defMethods(obj, methods) {
  for (var key in methods) {
    if (hasOwn(methods, key)) {
      defMethod(obj, key, methods[key]);
    }
  }
}

// inherited prototype methods, for convenience
defMethods(Cp, {
  get: function() {
    return getState(this).read(slice(arguments));
  },

  set: function() {
    var rest = slice(arguments);
    var last = rest.length - 1;
    var val = rest[last];
    getState(this).write(slice(rest, 0, last), val);
    return val;
  },

  move: function() {
    getState(this).update(slice(arguments));
  }
});

// static class methods, in case the methods are shadowed
defMethods(Cursor, {
  get: function(cursor) {
    return getState(cursor).read(slice(arguments));
  },

  set: function(cursor) {
    var rest = slice(arguments, 1);
    var last = rest.length - 1;
    var val = rest[last];
    getState(cursor).write(slice(rest, 0, last), val);
    return val;
  },

  move: function(cursor) {
    getState(cursor).update(slice(arguments));
  }
});

global.Cursor = Cursor;

})(this);
