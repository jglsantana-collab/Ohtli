import webpush from 'web-push';
import { sql } from './db.js';

const configured = !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);

if (configured) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:contacto@ohtli.app',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

export const pushConfigured = configured;

export async function sendPushToUser(userId, payload) {
  if (!configured) return;
  const subs = await sql`SELECT * FROM push_subscriptions WHERE user_id = ${userId}`;
  await Promise.all(subs.map(async (sub) => {
    const subscription = { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } };
    try {
      await webpush.sendNotification(subscription, JSON.stringify(payload));
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 410) {
        await sql`DELETE FROM push_subscriptions WHERE id = ${sub.id}`;
      }
    }
  }));
}

export async function sendPushToTripMembers(tripId, payload) {
  const members = await sql`SELECT user_id FROM trip_members WHERE trip_id = ${tripId}`;
  await Promise.all(members.map((m) => sendPushToUser(m.user_id, payload)));
}
