import { fireEvent, render, screen } from "@testing-library/react";
import { EchoTranscript } from "../components/experience/EchoTranscript";

const fragments = [
  { id: "one", text: "第一段回音" },
  { id: "two", text: "第二段回音" },
  { id: "three", text: "第三段回音" },
];

function pointer(target: Element | Document | Window, type: string, init: { pointerId: number; isPrimary?: boolean; button?: number; clientX?: number; clientY?: number }) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperties(event, {
    pointerId: { value: init.pointerId },
    button: { value: init.button ?? 0 },
    isPrimary: { value: init.isPrimary ?? true },
    clientX: { value: init.clientX ?? 0 },
    clientY: { value: init.clientY ?? 0 },
  });
  fireEvent(target, event);
}

test("shows only the active unlocked fragment and supports review", () => {
  const onSelect = vi.fn();
  render(<EchoTranscript fragments={fragments} unlocked={["one", "two"]} activeId="two" onSelect={onSelect} />);

  expect(screen.queryByText("第一段回音")).not.toBeInTheDocument();
  expect(screen.getByText("第二段回音")).toBeInTheDocument();
  expect(screen.queryByText("第三段回音")).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "回看第 1 段" }));
  expect(onSelect).toHaveBeenCalledWith("one");
});

test("swipes and arrow keys reveal one fragment at a time, review backward, and complete once at the end", () => {
  const onSelect = vi.fn();
  const onReveal = vi.fn();
  const onComplete = vi.fn();
  const view = render(
    <EchoTranscript fragments={fragments} unlocked={["one"]} activeId="one" onSelect={onSelect} onReveal={onReveal} onComplete={onComplete} />,
  );
  const status = screen.getByLabelText("回音正文，左右方向键切换");

  pointer(status, "pointerdown", { pointerId: 4, clientX: 260, clientY: 300 });
  pointer(status, "pointerup", { pointerId: 4, clientX: 120, clientY: 306 });
  expect(onReveal).toHaveBeenCalledWith("two");
  expect(onComplete).not.toHaveBeenCalled();

  view.rerender(
    <EchoTranscript fragments={fragments} unlocked={["one", "two"]} activeId="two" onSelect={onSelect} onReveal={onReveal} onComplete={onComplete} />,
  );
  fireEvent.keyDown(screen.getByLabelText("回音正文，左右方向键切换"), { key: "ArrowLeft" });
  expect(onSelect).toHaveBeenCalledWith("one");
  fireEvent.keyDown(screen.getByLabelText("回音正文，左右方向键切换"), { key: "ArrowRight" });
  expect(onReveal).toHaveBeenLastCalledWith("three");
  expect(onComplete).toHaveBeenCalledOnce();

  view.rerender(
    <EchoTranscript fragments={fragments} unlocked={["one", "two", "three"]} activeId="three" onSelect={onSelect} onReveal={onReveal} onComplete={onComplete} />,
  );
  fireEvent.keyDown(screen.getByLabelText("回音正文，左右方向键切换"), { key: "ArrowRight" });
  expect(onReveal).toHaveBeenCalledTimes(2);
  expect(onComplete).toHaveBeenCalledOnce();
});

test("ignores vertical and short gestures inside the transcript", () => {
  const onSelect = vi.fn();
  const onReveal = vi.fn();
  render(<EchoTranscript fragments={fragments} unlocked={["one"]} activeId="one" onSelect={onSelect} onReveal={onReveal} onComplete={() => {}} />);
  const status = screen.getByLabelText("回音正文，左右方向键切换");

  pointer(status, "pointerdown", { pointerId: 10, clientX: 220, clientY: 300 });
  pointer(status, "pointerup", { pointerId: 10, clientX: 210, clientY: 210 });
  pointer(status, "pointerdown", { pointerId: 11, clientX: 220, clientY: 300 });
  pointer(status, "pointerup", { pointerId: 11, clientX: 190, clientY: 302 });

  expect(onSelect).not.toHaveBeenCalled();
  expect(onReveal).not.toHaveBeenCalled();
});

test("announces the active fragment politely", () => {
  render(<EchoTranscript fragments={fragments} unlocked={["one"]} activeId="one" onSelect={() => {}} />);

  expect(screen.getByLabelText("回音正文，左右方向键切换")).toHaveAttribute("aria-live", "polite");
});

test("keeps an atomic live region mounted while active copy changes", () => {
  const { rerender } = render(
    <EchoTranscript fragments={fragments} unlocked={["one", "two"]} activeId="one" onSelect={() => {}} />,
  );
  const status = screen.getByLabelText("回音正文，左右方向键切换");

  rerender(
    <EchoTranscript fragments={fragments} unlocked={["one", "two"]} activeId="two" onSelect={() => {}} />,
  );

  expect(screen.getByLabelText("回音正文，左右方向键切换")).toBe(status);
  expect(status).toHaveTextContent("第二段回音");
  expect(status).toHaveAttribute("aria-atomic", "true");
});

test("mounts the live region while empty so the first fragment can be announced", () => {
  const { rerender } = render(
    <EchoTranscript fragments={fragments} unlocked={[]} activeId={null} onSelect={() => {}} />,
  );
  const status = screen.getByLabelText("回音正文，左右方向键切换");

  expect(status).toBeEmptyDOMElement();

  rerender(<EchoTranscript fragments={fragments} unlocked={["one"]} activeId="one" onSelect={() => {}} />);

  expect(screen.getByLabelText("回音正文，左右方向键切换")).toBe(status);
  expect(status).toHaveTextContent("第一段回音");
});

test("remounts only the keyed reveal layer when the active fragment changes", () => {
  const { container, rerender } = render(
    <EchoTranscript fragments={fragments} unlocked={["one", "two"]} activeId="one" onSelect={() => {}} />,
  );
  const status = screen.getByLabelText("回音正文，左右方向键切换");
  const firstReveal = container.querySelector(".echo-transcript-reveal");

  rerender(
    <EchoTranscript fragments={fragments} unlocked={["one", "two"]} activeId="two" onSelect={() => {}} />,
  );

  expect(screen.getByLabelText("回音正文，左右方向键切换")).toBe(status);
  expect(container.querySelector(".echo-transcript-reveal")).not.toBe(firstReveal);
  expect(status).toHaveTextContent("第二段回音");
});

test("renders a collapsed empty shell with no markers when there is no active fragment", () => {
  const { container } = render(
    <EchoTranscript fragments={fragments} unlocked={["one"]} activeId={null} onSelect={() => {}} />,
  );

  expect(container).toHaveTextContent("");
  expect(container.firstElementChild).toHaveClass("echo-transcript", "echo-transcript-empty");
  expect(container.firstElementChild).not.toHaveAttribute("aria-hidden");
  expect(screen.getByLabelText("回音正文，左右方向键切换")).toBeEmptyDOMElement();
  expect(screen.queryByRole("group", { name: "回音片段" })).not.toBeInTheDocument();
});

test("hides a locked fragment even when it is marked active", () => {
  const { container } = render(
    <EchoTranscript fragments={fragments} unlocked={["one"]} activeId="three" onSelect={() => {}} />,
  );

  expect(screen.queryByText("第三段回音")).not.toBeInTheDocument();
  expect(container.firstElementChild).toHaveClass("echo-transcript-empty");
  expect(screen.queryByRole("group", { name: "回音片段" })).not.toBeInTheDocument();
});

test("disables locked markers without selecting them", () => {
  const onSelect = vi.fn();
  render(<EchoTranscript fragments={fragments} unlocked={["one"]} activeId="one" onSelect={onSelect} />);
  const lockedMarker = screen.getByRole("button", { name: "第 3 段尚未解锁" });

  expect(lockedMarker).toBeDisabled();
  fireEvent.click(lockedMarker);
  expect(onSelect).not.toHaveBeenCalled();
});

test("labels the marker group and exposes the current fragment", () => {
  render(<EchoTranscript fragments={fragments} unlocked={["one", "two"]} activeId="two" onSelect={() => {}} />);

  expect(screen.getByRole("group", { name: "回音片段" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "回看第 2 段" })).toHaveAttribute("aria-current", "true");
  expect(screen.getByRole("button", { name: "回看第 1 段" })).not.toHaveAttribute("aria-current");
});

test("reports pointer reading while keeping the stable live region mounted", () => {
  const onReadingChange = vi.fn();
  const { rerender } = render(
    <EchoTranscript fragments={fragments} unlocked={["one", "two"]} activeId="one" onSelect={() => {}} onReadingChange={onReadingChange} />,
  );
  const status = screen.getByLabelText("回音正文，左右方向键切换");

  pointer(status, "pointerdown", { pointerId: 4 });
  expect(onReadingChange).toHaveBeenLastCalledWith(true);
  rerender(
    <EchoTranscript fragments={fragments} unlocked={["one", "two"]} activeId="two" onSelect={() => {}} onReadingChange={onReadingChange} />,
  );
  expect(screen.getByLabelText("回音正文，左右方向键切换")).toBe(status);
  pointer(status, "pointerup", { pointerId: 4 });
  expect(onReadingChange).toHaveBeenLastCalledWith(false);
});

test("pauses across marker focus changes and resumes only when focus leaves the transcript", () => {
  const onReadingChange = vi.fn();
  render(
    <EchoTranscript fragments={fragments} unlocked={["one", "two"]} activeId="two" onSelect={() => {}} onReadingChange={onReadingChange} />,
  );
  const first = screen.getByRole("button", { name: "回看第 1 段" });
  const second = screen.getByRole("button", { name: "回看第 2 段" });

  fireEvent.focus(first);
  expect(onReadingChange).toHaveBeenLastCalledWith(true);
  fireEvent.blur(first, { relatedTarget: second });
  expect(onReadingChange).toHaveBeenCalledTimes(1);
  fireEvent.focus(second, { relatedTarget: first });
  fireEvent.blur(second, { relatedTarget: document.body });
  expect(onReadingChange).toHaveBeenLastCalledWith(false);
});

test("owns one primary review pointer and balances release outside the live region", () => {
  const onReadingChange = vi.fn();
  render(
    <EchoTranscript fragments={fragments} unlocked={["one"]} activeId="one" onSelect={() => {}} onReadingChange={onReadingChange} />,
  );
  const status = screen.getByLabelText("回音正文，左右方向键切换");
  const release = vi.fn();
  Object.assign(status, { setPointerCapture: vi.fn(), hasPointerCapture: () => true, releasePointerCapture: release });

  pointer(status, "pointerdown", { pointerId: 7 });
  pointer(status, "pointerdown", { pointerId: 8 });
  pointer(window, "pointerup", { pointerId: 8 });
  expect(onReadingChange.mock.calls).toEqual([[true]]);
  pointer(window, "pointerup", { pointerId: 7 });
  expect(onReadingChange.mock.calls).toEqual([[true], [false]]);
  expect(release).toHaveBeenCalledWith(7);
});

test("balances pointer cancellation, lost capture, and window blur without duplicate resumes", () => {
  const onReadingChange = vi.fn();
  render(
    <EchoTranscript fragments={fragments} unlocked={["one"]} activeId="one" onSelect={() => {}} onReadingChange={onReadingChange} />,
  );
  const status = screen.getByLabelText("回音正文，左右方向键切换");

  pointer(status, "pointerdown", { pointerId: 1 });
  pointer(status, "lostpointercapture", { pointerId: 1 });
  pointer(window, "pointerup", { pointerId: 1 });
  pointer(status, "pointerdown", { pointerId: 2 });
  pointer(window, "pointercancel", { pointerId: 2 });
  fireEvent(window, new Event("blur"));
  pointer(status, "pointerdown", { pointerId: 3 });
  fireEvent(window, new Event("blur"));

  expect(onReadingChange.mock.calls).toEqual([[true], [false], [true], [false], [true], [false]]);
});

test("unmount releases an owned review pointer and resumes exactly once", () => {
  const onReadingChange = vi.fn();
  const view = render(
    <EchoTranscript fragments={fragments} unlocked={["one"]} activeId="one" onSelect={() => {}} onReadingChange={onReadingChange} />,
  );
  pointer(screen.getByLabelText("回音正文，左右方向键切换"), "pointerdown", { pointerId: 3 });
  view.unmount();
  expect(onReadingChange.mock.calls).toEqual([[true], [false]]);
});

test("page hiding clears owned pointer and focus review sources", () => {
  const onReadingChange = vi.fn();
  render(
    <EchoTranscript fragments={fragments} unlocked={["one"]} activeId="one" onSelect={() => {}} onReadingChange={onReadingChange} />,
  );
  const status = screen.getByLabelText("回音正文，左右方向键切换");
  pointer(status, "pointerdown", { pointerId: 9 });
  const descriptor = Object.getOwnPropertyDescriptor(document, "visibilityState");
  try {
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
    fireEvent(document, new Event("visibilitychange"));
    expect(onReadingChange.mock.calls).toEqual([[true], [false]]);
  } finally {
    if (descriptor) Object.defineProperty(document, "visibilityState", descriptor);
    else delete (document as { visibilityState?: DocumentVisibilityState }).visibilityState;
  }
});

test("focus and pointer review sources overlap without clearing each other", () => {
  const onReadingChange = vi.fn();
  render(
    <EchoTranscript fragments={fragments} unlocked={["one", "two"]} activeId="two" onSelect={() => {}} onReadingChange={onReadingChange} />,
  );
  const marker = screen.getByRole("button", { name: "回看第 1 段" });
  const status = screen.getByLabelText("回音正文，左右方向键切换");

  fireEvent.focus(marker);
  pointer(status, "pointerdown", { pointerId: 5 });
  pointer(window, "pointerup", { pointerId: 5 });
  expect(onReadingChange.mock.calls).toEqual([[true]]);
  fireEvent.blur(marker, { relatedTarget: document.body });
  expect(onReadingChange.mock.calls).toEqual([[true], [false]]);
});

test("ignores non-primary review pointers", () => {
  const onReadingChange = vi.fn();
  render(
    <EchoTranscript fragments={fragments} unlocked={["one"]} activeId="one" onSelect={() => {}} onReadingChange={onReadingChange} />,
  );
  pointer(screen.getByLabelText("回音正文，左右方向键切换"), "pointerdown", { pointerId: 4, isPrimary: false });
  expect(onReadingChange).not.toHaveBeenCalled();
});
