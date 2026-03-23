"use client";

import Link from "next/link";

export default function AcceptableUsePolicy() {
  return (
    <section className="bg-white text-gray-800">
      <div className="max-w-4xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold mb-6">Acceptable Use Policy</h1>

        <p className="text-sm text-gray-500 mb-8">
          Last updated: {new Date().toLocaleDateString()}
        </p>

        <div className="space-y-8 leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold mb-2">1. Introduction</h2>
            <p>
            Hospeniel (“we”, “our”, “us”) is an online food marketplace connecting customers with independent vendors, including home cooks, chefs, pastry sellers, and food vendors.
            </p>
            <p className="mt-2">
            This Acceptable Use Policy (“Policy”) sets out the rules and standards for using the Hospeniel platform. All vendors, customers, and partners must comply with this Policy. Failure to comply may result in suspension, termination, withholding of funds, or legal action.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">2. Permitted Use</h2>
            <p className="mt-2">
            Users may only use the platform for lawful purposes, including:
            </p>
            <ul className="list-disc list-inside space-y-1">
              <li>Vendors may list and sell only lawful food and beverage products.</li>
              <li>Vendors must provide accurate product descriptions, images, and pricing.</li>
              <li>Vendors must fulfill customer orders as described and in a timely, professional manner.</li>
              <li>Users must communicate respectfully with other users and Hospeniel staff.</li>
              <li>Customers may place orders for personal consumption only and may not use the platform for unlawful purposes..</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">
              3. Prohibited Products and Activities
            </h2>
            <p className="mt-2">
            The following activities and products are strictly prohibited:
            </p>
            <ul className="list-disc list-inside space-y-1">
              <li>Illegal, restricted, or regulated products</li>
              <li>Alcohol, tobacco, drugs, or controlled substances</li>
              <li>Counterfeit, stolen, or pirated goods</li>
              <li>Weapons, explosives, or hazardous materials</li>
              <li>Pornographic or sexually explicit content</li>
              <li>Hate speech, harassment, or abusive conduct</li>
              <li>Fraudulent, deceptive, or misleading practices</li>
              <li>Any activity that violates Nigerian law or regulations</li>
              <li>Circumventing platform security or interfering with its operation.</li>
              <li>
                Any product or activity prohibited under Paystack’s Acceptable
                Use Policy
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">4. Vendor Responsibilities</h2>
            <p className="mt-2">
            Vendors are required to:
            </p>
            <ul className="list-disc list-inside space-y-1">
              <li>Provide accurate and truthful business information during registration.</li>
              <li>Prepare and store food under safe and hygienic conditions, complying with applicable food safety and consumer protection laws.</li>
              <li>Deliver orders as described and on time.</li>
              <li>Disclose allergens and dietary information for listed products.</li>
              <li>Resolve customer complaints promptly and professionally.</li>
              <li>Avoid any fraudulent, deceptive, or misleading activity.</li>
              <li>Provide additional documentation upon request for verification or compliance purposes.</li>
            </ul>
            <p className="mt-2">
              Hospeniel may request additional documentation from vendors when
              necessary.
            </p>
          </section>

          <section>
          <h2 className="text-xl font-semibold mb-2">5. Payment Compliance</h2>
            <p className="mt-2">
            Users may only use the platform for lawful purposes, including:
            </p>
            <ul className="list-disc list-inside space-y-1">
              <li>Vendors and users must comply with Hospeniel’s payment policies, including the rules of payment providers such as Paystack.</li>
              <li>Non-compliance may result in restricted payouts, account suspension, or termination.</li>
              <li>Hospeniel is not responsible for delays or errors caused by payment providers.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">6. Monitoring and Enforcement</h2>
            <ul className="list-disc list-inside space-y-1">
              <li>Hospeniel may conduct manual reviews and ongoing monitoring of vendor and user activity.</li>
              <li>We may suspend, restrict, or terminate accounts, remove listings, withhold funds, or take other interim measures during investigations.</li>
              <li>Hospeniel may report unlawful activity to authorities, payment providers, or other relevant parties as required.</li>
            </ul>
          </section>
          
          <section>
            <h2 className="text-xl font-semibold mb-2">7. Reporting Violations</h2>
            <ul className="list-disc list-inside space-y-1">
              <li>Users may report suspected violations through Hospeniel’s customer support channels..</li>
              <li>All reports will be reviewed promptly and confidentially, and appropriate action will be taken.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">
              8. Changes to This Policy
            </h2>
            <p>
            Hospeniel may update this Policy at any time. Continued use of the platform constitutes acceptance of any changes.
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
