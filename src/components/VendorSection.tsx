"use client";

import React from "react";
import { motion } from "framer-motion";
import { FaStore, FaChartLine, FaRocket, FaUsers } from "react-icons/fa";

interface VendorPoint {
  title: string;
  description: string;
  icon: React.ReactNode;
}

const vendorPoints: VendorPoint[] = [
  {
    icon: <FaStore className="w-6 h-6" />,
    title: "Reach More Customers",
    description:
      "List your business where users are already looking for top-rated places to eat, drink, and stay.",
  },
  {
    icon: <FaChartLine className="w-6 h-6" />,
    title: "Boost Your Visibility",
    description:
      "Appear in searches, get featured in categories, and grow your reputation with reviews.",
  },
  {
    icon: <FaRocket className="w-6 h-6" />,
    title: "Promote with Ease",
    description:
      "Run special offers, discounts, and track engagement with your listing.",
  },
  {
    icon: <FaUsers className="w-6 h-6" />,
    title: "Join a Growing Network",
    description:
      "Be part of a thriving community of trusted vendors across cities.",
  },
];

const VendorSection: React.FC = () => {
  return (
    <section id="listing" className="py-16 bg-hospineil-base-bg px-6 md:px-20">
      <div className="text-center mb-12">
        <h2 className="text-3xl font-bold font-header">Become a Listed Vendor</h2>
      <p className="mt-4 text-lg text-gray-800 font-body">
      Are you a <span className="font-semibold text-hospineil-primary">Food Vendor</span>, 
     <span className="font-semibold text-hospineil-accent"> Chef</span>, 
     <span className="font-semibold text-hospineil-primary"> Baker</span>, or 
     <span className="font-semibold text-hospineil-accent"> Pastry Expert</span>?  
     Get discovered by thousands of users actively searching for your services.
</p>
    
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-2 gap-8">
        {vendorPoints.map((point, index) => (
          <motion.div
            key={index}
            className="flex items-start bg-white rounded-2xl p-6 shadow-md hover:shadow-lg transition-all duration-300 hover:scale-105"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: index * 0.1 }}
          >
            <motion.div 
              className={`mr-4 ${index % 2 === 0 ? "text-hospineil-primary" : "text-hospineil-accent"}`}
              initial={{ opacity: 0, scale: 0, rotate: -180 }}
              whileInView={{ opacity: 1, scale: 1, rotate: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ 
                type: "spring", 
                stiffness: 200, 
                damping: 15,
                delay: index * 0.1 + 0.2 
              }}
              whileHover={{ 
                scale: 1.3, 
                rotate: [0, -15, 15, -15, 0],
                transition: { duration: 0.6 }
              }}
            >
              {point.icon}
            </motion.div>
            <div>
              <h4 className="text-lg font-semibold text-gray-800 font-header">{point.title}</h4>
              <p className="text-sm text-gray-700 mt-1 font-body">{point.description}</p>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="text-center mt-12">
        <button
          onClick={() => window.location.href = "/register"}
          className="flex items-center justify-center px-8 py-3 bg-hospineil-accent text-hospineil-light-bg font-medium rounded-full font-button shadow-lg transition-all duration-300 ease-in-out transform hover:scale-105 hover:shadow-xl hover:bg-hospineil-accent-hover focus:ring-2 focus:ring-hospineil-primary focus:ring-offset-2"
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
    </section>
  );
};

export default VendorSection;
