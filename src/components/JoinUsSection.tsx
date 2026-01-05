"use client";

import React from "react";

const JoinUsSection: React.FC = () => {
  return (
    <section id="join" className="py-12 px-6 text-gray-800 bg-hospineil-base-bg relative overflow-hidden">
      <div className="max-w-4xl mx-auto text-center">
        <h2 className="text-3xl font-bold font-header">Join Us Today</h2>
        <p className="mt-4 text-lg font-body">
          Sign up now and start discovering amazing places instantly. Enjoy exclusive offers and curated recommendations.
        </p>
        <div className="mt-8">
          <button
            onClick={() => window.location.href='/register'}
            className="flex items-center justify-center px-8 py-3 bg-hospineil-accent text-hospineil-light-bg font-medium rounded-full shadow-lg transition-all duration-300 ease-in-out transform hover:scale-105 hover:shadow-xl hover:bg-hospineil-accent-hover focus:ring-2 focus:ring-hospineil-primary focus:ring-offset-2 font-button"
          >
            Sign Up
            <svg
              className="w-5 h-5 ml-2"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3"></path>
            </svg>
          </button>
        </div>
        <div className="mt-6">
          <p className="text-sm italic font-body text-gray-600">
            Join thousands of happy explorers and get early access to the best deals!
          </p>
        </div>
      </div>
    </section>
  );
};

export default JoinUsSection;
