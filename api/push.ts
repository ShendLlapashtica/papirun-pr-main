import webpush from 'web-push';
import type { VercelRequest, VercelResponse } from '@vercel/node';

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT!,
  process.env.VITE_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  const { subscription, title, body, orderId } = req.body ?? {};
  if (!subscription) return res.status(400).json({ error: 'missing subscription' });
  try {
    await webpush.sendNotification(
      subscription,
      JSON.stringify({ title: title ?? 'Porosi e re!', body: body ?? '', orderId })
    );
    return res.status(200).json({ ok: true });
  } catch (err: any) {
    return res.status(err.statusCode ?? 500).json({ error: err.message });
  }
}
