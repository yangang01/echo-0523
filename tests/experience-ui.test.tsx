import { fireEvent, render, screen } from "@testing-library/react";
import { EchoExperience } from "../components/experience/EchoExperience";

test("renders a persistent visual layer, current scene, progress, and sound control", () => {
  render(<EchoExperience />);
  expect(screen.getByLabelText("0523 回音星核动态视觉")).toBeInTheDocument();
  expect(screen.getByText("01 / 08")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "开启声音" })).toBeInTheDocument();
  expect(screen.getByText("只有小宝贝能进入")).toBeInTheDocument();
  expect(document.querySelector(".cinematic-plate")).toBeInTheDocument();
});

test("reveals the first wake echo inside the experience shell", () => {
  render(<EchoExperience />);

  fireEvent.click(screen.getByRole("button", { name: "长按唤醒宇宙" }));

  expect(screen.getByRole("status")).toHaveTextContent("这片宇宙原本安静得没有方向");
  expect(screen.getByRole("button", { name: "回看第 1 段" })).toHaveAttribute("aria-current", "true");
  expect(screen.getByLabelText("0523 回音星核动态视觉")).toBeInTheDocument();
  expect(screen.getByText("01 / 08")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "开启声音" })).toBeInTheDocument();
});
