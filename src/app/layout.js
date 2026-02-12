import './globals.css'

export const metadata = {
  title: 'Brilworks Voice Agents',
  description: 'AI-powered voice agents for multiple industries',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
