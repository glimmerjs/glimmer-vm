import type { Tag } from '@glimmer/interfaces';

import type { MonomorphicTagImpl } from './validators';

import { infoForTag, tagFor } from './meta';
import { track } from './tracking';
import { validateTag, valueForTag } from './validators';

type Info = {
  tag: MonomorphicTagImpl;
  prevValue: number;
  dependencies: {
    object: object;
    propertyKey: string;
    changed: boolean;
  }[];
};

export function getTrackedDependencies(obj: Record<string, any>, property: string, info?: Info) {
  info = info || ({} as Info);
  const tag = info?.tag || track(() => obj[property]);
  const dependencies = [];
  // do not include tracked properties from dependencies

  const subtags = (Array.isArray(tag.subtag) ? [tag, ...tag.subtag] : [tag, tag.subtag]).filter(
    (t) => !!t
  ) as Tag[];
  for (const subtag of subtags) {
    if (subtag === tag) continue;
    dependencies.push({ ...infoForTag(subtag), tag: subtag });
    if (subtag.subtag && !Array.isArray(subtag.subtag)) {
      dependencies.push({ ...infoForTag(subtag.subtag) });
    }
  }

  let maxRevision = valueForTag(tag);

  const hasChange = (info.prevValue && maxRevision !== info.prevValue) || false;
  let latestValue = info.prevValue || 0;

  info.dependencies = dependencies.map((t) => {
    if (t.tag.lastValue > latestValue) {
      latestValue = t.tag.lastValue;
    }
    const changed = hasChange && t.tag.lastValue > info!.prevValue;
    return { object: t.object, propertyKey: t.propertyKey, changed };
  });

  info.prevValue = maxRevision;

  return info;
}

type TrackedInfo = {
  changed: string[];
  propertyInfo: Record<string, any>;
};

export function getChangedProperties(obj: object, trackedInfo?: TrackedInfo) {
  trackedInfo = trackedInfo || ({} as TrackedInfo);
  trackedInfo['changed'] = [];
  trackedInfo.propertyInfo = trackedInfo.propertyInfo || {};
  for (const name in obj) {
    const tag = tagFor(obj, name);
    const revision = valueForTag(tag);
    let tagInfo = trackedInfo.propertyInfo?.[name] || {
      tag: tag,
      revision,
    };
    if (!tagInfo.tag) return;
    trackedInfo.propertyInfo[name] = tagInfo;

    const changed = !validateTag(tagInfo.tag, tagInfo.revision);
    tagInfo.revision = revision;
    if (changed) {
      trackedInfo['changed'].push(name);
    }
  }
  return trackedInfo;
}
