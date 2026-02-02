export const metadata = {
  title: "Refund Policy | Hospeniel",
  description:
    "Refund Policy for Hospeniel – how refunds, cancellations, and disputes are handled on our food marketplace platform.",
};

export default function RefundPolicyPage() {
  return (
    <main className="bg-white text-gray-800">
      <section className="max-w-4xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold mb-6">Refund Policy</h1>

        <p className="text-sm text-gray-500 mb-8">
          Last updated: {new Date().toLocaleDateString()}
        </p>

        <div className="space-y-8 leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold mb-2">1. Introduction</h2>
            <p>
              Hospeniel is an online food marketplace that connects customers
              with independent third-party food vendors. This Refund Policy
              explains the circumstances under which refunds may be issued and
              how refund requests are handled.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">2. Eligibility for Refunds</h2>
            <p>Customers may be eligible for a refund under the following conditions:</p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>Order was not delivered</li>
              <li>Incorrect or incomplete order was delivered</li>
              <li>Order was canceled before preparation began</li>
              <li>Vendor failed to fulfill the order as described</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">
              3. Non-Refundable Situations
            </h2>
            <p>Refunds may not be issued in the following cases:</p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>Change of mind after order preparation has begun</li>
              <li>Customer provided incorrect delivery details</li>
              <li>Delays caused by circumstances beyond vendor control</li>
              <li>Failure to receive an order due to customer unavailability</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">
              4. Refund Request Process
            </h2>
            <p>
              To request a refund, customers must contact Hospeniel support
              within a reasonable time after the order issue occurs. Requests
              should include order details and a description of the issue.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">
              5. Review and Resolution
            </h2>
            <p>
              All refund requests are reviewed by Hospeniel. We may contact the
              vendor involved to verify order details before making a decision.
              Approved refunds are processed back to the original payment
              method within a reasonable timeframe.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">
              6. Vendor Accountability
            </h2>
            <p>
              Vendors are responsible for fulfilling orders accurately and on
              time. Repeated complaints or confirmed violations may result in
              penalties, suspension, or removal from the platform.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">
              7. Disputes and Chargebacks
            </h2>
            <p>
              In the event of a dispute or chargeback, Hospeniel will investigate
              the issue and work with both the customer and vendor to reach a
              fair resolution. Funds may be temporarily withheld during dispute
              investigations.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">
              8. Changes to This Policy
            </h2>
            <p>
              Hospeniel reserves the right to update this Refund Policy at any
              time. Continued use of the platform constitutes acceptance of the
              updated policy.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">9. Contact Information</h2>
            <p>
              For refund-related questions, contact us at:
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
