import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Ideas & Bugs | Cluebase',
  description: 'Share feature requests, report bugs, and suggest improvements',
};

export default function PlatformFeedbackLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
