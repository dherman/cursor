## Cursor

A prollyfill for an ES6 "cursor" API, which represents the lazy
evaluation of an object selection path (e.g., `obj.w.x[y].z`).

Right now this works for all object selection paths. We may want to
limit it to just structured data, i.e., typed objects.

## Example

```javascript
var Point = new StructType({ x: uint32, y: uint32 });
var PointArray = new ArrayType(Point);

var data = new PointArray(1000000);

var c = new Cursor();

var maxX = -Infinity, maxY = -Infinity;

for (var i = 0, n = data.length; i < n; i++) {
  c.move(data, i);
  maxX = Math.max(maxX, c.x);
  maxY = Math.max(maxY, c.y);
}

console.log("max x: " + maxX);
console.log("max y: " + maxY);
```

## License

MIT.
