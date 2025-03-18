# Reactive Composition

Glimmer's reactivity system is based on a small primitive called _Tag_: _Tags_ evolve along a _timeline of revisions_ and are composed inside of _tracking frames_.

_Tags_ intentionally compose separately from the [reactive values](./reactive-values.md) that they
represent, making the core of Glimmer's reactive composition simple and easy to reason about.

> [!NOTE]
>
> This is an important distinction between Glimmer's reactivity system and most competing reactivity
> systems: A reactive computation in Glimmer can _always_ be validated without computing its value
> and comparing the new value to the previous value. This is a real tradeoff, but it allows Glimmer
> to validate reactive computations reliably and efficiently.

## The Core Concepts

- [**A timeline of revisions**](#the-timeline-of-revisions): each of which represents a single atomic change. The timeline changes
  monotonically: each time the timeline is advanced, its _current revision_ increases to a value
  greater than the previous revision.
- **Reactive cells**: JavaScript storage that can change over time. Each change to a reactive cell
  is recorded in an associated tag. The _tag's revision_ reflects the most recent time that the
  cell's value changed.
- **Validation**: To determine whether the previous value of a cell is still valid, the its tag's
  _current revision_ is compared to the tag's revision when the value was last accessed.
- **Value Tags**: <a id="value-tag"></a> stateful objects that represent reactive values, and which report when they were
  last changed as a timestamp. Tags have two fundamental operations:
  - `[Consume]`: When the reactive value associated with the tag is _accessed_, its tag is _consumed_.
  - <a id="combined-tag"></a> `[Combine]`: Multiple tags can be combined into a single tag that reflects the _most recent_
    timestamp of any of its members. 
- **Mutable Tags**: Mutable tags are a superset of value tags with two additional operations:
  - `[Update]`: When the reactive value associated with the tag is updated, the timeline is advanced to
    the next revision, and the _current revision_ is recorded as the _tag's revision_.
  - `[Freeze]`: If a reactive value associated with a mutable tag can no longer be changed, the tag can
    be _frozen_. Accesses to a frozen tag will not be recorded in the current tracking frame.
- **Tracking Frame**: Represents the current reactive _computation_. Whenever a tag is consumed, it is
  added to the current tracking frame.
  - **Committed**: When a tracking frame is _committed_, its list of members is finalized and become
    dependencies of the previous tracking frame, if there is one.
  - **Invalidates**: A tracking frame _invalidates_ after it is committed, and when any of its
    members are updated.
- **Tracking Stack**: A stack of tracking frames that represents the current reactive computation.
  The tracking stack has two fundamental operations:
  - `[Begin]`: When a reactive computation begins, a new tracking frame is created.
  - `[Commit]`: When a reactive computation ends, the previous tracking frame is restored, and the
    operation returns a [combined tag](#combined-tag) composed of the tags that were added to the
    current tracking frame.
- **Reactive Phases**: There are two important reactive phases: _updating_ (sometimes referred to as
  the "action" phase), and _rendering_.
  - _Updating_: During the updating phase, reactive values are updated, and the timeline is advanced
    to the next revision for each atomic update. This phase is not considered a reactive
    computation: reactive values can be freely consumed, and the work is not recorded in the
    tracking stack.
  - _Rendering_: During the rendering phase, reactive values are consumed but _should not be
    updated_. The tracking stack is used to track the reactive dependencies of the output.
- **Rendering Transactions**: A rendering transaction is a unit of work that represents a single
  _rendering_ phase. Glimmer's [safety constraints](#safety-constraints) are defined in terms of
  rendering transactions.

## The Timeline of Revisions

The timeline of revisions is a monotonically increasing sequence of revisions, each of which
represents a single atomic change. The timeline changes monotonically: each time the timeline is
advanced, its _current revision_ increases to a value greater than the previous revision.

The _initial revision_ on the timeline is revision `1`, and a 

> [!NOTE]
>
> Revision `0` is a special revision called the _constant revision_. It is used to represent values
> that are constant and will never change. Tags with the constant revision are not added to the
> current tracking frame, and a tracking frame that consumed only constant tags is considered
> _constant_.

## Tags

## Tracking Frame