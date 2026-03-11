import "./globals.css";
import ToasterProvider from "./components/ToasterProvider";

export const metadata = {
  title: "Brilworks Voice Agents",
  description: "AI-powered voice agents for multiple industries",
  referrer: "no-referrer-when-downgrade",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {children}
        <ToasterProvider />
      </body>
    </html>
  );
}
