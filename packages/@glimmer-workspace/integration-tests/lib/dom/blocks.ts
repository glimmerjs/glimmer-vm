export function blockStack() {
  let stack: number[] = [];

  return (id: number) => {
    if (stack.includes(id)) {
      let close = `<!--%-b:${id}%-->`;
      stack.pop();
      return close;
    } else {
      stack.push(id);
      return `<!--%+b:${id}%-->`;
    }
  };
}
