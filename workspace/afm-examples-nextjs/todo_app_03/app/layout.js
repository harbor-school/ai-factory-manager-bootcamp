import './globals.css';

export const metadata = {
  title: 'Todo App',
  description: '미니멀 할 일 관리',
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body className="bg-gray-50 min-h-screen">{children}</body>
    </html>
  );
}
