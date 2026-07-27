import { GraphQLError, GraphQLNonNull, isListType } from "graphql";
import type { ValidationRule } from "graphql";
// @ts-expect-error graphql-depth-limit ships no type declarations.
import depthLimit from "graphql-depth-limit";
import { createComplexityRule, type ComplexityEstimator } from "graphql-query-complexity";

/** Maximum allowed selection-set nesting for any GraphQL operation (#774). */
export const MAX_QUERY_DEPTH = 7;

/** Maximum allowed total query complexity score for any GraphQL operation (#774). */
export const MAX_QUERY_COMPLEXITY = 200;

/**
 * graphql-depth-limit reports its own ("'opName' exceeds maximum operation
 * depth of N") message the instant a selection crosses maxDepth, which
 * doesn't match the descriptive message required by #774. So it's given a
 * high safety ceiling here — purely to bound pathological recursion — and
 * the real enforcement happens in the callback, where we know the actual
 * computed depth and can report it.
 */
const DEPTH_SAFETY_CEILING = 50;

export const depthLimitRule: ValidationRule = (validationContext) =>
  depthLimit(DEPTH_SAFETY_CEILING, {}, (depths: Record<string, number>) => {
    for (const depth of Object.values(depths)) {
      if (depth > MAX_QUERY_DEPTH) {
        validationContext.reportError(
          new GraphQLError(`Query depth ${depth} exceeds maximum of ${MAX_QUERY_DEPTH}`),
        );
      }
    }
  })(validationContext);

/** Every field costs 1; a field whose type resolves to a list costs 10 (#774). */
const listAwareEstimator: ComplexityEstimator = ({ field, childComplexity }) => {
  let type = field.type;
  while (type instanceof GraphQLNonNull) {
    type = type.ofType;
  }
  const fieldCost = isListType(type) ? 10 : 1;
  return fieldCost + childComplexity;
};

export const complexityLimitRule: ValidationRule = createComplexityRule({
  maximumComplexity: MAX_QUERY_COMPLEXITY,
  estimators: [listAwareEstimator],
  createError: (max, actual) =>
    new GraphQLError(`Query complexity ${actual} exceeds maximum of ${max}`),
});
