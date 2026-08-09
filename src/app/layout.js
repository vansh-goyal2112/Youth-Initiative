import "./globals.css";
import AppProviders from "@/components/common/AppProviders";

export const metadata = {
  title: {
    default: "SAIT Youth Initiative",
    template: "%s | SAIT Youth Initiative",
  },
  description:
    "Explore workshops, build skills, earn achievements, and discover future SAIT pathways.",
  applicationName: "SAIT Youth Initiative",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Youth Initiative",
    statusBarStyle: "default",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#e2232a",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}