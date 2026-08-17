import { render, screen } from "@testing-library/react";
import { EchoExperience } from "../components/experience/EchoExperience";

test("renders a persistent visual layer, current scene, progress, and sound control", () => {
  render(<EchoExperience />);
  expect(screen.getByLabelText("0523 回音星核动态视觉")).toBeInTheDocument();
  expect(screen.getByText("01 / 08")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "开启声音" })).toBeInTheDocument();
  expect(screen.getByText("只有小宝贝能进入")).toBeInTheDocument();
});
