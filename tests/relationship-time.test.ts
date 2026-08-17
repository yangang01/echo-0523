import { elapsedSinceConfession } from "../lib/relationship-time";

test("calculates elapsed units from 2026-05-23 in Asia/Shanghai", () => {
  expect(elapsedSinceConfession(new Date("2026-05-24T00:00:00+08:00"))).toEqual({
    days: 1, hours: 0, minutes: 0, seconds: 0,
  });
});

test("clamps dates before the confession to zero", () => {
  expect(elapsedSinceConfession(new Date("2026-05-01T00:00:00+08:00"))).toEqual({
    days: 0, hours: 0, minutes: 0, seconds: 0,
  });
});
