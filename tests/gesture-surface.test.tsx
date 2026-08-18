import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, vi } from "vitest";
import { GestureSurface } from "../components/experience/GestureSurface";

let visibilityStateDescriptor: PropertyDescriptor | undefined;

function renderSurface(enabled = true) {
  const onAdvance = vi.fn();
  const onPause = vi.fn();
  const result = render(
    <GestureSurface enabled={enabled} onAdvance={onAdvance} onPause={onPause}>
      <span>content</span>
    </GestureSurface>,
  );
  return { ...result, onAdvance, onPause, surface: screen.getByTestId("gesture-surface") };
}

afterEach(() => {
  if (visibilityStateDescriptor) {
    Object.defineProperty(document, "visibilityState", visibilityStateDescriptor);
    visibilityStateDescriptor = undefined;
  }
  if (vi.isFakeTimers()) {
    vi.clearAllTimers();
    vi.useRealTimers();
  }
  vi.restoreAllMocks();
});

test("an upward pointer gesture advances once and balances pause", () => {
  const setPointerCapture = vi.fn();
  const releasePointerCapture = vi.fn();
  const { onAdvance, onPause, surface } = renderSurface();
  Object.assign(surface, { setPointerCapture, releasePointerCapture });

  fireEvent.pointerDown(surface, { clientX: 20, clientY: 160, pointerId: 4 });
  fireEvent.pointerUp(surface, { clientX: 20, clientY: 80, pointerId: 4 });

  expect(onAdvance).toHaveBeenCalledOnce();
  expect(onPause.mock.calls).toEqual([[true], [false]]);
  expect(setPointerCapture).toHaveBeenCalledWith(4);
  expect(releasePointerCapture).toHaveBeenCalledWith(4);
});

test("cancelled and horizontal pointer gestures never advance and balance pause", () => {
  const { onAdvance, onPause, surface } = renderSurface();

  fireEvent.pointerDown(surface, { clientX: 20, clientY: 160, pointerId: 1 });
  fireEvent.pointerCancel(surface, { pointerId: 1 });
  fireEvent.pointerDown(surface, { clientX: 20, clientY: 160, pointerId: 2 });
  fireEvent.pointerUp(surface, { clientX: 120, clientY: 140, pointerId: 2 });

  expect(onAdvance).not.toHaveBeenCalled();
  expect(onPause.mock.calls).toEqual([[true], [false], [true], [false]]);
});

test("disabled gestures never advance while pointer pause remains balanced", () => {
  const { onAdvance, onPause, surface } = renderSurface(false);

  fireEvent.pointerDown(surface, { clientX: 20, clientY: 160 });
  fireEvent.pointerUp(surface, { clientX: 20, clientY: 80 });
  fireEvent.wheel(surface, { deltaY: 50 });
  fireEvent.keyDown(surface, { key: "ArrowDown" });

  expect(onAdvance).not.toHaveBeenCalled();
  expect(onPause.mock.calls).toEqual([[true], [false]]);
});

test("one wheel burst advances once and a later burst advances again", () => {
  vi.useFakeTimers();
  const { onAdvance, surface } = renderSurface();

  fireEvent.wheel(surface, { deltaY: 50 });
  fireEvent.wheel(surface, { deltaY: 50 });
  expect(onAdvance).toHaveBeenCalledOnce();
  act(() => vi.advanceTimersByTime(400));
  fireEvent.wheel(surface, { deltaY: 50 });
  expect(onAdvance).toHaveBeenCalledTimes(2);
});

test("eligible keyboard gestures advance once and prevent their defaults", () => {
  const { onAdvance, surface } = renderSurface();
  for (const key of ["ArrowDown", "PageDown", " "]) {
    const event = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key });
    surface.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  }
  fireEvent.keyDown(surface, { key: "ArrowDown", repeat: true });
  fireEvent.keyDown(surface, { key: "ArrowUp" });

  expect(onAdvance).toHaveBeenCalledTimes(3);
});

test("visibility cancellation releases an active gesture and unmount clears listeners and wheel timers", () => {
  vi.useFakeTimers();
  visibilityStateDescriptor = Object.getOwnPropertyDescriptor(document, "visibilityState");
  Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
  const { onAdvance, onPause, surface, unmount } = renderSurface();
  const releasePointerCapture = vi.fn();
  const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout");
  Object.assign(surface, { releasePointerCapture });

  fireEvent.pointerDown(surface, { clientX: 20, clientY: 160, pointerId: 5 });
  document.dispatchEvent(new Event("visibilitychange"));
  expect(onPause.mock.calls).toEqual([[true], [false]]);
  expect(releasePointerCapture).toHaveBeenCalledWith(5);

  fireEvent.wheel(surface, { deltaY: 50 });
  expect(onAdvance).toHaveBeenCalledOnce();
  unmount();
  expect(clearTimeoutSpy).toHaveBeenCalled();
  act(() => vi.advanceTimersByTime(400));
  document.dispatchEvent(new Event("visibilitychange"));
  expect(onPause.mock.calls).toEqual([[true], [false]]);
});
