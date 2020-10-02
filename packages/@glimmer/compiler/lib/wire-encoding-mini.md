This proposal is an attempt to use the ideas in `wire-encoding.md` to avoid needing quite as many
variants of opcodes, instead representing flags compactly.

# Expressions

Expressions are allowed in _expression position_ and start with a unique 4-bit tag.

# Simple Literals

Expression Tag: 0x0 (`0b0000`)

Literal Tags:

```
null       0b00 ; complete tag: 0x00 (`0b000000`), encoding: `0`
undefined  0b01 ; complete tag: 0x01 (`0b000001`), encoding: `1`
true       0b10 ; complete tag: 0x02 (`0b000010`), encoding: `2`
false      0b11 ; complete tag: 0x03 (`0b000011`), encoding: `3`
```

# Unbounded Literals

Expression Tag: 0x1 (`0b0001`)

Literal Tags:

```
number  0b00 ; complete tag: 0x04 (`0b000100`), encoding: `4`
string  0b01 ; complete tag: 0x05 (`0b000101`), encoding: `5`
```


## Number

A number is represented as a leading `4` (`0b000100`) followed by a literal representation of the
number.

Example: the number 525.

```
4525
```

> This could be represented more efficiently over the wire, but might be slower to decode.

## String

A string is represented as a leading `5` (`0b000101`) followed by a literal representation of the
string, encoded like the body of a JSON string.

Example: the string `hello world`

```
5hello world
```

Example: the string `hello\nworld"`

```
5hello\nworld\"
```

# Variable References

## Namespaced Resolve

Expression Tag: 0x2 (`0b0010`)

Namespaces:

```
helper              0b00 ; complete tag: 0x08 (`0b001000`), encoding: `8`
modifier            0b01 ; complete tag: 0x09 (`0b001001`), encoding: `9`
component           0b10 ; complete tag: 0x0A (`0b001010`), encoding: `A`
component or helper 0b11 ; complete tag: 0x0B (`0b001011`), encoding: `B`
```

A namespaced resolve is encoded as the complete tag, followed by the upvar number as a literal
number.

### Examples

In all of the following examples, assume that `x` is upvar `1`.

Example: the `x` in `(x)` (`helper` namespace).

```
91
```

Example: the `x` in `{{x y}}` (`component` or `helper` namespace).

```
B1
```

## Special Resolve

Expression Tag: 0x3 (`0b0011`)

Namespaces:

```
strict              0b00 ; complete tag: 0x0C (`0b001100`), encoding: `C`
none                0b01 ; complete tag: 0x0D (`0b001101`), encoding: `D`
helper              0b10 ; complete tag: 0x0E (`0b001110`), encoding: `E`
component or helper 0b11 ; complete tag: 0x0F (`0b001111`), encoding: `F`
```

### Examples

In all of the following examples, assume that `x` is upvar `1`.

Example: the `x` in `{{x.y}}` (`none` namespace).

```
C1
```

Example: the `x` in `attr={{x}}` (`helper` namespace)

```
D1
```

Example: the `x` in `{{x}}` (`component` or `helper` namespace).

```
E1
```

In strict mode, all free variables are prefixed with `F`.

## GetPath

Expression Tag: 0x4 (`0b0100`)
Complete Tag (no flags): 0x10 (`0b010000`)

The head is separated from the tail with a `.` character.

The tail is represented a series of:

- dot-terminated string, if the string does not contain a dot
- dot-terminated quoted JSON string, if the string does contain a dot

### Example

In strict mode, assuming that `x` is upvar 1.

```hbs
x.y.z
```

Encoding in Longhand:

```
0x10 GetPath
0x04 SpecialResolve flag=strict
0x01 Upvar 1
0x49 `.`
0x3C `y`
0x49 `.`
0x3D `z`
```

Encoding:

```
G41.y.z
```

(8 characters)

#### Compared to Today's Wire Format

```
[32,[34,1],["y","z"]]
```

(22 characters)

# Representation

# Encoded wire format

The entire wire format is encoded using the characters that are valid in a JSON string.

```
'0' 0x00 0000000
'1' 0x01 0000001
'2' 0x02 0000010
'3' 0x03 0000011
'4' 0x04 0000100
'5' 0x05 0000101
'6' 0x06 0000110
'7' 0x07 0000111
'8' 0x08 0001000
'9' 0x09 0001001
'A' 0x0A 0001010
'B' 0x0B 0001011
'C' 0x0C 0001100
'D' 0x0D 0001101
'E' 0x0E 0001110
'F' 0x0F 0001111
'G' 0x10 0010000
'H' 0x11 0010001
'I' 0x12 0010010
'J' 0x13 0010011
'K' 0x14 0010100
'L' 0x15 0010101
'M' 0x16 0010110
'N' 0x17 0010111
'O' 0x18 0011000
'P' 0x19 0011001
'Q' 0x1A 0011010
'R' 0x1B 0011011
'S' 0x1C 0011100
'T' 0x1D 0011101
'U' 0x1E 0011110
'V' 0x1F 0011111
'W' 0x20 0100000
'X' 0x21 0100001
'Y' 0x22 0100010
'Z' 0x23 0100011
'a' 0x24 0100100
'b' 0x25 0100101
'c' 0x26 0100110
'd' 0x27 0100111
'e' 0x28 0101000
'f' 0x29 0101001
'g' 0x2A 0101010
'h' 0x2B 0101011
'i' 0x2C 0101100
'j' 0x2D 0101101
'k' 0x2E 0101110
'l' 0x2F 0101111
'm' 0x30 0110000
'n' 0x31 0110001
'o' 0x32 0110010
'p' 0x33 0110011
'q' 0x34 0110100
'r' 0x35 0110101
's' 0x36 0110110
't' 0x37 0110111
'u' 0x38 0111000
'v' 0x39 0111001
'w' 0x3A 0111010
'x' 0x3B 0111011
'y' 0x3C 0111100
'z' 0x3D 0111101
'!' 0x3E 0111110
'#' 0x3F 0111111
'$' 0x40 1000000
'%' 0x41 1000001
'&' 0x42 1000010
'(' 0x43 1000011
')' 0x44 1000100
'*' 0x45 1000101
'+' 0x46 1000110
',' 0x47 1000111
'-' 0x48 1001000
'.' 0x49 1001001
'/' 0x4A 1001010
':' 0x4B 1001011
';' 0x4C 1001100
'<' 0x4D 1001101
'=' 0x4E 1001110
'>' 0x4F 1001111
'?' 0x50 1010000
'@' 0x51 1010001
'[' 0x52 1010010
']' 0x53 1010011
'^' 0x54 1010100
'_' 0x55 1010101
'`' 0x56 1010110
'{' 0x57 1010111
'|' 0x58 1011000
'}' 0x59 1011001
'~' 0x5A 1011010
```

In terms of bit patterns, anything from 0b000000 to 0b111111
(0x00 to 0x3F) can be represented directly.

The remaining available characters (0x40 to 0x5A) don't have a
very useful bit representation, but can be used to represent
standalone values between 0 and 90 and the high bit flag can be
used on values between 0 and 26 (0x00 to 0x1a).

Generally speaking, chars are assumed to encode 6 bits, except
when otherwise explicitly stated.
