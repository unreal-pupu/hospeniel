"use client";

import { useState } from "react";
import { FiPlus, FiMinus } from "react-icons/fi";

interface FAQItem {
  question: string;
  answer: string;
}

const faqData: FAQItem[] = [
  {
    question: "How do I place an order on Hospineil?",
    answer: "To place an order, simply browse through our vendors, select the items you want, add them to your cart, and proceed to checkout. You can pay securely using various payment methods available on our platform."
  },
  {
    question: "Can I hire a chef for a private event?",
    answer: "Yes! Hospineil offers professional chef hiring services for private dining experiences, events, and catering. Browse our chef profiles, check their specialties and availability, then book directly through the platform."
  },
  {
    question: "What delivery options are available?",
    answer: "We offer multiple delivery options including standard delivery, express delivery, and no-contact delivery. Delivery times and fees vary by vendor and location. You can track your order in real-time through your account dashboard."
  },
  {
    question: "How can vendors join the platform?",
    answer: "Vendors can join Hospineil by signing up through our vendor registration page. After submitting your business details and verification documents, our team will review your application and get you set up on the platform."
  },
  {
    question: "What payment methods do you accept?",
    answer: "We accept various payment methods including credit cards, debit cards, mobile money, and bank transfers. All transactions are processed securely through our encrypted payment gateway to ensure your financial information is protected."
  }
];

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggleQuestion = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section id="faq" className="py-16 px-6 bg-hospineil-base-bg">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-header italic tracking-wide capitalize mb-4">
            Frequently Asked Questions
          </h2>
          <p className="text-lg text-gray-800 font-body">
            Find answers to common questions about our platform
          </p>
        </div>

        <div className="space-y-4">
          {faqData.map((item, index) => (
            <div
              key={index}
              className="bg-hospineil-light-bg border border-transparent rounded-2xl shadow-md overflow-hidden transition-all duration-300 hover:shadow-lg hover:border-hospineil-primary"
            >
              <button
                onClick={() => toggleQuestion(index)}
                className="w-full px-6 py-5 flex items-center justify-between text-left focus:outline-none focus:ring-2 focus:ring-hospineil-primary focus:ring-offset-2 rounded-xl"
                aria-expanded={openIndex === index}
              >
                <span className="text-lg font-semibold text-gray-800 font-header pr-4">
                  {item.question}
                </span>
                <div className="flex-shrink-0">
                  {openIndex === index ? (
                    <FiMinus className="w-6 h-6 text-hospineil-accent" />
                  ) : (
                    <FiPlus className="w-6 h-6 text-hospineil-accent" />
                  )}
                </div>
              </button>

              {openIndex === index && (
                <div className="px-6 pb-5 pt-0">
                  <div className="border-t border-gray-300 pt-4">
                    <p className="text-gray-800 leading-relaxed font-body">
                      {item.answer}
                    </p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

