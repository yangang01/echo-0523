import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, vi } from "vitest";
import { GestureSurface } from "../components/experience/GestureSurface";

let visibilityStateDescriptor: PropertyDescriptor | undefined;
let visibilityStateHadOwnDescriptor = false;

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
  if (visibilityStateHadOwnDescriptor && visibilityStateDescriptor) {
    Object.defineProperty(document, "visibilityState", visibilityStateDescriptor);
  } else {
    delete (document as unknown as Record<string, unknown>).visibilityState;
  }
  visibilityStateDescriptor = undefined;
  visibilityStateHadOwnDescriptor = false;
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

  fireEvent.pointerDown(surface, { clientX: 20, clientY: 160, pointerId: 4, isPrimary: true, button: 0 });
  fireEvent.pointerUp(surface, { clientX: 20, clientY: 80, pointerId: 4 });

  expect(onAdvance).toHaveBeenCalledOnce();
  expect(onPause.mock.calls).toEqual([[true], [false]]);
  expect(setPointerCapture).toHaveBeenCalledWith(4);
  expect(releasePointerCapture).toHaveBeenCalledWith(4);
});

test("unmount releases an active pointer once and removes later gesture callbacks", () => {
  vi.useFakeTimers();
  const { onAdvance, onPause, surface, unmount } = renderSurface();
  const releasePointerCapture = vi.fn();
  const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout");
  Object.assign(surface, { releasePointerCapture });

  fireEvent.pointerDown(surface, { clientX: 20, clientY: 160, pointerId: 6, isPrimary: true, button: 0 });
  fireEvent.wheel(surface, { deltaY: 50 });
  expect(onAdvance).toHaveBeenCalledOnce();
  unmount();
  expect(releasePointerCapture).toHaveBeenCalledWith(6);
  expect(onPause.mock.calls).toEqual([[true], [false]]);
  expect(clearTimeoutSpy).toHaveBeenCalled();

  document.dispatchEvent(new Event("visibilitychange"));
  act(() => vi.advanceTimersByTime(400));
  expect(releasePointerCapture).toHaveBeenCalledOnce();
  expect(onPause.mock.calls).toEqual([[true], [false]]);
  expect(onAdvance).toHaveBeenCalledOnce();
});

test("cancelled and horizontal pointer gestures never advance and balance pause", () => {
  const { onAdvance, onPause, surface } = renderSurface();

  fireEvent.pointerDown(surface, { clientX: 20, clientY: 160, pointerId: 1, isPrimary: true, button: 0 });
  fireEvent.pointerCancel(surface, { pointerId: 1 });
  fireEvent.pointerDown(surface, { clientX: 20, clientY: 160, pointerId: 2, isPrimary: true, button: 0 });
  fireEvent.pointerUp(surface, { clientX: 120, clientY: 140, pointerId: 2 });

  expect(onAdvance).not.toHaveBeenCalled();
  expect(onPause.mock.calls).toEqual([[true], [false], [true], [false]]);
});

test("nested controls keep their own pointer, wheel, and keyboard behavior", () => {
  const onAdvance = vi.fn();
  const onPause = vi.fn();
  const onChildClick = vi.fn();
  render(
    <GestureSurface enabled onAdvance={onAdvance} onPause={onPause}>
      <button type="button" onClick={onChildClick}>Inner control</button>
      <input aria-label="Inner input" />
      <div data-gesture-ignore>Ignored region</div>
    </GestureSurface>,
  );
  const surface = screen.getByTestId("gesture-surface");
  const childButton = screen.getByRole("button", { name: "Inner control" });
  const input = screen.getByRole("textbox", { name: "Inner input" });
  const ignored = screen.getByText("Ignored region");
  const setPointerCapture = vi.fn();
  Object.assign(surface, { setPointerCapture });

  const space = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: " " });
  childButton.dispatchEvent(space);
  fireEvent.pointerDown(childButton, { clientX: 20, clientY: 160, pointerId: 3, isPrimary: true, button: 0 });
  fireEvent.wheel(input, { deltaY: 50 });
  fireEvent.wheel(ignored, { deltaY: 50 });
  fireEvent.click(childButton);

  expect(space.defaultPrevented).toBe(false);
  expect(onAdvance).not.toHaveBeenCalled();
  expect(onPause).not.toHaveBeenCalled();
  expect(setPointerCapture).not.toHaveBeenCalled();
  expect(onChildClick).toHaveBeenCalledOnce();
});

test("only the primary owning pointer can complete or cancel a gesture", () => {
  const { onAdvance, onPause, surface } = renderSurface();

  fireEvent.pointerDown(surface, { clientX: 20, clientY: 160, pointerId: 1, isPrimary: true, button: 0 });
  fireEvent.pointerDown(surface, { clientX: 40, clientY: 160, pointerId: 2, isPrimary: true, button: 0 });
  fireEvent.pointerUp(surface, { clientX: 40, clientY: 80, pointerId: 2 });
  fireEvent.pointerCancel(surface, { pointerId: 2 });
  expect(onPause.mock.calls).toEqual([[true]]);
  expect(onAdvance).not.toHaveBeenCalled();

  fireEvent.pointerUp(surface, { clientX: 20, clientY: 80, pointerId: 1 });
  expect(onAdvance).toHaveBeenCalledOnce();
  expect(onPause.mock.calls).toEqual([[true], [false]]);
});

test("non-primary and right-button pointers cannot start a gesture", () => {
  const { onPause, surface } = renderSurface();

  fireEvent.pointerDown(surface, { clientX: 20, clientY: 160, pointerId: 1, isPrimary: false, button: 0 });
  fireEvent.pointerDown(surface, { clientX: 20, clientY: 160, pointerId: 2, isPrimary: true, button: 2 });

  expect(onPause).not.toHaveBeenCalled();
});

test("disabled gestures never advance while pointer pause remains balanced", () => {
  const { onAdvance, onPause, surface } = renderSurface(false);

  fireEvent.pointerDown(surface, { clientX: 20, clientY: 160, pointerId: 4, isPrimary: true, button: 0 });
  fireEvent.pointerUp(surface, { clientX: 20, clientY: 80, pointerId: 4 });
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

test("the focusable surface uses group semantics and safely contains interactive children", () => {
  const { getByTestId, getByRole } = render(
    <GestureSurface enabled onAdvance={vi.fn()} onPause={vi.fn()}>
      <button type="button">Inner control</button>
    </GestureSurface>,
  );
  const surface = getByTestId("gesture-surface");

  expect(surface).toHaveAttribute("role", "group");
  expect(surface).not.toHaveAttribute("role", "button");
  expect(getByRole("button", { name: "Inner control" })).toBeInTheDocument();
});

test("lost pointer capture and window blur cancel the owning gesture without advancing", () => {
  const { onAdvance, onPause, surface } = renderSurface();
  const releasePointerCapture = vi.fn();
  const hasPointerCapture = vi.fn().mockReturnValueOnce(false).mockReturnValueOnce(true);
  Object.assign(surface, { hasPointerCapture, releasePointerCapture });

  fireEvent.pointerDown(surface, { clientX: 20, clientY: 160, pointerId: 7, isPrimary: true, button: 0 });
  fireEvent.lostPointerCapture(surface, { pointerId: 7 });
  fireEvent.pointerDown(surface, { clientX: 20, clientY: 160, pointerId: 8, isPrimary: true, button: 0 });
  window.dispatchEvent(new Event("blur"));

  expect(onAdvance).not.toHaveBeenCalled();
  expect(onPause.mock.calls).toEqual([[true], [false], [true], [false]]);
  expect(releasePointerCapture).toHaveBeenCalledWith(8);
  expect(releasePointerCapture).not.toHaveBeenCalledWith(7);
  expect(hasPointerCapture).toHaveBeenCalledTimes(2);
});

test("visibility and blur clear wheel locks", () => {
  vi.useFakeTimers();
  visibilityStateHadOwnDescriptor = Object.prototype.hasOwnProperty.call(document, "visibilityState");
  visibilityStateDescriptor = Object.getOwnPropertyDescriptor(document, "visibilityState");
  Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
  const { onAdvance, surface } = renderSurface();

  fireEvent.wheel(surface, { deltaY: 50 });
  document.dispatchEvent(new Event("visibilitychange"));
  fireEvent.wheel(surface, { deltaY: 50 });
  window.dispatchEvent(new Event("blur"));
  fireEvent.wheel(surface, { deltaY: 50 });

  expect(onAdvance).toHaveBeenCalledTimes(3);
});

test("visibility cancellation releases an active gesture and unmount clears listeners and wheel timers", () => {
  vi.useFakeTimers();
  visibilityStateHadOwnDescriptor = Object.prototype.hasOwnProperty.call(document, "visibilityState");
  visibilityStateDescriptor = Object.getOwnPropertyDescriptor(document, "visibilityState");
  Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
  const { onAdvance, onPause, surface, unmount } = renderSurface();
  const releasePointerCapture = vi.fn();
  const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout");
  Object.assign(surface, { releasePointerCapture });

  fireEvent.pointerDown(surface, { clientX: 20, clientY: 160, pointerId: 5, isPrimary: true, button: 0 });
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
