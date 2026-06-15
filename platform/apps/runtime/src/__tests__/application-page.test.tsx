import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ApplicationPage from "../pages/application-page";
import registerRuntime from "../registry-bridge";

beforeAll(() => {
  registerRuntime();
});

test("application page renders loading then content", async () => {
  const fakePkg = {
    id: "app1",
    tenant_id: "t1",
    name: "App1",
    status: "draft",
    screens: [
      {
        id: "s1",
        application_id: "app1",
        name: "Screen1",
        display_order: 1,
        layout_type: "grid",
        controls: [],
      },
    ],
    created_on: new Date(),
  };
  const original = global.fetch;
  // @ts-ignore
  global.fetch = jest.fn(() =>
    Promise.resolve({ json: () => Promise.resolve({ data: fakePkg }) }),
  );
  render(
    <MemoryRouter initialEntries={["/apps/app1"]}>
      <ApplicationPage />
    </MemoryRouter>,
  );
  expect(screen.getByText(/Loading/i)).toBeDefined();
  // cleanup
  // @ts-ignore
  global.fetch = original;
});
