"use client";
import { MdEmail, MdPhone } from "react-icons/md";

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-6 flex justify-center">
      <div className="max-w-4xl bg-white shadow-md rounded-2xl p-10 leading-relaxed">
        <h1 className="text-4xl font-bold text-indigo-700 mb-6 text-center">Hospeniel Privacy Policy</h1>
        <p className="text-gray-600 mb-8 text-center italic">
          Effective Date: October 9, 2025
        </p>

        <section className="space-y-6 text-gray-700">
          <p>
            At <strong>Hospeniel</strong>, your privacy is our top priority. This Privacy Policy explains how we collect, use, disclose, and protect your personal information when you use our website, mobile application, and related services (collectively, the “Platform”).
          </p>

          <h2 className="text-2xl font-semibold text-indigo-600">1. Information We Collect</h2>
          <p>We collect the following categories of information to provide and improve our services:</p>
          <ul className="list-disc ml-6 space-y-2">
            <li>
              <strong>Personal Information:</strong> Includes your name, email address, phone number, contact address, and account details when you create an account or communicate with us.
            </li>
            <li>
              <strong>Payment Information:</strong> Such as debit/credit card details or transaction history, when you make purchases or payments on our platform. All financial transactions are securely processed through third-party providers.
            </li>
            <li>
              <strong>Usage Data:</strong> Includes information about your device, browser type, IP address, and activity on our platform (such as pages visited and time spent).
            </li>
            <li>
              <strong>Cookies and Tracking Technologies:</strong> We use cookies, beacons, and similar technologies to enhance your user experience and analyze website traffic.
            </li>
          </ul>

          <h2 className="text-2xl font-semibold text-indigo-600">2. How We Use Your Information</h2>
          <p>Your information helps us deliver a personalized and seamless experience. We use it to:</p>
          <ul className="list-disc ml-6 space-y-2">
            <li>Provide, maintain, and improve our products and services.</li>
            <li>Process your orders, reservations, and payments.</li>
            <li>Communicate with you about your account or customer support inquiries.</li>
            <li>Send service-related notifications, promotions, and updates (you can opt out anytime).</li>
            <li>Detect, prevent, and investigate fraudulent or illegal activities.</li>
            <li>Comply with legal obligations and enforce our Terms of Service.</li>
          </ul>

          <h2 className="text-2xl font-semibold text-indigo-600">3. How We Share Your Information</h2>
          <p>
            We do not sell or rent your personal data. However, we may share it in the following cases:
          </p>
          <ul className="list-disc ml-6 space-y-2">
            <li>
              <strong>With Service Providers:</strong> We share information with trusted partners who help us operate our business, such as payment processors, analytics providers, and delivery partners.
            </li>
            <li>
              <strong>For Legal Reasons:</strong> We may disclose data when required by law, government authorities, or in response to legal processes.
            </li>
            <li>
              <strong>In Business Transfers:</strong> In case of a merger, acquisition, or sale of assets, your information may be transferred as part of the transaction.
            </li>
          </ul>

          <h2 className="text-2xl font-semibold text-indigo-600">4. Data Security</h2>
          <p>
            We implement robust technical and organizational measures to protect your data from unauthorized access, alteration, or disclosure. However, no online platform is 100% secure, and we cannot guarantee absolute security.
          </p>

          <h2 className="text-2xl font-semibold text-indigo-600">5. Your Rights and Choices</h2>
          <p>You have the right to:</p>
          <ul className="list-disc ml-6 space-y-2">
            <li>Access and request a copy of your personal information.</li>
            <li>Request corrections to inaccurate or outdated information.</li>
            <li>Withdraw consent for certain data uses, where applicable.</li>
            <li>Request deletion of your account and data, subject to legal retention requirements.</li>
          </ul>
          <p>
            To exercise any of these rights, contact us using the information below.
          </p>

          <h2 className="text-2xl font-semibold text-indigo-600">6. Cookies Policy</h2>
          <p>
            We use cookies to improve your browsing experience, analyze website traffic, and personalize content. You can control cookie preferences through your browser settings.
          </p>

          <h2 className="text-2xl font-semibold text-indigo-600">7. Third-Party Links</h2>
          <p>
            Our website may contain links to third-party websites or services. We are not responsible for the content or privacy practices of those third parties, and we encourage you to review their privacy policies.
          </p>

          <h2 className="text-2xl font-semibold text-indigo-600">8. Data Retention</h2>
          <p>
            We retain your personal data only as long as necessary to fulfill the purposes outlined in this Privacy Policy or as required by law.
          </p>

          <h2 className="text-2xl font-semibold text-indigo-600">9. Children’s Privacy</h2>
          <p>
            Hospeniel does not knowingly collect or solicit personal information from anyone under the age of 16. If we learn that a child under 16 has provided us with personal data, we will promptly delete it.
          </p>

          <h2 className="text-2xl font-semibold text-indigo-600">10. Changes to This Policy</h2>
          <p>
            We may update this Privacy Policy periodically. Any changes will be posted on this page with an updated “Effective Date.” We encourage you to review this page regularly to stay informed about how we protect your information.
          </p>

          <h2 className="text-2xl font-semibold text-indigo-600">11. Contact Us</h2>
          <p>
            If you have any questions, complaints, or concerns about this Privacy Policy or our data practices, please contact us:
          </p>

          <div className="mt-4 space-y-2">
            <div className="flex items-center gap-3">
              <MdPhone className="text-indigo-600 text-2xl" />
              <p>+234 8162813032</p>
            </div>
            <div className="flex items-center gap-3">
              <MdEmail className="text-indigo-600 text-2xl" />
              <p>privacy@hospeniel.com</p>
            </div>
          </div>

          <p className="mt-8 text-gray-600 text-center text-sm">
            © {new Date().getFullYear()} Hospeniel. All rights reserved.
          </p>
        </section>
      </div>
    </div>
  );
}
