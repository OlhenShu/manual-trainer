import type { AdminStats } from "@manual-trainer/shared";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { StudentRoster } from "@/components/StudentRoster";

type Student = AdminStats["students"][number];

function student(overrides: Partial<Student> & Pick<Student, "id" | "email">): Student {
  return {
    attempts: 0,
    averageScore: null,
    averageFirstScore: null,
    successRate: null,
    passedScenarios: 0,
    emailVerified: false,
    role: "user",
    reviewCredits: 0,
    scenarios: [],
    ...overrides,
  };
}

const students = [
  student({
    id: "11111111-1111-4111-8111-111111111111",
    email: "zoya@test.example",
    attempts: 4,
    averageScore: 40,
    averageFirstScore: 20,
    successRate: 0,
    passedScenarios: 0,
    scenarios: [
      {
        scenarioId: "22222222-2222-4222-8222-222222222222",
        title: "Оформлення",
        attempts: 4,
        firstScore: 20,
        bestScore: 40,
        passed: false,
      },
    ],
  }),
  student({
    id: "33333333-3333-4333-8333-333333333333",
    email: "anna@test.example",
    attempts: 1,
    averageScore: 90,
    averageFirstScore: 90,
    successRate: 100,
    passedScenarios: 1,
    scenarios: [
      {
        scenarioId: "44444444-4444-4444-8444-444444444444",
        title: "Сповіщення",
        attempts: 1,
        firstScore: 90,
        bestScore: 90,
        passed: true,
      },
    ],
  }),
  student({
    id: "55555555-5555-4555-8555-555555555555",
    email: "idle@test.example",
  }),
];

function emails() {
  return within(screen.getByRole("list", { name: "Студенти" })).getAllByText(/@test\.example/).map((item) => item.textContent);
}

describe("StudentRoster", () => {
  it("searches by email and scenario title, then filters and sorts", async () => {
    const user = userEvent.setup();
    render(
      <StudentRoster
        students={students}
        onDelete={async () => undefined}
        onRoleChange={async () => undefined}
        onAddReviews={async () => undefined}
      />,
    );

    expect(emails()).toEqual(["zoya@test.example", "anna@test.example", "idle@test.example"]);

    await user.type(screen.getByLabelText("Пошук"), "оформ");
    expect(screen.getByText("zoya@test.example")).toBeInTheDocument();
    expect(screen.queryByText("anna@test.example")).not.toBeInTheDocument();

    await user.clear(screen.getByLabelText("Пошук"));
    await user.click(screen.getByRole("button", { name: "Без спроб" }));
    expect(screen.getByText("idle@test.example")).toBeInTheDocument();
    expect(screen.queryByText("zoya@test.example")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Ще не зараховано" }));
    expect(screen.getByText("zoya@test.example")).toBeInTheDocument();
    expect(screen.queryByText("anna@test.example")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Усі" }));
    await user.selectOptions(screen.getByLabelText("Сортування"), "email");
    expect(emails()).toEqual(["anna@test.example", "idle@test.example", "zoya@test.example"]);

    await user.selectOptions(screen.getByLabelText("Сортування"), "average");
    expect(emails()[0]).toBe("anna@test.example");
    expect(emails().at(-1)).toBe("idle@test.example");

    await user.type(screen.getByLabelText("Пошук"), "немає");
    expect(screen.getByText("Нікого не знайдено.")).toBeInTheDocument();
  });
});
