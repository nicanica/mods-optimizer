export default function flatten(arr) {
  return arr.reduce((acc, item) => acc.concat(item), []);
}
