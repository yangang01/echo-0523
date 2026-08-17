import { render } from "@testing-library/react";
import { EchoCoreCanvas } from "../components/experience/EchoCoreCanvas";

test("exposes one persistent labelled canvas", () => {
  const { rerender } = render(<EchoCoreCanvas scene="wake" growth={{ filaments: 0, petals: 0, currents: 0 }} />);
  const canvas = document.querySelector('canvas[aria-label="0523 回音星核动态视觉"]');
  expect(canvas).toBeInTheDocument();
  expect(canvas).toHaveAttribute("data-sculpture", "wake");
  rerender(<EchoCoreCanvas scene="signal" growth={{ filaments: 1, petals: 1, currents: 1 }} />);
  expect(document.querySelectorAll("canvas")).toHaveLength(1);
  expect(canvas).toHaveAttribute("data-sculpture", "signal");
});
