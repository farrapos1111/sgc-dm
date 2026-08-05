import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/_shell/regional/estados")({
  beforeLoad: () => {
    throw redirect({ to: "/regional" });
  },
  component: () => null,
  head: () => ({
    meta: [{ title: "Estados — SG-CDM" }],
  }),
});
