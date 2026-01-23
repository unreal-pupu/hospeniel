"use client";

import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function PrivacyPolicyPage() {
  return (
    <section className="min-h-screen bg-gray-50 px-6 md:px-16 py-20 text-gray-800">
      {/* Header */}
      <div className="max-w-4xl mx-auto text-center mb-12">
        <h1 className="text-4xl font-bold text-indigo-700 mb-4">
          Hospeniel Privacy Policy
        </h1>
        <p className="text-gray-600 text-lg">
          Last updated: <span className="font-medium">October 9, 2025</span>
        </p>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto space-y-10 leading-relaxed">
        <section>
          <h2 className="text-2xl font-semibold text-gray-900 mb-3">
            1. Introduction
          </h2>
          <p>
            At <strong>Hospeniel</strong>, we value your privacy and are
            committed to protecting your personal information. This Privacy
            Policy explains how we collect, use, and protect your information
            when you use our website, mobile app, or services.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-gray-900 mb-3">
            2. Information We Collect
          </h2>
          <p>
            We collect personal and non-personal information to enhance your
            experience and ensure smooth service delivery. This includes:
          </p>
          <ul className="list-disc ml-6 mt-2 space-y-1">
            <li>
              <strong>Personal Information:</strong> Name, email, phone number,
              billing address, and payment details.
            </li>
            <li>
              <strong>Account Information:</strong> Login credentials and
              preferences.
            </li>
            <li>
              <strong>Usage Data:</strong> Device information, IP address,
              browser type, and pages visited.
            </li>
            <li>
              <strong>Cookies:</strong> Small files stored on your device to
              improve site functionality and analytics.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-gray-900 mb-3">
            3. How We Use Your Information
          </h2>
          <p>Your data is used to:</p>
          <ul className="list-disc ml-6 mt-2 space-y-1">
            <li>Provide, maintain, and improve our services.</li>
            <li>Process payments and manage orders securely.</li>
            <li>Personalize your user experience.</li>
            <li>Send important notifications, updates, and offers.</li>
            <li>Ensure compliance with legal and regulatory obligations.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-gray-900 mb-3">
            4. Data Protection and Security
          </h2>
          <p>
            We use industry-standard encryption and authentication tools to
            protect your data from unauthorized access, alteration, or
            disclosure. However, no online platform can guarantee 100% security.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-gray-900 mb-3">
            5. Sharing Your Information
          </h2>
          <p>
            We do not sell or rent your personal data. We may share your
            information only with:
          </p>
          <ul className="list-disc ml-6 mt-2 space-y-1">
            <li>
              <strong>Service Providers:</strong> Payment processors, delivery
              partners, or analytics tools that help us operate efficiently.
            </li>
            <li>
              <strong>Legal Authorities:</strong> When required by law or in
              response to valid legal requests.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-gray-900 mb-3">
            6. Your Rights
          </h2>
          <p>You have the right to:</p>
          <ul className="list-disc ml-6 mt-2 space-y-1">
            <li>Access, update, or delete your personal information.</li>
            <li>Withdraw consent for marketing communications.</li>
            <li>Request a copy of the data we hold about you.</li>
            <li>Opt out of cookies through your browser settings.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-gray-900 mb-3">
            7. Third-Party Links
          </h2>
          <p>
            Our platform may contain links to external websites. We are not
            responsible for the privacy practices or content of such third
            parties. Please review their policies before providing any personal
            data.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-gray-900 mb-3">
            8. Updates to This Policy
          </h2>
          <p>
            Hospeniel may update this Privacy Policy occasionally to reflect
            changes in our practices. Updates will be posted on this page with a
            revised “Last Updated” date.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-gray-900 mb-3">
            9. Contact Us
          </h2>
          <p>
            If you have any questions or concerns about this Privacy Policy or
            how your information is handled, please contact us at:
          </p>
          <ul className="mt-2">
            <li>
              📧 Email:{" "}
              <a
                href="mailto:support@hospeniel.com"
                className="text-indigo-600 hover:underline"
              >
                support@hospeniel.com
              </a>
            </li>
            <li>📍 Address: 45 Healthway Avenue, Lagos, Nigeria</li>
          </ul>
        </section>

        {/* Back Button */}
        <div className="text-center mt-16">
          <Link href="/explore">
            <Button className="rounded-full bg-indigo-600 text-white px-8 py-3 hover:bg-indigo-700 transition-all">
              Back to Explore
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
