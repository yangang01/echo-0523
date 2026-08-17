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

test("renders only an empty placeholder when there is no active fragment", () => {
  const { container } = render(
    <EchoTranscript fragments={fragments} unlocked={["one"]} activeId={null} onSelect={() => {}} />,
  );

  expect(container).toHaveTextContent("");
  expect(container.firstElementChild).toHaveClass("echo-transcript", "echo-transcript-empty");
  expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
  expect(screen.queryByLabelText("已解锁回音")).not.toBeInTheDocument();
});

test("disables locked markers without selecting them", () => {
  const onSelect = vi.fn();
  render(<EchoTranscript fragments={fragments} unlocked={["one"]} activeId="one" onSelect={onSelect} />);
  const lockedMarker = screen.getByRole("button", { name: "第 3 段尚未解锁" });

  expect(lockedMarker).toBeDisabled();
  fireEvent.click(lockedMarker);
  expect(onSelect).not.toHaveBeenCalled();
});
