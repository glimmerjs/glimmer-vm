export default function objectValues(obj: any) {
  return typeof Object.values === 'function' ? Object.values(obj) : Object.keys(obj).map((k) => obj[k]);
}
