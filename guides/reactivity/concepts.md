The core concepts in the Glimmer reactivity system are:

- **A timeline of revisions**: each of which represents a single atomic change. The timeline changes
  monotonically: each time the timeline is advanced, its _current revision_ increases to a value
  greater than the previous revision.
- **Reactive cells**: JavaScript storage that can change over time. Each change to a reactive cell
  is recorded in an associated tag. The _tag's revision_ reflects the most recent time that the
  cell's value changed.
- **Validation**: To determine whether the previous value of a cell is still valid, the its tag's
  _current revision_ is compared to the tag's revision when the value was last accessed.
- **Value Tags**: stateful objects that represent reactive values, and which report when they were
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
- **Tracking Stack**: A stack of tracking frames that represents the current reactive computation.
  The tracking stack has two fundamental operations:
  - `[Begin]`: When a reactive computation begins, a new tracking frame is created.
  - `[Commit]`: When a reactive computation ends, the previous tracking frame is restored, and the
    operation returns a [combined tag](#combined-tag) composed of the tags that were added to the
    current tracking frame.
