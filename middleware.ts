import createIntlMiddleware from "next-intl/middleware";
import { NextRequest, NextResponse } from "next/server";
import { routing } from "./i18n/routing";

const intlMiddleware = createIntlMiddleware(routing);

const PROTECTED = [
  /^\/(en|ka|ru)?\/?(overview|orders|shipments|dispatch|tracking|fleet|drivers|customers|warehouse|invoices|expenses|reports|settings|driver)(\/|$)/,
  /^\/(en|ka|ru)?\/portal\/my(\/|$)/,
];

export default async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isProtected = PROTECTED.some((r) => r.test(pathname));

  if (isProtected) {
    const token = req.cookies.get("authjs.session-token")?.value ??
      req.cookies.get("__Secure-authjs.session-token")?.value;
    if (!token) {
      const url = req.nextUrl.clone();
      const locale = pathname.split("/").filter(Boolean)[0];
      const loc = routing.locales.includes(locale as (typeof routing.locales)[number])
        ? locale
        : routing.defaultLocale;
      url.pathname = `/${loc}/login`;
      url.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(url);
    }
  }

  return intlMiddleware(req);
}

export const config = {
  matcher: ["/((?!api|trpc|_next|_vercel|.*\\..*).*)"],
};
