import { readContacts } from "@/lib/contacts";
import { ContactsView } from "@/components/contacts/contacts-view";

export const dynamic = "force-dynamic";

export default function ContactsPage() {
  const contacts = readContacts();
  return <ContactsView initial={contacts} />;
}
