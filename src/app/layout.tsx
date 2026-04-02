import type { Metadata } from 'next';
import { Toaster } from 'sonner';
import './globals.css';

export const metadata: Metadata = {
  title: 'ReplyBot — Instagram DM Automation',
  description: 'Auto-reply to Instagram comments with DMs. Set keyword triggers, define response messages, and let the system handle the rest.',
  keywords: 'instagram, dm automation, comment trigger, marketing automation',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            className: 'font-sans',
            style: {
              borderRadius: '12px',
              border: '1px solid rgb(229 231 235)',
              boxShadow: '0 10px 15px -3px rgba(0,0,0,0.06)',
            },
          }}
        />
      </body>
    </html>
  );
}
