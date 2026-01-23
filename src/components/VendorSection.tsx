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
      "Connect with food lovers in your area and beyond. Our marketplace puts your offerings in front of thousands of hungry customers, helping you grow your sales effortlessly.",
  },
  {
    icon: <FaChartLine className="w-6 h-6" />,
    title: "Boost Your Visibility",
    description:
      "Get featured on our Explore page and priority listings to stand out from the competition. Increase engagement, attract new customers, and make your brand unforgettable.",
  },
  {
    icon: <FaRocket className="w-6 h-6" />,
    title: "Promote With Ease",
    description:
      "Showcase your dishes, baked goods, or specialties with just a few clicks. Upload menus, highlight your best items, and let our platform handle the promotion for you.",
  },
  {
    icon: <FaUsers className="w-6 h-6" />,
    title: "Join a Growing Network",
    description:
      "Be part of a community of top food vendors, chefs, bakers, and pastry sellers. Collaborate, learn, and expand your business while gaining credibility and trust among customers.",
  },
];

const VendorSection: React.FC = () => {
  return (
    <section id="listing" className="py-16 bg-hospineil-base-bg px-6 md:px-20">
      <div className="text-center mb-12">
        <h2 className="text-3xl font-bold font-header">Become a Listed Vendor</h2>
      <p className="mt-4 text-lg text-gray-800 font-body">
        Join our vibrant marketplace and showcase your culinary talents! Whether you’re a chef, home cook, baker, or pastry seller, our platform helps you gain visibility, reach more customers, and grow your business. Get listed, share your creations, and let hungry customers find you easily!
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
