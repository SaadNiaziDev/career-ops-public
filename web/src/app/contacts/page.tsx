import { readContacts } from "@/lib/contacts";
import { pipelineSummary } from "@/lib/career-ops";
import { ContactsView } from "@/components/contacts/contacts-view";

export const dynamic = "force-dynamic";

export default function ContactsPage() {
  const contacts = readContacts();
  const { applications } = pipelineSummary();
  return <ContactsView initial={contacts} applications={applications} />;
}
