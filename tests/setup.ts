import "@testing-library/jest-dom/vitest";

beforeEach(() => {
  // Tests i Node-miljøet (uden browser) har ikke localStorage.
  if (typeof localStorage !== "undefined") localStorage.clear();
});
