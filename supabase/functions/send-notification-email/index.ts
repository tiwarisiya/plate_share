// Emails a notification row to its recipient.
//
// Not deployed. To enable:
//   1. Pick a mail provider and add it to PROVIDERS below (one function
//      that sends { to, subject, text }).
//   2. supabase functions deploy send-notification-email --no-verify-jwt
//   3. supabase secrets set NOTIFY_WEBHOOK_SECRET=<random> MAIL_PROVIDER=<name>
//      APP_URL=<https://your-app> plus the provider's API key.
//   4. Dashboard > Database > Webhooks: on INSERT into public.notifications,
//      POST to the function URL with header x-webhook-secret: <same secret>.
// Until MAIL_PROVIDER names a real provider it runs in "log" mode: it
// builds the email, logs it, and marks the row emailed.

import { createClient } from "npm:@supabase/supabase-js@2";

type NotificationRecord = {
  id: string;
  user_id: string;
  kind: "new_response" | "response_accepted" | "listing_claimed" | "new_message" | "pickup_confirmed";
  request_id: string | null;
  body: string;
  emailed_at: string | null;
};

type Email = { to: string; subject: string; text: string };
type Provider = (email: Email) => Promise<void>;

const PROVIDERS: Record<string, Provider> = {
  log: async (email) => {
    console.log(`[send-notification-email] would send to ${email.to}: ${email.subject}\n${email.text}`);
  },
};

// Chat messages within this window of an emailed one for the same
// conversation aren't emailed again.
const CHAT_EMAIL_COOLDOWN_MINUTES = 15;

const SUBJECTS: Record<NotificationRecord["kind"], string> = {
  new_response: "A restaurant responded to your request",
  response_accepted: "Your response was accepted",
  listing_claimed: "A shelter claimed your listing",
  new_message: "New message on Plate Share",
  pickup_confirmed: "Pickup confirmation on Plate Share",
};

function linkFor(appUrl: string, role: string, n: NotificationRecord): string {
  if (!n.request_id) return `${appUrl}/${role}/home`;
  if (n.kind === "new_message") return `${appUrl}/${role}/chat/${n.request_id}`;
  return role === "restaurant" ? `${appUrl}/restaurant/donation/${n.request_id}` : `${appUrl}/shelter/home`;
}

Deno.serve(async (req) => {
  const secret = Deno.env.get("NOTIFY_WEBHOOK_SECRET");
  if (!secret || req.headers.get("x-webhook-secret") !== secret) {
    return new Response("Unauthorized", { status: 401 });
  }

  const payload = await req.json().catch(() => null);
  const record = payload?.record as NotificationRecord | undefined;
  if (payload?.type !== "INSERT" || payload?.table !== "notifications" || !record?.id) {
    return new Response("Ignored", { status: 200 });
  }

  const providerName = Deno.env.get("MAIL_PROVIDER") || "log";
  const send = PROVIDERS[providerName];
  if (!send) return new Response(`Unknown MAIL_PROVIDER ${providerName}`, { status: 500 });

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });

  const { data: profile } = await supabase
    .from("profiles")
    .select("email, role, name, email_notifications")
    .eq("id", record.user_id)
    .single();

  if (!profile?.email || !profile.email_notifications) {
    return new Response("Recipient opted out or has no email", { status: 200 });
  }

  if (record.kind === "new_message" && record.request_id) {
    const since = new Date(Date.now() - CHAT_EMAIL_COOLDOWN_MINUTES * 60_000).toISOString();
    const { count } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", record.user_id)
      .eq("request_id", record.request_id)
      .eq("kind", "new_message")
      .gte("emailed_at", since);
    if ((count || 0) > 0) return new Response("Chat email cooldown", { status: 200 });
  }

  const appUrl = Deno.env.get("APP_URL") || "http://localhost:3000";
  await send({
    to: profile.email,
    subject: SUBJECTS[record.kind],
    text: [
      `Hi ${profile.name || "there"},`,
      "",
      record.body,
      "",
      `Open Plate Share: ${linkFor(appUrl, profile.role, record)}`,
      "",
      "You can turn off these emails in Settings.",
    ].join("\n"),
  });

  await supabase.from("notifications").update({ emailed_at: new Date().toISOString() }).eq("id", record.id);
  return new Response("Sent", { status: 200 });
});
