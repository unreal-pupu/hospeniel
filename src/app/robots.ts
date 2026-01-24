import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || "https://www.hospeniel.com";

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin/",
          "/api/",
          "/vendor/dashboard/",
          "/vendor/orders/",
          "/vendor/settings/",
          "/vendor/subscription/",
          "/vendor/notifications/",
          "/vendor/service-requests/",
          "/vendor/contact/",
          "/vendor/help/",
          "/vendor/privacy/",
          "/settings/",
          "/orders/",
          "/notifications/",
          "/cart/",
          "/checkout/",
          "/payment/",
          "/payment-success/",
          "/checkout/confirmation/",
          "/reset-password/",
          "/forgot-password/",
          "/loginpage/",
          "/register/",
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}




