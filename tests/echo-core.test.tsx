import { render } from "@testing-library/react";
import { EchoCoreCanvas } from "../components/experience/EchoCoreCanvas";

test("exposes one persistent labelled canvas", () => {
  const { rerender } = render(<EchoCoreCanvas scene="wake" growth={{ filaments: 0, petals: 0, currents: 0 }} finaleOpen={false} />);
  const canvas = document.querySelector('canvas[aria-label="0523 回音星核动态视觉"]');
  expect(canvas).toBeInTheDocument();
  expect(canvas).toHaveAttribute("data-sculpture", "wake");
  rerender(<EchoCoreCanvas scene="signal" growth={{ filaments: 1, petals: 1, currents: 1 }} finaleOpen={false} />);
  expect(document.querySelectorAll("canvas")).toHaveLength(1);
  expect(canvas).toHaveAttribute("data-sculpture", "signal");
});

test("keeps the finale sculpture dormant until the final echo opens", () => {
  const growth = { filaments: 1, petals: 1, currents: 1 };
  const { rerender } = render(<EchoCoreCanvas scene="finale" growth={growth} finaleOpen={false} />);
  const canvas = document.querySelector('canvas[aria-label="0523 回音星核动态视觉"]');

  expect(canvas).toHaveAttribute("data-sculpture", "wake");
  rerender(<EchoCoreCanvas scene="finale" growth={growth} finaleOpen />);
  expect(canvas).toHaveAttribute("data-sculpture", "finale");
});
