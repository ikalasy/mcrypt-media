import { redirect } from "next/navigation";

/** Status moved into the admin Server panel. */
export default function StatusRedirect() {
  redirect("/settings/server");
}
