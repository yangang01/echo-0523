import { fireEvent, render, screen } from "@testing-library/react";
import { EchoTranscript } from "../components/experience/EchoTranscript";

const fragments = [
  { id: "one", text: "第一段回音" },
  { id: "two", text: "第二段回音" },
  { id: "three", text: "第三段回音" },
];

test("shows only the active unlocked fragment and supports review", () => {
  const onSelect = vi.fn();
  render(<EchoTranscript fragments={fragments} unlocked={["one", "two"]} activeId="two" onSelect={onSelect} />);

  expect(screen.queryByText("第一段回音")).not.toBeInTheDocument();
  expect(screen.getByText("第二段回音")).toBeInTheDocument();
  expect(screen.queryByText("第三段回音")).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "回看第 1 段" }));
  expect(onSelect).toHaveBeenCalledWith("one");
});

test("announces the active fragment politely", () => {
  render(<EchoTranscript fragments={fragments} unlocked={["one"]} activeId="one" onSelect={() => {}} />);

  expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");
});

test("keeps an atomic live region mounted while active copy changes", () => {
  const { rerender } = render(
    <EchoTranscript fragments={fragments} unlocked={["one", "two"]} activeId="one" onSelect={() => {}} />,
  );
  const status = screen.getByRole("status");

  rerender(
    <EchoTranscript fragments={fragments} unlocked={["one", "two"]} activeId="two" onSelect={() => {}} />,
  );

  expect(screen.getByRole("status")).toBe(status);
  expect(status).toHaveTextContent("第二段回音");
  expect(status).toHaveAttribute("aria-atomic", "true");
});

test("mounts the live region while empty so the first fragment can be announced", () => {
  const { rerender } = render(
    <EchoTranscript fragments={fragments} unlocked={[]} activeId={null} onSelect={() => {}} />,
  );
  const status = screen.getByRole("status");

  expect(status).toBeEmptyDOMElement();

  rerender(<EchoTranscript fragments={fragments} unlocked={["one"]} activeId="one" onSelect={() => {}} />);

  expect(screen.getByRole("status")).toBe(status);
  expect(status).toHaveTextContent("第一段回音");
});

test("remounts only the keyed reveal layer when the active fragment changes", () => {
  const { container, rerender } = render(
    <EchoTranscript fragments={fragments} unlocked={["one", "two"]} activeId="one" onSelect={() => {}} />,
  );
  const status = screen.getByRole("status");
  const firstReveal = container.querySelector(".echo-transcript-reveal");

  rerender(
    <EchoTranscript fragments={fragments} unlocked={["one", "two"]} activeId="two" onSelect={() => {}} />,
  );

  expect(screen.getByRole("status")).toBe(status);
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
  expect(screen.getByRole("status")).toBeEmptyDOMElement();
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
  const status = screen.getByRole("status");

  fireEvent.pointerDown(status, { pointerId: 4 });
  expect(onReadingChange).toHaveBeenLastCalledWith(true);
  rerender(
    <EchoTranscript fragments={fragments} unlocked={["one", "two"]} activeId="two" onSelect={() => {}} onReadingChange={onReadingChange} />,
  );
  expect(screen.getByRole("status")).toBe(status);
  fireEvent.pointerUp(status, { pointerId: 4 });
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
