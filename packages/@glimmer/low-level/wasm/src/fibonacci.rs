#[no_mangle]
pub fn fibonacci(x: f64) -> f64 {
  if x <= 2.0 {
    return 1.0;
  } else {
    return fibonacci(x - 1.0) + fibonacci(x - 2.0);
  }
}
