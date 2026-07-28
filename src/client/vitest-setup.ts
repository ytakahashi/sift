// Test setup shared by every client (jsdom) test.
//
// jsdom implements no layout, so it omits Element.prototype.scrollIntoView
// entirely. Components that keep the selected row visible would throw when
// rendered without it. A plain no-op is installed rather than a shared mock so
// no state leaks between tests; a test that wants to assert on the call can
// spy on it with vi.spyOn(Element.prototype, 'scrollIntoView').
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = (): void => {};
}
