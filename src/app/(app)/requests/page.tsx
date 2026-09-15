import { redirect } from "next/navigation";

/** Requests now live on the Search tab. */
export default function RequestsRedirect() {
  redirect("/search");
}
