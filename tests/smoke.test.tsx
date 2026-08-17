import { render, screen } from "@testing-library/react";
import Page from "../app/page";

test("renders the 0523 experience entry instead of the starter preview", () => {
  render(<Page />);
  expect(screen.getByRole("main", { name: "0523 回音星核" })).toBeInTheDocument();
  expect(screen.queryByText(/Your site is taking shape/i)).not.toBeInTheDocument();
});
