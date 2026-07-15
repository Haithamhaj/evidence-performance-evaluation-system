export default function LocaleLayout() {
  const children = arguments[0]?.children;

  return (
    <html lang="ar" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
