/*
  The root path is just a doorway. A signed in operator goes to their dashboard;
  a signed out visitor never reaches here because the proxy redirects them to
  /login first.
*/
import { redirect } from "next/navigation";

export default function Home() {
  redirect("/send");
}
