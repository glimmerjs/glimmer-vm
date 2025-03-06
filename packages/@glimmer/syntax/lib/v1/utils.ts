import type { ErrorNode, ParseResult, ParseResults } from './nodes-v1';

export function getResultsArray<T extends { type: string }>(
  results: ParseResults<T>
): ParseResult<T[]> {
  if (Array.isArray(results)) {
    const out: T[] = [];

    for (const result of results) {
      if (result.type === 'Error') {
        return result as ErrorNode;
      } else {
        out.push(result as T);
      }
    }

    return out;
  } else {
    return results;
  }
}

export function getErrorsFromResults(results: ParseResults<{ type: string }>): ErrorNode[] {
  if (isResultsError(results)) {
    return [results];
  } else {
    return results.filter(isErrorNode);
  }
}

export function isResultsError<T>(results: ParseResults<T>): results is ErrorNode {
  return !Array.isArray(results);
}

export function isErrorNode<T extends { type: string }>(
  result: ParseResult<T>
): result is ErrorNode {
  return result.type === 'Error';
}

export function isOkNode<T extends { type: string }>(result: ParseResult<T>): result is T {
  return result.type !== 'Error';
}

export function resultsToArray<T extends { type: string }>(results: ParseResults<T>): T[] {
  if (isResultsError(results)) {
    return [];
  }

  return results.filter(isOkNode);
}
