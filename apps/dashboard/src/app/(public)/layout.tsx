import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'TeamBrain AI - AI-Powered Knowledge Assistant for Teams',
  description: 'Transform your team\'s knowledge into instant answers. Connect Google Drive, Slack, and websites to create an AI assistant that knows your business.',
  keywords: ['AI assistant', 'knowledge management', 'Slack bot', 'team productivity', 'RAG', 'enterprise AI'],
  openGraph: {
    title: 'TeamBrain AI - AI-Powered Knowledge Assistant',
    description: 'Transform your team\'s knowledge into instant answers.',
    type: 'website',
  },
};

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      {children}
    </div>
  );
}
