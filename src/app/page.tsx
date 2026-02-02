import { Suspense } from "react";
import dynamic from "next/dynamic";
import Hero from "../components/Hero";
import ProductsShowcase from "@/components/ProductsShowcase";
import { getLandingPageMetadata } from "@/lib/seo";
import Script from "next/script";
import { generateWebsiteSchema, generateOrganizationSchema } from "@/lib/seo";

// Dynamic imports for below-the-fold components with code splitting
const HowItWorks = dynamic(() => import("@/components/HowItWorks"), {
  loading: () => <div className="min-h-[400px] bg-hospineil-base-bg" />,
});

const VendorShowcase = dynamic(() => import("@/components/VendorShowcase"), {
  loading: () => <div className="min-h-[400px] bg-hospineil-light-bg" />,
});

const HomeCookChefPromo = dynamic(() => import("@/components/HomeCookChefPromo"), {
  loading: () => <div className="min-h-[200px] bg-gradient-to-r from-hospineil-primary to-hospineil-accent" />,
});

// const Pricing = dynamic(() => import("@/components/Pricing"), {
//   loading: () => <div className="min-h-[600px] bg-hospineil-base-bg" />,
// });

const VendorSection = dynamic(() => import("@/components/VendorSection"), {
  loading: () => <div className="min-h-[400px] bg-hospineil-base-bg" />,
});

const CustomerReviews = dynamic(() => import("@/components/CustomerReviews"), {
  loading: () => <div className="min-h-[400px] bg-hospineil-light-bg" />,
});

const JoinUsSection = dynamic(() => import("@/components/JoinUsSection"), {
  loading: () => <div className="min-h-[300px] bg-hospineil-base-bg" />,
});

const FAQ = dynamic(() => import("@/components/FAQ"), {
  loading: () => <div className="min-h-[400px] bg-hospineil-base-bg" />,
});

export const metadata = getLandingPageMetadata();

export default function Home() {
  const structuredData = [generateWebsiteSchema(), generateOrganizationSchema()];
  
  return (
   <>
   {/* Structured Data for SEO - Organization and Website schemas */}
   {structuredData.map((data, index) => (
     <Script
       key={index}
       id={`structured-data-${index}`}
       type="application/ld+json"
       dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
     />
   ))}
   <Hero/>
   <Suspense fallback={<div className="min-h-[600px] bg-hospineil-base-bg" />}>
     <ProductsShowcase/>
   </Suspense>
   <Suspense fallback={<div className="min-h-[400px] bg-hospineil-base-bg" />}>
     <HowItWorks/>
   </Suspense>
   <Suspense fallback={<div className="min-h-[200px] bg-gradient-to-r from-hospineil-primary to-hospineil-accent" />}>
     <HomeCookChefPromo/>
   </Suspense>
   <Suspense fallback={<div className="min-h-[400px] bg-hospineil-light-bg" />}>
     <VendorShowcase/>
   </Suspense>
   <Suspense fallback={<div className="min-h-[400px] bg-hospineil-base-bg" />}>
     <VendorSection/>
   </Suspense>
  {/* <Suspense fallback={<div className="min-h-[600px] bg-hospineil-base-bg" />}>
    <Pricing/>
  </Suspense> */}
   <Suspense fallback={<div className="min-h-[400px] bg-hospineil-light-bg" />}>
     <CustomerReviews/>
   </Suspense>
   <Suspense fallback={<div className="min-h-[300px] bg-hospineil-base-bg" />}>
     <JoinUsSection/>
   </Suspense>
   <Suspense fallback={<div className="min-h-[400px] bg-hospineil-base-bg" />}>
     <FAQ/>
   </Suspense>
   </>
  );
}
