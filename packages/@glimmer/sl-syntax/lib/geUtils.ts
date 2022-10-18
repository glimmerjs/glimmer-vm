const enableLog = true;

export function gelog(msg: string, ...args: any[]) {
  if (!enableLog) {
    return;
  }

  console.log(`${msg} \n`);
  args.forEach((item) => {
    // todo 引入 deep clone
    // 然后要看看最新的测试例子，看看是怎么识别到 html element

    const t = JSON.stringify(item);
    const i = JSON.parse(t);
    console.log(msg, i);
  });
  console.log(`\n`);
}
