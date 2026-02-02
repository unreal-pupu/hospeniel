"use client";

import Link from "next/link";

export default function AcceptableUsePolicy() {
  return (
    <section className="bg-white text-gray-800">
      <div className="max-w-4xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold mb-6">Acceptable Use Policy</h1>

        {/* <p className="text-sm text-gray-500 mb-8">
          Last updated: {new Date().toLocaleDateString()}
        </p> */}

        <div className="space-y-8 leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold mb-2">1. Introduction</h2>
            <p>
              Hospeniel (“we”, “our”, “us”) is an online food marketplace that
              connects customers with independent third-party food vendors. This
              Acceptable Use Policy (“Policy”) outlines the activities, products,
              and conduct that are permitted and prohibited on our platform.
            </p>
            <p className="mt-2">
              All vendors, users, and partners are required to comply with this
              Policy. Failure to do so may result in suspension or termination of
              access to the platform.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">2. Permitted Use</h2>
            <ul className="list-disc list-inside space-y-1">
              <li>List and sell lawful food and beverage products</li>
              <li>Provide accurate descriptions of products and pricing</li>
              <li>Fulfill customer orders in a timely and professional manner</li>
              <li>Communicate respectfully with customers and Hospeniel staff</li>
            </ul>
            <p className="mt-2">
              Customers may place orders for personal consumption and use the
              platform for lawful purposes only.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">
              3. Prohibited Products and Activities
            </h2>
            <ul className="list-disc list-inside space-y-1">
              <li>Illegal, restricted, or regulated products</li>
              <li>Alcohol, tobacco, drugs, or controlled substances</li>
              <li>Counterfeit, stolen, or pirated goods</li>
              <li>Weapons, explosives, or hazardous materials</li>
              <li>Pornographic or sexually explicit content</li>
              <li>Hate speech, harassment, or abusive conduct</li>
              <li>Fraudulent, deceptive, or misleading practices</li>
              <li>Any activity that violates Nigerian law or regulations</li>
              <li>
                Any product or activity prohibited under Paystack’s Acceptable
                Use Policy
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">4. Vendor Responsibilities</h2>
            <ul className="list-disc list-inside space-y-1">
              <li>Provide accurate and truthful business information</li>
              <li>Prepare food under hygienic conditions</li>
              <li>Comply with food safety and consumer protection laws</li>
              <li>Deliver orders as described and on time</li>
              <li>Resolve customer complaints promptly</li>
              <li>Avoid fraudulent or misleading activity</li>
            </ul>
            <p className="mt-2">
              Hospeniel may request additional documentation from vendors when
              necessary.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">
              5. Monitoring and Enforcement
            </h2>
            <p>
              We conduct manual reviews and ongoing monitoring of vendor
              activity. Hospeniel reserves the right to suspend or terminate
              accounts, remove prohibited listings, withhold settlements during
              investigations, and report unlawful activity where required.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">6. Reporting Violations</h2>
            <p>
              Violations may be reported through our customer support channels
              and are reviewed promptly.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">
              7. Changes to This Policy
            </h2>
            <p>
              We may update this Policy at any time. Continued use of the
              platform constitutes acceptance of the updated Policy.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">8. Contact Information</h2>
            <p>
              Email: <span className="font-medium">support@hospeniel.com</span>
              <br />
              Website:{" "}
              <Link
                href="https://www.hospeniel.com"
                className="text-blue-600 underline"
              >
                https://www.hospeniel.com
              </Link>
            </p>
          </section>
        </div>
      </div>
    </section>
  );
}
