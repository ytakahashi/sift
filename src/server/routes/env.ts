/**
 * Hono environment shared by every router in this layer.
 *
 * Currently empty: Sift passes runtime dependencies through route factory
 * options rather than through Hono's context, so there are no bindings or
 * variables. It exists as a named type so all routers agree on the generic
 * parameter, and so that adding a binding later is a one-line change here
 * instead of a sweep across every router.
 */
export type Env = Record<string, never>;
