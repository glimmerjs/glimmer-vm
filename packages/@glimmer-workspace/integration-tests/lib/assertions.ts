export function notThrows(callback: () => void, message?: string): void;
export function notThrows(callback: () => Promise<void>, message?: string): Promise<void>;
export function notThrows(
  callback: () => void | Promise<void>,
  message = 'expected callback to not throw'
): void | Promise<void> {
  try {
    const result = callback();

    if (result) {
      return result
        .then(() => {
          QUnit.assert.ok(true, message);
        })
        .catch((e) => {
          QUnit.assert.notOk(e, message);
        });
    } else {
      QUnit.assert.ok(true, message);
    }
  } catch (e) {
    QUnit.assert.ok(false, message);
  }
}
