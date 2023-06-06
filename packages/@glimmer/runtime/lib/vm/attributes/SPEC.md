# Rationalized Classic Attribute Spec

This algorithm takes an element (_element_) and a qualified attribute name (_name_).

It returns a tuple of:

- `ATTR` or `PROP` (`ATTR` means that the attribute should be treated as an HTML attribute, while `PROP` means that it should be treated as a property)
- `name` (the name of the attribute)

> The output `name` differs from the input `name` when the user specifies an invalid uppercase attribute name that is a valid property name such as `<input DISABLED>`. In this case,

1. If _name_ is a property of `element` (using the `in` operator, `[[HasProperty]]`), then return `[ Triage(element.tagName, name), name ]`.
2. Let _lowercase_ be the lowercase version of _name_.
3. If _lowercase_ is a property of `element` (using the `in` operator, `[[HasProperty]]`), then return `[ Triage(element.tagName, lowercase), lowercase ]`.
4. Return `[ ATTR, name ]`.

## NormalizeProperty

## Triage

This algorithm takes a tag name (_tag_) and a qualified attribute name (_name_). The _tag_ has the same case as `element.tagName` (typically uppercased).

1. If _name_ is `style`, return `ATTR`
2. If _name_ is `form`, then if _tag_ is one of the [FormFieldTags](#form-field-tags), return `ATTR`.
3. If _tag_ is `INPUT`, then if _name_ is one of the [InputAttributes](#input-attributes), return `ATTR`.
4. Return `PROP`.

## FormFieldTags

1. `INPUT`
2. `SELECT`
3. `OPTION`
4. `TEXTAREA`
5. `LABEL`
6. `FIELDSET`
7. `LEGEND`
8. `OBJECT`
9. `OUTPUT`
10. `BUTTON`

## InputAttributes

1. `autocorrect`
2. `list`
