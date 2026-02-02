export const metadata = {
  title: "Terms & Conditions | Hospeniel",
  description:
    "Terms & Conditions for Hospeniel – rules, responsibilities, and guidelines for using our food marketplace platform.",
};

export default function TermsAndConditionsPage() {
  return (
    <main className="bg-white text-gray-800">
      <section className="max-w-4xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold mb-6">Terms & Conditions</h1>

        <p className="text-sm text-gray-500 mb-8">
          Last updated: {new Date().toLocaleDateString()}
        </p>

        <div className="space-y-8 leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold mb-2">1. Introduction</h2>
            <p>
              Welcome to Hospeniel, an online food marketplace connecting customers
              with independent third-party vendors. By using our platform, you
              agree to comply with these Terms & Conditions.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">2. Use of the Platform</h2>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>You must be at least 18 years old to use the platform.</li>
              <li>Use the platform for lawful purposes only.</li>
              <li>Do not attempt to disrupt or hack the platform.</li>
              <li>Respect all vendors and customers.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">3. Vendor Responsibilities</h2>
            <p>
              Vendors must provide accurate business information, prepare food
              safely, fulfill orders as described, and comply with applicable
              laws and regulations. Violations may result in account suspension
              or removal.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">4. Payment and Refunds</h2>
            <p>
              All payments are processed securely via our payment partners. Please
              review our Refund Policy for conditions under which refunds may be
              issued.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">5. Intellectual Property</h2>
            <p>
              All content on Hospeniel, including text, images, logos, and code,
              is owned by Hospeniel or its partners. You may not use or reproduce
              any content without permission.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">6. Limitation of Liability</h2>
            <p>
              Hospeniel is not responsible for the acts or omissions of vendors.
              We do not guarantee product quality, delivery times, or accuracy
              of vendor information. Use of the platform is at your own risk.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">7. Changes to Terms</h2>
            <p>
              Hospeniel may update these Terms & Conditions at any time. Continued
              use of the platform constitutes acceptance of updated terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">8. Contact Information</h2>
            <p>
              Questions regarding these terms can be sent to:
              <br />
              <strong>Email:</strong> support@hospeniel.com
              <br />
              <strong>Website:</strong> https://www.hospeniel.com
            </p>
          </section>
        </div>
      </section>
    </main>
  );
}
