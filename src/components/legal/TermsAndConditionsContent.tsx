import Link from "next/link";

interface TermsAndConditionsContentProps {
  showVendorBackButton?: boolean;
}

export function TermsAndConditionsContent({
  showVendorBackButton = false,
}: TermsAndConditionsContentProps) {
  return (
    <main className="bg-white text-gray-800">
      <section className="max-w-4xl mx-auto px-4 py-12">
        <div className="mb-6 flex items-center justify-between gap-3 flex-wrap">
          <h1 className="text-3xl font-bold">Terms & Conditions</h1>
          {showVendorBackButton && (
            <Link
              href="/vendor/dashboard"
              className="inline-flex items-center rounded-md bg-hospineil-primary px-4 py-2 text-sm font-semibold text-white hover:bg-hospineil-primary/90 transition-colors"
            >
              Back to Dashboard Overview
            </Link>
          )}
        </div>

        <p className="text-sm text-gray-500 mb-8">
          Last updated: {new Date().toLocaleDateString()}
        </p>

        <div className="space-y-8 leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold mb-2">1. Introduction</h2>
            <p>
              Welcome to Hospeniel, a digital marketplace connecting customers with independent
              vendors, including home cooks, chefs, pastry sellers, and food vendors. By accessing
              or using our platform, you agree to be bound by these Terms of Service. If you do
              not agree, you may not use the platform.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">2. Eligibility & Accounts</h2>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>You must be at least 18 years old to use the platform.</li>
              <li>You are responsible for maintaining the confidentiality of your account credentials.</li>
              <li>You are responsible for all activity under your account.</li>
              <li>Vendors must provide accurate business information during registration.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">3.Platform Role</h2>
            <p>
              Hospeniel acts solely as an intermediary platform connecting customers with
              independent vendors.
            </p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>Hospeniel does not sell products directly.</li>
              <li>
                Vendors are fully responsible for the quality, safety, preparation, and fulfillment
                of their orders.
              </li>
              <li>
                Any disputes between vendors and customers must follow our dispute resolution
                process.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">4.Orders & Transactions</h2>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>Orders are agreements between the customer and the vendor.</li>
              <li>Payments are processed securely via third-party providers, including Paystack.</li>
              <li>
                Hospeniel may facilitate payments, but cannot guarantee product quality, delivery
                times, or vendor compliance.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">5.Fees & Payments</h2>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>
                Hospeniel charges a 2% commission on each completed order, deducted automatically
                before vendor payouts.
              </li>
              <li>Vendors must provide valid bank account information to receive payouts.</li>
              <li>
                Payouts may be delayed if vendor accounts are unverified or if payments are under
                review.
              </li>
              <li>Hospeniel reserves the right to update fees or payment terms with prior notice..</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">6. Vendor Responsibilities</h2>
            <p>Vendors must:</p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>Provide accurate and up-to-date business information.</li>
              <li>
                Prepare food safely and comply with all applicable food safety, hygiene, and
                licensing regulations.
              </li>
              <li>Fulfill orders as described and deliver on time.</li>
              <li>Respond promptly to customer inquiries and complaints.</li>
            </ul>
            <p>Failure to comply may result in account suspension or termination.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">7. Refunds & Disputes</h2>
            <p>Refunds may be issued in cases including, but not limited to:</p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>Order not delivered.</li>
              <li>Incorrect or incomplete order</li>
              <li>Poor quality or unsafe food</li>
              <li>Hospeniel will investigate disputes and determine the appropriate resolution.</li>
              <li>Vendors and customers must cooperate with Hospeniel’s dispute process.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">8.Prohibited Use</h2>
            <p>You may not:</p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>Violate any applicable laws or regulations.</li>
              <li>Disrupt or interfere with the platform’s operation.</li>
              <li>Use the platform to commit fraud, phishing, or other malicious activity.</li>
              <li>Hospeniel will investigate disputes and determine the appropriate resolution.</li>
              <li>Misrepresent yourself, your business, or your products.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">9. Account Suspension & Termination</h2>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>
                All content on Hospeniel, including text, images, logos, and code, is owned by
                Hospeniel or its partners.
              </li>
              <li>You may not use or reproduce any content without express permission.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">10. Intellectual Property</h2>
            <p>Hospeniel may suspend or terminate accounts that:</p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>Violate these Terms of Service</li>
              <li>Engage in fraudulent or harmful activity</li>
              <li>Pose risks to the platform, customers, or other vendors</li>
              <li>Fail to comply with payment or verification requirements</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">11. Limitation of Liability</h2>
            <p>Hospeniel may suspend or terminate accounts that:</p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>Hospeniel is not liable for the acts or omissions of vendors.</li>
              <li>We do not guarantee product quality, delivery times, or vendor accuracy.</li>
              <li>Use of the platform is at your own risk.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">12. Changes to Terms</h2>
            <p>
              Hospeniel may update these Terms of Service at any time. Continued use of the
              platform constitutes acceptance of the updated terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">13. Contact Information</h2>
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
